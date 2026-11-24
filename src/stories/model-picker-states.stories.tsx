import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fn, screen, userEvent, waitFor } from "storybook/test"

import { ModelPicker, type ModelGroup } from "@/components/model-picker"

const groups: ModelGroup[] = [
  {
    id: "anthropic",
    label: "Anthropic",
    models: [
      { id: "opus-5.5", label: "Opus 5.5", detail: "1M · $15" },
      { id: "sonnet-5.5", label: "Sonnet 5.5", detail: "1M · $3" },
      {
        id: "haiku-5.5",
        label: "Haiku 5.5",
        disabledReason: "Not in this connection's plan",
      },
    ],
  },
]

function Demo({
  value = "opus-5.5",
  valueLabel,
  groups: shown = groups,
  loading,
  error,
  source,
  defaultPinned = false,
  failFirstSave = false,
  onValueChange,
  onRetry,
}: {
  value?: string | null
  valueLabel?: string
  groups?: ModelGroup[]
  loading?: boolean
  error?: string
  source?: string
  defaultPinned?: boolean
  /** Whether the first pin or unpin fails. */
  failFirstSave?: boolean
  onValueChange?: (id: string) => void
  onRetry?: () => void
}) {
  const [pinned, setPinned] = React.useState(defaultPinned)
  const failed = React.useRef(false)
  return (
    <ModelPicker
      groups={shown}
      value={value}
      valueLabel={valueLabel}
      onValueChange={onValueChange ?? (() => {})}
      loading={loading}
      error={error}
      onRetry={onRetry}
      searchFrom={0}
      {...(source !== undefined && {
        source,
        pinned,
        onPinnedChange: (next: boolean) =>
          new Promise<void>((resolve, reject) =>
            setTimeout(() => {
              if (failFirstSave && !failed.current) {
                failed.current = true
                return reject(new Error("The settings could not be saved"))
              }
              setPinned(next)
              resolve()
            }, 300)
          ),
      })}
    />
  )
}

const meta = {
  title: "Components/Model Picker States",
  component: Demo,
  parameters: { layout: "centered" },
  args: { onValueChange: fn(), onRetry: fn() },
} satisfies Meta<typeof Demo>

export default meta
type Story = StoryObj<typeof meta>

async function open(name: string) {
  await userEvent.click(screen.getByRole("button", { name }))
  return screen.findByRole("dialog")
}

/**
 * A model that cannot be used now says why at its row's end, in its
 * name too; it cannot be chosen.
 */
export const DisabledReason: Story = {
  play: async () => {
    await open("Model: Opus 5.5")
    const haiku = await screen.findByRole("option", { name: /^Haiku 5\.5/ })
    await expect(haiku).toHaveAccessibleName(/Not in this connection's plan/)
    await expect(haiku).toHaveAttribute("aria-disabled", "true")
    await expect(
      haiku.querySelector("[data-slot=model-picker-detail]")
    ).toHaveTextContent("Not in this connection's plan")
  },
}

/**
 * The chosen model gone from the list: the trigger keeps its name,
 * marked not available, and the list says it stays until another is
 * picked; nothing is chosen in its place.
 */
export const ValueGone: Story = {
  args: { value: "opus-4", valueLabel: "Opus 4" },
  play: async ({ args }) => {
    const dialog = await open("Model: Opus 4, not available")
    await expect(dialog).toHaveTextContent(
      "Opus 4 is not available now. It stays chosen until you pick another."
    )
    await userEvent.keyboard("{Escape}")
    await expect(args.onValueChange).not.toHaveBeenCalled()
  },
}

/** A model that cannot be used now, chosen: so too. */
export const ValueDisabled: Story = {
  args: { value: "haiku-5.5" },
  play: async () => {
    await expect(
      screen.getByRole("button", { name: "Model: Haiku 5.5, not available" })
    ).toBeVisible()
  },
}

/**
 * Where the chosen model comes from, and Pin to keep it: saving while
 * the app saves, and if that fails, said, the button there to try again.
 */
export const SourceAndPin: Story = {
  args: { source: "The project's default", failFirstSave: true },
  play: async () => {
    await open("Model: Opus 5.5")
    const row = document.querySelector("[data-slot=model-picker-source]")!
    await expect(row).toHaveTextContent("The project's default")
    await userEvent.click(screen.getByRole("button", { name: "Pin" }))
    await expect(await screen.findByText("Saving…")).toBeVisible()
    await expect(await screen.findByText("Couldn't save")).toBeVisible()
    await userEvent.click(screen.getByRole("button", { name: "Pin" }))
    await expect(
      await screen.findByRole("button", { name: "Unpin" })
    ).toBeVisible()
    await expect(screen.queryByText("Couldn't save")).toBeNull()
  },
}

/** No models at all: "No models yet", not a search's "No models found". */
export const NoModels: Story = {
  args: {
    groups: [{ id: "anthropic", label: "Anthropic", models: [] }],
    valueLabel: "Opus 5.5",
  },
  play: async () => {
    await open("Model: Opus 5.5, not available")
    const none = await screen.findByText("No models yet")
    // Once the popup has faded in.
    await waitFor(() => expect(none).toBeVisible())
  },
}

/** A search with no match: "No models found". */
export const NoMatch: Story = {
  play: async () => {
    await open("Model: Opus 5.5")
    await userEvent.keyboard("zzz")
    const none = await screen.findByText("No models found")
    // Once the popup has faded in.
    await waitFor(() => expect(none).toBeVisible())
    // cmdk leaves its list without options meanwhile, which axe reports:
    // end with results.
    await userEvent.keyboard("{Backspace}{Backspace}{Backspace}")
    await expect(
      await screen.findByRole("option", { name: /^Sonnet/ })
    ).toBeVisible()
  },
}

/** Fetching failed: a row says why, with Retry; what it has stays. */
export const FetchFailed: Story = {
  args: { error: "Couldn't fetch the models" },
  play: async ({ args }) => {
    await open("Model: Opus 5.5")
    const alert = await screen.findByRole("alert")
    await expect(alert).toHaveTextContent("Couldn't fetch the models")
    await userEvent.click(screen.getByRole("button", { name: "Retry" }))
    await expect(args.onRetry).toHaveBeenCalledOnce()
    await waitFor(() =>
      expect(screen.getByRole("option", { name: /^Sonnet 5\.5/ })).toBeVisible()
    )
  },
}

/** Still fetching, the chosen model not listed yet: not called gone. */
export const LoadingValue: Story = {
  args: { groups: [], loading: true, valueLabel: "Opus 5.5" },
  play: async () => {
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /^Model: / })
      ).toHaveAccessibleName("Model: Opus 5.5")
    )
  },
}
