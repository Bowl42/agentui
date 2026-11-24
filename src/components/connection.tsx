"use client"

import * as React from "react"
import { cn } from "cn"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert02Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  SquareLock02Icon,
} from "@hugeicons/core-free-icons"

import { CopyButton } from "@/components/copy-button"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * How a connection was last found: usable, refused (its credential or
 * its access), not known (never checked, or the check said nothing), or
 * turned off.
 */
type ConnectionStatusValue = "available" | "rejected" | "unknown" | "disabled"

type ConnectionLabels = {
  available: string
  rejected: string
  unknown: string
  disabled: string
  /** When it was last checked: "Checked 2h ago". */
  checked: (when: string) => string
  /** A check too old to go by. */
  stale: string
  /** The list's name. */
  list: string
  loading: string
  /** The list with none. */
  empty: string
  /** The list could not be fetched; its button. */
  retry: string
  /** The details with no connection chosen. */
  none: string
  /** The details of one that cannot be shown. */
  unavailable: string
  /** A long address's button that shows it whole, and back. */
  expand: string
  collapse: string
  copy: string
  /** After a credential's summary: it is never shown whole here. */
  credentialHidden: string
}

const defaultLabels: ConnectionLabels = {
  available: "Available",
  rejected: "Rejected",
  unknown: "Unknown",
  disabled: "Off",
  checked: (when) => `Checked ${when}`,
  stale: "May be out of date",
  list: "Connections",
  loading: "Loading connections…",
  empty: "No connections",
  retry: "Retry",
  none: "Choose a connection to see its details.",
  unavailable: "This connection can't be shown.",
  expand: "Show the whole address",
  collapse: "Show less",
  copy: "Copy address",
  credentialHidden: "Not shown in full",
}

const ConnectionContext = React.createContext<ConnectionLabels>(defaultLabels)

/** Labels for the parts inside: a `ConnectionList`'s or `ConnectionDetails`'. */
function useLabels(own?: Partial<ConnectionLabels>) {
  const inherited = React.useContext(ConnectionContext)
  return own ? { ...inherited, ...own } : inherited
}

/**
 * Each status's mark, told by its shape, not only its colour: a dot
 * available, a diamond rejected, a ring unknown, a bar off.
 */
const marks: Record<ConnectionStatusValue, string> = {
  available: "size-2 rounded-full bg-success",
  rejected: "size-2 rotate-45 bg-destructive",
  // grid: mark (a ring, as large as the dots look)
  unknown: "size-2.5 rounded-full border-2 border-muted-foreground",
  // grid: mark (a bar, as wide as the dots)
  disabled: "h-0.5 w-2.5 rounded-full bg-muted-foreground",
}

/**
 * A connection's status in words, its mark before them: "Available ·
 * Checked 2h ago"; `stale`, "May be out of date" after; why, under it
 * (`reason`), unless `compact`.
 */
function ConnectionStatus({
  status,
  checkedAt,
  stale = false,
  reason,
  compact = false,
  labels: labelsProp,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  status: ConnectionStatusValue
  /** When it was last checked, as the app says it: "2h ago". */
  checkedAt?: string | undefined
  /** Whether that check is too old to go by. */
  stale?: boolean | undefined
  /** Why it is as it is: "The key was revoked." */
  reason?: React.ReactNode
  /** On one line, cut short: a list's row. */
  compact?: boolean
  labels?: Partial<ConnectionLabels>
}) {
  const labels = useLabels(labelsProp)
  const facts = [
    labels[status],
    checkedAt ? labels.checked(checkedAt) : null,
    stale ? labels.stale : null,
  ].filter((fact): fact is string => fact !== null)
  return (
    <div
      data-slot="connection-status"
      data-status={status}
      data-stale={stale || undefined}
      className={cn(
        "flex min-w-0 flex-col gap-0.5 text-2sm text-muted-foreground",
        className
      )}
      {...props}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span aria-hidden className="grid size-4 shrink-0 place-items-center">
          <span className={marks[status]} />
        </span>
        <span className={cn("min-w-0", compact && "truncate")}>
          {facts.map((fact, index) => (
            <span
              key={fact}
              // A dot between facts, read as a comma; its status and a check
              // too old to go by in the text's colour.
              className={cn(
                "not-first:before:mx-1 not-first:before:text-subtle-foreground not-first:before:content-['·'_/_',_']",
                (index === 0 || fact === labels.stale) && "text-foreground"
              )}
            >
              {fact}
            </span>
          ))}
        </span>
      </span>
      {reason !== undefined && reason !== null && !compact && (
        <span className="ps-6 text-pretty">{reason}</span>
      )}
    </div>
  )
}

/**
 * Connections to services (a model provider's, a tool server's), read,
 * not managed: a `ConnectionListItem` a row, the one shown beside
 * `selected`. Loading, its rows' shapes; with none, `labels.empty`; not
 * fetched (`error`), why and a Retry. Filtering and pages are the app's,
 * around it (an `Input`, `Pagination`): it fetches nothing.
 */
