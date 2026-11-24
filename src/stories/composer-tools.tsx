import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ShieldEnergyIcon,
  AtIcon,
  BrainIcon,
  CodeIcon,
  Folder01Icon,
  HashtagIcon,
  Image01Icon,
  LaptopIcon,
  Message01Icon,
  SecurityCheckIcon,
} from "@hugeicons/core-free-icons"

import {
  ComposerAttach,
  ComposerAttachFiles,
  ComposerAttachItem,
  ComposerHistoryHint,
  ComposerOptions,
  ComposerOptionsFold,
  ComposerOptionsItem,
  ComposerSubmit,
  ComposerToolbar,
  ComposerVoice,
} from "@/components/composer"
import { ComposerModePicker } from "@/components/composer-select"
import { ModelPicker, type ModelGroup } from "@/components/model-picker"
import {
  UsageMeterBreakdown,
  UsageMeterGraphic,
} from "@/components/usage-meter"
import { Button } from "@/components/ui/button"
import { DropdownMenuSeparator } from "@/components/ui/dropdown-menu"

// A composer's full toolbar, as the design has it, for the stories: add,
// permissions, model and effort, context, voice and send.

const icon = (glyph: typeof AtIcon) => (
  <HugeiconsIcon icon={glyph} strokeWidth={2} />
)

const steps = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "max", label: "Max" },
]

const toolbarModels: ModelGroup[] = [
  {
    id: "anthropic",
    label: "Anthropic",
    models: [
      {
        id: "opus-5.5",
        label: "Opus 5.5",
        detail: "200k · $15",
        efforts: steps,
        defaultEffort: "medium",
      },
      {
        id: "sonnet-5.5",
        label: "Sonnet 5.5",
        detail: "1M · $3",
        efforts: steps,
        defaultEffort: "medium",
      },
      { id: "haiku-5.5", label: "Haiku 5.5", detail: "200k · $1" },
    ],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    models: [
      {
        id: "deepseek-v4",
        label: "deepseek-v4",
        detail: "128k · $0.27",
        badge: "OpenRouter",
      },
    ],
  },
]

const modes = [
  {
    value: "discuss",
    label: "Discuss",
    description: "Talks it through, changes nothing",
    icon: icon(Message01Icon),
  },
  {
    value: "ask",
    label: "Ask first",
    description: "Asks before it edits or runs a command",
    icon: icon(SecurityCheckIcon),
  },
  {
    value: "full",
    label: "Full access",
    description: "Edits, runs and uses the network without asking",
    icon: icon(ShieldEnergyIcon),
    tone: "destructive" as const,
  },
]

/** A waveform as an app's recorder reports it. */
const levels = [
  0, 0.1, 0.3, 0.5, 0.2, 0.05, 0.4, 0.7, 0.9, 0.6, 0.25, 0.1, 0, 0.2, 0.5, 0.8,
  1, 0.7, 0.4, 0.2, 0.1, 0.3, 0.6, 0.9, 0.7, 0.4, 0.2, 0.05, 0, 0.15, 0.4, 0.6,
  0.3, 0.1,
]

/** A plan's limits, a week's outside and five hours' inside. */
const planLimits = [
  {
    label: "Weekly",
    value: 41,
    valueText: "41% used",
    detail: "Resets Mon 09:00",
  },
  {
    label: "5 hours",
    value: 78,
    valueText: "78% used",
    detail: "Resets in 1h 12m",
    tone: "warning" as const,
  },
]

/**
 * The design's toolbar, each tool working on its own state. With
 * `options`, a phone folds permissions and the context meter into the
 * options button (⚙) and its sheet.
 */
