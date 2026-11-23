import type { Meta, StoryObj } from "@storybook/react-vite"
import * as React from "react"
import { expect, spyOn, userEvent, waitFor, within } from "storybook/test"
import { coarseHitSize } from "@/stories/touch"
import { reducedMotionTransition } from "@/stories/motion"
import { settled } from "@/stories/wait"
import { LongConversation, instrument } from "@/stories/long-conversation"
import { PrependWhileScrolling } from "@/stories/prepend-while-scrolling"
import { HugeiconsIcon } from "@hugeicons/react"
import { Shield01Icon } from "@hugeicons/core-free-icons"

import {
  AgentRequest,
  AgentRequestContent,
  AgentRequestDescription,
  AgentRequestFooter,
  AgentRequestTitle,
} from "@/components/agent-request"
import {
  Composer,
  ComposerEditor,
  ComposerSubmit,
  ComposerTakeover,
} from "@/components/composer"
import { MessageScrollerLoadEarlier } from "@/components/message-scroller-load-earlier"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import { CodeBlock, CodeBlockContent } from "@/components/ui/code-block"
import { InputGroupAddon } from "@/components/ui/input-group"
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker"
import { Message, MessageContent } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScroller,
  useMessageScrollerShowAll,
} from "@/components/ui/message-scroller"
import { cn } from "cn"
import { Spinner } from "@/components/ui/spinner"
import { Clamp } from "@/components/clamp"

/**
 * Once the viewport has stopped scrolling and growing, and is not in a
 * scroll of its own (to the end, which takes a moment): where it stays.
 */
const still = (viewport: HTMLElement, also?: () => unknown) =>
  settled(() => [viewport.scrollTop, viewport.scrollHeight, also?.()], {
    busy: () => viewport.hasAttribute("data-autoscrolling"),
  })

const meta = {
  title: "Components/Message Scroller",
  component: MessageScroller,
  parameters: { layout: "padded" },
} satisfies Meta<typeof MessageScroller>

export default meta
type Story = StoryObj<typeof meta>

type ChatMessage = { id: string; role: "user" | "assistant"; text: string }

const transcript: ChatMessage[] = [
  { id: "1", role: "user", text: "Hello there!" },
  { id: "2", role: "assistant", text: "Hey, how's it going?" },
  {
    id: "3",
    role: "user",
    text: "I'm prototyping a chat surface for our agent runs. Can you sketch a component breakdown?",
  },
  {
    id: "4",
    role: "assistant",
    text: `Treat the chat as three layers so scrolling and the composer never fight each other:

- Shell: the frame, title and status.
- Transcript: the scrolling message list.
- Composer: input, send and stop.

Keep transport logic out of shared components, clip the parent and let the child scroll, and pin long replies to the bottom unless the reader scrolls up.`,
  },
  {
    id: "5",
    role: "user",
    text: "What about spacing when one reply is short and the next is long?",
  },
  {
    id: "6",
    role: "assistant",
    text: `The scroll container should own the vertical rhythm, not the bubbles.

Use one gap on the list so short and long messages sit on the same grid. When a long reply streams in, keep the viewport pinned to the end until the reader scrolls away; then show a scroll-to-end button instead of yanking them back.`,
  },
  { id: "7", role: "user", text: "Thanks, that helps." },
]

const replies = [
  "Happy to help. Send another message when you're ready.",
  "Anything else about the transcript?",
]

function Chat({
  autoScroll = true,
  summary,
  className,
  labels,
}: {
  autoScroll?: boolean
  summary?: React.ReactNode
  className?: string
  labels?: React.ComponentProps<typeof MessageScrollerButton>["labels"]
}) {
  const [messages, setMessages] = React.useState(transcript)
  const [thinking, setThinking] = React.useState(false)

  function send() {
    const id = String(messages.length + 1)
    setMessages((current) => [
      ...current,
      { id, role: "user", text: `Follow-up question ${id}` },
    ])
    setThinking(true)
    setTimeout(() => {
      setThinking(false)
      setMessages((current) => [
        ...current,
        {
          id: `${id}-reply`,
          role: "assistant",
          text: replies[current.length % replies.length],
        },
      ])
    }, 300)
  }

  return (
    <div
      className={cn(
        "flex h-120 w-md max-w-full flex-col overflow-hidden rounded-xl border",
        className
      )}
    >
      <MessageScrollerProvider autoScroll={autoScroll}>
        <MessageScroller>
          <MessageScrollerViewport aria-label="Conversation">
            <MessageScrollerContent className="p-4">
              {messages.map((message) => (
                <MessageScrollerItem
                  key={message.id}
                  messageId={message.id}
                  scrollAnchor={message.role === "user"}
                  className={
                    message.role === "user" ? "not-first:mt-4" : undefined
                  }
                >
                  <Message align={message.role === "user" ? "end" : "start"}>
                    <MessageContent>
                      <Bubble variant="muted">
                        <BubbleContent className="whitespace-pre-wrap">
                          {message.text}
                        </BubbleContent>
                      </Bubble>
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              ))}
              {thinking ? (
                <MessageScrollerItem>
                  <Marker role="status">
                    <MarkerIcon>
                      <Spinner />
                    </MarkerIcon>
                    <MarkerContent>Thinking...</MarkerContent>
                  </Marker>
                </MessageScrollerItem>
              ) : null}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton summary={summary} labels={labels} />
          <MessageScrollerButton direction="start" />
        </MessageScroller>
      </MessageScrollerProvider>
      <div className="border-t p-3">
        <Button className="w-full" disabled={thinking} onClick={send}>
          Send a follow-up
        </Button>
      </div>
    </div>
  )
}

export const Default: Story = {
  render: () => <Chat />,
  play: async ({ canvas }) => {
    const viewport = canvas.getByRole("region", { name: "Conversation" })
    await expect(canvas.getByRole("log")).toBeInTheDocument()

    // The viewport is focusable, so the keyboard can scroll it.
    await userEvent.tab()
    await expect(viewport).toHaveFocus()

    // A new message is followed to the end.
    await userEvent.click(
      canvas.getByRole("button", { name: "Send a follow-up" })
    )
    await expect(
      await within(viewport).findByText("Follow-up question 8")
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(
        canvas.getByRole("button", { name: "Send a follow-up" })
      ).toBeEnabled()
    )
  },
}

function Streaming() {
  const [lines, setLines] = React.useState(1)
  return (
    <div className="flex h-120 w-md max-w-full flex-col overflow-hidden rounded-xl border">
      <MessageScrollerProvider autoScroll>
        <MessageScroller>
          <MessageScrollerViewport aria-label="Conversation">
            <MessageScrollerContent className="p-4">
              {transcript.map((message) => (
                <MessageScrollerItem key={message.id} messageId={message.id}>
                  <Message align={message.role === "user" ? "end" : "start"}>
                    <MessageContent>
                      <Bubble variant="muted">
                        <BubbleContent className="whitespace-pre-wrap">
                          {message.text}
                        </BubbleContent>
                      </Bubble>
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              ))}
              <MessageScrollerItem messageId="reply">
                <Message>
                  <MessageContent>
                    {Array.from({ length: lines }, (_, index) => (
                      <p key={index}>Line {index + 1} of the reply.</p>
                    ))}
                  </MessageContent>
                </Message>
              </MessageScrollerItem>
            </MessageScrollerContent>
          </MessageScrollerViewport>
        </MessageScroller>
      </MessageScrollerProvider>
      <div className="border-t p-3">
        <Button className="w-full" onClick={() => setLines((n) => n + 4)}>
          Stream more
        </Button>
      </div>
    </div>
  )
}

/**
 * A reply streaming while the reader is at the end: a gesture toward the
 * end there (a wheel down, a sideways one, End, a finger dragging up)
 * moves nothing and keeps following; only one toward the start lets go.
 */
