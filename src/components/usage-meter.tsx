"use client"

import * as React from "react"
import { Meter as MeterPrimitive } from "@base-ui/react/meter"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  inputGroupPopupAnchor,
  inputGroupPopupEndOffset,
  inputGroupPopupOffset,
} from "@/components/ui/input-group"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"

/** A row of a meter's breakdown: what it is, and how much, as the app words it. */
type UsageMeterRow = {
  /** The app's, for React; by default its place. */
  key?: string | undefined
  label: React.ReactNode
  /** As shown: "3.1k", "12%". */
  value: React.ReactNode
  /**
   * Its share of the meter, on the meter's scale: given, the breakdown's
   * bar is in parts, one a row's, each a grey of its own.
   */
  amount?: number | undefined
  /** A line before it: it starts a group of rows, e.g. cost after context. */
  separator?: boolean | undefined
}

/**
 * A row under a breakdown's to act on what it measures: a button, as
 * "Compact older messages", or, with `checked`, a switch, as "Compact
 * automatically". Rows of the breakdown's look, a line above the first.
 */
type UsageMeterAction = {
  /** The app's, for React; by default its place. */
  key?: string | undefined
  label: React.ReactNode
  /** At its end, in grey: a command or a key, "/compact". */
  shortcut?: React.ReactNode
  /** A button's: what it does. */
  onClick?: (() => void) | undefined
  /** Given, the row is a switch, on or off. */
  checked?: boolean | undefined
  onCheckedChange?: ((checked: boolean) => void) | undefined
  disabled?: boolean | undefined
}

type UsageMeterProps = {
  value: number
  min?: number | undefined
  max?: number | undefined
  /** A ring, e.g. beside a composer's buttons; or a bar, e.g. in a badge. */
  variant?: "ring" | "bar" | undefined
  /**
   * Its fill: the text's colour, or the theme's warning or destructive
   * one, e.g. near a limit and at it. Say it in words too (`valueText`).
   */
  tone?: "default" | "warning" | "destructive" | undefined
}

// A tone's fill, as a ring's stroke and a bar's background.
const toneStroke = {
  default: "stroke-foreground",
  warning: "stroke-warning",
  destructive: "stroke-destructive",
}
const toneFill = {
  default: "bg-foreground",
  warning: "bg-warning",
  destructive: "bg-destructive",
}

// The share filled, from 0 to 1.
const shareOf = ({ value, min = 0, max = 100 }: UsageMeterProps) =>
  max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0

// The parts' greys, in order: no colour, but each a step apart.
const partGreys = [
  "bg-subtle-foreground/70",
  "bg-subtle-foreground/40",
  "bg-muted-foreground",
  "bg-foreground",
  "bg-foreground/60",
]

/**
 * Concentric rings, outermost first, in a ring's 16px: a meter each,
 * e.g. a plan's weekly limit outside and its five hours' inside. Two at
 * most, 1.5px strokes 1.5px apart: a third, at 16px, blurs into the
 * others on a 1x screen. More are neither drawn nor said; show them in
 * a `UsageMeterList`.
 */
type UsageMeterRings = {
  rings: readonly UsageMeterListEntry[]
  variant?: "ring" | undefined
  value?: undefined
  min?: undefined
  max?: undefined
  tone?: undefined
}

// The rings drawn: two at most.
const maxRings = 2
const ringsOf = (rings: readonly UsageMeterListEntry[]) =>
  rings.slice(0, maxRings)

// Each ring's radius and stroke in the 16 box, by how many there are,
// outermost first: the outer at the box's edge, a gap between each.
const ringGeometry: Record<number, readonly { r: number; width: number }[]> = {
  1: [{ r: 6.5, width: 2.5 }],
  // 6.5–8 and 3.5–5: 1.5 apart, a 7px hole.
  2: [
    { r: 7.25, width: 1.5 },
    { r: 4.25, width: 1.5 },
  ],
}

/** A ring's track and fill, as its tone says. */
function UsageMeterRing({
  share,
  tone,
  r,
  width,
}: {
  share: number
  tone: NonNullable<UsageMeterProps["tone"]>
  r: number
  width: number
}) {
  const length = 2 * Math.PI * r
  return (
    <g data-slot="usage-meter-ring" data-tone={tone}>
      <circle
        cx="8"
        cy="8"
        r={r}
        strokeWidth={width}
        className="stroke-foreground/15"
      />
      <circle
        cx="8"
        cy="8"
        r={r}
        strokeWidth={width}
        strokeLinecap={share > 0 ? "round" : "butt"}
        strokeDasharray={`${share * length} ${length}`}
        className={cn("transition-[stroke-dasharray]", toneStroke[tone])}
      />
    </g>
  )
}

