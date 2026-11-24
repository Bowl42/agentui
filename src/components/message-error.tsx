"use client"

import * as React from "react"
import {
  Alert02Icon,
  CancelCircleIcon,
  Clock01Icon,
  HelpCircleIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "cn"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

/**
 * Where a failed request is: waiting to try again, trying again, given
 * up after its attempts, failed, cancelled, or with no answer, so it may
 * have gone through.
 */
type MessageErrorStatus =
  "waiting" | "retrying" | "exhausted" | "failed" | "cancelled" | "unknown"

type MessageErrorLabels = {
  retryNow: string
  /** While it waits to try again: "Retrying in 8s". */
  retryingIn: (seconds: number) => string
  /** Once the wait is over, until the app says how it went. */
  retrying: string
  /** Which try is next: "attempt 2 of 5". */
  attempt: (attempt: number, attempts: number | undefined) => string
  /** Given up: "Gave up after 5 attempts". */
  exhausted: (attempts: number | undefined) => string
  cancelled: string
  /** No answer came: what it means. */
  unknown: string
}

const defaultMessageErrorLabels: MessageErrorLabels = {
  retryNow: "Retry now",
  retryingIn: (seconds) => `Retrying in ${seconds}s`,
  retrying: "Retrying…",
  attempt: (attempt, attempts) =>
    attempts === undefined
      ? `attempt ${attempt}`
      : `attempt ${attempt} of ${attempts}`,
  exhausted: (attempts) =>
    attempts === undefined
      ? "Gave up retrying"
      : `Gave up after ${attempts} ${attempts === 1 ? "attempt" : "attempts"}`,
  cancelled: "Cancelled",
  unknown:
    "No answer came: it may have gone through. Check before trying again.",
}

/** Each status's mark, so it is told by its shape, not a colour. */
const statusIcons = {
  waiting: Clock01Icon,
  exhausted: Alert02Icon,
  failed: Alert02Icon,
  cancelled: CancelCircleIcon,
  unknown: HelpCircleIcon,
} as const

/** The whole seconds left until `at` (a time in ms), counting down. */
function useSecondsLeft(at: number | undefined) {
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    if (at === undefined) return
    const tick = () => {
      const time = Date.now()
      setNow(time)
      if (time >= at) window.clearInterval(timer)
    }
    const timer = window.setInterval(tick, 250)
    return () => window.clearInterval(timer)
  }, [at])
  return at === undefined ? 0 : Math.max(0, Math.ceil((at - now) / 1000))
}

/**
 * Why a turn failed and what comes next, in the conversation where the
 * answer would have gone: its reason in a line ("Rate limited", "The
 * connection dropped") and, under it, what it means, or, while the app
 * waits to try again (`retry`), a countdown to it and which attempt
 * that is. Its actions at its end: "Retry now" with `onRetry`, or the
 * app's own (`action`, one button or several, e.g. "Continue"). An
 * outlined card in the page's greys, not a colour: it says what
 * happened, it is not an alarm.
 *
 * Its `status` is told by its mark and its words, not a colour: waiting
 * (a clock and the countdown), retrying (a spinner), exhausted (given up
 * after its attempts), failed, cancelled, unknown (no answer: it may have
 * gone through). Nothing is tried on its own: at the countdown's end it
 * says it is retrying, and the app retries, or a button does.
 */
function MessageError({
  title,
  description,
  status: statusProp,
  retry,
  onRetry,
  action,
  labels: labelsProp,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "title" | "children"> & {
  /** What went wrong, in a line. */
  title: React.ReactNode
  /** What it means or what to do, under it; the countdown takes its place while retrying. */
  description?: React.ReactNode
  /**
   * Where it is; by default waiting while `retry` counts down, then
   * retrying, else failed.
   */
  status?: MessageErrorStatus | undefined
  /**
   * The tries: the next the app has planned, when (`at`, a time in ms)
   * and which; or, given up, how many there were (`attempts`).
   */
  retry?:
    | {
        at?: number | undefined
        attempt?: number | undefined
        attempts?: number | undefined
      }
    | undefined
  /** Tries again now: a "Retry now" button. */
  onRetry?: (() => void) | undefined
  /** The app's actions in its place, e.g. a "Continue" `Button`, or several. */
  action?: React.ReactNode
  labels?: Partial<MessageErrorLabels> | undefined
}) {
  const labels = { ...defaultMessageErrorLabels, ...labelsProp }
  const seconds = useSecondsLeft(retry?.at)
  const status: MessageErrorStatus =
    statusProp ??
    (retry?.at !== undefined
      ? seconds > 0
        ? "waiting"
        : "retrying"
      : "failed")
  const counting = status === "waiting" || status === "retrying"
  const attempt =
    counting && retry?.attempt !== undefined
      ? ` · ${labels.attempt(retry.attempt, retry.attempts)}`
      : null
  // What its status says, before what it means.
  const said =
    status === "exhausted"
      ? labels.exhausted(retry?.attempts ?? retry?.attempt)
      : status === "cancelled"
        ? labels.cancelled
        : status === "unknown"
          ? labels.unknown
          : null
  const detail = counting ? (
    <>
      {/* Read once, not every second: the countdown is for the eye. */}
      <span aria-hidden="true" className="tabular-nums">
        {status === "waiting" && seconds > 0
          ? labels.retryingIn(seconds)
          : labels.retrying}
      </span>
      <span className="sr-only">{labels.retrying}</span>
      {attempt}
    </>
  ) : said !== null ? (
    <>
      <span data-slot="message-error-status">{said}</span>
      {description ? <span className="block">{description}</span> : null}
    </>
  ) : (
    description
  )
  return (
    <Alert
      data-slot="message-error"
      data-status={status}
      className={cn(
        // Its parts at the top: the buttons (the app's actions) level
        // with the title, not centred on the title and its line under it.
        "flex flex-wrap items-start gap-2 rounded-lg bg-transparent p-3",
        className
      )}
      {...props}
    >
      {status === "retrying" ? (
        // In the mark's place, as large.
        <Spinner aria-hidden="true" className="size-4 shrink-0" />
      ) : (
        <HugeiconsIcon
          icon={statusIcons[status]}
          strokeWidth={2}
          aria-hidden="true"
        />
      )}
      <div className="min-w-0 flex-1 basis-0">
        <div data-slot="message-error-title" className="font-medium">
          {title}
        </div>
        {detail && (
          <div
            data-slot="message-error-description"
            className="text-xs/5 text-subtle-foreground"
          >
            {detail}
          </div>
        )}
      </div>
      {action ? (
        <div
          data-slot="message-error-actions"
          // Several wrap under one another's end; on a narrow card, a
          // line of their own under its words, where they start.
          className="flex shrink-0 flex-wrap justify-end gap-2 @max-md/alert:order-last @max-md/alert:basis-full @max-md/alert:justify-start @max-md/alert:ps-6"
        >
          {action}
        </div>
      ) : (
        onRetry && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={onRetry}
          >
            {labels.retryNow}
          </Button>
        )
      )}
    </Alert>
  )
}

export { MessageError, type MessageErrorLabels, type MessageErrorStatus }
