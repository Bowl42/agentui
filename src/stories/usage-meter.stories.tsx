import type { Meta, StoryObj } from "@storybook/react-vite"
import * as React from "react"
import { expect, fn, userEvent, waitFor, within } from "storybook/test"

import {
  UsageMeter,
  UsageMeterBreakdown,
  UsageMeterList,
} from "@/components/usage-meter"
import { Composer, ComposerEditor } from "@/components/composer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FullToolbar, planLimits } from "@/stories/composer-tools"

const meta = {
  title: "Components/Usage Meter",
  component: UsageMeter,
  parameters: { layout: "centered" },
  args: { value: 62, label: "Used" },
} satisfies Meta<typeof UsageMeter>

export default meta
type Story = StoryObj<typeof meta>

/** A ring and a bar, each a meter: its name and value said, the app's words after it. */
export const Meter: Story = {
  render: () => (
    <div className="flex items-center gap-6 text-sm">
      <UsageMeter value={31} label="Session" valueText="31% used">
        31%
      </UsageMeter>
      <UsageMeter
        value={82}
        max={100}
        variant="bar"
        label="Requests today"
        valueText="82 of 100"
      >
        82/100
      </UsageMeter>
      <UsageMeter value={0} label="Storage" valueText="Empty" />
    </div>
  ),
  play: async ({ canvas }) => {
    const ring = canvas.getByRole("meter", { name: "Session" })
    await expect(ring).toHaveAttribute("aria-valuenow", "31")
    await expect(ring).toHaveAttribute("aria-valuetext", "31% used")
    const bar = canvas.getByRole("meter", { name: "Requests today" })
    await expect(bar).toHaveAttribute("aria-valuemax", "100")
    // The bar is filled as far as the value.
    const graphic = bar.querySelector<HTMLElement>(
      "[data-slot=usage-meter-graphic]"
    )!
    const fill = graphic.firstElementChild!.getBoundingClientRect().width
    await expect(
      Math.abs(fill / graphic.getBoundingClientRect().width - 0.82)
    ).toBeLessThan(0.02)
  },
}

/**
 * Near a limit and at it: the ring's and the bar's fill in the theme's
 * warning or destructive colour (`tone`), the track as it was; the
 * breakdown's bar too.
 */
export const Tones: Story = {
  render: () => (
    <div className="flex items-center gap-6 text-sm">
      <UsageMeter value={50} label="Plain" />
      <UsageMeter
        value={85}
        tone="warning"
        label="Near"
        valueText="85%, near the limit"
      />
      <UsageMeter
        value={100}
        tone="destructive"
        label="Reached"
        valueText="Limit reached"
      />
      <UsageMeter value={85} variant="bar" tone="warning" label="Near bar" />
      <UsageMeterBreakdown
        value={85}
        tone="warning"
        label="Context"
        valueText="85%"
        rows={[{ label: "Messages", value: "170k" }]}
      />
    </div>
  ),
  play: async ({ canvas }) => {
    // A colour of the theme's, by its variable.
    const theme = (name: string) => {
      const probe = document.createElement("span")
      probe.style.color = `var(--${name})`
      document.body.append(probe)
      const color = getComputedStyle(probe).color
      probe.remove()
      return color
    }
    const fillOf = (name: string) => {
      const graphic = canvas
        .getByRole("meter", { name })
        .querySelector<Element>("[data-slot=usage-meter-graphic]")!
      const fill = graphic.lastElementChild!
      return graphic.tagName === "svg"
        ? getComputedStyle(fill).stroke
        : getComputedStyle(fill).backgroundColor
    }
    await expect(fillOf("Plain")).toBe(theme("foreground"))
    await expect(fillOf("Near")).toBe(theme("warning"))
    await expect(fillOf("Reached")).toBe(theme("destructive"))
    await expect(fillOf("Near bar")).toBe(theme("warning"))
    await userEvent.click(canvas.getByRole("button", { name: "Context: 85%" }))
    const popup = within(document.body).getByRole("meter", { name: "Context" })
    const bar = popup.querySelector("[data-slot=usage-meter-graphic]")!
    await waitFor(() =>
      expect(getComputedStyle(bar.lastElementChild!).backgroundColor).toBe(
        theme("warning")
      )
    )
    await userEvent.keyboard("{Escape}")
  },
}

