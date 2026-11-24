import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, screen, userEvent, waitFor } from "storybook/test"

import { ComposerMessage } from "@/components/composer"
import { Markdown } from "@/components/markdown"
import { UserMessage, UserMessageText } from "@/components/user-message"

/** 256 KiB without a space, of a kind. */
const runs = {
  // One letter: kerned in the system font, Chromium's layout of it is
  // quadratic.
  letter: "x".repeat(256 * 1024),
  // Base64: WebKit's layout grows with it.
  base64: Array.from(
    { length: 256 * 1024 },
    (_, index) =>
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"[
        (index * 2654435761) % 64
      ]
  ).join(""),
}

/**
 * How long the text takes to lay out again, in ms, at a width 2px less:
 * the worst of three.
 */
function relayout(element: HTMLElement) {
  let worst = 0
  for (const width of [750, 748, 752]) {
    element.style.width = `${width}px`
    const start = performance.now()
    void element.offsetHeight
    worst = Math.max(worst, performance.now() - start)
  }
  element.style.width = ""
  return worst
}

/** A long address, its path base64. */
const address = `https://example.com/${runs.base64.slice(0, 64 * 1024).replace(/[+/]/g, "-")}`

/** Layout bounded: well under a frame's budget of 50ms, with room for CI. */
const bound = 50

const meta = {
  title: "Components/Long Text",
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="w-188">
        <Story />
      </div>
    ),
  ],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/**
 * An answer with 256 KiB of one letter in it: its first 512 characters,
 * then an ellipsis, a button for more and one to copy it whole. Laid
 * out again in a few ms.
 */
export const InAnAnswer: Story = {
  render: () => (
    <Markdown>{`The token it printed:\n\n${runs.letter}\n\nand nothing after it.`}</Markdown>
  ),
  play: async ({ canvasElement }) => {
    const more = await screen.findByRole("button", {
      name: "Show 261,632 more characters",
    })
    await expect(more).toBeVisible()
    await expect(screen.getByRole("button", { name: "Copy all" })).toBeVisible()
    const answer = canvasElement.querySelector<HTMLElement>(
      "[data-slot=markdown]"
    )!
    const took = relayout(answer)
    console.log(`long text: answer, one letter: ${took.toFixed(1)}ms`)
    await expect(took).toBeLessThan(bound)
    // More, 16,384 at a time.
    await userEvent.click(more)
    await expect(
      await screen.findByRole("button", {
        name: "Show 245,248 more characters",
      })
    ).toBeVisible()
  },
}

/** Base64 in an answer, inline code and a paragraph: each folded. */
export const Base64: Story = {
  render: () => (
    <Markdown>{`An image as data: \`${runs.base64}\`.\n\nAnd again: ${runs.base64}`}</Markdown>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: /^Show [\d,]+ more characters$/ })
      ).toHaveLength(2)
    )
    const took = relayout(
      canvasElement.querySelector<HTMLElement>("[data-slot=markdown]")!
    )
    console.log(`long text: answer, base64: ${took.toFixed(1)}ms`)
    await expect(took).toBeLessThan(bound)
  },
}

/**
 * A long address as a link: only its start, no buttons in the link (the
 * link has it whole).
 */
export const InALink: Story = {
  render: () => <Markdown>{`See [${address}](${address}) for it.`}</Markdown>,
  play: async ({ canvasElement }) => {
    // Streamdown's link, a button that asks before it opens.
    const link = await waitFor(() => {
      const found = canvasElement.querySelector("[data-streamdown=link]")
      expect(found).not.toBeNull()
      return found!
    })
    await expect(link.textContent!.length).toBeLessThan(600)
    await expect(
      screen.queryByRole("button", { name: /more characters/ })
    ).toBe(null)
    const took = relayout(
      canvasElement.querySelector<HTMLElement>("[data-slot=markdown]")!
    )
    console.log(`long text: answer, link: ${took.toFixed(1)}ms`)
    await expect(took).toBeLessThan(bound)
  },
}

/** Text with spaces, however long, is as it was: nothing folds. */
export const Words: Story = {
  render: () => (
    <Markdown>
      {"A sentence of ordinary words that goes on. ".repeat(200)}
    </Markdown>
  ),
  play: async () => {
    await expect(
      screen.queryByRole("button", { name: /more characters/ })
    ).toBe(null)
  },
}

/** A sent message with a pasted run: folded the same (`LongText`). */
export const InASentMessage: Story = {
  render: () => (
    <UserMessage>
      <UserMessageText>
        <ComposerMessage
          value={[`Why does this fail to decode? ${runs.base64}`]}
        />
      </UserMessageText>
    </UserMessage>
  ),
  play: async ({ canvasElement }) => {
    await expect(
      await screen.findByRole("button", { name: /^Show [\d,]+ more/ })
    ).toBeInTheDocument()
    const took = relayout(
      canvasElement.querySelector<HTMLElement>("[data-slot=composer-message]")!
    )
    console.log(`long text: sent message, base64: ${took.toFixed(1)}ms`)
    await expect(took).toBeLessThan(bound)
  },
}

/**
 * Streamed: the run grows a chunk at a time, folded once past 1,024
 * characters, each layout bounded as it grows.
 */
export const Streamed: Story = {
  render: function Render() {
    const [length, setLength] = React.useState(0)
    React.useEffect(() => {
      if (length >= 128 * 1024) return
      const timer = setTimeout(() => setLength((was) => was + 8192), 16)
      return () => clearTimeout(timer)
    }, [length])
    return (
      <Markdown isAnimating={length < 128 * 1024}>
        {`Hash: ${runs.letter.slice(0, length)}`}
      </Markdown>
    )
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () =>
        expect(
          screen.getByRole("button", { name: /^Show [\d,]+ more/ })
        ).toHaveAccessibleName("Show 130,560 more characters"),
      { timeout: 10_000 }
    )
    const took = relayout(
      canvasElement.querySelector<HTMLElement>("[data-slot=markdown]")!
    )
    await expect(took).toBeLessThan(bound)
  },
}