/**
 * The meter's picture alone: a ring or a bar, filled in the foreground;
 * or, with `rings`, concentric rings in the ring's place.
 */
function UsageMeterGraphic({
  className,
  ...meter
}: ((UsageMeterProps & { rings?: undefined }) | UsageMeterRings) & {
  className?: string | undefined
}) {
  if (meter.rings) {
    const rings = ringsOf(meter.rings)
    const geometry = ringGeometry[Math.max(1, rings.length)]!
    return (
      <svg
        aria-hidden="true"
        data-slot="usage-meter-graphic"
        data-variant="rings"
        data-rings={rings.length}
        viewBox="0 0 16 16"
        fill="none"
        className={cn("size-4 shrink-0 -rotate-90", className)}
      >
        {rings.map((ring, index) => (
          <UsageMeterRing
            key={ring.key ?? ring.label}
            share={shareOf(ring)}
            tone={ring.tone ?? "default"}
            {...geometry[index]!}
          />
        ))}
      </svg>
    )
  }
  const share = shareOf(meter)
  const tone = meter.tone ?? "default"
  if (meter.variant === "bar")
    return (
      <span
        aria-hidden="true"
        data-slot="usage-meter-graphic"
        data-variant="bar"
        data-tone={tone}
        className={cn(
          // grid: mark
          "relative block h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-foreground/15",
          className
        )}
      >
        <span
          className={cn(
            "absolute inset-y-0 start-0 rounded-full transition-[width]",
            toneFill[tone]
          )}
          style={{ width: `${share * 100}%` }}
        />
      </span>
    )
  // A circle of radius 6.5 in a 16 box.
  const length = 2 * Math.PI * 6.5
  return (
    <svg
      aria-hidden="true"
      data-slot="usage-meter-graphic"
      data-variant="ring"
      data-tone={tone}
      viewBox="0 0 16 16"
      fill="none"
      className={cn("size-4 shrink-0 -rotate-90", className)}
    >
      <circle
        cx="8"
        cy="8"
        r="6.5"
        strokeWidth="2.5"
        className="stroke-foreground/15"
      />
      <circle
        cx="8"
        cy="8"
        r="6.5"
        strokeWidth="2.5"
        strokeLinecap={share > 0 ? "round" : "butt"}
        strokeDasharray={`${share * length} ${length}`}
        className={cn("transition-[stroke-dasharray]", toneStroke[tone])}
      />
    </svg>
  )
}

// What a ring says: its label and value, "Weekly: 41% used".
const ringText = (ring: UsageMeterListEntry) =>
  `${ring.label}: ${ring.valueText}`

/** Each ring a meter to a screen reader, unseen: its name and value. */
function UsageMeterRingMeters({
  rings,
}: {
  rings: readonly UsageMeterListEntry[]
}) {
  return ringsOf(rings).map((ring) => (
    <MeterPrimitive.Root
      key={ring.key ?? ring.label}
      value={ring.value}
      min={ring.min ?? 0}
      max={ring.max ?? 100}
      aria-label={ring.label}
      aria-valuetext={ring.valueText}
      className="sr-only"
    />
  ))
}

/**
 * How much of something is used, as a meter: a ring or a bar, its value
 * said to a screen reader (`label`, `valueText`), the app's words after
 * it (`children`). On its own, or in a `Badge`. With `rings`, several in
 * a ring's place, outermost first: a group named by `label`, each ring a
 * meter of its own, its label and value said.
 */
