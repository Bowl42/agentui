import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fn, userEvent, waitFor, within } from "storybook/test"

import {
  ConnectionCredential,
  ConnectionDetails,
  ConnectionDetailsField,
  ConnectionDetailsHeader,
  ConnectionList,
  ConnectionListItem,
  ConnectionNotice,
  ConnectionStatus,
  ConnectionTarget,
  type ConnectionStatusValue,
} from "@/components/connection"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { onAPhone } from "@/stories/phone"

type Item = {
  id: string
  label: string
  enabled: boolean
  status: ConnectionStatusValue
  checkedAt?: string
  stale?: boolean
  reason?: string
}

const items: Item[] = [
  {
    id: "acme",
    label: "Acme models",
    enabled: true,
    status: "available",
    checkedAt: "2m ago",
  },
  {
    id: "local",
    label:
      "linux-box inference server on the office network, second floor rack",
    enabled: true,
    status: "rejected",
    checkedAt: "1h ago",
    reason: "The key was revoked.",
  },
  {
    id: "lab",
    label: "Lab gateway",
    enabled: true,
    status: "unknown",
    checkedAt: "3 days ago",
    stale: true,
  },
  { id: "old", label: "Old proxy", enabled: false, status: "disabled" },
]

const address =
  "https://models.example.com/v1/projects/app/regions/eu-west/endpoints/chat-completions"

function Details({ item }: { item: Item | undefined }) {
  if (!item) return <ConnectionDetails state="none" />
  return (
    <ConnectionDetails>
      <ConnectionDetailsHeader
        label={item.label}
        status={item.status}
        checkedAt={item.checkedAt}
        stale={item.stale}
        reason={item.reason}
      />
      {item.status === "rejected" && (
        <ConnectionNotice
          title="Enter its key again"
          description="Its key was refused. An admin sets it in the connection's settings."
          action={
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<a href="#guide" />}
            >
              How to
            </Button>
          }
        />
      )}
      <ConnectionDetailsField label="Addresses">
        <ConnectionTarget>{address}</ConnectionTarget>
        <ConnectionTarget>
          https://models.example.com/v1/models
        </ConnectionTarget>
      </ConnectionDetailsField>
      <ConnectionDetailsField label="Credential">
        <ConnectionCredential>
          API key sk-…7f3a, added 12 Mar
        </ConnectionCredential>
      </ConnectionDetailsField>
    </ConnectionDetails>
  )
}

function Browser({
  loading = false,
  error,
  onRetry,
}: {
  loading?: boolean
  error?: string
  onRetry?: () => void
}) {
  const [selected, setSelected] = React.useState<string | null>("acme")
  const [query, setQuery] = React.useState("")
  const shown = items.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase())
  )
  return (
    <div className="grid w-full max-w-3xl grid-cols-[minmax(0,16rem)_minmax(0,1fr)] gap-6 max-sm:grid-cols-1">
      <div className="flex min-w-0 flex-col gap-2">
        <Input
          aria-label="Filter connections"
          placeholder="Filter"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <ConnectionList
          loading={loading}
          error={error}
          onRetry={onRetry}
          empty={query ? "No connection matches" : undefined}
        >
          {loading
            ? null
            : shown.map((item) => (
                <ConnectionListItem
                  key={item.id}
                  label={item.label}
                  status={item.status}
                  checkedAt={item.checkedAt}
                  stale={item.stale}
                  reason={item.reason}
                  selected={item.id === selected}
                  onSelect={() => setSelected(item.id)}
                />
              ))}
        </ConnectionList>
      </div>
      <Details item={items.find((item) => item.id === selected)} />
    </div>
  )
}

const meta = {
  title: "Components/Connection",
  component: Browser,
  parameters: { layout: "padded" },
  args: { onRetry: fn() },
} satisfies Meta<typeof Browser>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Connections, read, not managed: each a row of its name and status,
 * told by a mark's shape and its words; chosen, its details beside.
 */
export const Default: Story = {
  play: async ({ canvas }) => {
    const list = canvas.getByRole("list", { name: "Connections" })
    const rows = within(list).getAllByRole("button")
    await expect(rows).toHaveLength(4)
    await expect(rows[0]).toHaveAttribute("aria-current", "true")
    await expect(rows[1]).toHaveTextContent("RejectedChecked 1h ago")
    await expect(rows[2]).toHaveTextContent("May be out of date")
    await expect(rows[3]).toHaveTextContent("Off")
    // A long name is cut short in the list, whole in its details.
    await userEvent.click(rows[1]!)
    await expect(rows[1]).toHaveAttribute("aria-current", "true")
    const heading = canvas.getByRole("heading", { level: 2 })
    await expect(heading).toHaveTextContent("second floor rack")
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "Enter its key again"
    )
    // No way to show or enter the credential.
    await expect(canvas.getByText(/sk-…7f3a/)).toBeVisible()
    await expect(canvas.queryByRole("textbox", { name: /key/i })).toBeNull()
  },
}

/** A long address on a line; a button shows it whole, another copies it. */
export const Addresses: Story = {
  play: async ({ canvas }) => {
    const [expand] = canvas.getAllByRole("button", {
      name: "Show the whole address",
    })
    const code = canvas.getByText(address)
    await expect(code.scrollWidth).toBeGreaterThan(code.clientWidth)
    await userEvent.click(expand!)
    await expect(expand).toHaveAttribute("aria-expanded", "true")
    await waitFor(() =>
      expect(code.scrollWidth).toBeLessThanOrEqual(code.clientWidth)
    )
    await expect(
      canvas.getAllByRole("button", { name: "Copy address" })
    ).toHaveLength(2)
    // A short one, whole on its line, has nothing to show whole.
    await userEvent.click(expand!)
    await waitFor(() =>
      expect(
        canvas.getAllByRole("button", { name: "Show the whole address" })
      ).toHaveLength(1)
    )
  },
}

/** Filtered to none: the app's words for it. */
export const NoMatch: Story = {
  play: async ({ canvas }) => {
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Filter connections" }),
      "zzz"
    )
    await expect(canvas.getByText("No connection matches")).toBeVisible()
  },
}

/** Loading: its rows' shapes, said once. */
export const Loading: Story = {
  args: { loading: true },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("status", { name: "Loading connections…" })
    ).toBeVisible()
  },
}

/** Not fetched: why, and Retry, the app's to call. */
export const Failed: Story = {
  args: { error: "Couldn't load the connections" },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Retry" }))
    await expect(args.onRetry).toHaveBeenCalledOnce()
  },
}

/** On a phone: the list over the details. */
export const OnAPhone: Story = {
  ...onAPhone,
}

/** The details' states: none chosen, loading, one that cannot be shown. */
export const DetailsStates: Story = {
  render: () => (
    <div className="flex w-120 flex-col gap-6">
      <ConnectionDetails state="none" />
      <ConnectionDetails state="loading" />
      <ConnectionDetails state="unavailable" />
      <ConnectionStatus
        status="unknown"
        checkedAt="3 days ago"
        stale
        reason="The last check timed out."
      />
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(
      canvas.getByText("Choose a connection to see its details.")
    ).toBeVisible()
    await expect(canvas.getByRole("status")).toBeInTheDocument()
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "This connection can't be shown."
    )
  },
}