export const FollowsPastGesturesTowardTheEnd: Story = {
  render: () => <Streaming />,
  play: async ({ canvas }) => {
    const viewport = canvas.getByRole("region", { name: "Conversation" })
    const more = canvas.getByRole("button", { name: "Stream more" })
    const gap = () =>
      viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop
    const grow = async () => {
      const height = viewport.scrollHeight
      more.click()
      await waitFor(() => expect(viewport.scrollHeight).toBeGreaterThan(height))
      await still(viewport)
    }
    await grow()
    await expect(gap()).toBeLessThanOrEqual(1)
    // A finger's: a TouchEvent's touches, which not every browser builds.
    const touch = (type: string, clientY: number) =>
      Object.defineProperty(new Event(type, { bubbles: true }), "touches", {
        value: [{ clientX: 10, clientY }],
      })
    const towardTheEnd = [
      () =>
        viewport.dispatchEvent(
          new WheelEvent("wheel", { bubbles: true, deltaY: 100 })
        ),
      () =>
        viewport.dispatchEvent(
          new WheelEvent("wheel", { bubbles: true, deltaX: 100 })
        ),
      () =>
        viewport.dispatchEvent(
          new KeyboardEvent("keydown", { bubbles: true, key: "End" })
        ),
      () => {
        viewport.dispatchEvent(touch("touchstart", 300))
        viewport.dispatchEvent(touch("touchmove", 200))
      },
    ]
    for (const gesture of towardTheEnd) {
      gesture()
      await grow()
      await expect(gap()).toBeLessThanOrEqual(1)
    }
    // A wheel up lets go, and scrolls: the reply grows on below.
    viewport.dispatchEvent(
      new WheelEvent("wheel", { bubbles: true, deltaY: -100 })
    )
    viewport.scrollTop -= 100
    await still(viewport)
    await grow()
    await expect(gap()).toBeGreaterThan(1)
  },
}

/**
 * The reply's content rebuilt at once as it ends, the same size: a
 * renderer finishing a streamed reply takes its nodes out and puts them
 * back, laid out in between. WebKit moves the scroll up then, as if the
 * reply were gone; that is the content's doing, not the reader's, so the
 * reply is still followed to the end.
 */
export const FollowsThroughARebuild: Story = {
  render: () => <Streaming />,
  play: async ({ canvas }) => {
    const viewport = canvas.getByRole("region", { name: "Conversation" })
    const more = canvas.getByRole("button", { name: "Stream more" })
    const gap = () =>
      viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop
    const grow = async () => {
      const height = viewport.scrollHeight
      more.click()
      await waitFor(() => expect(viewport.scrollHeight).toBeGreaterThan(height))
      await still(viewport)
    }
    await grow()
    await grow()
    await expect(gap()).toBeLessThanOrEqual(1)
    const reply = viewport.querySelector<HTMLElement>(
      '[data-message-id="reply"] [data-slot="message-content"]'
    )!
    const lines = [...reply.children]
    reply.replaceChildren()
    reply.getBoundingClientRect()
    reply.append(...lines)
    await still(viewport)
    await grow()
    await expect(gap()).toBeLessThanOrEqual(1)
  },
}

/** The scroll buttons, which show only while there is room to scroll. */
export const ScrollButtons: Story = {
  render: () => <Chat />,
  play: async ({ canvas }) => {
    const viewport = canvas.getByRole("region", { name: "Conversation" })
    const toStart = canvas.getByRole("button", { name: "Scroll to start" })
    const toEnd = canvas.getByRole("button", { name: "Scroll to end" })

    // It opens at the end.
    await waitFor(() => expect(toEnd).toHaveAttribute("data-active", "false"))
    await waitFor(() => expect(toStart).toHaveAttribute("data-active", "true"))

    toStart.focus()
    await userEvent.keyboard("{Enter}")
    await waitFor(() => expect(viewport.scrollTop).toBe(0))
    // The button, scrolled, goes inert: the focus goes on to the viewport,
    // where the keyboard scrolls on, not to the page.
    await expect(viewport).toHaveFocus()
    // With autoScroll, @shadcn/react 0.3.1 could pull a smooth scroll back
    // to the end; the start button now jumps instead. Make sure it stays.
    await still(viewport)
    await expect(viewport.scrollTop).toBe(0)
    await waitFor(() => expect(toStart).toHaveAttribute("data-active", "false"))
    await expect(toEnd).toHaveAttribute("data-active", "true")
    await expect(toEnd.offsetWidth).toBe(toEnd.offsetHeight)
    await expect(within(toEnd).getByText("Scroll to end")).toHaveClass(
      "sr-only"
    )
    // Round and raised: it floats over the text it covers.
    const style = getComputedStyle(toEnd)
    await expect(parseFloat(style.borderTopLeftRadius)).toBeGreaterThanOrEqual(
      toEnd.offsetHeight / 2
    )
    await expect(style.boxShadow).not.toBe("none")
    // A finger's size, past its box, on a touch screen.
    for (const button of [toStart, toEnd]) {
      const size = coarseHitSize(button)
      await expect(Math.min(size.width, size.height)).toBeGreaterThanOrEqual(44)
    }

    // With reduced motion it fades without sliding.
    await expect(reducedMotionTransition(toEnd)).toBe("opacity")

    toEnd.focus()
    await userEvent.keyboard("{Enter}")
    await waitFor(() => expect(toEnd).toHaveAttribute("data-active", "false"), {
      timeout: 3000,
    })
    await expect(viewport).toHaveFocus()
    await waitFor(() => expect(toStart).toHaveAttribute("data-active", "true"))
  },
}

/**
 * What is at the end brought into view (by `scrollIntoView`, or the
 * focus) scrolls the viewport only: the scroller itself, which its
 * hidden button sticks out of, is not scrolled, its top never cut.
 */
export const OnlyTheViewportScrolls: Story = {
  render: () => <Chat />,
  play: async ({ canvas, canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>(
      "[data-slot=message-scroller]"
    )!
    const toEnd = canvas.getByRole("button", { name: "Scroll to end" })
    await waitFor(() => expect(toEnd).toHaveAttribute("data-active", "false"))
    const viewport = canvas.getByRole("region", { name: "Conversation" })
    const last = Array.from(
      viewport.querySelectorAll<HTMLElement>("[data-slot=message]")
    ).at(-1)!
    for (const block of ["center", "end", "nearest"] as const) {
      last.scrollIntoView({ block })
      await expect(root.scrollTop).toBe(0)
    }
  },
}

/** The app's words on what waits below, kept in the button's name. */
export const Summary: Story = {
  render: () => <Chat summary="2 queued · a question waits" />,
  play: async ({ canvas }) => {
    const toStart = canvas.getByRole("button", { name: /Scroll to start/ })
    const button = canvas.getByRole("button", {
      name: /Scroll to end 2 queued · a question waits/,
    })
    await waitFor(() => expect(button).toHaveAttribute("data-active", "false"))
    await waitFor(() => expect(toStart).toHaveAttribute("data-active", "true"))
    await userEvent.click(toStart)
    await waitFor(() => expect(button).toHaveAttribute("data-active", "true"))
    await expect(within(button).getByText("·")).toHaveAttribute(
      "aria-hidden",
      "true"
    )
    const label = within(button).getByText("Scroll to end")
    // The label shows beside the summary, not only to screen readers.
    await expect(label.offsetWidth).toBeGreaterThan(1)
    await expect(label).not.toHaveClass("sr-only")
    const summary = within(button).getByText("2 queued · a question waits")
    await expect(getComputedStyle(summary).color).not.toBe(
      getComputedStyle(button).color
    )
    const size = coarseHitSize(button)
    await expect(Math.min(size.width, size.height)).toBeGreaterThanOrEqual(44)
    await expect(reducedMotionTransition(button)).toBe("opacity")
    await expect(getComputedStyle(button).boxShadow).not.toBe("none")
    await expect(button.offsetHeight).toBe(toStart.offsetHeight)
    await expect(button.offsetHeight).toBe(28)
    await expect(button).not.toHaveAttribute("aria-live")
  },
}

const phoneSummary =
  "3 queued · a subagent is waiting for you · the build finished with 2 warnings · 1 question"

export const SummaryOnAPhone: Story = {
  render: () => <Chat className="w-90" summary={phoneSummary} />,
  play: async ({ canvas, canvasElement }) => {
    const toStart = canvas.getByRole("button", { name: /Scroll to start/ })
    const button = canvas.getByRole("button", {
      name: `Scroll to end ${phoneSummary}`,
    })
    await waitFor(() => expect(toStart).toHaveAttribute("data-active", "true"))
    await userEvent.click(toStart)
    await waitFor(() => expect(button).toHaveAttribute("data-active", "true"))
    await still(canvas.getByRole("region", { name: "Conversation" }))
    const scroller = canvasElement.querySelector(
      '[data-slot="message-scroller"]'
    )!
    const bounds = scroller.getBoundingClientRect()
    const rect = button.getBoundingClientRect()
    await expect(rect.left).toBeGreaterThanOrEqual(bounds.left)
    await expect(rect.right).toBeLessThanOrEqual(bounds.right)
    const summary = within(button).getByText(phoneSummary)
    await expect(summary.scrollWidth).toBeGreaterThan(summary.clientWidth)
    await expect(summary.textContent).toBe(phoneSummary)
    await expect(button).toHaveAccessibleName(`Scroll to end ${phoneSummary}`)
    // The fraction must compile to a real percentage cap in Tailwind v4.
    await expect(
      parseFloat(getComputedStyle(button).maxWidth)
    ).toBeLessThanOrEqual(bounds.width * 0.9)
  },
}

export const Labels: Story = {
  render: () => <Chat labels={{ scrollToEnd: "Zum Ende" }} />,
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("button", { name: "Zum Ende" })
    ).toBeInTheDocument()
  },
}

