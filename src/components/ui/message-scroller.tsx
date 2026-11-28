"use client"

import * as React from "react"
import { flushSync } from "react-dom"
import {
  MessageScroller as MessageScrollerPrimitive,
  useMessageScroller as useMessageScrollerPrimitive,
  useMessageScrollerScrollable,
  useMessageScrollerVisibility,
} from "@/lib/message-scroller-primitive"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown02Icon } from "@hugeicons/core-free-icons"

// agentui: keep the place scrollToMessage, scrollToEnd or the default
// position "end" scrolled to while the content settles or grows.
// @shadcn/react 0.3.1 scrolls once; then messages render at their real
// height instead of the content-visibility estimate, images load and, at
// the end, more content comes, and the place moves away (several messages,
// on a fresh mount in Chromium). Without autoScroll the end was left too.
function createPin() {
  let viewport: HTMLDivElement | null = null
  let unpin: (() => void) | null = null
  let moved: (() => void) | null = null
  return {
    viewport: () => viewport,
    /**
     * After a pin scrolled in an animation frame, whose scroll event comes
     * only after that frame is drawn: what it brought near is mounted.
     */
    moved: () => moved?.(),
    onMoved: (next: (() => void) | null) => {
      moved = next
    },
    setViewport: (node: HTMLDivElement | null) => {
      viewport = node
    },
    /** Ends the current pin, if any, and makes `next` the current one. */
    start: (next: () => void) => {
      unpin?.()
      unpin = next
    },
    ended: (done: () => void) => {
      if (unpin === done) unpin = null
    },
    end: () => unpin?.(),
  }
}

type MessageScrollerPin = ReturnType<typeof createPin>

const MessageScrollerPinContext = React.createContext<{
  pin: MessageScrollerPin
  /** The end is held, as autoScroll does not follow it. */
  holdsEnd: boolean
  /** The default position is the end. */
  startsAtEnd: boolean
} | null>(null)

// agentui: a long conversation's messages are windowed. Each item stays
// in the content, at its height, so the scroller's geometry, anchors and
// jumps work on it as before; only the content of those far from the view
// is unmounted, a box of their last measured height in its place (10rem
// before they are first measured). An item mounts within a view of the
// viewport and unmounts past three, so a scroll back and forth does not
// mount and unmount it; one holding the focus or the selection stays. While
// all are asked for (a find searching the conversation's text), all mount.
//
// The observers tell of an intersection after the frame they saw it in is
// drawn, and the item mounts in a later one: a fast scroll (a fling, the
// scrollbar dragged, a jump to a message, a conversation opened at one)
// outran them, and what came into view was drawn as empty boxes for a
// frame or more. A frame whose scroll outran them mounts at once
// (flushSync), before its layout and paint, the boxes within a view of
// the viewport, found by halving over the rows. The observers still
// mount the rest and unmount.
const windowNear = "100% 0px"
const windowFar = "300% 0px"
/** How many messages from the end it opens at mount at once. */
const windowStart = 12

type WindowedItem = {
  near: () => void
  far: () => void
  size: (height: number) => void
}

/**
 * Each target's last entry of a batch: a busy main thread hands an
 * observer several frames' at once (out, then in), and the far one,
 * taking a stale "out" after the near one's "in", would unmount an item
 * the near one, still intersecting, never tells of again.
 */
const latest = (entries: IntersectionObserverEntry[]) =>
  new Map(entries.map((entry) => [entry.target, entry])).values()

/**
 * The rows from the first whose bottom is past `from` to the last whose
 * top is before `to`, found by halving: rows are in order down the
 * content, so a scroll reads a few rects, not every row's.
 */
function* rowsBetween(content: Element, from: number, to: number) {
  const rows = content.children
  let count = rows.length
  // The primitive's spacer, last, hidden while not needed (no rect then).
  if (rows[count - 1]?.hasAttribute("data-message-scroller-spacer")) count -= 1
  let low = 0
  let high = count
  while (low < high) {
    const middle = (low + high) >> 1
    if (rows[middle]!.getBoundingClientRect().bottom > from) high = middle
    else low = middle + 1
  }
  for (let index = low; index < count; index++) {
    const row = rows[index]!
    if (row.getBoundingClientRect().top >= to) return
    yield row
  }
}

