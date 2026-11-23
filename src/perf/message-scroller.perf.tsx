import { memo, useLayoutEffect, useState } from "react"
import { test } from "vitest"

import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Message, MessageContent } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"

import {
  frame,
  measureFrames,
  render,
  report,
  reportFrames,
  sync,
  timeWithFrames,
} from "./harness"

type Turn = { id: string; role: "user" | "assistant"; text: string }

const reply = (index: number) =>
  Array.from(
    { length: 4 },
    (_, p) =>
      `Paragraph ${p} of reply ${index}, long enough to wrap onto a second line in the conversation.`
  ).join("\n\n")

const conversation = (count: number): Turn[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `m${index}`,
    role: index % 2 === 0 ? "user" : "assistant",
    text: index % 2 === 0 ? `Question ${index}?` : reply(index),
  }))

const Turn = memo(function Turn({ turn }: { turn: Turn }) {
  const user = turn.role === "user"
  return (
    <MessageScrollerItem messageId={turn.id} scrollAnchor={user}>
      <Message align={user ? "end" : "start"}>
        <MessageContent>
          <Bubble variant={user ? "default" : "muted"}>
            <BubbleContent className="whitespace-pre-wrap">
              {turn.text}
            </BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
    </MessageScrollerItem>
  )
})

const control: { write?: (text: string) => void } = {}
const write = (text: string) => control.write!(text)

function Chat({ initial }: { initial: Turn[] }) {
  const [turns, setTurns] = useState(initial)
  useLayoutEffect(() => {
    control.write = (text) =>
      setTurns((current) => {
        const last = current.at(-1)!
        return [...current.slice(0, -1), { ...last, text: last.text + text }]
      })
  }, [])
  return (
    <div className="flex h-[700px] w-2xl flex-col">
      <MessageScrollerProvider autoScroll>
        <MessageScroller>
          <MessageScrollerViewport aria-label="Conversation">
            <MessageScrollerContent className="p-4">
              {turns.map((turn) => (
                <Turn key={turn.id} turn={turn} />
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
        </MessageScroller>
      </MessageScrollerProvider>
    </div>
  )
}

const viewport = (host: HTMLElement) =>
  host.querySelector<HTMLElement>("[data-slot=message-scroller-viewport]")!

for (const count of [100, 1000, 3000]) {
  test(`message-scroller: stream into ${count} messages`, async () => {
    const turns = conversation(count)
    turns.push({ id: "streaming", role: "assistant", text: "" })
    render(<Chat initial={turns} />)
    for (let i = 0; i < 10; i++) await frame()

    const samples: number[] = []
    for (let step = 0; step < 100; step++) {
      samples.push(
        await timeWithFrames(() =>
          write(step % 12 === 11 ? "\n\nNext paragraph " : `word${step} `)
        )
      )
    }
    report(`message-scroller chunk, ${count} messages`, samples)
    // The browser's own work too: the render, its style and layout.
    const frames = []
    for (let step = 0; step < 40; step++)
      frames.push(
        await measureFrames(() =>
          sync(() =>
            write(step % 12 === 11 ? "\n\nNext paragraph " : `more${step} `)
          )
        )
      )
    reportFrames(`message-scroller chunk, ${count} messages`, frames)
  })

  test(`message-scroller: scroll ${count} messages`, async () => {
    const host = render(<Chat initial={conversation(count)} />)
    for (let i = 0; i < 10; i++) await frame()
    const element = viewport(host)
    const samples: number[] = []
    for (let step = 0; step < 100; step++) {
      samples.push(
        await timeWithFrames(() => {
          element.scrollTop -= 150
          element.dispatchEvent(new Event("scroll"))
        }, 2)
      )
    }
    report(`message-scroller scroll step, ${count} messages`, samples)
  })
}

test("message-scroller: scroll 1000 messages, frames included", async () => {
  const host = render(<Chat initial={conversation(1000)} />)
  for (let i = 0; i < 10; i++) await frame()
  const element = viewport(host)
  const samples = []
  for (let step = 0; step < 30; step++) {
    samples.push(
      await measureFrames(() => {
        element.scrollTop -= 150
      }, 2)
    )
  }
  reportFrames("message-scroller scroll step, 1000 messages", samples)
})

// A fling or a scrollbar drag: a view and a half a frame, past messages
// never mounted, which mount as they come (the frames after included, as
// the observers mount them there).
test("message-scroller: fling 3000 messages, frames included", async () => {
  const host = render(<Chat initial={conversation(3000)} />)
  for (let i = 0; i < 10; i++) await frame()
  const element = viewport(host)
  const samples = []
  for (let step = 0; step < 40; step++) {
    samples.push(
      await measureFrames(() => {
        element.scrollTop -= element.clientHeight * 1.5
      }, 3)
    )
  }
  reportFrames("message-scroller fling step, 3000 messages", samples)
})
