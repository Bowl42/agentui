import * as React from "react"

import { AgentTurn, type AgentTurnPart } from "@/components/agent-turn"
import { Markdown } from "@/components/markdown"
import { MediaGallery } from "@/components/media-gallery"
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import { UserMessage, UserMessageText } from "@/components/user-message"

// A long, tool-heavy conversation, as an agent app shows it: each turn a
// question, four commands with 80 lines of output each, and an answer in
// Markdown with headings and a fenced block; the scroller deep in nested
// flex boxes, as an app's shell puts it. Scrolled by wheel, a step a
// frame, as a reader does.

const output = (turn: number, step: number) =>
  Array.from(
    { length: 80 },
    (_, line) => `turn ${turn} step ${step} line ${line}: ok`
  ).join("\n")

const answer = (turn: number) => `## What changed in turn ${turn}

The build now splits vendor code once and skips what nothing imports.

### The config

\`\`\`ts
export default defineConfig({
  build: {
    rollupOptions: { output: { manualChunks: { vendor: ["react"] } } },
    cssCodeSplit: true,
  },
})
\`\`\`

One snapshot test failed; I left it for you to review.`

type Turn = { id: number; parts: AgentTurnPart[] }

const makeTurns = (count: number, screenshots: readonly string[]): Turn[] =>
  Array.from({ length: count }, (_, id) => ({
    id,
    parts: Array.from({ length: 4 }, (_, step): AgentTurnPart => ({
      type: "tool",
      id: `t${id}-${step}`,
      kind: "command",
      command: `pnpm test --filter step-${step}`,
      status: "done",
      output: output(id, step),
      duration: "2s",
      // Two screenshots the first step took, each in its card.
      ...(step === 0 && screenshots.length > 0
        ? {
            media: (
              <MediaGallery
                layout="flow"
                items={[0, 1].map((shot) => ({
                  kind: "image" as const,
                  src: screenshots[(2 * id + shot) % screenshots.length]!,
                  alt: `Screenshot ${shot + 1} of turn ${id}`,
                  width: 2880,
                  height: 1800,
                }))}
              />
            ),
          }
        : {}),
    })),
  }))

const TurnView = React.memo(function TurnView({ turn }: { turn: Turn }) {
  return (
    <>
      <MessageScrollerItem messageId={`q${turn.id}`} scrollAnchor>
        <UserMessage>
          <UserMessageText>
            Can you make build {turn.id} faster?
          </UserMessageText>
        </UserMessage>
      </MessageScrollerItem>
      <MessageScrollerItem messageId={`a${turn.id}`}>
        <AgentTurn
          id={`turn${turn.id}`}
          status="done"
          duration="48s"
          parts={[
            ...turn.parts,
            {
              type: "content",
              id: `c${turn.id}`,
              content: <Markdown>{answer(turn.id)}</Markdown>,
            },
          ]}
        />
      </MessageScrollerItem>
    </>
  )
})

/** Nested flex columns, as an app's shell has around its conversation. */
function Shell({
  depth,
  children,
}: {
  depth: number
  children: React.ReactNode
}) {
  return depth === 0 ? (
    children
  ) : (
    <div className="flex min-h-0 flex-1 flex-col">
      <Shell depth={depth - 1}>{children}</Shell>
    </div>
  )
}

const none: readonly string[] = []

/**
 * `count` turns, each a question, four commands with 80 lines of output
 * and an answer with headings and a fenced block, in a scroller 800px
 * tall under ten nested flex boxes. With `screenshots`, the first command
 * of each turn shows two of them (2880×1800), in turn.
 */
function LongConversation({
  count = 300,
  screenshots = none,
}: {
  count?: number
  screenshots?: readonly string[]
}) {
  const turns = React.useMemo(
    () => makeTurns(count, screenshots),
    [count, screenshots]
  )
  return (
    <div className="flex h-[800px] flex-col">
      <Shell depth={10}>
        <MessageScrollerProvider>
          <MessageScroller className="flex-1">
            <MessageScrollerViewport aria-label="Conversation">
              <MessageScrollerContent className="mx-auto flex max-w-column flex-col gap-6 px-4 py-8">
                {turns.map((turn) => (
                  <TurnView key={turn.id} turn={turn} />
                ))}
              </MessageScrollerContent>
            </MessageScrollerViewport>
          </MessageScroller>
        </MessageScrollerProvider>
      </Shell>
    </div>
  )
}

export { LongConversation, instrument, screenshots }

/**
 * `count` screenshots as an agent's browser takes them: 2880×1800 JPEGs,
 * each its own, as object URLs.
 */
async function screenshots(count: number) {
  const canvas = document.createElement("canvas")
  canvas.width = 2880
  canvas.height = 1800
  const context = canvas.getContext("2d")!
  const urls: string[] = []
  for (let shot = 0; shot < count; shot++) {
    const gradient = context.createLinearGradient(0, 0, 2880, 1800)
    gradient.addColorStop(0, `hsl(${(shot * 37) % 360} 40% 85%)`)
    gradient.addColorStop(1, `hsl(${(shot * 37 + 120) % 360} 40% 35%)`)
    context.fillStyle = gradient
    context.fillRect(0, 0, 2880, 1800)
    context.fillStyle = "#111"
    context.font = "48px sans-serif"
    for (let line = 0; line < 30; line++)
      context.fillText(
        `screenshot ${shot}, line ${line}: the page as the agent saw it`,
        96,
        120 + line * 54
      )
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((made) => resolve(made!), "image/jpeg", 0.9)
    )
    urls.push(URL.createObjectURL(blob))
  }
  return urls
}

/**
 * Counts layout reads, those in animation frames (before the frame's
 * layout, where a row just mounted makes one forced) apart, and the
 * scroller's own scrolls (a scrollTop written, a scrollBy).
 */
function instrument(viewport: HTMLElement) {
  const counts = { rects: 0, inFrames: 0, writes: 0 }
  let ours = false
  let inFrame = false
  const rect = Element.prototype.getBoundingClientRect
  Element.prototype.getBoundingClientRect = function (this: Element) {
    counts.rects += 1
    if (inFrame) counts.inFrames += 1
    return rect.call(this)
  }
  const request = window.requestAnimationFrame
  window.requestAnimationFrame = (callback) =>
    request((time) => {
      inFrame = true
      try {
        callback(time)
      } finally {
        inFrame = false
      }
    })
  const descriptor = Object.getOwnPropertyDescriptor(
    Element.prototype,
    "scrollTop"
  )!
  Object.defineProperty(viewport, "scrollTop", {
    configurable: true,
    get() {
      return descriptor.get!.call(this)
    },
    set(value: number) {
      if (!ours) counts.writes += 1
      descriptor.set!.call(this, value)
    },
  })
  // The place kept by scrollBy too.
  const scrollBy = Element.prototype.scrollBy
  Object.defineProperty(viewport, "scrollBy", {
    configurable: true,
    value(this: Element, ...args: unknown[]) {
      if (!ours) counts.writes += 1
      ;(scrollBy as (...args: unknown[]) => void).apply(this, args)
    },
  })
  return {
    counts,
    /** The reader's scroll: not the scroller's. */
    scrollBy(delta: number) {
      ours = true
      viewport.dispatchEvent(
        new WheelEvent("wheel", { deltaY: delta, bubbles: true })
      )
      viewport.scrollTop += delta
      ours = false
    },
    restore() {
      Element.prototype.getBoundingClientRect = rect
      window.requestAnimationFrame = request
      delete (viewport as { scrollTop?: number }).scrollTop
      delete (viewport as { scrollBy?: unknown }).scrollBy
    },
  }
}