/** Where the reader prefers reduced motion, the end too is a jump. */
export const ReducedMotion: Story = {
  beforeEach: () => {
    const matchMedia = window.matchMedia
    window.matchMedia = (query) => {
      const list = matchMedia.call(window, query)
      return query.includes("prefers-reduced-motion: reduce")
        ? ({
            matches: true,
            media: query,
            onchange: null,
            addEventListener: () => {},
            removeEventListener: () => {},
            addListener: () => {},
            removeListener: () => {},
            dispatchEvent: () => false,
          } satisfies MediaQueryList)
        : list
    }
    return () => {
      window.matchMedia = matchMedia
    }
  },
  render: () => <Chat />,
  play: async ({ canvas }) => {
    const viewport = canvas.getByRole("region", { name: "Conversation" })
    const toStart = canvas.getByRole("button", { name: "Scroll to start" })
    const toEnd = canvas.getByRole("button", { name: "Scroll to end" })
    await waitFor(() => expect(toStart).toHaveAttribute("data-active", "true"))
    await userEvent.click(toStart)
    await waitFor(() => expect(toEnd).toHaveAttribute("data-active", "true"))
    await userEvent.click(toEnd)
    // At the end at once, not on its way there.
    await expect(viewport.scrollTop).toBeGreaterThanOrEqual(
      viewport.scrollHeight - viewport.clientHeight - 1
    )
  },
}

/** A long history: 70 rounds, each answer five paragraphs. */
const history = Array.from({ length: 70 }, (_, round) => [
  { id: `question-${round}`, role: "user" as const, text: `Question ${round}` },
  {
    id: `answer-${round}`,
    role: "assistant" as const,
    text: Array.from(
      { length: 5 },
      (_, paragraph) =>
        `Answer ${round}, paragraph ${paragraph + 1}. ` +
        "The run read the logs, compared the failing step with the last good one, and found the change that broke it. ".repeat(
          3
        )
    ).join("\n\n"),
  },
]).flat()

function ScrollTo({ messageId }: { messageId: string }) {
  const { scrollToMessage } = useMessageScroller()
  React.useEffect(() => {
    scrollToMessage(messageId)
  }, [messageId, scrollToMessage])
  return null
}

