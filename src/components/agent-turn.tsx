"use client"

import * as React from "react"
import { useFollowEnd } from "@/hooks/use-follow-end"
import { useShimmerPause } from "@/hooks/use-shimmer-pause"
import { cn } from "cn"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AiBrain01Icon,
  Alert02Icon,
  ArrowDown01Icon,
  ArrowReloadHorizontalIcon,
  ArrowExpand01Icon,
  BookOpen01Icon,
  CommandLineIcon,
  File01Icon,
  Folder01Icon,
  PencilEdit01Icon,
  Search01Icon,
  SecurityCheckIcon,
  StopCircleIcon,
  Wifi01Icon,
  WifiDisconnected02Icon,
  Wrench01Icon,
} from "@hugeicons/core-free-icons"

import { describeCommand, type DescribedCommand } from "@/lib/describe-command"
import { parseUnifiedDiff, type DiffFile } from "@/lib/unified-diff"
import { FoldFindText, useFold } from "@/hooks/use-fold"
import { Clamp, type ClampLabels } from "@/components/clamp"
import { nodeText } from "@/components/search-highlight"
import { CopyButton } from "@/components/copy-button"
import { DiffFileContent } from "@/components/diff-block"
import {
  AgentEvent,
  type AgentEventData,
  type AgentEventLabels,
} from "@/components/agent-event"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import {
  CodeBlock,
  CodeBlockContent,
  CodeBlockLine,
} from "@/components/ui/code-block"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"

// A fold the reader opens or closes: its line stays where it is on
// screen while its panel changes height, the nearest scroller scrolled
// as it does (the browser's scroll anchoring keeps what is seen under it
// still instead, when the line is out of sight above). Not while a
// message scroller is at its live end, which it keeps; the reader
// scrolling ends it.
const keeps = new WeakMap<Element, () => void>()

function keepInPlace(
  element: HTMLElement,
  // Read each frame: a closed panel mounts as it opens.
  panelOf: () => HTMLElement | null
) {
  let container: Element | null = element.parentElement
  while (container) {
    if (
      /^(auto|scroll|overlay)$/.test(getComputedStyle(container).overflowY) &&
      container.scrollHeight > container.clientHeight
    )
      break
    container = container.parentElement
  }
  container ??= document.scrollingElement
  if (!container) return
  keeps.get(container)?.()
  if (
    container.matches("[data-slot=message-scroller-viewport]") &&
    !container.getAttribute("data-scrollable")?.split(/\s+/).includes("end")
  )
    return

  const scroller = container
  const target = scroller === document.scrollingElement ? window : scroller
  const top = element.getBoundingClientRect().top
  const started = performance.now()
  let frame = 0
  let settled = 0
  const stop = () => {
    cancelAnimationFrame(frame)
    target.removeEventListener("wheel", stop)
    target.removeEventListener("touchmove", stop)
    target.removeEventListener("pointerdown", stop)
    target.removeEventListener("keydown", key)
    if (keeps.get(scroller) === stop) keeps.delete(scroller)
  }
  const key = (event: Event) => {
    if (
      [
        "ArrowUp",
        "ArrowDown",
        "PageUp",
        "PageDown",
        "Home",
        "End",
        " ",
      ].includes((event as KeyboardEvent).key)
    )
      stop()
  }
  const tick = () => {
    if (!element.isConnected || performance.now() - started >= 1000) {
      stop()
      return
    }
    const delta = element.getBoundingClientRect().top - top
    if (Math.abs(delta) > 0.5) scroller.scrollTop += delta
    // Closed, the panel is unmounted: nothing moves any more.
    const panel = panelOf()
    const moving =
      panel?.isConnected &&
      (panel.getAnimations().length > 0 ||
        panel.hasAttribute("data-starting-style") ||
        panel.hasAttribute("data-ending-style"))
    settled = moving ? 0 : settled + 1
    if (settled >= 2) stop()
    else frame = requestAnimationFrame(tick)
  }
  keeps.set(scroller, stop)
  frame = requestAnimationFrame(() => {
    for (const type of ["wheel", "touchmove", "pointerdown"])
      target.addEventListener(type, stop, { once: true, passive: true })
    target.addEventListener("keydown", key)
    tick()
  })
}

type AgentReasoning = {
  type: "reasoning"
  id: string
  /** Streamed as it comes; its newest line is shown while it runs. */
  text: string
  status: "running" | "done"
  /** How long it took, as the app words it ("12s"). */
  duration?: string
}

/**
 * The kinds of tool call the turn knows: it words them, counts them and
 * folds them together. A "command" is read by `describeCommand`, so a
 * `cat` is a read and a `sed -i` an edit.
 */
type AgentToolKind = "read" | "search" | "list" | "edit" | "write" | "command"

type AgentToolCall = {
  type: "tool"
  id: string
  /** "waiting": for the reader, e.g. a permission. */
  status: "running" | "waiting" | "done" | "error"
  /**
   * What it does: one of `AgentToolKind`, which the turn words, or the
   * app's own (a subagent's "agent", "web"), counted by `kinds`.
   */
  kind?: AgentToolKind | (string & {})
  /** A shell command, as the agent typed it: shown whole when opened. */
  command?: string
  /** The agent's own words for what it does ("Type-check the app"). */
  description?: string
  /** The file it read, edited or wrote; the folder it listed. */
  path?: string
  /** What it searched for. */
  pattern?: string
  /** The lines an edit or a write added and removed. */
  added?: number
  removed?: number
  /** An edit's or a write's change, as a unified diff. */
  diff?: string
  /** What a command wrote: its last lines are shown when opened. */
  output?: string
  /**
   * The source cut its output: "start" when what is given is its end
   * (a tail kept), "end" when it is its start (a head kept). A line says so
   * where the cut was.
   */
  outputTruncated?: "start" | "end" | undefined
  /** Its output is being fetched, as from a history without it. */
  outputLoading?: boolean
  /** A command's exit code: "Exit 2" at its line's end if it failed. */
  exitCode?: number
  /**
   * Its icon, in place of its kind's (a book for a read, a terminal for a
   * command); without either, a wrench. A spinner while it runs, a shield
   * while it waits for the reader.
   */
  icon?: React.ReactNode
  /**
   * Its words, in place of those the turn gives its kind: a subagent's
   * "Exploring the build scripts". What it acted on may be an
   * `AgentTurnTarget`.
   */
  title?: React.ReactNode
  /** How long it took, as the app words it ("0.2s"): on hover. */
  duration?: string
  /**
   * What came of it, at the line's end, in place of the turn's ("Exit 1",
   * "+2 −2"): a subagent's "3 steps".
   */
  outcome?: React.ReactNode
  /**
   * What it is at now, a line under its words while it is closed: a
   * subagent's step ("Reading scripts/build.ts"). It shimmers while the
   * call runs.
   */
  progress?: React.ReactNode
  /**
   * Shown when it is opened, in place of the turn's (its command and
   * output, its diff): a subagent's `AgentTurn`, which shows its parts
   * under the call's words.
   */
  details?: React.ReactNode
  /**
   * What it viewed or made for the reader to see, e.g. a `MediaGallery`
   * of the screenshots it took: under its line, opened or not, and kept
   * in sight after its run's line (or the work's title) while those are
   * folded.
   */
  media?: React.ReactNode
}

/** What the agent said or showed: text, an image it made, a video. */
type AgentContent = {
  type: "content"
  id: string
  /** The app renders it, e.g. Markdown, a `MediaGallery`. */
  content: React.ReactNode
}

/**
 * What the reader decided when the agent asked, a step among the others:
 * a permission allowed or denied, a question answered. Allowed and denied
 * look the same, only the words differ.
 */
type AgentDecision = {
  type: "decision"
  id: string
  /** In the app's words: "Allowed git push origin main", "Denied rm -rf dist". */
  title: React.ReactNode
  /** Before its words: a shield, a "?". */
  icon: React.ReactNode
  /** At the line's end: "Once · by you". */
  meta?: React.ReactNode
  /** Shown when it is opened: the request as it was. */
  details?: React.ReactNode
}

/** A step of the turn's work, one line. */
type AgentStep = AgentReasoning | AgentToolCall | AgentDecision

/** What the user sent into the turn while it ran (a steer). */
type AgentSteer = {
  type: "steer"
  id: string
  /** Their words, as the app renders them. */
  content: React.ReactNode
  /** When it was sent (ms since the epoch): the work after it counts from it. */
  startedAt?: number | undefined
  /**
   * How long the agent worked after it, as the app words it from its own
   * timestamps ("40s"): the work after it is "Worked for 40s" once over.
   */
  duration?: string | undefined
  /**
   * The first steer's: how long the agent worked before it, from the
   * turn's start ("2m 10s"): the work before it is "Worked for 2m 10s".
   */
  before?: string | undefined
}

/**
 * An attempt the agent cut off and replaced (a steer cut it off, a retry
 * replaced it): one line, "Superseded attempt · Cut off by a steer", its
 * parts shown when opened. Do not mark an attempt whose reply finished:
 * the reader needs it.
 */
type AgentSuperseded = {
  type: "superseded"
  id: string
  /** Its parts, as a turn's (runs, what it said). */
  parts: AgentTurnPart[]
  /**
   * Why, in the app's words, after its line's title; without it,
   * `labels.cutOffBySteer` when a steer comes right after it, else nothing.
   */
  reason?: React.ReactNode
  /** Its parts are not here yet: as the turn's `steps`. */
  steps?: "deferred" | "loading" | "error" | undefined
  /** Loads its parts: called when it is opened while "deferred", and by Retry. */
  onLoadSteps?: () => void
}

/**
 * What came to the agent from outside while it worked: a line of a stream
 * it watches, a background task's end, a wake-up (an `AgentEvent`). Where
 * it came, among the rest; not folded into a run of steps.
 */
type AgentTurnEvent = AgentEventData & {
  type: "event"
  id: string
  /** Its own words, over the turn's (`labels.event`). */
  labels?: Partial<AgentEventLabels> | undefined
}

type AgentTurnPart =
  AgentStep | AgentContent | AgentSteer | AgentSuperseded | AgentTurnEvent

/**
 * What a run's calls did, counted for its line: files once each,
 * however often they were read or edited.
 */
type AgentWorkCount = {
  /** Files read. */
  read: number
  /** Searches and listings. */
  searched: number
  listed: number
  /** Files edited or written. */
  edited: number
  /** Commands run (not those read as reads, searches or edits). */
  ran: number
  /** Calls of no kind the turn knows or `kinds` names. */
  other: number
}

/** A step's state, as its words say it. */
type AgentStepState = "done" | "running" | "waiting" | "stopped"