function FullToolbar({
  reason,
  usage = true,
  options = false,
  extra,
  compact = false,
}: {
  /** Why it cannot send, before the send button. */
  reason?: string | undefined
  /**
   * Whether the context meter shows; `rings`, a plan's limits instead,
   * as two rings.
   */
  usage?: boolean | "rings"
  /** Whether a phone folds permissions and usage into the options sheet. */
  options?: boolean
  /** An app's own tools after the model, e.g. an account picker. */
  extra?: React.ReactNode
  /**
   * Whether folding keeps the tools in place, compact, first: the
   * permissions as their icon, the meter (kept) as its bar and number.
   */
  compact?: boolean
}) {
  const [mode, setMode] = React.useState("ask")
  const [model, setModel] = React.useState("opus-5.5")
  const [effort, setEffort] = React.useState<string | null>("high")
  const [open, setOpen] = React.useState<"options" | "mode" | "model" | null>(
    null
  )
  const opener = (name: "options" | "mode" | "model") => ({
    open: open === name,
    onOpenChange: (next: boolean) =>
      setOpen((current) => (next ? name : current === name ? null : current)),
  })
  const Fold = options ? ComposerOptionsFold : React.Fragment
  const modeFold = compact ? { compact: true } : {}
  const meterFold = compact ? { keep: true } : {}
  const meter =
    usage === "rings" ? (
      <UsageMeterBreakdown
        rings={planLimits}
        label="Plan limits"
        rows={[{ label: "Plan", value: "Pro" }]}
        className="ms-auto"
      />
    ) : usage ? (
      <UsageMeterBreakdown
        variant="bar"
        value={38}
        label="Context"
        valueText="76k of 200k"
        rows={[
          { label: "System and tools", value: "28k", amount: 14 },
          { label: "Messages", value: "36k", amount: 18 },
          { label: "Files", value: "12k", amount: 6 },
          { label: "This conversation", value: "$0.42", separator: true },
          { label: "Weekly quota", value: "61% · resets Mon" },
        ]}
        footer={
          <Button variant="outline" size="sm" className="w-full">
            Compact now
          </Button>
        }
        className="ms-auto"
      >
        38%
      </UsageMeterBreakdown>
    ) : null
  return (
    <ComposerToolbar>
      <ComposerAttach>
        <ComposerAttachFiles shortcut="⌘U" />
        <ComposerAttachItem icon={icon(Image01Icon)} shortcut="⌘⇧U">
          Add photos
        </ComposerAttachItem>
        <ComposerAttachItem icon={icon(LaptopIcon)} shortcut="⌘⇧S">
          Take a screenshot
        </ComposerAttachItem>
        <ComposerAttachItem icon={icon(Folder01Icon)} shortcut="⌘O">
          From the workspace
        </ComposerAttachItem>
        <DropdownMenuSeparator />
        <ComposerAttachItem icon={icon(AtIcon)} shortcut="@">
          Mention
        </ComposerAttachItem>
        <ComposerAttachItem icon={icon(HashtagIcon)} shortcut="#">
          Insert a snippet
        </ComposerAttachItem>
        <ComposerAttachItem icon={icon(SecurityCheckIcon)} shortcut="$">
          Use a secret
        </ComposerAttachItem>
        <ComposerAttachItem icon={icon(CodeIcon)} shortcut="/">
          Run a command
        </ComposerAttachItem>
      </ComposerAttach>
      <Fold {...modeFold}>
        <ComposerModePicker
          modes={modes}
          value={mode}
          onValueChange={setMode}
          {...opener("mode")}
        />
      </Fold>
      <ModelPicker
        {...opener("model")}
        shortcut="⌘M"
        onManage={() => {}}
        groups={toolbarModels}
        recent={["opus-5.5", "sonnet-5.5", "deepseek-v4"]}
        value={model}
        onValueChange={(id) => {
          setModel(id)
          setEffort(null)
        }}
        effort={effort}
        onEffortChange={setEffort}
      />
      {extra}
      <ComposerHistoryHint />
      <Fold {...meterFold}>{meter}</Fold>
      {options ? (
        <ComposerOptions className="ms-auto" {...opener("options")}>
          <ComposerOptionsItem
            icon={modes.find((item) => item.value === mode)?.icon}
            value={modes.find((item) => item.value === mode)?.label}
            onClick={() => setOpen("mode")}
          >
            Permissions
          </ComposerOptionsItem>
          <ComposerOptionsItem
            icon={icon(BrainIcon)}
            value={
              steps.find((step) => step.value === effort)?.label ?? "Default"
            }
            onClick={() => setOpen("model")}
          >
            Thinking
          </ComposerOptionsItem>
          {usage === "rings" ? (
            <ComposerOptionsItem
              icon={<UsageMeterGraphic rings={planLimits} />}
              value="41% · 78%"
            >
              Plan limits
            </ComposerOptionsItem>
          ) : usage ? (
            <ComposerOptionsItem
              icon={<UsageMeterGraphic value={38} variant="bar" />}
              value="76k of 200k"
            >
              Context
            </ComposerOptionsItem>
          ) : null}
        </ComposerOptions>
      ) : null}
      <ComposerVoice
        levels={levels}
        duration={7}
        onStart={() => {}}
        onFinish={() => "Tag it once CI is green"}
        className={usage || options ? undefined : "ms-auto"}
      />
      <ComposerSubmit reason={reason} />
    </ComposerToolbar>
  )
}

export { FullToolbar, planLimits, toolbarModels }
