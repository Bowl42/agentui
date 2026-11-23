import * as React from "react"

import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Message, MessageContent } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"

// A conversation whose earlier messages arrive as the reader scrolls up:
// the first wheel step up asks for them, and 43 come `delay` ms later,
// among the steps that follow, as a page of older ones arrives.

const messages = Array.from({ length: 73 }, (_, index) => ({
  id: `message-${index}`,
  user: index % 2 === 0,
  text:
    index % 2 === 0
      ? `Question ${index}`
      : Array.from(
          { length: 3 },
          (_, paragraph) =>
            `Answer ${index}, paragraph ${paragraph + 1}. ` +
            "The run read the logs and found the change that broke it. ".repeat(
              3
            )
        ).join("\n\n"),
}))

/** How many there are before the earlier ones come. */
const first = 30

export function PrependWhileScrolling({ delay = 30 }: { delay?: number }) {
  const [from, setFrom] = React.useState(messages.length - first)
  const asked = React.useRef(false)
  return (
    <div className="flex h-120 w-md max-w-full flex-col overflow-hidden rounded-xl border">
      <MessageScrollerProvider>
        <MessageScroller>
          <MessageScrollerViewport
            aria-label="Conversation"
            onWheel={(event) => {
              if (event.deltaY >= 0 || asked.current) return
              asked.current = true
              setTimeout(() => setFrom(0), delay)
            }}
          >
            <MessageScrollerContent className="p-4">
              {messages.slice(from).map((message) => (
                <MessageScrollerItem key={message.id} messageId={message.id}>
                  <Message align={message.user ? "end" : "start"}>
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
