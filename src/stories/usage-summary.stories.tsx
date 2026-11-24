import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, screen, userEvent, waitFor } from "storybook/test"

import { AgentTurnFooter, AgentTurnInfo } from "@/components/agent-turn-footer"
import {
  UsageSummary,
  UsageSummaryRows,
  type UsageAmount,
  type UsageSummaryRow,
} from "@/components/usage-summary"

const totals: UsageAmount[] = [
  { value: "$1.16", unit: "USD", completeness: "estimated" },
  { value: "320 credits", unit: "credits", completeness: "unreconciled" },
]

const rows: UsageSummaryRow[] = [
  {
    label: "Input tokens",
    value: "$0.84",
    unit: "USD",
    completeness: "estimated",
    source: "Our price list, at $15 a million",
    reason: "The provider has not reported cached input yet.",
  },
  {
    label: "Output tokens",
    value: "$0.32",
    unit: "USD",
    completeness: "complete",
    source: "The provider's report",
  },
  {
    label: "Image generation",
    value: "320 credits",
    unit: "credits",
    completeness: "unreconciled",
    source: "The provider's report",
    reason: "Not matched with the month's bill yet.",
  },
  {
    label: "Code execution",
    value: null,
    unit: "USD",
    completeness: "unknown",
    reason: "The sandbox does not report its time.",
  },
  {
    label: "Web search",
    value: "14 searches",
    unit: "searches",
    completeness: "unpriced",
  },
]

const meta = {
  title: "Components/Usage Summary",
  component: UsageSummary,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="w-120 max-w-full">
        <Story />
      </div>
    ),
  ],
  args: { totals },
} satisfies Meta<typeof UsageSummary>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Its totals, one a unit, never added across units, each saying how far
 * it is to be trusted; opened, the breakdown and what has no price.
 */
export const Default: Story = {
  render: (args) => (
    <UsageSummary {...args} missing={["Web search"]}>
      <UsageSummaryRows rows={rows} />
    </UsageSummary>
  ),
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: /^Usage/ })
    await expect(trigger).toHaveTextContent(
      "Usage≈ $1.16Estimated320 creditsNot reconciled"
    )
    await expect(trigger).toHaveAttribute("aria-expanded", "false")
    await userEvent.click(trigger)
    await expect(trigger).toHaveAttribute("aria-expanded", "true")
    // Not known is said, never 0.
    const execution = canvas
      .getByText("Code execution")
      .closest("[data-slot=usage-summary-row]")!
    await expect(execution).toHaveTextContent("Unknown")
    await expect(execution).not.toHaveTextContent(/\$0/)
    await expect(canvas.getByText("No price")).toBeVisible()
    await expect(
      canvas.getByText("No price for", { exact: false })
    ).toHaveTextContent("No price for Web search")
    // A row's source and reason, by its button, by touch too.
    await userEvent.click(
      canvas.getByRole("button", { name: "About Input tokens" })
    )
    const about = await screen.findByText("Our price list, at $15 a million")
    await waitFor(() => expect(about).toBeVisible())
    await expect(
      screen.getByText("The provider has not reported cached input yet.")
    ).toBeVisible()
    await userEvent.keyboard("{Escape}")
  },
}

/** While the run goes on: its totals so far, partial. */
export const Running: Story = {
  args: {
    running: true,
    totals: [{ value: "$0.42", unit: "USD", completeness: "partial" }],
  },
  render: (args) => (
    <UsageSummary {...args}>
      <UsageSummaryRows rows={rows.slice(0, 2)} />
    </UsageSummary>
  ),
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("button", { name: /^So far/ })
    ).toHaveTextContent("So far$0.42Partial")
  },
}

/** A total not known: "Unknown", not 0. No breakdown: not a button to open. */
export const Unknown: Story = {
  args: { totals: [{ value: null, unit: "USD", completeness: "unknown" }] },
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: /^Usage/ })
    await expect(trigger).toHaveTextContent("UsageUnknown")
    await expect(trigger).toBeDisabled()
    await expect(trigger).not.toHaveAttribute("aria-expanded")
  },
}

/** No usage yet. */
export const Empty: Story = {
  args: { totals: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button")).toHaveTextContent("No usage yet")
  },
}

/** Its rows in a turn's details, as its numbers are. */
export const InATurnsDetails: Story = {
  decorators: [
    (Story) => (
      <div className="flex h-80 items-end">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <AgentTurnFooter>
      <AgentTurnInfo
        details={<UsageSummaryRows rows={rows} className="px-2 py-1" />}
      >
        <span>Opus 5.5</span>
        <span>48s</span>
        <span>12:04</span>
      </AgentTurnInfo>
    </AgentTurnFooter>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(
      canvasElement.querySelector("[data-slot=agent-turn-info-trigger]")!
    )
    const image = await screen.findByText("Image generation")
    await waitFor(() => expect(image).toBeVisible())
    await expect(screen.getByText("Not reconciled")).toBeVisible()
  },
}
