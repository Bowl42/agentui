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

import { deferred, frame, profile, render, report } from "./harness"

const chromium = server.browser === "chromium"

const paragraph =
  "A running session reports progress while another device can request a stop. The accepted result remains available after reconnecting."

/** A done turn's answer: a few paragraphs. */
const answer = (turn: number) =>
  Array.from(
    { length: big.on ? 480 : 6 },
    (_, at) => `${paragraph} (${turn}.${at})`
  ).join("\n\n")

/** Whether done turns' answers are long (stopped ones, 64 KiB each). */
const big = { on: false }

/** 256 KiB of paragraphs, the live turn's answer. */
const long = `${paragraph}\n\n`
  .repeat(Math.floor((256 << 10) / (paragraph.length + 2)))
  .slice(0, 256 << 10)

function DoneTurn({ turn }: { turn: number }) {
  return (
    <>
      <MessageScrollerItem messageId={`q${turn}`} scrollAnchor>
        <UserMessage>
          <UserMessageText>
            Stop, and try again with the smaller build {turn}.
          </UserMessageText>
        </UserMessage>
      </MessageScrollerItem>
      <MessageScrollerItem messageId={`a${turn}`}>
        <AgentTurn
          id={`turn${turn}`}
          status="done"
          duration="12s"
          parts={[
            {
              type: "content",
              id: `c${turn}`,
              content: <Markdown>{answer(turn)}</Markdown>,
            },
          ]}
        />
      </MessageScrollerItem>
    </>
  )
}

const Done = React.memo(DoneTurn)

const control: { set?: (text: string) => void } = {}

function LiveTurn() {
  const [text, setText] = React.useState("")
  React.useLayoutEffect(() => {
    control.set = setText
  }, [])
  const parts = React.useMemo(
    () => [
      {
        type: "content" as const,
        id: "live",
        content: <Markdown isAnimating>{text}</Markdown>,
      },
    ],
    [text]
  )
  return (
    <MessageScrollerItem messageId="live">
      <AgentTurn id="live" status="running" parts={parts} />
    </MessageScrollerItem>
  )
}

/**
 * As an app that keeps the whole conversation in one state and maps it
 * each render: every turn's elements, labels and parts made anew.
 */
