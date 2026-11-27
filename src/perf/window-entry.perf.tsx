import * as React from "react"
import { test } from "vitest"
import { commands, server } from "vitest/browser"

import { AgentTurn } from "@/components/agent-turn"
import { Markdown } from "@/components/markdown"
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import { UserMessage, UserMessageText } from "@/components/user-message"

import { frame, render, report, sync, time } from "./harness"

const chromium = server.browser === "chromium"

const paragraph =
  "A running session reports progress while another device can request a stop. The accepted result remains available after reconnecting."

/** 256 KiB of paragraphs: a long answer. */
const long = `${paragraph}\n\n`
  .repeat(Math.floor((256 << 10) / (paragraph.length + 2)))
  .slice(0, 256 << 10)

/** Clamps' measures: the time in their first read, the layout it forces. */
function timeMeasures() {
  const spent = { ms: 0, reads: 0 }
  const descriptor = Object.getOwnPropertyDescriptor(
    Element.prototype,
    "clientWidth"
  )!
  Object.defineProperty(Element.prototype, "clientWidth", {
    configurable: true,
    get(this: Element) {
      if (this.getAttribute("data-slot") !== "clamp-content")
        return descriptor.get!.call(this)
      const start = performance.now()
      const width = descriptor.get!.call(this)
      spent.ms += performance.now() - start
      spent.reads++
      return width
    },
  })
  return {
    spent,
    restore: () =>
      Object.defineProperty(Element.prototype, "clientWidth", descriptor),
  }
}

const control: { set?: (streaming: boolean) => void } = {}

function Stopping() {
  const [streaming, setStreaming] = React.useState(true)
  React.useLayoutEffect(() => {
    control.set = setStreaming
  }, [])
  return (
    <AgentTurn
      id="stopping"
      status={streaming ? "running" : "stopped"}
      parts={[
        {
          type: "content",
          id: "c",
          content: <Markdown isAnimating={streaming}>{long}</Markdown>,
        },
      ]}
    />
  )
}

/** A 256 KiB answer's turn stopping: its Markdown no longer animating. */
test("a 256 KiB answer stops", async () => {
  const samples: number[] = []
  for (let run = 0; run < 10; run++) {
    render(<Stopping />)
    await frame()
    await frame()
    samples.push(time(() => sync(() => control.set!(false))))
    await frame()
  }
  report("a 256 KiB answer stops", samples)
})

/** The same answer mounting, done: what a row entering the window costs. */
test("a 256 KiB answer mounts", async () => {
  const samples: number[] = []
  for (let run = 0; run < 10; run++) {
    samples.push(
      time(() =>
        render(
          <AgentTurn
            id="done"
            status="done"
            parts={[
              {
                type: "content",
                id: "c",
                content: <Markdown>{long}</Markdown>,
              },
            ]}
          />
        )
      )
    )
    await frame()
  }
  report("a 256 KiB answer mounts", samples)
})

const turns = 20

function Conversation() {
  return (
    <div className="flex h-[800px] flex-col">
      <MessageScrollerProvider>
        <MessageScroller className="flex-1">
          <MessageScrollerViewport aria-label="Conversation">
            <MessageScrollerContent className="mx-auto flex max-w-column flex-col gap-6 px-4 py-8">
              {Array.from({ length: turns }, (_, turn) => (
                <React.Fragment key={turn}>
                  <MessageScrollerItem messageId={`q${turn}`} scrollAnchor>
                    <UserMessage>
                      <UserMessageText>
                        {`Stop, and try again with the smaller build ${turn}.`}
                      </UserMessageText>
                    </UserMessage>
                  </MessageScrollerItem>
                  <MessageScrollerItem messageId={`a${turn}`}>
                    <AgentTurn
                      id={`turn${turn}`}
                      status="stopped"
                      parts={[
                        {
                          type: "content",
                          id: `c${turn}`,
                          content: <Markdown>{long}</Markdown>,
                        },
                      ]}
                    />
                  </MessageScrollerItem>
                </React.Fragment>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
        </MessageScroller>
      </MessageScrollerProvider>
    </div>
  )
}

/**
 * Twenty turns of 256 KiB answers, opened at the end; then a jump to the
 * start, where none was measured yet (each a 10rem box): the longest task
 * as they mount, how many mount, and the clamps' share of it.
 */
test("rows entering the window, never measured", async () => {
  render(<Conversation />)
  for (let i = 0; i < 30; i++) await frame()
  const viewport = document.querySelector<HTMLElement>(
    "[data-slot=message-scroller-viewport]"
  )!
  const answers = () => document.querySelectorAll("[data-slot=markdown]").length
  console.log(`PERF window entry: ${answers()} answers mounted at the end`)
  const tasks: number[] = []
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) tasks.push(entry.duration)
  })
  observer.observe({ type: "longtask" })
  const measures = timeMeasures()
  const before = chromium ? await commands.browserTotals() : undefined
  const start = performance.now()
  viewport.scrollTop = 0
  for (let i = 0; i < 30; i++) await frame()
  const total = performance.now() - start
  measures.restore()
  observer.disconnect()
  const at = answers()
  // The answers mounted near the start, of those mounted at the end.
  const near = [
    ...document.querySelectorAll("[data-slot=message-scroller-item]"),
  ].filter(
    (item, index) => index < turns && item.querySelector("[data-slot=markdown]")
  ).length
  console.log(
    `PERF window entry: ${total.toFixed(0)}ms over 30 frames, longest task ${Math.max(0, ...tasks).toFixed(0)}ms (${tasks.map((t) => t.toFixed(0)).join(", ")}); ${near} answers mounted near the start, ${at} in all; clamps read ${measures.spent.reads} times, ${measures.spent.ms.toFixed(0)}ms`
  )
  if (chromium) {
    const after = await commands.browserTotals()
    console.log(
      `PERF window entry: script ${Math.round(after.script - before!.script)}ms, style ${Math.round(after.style - before!.style)}ms, layout ${Math.round(after.layout - before!.layout)}ms`
    )
  }
})
