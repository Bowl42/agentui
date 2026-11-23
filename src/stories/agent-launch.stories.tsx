import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AiBrain01Icon,
  ComputerIcon,
  Edit02Icon,
  Folder01Icon,
  GitBranchIcon,
  RocketIcon,
  SecurityCheckIcon,
  ShieldEnergyIcon,
} from "@hugeicons/core-free-icons"
import { expect, fn, userEvent, within } from "storybook/test"

import {
  AgentLaunch,
  AgentLaunchControls,
  AgentLaunchEdit,
  AgentLaunchList,
  AgentLaunchMessage,
  AgentLaunchMeta,
  AgentLaunchMetaItem,
  AgentLaunchTitle,
} from "@/components/agent-launch"
import {
  AgentRequest,
  AgentRequestContent,
  AgentRequestFooter,
  AgentRequestTitle,
} from "@/components/agent-request"
import {
  ComposerModePicker,
  ComposerOptionButton,
  ComposerSelect,
  ComposerSelectContent,
  ComposerSelectItem,
  ComposerSelectList,
  ComposerSelectTrigger,
  ComposerSelectValue,
  type ComposerMode,
} from "@/components/composer-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupTextarea,
} from "@/components/ui/input-group"

const decide = fn()

const meta = {
  title: "Blocks/Agent Launch",
  component: AgentLaunch,
  parameters: { layout: "padded" },
  beforeEach: () => {
    decide.mockClear()
  },
  decorators: [
    (Story) => (
      // The composer's width, where the request takes its place.
      <div className="w-188 max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AgentLaunch>

export default meta
type Story = StoryObj<typeof meta>

/** The app's own: its machines, agents and permission levels. */
const machines = ["linux-box", "mac-mini"]
const agents = [
  { value: "claude", label: "Claude Opus (high)" },
  { value: "claude-fast", label: "Claude Sonnet (low)" },
  { value: "codex", label: "Codex (medium)" },
]
const modes: ComposerMode[] = [
  {
    value: "ask",
    label: "Ask first",
    description: "Asks before it edits or runs a command.",
    icon: <HugeiconsIcon icon={SecurityCheckIcon} strokeWidth={2} />,
  },
  {
    value: "edit",
    label: "Edit freely",
    description: "Edits files; asks before commands.",
    icon: <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} />,
  },
  {
    value: "full",
    label: "Full access",
    description: "Edits and runs anything, unasked.",
    icon: <HugeiconsIcon icon={ShieldEnergyIcon} strokeWidth={2} />,
    tone: "destructive",
  },
]

type Launch = {
  id: string
  title: string
  machine: string
  agent: string
  mode: string
  folder: string
  message: string
  nested: boolean
  /** A copy of a conversation: its machine, agent and folder fixed. */
  copyOf?: string
  included: boolean
}

const fix: Launch = {
  id: "fix",
  title: "Fix the flaky upload test",
  machine: "linux-box",
  agent: "claude",
  mode: "ask",
  folder: "~/code/app",
  message:
    "The upload test fails about one run in ten on CI, never locally. Find why: look at the retries in `upload.ts`, the fake timers in the test, and whether the bucket mock is reset between cases.\n\nFix the cause rather than adding a retry, run the test a hundred times to show it holds, and open a pull request with what you found.",
  nested: true,
  included: true,
}
const docs: Launch = {
  id: "docs",
  title: "Write the migration notes for the cache change",
  machine: "mac-mini",
  agent: "claude-fast",
  mode: "edit",
  folder: "~/code/app/docs",
  message:
    "Write the notes for moving to the new cache: what changes for an app, the one setting it must add, and how to roll back.",
  nested: true,
  included: true,
}
const copy: Launch = {
  id: "copy",
  title: "Try the build on the older Node",
  machine: "linux-box",
  agent: "codex",
  mode: "ask",
  folder: "~/code/app",
  message:
    "Same as before, on Node 20: run the build and the tests, and list what breaks.",
  nested: false,
  copyOf: "Tune the vite build",
  included: true,
}

const icon = (glyph: typeof ComputerIcon) => (
  <HugeiconsIcon icon={glyph} strokeWidth={2} />
)
const agentLabel = (value: string) =>
  agents.find((agent) => agent.value === value)?.label ?? value
const folders = ["~/code/app", "~/code/app/docs", "~/code/site"]

/** A picker of the launch's, as a composer's toolbar has one. */
function Picker({
  name,
  value,
  values,
  label = (value) => value,
  glyph,
  onValueChange,
}: {
  name: string
  value: string
  values: readonly string[]
  label?: (value: string) => string
  glyph: typeof ComputerIcon
  onValueChange: (value: string) => void
}) {
  return (
    <ComposerSelect value={value} onValueChange={onValueChange}>
      <ComposerSelectTrigger aria-label={`${name}: ${label(value)}`}>
        {icon(glyph)}
        <ComposerSelectValue>{label(value)}</ComposerSelectValue>
      </ComposerSelectTrigger>
      <ComposerSelectContent title={name}>
        <ComposerSelectList aria-label={name}>
          {values.map((value) => (
            <ComposerSelectItem key={value} value={value}>
              {label(value)}
            </ComposerSelectItem>
          ))}
        </ComposerSelectList>
      </ComposerSelectContent>
    </ComposerSelect>
  )
}

/** A launch as the app renders it: its summary, and its settings. */
function LaunchItem({
  launch,
  several,
  onChange,
}: {
  launch: Launch
  several: boolean
  onChange: (launch: Launch) => void
}) {
  const set = (change: Partial<Launch>) => onChange({ ...launch, ...change })
  const fixed = launch.copyOf !== undefined
  const mode = modes.find((mode) => mode.value === launch.mode)
  return (
    <AgentLaunch
      {...(several && {
        included: launch.included,
        onIncludedChange: (included: boolean) => set({ included }),
      })}
    >
      <AgentLaunchTitle
        editor={
          <Input
            aria-label="Title"
            value={launch.title}
            onChange={(event) => set({ title: event.target.value })}
          />
        }
      >
        {launch.title}
      </AgentLaunchTitle>
      <AgentLaunchMeta>
        {fixed && (
          <AgentLaunchMetaItem fixed>
            Copy of {launch.copyOf}
          </AgentLaunchMetaItem>
        )}
        <AgentLaunchMetaItem fixed={fixed}>
          {agentLabel(launch.agent)}
        </AgentLaunchMetaItem>
        {machines.length > 1 && (
          <AgentLaunchMetaItem fixed={fixed}>
            {launch.machine}
          </AgentLaunchMetaItem>
        )}
        <AgentLaunchMetaItem fixed={fixed}>{launch.folder}</AgentLaunchMetaItem>
        <AgentLaunchMetaItem
          className={
            mode?.tone === "destructive" ? "text-destructive" : undefined
          }
        >
          {mode?.label}
        </AgentLaunchMetaItem>
      </AgentLaunchMeta>
      <AgentLaunchMessage>{launch.message}</AgentLaunchMessage>
      <AgentLaunchEdit>
        <InputGroup>
          <InputGroupTextarea
            aria-label="First message"
            value={launch.message}
            onChange={(event) => set({ message: event.target.value })}
          />
          <InputGroupAddon align="block-end">
            <AgentLaunchControls>
              {!fixed && (
                <Picker
                  name="Agent"
                  value={launch.agent}
                  values={agents.map((agent) => agent.value)}
                  label={agentLabel}
                  glyph={AiBrain01Icon}
                  onValueChange={(agent) => set({ agent })}
                />
              )}
              {machines.length > 1 && !fixed && (
                <Picker
                  name="Machine"
                  value={launch.machine}
                  values={machines}
                  glyph={ComputerIcon}
                  onValueChange={(machine) => set({ machine })}
                />
              )}
              {!fixed && (
                <Picker
                  name="Folder"
                  value={launch.folder}
                  values={folders}
                  glyph={Folder01Icon}
                  onValueChange={(folder) => set({ folder })}
                />
              )}
              <ComposerModePicker
                modes={modes}
                value={launch.mode}
                onValueChange={(mode) => set({ mode })}
              />
              <ComposerOptionButton
                aria-pressed={launch.nested}
                onClick={() => set({ nested: !launch.nested })}
              >
                {icon(GitBranchIcon)}
                In this chat
              </ComposerOptionButton>
            </AgentLaunchControls>
          </InputGroupAddon>
        </InputGroup>
      </AgentLaunchEdit>
    </AgentLaunch>
  )
}

/** The request: the launches, and the reader's choices for them all. */
function LaunchRequest({ initial }: { initial: Launch[] }) {
  const [launches, setLaunches] = React.useState(initial)
  const several = launches.length > 1
  const count = launches.filter((launch) => launch.included).length
  const items = launches.map((launch) => (
    <LaunchItem
      key={launch.id}
      launch={launch}
      several={several}
      onChange={(next) =>
        setLaunches((all) =>
          all.map((launch) => (launch.id === next.id ? next : launch))
        )
      }
    />
  ))
  return (
    <AgentRequest icon={icon(RocketIcon)}>
      <AgentRequestTitle>
        {several ? `Start ${launches.length} new tasks?` : "Start a new task?"}
      </AgentRequestTitle>
      <AgentRequestContent>
        {several ? <AgentLaunchList>{items}</AgentLaunchList> : items}
      </AgentRequestContent>
      <AgentRequestFooter>
        <Button variant="outline" size="sm" onClick={() => decide("cancel")}>
          Don't start
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={count === 0}
          onClick={() => decide("always", launches)}
        >
          Always start like this
        </Button>
        <Button
          size="sm"
          disabled={count === 0}
          onClick={() =>
            decide(
              "start",
              launches.filter((launch) => launch.included)
            )
          }
        >
          {!several
            ? "Start"
            : count === launches.length
              ? "Start these"
              : `Start ${count}`}
        </Button>
      </AgentRequestFooter>
    </AgentRequest>
  )
}

/**
 * One task proposed: its title, a quiet line of what it runs with, and
 * two lines of its first message, all in line. The pencil opens its
 * settings in their place, a composer's: the message in a box, the
 * pickers along its foot (agent, machine, folder, permissions, whether
 * it stays in this chat); Done closes them, the summary saying what was
 * chosen.
 */
export const One: Story = {
  render: () => <LaunchRequest initial={[fix]} />,
  play: async ({ canvas, canvasElement }) => {
    const launch = canvasElement.querySelector<HTMLElement>(
      "[data-slot=agent-launch]"
    )!
    // No checkbox for one.
    await expect(within(launch).queryByRole("checkbox")).toBeNull()
    await expect(within(launch).getByText("~/code/app")).toBeVisible()
    // Two lines of the message, in line with the title.
    const message = launch.querySelector<HTMLElement>(
      "[data-slot=agent-launch-message]"
    )!
    await expect(message.getBoundingClientRect().height).toBe(40)
    const heading = launch.querySelector("[data-slot=agent-launch-title]")!
    await expect(message.getBoundingClientRect().left).toBe(
      heading.getBoundingClientRect().left
    )
    const edit = canvas.getByRole("button", { name: "Edit" })
    await expect(edit).toHaveAccessibleDescription("Fix the flaky upload test")
    await userEvent.click(edit)
    const title = canvas.getByRole("textbox", { name: "Title" })
    // Its meta, nothing of it fixed, gone for the controls.
    await expect(
      canvasElement.querySelector("[data-slot=agent-launch-meta]")
    ).not.toBeVisible()
    await userEvent.clear(title)
    await userEvent.type(title, "Fix the upload test")
    await userEvent.click(
      canvas.getByRole("button", { name: "Permissions: Ask first" })
    )
    await userEvent.click(
      await within(document.body).findByRole("option", { name: /^Edit freely/ })
    )
    await userEvent.click(canvas.getByRole("button", { name: "Done" }))
    await expect(canvas.getByText("Fix the upload test")).toBeVisible()
    await expect(canvas.getByText("Edit freely")).toBeVisible()
    await userEvent.click(canvas.getByRole("button", { name: "Start" }))
    await expect(decide).toHaveBeenCalledWith("start", [
      expect.objectContaining({ title: "Fix the upload test", mode: "edit" }),
    ])
  },
}

/**
 * Several proposed at once: a list, a rule between, each with a
 * checkbox to leave it out (its title muted then); Start says how many.
 */
export const Several: Story = {
  render: () => <LaunchRequest initial={[fix, docs, copy]} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("list")).toBeVisible()
    const boxes = canvas.getAllByRole("checkbox")
    await expect(boxes).toHaveLength(3)
    await expect(boxes[1]).toHaveAccessibleName(
      "Start Write the migration notes for the cache change"
    )
    await expect(
      canvas.getByRole("button", { name: "Start these" })
    ).toBeVisible()
    await userEvent.click(boxes[1]!)
    const start = canvas.getByRole("button", { name: "Start 2" })
    const title = canvas.getByText(
      "Write the migration notes for the cache change"
    )
    await expect(getComputedStyle(title.parentElement!).color).not.toBe(
      getComputedStyle(canvas.getByText("Fix the flaky upload test")).color
    )
    await userEvent.click(start)
    await expect(decide).toHaveBeenCalledWith(
      "start",
      expect.not.arrayContaining([expect.objectContaining({ id: "docs" })])
    )
  },
}

