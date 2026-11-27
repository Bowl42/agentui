import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AiBrain01Icon,
  Cancel01Icon,
  GitBranchIcon,
  Globe02Icon,
  Link01Icon,
  RefreshIcon,
  Robot01Icon,
  SecurityCheckIcon,
  TextIcon,
  ThumbsUpIcon,
  VolumeHighIcon,
} from "@hugeicons/core-free-icons"
import { expect, fn, spyOn, userEvent, waitFor, within } from "storybook/test"

import {
  AgentTurn,
  AgentTurnResult,
  AgentTurnStep,
  AgentTurnTarget,
  agentTurnFolds,
  describeCommand,
  thoughtLine,
  type AgentToolCall,
  type AgentTurnPart,
} from "@/components/agent-turn"
import {
  AgentTurnAction,
  AgentTurnDetail,
  AgentTurnDetails,
  AgentTurnFact,
  AgentTurnFooter,
  AgentTurnInfo,
  AgentTurnMore,
  AgentTurnRetry,
} from "@/components/agent-turn-footer"
import { AgentTurnSources } from "@/components/agent-turn-changes"
import { Clamp } from "@/components/clamp"
import { CopyButton } from "@/components/copy-button"
import { MediaGallery, type MediaImage } from "@/components/media-gallery"
import { UserMessage, UserMessageText } from "@/components/user-message"
import { tone } from "@/stories/samples"
import { asCoarse } from "@/stories/touch"
import { animating, frames, settled } from "@/stories/wait"
import { FoldProvider, useFold, useSetFold } from "@/hooks/use-fold"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu"
import { Message, MessageContent } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"

const meta = {
  title: "Blocks/Agent Turn",
  component: AgentTurn,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <FoldProvider>
        <div className="w-165 max-w-full">
          <Story />
        </div>
      </FoldProvider>
    ),
  ],
} satisfies Meta<typeof AgentTurn>

export default meta
type Story = StoryObj<typeof meta>

/** A read of a file, as an app's read tool reports it. */
function read(
  id: string,
  path: string,
  status: "running" | "done" = "done",
  duration = "0.2s"
) {
  return {
    type: "tool",
    id,
    kind: "read",
    path,
    status,
    ...(status === "done" && { duration }),
  } satisfies AgentToolCall
}

/** A shell command: the turn says what it did (`describeCommand`). */
function command(
  id: string,
  line: string,
  output: string,
  status: AgentToolCall["status"] = "done",
  duration = "31s",
  description?: string
) {
  return {
    type: "tool",
    id,
    kind: "command",
    command: line,
    ...(description !== undefined && { description }),
    status,
    ...((status === "done" || status === "error") && { output, duration }),
    ...(status === "error" && { exitCode: 1 }),
  } satisfies AgentToolCall
}

/** An edit of a file, its lines counted. */
function edit(
  id: string,
  path: string,
  status: "running" | "done" = "done",
  added = 2,
  removed = 2
) {
  return {
    type: "tool",
    id,
    kind: "edit",
    path,
    status,
    ...(status === "done" && { added, removed }),
  } satisfies AgentToolCall
}

const text = (id: string, content: string) =>
  ({
    type: "content",
    id,
    content: <p>{content}</p>,
  }) satisfies AgentTurnPart

const reasoning = {
  type: "reasoning",
  id: "reasoning",
  text: "The log shows where the time goes.\nOptimizing images takes almost four minutes.",
  status: "done",
  duration: "2s",
} satisfies AgentTurnPart

/** The parts of a short turn: four steps, one failed. */
const build: AgentTurnPart[] = [
  read("read:a", "vite.config.ts"),
  command("run:a", "pnpm build", "✓ built in 31s"),
  command("run:b", "pnpm test", "✗ app.test.tsx: snapshot mismatch", "error"),
  edit("edit:a", "src/app.test.tsx"),
  text(
    "answer:a",
    "The build now splits vendor code once. Tests failed on one snapshot, which I left for you to review."
  ),
]

/** The title of the turn's work. */
const work = (root: ParentNode = document) =>
  root.querySelector<HTMLElement>("[data-slot=agent-turn-work-trigger]")!

const titleOf = (element: Element, slot: string) =>
  element.querySelector(`[data-slot=${slot}]`)!.textContent!

const matches = (words: string, title: string | RegExp) =>
  typeof title === "string" ? words === title : title.test(words)

/** A step's line by its words. */
const step = (title: string | RegExp, root: ParentNode = document) =>
  [...root.querySelectorAll<HTMLElement>("[data-slot=agent-turn-step]")].find(
    (element) => matches(titleOf(element, "agent-turn-step-title"), title)
  )!

/** A run's line, the button that folds its rows, by its words. */
const runLine = (title: string | RegExp, root: ParentNode = document) =>
  [
    ...root.querySelectorAll<HTMLElement>("[data-slot=agent-turn-run-trigger]"),
  ].find((element) => matches(titleOf(element, "agent-turn-run-title"), title))!

/** The line over reads and searches in a row, by its words. */
const lookLine = (title: string | RegExp, root: ParentNode = document) =>
  [
    ...root.querySelectorAll<HTMLElement>(
      "[data-slot=agent-turn-look-trigger]"
    ),
  ].find((element) =>
    matches(titleOf(element, "agent-turn-look-title"), title)
  )!

const triggerOf = (element: HTMLElement) =>
  element.querySelector<HTMLElement>("[data-slot=agent-turn-step-trigger]")!

const left = (element: Element) =>
  Math.round(element.getBoundingClientRect().left)

/** Where an element's middle is, up and down. */
const middle = (element: Element) => {
  const box = element.getBoundingClientRect()
  // To a hundredth: WebKit's boxes are off by a few millionths.
  return Math.round((box.top + box.height / 2) * 100) / 100
}

// The stream of the mockup: an agent moves a waiting step into its run.
// It reads and searches, runs an edit script, edits one file four times,
// fails a type check, and so on, between two things it says.

const files = {
  turn: "src/components/agent-turn.tsx",
  stories: "src/stories/agent-turn.stories.tsx",
}

/** A hunk of a unified diff, its counts from its lines. */
function hunk(start: number, section: string, lines: string[]) {
  const old = lines.filter((line) => !line.startsWith("+")).length
  const now = lines.filter((line) => !line.startsWith("-")).length
  return [`@@ -${start},${old} +${start},${now} @@ ${section}`, ...lines].join(
    "\n"
  )
}

/** Lines of code, `count` of them, for a hunk's body. */
const code = (sign: "+" | "-", count: number, what: string) =>
  Array.from(
    { length: count },
    (_, index) => `${sign}  const ${what}${index + 1} = rows.at(${index})`
  )

/** An edit with its diff, as an app's edit tool reports it. */
function editWith(
  id: string,
  path: string,
  diff: string,
  status: "running" | "done"
) {
  const lines = diff.split("\n")
  return {
    type: "tool",
    id,
    kind: "edit",
    path,
    status,
    ...(status === "done" && {
      diff,
      added: lines.filter((line) => line.startsWith("+")).length,
      removed: lines.filter((line) => line.startsWith("-")).length,
      duration: "0.1s",
    }),
  } satisfies AgentToolCall
}

const diffs = {
  a: hunk(812, "AgentTurnRun", [
    "   const steps = useRunSteps(children)",
    "-  const waiting = steps.find(isWaiting)",
    "+  const live = steps.at(-1)",
  ]),
  b: hunk(1040, "AgentTurnStep", [
    "-  icon = <ClockIcon />",
    "+  icon = <Spinner />",
  ]),
  c: hunk(1100, "AgentTurnRun", [
    ...code("-", 7, "waiting"),
    ...code("+", 29, "row"),
  ]),
  stories: hunk(14, "imports", [
    '-import { ComposerSubmit } from "@/components/composer"',
    '+import { ComposerSend } from "@/components/composer"',
  ]),
  d: hunk(1300, "agentTurnFolds", [
    ...code("-", 3, "fold"),
    ...code("+", 7, "key"),
  ]),
}

const typeCheck = [
  "> agentui@0.1.12 typecheck",
  "> tsc -p tsconfig.app.json --noEmit",
  "src/stories/agent-turn.stories.tsx(14,10): error TS2305:",
  "  Module '\"@/components/composer\"' has no exported",
  "  member 'ComposerSubmit'.",
  "Found 1 error in src/stories/agent-turn.stories.tsx:14",
].join("\n")

/** What happened, in order: each part as it runs and once done. */
const events: ((status: "running" | "done") => AgentTurnPart)[] = [
  () =>
    text(
      "demo:intro",
      "I'll move the waiting step into the run first, then rewire the story."
    ),
  (status) =>
    command(
      "demo:read:1",
      `sed -n 780,860p ${files.turn}`,
      "…",
      status,
      "0.1s"
    ),
  (status) =>
    command(
      "demo:read:2",
      `sed -n 1,80p ${files.stories}`,
      "…",
      status,
      "0.1s"
    ),
  (status) =>
    command(
      "demo:search:1",
      'grep -rln "ComposerSubmit" src',
      "src/components/composer.tsx\nsrc/stories/agent-turn.stories.tsx",
      status,
      "0.2s"
    ),
  (status) =>
    command(
      "demo:search:2",
      `grep -n "isWaiting" ${files.turn}`,
      "813:  const waiting = steps.find(isWaiting)",
      status,
      "0.1s"
    ),
  (status) =>
    command(
      "demo:search:3",
      'rg -n "useRunSteps" src',
      "src/components/agent-turn.tsx:812",
      status,
      "0.1s"
    ),
  (status) =>
    command(
      "demo:read:3",
      "cat src/components/composer.tsx src/components/composer-queue.tsx src/hooks/use-fold.tsx src/components/agent-turn-footer.tsx",
      "…",
      status,
      "0.1s"
    ),
  (status) =>
    command(
      "demo:apply:1",
      `python3 scripts/codemod.py ${files.stories} codemods/one.py; grep -c ComposerSubmit ${files.stories}`,
      "applied 12 edits\n1",
      status,
      "1.2s",
      "Apply the edit script to the stories"
    ),
  (status) => editWith("demo:edit:a", files.turn, diffs.a, status),
  (status) => editWith("demo:edit:b", files.turn, diffs.b, status),
  (status) => editWith("demo:edit:c", files.turn, diffs.c, status),
  (status) => ({
    ...command(
      "demo:check",
      "pnpm exec tsc -p tsconfig.app.json --noEmit 2>&1 | head -5",
      typeCheck,
      status === "done" ? "error" : "running",
      "14s",
      "Type-check the app"
    ),
    ...(status === "done" && { exitCode: 2 }),
  }),
  (status) =>
    editWith("demo:edit:stories", files.stories, diffs.stories, status),
  (status) => editWith("demo:edit:d", files.turn, diffs.d, status),
  (status) =>
    command(
      "demo:test",
      `pnpm vitest run --project chromium ${files.stories}`,
      "✓ 41 passed",
      status,
      "48s",
      "Run the agent-turn stories in chromium"
    ),
  (status) => ({
    type: "tool",
    id: "demo:write:1",
    kind: "write",
    path: "codemods/two.py",
    status,
  }),
  (status) => ({
    type: "tool",
    id: "demo:write:2",
    kind: "write",
    path: "codemods/three.py",
    status,
  }),
  (status) =>
    command(
      "demo:apply:2",
      "python3 scripts/codemod.py src/stories/agent-app-screens.stories.tsx codemods/two.py codemods/three.py",
      "applied 8 edits",
      status,
      "1.1s",
      "Apply the edit script to the screens"
    ),
  () =>
    text(
      "demo:outro",
      "The type check fails on an import the story still uses; I left it for you."
    ),
  () =>
    text(
      "demo:answer",
      "The waiting step now sits inside its run, and the queue stands above the composer in both screens. One type error is left in the story."
    ),
]

/** Where the agent is: `done` parts done, the next one running. */
const at = (done: number, running = true) => [
  ...events.slice(0, done).map((event) => event("done")),
  ...(running && done < events.length ? [events[done]!("running")] : []),
]

const index = (id: string) =>
  events.findIndex((event) => event("done").id === id)

const question =
  "Put the queue above the composer and fold the waiting step into the run."

/** The user's message the turn answers. */
function Asked({ children = question }: { children?: string }) {
  return (
    <UserMessage>
      <UserMessageText>{children}</UserMessageText>
    </UserMessage>
  )
}

/** The user's message, then the turn. */
function Exchange({
  folds,
  asked = true,
  ...turn
}: React.ComponentProps<typeof AgentTurn> & {
  folds?: Record<string, boolean>
  /** The user's message: `question`, its own words, or none. */
  asked?: boolean | string
}) {
  return (
    <FoldProvider {...(folds && { defaultValue: folds })}>
      <div className="flex flex-col gap-3">
        {asked !== false && (
          <Asked {...(typeof asked === "string" && { children: asked })} />
        )}
        <AgentTurn {...turn} />
      </div>
    </FoldProvider>
  )
}

const finished = at(events.length, false)
const run = "demo:read:1:run"

const steeredParts: AgentTurnPart[] = [
  read("steer:read", "src/helper.ts"),
  command("steer:test", "pnpm test", "Passed"),
  edit("steer:edit", "src/app.tsx"),
  {
    type: "steer",
    id: "steer:message",
    content: "Use the existing helper instead",
    duration: "40s",
    before: "1m 30s",
  },
  read("continued:read", "src/helper.ts"),
  edit("continued:edit", "src/app.tsx"),
  command("continued:test", "pnpm test", "Passed"),
  text("steer:answer", "The existing helper is now used."),
]

/**
 * A steer stays visible between independently folded runs of work, each
 * titled as a turn's work with its own time: before the steer, after it.
 */
export const Steered: Story = {
  args: {
    id: "steered",
    status: "done",
    duration: "2m 10s",
    parts: steeredParts,
  },
  play: async ({ canvasElement, canvas }) => {
    const titles = canvasElement.querySelectorAll<HTMLElement>(
      "[data-slot=agent-turn-work-trigger]"
    )
    await expect(titles).toHaveLength(2)
    await expect(titles[0]).toHaveTextContent("Worked for 1m 30s")
    await expect(titles[1]).toHaveTextContent("Worked for 40s")
    for (const title of titles)
      await expect(title).toHaveAttribute("aria-expanded", "false")
    const bubble = canvasElement.querySelector<HTMLElement>(
      "[data-slot=agent-turn-steer]"
    )!
    await waitFor(() => expect(bubble).toBeVisible())
    await expect(bubble).toHaveTextContent(
      "You: Use the existing helper instead"
    )
    await expect(
      Math.abs(
        bubble.getBoundingClientRect().right -
          canvasElement
            .querySelector("[data-slot=agent-turn]")!
            .getBoundingClientRect().right
      )
    ).toBeLessThanOrEqual(1)
    for (const title of titles) await userEvent.click(title)
    await waitFor(() =>
      expect(
        canvasElement.querySelectorAll("[data-slot=agent-turn-run]")
      ).toHaveLength(2)
    )
    await expect(
      canvasElement.querySelectorAll("[data-slot=agent-turn-run-trigger]")
    ).toHaveLength(2)
    for (const title of titles) await userEvent.click(title)
    await waitFor(() =>
      expect(titles[1]).toHaveAttribute("aria-expanded", "false")
    )
    await waitFor(() =>
      expect(canvas.getByText("Use the existing helper instead")).toBeVisible()
    )
    await expect(
      agentTurnFolds({ id: "steered", parts: steeredParts }, "continued:edit")
    ).toEqual(["steer:message:continued", "continued:read:run"])
    await expect(
      agentTurnFolds({ id: "steered", parts: steeredParts }, "steer:message")
    ).toEqual([])
  },
}

/** A long steer spans at most 9 of the column's 12 columns. */
export const SteerOnTheGrid: Story = {
  decorators: [
    (Story) => (
      <div className="w-188">
        <Story />
      </div>
    ),
  ],
  args: {
    id: "steer-grid",
    status: "done",
    parts: [
      ...steeredParts.slice(0, 3),
      {
        type: "steer",
        id: "steer:long",
        content:
          "Use the existing helper instead, keep the public API unchanged, and leave the old tests as they are so we can compare the two runs side by side afterwards.",
        duration: "12s",
      },
      ...steeredParts.slice(4),
    ],
  },
  play: async ({ canvasElement }) => {
    const bubble = canvasElement.querySelector<HTMLElement>(
      "[data-slot=agent-turn-steer]"
    )!
    await waitFor(() => expect(bubble).toBeVisible())
    const turn = canvasElement
      .querySelector("[data-slot=agent-turn]")!
      .getBoundingClientRect()
    const box = bubble.getBoundingClientRect()
    await expect(turn.width).toBe(752)
    await expect(box.width).toBe(9 * 48 + 8 * 16)
    await expect(Math.abs(box.right - turn.right)).toBeLessThanOrEqual(1)
  },
}

/**
 * A steer's words as the user's message's: 16px on lines of 28px, the
 * same bubble; a long one cut to 6 lines, "Show all" opening it.
 */
export const SteerAsUserMessage: Story = {
  decorators: [
    (Story) => (
      <div className="w-188 max-w-full">
        <UserMessage>
          <UserMessageText>Make the build faster.</UserMessageText>
        </UserMessage>
        <Story />
      </div>
    ),
  ],
  args: {
    id: "steer-long",
    status: "done",
    parts: [
      ...steeredParts.slice(0, 3),
      {
        type: "steer",
        id: "steer:many",
        content: Array.from(
          { length: 9 },
          (_, line) => `Step ${line + 1}: keep the public API unchanged.`
        ).join("\n"),
        duration: "12s",
      },
      ...steeredParts.slice(4),
    ],
  },
  play: async ({ canvasElement }) => {
    const steer = canvasElement.querySelector<HTMLElement>(
      "[data-slot=agent-turn-steer] [data-slot=bubble-content]"
    )!
    const message = canvasElement.querySelector<HTMLElement>(
      "[data-slot=user-message-text] [data-slot=bubble-content]"
    )!
    await waitFor(() => expect(steer).toBeVisible())
    const style = (element: HTMLElement) => {
      const { fontSize, lineHeight, paddingInlineStart, paddingTop } =
        getComputedStyle(element)
      return { fontSize, lineHeight, paddingInlineStart, paddingTop }
    }
    await expect(style(steer)).toEqual(style(message))
    await expect(style(steer).fontSize).toBe("16px")
    const clamp = steer.querySelector("[data-slot=clamp]")!
    const content = steer.querySelector<HTMLElement>(
      "[data-slot=clamp-content]"
    )!
    await waitFor(() => expect(clamp).toHaveAttribute("data-clamped"))
    await expect(content.clientHeight).toBe(6 * 28)
    await userEvent.click(
      within(steer).getByRole("button", { name: "Show all" })
    )
    await waitFor(() => expect(content.clientHeight).toBe(9 * 28))
  },
}

/** Consecutive user steers share one fold after them, timed by the last. */
export const SteeredTwice: Story = {
  args: {
    id: "twice",
    status: "done",
    parts: [
      ...steeredParts.slice(0, 4),
      {
        type: "steer",
        id: "steer:second",
        content: "Keep the API unchanged",
        duration: "12s",
      },
      ...steeredParts.slice(4),
    ],
  },
  play: async ({ canvasElement, canvas }) => {
    await expect(
      canvasElement.querySelectorAll("[data-slot=agent-turn-steer]")
    ).toHaveLength(2)
    const titles = canvasElement.querySelectorAll<HTMLElement>(
      "[data-slot=agent-turn-work-trigger]"
    )
    await expect(titles).toHaveLength(2)
    await waitFor(() =>
      expect(canvas.getByText("Worked for 12s")).toBeVisible()
    )
  },
}

/**
 * Only the work after the latest steer is "Working", shimmering, counted
 * from the steer; the work before it is over, "Worked for" its time.
 */
export const SteeredRunning: Story = {
  args: {
    id: "steering",
    status: "running",
    parts: [
      ...steeredParts.slice(0, 3),
      {
        type: "steer",
        id: "live:steer",
        content: "Use the existing helper instead",
        startedAt: Date.now() - 42_000,
        before: "1m 30s",
      },
      read("live:read", "src/helper.ts"),
      edit("live:edit", "src/app.tsx"),
      command("live:command", "pnpm test", "", "running"),
    ],
  },
  play: async ({ canvasElement }) => {
    const titles = canvasElement.querySelectorAll<HTMLElement>(
      "[data-slot=agent-turn-work-trigger]"
    )
    await expect(titles).toHaveLength(2)
    await expect(titles[0]).toHaveTextContent("Worked for 1m 30s")
    await expect(titles[0]!.querySelector(".shimmer")).toBeNull()
    const title = within(titles[1]!).getByText("Working")
    await expect(title).toHaveClass("shimmer", "motion-reduce:shimmer-none")
    await expect(title.closest("button")).toHaveClass("text-foreground")
    // Counted from the steer, not the turn.
    await expect(titles[1]).toHaveTextContent(/Working · 4[2-9]s/)
    await waitFor(() =>
      expect(runLine("Running pnpm test", canvasElement)).toBeVisible()
    )
  },
}

const supersededParts: AgentTurnPart[] = [
  {
    type: "superseded",
    id: "attempt",
    parts: [
      read("old:read", "old.ts"),
      command("old:test", "pnpm old-test", "Passed"),
      text("old:words", "An unfinished approach."),
    ],
  },
  ...steeredParts.slice(3),
]

/** A replaced attempt opens in place and supports pointer and keyboard folding. */
export const Superseded: Story = {
  args: { id: "replaced", status: "done", parts: supersededParts },
  render: (args) => (
    <Exchange
      {...args}
      folds={{ "replaced:work": true, "old:read:run": true }}
    />
  ),
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector<HTMLElement>(
      "[data-slot=agent-turn-superseded-trigger]"
    )!
    await expect(trigger).toHaveTextContent(
      "Superseded attempt · Cut off by a steer"
    )
    await expect(trigger).toHaveAttribute("aria-expanded", "false")
    await expect(
      canvasElement.querySelector('[data-part-id="old:read"]')
    ).toBeNull()
    await expect(
      canvasElement.querySelector('[data-part-id="old:words"]')
    ).toBeNull()
    await userEvent.click(trigger)
    await waitFor(() =>
      expect(trigger).toHaveAttribute("aria-expanded", "true")
    )
    await waitFor(() =>
      expect(
        canvasElement.querySelector('[data-part-id="old:read"]')
      ).toBeVisible()
    )
    await waitFor(() =>
      expect(
        canvasElement.querySelector('[data-part-id="old:words"]')
      ).toBeVisible()
    )
    trigger.focus()
    await userEvent.keyboard("{Enter}")
    await waitFor(() =>
      expect(trigger).toHaveAttribute("aria-expanded", "false")
    )
    await userEvent.keyboard(" ")
    await waitFor(() =>
      expect(trigger).toHaveAttribute("aria-expanded", "true")
    )
    await userEvent.keyboard(" ")
    await waitFor(() =>
      expect(trigger).toHaveAttribute("aria-expanded", "false")
    )
    await expect(
      agentTurnFolds({ id: "replaced", parts: supersededParts }, "old:test")
    ).toEqual(["replaced:work", "attempt", "old:read:run"])
  },
}