function createWindowing(viewport: () => HTMLElement | null) {
  const items = new Map<Element, WindowedItem>()
  // The items whose content is not mounted, by element: how to mount each.
  const boxes = new Map<Element, () => void>()
  let near: IntersectionObserver | null = null
  let far: IntersectionObserver | null = null
  let sizes: ResizeObserver | null = null
  let all = 0
  const listeners = new Set<() => void>()

  // Boxes come near together (a jump, or boxes of 10rem, never measured,
  // many in a view): they mount nearest first, one at a time, each laid
  // out before the rest are looked at again, so those it pushed out of
  // reach do not mount. A long answer (thousands of paragraphs) takes the
  // place of five boxes; all six mounting in one task held the page for
  // the five it pushed away. Those in view mount at once, before the
  // frame is drawn; past a few milliseconds, the rest a frame later each.
  // Each queued box, and whether it may have moved since it was queued
  // (one mounted since, or a frame passed).
  const queued = new Map<Element, boolean>()
  // The rest's turn: in the task after the next frame is drawn, as an
  // observer's (in the frame, its reads would force a layout before the
  // frame's own).
  let later = 0
  let laterTask: ReturnType<typeof setTimeout> | undefined
  const after = () => {
    later = window.requestAnimationFrame(() => {
      later = 0
      laterTask = setTimeout(() => settle())
    })
  }
  const cancel = () => {
    window.cancelAnimationFrame(later)
    clearTimeout(laterTask)
    later = 0
    laterTask = undefined
  }
  const settle = (budget = true) => {
    laterTask = undefined
    const root = viewport()
    if (!root || all > 0) {
      // All mount anyway (or nothing to measure by): as they came.
      const mount = [...queued.keys()].flatMap((row) => boxes.get(row) ?? [])
      queued.clear()
      if (mount.length > 0) flushSync(() => mount.forEach((box) => box()))
      return
    }
    const start = performance.now()
    let mounted = 0
    while (queued.size > 0) {
      const view = root.getBoundingClientRect()
      let nearest: Element | null = null
      let distance = Infinity
      for (const [row, moved] of queued) {
        const rect = row.isConnected && row.getBoundingClientRect()
        const away = rect
          ? Math.max(view.top - rect.bottom, rect.top - view.bottom, 0)
          : Infinity
        // Pushed out of the near observer's reach (a view past the
        // viewport) by one mounted since, or mounted itself: the observer
        // tells again if it comes near. Else as near as it was told.
        if (!boxes.has(row)) queued.delete(row)
        else if (moved && away > view.height + 2) {
          queued.delete(row)
          // Asked again of the observer, as the page is laid out next:
          // what it says then counts, not this read (a scroll anchored
          // after it may bring the row back).
          near?.unobserve(row)
          near?.observe(row)
        }
        else if (away < distance) {
          distance = away
          nearest = row
        }
      }
      if (!nearest) return
      // At least the nearest each turn, so each turn gets on.
      if (
        budget &&
        distance > 0 &&
        mounted > 0 &&
        performance.now() - start > 4
      ) {
        // By then the reader may have scrolled them away too.
        for (const row of queued.keys()) queued.set(row, true)
        after()
        return
      }
      queued.delete(nearest)
      flushSync(boxes.get(nearest)!)
      mounted += 1
      for (const row of queued.keys()) queued.set(row, true)
    }
  }
  const queue = (row: Element) => {
    queued.set(row, false)
    cancel()
  }

  /** Mounts the boxes within a view of the viewport, before it is drawn. */
  const reveal = () => {
    const root = viewport()
    const content = root?.firstElementChild
    if (boxes.size === 0 || all > 0 || !root || !content) return
    const view = root.getBoundingClientRect()
    for (const row of rowsBetween(
      content,
      view.top - view.height,
      view.bottom + view.height
    ))
      if (boxes.has(row)) queue(row)
    // In the frame, before its paint: all in reach, as the scroll may be
    // anchored again before the frame is drawn.
    settle(false)
  }
  // Looked for only where a frame's scroll outran the near observer: by
  // half a view or more since the frame before (where it last looked), as
  // the observer, a view ahead, mounts in a frame or two. A wheel's or a
  // finger's scroll reads no rect before the frame's layout, where a
  // message just mounted would force one.
  let top = 0
  let height = 0
  let seen: number | null = null
  const check = () => {
    if (seen === null || Math.abs(top - seen) >= height / 2) reveal()
    seen = top
  }
  // Once a frame, not on every scroll event (a trackpad gives several):
  // in an animation frame, which the frame's scroll events come before
  // and its style, layout and paint after.
  let frame = 0
  let scrolled: HTMLElement | null = null
  const onScroll = () => {
    if (!scrolled || boxes.size === 0) return
    top = scrolled.scrollTop
    height = scrolled.clientHeight
    frame ||= window.requestAnimationFrame(() => {
      frame = 0
      check()
    })
  }

  const start = () => {
    const root = viewport()
    if (near || !root || typeof IntersectionObserver === "undefined") return
    near = new IntersectionObserver(
      (entries) => {
        for (const entry of latest(entries))
          if (!entry.isIntersecting) continue
          else if (boxes.has(entry.target)) queue(entry.target)
          else items.get(entry.target)?.near()
        if (queued.size > 0) settle()
      },
      { root, rootMargin: windowNear }
    )
    far = new IntersectionObserver(
      (entries) => {
        for (const entry of latest(entries))
          if (!entry.isIntersecting) items.get(entry.target)?.far()
      },
      { root, rootMargin: windowFar }
    )
    sizes = new ResizeObserver((entries) => {
      for (const entry of entries)
        items
          .get(entry.target)
          ?.size(
            entry.borderBoxSize?.[0]?.blockSize ??
              entry.target.getBoundingClientRect().height
          )
    })
  }

  return {
    /**
     * Marks an item's content not mounted until the returned function is
     * called, `mount` mounting it.
     */
    box(element: Element, mount: () => void) {
      boxes.set(element, mount)
      return () => {
        if (boxes.get(element) === mount) boxes.delete(element)
      }
    },
    /** After a scroll in an animation frame, its event a frame later. */
    moved() {
      const root = viewport()
      if (!root || boxes.size === 0) return
      top = root.scrollTop
      height = root.clientHeight
      check()
    },
    /**
     * Watches the viewport's scroll; as its ref is set, before the items'
     * layout effects and the first scroll.
     */
    attach(root: HTMLElement | null) {
      if (root === scrolled) return
      scrolled?.removeEventListener("scroll", onScroll)
      root?.addEventListener("scroll", onScroll, { passive: true })
      scrolled = root
    },
    /** Watches an item; without observers to window by, it is near. */
    observe(element: HTMLElement, item: WindowedItem) {
      watchSelection()
      start()
      if (!near || !far || !sizes) {
        item.near()
        return () => {}
      }
      items.set(element, item)
      near.observe(element)
      far.observe(element)
      sizes.observe(element)
      return () => {
        items.delete(element)
        near?.unobserve(element)
        far?.unobserve(element)
        sizes?.unobserve(element)
      }
    },
    /** Mounts every item until the returned function is called. */
    showAll() {
      all += 1
      if (all === 1) listeners.forEach((listener) => listener())
      return () => {
        all -= 1
        if (all === 0) listeners.forEach((listener) => listener())
      }
    },
    allShown: () => all > 0,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    stop() {
      near?.disconnect()
      far?.disconnect()
      sizes?.disconnect()
      scrolled?.removeEventListener("scroll", onScroll)
      window.cancelAnimationFrame(frame)
      cancel()
      frame = 0
      queued.clear()
      near = far = sizes = scrolled = null
      items.clear()
      boxes.clear()
    },
  }
}