const rows = [
  { label: "Instructions", value: "3.1k", amount: 3_100 },
  { label: "Messages", value: "41.2k", amount: 41_200 },
  { label: "Tool results", value: "14.6k", amount: 14_600 },
  { label: "Files", value: "3.1k", amount: 3_100 },
  { label: "Free", value: "138k" },
]

/**
 * A ring that opens its breakdown: the title and value, a bar of the
 * whole in parts (a grey each, as the rows are
 * categories), and the app's rows. Every word is the app's.
 */
export const Breakdown: Story = {
  render: () => (
    <UsageMeterBreakdown
      value={62_000}
      max={200_000}
      label="Tokens"
      valueText="62k of 200k"
      rows={rows}
      footer="Older messages are summarised near the limit."
    >
      31%
    </UsageMeterBreakdown>
  ),
  play: async ({ canvas, canvasElement }) => {
    const button = canvas.getByRole("button", { name: "Tokens: 31%" })
    await userEvent.click(button)
    const popover = await waitFor(() => {
      const element = canvasElement.ownerDocument.querySelector<HTMLElement>(
        "[data-slot=popover-content][data-open]"
      )
      expect(element).toBeTruthy()
      return element!
    })
    const body = within(popover)
    await expect(body.getByRole("meter", { name: "Tokens" })).toHaveAttribute(
      "aria-valuetext",
      "62k of 200k"
    )
    const terms = body.getAllByRole("term").map((term) => term.textContent)
    await expect(terms).toEqual([
      "Instructions",
      "Messages",
      "Tool results",
      "Files",
      "Free",
    ])
    await expect(
      body.getAllByRole("definition").map((value) => value.textContent)
    ).toEqual(["3.1k", "41.2k", "14.6k", "3.1k", "138k"])
    // Four parts, one a row with an amount.
    await expect(
      popover.querySelectorAll("[data-variant=parts] > span")
    ).toHaveLength(4)
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(button).toHaveFocus())
  },
}

/**
 * More rows than the room it has: no higher or wider than that (here the
 * app asks for the screen's width), its rows scrolled to, its title and
 * footer kept.
 */
export const BreakdownCrowded: Story = {
  render: () => (
    <UsageMeterBreakdown
      value={62_000}
      max={200_000}
      label="Tokens"
      valueText="62k of 200k"
      rows={Array.from({ length: 60 }, (_, index) => ({
        label: `Tool result ${index + 1}`,
        value: "1.2k",
      }))}
      footer="Older messages are summarised near the limit."
      contentClassName="w-screen"
    >
      31%
    </UsageMeterBreakdown>
  ),
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Tokens: 31%" }))
    const popover = await waitFor(() => {
      const element = canvasElement.ownerDocument.querySelector<HTMLElement>(
        "[data-slot=popover-content][data-open]"
      )
      expect(element).toBeTruthy()
      return element!
    })
    await waitFor(() => expect(document.getAnimations()).toHaveLength(0))
    const box = popover.getBoundingClientRect()
    await expect(box.top).toBeGreaterThanOrEqual(0)
    await expect(box.bottom).toBeLessThanOrEqual(window.innerHeight)
    await expect(box.left).toBeGreaterThanOrEqual(0)
    await expect(box.right).toBeLessThanOrEqual(window.innerWidth)
    const list = popover.querySelector<HTMLElement>(
      "[data-slot=usage-meter-rows]"
    )!
    await expect(list.scrollHeight).toBeGreaterThan(list.clientHeight)
    await expect(list.scrollWidth).toBe(list.clientWidth)
    await expect(within(popover).getByText(/^Older messages/)).toBeVisible()
    await userEvent.keyboard("{Escape}")
  },
}

function Compacting() {
  const [open, setOpen] = React.useState(false)
  const [compacted, setCompacted] = React.useState(false)
  return (
    <UsageMeterBreakdown
      value={compacted ? 12_000 : 62_000}
      max={200_000}
      label="Tokens"
      valueText={compacted ? "12k of 200k" : "62k of 200k"}
      rows={rows}
      open={open}
      onOpenChange={setOpen}
      footer={
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => {
            setCompacted(true)
            setOpen(false)
          }}
        >
          Compact
        </Button>
      }
    />
  )
}