type AgentTurnLabels = {
  /**
   * Before a steer's words, for screen readers, and the bar over a long
   * one opened and scrolled past its start: "You".
   */
  steer: string
  /** A long steer's fold: "Show all", "Show less", "N lines". */
  steerClamp: Partial<ClampLabels>
  /** A superseded attempt's line: "Superseded attempt". */
  superseded: string
  /** After it, when a steer comes right after it: "Cut off by a steer". */
  cutOffBySteer: string
  /**
   * An event part's words (an `AgentEvent`'s): its kinds' sources and
   * "Failed", "Stopped".
   */
  event: Partial<AgentEventLabels>
  /**
   * Its title while it runs, then how long it has run (from `startedAt`,
   * else the turn's `duration`) and the app's `metrics`.
   */
  working: string
  /** Its link to the agent lost, trying again: "Reconnecting 2/5". */
  reconnecting: (attempt: number, attempts: number | undefined) => string
  /** Its link to the agent lost, no longer trying. */
  offline: string
  /** Its title once over, with the turn's `duration` if it has one. */
  worked: (duration: string | undefined) => string
  failed: (duration: string | undefined) => string
  stopped: (duration: string | undefined) => string
  /** Its title while it thinks, in place of `working`. */
  thinking: string
  /**
   * How long it has run, in its title while it runs (from `startedAt`):
   * "12s", "1m 05s".
   */
  elapsed: (seconds: number) => string
  /** A thought's line, once it is over: "Thought for 12s". */
  thought: (duration: string | undefined) => string
  /**
   * A kind's verb, before what it acted on: "Read", "Reading", "Wants to
   * run", "Stopped while running".
   */
  verb: (kind: AgentToolKind, state: AgentStepState) => string
  /** After a verb, for several files: "3 files" ("Read 3 files"). */
  files: (files: number) => string
  /** After a command's verb, for one the agent did not describe. */
  script: string
  /** A call of the app's kind with no title or description. */
  tool: string
  /**
   * A run's line, what its calls did: "Explored 6 files, edited 4, ran
   * 4 commands"; `kinds` is what the app's kinds say ("explored with 3
   * agents"). Past three groups, `count` and `kinds` keep three, dropped
   * in this order of priority: other tools, the app's kinds (the last
   * seen first), reads with searches and listings, commands, edits;
   * `others` is then `otherActions` of what the rest did ("6 other
   * actions"), else "". Empty if it did nothing to tell.
   */
  summary: (count: AgentWorkCount, kinds: string[], others: string) => string
  /** What a run's line leaves out, at its end: "6 other actions". */
  otherActions: (actions: number) => string
  /** The line over reads, searches and listings in a row: "Read 6 files, searched 3 times". */
  looked: (count: AgentWorkCount) => string
  /** A run's line where its calls say nothing: "4 steps". */
  steps: (steps: number) => string
  /** At a run's line's end: "1 failed" (on a phone, the number alone). */
  failures: (calls: number) => string
  /** A file's edits, merged: "4 edits". */
  edits: (edits: number) => string
  /** What an edit added and removed: "+38 −12". */
  changes: (added: number, removed: number) => string
  /** A failed command's end: "Exit 2". */
  exit: (code: number) => string
  /** A failed call's end with nothing more to say. */
  error: string
  /** A waiting call's end. */
  waiting: string
  /** Under a command's last lines: "Show 2 earlier lines". */
  earlierLines: (lines: number) => string
  /** Under a diff cut short: "Show all 50 lines". */
  allLines: (lines: number) => string
  /** Where the source cut the start of its output. */
  outputTruncatedStart: string
  /** Where the source cut the end of its output. */
  outputTruncatedEnd: string
  /** A finished command printed nothing. */
  noOutput: string
  /** Its output is being fetched. */
  loadingOutput: string
  /** Its steps are being fetched. */
  loadingSteps: string
  /** Its steps could not be loaded. */
  stepsFailed: string
  /** Tries to load its steps again. */
  retry: string
  copy: string
  copied: string
  /** The button that opens a call in the app's view (`onExpand`). */
  expand: string
  /** Over what a subagent handed back (`AgentTurnResult`). */
  result: string
}

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`

const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1)

const times = (count: number) =>
  count === 1 ? "once" : count === 2 ? "twice" : `${count} times`

const verbs: Record<AgentToolKind, [string, string, string]> = {
  read: ["Read", "Reading", "read"],
  search: ["Searched for", "Searching for", "search for"],
  list: ["Listed files in", "Listing files in", "list files in"],
  edit: ["Edited", "Editing", "edit"],
  write: ["Wrote", "Writing", "write"],
  command: ["Ran", "Running", "run"],
}

const defaultLabels: AgentTurnLabels = {
  steer: "You",
  steerClamp: {},
  superseded: "Superseded attempt",
  cutOffBySteer: "Cut off by a steer",
  event: {},
  working: "Working",
  reconnecting: (attempt, attempts) =>
    attempts === undefined
      ? `Reconnecting ${attempt}`
      : `Reconnecting ${attempt}/${attempts}`,
  offline: "Disconnected",
  worked: (duration) => (duration ? `Worked for ${duration}` : "Worked"),
  failed: (duration) => (duration ? `Failed after ${duration}` : "Failed"),
  stopped: (duration) => (duration ? `Stopped after ${duration}` : "Stopped"),
  thinking: "Thinking",
  elapsed: (seconds) =>
    seconds < 60
      ? `${seconds}s`
      : `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`,
  thought: (duration) => (duration ? `Thought for ${duration}` : "Thought"),
  verb: (kind, state) => {
    const [done, running, base] = verbs[kind]
    if (state === "running") return running
    if (state === "waiting") return `Wants to ${base}`
    if (state === "stopped")
      return `Stopped while ${running.charAt(0).toLowerCase()}${running.slice(1)}`
    return done
  },
  files: (files) => plural(files, "file"),
  script: "a script",
  tool: "Used a tool",
  otherActions: (actions) => plural(actions, "other action"),
  summary: (count, kinds, others) => {
    const phrases: string[] = []
    if (count.read > 0) phrases.push(`explored ${plural(count.read, "file")}`)
    else if (count.searched > 0)
      phrases.push(`searched ${times(count.searched)}`)
    else if (count.listed > 0) phrases.push("listed files")
    if (count.edited > 0)
      phrases.push(
        phrases.length > 0
          ? `edited ${count.edited}`
          : count.edited === 1
            ? "edited a file"
            : `edited ${count.edited} files`
      )
    if (count.ran > 0)
      phrases.push(
        count.ran === 1 ? "ran a command" : `ran ${count.ran} commands`
      )
    phrases.push(...kinds)
    if (count.other > 0)
      phrases.push(
        count.other === 1 ? "used a tool" : `used ${count.other} tools`
      )
    if (phrases.length === 0) return ""
    return capitalize(phrases.join(", ") + (others ? ` and ${others}` : ""))
  },
  looked: (count) => {
    const phrases: string[] = []
    if (count.read > 0) phrases.push(`read ${plural(count.read, "file")}`)
    if (count.searched > 0) phrases.push(`searched ${times(count.searched)}`)
    if (count.listed > 0)
      phrases.push(`listed ${plural(count.listed, "folder")}`)
    return capitalize(phrases.join(", "))
  },
  steps: (steps) => plural(steps, "step"),
  failures: (calls) => `${calls} failed`,
  edits: (edits) => plural(edits, "edit"),
  changes: (added, removed) => `+${added} −${removed}`,
  exit: (code) => `Exit ${code}`,
  error: "Failed",
  waiting: "Waiting for you",
  earlierLines: (lines) =>
    `Show ${lines} earlier ${lines === 1 ? "line" : "lines"}`,
  allLines: (lines) => `Show all ${plural(lines, "line")}`,
  outputTruncatedStart: "Earlier output not shown",
  outputTruncatedEnd: "Later output not shown",
  noOutput: "No output",
  loadingOutput: "Loading output…",
  loadingSteps: "Loading steps",
  stepsFailed: "Could not load the steps",
  retry: "Retry",
  copy: "Copy command",
  copied: "Copied",
  expand: "Expand",
  result: "Result",
}

/**
 * How a line of a command's output reads: `strong`, what failed (in the
 * foreground, heavier); `plain`, the output (muted); `faint`, what passed
 * and the run's tally (the faintest grey).
 */
type AgentOutputTone = "strong" | "plain" | "faint"

/**
 * The tone of a line of output, by what most tools print: a cross, FAIL
 * or an error's name ("error TS2305:", "TypeError:", "npm ERR!") is
 * strong; a tick, PASS and a tally ("Tests 1 failed | 41 passed", "Found
 * 1 error", "Done in 3s") faint; the rest plain. Wrap it for a tool of
 * the app's own (`outputTone`).
 */
function agentOutputTone(line: string): AgentOutputTone {
  const text = line.trim()
  if (
    /^(?:[✓✔√]|PASS\b|ok\b|Tests?\b|Test Files\b|Found \d|Done\b|Duration\b|Time:)/.test(
      text
    )
  )
    return "faint"
  if (
    /^(?:[✗✘×✖]|FAIL\b|fatal:|panic:)/.test(text) ||
    /\b(?:error|[A-Z]\w*Error)(?: [A-Z]+\d+)?:|\bERR!/.test(text)
  )
    return "strong"
  return "plain"
}

const toneClass: Record<AgentOutputTone, string> = {
  strong: "font-semibold text-foreground",
  plain: "text-muted-foreground",
  faint: "text-subtle-foreground",
}

/** What the turn's parts share: its words, the app's kinds, and more. */
type TurnContextValue = {
  labels: AgentTurnLabels
  kinds: Record<string, (calls: number) => string>
  outputTone: (line: string, call: AgentToolCall) => AgentOutputTone
  /** Failed calls that a later one made good (the same command ran). */
  resolved: ReadonlySet<string>
  /**
   * A subagent's turn, in its step's details: its steps listed as they
   * came, with no line over them, as its step's words are that line.
   */
  flat: boolean
  /** The turn stopped or failed: what still ran stopped there. */
  ended: boolean
  /**
   * Its link to the agent lost (`connection`): what runs is not seen
   * going, its spinners and shimmer still.
   */
  stalled: boolean
  onExpand: ((call: AgentToolCall) => void) | undefined
  /**
   * The reader opened or closed something in it: a running turn then
   * stays open when it ends, as they left it.
   */
  touch: () => void
}

const TurnContext = React.createContext<TurnContextValue>({
  labels: defaultLabels,
  kinds: {},
  outputTone: agentOutputTone,
  resolved: new Set(),
  flat: false,
  ended: false,
  stalled: false,
  onExpand: undefined,
  touch: () => {},
})

/**
 * A step alone where a run's line would be: a level under the lines that
 * sum up several, its words a size smaller and a grey fainter.
 */
const SoleStepContext = React.createContext(false)

/**
 * In a step's details: a turn there is a subagent's, which tells its
 * step so (a chevron after the step's words).
 */
const StepDetailsContext = React.createContext<
  ((nests: boolean) => void) | null
>(null)

/** False inside a button (a fold's line): a target there is no link. */
const TargetLinks = React.createContext(true)

/**
 * What a tool call acted on, in its title: a file, a page, a command. In
 * the words' font, a step lighter than its verb ("Ran", "Read"): the
 * faintest grey, the muted one while its step runs. A `file` is
 * underlined with dots; with an `href`, it is a link (a file the app
 * opens), but in a fold's line (the run's or the work's, saying the
 * step under way), a button, where it is its words alone. `code` marks
 * a command; it looks as the rest.
 */
function AgentTurnTarget({
  code = false,
  file = false,
  href,
  className,
  ...props
}: React.ComponentProps<"a"> & { code?: boolean; file?: boolean }) {
  const shared = {
    "data-slot": "agent-turn-target",
    "data-code": code || undefined,
    "data-file": file || undefined,
  }
  const links = React.useContext(TargetLinks)
  if (href === undefined || !links)
    return (
      // A step lighter than its line's words: by its line's state, not its
      // step's, which a subagent's steps in the step's details would take.
      <span
        {...shared}
        className={cn(
          "text-subtle-foreground group-data-[status=running]/agent-turn-line:text-muted-foreground group-data-[status=waiting]/agent-turn-line:text-muted-foreground",
          file &&
            "underline decoration-subtle-foreground/70 decoration-dotted underline-offset-3",
          className
        )}
        {...(props as React.ComponentProps<"span">)}
      />
    )
  return (
    <a
      {...shared}
      href={href}
      className={cn(
        // Over the line's own button, so it is the link that is pressed.
        "relative z-10 rounded-xs text-subtle-foreground underline decoration-muted-foreground/60 decoration-dotted underline-offset-3 outline-none hover:text-foreground hover:decoration-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
        // In words that shimmer, it shimmers itself: a layer of its own,
        // WebKit paints none of their clipped ground in it, and its text,
        // transparent with theirs, was not seen.
        "motion-safe:in-[.shimmer]:shimmer",
        className
      )}
      {...props}
    />
  )
}

/** A path's last part: `src/app.tsx` is `app.tsx`. */
const baseName = (path: string) =>
  path.replace(/\/+$/, "").split("/").at(-1) || path

/** A folder's last two parts: `/tmp/build/out` is `build/out`. */
const folderName = (path: string) =>
  path.replace(/\/+$/, "").split("/").filter(Boolean).slice(-2).join("/") ||
  path

/** What a call did, as the turn tells and counts it. */
type Act =
  | { kind: "read" | "edit" | "write"; paths: string[] }
  | { kind: "search"; pattern: string; paths: string[] }
  | { kind: "list"; path: string }
  | {
      kind: "command"
      line: Extract<DescribedCommand, { kind: "run" | "described" | "script" }>
    }
  | { kind: "other"; name: string | undefined }

function actOf(call: AgentToolCall): Act {
  const paths = call.path !== undefined ? [call.path] : []
  switch (call.kind) {
    case "read":
    case "edit":
    case "write":
      return { kind: call.kind as "read" | "edit" | "write", paths }
    case "search":
      return { kind: "search", pattern: call.pattern ?? "", paths }
    case "list":
      return { kind: "list", path: call.path ?? "." }
    case "command":
    case undefined: {
      if (call.command === undefined && call.kind === undefined)
        return { kind: "other", name: undefined }
      const described = describeCommand(call.command ?? "", call.description)
      if (described.kind === "read" || described.kind === "edit")
        return { kind: described.kind, paths: described.paths }
      if (described.kind === "search" || described.kind === "list")
        return described
      return { kind: "command", line: described }
    }
    default:
      return { kind: "other", name: call.kind }
  }
}

/** The acts of calls, kept by part, so a call is read once per render. */
function useActs() {
  const cache = React.useRef(new WeakMap<AgentToolCall, Act>())
  return React.useCallback((call: AgentToolCall) => {
    let act = cache.current.get(call)
    if (!act) cache.current.set(call, (act = actOf(call)))
    return act
  }, [])
}

const looks = (act: Act) =>
  act.kind === "read" || act.kind === "search" || act.kind === "list"

const icon = (of: Parameters<typeof HugeiconsIcon>[0]["icon"]) => (
  <HugeiconsIcon icon={of} strokeWidth={2} />
)

const kindIcons: Record<Act["kind"], React.ReactNode> = {
  read: icon(BookOpen01Icon),
  search: icon(Search01Icon),
  list: icon(Folder01Icon),
  edit: icon(PencilEdit01Icon),
  write: icon(File01Icon),
  command: icon(CommandLineIcon),
  other: icon(Wrench01Icon),
}

/**
 * A run's rows: a step alone; a file's reads or edits, merged; writes in
 * a row; reads, searches and listings in a row, under one line.
 */
type Row =
  | { type: "step"; key: string; part: AgentStep }
  | {
      type: "file"
      key: string
      kind: "read" | "edit"
      path: string
      calls: AgentToolCall[]
    }
  | { type: "write"; key: string; calls: AgentToolCall[] }
  | { type: "look"; key: string; rows: Row[]; calls: AgentToolCall[] }

const rowCalls = (row: Row): AgentToolCall[] =>
  row.type === "step" ? (row.part.type === "tool" ? [row.part] : []) : row.calls

/**
 * Steps as rows, each thing once. `flat`, in a subagent's details: its
 * reads and searches each a row, not under a line of their own, and a
 * step under way its own row, in the order they came.
 */
function rowsOf(
  steps: AgentStep[],
  act: (call: AgentToolCall) => Act,
  flat = false
) {
  const rows: Row[] = []
  const edits = new Map<string, Extract<Row, { type: "file" }>>()
  let look: Row[] = []
  let lookCalls: AgentToolCall[] = []
  const reads = new Map<string, Extract<Row, { type: "file" }>>()
  const flush = () => {
    const things = look.filter((row) => rowCalls(row).length > 0).length
    if (things >= 2 && !flat)
      rows.push({
        type: "look",
        key: `${lookCalls[0]!.id}:look`,
        rows: look,
        calls: lookCalls,
      })
    else rows.push(...look)
    look = []
    lookCalls = []
    reads.clear()
  }
  for (const part of steps) {
    if (part.type === "reasoning" && look.length > 0) {
      // Thinking between reads does not split them.
      look.push({ type: "step", key: part.id, part })
      continue
    }
    if (part.type !== "tool" || kept(part) || (flat && active(part))) {
      flush()
      rows.push({ type: "step", key: part.id, part })
      continue
    }
    const what = act(part)
    if (looks(what)) {
      lookCalls.push(part)
      if (what.kind === "read" && what.paths.length === 1) {
        const path = what.paths[0]!
        const row = reads.get(path)
        if (row) row.calls.push(part)
        else {
          const created: Extract<Row, { type: "file" }> = {
            type: "file",
            key: part.id,
            kind: "read",
            path,
            calls: [part],
          }
          reads.set(path, created)
          look.push(created)
        }
      } else look.push({ type: "step", key: part.id, part })
      continue
    }
    flush()
    if (what.kind === "edit" && what.paths.length === 1) {
      const path = what.paths[0]!
      const row = edits.get(path)
      if (row) row.calls.push(part)
      else {
        const created: Extract<Row, { type: "file" }> = {
          type: "file",
          key: part.id,
          kind: "edit",
          path,
          calls: [part],
        }
        edits.set(path, created)
        rows.push(created)
      }
      continue
    }
    if (what.kind === "write") {
      const last = rows.at(-1)
      if (last?.type === "write") last.calls.push(part)
      else rows.push({ type: "write", key: part.id, calls: [part] })
      continue
    }
    rows.push({ type: "step", key: part.id, part })
  }
  flush()
  return rows
}

/** It is under way: it runs, or waits for the reader. */
const active = (part: AgentStep) =>
  part.type !== "decision" &&
  (part.status === "running" || part.status === "waiting")

/** What the reader decided or a step showed stays in sight. */
function kept(part: AgentStep): boolean {
  return (
    part.type === "decision" ||
    (part.type === "tool" && part.media != null && part.media !== false)
  )
}

/**
 * A run laid out: the rows under its line, and the steps after it, on
 * their own. Every step under way stands under its line, in any run (one
 * waiting for the reader may have what the agent said after it); while it
 * is the turn's live run (or the one it stopped at), so does the step it
 * is at. A step the reader opened stays where it is.
 */
function layoutRun(
  steps: AgentStep[],
  split: boolean,
  pinned: ReadonlySet<string>,
  act: (call: AgentToolCall) => Act,
  /** The step under way the run's line says: in the run, not under it. */
  inLine?: AgentStep
) {
  const last = steps.at(-1)
  const outside = steps.filter(
    (part) =>
      part !== inLine &&
      (pinned.has(part.id) || active(part) || (split && part === last))
  )
  const inside = steps.filter((part) => !outside.includes(part))
  const rows = rowsOf(inside, act)
  // One row on its own needs no line over it, unless it is the live run's.
  const line = rows.length > 0 && (rows.length >= 2 || split)
  return { rows, outside, line }
}

/** What calls did, counted. */
function countOf(calls: AgentToolCall[], act: (call: AgentToolCall) => Act) {
  const count: AgentWorkCount = {
    read: 0,
    searched: 0,
    listed: 0,
    edited: 0,
    ran: 0,
    other: 0,
  }
  const read = new Set<string>()
  const edited = new Set<string>()
  const others = new Map<string, number>()
  for (const call of calls) {
    const what = act(call)
    if ("paths" in what && what.kind !== "search") {
      const files = what.kind === "read" ? read : edited
      if (what.paths.length === 0) files.add(`#${call.id}`)
      for (const path of what.paths) files.add(path)
    } else if (what.kind === "search") count.searched++
    else if (what.kind === "list") count.listed++
    else if (what.kind === "command") count.ran++
    else if (what.kind === "other" && what.name !== undefined)
      others.set(what.name, (others.get(what.name) ?? 0) + 1)
    else count.other++
  }
  count.read = read.size
  count.edited = edited.size
  return { count, others }
}