type MessageScrollerWindowing = ReturnType<typeof createWindowing>

const MessageScrollerWindowContext = React.createContext<{
  windowing: MessageScrollerWindowing
  startsAtEnd: boolean
} | null>(null)

/** Within `count` items of its end, in the direction it opens from. */
function nearItsEnd(element: Element, atEnd: boolean, count: number) {
  let rows = 0
  for (
    let row = atEnd ? element.nextElementSibling : element.previousElementSibling;
    row;
    row = atEnd ? row.nextElementSibling : row.previousElementSibling
  ) {
    if (!row.hasAttribute("data-message-scroller-spacer")) rows += 1
    if (rows >= count) return false
  }
  return true
}

// Whether the page has a selection, kept as it changes: the far observer
// asks of every item leaving the window, and reading the selection there
// made the browser lay out the page again first (the scroller had just
// rendered), at every step of a scroll.
let selecting = false
let watchingSelection = false

function watchSelection() {
  if (watchingSelection || typeof document === "undefined") return
  watchingSelection = true
  document.addEventListener("selectionchange", () => {
    const selection = document.getSelection()
    selecting =
      selection !== null && selection.rangeCount > 0 && !selection.isCollapsed
  })
}

/** Holds the focus or the selection, so it stays mounted. */
function inUse(element: Element) {
  if (element.contains(document.activeElement)) return true
  if (!selecting) return false
  const selection = document.getSelection()
  return Boolean(
    selection &&
      selection.rangeCount > 0 &&
      !selection.isCollapsed &&
      (element.contains(selection.anchorNode) ||
        element.contains(selection.focusNode))
  )
}