/**
 * Open as the app says: its footer's button compacts, and closes the
 * popover.
 */
export const BreakdownControlled: Story = {
  render: () => <Compacting />,
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Tokens: 62k of 200k" })
    )
    const popover = await waitFor(() => {
      const element = canvasElement.ownerDocument.querySelector<HTMLElement>(
        "[data-slot=popover-content][data-open]"
      )
      expect(element).toBeTruthy()
      return element!
    })
    await userEvent.click(
      within(popover).getByRole("button", { name: "Compact" })
    )
    await waitFor(() =>
      expect(
        canvasElement.ownerDocument.querySelector("[data-slot=popover-content]")
      ).toBeNull()
    )
    await expect(
      canvas.getByRole("button", { name: "Tokens: 12k of 200k" })
    ).toBeVisible()
  },
}

function Acting({ onCompact }: { onCompact: () => void }) {
  const [auto, setAuto] = React.useState(true)
  return (
    <UsageMeterBreakdown
      value={62_000}
      max={200_000}
      label="Tokens"
      valueText="62k of 200k"
      rows={rows}
      actions={[
        {
          key: "auto",
          label: "Compact automatically",
          checked: auto,
          onCheckedChange: setAuto,
        },
        {
          key: "compact",
          label: "Compact older messages",
          shortcut: "/compact",
          onClick: onCompact,
        },
        { key: "retry", label: "Retry", disabled: true },
      ]}
      footer="Older messages are summarised near the limit."
    >
      31%
    </UsageMeterBreakdown>
  )
}

const compact = fn()

/**
 * Rows to act on under the breakdown's, a line above them: a switch the
 * whole row toggles, a button with its command at its end. Rows of a
 * menu's height, their text where the breakdown's is.
 */
export const BreakdownActions: Story = {
  render: () => <Acting onCompact={compact} />,
  play: async ({ canvas, canvasElement }) => {
    compact.mockClear()
    await userEvent.click(canvas.getByRole("button", { name: "Tokens: 31%" }))
    const popover = await waitFor(() => {
      const element = canvasElement.ownerDocument.querySelector<HTMLElement>(
        "[data-slot=popover-content][data-open]"
      )
      expect(element).toBeTruthy()
      return element!
    })
    await waitFor(() => expect(document.getAnimations()).toHaveLength(0))
    const body = within(popover)
    const auto = body.getByRole("switch", { name: "Compact automatically" })
    await expect(auto).toBeChecked()
    // The row's words toggle it too.
    await userEvent.click(body.getByText("Compact automatically"))
    await expect(auto).not.toBeChecked()
    const button = body.getByRole("button", {
      name: "Compact older messages /compact",
    })
    await userEvent.click(button)
    await expect(compact).toHaveBeenCalledOnce()
    await expect(body.getByRole("button", { name: "Retry" })).toBeDisabled()
    // 32px rows, their text where the breakdown's starts.
    await expect(button.getBoundingClientRect().height).toBe(32)
    const textLeft = (element: Element) => {
      const range = document.createRange()
      range.selectNodeContents(element)
      return range.getBoundingClientRect().left
    }
    await expect(
      Math.abs(
        textLeft(button.firstElementChild!) -
          textLeft(body.getAllByRole("term")[0]!)
      )
    ).toBeLessThanOrEqual(1)
    // A line above them, from edge to edge of the popover.
    const actions = popover.querySelector("[data-slot=usage-meter-actions]")!
    await expect(
      parseFloat(getComputedStyle(actions).borderTopWidth)
    ).toBeGreaterThan(0)
    await expect(actions.getBoundingClientRect().width).toBe(
      popover.clientWidth
    )
    await userEvent.keyboard("{Escape}")
  },
}

/**
 * Rows without amounts: the bar is the whole, in the foreground, and the
 * rows only words. A bar in the button.
 */
