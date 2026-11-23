import * as React from "react"

// agentui: @shadcn/react 0.3.1's message-scroller primitive
// (https://github.com/shadcn-ui/ui, packages/react/src/message-scroller and
// use-render at 503a3a5), MIT License, Copyright (c) 2023 shadcn. Its files
// are joined here, as a registry installs one file; agentui's changes are
// marked "agentui:", but for "| undefined" on optional props, for apps
// with exactOptionalPropertyTypes. Its code is kept as upstream wrote it,
// refs read as it reads them, so these rules are off here.
/* eslint-disable react-hooks/refs, react-hooks/exhaustive-deps */

// --- utils.ts ---

function useLatest<T>(value: T) {
  const ref = React.useRef(value)

  ref.current = value

  return ref
}

// --- use-render/index.ts ---

// A poor man's version of base-ui useRender.
// see https://base-ui.com/react/utils/use-render.
// TODO: Replace if base-ui useRender is published as a package.

type RenderState = Record<string, unknown>

type RenderFunction<TState extends RenderState> = (
  props: Record<string, unknown>,
  state: TState
) => React.ReactElement | null

type RenderProp<TState extends RenderState> =
  | React.ReactElement
  | RenderFunction<TState>

type StateAttributesMapping<TState extends RenderState> = Partial<{
  [K in keyof TState]: (
    value: TState[K]
  ) => Record<string, string | undefined> | null | undefined
}>

type UseRenderComponentProps<
  TElement extends React.ElementType,
  TState extends RenderState = RenderState,
> = React.ComponentPropsWithRef<TElement> & {
  render?: RenderProp<TState>
}

type UseRenderOptions<
  TElement extends React.ElementType,
  TState extends RenderState,
> = {
  defaultTagName: TElement
  props?: React.ComponentPropsWithRef<TElement>
  render?: RenderProp<TState> | undefined
  state?: TState
  stateAttributesMapping?: StateAttributesMapping<TState>
}

function useRender<
  TElement extends React.ElementType,
  TState extends RenderState = RenderState,
>({
  defaultTagName,
  props,
  render,
  state = {} as TState,
  stateAttributesMapping,
}: UseRenderOptions<TElement, TState>) {
  const elementProps = mergeProps<TElement>(
    getStateAttributes(state, stateAttributesMapping),
    props
  )

  if (!render) {
    return React.createElement(defaultTagName, elementProps)
  }

  if (typeof render === "function") {
    return render(elementProps, state)
  }

  if (!React.isValidElement(render)) {
    return null
  }

  const renderProps = render.props as Record<string, unknown>
  const propsWithRenderProps = mergeProps<TElement>(elementProps, renderProps)
  const propsWithRef = {
    ...propsWithRenderProps,
    ref: composeRefs(
      elementProps.ref as React.Ref<unknown> | undefined,
      renderProps.ref as React.Ref<unknown> | undefined
    ),
  }

  return React.cloneElement(
    render,
    propsWithRef as React.Attributes & Record<string, unknown>
  )
}

function mergeProps<TElement extends React.ElementType>(
  ...sources: Array<
    React.ComponentPropsWithRef<TElement> | Record<string, unknown> | undefined
  >
) {
  const result: Record<string, unknown> = {}

  for (const source of sources) {
    if (!source) {
      continue
    }

    const sourceProps = source as Record<string, unknown>

    for (const key of Object.keys(sourceProps)) {
      const value = sourceProps[key]

      if (value === undefined) {
        continue
      }

      const current = result[key]

      if (key === "className") {
        result[key] = [current, value].filter(Boolean).join(" ")
      } else if (key === "style") {
        result[key] = {
          ...(current as React.CSSProperties | undefined),
          ...(value as React.CSSProperties | undefined),
        }
      } else if (key === "ref") {
        result[key] = composeRefs(
          current as React.Ref<unknown> | undefined,
          value as React.Ref<unknown> | undefined
        )
      } else if (
        isEventHandler(key) &&
        typeof current === "function" &&
        typeof value === "function"
      ) {
        result[key] = composeEventHandlers(
          value as EventHandler,
          current as EventHandler
        )
      } else {
        result[key] = value
      }
    }
  }

  return result as React.ComponentPropsWithRef<TElement>
}

function getStateAttributes<TState extends RenderState>(
  state: TState,
  mapping?: StateAttributesMapping<TState>
) {
  const props: Record<string, unknown> = {}

  for (const key of Object.keys(state) as Array<keyof TState>) {
    const value = state[key]
    const attributes = mapping?.[key]?.(value)

    if (attributes) {
      Object.assign(props, attributes)
      continue
    }

    if (key === "slot") {
      props["data-slot"] = value
      continue
    }

    const attribute = `data-${String(key).replace(
      /[A-Z]/g,
      (letter) => `-${letter.toLowerCase()}`
    )}`

    if (typeof value === "boolean") {
      props[attribute] = value ? "" : undefined
    } else if (value !== null && value !== undefined) {
      props[attribute] = String(value)
    }
  }

  return props
}

type EventHandler = (event: React.SyntheticEvent) => void

function composeEventHandlers(theirs: EventHandler, ours: EventHandler) {
  return function handleEvent(event: React.SyntheticEvent) {
    theirs(event)

    if (!event.defaultPrevented) {
      ours(event)
    }
  }
}

function isEventHandler(key: string) {
  return /^on[A-Z]/.test(key)
}

function composeRefs<T>(
  ...refs: Array<React.Ref<T> | undefined>
): React.RefCallback<T> | undefined {
  const validRefs = refs.filter(Boolean)

  if (validRefs.length === 0) {
    return undefined
  }

  return (value) => {
    for (const ref of validRefs) {
      if (typeof ref === "function") {
        ref(value)
      } else if (ref) {
        ref.current = value
      }
    }
  }
}

// --- types.ts ---

// Default scrollEdgeThreshold. Sub-pixel tolerance so edge detection does not
// flicker across engines that round scrollTop differently.
const DEFAULT_SCROLL_EDGE_THRESHOLD = 8

// Default scrollPreviousItemPeek. Pixels of the previous item kept visible above
// a newly anchored row.
const DEFAULT_SCROLL_PREVIOUS_ITEM_PEEK = 64

// Default scrollMargin for scrollToMessage and programmatic targets.
const DEFAULT_SCROLL_MARGIN = 0

// Two fractional scrollTop values within this range are treated as equal, to
// absorb zoom and HiDPI rounding drift.
const SCROLL_POSITION_EPSILON = 0.5
// agentui: how long a scroll must have stopped before the place is noted.
const SCROLL_IDLE = 120

// How long (ms) data-autoscrolling stays set during a programmatic smooth scroll
// before clearing.
const AUTOSCROLLING_CLEAR_DELAY = 180

// Viewport keys that count as deliberate scroll intent and release follow-bottom.
// agentui: keys that scroll toward the start, which alone release
// following: one toward the end, at the end, moves nothing, and no scroll
// would re-arm it (Shift+Space is a page up).
const USER_SCROLL_KEYS = new Set(["ArrowUp", "Home", "PageUp"])

// Internal scroll mode. Derived from intent and commands; decides how the
// viewport reacts to content and resize.
type MessageScrollerMode =
  | "following-bottom" // autoScroll on, pinned to the latest message.
  | "free-scrolling" // reader scrolled away; position left alone (prepends still preserved).
  | "anchored-to-message" // holding a turn at the reading line while it streams.
  | "settling-jump" // a programmatic jump is animating; intent detection suppressed until it settles.

// Where a saved transcript opens on the first non-empty render.
type MessageScrollerDefaultScrollPosition = "start" | "end" | "last-anchor"

// Which transcript edge MessageScrollerButton scrolls toward.
type MessageScrollerButtonDirection = "start" | "end"

// Viewport alignment for scrollToMessage and programmatic jumps.
type MessageScrollerScrollAlign = "start" | "center" | "end" | "nearest"

// Options for scrollToMessage, scrollToEnd, and scrollToStart.
type MessageScrollerScrollOptions = {
  // Viewport edge or center to align the target to.
  align?: MessageScrollerScrollAlign
  // Native scroll behavior.
  behavior?: ScrollBehavior
  // Margin on the aligned edge, in pixels. Defaults to the provider scrollMargin.
  scrollMargin?: number
}

// Scroll snapshot from useMessageScrollerScrollable: which edges the viewport can
// still scroll toward.
type MessageScrollerScrollable = {
  // The viewport can scroll toward the start (content is hidden above).
  start: boolean
  // The viewport can scroll toward the end (content is hidden below).
  end: boolean
}

// Visibility snapshot from useMessageScrollerVisibility.
type MessageScrollerVisibilityState = {
  // The anchored turn the reader is in, or null. Stays set after the anchor
  // scrolls above the viewport.
  currentAnchorId: string | null
  // messageId values intersecting the viewport, in document order.
  visibleMessageIds: string[]
}

// Headless provider for a chat transcript scroller. Owns scroll behavior and
// state; renders no DOM.
type MessageScrollerProviderProps = {
  children?: React.ReactNode
  // Follow new content at the bottom while the viewport is already at the end.
  autoScroll?: boolean | undefined
  // Opening position on the first non-empty render, applied once.
  defaultScrollPosition?: MessageScrollerDefaultScrollPosition | undefined
  // Distance from an edge that still counts as at-top/at-bottom. Defaults to 8.
  scrollEdgeThreshold?: number | undefined
  // Extra top margin for a newly anchored row, added to scrollMargin. Defaults to 64.
  scrollPreviousItemPeek?: number | undefined
  // Default margin on the aligned edge for commands and visibility. Defaults to 0.
  scrollMargin?: number | undefined
}

// Frame container for a chat transcript scroller. Must render inside a
// MessageScrollerProvider.
type MessageScrollerProps = React.ComponentProps<"div">

// Scrollable viewport. Owns native scroll events and prepend preservation.
type MessageScrollerViewportProps = React.ComponentProps<"div"> & {
  // Keep the first visible messageId row stable on prepend. Defaults to true.
  preserveScrollOnPrepend?: boolean
}

// Transcript row container. Every direct child should be a MessageScrollerItem.
type MessageScrollerContentProps = React.ComponentProps<"div"> & {
  // Class name for the internal tail spacer used when anchoring turns near the top.
  spacerClassName?: string
}

// One transcript row: a message, marker, typing row, separator, or load-more row.
type MessageScrollerItemProps = React.ComponentProps<"div"> & {
  // Stable row id for scrollToMessage, visibility, and prepend preservation.
  messageId?: string
  // Marks a turn boundary that newly appended anchors and last-anchor restore use.
  scrollAnchor?: boolean
}