// The keys @shadcn/react takes as the reader scrolling.
const scrollKeys = new Set([
  "ArrowDown",
  "ArrowUp",
  "End",
  "Home",
  "PageDown",
  "PageUp",
  " ",
])

/** How long the content must not change size before a message's pin ends. */
const settleTime = 500

/**
 * Scrolls again with `scroll` whenever the content changes size, until the
 * reader scrolls (by wheel, touch, keys or otherwise), another pin starts,
 * or, given `settle`, the content has not changed size for that long.
 */
function hold(
  pin: MessageScrollerPin,
  scroll: () => void,
  { settle, toEnd = false }: { settle?: number; toEnd?: boolean } = {}
) {
  const viewport = pin.viewport()
  const content = viewport?.firstElementChild
  if (!viewport || !content || typeof ResizeObserver === "undefined") return

  let frame = 0
  let timeout = settle === undefined ? 0 : window.setTimeout(unpin, settle)
  // Where it last put the viewport, and the content's height then: a
  // scroll elsewhere while the height is the same is not the pin's, nor a
  // correction for a size change, so the reader's (a script, a scrollbar
  // drag) and it ends the pin.
  let at = viewport.scrollTop
  let height = viewport.scrollHeight
  const observer = new ResizeObserver(() => {
    window.cancelAnimationFrame(frame)
    frame = window.requestAnimationFrame(() => {
      scroll()
      pin.moved()
      at = viewport.scrollTop
      height = viewport.scrollHeight
    })
    if (settle === undefined) return
    window.clearTimeout(timeout)
    timeout = window.setTimeout(unpin, settle)
  })
  function onKeyDown(event: KeyboardEvent) {
    if (scrollKeys.has(event.key)) unpin()
  }
  function onScroll() {
    if (viewport!.scrollHeight !== height) return
    const top = viewport!.scrollTop
    // Holding the end, a scroll on toward it (a smooth one under way) is
    // not away from it.
    if (toEnd && top >= at) at = top
    else if (Math.abs(top - at) > 1) unpin()
  }
  function unpin() {
    observer.disconnect()
    window.cancelAnimationFrame(frame)
    window.clearTimeout(timeout)
    viewport!.removeEventListener("wheel", unpin)
    viewport!.removeEventListener("touchmove", unpin)
    viewport!.removeEventListener("pointerdown", unpin)
    viewport!.removeEventListener("keydown", onKeyDown)
    viewport!.removeEventListener("scroll", onScroll)
    pin.ended(unpin)
  }

  // The reader scrolling ends it.
  viewport.addEventListener("wheel", unpin, { passive: true })
  viewport.addEventListener("touchmove", unpin, { passive: true })
  viewport.addEventListener("pointerdown", unpin)
  viewport.addEventListener("keydown", onKeyDown)
  viewport.addEventListener("scroll", onScroll, { passive: true })
  observer.observe(content)
  pin.start(unpin)
}

/**
 * Holds the end: scrolls there again as the content grows or settles,
 * except while @shadcn/react anchors a message (its spacer shows); a new
 * message with `scrollAnchor` ends it, as the scroller anchors that.
 */
function holdEnd(
  pin: MessageScrollerPin,
  scrollToEnd: (options?: { behavior?: ScrollBehavior }) => boolean
) {
  const content = pin.viewport()?.firstElementChild
  if (!content) return
  const count = (selector: string) => content.querySelectorAll(selector).length
  let items = count("[data-message-id]")
  let anchors = count("[data-scroll-anchor=true]")
  hold(pin, () => {
    const spacer = content.querySelector<HTMLElement>(
      "[data-message-scroller-spacer]"
    )
    const now = count("[data-scroll-anchor=true]")
    // The first messages to come are not new ones.
    if ((items > 0 && now > anchors) || (spacer && !spacer.hidden))
      return pin.end()
    items = count("[data-message-id]")
    anchors = now
    scrollToEnd({ behavior: "auto" })
  }, { toEnd: true })
}