/** As when an app returns to a conversation and restores where it was. */
function History({ restore }: { restore: string }) {
  return (
    <div className="flex h-120 w-md max-w-full flex-col overflow-hidden rounded-xl border">
      <MessageScrollerProvider autoScroll>
        <ScrollTo messageId={restore} />
        <MessageScroller>
          <MessageScrollerViewport aria-label="Conversation">
            <MessageScrollerContent className="p-4">
              {history.map((message) => (
                <MessageScrollerItem
                  key={message.id}
                  messageId={message.id}
                  scrollAnchor={message.role === "user"}
                  className={
                    message.role === "user" ? "not-first:mt-4" : undefined
                  }
                >
                  <Message align={message.role === "user" ? "end" : "start"}>
                    <MessageContent>
                      <Bubble variant="muted">
                        <BubbleContent className="whitespace-pre-wrap">
                          {message.text}
                        </BubbleContent>
                      </Bubble>
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
        </MessageScroller>
      </MessageScrollerProvider>
    </div>
  )
}

/**
 * scrollToMessage on a fresh mount keeps the message at the top while the
 * messages above it render at their real height.
 */
export const RestorePosition: Story = {
  render: () => <History restore="answer-65" />,
  play: async ({ canvas, canvasElement }) => {
    const viewport = canvas.getByRole("region", { name: "Conversation" })
    const target = canvasElement.querySelector('[data-message-id="answer-65"]')!
    const padding = parseFloat(
      getComputedStyle(canvas.getByRole("log")).paddingTop
    )
    const offset = () =>
      target.getBoundingClientRect().top - viewport.getBoundingClientRect().top
    await still(viewport, offset)
    await expect(Math.abs(offset() - padding)).toBeLessThanOrEqual(1)
  },
}

/**
 * Scrolling a long conversation costs a few rect reads a frame, however
 * many messages there are: none while the scroll events come (a trackpad
 * gives several a frame), each read a forced layout of the whole
 * conversation where layout is dirty; once a frame, the last message for
 * where the content ends and halving searches for the first one in view.
 */
export const ScrollCost: Story = {
  render: () => <History restore="answer-65" />,
  play: async ({ canvas }) => {
    const viewport = canvas.getByRole("region", { name: "Conversation" })
    await still(viewport)
    const rects = spyOn(Element.prototype, "getBoundingClientRect")
    try {
      for (let event = 0; event < 10; event++) {
        viewport.scrollTop -= 12
        viewport.dispatchEvent(new Event("scroll"))
      }
      await expect(rects).not.toHaveBeenCalled()
      await new Promise(requestAnimationFrame)
      await new Promise(requestAnimationFrame)
      // 140 messages: a scan of them would read 140 and more; a frame's
      // two halving searches (the place kept, the prepend anchor) and the
      // rows around them read some 30.
      await expect(rects.mock.calls.length).toBeLessThan(60)
    } finally {
      rects.mockRestore()
    }
    await expect(viewport).toHaveAttribute(
      "data-scrollable",
      expect.stringContaining("start")
    )
  },
}

/** Messages much taller than the scroller guesses before they render. */
const tall = Array.from({ length: 80 }, (_, index) => ({
  id: `tall-${index}`,
  text: Array.from(
    { length: 12 },
    (_, line) => `Message ${index}, line ${line + 1} of a long answer.`
  ).join("\n"),
}))

/**
 * Scrolling up a long conversation, what the reader looks at moves as
 * they scroll and no more: messages coming into view for the first time
 * render taller than guessed, above it, and WebKit, which does not anchor
 * the scroll to what is in view (overflow-anchor), would push it down.
 */
export const KeepsPlace: Story = {
  render: () => (
    <div className="flex h-120 w-md max-w-full flex-col overflow-hidden rounded-xl border">
      <MessageScrollerProvider>
        <MessageScroller>
          <MessageScrollerViewport aria-label="Conversation">
            <MessageScrollerContent className="p-4">
              {tall.map((message) => (
                <MessageScrollerItem key={message.id} messageId={message.id}>
                  <Message>
                    <MessageContent>
                      <Bubble variant="muted">
                        <BubbleContent className="whitespace-pre-wrap">
                          {message.text}
                        </BubbleContent>
                      </Bubble>
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
        </MessageScroller>
      </MessageScrollerProvider>
    </div>
  ),
  play: async ({ canvas }) => {
    const viewport = canvas.getByRole("region", { name: "Conversation" })
    await still(viewport)
    // The reader takes over from the end it opened at.
    viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: -1 }))
    const top = () => viewport.getBoundingClientRect().top
    const firstInView = () =>
      [...viewport.querySelectorAll<HTMLElement>("[data-message-id]")].find(
        (item) => item.getBoundingClientRect().bottom > top() + 1
      )!
    const moved: number[] = []
    for (let step = 0; step < 20; step++) {
      const item = firstInView()
      const before = item.getBoundingClientRect().top
      viewport.scrollTop -= 150
      await new Promise(requestAnimationFrame)
      await new Promise(requestAnimationFrame)
      moved.push(Math.round(item.getBoundingClientRect().top - before))
    }
    await expect(moved).toEqual(moved.map(() => 150))
  },
}

const clamped = Array.from({ length: 60 }, (_, index) => ({
  id: `clamped-${index}`,
  user: index % 2 === 0,
  text: Array.from(
    { length: index % 2 === 0 ? 60 : 8 },
    (_, line) => `Message ${index}, line ${line + 1}.`
  ).join("\n"),
}))

function LongQuestions() {
  return (
    <div className="flex h-120 w-md max-w-full flex-col overflow-hidden rounded-xl border">
      <MessageScrollerProvider autoScroll>
        <MessageScroller>
          <MessageScrollerViewport aria-label="Conversation">
            <MessageScrollerContent className="p-4">
              {clamped.map((message) => (
                <MessageScrollerItem
                  key={message.id}
                  messageId={message.id}
                  scrollAnchor={message.user}
                >
                  <Message align={message.user ? "end" : "start"}>
                    <MessageContent>
                      <Bubble variant="muted">
                        <BubbleContent className="whitespace-pre-wrap">
                          {message.user ? (
                            <Clamp>{message.text}</Clamp>
                          ) : (
                            message.text
                          )}
                        </BubbleContent>
                      </Bubble>
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
        </MessageScroller>
      </MessageScrollerProvider>
    </div>
  )
}

/**
 * Long questions, clamped, mount as the reader scrolls up to them: what
 * the reader looks at stays put as each mounts, already cut to its lines.
 */
export const KeepsPlaceClamped: Story = {
  render: () => <LongQuestions />,
  play: async ({ canvas }) => {
    const viewport = canvas.getByRole("region", { name: "Conversation" })
    await still(viewport)
    // The reader's, as a wheel's: not the end that autoScroll follows.
    const scrollUp = (by: number) => {
      viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: -by }))
      viewport.scrollTop -= by
    }
    // Away from the end, which autoScroll holds as the content changes.
    scrollUp(1000)
    await still(viewport)
    const top = () => viewport.getBoundingClientRect().top
    const firstInView = () =>
      [...viewport.querySelectorAll<HTMLElement>("[data-message-id]")].find(
        (item) => item.getBoundingClientRect().top >= top()
      )!
    const moved: string[] = []
    for (let step = 0; step < 50; step++) {
      scrollUp(150)
      // Where it is painted: after the frame, its corrections made.
      await new Promise((painted) =>
        requestAnimationFrame(() => setTimeout(painted))
      )
      const item = firstInView()
      const before = item.getBoundingClientRect().top
      await still(viewport)
      const by = Math.round(item.getBoundingClientRect().top - before)
      if (Math.abs(by) > 1)
        moved.push(`${step} ${item.dataset.messageId} ${by}`)
    }
    await expect(moved).toEqual([])
  },
}

/** Turns, each one item, many times taller than the 10rem guessed. */
const turns = Array.from({ length: 30 }, (_, index) => ({
  id: `turn-${index}`,
  text: Array.from(
    { length: 30 + ((index * 7) % 50) },
    (_, line) => `Turn ${index}, paragraph ${line + 1} of its answer.`
  ).join("\n"),
}))

/**
 * A long conversation opened at its end, each turn an item far taller
 * than the box guessed for it: scrolling up past those mounted at once,
 * a turn never mounted before takes its height above the view, and what
 * the reader looks at moves as they scroll, no more.
 */
/** The turns, come once the conversation has loaded, as an app's do. */
function TallTurns({ ids }: { ids: boolean }) {
  const [shown, setShown] = React.useState<typeof turns>([])
  React.useEffect(() => {
    const timer = setTimeout(() => setShown(turns))
    return () => clearTimeout(timer)
  }, [])
  return (
    <div className="flex h-120 w-md max-w-full flex-col overflow-hidden rounded-xl border">
      <MessageScrollerProvider autoScroll>
        <MessageScroller>
          <MessageScrollerViewport aria-label="Conversation">
            <MessageScrollerContent className="p-4">
              {shown.map((turn) => (
                <MessageScrollerItem
                  key={turn.id}
                  data-turn={turn.id}
                  {...(ids ? { messageId: turn.id, scrollAnchor: true } : {})}
                >
                  <Message>
                    <MessageContent>
                      <Bubble variant="muted">
                        <BubbleContent className="whitespace-pre-wrap">
                          {turn.text}
                        </BubbleContent>
                      </Bubble>
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
        </MessageScroller>
      </MessageScrollerProvider>
    </div>
  )
}

/** Up a step at a time, what is in view moving by the step and no more. */
async function scrollsUpTurns(viewport: HTMLElement) {
  await waitFor(() =>
    expect(viewport.querySelectorAll("[data-turn]")).toHaveLength(30)
  )
  await still(viewport)
  // Most never mounted: their guessed boxes.
  await expect(
    viewport.querySelectorAll("[data-windowed]").length
  ).toBeGreaterThan(10)
  const top = () => viewport.getBoundingClientRect().top
  const firstInView = () =>
    [...viewport.querySelectorAll<HTMLElement>("[data-turn]")].find(
      (item) => item.getBoundingClientRect().bottom > top() + 1
    )!
  const moved: string[] = []
  for (let step = 0; step < 80 && viewport.scrollTop > 400; step++) {
    const item = firstInView()
    const before = item.getBoundingClientRect().top
    viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: -200 }))
    viewport.scrollTop -= 200
    await still(viewport)
    const by = Math.round(item.getBoundingClientRect().top - before)
    if (Math.abs(by - 200) > 1) moved.push(`${step} ${item.dataset.turn} ${by}`)
  }
  await expect(moved).toEqual([])
}

/**
 * A long conversation opened at its end, each turn an item far taller
 * than the box guessed for it: scrolling up past those mounted at once,
 * a turn never mounted before takes its height above the view, and what
 * the reader looks at moves as they scroll, no more.
 */
export const KeepsPlaceTallTurns: Story = {
  render: () => <TallTurns ids />,
  play: async ({ canvas }) =>
    scrollsUpTurns(canvas.getByRole("region", { name: "Conversation" })),
}

/** The same with items the app gives no `messageId`. */
export const KeepsPlaceTallTurnsUnnamed: Story = {
  render: () => <TallTurns ids={false} />,
  play: async ({ canvas }) =>
    scrollsUpTurns(canvas.getByRole("region", { name: "Conversation" })),
}

function ShowAll() {
  const [all, setAll] = React.useState(false)
  useMessageScrollerShowAll(all)
  return (
    <Button variant="outline" size="sm" onClick={() => setAll(!all)}>
      {all ? "Window" : "Show all"}
    </Button>
  )
}

/**
 * A long conversation is windowed: the messages far from the view keep
 * their place and height in the content but not their content, mounted as
 * the reader comes near; a find, say, has them all mounted while open.
 */
export const Windowed: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <MessageScrollerProvider>
        <ShowAll />
        <div className="flex h-120 w-md max-w-full flex-col overflow-hidden rounded-xl border">
          <MessageScroller>
            <MessageScrollerViewport aria-label="Conversation">
              <MessageScrollerContent className="p-4">
                {tall.map((message) => (
                  <MessageScrollerItem key={message.id} messageId={message.id}>
                    <Message>
                      <MessageContent>
                        <Bubble variant="muted">
                          <BubbleContent className="whitespace-pre-wrap">
                            {message.text}
                          </BubbleContent>
                        </Bubble>
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                ))}
              </MessageScrollerContent>
            </MessageScrollerViewport>
          </MessageScroller>
        </div>
      </MessageScrollerProvider>
    </div>
  ),
  play: async ({ canvas }) => {
    const viewport = canvas.getByRole("region", { name: "Conversation" })
    await still(viewport)
    const item = (id: string) =>
      viewport.querySelector<HTMLElement>(`[data-message-id="${id}"]`)!
    // At the end: the last messages mounted, the first an empty box.
    await expect(canvas.getByText(/Message 79, line 1 /)).toBeVisible()
    await expect(item("tall-0")).toHaveAttribute("data-windowed")
    await expect(item("tall-0")).toBeEmptyDOMElement()
    await expect(canvas.queryByText(/Message 0, line 1 /)).toBeNull()
    // The reader scrolls to the start: they mount, the end goes.
    viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: -1 }))
    viewport.scrollTop = 0
    await waitFor(() =>
      expect(canvas.getByText(/Message 0, line 1 /)).toBeVisible()
    )
    await waitFor(() =>
      expect(item("tall-79")).toHaveAttribute("data-windowed")
    )
    // A measured message keeps its height while it is a box.
    await expect(item("tall-79").style.height).toMatch(/px$/)
    // All asked for: all mounted.
    await userEvent.click(canvas.getByRole("button", { name: "Show all" }))
    await expect(viewport.querySelectorAll("[data-windowed]")).toHaveLength(0)
    await expect(canvas.getByText(/Message 79, line 1 /)).toBeInTheDocument()
  },
}