// State passed to MessageScrollerButton's render prop.
type MessageScrollerButtonRenderState = {
  // Whether overflow exists toward this button's direction.
  active: boolean
  direction: MessageScrollerButtonDirection
}

// Scroll control for the start or end of the transcript.
type MessageScrollerButtonProps = UseRenderComponentProps<
  "button",
  MessageScrollerButtonRenderState
> & {
  // Native scroll behavior when clicked. Defaults to "smooth".
  behavior?: ScrollBehavior
  // Transcript edge to scroll toward. Defaults to "end".
  direction?: MessageScrollerButtonDirection
}

// Minimal external store backing useMessageScrollerScrollable, consumed via
// useSyncExternalStore.
type MessageScrollerStore<T> = {
  getSnapshot: () => T
  setSnapshot: (nextSnapshot: T) => void
  subscribe: (listener: () => void) => () => void
}

// External store backing useMessageScrollerVisibility. Adds reference-counting so
// tracking stays lazy.
type MessageScrollerVisibilityStore = {
  getSnapshot: () => MessageScrollerVisibilityState
  hasListeners: () => boolean
  setSnapshot: (nextSnapshot: MessageScrollerVisibilityState) => void
  subscribe: (
    listener: () => void,
    onFirstSubscribe: () => void,
    onLastUnsubscribe: () => void
  ) => () => void
}

// Registers (or, with removedElement, unregisters) a MessageScrollerItem node by
// messageId.
type MessageScrollerRegisterMessage = (
  messageId: string,
  element: HTMLElement | null,
  removedElement?: HTMLElement | null
) => void

// Internal context wiring the parts together. Not part of the public API.
type MessageScrollerContextValue = {
  handleContentChange: () => void
  keepEndThroughRebuild: (mutations: MutationRecord[]) => void
  pointerHeldRef: React.RefObject<boolean>
  handleResize: () => void
  holdPlace: () => void
  observeVisibility: () => void
  preserveScrollOnPrependRef: React.RefObject<boolean>
  scrollToEnd: (options?: MessageScrollerScrollOptions) => boolean
  scrollToMessage: (
    messageId: string,
    options?: MessageScrollerScrollOptions
  ) => boolean
  scrollToStart: (options?: MessageScrollerScrollOptions) => boolean
  setContentElement: (element: HTMLDivElement | null) => void
  setRootElement: (element: HTMLDivElement | null) => void
  setSpacerElement: (element: HTMLDivElement | null) => void
  setViewportElement: (element: HTMLDivElement | null) => void
  pendingDefaultScrollStore: MessageScrollerStore<boolean>
  stateStore: MessageScrollerStore<MessageScrollerScrollable>
  syncAfterScroll: () => void
  unobserveVisibility: () => void
  userScrollIntent: () => void
  viewportRef: React.RefObject<HTMLDivElement | null>
  visibilityStore: MessageScrollerVisibilityStore
}

// Initial MessageScrollerScrollable before measurement. Stable reference for the
// server and first-render snapshot.
const EMPTY_MESSAGE_SCROLLER_SCROLLABLE: MessageScrollerScrollable = {
  start: false,
  end: false,
}

// Shared empty array so empty visibility snapshots stay referentially stable.
const EMPTY_VISIBLE_MESSAGE_IDS: string[] = []

// Initial MessageScrollerVisibilityState. Nothing tracked, no current anchor.
const EMPTY_MESSAGE_SCROLLER_VISIBILITY_STATE: MessageScrollerVisibilityState =
  {
    currentAnchorId: null,
    visibleMessageIds: EMPTY_VISIBLE_MESSAGE_IDS,
  }

// --- stores.ts ---

// Generic useSyncExternalStore backing: a stable snapshot (referentially equal
// while isEqual holds, so subscribers only re-render on real transitions) plus
// optional reference-counting via the subscribe-time lifecycle callbacks.
function createExternalStore<T>(
  initialSnapshot: T,
  isEqual: (a: T, b: T) => boolean
) {
  let snapshot = initialSnapshot
  const listeners = new Set<() => void>()

  return {
    getSnapshot: () => snapshot,
    hasListeners: () => listeners.size > 0,
    setSnapshot: (nextSnapshot: T) => {
      if (isEqual(snapshot, nextSnapshot)) {
        return
      }

      snapshot = nextSnapshot
      listeners.forEach((listener) => listener())
    },
    subscribe: (
      listener: () => void,
      onFirstSubscribe?: () => void,
      onLastUnsubscribe?: () => void
    ) => {
      const wasEmpty = listeners.size === 0

      listeners.add(listener)

      if (wasEmpty) {
        onFirstSubscribe?.()
      }

      return () => {
        listeners.delete(listener)

        if (listeners.size === 0) {
          onLastUnsubscribe?.()
        }
      }
    },
  }
}

function createMessageScrollerStore<T>(
  initialSnapshot: T,
  isEqual: (a: T, b: T) => boolean
): MessageScrollerStore<T> {
  return createExternalStore(initialSnapshot, isEqual)
}

function createMessageScrollerVisibilityStore(): MessageScrollerVisibilityStore {
  return createExternalStore(
    EMPTY_MESSAGE_SCROLLER_VISIBILITY_STATE,
    areVisibilityStatesEqual
  )
}

function areScrollStatesEqual(
  current: MessageScrollerScrollable,
  next: MessageScrollerScrollable
) {
  return current.start === next.start && current.end === next.end
}

function areVisibilityStatesEqual(
  current: MessageScrollerVisibilityState,
  next: MessageScrollerVisibilityState
) {
  if (current.currentAnchorId !== next.currentAnchorId) {
    return false
  }

  if (current.visibleMessageIds.length !== next.visibleMessageIds.length) {
    return false
  }

  return current.visibleMessageIds.every(
    (messageId, index) => messageId === next.visibleMessageIds[index]
  )
}

// --- geometry.ts ---

function getMessageScrollerScrollable({
  content,
  scrollEdgeThreshold,
  spacer,
  viewport,
}: {
  content: HTMLElement | null
  scrollEdgeThreshold: number
  spacer: HTMLElement | null
  viewport: HTMLElement | null
}): MessageScrollerScrollable {
  if (!viewport || !content) {
    return EMPTY_MESSAGE_SCROLLER_SCROLLABLE
  }

  const contentBottom = getContentBottom({ content, spacer, viewport })

  return {
    start: viewport.scrollTop > scrollEdgeThreshold,
    end:
      contentBottom - viewport.scrollTop - viewport.clientHeight >
      scrollEdgeThreshold,
  }
}

function getMessageScrollerVisibilityState({
  content,
  scrollMargin,
  scrollPreviousItemPeek,
  spacer,
  viewport,
  visibleMessageIds,
}: {
  content: HTMLElement | null
  scrollMargin: number
  scrollPreviousItemPeek: number
  spacer: HTMLElement | null
  viewport: HTMLElement | null
  visibleMessageIds: Set<string>
}): MessageScrollerVisibilityState {
  if (!content || !viewport) {
    return EMPTY_MESSAGE_SCROLLER_VISIBILITY_STATE
  }

  const viewportRect = viewport.getBoundingClientRect()
  // The reading line sits scrollPreviousItemPeek below scrollMargin: anchored
  // turns land there with the previous turn peeking above. A row only peeking in
  // that band has not been read down to yet, so it counts as neither visible nor
  // current.
  const lineTop = viewportRect.top + scrollMargin + scrollPreviousItemPeek
  const trackByLayout = typeof IntersectionObserver === "undefined"

  const visible: string[] = []
  let currentAnchorId: string | null = null

  // Walk rows in document order so visible ids come out top-to-bottom.
  for (const item of getMessageScrollerItems(content, spacer)) {
    const messageId = item.dataset.messageId

    if (!messageId) {
      continue
    }

    const isAnchor = item.dataset.scrollAnchor === "true"
    // Anchors need a rect to place the current line; non-anchors lean on the
    // observer set (or a rect in the no-observer fallback).
    const rect = isAnchor || trackByLayout ? item.getBoundingClientRect() : null

    const isVisible =
      trackByLayout && rect
        ? rect.bottom > lineTop && rect.top < viewportRect.bottom
        : visibleMessageIds.has(messageId)

    if (isVisible) {
      visible.push(messageId)
    }

    // Current is the last anchor to have reached the reading line: the turn you
    // scrolled to (placed at the line) wins over newer turns lower down, the
    // previous turn peeking above the line has been passed, and it stays current
    // even after its header scrolls above the viewport.
    if (isAnchor && rect && rect.top <= lineTop + SCROLL_POSITION_EPSILON) {
      currentAnchorId = messageId
    }
  }

  if (visible.length === 0 && currentAnchorId === null) {
    return EMPTY_MESSAGE_SCROLLER_VISIBILITY_STATE
  }

  return {
    currentAnchorId,
    visibleMessageIds: visible,
  }
}

function getMessageScrollerItems(
  content: HTMLElement,
  spacer: HTMLElement | null
) {
  return Array.from(content.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child !== spacer
  )
}

function getNewScrollAnchor(items: HTMLElement[], previousItemCount: number) {
  for (let index = previousItemCount; index < items.length; index++) {
    const item = items[index]

    if (item?.dataset.scrollAnchor === "true") {
      return item
    }
  }

  return null
}

function getUnanchoredScrollAnchor(
  items: HTMLElement[],
  handledAnchors: { has(element: HTMLElement): boolean }
) {
  for (const item of items) {
    if (item.dataset.scrollAnchor === "true" && !handledAnchors.has(item)) {
      return item
    }
  }

  return null
}

function hasMultipleNewScrollAnchors(
  items: HTMLElement[],
  previousItemCount: number
) {
  let count = 0

  for (let index = previousItemCount; index < items.length; index++) {
    const item = items[index]

    if (item?.dataset.scrollAnchor !== "true") {
      continue
    }

    count += 1

    if (count > 1) {
      return true
    }
  }

  return false
}

function getLastScrollAnchor(items: HTMLElement[]) {
  for (let index = items.length - 1; index >= 0; index--) {
    const item = items[index]

    if (item?.dataset.scrollAnchor === "true") {
      return item
    }
  }

  return null
}

// agentui: whether a row's content is rendered: not an empty box (a row
// whose content is not mounted, its height kept) nor skipped by its
// content-visibility: auto while off screen (where the browser can tell).
function isRendered(row: HTMLElement) {
  const child = row.firstElementChild

  return Boolean(
    child &&
      (typeof child.checkVisibility !== "function" ||
        child.checkVisibility({ contentVisibilityAuto: true }))
  )
}