function MessageScrollerProvider({
  children,
  windowed = true,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Provider> & {
  /**
   * Unmounts the content of messages far from the view, keeping their
   * height (on by default). Off, every message stays mounted.
   */
  windowed?: boolean
}) {
  const [pin] = React.useState(createPin)
  React.useEffect(() => pin.end, [pin])
  const [windowing] = React.useState(() => createWindowing(pin.viewport))
  React.useEffect(() => windowing.stop, [windowing])
  React.useEffect(() => {
    if (!windowed) return undefined
    pin.onMoved(windowing.moved)
    return () => pin.onMoved(null)
  }, [pin, windowing, windowed])
  const value = React.useMemo(
    () => ({
      pin,
      holdsEnd: !props.autoScroll,
      startsAtEnd: (props.defaultScrollPosition ?? "end") === "end",
    }),
    [pin, props.autoScroll, props.defaultScrollPosition]
  )
  const windowValue = React.useMemo(
    () =>
      windowed
        ? {
            windowing,
            startsAtEnd: (props.defaultScrollPosition ?? "end") !== "start",
          }
        : null,
    [windowed, windowing, props.defaultScrollPosition]
  )

  return (
    <MessageScrollerPrimitive.Provider {...props}>
      <MessageScrollerPinContext.Provider value={value}>
        <MessageScrollerWindowContext.Provider value={windowValue}>
          {children}
        </MessageScrollerWindowContext.Provider>
      </MessageScrollerPinContext.Provider>
    </MessageScrollerPrimitive.Provider>
  )
}

// agentui: every message mounted while `active`, e.g. while a find
// searches the conversation's text. Without a provider this is a no-op.
function useMessageScrollerShowAll(active: boolean) {
  const windowing = React.useContext(MessageScrollerWindowContext)?.windowing
  React.useLayoutEffect(() => {
    if (!active || !windowing) return undefined
    return windowing.showAll()
  }, [active, windowing])
}

const subscribeToNothing = () => () => {}

// agentui: an app scrolling the viewport itself, e.g. to a find's match,
// must not be pulled back by a hold. Without a provider this is a no-op.
function useMessageScrollerRelease() {
  const context = React.useContext(MessageScrollerPinContext)
  const pin = context?.pin
  return React.useCallback(() => pin?.end(), [pin])
}

// agentui: how long a message is marked once the reader is taken to it,
// as the theme's animate-highlight lasts.
const highlightTime = 1200

// agentui: a part scrolled to is this far below the viewport's start.
const partMargin = 16
const highlighted = new Map<string, ReturnType<typeof setTimeout>>()

/** Marks a message's item for `highlightTime`, again from the start. */
function highlight(messageId: string) {
  const item = document.querySelector<HTMLElement>(
    `[data-slot=message-scroller-item][data-message-id="${CSS.escape(messageId)}"]`
  )
  if (!item) return
  clearTimeout(highlighted.get(messageId))
  // Its animation from the start, marked again.
  item.removeAttribute("data-highlighted")
  void item.offsetWidth
  item.setAttribute("data-highlighted", "")
  highlighted.set(
    messageId,
    setTimeout(() => {
      item.removeAttribute("data-highlighted")
      highlighted.delete(messageId)
    }, highlightTime)
  )
}

function useMessageScroller() {
  const scroller = useMessageScrollerPrimitive()
  const context = React.useContext(MessageScrollerPinContext)
  const pin = context?.pin
  const holdsEnd = context?.holdsEnd ?? false
  const { scrollToMessage: scroll, scrollToEnd: end, scrollToStart } = scroller

  const scrollToMessage = React.useCallback(
    (
      messageId: string,
      options?: Parameters<typeof scroll>[1] & {
        /**
         * agentui: mark it a moment, where the reader was taken to it
         * (a search's result, a link to it): the accent fading out.
         */
        highlight?: boolean
        /**
         * agentui: a part of it (`[data-part-id]`, e.g. an AgentTurn's
         * step) at the viewport's start, not the message's start: open
         * its folds first (`agentTurnFolds`, `useSetFold`).
         */
        part?: string
      }
    ) => {
      pin?.end()
      const { highlight: mark = false, part, ...rest } = options ?? {}
      const scrolled = scroll(messageId, rest)
      // Its part, once mounted and its folds opened: the next frame.
      const toPart = (behavior: ScrollBehavior | undefined) => {
        const viewport = pin?.viewport()
        const target = viewport?.querySelector<HTMLElement>(
          `[data-slot=message-scroller-item][data-message-id="${CSS.escape(messageId)}"] [data-part-id="${CSS.escape(part!)}"]`
        )
        if (!viewport || !target) return false
        const top =
          target.getBoundingClientRect().top -
          viewport.getBoundingClientRect().top +
          viewport.scrollTop -
          (rest.scrollMargin ?? partMargin)
        viewport.scrollTo({ top, ...(behavior ? { behavior } : {}) })
        return true
      }
      const again =
        part === undefined
          ? () => scroll(messageId, { ...rest, behavior: "auto" })
          : () => {
              if (!toPart("auto")) scroll(messageId, { ...rest, behavior: "auto" })
            }
      if (scrolled && part !== undefined)
        window.requestAnimationFrame(() => {
          if (!toPart(rest.behavior)) return
          if (pin && rest.behavior !== "smooth")
            hold(pin, again, { settle: settleTime })
        })
      else if (pin && scrolled && rest.behavior !== "smooth")
        hold(pin, again, { settle: settleTime })
      if (scrolled && mark) highlight(messageId)
      return scrolled
    },
    [pin, scroll]
  )

  // Without autoScroll, the end is held until the reader scrolls: what
  // comes after, and what settles above, does not leave it.
  const scrollToEnd = React.useCallback(
    (options?: Parameters<typeof end>[0]) => {
      pin?.end()
      const scrolled = end(options)
      if (pin && scrolled && holdsEnd) holdEnd(pin, end)
      return scrolled
    },
    [pin, end, holdsEnd]
  )

  const scrollToStartUnpinned = React.useCallback(
    (options?: Parameters<typeof scrollToStart>[0]) => {
      pin?.end()
      return scrollToStart(options)
    },
    [pin, scrollToStart]
  )

  return React.useMemo(
    () => ({
      ...scroller,
      scrollToMessage,
      scrollToEnd,
      scrollToStart: scrollToStartUnpinned,
    }),
    [scroller, scrollToMessage, scrollToEnd, scrollToStartUnpinned]
  )
}

function MessageScroller({
  className,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Root>) {
  return (
    <MessageScrollerPrimitive.Root
      data-slot="message-scroller"
      // agentui: a container, so what is in it can take the room beside
      // the column (a Markdown table wider than the text). Not the
      // viewport: WebKit then misses the end it is held at.
      className={cn(
        "group/message-scroller @container/message-scroller relative flex size-full min-h-0 flex-col overflow-clip",
        className
      )}
      {...props}
    />
  )
}

function MessageScrollerViewport({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Viewport>) {
  const context = React.useContext(MessageScrollerPinContext)
  const pin = context?.pin
  const windowing = React.useContext(MessageScrollerWindowContext)?.windowing
  const setRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      pin?.setViewport(node)
      windowing?.attach(node)
      if (typeof ref === "function") return ref(node)
      if (ref) ref.current = node
    },
    [pin, windowing, ref]
  )
  // Started at the end, it is held there while the messages settle and
  // come, until the reader scrolls.
  const { scrollToEnd } = useMessageScrollerPrimitive()
  const holdsDefault = Boolean(context?.holdsEnd && context.startsAtEnd)
  React.useEffect(() => {
    if (pin && holdsDefault) holdEnd(pin, scrollToEnd)
    // Once, on mount: the default position applies once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <MessageScrollerPrimitive.Viewport
      ref={setRef}
      data-slot="message-scroller-viewport"
      className={cn(
        "size-full min-h-0 min-w-0 scroll-fade-b scrollbar-thin scrollbar-gutter-stable overflow-y-auto overscroll-contain contain-content data-autoscrolling:scrollbar-thumb-transparent data-autoscrolling:scrollbar-track-transparent data-pending-scroll:invisible",
        className
      )}
      {...props}
    />
  )
}

// agentui: only a new message is an anchor to scroll to. @shadcn/react
// 0.3.1, when a row is replaced by another (a waiting row by a decided
// one, a working row by a waiting one: as many rows as before), looks for
// an anchor it has not scrolled to and finds the first message there when
// it mounted, as it marks only those it scrolled to; one inserted above
// the end makes an anchor after it look new too. It scrolled up to that
// message, at the top of a short conversation, and held it there: the
// end, being followed, was left. Its observer of the rows sees only the
// anchors that are new rows: those seen before are not anchors until it
// has run. This observer is made as the element is, so it runs before
// the primitive's, made in an effect after it.
const contentObservers = new WeakMap<HTMLElement, MutationObserver>()

function observeNewAnchors(content: HTMLElement) {
  if (contentObservers.has(content) || typeof MutationObserver === "undefined")
    return
  const seen = new WeakSet<Element>(content.children)
  const observer = new MutationObserver(() => {
    const old: HTMLElement[] = []
    for (const row of content.children) {
      if (!seen.has(row)) seen.add(row)
      else if (row instanceof HTMLElement && row.dataset.scrollAnchor === "true")
        old.push(row)
    }
    if (old.length === 0) return
    for (const row of old) row.dataset.scrollAnchor = "false"
    // After every observer of this change, the primitive's too.
    queueMicrotask(() => {
      for (const row of old) row.dataset.scrollAnchor = "true"
    })
  })
  observer.observe(content, { childList: true })
  contentObservers.set(content, observer)
}

function MessageScrollerContent({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Content>) {
  const setRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      if (node) observeNewAnchors(node)
      if (typeof ref === "function") return ref(node)
      if (ref) ref.current = node
    },
    [ref]
  )
  return (
    <MessageScrollerPrimitive.Content
      ref={setRef}
      data-slot="message-scroller-content"
      className={cn("flex h-max min-h-full flex-col gap-6", className)}
      {...props}
    />
  )
}

function MessageScrollerItem({
  className,
  scrollAnchor = false,
  children,
  style,
  ref,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Item>) {
  const context = React.useContext(MessageScrollerWindowContext)
  const windowing = context?.windowing
  const element = React.useRef<HTMLDivElement | null>(null)
  // Its last height while its content was mounted, and the height kept
  // while it is not.
  const height = React.useRef<number | null>(null)
  const [box, setBox] = React.useState<number | null>(null)
  const [near, setNear] = React.useState(!windowing)
  const all = React.useSyncExternalStore(
    windowing?.subscribe ?? subscribeToNothing,
    () => windowing?.allShown() ?? false,
    () => false
  )
  const shown = near || all || !windowing
  const shownRef = React.useRef(shown)
  React.useLayoutEffect(() => {
    shownRef.current = shown
  })

  const setRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      element.current = node
      if (typeof ref === "function") return ref(node)
      if (ref) ref.current = node
    },
    [ref]
  )

  // Those by the end it opens at mount before the first paint.
  React.useLayoutEffect(() => {
    const node = element.current
    if (node && context && nearItsEnd(node, context.startsAtEnd, windowStart))
      setNear(true)
    // Once, as it mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A box, until it mounts: a scroll that brings it near mounts it before
  // the frame is drawn. In a layout effect, so the first scroll, to where
  // it opens, finds it.
  React.useLayoutEffect(() => {
    const node = element.current
    if (!node || !windowing || shown) return undefined
    return windowing.box(node, () => setNear(true))
  }, [windowing, shown])

  React.useEffect(() => {
    const node = element.current
    if (!node || !windowing) return
    // Whether the size observed is its content's, not the box kept in its
    // place: as the page has it (the observer tells of a layout, which a
    // render may have changed since), not as this component last rendered.
    const mounted = () => !node.hasAttribute("data-windowed")
    return windowing.observe(node, {
      near: () => setNear(true),
      far: () => {
        if (inUse(node)) return
        // Its height while mounted; read now if no size was told of yet
        // (it came near and goes far before the observer told of it).
        if (mounted()) height.current ??= node.getBoundingClientRect().height
        setBox(height.current)
        setNear(false)
      },
      size: (next) => {
        if (mounted()) height.current = next
      },
    })
  }, [windowing])

  return (
    <MessageScrollerPrimitive.Item
      ref={setRef}
      data-slot="message-scroller-item"
      data-windowed={shown ? undefined : ""}
      scrollAnchor={scrollAnchor}
      className={cn(
        "min-w-0 shrink-0",
        // agentui: marked a moment where the reader was taken to it
        // (`scrollToMessage(id, { highlight: true })`, or the app's
        // data-highlighted): the accent's grey fading out over 1.2s; with
        // less motion, held while marked.
        "rounded-xl data-highlighted:bg-accent data-highlighted:animate-highlight",
        // Windowed, what is far from the view is not mounted at all; else
        // the browser skips rendering it.
        !windowing &&
          "[contain-intrinsic-size:auto_10rem] [content-visibility:auto]",
        className
      )}
      style={shown ? style : { ...style, height: box ?? "10rem" }}
      {...props}
    >
      {shown ? children : null}
    </MessageScrollerPrimitive.Item>
  )
}

// agentui: whether the reader asked for less motion, for the scroll
// buttons' behavior.
const reducedMotion = "(prefers-reduced-motion: reduce)"

function subscribeToReducedMotion(onChange: () => void) {
  const query = window.matchMedia(reducedMotion)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

function usePrefersReducedMotion() {
  return React.useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia(reducedMotion).matches,
    () => false
  )
}

// agentui: every button name is a label, so apps can translate both directions.
type MessageScrollerButtonLabels = {
  /** The end button's name. */
  scrollToEnd: string
  /** The start button's name. */
  scrollToStart: string
}

const messageScrollerButtonLabels: MessageScrollerButtonLabels = {
  scrollToEnd: "Scroll to end",
  scrollToStart: "Scroll to start",
}

function MessageScrollerButton({
  direction = "end",
  // agentui: jump to the start instead of scrolling smoothly. With
  // autoScroll, @shadcn/react 0.3.1 counts the first scroll event of a smooth
  // scroll as still at the end and goes back to following the bottom. And
  // jump to the end too where the reader asked for less motion.
  behavior,
  className,
  children,
  render,
  variant = "secondary",
  summary,
  labels: labelsProp,
  size: sizeProp,
  onClick,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Button> &
  Pick<React.ComponentProps<typeof Button>, "variant" | "size"> & {
    // agentui: the app's words on what waits past the button, e.g.
    // "2 queued"; part of its name, never announced on a change.
    summary?: React.ReactNode
    labels?: Partial<MessageScrollerButtonLabels>
  }) {
  const labels = { ...messageScrollerButtonLabels, ...labelsProp }
  const label = direction === "end" ? labels.scrollToEnd : labels.scrollToStart
  // agentui: with a summary, a pill at the icon button's height.
  const pill =
    summary !== undefined && summary !== null && summary !== false && !children
  const size = sizeProp ?? (pill ? "sm" : "icon-sm")
  const reduced = usePrefersReducedMotion()
  return (
    <MessageScrollerPrimitive.Button
      data-slot="message-scroller-button"
      data-direction={direction}
      data-variant={variant}
      data-size={size}
      direction={direction}
      behavior={
        behavior ?? (direction === "start" || reduced ? "auto" : "smooth")
      }
      // agentui: @shadcn/react 0.3.1 blurs the button after this, and
      // once scrolled it is inert, so the focus fell to the body. It goes
      // to the viewport instead, where the keyboard scrolls on.
      onClick={(event) => {
        onClick?.(event)
        const button = event.currentTarget
        if (event.defaultPrevented || document.activeElement !== button)
          return
        const viewport = button
          .closest("[data-slot=message-scroller]")
          ?.querySelector<HTMLElement>("[data-slot=message-scroller-viewport]")
        queueMicrotask(() => viewport?.focus({ preventScroll: true }))
      }}
      // agentui: round and raised, so it floats over the text it covers
      // while the reader is above the end, not a box set on it. To a
      // finger, 44px past its 28px box. With reduced motion it fades
      // without sliding. Raised by shadow-float, as everything that floats:
      // shadow-md had no outline, and in dark hardly showed.
      className={cn(
        "absolute inset-s-1/2 -translate-x-1/2 rounded-full bg-background text-foreground shadow-float transition-[translate,scale,opacity] motion-pop motion-reduce:transition-opacity hover:bg-muted hover:text-foreground dark:bg-muted dark:hover:bg-accent data-[active=false]:pointer-events-none data-[active=false]:scale-95 data-[active=false]:opacity-0 data-[active=true]:translate-y-0 data-[active=true]:scale-100 data-[active=true]:opacity-100 data-[direction=end]:bottom-4 data-[direction=end]:data-[active=false]:translate-y-full data-[direction=start]:top-4 data-[direction=start]:data-[active=false]:-translate-y-full rtl:translate-x-1/2 data-[direction=start]:[&_svg]:rotate-180 pointer-coarse:after:absolute pointer-coarse:after:-inset-2",
        // agentui: a pill with a summary. Placed at half the width, it
        // would shrink to fit the other half: w-max, kept in the scroller.
        pill && "w-max max-w-9/10 gap-2 px-3",
        className
      )}
      render={render ?? <Button variant={variant} size={size} />}
      {...props}
    >
      {children ?? (
        <>
          <HugeiconsIcon icon={ArrowDown02Icon} strokeWidth={2} />
          {/* agentui: visible names with a summary; literal spaces keep the
              accessible name separated, even between inline spans. */}
          <span className={pill ? "shrink-0" : "sr-only"}>{label}</span>
          {pill && (
            <>
              {" "}
              <span className="flex min-w-0 items-center gap-1 text-muted-foreground">
                <span aria-hidden="true" className="shrink-0">
                  ·
                </span>
                {" "}
                <span
                  data-slot="message-scroller-summary"
                  className="min-w-0 truncate"
                >
                  {summary}
                </span>
              </span>
            </>
          )}
        </>
      )}
    </MessageScrollerPrimitive.Button>
  )
}

export {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
  type MessageScrollerButtonLabels,
  useMessageScroller,
  useMessageScrollerRelease,
  useMessageScrollerScrollable,
  useMessageScrollerShowAll,
  useMessageScrollerVisibility,
}