function ConnectionList({
  loading = false,
  error,
  onRetry,
  empty,
  labels: labelsProp,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  loading?: boolean
  /** Why it could not be fetched. */
  error?: React.ReactNode
  onRetry?: () => void
  /** In place of `labels.empty` with no rows, e.g. a filter's "No match". */
  empty?: React.ReactNode
  labels?: Partial<ConnectionLabels>
}) {
  const labels = useLabels(labelsProp)
  const rows = React.Children.toArray(children)
  return (
    <ConnectionContext value={labels}>
      <div
        data-slot="connection-list"
        className={cn("flex min-w-0 flex-col", className)}
        {...props}
      >
        {error !== undefined && error !== null ? (
          <div
            role="alert"
            data-slot="connection-list-error"
            className="flex min-h-11 items-center gap-2 px-2 text-2sm text-muted-foreground [&>svg]:size-4 [&>svg]:shrink-0"
          >
            <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
            <span className="min-w-0 flex-1">{error}</span>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                {labels.retry}
              </Button>
            )}
          </div>
        ) : null}
        {loading && rows.length === 0 ? (
          <div
            role="status"
            aria-label={labels.loading}
            data-slot="connection-list-loading"
            className="flex flex-col"
          >
            {[0, 1, 2].map((index) => (
              <div key={index} className="flex flex-col gap-2 p-2">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-3/5" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 && (error === undefined || error === null) ? (
          <p
            data-slot="connection-list-empty"
            className="px-2 py-6 text-center text-2sm text-muted-foreground"
          >
            {empty ?? labels.empty}
          </p>
        ) : rows.length > 0 ? (
          <ul aria-label={labels.list} className="flex flex-col gap-0.5">
            {children}
          </ul>
        ) : null}
      </div>
    </ConnectionContext>
  )
}

/**
 * A connection in the list: its name, cut short to a line (its details
 * have it whole), and its status under it, a line too; a button that
 * shows it (`onSelect`), `aria-current` when it is the one shown. Off,
 * its name greyer.
 */
function ConnectionListItem({
  label,
  status,
  checkedAt,
  stale,
  reason,
  selected = false,
  onSelect,
  className,
  ...props
}: Omit<React.ComponentProps<"li">, "onSelect"> & {
  label: React.ReactNode
  status: ConnectionStatusValue
  checkedAt?: string | undefined
  stale?: boolean | undefined
  /** Why, after its status where it fits; whole in its details. */
  reason?: string | undefined
  selected?: boolean
  onSelect?: () => void
}) {
  return (
    <li
      data-slot="connection-list-item"
      data-status={status}
      className={cn("min-w-0", className)}
      {...props}
    >
      <button
        type="button"
        aria-current={selected ? "true" : undefined}
        onClick={onSelect}
        className="flex w-full min-w-0 cursor-pointer flex-col gap-0.5 rounded-md px-2 py-2 text-start outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-current:bg-muted pointer-coarse:min-h-11"
      >
        <span
          data-slot="connection-list-item-label"
          className={cn(
            "w-full truncate text-sm font-medium text-foreground",
            status === "disabled" && "text-muted-foreground"
          )}
        >
          {label}
        </span>
        <ConnectionStatus
          compact
          status={status}
          checkedAt={checkedAt}
          stale={stale}
          className="w-full"
        />
        {reason ? (
          <span className="w-full truncate ps-6 text-xs text-muted-foreground">
            {reason}
          </span>
        ) : null}
      </button>
    </li>
  )
}

/**
 * A connection's details, read, never edited: its name and status
 * (`ConnectionDetailsHeader`), what needs doing (`ConnectionNotice`), its
 * fields (`ConnectionDetailsField`): its addresses (`ConnectionTarget`),
 * its credential's summary (`ConnectionCredential`), its last check.
 * `state`: none chosen, loading, or one that cannot be shown.
 */
function ConnectionDetails({
  state = "ready",
  labels: labelsProp,
  className,
  children,
  ...props
}: React.ComponentProps<"section"> & {
  state?: "none" | "loading" | "unavailable" | "ready"
  labels?: Partial<ConnectionLabels>
}) {
  const labels = useLabels(labelsProp)
  return (
    <ConnectionContext value={labels}>
      <section
        data-slot="connection-details"
        data-state={state}
        aria-busy={state === "loading" || undefined}
        className={cn("flex min-w-0 flex-col gap-4", className)}
        {...props}
      >
        {state === "none" ? (
          <p className="py-6 text-center text-2sm text-muted-foreground">
            {labels.none}
          </p>
        ) : state === "unavailable" ? (
          <p
            role="alert"
            className="flex items-center justify-center gap-2 py-6 text-2sm text-muted-foreground [&>svg]:size-4"
          >
            <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
            {labels.unavailable}
          </p>
        ) : state === "loading" ? (
          <div
            role="status"
            aria-label={labels.loading}
            className="flex flex-col gap-3"
          >
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          children
        )}
      </section>
    </ConnectionContext>
  )
}

/** Its name, whole, wrapping, and its status under it. */
function ConnectionDetailsHeader({
  label,
  status,
  checkedAt,
  stale,
  reason,
  className,
  ...props
}: React.ComponentProps<"header"> & {
  label: React.ReactNode
  status: ConnectionStatusValue
  checkedAt?: string | undefined
  stale?: boolean | undefined
  reason?: React.ReactNode
}) {
  return (
    <header
      data-slot="connection-details-header"
      className={cn("flex min-w-0 flex-col gap-1", className)}
      {...props}
    >
      <h2 className="text-base font-semibold break-words text-foreground">
        {label}
      </h2>
      <ConnectionStatus
        status={status}
        checkedAt={checkedAt}
        stale={stale}
        reason={reason}
      />
    </header>
  )
}

/**
 * What needs the reader, e.g. to approve it again or enter its key
 * again, where that is done (the app's `action`: a link to the guide):
 * a line with a warning's mark, announced.
 */
function ConnectionNotice({
  title,
  description,
  action,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div
      role="alert"
      data-slot="connection-notice"
      className={cn(
        "flex min-w-0 items-start gap-2 rounded-lg border p-3 text-2sm [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0",
        className
      )}
      {...props}
    >
      <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{title}</p>
        {description !== undefined && description !== null && (
          <p className="text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}

/** A field of its details: its name over its value. */
function ConnectionDetailsField({
  label,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { label: React.ReactNode }) {
  return (
    <div
      data-slot="connection-details-field"
      className={cn("flex min-w-0 flex-col gap-1", className)}
      {...props}
    >
      <div className="text-xs font-medium text-subtle-foreground">{label}</div>
      <div className="flex min-w-0 flex-col gap-1 text-2sm">{children}</div>
    </div>
  )
}

/**
 * An address it reaches, in mono: on a line, cut short at its end; a
 * button shows it whole, wrapped, and one copies it. Only what is not
 * secret: the app strips any key from it.
 */
function ConnectionTarget({
  children: address,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & { children: string }) {
  const labels = useLabels()
  const [whole, setWhole] = React.useState(false)
  const id = React.useId()
  const code = React.useRef<HTMLElement>(null)
  // Whether it is cut short on its line: else nothing to show whole.
  const [cut, setCut] = React.useState(false)
  React.useLayoutEffect(() => {
    const element = code.current
    if (!element || whole) return
    const check = () => setCut(element.scrollWidth > element.clientWidth)
    check()
    const observer = new ResizeObserver(check)
    observer.observe(element)
    return () => observer.disconnect()
  }, [whole, address])
  return (
    <div
      data-slot="connection-target"
      className={cn("flex min-w-0 items-start gap-1", className)}
      {...props}
    >
      <code
        ref={code}
        id={id}
        className={cn(
          "min-w-0 flex-1 py-1 font-mono text-xs leading-5 text-foreground",
          whole ? "break-all" : "truncate"
        )}
      >
        {address}
      </code>
      {(cut || whole) && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={whole ? labels.collapse : labels.expand}
          aria-expanded={whole}
          aria-controls={id}
          onClick={() => setWhole(!whole)}
          className="text-muted-foreground"
        >
          <HugeiconsIcon
            icon={whole ? ArrowUp01Icon : ArrowDown01Icon}
            strokeWidth={2}
          />
        </Button>
      )}
      <CopyButton
        value={address}
        size="icon-sm"
        labels={{ copy: labels.copy }}
      />
    </div>
  )
}

/**
 * Its credential as the app sums it up, already masked ("sk-…7f3a,
 * added 12 Mar"): with a lock, and no way to show or enter it here.
 */
function ConnectionCredential({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const labels = useLabels()
  return (
    <div
      data-slot="connection-credential"
      className={cn(
        "flex min-w-0 items-center gap-2 text-2sm text-foreground [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground",
        className
      )}
      {...props}
    >
      <HugeiconsIcon icon={SquareLock02Icon} strokeWidth={2} />
      <span className="min-w-0 break-words">{children}</span>
      <span className="shrink-0 text-xs text-subtle-foreground">
        {labels.credentialHidden}
      </span>
    </div>
  )
}

export {
  ConnectionCredential,
  ConnectionDetails,
  ConnectionDetailsField,
  ConnectionDetailsHeader,
  ConnectionList,
  ConnectionListItem,
  ConnectionNotice,
  ConnectionStatus,
  ConnectionTarget,
  type ConnectionLabels,
  type ConnectionStatusValue,
}