// agentui: found by halving, not by reading every row from the top: rows
// are in order down the content, so a few rects are read, not as many as
// rows above the view (each a forced layout while layout is dirty).
function getFirstVisibleMessageItem({
  content,
  spacer,
  viewport,
}: {
  content: HTMLElement
  spacer: HTMLElement | null
  viewport: HTMLElement
}) {
  const viewportRect = viewport.getBoundingClientRect()
  // The rows by index, without copying them, so no step of the scroll
  // costs as many as there are rows.
  const rows = content.children
  const count = rows.length - (spacer?.parentElement === content ? 1 : 0)
  const row = (index: number) => {
    const child = rows[index]
    return child instanceof HTMLElement && child !== spacer ? child : null
  }
  // The first row whose bottom is below the view's top.
  let low = 0
  let high = count
  while (low < high) {
    const middle = (low + high) >> 1
    const bottom = row(middle)?.getBoundingClientRect().bottom ?? 0
    if (bottom > viewportRect.top) high = middle
    else low = middle + 1
  }

  for (let index = low; index < rows.length; index++) {
    const item = row(index)

    if (!item?.dataset.messageId) {
      continue
    }

    const rect = item.getBoundingClientRect()

    if (rect.bottom > viewportRect.top && rect.top < viewportRect.bottom) {
      return item
    }

    if (rect.top >= viewportRect.bottom) {
      return null
    }
  }

  return null
}

function getElementScrollTop({
  align,
  element,
  scrollMargin,
  spacer,
  viewport,
}: {
  align: MessageScrollerScrollAlign
  element: HTMLElement
  scrollMargin: number
  spacer: HTMLElement | null
  viewport: HTMLElement
}) {
  const elementTop = getElementTop(element, viewport)
  const elementHeight = element.getBoundingClientRect().height
  const contentPadding = getContentBlockPadding(spacer)

  if (align === "center") {
    const insetHeight = Math.max(
      0,
      viewport.clientHeight - contentPadding.start - contentPadding.end
    )

    return (
      elementTop -
      contentPadding.start -
      (insetHeight - elementHeight) / 2 -
      scrollMargin
    )
  }

  if (align === "end") {
    return (
      elementTop -
      viewport.clientHeight +
      elementHeight +
      contentPadding.end +
      scrollMargin
    )
  }

  if (align === "nearest") {
    const elementBottom = elementTop + elementHeight
    const viewportTop = viewport.scrollTop + contentPadding.start
    const viewportBottom =
      viewport.scrollTop + viewport.clientHeight - contentPadding.end

    if (elementTop >= viewportTop && elementBottom <= viewportBottom) {
      return viewport.scrollTop
    }

    if (elementTop < viewportTop) {
      return elementTop - contentPadding.start - scrollMargin
    }

    return (
      elementBottom - viewport.clientHeight + contentPadding.end + scrollMargin
    )
  }

  return elementTop - contentPadding.start - scrollMargin
}

function getElementTop(element: HTMLElement, viewport: HTMLElement) {
  const elementRect = element.getBoundingClientRect()
  const viewportRect = viewport.getBoundingClientRect()

  return elementRect.top - viewportRect.top + viewport.scrollTop
}

// agentui: its top in the content, which a scroll does not change.
function getElementContentOffset(element: HTMLElement, content: HTMLElement) {
  return (
    element.getBoundingClientRect().top - content.getBoundingClientRect().top
  )
}

function getTailSpacerHeight({
  content,
  scrollTop,
  spacer,
  viewport,
}: {
  content: HTMLElement
  scrollTop: number
  spacer: HTMLElement | null
  viewport: HTMLElement
}) {
  const contentBottom = getContentBottom({ content, spacer, viewport })

  return scrollTop + viewport.clientHeight - contentBottom
}

function getContentBottom({
  content,
  spacer,
  viewport,
}: {
  content: HTMLElement
  spacer: HTMLElement | null
  viewport: HTMLElement
}) {
  const rows = content.children
  const padding = getBlockPadding(content)
  const viewportRect = viewport.getBoundingClientRect()
  const scrollTop = viewport.scrollTop
  let contentBottom = padding.start + padding.end

  // agentui: rows are in order down the content, so the last one shown
  // ends it: one rect read, not one a row (each a forced layout while
  // layout is dirty), and the rows not copied. Rows not shown (no box)
  // are passed over.
  for (let index = rows.length - 1; index >= 0; index--) {
    const row = rows[index]

    if (!(row instanceof HTMLElement) || row === spacer) {
      continue
    }

    const rect = row.getBoundingClientRect()

    if (rect.height === 0 && rect.width === 0) {
      continue
    }

    contentBottom = Math.max(
      contentBottom,
      rect.bottom - viewportRect.top + scrollTop + padding.end
    )
    break
  }

  return contentBottom
}

function getMaxScrollTop(viewport: HTMLElement) {
  return Math.max(0, viewport.scrollHeight - viewport.clientHeight)
}

function getBlockPadding(element: HTMLElement) {
  const style = window.getComputedStyle(element)

  return {
    end: readCssPixel(style.paddingBlockEnd || style.paddingBottom),
    start: readCssPixel(style.paddingBlockStart || style.paddingTop),
  }
}

function getContentBlockPadding(spacer: HTMLElement | null) {
  const content = spacer?.parentElement

  if (!content) {
    return {
      end: 0,
      start: 0,
    }
  }

  return getBlockPadding(content)
}

function getFlexGap(element: HTMLElement | null) {
  if (!element) {
    return 0
  }

  const style = window.getComputedStyle(element)
  const gap = style.rowGap === "normal" ? style.gap : style.rowGap

  return readCssPixel(gap)
}

function readCssPixel(value: string | undefined) {
  if (!value) {
    return 0
  }

  const number = Number.parseFloat(value)

  return Number.isFinite(number) ? number : 0
}

// --- use-message-scroller-refs.ts ---

// Shared mutable ref bag for one MessageScroller, closed over by both the
// controller and the commands so writes are visible across them without prop
// threading. stateStore and visibilityStore fan out via useSyncExternalStore.
type MessageScrollerRefs = {
  autoScrollRef: React.RefObject<boolean>
  autoscrollingRef: React.RefObject<boolean>
  autoscrollingTimeoutRef: React.RefObject<number | null>
  streamingTurnRef: React.RefObject<HTMLElement | null>
  contentRef: React.RefObject<HTMLDivElement | null>
  defaultScrollPositionAppliedRef: React.RefObject<boolean>
  firstItemRef: React.RefObject<HTMLElement | null>
  itemCountRef: React.RefObject<number>
  lastScrollTopRef: React.RefObject<number>
  messageElementsRef: React.RefObject<Map<string, HTMLElement>>
  modeRef: React.RefObject<MessageScrollerMode>
  pendingScrollFrameRef: React.RefObject<number | null>
  pendingScrollToMessageRef: React.RefObject<{
    messageId: string
    options?: MessageScrollerScrollOptions | undefined
  } | null>
  prependRestoreRef: React.RefObject<{
    element: HTMLElement
    offset: number
  } | null>
  preserveScrollOnPrependRef: React.RefObject<boolean>
  pendingDefaultScrollStore: MessageScrollerStore<boolean>
  rootRef: React.RefObject<HTMLDivElement | null>
  scrollEdgeThresholdRef: React.RefObject<number>
  scrollMarginRef: React.RefObject<number>
  scrollPreviousItemPeekRef: React.RefObject<number>
  spacerGapRef: React.RefObject<number>
  spacerHeightRef: React.RefObject<number>
  spacerRef: React.RefObject<HTMLDivElement | null>
  stateFrameRef: React.RefObject<number | null>
  stateStore: MessageScrollerStore<MessageScrollerScrollable>
  viewportRef: React.RefObject<HTMLDivElement | null>
  visibilityFrameRef: React.RefObject<number | null>
  visibilityObserverRef: React.RefObject<IntersectionObserver | null>
  visibilityStore: MessageScrollerVisibilityStore
  visibleMessageIdsRef: React.RefObject<Set<string>>
  handledScrollAnchorsRef: React.RefObject<WeakSet<HTMLElement>>
}

// Builds the per-instance ref bag: the two external stores constructed once, and
// the latest prop values mirrored onto refs each render so callbacks stay stable.
function useMessageScrollerRefs({
  autoScroll,
  defaultScrollPosition,
  scrollEdgeThreshold,
  scrollMargin,
  scrollPreviousItemPeek,
}: {
  autoScroll: boolean
  defaultScrollPosition: MessageScrollerDefaultScrollPosition
  scrollEdgeThreshold: number
  scrollMargin: number
  scrollPreviousItemPeek: number
}): MessageScrollerRefs {
  const autoScrollRef = React.useRef(autoScroll)
  const autoscrollingRef = React.useRef(false)
  const contentRef = React.useRef<HTMLDivElement | null>(null)
  const defaultScrollPositionAppliedRef = React.useRef(false)
  const scrollEdgeThresholdRef = React.useRef(scrollEdgeThreshold)
  const itemCountRef = React.useRef(0)
  const firstItemRef = React.useRef<HTMLElement | null>(null)
  // The scrollTop seen by the previous state commit, so follow-release can tell
  // a reader scrolling up from content growing past the live edge.
  const lastScrollTopRef = React.useRef(0)
  const modeRef = React.useRef<MessageScrollerMode>(
    autoScroll ? "following-bottom" : "free-scrolling"
  )
  const messageElementsRef = React.useRef(new Map<string, HTMLElement>())
  const pendingScrollToMessageRef = React.useRef<{
    messageId: string
    options?: MessageScrollerScrollOptions | undefined
  } | null>(null)
  // The row to hold steady on the next prepend: the first visible row, or a jump
  // target seeded by scrollToElement. restorePrependedAnchor reads only this.
  // agentui: by its offset in the content, which a scroll does not change,
  // so it holds however far the reader scrolled since it was noted.
  const prependRestoreRef = React.useRef<{
    element: HTMLElement
    offset: number
  } | null>(null)
  // The turn held at the reading line so a reply streaming in below it can re-pin
  // it instead of letting scrollTop clamp it loose.
  const streamingTurnRef = React.useRef<HTMLElement | null>(null)
  const scrollPreviousItemPeekRef = React.useRef(scrollPreviousItemPeek)
  const preserveScrollOnPrependRef = React.useRef(true)
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const scrollMarginRef = React.useRef(scrollMargin)
  const pendingScrollFrameRef = React.useRef<number | null>(null)
  const spacerGapRef = React.useRef(0)
  const spacerHeightRef = React.useRef(0)
  const spacerRef = React.useRef<HTMLDivElement | null>(null)
  const stateFrameRef = React.useRef<number | null>(null)
  const pendingDefaultScrollStoreRef =
    React.useRef<MessageScrollerStore<boolean> | null>(null)
  const stateStoreRef =
    React.useRef<MessageScrollerStore<MessageScrollerScrollable> | null>(null)
  const autoscrollingTimeoutRef = React.useRef<number | null>(null)
  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const visibilityFrameRef = React.useRef<number | null>(null)
  const visibilityObserverRef = React.useRef<IntersectionObserver | null>(null)
  const visibilityStoreRef =
    React.useRef<MessageScrollerVisibilityStore | null>(null)
  const visibleMessageIdsRef = React.useRef(new Set<string>())
  const handledScrollAnchorsRef = React.useRef(new WeakSet<HTMLElement>())

  if (pendingDefaultScrollStoreRef.current === null) {
    pendingDefaultScrollStoreRef.current = createMessageScrollerStore(
      defaultScrollPosition === "end" ||
        defaultScrollPosition === "last-anchor",
      (current, next) => current === next
    )
  }

  if (stateStoreRef.current === null) {
    stateStoreRef.current = createMessageScrollerStore(
      EMPTY_MESSAGE_SCROLLER_SCROLLABLE,
      areScrollStatesEqual
    )
  }

  if (visibilityStoreRef.current === null) {
    visibilityStoreRef.current = createMessageScrollerVisibilityStore()
  }

  // Track the latest prop values on every render so callbacks read fresh values
  // without being recreated (the useLatest pattern).
  autoScrollRef.current = autoScroll
  scrollEdgeThresholdRef.current = scrollEdgeThreshold
  scrollMarginRef.current = scrollMargin
  scrollPreviousItemPeekRef.current = scrollPreviousItemPeek

  return {
    autoScrollRef,
    autoscrollingRef,
    autoscrollingTimeoutRef,
    streamingTurnRef,
    contentRef,
    defaultScrollPositionAppliedRef,
    firstItemRef,
    itemCountRef,
    lastScrollTopRef,
    messageElementsRef,
    modeRef,
    pendingScrollFrameRef,
    pendingScrollToMessageRef,
    prependRestoreRef,
    preserveScrollOnPrependRef,
    pendingDefaultScrollStore: pendingDefaultScrollStoreRef.current,
    rootRef,
    scrollEdgeThresholdRef,
    scrollMarginRef,
    scrollPreviousItemPeekRef,
    spacerGapRef,
    spacerHeightRef,
    spacerRef,
    stateFrameRef,
    stateStore: stateStoreRef.current,
    viewportRef,
    visibilityFrameRef,
    visibilityObserverRef,
    visibilityStore: visibilityStoreRef.current,
    visibleMessageIdsRef,
    handledScrollAnchorsRef,
  }
}