/**
 * Keep a run's first three groups by priority (edits, commands, reads,
 * the app's kinds, other tools), counting what the rest did.
 */
function capSummary(
  count: AgentWorkCount,
  others: Map<string, number>,
  kinds: Record<string, (calls: number) => string>
) {
  const phrases: string[] = []
  let kept = 0
  let dropped = 0
  const keep = (amount: number) => {
    if (amount === 0) return false
    if (kept < 3) {
      kept++
      return true
    }
    dropped += amount
    return false
  }
  if (!keep(count.edited)) count.edited = 0
  if (!keep(count.ran)) count.ran = 0
  if (!keep(count.read + count.searched + count.listed)) {
    count.read = count.searched = count.listed = 0
  }
  for (const [name, calls] of others) {
    const say = kinds[name]
    if (say) {
      if (keep(calls)) phrases.push(say(calls))
    } else count.other += calls
  }
  if (!keep(count.other)) count.other = 0
  return { count, phrases, dropped }
}

/** A run's line: what its calls did, in the app's words. */
function useSummary(calls: AgentToolCall[], steps: number) {
  const { labels, kinds } = React.useContext(TurnContext)
  const act = useActs()
  const { count, others } = countOf(calls, act)
  const capped = capSummary(count, others, kinds)
  return (
    labels.summary(
      capped.count,
      capped.phrases,
      capped.dropped > 0 ? labels.otherActions(capped.dropped) : ""
    ) || labels.steps(steps)
  )
}

/** A step's line, a little over its text; on a phone, a finger's. */
const lineClass = "h-7 max-sm:h-9 pointer-coarse:h-9"

/**
 * A step's icon, 16px: a spinner while it runs, a shield while it waits
 * for the reader, a stop where the turn stopped, else its own; its own,
 * still, while the turn's link is lost.
 */
function StepIcon({
  state,
  icon,
}: {
  state: AgentStepState
  icon?: React.ReactNode
}) {
  const { stalled } = React.useContext(TurnContext)
  return (
    <span
      data-slot="agent-turn-step-icon"
      aria-hidden="true"
      className={cn(
        // 14px (16px on a phone) in a 16px column, a grey fainter than
        // the words; one at work or waiting as dark as its words.
        "flex size-4 shrink-0 items-center justify-center [&_svg]:size-3.5 max-sm:[&_svg]:size-4",
        state !== "running" && state !== "waiting" && "text-subtle-foreground"
      )}
    >
      {state === "running" && !stalled ? (
        <Spinner aria-hidden="true" role="presentation" />
      ) : state === "waiting" ? (
        <HugeiconsIcon icon={SecurityCheckIcon} strokeWidth={2} />
      ) : state === "stopped" ? (
        <HugeiconsIcon icon={StopCircleIcon} strokeWidth={2} />
      ) : (
        (icon ?? <HugeiconsIcon icon={Wrench01Icon} strokeWidth={2} />)
      )}
    </span>
  )
}

/** A chevron after words: down when open, right when closed. */
function Chevron({
  open,
  className,
}: {
  open: boolean
  className?: string | undefined
}) {
  return (
    <HugeiconsIcon
      icon={ArrowDown01Icon}
      strokeWidth={2}
      aria-hidden="true"
      data-slot="agent-turn-chevron"
      className={cn(
        "size-3.5 shrink-0 transition-transform motion-reduce:transition-none",
        !open && "-rotate-90",
        className
      )}
    />
  )
}

/** "⚠ Exit 2", "⚠ 1 failed": by weight and shade, not a colour. */
function Failure({ children }: { children: React.ReactNode }) {
  return (
    <span
      data-slot="agent-turn-failure"
      className="flex items-center gap-1 font-medium text-foreground [&_svg]:size-3.5"
    >
      <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} aria-hidden="true" />
      {children}
    </span>
  )
}

/**
 * A step: its icon, its verb and what it acted on, what came of it at the
 * end and, on hover, how long it took; closed, what it is at
 * now under its words; its details, if it has any, open under it.
 */
/**
 * Parts' words as plain text, for a find over closed folds (FoldFindText):
 * what their details show, read from their data, not rendered.
 */
function partsText(
  parts: readonly (AgentTurnPart | { type: "work"; parts: AgentStep[] })[]
): string {
  return parts
    .map((part) => {
      const words =
        part.type === "tool"
          ? [
              nodeText(part.title),
              part.description,
              part.command,
              part.path,
              part.pattern,
              part.output,
              part.diff,
              nodeText(part.outcome),
              nodeText(part.details),
            ]
          : part.type === "reasoning"
            ? [part.text]
            : part.type === "decision"
              ? [
                  nodeText(part.title),
                  nodeText(part.meta),
                  nodeText(part.details),
                ]
              : part.type === "superseded" || part.type === "work"
                ? [partsText(part.parts)]
                : part.type === "event"
                  ? [
                      nodeText(part.source),
                      nodeText(part.title),
                      nodeText(part.meta),
                      nodeText(part.details),
                    ]
                  : [nodeText(part.content)]
      return words.filter(Boolean).join("\n")
    })
    .filter(Boolean)
    .join("\n")
}