/**
 * A superseded attempt whose parts are not here yet: opened, it loads
 * them (`onLoadSteps`), three skeleton lines while they come.
 */
export const SupersededDeferred: Story = {
  args: { id: "lazy-attempt", status: "done", parts: [] },
  render: function Render(args) {
    const [steps, setSteps] = React.useState<"deferred" | "loading">("deferred")
    return (
      <Exchange
        {...args}
        folds={{ "lazy-attempt:work": true }}
        asked={false}
        parts={[
          {
            type: "superseded",
            id: "lazy",
            parts: [],
            steps,
            onLoadSteps: () => setSteps("loading"),
          },
          text("lazy:answer", "The current answer."),
        ]}
      />
    )
  },
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: /^Superseded attempt/ })
    await expect(trigger).toHaveAttribute("aria-expanded", "false")
    await expect(canvas.queryByRole("status")).toBeNull()
    await userEvent.click(trigger)
    await waitFor(() =>
      expect(
        canvas.getByRole("status", { name: "Loading steps" })
      ).toBeVisible()
    )
  },
}

/**
 * A superseded attempt whose parts could not be loaded: opened, the
 * message and Retry, which loads them.
 */
export const SupersededFailed: Story = {
  args: { id: "failed-attempt", status: "done", parts: [] },
  render: function Render(args) {
    const [loaded, setLoaded] = React.useState(false)
    return (
      <Exchange
        {...args}
        folds={{ "failed-attempt:work": true, "failed:attempt": true }}
        asked={false}
        parts={[
          {
            type: "superseded",
            id: "failed:attempt",
            parts: loaded ? [text("loaded:words", "Loaded attempt")] : [],
            steps: loaded ? undefined : "error",
            onLoadSteps: () => setLoaded(true),
          },
          text("failed:answer", "The current answer."),
        ]}
      />
    )
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "Could not load the steps"
    )
    await userEvent.click(canvas.getByRole("button", { name: "Retry" }))
    await waitFor(() =>
      expect(canvas.getByText("Loaded attempt")).toBeVisible()
    )
    await expect(canvas.queryByRole("alert")).toBeNull()
  },
}

/**
 * Done (stage 1): a dozen calls are one line, counted by kind, files
 * once each; a failure counts only if nothing later made it good.
 */
export const Done: Story = {
  args: {
    id: "demo:done",
    status: "done",
    duration: "6m 12s",
    parts: finished,
  },
  render: (args) => <Exchange {...args} folds={{ "demo:done:work": true }} />,
  play: async ({ canvas }) => {
    await expect(work()).toHaveTextContent(/^Worked for 6m 12s$/)
    // Over, its title is grey, not the text's colour.
    await expect(
      getComputedStyle(
        work().querySelector("[data-slot=agent-turn-work-title]")!
      ).color
    ).not.toBe(getComputedStyle(document.body).color)
    const line = runLine("Explored 6 files, edited 4, ran 4 commands")
    await expect(line).toHaveAttribute("aria-expanded", "false")
    // The failure at the line's end, by weight; read with the line.
    const failures = line.querySelector<HTMLElement>(
      "[data-slot=agent-turn-failures]"
    )!
    await expect(failures).toHaveTextContent("1 failed")
    await expect(line).toHaveAccessibleName(/1 failed/)
    await expect(
      Number(
        getComputedStyle(
          failures.querySelector("[data-slot=agent-turn-failure]")!
        ).fontWeight
      )
    ).toBe(500)
    await expect(Math.round(failures.getBoundingClientRect().right)).toBe(
      Math.round(line.getBoundingClientRect().right - 8)
    )
    // Its chevron after its words, on their line.
    const chevron = line.querySelector("[data-slot=agent-turn-chevron]")!
    const words = line.querySelector("[data-slot=agent-turn-run-title]")!
    await expect(left(chevron)).toBeGreaterThan(left(words))
    await expect(Math.abs(middle(chevron) - middle(words))).toBeLessThan(1)
    await waitFor(() =>
      expect(canvas.getByText(/sits inside its run/)).toBeVisible()
    )
  },
}

/**
 * A command alone between the answer's paragraphs is a level under a
 * line that sums up several: its words 12px in the faintest grey (4.5:1
 * still), its icon 14px in the same column; it still opens. A step under
 * way is not lowered.
 */
export const SoleStep: Story = {
  args: {
    id: "demo:sole",
    status: "done",
    duration: "48s",
    parts: [
      command("sole:a", "pnpm lint", "✓ no problems", "done", "4s"),
      command("sole:b", "pnpm build", "✓ built in 31s"),
      text("sole:said", "The build passes; one more check on the types."),
      command(
        "sole:c",
        "pnpm exec tsc --noEmit -p .",
        "",
        "done",
        "9s",
        "Check background tsc status"
      ),
      text("sole:end", "The types check too."),
    ],
  },
  render: (args) => <Exchange {...args} folds={{ "demo:sole:work": true }} />,
  play: async () => {
    const line = runLine("Ran 2 commands")
    const sole = step(/pnpm exec tsc/)
    const words = (element: Element) =>
      element.querySelector("[data-slot=agent-turn-step-title]")!
    const size = (element: Element) =>
      parseFloat(getComputedStyle(element).fontSize)
    await expect(size(words(sole))).toBe(12)
    await expect(size(line)).toBe(13)
    // The theme's faintest grey, as this browser writes it.
    const probe = document.createElement("span")
    probe.className = "text-subtle-foreground"
    sole.append(probe)
    const subtle = getComputedStyle(probe).color
    probe.remove()
    await expect(getComputedStyle(sole).color).toBe(subtle)
    await expect(getComputedStyle(line).color).not.toBe(subtle)
    const icon = (element: Element) =>
      element
        .querySelector("[data-slot=agent-turn-step-icon] svg")!
        .getBoundingClientRect()
    await expect(Math.round(icon(sole).width)).toBe(14)
    // Its words where the other lines' are.
    await expect(
      left(sole.querySelector("[data-slot=agent-turn-step-title]")!)
    ).toBe(left(line.querySelector("[data-slot=agent-turn-run-title]")!))

    // It opens; what it holds, and the steps under the run's line, at
    // their size.
    await userEvent.click(triggerOf(sole))
    await expect(sole).toHaveAttribute("data-open")
    await expect(
      size(sole.querySelector("[data-slot=agent-turn-step-details]")!)
    ).toBe(13)
    await userEvent.click(line)
    const under = document.querySelector(
      "[data-slot=agent-turn-steps] [data-slot=agent-turn-step]"
    )!
    await waitFor(() => expect(size(words(under))).toBe(13))
    await expect(Math.round(icon(under).width)).toBe(14)
  },
}

/**
 * The run, opened (stage 2): a row a thing, files by their names; reads
 * and searches in a row one line; a file edited four times one row; two
 * files written in a row one; commands by the agent's own words.
 */