function clearPendingDefaultScroll(refs: MessageScrollerRefs) {
  refs.pendingDefaultScrollStore.setSnapshot(false)
}

function markDefaultScrollPositionApplied(refs: MessageScrollerRefs) {
  refs.defaultScrollPositionAppliedRef.current = true
  clearPendingDefaultScroll(refs)
}

// --- use-message-scroller-commands.ts ---

// Imperative scroll primitives, split from the controller so the move mechanics
// live apart from the policy that decides when to run them. Each command resolves
// a target scrollTop and returns false when the viewport is not mounted yet.
function useMessageScrollerCommands({
  refs,
  commitScrollState,
  scheduleStateCommit,
  scheduleVisibilitySync,
}: {
  refs: MessageScrollerRefs
  commitScrollState: () => void
  scheduleStateCommit: () => void
  scheduleVisibilitySync: () => void
}) {
  const {
    streamingTurnRef,
    autoScrollRef,
    autoscrollingRef,
    autoscrollingTimeoutRef,
    contentRef,
    itemCountRef,
    messageElementsRef,
    modeRef,
    pendingScrollToMessageRef,
    prependRestoreRef,
    scrollMarginRef,
    scrollPreviousItemPeekRef,
    spacerGapRef,
    spacerHeightRef,
    spacerRef,
    viewportRef,
  } = refs

  const setAutoScrolling = React.useCallback(
    (autoscrolling: boolean) => {
      if (autoscrollingTimeoutRef.current !== null) {
        window.clearTimeout(autoscrollingTimeoutRef.current)
        autoscrollingTimeoutRef.current = null
      }

      if (autoscrollingRef.current !== autoscrolling) {
        autoscrollingRef.current = autoscrolling
        commitScrollState()
      }

      if (autoscrolling) {
        autoscrollingTimeoutRef.current = window.setTimeout(() => {
          autoscrollingTimeoutRef.current = null
          autoscrollingRef.current = false
          commitScrollState()
        }, AUTOSCROLLING_CLEAR_DELAY)
      }
    },
    [commitScrollState]
  )

  const setTailSpacerHeight = React.useCallback((height: number) => {
    const spacer = spacerRef.current

    if (!spacer) {
      return
    }

    const nextHeight = Math.max(0, Math.ceil(height))

    if (spacerHeightRef.current === nextHeight) {
      return
    }

    spacerHeightRef.current = nextHeight
    spacer.hidden = nextHeight === 0
    spacer.style.height = `${nextHeight}px`
    spacer.style.marginTop = nextHeight > 0 ? `${-spacerGapRef.current}px` : ""
  }, [])

  const scrollToPosition = React.useCallback(
    (
      scrollTop: number,
      {
        behavior = "auto",
        autoscrolling = false,
      }: {
        behavior?: ScrollBehavior
        autoscrolling?: boolean
      } = {}
    ) => {
      const viewport = viewportRef.current

      if (!viewport) {
        return
      }

      const nextScrollTop = Math.max(0, scrollTop)

      if (
        Math.abs(viewport.scrollTop - nextScrollTop) <= SCROLL_POSITION_EPSILON
      ) {
        viewport.scrollTop = nextScrollTop
        commitScrollState()
        return
      }

      if (autoscrolling) {
        setAutoScrolling(true)
      }

      viewport.scrollTo({
        top: nextScrollTop,
        behavior,
      })
      scheduleStateCommit()
    },
    [commitScrollState, scheduleStateCommit, setAutoScrolling]
  )

  const scrollToStart = React.useCallback(
    ({ behavior = "auto" }: MessageScrollerScrollOptions = {}) => {
      if (!viewportRef.current) {
        return false
      }

      setTailSpacerHeight(0)
      streamingTurnRef.current = null
      modeRef.current = "free-scrolling"
      scrollToPosition(0, { behavior })
      scheduleVisibilitySync()

      return true
    },
    [scheduleVisibilitySync, scrollToPosition, setTailSpacerHeight]
  )

  const scrollToEnd = React.useCallback(
    ({ behavior = "auto" }: MessageScrollerScrollOptions = {}) => {
      const viewport = viewportRef.current

      if (!viewport) {
        return false
      }

      setTailSpacerHeight(0)
      streamingTurnRef.current = null
      modeRef.current = autoScrollRef.current
        ? "following-bottom"
        : "free-scrolling"
      scrollToPosition(getMaxScrollTop(viewport), {
        autoscrolling: true,
        behavior,
      })
      scheduleVisibilitySync()

      return true
    },
    [scheduleVisibilitySync, scrollToPosition, setTailSpacerHeight]
  )

  const scrollToElement = React.useCallback(
    (
      element: HTMLElement,
      {
        align = "start",
        behavior = "auto",
        scrollMargin = scrollMarginRef.current,
      }: MessageScrollerScrollOptions = {},
      {
        keepPreviousPeek = false,
      }: {
        keepPreviousPeek?: boolean
      } = {}
    ) => {
      const content = contentRef.current
      const viewport = viewportRef.current

      if (!content || !viewport || !content.contains(element)) {
        return false
      }

      const scrollTop = getElementScrollTop({
        align,
        element,
        scrollMargin: keepPreviousPeek
          ? scrollMargin + scrollPreviousItemPeekRef.current
          : scrollMargin,
        spacer: spacerRef.current,
        viewport,
      })

      const nextSpacerHeight = getTailSpacerHeight({
        content,
        scrollTop,
        spacer: spacerRef.current,
        viewport,
      })

      setTailSpacerHeight(nextSpacerHeight)
      // Seed the prepend anchor with the jump target so a prepend that lands
      // before this scroll settles still preserves the jumped-to row; once it
      // settles, syncAfterScroll's capturePrependAnchor re-captures it from the
      // first visible row.
      prependRestoreRef.current = {
        element,
        offset: getElementContentOffset(element, content),
      }

      modeRef.current = keepPreviousPeek
        ? "anchored-to-message"
        : "settling-jump"
      streamingTurnRef.current = keepPreviousPeek ? element : null

      scrollToPosition(scrollTop, { behavior })
      scheduleVisibilitySync()

      return true
    },
    [scheduleVisibilitySync, scrollToPosition, setTailSpacerHeight]
  )

  const reanchorToAnchoredMessage = React.useCallback(() => {
    const element = streamingTurnRef.current

    if (
      !element ||
      !element.isConnected ||
      modeRef.current !== "anchored-to-message"
    ) {
      return false
    }

    // Re-run the placement so the tail spacer is recomputed for the new content
    // height and the turn is held at the reading line.
    return scrollToElement(
      element,
      { align: "start" },
      { keepPreviousPeek: true }
    )
  }, [scrollToElement])

  // The target row may not be mounted yet (e.g. an async-loaded transcript).
  // When it is missing the request is queued in pendingScrollToMessageRef and
  // flushed later — on registerMessage for that id, or on the next content
  // change. An explicit jump also marks the mount default as applied, so
  // defaultScrollPosition does not override it.
  const scrollToMessage = React.useCallback(
    (messageId: string, options?: MessageScrollerScrollOptions) => {
      const element = messageElementsRef.current.get(messageId)

      if (!element) {
        if (itemCountRef.current === 0) {
          pendingScrollToMessageRef.current = {
            messageId,
            options,
          }
          markDefaultScrollPositionApplied(refs)

          return true
        }

        return false
      }

      markDefaultScrollPositionApplied(refs)

      if (scrollToElement(element, options)) {
        pendingScrollToMessageRef.current = null
        return true
      }

      pendingScrollToMessageRef.current = {
        messageId,
        options,
      }

      return true
    },
    [scrollToElement]
  )

  const flushPendingScrollToMessage = React.useCallback(() => {
    const pending = pendingScrollToMessageRef.current

    if (!pending) {
      return false
    }

    const element = messageElementsRef.current.get(pending.messageId)

    if (!element) {
      return false
    }

    const handled = scrollToElement(element, pending.options)

    if (!handled) {
      return false
    }

    pendingScrollToMessageRef.current = null
    markDefaultScrollPositionApplied(refs)

    return true
  }, [scrollToElement])

  return {
    flushPendingScrollToMessage,
    reanchorToAnchoredMessage,
    scrollToElement,
    scrollToEnd,
    scrollToMessage,
    scrollToStart,
  }
}