function UsageMeter(
  props:
    | (Omit<MeterPrimitive.Root.Props, "value" | "min" | "max" | "children"> &
        UsageMeterProps & {
          rings?: undefined
          /** Its name: what is measured, "Requests today". */
          label: string
          /** Its value, said: "82 of 100". By default a percentage. */
          valueText?: string | undefined
          /** Shown after it: "82%". */
          children?: React.ReactNode
        })
    | (Omit<React.ComponentProps<"div">, "children"> &
        Omit<UsageMeterRings, "variant"> & {
          /** The group's name: "Plan limits". */
          label: string
          valueText?: undefined
          /** Shown after it. */
          children?: React.ReactNode
        })
) {
  if (props.rings) {
    const { rings, label, className, children, ...rest } = props
    return (
      <div
        role="group"
        data-slot="usage-meter"
        data-variant="rings"
        aria-label={label}
        className={cn("inline-flex items-center gap-2 tabular-nums", className)}
        {...rest}
      >
        <UsageMeterGraphic rings={rings} />
        <UsageMeterRingMeters rings={rings} />
        {children}
      </div>
    )
  }
  const {
    value,
    min = 0,
    max = 100,
    variant = "ring",
    tone = "default",
    label,
    valueText,
    className,
    children,
    ...rest
  } = props
  return (
    <MeterPrimitive.Root
      data-slot="usage-meter"
      value={value}
      min={min}
      max={max}
      aria-label={label}
      {...(valueText !== undefined ? { "aria-valuetext": valueText } : {})}
      className={cn("inline-flex items-center gap-2 tabular-nums", className)}
      {...rest}
    >
      <UsageMeterGraphic
        value={value}
        min={min}
        max={max}
        variant={variant}
        tone={tone}
      />
      {children}
    </MeterPrimitive.Root>
  )
}

/**
 * A meter that opens its breakdown: a button with the ring or bar (and
 * the app's words after it), and a popover with the meter's title and
 * value on one line, a bar of the whole, and the app's rows of label and
 * value. Rows with an `amount` are parts of the bar, each a grey of its
 * own; a row's `separator` starts a group. In an input group, as a
 * composer's toolbar, it opens 8px above the group, not over its text.
 */