function Step({
  id,
  foldKey,
  state,
  status = state,
  verb,
  target,
  icon,
  outcome,
  failed = false,
  duration,
  progress,
  media,
  live = false,
  quiet = false,
  onOpenChange: reportOpen,
  findText,
  children,
}: {
  id?: string | undefined
  /** Its details' fold. */
  foldKey: string
  state: AgentStepState
  /** As its data says: "error" for one that failed. */
  status?: string
  verb: React.ReactNode
  target?: React.ReactNode
  icon?: React.ReactNode
  /** Always seen, at the line's end. */
  outcome?: React.ReactNode
  /** Its outcome is a failure: an alert before it. */
  failed?: boolean
  /** Seen on hover or focus. */
  duration?: string | undefined
  /** Under its words while it is closed; it shimmers while it runs. */
  progress?: React.ReactNode
  /** What it showed, opened or not. */
  media?: React.ReactNode
  /** The step the agent is at: its words shimmer. */
  live?: boolean
  /** A step aside, e.g. a thought: its line in the faintest grey. */
  quiet?: boolean
  /** Told when the reader opens or closes it. */
  onOpenChange?: ((open: boolean) => void) | undefined
  /** Its details' words, for a find while it is closed. */
  findText?: (() => string) | undefined
  children?: React.ReactNode
}) {
  useShimmerPause()
  const { touch, stalled } = React.useContext(TurnContext)
  const sole = React.useContext(SoleStepContext)
  const [open, setOpen] = useFold(foldKey, false)
  const lineRef = React.useRef<HTMLDivElement>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const titleId = React.useId()
  const progressId = React.useId()
  const titleRef = React.useRef<HTMLSpanElement>(null)
  // A subagent's turn in its details, while they are shown.
  const [nests, setNests] = React.useState(false)
  const opens =
    children !== undefined && children !== null && children !== false
  const opened = opens && open
  const progressShown = progress !== undefined && !opened
  const shimmer = live && !stalled && "shimmer motion-reduce:shimmer-none"
  const row = (
    <div
      // Its own group: a subagent's steps, in the step's details, are not
      // in it, so they do not take its hover or state.
      ref={lineRef}
      data-status={state}
      data-open={opened || undefined}
      className={cn(
        "group/agent-turn-line relative grid w-full min-w-0 grid-cols-icon-end items-center gap-x-2",
        lineClass,
        sole && "text-xs",
        opens && "hover:text-foreground"
      )}
      // Cut short, e.g. a long command, its whole text on hover.
      onPointerEnter={(event) => {
        const words = titleRef.current
        if (words && words.scrollWidth > words.clientWidth)
          event.currentTarget.title = words.textContent ?? ""
        else event.currentTarget.removeAttribute("title")
      }}
    >
      <StepIcon state={state} icon={icon} />
      <span className="flex min-w-0 items-center gap-1">
        <span
          ref={titleRef}
          id={titleId}
          data-slot="agent-turn-step-title"
          className="flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap"
        >
          <span
            data-slot="agent-turn-step-verb"
            className={cn(
              target === undefined ? "min-w-0 truncate" : "shrink-0",
              // Opened, its words dark; its icon as it was.
              "group-data-open/agent-turn-line:text-foreground",
              shimmer
            )}
          >
            {verb}
          </span>
          {/* A space for its name and its text; the flex gap lays it out. */}
          {target !== undefined && " "}
          {target !== undefined && (
            <span className={cn("min-w-0 truncate", shimmer)}>{target}</span>
          )}
        </span>
        {opens && (
          <Chevron
            open={opened || nests}
            className={cn(
              "text-subtle-foreground",
              !opened &&
                !nests &&
                "opacity-0 group-focus-within/agent-turn-line:opacity-100 group-hover/agent-turn-line:opacity-100"
            )}
          />
        )}
      </span>
      {(outcome !== undefined || duration !== undefined) && (
        <span
          data-slot="agent-turn-step-meta"
          className="flex shrink-0 items-center gap-2 ps-4 text-xs text-subtle-foreground tabular-nums max-sm:text-2sm"
        >
          {/* Before what came of it, which stays at the line's end; on
              hover or focus only, opened or not: a step's time is asked
              for, not shown. */}
          {duration !== undefined && (
            <span
              data-slot="agent-turn-step-duration"
              className="opacity-0 transition-opacity group-focus-within/agent-turn-line:opacity-100 group-hover/agent-turn-line:opacity-100 motion-reduce:transition-none"
            >
              {duration}
            </span>
          )}
          {outcome !== undefined && (
            <span
              data-slot="agent-turn-step-outcome"
              className="flex items-center gap-1 [&_svg]:size-3.5"
            >
              {failed ? <Failure>{outcome}</Failure> : outcome}
            </span>
          )}
        </span>
      )}
      {opens && (
        // Over the whole line, named by its words.
        <CollapsibleTrigger
          data-slot="agent-turn-step-trigger"
          aria-labelledby={titleId}
          aria-describedby={progressShown ? progressId : undefined}
          className="absolute -inset-x-2 inset-y-0 cursor-pointer rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      )}
    </div>
  )
  const progressLine = progressShown && (
    // Under its words, closer to them than the next line is.
    <div
      id={progressId}
      data-slot="agent-turn-step-progress"
      className="-mt-1 mb-1 flex h-5 min-w-0 items-center ps-6 text-xs text-subtle-foreground max-sm:-mt-2 max-sm:h-6 max-sm:text-sm"
    >
      <span
        className={cn(
          "min-w-0 truncate",
          state === "running" &&
            !stalled &&
            "shimmer motion-reduce:shimmer-none"
        )}
      >
        {progress}
      </span>
    </div>
  )
  return (
    <div
      data-slot="agent-turn-step"
      data-status={status}
      data-part-id={id}
      data-open={opened || undefined}
      className={cn(
        "flex min-w-0 flex-col text-muted-foreground data-[status=running]:text-foreground data-[status=waiting]:text-foreground",
        (quiet || sole) && "text-subtle-foreground"
      )}
    >
      {opens ? (
        <Collapsible
          open={open}
          onOpenChange={(next, details) => {
            if (details.reason === "trigger-press" && lineRef.current)
              keepInPlace(lineRef.current, () => panelRef.current)
            setOpen(next)
            reportOpen?.(next)
            touch()
          }}
          className="flex min-w-0 flex-col"
        >
          {row}
          {progressLine}
          {media != null && media !== false && (
            <div data-slot="agent-turn-step-media" className="ps-6 pb-2">
              {media}
            </div>
          )}
          <CollapsibleContent ref={panelRef} className="min-w-0">
            <div
              data-slot="agent-turn-step-details"
              className={cn(
                "min-w-0 ps-6 leading-6 wrap-break-word text-muted-foreground",
                // A subagent's lines follow the step's, as a run's do.
                nests ? "pb-1" : "pb-2"
              )}
            >
              <StepDetailsContext value={setNests}>
                {/* What it holds, e.g. a subagent's steps, at their size. */}
                <SoleStepContext value={false}>{children}</SoleStepContext>
              </StepDetailsContext>
            </div>
          </CollapsibleContent>
          {!open && findText && (
            <FoldFindText
              text={findText}
              onFound={() => {
                setOpen(true)
                reportOpen?.(true)
                touch()
              }}
            />
          )}
        </Collapsible>
      ) : (
        <>
          {row}
          {progressLine}
          {media != null && media !== false && (
            <div data-slot="agent-turn-step-media" className="ps-6 pb-2">
              {media}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** "Show 2 earlier lines" under code: a quiet row across it. */
function ShowMore({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      data-slot="agent-turn-show-more"
      className={cn(
        "flex h-7 w-full shrink-0 cursor-pointer items-center border-t border-border px-2 text-start text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
        className
      )}
      {...props}
    />
  )
}

/** How many of a command's last lines are shown. */
const outputTail = 4

/**
 * A command opened: the whole of it, wrapped, never cut, to copy (and to
 * open in the app's view); under it, its output's last lines, the earlier
 * ones on request.
 */
function CommandDetails({ call }: { call: AgentToolCall }) {
  const { labels, onExpand, outputTone } = React.useContext(TurnContext)
  const act = useActs()(call)
  const [all, setAll] = React.useState(false)
  const output = call.output?.replace(/\n$/, "")
  const lines = output ? output.split("\n") : []
  const content = React.useRef<HTMLPreElement>(null)
  const follow = React.useRef(true)
  const running = call.status === "running"
  const empty = lines.length === 0
  const loading = empty && call.outputLoading
  const noOutput =
    empty &&
    !loading &&
    call.output !== undefined &&
    (call.status === "done" || call.status === "error")
  React.useLayoutEffect(() => {
    if (all && running && follow.current && content.current)
      content.current.scrollTop = content.current.scrollHeight
  })
  const hidden = all ? 0 : Math.max(0, lines.length - outputTail)
  // Its line says the command ("Ran pnpm test"): over the output it is a
  // label, by a terminal's icon. Its line says what it does ("Type-check
  // the app"): here is the command itself, in code.
  const label = act.kind === "command" && act.line.kind === "run"
  return (
    // A small well, 8px corners, on the side's grey (the page's in dark),
    // as a terminal's.
    <CodeBlock
      size="sm"
      data-slot="agent-turn-command"
      className="mt-0.5 rounded-md bg-sidebar dark:bg-transparent"
    >
      {call.command !== undefined && (
        <div
          data-slot="agent-turn-command-line"
          data-label={label || undefined}
          // 32px over its rule, its buttons on its first line.
          className={cn(
            "flex min-w-0 items-start gap-2 ps-2 pe-1",
            (lines.length > 0 || loading || noOutput) &&
              "border-b border-border"
          )}
        >
          {label && (
            <span className="flex h-8 shrink-0 items-center text-subtle-foreground">
              <HugeiconsIcon
                icon={CommandLineIcon}
                strokeWidth={2}
                aria-hidden="true"
                className="size-3"
              />
            </span>
          )}
          <code
            className={cn(
              "min-w-0 flex-1 py-2 text-xs/4 break-all whitespace-pre-wrap",
              label
                ? "font-sans text-subtle-foreground"
                : "font-mono text-muted-foreground"
            )}
          >
            {call.command}
          </code>
          <span className="flex h-8 shrink-0 items-center">
            <CopyButton
              value={call.command}
              size="icon-xs"
              labels={{ copy: labels.copy, copied: labels.copied }}
            />
            {onExpand && (
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={labels.expand}
                onClick={() => onExpand(call)}
              >
                <HugeiconsIcon icon={ArrowExpand01Icon} strokeWidth={2} />
              </Button>
            )}
          </span>
        </div>
      )}
      {lines.length > 0 && (
        // 12px on 16px lines: smaller lines than code's, as output is
        // read in a glance; each line in its tone.
        <CodeBlockContent
          ref={content}
          onScroll={(event) => {
            const element = event.currentTarget
            follow.current =
              element.scrollHeight - element.scrollTop - element.clientHeight <=
              4
          }}
          className={cn(
            "py-2 leading-4 group-data-[size=sm]/code-block:py-2",
            all && "max-h-80"
          )}
        >
          {call.outputTruncated === "start" && hidden === 0 && (
            <CodeBlockLine
              data-slot="agent-turn-output-truncated"
              data-cut="start"
              className="font-sans text-subtle-foreground"
            >
              {labels.outputTruncatedStart}
            </CodeBlockLine>
          )}
          {lines.slice(hidden).map((line, index) => {
            const tone = outputTone(line, call)
            return (
              <CodeBlockLine
                key={hidden + index}
                data-tone={tone}
                className={toneClass[tone]}
              >
                {line}
              </CodeBlockLine>
            )
          })}
          {call.outputTruncated === "end" && (
            <CodeBlockLine
              data-slot="agent-turn-output-truncated"
              data-cut="end"
              className="font-sans text-subtle-foreground"
            >
              {labels.outputTruncatedEnd}
            </CodeBlockLine>
          )}
        </CodeBlockContent>
      )}
      {(loading || noOutput) && (
        <div
          data-slot={
            loading ? "agent-turn-output-loading" : "agent-turn-output-empty"
          }
          role={loading ? "status" : undefined}
          className="px-2 py-2 font-sans text-xs text-subtle-foreground"
        >
          {loading ? labels.loadingOutput : labels.noOutput}
        </div>
      )}
      {/* The earlier lines, for a find: found, they are shown. */}
      {hidden > 0 && (
        <FoldFindText
          text={() => lines.slice(0, hidden).join("\n")}
          onFound={() => setAll(true)}
        />
      )}
      {hidden > 0 && (
        <ShowMore
          onClick={() => {
            follow.current = true
            setAll(true)
            if (running && content.current)
              content.current.scrollTop = content.current.scrollHeight
          }}
        >
          {labels.earlierLines(hidden)}
        </ShowMore>
      )}
    </CodeBlock>
  )
}

/** A diff as given, its file's headers added if it has none. */
function diffOf(text: string): DiffFile | undefined {
  const withHeaders = /^(?:diff |--- )/m.test(text)
    ? text
    : `--- a\n+++ b\n${text}`
  return parseUnifiedDiff(withHeaders)[0]
}

/** How many of a diff's lines show before "Show all". */
const diffHead = 5

/**
 * A file's changes, merged: the hunks of its edits in the file's order,
 * each line with its number in the new file, the first few lines and the
 * rest on request.
 */
function DiffDetails({ calls }: { calls: AgentToolCall[] }) {
  const { labels } = React.useContext(TurnContext)
  const [all, setAll] = React.useState(false)
  const files = calls.flatMap((call) => {
    const file = call.diff === undefined ? undefined : diffOf(call.diff)
    return file ? [file] : []
  })
  const hunks = files
    .flatMap((file) => file.hunks)
    .sort((a, b) => a.newStart - b.newStart)
    .map((hunk) => ({
      ...hunk,
      header: `@@ ${hunk.newStart}${hunk.section ? ` ${hunk.section}` : ""}`,
    }))
  const total = hunks.reduce((sum, hunk) => sum + hunk.lines.length, 0)
  const shown: typeof hunks = []
  for (
    let left = all ? Infinity : diffHead, at = 0;
    left > 0 && at < hunks.length;
    at++
  ) {
    const hunk = hunks[at]!
    const lines = hunk.lines.slice(0, left)
    left -= lines.length
    shown.push({ ...hunk, lines })
  }
  const merged: DiffFile = {
    oldPath: null,
    newPath: null,
    name: "",
    status: "modified",
    binary: false,
    hunks: shown,
    added: 0,
    removed: 0,
  }
  return (
    <CodeBlock size="sm" data-slot="agent-turn-diff">
      <DiffFileContent
        file={merged}
        className="pt-0 pb-1 group-data-[size=sm]/code-block:pt-0 group-data-[size=sm]/code-block:pb-1"
      />
      {total > diffHead && !all && (
        <ShowMore onClick={() => setAll(true)}>
          {labels.allLines(total)}
        </ShowMore>
      )}
    </CodeBlock>
  )
}

/** A call's details by what it did: its diff, or its command and output. */
function detailsOf(calls: AgentToolCall[]): React.ReactNode {
  const first = calls[0]
  if (!first) return undefined
  if (calls.length === 1 && first.details !== undefined) return first.details
  if (calls.some((call) => call.diff !== undefined))
    return <DiffDetails calls={calls} />
  if (
    calls.length === 1 &&
    (first.command !== undefined ||
      first.output !== undefined ||
      first.outputLoading)
  )
    return <CommandDetails call={first} />
  return undefined
}

/** A file's name in a line, its whole path on hover. */
function FileTarget({ path }: { path: string }) {
  return (
    <AgentTurnTarget file title={path}>
      {baseName(path)}
    </AgentTurnTarget>
  )
}

/** The state a step's words are in: in a stopped turn, what ran stopped. */
function useStepState(
  status: AgentToolCall["status"] | "done"
): AgentStepState {
  const { ended } = React.useContext(TurnContext)
  if (status === "running" || status === "waiting")
    return ended ? "stopped" : status
  return "done"
}

/** What came at a call's end: the app's, else its exit, failed or waiting. */
function useOutcome(call: AgentToolCall, state: AgentStepState) {
  const { labels } = React.useContext(TurnContext)
  if (call.status === "error")
    return {
      failed: true,
      outcome:
        call.outcome ??
        (call.exitCode !== undefined
          ? labels.exit(call.exitCode)
          : labels.error),
    }
  if (state === "waiting")
    return { failed: false, outcome: call.outcome ?? labels.waiting }
  return { failed: false, outcome: call.outcome }
}

/** A tool call's words: what it does or did, and to what. */
function useCallWords(part: AgentToolCall) {
  const { labels } = React.useContext(TurnContext)
  const act = useActs()(part)
  const state = useStepState(part.status)
  const { failed, outcome: given } = useOutcome(part, state)
  let verb: React.ReactNode
  let target: React.ReactNode
  let outcome = given
  if (part.title !== undefined) verb = part.title
  else if (act.kind === "read" || act.kind === "edit" || act.kind === "write") {
    verb = labels.verb(act.kind, state)
    if (act.paths.length === 1) target = <FileTarget path={act.paths[0]!} />
    else if (act.paths.length > 1)
      verb = `${verb} ${labels.files(act.paths.length)}`
    if (
      outcome === undefined &&
      act.kind !== "read" &&
      (part.added !== undefined || part.removed !== undefined)
    )
      outcome = labels.changes(part.added ?? 0, part.removed ?? 0)
  } else if (act.kind === "search") {
    verb = labels.verb("search", state)
    target = (
      <AgentTurnTarget code title={act.paths.join(" ") || undefined}>
        {act.pattern}
      </AgentTurnTarget>
    )
  } else if (act.kind === "list") {
    verb = labels.verb("list", state)
    target = (
      <AgentTurnTarget title={act.path}>{folderName(act.path)}</AgentTurnTarget>
    )
  } else if (act.kind === "command") {
    const line = act.line
    if (state === "waiting" && part.command !== undefined) {
      // What the reader is asked to allow: the command itself.
      verb = labels.verb("command", state)
      target = (
        <AgentTurnTarget code title={part.command}>
          {part.command.trim().split("\n")[0]}
        </AgentTurnTarget>
      )
    } else if (line.kind === "run") {
      verb = labels.verb("command", state)
      target = <AgentTurnTarget code>{line.command}</AgentTurnTarget>
    } else if (line.kind === "described") {
      // The agent's words, the same while it runs and once done.
      if (state === "stopped" || state === "waiting") {
        verb = labels.verb("command", state)
        target = <AgentTurnTarget>{line.description}</AgentTurnTarget>
      } else verb = line.description
    } else verb = `${labels.verb("command", state)} ${labels.script}`
  } else verb = part.description ?? labels.tool
  return { act, state, failed, verb, target, outcome }
}

/**
 * The live run's step under way, as its line: its words in place of the
 * run's sum, each step's in turn, shimmering.
 */
function LiveCall({ part }: { part: AgentToolCall }) {
  const { verb, target } = useCallWords(part)
  const { stalled } = React.useContext(TurnContext)
  const shimmer = !stalled && "shimmer motion-reduce:shimmer-none"
  return (
    <span className="flex min-w-0 items-center gap-1 text-foreground">
      <span
        className={cn(
          target === undefined ? "min-w-0 truncate" : "shrink-0",
          shimmer
        )}
      >
        {verb}
      </span>
      {target !== undefined && " "}
      {target !== undefined && (
        <span className={cn("min-w-0 truncate", shimmer)}>{target}</span>
      )}
    </span>
  )
}

/** A tool call on its own line. */
function ToolCall({
  part,
  live = false,
  onOpenChange,
}: {
  part: AgentToolCall
  live?: boolean
  onOpenChange?: ((open: boolean) => void) | undefined
}) {
  const { act, state, failed, verb, target, outcome } = useCallWords(part)
  return (
    <Step
      id={part.id}
      foldKey={part.id}
      state={state}
      status={part.status === "error" ? "error" : state}
      icon={part.icon ?? kindIcons[act.kind]}
      verb={verb}
      target={target}
      outcome={outcome}
      failed={failed}
      duration={part.duration}
      progress={part.progress}
      media={part.media}
      // With a progress line, that line shimmers.
      live={live && state === "running" && part.progress === undefined}
      onOpenChange={onOpenChange}
      findText={() => partsText([part])}
    >
      {detailsOf([part])}
    </Step>
  )
}

/** A file read or edited more than once: one line. */
function FileRow({ row }: { row: Extract<Row, { type: "file" }> }) {
  const { labels } = React.useContext(TurnContext)
  const first = row.calls[0]!
  if (row.calls.length === 1) return <ToolCall part={first} />
  const failed = row.calls.at(-1)!.status === "error"
  const sum = (key: "added" | "removed") =>
    row.calls.reduce((total, call) => {
      if (call[key] !== undefined) return total + call[key]
      const file = call.diff === undefined ? undefined : diffOf(call.diff)
      return total + (file?.[key] ?? 0)
    }, 0)
  const lines = row.calls.some(
    (call) =>
      call.added !== undefined ||
      call.removed !== undefined ||
      call.diff !== undefined
  )
  const outcome =
    row.kind === "edit"
      ? [
          labels.edits(row.calls.length),
          ...(lines ? [labels.changes(sum("added"), sum("removed"))] : []),
        ].join(" · ")
      : undefined
  return (
    <Step
      id={first.id}
      foldKey={first.id}
      state="done"
      status={failed ? "error" : "done"}
      icon={first.icon ?? kindIcons[row.kind]}
      verb={labels.verb(row.kind, "done")}
      target={<FileTarget path={row.path} />}
      outcome={outcome}
      failed={false}
      findText={() => (row.kind === "edit" ? partsText(row.calls) : "")}
    >
      {row.kind === "edit" ? detailsOf(row.calls) : undefined}
    </Step>
  )
}

/** Files written one after another: one line, "Wrote a.py, b.py". */
function WriteRow({ row }: { row: Extract<Row, { type: "write" }> }) {
  const { labels } = React.useContext(TurnContext)
  const act = useActs()
  const first = row.calls[0]!
  if (row.calls.length === 1) return <ToolCall part={first} />
  const paths = [
    ...new Set(
      row.calls.flatMap((call) => (act(call) as { paths: string[] }).paths)
    ),
  ]
  return (
    <Step
      id={first.id}
      foldKey={first.id}
      state="done"
      status={
        row.calls.some((call) => call.status === "error") ? "error" : "done"
      }
      icon={first.icon ?? kindIcons.write}
      verb={labels.verb("write", "done")}
      target={
        <span className="text-subtle-foreground">
          {paths.map((path, index) => (
            <React.Fragment key={path}>
              {index > 0 && ", "}
              <FileTarget path={path} />
            </React.Fragment>
          ))}
        </span>
      }
      findText={() => partsText(row.calls)}
    >
      {detailsOf(row.calls)}
    </Step>
  )
}

/**
 * A line over rows: a run's ("Explored 6 files, ran 2 commands") or its
 * reads' and searches' ("Read 6 files, searched 3 times"): its first
 * row's icon, its words and chevron, failures at its end. Pressed, it
 * opens to its rows.
 */
function FoldLine({
  ref,
  slot,
  icon,
  title,
  failures,
  open,
  state = "done",
}: {
  ref?: React.Ref<HTMLButtonElement>
  slot: "run" | "look"
  icon: React.ReactNode
  title: React.ReactNode
  failures: number
  open: boolean
  /** Its icon's: running while it says the step under way. */
  state?: AgentStepState
}) {
  const { labels } = React.useContext(TurnContext)
  return (
    <CollapsibleTrigger
      ref={ref}
      data-slot={`agent-turn-${slot}-trigger`}
      className={cn(
        "group/agent-turn-fold -mx-2 grid w-[calc(100%+--spacing(4))] min-w-0 grid-cols-icon-end items-center gap-x-2 rounded-md px-2 text-left text-muted-foreground",
        lineClass,
        "cursor-pointer transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      )}
    >
      <StepIcon state={state} icon={icon} />
      {/* One line, its chevron wrapping out of sight before its words are
          cut short: on a narrow line, the words come first. */}
      <span className="flex h-lh min-w-0 flex-wrap items-center gap-x-1 overflow-hidden">
        <span
          data-slot={`agent-turn-${slot}-title`}
          className={cn("min-w-0 truncate", open && "text-foreground")}
        >
          <TargetLinks value={false}>{title}</TargetLinks>
        </span>
        <Chevron open={open} className="text-subtle-foreground" />
      </span>
      {failures > 0 ? (
        <Failures count={failures}>
          <span className="sr-only">, {labels.failures(failures)}</span>
        </Failures>
      ) : (
        <span />
      )}
    </CollapsibleTrigger>
  )
}

/**
 * "⚠ 1 failed" at a line's end (on a phone "⚠ 1"), seen, not read: its
 * line says it in words (`children`, e.g. an `sr-only` span).
 */
function Failures({
  count,
  className,
  children,
}: {
  count: number
  className?: string
  children?: React.ReactNode
}) {
  const { labels } = React.useContext(TurnContext)
  return (
    <span
      data-slot="agent-turn-failures"
      className={cn(
        "flex shrink-0 items-center ps-4 text-xs tabular-nums max-sm:text-2sm",
        className
      )}
    >
      {children}
      <span aria-hidden="true">
        <Failure>
          <span className="max-sm:hidden">{labels.failures(count)}</span>
          <span className="sm:hidden">{count}</span>
        </Failure>
      </span>
    </span>
  )
}

/** The icon of a row, for a line over it. */
function rowIcon(row: Row, act: (call: AgentToolCall) => Act): React.ReactNode {
  if (row.type === "look") return rowIcon(row.rows[0]!, act)
  if (row.type === "step") {
    const part = row.part
    if (part.type === "reasoning")
      return <HugeiconsIcon icon={AiBrain01Icon} strokeWidth={2} />
    if (part.type === "decision") return part.icon
    return part.icon ?? kindIcons[act(part).kind]
  }
  return (
    row.calls[0]!.icon ?? kindIcons[row.type === "write" ? "write" : row.kind]
  )
}

/** Failed calls, but those a later one made good. */
function useFailures(calls: AgentToolCall[]) {
  const { resolved } = React.useContext(TurnContext)
  return calls.filter(
    (call) => call.status === "error" && !resolved.has(call.id)
  ).length
}

/** Reads, searches and listings in a row: one line, opened, theirs. */
function LookRow({
  row,
  foldKey,
  capped,
}: {
  row: Extract<Row, { type: "look" }>
  foldKey: string
  /** Its list scrolls as a run's does: it is not in one. */
  capped: boolean
}) {
  const { labels, touch } = React.useContext(TurnContext)
  const act = useActs()
  const [open, setOpen] = useFold(foldKey, false)
  const lineRef = React.useRef<HTMLButtonElement>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const failures = useFailures(row.calls)
  const list = React.useRef<HTMLDivElement>(null)
  useOpenedHeight(list, open && capped)
  return (
    <Collapsible
      data-slot="agent-turn-look"
      data-look-id={row.calls[0]!.id}
      open={open}
      onOpenChange={(next, details) => {
        if (details.reason === "trigger-press" && lineRef.current)
          keepInPlace(lineRef.current, () => panelRef.current)
        setOpen(next)
        touch()
      }}
      className="flex min-w-0 flex-col"
    >
      <FoldLine
        ref={lineRef}
        slot="look"
        icon={rowIcon(row, act)}
        title={labels.looked(countOf(row.calls, act).count)}
        failures={failures}
        open={open}
      />
      <CollapsibleContent ref={panelRef} className="min-w-0">
        <div
          ref={list}
          data-slot="agent-turn-look-steps"
          // Reads are rows to see, not press: the list itself takes the
          // keys that scroll it.
          tabIndex={capped ? 0 : undefined}
          // Capped, its -mx-2 (room for rings) taken back at its start.
          className={cn(
            capped && stepsList,
            "flex min-w-0 flex-col ps-6 pb-1",
            capped &&
              "ps-8 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          )}
        >
          {row.rows.map((each) => (
            <RowView key={each.key} row={each} />
          ))}
        </div>
      </CollapsibleContent>
      {!open && (
        <FoldFindText
          text={() => partsText(row.calls)}
          onFound={() => {
            setOpen(true)
            touch()
          }}
        />
      )}
    </Collapsible>
  )
}

function RowView({ row, foldKey }: { row: Row; foldKey?: string }) {
  // A run's own key: the row is the run, alone, not in its list.
  if (row.type === "look")
    return (
      <LookRow
        row={row}
        foldKey={foldKey ?? row.key}
        capped={foldKey !== undefined}
      />
    )
  if (row.type === "file") return <FileRow row={row} />
  if (row.type === "write") return <WriteRow row={row} />
  return <StepView part={row.part} />
}

function StepView({
  part,
  live = false,
  onOpenChange,
}: {
  part: AgentStep
  live?: boolean
  onOpenChange?: ((open: boolean) => void) | undefined
}) {
  if (part.type === "reasoning")
    return <Reasoning part={part} onOpenChange={onOpenChange} />
  if (part.type === "decision")
    return <Decision part={part} onOpenChange={onOpenChange} />
  return <ToolCall part={part} live={live} onOpenChange={onOpenChange} />
}

/**
 * Folded steps' visual results, without their lines: those of steps in a
 * row side by side, wrapping, e.g. two screenshots.
 */
function KeptMedia({ parts }: { parts: AgentToolCall[] }) {
  return (
    <div
      data-slot="agent-turn-kept-media"
      className="flex min-w-0 flex-wrap items-start gap-3 ps-6 pb-2"
    >
      {parts.map((part) => (
        <div
          key={part.id}
          data-slot="agent-turn-step-media"
          data-part-id={part.id}
          className={cn(
            // As wide as its card, the card as wide as it is alone in the
            // conversation: up to 6 of the 12 columns, here of the row's
            // (a card's own span, a share of what it is in, was a share of
            // this box: half of it, beside an empty half).
            "max-w-span-6 min-w-0 [&_[data-slot=media-gallery-item]]:max-w-full",
            // Several pictures, or a video or a recording: a row of their
            // own, their spans the row's.
            "has-data-[slot=media-gallery-player]:max-w-full has-data-[slot=media-gallery-player]:basis-full has-[[data-slot=media-gallery-item]~[data-slot=media-gallery-item]]:max-w-full has-[[data-slot=media-gallery-item]~[data-slot=media-gallery-item]]:basis-full"
          )}
        >
          {part.media}
        </div>
      ))}
    </div>
  )
}

/**
 * A fold's panel is gone: closed and done closing. Its panel's ref, to
 * put on it; while it closes its content is still in it, so what is kept
 * in sight outside shows only once it has gone, and goes the moment it
 * opens (its panel mounts in the same commit). With reduced motion there
 * is no closing, so the swap is at once.
 */
function useShut(
  open: boolean,
  panelRef: React.RefObject<HTMLDivElement | null>
) {
  const [gone, setGone] = React.useState(!open)
  const ref = React.useCallback(
    (panel: HTMLDivElement | null) => {
      panelRef.current = panel
      setGone(panel === null)
    },
    [panelRef]
  )
  return [!open && gone, ref] as const
}

/** Parts left in sight under a closed fold, in their order. */
function Kept({ parts }: { parts: AgentStep[] }) {
  if (!parts.length) return null
  // Steps shown as they are, and runs of media between them.
  const rows: (AgentStep | AgentToolCall[])[] = []
  for (const part of parts) {
    if (part.type === "decision" || active(part)) rows.push(part)
    else if (part.type === "tool") {
      const last = rows.at(-1)
      if (Array.isArray(last)) last.push(part)
      else rows.push([part])
    }
  }
  return (
    <div data-slot="agent-turn-kept" className="flex min-w-0 flex-col">
      {rows.map((row) =>
        Array.isArray(row) ? (
          <KeptMedia key={row[0]!.id} parts={row} />
        ) : (
          <StepView key={row.id} part={row} live={active(row)} />
        )
      )}
    </div>
  )
}

/** A clean live thought: the newest bold heading, else a paragraph's first sentence. */
function thoughtLine(text: string): string {
  const clean = (text: string) =>
    text
      .split("\n")
      .map((line) =>
        line
          .trimStart()
          .replace(
            /^(?:(?:>+\s*)|(?:#{1,6}\s+)|(?:(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s*)?))+/g,
            ""
          )
          .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
          .replace(/<(https?:\/\/[^>]+)>/g, "$1")
          .replace(/`+/g, "")
          .replace(
            /\*\*(.+?)\*\*|__(.+?)__|~~(.+?)~~/g,
            (_, a, b, c) => a ?? b ?? c
          )
          .replace(/(^|[^\w])([*_])([^\s](?:.*?[^\s])?)\2(?!\w)/g, "$1$3")
          .replace(/\*\*|__|~~/g, "")
      )
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
  const headings = [
    ...text.matchAll(/^\s*(?:\*\*([^*\n]+)\*\*|__([^_\n]+)__)\s*$/gm),
  ]
  const heading = headings.at(-1)
  if (heading) return clean(heading[1] ?? heading[2] ?? "")
  for (const paragraph of text.split(/\n\s*\n/).reverse()) {
    const cleaned = clean(paragraph)
    if (!cleaned) continue
    return cleaned.match(/^.+?[.?!…]["'”’\])}]?(?=\s|$)/)?.[0] ?? cleaned
  }
  return ""
}

function Reasoning({
  part,
  onOpenChange,
}: {
  part: AgentReasoning
  onOpenChange?: ((open: boolean) => void) | undefined
}) {
  const { labels } = React.useContext(TurnContext)
  const state = useStepState(part.status)
  if (state === "running") {
    // The turn's title says it thinks ("Thinking · 4s"); under it, a
    // running step's spinner, so it is seen going, and its clean thought
    // alone, as it comes, where a step's words are; none before any.
    const latest = thoughtLine(part.text)
    return (
      <div
        data-slot="agent-turn-step"
        data-status="running"
        data-part-id={part.id}
        className="flex min-w-0 flex-col text-foreground"
      >
        <div
          className={cn(
            "grid min-w-0 grid-cols-icon items-center gap-x-2",
            lineClass
          )}
        >
          <StepIcon state="running" />
          <p
            data-slot="agent-turn-thought"
            className="min-w-0 truncate text-muted-foreground"
          >
            {latest}
          </p>
        </div>
      </div>
    )
  }
  // Its paragraphs as it wrote them, a little apart.
  const paragraphs = part.text.trim().split(/\n\s*\n/)
  return (
    <Step
      id={part.id}
      foldKey={part.id}
      state="done"
      icon={<HugeiconsIcon icon={AiBrain01Icon} strokeWidth={2} />}
      verb={labels.thought(part.duration)}
      quiet
      onOpenChange={onOpenChange}
      findText={() => part.text}
    >
      {/* Set off by a rule under its icon, its words where a step's are. */}
      <div
        data-slot="agent-turn-reasoning"
        className="relative -ms-4 flex flex-col gap-2 ps-4 before:absolute before:inset-y-0 before:start-0 before:w-px before:bg-border"
      >
        {paragraphs.map((paragraph, index) => (
          <p key={index} className="whitespace-pre-wrap">
            {paragraph}
          </p>
        ))}
      </div>
    </Step>
  )
}

function Decision({
  part,
  onOpenChange,
}: {
  part: AgentDecision
  onOpenChange?: ((open: boolean) => void) | undefined
}) {
  return (
    <Step
      id={part.id}
      foldKey={part.id}
      state="done"
      icon={part.icon}
      verb={part.title}
      outcome={part.meta}
      onOpenChange={onOpenChange}
      findText={() => nodeText(part.details)}
    >
      {part.details}
    </Step>
  )
}

/**
 * A list of steps, opened: it scrolls within min(18rem, 50dvh), fading at
 * its edges, a step opened in it growing the cap by its details.
 */
const stepsList =
  "-mx-2 flex max-h-[calc(min(18rem,50dvh)+var(--agent-turn-opened,0px))] min-w-0 scroll-fade-y scrollbar-thin flex-col overflow-x-hidden overflow-y-auto px-2"

/** The opened details grow the cap without rendering the run again. */
function useOpenedHeight(
  ref: React.RefObject<HTMLDivElement | null>,
  open: boolean
) {
  React.useLayoutEffect(() => {
    const element = ref.current
    if (!element || !open) return
    let details: HTMLElement[] = []
    const measure = () =>
      element.style.setProperty(
        "--agent-turn-opened",
        `${details.reduce((sum, detail) => sum + detail.getBoundingClientRect().height, 0)}px`
      )
    const resize = new ResizeObserver(measure)
    const scan = () => {
      resize.disconnect()
      details = [
        ...element.querySelectorAll<HTMLElement>(
          "[data-slot=agent-turn-step-details]"
        ),
      ].filter(
        (detail) =>
          !element.contains(
            detail.parentElement?.closest(
              "[data-slot=agent-turn-step-details]"
            ) ?? null
          )
      )
      details.forEach((detail) => resize.observe(detail))
      measure()
    }
    const mutations = new MutationObserver(scan)
    mutations.observe(element, { childList: true, subtree: true })
    scan()
    return () => {
      resize.disconnect()
      mutations.disconnect()
    }
  }, [ref, open])
}

/**
 * A run: the steps between two things the agent said, folded under one
 * line of what they did ("Edited 4 files, ran 4 commands and 6 other actions"),
 * how many failed at its end; one row is its line alone. While it is the
 * turn's live run, the step it is at stands under the line (a spinner,
 * shimmering) and the line counts up; nothing opens or closes by itself,
 * and what the reader opened stays open.
 */
function Work({ parts, split }: { parts: AgentStep[]; split: boolean }) {
  const list = React.useRef<HTMLDivElement>(null)
  const { touch, flat } = React.useContext(TurnContext)
  const act = useActs()
  const first = parts[0]!
  const runKey = `${first.id}:run`
  const [open, setOpen] = useFold(runKey, false)
  const lineRef = React.useRef<HTMLButtonElement>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const [shut, panel] = useShut(open, panelRef)
  // Steps the reader opened under the line: they stay where they are.
  const [pinned, setPinned] = React.useState<ReadonlySet<string>>(
    () => new Set()
  )
  const pin = (id: string) => (opened: boolean) =>
    setPinned((current) => {
      if (opened === current.has(id)) return current
      const next = new Set(current)
      if (opened) next.add(id)
      else next.delete(id)
      return next
    })
  // The live run's step under way, a tool's at work on nothing the reader
  // must see apart (a progress line, media): the run's one line says it,
  // each step's in turn, as it comes, not a line under it.
  const last = parts.at(-1)
  // Running still: not a turn stopped while it ran.
  const lastState = useStepState(last?.type === "tool" ? last.status : "done")
  const current =
    split &&
    last?.type === "tool" &&
    lastState === "running" &&
    last.progress === undefined &&
    (last.media === undefined || last.media === null || last.media === false) &&
    !pinned.has(last.id)
      ? last
      : undefined
  const { rows, outside, line } = layoutRun(
    parts,
    split,
    pinned,
    act,
    // Opened, it stands under the list, in sight however far that scrolls.
    open ? undefined : current
  )
  useOpenedHeight(list, open && line && !flat)
  // While it is the live run, its list opens at its newest steps, next to
  // the step under way, and keeps them in sight as steps come, until the
  // reader scrolls up.
  const { ref: follow } = useFollowEnd<HTMLDivElement>()
  const listRef = React.useCallback(
    (element: HTMLDivElement) => {
      list.current = element
      const stop = split ? follow(element) : undefined
      return () => {
        stop?.()
        list.current = null
      }
    },
    [follow, split]
  )
  const calls = rows.flatMap(rowCalls)
  const steps = rows.reduce(
    (total, row) => total + (row.type === "look" ? row.rows.length : 1),
    0
  )
  const title = useSummary(calls, steps)
  const failures = useFailures(calls)
  const sole = rows.length === 1 ? rows[0]! : undefined
  if (flat)
    // A subagent's: its step's words are its line; its steps under them
    // one level, as they came, the one under way spinning.
    return (
      <div
        data-slot="agent-turn-run"
        data-run-id={first.id}
        className="flex min-w-0 flex-col"
      >
        {rowsOf(parts, act, true).map((row) =>
          row.type === "step" ? (
            <StepView
              key={row.key}
              part={row.part}
              live={split && active(row.part)}
            />
          ) : (
            <RowView key={row.key} row={row} />
          )
        )}
      </div>
    )
  return (
    <div
      data-slot="agent-turn-run"
      data-run-id={first.id}
      className="flex min-w-0 flex-col"
    >
      {line ? (
        <Collapsible
          open={open}
          onOpenChange={(next, details) => {
            if (details.reason === "trigger-press" && lineRef.current)
              keepInPlace(lineRef.current, () => panelRef.current)
            setOpen(next)
            touch()
          }}
          className="flex min-w-0 flex-col"
        >
          <FoldLine
            ref={lineRef}
            slot="run"
            // Folded to the step under way, its icon; else the run's first.
            icon={
              current && !open
                ? (current.icon ?? kindIcons[act(current).kind])
                : rowIcon(rows[0]!, act)
            }
            title={current && !open ? <LiveCall part={current} /> : title}
            state={current && !open ? "running" : "done"}
            failures={failures}
            open={open}
          />
          <CollapsibleContent ref={panel} className="-mx-3 min-w-0 px-3">
            <div
              ref={listRef}
              data-slot="agent-turn-steps"
              className={stepsList}
            >
              {rows.map((row) => (
                <RowView key={row.key} row={row} />
              ))}
            </div>
          </CollapsibleContent>
          {!open && (
            <FoldFindText
              text={() => partsText(parts)}
              onFound={() => {
                setOpen(true)
                touch()
              }}
            />
          )}
        </Collapsible>
      ) : (
        sole && (
          // Its reads alone: their line is the run's, so it keeps what
          // the reader chose while the run was live. A step alone, a
          // level under the lines that sum up several.
          <SoleStepContext value={sole.type === "step"}>
            <RowView row={sole} foldKey={runKey} />
          </SoleStepContext>
        )
      )}
      {line && shut && (
        <Kept
          parts={parts.filter((part) => kept(part) && !outside.includes(part))}
        />
      )}
      {outside.map((part) => (
        <StepView
          key={part.id}
          part={part}
          live={split && active(part)}
          onOpenChange={pin(part.id)}
        />
      ))}
    </div>
  )
}

/** Parts in runs: work (reasoning and tool calls) and content, in turn. */
function runs(parts: AgentTurnPart[]) {
  const result: (
    | { type: "work"; parts: AgentStep[] }
    | AgentContent
    | AgentSteer
    | AgentSuperseded
    | AgentTurnEvent
  )[] = []
  for (const part of parts) {
    const last = result.at(-1)
    if (
      part.type === "content" ||
      part.type === "steer" ||
      part.type === "superseded" ||
      part.type === "event"
    )
      result.push(part)
    else if (last?.type === "work") last.parts.push(part)
    else result.push({ type: "work", parts: [part] })
  }
  return result
}

/** It ends with what the agent said: an answer under its work. */
const answers = (parts: AgentTurnPart[]) => parts.at(-1)?.type === "content"

/**
 * The set last returned while the next has the same members: a set in
 * the turn's context, new with every part streamed, re-rendered every
 * step of the turn.
 */
function useSameSet<T>(set: ReadonlySet<T>): ReadonlySet<T> {
  const [kept, setKept] = React.useState(set)
  if (
    kept !== set &&
    (kept.size !== set.size || [...set].some((item) => !kept.has(item)))
  ) {
    setKept(set)
    return set
  }
  return kept
}

/** Failed commands that ran again, and then did not fail. */
function resolvedFailures(parts: AgentTurnPart[]) {
  const resolved = new Set<string>()
  const later = new Set<string>()
  for (let index = parts.length - 1; index >= 0; index--) {
    const part = parts[index]!
    if (part.type !== "tool" || part.command === undefined) continue
    const command = part.command.trim()
    if (part.status === "error" && later.has(command)) resolved.add(part.id)
    if (part.status === "done") later.add(command)
  }
  return resolved
}

const workTitleClass = cn(
  "group/agent-turn-work -mx-2 flex w-fit max-w-[calc(100%+--spacing(4))] min-w-0 items-center gap-1 rounded-md px-2 text-left text-subtle-foreground",
  lineClass
)

/** The work's title, its chevron after it (none while `bare`). */
function WorkTitle({
  title,
  open,
  bare = false,
}: {
  title: React.ReactNode
  open: boolean
  bare?: boolean
}) {
  return (
    <>
      <span data-slot="agent-turn-work-title" className="min-w-0 truncate">
        {title}
      </span>
      {!bare && <Chevron open={open} />}
    </>
  )
}

/** Under the work's title while it is open: a rule across the turn. */
const workHeaderClass = "flex min-w-0 border-b border-border pb-2"

/**
 * A turn's work under its title, its chevron after it: its runs of steps,
 * and what the agent said between them.
 */
function TurnWork({
  open,
  onOpenChange,
  title,
  bare = false,
  running,
  failures,
  kept,
  findText,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Its work's words, for a find while it is closed. */
  findText?: (() => string) | undefined
  title: React.ReactNode
  /**
   * Only thinking so far: its title alone, no chevron and no rule (kept
   * in its place, unseen, so nothing moves as the first step comes).
   */
  bare?: boolean
  /** The turn runs: its title in the text's colour, as a running step's words. */
  running: boolean
  /** Failed calls nothing made good: at its title's end while it is closed. */
  failures: number
  kept?: React.ReactNode
  children: React.ReactNode
}) {
  const { labels } = React.useContext(TurnContext)
  const headerRef = React.useRef<HTMLDivElement>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const [shut, panel] = useShut(open, panelRef)
  const failuresId = React.useId()
  // Closed, its failures are still seen: its runs' lines are not.
  const failed = !open && failures > 0
  return (
    <Collapsible
      data-slot="agent-turn-work"
      open={open}
      onOpenChange={(next, details) => {
        if (details.reason === "trigger-press" && headerRef.current)
          keepInPlace(headerRef.current, () => panelRef.current)
        onOpenChange(next)
      }}
      className="flex w-full min-w-0 flex-col text-2sm max-sm:text-md"
    >
      <div
        ref={headerRef}
        data-slot="agent-turn-work-header"
        className={cn(
          workHeaderClass,
          "items-center",
          !open && "border-transparent pb-0",
          bare && "border-transparent"
        )}
      >
        <CollapsibleTrigger
          data-slot="agent-turn-work-trigger"
          aria-describedby={failed ? failuresId : undefined}
          className={cn(
            workTitleClass,
            "cursor-pointer transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
            running && "text-foreground"
          )}
        >
          <WorkTitle title={title} open={open} bare={bare} />
        </CollapsibleTrigger>
        {failed && (
          <Failures count={failures} className="ms-auto">
            <span id={failuresId} className="sr-only">
              {labels.failures(failures)}
            </span>
          </Failures>
        )}
      </div>
      {/* Clipped as it opens and closes, with room at its sides and its
          foot for a card's ring and shadow (a request's, last in the
          work), which it would cut off. */}
      <CollapsibleContent ref={panel} className="-mx-3 -mb-2 min-w-0 px-3 pb-2">
        <div className="flex min-w-0 flex-col pt-2 wrap-break-word">
          {children}
        </div>
      </CollapsibleContent>
      {!open && findText && (
        <FoldFindText text={findText} onFound={() => onOpenChange(true)} />
      )}
      {/* Where its panel was, once it has gone. */}
      {shut && kept && <div className="pt-1">{kept}</div>}
    </Collapsible>
  )
}

/**
 * A turn, or a piece of a steered one: the work before its first steer,
 * or the work after a steer, each under a title as a turn's work with its
 * own time ("Worked for 40s"); the last piece has the answer and the end.
 */
function Segment({
  segment,
  id,
  status,
  parts,
  steps,
  onLoadSteps,
  duration,
  startedAt,
  metrics,
  connection,
  kinds,
  outputTone,
  onExpand,
  labels: labelsProp,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "id"> & {
  /**
   * A piece of a steered turn: the steer it follows (none for the first),
   * whether it is the last, whether the whole turn ends with an answer,
   * and the failures the whole turn made good.
   */
  segment?: {
    steer?: AgentSteer
    last: boolean
    answered: boolean
    resolved: ReadonlySet<string>
  }
  /** Stays the same for the turn: what is open is kept by it. */
  id: string
  status: "running" | "done" | "error" | "stopped"
  parts: AgentTurnPart[]
  /**
   * Its steps are not here yet (a history loaded without them): "deferred",
   * to load when its work is opened; "loading"; "error", they could not be
   * loaded. Its work's title is shown even with no steps in `parts`.
   */
  steps?: "deferred" | "loading" | "error" | undefined
  /** Loads its steps: called when its work is open while they are "deferred", and by Retry. */
  onLoadSteps?: () => void
  /**
   * How long the turn took, or has taken while it runs, as the app words
   * it ("48s"); without it, e.g. a turn from a history that kept none,
   * its title is "Worked".
   */
  duration?: string | undefined
  /**
   * When it started, in milliseconds since the epoch (`Date.now()`'s):
   * while it runs, its title counts the time since, each second, in place
   * of `duration`.
   */
  startedAt?: number | undefined
  /**
   * While it runs, in its title after the time: what the app measures as
   * it goes, e.g. "38 tok/s" or "1.2k tokens".
   */
  metrics?: React.ReactNode
  /**
   * While it runs, its link to the agent lost: trying again (`attempt` of
   * `attempts`), or `"offline"`, no longer trying. A line at its end says
   * so (`labels.reconnecting`, `labels.offline`) in place of its spinner.
   */
  connection?: { attempt: number; attempts?: number } | "offline" | undefined
  /**
   * What calls of the app's own kinds did, by `kind`, for a run's line:
   * `{ agent: (n) => "explored with 3 agents" }`.
   */
  kinds?: Record<string, (calls: number) => string>
  /**
   * The tone of each line of a command's output, opened: what failed
   * strong, the output plain, passes and tallies faint. `agentOutputTone`
   * without it, which knows what most tools print.
   */
  outputTone?: (line: string, call: AgentToolCall) => AgentOutputTone
  /** Opens a call in the app's own view (its terminal): "Expand" by its command. */
  onExpand?: (call: AgentToolCall) => void
  labels?: Partial<AgentTurnLabels>
}) {
  useShimmerPause()
  // A subagent's turn takes the words of the turn it is in.
  const outer = React.useContext(TurnContext)
  const labels = React.useMemo(
    () => ({ ...outer.labels, ...labelsProp }),
    [outer.labels, labelsProp]
  )
  const ended = status === "stopped" || status === "error"
  const ownResolved = useSameSet(
    React.useMemo(() => resolvedFailures(parts), [parts])
  )
  const resolved = segment?.resolved ?? ownResolved
  const failures = parts.filter(
    (part) =>
      part.type === "tool" && part.status === "error" && !resolved.has(part.id)
  ).length
  const running = status === "running"
  const [open, setOpen] = useFold(
    segment?.steer ? `${segment.steer.id}:continued` : `${id}:work`,
    status !== "done" || !(segment?.answered ?? answers(parts))
  )
  const loadSteps = React.useEffectEvent(() => onLoadSteps?.())
  React.useEffect(() => {
    if (open && steps === "deferred") loadSteps()
  }, [open, steps])
  const outerTouch = outer.touch
  const touch = React.useCallback(() => {
    outerTouch()
    if (running) setOpen(true)
  }, [outerTouch, running, setOpen])
  // In a step's details: a subagent's turn, which tells its step so.
  const nest = React.useContext(StepDetailsContext)
  const context = React.useMemo(
    () => ({
      labels,
      kinds: kinds ?? outer.kinds,
      outputTone: outputTone ?? outer.outputTone,
      resolved,
      flat: nest !== null,
      ended,
      stalled: connection !== undefined || outer.stalled,
      onExpand: onExpand ?? outer.onExpand,
      touch,
    }),
    [
      labels,
      kinds,
      outer.kinds,
      outputTone,
      outer.outputTone,
      resolved,
      nest,
      ended,
      connection,
      outer.stalled,
      onExpand,
      outer.onExpand,
      touch,
    ]
  )
  React.useLayoutEffect(() => {
    if (!nest) return
    nest(true)
    return () => nest(false)
  }, [nest])
  const all = runs(parts)
  // While it runs, every part is in the work, in the order they came:
  // nothing moves from the answer into the work as the next step comes.
  // Once over, what it said after its last work is its answer, under the
  // work.
  const lastWork =
    running || segment?.last === false
      ? all.length - 1
      : all.findLastIndex(
          (run) => run.type === "work" || run.type === "superseded"
        )
  const work = all.slice(0, lastWork + 1)
  // What it is saying after its last step is drawn in the answer's place
  // already, just under the work's panel, where it stands in the panel:
  // as the turn ends it stays mounted, not mounted again (a long answer's
  // Markdown parsed and laid out again, as the turn stops). A step after
  // it moves it into the panel, while it is short.
  let shownAt = lastWork + 1
  if (running && segment?.last !== false)
    while (shownAt > 0 && all[shownAt - 1]!.type === "content") shownAt--
  const shown = all.slice(0, shownAt)
  const answer = all.slice(shownAt) as (AgentContent | AgentTurnEvent)[]
  const keptParts = work.flatMap((run) =>
    run.type === "work"
      ? // A step still under way, once the turn has ended (a subagent
        // still going), too; while it runs, a closed work is the reader's.
        run.parts.filter((part) => kept(part) || (!running && active(part)))
      : []
  )
  // Its work no more than thought: done, a thought's line is all it
  // needs, with no title over it; while it thinks, its title stands bare,
  // with no chevron or rule, until a step comes (taking their place).
  const thinks = (run: (typeof all)[number]) =>
    run.type === "work" && run.parts.every((part) => part.type === "reasoning")
  const thoughtOnly =
    !segment &&
    !parts.some((part) => part.type === "steer") &&
    steps === undefined &&
    status === "done" &&
    work.length > 0 &&
    work.every(thinks)
  const thinkingOnly = running && work.length > 0 && work.every(thinks)
  // What it is at: thinking, its title says so.
  const last = parts.at(-1)
  const thinking =
    running && last?.type === "reasoning" && last.status === "running"
  // Something at its end is seen going: a step under way (or waiting for
  // the reader), a thought, or words as they come.
  const live =
    thinking ||
    last?.type === "content" ||
    parts.some((part) => part.type === "tool" && active(part))
  // Else its end says it is going: between steps, and before anything came.
  // Nothing seen going while its link is lost: the line at its end says so.
  const pending =
    running && segment?.last !== false && !live && connection === undefined
  // A piece of a steered turn says its own, as a turn's work: the last
  // runs as the turn does, counted from its steer; one before it is over,
  // however the turn ends, unless a step of it is still under way.
  const current = segment?.last !== false
  const seconds = useElapsed(
    running && current ? (segment?.steer?.startedAt ?? startedAt) : undefined
  )
  const goingOn =
    running &&
    (current || parts.some((part) => part.type === "tool" && active(part)))
  const title = goingOn
    ? thinking
      ? labels.thinking
      : labels.working
    : status === "error" && current
      ? labels.failed(duration)
      : status === "stopped" && current
        ? labels.stopped(duration)
        : labels.worked(duration)
  // While it runs: how long, counted from `startedAt` (or the app's
  // `duration`), and the app's `metrics`.
  const since = seconds !== undefined ? labels.elapsed(seconds) : duration
  const going = running && current && (
    <>
      {since && (
        <span data-slot="agent-turn-elapsed" className="tabular-nums">
          {` · ${since}`}
        </span>
      )}
      {metrics !== undefined && metrics !== null && (
        <span data-slot="agent-turn-metrics" className="tabular-nums">
          {" · "}
          {metrics}
        </span>
      )}
    </>
  )
  const heading = (
    <span
      className={cn(
        running &&
          segment?.last !== false &&
          !context.stalled &&
          "shimmer motion-reduce:shimmer-none"
      )}
    >
      {title}
      {going}
    </span>
  )
  const renderTurnRuns = (items: typeof all, nested: boolean) =>
    renderRuns(
      items,
      nested,
      (running || ended) && segment?.last !== false ? all.length - 1 : -1,
      segment?.last === false
    )
  if (nest)
    // A subagent's: its parts under its step's words, in the order they
    // came, with no title of its own (its step is that).
    return (
      <TurnContext value={context}>
        <div
          data-slot="agent-turn"
          data-turn-id={id}
          data-status={status}
          data-nested=""
          className={cn(
            "flex min-w-0 flex-col text-2sm max-sm:text-md",
            className
          )}
          {...props}
        >
          {renderTurnRuns(all, true)}
        </div>
      </TurnContext>
    )
  return (
    <TurnContext value={context}>
      <div
        data-slot={segment ? "agent-turn-segment" : "agent-turn"}
        data-turn-id={segment ? undefined : id}
        data-status={status}
        className={cn(
          "flex min-w-0 flex-col text-sm max-sm:text-base",
          className
        )}
        {...props}
      >
        {thoughtOnly ? (
          // Its thought alone: its line is its title, not one over it.
          <div
            data-slot="agent-turn-thoughts"
            className="flex min-w-0 flex-col text-2sm max-sm:text-md"
          >
            {renderTurnRuns(work, false)}
          </div>
        ) : (
          (work.length > 0 || steps !== undefined || segment?.steer) && (
            <TurnWork
              open={open}
              onOpenChange={setOpen}
              title={heading}
              bare={
                thinkingOnly ||
                (running && segment?.steer !== undefined && work.length === 0)
              }
              running={running && segment?.last !== false}
              failures={failures}
              kept={
                keptParts.length > 0 ? <Kept parts={keptParts} /> : undefined
              }
              findText={() => partsText(shown)}
            >
              <StepsState steps={steps} onRetry={onLoadSteps} />
              {renderTurnRuns(shown, false)}
              {pending && work.length > 0 && <PendingStep />}
            </TurnWork>
          )
        )}
        {answer.map((part, index) =>
          part.type === "event" ? (
            <TurnEvent
              key={part.id}
              part={part}
              className={cn(
                (index > 0 || shown.length > 0 || steps !== undefined) && "mt-3"
              )}
            />
          ) : (
            <div
              key={part.id}
              data-slot="agent-turn-answer"
              data-part-id={part.id}
              className={cn(
                // Under what the open work said last, as close as between
                // steps; under its last step's line, its closed title, a
                // thought alone, or more it said, a paragraph's distance.
                // Under an open panel with nothing in it yet (all it said
                // so far is this), where it would stand in the panel.
                index === 0 &&
                  (work.length > 0 || steps !== undefined) &&
                  !(open && shown.length === 0 && steps === undefined) &&
                  (open && !thoughtOnly && shown.at(-1)?.type === "content"
                    ? "mt-1"
                    : "mt-3"),
                index > 0 && "mt-3",
                // 16px on 28px lines, as an answer's Markdown.
                "text-base/7",
                // Stopped, what it had said is kept, dimmed.
                status === "stopped" && "text-muted-foreground"
              )}
            >
              {part.content}
            </div>
          )
        )}
        {running && segment?.last !== false && (
          // As far under the work as a message's footer is under the turn
          // (a message's gap), whose place it keeps while the turn runs,
          // empty while something there is seen going: nothing under it
          // moves as it ends.
          <div
            data-slot="agent-turn-end"
            className={cn("@container w-full", work.length > 0 && "mt-2")}
          >
            {connection !== undefined ? (
              <Connection connection={connection} labels={labels} />
            ) : pending && (work.length === 0 || !open) ? (
              <Pending first={work.length === 0 && !segment?.steer}>
                {title}
                {going}
              </Pending>
            ) : (
              <div className={footerRowClass} />
            )}
          </div>
        )}
      </div>
    </TurnContext>
  )
}

/** Parts in flow, shared by turns and replaced attempts. */
/**
 * A run re-rendered only when one of its parts is new: those of a long
 * turn's finished runs are the same objects with every part streamed at
 * its end (parts are compared by identity: a changed part is a new one).
 */
const MemoWork = React.memo(
  Work,
  (before, after) =>
    before.split === after.split &&
    before.parts.length === after.parts.length &&
    before.parts.every((part, index) => part === after.parts[index])
)

function renderRuns(
  items: ReturnType<typeof runs>,
  nested: boolean,
  splitAt = -1,
  cutOffLast = false
) {
  return items.map((run, index) =>
    run.type === "work" ? (
      <MemoWork
        key={run.parts[0]!.id}
        parts={run.parts}
        split={index === splitAt}
      />
    ) : run.type === "steer" ? (
      <Steer key={run.id} part={run} />
    ) : run.type === "event" ? (
      <TurnEvent
        key={run.id}
        part={run}
        className={cn(
          // Apart from the steps around it, as what the agent said is;
          // events in a row closer, as a list's lines.
          nested ? "my-1" : "my-3",
          items[index - 1]?.type === "event" && "mt-0",
          items[index + 1]?.type === "event" && "mb-1",
          "first:mt-0 last:mb-0"
        )}
      />
    ) : run.type === "superseded" ? (
      <SupersededAttempt
        key={run.id}
        part={run}
        cutOff={
          items[index + 1]?.type === "steer" ||
          (cutOffLast && index === items.length - 1)
        }
      />
    ) : (
      <div
        key={run.id}
        data-slot="agent-turn-content"
        data-part-id={run.id}
        className={cn(
          // Apart from the lines of steps around it, so what it says
          // and what it did read as two things; a subagent's, as its
          // steps', closer. Not twice as far from what it said next.
          nested ? "my-1" : "my-3",
          items[index - 1]?.type === "content" && "mt-0",
          "first:mt-0 last:mb-0",
          // What a subagent said: a size smaller and lighter than the
          // answer; the turn's at the answer's size and edge, so it does
          // not change as it becomes the answer, or the answer it.
          nested
            ? "text-sm text-muted-foreground max-sm:text-md"
            : "text-base/7"
        )}
      >
        {run.content}
      </div>
    )
  )
}

/** An event among a turn's parts: its fold kept by its id. */
function TurnEvent({
  part,
  className,
}: {
  part: AgentTurnEvent
  className?: string | undefined
}) {
  const { touch, labels } = React.useContext(TurnContext)
  const { id, kind, source, icon, title, time, status, meta, details } = part
  return (
    <AgentEvent
      {...{ kind, source, icon, title, time, status, meta, details }}
      labels={{ ...labels.event, ...part.labels }}
      foldKey={`${id}:event`}
      data-part-id={id}
      onOpenChange={() => touch()}
      className={className}
    />
  )
}

/** Consecutive steers share the following segment. */
function segments(parts: AgentTurnPart[]) {
  const result: { steers: AgentSteer[]; parts: AgentTurnPart[] }[] = [
    { steers: [], parts: [] },
  ]
  for (const part of parts) {
    let last = result.at(-1)!
    if (part.type === "steer") {
      if (last.parts.length || result.length === 1) {
        last = { steers: [], parts: [] }
        result.push(last)
      }
      last.steers.push(part)
    } else last.parts.push(part)
  }
  return result
}

/**
 * An agent's turn: its work (reasoning and tool calls, and what it said in
 * between) under one title, then its answer, what it said after its last
 * work. Its steps are lines of an icon and words saying what was done, in
 * runs between what it said; a run folds under one line of what it did.
 * The work is open while the turn runs, if it failed or stopped, or if
 * closed it would leave nothing: it folds once, when the turn ends, and
 * the reader's choice, once made, wins. Put a `FoldProvider` around the
 * conversation to keep choices while turns unmount. In a tool call's
 * `details` it is a subagent's turn: its parts under the call's words,
 * with no title of its own.
 */
function AgentTurn(
  props: Omit<React.ComponentProps<typeof Segment>, "segment">
) {
  const nest = React.useContext(StepDetailsContext)
  const { id, status, parts, className, labels } = props
  const groups = React.useMemo(() => segments(parts), [parts])
  const resolved = useSameSet(
    React.useMemo(() => resolvedFailures(parts), [parts])
  )
  // Not steered, or a subagent's: one piece, as it always was.
  if (nest || groups.length === 1) return <Segment {...props} />
  return (
    <div
      data-slot="agent-turn"
      data-turn-id={id}
      data-status={status}
      data-steered=""
      className={cn("flex min-w-0 flex-col", className)}
    >
      {groups.map((group, index) => {
        const steer = group.steers.at(-1)
        // Each piece's own time: after its steer, or before the first.
        const own = steer ? steer.duration : groups[1]?.steers[0]?.before
        return (
          <React.Fragment key={steer?.id ?? id}>
            {group.steers.map((part) => (
              <Steer key={part.id} part={part} labels={labels} />
            ))}
            <Segment
              {...props}
              className={undefined}
              parts={group.parts}
              duration={own}
              segment={{
                ...(steer ? { steer } : {}),
                last: index === groups.length - 1,
                answered: answers(parts),
                resolved,
              }}
            />
          </React.Fragment>
        )
      })}
    </div>
  )
}

/**
 * What the user sent into the turn while it ran, where it came: their
 * words as their message's (`UserMessageText`'s), in a muted bubble at
 * the turn's end edge, at most 9 of the column's 12 columns, cut to 6
 * lines when longer (a long one, cut or opened, 10).
 */
function Steer({
  part,
  labels: overrides,
}: {
  part: AgentSteer
  labels?: Partial<AgentTurnLabels> | undefined
}) {
  const { labels } = React.useContext(TurnContext)
  const you = overrides?.steer ?? labels.steer
  const clampLabels = { ...labels.steerClamp, ...overrides?.steerClamp }
  return (
    <Bubble
      variant="muted"
      data-slot="agent-turn-steer"
      data-part-id={part.id}
      className="my-3 ms-auto max-w-span-9 has-[[data-slot=clamp]:is([data-clamped],[data-open])]:max-w-span-10"
    >
      {/* As UserMessageText's: not clipped, for the bar to stick. */}
      <BubbleContent className="overflow-visible px-3 py-2 text-base leading-7 [--clamp-muted:var(--muted-foreground)] max-sm:rounded-2xl">
        <span className="sr-only">{you}: </span>
        <Clamp
          lines={6}
          title={you}
          labels={clampLabels}
          className="scroll-mt-4 [&>[data-slot=clamp-content]]:whitespace-pre-wrap"
        >
          {part.content}
        </Clamp>
      </BubbleContent>
    </Bubble>
  )
}

/** Steps not here yet: three skeleton lines, or a message and Retry. */
function StepsState({
  steps,
  onRetry,
}: {
  steps: AgentSuperseded["steps"]
  onRetry: (() => void) | undefined
}) {
  const { labels } = React.useContext(TurnContext)
  return (
    <>
      {(steps === "deferred" || steps === "loading") && (
        <div
          data-slot="agent-turn-steps-loading"
          role="status"
          aria-label={labels.loadingSteps}
          // Seen only past a short wait, so quick steps never flash it.
          className="animate-wait-in"
        >
          {["w-2/5", "w-3/5", "w-1/3"].map((width) => (
            <div
              key={width}
              aria-hidden="true"
              className={cn(
                "grid grid-cols-icon items-center gap-x-2",
                lineClass
              )}
            >
              <Skeleton className="size-4 rounded-full" />
              <Skeleton
                className={cn(
                  // grid: mark
                  "h-2.5 rounded-full",
                  width
                )}
              />
            </div>
          ))}
        </div>
      )}
      {steps === "error" && (
        <div
          data-slot="agent-turn-steps-error"
          role="alert"
          className={cn(
            "flex items-center gap-2 text-muted-foreground",
            lineClass
          )}
        >
          <HugeiconsIcon
            icon={Alert02Icon}
            strokeWidth={2}
            aria-hidden="true"
            className="size-4 shrink-0 text-subtle-foreground"
          />
          <span>{labels.stepsFailed}</span>
          <Button variant="outline" size="xs" onClick={onRetry}>
            {labels.retry}
          </Button>
        </div>
      )}
    </>
  )
}

/**
 * An attempt cut off and replaced: one line, closed until the reader
 * opens it, its parts under it a level in, what it said a size smaller
 * and lighter; loaded when opened while "deferred".
 */
function SupersededAttempt({
  part,
  cutOff,
}: {
  part: AgentSuperseded
  cutOff: boolean
}) {
  const context = React.useContext(TurnContext)
  const resolved = React.useMemo(
    () => resolvedFailures(part.parts),
    [part.parts]
  )
  const inner = React.useMemo(
    () => ({ ...context, resolved }),
    [context, resolved]
  )
  const [open, setOpen] = useFold(part.id, false)
  const trigger = React.useRef<HTMLButtonElement>(null)
  const panel = React.useRef<HTMLDivElement>(null)
  const load = React.useEffectEvent(() => part.onLoadSteps?.())
  React.useEffect(() => {
    if (open && part.steps === "deferred") load()
  }, [open, part.steps])
  const reason =
    part.reason ?? (cutOff ? context.labels.cutOffBySteer : undefined)
  return (
    <Collapsible
      data-slot="agent-turn-superseded"
      data-part-id={part.id}
      open={open}
      onOpenChange={(next, details) => {
        if (details.reason === "trigger-press" && trigger.current)
          keepInPlace(trigger.current, () => panel.current)
        setOpen(next)
        context.touch()
      }}
    >
      <CollapsibleTrigger
        ref={trigger}
        data-slot="agent-turn-superseded-trigger"
        className={cn(
          "-mx-2 grid w-[calc(100%+--spacing(4))] min-w-0 grid-cols-icon-end items-center gap-x-2 rounded-md px-2 text-left text-muted-foreground",
          "cursor-pointer transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
          lineClass
        )}
      >
        <StepIcon state="done" icon={icon(ArrowReloadHorizontalIcon)} />
        <span className="flex h-lh min-w-0 items-center gap-1 overflow-hidden">
          <span className="min-w-0 truncate">
            {context.labels.superseded}
            {reason != null && (
              <span className="text-subtle-foreground"> · {reason}</span>
            )}
          </span>
          <Chevron open={open} className="text-subtle-foreground" />
        </span>
        <span />
      </CollapsibleTrigger>
      <CollapsibleContent ref={panel} className="-mx-3 min-w-0 px-3">
        <TurnContext value={inner}>
          <div className="ps-6 text-2sm text-muted-foreground">
            <StepsState steps={part.steps} onRetry={part.onLoadSteps} />
            {renderRuns(runs(part.parts), true)}
          </div>
        </TurnContext>
      </CollapsibleContent>
      {!open && (
        <FoldFindText
          text={() => partsText(part.parts)}
          onFound={() => {
            setOpen(true)
            context.touch()
          }}
        />
      )}
    </Collapsible>
  )
}

/**
 * Between steps, the next not yet come: the work's next line, a spinner
 * in the icons' column, so it does not stand apart under the steps; the
 * step that comes takes its place.
 */
function PendingStep() {
  return (
    <div
      data-slot="agent-turn-pending"
      className={cn(
        "grid min-w-0 grid-cols-icon items-center gap-x-2 text-foreground",
        lineClass
      )}
    >
      <StepIcon state="running" />
    </div>
  )
}

/** As tall as an AgentTurnFooter's row, narrow or not. */
const footerRowClass = "h-8 @max-sm:h-10"

/**
 * How long since `startedAt` (ms since the epoch), in whole seconds,
 * counted each second; none without it, on a server, or before the first
 * count, so the page it renders is the browser's first too.
 */
function useElapsed(startedAt: number | undefined) {
  const [now, setNow] = React.useState<number | null>(null)
  React.useEffect(() => {
    if (startedAt === undefined) return
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      const at = Date.now()
      setNow(at)
      // At the next whole second of its time, not drifting from it.
      timer = setTimeout(tick, 1000 - ((at - startedAt) % 1000))
    }
    tick()
    return () => clearTimeout(timer)
  }, [startedAt])
  return startedAt !== undefined && now !== null
    ? Math.max(0, Math.floor((now - startedAt) / 1000))
    : undefined
}

/**
 * The turn's link to the agent lost: "Reconnecting 2/5" while it tries
 * again, shimmering, or "Disconnected"; a status, read as it changes.
 */
function Connection({
  connection,
  labels,
}: {
  connection: { attempt: number; attempts?: number } | "offline"
  labels: AgentTurnLabels
}) {
  useShimmerPause()
  const offline = connection === "offline"
  return (
    <div
      role="status"
      data-slot="agent-turn-connection"
      data-state={offline ? "offline" : "reconnecting"}
      className={cn(
        "flex min-w-0 items-center gap-2 text-2sm text-muted-foreground max-sm:text-md",
        footerRowClass
      )}
    >
      <HugeiconsIcon
        icon={offline ? WifiDisconnected02Icon : Wifi01Icon}
        strokeWidth={2}
        aria-hidden="true"
        className="size-4 shrink-0"
      />
      <span
        className={cn(
          "min-w-0 truncate tabular-nums",
          !offline && "shimmer motion-reduce:shimmer-none"
        )}
      >
        {offline
          ? labels.offline
          : labels.reconnecting(connection.attempt, connection.attempts)}
      </span>
    </div>
  )
}

/**
 * At a running turn's end while nothing there is seen going (between
 * steps): a spinner in the steps' icon column, still where the reader asks
 * for less motion. With nothing come yet, in the work's title's place, its
 * words too: "Working · 12s · 38 tok/s".
 */
function Pending({
  first,
  children,
}: {
  /** Nothing come yet: in the place of the work's title, its height. */
  first: boolean
  /** Its words, with nothing come yet. */
  children: React.ReactNode
}) {
  useShimmerPause()
  return (
    <div
      data-slot="agent-turn-pending"
      className={cn(
        "flex min-w-0 items-center gap-2 text-2sm max-sm:text-md",
        first ? lineClass : footerRowClass
      )}
    >
      <span className="flex size-4 shrink-0 items-center justify-center [&_svg]:size-4">
        <Spinner
          aria-hidden="true"
          role="presentation"
          // 2px, as a running conversation's mark: seen at a glance.
          className="*:stroke-2 motion-reduce:animate-none"
        />
      </span>
      {first && (
        <span className="min-w-0 truncate">
          <span className="shimmer motion-reduce:shimmer-none">{children}</span>
        </span>
      )}
    </div>
  )
}

/**
 * What a subagent handed back, at the end of its turn: its words under a
 * small label ("Result", `labels.result`), set off by a rule. Put it in
 * the subagent's last `content` part. A long one is cut to `lines` (6),
 * fading out, over "Show all" and how many lines it has; all of it stays
 * in the page for screen readers, copying and find in the page.
 */
function AgentTurnResult({
  label,
  lines = 6,
  clampLabels,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  /** Over it; `labels.result` without it. */
  label?: React.ReactNode
  /** The lines it shows until the reader shows all; `false`, all. */
  lines?: number | false
  /** "Show all", "Show less", "N lines": for other languages. */
  clampLabels?: Partial<ClampLabels>
}) {
  const { labels } = React.useContext(TurnContext)
  return (
    <div
      data-slot="agent-turn-result"
      className={cn(
        // Its clamp's count in the muted grey itself, not a share of it.
        "mt-0.5 mb-0.5 flex min-w-0 flex-col gap-0.5 border-s-2 border-border ps-3 text-2sm text-pretty text-muted-foreground [--clamp-muted:var(--muted-foreground)] max-sm:text-md",
        className
      )}
      {...props}
    >
      <span
        data-slot="agent-turn-result-label"
        // A label, a step lighter than the words it is over.
        className="text-2xs font-medium text-subtle-foreground"
      >
        {label ?? labels.result}
      </span>
      {lines === false ? (
        <div>{children}</div>
      ) : (
        <Clamp
          lines={lines}
          title={label ?? labels.result}
          {...(clampLabels ? { labels: clampLabels } : {})}
        >
          {children}
        </Clamp>
      )}
    </div>
  )
}

/**
 * A tool call's line alone, as a turn says it, outside a turn: e.g. what
 * a request is about, a search's match. Its details open under it.
 */
function AgentTurnStep({
  part,
  labels: labelsProp,
}: {
  part: AgentToolCall
  labels?: Partial<AgentTurnLabels>
}) {
  const outer = React.useContext(TurnContext)
  const context = React.useMemo(
    () => ({ ...outer, labels: { ...outer.labels, ...labelsProp } }),
    [outer, labelsProp]
  )
  return (
    <TurnContext value={context}>
      <div className="flex min-w-0 flex-col text-2sm max-sm:text-md">
        <ToolCall part={part} />
      </div>
    </TurnContext>
  )
}

/**
 * The keys of the folds a part of a turn is in, outermost first: open
 * them (`useSetFold`) to show it, e.g. a search's match, then
 * `scrollToMessage(messageId, { part })` scrolls to its `[data-part-id]`. Its own fold, if it has one
 * (reasoning, a tool call's details), is keyed by its id; a call merged
 * into another's line (a file's second edit) is in that line's.
 */
function agentTurnFolds(
  turn: {
    id: string
    status?: "running" | "done" | "error" | "stopped"
    parts: AgentTurnPart[]
  },
  part: string
): string[] {
  const groups = segments(turn.parts)
  for (const [index, group] of groups.entries()) {
    const steer = group.steers.at(-1)
    if (group.steers.some((item) => item.id === part)) return []
    const prefix = steer ? `${steer.id}:continued` : `${turn.id}:work`
    const found = runFolds(
      group.parts,
      part,
      turn.status ?? "done",
      index === groups.length - 1
    )
    if (found) return [prefix, ...found]
  }
  return []
}

/** Run keys inside a segment or attempt; null when outside its work. */
function runFolds(
  parts: AgentTurnPart[],
  part: string,
  status: "running" | "done" | "error" | "stopped",
  last: boolean,
  attempt = false
): string[] | null {
  const all = runs(parts)
  const lastWork =
    attempt || !last || status === "running"
      ? all.length - 1
      : all.findLastIndex(
          (run) => run.type === "work" || run.type === "superseded"
        )
  const acts = new WeakMap<AgentToolCall, Act>()
  const act = (call: AgentToolCall) => {
    let found = acts.get(call)
    if (!found) acts.set(call, (found = actOf(call)))
    return found
  }
  const split = status !== "done"
  for (const [index, run] of all.slice(0, lastWork + 1).entries()) {
    if (run.type === "content" || run.type === "event") {
      if (run.id === part) return []
      continue
    }
    if (run.type === "steer") {
      if (attempt && run.id === part) return []
      continue
    }
    if (run.type === "superseded") {
      if (run.id === part) return []
      const inside = runFolds(run.parts, part, "done", false, true)
      if (inside) return [run.id, ...inside]
      continue
    }
    if (!run.parts.some((item) => item.id === part)) continue
    const keys: string[] = []
    const { rows, line } = layoutRun(
      run.parts,
      split && last && !attempt && index === all.length - 1,
      new Set(),
      act
    )
    const runKey = `${run.parts[0]!.id}:run`
    const inRow = (row: Row): boolean =>
      row.type === "look"
        ? row.rows.some(inRow)
        : row.type === "step"
          ? row.part.id === part
          : row.calls.some((call) => call.id === part)
    const row = rows.find(inRow)
    if (!row) return keys
    if (line) keys.push(runKey)
    let inner = row
    if (row.type === "look") {
      keys.push(line ? row.key : runKey)
      inner = row.rows.find(inRow)!
    }
    if (inner.type !== "step" && inner.key !== part) keys.push(inner.key)
    return keys
  }
  return null
}

export {
  AgentTurn,
  AgentTurnResult,
  AgentTurnStep,
  AgentTurnTarget,
  agentTurnFolds,
  agentOutputTone,
  describeCommand,
  thoughtLine,
  type AgentOutputTone,
  type AgentTurnPart,
  type AgentReasoning,
  type AgentToolCall,
  type AgentToolKind,
  type AgentContent,
  type AgentSteer,
  type AgentSuperseded,
  type AgentTurnEvent,
  type AgentDecision,
  type AgentStepState,
  type AgentWorkCount,
  type AgentTurnLabels,
  type DescribedCommand,
}