// --- use-message-scroller-controller.ts ---

// Builds a ref callback that stores the node and runs onMount once it attaches.
function useElementRef(
  elementRef: React.RefObject<HTMLDivElement | null>,
  onMount: () => void
) {
  return React.useCallback(
    (element: HTMLDivElement | null) => {
      elementRef.current = element

      if (element) {
        onMount()
      }
    },
    [elementRef, onMount]
  )
}

// Orchestrator hook. Decides when to scroll and delegates the moves to
// useMessageScrollerCommands; state and visibility commits are coalesced on a
// requestAnimationFrame and torn down on cleanup for StrictMode safety.
function useMessageScrollerController({
  autoScroll = false,
  defaultScrollPosition = "end",
  scrollEdgeThreshold = DEFAULT_SCROLL_EDGE_THRESHOLD,
  scrollPreviousItemPeek = DEFAULT_SCROLL_PREVIOUS_ITEM_PEEK,
  scrollMargin = DEFAULT_SCROLL_MARGIN,
}: MessageScrollerProviderProps) {
  const refs = useMessageScrollerRefs({
    autoScroll,
    defaultScrollPosition,
    scrollEdgeThreshold,
    scrollMargin,
    scrollPreviousItemPeek,
  })

  const {
    streamingTurnRef,
    autoScrollRef,
    autoscrollingRef,
    autoscrollingTimeoutRef,
    contentRef,
    defaultScrollPositionAppliedRef,
    firstItemRef,
    itemCountRef,
    lastScrollTopRef,
    messageElementsRef,
    modeRef,
    pendingScrollFrameRef,
    pendingScrollToMessageRef,
    prependRestoreRef,
    preserveScrollOnPrependRef,
    pendingDefaultScrollStore,
    rootRef,
    scrollEdgeThresholdRef,
    scrollMarginRef,
    scrollPreviousItemPeekRef,
    spacerGapRef,
    spacerHeightRef,
    spacerRef,
    stateFrameRef,
    stateStore,
    viewportRef,
    visibilityFrameRef,
    visibilityObserverRef,
    visibilityStore,
    visibleMessageIdsRef,
    handledScrollAnchorsRef,
  } = refs

  const previousDefaultScrollPositionRef = React.useRef(defaultScrollPosition)

  if (previousDefaultScrollPositionRef.current !== defaultScrollPosition) {
    previousDefaultScrollPositionRef.current = defaultScrollPosition
    defaultScrollPositionAppliedRef.current = false
    // The pending-scroll hold is mount-only. A live prop change re-applies the
    // opening position in layout; it does not hide the viewport again.
  }

  const writeStateAttributes = React.useCallback(
    (state: MessageScrollerScrollable) => {
      const root = rootRef.current
      const viewport = viewportRef.current
      const scrollable = [state.start && "start", state.end && "end"]
        .filter(Boolean)
        .join(" ")
      const autoScrolling = autoscrollingRef.current

      for (const element of [root, viewport]) {
        if (!element) {
          continue
        }

        if (scrollable) {
          element.setAttribute("data-scrollable", scrollable)
        } else {
          element.removeAttribute("data-scrollable")
        }

        element.toggleAttribute("data-autoscrolling", autoScrolling)
      }
    },
    []
  )

  // Owns the one follow-bottom transition: arm at the bottom, release on any
  // scroll away (including a scrollbar drag), suppressed during a programmatic
  // scroll so the auto-scroll animation cannot release itself. Arming also
  // skips the anchored-to-message hold: the tail spacer makes a freshly
  // anchored turn read as "at the end", and re-arming there would let the
  // first streamed chunk yank the reader off the anchor. The hold hands back
  // to following in handleResize, once the reply consumes the tail spacer.
  const reconcileFollowMode = React.useCallback(
    (scrollable: MessageScrollerScrollable) => {
      const scrollTop = viewportRef.current?.scrollTop ?? 0
      // Content growing past the live edge also reads as "not at the end", but
      // only a scrollbar drag moves scrollTop up. Growth must not release
      // follow-output: the resize handler is coalesced onto a frame, so a state
      // commit can observe the grown content before follow catches up.
      const scrolledUp =
        scrollTop < lastScrollTopRef.current - SCROLL_POSITION_EPSILON

      lastScrollTopRef.current = scrollTop

      if (
        autoScrollRef.current &&
        !scrollable.end &&
        modeRef.current !== "settling-jump" &&
        modeRef.current !== "anchored-to-message"
      ) {
        modeRef.current = "following-bottom"
      } else if (
        modeRef.current === "following-bottom" &&
        scrollable.end &&
        scrolledUp &&
        !autoscrollingRef.current
      ) {
        modeRef.current = "free-scrolling"
      }
    },
    []
  )

  const commitScrollState = React.useCallback(() => {
    const nextState = getMessageScrollerScrollable({
      content: contentRef.current,
      scrollEdgeThreshold: scrollEdgeThresholdRef.current,
      spacer: spacerRef.current,
      viewport: viewportRef.current,
    })

    reconcileFollowMode(nextState)

    // While follow-output is engaged the scroller is already closing any gap a
    // streamed chunk just opened, so publishing it as scrollable toward the
    // end would strobe the scroll button once per chunk. Reconcile runs on the
    // raw geometry first, so a commit that releases follow still publishes the
    // gap it released over.
    const publishedState =
      modeRef.current === "following-bottom"
        ? { ...nextState, end: false }
        : nextState

    writeStateAttributes(publishedState)
    stateStore.setSnapshot(publishedState)
  }, [reconcileFollowMode, stateStore, writeStateAttributes])

  const scheduleStateCommit = React.useCallback(() => {
    if (stateFrameRef.current !== null) {
      return
    }

    stateFrameRef.current = window.requestAnimationFrame(() => {
      // agentui: while the reader scrolls freely, read once the frame is
      // painted, not before its layout (see syncAfterScroll).
      if (modeRef.current === "free-scrolling") {
        window.setTimeout(() => {
          stateFrameRef.current = null
          commitScrollState()
        })
        return
      }

      stateFrameRef.current = null
      commitScrollState()
    })
  }, [commitScrollState])

  const scheduleVisibilitySync = React.useCallback(() => {
    if (!visibilityStore.hasListeners()) {
      return
    }

    if (visibilityFrameRef.current !== null) {
      return
    }

    visibilityFrameRef.current = window.requestAnimationFrame(() => {
      visibilityFrameRef.current = null

      // A frame can outlive the last unsubscribe. Recomputing here would
      // overwrite the EMPTY snapshot that teardown just wrote, leaving a stale
      // value for the next subscriber to read.
      if (!visibilityStore.hasListeners()) {
        return
      }

      visibilityStore.setSnapshot(
        getMessageScrollerVisibilityState({
          content: contentRef.current,
          scrollMargin: scrollMarginRef.current,
          scrollPreviousItemPeek: scrollPreviousItemPeekRef.current,
          spacer: spacerRef.current,
          viewport: viewportRef.current,
          visibleMessageIds: visibleMessageIdsRef.current,
        })
      )
    })
  }, [visibilityStore])

  const {
    flushPendingScrollToMessage,
    reanchorToAnchoredMessage,
    scrollToElement,
    scrollToEnd,
    scrollToMessage,
    scrollToStart,
  } = useMessageScrollerCommands({
    refs,
    commitScrollState,
    scheduleStateCommit,
    scheduleVisibilitySync,
  })

  const restorePrependedAnchor = React.useCallback(() => {
    const anchor = prependRestoreRef.current
    const viewport = viewportRef.current
    const content = contentRef.current

    if (!anchor || !viewport || !content || !anchor.element.isConnected) {
      return false
    }

    // agentui: by how far the rows put before it moved it down the content
    // (the browser's scroll anchoring is off, so it has not).
    const offset = getElementContentOffset(anchor.element, content)
    const delta = offset - anchor.offset

    if (Math.abs(delta) <= SCROLL_POSITION_EPSILON) {
      return false
    }

    viewport.scrollTop += delta
    anchor.offset = offset
    scheduleStateCommit()
    scheduleVisibilitySync()

    return true
  }, [scheduleStateCommit, scheduleVisibilitySync])

  // agentui: while the reader scrolls freely, what they look at stays
  // where it is as the content above it changes size: messages coming
  // into view render at their real height, not the guess they had, and the
  // browser's own scroll anchoring is off (WebKit has none, and Firefox's
  // misses these), so one way holds in every browser. Nothing is read or
  // written as the reader scrolls: a scroll moves no row in the content.
  //
  // - A row changing size (a message mounting, a fold opening) is told by
  //   a ResizeObserver on the rows, after layout and before paint: by how
  //   much each changed, the scroll moves by what changed above what is in
  //   view (keepPlaceOnResize), reading only the rows that changed, on a
  //   layout already done.
  // - Rows added or gone (handleContentChange) are measured by the first
  //   message in view, noted by its offset in the content (a scroll does
  //   not change it): noted once the reader stops, and after each change.
  const placeRef = React.useRef<{
    element: HTMLElement
    offset: number
  } | null>(null)
  const notePlace = React.useCallback(() => {
    const content = contentRef.current
    const viewport = viewportRef.current

    if (!content || !viewport) {
      placeRef.current = null
      return
    }

    const contentTop = content.getBoundingClientRect().top
    const view = viewport.getBoundingClientRect()
    const inView = (rect: DOMRect) =>
      rect.bottom > view.top && rect.top < view.bottom
    // The first in view whose content is rendered and whose top is in
    // view: one coming into view may still be at the guess, and its
    // growing would not move its own top, only what is below it, what the
    // reader looks at; one across the top, the same, as it changes size
    // (a clamp closing, a fold). Else the first rendered across the top,
    // else the first in view.
    const first = getFirstVisibleMessageItem({
      content,
      spacer: spacerRef.current,
      viewport,
    })
    let across: { element: HTMLElement; rect: DOMRect } | null = null
    let item: { element: HTMLElement; rect: DOMRect } | null = null

    for (
      let next = first;
      next;
      next = next.nextElementSibling as HTMLElement | null
    ) {
      const rect = next.getBoundingClientRect()

      if (!inView(rect)) {
        break
      }

      if (!next.dataset.messageId || !isRendered(next)) {
        continue
      }

      if (rect.top >= view.top - SCROLL_POSITION_EPSILON) {
        item = { element: next, rect }
        break
      }

      across ??= { element: next, rect }
    }

    const place =
      item ??
      across ??
      (first ? { element: first, rect: first.getBoundingClientRect() } : null)
    placeRef.current = place
      ? { element: place.element, offset: place.rect.top - contentTop }
      : null
  }, [])

  /** Rows added or gone above the place: back to it, then noted again. */
  const holdPlace = React.useCallback(() => {
    const content = contentRef.current
    const viewport = viewportRef.current
    const place = placeRef.current
    let moved = 0

    if (
      content &&
      viewport &&
      place?.element.isConnected &&
      modeRef.current === "free-scrolling" &&
      !autoscrollingRef.current
    ) {
      moved = getElementContentOffset(place.element, content) - place.offset

      if (Math.abs(moved) > SCROLL_POSITION_EPSILON) {
        viewport.scrollTop += moved
      } else {
        moved = 0
      }
    }

    notePlace()
    return moved !== 0
  }, [notePlace])

  // Each row's last height, to tell by how much it changed.
  const rowHeightsRef = React.useRef(new WeakMap<Element, number>())
  const keepPlaceOnResize = React.useCallback(
    (entries: ResizeObserverEntry[]) => {
      const heights = rowHeightsRef.current
      const changed: { element: HTMLElement; delta: number }[] = []

      for (const entry of entries) {
        const height =
          entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height
        const before = heights.get(entry.target)
        heights.set(entry.target, height)

        if (
          before !== undefined &&
          Math.abs(height - before) > SCROLL_POSITION_EPSILON
        ) {
          changed.push({
            element: entry.target as HTMLElement,
            delta: height - before,
          })
        }
      }

      const viewport = viewportRef.current

      if (
        changed.length === 0 ||
        !viewport ||
        modeRef.current !== "free-scrolling" ||
        autoscrollingRef.current
      ) {
        return
      }

      // Read on the layout the observer is told after: no layout forced.
      const view = viewport.getBoundingClientRect()
      const rows = changed
        .map((row) => ({ ...row, rect: row.element.getBoundingClientRect() }))
        .sort((a, b) => a.rect.top - b.rect.top)
      // How far the rows before each pushed it down: where it was before.
      let pushed = 0
      let moved = 0

      for (const row of rows) {
        const top = row.rect.top - pushed
        const bottom = top + row.rect.height - row.delta
        // Above what is in view, or across its top with another row's top
        // in view under it (one filling the view is what the reader reads:
        // it grows on below them, as they are).
        if (
          top < view.top - SCROLL_POSITION_EPSILON &&
          bottom < view.bottom - SCROLL_POSITION_EPSILON
        ) {
          moved += row.delta
        }

        pushed += row.delta
      }

      if (Math.abs(moved) > SCROLL_POSITION_EPSILON) {
        viewport.scrollTop += moved
      }

      // Noted again on what it shows now (still no layout to force).
      if (placeRef.current) {
        notePlace()
      }
    },
    [notePlace]
  )
  const rowSizesRef = React.useRef<ResizeObserver | null>(null)
  const observeRowSize = React.useCallback(
    (element: HTMLElement, observe: boolean) => {
      if (typeof ResizeObserver === "undefined") {
        return
      }

      if (!observe) {
        rowSizesRef.current?.unobserve(element)
        rowHeightsRef.current.delete(element)
        return
      }

      rowSizesRef.current ??= new ResizeObserver(keepPlaceOnResize)
      rowSizesRef.current.observe(element, { box: "border-box" })
    },
    [keepPlaceOnResize]
  )
  React.useEffect(
    () => () => {
      rowSizesRef.current?.disconnect()
      rowSizesRef.current = null
    },
    []
  )

  const capturePrependAnchor = React.useCallback(() => {
    const content = contentRef.current
    const viewport = viewportRef.current

    if (!content || !viewport) {
      prependRestoreRef.current = null
      return
    }

    const anchor = getFirstVisibleMessageItem({
      content,
      spacer: spacerRef.current,
      viewport,
    })

    prependRestoreRef.current = anchor
      ? { element: anchor, offset: getElementContentOffset(anchor, content) }
      : null
  }, [])

  const schedulePendingScrollToMessageFlush = React.useCallback(() => {
    if (pendingScrollFrameRef.current !== null) {
      return
    }

    pendingScrollFrameRef.current = window.requestAnimationFrame(() => {
      pendingScrollFrameRef.current = null

      if (flushPendingScrollToMessage()) {
        capturePrependAnchor()
      }
    })
  }, [capturePrependAnchor, flushPendingScrollToMessage])

  const applyDefaultScrollPosition = React.useCallback(() => {
    if (
      !defaultScrollPosition ||
      defaultScrollPositionAppliedRef.current ||
      itemCountRef.current === 0
    ) {
      return false
    }

    let handled: boolean

    if (defaultScrollPosition === "last-anchor") {
      const content = contentRef.current
      const viewport = viewportRef.current
      const anchor =
        content && viewport
          ? getLastScrollAnchor(
              getMessageScrollerItems(content, spacerRef.current)
            )
          : null

      if (!content || !viewport || !anchor) {
        handled = scrollToEnd({ behavior: "auto" })
      } else {
        const anchorTop = getElementTop(anchor, viewport)
        const contentBottom = getContentBottom({
          content,
          spacer: spacerRef.current,
          viewport,
        })
        // A short last turn already fits below the anchor, so opening at the end
        // shows the whole turn without leaving a blank gap beneath it.
        const lastTurnFits = contentBottom - anchorTop <= viewport.clientHeight

        handled = lastTurnFits
          ? scrollToEnd({ behavior: "auto" })
          : scrollToElement(
              anchor,
              { align: "start" },
              { keepPreviousPeek: true }
            )
      }
    } else {
      handled =
        defaultScrollPosition === "end"
          ? scrollToEnd({ behavior: "auto" })
          : scrollToStart({ behavior: "auto" })
    }

    if (!handled) {
      return false
    }

    markDefaultScrollPositionApplied(refs)

    return true
  }, [defaultScrollPosition, scrollToElement, scrollToEnd, scrollToStart])

  const handleContentChange = React.useCallback(() => {
    const content = contentRef.current

    if (!content) {
      return
    }

    // agentui: rows added or gone above the place keep it.
    const held = holdPlace()

    const items = getMessageScrollerItems(content, spacerRef.current)
    // agentui: every row's size watched, the app's with no messageId too
    // (they are not registered): one above the view mounting (windowed,
    // first measured) keeps the place as a registered one does.
    for (const item of items) observeRowSize(item, true)
    const previousItemCount = itemCountRef.current
    const previousFirstItem = firstItemRef.current

    itemCountRef.current = items.length
    firstItemRef.current = items[0] ?? null

    // Reconcile the scroll position with the new content. Every path re-captures
    // the prepend anchor afterward, so each branch just returns.
    //
    // Branch order is load-bearing: first-content, prepended, appended, updated.
    const reconcileScrollPosition = () => {
      if (flushPendingScrollToMessage()) {
        return
      }

      if (previousItemCount === 0) {
        if (applyDefaultScrollPosition()) {
          return
        }

        if (
          items.length > 0 &&
          autoScrollRef.current &&
          scrollToEnd({ behavior: "auto" })
        ) {
          return
        }

        commitScrollState()
        scheduleVisibilitySync()
        return
      }

      const previousFirstItemIndex = previousFirstItem
        ? items.indexOf(previousFirstItem)
        : -1
      const didPrepend =
        preserveScrollOnPrependRef.current && previousFirstItemIndex > 0

      if (didPrepend) {
        // Prepended rows are not new appends. Restore the prior scroll position,
        // unless the place already held it.
        if (!held) {
          restorePrependedAnchor()
        }
        return
      }

      if (items.length > previousItemCount) {
        const anchor = getNewScrollAnchor(items, previousItemCount)

        if (anchor) {
          // While the reader is following the live end, a batch of several
          // anchored turns arriving at once should keep following the end — not
          // yank back to anchor the first turn of the batch. A single new anchor
          // still moves to the top as usual.
          if (
            autoScrollRef.current &&
            modeRef.current === "following-bottom" &&
            hasMultipleNewScrollAnchors(items, previousItemCount)
          ) {
            scrollToEnd({ behavior: "auto" })
            return
          }

          scrollToElement(
            anchor,
            { align: "start" },
            { keepPreviousPeek: true }
          )
          handledScrollAnchorsRef.current.add(anchor)
          return
        }
      }

      if (items.length === previousItemCount) {
        const anchor = getUnanchoredScrollAnchor(
          items,
          handledScrollAnchorsRef.current
        )

        if (anchor) {
          scrollToElement(
            anchor,
            { align: "start" },
            { keepPreviousPeek: true }
          )
          handledScrollAnchorsRef.current.add(anchor)
          return
        }
      }

      // Appends with no new anchor (and content-only updates) fall through here:
      // keep following the end if we still are, otherwise just recommit state.
      if (modeRef.current === "following-bottom" && autoScrollRef.current) {
        scrollToEnd({ behavior: "auto" })
      } else {
        commitScrollState()
        scheduleVisibilitySync()
      }
    }

    reconcileScrollPosition()
    capturePrependAnchor()
  }, [
    applyDefaultScrollPosition,
    capturePrependAnchor,
    commitScrollState,
    flushPendingScrollToMessage,
    holdPlace,
    observeRowSize,
    restorePrependedAnchor,
    scheduleVisibilitySync,
    scrollToElement,
    scrollToEnd,
  ])

  const handleResize = React.useCallback(() => {
    if (modeRef.current === "following-bottom" && autoScrollRef.current) {
      scrollToEnd({ behavior: "auto" })
      return
    }

    // Hold the anchored turn in place as content below it resizes (a reply
    // streaming in, or a transient marker collapsing) — otherwise the shrinking
    // content lets the browser clamp scrollTop and the turn drops.
    const previousSpacerHeight = spacerHeightRef.current

    if (reanchorToAnchoredMessage()) {
      // The reply streaming below the anchor consumes the tail spacer as it
      // grows. Once the last of it is gone the reply has filled the viewport
      // and the reader is genuinely at the live edge, so autoScroll hands off
      // from the anchor hold to following the bottom. Requiring the >0 → 0
      // transition keeps a turn taller than the viewport (placed with no
      // spacer) held instead of yanked to the end.
      if (
        autoScrollRef.current &&
        previousSpacerHeight > 0 &&
        spacerHeightRef.current === 0
      ) {
        scrollToEnd({ behavior: "auto" })
      }

      return
    }

    scheduleStateCommit()
    scheduleVisibilitySync()
  }, [
    reanchorToAnchoredMessage,
    scheduleStateCommit,
    scheduleVisibilitySync,
    scrollToEnd,
  ])

  const observeVisibility = React.useCallback(() => {
    const viewport = viewportRef.current

    if (!viewport || !visibilityStore.hasListeners()) {
      return
    }

    if (typeof IntersectionObserver === "undefined") {
      scheduleVisibilitySync()
      return
    }

    if (!visibilityObserverRef.current) {
      visibilityObserverRef.current = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const messageId = (entry.target as HTMLElement).dataset.messageId

            if (!messageId) {
              continue
            }

            if (entry.isIntersecting) {
              visibleMessageIdsRef.current.add(messageId)
            } else {
              visibleMessageIdsRef.current.delete(messageId)
            }
          }

          scheduleVisibilitySync()
        },
        {
          root: viewport,
          // Shrink the root's top edge to the anchoring line so a previous turn
          // peeking in the scrollMargin + peek band is not reported as visible,
          // keeping visibleMessageIds consistent with currentAnchorId. Captured
          // at observe time; a prop change rebuilds the observer on resubscribe.
          rootMargin: `${-(
            scrollMarginRef.current + scrollPreviousItemPeekRef.current
          )}px 0px 0px 0px`,
          threshold: [0, 0.01, 0.5, 1],
        }
      )
    }

    messageElementsRef.current.forEach((element) => {
      visibilityObserverRef.current?.observe(element)
    })
    scheduleVisibilitySync()
  }, [scheduleVisibilitySync, visibilityStore])

  const unobserveVisibility = React.useCallback(() => {
    if (visibilityFrameRef.current !== null) {
      window.cancelAnimationFrame(visibilityFrameRef.current)
      visibilityFrameRef.current = null
    }

    visibilityObserverRef.current?.disconnect()
    visibilityObserverRef.current = null
    visibleMessageIdsRef.current.clear()
    visibilityStore.setSnapshot(EMPTY_MESSAGE_SCROLLER_VISIBILITY_STATE)
  }, [visibilityStore])

  const registerMessage = React.useCallback<MessageScrollerRegisterMessage>(
    (messageId, element, removedElement) => {
      if (element) {
        messageElementsRef.current.set(messageId, element)
        visibilityObserverRef.current?.observe(element)
        observeRowSize(element, true)
        scheduleVisibilitySync()

        if (pendingScrollToMessageRef.current?.messageId === messageId) {
          schedulePendingScrollToMessageFlush()
        }

        return
      }

      if (
        removedElement &&
        messageElementsRef.current.get(messageId) === removedElement
      ) {
        messageElementsRef.current.delete(messageId)
        visibleMessageIdsRef.current.delete(messageId)
        visibilityObserverRef.current?.unobserve(removedElement)
        observeRowSize(removedElement, false)
        scheduleVisibilitySync()
      }
    },
    [observeRowSize, schedulePendingScrollToMessageFlush, scheduleVisibilitySync]
  )

  // agentui: whether a pointer is held down in the viewport (on its
  // scrollbar, or carrying a text selection past its edge): the reader's
  // scrolling, which keepEndThroughRebuild leaves alone.
  const pointerHeldRef = React.useRef(false)
  // agentui: where the last scroll event left the viewport while following
  // (a script's scroll is told by one before the next frame): the place a
  // rebuild is measured from.
  const followedScrollTopRef = React.useRef(0)

  // agentui: a message rebuilt in place, its nodes taken out and put back
  // with a layout read in between (as a renderer does finishing a streamed
  // reply), has the browser fit the scroll to the content without them:
  // up from the end, by as much as they took. The content back, the end is
  // below again and the scroll read as the reader's, so following was let
  // go. Seen as the task that did it ends, before any scroll is read, the
  // end is taken back at once. Read only where nodes went, as only that
  // shrinks the content.
  const keepEndThroughRebuild = React.useCallback(
    (mutations: MutationRecord[]) => {
      const viewport = viewportRef.current

      if (
        !viewport ||
        modeRef.current !== "following-bottom" ||
        !autoScrollRef.current ||
        pointerHeldRef.current ||
        !mutations.some((mutation) => mutation.removedNodes.length > 0)
      ) {
        return
      }

      if (
        viewport.scrollTop <
        followedScrollTopRef.current - SCROLL_POSITION_EPSILON
      ) {
        scrollToEnd({ behavior: "auto" })
      }
    },
    [scrollToEnd]
  )

  const userScrollIntent = React.useCallback(() => {
    if (
      modeRef.current === "following-bottom" ||
      modeRef.current === "anchored-to-message" ||
      modeRef.current === "settling-jump"
    ) {
      // A deliberate gesture releases auto-follow, turn-anchoring, and an in-flight
      // programmatic jump so re-pinning (and re-arming) never fights the reader.
      streamingTurnRef.current = null
      modeRef.current = "free-scrolling"
    }
  }, [])

  const mirrorStateAttributes = React.useCallback(
    () => writeStateAttributes(stateStore.getSnapshot()),
    [stateStore, writeStateAttributes]
  )

  const setRootElement = useElementRef(rootRef, mirrorStateAttributes)
  // agentui: the browser's scroll anchoring off, as holdPlace keeps the
  // place in every browser.
  const mountViewport = React.useCallback(() => {
    if (viewportRef.current) viewportRef.current.style.overflowAnchor = "none"
    mirrorStateAttributes()
  }, [mirrorStateAttributes])
  const setViewportElement = useElementRef(viewportRef, mountViewport)

  const setContentElement = React.useCallback(
    (element: HTMLDivElement | null) => {
      contentRef.current = element
    },
    []
  )

  const setSpacerElement = React.useCallback(
    (element: HTMLDivElement | null) => {
      spacerRef.current = element
      spacerGapRef.current = getFlexGap(element?.parentElement ?? null)
    },
    []
  )

  // agentui: once a frame, not on every scroll event: a trackpad gives
  // several a frame, and each read the rows' rects, forcing a layout of the
  // whole conversation wherever layout was dirty (a hover, a commit).
  const scrollFrameRef = React.useRef<number | null>(null)
  const scrollIdleRef = React.useRef(0)
  const syncAfterScroll = React.useCallback(() => {
    scheduleVisibilitySync()

    if (modeRef.current === "following-bottom" && viewportRef.current) {
      followedScrollTopRef.current = viewportRef.current.scrollTop
    }

    if (scrollFrameRef.current !== null) {
      return
    }

    scrollFrameRef.current = window.requestAnimationFrame(() => {
      // agentui: while the reader scrolls freely, nothing is read before
      // the frame's layout, where a row just mounted would force one: the
      // state (the edges reached) is read once the frame is painted, on
      // the layout it drew; the place and the prepend anchor are noted
      // once they stop, as a scroll does not move them in the content and
      // a row changing size meanwhile is told by keepPlaceOnResize.
      if (modeRef.current === "free-scrolling") {
        window.setTimeout(() => {
          scrollFrameRef.current = null
          commitScrollState()
        })
        return
      }

      scrollFrameRef.current = null
      commitScrollState()
      notePlace()
      capturePrependAnchor()
    })

    window.clearTimeout(scrollIdleRef.current)
    scrollIdleRef.current = window.setTimeout(() => {
      notePlace()
      capturePrependAnchor()
    }, SCROLL_IDLE)
  }, [
    capturePrependAnchor,
    commitScrollState,
    notePlace,
    scheduleVisibilitySync,
  ])
  React.useEffect(() => () => window.clearTimeout(scrollIdleRef.current), [])

  const context = React.useMemo<MessageScrollerContextValue>(
    () => ({
      handleContentChange,
      handleResize,
      holdPlace,
      keepEndThroughRebuild,
      pointerHeldRef,
      observeVisibility,
      pendingDefaultScrollStore,
      preserveScrollOnPrependRef,
      scrollToEnd,
      scrollToMessage,
      scrollToStart,
      setContentElement,
      setRootElement,
      setSpacerElement,
      setViewportElement,
      stateStore,
      syncAfterScroll,
      unobserveVisibility,
      userScrollIntent,
      viewportRef,
      visibilityStore,
    }),
    [
      handleContentChange,
      handleResize,
      holdPlace,
      keepEndThroughRebuild,
      observeVisibility,
      pendingDefaultScrollStore,
      scrollToEnd,
      scrollToMessage,
      scrollToStart,
      setContentElement,
      setRootElement,
      setSpacerElement,
      setViewportElement,
      stateStore,
      syncAfterScroll,
      unobserveVisibility,
      userScrollIntent,
      visibilityStore,
    ]
  )

  React.useLayoutEffect(() => {
    if (applyDefaultScrollPosition()) {
      return
    }

    if (itemCountRef.current === 0) {
      clearPendingDefaultScroll(refs)
    }
  }, [applyDefaultScrollPosition])

  React.useEffect(() => {
    return () => {
      // Reset every ref after cancelling. StrictMode replays effects on the same
      // refs (unmount then remount), so a frame id left non-null here makes the
      // scheduler on remount think a frame is still pending and never reschedule.
      if (stateFrameRef.current !== null) {
        window.cancelAnimationFrame(stateFrameRef.current)
        stateFrameRef.current = null
      }

      if (visibilityFrameRef.current !== null) {
        window.cancelAnimationFrame(visibilityFrameRef.current)
        visibilityFrameRef.current = null
      }

      if (autoscrollingTimeoutRef.current !== null) {
        window.clearTimeout(autoscrollingTimeoutRef.current)
        autoscrollingTimeoutRef.current = null
      }

      if (pendingScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingScrollFrameRef.current)
        pendingScrollFrameRef.current = null
      }

      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current)
        scrollFrameRef.current = null
      }

      visibilityObserverRef.current?.disconnect()
      visibilityObserverRef.current = null
    }
  }, [])

  React.useLayoutEffect(() => {
    if (
      autoScroll &&
      modeRef.current === "following-bottom" &&
      itemCountRef.current > 0
    ) {
      scrollToEnd({ behavior: "auto" })
      return
    }

    commitScrollState()
  }, [autoScroll, commitScrollState, scrollToEnd])

  return {
    context,
    registerMessage,
  }
}

