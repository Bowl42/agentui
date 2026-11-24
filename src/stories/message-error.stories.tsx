import type { Meta, StoryObj } from "@storybook/react-vite"
import * as React from "react"
import { expect, fn, userEvent, waitFor } from "storybook/test"

import { MessageError } from "@/components/message-error"
import { Button } from "@/components/ui/button"

const onRetry = fn()
const onContinue = fn()

const meta = {
  title: "Components/Message Error",
  component: MessageError,
  parameters: { layout: "padded" },
  beforeEach: () => {
    onRetry.mockClear()
    onContinue.mockClear()
  },
  decorators: [
    (Story) => (
      <div className="flex w-165 max-w-full flex-col gap-3">
        <Story />
      </div>
    ),
  ],
  args: { title: "" },
} satisfies Meta<typeof MessageError>

export default meta
type Story = StoryObj<typeof meta>

/** Rate limited, the next try `seconds` from when it is shown. */
function RateLimited({
  seconds,
  attempt,
}: {
  seconds: number
  attempt: number
}) {
  const [at] = React.useState(() => Date.now() + seconds * 1000)
  return (
    <MessageError
      title="Rate limited by the provider"
      retry={{ at, attempt, attempts: 5 }}
      onRetry={onRetry}
    />
  )
}

/**
 * A turn that failed: its reason, then, while the app waits to try
 * again, a countdown to it and which attempt that is, "Retry now" at its
 * end; or what it means, with the app's own action ("Continue").
 */
export const Default: Story = {
  render: () => (
    <>
      <RateLimited seconds={8} attempt={2} />
      <MessageError
        title="The connection dropped"
        description="The answer above is incomplete. Nothing was lost from the steps."
        action={
          <Button variant="outline" size="sm" onClick={onContinue}>
            Continue
          </Button>
        }
      />
    </>
  ),
  play: async ({ canvas }) => {
    const [limited, dropped] = canvas.getAllByRole("alert")
    await expect(limited).toHaveTextContent(/Retrying in [78]s/)
    await expect(limited).toHaveTextContent("attempt 2 of 5")
    await userEvent.click(canvas.getByRole("button", { name: "Retry now" }))
    await expect(onRetry).toHaveBeenCalledOnce()
    await expect(dropped).toHaveTextContent("The answer above is incomplete.")
    const proceed = canvas.getByRole("button", { name: "Continue" })
    // The button level with the title, not centred on the card.
    const title = dropped!.querySelector("[data-slot=message-error-title]")!
    await expect(
      Math.abs(
        proceed.getBoundingClientRect().top - title.getBoundingClientRect().top
      )
    ).toBeLessThan(1)
    await userEvent.click(proceed)
    await expect(onContinue).toHaveBeenCalledOnce()
  },
}

/**
 * The wait over, it says it is retrying until the app has an answer or
 * another error to show.
 */
export const Retrying: Story = {
  render: () => <RateLimited seconds={1.2} attempt={3} />,
  play: async ({ canvas }) => {
    const alert = canvas.getByRole("alert")
    await expect(alert).toHaveTextContent(/Retrying in [12]s/)
    await waitFor(() => expect(alert).not.toHaveTextContent(/Retrying in/), {
      timeout: 3000,
    })
    await expect(alert).toHaveTextContent("Retrying…")
    await expect(alert).toHaveTextContent("attempt 3 of 5")
  },
}

/**
 * Each status by its mark and words, not a colour: waiting, retrying,
 * given up after its attempts, failed, cancelled, and unknown (no answer
 * came: it may have gone through), with the app's two actions.
 */
export const Statuses: Story = {
  render: () => (
    <>
      <RateLimited seconds={30} attempt={2} />
      <MessageError
        status="retrying"
        title="Rate limited by the provider"
        retry={{ attempt: 3, attempts: 5 }}
      />
      <MessageError
        status="exhausted"
        title="Rate limited by the provider"
        description="Try again later, or pick another model."
        retry={{ attempts: 5 }}
        onRetry={onRetry}
      />
      <MessageError
        title="The model is not available"
        description="It was removed from this connection."
      />
      <MessageError status="cancelled" title="Stopped before an answer" />
      <MessageError
        status="unknown"
        title="The request timed out"
        action={
          <>
            <Button variant="outline" size="sm" onClick={onContinue}>
              Check status
            </Button>
            <Button variant="outline" size="sm" onClick={onRetry}>
              Send again
            </Button>
          </>
        }
      />
    </>
  ),
  play: async ({ canvas }) => {
    const cards = canvas.getAllByRole("alert")
    await expect(cards.map((card) => card.dataset.status)).toEqual([
      "waiting",
      "retrying",
      "exhausted",
      "failed",
      "cancelled",
      "unknown",
    ])
    await expect(cards[1]).toHaveTextContent("Retrying… · attempt 3 of 5")
    await expect(cards[2]).toHaveTextContent("Gave up after 5 attempts")
    await expect(cards[2]).toHaveTextContent("Try again later")
    await expect(cards[4]).toHaveTextContent("Cancelled")
    await expect(cards[5]).toHaveTextContent("it may have gone through")
    // Each told by its own mark: the retrying one's a spinner.
    await expect(
      cards[1]!.querySelector("[data-slot=spinner]")
    ).toBeInTheDocument()
    const marks = cards
      .filter((card) => card.dataset.status !== "retrying")
      .map((card) => card.querySelector("svg")!.innerHTML)
    await expect(new Set(marks).size).toBe(4)
    // Only a press acts.
    await userEvent.click(canvas.getByRole("button", { name: "Send again" }))
    await expect(onRetry).toHaveBeenCalledOnce()
  },
}

/** At the countdown's end it says it retries; it calls nothing itself. */
export const NothingOnItsOwn: Story = {
  tags: ["!autodocs"],
  render: () => <RateLimited seconds={1} attempt={2} />,
  play: async ({ canvas }) => {
    const alert = canvas.getByRole("alert")
    await waitFor(() => expect(alert.dataset.status).toBe("retrying"), {
      timeout: 3000,
    })
    await expect(onRetry).not.toHaveBeenCalled()
  },
}

/** Narrow, its actions a line of their own under its words. */
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <MessageError
      status="unknown"
      title="The request timed out"
      action={
        <>
          <Button variant="outline" size="sm">
            Check status
          </Button>
          <Button variant="outline" size="sm">
            Send again
          </Button>
        </>
      }
    />
  ),
  play: async ({ canvas }) => {
    const words = canvas
      .getByRole("alert")
      .querySelector("[data-slot=message-error-description]")!
    const check = canvas.getByRole("button", { name: "Check status" })
    await expect(check.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      words.getBoundingClientRect().bottom
    )
    // Where its words start.
    await expect(
      Math.round(
        check.getBoundingClientRect().left - words.getBoundingClientRect().left
      )
    ).toBe(0)
  },
}