export const BreakdownPlain: Story = {
  render: () => (
    <UsageMeterBreakdown
      value={82}
      variant="bar"
      label="Requests today"
      valueText="82 of 100"
      side="bottom"
      align="center"
      rows={[
        { label: "Resets", value: "in 4 h" },
        { label: "Plan", value: "100 a day" },
      ]}
    >
      82/100
    </UsageMeterBreakdown>
  ),
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Requests today: 82/100" })
    )
    await waitFor(() =>
      expect(
        canvasElement.ownerDocument.querySelector(
          "[data-slot=popover-content][data-open] [data-variant=bar]"
        )
      ).toBeTruthy()
    )
  },
}

/** A quota chip: a `Badge` with the meter in it, its words after. */
export const QuotaChip: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Badge variant="outline">
        <UsageMeter
          value={82}
          variant="bar"
          label="Requests today"
          valueText="82 of 100"
        >
          82/100
        </UsageMeter>
      </Badge>
      <Badge variant="secondary">
        <UsageMeter value={45} label="Storage" valueText="4.5 of 10 GB">
          4.5 GB
        </UsageMeter>
      </Badge>
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("meter", { name: "Requests today" })
    ).toHaveAttribute("aria-valuetext", "82 of 100")
  },
}

/**
 * Several meters at a glance, as in a popup of an account's limits: each
 * its label and value, a bar across, when it resets; each a meter.
 */
export const List: Story = {
  render: () => (
    <UsageMeterList
      className="w-72"
      meters={[
        {
          label: "Requests this hour",
          value: 82,
          valueText: "82 of 100",
          detail: "Resets in 24m",
          tone: "warning",
        },
        {
          label: "Tokens today",
          value: 31,
          valueText: "31%",
          detail: "Resets at midnight",
        },
        { label: "Storage", value: 2, max: 10, valueText: "2 of 10 GB" },
      ]}
    />
  ),
  play: async ({ canvas, canvasElement }) => {
    const meters = canvas.getAllByRole("meter")
    await expect(meters).toHaveLength(3)
    await expect(meters[0]).toHaveAccessibleName("Requests this hour")
    await expect(meters[0]).toHaveAttribute("aria-valuetext", "82 of 100")
    // Each bar across the list.
    for (const meter of meters)
      await expect(
        meter
          .querySelector("[data-slot=usage-meter-graphic]")!
          .getBoundingClientRect().width
      ).toBe(288)
    const items = canvasElement.querySelectorAll(
      "[data-slot=usage-meter-list-item]"
    )
    await expect(
      items[1]!.getBoundingClientRect().top -
        items[0]!.getBoundingClientRect().bottom
    ).toBe(12)
    await expect(canvas.getByText("Resets in 24m")).toBeVisible()
  },
}

// A ring's band, from its circle: its inner and outer radius, in px.
const bands = (graphic: Element) => {
  const scale = graphic.getBoundingClientRect().width / 16
  return [...graphic.querySelectorAll("[data-slot=usage-meter-ring]")].map(
    (ring) => {
      const circle = ring.firstElementChild!
      const r = Number(circle.getAttribute("r"))
      const width = Number(circle.getAttribute("stroke-width"))
      return {
        inner: (r - width / 2) * scale,
        outer: (r + width / 2) * scale,
        width: width * scale,
      }
    }
  )
}

/**
 * Several meters as concentric rings in a ring's 16px, outermost first,
 * each its own tone: a plan's weekly limit outside, its five hours'
 * inside. 1.5px strokes 1.5px apart. Two at most: a third is
 * neither drawn nor said. A group named by `label`, each ring a meter of its
 * own, its label and value said.
 */