// --- components.tsx ---

const MessageScrollerContext =
  React.createContext<MessageScrollerContextValue | null>(null)
const MessageScrollerItemContext =
  React.createContext<MessageScrollerRegisterMessage | null>(null)

function useMessageScrollerContext() {
  const context = React.useContext(MessageScrollerContext)

  if (!context) {
    throw new Error("useMessageScroller must be used within a MessageScroller.")
  }

  return context
}

function useMessageScrollerItemContext() {
  const context = React.useContext(MessageScrollerItemContext)

  if (!context) {
    throw new Error(
      "MessageScrollerItem must be used within a MessageScroller."
    )
  }

  return context
}

function useMessageScroller() {
  const { scrollToEnd, scrollToMessage, scrollToStart } =
    useMessageScrollerContext()

  return React.useMemo(
    () => ({
      scrollToEnd,
      scrollToMessage,
      scrollToStart,
    }),
    [scrollToEnd, scrollToMessage, scrollToStart]
  )
}

function useMessageScrollerScrollable() {
  const { stateStore } = useMessageScrollerContext()

  return React.useSyncExternalStore(
    stateStore.subscribe,
    stateStore.getSnapshot,
    stateStore.getSnapshot
  )
}

function useMessageScrollerVisibility() {
  const { observeVisibility, unobserveVisibility, visibilityStore } =
    useMessageScrollerContext()
  const subscribe = React.useCallback(
    (listener: () => void) =>
      visibilityStore.subscribe(
        listener,
        observeVisibility,
        unobserveVisibility
      ),
    [observeVisibility, unobserveVisibility, visibilityStore]
  )

  return React.useSyncExternalStore(
    subscribe,
    visibilityStore.getSnapshot,
    visibilityStore.getSnapshot
  )
}