function Plain({ turns, all = false }: { turns: number; all?: boolean }) {
  const [text, setText] = React.useState("")
  React.useLayoutEffect(() => {
    control.set = setText
  }, [])
  if (all)
    return (
      <div className="mx-auto flex max-w-column flex-col gap-6 px-4 py-8">
        {Array.from({ length: turns + 1 }, (_, turn) => (
          <React.Fragment key={turn}>
            <UserMessage labels={{ author: "You" }}>
              <UserMessageText labels={{ title: "Your message" }}>
                {`Stop, and try again with the smaller build ${turn}.`}
              </UserMessageText>
            </UserMessage>
            <AgentTurn
              id={`turn${turn}`}
              status={turn === turns ? "running" : "done"}
              labels={{ working: "Working" }}
              parts={[
                {
                  type: "content",
                  id: `c${turn}`,
                  content: (
                    <Markdown isAnimating={turn === turns}>
                      {turn === turns ? text : answer(turn)}
                    </Markdown>
                  ),
                },
              ]}
            />
          </React.Fragment>
        ))}
      </div>
    )
  return (
    <div className="flex h-[800px] flex-col">
      <MessageScrollerProvider autoScroll>
        <MessageScroller className="flex-1">
          <MessageScrollerViewport aria-label="Conversation">
            <MessageScrollerContent className="mx-auto flex max-w-column flex-col gap-6 px-4 py-8">
              {Array.from({ length: turns + 1 }, (_, turn) => (
                <React.Fragment key={turn}>
                  <MessageScrollerItem messageId={`q${turn}`} scrollAnchor>
                    <UserMessage labels={{ author: "You" }}>
                      <UserMessageText labels={{ title: "Your message" }}>
                        {`Stop, and try again with the smaller build ${turn}.`}
                      </UserMessageText>
                    </UserMessage>
                  </MessageScrollerItem>
                  <MessageScrollerItem messageId={`a${turn}`}>
                    <AgentTurn
                      id={`turn${turn}`}
                      status={turn === turns ? "running" : "done"}
                      labels={{ working: "Working" }}
                      parts={[
                        {
                          type: "content",
                          id: `c${turn}`,
                          content: (
                            <Markdown isAnimating={turn === turns}>
                              {turn === turns ? text : answer(turn)}
                            </Markdown>
                          ),
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

function Conversation({ turns }: { turns: number }) {
  return (
    <div className="flex h-[800px] flex-col">
      <MessageScrollerProvider>
        <MessageScroller className="flex-1">
          <MessageScrollerViewport aria-label="Conversation">
            <MessageScrollerContent className="mx-auto flex max-w-column flex-col gap-6 px-4 py-8">
              {Array.from({ length: turns }, (_, turn) => (
                <Done key={turn} turn={turn} />
              ))}
              <LiveTurn />
            </MessageScrollerContent>
          </MessageScrollerViewport>
        </MessageScroller>
      </MessageScrollerProvider>
    </div>
  )
}

/** How many times each Clamp measured, by counting its content's reads. */
function countMeasures() {
  const counter = { reads: 0 }
  const descriptor = Object.getOwnPropertyDescriptor(
    Element.prototype,
    "scrollHeight"
  )!
  Object.defineProperty(Element.prototype, "scrollHeight", {
    configurable: true,
    get(this: Element) {
      if (this.getAttribute("data-slot") === "clamp-content") counter.reads++
      return descriptor.get!.call(this)
    },
  })
  return {
    counter,
    restore: () =>
      Object.defineProperty(Element.prototype, "scrollHeight", descriptor),
  }
}

/**
 * Hundreds of done turns (a question in its clamp, a few paragraphs of
 * answer), and a live one whose 256 KiB answer streams in a chunk each
 * 50ms: each update's cost with what it defers to the frames after it,
 * how many clamps measured meanwhile, and the animations left.
 */
for (const [turns, plain, all] of [
  [50, false, false],
  [400, false, false],
  [400, true, false],
  [20, true, false],
  [100, true, true],
] as const) {
  test(`${turns} done turns and one streaming${plain ? ", unmemoized" : ""}${all ? ", all mounted" : ""}`, async () => {
    big.on = turns === 20
    render(
      plain ? <Plain turns={turns} all={all} /> : <Conversation turns={turns} />
    )
    for (let i = 0; i < 20; i++) await frame()
    console.log(
      `PERF mounted: ${document.querySelectorAll("[data-slot=markdown]").length} answers, ${document.querySelectorAll("[data-slot=clamp]").length} clamps, ${document.getElementsByTagName("p").length} paragraphs, ${document.getElementsByTagName("*").length} elements`
    )
    const measures = countMeasures()
    const before = chromium ? await commands.browserTotals() : undefined
    const samples: number[] = []
    const run = async () => {
      for (let update = 1; update <= 100; update++) {
        const text = long.slice(0, Math.round((long.length * update) / 100))
        deferred.busy = 0
        const start = performance.now()
        React.startTransition(() => {})
        control.set!(text)
        await frame()
        await frame()
        samples.push(performance.now() - start - 16)
        await new Promise((resolve) => setTimeout(resolve, 20))
      }
    }
    if (chromium && import.meta.env.VITE_PROFILE)
      await profile(
        `conversation-${turns}${plain ? "-plain" : ""}${all ? "-all" : ""}`,
        run
      )
    else await run()
    measures.restore()
    const name = `${turns} done turns${plain ? ", unmemoized" : ""}${all ? ", all mounted" : ""}`
    report(`${name}, an update (frames included)`, samples)
    if (chromium) {
      const after = await commands.browserTotals()
      console.log(
        `PERF ${name}: script ${Math.round(after.script - before!.script)}ms, style ${Math.round(after.style - before!.style)}ms, layout ${Math.round(after.layout - before!.layout)}ms over 100 updates`
      )
    }
    console.log(
      `PERF ${name}: clamps measured ${measures.counter.reads} times in 100 updates; ${document.getElementsByTagName("p").length} paragraphs; ${document.getAnimations().length} animations running`
    )
  })
}