export const Rings: Story = {
  render: () => (
    <div className="flex items-center gap-6 text-sm">
      <UsageMeter rings={planLimits} label="Plan limits">
        41% · 78%
      </UsageMeter>
      <UsageMeter
        rings={[
          {
            label: "Weekly",
            value: 96,
            valueText: "96% used",
            tone: "warning",
          },
          {
            label: "5 hours",
            value: 100,
            valueText: "Limit reached",
            tone: "destructive",
          },
        ]}
        label="At the limit"
      />
      <UsageMeter
        rings={[
          { label: "Weekly", value: 41, valueText: "41% used" },
          { label: "5 hours", value: 12, valueText: "12% used" },
          { label: "Hourly", value: 90, valueText: "90% used" },
        ]}
        label="Three limits"
      />
      <UsageMeter
        rings={[
          { label: "Weekly", value: 0, valueText: "Unused" },
          { label: "5 hours", value: 0, valueText: "Unused" },
        ]}
        label="Unused"
      />
    </div>
  ),
  play: async ({ canvas }) => {
    const plan = canvas.getByRole("group", { name: "Plan limits" })
    const meters = within(plan).getAllByRole("meter")
    await expect(
      meters.map((meter) => meter.getAttribute("aria-label"))
    ).toEqual(["Weekly", "5 hours"])
    await expect(meters[0]).toHaveAttribute("aria-valuenow", "41")
    await expect(meters[1]).toHaveAttribute("aria-valuetext", "78% used")
    // In a ring's place: 16px, two rings apart and thin.
    const graphic = plan.querySelector("[data-slot=usage-meter-graphic]")!
    await expect(graphic.getBoundingClientRect().width).toBe(16)
    const [outer, inner] = bands(graphic)
    await expect(outer!.outer).toBe(8)
    await expect(outer!.inner - inner!.outer).toBeGreaterThanOrEqual(1.5)
    await expect(outer!.width).toBeLessThanOrEqual(1.5)
    // Each ring its tone, the track as a ring's.
    const fills = [...graphic.querySelectorAll("[data-slot=usage-meter-ring]")]
    await expect(fills.map((ring) => ring.getAttribute("data-tone"))).toEqual([
      "default",
      "warning",
    ])
    // Filled as far as each value, round the ring.
    const dash = (index: number) => {
      const [length, whole] = fills[index]!.lastElementChild!.getAttribute(
        "stroke-dasharray"
      )!
        .split(" ")
        .map(Number)
      return length! / whole!
    }
    await expect(Math.abs(dash(0) - 0.41)).toBeLessThan(0.01)
    await expect(Math.abs(dash(1) - 0.78)).toBeLessThan(0.01)
    // Two at most: a third is neither drawn nor said.
    const three = canvas.getByRole("group", { name: "Three limits" })
    await expect(
      within(three)
        .getAllByRole("meter")
        .map((meter) => meter.getAttribute("aria-label"))
    ).toEqual(["Weekly", "5 hours"])
    await expect(
      bands(three.querySelector("[data-slot=usage-meter-graphic]")!)
    ).toHaveLength(2)
  },
}

/**
 * Rings that open their breakdown: the button says each ring's label and
 * value; the popover, a bar each, as a `UsageMeterList`, and the rows.
 */
export const RingsBreakdown: Story = {
  render: () => (
    <UsageMeterBreakdown
      rings={planLimits}
      label="Plan limits"
      rows={[{ label: "Plan", value: "Pro" }]}
    />
  ),
  play: async ({ canvas, canvasElement }) => {
    const button = canvas.getByRole("button", {
      name: "Plan limits: Weekly: 41% used, 5 hours: 78% used",
    })
    await userEvent.click(button)
    const popover = await waitFor(() => {
      const element = canvasElement.ownerDocument.querySelector<HTMLElement>(
        "[data-slot=popover-content][data-open]"
      )
      expect(element).toBeTruthy()
      return element!
    })
    const body = within(popover)
    await expect(body.getByRole("meter", { name: "Weekly" })).toHaveAttribute(
      "aria-valuetext",
      "41% used"
    )
    await expect(body.getByRole("meter", { name: "5 hours" })).toHaveAttribute(
      "aria-valuetext",
      "78% used"
    )
    await waitFor(() =>
      expect(body.getByText("Resets in 1h 12m")).toBeVisible()
    )
    await expect(body.getByRole("term")).toHaveTextContent("Plan")
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(button).toHaveFocus())
  },
}

/** In a composer's toolbar, at its size: two rings in the meter's 16px. */
export const RingsInComposer: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="mx-auto w-full max-w-3xl">
      <Composer>
        <ComposerEditor aria-label="Message" />
        <FullToolbar usage="rings" />
      </Composer>
    </div>
  ),
  play: async ({ canvas }) => {
    const button = canvas.getByRole("button", { name: /^Plan limits:/ })
    const graphic = button.querySelector("[data-slot=usage-meter-graphic]")!
    await expect(graphic).toHaveAttribute("data-rings", "2")
    await expect(graphic.getBoundingClientRect().height).toBe(16)
  },
}
