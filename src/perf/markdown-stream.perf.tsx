import { useLayoutEffect, useMemo, useState } from "react"
import { test } from "vitest"
import { commands, server } from "vitest/browser"

import { AgentTurn } from "@/components/agent-turn"
import { Markdown } from "@/components/markdown"

import { frame, render, report, sync, time } from "./harness"

const chromium = server.browser === "chromium"

/** 256 KiB of paragraphs: words and spaces, as a long answer. */
const unit =
  "A running session reports progress while another device can request a stop. The accepted result remains available after reconnecting.\n\n"
const prose = unit
  .repeat(Math.floor((256 << 10) / unit.length))
  .padEnd(256 << 10, " ")

/** An answer with code in it, as an agent writes one. */
const block =
  "Here is the change, then why it works.\n\n```ts\nexport function retry<T>(attempt: () => Promise<T>, times = 3) {\n  return attempt().catch((error) =>\n    times > 0 ? retry(attempt, times - 1) : Promise.reject(error)\n  )\n}\n```\n\nIt retries **three** times, then gives up with the last `error`.\n\n"

/** The animations on the page, by kind: none should come of an update. */
function animations() {
  const kinds = new Map<string, number>()
  for (const animation of document.getAnimations()) {
    const name =
      "animationName" in animation
        ? (animation as CSSAnimation).animationName
        : "transitionProperty" in animation
          ? `transition ${(animation as CSSTransition).transitionProperty}`
          : "script"
    kinds.set(name, (kinds.get(name) ?? 0) + 1)
  }
  const total = [...kinds.values()].reduce((sum, n) => sum + n, 0)
  return `${total} ${JSON.stringify(Object.fromEntries(kinds))}`
}

const control: { set?: (text: string) => void } = {}

function Live({ initial, turn }: { initial: string; turn: boolean }) {
  const [text, setText] = useState(initial)
  useLayoutEffect(() => {
    control.set = setText
  }, [])
  const content = <Markdown isAnimating>{text}</Markdown>
  return turn ? (
    <AgentTurn
      id="perf"
      status="running"
      parts={[{ type: "content", id: "1.1", content }]}
    />
  ) : (
    content
  )
}

/**
 * One long answer updated 100 times, its last character changing: each
 * update's cost, and what is left on the page after.
 */
for (const turn of [false, true]) {
  const name = `256 KiB answer${turn ? " in a running turn" : ""}`
  test(name, async () => {
    render(<Live initial={prose} turn={turn} />)
    await frame()
    const samples: number[] = []
    for (let index = 0; index < 100; index++) {
      const next = prose.slice(0, -1) + (index % 2)
      samples.push(time(() => sync(() => control.set!(next))))
      await frame()
    }
    report(`${name}, an update`, samples)
    console.log(`PERF ${name}: animations after 100 updates ${animations()}`)
  })
}

const streams: { set: ((text: string) => void)[] } = { set: [] }

/** One answer streaming, its own state: an update renders it alone. */
function Stream({ index }: { index: number }) {
  const [text, setText] = useState("")
  useLayoutEffect(() => {
    streams.set[index] = setText
  }, [index])
  const parts = useMemo(
    () => [
      {
        type: "content" as const,
        id: `c${index}`,
        content: <Markdown isAnimating>{text}</Markdown>,
      },
    ],
    [index, text]
  )
  return <AgentTurn id={`run${index}`} status="running" parts={parts} />
}

/**
 * Eight answers streaming at once in running turns, words and code, 1,600
 * updates between them, eight a frame: each update's cost, early and late
 * (bounded: it does not grow with the answers), and what is left.
 */
test("eight answers streaming", async () => {
  render(
    <div className="flex flex-col gap-4">
      {Array.from({ length: 8 }, (_, index) => (
        <Stream key={index} index={index} />
      ))}
    </div>
  )
  await frame()
  const whole = (block + unit).repeat(60)
  const lengths = Array<number>(8).fill(0)
  const before = chromium ? await commands.browserTotals() : undefined
  const samples: number[] = []
  for (let update = 0; update < 1600; update++) {
    const index = update % 8
    lengths[index] = Math.min(whole.length, lengths[index]! + 48)
    const text = whole.slice(0, lengths[index])
    samples.push(time(() => sync(() => streams.set[index]!(text))))
    if (update % 8 === 7) await frame()
  }
  report("eight answers, an update", samples)
  report("eight answers, the first 200 updates", samples.slice(0, 200))
  report("eight answers, the last 200 updates", samples.slice(-200))
  if (chromium) {
    const after = await commands.browserTotals()
    const memory = await commands.browserMemory()
    console.log(
      `PERF eight answers: script ${Math.round(after.script - before!.script)}ms, style ${Math.round(after.style - before!.style)}ms, layout ${Math.round(after.layout - before!.layout)}ms; ${memory.nodes} nodes, heap ${Math.round(memory.heap / 1048576)} MiB`
    )
  }
  console.log(`PERF eight answers: animations ${animations()}`)
})
