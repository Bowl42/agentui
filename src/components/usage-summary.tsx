"use client"

import * as React from "react"
import { cn } from "cn"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDown01Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

/**
 * How far an amount is to be trusted: known in full, part of it known,
 * estimated, not known, with no price to put on it, or known but not yet
 * matched with the bill.
 */
type UsageCompleteness =
  "complete" | "partial" | "estimated" | "unknown" | "unpriced" | "unreconciled"

/** An amount of one unit: "$1.16", "320 credits", "48.2k tokens". */
type UsageAmount = {
  /** As shown, the app's formatting; null when it is not known. */
  value: React.ReactNode | null
  /** What it is counted in: amounts of different units are never added. */
  unit: string
  completeness?: UsageCompleteness | undefined
}

/** A line of the breakdown: what was used, and its amount. */
type UsageSummaryRow = UsageAmount & {
  /** The app's, for React; by default its place. */
  key?: string | undefined
  label: React.ReactNode
  /** Where the amount comes from: "The provider's invoice", "Our price list". */
  source?: React.ReactNode
  /** Why it is not complete: "The provider has not reported cached input." */
  reason?: React.ReactNode
}

type UsageSummaryLabels = {
  /** The summary's button's name, before its amounts. */
  title: string
  /** While the run goes on, before its amounts: "So far". */
  running: string
  /** An amount that is not known. */
  unknown: string
  /** Each completeness but complete, after its amount. */
  partial: string
  estimated: string
  unpriced: string
  unreconciled: string
  /** The button that explains a row: "About Input tokens". */
  about: (label: string) => string
  /** Over what is used but has no price. */
  missing: string
  /** No amounts at all. */
  none: string
}

const defaultLabels: UsageSummaryLabels = {
  title: "Usage",
  running: "So far",
  unknown: "Unknown",
  partial: "Partial",
  estimated: "Estimated",
  unpriced: "No price",
  unreconciled: "Not reconciled",
  about: (label) => `About ${label}`,
  missing: "No price for",
  none: "No usage yet",
}

const UsageSummaryContext =
  React.createContext<UsageSummaryLabels>(defaultLabels)

/** The words after an amount for how far it is to be trusted; none if whole. */
function completenessOf(
  amount: UsageAmount,
  labels: UsageSummaryLabels
): string | null {
  if (amount.value === null || amount.value === undefined) return null
  switch (amount.completeness) {
    case "partial":
      return labels.partial
    case "estimated":
      return labels.estimated
    case "unpriced":
      return labels.unpriced
    case "unreconciled":
      return labels.unreconciled
    default:
      return null
  }
}

/**
 * An amount and how far it is to be trusted, in words, not a colour: an
 * estimate "≈ $1.16 Estimated", one not known "Unknown" (never 0).
 */
function Amount({
  amount,
  labels,
  className,
}: {
  amount: UsageAmount
  labels: UsageSummaryLabels
  className?: string
}) {
  const known = amount.value !== null && amount.value !== undefined
  const said = completenessOf(amount, labels)
  return (
    <span
      data-slot="usage-summary-amount"
      data-completeness={
        known ? (amount.completeness ?? "complete") : "unknown"
      }
      className={cn("inline-flex items-baseline gap-1", className)}
    >
      {known ? (
        <span className="text-foreground tabular-nums">
          {amount.completeness === "estimated" && (
            // Approximately, as the eye reads it; the word says it too.
            <span aria-hidden>≈ </span>
          )}
          {amount.value}
        </span>
      ) : (
        <span className="text-muted-foreground">{labels.unknown}</span>
      )}
      {said !== null && (
        <span className="text-xs text-subtle-foreground">{said}</span>
      )}
    </span>
  )
}

/**
 * What a run used and what it cost, by unit, never added across units
 * (dollars and credits are two amounts): a button of its totals, each
 * saying how far it is to be trusted (estimated, partial, not
 * reconciled; not known is "Unknown", not 0), that opens its breakdown
 * (`UsageSummaryRows`) and what has no price (`missing`). The amounts are
 * the app's, formatted as it likes; it adds them, by unit.
 */