function UsageMeterBreakdown({
  value = 0,
  min = 0,
  max = 100,
  variant = "ring",
  tone = "default",
  rings,
  label,
  valueText,
  title,
  description,
  rows = [],
  actions,
  footer,
  children,
  align = "end",
  side = "top",
  open,
  defaultOpen,
  onOpenChange,
  className,
  contentClassName,
  ...props
}: Omit<
  React.ComponentProps<typeof Button>,
  "value" | "children" | "title" | "variant" | "size"
> &
  (
    | (UsageMeterProps & {
        rings?: undefined
        /** Its value, said, and at the title's end: "62k of 200k". */
        valueText: string
      })
    | (UsageMeterRings & {
        /** At the title's end, if any; each ring says its own. */
        valueText?: string | undefined
      })
  ) & {
    /** What is measured: the button's name, and the popover's title. */
    label: string
    /** The popover's title, by default `label`. */
    title?: React.ReactNode
    /** At the title's end, by default `valueText`. */
    description?: React.ReactNode
    /**
     * Under its bar (with `rings`, a bar each, as a `UsageMeterList`):
     * the app's rows of label and value.
     */
    rows?: readonly UsageMeterRow[] | undefined
    /** Under the rows, a line above them: rows that act, a button or a switch. */
    actions?: readonly UsageMeterAction[] | undefined
    /** At its end: e.g. a note, or a button of the app's own. */
    footer?: React.ReactNode
    /** In the button, after the ring or bar: "31%". */
    children?: React.ReactNode
    align?: "start" | "center" | "end" | undefined
    side?: "top" | "bottom" | "left" | "right" | undefined
    /** The popover's classes, after its own: e.g. its width. */
    contentClassName?: string | undefined
    /** The popover's: e.g. closed by the footer's button once it acts. */
    open?: boolean | undefined
    defaultOpen?: boolean | undefined
    onOpenChange?: ((open: boolean) => void) | undefined
  }) {
  const trigger = React.useRef<HTMLButtonElement>(null)
  const popup = React.useRef<HTMLDivElement>(null)
  // Its rows, where they scroll, are a stop of the keyboard's to scroll.
  const [scrolls, setScrolls] = React.useState(false)
  const rowsRef = React.useCallback((element: HTMLElement | null) => {
    if (!element) return
    const observer = new ResizeObserver(() =>
      setScrolls(element.scrollHeight > element.clientHeight)
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const parts = rows.some((row) => row.amount !== undefined)
  const span = max - min
  return (
    <Popover
      {...(open === undefined ? {} : { open })}
      {...(defaultOpen === undefined ? {} : { defaultOpen })}
      onOpenChange={(next) => onOpenChange?.(next)}
    >
      <PopoverTrigger
        render={
          <Button
            ref={trigger}
            variant="ghost"
            size={children ? "sm" : "icon-sm"}
            // Named by what is measured and its value; with words of
            // the app's, by them, which the reader sees. Rings say
            // each ring's label and value, and then the app's words.
            {...(children || rings
              ? {}
              : { "aria-label": `${label}: ${valueText}` })}
            data-slot="usage-meter-breakdown"
            className={cn("tabular-nums", className)}
            {...props}
          />
        }
      >
        {rings ? (
          <span className="sr-only">
            {`${label}: ${ringsOf(rings).map(ringText).join(", ")}${children ? ", " : ""}`}
          </span>
        ) : (
          children && <span className="sr-only">{`${label}: `}</span>
        )}
        {rings ? (
          <UsageMeterGraphic rings={rings} />
        ) : (
          <UsageMeterGraphic
            value={value}
            min={min}
            max={max}
            variant={variant}
            tone={tone}
          />
        )}
        {children && <span data-slot="usage-meter-value">{children}</span>}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        sideOffset={({ side }) => inputGroupPopupOffset(trigger.current, side)}
        // In a composer, its end where the send column starts.
        alignOffset={({ align }) =>
          align === "end" ? inputGroupPopupEndOffset(trigger.current) : 0
        }
        anchor={() => inputGroupPopupAnchor(trigger.current)}
        // Focus in the popover itself, not on its rows where they scroll
        // (Tab goes on to them).
        ref={popup}
        initialFocus={popup}
        // No wider or higher than the room it has (a phone's large text):
        // its rows scroll, its title, meter and footer stay.
        className={cn(
          "max-h-(--available-height) w-76 max-w-(--available-width) gap-0 p-1",
          contentClassName
        )}
      >
        <PopoverHeader className="h-7 shrink-0 flex-row items-center justify-between gap-2 px-2">
          <PopoverTitle className="text-2xs text-subtle-foreground">
            {title ?? label}
          </PopoverTitle>
          {(description ?? valueText) !== undefined && (
            <PopoverDescription className="text-2xs tabular-nums">
              {description ?? valueText}
            </PopoverDescription>
          )}
        </PopoverHeader>
        {rings ? (
          <UsageMeterList
            meters={ringsOf(rings)}
            className="shrink-0 px-2 pt-1 pb-3"
          />
        ) : (
          <MeterPrimitive.Root
            value={value}
            min={min}
            max={max}
            aria-label={label}
            {...(valueText !== undefined
              ? { "aria-valuetext": valueText }
              : {})}
            data-slot="usage-meter"
            className="shrink-0 px-2 pt-1 pb-3"
          >
            {parts ? (
              <span
                aria-hidden="true"
                data-slot="usage-meter-graphic"
                data-variant="parts"
                // grid: mark
                className="flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-muted"
              >
                {rows.map((row, index) =>
                  row.amount ? (
                    <span
                      key={row.key ?? index}
                      className={cn(
                        "h-full",
                        partGreys[index % partGreys.length]
                      )}
                      style={{
                        width: `${span > 0 ? Math.max(0, (row.amount / span) * 100) : 0}%`,
                      }}
                    />
                  ) : null
                )}
              </span>
            ) : (
              <UsageMeterGraphic
                value={value}
                min={min}
                max={max}
                variant="bar"
                tone={tone}
                className="w-full"
              />
            )}
          </MeterPrimitive.Root>
        )}
        {rows.length > 0 && (
          <dl
            ref={rowsRef}
            data-slot="usage-meter-rows"
            {...(scrolls ? { tabIndex: 0, "aria-label": label } : {})}
            // As wide as the popover, for a separator's line to its edges.
            className="-mx-1 flex min-h-0 flex-col overflow-y-auto overscroll-contain px-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {rows.map((row, index) => (
              <div
                key={row.key ?? index}
                data-slot="usage-meter-row"
                className={cn(
                  "flex h-7 items-center gap-2 px-2 text-2sm text-muted-foreground",
                  row.separator && "-mx-1 mt-1 h-8 border-t px-3 pt-1"
                )}
              >
                <dt className="min-w-0 flex-1 truncate">{row.label}</dt>
                <dd className="shrink-0 text-end text-xs text-subtle-foreground tabular-nums">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {actions && actions.length > 0 && (
          <div
            data-slot="usage-meter-actions"
            // Its line to the popover's edges, as a row's separator.
            className="-mx-1 mt-1 flex shrink-0 flex-col border-t px-1 pt-1"
          >
            {actions.map((action, index) => (
              <UsageMeterActionRow key={action.key ?? index} action={action} />
            ))}
          </div>
        )}
        {footer && (
          <div
            data-slot="usage-meter-footer"
            // A note in grey; a button in the text's colour.
            className="shrink-0 px-2 pt-2 pb-1 text-xs text-muted-foreground *:data-[slot=button]:text-foreground"
          >
            {footer}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

// A row to act on: as tall as a menu's, its text where the rows' is.
const actionRow =
  "flex min-h-8 w-full cursor-default items-center gap-2 rounded-md px-2 py-1 text-start text-2sm outline-none select-none motion-hover hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-disabled:pointer-events-none aria-disabled:opacity-50 has-data-disabled:pointer-events-none has-data-disabled:opacity-50 disabled:pointer-events-none disabled:opacity-50"

/** An action's row: a button, or a switch the whole row toggles. */
function UsageMeterActionRow({ action }: { action: UsageMeterAction }) {
  const shortcut = action.shortcut !== undefined &&
    action.shortcut !== null && (
      <span
        data-slot="usage-meter-action-shortcut"
        className="shrink-0 text-xs text-subtle-foreground"
      >
        {action.shortcut}
      </span>
    )
  if (action.checked !== undefined)
    return (
      <label data-slot="usage-meter-action" className={actionRow}>
        <span className="min-w-0 flex-1 truncate">{action.label}</span>
        {shortcut}
        <Switch
          size="sm"
          checked={action.checked}
          onCheckedChange={(checked) => action.onCheckedChange?.(checked)}
          disabled={action.disabled}
        />
      </label>
    )
  return (
    <button
      type="button"
      data-slot="usage-meter-action"
      disabled={action.disabled}
      onClick={() => action.onClick?.()}
      className={actionRow}
    >
      <span className="min-w-0 flex-1 truncate">{action.label}</span>
      {shortcut}
    </button>
  )
}

/** One meter of a `UsageMeterList`. */
type UsageMeterListEntry = UsageMeterProps & {
  /** The app's, for React; by default its label. */
  key?: string | undefined
  /** What is measured: "Requests this hour". */
  label: string
  /** Its value, shown at its line's end and said: "82 of 100". */
  valueText: string
  /** Under its bar, small and grey: "Resets in 2h". */
  detail?: React.ReactNode
}

/**
 * Several meters at a glance, e.g. in a popup of an account's limits:
 * each its label and value on a line, a bar across under them, and a
 * line of detail under it (when it resets); 12px apart. Each a meter to
 * a screen reader, named by its label, its value said.
 */
function UsageMeterList({
  meters,
  className,
  ...props
}: Omit<React.ComponentProps<"ul">, "children"> & {
  meters: readonly UsageMeterListEntry[]
}) {
  return (
    <ul
      data-slot="usage-meter-list"
      className={cn("flex min-w-0 flex-col gap-3 text-2sm", className)}
      {...props}
    >
      {meters.map(
        ({
          key,
          label,
          valueText,
          detail,
          value,
          min = 0,
          max = 100,
          tone,
        }) => (
          <li
            key={key ?? label}
            data-slot="usage-meter-list-item"
            className="flex min-w-0 flex-col gap-1"
          >
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="min-w-0 truncate">{label}</span>
              <span
                aria-hidden="true"
                className="ms-auto shrink-0 text-muted-foreground tabular-nums"
              >
                {valueText}
              </span>
            </div>
            <MeterPrimitive.Root
              value={value}
              min={min}
              max={max}
              aria-label={label}
              aria-valuetext={valueText}
              className="flex h-2 items-center"
            >
              <UsageMeterGraphic
                variant="bar"
                value={value}
                min={min}
                max={max}
                tone={tone}
                className="w-full"
              />
            </MeterPrimitive.Root>
            {detail && (
              <span className="text-xs text-subtle-foreground">{detail}</span>
            )}
          </li>
        )
      )}
    </ul>
  )
}

export {
  UsageMeter,
  UsageMeterBreakdown,
  UsageMeterGraphic,
  UsageMeterList,
  type UsageMeterListEntry,
  type UsageMeterRings,
  type UsageMeterAction,
  type UsageMeterRow,
}