function MessageScrollerProvider({
  autoScroll = false,
  children,
  defaultScrollPosition = "end",
  scrollEdgeThreshold,
  scrollPreviousItemPeek,
  scrollMargin,
}: MessageScrollerProviderProps) {
  const { context, registerMessage } = useMessageScrollerController({
    autoScroll,
    defaultScrollPosition,
    scrollEdgeThreshold,
    scrollPreviousItemPeek,
    scrollMargin,
  })

  return (
    <MessageScrollerContext.Provider value={context}>
      <MessageScrollerItemContext.Provider value={registerMessage}>
        {children}
      </MessageScrollerItemContext.Provider>
    </MessageScrollerContext.Provider>
  )
}

function usePendingDefaultScroll() {
  const { pendingDefaultScrollStore } = useMessageScrollerContext()

  return React.useSyncExternalStore(
    pendingDefaultScrollStore.subscribe,
    pendingDefaultScrollStore.getSnapshot,
    pendingDefaultScrollStore.getSnapshot
  )
}

function MessageScrollerRoot({ children, ...props }: MessageScrollerProps) {
  const { setRootElement } = useMessageScrollerContext()
  const pendingDefaultScroll = usePendingDefaultScroll()

  return (
    <div
      ref={setRootElement}
      {...props}
      {...(pendingDefaultScroll ? { "data-pending-scroll": "" } : null)}
    >
      {children}
    </div>
  )
}