/** The page's observers, as the scroller makes them. */
const observers: {
  callback: IntersectionObserverCallback
  options: IntersectionObserverInit | undefined
  observer: IntersectionObserver
}[] = []

/**
 * A busy main thread hands an observer several frames' entries at once:
 * a message's "out" then "in" in one batch leaves it mounted, its last
 * entry the one that counts.
 */
export const WindowedStaleBatch: Story = {
  render: Windowed.render,
  beforeEach: () => {
    const Native = window.IntersectionObserver
    observers.length = 0
    window.IntersectionObserver = class extends Native {
      constructor(
        callback: IntersectionObserverCallback,
        options?: IntersectionObserverInit
      ) {
        super(callback, options)
        observers.push({ callback, options, observer: this })
      }
    }
    return () => {
      window.IntersectionObserver = Native
    }
  },
  play: async ({ canvas }) => {
    const viewport = canvas.getByRole("region", { name: "Conversation" })
    await still(viewport)
    // In the middle, among messages mounted on either side.
    viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: -1 }))
    viewport.scrollTop = (viewport.scrollHeight - viewport.clientHeight) / 2
    await still(viewport)
    const box = viewport.getBoundingClientRect()
    const item = document
      .elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)!
      .closest<HTMLElement>("[data-slot=message-scroller-item]")!
    await expect(item).not.toHaveAttribute("data-windowed")
    const far = observers.find(({ options }) =>
      String(options?.rootMargin).startsWith("300%")
    )!
    const entry = (isIntersecting: boolean) =>
      ({ target: item, isIntersecting }) as unknown as IntersectionObserverEntry
    far.callback([entry(false), entry(true)], far.observer)
    await still(viewport)
    await expect(item).not.toHaveAttribute("data-windowed")
    await expect(item).not.toBeEmptyDOMElement()
  },
}

/**
 * A message mounting as it comes near, then far again before the browser
 * drew it (a fast scroll on a busy main thread): its height is read as it
 * goes, so it keeps that, not the 10rem guess, and coming back it is
 * drawn at its height, the view not corrected for it.
 */
export const WindowedBeforeMeasured: Story = {
  render: Windowed.render,
  beforeEach: WindowedStaleBatch.beforeEach,
  play: async ({ canvas }) => {
    const viewport = canvas.getByRole("region", { name: "Conversation" })
    await still(viewport)
    const item = viewport.querySelector<HTMLElement>(
      '[data-message-id="tall-0"]'
    )!
    await expect(item).toHaveAttribute("data-windowed")
    const observer = (margin: string) =>
      observers.find(({ options }) =>
        String(options?.rootMargin).startsWith(margin)
      )!
    const near = observer("100%")
    const far = observer("300%")
    const entry = (isIntersecting: boolean) =>
      ({ target: item, isIntersecting }) as unknown as IntersectionObserverEntry
    // Far as soon as it mounts, before any frame is drawn with it.
    const gone = new Promise<void>((resolve) => {
      const watch = new MutationObserver(() => {
        if (item.hasAttribute("data-windowed")) return
        watch.disconnect()
        far.callback([entry(false)], far.observer)
        resolve()
      })
      watch.observe(item, { attributes: true })
    })
    near.callback([entry(true)], near.observer)
    await gone
    await waitFor(() => expect(item).toHaveAttribute("data-windowed"))
    await expect(item.style.height).toMatch(/px$/)
    await expect(item.style.height).not.toBe("160px")
  },
}

/**
 * The near observer's entries held back, as a fast scroll outruns them:
 * the browser tells of an intersection after the frame it drew, and the
 * message mounts in a later one, a blank box drawn in between.
 */
function holdBackNear() {
  const Native = window.IntersectionObserver
  const timeouts = new Set<ReturnType<typeof setTimeout>>()
  window.IntersectionObserver = class extends Native {
    constructor(
      callback: IntersectionObserverCallback,
      options?: IntersectionObserverInit
    ) {
      const near = String(options?.rootMargin).startsWith("100%")
      super(
        near
          ? (entries, observer) => {
              const timeout = setTimeout(() => {
                timeouts.delete(timeout)
                callback(entries, observer)
              }, 2000)
              timeouts.add(timeout)
            }
          : callback,
        options
      )
    }
  }
  return () => {
    window.IntersectionObserver = Native
    timeouts.forEach(clearTimeout)
  }
}

/** The windowed items any of the viewport shows: empty boxes drawn. */
function blanksInView(viewport: HTMLElement) {
  const view = viewport.getBoundingClientRect()
  return [...viewport.querySelectorAll<HTMLElement>("[data-windowed]")]
    .filter((item) => {
      const rect = item.getBoundingClientRect()
      return rect.bottom > view.top && rect.top < view.bottom
    })
    .map((item) => item.dataset.messageId)
}

/**
 * Blank boxes in view in each of the next frames, as drawn: read once the
 * frame's callbacks have run (the near observer held back, nothing mounts
 * between the frame and the task after it).
 */
async function blanksDrawn(viewport: () => HTMLElement, frames = 2) {
  const blanks: string[] = []
  for (let at = 0; at < frames; at++) {
    await new Promise((resolve) =>
      requestAnimationFrame(() => setTimeout(resolve))
    )
    blanks.push(...blanksInView(viewport()).map((id) => `${at}:${id}`))
  }
  return blanks
}

/**
 * A fling up a long conversation, a view and a half a frame, then the
 * scrollbar dragged from end to end: what comes into view is drawn
 * mounted in the frame it comes in, never as an empty box, though the
 * observers tell of it too late.
 */
export const WindowedFling: Story = {
  render: Windowed.render,
  beforeEach: holdBackNear,
  play: async ({ canvas }) => {
    const viewport = canvas.getByRole("region", { name: "Conversation" })
    await still(viewport)
    const blanks: string[] = []
    while (viewport.scrollTop > 0) {
      viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: -720 }))
      viewport.scrollTop -= viewport.clientHeight * 1.5
      blanks.push(...(await blanksDrawn(() => viewport, 1)))
    }
    const end = () => viewport.scrollHeight - viewport.clientHeight
    for (const at of [0.9, 0.2, 0.6, 0.05, 0.75, 0.4]) {
      viewport.scrollTop = end() * at
      blanks.push(...(await blanksDrawn(() => viewport)))
    }
    await expect(blanks).toEqual([])
    // Those out of view still windowed.
    await expect(
      viewport.querySelectorAll("[data-windowed]").length
    ).toBeGreaterThan(10)
  },
}

/** Switching between two long conversations, one put at a message. */
function Switching() {
  const [which, setWhich] = React.useState<"a" | "b">("a")
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setWhich(which === "a" ? "b" : "a")}
      >
        Switch
      </Button>
      <div className="flex h-120 w-md max-w-full flex-col overflow-hidden rounded-xl border">
        <MessageScrollerProvider key={which} autoScroll>
          {which === "b" && <ScrollTo messageId="b-40" />}
          <MessageScroller>
            <MessageScrollerViewport aria-label="Conversation">
              <MessageScrollerContent className="p-4">
                {tall.map((message, index) => (
                  <MessageScrollerItem
                    key={message.id}
                    messageId={`${which}-${index}`}
                  >
                    <Message>
                      <MessageContent>
                        <Bubble variant="muted">
                          <BubbleContent className="whitespace-pre-wrap">
                            {index % 3 === 0
                              ? `Short message ${index}.`
                              : message.text}
                          </BubbleContent>
                        </Bubble>
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                ))}
              </MessageScrollerContent>
            </MessageScrollerViewport>
          </MessageScroller>
        </MessageScrollerProvider>
      </div>
    </div>
  )
}