function UsageSummary({
  totals,
  running = false,
  missing = [],
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  labels: labelsProp,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  /** Its totals, one a unit, in the app's order. */
  totals: readonly UsageAmount[]
  /** Whether the run goes on: its totals are so far. */
  running?: boolean
  /** What was used and has no price, by name: "Web search". */
  missing?: readonly React.ReactNode[]
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  labels?: Partial<UsageSummaryLabels>
}) {
  const labels = { ...defaultLabels, ...labelsProp }
  const [openState, setOpenState] = React.useState(defaultOpen)
  const open = openProp ?? openState
  const setOpen = (next: boolean) => {
    setOpenState(next)
    onOpenChange?.(next)
  }
  const detailsId = React.useId()
  const details =
    React.Children.toArray(children).length > 0 || missing.length > 0
  return (
    <UsageSummaryContext value={labels}>
      <div
        data-slot="usage-summary"
        data-running={running || undefined}
        className={cn("flex min-w-0 flex-col text-2sm", className)}
        {...props}
      >
        <button
          type="button"
          data-slot="usage-summary-trigger"
          aria-expanded={details ? open : undefined}
          aria-controls={details && open ? detailsId : undefined}
          disabled={!details}
          onClick={() => setOpen(!open)}
          // A row of the page's text; its chevron says it opens.
          className="group/usage-summary -mx-2 flex min-h-8 min-w-0 cursor-pointer items-center gap-x-3 gap-y-1 rounded-md px-2 text-start outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:hover:bg-transparent pointer-coarse:min-h-11"
        >
          <span className="shrink-0 text-muted-foreground">
            {running ? labels.running : labels.title}
          </span>
          <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5">
            {totals.length === 0 ? (
              <span className="text-muted-foreground">{labels.none}</span>
            ) : (
              totals.map((total) => (
                <Amount key={total.unit} amount={total} labels={labels} />
              ))
            )}
          </span>
          {details && (
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              strokeWidth={2}
              className="size-4 shrink-0 text-muted-foreground transition-transform group-aria-expanded/usage-summary:rotate-180"
            />
          )}
        </button>
        {details && open && (
          <div
            id={detailsId}
            data-slot="usage-summary-details"
            className="flex flex-col gap-2 pt-1"
          >
            {children}
            {missing.length > 0 && (
              <p
                data-slot="usage-summary-missing"
                className="text-xs text-subtle-foreground"
              >
                {labels.missing}{" "}
                {missing.map((name, index) => (
                  <React.Fragment key={index}>
                    {index > 0 && ", "}
                    <span className="text-muted-foreground">{name}</span>
                  </React.Fragment>
                ))}
              </p>
            )}
          </div>
        )}
      </div>
    </UsageSummaryContext>
  )
}

/**
 * The breakdown: a row a line, its label, its amount and how far it is
 * to be trusted, and, given its `source` or `reason`, a button that
 * explains it (a popover, by touch too). In `UsageSummary`, or in an
 * `AgentTurnInfo`'s details as they are.
 */
function UsageSummaryRows({
  rows,
  labels: labelsProp,
  className,
  ...props
}: React.ComponentProps<"dl"> & {
  rows: readonly UsageSummaryRow[]
  labels?: Partial<UsageSummaryLabels>
}) {
  const inherited = React.useContext(UsageSummaryContext)
  const labels = { ...inherited, ...labelsProp }
  return (
    <dl
      data-slot="usage-summary-rows"
      className={cn("flex min-w-0 flex-col", className)}
      {...props}
    >
      {rows.map((row, index) => {
        const name = typeof row.label === "string" ? row.label : undefined
        const explained =
          (row.source !== undefined && row.source !== null) ||
          (row.reason !== undefined && row.reason !== null)
        return (
          <div
            key={row.key ?? index}
            data-slot="usage-summary-row"
            className="flex min-h-7 min-w-0 items-center gap-3 text-2sm"
          >
            <dt className="flex min-w-0 items-center gap-1 text-subtle-foreground">
              <span className="min-w-0 break-words">{row.label}</span>
              {explained && (
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={labels.about(name ?? "")}
                        className="text-subtle-foreground hover:text-foreground"
                      />
                    }
                  >
                    <HugeiconsIcon
                      icon={InformationCircleIcon}
                      strokeWidth={2}
                    />
                  </PopoverTrigger>
                  <PopoverContent
                    data-slot="usage-summary-about"
                    aria-label={labels.about(name ?? "")}
                    className="flex w-64 flex-col gap-1 text-2sm"
                  >
                    {row.source !== undefined && row.source !== null && (
                      <p className="text-foreground">{row.source}</p>
                    )}
                    {row.reason !== undefined && row.reason !== null && (
                      <p className="text-muted-foreground">{row.reason}</p>
                    )}
                  </PopoverContent>
                </Popover>
              )}
            </dt>
            <dd className="ms-auto shrink-0 text-end">
              <Amount amount={row} labels={labels} />
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

export {
  UsageSummary,
  UsageSummaryRows,
  type UsageAmount,
  type UsageCompleteness,
  type UsageSummaryLabels,
  type UsageSummaryRow,
}