function MessageScrollerViewport({
  "aria-label": ariaLabel,
  children,
  onKeyDown,
  onPointerDown,
  onScroll,
  onTouchMove,
  onTouchStart,
  onWheel,
  preserveScrollOnPrepend = true,
  ref,
  role,
  tabIndex,
  ...props
}: MessageScrollerViewportProps) {
  const {
    handleResize,
    pointerHeldRef,
    preserveScrollOnPrependRef,
    setViewportElement,
    syncAfterScroll,
    userScrollIntent,
    viewportRef,
  } = useMessageScrollerContext()
  const pendingDefaultScroll = usePendingDefaultScroll()

  preserveScrollOnPrependRef.current = preserveScrollOnPrepend

  const setViewportRef = React.useCallback(
    (element: HTMLDivElement | null) => {
      setViewportElement(element)
      composeRefs(ref)?.(element)
    },
    [ref, setViewportElement]
  )

  function handleScroll(event: React.UIEvent<HTMLDivElement>) {
    syncAfterScroll()
    onScroll?.(event)
  }

  // agentui: held until it is let go anywhere (see keepEndThroughRebuild).
  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    pointerHeldRef.current = true
    onPointerDown?.(event)
  }

  React.useEffect(() => {
    const release = () => {
      pointerHeldRef.current = false
    }
    window.addEventListener("pointerup", release)
    window.addEventListener("pointercancel", release)
    return () => {
      window.removeEventListener("pointerup", release)
      window.removeEventListener("pointercancel", release)
    }
  }, [pointerHeldRef])

  // agentui: only a gesture toward the start releases following. One
  // toward the end (a wheel down, a sideways one over a wide code block,
  // End) at the end moves nothing, so no scroll would follow to re-arm
  // it: the reply would grow on below the reader.
  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (event.deltaY < 0) userScrollIntent()
    onWheel?.(event)
  }

  // Where the finger was: dragged down, the content scrolls toward the start.
  const touchYRef = React.useRef<number | null>(null)

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    touchYRef.current = event.touches[0]?.clientY ?? null
    onTouchStart?.(event)
  }

  function handleTouchMove(event: React.TouchEvent<HTMLDivElement>) {
    const y = event.touches[0]?.clientY
    if (y !== undefined) {
      if (touchYRef.current !== null && y > touchYRef.current) {
        userScrollIntent()
      }
      touchYRef.current = y
    }
    onTouchMove?.(event)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (
      USER_SCROLL_KEYS.has(event.key) ||
      (event.key === " " && event.shiftKey)
    ) {
      userScrollIntent()
    }

    onKeyDown?.(event)
  }

  React.useEffect(() => {
    const viewport = viewportRef.current

    if (!viewport || typeof ResizeObserver === "undefined") {
      return
    }

    // Coalesce into rAF: handleResize mutates the spacer inside the observed
    // content, and resizing an observed element during delivery fires
    // "ResizeObserver loop completed with undelivered notifications".
    let frame = 0

    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(handleResize)
    })

    observer.observe(viewport)

    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [handleResize, viewportRef])

  return (
    <div
      ref={setViewportRef}
      role={role ?? "region"}
      aria-label={ariaLabel ?? "Messages"}
      tabIndex={tabIndex ?? 0}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onScroll={handleScroll}
      onTouchMove={handleTouchMove}
      onTouchStart={handleTouchStart}
      onWheel={handleWheel}
      {...props}
      {...(pendingDefaultScroll ? { "data-pending-scroll": "" } : null)}
    >
      {children}
    </div>
  )
}

function MessageScrollerContent({
  "aria-relevant": ariaRelevant,
  children,
  ref,
  role,
  spacerClassName,
  ...props
}: MessageScrollerContentProps) {
  const {
    handleContentChange,
    handleResize,
    keepEndThroughRebuild,
    setContentElement,
    setSpacerElement,
  } = useMessageScrollerContext()
  const contentRef = React.useRef<HTMLDivElement | null>(null)

  const setContentRef = React.useCallback(
    (element: HTMLDivElement | null) => {
      contentRef.current = element
      setContentElement(element)
      composeRefs(ref)?.(element)
    },
    [ref, setContentElement]
  )

  React.useLayoutEffect(() => {
    const content = contentRef.current

    if (!content) {
      return
    }

    handleContentChange()

    if (typeof MutationObserver === "undefined") {
      return
    }

    const observer = new MutationObserver(() => {
      handleContentChange()
    })

    observer.observe(content, { childList: true })

    return () => observer.disconnect()
  }, [handleContentChange])

  // agentui: nodes going anywhere in a message (see keepEndThroughRebuild).
  React.useEffect(() => {
    const content = contentRef.current

    if (!content || typeof MutationObserver === "undefined") {
      return
    }

    const observer = new MutationObserver(keepEndThroughRebuild)
    observer.observe(content, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [keepEndThroughRebuild])

  React.useEffect(() => {
    const content = contentRef.current

    if (!content || typeof ResizeObserver === "undefined") {
      return
    }

    // Coalesce into rAF: handleResize mutates the spacer inside this observed
    // element, and resizing an observed element during delivery fires
    // "ResizeObserver loop completed with undelivered notifications".
    let frame = 0

    // agentui: the place is kept by the rows' own observer (keepPlaceOnResize).
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(handleResize)
    })

    observer.observe(content)

    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [handleResize])

  return (
    <div
      ref={setContentRef}
      role={role ?? "log"}
      aria-relevant={ariaRelevant ?? "additions"}
      {...props}
    >
      {children}
      <div
        ref={setSpacerElement}
        aria-hidden="true"
        data-message-scroller-spacer=""
        hidden
        className={spacerClassName}
      />
    </div>
  )
}

function MessageScrollerItem({
  messageId,
  ref,
  scrollAnchor = false,
  ...props
}: MessageScrollerItemProps) {
  const registerMessage = useMessageScrollerItemContext()
  const elementRef = React.useRef<HTMLDivElement | null>(null)

  const setItemRef = React.useCallback(
    (element: HTMLDivElement | null) => {
      const previousElement = elementRef.current

      elementRef.current = element

      if (messageId) {
        registerMessage(messageId, element, previousElement)
      }

      composeRefs(ref)?.(element)
    },
    [messageId, ref, registerMessage]
  )

  return (
    <div
      ref={setItemRef}
      data-message-id={messageId}
      data-scroll-anchor={scrollAnchor ? "true" : "false"}
      {...props}
    />
  )
}

function MessageScrollerButton({
  behavior = "smooth",
  children,
  direction = "end",
  onClick,
  render,
  tabIndex,
  type = "button",
  ...props
}: MessageScrollerButtonProps) {
  const { scrollToEnd, scrollToStart, stateStore } = useMessageScrollerContext()
  const onClickRef = useLatest(onClick)
  const subscribe = React.useCallback(
    (listener: () => void) => stateStore.subscribe(listener),
    [stateStore]
  )
  const getSnapshot = React.useCallback(() => {
    const state = stateStore.getSnapshot()

    return direction === "start" ? state.start : state.end
  }, [direction, stateStore])
  const isActive = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot
  )

  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (!isActive) {
        return
      }

      onClickRef.current?.(event)

      if (!event.defaultPrevented) {
        event.currentTarget.blur()

        if (direction === "start") {
          scrollToStart({ behavior })
        } else {
          scrollToEnd({ behavior })
        }
      }
    },
    [behavior, direction, isActive, onClickRef, scrollToEnd, scrollToStart]
  )

  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        type,
        inert: !isActive,
        tabIndex: isActive ? tabIndex : -1,
        children: children ?? <span>Scroll to {direction}</span>,
        onClick: handleClick,
      },
      props
    ),
    render,
    state: {
      active: isActive,
      direction,
    },
    stateAttributesMapping: {
      active: (value) => ({
        "data-active": value ? "true" : "false",
      }),
    },
  })
}

const MessageScroller = {
  Provider: MessageScrollerProvider,
  Root: MessageScrollerRoot,
  Viewport: MessageScrollerViewport,
  Content: MessageScrollerContent,
  Item: MessageScrollerItem,
  Button: MessageScrollerButton,
}

export {
  MessageScroller,
  useMessageScroller,
  useMessageScrollerScrollable,
  useMessageScrollerVisibility,
}

export type {
  MessageScrollerDefaultScrollPosition,
  MessageScrollerScrollAlign,
  MessageScrollerScrollOptions,
  MessageScrollerScrollable,
  MessageScrollerVisibilityState,
}