/**
 * A conversation switched to, at its end or put at a message: what is in
 * view is mounted in the first frame drawn, not boxes filled in later.
 */
export const WindowedSwitch: Story = {
  render: () => <Switching />,
  beforeEach: holdBackNear,
  play: async ({ canvas }) => {
    const button = canvas.getByRole("button", { name: "Switch" })
    const blanks: string[] = []
    for (let step = 0; step < 4; step++) {
      // Clicked here, so the next frame is the first with it.
      button.click()
      const viewport = () =>
        canvas.getByRole("region", { name: "Conversation" })
      blanks.push(
        ...(await blanksDrawn(viewport, 3)).map((b) => `${step} ${b}`)
      )
      await still(viewport())
    }
    await expect(blanks).toEqual([])
  },
}

/**
 * Scrolled from the end by a script or a scrollbar, with no wheel, touch
 * or key: the end is let go, so the messages mounting above as they come
 * near do not pull the view back to it.
 */
export const WindowedScrolledAway: Story = {
  render: Windowed.render,
  play: async ({ canvas }) => {
    const viewport = canvas.getByRole("region", { name: "Conversation" })
    const gap = () =>
      viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop
    await still(viewport)
    await expect(gap()).toBeLessThanOrEqual(1)
    // Past the messages mounted at the end, to those still at the guess.
    for (let step = 0; step < 30; step++) {
      viewport.scrollTop -= 150
      await new Promise(requestAnimationFrame)
    }
    await still(viewport)
    await expect(gap()).toBeGreaterThan(4000)
  },
}

/** Once the reader scrolls, the scroller no longer holds the message. */
export const RestoreThenScroll: Story = {
  render: () => <History restore="answer-65" />,
  play: async ({ canvas, canvasElement }) => {
    const viewport = canvas.getByRole("region", { name: "Conversation" })
    const target = canvasElement.querySelector('[data-message-id="answer-65"]')!
    const padding = parseFloat(
      getComputedStyle(canvas.getByRole("log")).paddingTop
    )
    const offset = () =>
      target.getBoundingClientRect().top - viewport.getBoundingClientRect().top
    // Scrolled from where it was put.
    await waitFor(() =>
      expect(Math.abs(offset() - padding)).toBeLessThanOrEqual(1)
    )
    viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: -300 }))
    viewport.scrollTop -= 300
    await still(viewport, offset)
    await expect(offset()).toBeGreaterThan(250)
  },
}

/** An image that takes its size once it has loaded. */
function LateImage({ delay }: { delay: number }) {
  const [loaded, setLoaded] = React.useState(false)
  React.useEffect(() => {
    const timeout = setTimeout(() => setLoaded(true), delay)
    return () => clearTimeout(timeout)
  }, [delay])
  return (
    <div
      role="img"
      aria-label="A chart"
      className="w-64 rounded-lg bg-muted"
      style={{ height: loaded ? 240 : 0 }}
    />
  )
}

/**
 * Without autoScroll: the end it opens at, and the end `scrollToEnd` goes
 * to, are held while the content settles and comes.
 */
function Settling() {
  const [reply, setReply] = React.useState<string | null>(null)
  const { scrollToEnd } = useMessageScroller()
  React.useEffect(() => {
    if (reply === null || reply.length > 400) return
    const timeout = setTimeout(
      () => setReply((text) => `${text}The run read the logs again. `),
      60
    )
    return () => clearTimeout(timeout)
  }, [reply])
  return (
    <div className="flex h-120 w-md max-w-full flex-col overflow-hidden rounded-xl border">
      <MessageScroller>
        <MessageScrollerViewport aria-label="Conversation">
          <MessageScrollerContent className="p-4">
            {history.map((message, index) => (
              <MessageScrollerItem key={message.id} messageId={message.id}>
                <Message align={message.role === "user" ? "end" : "start"}>
                  <MessageContent>
                    <Bubble variant="muted">
                      <BubbleContent className="whitespace-pre-wrap">
                        {message.text}
                      </BubbleContent>
                    </Bubble>
                    {index === history.length - 1 && <LateImage delay={300} />}
                  </MessageContent>
                </Message>
              </MessageScrollerItem>
            ))}
            {reply !== null && (
              <MessageScrollerItem messageId="reply">
                <Message>
                  <MessageContent>
                    <Bubble variant="muted">
                      <BubbleContent>{reply}</BubbleContent>
                    </Bubble>
                  </MessageContent>
                </Message>
              </MessageScrollerItem>
            )}
          </MessageScrollerContent>
        </MessageScrollerViewport>
      </MessageScroller>
      <div className="border-t p-3">
        <Button
          className="w-full"
          disabled={reply !== null}
          onClick={() => {
            setReply("")
            scrollToEnd()
          }}
        >
          Reply
        </Button>
      </div>
    </div>
  )
}

/**
 * Without autoScroll, at the end: it stays there while the messages render
 * at their real height, an image loads and a reply comes, until the reader
 * scrolls.
 */
export const HoldEnd: Story = {
  render: () => (
    <MessageScrollerProvider>
      <Settling />
    </MessageScrollerProvider>
  ),
  play: async ({ canvas }) => {
    const viewport = canvas.getByRole("region", { name: "Conversation" })
    const gap = () =>
      viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop
    // The image took its size after the first scroll.
    await waitFor(() =>
      expect(canvas.getByRole("img", { hidden: true }).offsetHeight).toBe(240)
    )
    await still(viewport)
    await expect(gap()).toBeLessThanOrEqual(1)

    // A reply streams in after scrollToEnd: the end is held.
    await userEvent.click(canvas.getByRole("button", { name: "Reply" }))
    await waitFor(
      () =>
        expect(
          viewport.querySelector('[data-message-id="reply"]')!.textContent!
            .length
        ).toBeGreaterThan(400),
      { timeout: 4000 }
    )
    await still(viewport)
    await expect(gap()).toBeLessThanOrEqual(1)
  },
}

/** Once the reader scrolls away, the end is no longer held. */
export const HoldEndThenScroll: Story = {
  render: HoldEnd.render,
  play: async ({ canvas }) => {
    const viewport = canvas.getByRole("region", { name: "Conversation" })
    const gap = () =>
      viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop
    // Scrolled from the end it opens at.
    await waitFor(() => expect(gap()).toBeLessThanOrEqual(1))
    viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: -300 }))
    viewport.scrollTop -= 300
    await waitFor(() =>
      expect(canvas.getByRole("img", { hidden: true }).offsetHeight).toBe(240)
    )
    await still(viewport)
    await expect(gap()).toBeGreaterThan(250)
  },
}

/**
 * A long conversation shows its latest messages and loads earlier ones on
 * request, so the scroller has a bounded number of messages to track.
 */