export const RunOpened: Story = {
  args: { ...Done.args, id: "demo:opened" },
  render: (args) => (
    <Exchange
      {...args}
      asked={false}
      folds={{ "demo:opened:work": true, [run]: true }}
    />
  ),
  play: async ({ canvas }) => {
    const rows = [
      ...document.querySelectorAll<HTMLElement>(
        "[data-slot=agent-turn-steps] > *"
      ),
    ]
    const words = rows.map(
      (row) =>
        row.querySelector(
          "[data-slot=agent-turn-step-title], [data-slot=agent-turn-look-title]"
        )!.textContent
    )
    await expect(words).toEqual([
      "Read 6 files, searched 3 times",
      "Apply the edit script to the stories",
      "Edited agent-turn.tsx",
      "Type-check the app",
      "Edited agent-turn.stories.tsx",
      "Run the agent-turn stories in chromium",
      "Wrote two.py, three.py",
      "Apply the edit script to the screens",
    ])
    await expect(step("Edited agent-turn.tsx")).toHaveTextContent(
      "4 edits · +38 −12"
    )
    await expect(step("Edited agent-turn.stories.tsx")).toHaveTextContent(
      "+1 −1"
    )
    const failed = step("Type-check the app")
    await expect(failed).toHaveAttribute("data-status", "error")
    await expect(failed).toHaveTextContent("Exit 2")
    // A file is its name, its path on hover, underlined with dots.
    const file = within(step("Edited agent-turn.tsx")).getByText(
      "agent-turn.tsx"
    )
    await expect(file).toHaveAttribute("title", files.turn)
    await expect(getComputedStyle(file).textDecorationStyle).toBe("dotted")
    // The icons in one column at the turn's edge, as what it said.
    const turn = document.querySelector("[data-slot=agent-turn]")!
    for (const row of rows)
      await expect(
        left(row.querySelector("[data-slot=agent-turn-step-icon]")!)
      ).toBe(left(turn))
    await expect(left(canvas.getByText(/^I'll move the waiting/))).toBe(
      left(turn)
    )
    for (const row of rows) {
      const icon = row.querySelector("[data-slot=agent-turn-step-icon]")!
      await expect(
        Math.abs(middle(icon) - middle(row.firstElementChild!))
      ).toBeLessThan(15)
    }
    await expect(rows[1]!.getBoundingClientRect().height).toBe(28)
  },
}

/**
 * Running (stage 3): the live run is one line, folded, saying the step it
 * is at (a spinner, shimmering), each step's in turn as they come, not a
 * line under it; opened, the run's sum and all its steps. It does not
 * grow, or open and close by itself.
 */
export const Running: Story = {
  args: {
    id: "demo:running",
    status: "running",
    duration: "3m 40s",
    parts: at(index("demo:test")),
  },
  render: (args) => <Exchange {...args} />,
  play: async () => {
    await expect(work()).toHaveTextContent(/^Working · 3m 40s$/)
    const line = runLine("Run the agent-turn stories in chromium")
    await expect(line).toHaveAttribute("aria-expanded", "false")
    await expect(line).toHaveTextContent("1 failed")
    await expect(
      line.querySelector("[data-slot=agent-turn-step-icon] [data-slot=spinner]")
    ).not.toBeNull()
    await expect(line.querySelector(".shimmer")).not.toBeNull()
    // The one line, nothing under it.
    const runs = document.querySelectorAll("[data-slot=agent-turn-run]")
    await expect(runs).toHaveLength(1)
    await expect(
      runs[0]!.querySelectorAll("[data-slot=agent-turn-step]")
    ).toHaveLength(0)
    // Opened: the sum of the steps done, and under them the one under way,
    // in sight however far they scroll.
    await userEvent.click(line)
    await waitFor(() =>
      expect(
        runLine("Explored 6 files, edited 2, ran 2 commands")
      ).toHaveAttribute("aria-expanded", "true")
    )
    const live = step("Run the agent-turn stories in chromium", runs[0]!)
    await expect(live).toHaveAttribute("data-status", "running")
    await expect(live.closest("[data-slot=agent-turn-steps]")).toBeNull()
  },
}

/**
 * A running step whose words hold a link (an `AgentTurnTarget` with
 * `href`): the link shimmers with them, its own ground clipped to its
 * text. As its own layer (over the line's button), WebKit painted none
 * of its words' ground in it, and its text was not seen.
 */
export const RunningLink: Story = {
  args: {
    id: "turn:running-link",
    status: "running",
    parts: [
      read("link:read", "src/build.ts"),
      {
        type: "tool",
        id: "link:agent",
        kind: "agent",
        status: "running",
        title: (
          <>
            Starting{" "}
            <AgentTurnTarget href="#review-the-build">
              Review the build
            </AgentTurnTarget>{" "}
            · Helper
          </>
        ),
      },
    ],
  },
  render: (args) => <Exchange {...args} />,
  play: async ({ canvasElement }) => {
    // Folded, the run's line (a button) says it, the link its words alone.
    const line = runLine("Starting Review the build · Helper")
    await expect(line.querySelector("a")).toBeNull()
    await expect(within(line).getByText("Review the build")).toBeVisible()
    await userEvent.click(line)
    const link = await waitFor(() => {
      const found = canvasElement.querySelector<HTMLElement>(
        "[data-slot=agent-turn-step] a[data-slot=agent-turn-target]"
      )
      expect(found).not.toBeNull()
      return found!
    })
    await expect(link.closest(".shimmer")).not.toBeNull()
    const style = getComputedStyle(link)
    await expect(style.backgroundImage).not.toBe("none")
    await expect(style.backgroundClip).toBe("text")
    line.blur()
  },
}

/**
 * Running while its link to the agent is lost: the step under way is not
 * seen going, so its line is still, no spinner and no shimmer, its icon
 * the step's own (a command's), not the run's first step's.
 */
export const RunningReconnecting: Story = {
  args: { ...Running.args, connection: { attempt: 2, attempts: 5 } },
  render: (args) => <Exchange {...args} />,
  play: async () => {
    const line = runLine("Run the agent-turn stories in chromium")
    const icon = line.querySelector("[data-slot=agent-turn-step-icon]")!
    await expect(icon.querySelector("[data-slot=spinner]")).toBeNull()
    await expect(line.querySelector(".shimmer")).toBeNull()
    await expect(work().querySelector(".shimmer")).toBeNull()
    const drawn = icon.innerHTML
    await userEvent.click(line)
    const runs = document.querySelectorAll("[data-slot=agent-turn-run]")
    const live = step("Run the agent-turn stories in chromium", runs[0]!)
    await waitFor(() => expect(live).toHaveAttribute("data-status", "running"))
    const own = live.querySelector("[data-slot=agent-turn-step-icon]")!
    await expect(own.querySelector("[data-slot=spinner]")).toBeNull()
    await expect(own.innerHTML).toBe(drawn)
  },
}

/**
 * A command, opened (stage 4): the whole command, wrapped, never cut, to
 * copy or open in the app's view; its output's last lines under it, the
 * earlier ones a press away.
 */
export const CommandOpened: Story = {
  args: { ...Done.args, id: "demo:command", onExpand: fn() },
  render: (args) => (
    <Exchange
      {...args}
      asked={false}
      folds={{ "demo:command:work": true, [run]: true, "demo:check": true }}
    />
  ),
  beforeEach: () => {
    const writeText = spyOn(navigator.clipboard, "writeText")
    writeText.mockResolvedValue(undefined)
    return () => writeText.mockRestore()
  },
  play: async () => {
    const opened = step("Type-check the app")
    await expect(triggerOf(opened)).toHaveAttribute("aria-expanded", "true")
    const block = opened.querySelector<HTMLElement>(
      "[data-slot=agent-turn-command]"
    )!
    const line = block.querySelector<HTMLElement>(
      "[data-slot=agent-turn-command-line] code"
    )!
    await expect(line).toHaveTextContent(
      "pnpm exec tsc -p tsconfig.app.json --noEmit 2>&1 | head -5"
    )
    await expect(getComputedStyle(line).whiteSpace).toBe("pre-wrap")
    // Its line says what it does: here, the command itself, in mono. A
    // small well, its corners 8px.
    await expect(getComputedStyle(line).fontFamily).toMatch(/mono/i)
    await expect(getComputedStyle(block).borderRadius).toBe("8px")
    // Its last lines; the earlier ones on request.
    await expect(within(block).queryByText(/typecheck$/)).toBeNull()
    await waitFor(() =>
      expect(within(block).getByText(/^Found 1 error/)).toBeVisible()
    )
    // Toned as read: the error strong, in the text's colour; the output
    // muted; the tally faint; 16px lines, on the side's grey.
    const lines = [
      ...block.querySelectorAll<HTMLElement>("[data-slot=code-block-line]"),
    ]
    await expect(lines.map((each) => each.dataset.tone)).toEqual([
      "strong",
      "plain",
      "plain",
      "faint",
    ])
    const [error, output, , tally] = lines.map((each) => getComputedStyle(each))
    await expect(error!.fontWeight).toBe("600")
    await expect(error!.color).toBe(getComputedStyle(document.body).color)
    await expect(output!.color).not.toBe(error!.color)
    await expect(tally!.color).not.toBe(output!.color)
    await expect(output!.lineHeight).toBe("16px")
    await expect(output!.fontSize).toBe("12px")
    await expect(lines[1]!.getBoundingClientRect().height).toBe(16)
    const fill = getComputedStyle(block).backgroundColor
    await expect(fill).not.toBe(getComputedStyle(document.body).backgroundColor)
    await waitFor(() =>
      expect(
        within(block).getByRole("button", { name: "Show 2 earlier lines" })
      ).toBeVisible()
    )
  },
}

/** Opened, its earlier lines shown, it copied and opened in the app's view. */
export const CommandActions: Story = {
  ...CommandOpened,
  args: { ...CommandOpened.args, id: "demo:actions" },
  render: (args) => (
    <Exchange
      {...args}
      asked={false}
      folds={{ "demo:actions:work": true, [run]: true, "demo:check": true }}
    />
  ),
  play: async ({ args, canvas }) => {
    const block = step("Type-check the app").querySelector<HTMLElement>(
      "[data-slot=agent-turn-command]"
    )!
    await userEvent.click(
      within(block).getByRole("button", { name: "Show 2 earlier lines" })
    )
    await waitFor(() =>
      expect(within(block).getByText(/typecheck$/)).toBeVisible()
    )
    await userEvent.click(
      within(block).getByRole("button", { name: "Copy command" })
    )
    await expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "pnpm exec tsc -p tsconfig.app.json --noEmit 2>&1 | head -5"
    )
    await userEvent.click(canvas.getByRole("button", { name: "Expand" }))
    await expect(args.onExpand).toHaveBeenCalledWith(
      expect.objectContaining({ id: "demo:check" })
    )
  },
}

/**
 * Explored and an edit, opened (stage 5): reads and searches in a row
 * open to a line each; a file edited four times opens to its changes
 * merged, by hunk, in the file's order, not four blocks.
 */
export const ExploredOpened: Story = {
  args: { ...Done.args, id: "demo:explored" },
  render: (args) => (
    <Exchange
      {...args}
      asked={false}
      folds={{
        "demo:explored:work": true,
        [run]: true,
        "demo:read:1:look": true,
        "demo:edit:a": true,
      }}
    />
  ),
  play: async () => {
    const look = lookLine("Read 6 files, searched 3 times")
    await expect(look).toHaveAttribute("aria-expanded", "true")
    const inside = look.parentElement!.querySelector<HTMLElement>(
      "[data-slot=agent-turn-look-steps]"
    )!
    await expect(
      [...inside.querySelectorAll("[data-slot=agent-turn-step-title]")].map(
        (title) => title.textContent
      )
    ).toEqual([
      "Read agent-turn.tsx",
      "Read agent-turn.stories.tsx",
      "Searched for ComposerSubmit",
      "Searched for isWaiting",
      "Searched for useRunSteps",
      "Read 4 files",
    ])
    // Its rows under its words.
    await expect(
      left(inside.querySelector("[data-slot=agent-turn-step-icon]")!)
    ).toBe(left(look.querySelector("[data-slot=agent-turn-look-title]")!))

    const edited = step("Edited agent-turn.tsx")
    const diff = edited.querySelector<HTMLElement>(
      "[data-slot=agent-turn-diff]"
    )!
    const headers = [...diff.querySelectorAll("[data-diff=hunk]")].map(
      (header) => header.textContent
    )
    await expect(headers).toEqual([
      "@@ 812 AgentTurnRun",
      "@@ 1040 AgentTurnStep",
    ])
    const numbers = [
      ...diff.querySelectorAll<HTMLElement>("[data-slot=code-block-line]"),
    ]
      .filter((line) => line.dataset.diff !== "hunk")
      .map((line) => line.dataset.number)
    await expect(numbers).toEqual(["812", "813", "813", "1040", "1040"])
    await waitFor(() =>
      expect(
        within(diff).getByRole("button", { name: "Show all 51 lines" })
      ).toBeVisible()
    )
  },
}

/** A file's merged diff, all of it: each hunk in the file's order. */
export const EditDiffAll: Story = {
  args: { ...Done.args, id: "demo:diff" },
  render: (args) => (
    <Exchange
      {...args}
      asked={false}
      folds={{ "demo:diff:work": true, [run]: true, "demo:edit:a": true }}
    />
  ),
  play: async () => {
    const diff = step("Edited agent-turn.tsx").querySelector<HTMLElement>(
      "[data-slot=agent-turn-diff]"
    )!
    await userEvent.click(
      within(diff).getByRole("button", { name: "Show all 51 lines" })
    )
    await waitFor(() =>
      expect(diff.querySelectorAll("[data-diff=hunk]")).toHaveLength(4)
    )
    await expect(
      [...diff.querySelectorAll("[data-diff=hunk]")].map(
        (header) => header.textContent
      )
    ).toEqual([
      "@@ 812 AgentTurnRun",
      "@@ 1040 AgentTurnStep",
      "@@ 1100 AgentTurnRun",
      "@@ 1300 agentTurnFolds",
    ])
  },
}

/** The commands of stage 6, and what the agent said they do. */
const commandMap: [string, string?][] = [
  ["sed -n 3210,3316p src/components/composer.tsx"],
  ["cat a.ts b.ts; head -40 c.ts"],
  ['grep -n "useSyncExternalStore" composer.tsx'],
  ["ls /tmp/build/out | head -80"],
  ["sed -i '' 's/^import …/…/' agent-turn.stories.tsx"],
  ["pnpm build"],
  [
    "python3 scripts/codemod.py src/stories/agent-turn.stories.tsx codemods/one.py; grep -c x a",
    "Apply the edit script to the stories",
  ],
  ["for f in composer-select composer-queue; do pnpm lint $f; done"],
]

/**
 * How a command becomes a line (stage 6): `describeCommand`, the first
 * rule that holds. Each command is a step of the turn as it says it.
 */
export const DescribeCommand: Story = {
  args: {
    id: "demo:map",
    status: "done",
    parts: commandMap.map(([line, description], at) =>
      command(`map:${at}`, line, "", "done", "0.1s", description)
    ),
  },
  render: (args) => (
    <table className="w-full table-fixed text-start text-2sm">
      <thead>
        <tr className="h-7 border-b text-xs text-subtle-foreground">
          <th className="text-start font-normal">Command</th>
          <th className="ps-6 text-start font-normal">Line</th>
        </tr>
      </thead>
      <tbody>
        {args.parts.map((part, at) => (
          <tr key={part.id} className="h-8.5 border-b">
            <td className="truncate font-mono text-xs text-muted-foreground">
              {commandMap[at]![0]}
            </td>
            <td className="ps-6">
              <AgentTurnStep part={part as AgentToolCall} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
  play: async () => {
    await expect(
      commandMap.map(([line, description]) =>
        describeCommand(line, description)
      )
    ).toEqual([
      { kind: "read", paths: ["src/components/composer.tsx"] },
      { kind: "read", paths: ["a.ts", "b.ts", "c.ts"] },
      {
        kind: "search",
        pattern: "useSyncExternalStore",
        paths: ["composer.tsx"],
      },
      { kind: "list", path: "/tmp/build/out" },
      { kind: "edit", paths: ["agent-turn.stories.tsx"] },
      { kind: "run", command: "pnpm build" },
      {
        kind: "described",
        description: "Apply the edit script to the stories",
      },
      { kind: "script" },
    ])
    const words = [
      ...document.querySelectorAll("[data-slot=agent-turn-step-title]"),
    ].map((title) => title.textContent)
    await expect(words).toEqual([
      "Read composer.tsx",
      "Read 3 files",
      "Searched for useSyncExternalStore",
      "Listed files in build/out",
      "Edited agent-turn.stories.tsx",
      "Ran pnpm build",
      "Apply the edit script to the stories",
      "Ran a script",
    ])
  },
}

/** One of the moments of stage 7: its time, then the turn then. */
function Moment({
  time,
  children,
}: {
  time: string
  children: React.ReactNode
}) {
  return (
    <div data-moment={time} className="flex min-w-0 flex-col gap-3">
      <p className="text-xs text-muted-foreground">{time}</p>
      {children}
    </div>
  )
}

/**
 * Nothing opens or closes by itself while it runs (stage 7), the same
 * turn at four moments: only the line's words change, the step it is at; a run the reader opened stays open as steps join it; done, and
 * never touched, the turn folds to its title, once.
 */
/**
 * What the agent says between its runs of steps: a paragraph stands
 * apart from the lines around it, 12px, so what it says and what it did
 * read as two things; two paragraphs in a row are no farther apart.
 */
export const TextBetweenRuns: Story = {
  args: {
    id: "demo:between",
    status: "running",
    duration: "12m 51s",
    parts: [
      edit("between:edit:a", "package.json"),
      edit("between:edit:b", "src/routes.ts"),
      command("between:run:a", "pnpm build", ""),
      text("between:a", "The routes and the config are in."),
      edit("between:edit:c", "src/pages/home.tsx"),
      command("between:run:b", "pnpm lint", ""),
      text("between:b", "The home page and its layout are written."),
      text("between:c", "Next, the tests."),
      edit("between:edit:d", "src/pages/home.test.tsx"),
      command("between:run:c", "pnpm test", "", "running"),
    ],
  },
  render: (args) => <Exchange {...args} asked={false} />,
  play: async () => {
    const box = (element: Element) => element.getBoundingClientRect()
    const said = (id: string) =>
      document.querySelector(
        `[data-slot=agent-turn-content][data-part-id="${id}"]`
      )!
    const runs = [...document.querySelectorAll("[data-slot=agent-turn-run]")]
    await expect(runs).toHaveLength(3)
    // The work opens under its rule, as it did.
    await waitFor(() =>
      expect(box(runs[1]!).top - box(said("between:a")).bottom).toBe(12)
    )
    await expect(box(said("between:a")).top - box(runs[0]!).bottom).toBe(12)
    await expect(box(said("between:b")).top - box(runs[1]!).bottom).toBe(12)
    await expect(
      box(said("between:c")).top - box(said("between:b")).bottom
    ).toBe(12)
    await expect(box(runs[2]!).top - box(said("between:c")).bottom).toBe(12)
  },
}

export const Moments: Story = {
  args: { id: "demo:moments", status: "running", parts: [] },
  render: () => (
    <div className="grid w-5xl grid-cols-2 gap-x-12 gap-y-10">
      <Moment time="0:40">
        <Exchange
          asked={false}
          id="demo:m1"
          status="running"
          duration="40s"
          parts={at(index("demo:apply:1"))}
        />
      </Moment>
      <Moment time="2:10">
        <Exchange
          asked={false}
          id="demo:m2"
          status="running"
          duration="2m 10s"
          parts={at(index("demo:check"))}
        />
      </Moment>
      <Moment time="3:05 · the reader opened the run">
        <Exchange
          asked={false}
          id="demo:m3"
          status="running"
          duration="3m 05s"
          parts={at(index("demo:edit:stories"))}
          folds={{ [run]: true }}
        />
      </Moment>
      <Moment time="6:12 · done, never touched">
        <Exchange
          asked={false}
          id="demo:m4"
          status="done"
          duration="6m 12s"
          parts={finished}
        />
      </Moment>
    </div>
  ),
  play: async () => {
    const moment = (time: string) =>
      document.querySelector<HTMLElement>(`[data-moment^="${time}"]`)!
    // Folded, the live run's one line says the step it is at, each in
    // turn.
    await waitFor(() =>
      expect(
        runLine("Apply the edit script to the stories", moment("0:40"))
      ).toBeVisible()
    )
    await waitFor(() =>
      expect(runLine("Type-check the app", moment("2:10"))).toBeVisible()
    )
    const opened = moment("3:05")
    const line = runLine("Explored 6 files, edited 1, ran 2 commands", opened)
    await expect(line).toHaveAttribute("aria-expanded", "true")
    await expect(step("Edited agent-turn.tsx", opened)).toHaveTextContent(
      "3 edits · +31 −9"
    )
    // The step it is at, last, under what the reader opened.
    const steps = [
      ...opened.querySelectorAll<HTMLElement>("[data-slot=agent-turn-step]"),
    ]
    await expect(steps.at(-1)).toBe(
      step("Editing agent-turn.stories.tsx", opened)
    )
    await expect(work(moment("6:12"))).toHaveAttribute("aria-expanded", "false")
    await expect(work(moment("6:12"))).toHaveTextContent(/^Worked for 6m 12s$/)
  },
}

/** The turn as it streams: a part at a time, each call running, then done. */
const stream: { status: "running" | "done"; parts: AgentTurnPart[] }[] = [
  { status: "running", parts: [] },
  ...events.flatMap((event, done) => {
    const part = event("done")
    if (part.type === "content") {
      const words = (
        part.content as React.ReactElement<{ children: string }>
      ).props.children.split(" ")
      return [3, words.length].map((count) => ({
        status: "running" as const,
        parts: [
          ...at(done, false),
          text(part.id, words.slice(0, count).join(" ")),
        ],
      }))
    }
    return [
      { status: "running" as const, parts: at(done) },
      { status: "running" as const, parts: at(done + 1, false) },
    ]
  }),
  { status: "done", parts: finished },
]

/** Plays `stream`, a frame a press of "Next". */
function Streaming({
  id,
  scroller = false,
}: {
  id: string
  scroller?: boolean
}) {
  const [shown, setShown] = React.useState(0)
  const now = stream[shown]!
  // As in a message: its footer under it, hidden while it runs, in the
  // place of its end's "Working" line.
  const turn = (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <AgentTurn
        id={id}
        status={now.status}
        duration={now.status === "done" ? "6m 12s" : `${shown}s`}
        parts={now.parts}
      />
      <AgentTurnFooter>
        <AgentTurnInfo>
          <span>Opus 5.5</span>
        </AgentTurnInfo>
      </AgentTurnFooter>
    </div>
  )
  return (
    <div className="flex flex-col gap-4">
      <Button
        size="sm"
        variant="outline"
        className="self-start"
        disabled={shown === stream.length - 1}
        onClick={() => setShown(shown + 1)}
      >
        Next
      </Button>
      {scroller ? (
        <MessageScrollerProvider autoScroll>
          <div className="flex h-120 flex-col overflow-hidden rounded-xl border">
            <MessageScroller>
              <MessageScrollerViewport aria-label="Conversation">
                <MessageScrollerContent className="gap-6 p-4">
                  {["earlier:1", "earlier:2", "earlier:3"].map((earlier) => (
                    <React.Fragment key={earlier}>
                      <MessageScrollerItem messageId={earlier}>
                        <Asked>Run the tests and tell me what fails.</Asked>
                      </MessageScrollerItem>
                      <MessageScrollerItem messageId={`${earlier}:turn`}>
                        <AgentTurn
                          id={earlier}
                          status="done"
                          duration="40s"
                          parts={build}
                        />
                      </MessageScrollerItem>
                    </React.Fragment>
                  ))}
                  <MessageScrollerItem messageId="asked">
                    <Asked />
                  </MessageScrollerItem>
                  <MessageScrollerItem messageId="turn">
                    {turn}
                  </MessageScrollerItem>
                </MessageScrollerContent>
              </MessageScrollerViewport>
            </MessageScroller>
          </div>
        </MessageScrollerProvider>
      ) : (
        <>
          <Asked />
          {turn}
        </>
      )}
    </div>
  )
}

/** Every fold's state, by what it folds. */
function folds(root: HTMLElement) {
  const found = new Map<string, string>()
  for (const element of root.querySelectorAll<HTMLElement>("[aria-expanded]")) {
    const slot = element.dataset.slot ?? ""
    const owner =
      slot === "agent-turn-run-trigger"
        ? element.closest<HTMLElement>("[data-run-id]")?.dataset.runId
        : slot === "agent-turn-look-trigger"
          ? element.closest<HTMLElement>("[data-look-id]")?.dataset.lookId
          : slot === "agent-turn-step-trigger"
            ? element.closest<HTMLElement>("[data-part-id]")?.dataset.partId
            : element.closest<HTMLElement>("[data-turn-id]")?.dataset.turnId
    found.set(`${slot}:${owner}`, element.getAttribute("aria-expanded")!)
  }
  return found
}

/**
 * Plays the stream and records every fold after each frame: nothing the
 * reader did not press opens or closes. Returns what the reader pressed.
 */
async function playStream(
  root: HTMLElement,
  reader?: { at: number; press: () => HTMLElement }
) {
  const next = within(root).getByRole("button", { name: "Next" })
  let before = folds(root)
  const pressed = new Set<string>()
  for (let shown = 1; shown < stream.length - 1; shown++) {
    next.click()
    await frames(2)
    if (reader?.at === shown) {
      const element = reader.press()
      await userEvent.click(element)
      const after = folds(root)
      for (const [key, open] of after)
        if (before.get(key) !== undefined && before.get(key) !== open)
          pressed.add(key)
      before = after
    }
    const now = folds(root)
    for (const [key, open] of now)
      if (before.has(key))
        await expect({ key, open }).toEqual({ key, open: before.get(key) })
    // Folded, the live run is its line and the step it is at: it does
    // not grow.
    const live = [
      ...root.querySelectorAll<HTMLElement>("[data-slot=agent-turn-run]"),
    ].at(-1)
    const line = live?.querySelector("[data-slot=agent-turn-run-trigger]")
    if (live && line?.getAttribute("aria-expanded") === "false")
      await expect(
        live.querySelectorAll(":scope > [data-slot=agent-turn-step]").length
      ).toBeLessThanOrEqual(1)
    before = now
  }
  return pressed
}

/**
 * Streamed, the reader opening the run halfway: every fold is recorded
 * after each of the stream's frames, and none opens or closes by itself;
 * the run the reader opened stays open and the steps that follow join it;
 * the turn, touched, stays open when it ends.
 */
export const Streamed: Story = {
  args: { id: "demo:streamed", status: "running", parts: [] },
  render: () => <Streaming id="demo:streamed" />,
  play: async ({ canvasElement }) => {
    const opensAt = stream.findIndex((shown) =>
      shown.parts.some(
        (part) => part.id === "demo:edit:stories" && part.type === "tool"
      )
    )
    const pressed = await playStream(canvasElement, {
      at: opensAt,
      // The live run's line, saying the step it is at.
      press: () =>
        document.querySelector<HTMLElement>(
          "[data-slot=agent-turn-run-trigger]"
        )!,
    })
    await expect([...pressed]).toEqual(["agent-turn-run-trigger:demo:read:1"])
    // Opened, the steps that came after are in it, in order.
    const line = runLine(/^Explored 6 files/)
    await expect(line).toHaveAttribute("aria-expanded", "true")
    await waitFor(() =>
      expect(step("Run the agent-turn stories in chromium")).toBeVisible()
    )
    // Ends: touched, it stays as the reader left it, once it has ended.
    within(canvasElement).getByRole("button", { name: "Next" }).click()
    await waitFor(() => expect(work()).toHaveTextContent(/^Worked for 6m 12s$/))
    await frames(2)
    await expect(work()).toHaveAttribute("aria-expanded", "true")
    await expect(runLine(/^Explored 6 files/)).toHaveAttribute(
      "aria-expanded",
      "true"
    )
  },
}

/**
 * Streamed in a conversation, never touched: nothing opens or closes as
 * it runs; when it ends it folds, once, to its title, and the answer, at
 * the end of the scroller, does not move.
 */
export const StreamedInScroller: Story = {
  args: { id: "demo:scrolled", status: "running", parts: [] },
  render: () => <Streaming id="demo:scrolled" scroller />,
  play: async ({ canvasElement, canvas }) => {
    const pressed = await playStream(canvasElement)
    await expect(pressed.size).toBe(0)
    await expect(
      work(canvasElement.querySelector("[data-message-id=turn]")!)
    ).toHaveAttribute("aria-expanded", "true")
    const viewport = canvas.getByRole("region", { name: "Conversation" })
    const answer = () =>
      canvasElement.querySelector<HTMLElement>('[data-part-id="demo:answer"]')!
    const bottom = () =>
      answer().getBoundingClientRect().bottom -
      viewport.getBoundingClientRect().bottom
    const turn = () =>
      canvasElement.querySelector<HTMLElement>("[data-message-id=turn]")!
    // Where it has settled, the stream played.
    const place = () => [bottom(), viewport.scrollTop, viewport.scrollHeight]
    const busy = () => animating(viewport)
    await settled(place, { busy })
    const before = bottom()
    canvas.getByRole("button", { name: "Next" }).click()
    // Each frame of the fold, until it is over: the answer stays where it
    // was, where the browser anchors scrolling (not WebKit, where the
    // scroller follows the end by script: the line under it giving way to
    // the footer moves it for a few frames). Either way it ends where it
    // was.
    let most = 0
    await settled(
      () => {
        most = Math.max(most, Math.abs(bottom() - before))
        return [...place(), work(turn()).getAttribute("aria-expanded")]
      },
      { busy }
    )
    // WebKit takes overflow-anchor, but does not anchor by it.
    if (!/Version\/[\d.]+ .*Safari/.test(navigator.userAgent))
      await expect(most).toBeLessThanOrEqual(1)
    await waitFor(() =>
      expect(Math.abs(bottom() - before)).toBeLessThanOrEqual(1)
    )
    await expect(work(turn())).toHaveAttribute("aria-expanded", "false")
    await expect(work(turn())).toHaveTextContent(/^Worked for 6m 12s$/)
  },
}

/** Stage 8's turns: what they did before they waited, stopped or failed. */
const waitingParts: AgentTurnPart[] = [
  ...at(index("demo:check"), false),
  {
    ...(events[index("demo:check")]!("done") as AgentToolCall),
    status: "done",
  },
  events[index("demo:edit:stories")]!("done"),
  {
    type: "tool",
    id: "demo:publish",
    kind: "command",
    command: "pnpm publish --dry-run",
    status: "waiting",
  },
]
const stoppedParts: AgentTurnPart[] = [
  ...at(index("demo:apply:1"), false),
  ...[index("demo:edit:a"), index("demo:edit:b"), index("demo:edit:c")].map(
    (each) => events[each]!("done")
  ),
  events[index("demo:check")]!("running"),
]
const failedParts: AgentTurnPart[] = [
  ...at(index("demo:apply:1"), false),
  {
    ...(events[index("demo:test")]!("done") as AgentToolCall),
    status: "error",
    exitCode: 1,
  },
  text(
    "demo:failed",
    "The tool server stopped answering, so I couldn't run the stories."
  ),
]

/**
 * Waiting, stopped, failed (stage 8): waiting for the reader, its last
 * row has a shield, no spinner, what it wants to do and "Waiting for
 * you"; stopped and failed say so in the title, the last row where.
 */
export const WaitingStoppedFailed: Story = {
  args: { id: "demo:states", status: "running", parts: [] },
  render: () => (
    <div className="flex flex-col gap-10">
      <Moment time="Waiting for you">
        <Exchange
          asked={false}
          id="demo:waiting"
          status="running"
          duration="4m 02s"
          parts={waitingParts}
        />
      </Moment>
      <Moment time="Stopped">
        <Exchange
          asked={false}
          id="demo:stopped"
          status="stopped"
          duration="2m 03s"
          parts={stoppedParts}
        />
      </Moment>
      <Moment time="Failed">
        <Exchange
          asked={false}
          id="demo:failed"
          status="error"
          duration="1m 40s"
          parts={failedParts}
        />
      </Moment>
    </div>
  ),
  play: async () => {
    const moment = (time: string) =>
      document.querySelector<HTMLElement>(`[data-moment="${time}"]`)!
    const waiting = step(
      "Wants to run pnpm publish --dry-run",
      moment("Waiting for you")
    )
    await expect(waiting).toHaveAttribute("data-status", "waiting")
    await expect(waiting).toHaveTextContent("Waiting for you")
    await expect(waiting.querySelector("[data-slot=spinner]")).toBeNull()
    await waitFor(() =>
      expect(
        runLine(
          "Explored 6 files, edited 2, ran 2 commands",
          moment("Waiting for you")
        )
      ).toBeVisible()
    )

    const stopped = moment("Stopped")
    await expect(work(stopped)).toHaveTextContent(/^Stopped after 2m 03s$/)
    await waitFor(() =>
      expect(runLine("Explored 6 files, edited 1", stopped)).toBeVisible()
    )
    await waitFor(() =>
      expect(
        step("Stopped while running Type-check the app", stopped)
      ).toBeVisible()
    )

    const failed = moment("Failed")
    await expect(work(failed)).toHaveTextContent(/^Failed after 1m 40s$/)
    await expect(work(failed)).toHaveAttribute("aria-expanded", "true")
    const line = runLine("Explored 6 files, ran a command", failed)
    await expect(line).toHaveTextContent("1 failed")
  },
}

/** A viewport the story's tests run at too (Storybook sets it in Vitest). */
function viewport(name: string, width: number, height: number) {
  return {
    parameters: {
      viewport: {
        options: {
          [name]: {
            name,
            styles: { width: `${width}px`, height: `${height}px` },
            type: width < 600 ? "mobile" : "tablet",
          },
        },
      },
    },
    globals: { viewport: { value: name, isRotated: false } },
  } satisfies Partial<Story>
}

/**
 * On a phone (stage 9): the same, at a phone's sizes, rows 36px and the
 * steps 15px; narrow, a run's failures are their icon and number, and its
 * chevron goes before its words are cut, so its line keeps its words.
 */
export const Phone: Story = {
  ...viewport("phone", 375, 812),
  args: { ...Running.args, id: "demo:phone" },
  render: (args) => <Exchange {...args} />,
  play: async () => {
    const line = runLine("Run the agent-turn stories in chromium")
    const failures = line.querySelector<HTMLElement>(
      "[data-slot=agent-turn-failure]"
    )!
    await expect(failures.innerText).toBe("1")
    await expect(line).toHaveAccessibleName(/1 failed/)
    await expect(line.getBoundingClientRect().height).toBe(36)
    await expect(getComputedStyle(line).fontSize).toBe("15px")
    // Its failures take an icon's and a number's room, the words the rest.
    await expect(failures.getBoundingClientRect().width).toBeLessThan(32)
    // Opened, it says the run's sum, longer.
    await userEvent.click(line)
    await waitFor(() =>
      expect(
        line.querySelector("[data-slot=agent-turn-run-title]")
      ).toHaveTextContent("Explored 6 files, edited 2, ran 2 commands")
    )
    const words = line.querySelector<HTMLElement>(
      "[data-slot=agent-turn-run-title]"
    )!
    // Laid out again once its words changed.
    await waitFor(() => {
      expect(words.getBoundingClientRect().width).toBeGreaterThan(240)
      // Its words and chevron too long for the line: the chevron out of
      // sight, below it, and the words whole, or else to the line's end.
      const chevron = line.querySelector("[data-slot=agent-turn-chevron]")!
      const room = words.parentElement!.getBoundingClientRect()
      expect(words.scrollWidth + 4 + 14).toBeGreaterThan(room.width)
      expect(chevron.getBoundingClientRect().top).toBeGreaterThanOrEqual(
        room.bottom
      )
      expect(
        words.scrollWidth <= words.clientWidth ||
          Math.round(words.getBoundingClientRect().right) ===
            Math.round(room.right)
      ).toBe(true)
    })
  },
}

// The tool steps of a short turn: the build made faster, unused chunks
// dropped, one snapshot test left failing.

const chunksAsked = "Can you make the build faster and drop the unused chunks?"
const chunksAnswer =
  "The build now splits vendor code once and skips what nothing imports. One snapshot test failed; I left it for you to review."

/** A test run's output: 84 lines of passing files, then the failure. */
const testOutput = [
  ...Array.from(
    { length: 84 },
    (_, line) => `✓ src/routes/page-${line + 1}.test.tsx (3)`
  ),
  "✓ src/lib/debounce.test.ts (4)",
  "✗ src/app.test.tsx > renders the pricing route",
  "  Snapshot `pricing 1` mismatched",
  "  - assets/index-3f2a.js",
  "  + assets/vendor-91bc.js",
  " Tests  1 failed | 41 passed (42)",
].join("\n")

const chunks = {
  intro: text(
    "chunks:intro",
    "I'll read the build config, then build and run the tests."
  ),
  config: read("chunks:read:config", "vite.config.ts"),
  manifest: read("chunks:read:package", "package.json"),
  listed: {
    type: "tool",
    id: "chunks:list",
    kind: "list",
    path: "src",
    status: "done",
  } satisfies AgentToolCall,
  plan: text(
    "chunks:plan",
    "Splitting vendor code once should cut the first load."
  ),
  edit: edit("chunks:edit", "vite.config.ts", "done", 4, 2),
  build: command("chunks:build", "pnpm build", "✓ built in 31s"),
  test: command("chunks:test", "pnpm test", testOutput, "error", "12s"),
  answer: text("chunks:answer", chunksAnswer),
}

/** The whole turn: it looked, said what it would do, did it. */
const chunksDone: AgentTurnPart[] = [
  chunks.intro,
  chunks.config,
  chunks.manifest,
  chunks.listed,
  chunks.plan,
  chunks.edit,
  chunks.build,
  chunks.test,
  chunks.answer,
]

/** The user's message, the turn and its footer, as in a conversation. */
function Answered({
  asked = chunksAsked,
  answer,
  ...turn
}: React.ComponentProps<typeof AgentTurn> & {
  asked?: string
  answer: string
}) {
  return (
    <FoldProvider>
      <div className="flex flex-col gap-3">
        <Asked>{asked}</Asked>
        <Message>
          <MessageContent>
            <AgentTurn {...turn} />
            <TurnFooter answer={answer} />
          </MessageContent>
        </Message>
      </div>
    </FoldProvider>
  )
}

/**
 * Tool steps, done: the work folds to "Worked for 48s", its chevron after
 * it, the answer under it; a failure nothing made good stays seen at the
 * title's end.
 */
export const StepsCollapsed: Story = {
  args: {
    id: "chunks:collapsed",
    status: "done",
    duration: "48s",
    parts: chunksDone,
  },
  render: (args) => <Answered {...args} answer={chunksAnswer} />,
  play: async ({ canvas }) => {
    const title = work()
    await expect(title).toHaveAttribute("aria-expanded", "false")
    await expect(title).toHaveAccessibleName("Worked for 48s")
    await expect(title).toHaveAccessibleDescription("1 failed")
    const header = title.parentElement!
    const failures = header.querySelector<HTMLElement>(
      "[data-slot=agent-turn-failures]"
    )!
    await expect(
      failures.querySelector<HTMLElement>("[data-slot=agent-turn-failure]")!
        .innerText
    ).toBe("1 failed")
    // At the turn's end, in the middle of its title's line.
    const turn = document.querySelector("[data-slot=agent-turn]")!
    await expect(Math.round(failures.getBoundingClientRect().right)).toBe(
      Math.round(turn.getBoundingClientRect().right)
    )
    await expect(Math.abs(middle(failures) - middle(title))).toBeLessThan(1)
    // As a run's line says it.
    await expect(
      Number(
        getComputedStyle(
          failures.querySelector("[data-slot=agent-turn-failure]")!
        ).fontWeight
      )
    ).toBe(500)
    await waitFor(() =>
      expect(canvas.getByText(/^The build now splits/)).toBeVisible()
    )
    // Opened, the runs' lines say it: the title does not.
    await userEvent.click(title)
    await waitFor(() =>
      expect(header.querySelector("[data-slot=agent-turn-failures]")).toBeNull()
    )
    await expect(runLine("Edited a file, ran 2 commands")).toHaveTextContent(
      "1 failed"
    )
    await userEvent.click(title)
    ;(document.activeElement as HTMLElement | null)?.blur()
  },
}

/**
 * Opened: a rule under the title; what it said between its steps at the
 * answer's size, the steps' icons at its edge; each run a line of what it
 * did; the answer as far under the last line as what it said.
 */
export const StepsOpened: Story = {
  args: { ...StepsCollapsed.args, id: "chunks:opened" },
  render: (args) => (
    <Exchange
      {...args}
      asked={chunksAsked}
      folds={{ "chunks:opened:work": true }}
    />
  ),
  play: async ({ canvas }) => {
    await expect(work()).toHaveAttribute("aria-expanded", "true")
    await expect(lookLine("Read 2 files, listed 1 folder")).toHaveAttribute(
      "aria-expanded",
      "false"
    )
    const line = runLine("Edited a file, ran 2 commands")
    await expect(line).toHaveTextContent("1 failed")
    // Under the open work's last line, the answer a paragraph's distance
    // (12px), as far as what it said between steps is from them.
    const answer = canvas.getByText(/^The build now splits/)
    const gap =
      answer.getBoundingClientRect().top - line.getBoundingClientRect().bottom
    const said = canvas.getByText(/^Splitting vendor code/)
    const lookGap =
      said.getBoundingClientRect().top -
      lookLine(/^Read 2 files/).getBoundingClientRect().bottom
    await expect(Math.round(gap)).toBe(12)
    await expect(Math.round(lookGap)).toBe(12)
    await expect(
      document.querySelector(
        "[data-slot=agent-turn-work-header] [data-slot=agent-turn-failures]"
      )
    ).toBeNull()
  },
}

/**
 * Running: the title shimmers and counts; the earlier run is its line,
 * the live one too, saying the step it is at, a spinner.
 */
export const StepsRunning: Story = {
  args: {
    id: "chunks:running",
    status: "running",
    duration: "47s",
    parts: [
      ...chunksDone.slice(0, 7),
      command("chunks:test", "pnpm test", "", "running"),
    ],
  },
  render: (args) => <Exchange {...args} asked={chunksAsked} />,
  play: async () => {
    await expect(work()).toHaveTextContent(/^Working · 47s$/)
    await waitFor(() =>
      expect(lookLine("Read 2 files, listed 1 folder")).toBeVisible()
    )
    const live = runLine("Running pnpm test")
    await expect(live).toHaveAttribute("aria-expanded", "false")
    await expect(
      live.querySelector("[data-slot=agent-turn-step-icon] [data-slot=spinner]")
    ).not.toBeNull()
    await expect(
      document.querySelector("[data-slot=agent-turn-step]")
    ).toBeNull()
  },
}

/**
 * A failed step, opened: "Exit 1" and an alert at its line's end, its
 * kind's icon kept; opened, the command whole, to copy or open in the
 * app's view, and the last lines of its output, the earlier on request.
 */
export const StepsFailedOpened: Story = {
  args: {
    id: "chunks:failed",
    status: "done",
    duration: "48s",
    onExpand: fn(),
    parts: [
      chunks.plan,
      chunks.edit,
      chunks.build,
      chunks.test,
      text(
        "chunks:left",
        "The snapshot still names the old chunk. I left it for you to review."
      ),
    ],
  },
  render: (args) => (
    <Exchange
      {...args}
      asked={false}
      folds={{
        "chunks:failed:work": true,
        "chunks:edit:run": true,
        "chunks:test": true,
      }}
    />
  ),
  play: async () => {
    const failed = step("Ran pnpm test")
    await expect(failed).toHaveTextContent("Exit 1")
    await waitFor(() =>
      expect(
        failed.querySelector("[data-slot=agent-turn-step-icon] svg")
      ).toBeVisible()
    )
    const block = failed.querySelector<HTMLElement>(
      "[data-slot=agent-turn-command]"
    )!
    // Its line says the command: over the output, it is a label, by a
    // terminal's icon, on a 32px header over its rule.
    const header = block.querySelector<HTMLElement>(
      "[data-slot=agent-turn-command-line]"
    )!
    await expect(header).toHaveAttribute("data-label")
    await expect(header.clientHeight).toBe(32)
    await waitFor(() => expect(header.querySelector("svg")).toBeVisible())
    await expect(
      getComputedStyle(header.querySelector("code")!).fontFamily
    ).not.toMatch(/mono/i)
    await waitFor(() =>
      expect(within(block).getByText(/Tests 1 failed/)).toBeVisible()
    )
    await waitFor(() =>
      expect(
        within(block).getByRole("button", { name: "Show 86 earlier lines" })
      ).toBeVisible()
    )
    await expect(step("Edited vite.config.ts")).toHaveTextContent("+4 −2")
    // Opened, no time: "⚠ Exit 1" alone at its end; its time on hover.
    const time = failed.querySelector<HTMLElement>(
      "[data-slot=agent-turn-step-duration]"
    )!
    await expect(time).toHaveTextContent("12s")
    await expect(getComputedStyle(time).opacity).toBe("0")
    // Its output toned: the run's tally faint, the rest plain.
    const lines = [
      ...block.querySelectorAll<HTMLElement>("[data-slot=code-block-line]"),
    ]
    await expect(lines.map((line) => line.dataset.tone)).toEqual([
      "plain",
      "plain",
      "plain",
      "faint",
    ])
  },
}

/** A search on the web: the app's own kind, worded by the app. */
const webSearch = (id: string, query: string) =>
  ({
    type: "tool",
    id,
    kind: "web",
    status: "done",
    icon: <HugeiconsIcon icon={Globe02Icon} strokeWidth={2} />,
    title: (
      <>
        Searched the web for <AgentTurnTarget>{query}</AgentTurnTarget>
      </>
    ),
  }) satisfies AgentToolCall

const web = { web: () => "searched the web" }

/**
 * A run opened: a line a step, at the run line's edge; the reads and the
 * listing in a row one line, opened too; files underlined with dots.
 */
export const StepsRunOpened: Story = {
  args: {
    id: "chunks:run",
    status: "done",
    duration: "2m 19s",
    kinds: web,
    parts: [
      text(
        "lodash:intro",
        "I'll read the repository guidance and the build config, then check why lodash is still in the bundle."
      ),
      read("lodash:read:a", "AGENTS.md"),
      read("lodash:read:b", "vite.config.ts"),
      { ...chunks.listed, id: "lodash:list" },
      command("lodash:why", "pnpm why lodash", "lodash 4.17.21"),
      webSearch("lodash:web", "vite manualChunks vendor splitting"),
      text(
        "lodash:answer",
        "Only the debounce helper pulls lodash in; replacing it drops 24 KB."
      ),
    ],
  },
  render: (args) => (
    <Exchange
      {...args}
      asked={false}
      folds={{
        "chunks:run:work": true,
        "lodash:read:a:run": true,
        "lodash:read:a:look": true,
      }}
    />
  ),
  play: async () => {
    const line = runLine("Explored 2 files, ran a command, searched the web")
    await expect(line).toHaveAttribute("aria-expanded", "true")
    await waitFor(() => expect(step("Read AGENTS.md")).toBeVisible())
    await waitFor(() => expect(step("Listed files in src")).toBeVisible())
    await waitFor(() =>
      expect(
        step("Searched the web for vite manualChunks vendor splitting")
      ).toBeVisible()
    )
  },
}

/**
 * Each kind, a line alone (`AgentTurnStep`): its icon, its verb, what it
 * acted on a step lighter (a file underlined with dots), and only what
 * matters at the end: lines changed, a failure.
 */
export const StepsKinds: Story = {
  args: {
    id: "chunks:kinds",
    status: "done",
    parts: [
      read("kind:read", "src/app.test.tsx"),
      { ...chunks.listed, id: "kind:list", path: "src/lib" },
      command("kind:build", "pnpm build", "✓ built in 31s"),
      webSearch("kind:web", "rollup output.manualChunks"),
      edit("kind:edit", "vite.config.ts", "done", 4, 2),
      command("kind:test", "pnpm test", "✗ 1 failed", "error"),
      search("kind:search", "manualChunks"),
      command("kind:running", "pnpm test", "", "running"),
    ],
  },
  render: (args) => (
    <div className="flex flex-col">
      {args.parts.map((part) => (
        <AgentTurnStep key={part.id} part={part as AgentToolCall} />
      ))}
    </div>
  ),
  play: async () => {
    const words = [
      ...document.querySelectorAll("[data-slot=agent-turn-step-title]"),
    ].map((title) => title.textContent)
    await expect(words).toEqual([
      "Read app.test.tsx",
      "Listed files in src/lib",
      "Ran pnpm build",
      "Searched the web for rollup output.manualChunks",
      "Edited vite.config.ts",
      "Ran pnpm test",
      "Searched for manualChunks",
      "Running pnpm test",
    ])
    await expect(step("Edited vite.config.ts")).toHaveTextContent("+4 −2")
    await expect(step("Ran pnpm test")).toHaveTextContent("Exit 1")
  },
}

/**
 * A failure made good: the same command ran again and passed, so the
 * run's line does not count it; its own row still says it failed.
 */
export const ResolvedFailure: Story = {
  args: {
    id: "turn:resolved",
    status: "done",
    duration: "52s",
    parts: [
      command("fix:1", "pnpm test", "✗ 1 failed", "error", "12s"),
      edit("fix:2", "src/cache.ts", "done", 3, 1),
      command("fix:3", "pnpm test", "✓ 42 passed", "done", "11s"),
      text("fix:answer", "The cache test passes now."),
    ],
  },
  render: (args) => (
    <Exchange
      {...args}
      asked={false}
      folds={{ "turn:resolved:work": true, "fix:1:run": true }}
    />
  ),
  play: async () => {
    const line = runLine("Edited a file, ran 2 commands")
    await expect(
      line.querySelector("[data-slot=agent-turn-failures]")
    ).toBeNull()
    const failed = [
      ...document.querySelectorAll<HTMLElement>("[data-part-id='fix:1']"),
    ][0]!
    await expect(failed).toHaveAttribute("data-status", "error")
    await expect(failed).toHaveTextContent("Exit 1")
  },
}

/**
 * Past three groups, the run keeps edits, commands and reads, in their
 * order, and counts the rest; its failures stay at its end.
 */
export const RunSummaryCapped: Story = {
  args: {
    id: "turn:capped",
    status: "done",
    kinds: { ...web, review: (calls) => `reviewed ${calls} changes` },
    parts: [
      read("cap:read:a", "a.ts"),
      read("cap:read:b", "b.ts"),
      search("cap:search", "config"),
      edit("cap:edit:a", "a.ts"),
      edit("cap:edit:b", "b.ts"),
      command("cap:build", "pnpm build", "built"),
      command("cap:lint", "pnpm lint", "passed"),
      command("cap:test", "pnpm test", "failed", "error"),
      webSearch("cap:web", "config"),
      {
        type: "tool",
        id: "cap:review",
        kind: "review",
        status: "done",
        title: "Reviewed changes",
      },
      { type: "tool", id: "cap:other", status: "done", title: "Used a tool" },
      text("cap:answer", "Two files updated."),
      read("keep:read", "c.ts"),
      webSearch("keep:web", "tests"),
    ],
  },
  render: (args) => (
    <Exchange {...args} asked={false} folds={{ "turn:capped:work": true }} />
  ),
  play: async () => {
    const line = runLine(
      "Explored 2 files, edited 2, ran 3 commands and 3 other actions"
    )
    await waitFor(() => expect(line).toBeVisible())
    await expect(
      line.querySelector("[data-slot=agent-turn-failures]")
    ).toHaveTextContent("1 failed")
    await expect(line.lastElementChild).toHaveAttribute(
      "data-slot",
      "agent-turn-failures"
    )
    await waitFor(() =>
      expect(runLine("Explored 1 file, searched the web")).toBeVisible()
    )
  },
}

/** Only `otherActions` given: the default line ends in the app's words. */
export const RunSummaryOtherActions: Story = {
  args: {
    ...RunSummaryCapped.args,
    id: "turn:capped-words",
    labels: { otherActions: (actions) => `${actions} more` },
  },
  render: RunSummaryCapped.render!,
  play: async () => {
    await waitFor(() =>
      expect(
        runLine("Explored 2 files, edited 2, ran 3 commands and 3 more")
      ).toBeVisible()
    )
  },
}

/** A bold heading stays the live thought while its details stream. */
export const ThinkingLine: Story = {
  args: {
    id: "turn:thinking-line",
    status: "running",
    parts: [
      {
        ...reasoning,
        status: "running",
        text: "**Planning the split**\n\nI'll read `vite.config.ts` first. Then the tests.\n\n- half",
      },
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(
      canvasElement.querySelector("[data-slot=agent-turn-thought]")
    ).toHaveTextContent(/^Planning the split$/)
    const cases = [
      ["**Old**\n\n__New `heading`__", "New heading"],
      ["Old thought.\n\nNewest thought! More detail.", "Newest thought!"],
      [
        "Read [the docs](https://example.com) and ![diagram](image.png). Then test.",
        "Read the docs and diagram.",
      ],
      ["Read `vite.config.ts` first. Then test.", "Read vite.config.ts first."],
      ["> - **Bold** item", "Bold item"],
      ["**Two** bold **words**", "Two bold words"],
      ["> > 1) [x] ~~Done~~ item", "Done item"],
      ["## Step two", "Step two"],
      ["Keep snake_case_name and a * b", "Keep snake_case_name and a * b"],
      ["*Emphasis* and _more_", "Emphasis and more"],
      ["**Plann", "Plann"],
      ["Previous thought.\n\n- ", "Previous thought."],
      ["Previous thought.\n\n**", "Previous thought."],
      ["…so the test fails. Then", "…so the test fails."],
      ['She said "Done!" Then left.', 'She said "Done!"'],
      ["Normal sentence? Another one.", "Normal sentence?"],
      ["See <https://example.com/docs>", "See https://example.com/docs"],
      ["", ""],
      [" \n\t", ""],
    ]
    for (const [input, output] of cases) {
      await expect(thoughtLine(input!)).toBe(output)
    }
  },
}

/**
 * Thinking: the title says so, shimmering in the text's colour ("Thinking
 * · 4s"); under it a running step's spinner and the newest sentence of the
 * thought alone, as it comes: it is seen going, not a turn done.
 */
export const Thinking: Story = {
  args: {
    id: "turn:thinking",
    status: "running",
    duration: "4s",
    parts: [
      {
        ...reasoning,
        id: "reasoning:thinking",
        status: "running",
        text: "The vendor chunk is split out now.\n\n…so the snapshot test fails because the chunk names now include a hash, which",
      },
    ],
  },
  play: async () => {
    await expect(work()).toHaveTextContent(/^Thinking · 4s$/)
    const thought = document.querySelector<HTMLElement>(
      "[data-slot=agent-turn-thought]"
    )!
    await expect(thought).toHaveTextContent(
      /^…so the snapshot test fails because/
    )
    await expect(thought).not.toHaveTextContent(/vendor chunk is split/)
    // Its words where a step's words are, in the muted grey, one line.
    const turn = document.querySelector<HTMLElement>("[data-slot=agent-turn]")!
    await expect(left(thought)).toBe(left(turn) + 24)
    await expect(thought).toHaveClass("text-muted-foreground", "truncate")
    // One spinner, a running step's, in the icon column of its row; the
    // thought does not say "Thinking" again.
    const spinners = turn.querySelectorAll("[data-slot=spinner]")
    await expect(spinners).toHaveLength(1)
    const row = thought.parentElement!
    await expect(row.contains(spinners[0]!)).toBe(true)
    // Its 16px column at the turn's edge, the 14px spinner centred in it.
    await expect(
      left(spinners[0]!.closest("[data-slot=agent-turn-step-icon]")!)
    ).toBe(left(turn))
    await expect(middle(spinners[0]!)).toBe(middle(thought))
    await expect(row).not.toHaveTextContent(/Thinking/)
    // Only thinking: its title bare, no chevron, its rule unseen but kept
    // in its place, so nothing moves as the first step comes.
    const header = turn.querySelector<HTMLElement>(
      "[data-slot=agent-turn-work-header]"
    )!
    await expect(
      header.querySelector("[data-slot=agent-turn-chevron]")
    ).toBeNull()
    await expect(getComputedStyle(header).borderBottomColor).toBe(
      "rgba(0, 0, 0, 0)"
    )
    await expect(getComputedStyle(header).paddingBottom).toBe("8px")
    // The title in the body text's colour while it runs.
    const title = turn.querySelector("[data-slot=agent-turn-work-title]")!
    await expect(getComputedStyle(title).color).toBe(
      getComputedStyle(document.body).color
    )
  },
}

/** A thought over: two paragraphs, 12 seconds. */
const thought = (id: string) =>
  ({
    type: "reasoning",
    id,
    status: "done",
    duration: "12s",
    text: "The config inlines dynamic imports, so every route ships one bundle. Splitting vendor once and letting routes split CSS should cut the first load.\n\nlodash is only used for debounce and get; both are a few lines natively.",
  }) satisfies AgentTurnPart

/**
 * A thought, over: a quiet line, "Thought for 12s", a brain for its icon,
 * with no title over it when it is all the work; opened, its paragraphs a
 * little apart, set off by a rule, its words where a step's are.
 */
export const Thought: Story = {
  args: { id: "turn:thought", status: "done", duration: "12s", parts: [] },
  render: () => (
    <div className="flex flex-col gap-10">
      <Exchange
        asked={false}
        id="turn:thought:closed"
        status="done"
        duration="12s"
        parts={[thought("thought:closed")]}
      />
      <Exchange
        asked={false}
        id="turn:thought:opened"
        status="done"
        duration="12s"
        parts={[thought("thought:opened")]}
        folds={{ "thought:opened": true }}
      />
    </div>
  ),
  play: async () => {
    const closed = step("Thought for 12s")
    await expect(closed).not.toHaveAttribute("data-open")
    // Its line is all: no "Worked for 12s" over it.
    await expect(
      document.querySelector("[data-slot=agent-turn-work]")
    ).toBeNull()
    const opened = document.querySelector<HTMLElement>(
      '[data-part-id="thought:opened"]'
    )!
    const body = opened.querySelector<HTMLElement>(
      "[data-slot=agent-turn-reasoning]"
    )!
    await expect(body.children).toHaveLength(2)
    await expect(getComputedStyle(body).rowGap).toBe("8px")
    // Its rule, a hairline under the icon, drawn over its padding.
    await expect(getComputedStyle(body, "::before").width).toBe("1px")
    // Its words where the line's are.
    const words = opened.querySelector("[data-slot=agent-turn-step-title]")!
    await expect(left(body.firstElementChild!)).toBe(left(words))
  },
}

/**
 * Running: its title says how long since it started (`startedAt`, counted
 * each second) and the app's `metrics`. Between steps the work's next
 * line is a spinner, right under the last step, its icon in theirs; the
 * step that comes takes the last one's line. None while a step runs (its
 * own spinner says so), or waits for the reader.
 */
export const Pending: Story = {
  args: {
    id: "turn:pending",
    status: "running",
    metrics: "38 tok/s",
    parts: [
      text("pending:said", "I'll look at the build first."),
      command("pending:ls", "ls scripts", "build.ts", "done", "0.1s"),
    ],
  },
  render: function Render(args) {
    // 12s before it is shown, not before the stories were loaded: the
    // test may run a minute later.
    const [startedAt] = React.useState(() => Date.now() - 12_000)
    return (
      <div className="flex flex-col gap-10">
        <div data-testid="between">
          <AgentTurn startedAt={startedAt} {...args} />
        </div>
        <div data-testid="stepping">
          <AgentTurn
            startedAt={startedAt}
            {...args}
            id="turn:pending:step"
            parts={[
              ...args.parts,
              command("pending:test", "pnpm test", "", "running"),
            ]}
          />
        </div>
      </div>
    )
  },
  play: async ({ canvas }) => {
    const between = canvas.getByTestId("between")
    const title = between.querySelector<HTMLElement>(
      "[data-slot=agent-turn-work-title]"
    )!
    await waitFor(() =>
      expect(title).toHaveTextContent(/^Working · \d+s · 38 tok\/s$/)
    )
    // Counted each second.
    const shown = title.textContent
    await waitFor(() => expect(title.textContent).not.toBe(shown), {
      timeout: 2000,
    })
    // Between steps: a spinner alone, no words again, the work's next line.
    const pending = between.querySelector<HTMLElement>(
      "[data-slot=agent-turn-pending]"
    )!
    await expect(pending.querySelector("svg")).not.toBeNull()
    await expect(pending).toHaveTextContent(/^$/)
    // The last step's line, the run before it.
    const last = pending.previousElementSibling!
    const box = (element: Element) => element.getBoundingClientRect()
    await expect(Math.round(box(pending).top)).toBe(
      Math.round(box(last).bottom)
    )
    await expect(Math.round(box(pending).height)).toBe(
      Math.round(box(last).height)
    )
    await expect(
      left(pending.querySelector("[data-slot=agent-turn-step-icon]")!)
    ).toBe(left(last.querySelector("[data-slot=agent-turn-step-icon]")!))
    // The step that comes takes the last one's line: the live run's one
    // line says it, in its place.
    const stepping = canvas.getByTestId("stepping")
    const running = runLine(/pnpm test/, stepping)
    await expect(Math.round(box(running).top - box(stepping).top)).toBe(
      Math.round(box(last).top - box(between).top)
    )
    // A step running: its spinner, no other.
    await expect(
      stepping.querySelector("[data-slot=agent-turn-pending]")
    ).toBeNull()
  },
}

/**
 * Its link to the agent lost while it runs: "Reconnecting 2/5" at its
 * end, shimmering, in place of its spinner, then "Disconnected" once the
 * app stops trying; a status, read as it changes.
 */
export const Reconnecting: Story = {
  args: {
    id: "turn:reconnecting",
    status: "running",
    duration: "40s",
    connection: { attempt: 2, attempts: 5 },
    parts: [
      text("reconnecting:said", "I'll look at the build first."),
      command("reconnecting:ls", "ls scripts", "build.ts", "done", "0.1s"),
    ],
  },
  render: (args) => (
    <div className="flex flex-col gap-10">
      <AgentTurn {...args} />
      <AgentTurn {...args} id="turn:offline" connection="offline" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const [trying, lost] = [
      ...canvasElement.querySelectorAll<HTMLElement>(
        "[data-slot=agent-turn-connection]"
      ),
    ]
    await expect(trying).toHaveAttribute("role", "status")
    await expect(trying).toHaveTextContent("Reconnecting 2/5")
    await expect(trying!.querySelector(".shimmer")).not.toBeNull()
    await expect(lost).toHaveTextContent("Disconnected")
    await expect(lost!.querySelector(".shimmer")).toBeNull()
    // In place of the spinner between steps.
    await expect(
      canvasElement.querySelector("[data-slot=agent-turn-pending]")
    ).toBeNull()
  },
}

/**
 * Started, with nothing come yet: its title alone, shimmering, its rule's
 * place kept as the open work's, so nothing moves when the first step
 * comes.
 */
export const Starting: Story = {
  args: { id: "turn:starting", status: "running", duration: "1s", parts: [] },
  render: function Render(args) {
    const [stage, setStage] = React.useState(0)
    const thinking = {
      ...reasoning,
      id: "reasoning:starting",
      status: "running",
      text: "",
    } satisfies AgentTurnPart
    return (
      <div className="flex flex-col items-start gap-3">
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setStage(1)}>
            Start thinking
          </Button>
          <Button size="sm" variant="outline" onClick={() => setStage(2)}>
            Run a step
          </Button>
        </div>
        <AgentTurn
          {...args}
          parts={
            stage === 0
              ? args.parts
              : stage === 1
                ? [thinking]
                : [
                    { ...thinking, status: "done", text: "The build first." },
                    command("starting:ls", "ls scripts", "", "running"),
                  ]
          }
        />
      </div>
    )
  },
  play: async ({ canvas }) => {
    const title = () =>
      document.querySelector<HTMLElement>("[data-slot=agent-turn-work-title]")
    const pending = () =>
      document.querySelector<HTMLElement>("[data-slot=agent-turn-pending]")!
    // Nothing come yet: its end's line alone, that it is going.
    await expect(pending()).toHaveTextContent(/^Working/)
    await expect(title()).toBeNull()
    await expect(work()).toBeNull()
    // Its words, past its spinner.
    const before = pending().lastElementChild!.getBoundingClientRect()

    await userEvent.click(
      canvas.getByRole("button", { name: "Start thinking" })
    )
    await expect(work()).toHaveAttribute("aria-expanded", "true")
    // The work's title where the line was, saying the same (its text's
    // middle within 2px); the line under the work.
    const middle = (box: DOMRect) => box.top + box.height / 2
    await expect(
      Math.abs(
        middle(title()!.firstElementChild!.getBoundingClientRect()) -
          middle(before)
      )
    ).toBeLessThanOrEqual(2)
    await expect(title()).toHaveTextContent(/^Thinking · 1s$/)
    await expect(title()!.firstElementChild).toHaveClass("shimmer")
    // Its thought's line says it is going: no spinner at the end, one
    // there, even before any of its words.
    await expect(
      document.querySelector("[data-slot=agent-turn-pending]")
    ).toBeNull()
    const thought = document.querySelector<HTMLElement>(
      "[data-slot=agent-turn-thought]"
    )!
    await expect(thought).toHaveTextContent(/^$/)
    await expect(
      thought.parentElement!.querySelectorAll("[data-slot=spinner]")
    ).toHaveLength(1)

    // The first step: the title's chevron and rule show where they were
    // kept; nothing above the step moves.
    const header = document.querySelector<HTMLElement>(
      "[data-slot=agent-turn-work-header]"
    )!
    const titleTop = title()!.getBoundingClientRect().top
    const firstTop = thought.parentElement!.getBoundingClientRect().top
    await expect(
      header.querySelector("[data-slot=agent-turn-chevron]")
    ).toBeNull()
    await userEvent.click(canvas.getByRole("button", { name: "Run a step" }))
    await expect(title()).toHaveTextContent(/^Working/)
    await expect(
      header.querySelector("[data-slot=agent-turn-chevron]")
    ).not.toBeNull()
    await expect(getComputedStyle(header).borderBottomColor).not.toBe(
      "rgba(0, 0, 0, 0)"
    )
    await expect(title()!.getBoundingClientRect().top).toBe(titleTop)
    await expect(
      document
        .querySelector("[data-slot=agent-turn-run]")!
        .getBoundingClientRect().top
    ).toBe(firstTop)
  },
}

/**
 * Decided: the reader's answer to a request is a step, with its own icon;
 * allowed and denied look the same, only the words differ. Opened, the
 * request as it was.
 */
export const Decided: Story = {
  args: {
    id: "turn:decided",
    status: "done",
    duration: "48s",
    parts: [
      command("run:d1", "git tag v0.1.9", "", "done", "0.1s"),
      {
        type: "decision",
        id: "decision:d1",
        icon: <HugeiconsIcon icon={SecurityCheckIcon} strokeWidth={2} />,
        title: (
          <>
            Allowed <AgentTurnTarget code>git push origin main</AgentTurnTarget>
          </>
        ),
        meta: "Once · by you",
        details: (
          <p className="font-mono text-xs">
            $ git push origin main --follow-tags
          </p>
        ),
      },
      command("run:d2", "git push origin main", "", "done", "2.4s"),
      {
        type: "decision",
        id: "decision:d2",
        icon: <HugeiconsIcon icon={SecurityCheckIcon} strokeWidth={2} />,
        title: (
          <>
            Denied <AgentTurnTarget code>rm -rf dist</AgentTurnTarget>
          </>
        ),
        meta: "By you",
      },
      text("answer:d", "Pushed the tag; dist is as it was."),
    ],
  },
  render: (args) => (
    <Exchange
      {...args}
      asked={false}
      folds={{ "turn:decided:work": true, "run:d1:run": true }}
    />
  ),
  play: async ({ canvas }) => {
    // Decisions are not counted: the commands are.
    await expect(runLine("Ran 2 commands")).toHaveAttribute(
      "aria-expanded",
      "true"
    )
    const allowed = step("Allowed git push origin main")
    await expect(allowed).toHaveTextContent("Once · by you")
    const denied = step("Denied rm -rf dist")
    await expect(getComputedStyle(denied).color).toBe(
      getComputedStyle(allowed).color
    )
    const opener = canvas.getByRole("button", {
      name: /Allowed git push origin main/,
    })
    await userEvent.click(opener)
    await waitFor(async () =>
      expect(
        await canvas.findByText("$ git push origin main --follow-tags")
      ).toBeVisible()
    )
    // Closed again, as it stays among the steps.
    await userEvent.click(opener)
    opener.blur()
  },
}

/** Done without an answer: closed, it would leave nothing, so it is open. */
export const NoAnswer: Story = {
  args: {
    id: "turn:no-answer",
    status: "done",
    duration: "3s",
    parts: [command("run:7", "pnpm format", "✓ 212 files")],
  },
  play: async () => {
    await expect(work()).toHaveAttribute("aria-expanded", "true")
    // A single step is its line alone, no run's line over it.
    await waitFor(() => expect(step("Ran pnpm format")).toBeVisible())
    await expect(
      document.querySelector("[data-slot=agent-turn-run-trigger]")
    ).toBeNull()
  },
}

const searched = {
  id: "turn:search",
  status: "done",
  duration: "48s",
  parts: [
    reasoning,
    read("read:1", "vite.config.ts"),
    read("read:2", "scripts/cache.ts"),
    read("read:0", "package.json"),
    text("said", "The cache key changes on every deploy."),
    command("run:1", "pnpm build", "✓ built in 41s"),
    edit("edit:1", "scripts/cache.ts"),
    edit("edit:2", "scripts/cache.ts"),
    text("answer", "It is keyed on the images' content now."),
  ],
} satisfies React.ComponentProps<typeof AgentTurn>

/** As an app's search would: opens the folds a part is in, and goes to it. */
function Reveal({ part }: { part: string }) {
  const setFold = useSetFold()
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        for (const key of agentTurnFolds(searched, part)) setFold(key, true)
        requestAnimationFrame(() =>
          document
            .querySelector(`[data-part-id="${part}"]`)
            ?.scrollIntoView({ block: "nearest" })
        )
      }}
    >
      Show {part}
    </Button>
  )
}

/**
 * A part found by the app's search, in a folded turn: the folds it is in
 * open (`agentTurnFolds`, `useSetFold`), and it is found by its id.
 */
export const Search: Story = {
  args: searched,
  render: (args) => (
    <div className="flex flex-col gap-4">
      <Reveal part="read:2" />
      <AgentTurn {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    // In the work, in a run, in its reads; in the work; in no fold.
    await expect(agentTurnFolds(searched, "read:2")).toEqual([
      "turn:search:work",
      "reasoning:run",
      "read:1:look",
    ])
    await expect(agentTurnFolds(searched, "said")).toEqual(["turn:search:work"])
    // A file's second edit is in its first's line.
    await expect(agentTurnFolds(searched, "edit:2")).toEqual([
      "turn:search:work",
      "run:1:run",
      "edit:1",
    ])
    await expect(agentTurnFolds(searched, "answer")).toEqual([])

    await expect(work()).toHaveAttribute("aria-expanded", "false")
    await userEvent.click(canvas.getByRole("button", { name: "Show read:2" }))
    await expect(work()).toHaveAttribute("aria-expanded", "true")
    await waitFor(() =>
      expect(
        document.querySelector('[data-part-id="read:2"]')
      ).toHaveTextContent("Read cache.ts")
    )
    for (const [id, words] of [
      ["reasoning", "Thought"],
      ["said", "changes on every deploy"],
      ["answer", "keyed on the images"],
    ])
      await expect(
        document.querySelector(`[data-part-id="${id}"]`)
      ).toHaveTextContent(words!)
  },
}

/** The app's own kinds: what a subagent's and a search's calls did. */
const kinds = {
  agent: (n: number) => `explored with ${n} ${n === 1 ? "agent" : "agents"}`,
}

const icons = {
  agent: <HugeiconsIcon icon={Robot01Icon} strokeWidth={2} />,
}

function search(id: string, pattern: string) {
  return {
    type: "tool",
    id,
    kind: "search",
    pattern,
    status: "done",
    duration: "0.1s",
  } satisfies AgentToolCall
}

/**
 * A subagent, as the app makes its call: a robot for its icon, what it
 * does at the line's end ("3 steps", "No steps"), what it is at now under
 * its words while it runs, and its own `AgentTurn` (its own `id`) for
 * details, if it did anything: done with nothing, the call does not open.
 */
function subagent(
  id: string,
  task: string,
  status: AgentToolCall["status"],
  parts: AgentTurnPart[],
  {
    outcome,
    progress,
    turn = status === "running" || status === "waiting"
      ? "running"
      : status === "error"
        ? "error"
        : "done",
  }: {
    outcome?: React.ReactNode
    progress?: React.ReactNode
    turn?: React.ComponentProps<typeof AgentTurn>["status"]
  } = {}
) {
  const running = status === "running" || status === "waiting"
  const steps = parts.filter((part) => part.type !== "content").length
  return {
    type: "tool",
    id,
    kind: "agent",
    status,
    icon: icons.agent,
    title: (
      <>
        {running ? "Exploring" : "Explored"}{" "}
        <AgentTurnTarget>{task}</AgentTurnTarget>
      </>
    ),
    outcome:
      outcome ??
      (status === "waiting"
        ? undefined
        : steps > 0
          ? `${steps} ${steps === 1 ? "step" : "steps"}`
          : running
            ? undefined
            : "No steps"),
    ...(progress !== undefined && { progress }),
    ...(parts.length > 0 && {
      details: <AgentTurn id={`${id}:turn`} status={turn} parts={parts} />,
    }),
  } satisfies AgentToolCall
}

const intro = (id: string) =>
  text(id, "I'll look at the build, the tests and the CI config side by side.")

/** Three subagents at once, each with what it is at now under it. */
const parallel = (stage: string): AgentTurnPart[] => [
  intro(`${stage}:intro`),
  subagent(
    `${stage}:build`,
    "the build scripts",
    "running",
    [
      read(`${stage}:build:a`, "scripts/build.ts"),
      read(`${stage}:build:b`, "scripts/cache.ts"),
      text(
        `${stage}:build:said`,
        "The cache keys on the lockfile only, so it never misses. The image step is next."
      ),
      read(`${stage}:build:c`, "scripts/optimize-images.ts", "running"),
    ],
    { progress: "Reading scripts/optimize-images.ts" }
  ),
  subagent(
    `${stage}:tests`,
    "the test setup",
    "running",
    [
      command(
        `${stage}:tests:a`,
        "pnpm vitest --reporter=json",
        "…",
        "running"
      ),
    ],
    { progress: "Running pnpm vitest --reporter=json" }
  ),
  subagent(`${stage}:ci`, "the CI config", "running", [], {
    progress: "Starting",
  }),
]

/** Done: three subagents, the first with what it handed back. */
const explored: AgentTurnPart[] = [
  subagent("done:build", "the build scripts", "done", [
    read("done:build:a", "scripts/build.ts"),
    read("done:build:b", "scripts/cache.ts"),
    read("done:build:c", "scripts/optimize-images.ts"),
    command("done:build:d", "pnpm build --profile", "images 7m 40s"),
    search("done:build:e", "sharp("),
    {
      type: "content",
      id: "done:build:result",
      content: (
        <AgentTurnResult>
          Image optimization takes 7m 40s of 9m. Its cache key is the
          lockfile&apos;s hash, so it misses only when dependencies change;
          everything else re-encodes every image.
        </AgentTurnResult>
      ),
    },
  ]),
  subagent("done:tests", "the test setup", "done", [
    read("done:tests:a", "vitest.config.ts"),
    command("done:tests:b", "pnpm vitest", "✓ 412 passed in 40s"),
  ]),
  subagent("done:ci", "the CI config", "done", [
    read("done:ci:a", ".github/workflows/ci.yml"),
    read("done:ci:b", ".github/workflows/release.yml"),
    read("done:ci:c", "package.json"),
    read("done:ci:d", "pnpm-lock.yaml"),
  ]),
]

/** What came of subagents, at their lines' ends. */
const outcomes: AgentTurnPart[] = [
  subagent("end:build", "the build scripts", "done", [
    read("end:build:a", "scripts/build.ts"),
    read("end:build:b", "scripts/cache.ts"),
    read("end:build:c", "scripts/optimize-images.ts"),
    command("end:build:d", "pnpm build --profile", "images 7m 40s"),
    search("end:build:e", "sharp("),
  ]),
  subagent("end:docs", "the docs folder", "done", []),
  subagent(
    "end:deploy",
    "the deploy script",
    "error",
    [
      read("end:deploy:a", "scripts/deploy.ts"),
      command("end:deploy:b", "pnpm deploy --dry-run", "✗ no token", "error"),
    ],
    { outcome: "Failed" }
  ),
  subagent(
    "end:notes",
    "the release notes",
    "done",
    [read("end:notes:a", "CHANGELOG.md")],
    { outcome: "Stopped", turn: "stopped" }
  ),
  subagent(
    "end:staging",
    "the staging cluster",
    "waiting",
    [
      {
        type: "tool",
        id: "end:staging:a",
        kind: "command",
        command: "kubectl get pods -n staging",
        status: "waiting",
      },
    ],
    { progress: "Wants to run kubectl get pods -n staging" }
  ),
]

const ciAsked = "Why is CI so slow? Look at everything."

/**
 * Subagents, running in parallel: a subagent is a step, a spinner for its
 * icon while it runs, what it is at now under its words, shimmering, and
 * what it has done at the line's end. All under way, each its own row.
 */
export const SubagentsRunning: Story = {
  args: {
    id: "turn:sub:running",
    status: "running",
    duration: "47s",
    kinds,
    parts: parallel("run"),
  },
  render: (args) => <Exchange {...args} asked={ciAsked} />,
  play: async () => {
    const build = step(/^Exploring the build scripts/)
    await expect(build).toHaveAttribute("data-status", "running")
    await expect(build).toHaveTextContent("3 steps")
    const progress = build.querySelector<HTMLElement>(
      "[data-slot=agent-turn-step-progress]"
    )!
    await expect(progress).toHaveTextContent(
      "Reading scripts/optimize-images.ts"
    )
    await expect(progress.firstElementChild).toHaveClass("shimmer")
    const title = build.querySelector("[data-slot=agent-turn-step-title]")!
    await expect(left(progress.firstElementChild!)).toBe(left(title))
    await expect(triggerOf(build)).toHaveAccessibleDescription(
      "Reading scripts/optimize-images.ts"
    )
    await expect(step(/^Exploring the CI config/)).toHaveTextContent("Starting")
    await expect(
      document.querySelector("[data-slot=agent-turn-run-trigger]")
    ).toBeNull()
  },
}

/**
 * One opened while running: its parts under its words, folded by the
 * same rules, the lines as high as the turn's; what it said a size
 * smaller and lighter; the step it is at spins.
 */
export const SubagentsOpened: Story = {
  args: {
    id: "turn:sub:opened",
    status: "running",
    duration: "52s",
    kinds,
    parts: [
      ...parallel("open").slice(0, 2),
      subagent(
        "open:tests",
        "the test setup",
        "running",
        [
          command(
            "open:tests:a",
            "pnpm vitest --reporter=json",
            "✓ 412 passed",
            "done",
            "40s"
          ),
          read("open:tests:b", "vitest.config.ts", "running"),
        ],
        { progress: "Ran pnpm vitest --reporter=json" }
      ),
      subagent("open:ci", "the CI config", "done", [
        read("open:ci:a", ".github/workflows/ci.yml"),
        read("open:ci:b", ".github/workflows/release.yml"),
        read("open:ci:c", "package.json"),
        read("open:ci:d", "pnpm-lock.yaml"),
      ]),
    ],
  },
  render: (args) => (
    <Exchange {...args} asked={false} folds={{ "open:build": true }} />
  ),
  play: async ({ canvas }) => {
    const sub = step(/^Exploring the build scripts/)
    const nested = sub.querySelector<HTMLElement>("[data-slot=agent-turn]")!
    await waitFor(() => expect(nested).toBeVisible())
    await expect(
      nested.querySelector("[data-slot=agent-turn-work-header]")
    ).toBeNull()
    await expect(
      sub.querySelector("[data-slot=agent-turn-step-progress]")
    ).toBeNull()
    // Its lines start at its words, as high as the turn's; its live step
    // spins.
    const live = step("Reading optimize-images.ts", nested)
    await expect(live).toHaveAttribute("data-status", "running")
    await expect(
      left(live.querySelector("[data-slot=agent-turn-step-icon]")!)
    ).toBe(left(sub.querySelector("[data-slot=agent-turn-step-title]")!))
    await expect(live.firstElementChild!.getBoundingClientRect().height).toBe(
      28
    )
    // What it said: a size smaller than the turn's, and lighter.
    const said = within(nested).getByText(/^The cache keys/)
    const turnSaid = canvas.getByText(/^I'll look at the build/)
    await expect(parseFloat(getComputedStyle(said).fontSize)).toBeLessThan(
      parseFloat(getComputedStyle(turnSaid).fontSize)
    )
  },
}

/** The turn done: its agents one line, what it said around them. */
const ciDone: AgentTurnPart[] = [
  intro("done:intro"),
  ...explored,
  text("done:same", "Two of them point at the same step."),
  text(
    "done:answer",
    "Most of the 9 minutes is image optimization: it runs on every build, because its cache never misses. The tests take 40 seconds; CI installs without a cache."
  ),
]

/**
 * Done: the subagents fold into one line, as other steps do ("Explored
 * with 3 agents"); what it said after them is the answer.
 */
export const SubagentsDone: Story = {
  args: {
    id: "turn:sub:done",
    status: "done",
    duration: "1m 12s",
    kinds,
    parts: ciDone,
  },
  render: (args) => (
    <Exchange
      {...args}
      asked={ciAsked}
      folds={{ "turn:sub:done:work": true }}
    />
  ),
  play: async ({ canvas }) => {
    const agents = runLine("Explored with 3 agents")
    await expect(agents).toHaveAttribute("aria-expanded", "false")
    await waitFor(() =>
      expect(canvas.getByText(/^Two of them point/)).toBeVisible()
    )
    await waitFor(() =>
      expect(canvas.getByText(/^Most of the 9 minutes/)).toBeVisible()
    )
  },
}

/**
 * Done, opened: the line opens to its agents; one opened, its steps
 * listed under its words, one level, with no line over them (its words
 * are that line), its reads each a row; and what it handed back last,
 * under a label a step lighter than its words.
 */
export const SubagentsDoneOpened: Story = {
  args: {
    id: "turn:sub:done-opened",
    status: "done",
    duration: "1m 12s",
    kinds,
    parts: explored,
  },
  render: (args) => (
    <Exchange
      {...args}
      asked={false}
      folds={{
        "done:build:run": true,
        "done:build": true,
      }}
    />
  ),
  play: async ({ canvas }) => {
    const block = document
      .querySelector("[data-slot=agent-turn-result]")
      ?.closest<HTMLElement>("[data-slot=agent-turn-result]")
    await expect(block).toHaveTextContent(/^Result/)
    await expect(block).toHaveTextContent(/Image optimization takes/)
    await expect(step(/^Explored the build scripts/)).toHaveTextContent(
      "5 steps"
    )
    const agents = runLine("Explored with 3 agents")
    await expect(agents).toHaveAttribute("aria-expanded", "true")
    // Its steps listed as they came, one level under its words: no line
    // over them, nor over its reads.
    const sub = step(/^Explored the build scripts/)
    const nested = sub.querySelector<HTMLElement>("[data-slot=agent-turn]")!
    await expect(
      nested.querySelector(
        "[data-slot=agent-turn-run-trigger], [data-slot=agent-turn-look-trigger]"
      )
    ).toBeNull()
    const words = left(sub.querySelector("[data-slot=agent-turn-step-title]")!)
    for (const title of [
      "Read build.ts",
      "Read cache.ts",
      "Read optimize-images.ts",
      "Ran pnpm build --profile",
      "Searched for sharp(",
    ]) {
      const each = step(title, nested)
      await waitFor(() => expect(each).toBeVisible())
      await expect(
        left(each.querySelector("[data-slot=agent-turn-step-icon]")!)
      ).toBe(words)
    }
    // "Result" a step lighter than what it is over.
    const label = block!.querySelector("[data-slot=agent-turn-result-label]")!
    await expect(label).toHaveClass("text-subtle-foreground")
    await expect(getComputedStyle(label).color).not.toBe(
      getComputedStyle(block!).color
    )
    await userEvent.click(agents)
    await waitFor(() =>
      expect(canvas.queryByText(/^Image optimization/)).toBeNull()
    )
    await userEvent.click(agents)
    await waitFor(async () =>
      expect(await canvas.findByText(/^Image optimization/)).toBeVisible()
    )
    ;(document.activeElement as HTMLElement | null)?.blur()
  },
}

/** A subagent's long report: findings, one a paragraph. */
const longReport = [
  "Image optimization takes 7m 40s of 9m: sharp re-encodes all 1,412 images on every build.",
  "Its cache key is the lockfile's hash, so it misses only when dependencies change, and CI restores no cache between runs.",
  "The build itself (vite) takes 52s, of which 31s is type-checking in the same process; moving it to a worker would overlap it.",
  "Tests: 412 in 40s, single-threaded because vitest.config.ts sets poolOptions.threads.singleThread for one flaky suite.",
  "That suite (src/net/retry.test.ts) depends on real timers; with fake timers it passes threaded in 3 of 3 runs.",
  "CI installs with pnpm install and no store cache: 1m 05s each run, 4s with actions/cache on the pnpm store.",
  "The release workflow builds twice, once for the check and once to publish, as the artifact is not passed between jobs.",
  "Suggested order: cache the images by content hash, cache the pnpm store, pass the build artifact, then thread the tests.",
]

/**
 * A subagent's result past six lines: cut there, fading, over "Show all"
 * and how many lines it has; shown whole on demand.
 */
export const SubagentLongResult: Story = {
  args: {
    id: "turn:sub:long",
    status: "done",
    duration: "2m 03s",
    kinds,
    parts: [
      subagent("long:build", "the build and CI", "done", [
        read("long:build:a", "scripts/optimize-images.ts"),
        command("long:build:b", "pnpm build --profile", "images 7m 40s"),
        {
          type: "content",
          id: "long:build:result",
          content: (
            <AgentTurnResult>
              {longReport.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </AgentTurnResult>
          ),
        },
      ]),
    ],
  },
  render: (args) => (
    <Exchange
      {...args}
      asked={false}
      folds={{ "long:build:run": true, "long:build": true }}
    />
  ),
  play: async () => {
    const result = document.querySelector<HTMLElement>(
      "[data-slot=agent-turn-result]"
    )!
    const more = await within(result).findByRole("button", {
      name: /Show all/,
    })
    // All of it in the page, but six lines in sight.
    await expect(result).toHaveTextContent(/thread the tests\./)
    const cut = result.getBoundingClientRect().height
    await expect(cut).toBeLessThan(220)
    await userEvent.click(more)
    await waitFor(() =>
      expect(result.getBoundingClientRect().height).toBeGreaterThan(cut + 60)
    )
    await waitFor(() =>
      expect(
        within(result).getByRole("button", { name: /Show less/ })
      ).toBeVisible()
    )
    ;(document.activeElement as HTMLElement | null)?.blur()
  },
}

/**
 * What came of subagents, each a line alone (`AgentTurnStep`): how many
 * steps, "No steps" (it does not open), an alert and "Failed", "Stopped",
 * and a shield and "Waiting for you" with what it wants under it.
 */
export const SubagentOutcomes: Story = {
  args: { id: "turn:sub:outcomes", status: "done", parts: outcomes },
  render: (args) => (
    <div className="flex flex-col">
      {args.parts.map((part) => (
        <AgentTurnStep key={part.id} part={part as AgentToolCall} />
      ))}
    </div>
  ),
  play: async () => {
    await expect(step(/^Explored the build scripts/)).toHaveTextContent(
      "5 steps"
    )
    const docs = step(/^Explored the docs folder/)
    await expect(docs).toHaveTextContent("No steps")
    await expect(
      docs.querySelector("[data-slot=agent-turn-step-trigger]")
    ).toBeNull()
    const failed = step(/^Explored the deploy script/)
    await expect(failed).toHaveAttribute("data-status", "error")
    await expect(
      failed.querySelector("[data-slot=agent-turn-failure]")
    ).toHaveTextContent("Failed")
    await expect(step(/^Explored the release notes/)).toHaveTextContent(
      "Stopped"
    )
    const waiting = step(/^Exploring the staging cluster/)
    await expect(waiting).toHaveAttribute("data-status", "waiting")
    await expect(waiting).toHaveTextContent("Waiting for you")
    await expect(waiting.querySelector("[data-slot=spinner]")).toBeNull()
    await expect(triggerOf(waiting)).toHaveAttribute("aria-expanded", "false")
    const wants = waiting.querySelector<HTMLElement>(
      "[data-slot=agent-turn-step-progress]"
    )!
    await expect(wants).toHaveTextContent("Wants to run kubectl get pods")
    await expect(wants.firstElementChild).not.toHaveClass("shimmer")
  },
}

/**
 * On a phone: the same, at a phone's sizes, rows 36px, the steps 15px,
 * what each is at 14px.
 */
export const SubagentsPhone: Story = {
  ...viewport("phone", 390, 844),
  args: {
    id: "turn:sub:phone",
    status: "running",
    duration: "47s",
    kinds,
    parts: [
      intro("phone:intro"),
      ...parallel("phone").slice(1, 2),
      subagent(
        "phone:tests",
        "the test setup",
        "running",
        [command("phone:tests:a", "pnpm vitest", "…", "running")],
        { progress: "Running pnpm vitest" }
      ),
      subagent("phone:ci", "the CI config", "done", [
        read("phone:ci:a", ".github/workflows/ci.yml"),
        read("phone:ci:b", ".github/workflows/release.yml"),
        read("phone:ci:c", "package.json"),
        read("phone:ci:d", "pnpm-lock.yaml"),
      ]),
    ],
  },
  render: (args) => <Exchange {...args} asked={ciAsked} />,
  play: async () => {
    const build = step(/^Exploring the build scripts/)
    const row = triggerOf(build).parentElement!
    await expect(row.getBoundingClientRect().height).toBe(36)
    await expect(getComputedStyle(row).fontSize).toBe("15px")
    const progress = build.querySelector<HTMLElement>(
      "[data-slot=agent-turn-step-progress]"
    )!
    await expect(getComputedStyle(progress).fontSize).toBe("14px")
    await expect(step(/^Explored the CI config/)).toHaveTextContent("4 steps")
  },
}

/** Without its duration, e.g. from a history that kept none. */
export const NoDuration: Story = {
  args: { ...searched, id: "turn:no-duration", duration: undefined },
  play: async () => {
    await expect(work()).toHaveTextContent(/^Worked$/)
  },
}

/** Its words, for other languages: the app's labels. */
export const Labels: Story = {
  args: {
    ...Done.args,
    id: "turn:labels",
    duration: "6 Min. 12 Sek.",
    labels: {
      worked: (duration) => (duration ? `Gearbeitet: ${duration}` : "Fertig"),
      summary: (count) =>
        [
          count.read > 0 && `${count.read} Dateien angesehen`,
          count.edited > 0 && `${count.edited} bearbeitet`,
          count.ran > 0 && `${count.ran} Befehle ausgeführt`,
        ]
          .filter(Boolean)
          .join(", "),
      looked: (count) =>
        `${count.read} Dateien gelesen, ${count.searched}-mal gesucht`,
      verb: (kind, state) =>
        state === "running"
          ? "Läuft"
          : (
              {
                read: "Gelesen",
                search: "Gesucht",
                list: "Aufgelistet",
                edit: "Bearbeitet",
                write: "Geschrieben",
                command: "Ausgeführt",
              } as const
            )[kind],
      failures: (calls) => `${calls} fehlgeschlagen`,
      edits: (edits) => `${edits}-mal bearbeitet`,
    },
  },
  render: (args) => (
    <Exchange
      {...args}
      asked={false}
      folds={{ "turn:labels:work": true, [run]: true }}
    />
  ),
  play: async () => {
    await expect(work()).toHaveTextContent("Gearbeitet: 6 Min. 12 Sek.")
    await expect(
      runLine("6 Dateien angesehen, 4 bearbeitet, 4 Befehle ausgeführt")
    ).toHaveTextContent("1 fehlgeschlagen")
    await waitFor(() =>
      expect(lookLine("6 Dateien gelesen, 3-mal gesucht")).toBeVisible()
    )
    await expect(step("Bearbeitet agent-turn.tsx")).toHaveTextContent(
      "4-mal bearbeitet · +38 −12"
    )
  },
}

/** A picture of a size, with its name on it. */
const picture = (alt: string, hue: number): MediaImage => ({
  alt,
  width: 1600,
  height: 900,
  src: `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="100%" height="100%" fill="hsl(${hue} 55% 72%)"/><text x="50%" y="50%" font-family="sans-serif" font-size="96" text-anchor="middle" dominant-baseline="middle" fill="#1a1a1a">${alt}</text></svg>`
  )}`,
})

const phoneShot = (alt: string, hue: number): MediaImage => ({
  alt,
  title: `${alt}.png`,
  width: 1080,
  height: 2400,
  src: `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="2400"><rect width="100%" height="100%" fill="hsl(${hue} 30% 85%)"/><text x="50%" y="50%" font-family="sans-serif" font-size="96" text-anchor="middle" fill="#1a1a1a">${alt}</text></svg>`
  )}`,
})

/** A screenshot of a size, its name on it. */
const screenshot = (
  alt: string,
  width: number,
  height: number,
  hue: number
): MediaImage => ({
  alt,
  width,
  height,
  src: `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="hsl(${hue} 40% 80%)"/><text x="50%" y="50%" font-family="sans-serif" font-size="48" text-anchor="middle" fill="#1a1a1a">${alt}</text></svg>`
  )}`,
})

/**
 * Screenshots of every shape kept in sight under the folded work, each
 * card as wide as it is alone in the conversation (its picture's width,
 * up to 6 of the column's 12 columns), not half of that beside an empty
 * half; a step's several pictures a row of their own.
 */
export const MediaKeptShapes: Story = {
  args: {
    id: "turn:kept-shapes",
    status: "done",
    duration: "1m 02s",
    parts: [
      ...(
        [
          ["shot:desktop", screenshot("Desktop", 1920, 1080, 200)],
          ["shot:phone", screenshot("Phone", 390, 844, 120)],
          ["shot:phone-2", screenshot("Phone, signed in", 390, 844, 30)],
        ] as const
      ).map(([id, image]): AgentTurnPart => ({
        type: "tool",
        id,
        status: "done",
        title: "Took a screenshot",
        media: <MediaGallery items={[image]} />,
      })),
      {
        type: "tool",
        id: "shot:pair",
        status: "done",
        title: "Took two screenshots",
        media: (
          <MediaGallery
            items={[
              screenshot("Before", 1920, 1080, 260),
              screenshot("After", 1920, 1080, 300),
            ]}
          />
        ),
      },
      { type: "content", id: "answer", content: <p>All four render.</p> },
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(work()).toHaveAttribute("aria-expanded", "false")
    const kept = canvasElement.querySelector<HTMLElement>(
      "[data-slot=agent-turn-kept-media]"
    )!
    await waitFor(() =>
      expect(
        kept.querySelectorAll("[data-slot=media-gallery-item] img")
      ).toHaveLength(5)
    )
    const row = kept.getBoundingClientRect().width
    const style = getComputedStyle(kept)
    const inner =
      row -
      parseFloat(style.paddingInlineStart) -
      parseFloat(style.paddingInlineEnd)
    // 6 of the row's 12 columns, as the theme reckons them.
    const probe = document.createElement("div")
    probe.className = "w-span-6 shrink-0"
    kept.append(probe)
    const six = probe.getBoundingClientRect().width
    probe.remove()
    const items = [
      ...kept.querySelectorAll<HTMLElement>(
        "[data-slot=agent-turn-step-media]"
      ),
    ]
    for (const item of items.slice(0, 3)) {
      const card = item.querySelector<HTMLElement>(
        "[data-slot=media-gallery-item]"
      )!
      // The card fills its place: no empty half beside it.
      await expect(card.getBoundingClientRect().width).toBeCloseTo(
        item.getBoundingClientRect().width,
        0
      )
    }
    // The wide one up to 6 of the column's 12 columns, the tall ones at
    // their pictures' width.
    await expect(items[0]!.getBoundingClientRect().width).toBeCloseTo(six, 0)
    await expect(items[1]!.getBoundingClientRect().width).toBeLessThan(six)
    // Several pictures: a row of their own.
    await expect(items[3]!.getBoundingClientRect().width).toBeCloseTo(inner, 0)
  },
}

/**
 * Screenshots two steps took, a phone's, kept in sight under the folded
 * work: side by side, not one under the other, each at its own shape
 * (taller than wide), not a square around it.
 */
export const MediaSideBySide: Story = {
  args: {
    id: "turn:shots",
    status: "done",
    duration: "40s",
    parts: [
      {
        type: "tool",
        id: "shot:empty",
        status: "done",
        title: "Took a screenshot",
        media: <MediaGallery items={[phoneShot("Empty list", 210)]} />,
      },
      {
        type: "tool",
        id: "shot:orders",
        status: "done",
        title: "Took a screenshot",
        media: <MediaGallery items={[phoneShot("Orders", 120)]} />,
      },
      {
        type: "content",
        id: "answer",
        content: <p>Both pages render.</p>,
      },
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(work()).toHaveAttribute("aria-expanded", "false")
    const pictures = () =>
      [
        ...canvasElement.querySelectorAll<HTMLElement>(
          "[data-slot=agent-turn-kept] [data-slot=media-gallery-picture]"
        ),
      ].map((picture) => picture.getBoundingClientRect())
    await waitFor(() => expect(pictures()).toHaveLength(2))
    const [first, second] = pictures() as [DOMRect, DOMRect]
    // Side by side.
    await expect(Math.abs(first.top - second.top)).toBeLessThanOrEqual(1)
    await expect(second.left).toBeGreaterThan(first.right)
    // Each its own shape: 1080 by 2400.
    for (const box of [first, second])
      await expect(Math.abs(box.width / box.height - 1080 / 2400)).toBeLessThan(
        0.02
      )
  },
}

/**
 * Media is content too: what the agent made for the reader (here, a
 * chart and a recording) is in its answer, outside the fold; a screenshot
 * a tool took is in its `media`, under its line and kept in sight when folded.
 */
export const Media: Story = {
  args: {
    id: "turn:media",
    status: "done",
    duration: "21s",
    parts: [
      {
        type: "tool",
        id: "open-page",
        status: "done",
        title: (
          <>
            Opened <AgentTurnTarget code>/pricing</AgentTurnTarget> in the
            browser
          </>
        ),
        duration: "1.4s",
      },
      {
        type: "tool",
        id: "screenshot",
        status: "done",
        title: "Took a screenshot",
        duration: "0.3s",
        media: (
          <MediaGallery
            items={[
              picture("Pricing page", 150),
              picture("Pricing page, mobile", 180),
            ]}
          />
        ),
      },
      command(
        "chart",
        "node scripts/chart.ts",
        "Wrote chart.png",
        "done",
        "2s"
      ),
      {
        type: "content",
        id: "answer",
        content: (
          <div className="flex flex-col gap-3">
            <p className="leading-relaxed">Build times over the last week:</p>
            <MediaGallery items={[picture("Build times", 210)]} />
            <p className="leading-relaxed">And a recording of a deploy:</p>
            <MediaGallery
              items={[
                {
                  kind: "video",
                  src: tone(3),
                  poster: picture("Deploy, 12:04", 30).src,
                  width: 1600,
                  height: 900,
                  title: "deploy.webm",
                  description: "Screen recording",
                },
              ]}
            />
          </div>
        ),
      },
    ],
  },
  play: async ({ canvas }) => {
    await expect(work()).toHaveAttribute("aria-expanded", "false")
    await waitFor(() =>
      expect(canvas.getByRole("button", { name: "Build times" })).toBeVisible()
    )
    const strip = () => canvas.getByRole("button", { name: /^Pricing page$/ })
    const once = async () => {
      await waitFor(() =>
        expect(
          canvas.getAllByRole("button", { name: /^Pricing page$/ })
        ).toHaveLength(1)
      )
      await waitFor(() => expect(strip()).toBeVisible())
    }
    await once()
    await expect(strip().closest("[data-slot=agent-turn-kept]")).not.toBeNull()
    await waitFor(() =>
      expect(
        canvas.getByLabelText("deploy.webm", { selector: "video" })
      ).toBeVisible()
    )
    await userEvent.click(work())
    await waitFor(() =>
      expect(runLine("Ran a command, used 2 tools")).toBeVisible()
    )
    await once()
    const line = runLine("Ran a command, used 2 tools")
    await expect(line).toHaveAttribute("aria-expanded", "false")
    const run = line.closest("[data-slot=agent-turn-run]")!
    await expect(
      run.querySelector("[data-slot=agent-turn-kept]")
    ).toContainElement(strip())
    await userEvent.click(line)
    await waitFor(() => expect(step("Took a screenshot")).toBeVisible())
    await once()
    await waitFor(() =>
      expect(run.querySelector("[data-slot=agent-turn-kept]")).toBeNull()
    )
    await expect(step("Took a screenshot")).toContainElement(strip())
    await expect(triggerOf(step("Took a screenshot"))).toBeNull()
    // A step that does not open starts its words where the others do.
    const start = (title: string) =>
      step(title)
        .querySelector("[data-slot=agent-turn-step-title]")!
        .getBoundingClientRect().left
    await expect(start("Opened /pricing in the browser")).toBe(
      start("Took a screenshot")
    )
  },
}

const keptDecision: AgentTurnPart = {
  type: "decision",
  id: "branch",
  icon: <HugeiconsIcon icon={SecurityCheckIcon} />,
  title: "Answered: Which branch? · main",
  meta: "By you",
  details: <p>Which branch?</p>,
}

const keptParts: AgentTurnPart[] = [
  read("kept:read", "package.json"),
  command("kept:first", "pnpm lint", "Passed"),
  keptDecision,
  {
    type: "tool",
    id: "kept:shot",
    status: "done",
    title: "Took a screenshot",
    media: (
      <MediaGallery
        items={[
          picture("Pricing page", 150),
          picture("Pricing page, mobile", 180),
        ]}
      />
    ),
  },
  command("kept:last", "pnpm test", "Passed"),
]

/** Decisions and visual results stay in sight through both folds. */
export const KeptWhenFolded: Story = {
  args: {
    id: "turn:kept",
    status: "done",
    duration: "48s",
    parts: [...keptParts, text("kept:answer", "The page is ready.")],
  },
  play: async ({ canvas }) => {
    const check = async (root: ParentNode, folded: boolean) => {
      // Kept outside once the fold has finished closing: not in a panel
      // within `root`.
      await waitFor(() =>
        expect(
          [...root.querySelectorAll("[data-slot=agent-turn-kept]")].some(
            (block) => {
              const panel = block.closest("[data-slot=collapsible-content]")
              return !panel || !root.contains(panel)
            }
          )
        ).toBe(folded)
      )
      await waitFor(() => {
        expect(
          canvas.getAllByText("Answered: Which branch? · main")
        ).toHaveLength(1)
        expect(
          canvas.getAllByRole("button", { name: /^Pricing page$/ })
        ).toHaveLength(1)
      })
      const decision = step("Answered: Which branch? · main", root)
      const image = canvas.getByRole("button", {
        name: /^Pricing page$/,
      })
      await waitFor(() => expect(decision).toBeVisible())
      await waitFor(() => expect(image).toBeVisible())
      await expect(
        decision.compareDocumentPosition(image) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy()
      if (folded) {
        const block = root.querySelector("[data-slot=agent-turn-kept]")!
        await expect(block).toContainElement(decision)
        await expect(block).toContainElement(image)
      } else {
        await expect(
          root.querySelector("[data-slot=agent-turn-kept]")
        ).toBeNull()
        const shot = step("Took a screenshot", root)
        await expect(shot).toContainElement(image)
        await expect(
          step(/Ran pnpm lint/, root).compareDocumentPosition(decision) &
            Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy()
        await expect(
          decision.compareDocumentPosition(shot) &
            Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy()
        await expect(
          shot.querySelector("[data-slot=agent-turn-step-media]")
            ?.previousElementSibling
        ).toHaveAttribute("data-status", "done")
      }
    }
    await expect(work()).toHaveAttribute("aria-expanded", "false")
    await check(document, true)
    await expect(
      document
        .querySelector("[data-slot=agent-turn-kept]")!
        .compareDocumentPosition(canvas.getByText("The page is ready.")) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    await userEvent.click(work())
    await waitFor(() =>
      expect(
        runLine("Explored 1 file, ran 2 commands, used a tool")
      ).toBeVisible()
    )
    const line = runLine("Explored 1 file, ran 2 commands, used a tool")
    const run = line.closest("[data-slot=agent-turn-run]")!
    await expect(line).toHaveAttribute("aria-expanded", "false")
    await check(run, true)
    await expect(line.parentElement?.nextElementSibling).toHaveAttribute(
      "data-slot",
      "agent-turn-kept"
    )
    await userEvent.click(line)
    await waitFor(() => expect(step("Took a screenshot", run)).toBeVisible())
    await check(run, false)
    await userEvent.click(line)
    await waitFor(() => expect(line).toHaveAttribute("aria-expanded", "false"))
    await check(run, true)
    // Closing the work: its runs stay in its panel while it closes, and
    // nothing is kept outside it (seen or read) until it has gone; then
    // the kept items are where the panel was.
    const turn = document.querySelector("[data-slot=agent-turn-work]")!
    const panel = turn.querySelector<HTMLElement>(
      ":scope > [data-slot=collapsible-content]"
    )!
    const outside = () =>
      turn.querySelector(
        ":scope > :not([data-slot=collapsible-content]) [data-slot=agent-turn-kept]"
      )
    await userEvent.click(work())
    await expect(work()).toHaveAttribute("aria-expanded", "false")
    // Its title closed (no rule under it): where the panel starts.
    const top = panel.getBoundingClientRect().top
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      await waitFor(() => expect(panel).toHaveAttribute("data-ending-style"))
      await expect(panel.isConnected).toBe(true)
      await expect(panel).toContainElement(run as HTMLElement)
      await expect(outside()).toBeNull()
    }
    await waitFor(() => expect(outside()).not.toBeNull())
    await expect(panel.isConnected).toBe(false)
    await expect(
      outside()!.parentElement!.getBoundingClientRect().top
    ).toBeCloseTo(top, 0)
    await check(document, true)
  },
}

/** Earlier decisions stay under their closed run while the live step runs. */
export const KeptWhileRunning: Story = {
  args: {
    id: "turn:kept-running",
    status: "running",
    parts: [
      read("earlier:read", "package.json"),
      command("earlier:command", "pnpm lint", "Passed"),
      keptDecision,
      text("between", "Checking the build next."),
      read("live:read", "vite.config.ts"),
      command("live:command", "pnpm build", "", "running"),
    ],
  },
  play: async () => {
    await expect(work()).toHaveAttribute("aria-expanded", "true")
    const line = runLine("Explored 1 file, ran a command")
    await expect(line).toHaveAttribute("aria-expanded", "false")
    const run = line.closest("[data-slot=agent-turn-run]")!
    await expect(
      run.querySelector("[data-slot=agent-turn-kept]")
    ).toContainElement(step("Answered: Which branch? · main"))
    await expect(
      document.querySelectorAll('[data-part-id="branch"]')
    ).toHaveLength(1)
    // The live run's one line says the step it is at.
    await waitFor(() => expect(runLine("Running pnpm build")).toBeVisible())
  },
}

/**
 * Ended while a subagent still goes: its step stays in sight under the
 * folded work, once; opened, it is in place.
 */
export const KeptUnderWay: Story = {
  args: {
    id: "turn:kept-under-way",
    status: "done",
    duration: "30s",
    parts: [
      command("under-way:lint", "pnpm lint", "Passed"),
      subagent("under-way:ci", "the CI config", "running", [], {
        progress: "Reading .github/workflows/ci.yml",
      }),
      text("under-way:answer", "Lint passes; the CI check is still going."),
    ],
  },
  play: async () => {
    await expect(work()).toHaveAttribute("aria-expanded", "false")
    const kept = document.querySelector("[data-slot=agent-turn-kept]")!
    await expect(kept).toContainElement(step("Exploring the CI config"))
    await expect(
      document.querySelectorAll('[data-part-id="under-way:ci"]')
    ).toHaveLength(1)
    await userEvent.click(work())
    await waitFor(() =>
      expect(document.querySelector("[data-slot=agent-turn-kept]")).toBeNull()
    )
    await waitFor(() => expect(step("Exploring the CI config")).toBeVisible())
    await expect(
      document.querySelectorAll('[data-part-id="under-way:ci"]')
    ).toHaveLength(1)
  },
}

const retryTurn = fn()
const retryWith = fn()

/**
 * The footer the mockups show: copy, retry with its menu, branch, more;
 * then the model, how long and when (the full date on hover), its numbers
 * when pressed.
 */
function TurnFooter({
  answer,
  time = "12:04",
  facts = ["Opus 5.5", "48s"],
  visibility,
}: {
  answer: string
  time?: string
  facts?: string[]
  visibility?: "always" | "hover"
}) {
  return (
    <AgentTurnFooter {...(visibility && { visibility })}>
      <CopyButton
        value={answer}
        labels={{ copy: "Copy", copied: "Copied as Markdown" }}
      />
      <AgentTurnRetry onClick={retryTurn}>
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => retryWith("same")}>
            <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} />
            Retry
            <DropdownMenuShortcut>⌘R</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => retryWith("thinking")}>
            <HugeiconsIcon icon={AiBrain01Icon} strokeWidth={2} />
            Retry with more thinking
            <DropdownMenuShortcut>Max</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Retry with</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => retryWith("sonnet")}>
            Sonnet 5.5
            <DropdownMenuShortcut>Faster</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => retryWith("fable")}>
            Fable 5.1
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Other model…</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => retryWith("haiku")}>
                Haiku 5
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => retryWith("opus-4")}>
                Opus 4.8
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>
      </AgentTurnRetry>
      <AgentTurnAction label="Branch from here" optional>
        <HugeiconsIcon icon={GitBranchIcon} strokeWidth={2} />
      </AgentTurnAction>
      <AgentTurnMore>
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <HugeiconsIcon icon={TextIcon} strokeWidth={2} />
            Copy as plain text
          </DropdownMenuItem>
          <DropdownMenuItem>
            <HugeiconsIcon icon={Link01Icon} strokeWidth={2} />
            Copy link to this turn
          </DropdownMenuItem>
          <DropdownMenuItem>
            <HugeiconsIcon icon={VolumeHighIcon} strokeWidth={2} />
            Read aloud
          </DropdownMenuItem>
          <DropdownMenuItem>
            <HugeiconsIcon icon={GitBranchIcon} strokeWidth={2} />
            Branch into a new chat
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <HugeiconsIcon icon={ThumbsUpIcon} strokeWidth={2} />
            Good answer
          </DropdownMenuItem>
          <DropdownMenuItem>
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
            Hide this turn
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </AgentTurnMore>
      <AgentTurnInfo
        details={
          <>
            <AgentTurnDetails label="This turn">
              <AgentTurnDetail label="Model" note="High">
                Opus 5.5
              </AgentTurnDetail>
              <AgentTurnDetail label="Took" note="9 steps">
                48s
              </AgentTurnDetail>
              <AgentTurnDetail label="Finished">12:04:03</AgentTurnDetail>
            </AgentTurnDetails>
            <AgentTurnDetails label="Tokens">
              <AgentTurnDetail label="Input" note="12.0k cached">
                18.2k
              </AgentTurnDetail>
              <AgentTurnDetail label="Output" note="840 thinking">
                1.2k
              </AgentTurnDetail>
              <AgentTurnDetail label="Context" note="of 200k">
                41%
              </AgentTurnDetail>
            </AgentTurnDetails>
            <AgentTurnDetails>
              <AgentTurnDetail label="Cost">$0.04</AgentTurnDetail>
              <AgentTurnDetail label="This conversation">$0.31</AgentTurnDetail>
            </AgentTurnDetails>
          </>
        }
      >
        {facts.map((fact) => (
          <span key={fact}>{fact}</span>
        ))}
        <AgentTurnFact tooltip={`Saturday, Nov 8 · ${time}:03`}>
          <time dateTime={`2026-11-08T${time}`}>{time}</time>
        </AgentTurnFact>
      </AgentTurnInfo>
    </AgentTurnFooter>
  )
}

const reply =
  "The build now splits vendor code once and skips what nothing imports. Tests failed on one snapshot, which I left for you to review."

/** A done turn in a `Message`, with its footer. */
function Replied({
  footer,
}: {
  footer?: Partial<React.ComponentProps<typeof TurnFooter>>
}) {
  return (
    <Message>
      <MessageContent>
        <AgentTurn
          id="turn:footer"
          status="done"
          duration="48s"
          parts={[text("answer:f", reply)]}
        />
        <AgentTurnSources
          sources={[
            { href: "https://vitejs.dev/config/build-options" },
            { href: "https://rollupjs.org/configuration-options/" },
          ]}
        />
        <TurnFooter answer={reply} {...footer} />
      </MessageContent>
    </Message>
  )
}

const body = within(document.body)

/**
 * Under an ended turn, an `AgentTurnFooter`: actions on the left, their
 * icons in line with the text, the turn's facts on the right, ending
 * where the text does.
 */
export const Footer: Story = {
  args: { id: "", status: "done", parts: [] },
  beforeEach: () => {
    retryTurn.mockClear()
    retryWith.mockClear()
    const writeText = spyOn(navigator.clipboard, "writeText")
    writeText.mockResolvedValue(undefined)
    return () => writeText.mockRestore()
  },
  render: () => <Replied />,
  play: async ({ canvas, canvasElement }) => {
    const content = canvasElement.querySelector("[data-slot=message-content]")!
    const icon = canvas
      .getByRole("button", { name: "Copy" })
      .querySelector("svg")!
    await expect(
      Math.abs(
        icon.getBoundingClientRect().left - content.getBoundingClientRect().left
      )
    ).toBeLessThan(1)
    const facts = canvas.getByRole("button", { name: /Opus 5\.5/ })
    await expect(facts).toHaveTextContent("Opus 5.5 · 48s · 12:04")
    const words = document.createRange()
    words.selectNodeContents(facts)
    await expect(
      Math.abs(
        words.getBoundingClientRect().right -
          content.getBoundingClientRect().right
      )
    ).toBeLessThan(1)
    // Under a finger, 40px buttons, the icons as they were, in line still.
    const footer = canvasElement.querySelector<HTMLElement>(
      "[data-slot=agent-turn-footer-content]"
    )!
    const coarse = asCoarse(footer, () =>
      ["Copy", "Retry", "Branch from here"].map((name) => {
        const box = canvas.getByRole("button", { name }).getBoundingClientRect()
        return [Math.round(box.width), Math.round(box.height)]
      })
    )
    await expect(coarse).toEqual([
      [40, 40],
      [40, 40],
      [40, 40],
    ])
    await expect(
      asCoarse(footer, () =>
        Math.abs(
          icon.getBoundingClientRect().left -
            content.getBoundingClientRect().left
        )
      )
    ).toBeLessThan(1)

    const retry = canvas.getByRole("button", { name: "Retry" })
    await userEvent.click(retry)
    await expect(retryTurn).toHaveBeenCalledOnce()
    await waitFor(() =>
      expect(
        canvas.getByRole("button", { name: "Branch from here" })
      ).toBeVisible()
    )
  },
}

/**
 * Its facts: hovered, one says more, alone (the time its full date, a
 * tint on it alone); pressed, their numbers in a card.
 */
export const FooterDetails: Story = {
  ...Footer,
  play: async ({ canvas }) => {
    const facts = canvas.getByRole("button", { name: /Opus 5\.5/ })
    const time = facts.querySelector<HTMLElement>(
      "[data-slot=agent-turn-fact]"
    )!
    await userEvent.hover(time)
    const tip = await body.findByText("Saturday, Nov 8 · 12:04:03")
    await waitFor(() => expect(tip).toBeVisible())
    // The tooltip over the time, not the card over them all.
    await expect(body.queryByRole("dialog")).toBeNull()
    // Tinted alone on hover (synthetic events cannot hover: its class).
    await expect(time).toHaveClass("hover:bg-muted")
    await expect(getComputedStyle(facts).backgroundColor).toBe(
      "rgba(0, 0, 0, 0)"
    )
    await userEvent.unhover(time)
    await waitFor(() =>
      expect(body.queryByText("Saturday, Nov 8 · 12:04:03")).toBeNull()
    )
    // Pressed, the card.
    await userEvent.click(facts)
    const card = within(await body.findByRole("dialog", { name: "This turn" }))
    await waitFor(() => expect(card.getByText("$0.04")).toBeVisible())
    await expect(card.getByText("Input").nextSibling).toHaveTextContent(
      "18.2k12.0k cached"
    )
    await waitFor(() =>
      expect(card.getByRole("group", { name: "Tokens" })).toBeVisible()
    )
    // Padding 4; a key 12 in from the edge; a section label 11/500; the rule
    // between sections edge to edge.
    const cardBox = card.getByText("$0.04").closest("[role=dialog]")!
    await expect(getComputedStyle(cardBox).paddingLeft).toBe("4px")
    const label = card.getByText("Tokens")
    await expect(getComputedStyle(label).fontSize).toBe("11px")
    await expect(getComputedStyle(label).fontWeight).toBe("500")
    const section = label.closest<HTMLElement>(
      "[data-slot=agent-turn-details]"
    )!
    // The card scales in: measure once it has settled.
    await waitFor(() => {
      const edge = cardBox.getBoundingClientRect()
      const key = card.getByText("Input").getBoundingClientRect()
      const rule = section.getBoundingClientRect()
      expect(Math.round(key.left - edge.left)).toBe(12)
      expect(Math.round(rule.left - edge.left)).toBe(0)
      expect(Math.round(rule.width)).toBe(Math.round(edge.width))
    })
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(body.queryByRole("dialog")).toBeNull())
    // A key presses it, as a finger does.
    facts.focus()
    await userEvent.keyboard("{Enter}")
    await waitFor(() => expect(body.getByRole("dialog")).toBeVisible())
  },
}

/**
 * Copied: a check for a while, and its name and tooltip say how; pressed
 * with a pointer, the tooltip stays to say so.
 */
export const FooterCopied: Story = {
  ...Footer,
  play: async ({ canvas }) => {
    const tooltip = () =>
      document.querySelector<HTMLElement>("[data-slot=tooltip-content]")
    const copy = canvas.getByRole("button", { name: "Copy" })
    await userEvent.hover(copy)
    await waitFor(() => expect(tooltip()).toHaveTextContent(/^Copy$/))
    // The press does not close it, not for a moment: it says so.
    const open = tooltip()!
    let closed = false
    const watch = new MutationObserver(() => {
      if (open.hasAttribute("data-closed")) closed = true
    })
    watch.observe(open, { attributes: true })
    await userEvent.click(copy)
    const copied = await canvas.findByRole("button", {
      name: "Copied as Markdown",
    })
    await expect(copied).toHaveAttribute("data-copied")
    await waitFor(() =>
      expect(tooltip()).toHaveTextContent("Copied as Markdown")
    )
    watch.disconnect()
    await expect(closed).toBe(false)
    await expect(tooltip()).toBe(open)
    await waitFor(() => expect(open).toBeVisible())
  },
}

/**
 * Retry's menu: other ways to retry, beside the button that retries,
 * opened from the whole group (at Retry's edge), its hints plain small
 * text.
 */
export const FooterRetry: Story = {
  ...Footer,
  play: async ({ canvas, canvasElement }) => {
    const chevron = canvas.getByRole("button", { name: "More ways to retry" })
    // A target's least width beside another (WCAG 2.5.8).
    await expect(chevron.getBoundingClientRect().width).toBe(24)
    await userEvent.click(chevron)
    const popup = await body.findByRole("menu")
    const menu = within(popup)
    const group = canvasElement.querySelector<HTMLElement>(
      "[data-slot=agent-turn-retry]"
    )!
    await waitFor(() =>
      expect(
        Math.round(popup.getBoundingClientRect().left) -
          Math.round(group.getBoundingClientRect().left)
      ).toBe(0)
    )
    await expect(popup.offsetWidth).toBe(288)
    const hint = menu.getByText("Faster")
    await expect(getComputedStyle(hint).letterSpacing).toBe("normal")
    await expect(getComputedStyle(hint).fontSize).toBe("12px")
    await userEvent.click(menu.getByRole("menuitem", { name: /^Sonnet 5\.5/ }))
    await expect(retryWith).toHaveBeenCalledWith("sonnet")
    await expect(retryTurn).not.toHaveBeenCalled()
  },
}

/** "More": what is needed less often. */
export const FooterMore: Story = {
  ...Footer,
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "More" }))
    const popup = await body.findByRole("menu")
    await expect(popup.offsetWidth).toBe(256)
    const menu = within(popup)
    const item = await menu.findByRole("menuitem", { name: "Hide this turn" })
    await waitFor(() => expect(item).toBeVisible())
    // Padding 4, items 13px and their content 12 in; drawn 10px left of More.
    await expect(getComputedStyle(popup).paddingLeft).toBe("4px")
    await expect(getComputedStyle(item).fontSize).toBe("13px")
    await expect(
      Math.round(item.getBoundingClientRect().left) -
        Math.round(popup.getBoundingClientRect().left)
    ).toBe(4)
    await expect(getComputedStyle(item).paddingLeft).toBe("8px")
    const more = canvas.getByRole("button", { name: "More" })
    await waitFor(() =>
      expect(
        Math.round(more.getBoundingClientRect().left) -
          Math.round(popup.getBoundingClientRect().left)
      ).toBe(10)
    )
  },
}

/**
 * Turns before the last: the footer shows while its message is hovered or
 * holds the focus, and keeps its place meanwhile, so nothing moves.
 */
export const FooterOnHover: Story = {
  ...Footer,
  render: () => (
    <div className="flex flex-col gap-6">
      <Replied footer={{ visibility: "hover" }} />
      <Message align="end">
        <MessageContent>
          <Bubble variant="muted">
            <BubbleContent>Now open a PR.</BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
    </div>
  ),
  play: async ({ canvas, canvasElement }) => {
    const footer = canvasElement.querySelector<HTMLElement>(
      "[data-slot=agent-turn-footer]"
    )!
    const actions = footer.querySelector<HTMLElement>(
      "[data-slot=agent-turn-footer-actions]"
    )!
    const opacity = () => getComputedStyle(actions).opacity
    await expect(opacity()).toBe("0")
    // Its facts stay.
    await waitFor(() =>
      expect(canvas.getByRole("button", { name: /Opus 5\.5/ })).toBeVisible()
    )
    await expect(
      getComputedStyle(
        footer.querySelector<HTMLElement>("[data-slot=agent-turn-info]")!
      ).opacity
    ).toBe("1")
    await expect(footer.offsetHeight).toBe(32)
    // The keyboard finds it, as hovering does (synthetic events cannot
    // hover).
    canvas.getByRole("button", { name: "Copy" }).focus()
    await waitFor(() => expect(opacity()).toBe("1"))
    // It kept its place: the message below has not moved.
    await expect(footer.offsetHeight).toBe(32)
  },
}

/**
 * Stopped: what it had said is kept, dimmed, and under it the whole
 * footer, its facts how it ended ("Stopped by you · 12:06"), so retry is
 * a press away; while it ran, no footer.
 */
export const FooterStopped: Story = {
  args: { id: "", status: "done", parts: [] },
  render: function Render() {
    const [status, setStatus] = React.useState<"running" | "stopped">("running")
    return (
      <div className="flex flex-col items-start gap-4">
        {/* The app's stop, gone once it stopped. */}
        {status === "running" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setStatus("stopped")}
          >
            Stop
          </Button>
        )}
        <Message>
          <MessageContent>
            <AgentTurn
              id="turn:stopped"
              status={status}
              duration="1m 12s"
              parts={[
                text(
                  "answer:s",
                  "Checks passed and the tag is in place. Next I'll publish the registry and post the"
                ),
              ]}
            />
            <TurnFooter
              answer="Checks passed and the tag is in place."
              facts={["Stopped by you"]}
              time="12:06"
            />
          </MessageContent>
        </Message>
      </div>
    )
  },
  play: async ({ canvas, canvasElement }) => {
    const footer = () =>
      canvasElement.querySelector<HTMLElement>("[data-slot=agent-turn-footer]")!
    await expect(footer()).not.toBeVisible()
    await userEvent.click(canvas.getByRole("button", { name: "Stop" }))
    await waitFor(() => expect(footer()).toBeVisible())
    // Its facts how it ended, joined as any turn's are.
    const facts = within(footer()).getByRole("button", {
      name: /Stopped by you/,
    })
    await expect(facts).toHaveTextContent("Stopped by you · 12:06")
    const dot = facts.querySelector<HTMLElement>(
      "[data-slot=agent-turn-info-separator]"
    )!
    await expect(getComputedStyle(dot).opacity).toBe("0.6")
    // Retry, and the rest, a press away.
    for (const name of ["Copy", "Retry", "Branch from here", "More"])
      await waitFor(() =>
        expect(within(footer()).getByRole("button", { name })).toBeVisible()
      )
    // Its icons at the text's edge, under it.
    const kept = canvasElement.querySelector<HTMLElement>(
      "[data-slot=agent-turn-answer]"
    )!
    await expect(
      Math.abs(
        left(
          within(footer())
            .getByRole("button", { name: "Copy" })
            .querySelector("svg")!
        ) - left(kept)
      )
    ).toBeLessThan(1)
    // What it had said is kept, dimmed; with no steps, no title.
    await expect(kept).toHaveClass("text-muted-foreground")
    await expect(work()).toBeNull()
  },
}

/**
 * What it was saying as it ended stays mounted: drawn in the answer's
 * place already while it ran, under its steps (or alone), it is not
 * mounted again as the turn stops or finishes. A long answer's Markdown
 * would be parsed and laid out again, all of it, as the reader stopped
 * it. Its place while running is where it stood in the open work.
 */
export const EndsInPlace: Story = {
  args: { id: "", status: "done", parts: [] },
  render: function Render() {
    const [status, setStatus] = React.useState<"running" | "stopped">("running")
    const words = "Checks passed and the tag is in place. Next I'll publish"
    return (
      <div className="flex flex-col items-start gap-4">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setStatus("stopped")}
        >
          Stop
        </Button>
        <AgentTurn
          id="turn:steps"
          status={status}
          duration="1m 12s"
          parts={[...build.slice(0, 2), text("answer:steps", words)]}
        />
        <AgentTurn
          id="turn:alone"
          status={status}
          duration="12s"
          parts={[text("answer:alone", words)]}
        />
      </div>
    )
  },
  play: async ({ canvas, canvasElement }) => {
    const said = () =>
      [...canvasElement.querySelectorAll("p")].filter((p) =>
        p.textContent!.startsWith("Checks passed")
      )
    const before = said()
    await expect(before).toHaveLength(2)
    // Where it stands as it runs: as close under its step as a step's
    // words are, and under the bare title as in the panel.
    const [steps, alone] = canvasElement.querySelectorAll<HTMLElement>(
      "[data-slot=agent-turn]"
    )
    const answerOf = (turn: HTMLElement) =>
      turn.querySelector<HTMLElement>("[data-slot=agent-turn-answer]")!
    await expect(answerOf(steps!)).toHaveClass("mt-3")
    await expect(answerOf(alone!)).not.toHaveClass("mt-3")
    const header = alone!.querySelector("[data-slot=agent-turn-work-header]")!
    await expect(
      answerOf(alone!).getBoundingClientRect().top -
        header.getBoundingClientRect().bottom
    ).toBeCloseTo(8, 0)
    await userEvent.click(canvas.getByRole("button", { name: "Stop" }))
    await waitFor(() => expect(steps).toHaveAttribute("data-status", "stopped"))
    // The same elements, kept, dimmed.
    const after = said()
    await expect(after[0]).toBe(before[0])
    await expect(after[1]).toBe(before[1])
    await expect(answerOf(steps!)).toHaveClass("text-muted-foreground")
  },
}

/**
 * On a phone: copy, retry and more, a finger's size, and only the time;
 * the facts' numbers are a press away.
 */
export const FooterPhone: Story = {
  ...Footer,
  render: () => (
    <div className="w-[358px]">
      <Replied />
    </div>
  ),
  play: async ({ canvas, canvasElement }) => {
    for (const name of ["Copy", "Retry", "More"]) {
      const button = canvas.getByRole("button", { name })
      await waitFor(() => expect(button).toBeVisible())
      // Once its container is measured.
      await waitFor(() =>
        expect(button.offsetHeight).toBeGreaterThanOrEqual(40)
      )
      await expect(button.offsetWidth).toBeGreaterThanOrEqual(40)
    }
    for (const name of ["Branch from here", "More ways to retry"])
      await expect(
        canvasElement.querySelector(`button[aria-label="${name}"]`)
      ).not.toBeVisible()
    const facts = canvas.getByRole("button", { name: /12:04/ })
    await expect(canvas.getByText("Opus 5.5")).not.toBeVisible()
    await expect(facts.offsetHeight).toBeGreaterThanOrEqual(40)
  },
}

const slowDeploy = `The deploy got slow this week. Here is the end of the build log:

[12:01:02] vite v8.0.4 building for production...
[12:01:03] transforming (412) src/routes/index.tsx
[12:01:09] transforming (1931) src/components/chart.tsx
[12:01:14] ✓ 4120 modules transformed.
[12:01:15] rendering chunks (38)...
[12:05:02] optimizing images (212)...
[12:05:03] ✓ built in 4m 1s

Why is it so much slower than last week?`

type Step =
  | { think: string[] }
  | { call: (id: string, status: "running" | "done") => AgentToolCall }
  | { say: string }

const logFiles = [
  "vite.config.ts",
  "package.json",
  ".github/workflows/deploy.yml",
  "scripts/optimize-images.ts",
  "scripts/cache.ts",
  ".cache/images/key",
  "src/assets/index.ts",
  "public/images/manifest.json",
  "CHANGELOG.md",
]

const ran = (line: string, result: string, fails = false) => ({
  call: (id: string, status: "running" | "done") =>
    command(
      id,
      line,
      result,
      status === "running" ? "running" : fails ? "error" : "done"
    ),
})

const change = (file: string) => ({
  call: (id: string, status: "running" | "done") =>
    edit(id, file, status, 6, 2),
})

/** An agent looking into the slow deploy, with eighteen tool calls. */
const script: Step[] = [
  {
    think: [
      "The log shows where the time goes.",
      "Optimizing images takes almost four minutes.",
      "That step should be cached between deploys.",
    ],
  },
  ...logFiles.map((file) => ({
    call: (id: string, status: "running" | "done") => read(id, file, status),
  })),
  { say: "The cache key changes on every deploy. Checking the build." },
  ran("pnpm build --profile", "✓ built in 4m 1s"),
  ran("pnpm why sharp", "sharp 0.34.2"),
  ran("node scripts/cache.ts --print", "images-3f9c2a1-deploy-8812"),
  ran("pnpm test scripts", "Error: cache.test.ts: 1 failed", true),
  change("scripts/cache.ts"),
  change("scripts/optimize-images.ts"),
  change("vite.config.ts"),
  ran("pnpm test scripts", "✓ 12 passed"),
  ran("pnpm build --profile", "✓ built in 41s"),
  {
    say: "The image cache was keyed on the deploy id, so every deploy optimized all 212 images again. It is keyed on the images' content now: the build takes 41 seconds, down from 4 minutes.",
  },
]

const answer = (script.at(-1) as { say: string }).say

type Live = {
  id: string
  status: "running" | "done"
  parts: AgentTurnPart[]
}

/** Plays the script, as an agent's events would come in. */
function useScript() {
  const [turn, setTurn] = React.useState<Live | null>(null)
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([])
  React.useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const start = () => {
    timers.current.forEach(clearTimeout)
    const changes: [number, (turn: Live) => Live][] = []
    let ms = 0
    const at = (change: (turn: Live) => Live, wait: number) => {
      changes.push([ms, change])
      ms += wait
    }
    const put = (part: AgentTurnPart) => (t: Live) => ({
      ...t,
      parts: t.parts.some((it) => it.id === part.id)
        ? t.parts.map((it) => (it.id === part.id ? part : it))
        : [...t.parts, part],
    })
    script.forEach((step, index) => {
      const id = `live:${index}`
      if ("think" in step) {
        step.think.forEach((_, line) =>
          at(
            put({
              type: "reasoning",
              id,
              text: step.think.slice(0, line + 1).join("\n"),
              status: "running",
            }),
            500
          )
        )
        at(
          put({
            type: "reasoning",
            id,
            text: step.think.join("\n"),
            status: "done",
            duration: "2s",
          }),
          200
        )
      } else if ("call" in step) {
        at(put(step.call(id, "running")), 180)
        at(put(step.call(id, "done")), 60)
      } else {
        const words = step.say.split(" ")
        words.forEach((_, count) =>
          at(put(text(id, words.slice(0, count + 1).join(" "))), 40)
        )
        at((t) => t, 300)
      }
    })
    at((t) => ({ ...t, status: "done" }), 0)

    setTurn({ id: `live:${Date.now()}`, status: "running", parts: [] })
    timers.current = changes.map(([when, change]) =>
      setTimeout(() => setTurn((t) => t && change(t)), when)
    )
  }
  return [turn, start] as const
}

function Said({ id, text }: { id: string; text: string }) {
  const [open, setOpen] = useFold(`${id}:clamp`, false)
  return (
    <Message align="end">
      <MessageContent>
        <Bubble variant="muted">
          <BubbleContent className="whitespace-pre-wrap">
            <Clamp open={open} onOpenChange={setOpen}>
              {text}
            </Clamp>
          </BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  )
}

/**
 * A conversation: two earlier turns, one done and one failed, and a live
 * turn of eighteen tool calls. What the reader opens is kept when the
 * messages unmount, as when scrolled out of a window of messages.
 */
export const Conversation: Story = {
  args: { id: "", status: "done", parts: [] },
  render: function Render() {
    const [turn, start] = useScript()
    const [shown, setShown] = React.useState(true)
    return (
      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          <Button size="sm" onClick={start}>
            Run
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShown(!shown)}>
            {shown ? "Unmount messages" : "Mount messages"}
          </Button>
        </div>
        {shown && (
          <div className="flex flex-col gap-6">
            <Said id="message:1" text="Set up pnpm in CI." />
            <Message>
              <MessageContent>
                <AgentTurn
                  id="turn:1"
                  status="done"
                  duration="9s"

                  parts={[
                    {
                      ...reasoning,
                      id: "reasoning:1",
                      text: "The workflow installs with npm.",
                    },
                    read("tool:1", ".github/workflows/ci.yml"),
                    text("text:1", "CI now installs with pnpm 11."),
                  ]}
                />
                <TurnFooter
                  answer="CI now installs with pnpm 11."
                  time="2:02 PM"
                  facts={["Opus 5.5", "9s"]}
                  visibility="hover"
                />
              </MessageContent>
            </Message>
            <Said id="message:2" text="Run the tests." />
            <Message>
              <MessageContent>
                <AgentTurn
                  id="turn:2"
                  status="error"
                  duration="4s"

                  parts={[
                    command(
                      "tool:2",
                      "pnpm test",
                      "Error: Cannot find module 'vitest'",
                      "error"
                    ),
                    text("text:2", "The tests could not start."),
                  ]}
                />
                <TurnFooter
                  answer="The tests could not start."
                  time="2:05 PM"
                  facts={["Opus 5.5", "4s"]}
                  {...(turn && { visibility: "hover" as const })}
                />
              </MessageContent>
            </Message>
            <Said id="message:3" text={slowDeploy} />
            {turn && (
              <Message>
                <MessageContent>
                  <AgentTurn
                    id={turn.id}
                    status={turn.status}
                    duration="48s"

                    parts={turn.parts}
                  />
                  {/* Hidden while the turn runs. */}
                  <TurnFooter answer={answer} time="2:14 PM" />
                </MessageContent>
              </Message>
            )}
          </div>
        )}
      </div>
    )
  },
}

const cappedCalls = Array.from({ length: 150 }, (_, index) =>
  command(
    index === 75 ? "p-cap:cmd" : `p-cap:${index}`,
    `node task-${index}.js`,
    "one\ntwo\nthree\nfour"
  )
)

/**
 * A run of 150 calls, opened: its list scrolls within min(18rem, 50dvh),
 * fading at its edges; a step opened in it grows the cap by its details.
 */
export const RunCapped: Story = {
  args: {
    id: "cap",
    status: "done",
    parts: [...cappedCalls, text("cap:answer", "Finished.")],
  },
  render: (args) => (
    <Exchange
      {...args}
      asked={false}
      folds={{ "cap:work": true, "p-cap:0:run": true }}
    />
  ),
  play: async ({ canvasElement }) => {
    const list = canvasElement.querySelector<HTMLElement>(
      "[data-slot=agent-turn-steps]"
    )!
    const cap = Math.min(288, innerHeight / 2)
    await waitFor(() => {
      expect(getComputedStyle(list).overflowY).toBe("auto")
      expect(list.scrollHeight).toBeGreaterThan(list.clientHeight)
      expect(list.getBoundingClientRect().height).toBeLessThanOrEqual(cap + 1)
    })
    await expect(list).toHaveClass("scroll-fade-y")
    const row = step("Ran node task-75.js", list)
    row.scrollIntoView()
    await userEvent.click(triggerOf(row))
    await waitFor(() => {
      const details = row.querySelector<HTMLElement>(
        "[data-slot=agent-turn-step-details]"
      )!
      const height = details.getBoundingClientRect().height
      expect(height).toBeGreaterThan(0)
      expect(
        Math.abs(
          parseFloat(list.style.getPropertyValue("--agent-turn-opened")) -
            height
        )
      ).toBeLessThanOrEqual(1)
      expect(
        Math.abs(parseFloat(getComputedStyle(list).maxHeight) - cap - height)
      ).toBeLessThanOrEqual(1)
    })
    await userEvent.click(triggerOf(row))
    await waitFor(() =>
      expect(list.style.getPropertyValue("--agent-turn-opened")).toBe("0px")
    )
  },
}

const cappedCall = (index: number) =>
  command(`p-cap:${index}`, `node task-${index}.js`, "one\ntwo\nthree\nfour")

/** The capped run as it runs, a step more each time Next is pressed. */
function CappedRunning(props: React.ComponentProps<typeof AgentTurn>) {
  const [count, setCount] = React.useState(150)
  const parts = Array.from({ length: count }, (_, index) =>
    index === count - 1
      ? { ...cappedCall(index), status: "running" as const }
      : cappedCall(index)
  )
  return (
    <div className="flex flex-col items-start gap-3">
      <Button variant="outline" onClick={() => setCount((now) => now + 1)}>
        Next
      </Button>
      <Exchange
        {...props}
        parts={parts}
        asked={false}
        folds={{ "cap:work": true, "p-cap:0:run": true }}
      />
    </div>
  )
}

/**
 * The same run while it runs: the live step stays outside the scroller;
 * the list opens at its newest steps, next to it, and keeps them in sight
 * as steps come, until the reader scrolls up.
 */
export const RunCappedRunning: Story = {
  args: { id: "cap", status: "running", parts: [] },
  render: (args) => <CappedRunning {...args} />,
  play: async ({ canvasElement, canvas }) => {
    const live = () => step(/^Running node task-/, canvasElement)
    await waitFor(() => expect(live()).toBeVisible())
    await expect(live().closest("[data-slot=agent-turn-steps]")).toBeNull()
    await expect(live().parentElement).toHaveAttribute(
      "data-slot",
      "agent-turn-run"
    )
    const list = canvasElement.querySelector<HTMLElement>(
      "[data-slot=agent-turn-steps]"
    )!
    const atEnd = () =>
      list.scrollHeight - list.scrollTop - list.clientHeight < 2
    await waitFor(() => expect(atEnd()).toBe(true))
    await expect(list.scrollTop).toBeGreaterThan(0)
    // A step done goes in at the end, in sight.
    await userEvent.click(canvas.getByRole("button", { name: "Next" }))
    await waitFor(() =>
      expect(step("Ran node task-149.js", list)).toBeDefined()
    )
    await expect(live()).toHaveTextContent("node task-150.js")
    await waitFor(() => expect(atEnd()).toBe(true))
    // Scrolled up, the list stays where the reader left it.
    list.scrollTop = 0
    await waitFor(() => expect(list.scrollTop).toBe(0))
    await frames(2)
    await userEvent.click(canvas.getByRole("button", { name: "Next" }))
    await waitFor(() =>
      expect(step("Ran node task-150.js", list)).toBeDefined()
    )
    await frames(2)
    await expect(list.scrollTop).toBe(0)
  },
}

/**
 * A run of reads alone, opened: its one line is the run's, and its rows
 * scroll within the run's cap, under its words.
 */
export const ExploredCapped: Story = {
  args: {
    id: "look-cap",
    status: "done",
    parts: [
      ...Array.from({ length: 60 }, (_, index) =>
        read(`p-look:${index}`, `src/file-${index}.ts`)
      ),
      text("look-cap:answer", "Read them all."),
    ],
  },
  render: (args) => (
    <Exchange
      {...args}
      asked={false}
      folds={{ "look-cap:work": true, "p-look:0:run": true }}
    />
  ),
  play: async ({ canvasElement }) => {
    const look = lookLine("Read 60 files", canvasElement)
    await expect(look).toHaveAttribute("aria-expanded", "true")
    const inside = canvasElement.querySelector<HTMLElement>(
      "[data-slot=agent-turn-look-steps]"
    )!
    const cap = Math.min(288, innerHeight / 2)
    await waitFor(() => {
      expect(inside.scrollHeight).toBeGreaterThan(inside.clientHeight)
      expect(inside.getBoundingClientRect().height).toBeLessThanOrEqual(cap + 1)
    })
    await expect(inside).toHaveClass("scroll-fade-y")
    // Its rows under its words, as an uncapped one has them.
    await expect(
      left(inside.querySelector("[data-slot=agent-turn-step-icon]")!)
    ).toBe(left(look.querySelector("[data-slot=agent-turn-look-title]")!))
  },
}

const outputStory = (call: AgentToolCall): Story => ({
  args: { id: "output", status: "done", parts: [call] },
  render: (args) => (
    <Exchange
      {...args}
      asked={false}
      folds={{ "output:work": true, [`${call.id}:run`]: true, [call.id]: true }}
    />
  ),
})

/** Output the source cut: shown whole, it says the start is missing. */
export const CommandOutputTruncated: Story = {
  ...outputStory({
    ...command("truncated", "pnpm test", "1\n2\n3\n4\n5\n6"),
    outputTruncated: "start",
  }),
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.queryByText("Earlier output not shown")).toBeNull()
    await userEvent.click(
      canvas.getByRole("button", { name: "Show 2 earlier lines" })
    )
    const note = canvasElement.querySelector(
      "[data-slot=agent-turn-output-truncated]"
    )!
    await expect(note).toHaveTextContent("Earlier output not shown")
    await expect(note).not.toHaveAttribute("data-tone")
    await expect(note.parentElement?.firstElementChild).toBe(note)
  },
}

/** Output whose end the source cut: a line after it says so. */
export const CommandOutputTruncatedEnd: Story = {
  ...outputStory({
    ...command("truncated-end", "pnpm test", "1\n2"),
    outputTruncated: "end",
  }),
  play: async ({ canvasElement }) => {
    const note = canvasElement.querySelector(
      "[data-slot=agent-turn-output-truncated]"
    )!
    await expect(note).toHaveTextContent("Later output not shown")
    await expect(note).toHaveAttribute("data-cut", "end")
    await expect(note.parentElement?.lastElementChild).toBe(note)
  },
}

/** A finished command that printed nothing says so; a running one does not. */
export const CommandNoOutput: Story = {
  args: {
    id: "empty",
    status: "done",
    parts: [
      command("empty:done", "pnpm test", ""),
      { ...command("empty:running", "pnpm build", "", "running"), output: "" },
    ],
  },
  render: (args) => (
    <Exchange
      {...args}
      asked={false}
      folds={{
        "empty:work": true,
        "empty:done:run": true,
        "empty:done": true,
        "empty:running": true,
      }}
    />
  ),
  play: async ({ canvas, canvasElement }) => {
    await waitFor(() => expect(canvas.getByText("No output")).toBeVisible())
    const running = step("Running pnpm build", canvasElement)
    await expect(within(running).queryByText("No output")).toBeNull()
    await expect(within(running).queryByRole("status")).toBeNull()
  },
}

/** Output still being fetched. */
export const CommandOutputLoading: Story = {
  ...outputStory({
    type: "tool",
    id: "loading",
    status: "done",
    outputLoading: true,
  }),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Loading output…"
    )
  },
}

/**
 * A running command's output shown whole: capped at 20rem, it follows its
 * end, until the reader scrolls up.
 */
export const CommandOutputFollows: Story = {
  args: { id: "follow", status: "running", parts: [] },
  render: function Render() {
    const [count, setCount] = React.useState(40)
    return (
      <>
        <Button onClick={() => setCount((value) => value + 10)}>
          Add output
        </Button>
        <Exchange
          id="follow"
          status="running"
          asked={false}
          folds={{
            "follow:work": true,
            "follow:call:run": true,
            "follow:call": true,
          }}
          parts={[
            {
              ...command("follow:call", "pnpm test", "", "running"),
              output: Array.from(
                { length: count },
                (_, i) => `Line ${i + 1}`
              ).join("\n"),
            },
          ]}
        />
      </>
    )
  },
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Show 36 earlier lines" })
    )
    const output = canvasElement.querySelector<HTMLElement>(
      "[data-slot=code-block-content]"
    )!
    const bottom = () =>
      output.scrollHeight - output.scrollTop - output.clientHeight
    await waitFor(() => {
      expect(getComputedStyle(output).maxHeight).toBe("320px")
      expect(bottom()).toBeLessThanOrEqual(4)
    })
    await userEvent.click(canvas.getByRole("button", { name: "Add output" }))
    await waitFor(() => {
      expect(canvas.getByText("Line 50")).toBeInTheDocument()
      expect(bottom()).toBeLessThanOrEqual(4)
    })
    output.scrollTop = 0
    output.dispatchEvent(new Event("scroll", { bubbles: true }))
    await userEvent.click(canvas.getByRole("button", { name: "Add output" }))
    await waitFor(() => expect(canvas.getByText("Line 60")).toBeInTheDocument())
    await settled(() => output.scrollTop)
    await expect(output.scrollTop).toBe(0)
  },
}

/** A turn loaded without its steps, its work open or not. */
const lazySteps = (
  steps: "loading" | "deferred" | "error",
  open: boolean
): Story => ({
  args: {
    id: "lazy",
    status: "done",
    duration: "12s",
    parts: [text("lazy:answer", "Finished.")],
    steps,
    onLoadSteps: fn(),
  },
  render: (args) => (
    <Exchange {...args} asked={false} folds={{ "lazy:work": open }} />
  ),
})

/** Its steps loading: three skeleton lines. */
export const StepsLoading: Story = {
  ...lazySteps("loading", true),
  play: async ({ canvas }) => {
    const loading = canvas.getByRole("status", { name: "Loading steps" })
    await waitFor(() => expect(loading).toBeVisible())
    await expect(loading.children).toHaveLength(3)
    await waitFor(() =>
      expect(
        canvas.getByRole("button", { name: "Worked for 12s" })
      ).toBeVisible()
    )
  },
}

/** Its steps load when the reader opens its work. */
export const StepsDeferred: Story = {
  ...lazySteps("deferred", false),
  play: async ({ args, canvas }) => {
    const loadSteps = args.onLoadSteps!
    await expect(loadSteps).not.toHaveBeenCalled()
    await userEvent.click(
      canvas.getByRole("button", { name: "Worked for 12s" })
    )
    await waitFor(() => expect(loadSteps).toHaveBeenCalledTimes(1))
  },
}

/** Its steps failed to load: a message and Retry. */
export const StepsLoadFailed: Story = {
  ...lazySteps("error", true),
  play: async ({ args, canvas }) => {
    const loadSteps = args.onLoadSteps!
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "Could not load the steps"
    )
    await userEvent.click(canvas.getByRole("button", { name: "Retry" }))
    await expect(loadSteps).toHaveBeenCalledTimes(1)
  },
}

const foldParts: AgentTurnPart[] = [
  ...Array.from({ length: 6 }, (_, i) =>
    command(`fold:command:${i}`, `echo fold-${i}`, `Fold output ${i}`)
  ),
  text("fold:answer", "The commands finished."),
]

/** Its fold no longer changing height: closed (unmounted), or still. */
const still = (trigger: HTMLElement) => {
  const panel = trigger
    .closest("[data-slot=collapsible], [data-slot=agent-turn-work]")!
    .querySelector<HTMLElement>(":scope > [data-slot=collapsible-content]")
  return (
    !panel ||
    (panel.getAnimations().length === 0 &&
      !panel.hasAttribute("data-starting-style") &&
      !panel.hasAttribute("data-ending-style"))
  )
}

/**
 * Opened or closed by the reader, a fold's line stays where it was on
 * screen, even cut off at the scroller's top or out of sight above it,
 * where the browser's scroll anchoring would keep what is seen under it
 * still and move the line.
 */
export const FoldKeepsItsPlace: Story = {
  args: { id: "fold:place", status: "done", parts: foldParts },
  render: (args) => (
    <div className="h-80 overflow-y-auto" data-testid="fold-scroll">
      <div className="h-96" />
      <Exchange {...args} asked={false} folds={{ "fold:place:work": true }} />
      <div className="h-96" />
    </div>
  ),
  play: async ({ canvas }) => {
    const scroller = canvas.getByTestId("fold-scroll")
    /** Puts `line` `by` pixels above the scroller's top, focused. */
    const place = async (
      line: HTMLElement,
      trigger: HTMLElement,
      by: number
    ) => {
      scroller.scrollTop +=
        line.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top +
        by
      // Focused as a pointer focuses it, without scrolling it into view.
      trigger.focus({ preventScroll: true })
      await frames()
      return line.getBoundingClientRect().top
    }
    const toggled = async (trigger: HTMLElement, expanded: string) => {
      await waitFor(() =>
        expect(trigger).toHaveAttribute("aria-expanded", expanded)
      )
      await waitFor(() => expect(still(trigger)).toBe(true))
      await frames(2)
    }
    const check = async (trigger: HTMLElement) => {
      const top = await place(trigger, trigger, 4)
      for (const expanded of ["true", "false"]) {
        await userEvent.click(trigger)
        await toggled(trigger, expanded)
        await expect(
          Math.abs(trigger.getBoundingClientRect().top - top)
        ).toBeLessThan(2)
      }
    }
    const runOf = () => runLine(/^Ran 6 commands/)
    await check(runOf())
    // A step's line out of sight above, pressed from the keyboard: the
    // browser would keep what is seen still, and the line move up as far
    // as its details are tall.
    await userEvent.click(runOf())
    await toggled(runOf(), "true")
    const line = step("Ran echo fold-3")
    const trigger = line.querySelector<HTMLElement>(
      "[data-slot=agent-turn-step-trigger]"
    )!
    const top = await place(line, trigger, 40)
    await userEvent.keyboard("{Enter}")
    await toggled(trigger, "true")
    await expect(Math.abs(line.getBoundingClientRect().top - top)).toBeLessThan(
      2
    )
    // The turn's work, closed first so it opens, then closes.
    await userEvent.click(work())
    await toggled(work(), "false")
    await check(work())
  },
}