/**
 * A copy of a conversation: what it copies says so, and its agent,
 * machine and folder are shown, not offered to change.
 */
export const Copied: Story = {
  render: () => <LaunchRequest initial={[copy]} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Copy of Tune the vite build")).toBeVisible()
    await userEvent.click(canvas.getByRole("button", { name: "Edit" }))
    await expect(canvas.queryByRole("button", { name: /^Agent:/ })).toBeNull()
    await expect(canvas.queryByRole("button", { name: /^Machine:/ })).toBeNull()
    await expect(canvas.queryByRole("button", { name: /^Folder:/ })).toBeNull()
    // What cannot change, a line over what can.
    await expect(canvas.getByText("Codex (medium)")).toBeVisible()
    await expect(canvas.getByText("~/code/app")).toBeVisible()
    // Its permissions and message still the reader's to change.
    await expect(
      canvas.getByRole("button", { name: "Permissions: Ask first" })
    ).toBeVisible()
    await expect(
      canvas.getByRole("textbox", { name: "First message" })
    ).toBeVisible()
  },
}

/**
 * On a phone, in the composer's place: the meta cut short, the choices
 * a finger's height; edited, the pickers wrap along the box's foot.
 */
export const Phone: Story = {
  decorators: [
    (Story) => (
      <div className="w-90">
        <Story />
      </div>
    ),
  ],
  render: () => <LaunchRequest initial={[fix, copy]} />,
  play: async ({ canvas, canvasElement }) => {
    const card = canvasElement.querySelector<HTMLElement>(
      "[data-slot=agent-request]"
    )!
    await expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth)
    const [edit] = canvas.getAllByRole("button", { name: "Edit" })
    await userEvent.click(edit!)
    await expect(
      canvas.getByRole("textbox", { name: "First message" })
    ).toBeVisible()
    await expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth)
  },
}