function Earlier() {
  const step = 20
  const [from, setFrom] = React.useState(history.length - step)
  const [loading, setLoading] = React.useState(false)
  return (
    <div className="flex h-120 w-md max-w-full flex-col overflow-hidden rounded-xl border">
      <MessageScrollerProvider autoScroll>
        <MessageScroller>
          <MessageScrollerViewport aria-label="Conversation">
            <MessageScrollerContent className="p-4">
              {history.slice(from).map((message) => (
                <MessageScrollerItem
                  key={message.id}
                  messageId={message.id}
                  scrollAnchor={message.role === "user"}
                  className={
                    message.role === "user" ? "not-first:mt-4" : undefined
                  }
                >
                  <Message align={message.role === "user" ? "end" : "start"}>
                    <MessageContent>
                      <Bubble variant="muted">
                        <BubbleContent className="whitespace-pre-wrap">
                          {message.text}
                        </BubbleContent>
                      </Bubble>
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          {from > 0 && (
            <MessageScrollerLoadEarlier
              loading={loading}
              onClick={() => {
                // As a request for them takes a while.
                setLoading(true)
                setTimeout(() => {
                  setFrom((index) => Math.max(0, index - step))
                  setLoading(false)
                }, 400)
              }}
            />
          )}
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>
    </div>
  )
}

/**
 * Earlier messages, loaded from a button at the top shown while the reader
 * is at the start, leave the ones in view where they are; while they load,
 * it has a spinner and takes no second click.
 */
export const LoadEarlier: Story = {
  render: () => <Earlier />,
  play: async ({ canvas, canvasElement }) => {
    const viewport = canvas.getByRole("region", { name: "Conversation" })
    const items = () =>
      canvasElement.querySelectorAll("[data-slot=message-scroller-item]")
    const load = canvasElement.querySelector<HTMLElement>(
      "[data-slot=message-scroller-load-earlier]"
    )!
    // At the end, it is hidden.
    await still(viewport, () => load.dataset.active)
    await expect(load).toHaveAttribute("data-active", "false")
    await expect(load).toHaveAttribute("inert")

    // A wheel up, as the reader's bubbles: it lets go of the end.
    viewport.dispatchEvent(
      new WheelEvent("wheel", { bubbles: true, deltaY: -300 })
    )
    viewport.scrollTop = 0
    await waitFor(() => expect(load).toHaveAttribute("data-active", "true"))
    await still(viewport)
    const first = items()[0]!
    const offset = () =>
      first.getBoundingClientRect().top - viewport.getBoundingClientRect().top
    const before = offset()

    const button = canvas.getByRole("button", {
      name: "Load earlier messages",
    })
    await userEvent.click(button)
    await expect(button).toHaveAccessibleName("Loading earlier messages")
    await expect(button).toHaveAttribute("aria-disabled", "true")
    await expect(button).toHaveFocus()
    // A second click while they load does nothing.
    await userEvent.click(button)
    await waitFor(() => expect(items().length).toBe(40))
    await still(viewport, offset)
    await expect(items()[0]).not.toBe(first)
    await expect(Math.abs(offset() - before)).toBeLessThanOrEqual(1)
    await expect(viewport.scrollTop).toBeGreaterThan(0)
    // Scrolled past the start now, it hides, and the focus goes on to the
    // viewport.
    await waitFor(() => expect(load).toHaveAttribute("data-active", "false"))
    await expect(viewport).toHaveFocus()
  },
}

/** A row of the agent's turn in `Takeover`. */
type TurnRow =
  | { id: string; kind: "user" | "answer"; text: string }
  | { id: string; kind: "working" | "waiting" | "allowed" }

const takeoverTurns = 4
const takeoverAsks = 4

const takeoverHistory: TurnRow[] = Array.from(
  { length: takeoverTurns },
  (_, turn): TurnRow[] => [
    {
      id: `question-${turn}`,
      kind: "user",
      text: `Can you check step ${turn + 1} of the build?`,
    },
    {
      id: `answer-${turn}`,
      kind: "answer",
      text: `Step ${turn + 1} read the cache, compiled the sources and wrote the bundle. ${"It took about as long as the last good run. ".repeat(turn === takeoverTurns - 1 ? 1 : 3)}`,
    },
  ]
).flat()

const shield = <HugeiconsIcon icon={Shield01Icon} strokeWidth={2} />

/**
 * A conversation whose agent asks to call a tool, again and again: its
 * working row becomes a waiting row as the card takes the composer's
 * place, and, allowed, the waiting row a decided one as the composer
 * comes back and the rest of the turn streams in. Each swap replaces a
 * row with another, the count of rows the same.
 */
function TakeoverConversation() {
  const [rows, setRows] = React.useState<TurnRow[]>(() => [
    ...takeoverHistory,
    { id: "working-0", kind: "working" },
  ])
  const [ask, setAsk] = React.useState(0)
  const [asking, setAsking] = React.useState(false)
  const timeouts = React.useRef<number[]>([])
  React.useEffect(() => {
    const pending = timeouts.current
    return () => pending.forEach(clearTimeout)
  }, [])
  const later = (delay: number, run: () => void) =>
    timeouts.current.push(window.setTimeout(run, delay))
  const swap = (from: string, to: TurnRow) =>
    setRows((all) => all.map((row) => (row.id === from ? to : row)))

  // Working, the agent asks: its row becomes the waiting one.
  const working = rows.some((row) => row.id === `working-${ask}`)
  React.useEffect(() => {
    if (!working) return
    const timeout = window.setTimeout(() => {
      swap(`working-${ask}`, { id: `waiting-${ask}`, kind: "waiting" })
      setAsking(true)
    }, 250)
    return () => clearTimeout(timeout)
  }, [working, ask])

  function allow() {
    setAsking(false)
    swap(`waiting-${ask}`, { id: `allowed-${ask}`, kind: "allowed" })
    for (const part of [1, 2, 3])
      later(part * 40, () =>
        setRows((all) => [
          ...all,
          {
            id: `result-${ask}-${part}`,
            kind: "answer",
            text: `Call ${ask + 1}, part ${part}: the tool listed the files it changed and the tests it ran.`,
          },
        ])
      )
    if (ask + 1 < takeoverAsks)
      later(160, () => {
        setAsk(ask + 1)
        setRows((all) => [
          ...all,
          { id: `working-${ask + 1}`, kind: "working" },
        ])
      })
  }

  return (
    <div className="flex h-svh w-full flex-col gap-3 p-4">
      <MessageScrollerProvider autoScroll>
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport aria-label="Conversation">
            <MessageScrollerContent className="mx-auto max-w-column p-4">
              {rows.map((row) => (
                <MessageScrollerItem
                  key={row.id}
                  messageId={row.id}
                  scrollAnchor={row.kind === "user"}
                  className={row.kind === "user" ? "not-first:mt-4" : undefined}
                >
                  {row.kind === "user" || row.kind === "answer" ? (
                    <Message align={row.kind === "user" ? "end" : "start"}>
                      <MessageContent>
                        <Bubble variant="muted">
                          <BubbleContent>{row.text}</BubbleContent>
                        </Bubble>
                      </MessageContent>
                    </Message>
                  ) : row.kind === "working" ? (
                    <Marker role="status">
                      <MarkerIcon>
                        <Spinner />
                      </MarkerIcon>
                      <MarkerContent>Working...</MarkerContent>
                    </Marker>
                  ) : (
                    <AgentRequest
                      icon={shield}
                      {...(row.kind === "waiting"
                        ? {
                            waiting: {
                              summary: "Run read_files",
                              meta: "Waiting for you below",
                            },
                          }
                        : {
                            decision: {
                              summary: "Allowed read_files",
                              meta: "By you",
                            },
                          })}
                    />
                  )}
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>
      <ComposerTakeover
        className="mx-auto max-w-column"
        status="Needs your approval"
        request={
          asking ? (
            <AgentRequest key={ask} icon={shield}>
              <AgentRequestTitle>
                Allow the agent to call this tool?
              </AgentRequestTitle>
              <AgentRequestDescription>
                It reads the files the build wrote.
              </AgentRequestDescription>
              <AgentRequestContent>
                <CodeBlock size="sm">
                  <CodeBlockContent>
                    {JSON.stringify(
                      {
                        tool: "read_files",
                        paths: ["dist/index.js", "dist/index.css"],
                        limit: 2000,
                      },
                      null,
                      2
                    )}
                  </CodeBlockContent>
                </CodeBlock>
              </AgentRequestContent>
              <AgentRequestFooter>
                <Button size="sm" onClick={allow}>
                  Allow once
                </Button>
              </AgentRequestFooter>
            </AgentRequest>
          ) : undefined
        }
      >
        <Composer>
          <ComposerEditor aria-label="Message" />
          <InputGroupAddon align="block-end">
            <ComposerSubmit className="ms-auto" />
          </InputGroupAddon>
        </Composer>
      </ComposerTakeover>
    </div>
  )
}

/**
 * Followed at the end, the conversation stays there as an agent's
 * request takes the composer's place (the view shrinks) and, allowed,
 * gives it back (the view grows) while the turn streams on: a row
 * replaced by another is not a new message to scroll to.
 */
export const Takeover: Story = {
  render: () => <TakeoverConversation />,
  parameters: { layout: "fullscreen" },
  play: async ({ canvas }) => {
    const viewport = canvas.getByRole("region", { name: "Conversation" })
    const gap = () =>
      viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop
    // The farthest from the end any frame was, from the first request on.
    let farthest = 0
    let sampling = true
    const sample = () => {
      farthest = Math.max(farthest, gap())
      if (sampling) requestAnimationFrame(sample)
    }
    for (let ask = 0; ask < takeoverAsks; ask++) {
      const allow = await canvas.findByRole("button", { name: "Allow once" })
      if (ask === 0) sample()
      await still(viewport)
      await expect(gap()).toBeLessThanOrEqual(1)
      await userEvent.click(allow)
      await canvas.findByText(new RegExp(`^Call ${ask + 1}, part 3`))
      await still(viewport)
      await expect(gap()).toBeLessThanOrEqual(1)
    }
    sampling = false
    await expect(farthest).toBeLessThanOrEqual(1)
  },
}

const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

/**
 * A long, tool-heavy conversation scrolled by wheel, a step a frame:
 * nothing is read before a frame's layout (where a message just mounted
 * would force one), and over messages already seen, nothing changes size,
 * so the scroll is never corrected: only the reader moves it. (Frame
 * times are `pnpm perf`'s, in src/perf/long-conversation.perf.tsx.)
 */
export const LongToolHeavy: Story = {
  render: () => <LongConversation count={80} />,
  play: async ({ canvasElement }) => {
    const viewport = canvasElement.querySelector<HTMLElement>(
      "[data-slot=message-scroller-viewport]"
    )!
    await waitFor(() => expect(viewport.scrollTop).toBeGreaterThan(0))
    for (let i = 0; i < 10; i++) await nextFrame()
    const probe = instrument(viewport)
    const scroll = async (delta: number, steps: number) => {
      probe.counts.inFrames = 0
      probe.counts.writes = 0
      for (let step = 0; step < steps; step++) {
        probe.scrollBy(delta)
        await nextFrame()
      }
      for (let i = 0; i < 5; i++) await nextFrame()
      return { ...probe.counts }
    }
    try {
      const first = await scroll(-120, 60)
      await expect(first.inFrames).toBe(0)
      const back = await scroll(120, 60)
      await expect(back.inFrames).toBe(0)
      await expect(back.writes).toBe(0)
      const again = await scroll(-120, 60)
      await expect(again.inFrames).toBe(0)
      await expect(again.writes).toBe(0)
    } finally {
      probe.restore()
    }
  },
}

function PartButton() {
  const { scrollToMessage } = useMessageScroller()
  return (
    <Button
      size="sm"
      variant="outline"
      className="absolute end-3 top-3 z-10"
      onClick={() => scrollToMessage("long", { part: "long:step-9" })}
    >
      Step 9
    </Button>
  )
}

/**
 * Taken to a part of a message (a tool call opened from elsewhere): with
 * `scrollToMessage(id, { part })`, its `[data-part-id]` at the viewport's
 * start, 16px below it, not the message's start. Folds it is in are the
 * app's to open first (`agentTurnFolds`).
 */
export const ScrollToPart: Story = {
  render: () => (
    <div className="relative flex h-120 w-md max-w-full flex-col overflow-hidden rounded-xl border">
      <MessageScrollerProvider>
        <PartButton />
        <MessageScroller>
          <MessageScrollerViewport aria-label="Conversation">
            <MessageScrollerContent className="p-4">
              {history.slice(0, 4).map((message) => (
                <MessageScrollerItem key={message.id} messageId={message.id}>
                  <Message align={message.role === "user" ? "end" : "start"}>
                    <MessageContent>{message.text.slice(0, 80)}</MessageContent>
                  </Message>
                </MessageScrollerItem>
              ))}
              <MessageScrollerItem messageId="long">
                <Message>
                  <MessageContent className="flex flex-col gap-2">
                    {Array.from({ length: 16 }, (_, index) => (
                      <p
                        key={index}
                        data-part-id={`long:step-${index + 1}`}
                        className="py-4"
                      >
                        Step {index + 1}: read a file and edit it.
                      </p>
                    ))}
                  </MessageContent>
                </Message>
              </MessageScrollerItem>
              {history.slice(4, 8).map((message) => (
                <MessageScrollerItem key={message.id} messageId={message.id}>
                  <Message align={message.role === "user" ? "end" : "start"}>
                    <MessageContent>{message.text.slice(0, 80)}</MessageContent>
                  </Message>
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
        </MessageScroller>
      </MessageScrollerProvider>
    </div>
  ),
  play: async ({ canvas, canvasElement }) => {
    const viewport = canvasElement.querySelector<HTMLElement>(
      "[data-slot=message-scroller-viewport]"
    )!
    const part = canvasElement.querySelector<HTMLElement>(
      '[data-part-id="long:step-9"]'
    )!
    await userEvent.click(canvas.getByRole("button", { name: "Step 9" }))
    await waitFor(() =>
      expect(
        Math.round(
          part.getBoundingClientRect().top -
            viewport.getBoundingClientRect().top
        )
      ).toBe(16)
    )
  },
}

function HighlightTo({ messageId }: { messageId: string }) {
  const { scrollToMessage } = useMessageScroller()
  React.useEffect(() => {
    scrollToMessage(messageId, { highlight: true })
  }, [messageId, scrollToMessage])
  return null
}

/**
 * Taken to a message (a search's result, a link to it), it is marked a
 * moment: `scrollToMessage(id, { highlight: true })`, the accent's grey
 * fading out over 1.2s, then unmarked.
 */
export const Highlight: Story = {
  render: () => (
    <div className="flex h-120 w-md max-w-full flex-col overflow-hidden rounded-xl border">
      <MessageScrollerProvider>
        <HighlightTo messageId="answer-3" />
        <MessageScroller>
          <MessageScrollerViewport aria-label="Conversation">
            <MessageScrollerContent className="p-4">
              {history.slice(0, 10).map((message) => (
                <MessageScrollerItem key={message.id} messageId={message.id}>
                  <Message align={message.role === "user" ? "end" : "start"}>
                    <MessageContent>{message.text.slice(0, 80)}</MessageContent>
                  </Message>
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
        </MessageScroller>
      </MessageScrollerProvider>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const item = canvasElement.querySelector<HTMLElement>(
      '[data-message-id="answer-3"]'
    )!
    await waitFor(() => expect(item).toHaveAttribute("data-highlighted"))
    await expect(getComputedStyle(item).animationName).toBe("highlight")
    await expect(
      canvasElement.querySelector('[data-message-id="answer-2"]')
    ).not.toHaveAttribute("data-highlighted")
    // Unmarked once it has faded.
    await waitFor(() => expect(item).not.toHaveAttribute("data-highlighted"), {
      timeout: 3000,
    })
  },
}

/**
 * Earlier messages arriving among the reader's wheel steps up (asked for
 * by the first, they come a moment later): what the reader looks at
 * moves by the steps, every one, as the place is kept over the messages
 * put above it. (Real wheel steps, which WebKit scrolls on a thread of
 * its own: src/test/prepend-while-wheeling.input.test.tsx.)
 */
export const PrependWhileWheeling: Story = {
  render: () => <PrependWhileScrolling />,
  play: async ({ canvas }) => {
    const viewport = canvas.getByRole("region", { name: "Conversation" })
    await still(viewport)
    const box = viewport.getBoundingClientRect()
    const anchor = document
      .elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)!
      .closest<HTMLElement>("[data-message-id]")!
    const before = anchor.getBoundingClientRect().top
    for (let step = 0; step < 3; step++) {
      viewport.dispatchEvent(
        new WheelEvent("wheel", { bubbles: true, deltaY: -100 })
      )
      viewport.scrollTop -= 100
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    await waitFor(() =>
      expect(viewport.querySelectorAll("[data-message-id]").length).toBe(73)
    )
    await still(viewport)
    await expect(Math.round(anchor.getBoundingClientRect().top - before)).toBe(
      300
    )
  },
}
