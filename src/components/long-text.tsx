"use client"

import * as React from "react"

import { CopyButton } from "@/components/copy-button"
import { Button } from "@/components/ui/button"

type LongTextLabels = {
  /** A folded run's button: "Show 261,120 more characters". */
  longRunMore: (characters: number) => string
  /** Its copy button, of the run whole. */
  longRunCopy: string
}

const defaultLongTextLabels: LongTextLabels = {
  longRunMore: (characters) =>
    `Show ${characters.toLocaleString("en")} more ${characters === 1 ? "character" : "characters"}`,
  longRunCopy: "Copy all",
}

/**
 * Characters in a row without a space, past which they fold: a long
 * address, base64, a hash. A browser lays such a run out as one word
 * broken anywhere, in time that grows with it (WebKit) or, with the
 * system font's kerning, with its square (Chromium: 256 KiB of one
 * letter, 3s a layout). Folded, a layout is bounded whatever the text.
 */
const longRun = 1024
/** Of a folded run, the characters shown; each Show more's, more. */
const runHead = 512
const runStep = 16384

const longRunPattern = new RegExp(`\\S{${longRun + 1},}`, "g")

/**
 * A run of `longRun` characters or more without a space: its first 512,
 * an ellipsis, a button for 16,384 more at a time and one to copy it
 * whole. Kerned not, as kerning makes a long run's layout quadratic in
 * Chromium. In a link (`plain`), only its start: a button cannot be in a
 * link, and the link has it whole.
 */
function LongRun({
  text,
  plain = false,
  labels,
}: {
  text: string
  plain?: boolean
  labels: LongTextLabels
}) {
  const [shown, setShown] = React.useState(runHead)
  const rest = text.length - shown
  return (
    <span data-slot="long-run" className="[font-kerning:none]">
      {rest > 0 ? text.slice(0, shown) : text}
      {rest > 0 ? (
        <>
          <span aria-hidden>…</span>
          {plain ? null : (
            <span
              data-slot="long-run-actions"
              // Kept together after the ellipsis, on the text's line.
              className="ms-1 inline-flex items-center gap-1 align-middle font-sans whitespace-nowrap [font-kerning:auto]"
            >
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => setShown((was) => was + runStep)}
              >
                {labels.longRunMore(rest)}
              </Button>
              <CopyButton
                value={text}
                size="icon-xs"
                labels={{ copy: labels.longRunCopy }}
              />
            </span>
          )}
        </>
      ) : null}
    </span>
  )
}

/**
 * Text as it is, but where it runs past 1,024 characters without a
 * space: folded (`LongRun`), so its layout stays bounded. For text
 * shown as it was written, e.g. a sent message's (`ComposerMessage`);
 * `Markdown` folds its own.
 */
function LongText({
  children,
  labels,
}: {
  children: string
  labels?: Partial<LongTextLabels> | undefined
}) {
  if (children.length <= longRun) return children
  const all = { ...defaultLongTextLabels, ...labels }
  const parts: React.ReactNode[] = []
  let at = 0
  for (const match of children.matchAll(longRunPattern)) {
    if (match.index > at) parts.push(children.slice(at, match.index))
    parts.push(<LongRun key={match.index} text={match[0]} labels={all} />)
    at = match.index + match[0].length
  }
  if (at === 0) return children
  if (at < children.length) parts.push(children.slice(at))
  return <>{parts}</>
}

export {
  defaultLongTextLabels,
  LongRun,
  longRun,
  longRunPattern,
  LongText,
  type LongTextLabels,
}
