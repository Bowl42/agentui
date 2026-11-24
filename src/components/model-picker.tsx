"use client"

import * as React from "react"
import { flushSync } from "react-dom"
import { Select as SelectPrimitive } from "@base-ui/react/select"
import { cn } from "cn"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert02Icon,
  ArrowDown01Icon,
  PinIcon,
  PinOffIcon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowTurnBackwardIcon,
  Image01Icon,
  Clock01Icon,
  PlusSignIcon,
  Settings01Icon,
} from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import {
  ComposerSelect,
  ComposerSelectContent,
  ComposerSelectItem,
  ComposerSelectList,
  ComposerSelectTrigger,
  ComposerSelectValue,
  composerSelectRow,
} from "@/components/composer-select"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
} from "@/components/ui/empty"
import { Kbd } from "@/components/ui/kbd"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/** A step of how hard a model thinks: "Low", "High". */
type ModelEffort = { value: string; label: string }

/** A model to pick, as the app describes it. */
type ModelOption = {
  id: string
  label: string
  /** What sets it apart, on the right: "200k · $15". */
  detail?: string
  /**
   * A short tag after its name, in the list and in the trigger: the
   * route it takes ("OpenRouter"), "no tools".
   */
  badge?: string
  /** Its thinking steps, in order, if it has them. */
  efforts?: ModelEffort[]
  /** The step it uses unless one is chosen. */
  defaultEffort?: string
  /**
   * Its thinking only turns on or off: a switch, off its first step and
   * on its second.
   */
  effortToggle?: boolean
  /** It cannot be used now; as the conversation's, the trigger says so. */
  disabled?: boolean
  /**
   * Why it cannot be used now ("Not in your plan"): it is disabled, and
   * this is said at its row's end, in its name too.
   */
  disabledReason?: string
  /**
   * Its part of its group, e.g. its family: "Claude Opus". A group's
   * models with one are listed under its name, in the order they first
   * come, after those with none; a search lists them by group alone.
   */
  section?: string
}

/**
 * A group of models: where they come from (a provider) or what they are
 * (a family), as the app sorts them; its label is the group's name alone.
 * Families of several sources: each family's `section`, its source.
 */
type ModelGroup = {
  id: string
  label: string
  /**
   * What it is part of, e.g. the source of a family's models: the rail's
   * groups under a heading of it, in the app's order; said with its
   * label, "Local · Claude", in the search's headings and its tab's name.
   */
  section?: string
  /**
   * Before its section's heading in the rail, e.g. a machine's mark: the
   * section's first group's.
   */
  sectionIcon?: React.ReactNode
  /** Before its name in the rail, e.g. the provider's or family's mark. */
  icon?: React.ReactNode
  /**
   * After its name, in the rail, its tab and its headings: the app's, e.g.
   * how much of the provider's quota is used. Part of the heading's name.
   */
  labelEnd?: React.ReactNode
  /**
   * Over its models, while they are shown: its tab's pane, or under its
   * heading in a list of all; not in a search's results. The app's,
   * e.g. its provider's plan and usage.
   */
  header?: React.ReactNode
  models: ModelOption[]
}

/**
 * A page of further groups, opened by a row under the list (its label,
 * a chevron), with a back header: e.g. another machine's models. Its
 * models are picked as the list's are.
 */
type ModelPickerPage = {
  id: string
  label: string
  icon?: React.ReactNode
  /** At the row's end, faint: "12 models". */
  detail?: string
  groups: ModelGroup[]
  /**
   * Its groups are still coming, e.g. fetched as it opens
   * (`onPageChange`): `labels.loading` with a spinner on it, and no "No
   * models found".
   */
  loading?: boolean
}

/**
 * Where a model id was typed (`onCustomModel`): the group whose pane the
 * field was under, none from a list of all, the recent ones or a search
 * across groups; and the page, none for the main one.
 */
type ModelCustomPlace = {
  group?: string | undefined
  page?: string | undefined
}

/** A setting of a purpose's model for this conversation: "Aspect". */
type ModelSetting = {
  id: string
  label: string
  value: string
  options: {
    value: string
    label: string
    /** After its label in the list, faint, e.g. "Default"; not in the row. */
    hint?: string
  }[]
}

/**
 * What the agent uses a model for besides the conversation, each with its
 * own default: making images, video, speech.
 */
type ModelPurpose = {
  id: string
  label: string
  icon?: React.ReactNode
  /** The model it uses, by id. */
  value: string | null
  models: ModelOption[]
  settings?: ModelSetting[]
  /** A line under it, e.g. what it costs: "About $0.06 an image." */
  note?: string
  /**
   * With no models for it, under `labels.purposeEmpty`: the app's next
   * step, e.g. a button to add a provider that has some.
   */
  empty?: React.ReactNode
}

type ModelPickerLabels = {
  /** The popover's name. */
  title: string
  /** The trigger's name: "Model: Opus 5.5 · High". */
  trigger: (shown: string) => string
  /** The trigger with no model to use, or one that cannot be used now. */
  unavailable: string
  search: string
  /** At the search's end while typing: "3 of 49". */
  count: (shown: number, total: number) => string
  /** Under a group's list cut short (`groupLimit`). */
  more: (count: number) => string
  empty: string
  recent: string
  groups: string
  effort: string
  /** The model's default step, as the slider says it: "Medium, the default". */
  effortDefault: (label: string) => string
  /** A line under the thinking slider; none by default. */
  effortNote: string | null
  /** The step chosen for the conversation is not one the model has. */
  effortMissing: (label: string) => string
  /** The button that puts the thinking back to the model's default. */
  effortReset: (label: string) => string
  purposes: string
  purposesSet: (count: number) => string
  /** A purpose's row with no model set. */
  purposeNotSet: string
  /** A purpose's page with no models for it. */
  purposeEmpty: string
  /** Under the purposes: what they are. */
  purposesNote: string | null
  conversation: string
  back: string
  manage: string
  /** The row while `loading`: "Refreshing models…". */
  loading: string
  /** The row that takes a model id typed by hand: "Use “my-model”". */
  custom: (id: string) => string
  /** The field at the list's bottom for a model id (`customInput`). */
  customInput: string
  /** Closes the sheet it is in on a phone. */
  done: string
  /** The trigger's model that cannot be used now: "Opus 4, not available". */
  unavailableValue: (name: string) => string
  /** Over the list, the chosen model gone from it or not usable now. */
  valueGone: (name: string) => string
  /** The list with no models at all (not a search's). */
  none: string
  /** The models could not be fetched (`error`): its Retry. */
  retry: string
  /** The button that keeps the chosen model (`onPinnedChange`). */
  pin: string
  /** The button that lets it follow its default again. */
  unpin: string
  /** While pinning or unpinning is saved. */
  saving: string
  /** Pinning or unpinning failed. */
  saveFailed: string
}

const defaultLabels: ModelPickerLabels = {
  title: "Model",
  trigger: (shown) => `Model: ${shown}`,
  unavailable: "Pick a model",
  search: "Search models",
  count: (shown, total) =>
    `${shown.toLocaleString()} of ${total.toLocaleString()}`,
  more: (count) => `${count.toLocaleString()} more · type to search`,
  empty: "No models found",
  recent: "Recent",
  groups: "Model groups",
  effort: "Thinking",
  effortDefault: (label) => `${label}, the default`,
  effortNote: null,
  effortMissing: (label) =>
    `You picked ${label} for this conversation; this model doesn't have it, so it runs at its default.`,
  effortReset: (label) => `Back to the default, ${label}`,
  purposes: "Images, video and speech",
  purposesSet: (count) => `${count} set`,
  purposeNotSet: "Not set",
  purposeEmpty: "No models for this yet.",
  purposesNote:
    "What the agent uses when it makes an image, a video or audio. Set for every conversation.",
  conversation: "This conversation",
  back: "Back",
  manage: "Manage models",
  loading: "Refreshing models…",
  custom: (id) => `Use “${id}”`,
  customInput: "Another model's id",
  done: "Done",
  unavailableValue: (name) => `${name}, not available`,
  valueGone: (name) =>
    `${name} is not available now. It stays chosen until you pick another.`,
  none: "No models yet",
  retry: "Retry",
  pin: "Pin",
  unpin: "Unpin",
  saving: "Saving…",
  saveFailed: "Couldn't save",
}

/** A group's own header, over its models, where it is shown. */
function GroupHeader({
  group,
  ref,
}: {
  group: ModelGroup
  ref?: React.Ref<HTMLDivElement>
}) {
  if (group.header === undefined || group.header === null) return null
  return (
    <div ref={ref} data-slot="model-picker-group-header" className="px-2 pb-1">
      {group.header}
    </div>
  )
}

/** A group's heading: its full name, and the app's after it. */
const headingOf = (group: ModelGroup) =>
  group.labelEnd === undefined || group.labelEnd === null ? (
    fullName(group)
  ) : (
    <span className="flex min-w-0 items-center gap-1">
      <span className="min-w-0 truncate">{fullName(group)}</span>
      {group.labelEnd}
    </span>
  )

/** A group's name with its section's, where it has one: "Local · Claude". */
const fullName = (group: Pick<ModelGroup, "label" | "section">) =>
  group.section === undefined
    ? group.label
    : `${group.section} · ${group.label}`

/** A model's tag after its name: a hairline, small and grey. */
const modelBadge =
  "shrink-0 rounded-sm px-1 text-2xs leading-4 font-normal text-subtle-foreground ring-1 ring-border ring-inset"

/** A heading over a run of rows: "Recent", "This conversation". */
const sectionHeading =
  "flex h-6 items-center px-2 text-2xs font-medium text-subtle-foreground"

/** A line of grey words under rows: what they are, what it costs. */
// At the rows' words' start, 16px in.
const sectionNote = "px-4 pt-1 pb-3 text-xs text-subtle-foreground"

function ModelLabel({
  model,
  query = "",
}: {
  model: ModelOption
  query?: string
}) {
  const at = query ? model.label.toLowerCase().indexOf(query) : -1
  return (
    <span className="flex min-w-0 items-center gap-1">
      <span className="truncate">
        {at < 0 ? (
          model.label
        ) : (
          <>
            {model.label.slice(0, at)}
            <span className="font-semibold">
              {model.label.slice(at, at + query.length)}
            </span>
            {model.label.slice(at + query.length)}
          </>
        )}
      </span>
      {model.badge && <span className={modelBadge}>{model.badge}</span>}
    </span>
  )
}

/**
 * The picker's search as the design has it: a flush row over the list,
 * a hairline under it, no field, 13px; group names small and faint, 24px,
 * a group's heading right under the last row of the one before; rows
 * 13px, the chosen model's name a step bolder.
 */
const searchLook =
  "rounded-none! bg-transparent [&_[data-slot=command-input-wrapper]]:border-b [&_[data-slot=command-input-wrapper]]:p-0 [&_[data-slot=command-input-wrapper]>[data-slot=input-group]]:border-transparent [&_[data-slot=command-input-wrapper]>[data-slot=input-group]]:bg-transparent [&_[data-slot=command-input-wrapper]>[data-slot=input-group]]:ps-2 dark:[&_[data-slot=command-input-wrapper]>[data-slot=input-group]]:bg-transparent [&_[data-slot=command-input]]:text-2sm [&_[data-slot=command-list]]:py-1 [&_[data-slot=command-group]]:py-0 [&_[data-slot=command-group]_[cmdk-group-heading]]:py-1 [&_[data-slot=command-group]_[cmdk-group-heading]]:text-2xs **:data-[slot=command-item]:text-2sm **:data-[slot=command-item]:data-[checked=true]:font-medium"

// The rest of a row after its name, details at its end: the name is never
// cut for them, they are cut first. A model's (`reveal`) shows on the row
// highlighted, by the pointer or the keys, a row being its name and tick;
// still in its name, for a screen reader.
function Detail({
  reveal = false,
  children,
}: {
  reveal?: boolean
  children?: React.ReactNode
}) {
  return (
    <span
      data-slot="model-picker-detail"
      className={cn(
        "min-w-0 flex-1 truncate ps-2 text-end text-xs font-normal text-subtle-foreground tabular-nums group-data-[selected=true]/command-item:text-muted-foreground",
        reveal &&
          "opacity-0 group-data-[selected=true]/command-item:opacity-100"
      )}
    >
      {children}
    </span>
  )
}

/** A model row shared by the main list and a group's list. */
function ModelItem({
  model,
  group,
  value,
  query = "",
  onSelect,
}: {
  model: ModelOption
  group: ModelGroup
  value: string | null
  query?: string
  onSelect: (id: string) => void
}) {
  // Its route is the group's own: said by where it is.
  const { badge, ...rest } = model
  return (
    <CommandItem
      value={`model:${model.id}`}
      disabled={(model.disabled ?? false) || model.disabledReason !== undefined}
      data-checked={model.id === value}
      onSelect={() => onSelect(model.id)}
      // 44px under a finger, as a suggestion's row.
      className="pointer-coarse:min-h-11"
    >
      <ModelLabel model={badge === group.label ? rest : model} query={query} />
      {model.disabledReason !== undefined ? (
        <Detail>{model.disabledReason}</Detail>
      ) : (
        <Detail reveal>{model.detail}</Detail>
      )}
    </CommandItem>
  )
}

/**
 * A group's models in runs of their `section`: those with none first,
 * then each section's, in the order it first comes.
 */
function sectionsOf(models: ModelOption[]) {
  const runs = new Map<string | undefined, ModelOption[]>([[undefined, []]])
  for (const model of models) {
    const run = runs.get(model.section)
    if (run) run.push(model)
    else runs.set(model.section, [model])
  }
  return [...runs].map(([section, models]) => ({ section, models }))
}

/**
 * A group's models as listed: under its heading (if any) its header and
 * those with no section, then each section's under its name.
 */
function GroupModels({
  group,
  models,
  heading,
  header,
  value,
  onSelect,
}: {
  group: ModelGroup
  models: ModelOption[]
  heading?: React.ReactNode
  header?: React.ReactNode
  value: string | null
  onSelect: (id: string) => void
}) {
  const [first, ...rest] = sectionsOf(models)
  const item = (model: ModelOption) => (
    <ModelItem
      key={model.id}
      model={model}
      group={group}
      value={value}
      onSelect={onSelect}
    />
  )
  return (
    <>
      {(heading !== undefined ||
        header !== undefined ||
        first!.models.length > 0) && (
        <CommandGroup heading={heading}>
          {header}
          {first!.models.map(item)}
        </CommandGroup>
      )}
      {rest.map((run) => (
        <CommandGroup key={run.section} heading={run.section}>
          {run.models.map(item)}
        </CommandGroup>
      ))}
    </>
  )
}

/** Under a list cut short at `groupLimit`: how many more there are. */
function MoreModels({
  count,
  labels,
}: {
  count: number
  labels: ModelPickerLabels
}) {
  return count > 0 ? (
    <p
      data-slot="model-picker-more"
      className="px-3 pt-1 pb-2 text-xs text-subtle-foreground"
    >
      {labels.more(count)}
    </p>
  ) : null
}

/** At a search's end: its key, or how many match while typing. */
function SearchEnd({ children }: { children?: React.ReactNode }) {
  if (children === undefined || children === null || children === "")
    return null
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute end-3 top-3 z-10 text-2xs leading-4 text-subtle-foreground tabular-nums"
    >
      {children}
    </span>
  )
}

/**
 * The thinking slider's look, as the design draws it: a 4px track with a
 * hairline, filled in grey to the thumb; a 16px white thumb that floats
 * over the step's dots.
 */
const effortSliderLook =
  "[&_[data-slot=slider-range]]:bg-muted-foreground [&_[data-slot=slider-thumb]]:z-10 [&_[data-slot=slider-thumb]]:size-4 [&_[data-slot=slider-thumb]]:border-0 [&_[data-slot=slider-thumb]]:shadow-float [&_[data-slot=slider-track]]:bg-muted [&_[data-slot=slider-track]]:ring-1 [&_[data-slot=slider-track]]:ring-border [&_[data-slot=slider-track]]:ring-inset"

/**
 * How hard a model thinks: a slider of named steps, a dot on the track
 * and a name under each, the model's default step circled in a dashed
 * line; the step chosen at the end of its heading. A model that only
 * turns thinking on or off (`toggle`) has a switch instead. A line under
 * it can say what it sets (`note`) or what went wrong (`warning`).
 */
function EffortSlider({
  efforts,
  value,
  defaultValue,
  onValueChange,
  label = "Thinking",
  toggle = false,
  note,
  warning,
  formatDefault = defaultLabels.effortDefault,
  formatReset = defaultLabels.effortReset,
  className,
}: {
  efforts: ModelEffort[]
  value: string
  /** The step the model uses unless one is chosen: circled. */
  defaultValue?: string | undefined
  onValueChange: (value: string) => void
  label?: string
  /**
   * Thinking only turns on or off: a switch, off at the first of
   * `efforts` and on at the second.
   */
  toggle?: boolean
  /** A line under it, in grey: what it sets. */
  note?: React.ReactNode
  /** A line under it after a warning sign, e.g. a step it does not have. */
  warning?: React.ReactNode
  /** The default step as the slider says it: "Medium, the default". */
  formatDefault?: (label: string) => string
  /** The button back to the default: "Back to the default, Medium". */
  formatReset?: (label: string) => string
  className?: string
}) {
  const id = React.useId()
  const index = Math.max(
    0,
    efforts.findIndex((effort) => effort.value === value)
  )
  const last = efforts.length - 1
  // The dots sit where the thumb's center does: half its 16px in from
  // each end (thumbAlignment="edge").
  const at = (step: number) =>
    `calc(8px + (100% - 16px) * ${last ? step / last : 0})`

  const heading = (end: React.ReactNode) => (
    <div className="flex h-7 items-center gap-2">
      <span id={id} className="text-2sm font-medium text-foreground">
        {label}
      </span>
      {end}
    </div>
  )
  const lines =
    note || warning ? (
      <div className="grid gap-1 pt-1 text-xs text-subtle-foreground">
        {warning ? (
          <p
            data-slot="effort-slider-warning"
            className="flex items-start gap-1 [&>svg]:mt-0.5 [&>svg]:size-3.5 [&>svg]:shrink-0"
          >
            <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} aria-hidden />
            <span>{warning}</span>
          </p>
        ) : null}
        {note ? <p data-slot="effort-slider-note">{note}</p> : null}
      </div>
    ) : null

  if (toggle) {
    const on = efforts[1]
    return (
      <div
        data-slot="effort-slider"
        data-variant="toggle"
        className={cn("grid", className)}
      >
        {heading(
          <Switch
            aria-labelledby={id}
            className="ms-auto"
            checked={on !== undefined && value === on.value}
            onCheckedChange={(checked) => {
              const next = efforts[checked ? 1 : 0]
              if (next && next.value !== value) onValueChange(next.value)
            }}
          />
        )}
        {lines}
      </div>
    )
  }

  // One row, as tall as the picker's others: its name, the slider with
  // a dot at each step, the step chosen, and, off the model's default, a
  // button back to it.
  const fallback = efforts.find((effort) => effort.value === defaultValue)
  return (
    <div data-slot="effort-slider" className={cn("grid", className)}>
      <div className="flex h-8 items-center gap-3">
        <span id={id} className="shrink-0 text-2sm font-medium text-foreground">
          {label}
        </span>
        <div className="relative min-w-0 flex-1">
          <Slider
            className={effortSliderLook}
            aria-labelledby={id}
            min={0}
            max={last}
            step={1}
            value={[index]}
            onValueChange={(next) => {
              const step = Array.isArray(next) ? next[0] : next
              const effort = efforts[step ?? 0]
              if (effort && effort.value !== value) onValueChange(effort.value)
            }}
            getAriaValueText={(_formatted, step) => {
              const effort = efforts[step]
              if (!effort) return ""
              return effort.value === defaultValue
                ? formatDefault(effort.label)
                : effort.label
            }}
          />
          {efforts.map((effort, step) => (
            <span
              key={effort.value}
              aria-hidden
              data-slot="effort-slider-step"
              data-default={effort.value === defaultValue ? "" : undefined}
              className={cn(
                // grid: mark (a status dot)
                "pointer-events-none absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full",
                step <= index
                  ? "bg-muted-foreground"
                  : "bg-popover ring-1 ring-subtle-foreground ring-inset"
              )}
              style={{ left: at(step) }}
            />
          ))}
        </div>
        <span
          data-slot="effort-slider-value"
          className="min-w-12 shrink-0 text-end text-xs text-subtle-foreground"
        >
          {efforts[index]?.label}
        </span>
        {/* Its place kept: the slider does not move as it comes. */}
        <span className="-me-1 flex size-6 shrink-0 items-center justify-center">
          {fallback && fallback.value !== value && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <InputGroupButton
                    size="icon-xs"
                    data-slot="effort-slider-reset"
                    aria-label={formatReset(fallback.label)}
                    onClick={() => onValueChange(fallback.value)}
                    className="text-subtle-foreground hover:text-foreground"
                  />
                }
              >
                <HugeiconsIcon icon={ArrowTurnBackwardIcon} strokeWidth={2} />
              </TooltipTrigger>
              <TooltipContent>{formatReset(fallback.label)}</TooltipContent>
            </Tooltip>
          )}
        </span>
      </div>
      {lines}
    </div>
  )
}

/** Moves focus among a list's rows with the arrow keys, Home and End. */
function moveFocus(event: React.KeyboardEvent<HTMLElement>) {
  const keys = ["ArrowDown", "ArrowUp", "Home", "End"]
  if (!keys.includes(event.key)) return
  const rows = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>("[data-row]")
  )
  const from = rows.indexOf(document.activeElement as HTMLElement)
  const to =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? rows.length - 1
        : Math.min(
            rows.length - 1,
            Math.max(0, from + (event.key === "ArrowDown" ? 1 : -1))
          )
  event.preventDefault()
  rows[to]?.focus()
}

/** A page's header: back, and where it is. */
function PageHeader({
  title,
  back,
  onBack,
}: {
  title: string
  back: string
  onBack: () => void
}) {
  return (
    <div className="flex h-8 items-center gap-1 border-b px-1">
      <InputGroupButton
        size="icon-xs"
        aria-label={back}
        onClick={onBack}
        className="text-muted-foreground"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
      </InputGroupButton>
      <span className="truncate text-2sm font-medium">{title}</span>
    </div>
  )
}

type Page =
  | { kind: "main" }
  | { kind: "purposes" }
  | { kind: "purpose"; id: string }
  | { kind: "groups"; id: string }

/**
 * Picks a conversation's model and how hard it thinks, from a trigger in
 * a composer's toolbar. With several groups, a rail of them (recent
 * models first) beside the list shows one group's models at a time, a
 * row of tabs above it on a phone; a single group's models are listed
 * directly under its name, recent ones first only while its list is cut
 * short (`groupLimit`). Typing searches them all. The thinking steps
 * follow the model, a slider (←→ from the list with one group) or, for a
 * model that only turns it on or off, a switch. A last row turns the
 * popover to the models the agent uses for images, video and speech,
 * each with its own page; rows of the app's (`pages`) to pages of further
 * groups. Models, groups, steps and purposes are the app's data.
 */
function ModelPicker({
  groups: mainGroups,
  pages = [],
  recent = [],
  value,
  onValueChange,
  effort,
  onEffortChange,
  purposes = [],
  onPurposeChange,
  onPurposeSettingChange,
  onManage,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  onCustomModel,
  onPageChange,
  customInput = false,
  showEffort = true,
  showGroupIcon = false,
  groupLimit,
  searchFrom = 10,
  loading = false,
  error,
  onRetry,
  valueLabel,
  source,
  pinned,
  onPinnedChange,
  shortcut,
  triggerEnd,
  header,
  labels: labelsProp,
  className,
  children,
}: {
  /**
   * A single group lists its models directly under its name, with no
   * recent models unless `groupLimit` cuts it short.
   */
  groups: ModelGroup[]
  /**
   * Further groups, each page's under a row of its own under the list,
   * opened with a back header (Escape goes back too): e.g. another
   * machine's models.
   */
  pages?: ModelPickerPage[]
  /** Ids of the models used lately, most recent first. */
  recent?: string[]
  /**
   * The conversation's model, by id; null for none yet. None, or a
   * disabled one, the trigger asks to pick a model.
   */
  value: string | null
  onValueChange: (id: string) => void
  /**
   * The conversation's thinking step; the model's default when unset. One
   * the model does not have runs at its default, and the slider says so.
   */
  effort?: string | null
  onEffortChange?: (effort: string) => void
  purposes?: ModelPurpose[]
  onPurposeChange?: (purpose: string, model: string) => void
  onPurposeSettingChange?: (
    purpose: string,
    setting: string,
    value: string
  ) => void
  /** Opens the app's own place to manage models. */
  onManage?: () => void
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /**
   * Takes a model id typed into the search that matches none of the list:
   * a row offers to use it as it is.
   */
  onCustomModel?: (id: string, place: ModelCustomPlace) => void
  /**
   * A page of `pages` opened, by its id, or left (null), also as the
   * picker closes on one: e.g. to fetch its groups then.
   */
  onPageChange?: (page: string | null) => void
  /**
   * A field kept at the bottom of the list for a model id that is not in
   * it (`labels.customInput`), Enter or its button giving it to
   * `onCustomModel`; with that only.
   */
  customInput?: boolean
  /** The key that opens it, the app's to bind: shown on the search, "⌘M". */
  shortcut?: string
  /** Whether the trigger says the effort; not where a toolbar folds. */
  showEffort?: boolean
  /**
   * Whether the trigger shows the chosen model's group's `icon` before
   * its name, where groups look alike (a provider's models once per
   * agent): the first group with it, if that has an icon.
   */
  showGroupIcon?: boolean
  /**
   * How many of a group's models its list shows, then how many more
   * there are; typing searches them all. All of them by default.
   */
  groupLimit?: number
  /**
   * From how many models it has a search and, with several groups, a
   * rail of them; with as many or fewer, they are one list, under their
   * groups' names (not with `onCustomModel`, which is typed). 10 by
   * default; 0 always searches.
   */
  searchFrom?: number
  /**
   * The app is fetching its models: a row under the list says so
   * (`labels.loading`), with a spinner, while it shows what it has.
   */
  loading?: boolean
  /**
   * Why the models could not be fetched: a row under the list says so,
   * with a Retry (`onRetry`); what it has stays listed.
   */
  error?: React.ReactNode
  onRetry?: () => void
  /**
   * The chosen model's name where it is not in the list (gone, or not
   * fetched): shown, marked not available, and kept until the reader
   * picks another; never replaced on its own.
   */
  valueLabel?: string
  /**
   * Where the chosen model comes from, in the app's words, under the
   * list: "The project's default", "Pinned to this conversation".
   */
  source?: React.ReactNode
  /** Whether the chosen model is kept, not following its default. */
  pinned?: boolean
  /**
   * Pins or unpins it: a button by `source`. A promise says saving
   * (`labels.saving`) until it settles; a rejection, that it failed,
   * the button there to try again.
   */
  onPinnedChange?: (pinned: boolean) => void | Promise<unknown>
  /**
   * At the end of its button, after the model's name: the app's, e.g. a
   * ring of the provider's quota. Not in the button's name, its label
   * (`labels.trigger`) is: say there what it shows.
   */
  triggerEnd?: React.ReactNode
  /** At the top of its menu, over its search and list: the app's. */
  header?: React.ReactNode
  labels?: Partial<ModelPickerLabels>
  className?: string
  /**
   * The app's own content under the list, e.g. a row that manages its
   * endpoints (`composerSelectRow` gives it the list's look).
   */
  children?: React.ReactNode
}) {
  const labels = { ...defaultLabels, ...labelsProp }
  const mobile = useIsMobile()
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
  const open = openProp ?? uncontrolledOpen
  const [page, setPage] = React.useState<Page>({ kind: "main" })
  const [railChoice, setRailChoice] = React.useState<string | null>(null)
  const [query, setQuery] = React.useState("")
  // The id typed into `customInput`'s field.
  const [typed, setTyped] = React.useState("")
  // What the arrow keys did to the thinking step, said to a screen reader.
  const [said, setSaid] = React.useState("")
  const search = React.useRef<HTMLInputElement>(null)
  const rail = React.useRef<HTMLDivElement>(null)
  const railId = React.useId()
  const pageRef = React.useRef<HTMLDivElement>(null)
  // Turned to since it opened: a page fades in as it comes.
  const [turned, setTurned] = React.useState(false)

  // The groups shown: the main page's, or a further page's.
  const subPage =
    page.kind === "groups"
      ? pages.find((item) => item.id === page.id)
      : undefined
  const groups = subPage?.groups ?? mainGroups
  // Refreshing, or a page's groups still coming.
  const busy = loading || subPage?.loading === true
  const single = groups.length === 1 ? groups[0] : undefined
  const singleModels =
    single?.models.slice(
      0,
      groupLimit === undefined ? undefined : Math.max(0, groupLimit)
    ) ?? []
  const all = groups.flatMap((group) =>
    group.models.map((model) => ({ model, group }))
  )
  // Every model, of every page: the chosen one may be on another.
  const allGroups = [...mainGroups, ...pages.flatMap((item) => item.groups)]
  const everything = allGroups.flatMap((group) =>
    group.models.map((model) => ({ model, group }))
  )
  const byId = new Map(everything.map((entry) => [entry.model.id, entry]))
  const here = new Set(all.map((entry) => entry.model.id))
  // Few: one list to look down, nothing to search.
  const flat = all.length <= searchFrom && !onCustomModel
  // The popup's width and first focus: its main page's.
  const mainSingle = mainGroups.length === 1
  const mainFlat =
    mainGroups.reduce((count, group) => count + group.models.length, 0) <=
      searchFrom && !onCustomModel
  const list = React.useRef<HTMLDivElement>(null)
  const selected = value === null ? undefined : byId.get(value)?.model
  // The chosen model's group's mark, for the trigger: the first with it.
  const selectedIcon =
    showGroupIcon && value !== null
      ? allGroups.find((group) =>
          group.models.some((model) => model.id === value)
        )?.icon
      : undefined
  // The chosen model gone from the list, or not usable now: kept, said.
  const gone =
    value !== null &&
    (selected === undefined
      ? !loading
      : selected.disabled === true || selected.disabledReason !== undefined)
  const goneName = valueLabel ?? selected?.label ?? value ?? ""
  const unavailable = value === null || gone
  const [pinSave, setPinSave] = React.useState<"saving" | "failed" | null>(null)
  const pin = (next: boolean) => {
    const result = onPinnedChange?.(next)
    if (!(result instanceof Promise)) return
    setPinSave("saving")
    result.then(
      () => setPinSave(null),
      () => setPinSave("failed")
    )
  }
  // A model's thinking: its steps, the conversation's step or else its
  // default, and a step chosen for the conversation that it does not
  // have, by its name in any model that has it.
  const thinkingOf = (model: ModelOption | undefined) => {
    const steps = model?.efforts ?? []
    const chosen = steps.find((step) => step.value === effort)
    const current =
      chosen ??
      steps.find((step) => step.value === model?.defaultEffort) ??
      steps[0]
    const missing =
      effort && steps.length > 0 && !chosen
        ? (everything
            .flatMap((entry) => entry.model.efforts ?? [])
            .find((step) => step.value === effort)?.label ?? effort)
        : null
    return { steps, current, missing }
  }
  const currentEffort = thinkingOf(selected).current
  // The slider shows the thinking of the model the keyboard or the search
  // is on, to see what it has before choosing it; else the chosen one's.
  // A pointer passing over the rows does not change it.
  const [highlight, setHighlight] = React.useState("")
  const [browsed, setBrowsed] = React.useState<string | null>(null)
  const browsing = React.useRef(false)
  const sliderModel =
    (browsed === null ? undefined : byId.get(browsed)?.model) ?? selected
  const slider = thinkingOf(sliderModel)
  const efforts = slider.steps
  const thinking =
    efforts.length > 0 && slider.current !== undefined && !!onEffortChange
  const shown =
    value === null
      ? labels.unavailable
      : gone
        ? labels.unavailableValue(goneName)
        : [
            // Its route's tag, which the trigger shows, in its name too.
            [selected?.label ?? valueLabel ?? value, selected?.badge]
              .filter(Boolean)
              .join(" "),
            currentEffort?.label,
          ]
            .filter(Boolean)
            .join(" · ")

  const needle = query.trim().toLowerCase()
  const matches = needle
    ? all.filter(({ model, group }) =>
        `${model.label} ${model.badge ?? ""} ${single ? "" : `${group.section ?? ""} ${group.label}`}`
          .toLowerCase()
          .includes(needle)
      )
    : []
  // With one group, recent models only while its list is cut short:
  // otherwise every one of them is right under them.
  const recentModels =
    single && singleModels.length === single.models.length
      ? []
      : recent.flatMap((id) => {
          const entry = here.has(id) ? byId.get(id) : undefined
          return entry ? [entry.model] : []
        })

  // The rail's entries, keyed apart from the app's group ids: a group
  // may be called "recent" too.
  const entries: (ModelGroup & { key: string; recent?: boolean })[] = [
    ...(recentModels.length
      ? [
          {
            key: "recent",
            recent: true,
            id: "recent",
            label: labels.recent,
            icon: <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} />,
            models: recentModels,
          },
        ]
      : []),
    ...groups.map((group) => ({ ...group, key: `group:${group.id}` })),
  ]
  const shownOf = (entry: (typeof entries)[number] | undefined) =>
    entry?.recent || groupLimit === undefined
      ? (entry?.models ?? [])
      : (entry?.models.slice(0, Math.max(0, groupLimit)) ?? [])
  const active =
    entries.find((entry) => entry.key === railChoice) ??
    entries.find(
      (entry) =>
        !entry.recent && entry.models.some((model) => model.id === value)
    ) ??
    entries[0]
  const paneModels = shownOf(active)
  // The shown group's header, measured: its height is the app's.
  const [headerHeight, setHeaderHeight] = React.useState(0)
  const measureHeader = React.useCallback((node: HTMLDivElement | null) => {
    if (!node) return
    const measure = () => setHeaderHeight(node.offsetHeight)
    measure()
    const sizes = new ResizeObserver(measure)
    sizes.observe(node)
    return () => {
      sizes.disconnect()
      setHeaderHeight(0)
    }
  }, [])
  // The panes are as tall as the taller of the rail and the shown
  // group's list with its header, up to 80 spacing units (320px), the
  // rest scrolled to: no room kept for a longer group's. The rail: 32px
  // rows in 4px of padding, and 28px for each section's heading; a list:
  // 32px rows in 4px, 28px for how many more and 41px for a custom id's
  // field (40 and its hairline).
  const sectionHeadings = entries.filter(
    (entry, index) =>
      entry.section !== undefined &&
      entry.section !== entries[index - 1]?.section
  ).length
  const railUnits = 2 + 8 * entries.length + 7 * sectionHeadings
  const paneSections = active?.recent
    ? 0
    : sectionsOf(paneModels).filter((run) => run.section !== undefined).length
  const listUnits =
    2 +
    8 * Math.max(1, paneModels.length) +
    7 * paneSections +
    (customInput && !single ? 10 : 0) +
    ((active?.models.length ?? 0) > paneModels.length ? 7 : 0)
  const paneHeight = `min(calc(var(--spacing) * 80), max(calc(var(--spacing) * ${railUnits}), calc(var(--spacing) * ${listUnits} + ${headerHeight + (customInput && !single ? 1 : 0)}px)))`
  const panelId = `${railId}-panel`
  const tabId = (key: string) => `${railId}-tab-${key}`
  // Its content changes at once, and over its trigger its bottom stays:
  // the positioner places it a frame later, and its top would hold for
  // that frame instead.
  const keepBottom = (change: () => void) => {
    const positioner = pageRef.current?.closest<HTMLElement>(
      "[role=presentation][data-side=top]"
    )
    const bottom = positioner?.getBoundingClientRect().bottom
    flushSync(change)
    if (positioner && bottom !== undefined) {
      const by = bottom - positioner.getBoundingClientRect().bottom
      const at = new DOMMatrix(getComputedStyle(positioner).transform)
      if (by)
        positioner.style.transform = `translate(${at.e}px, ${at.f + by}px)`
    }
  }

  const activate = (key: string) => {
    const entry = entries.find((entry) => entry.key === key)
    const models = shownOf(entry)
    const model =
      models.find((model) => model.id === value && !model.disabled) ??
      models.find((model) => !model.disabled)
    // Another group's list, its height its own: the popup keeps its
    // bottom as it grows or shrinks.
    keepBottom(() => {
      setRailChoice(key)
      setQuery("")
      setHighlight(
        model ? `${entry?.recent ? "recent" : "model"}:${model.id}` : ""
      )
      setBrowsed(model?.id ?? null)
    })
  }

  const setOpen = (next: boolean) => {
    if (openProp === undefined) setUncontrolledOpen(next)
    onOpenChange?.(next)
    // One list: it opens on the chosen model.
    if (next && flat && value !== null) setHighlight(`model:${value}`)
    if (!next) {
      if (page.kind === "groups") onPageChange?.(null)
      setPage({ kind: "main" })
      setTurned(false)
      setRailChoice(null)
      setQuery("")
      setSaid("")
      setHighlight("")
      setBrowsed(null)
      setTyped("")
      browsing.current = false
    }
  }

  // A page turns at once and focus goes into it, its search or first
  // row: left on a row of the page that went, it would go to the popup.
  const go = (next: Page) => {
    keepBottom(() => {
      // Into or out of a page of groups: its own rail and search.
      if (next.kind === "groups" || page.kind === "groups") {
        setRailChoice(null)
        setQuery("")
        setHighlight("")
        setBrowsed(null)
      }
      setPage(next)
      setTurned(true)
    })
    if (next.kind === "groups") onPageChange?.(next.id)
    else if (page.kind === "groups") onPageChange?.(null)
    const root = pageRef.current
    const target =
      root?.querySelector<HTMLElement>(
        "[data-row][tabindex='0'], [data-slot=composer-select-item][tabindex='0']"
      ) ??
      root?.querySelector<HTMLElement>("[cmdk-input], [cmdk-list][tabindex]") ??
      root?.querySelector<HTMLElement>("[data-row]")
    target?.focus()
  }

  const back = () => {
    if (page.kind === "purpose") go({ kind: "purposes" })
    else go({ kind: "main" })
  }

  const choose = (id: string) => {
    onValueChange(id)
    setOpen(false)
  }

  // ←→ from the list: a step less or more thinking, or off and on.
  const stepEffort = (by: 1 | -1) => {
    const current = slider.current
    if (!thinking || !current) return
    const at = efforts.indexOf(current)
    const next = sliderModel?.effortToggle
      ? efforts[by > 0 ? 1 : 0]
      : efforts[Math.min(efforts.length - 1, Math.max(0, at + by))]
    if (!next || next === current) return
    onEffortChange?.(next.value)
    setSaid(`${labels.effort}: ${next.label}`)
  }

  // Where an id was typed: the pane's group (one group's, or the rail's
  // or the tabs' shown one, not the recent ones), none in a search across
  // groups.
  const customPlace = (searching: boolean): ModelCustomPlace => {
    const group =
      single?.id ?? (searching || active?.recent ? undefined : active?.id)
    return {
      ...(group === undefined ? {} : { group }),
      ...(subPage ? { page: subPage.id } : {}),
    }
  }

  // `customInput`'s field: its keys its own, not the list's (Enter would
  // choose the highlighted model); Escape still closes.
  const submitTyped = () => {
    const id = typed.trim()
    if (!id || !onCustomModel) return
    onCustomModel(id, customPlace(false))
    setOpen(false)
  }
  const customField = customInput && onCustomModel && (
    <form
      data-slot="model-picker-custom-input"
      className={cn(
        "border-t bg-popover p-1",
        // Kept in view at the pane's bottom as its list scrolls.
        !single && !mobile && "sticky bottom-0"
      )}
      onSubmit={(event) => {
        event.preventDefault()
        submitTyped()
      }}
    >
      <InputGroup>
        <InputGroupInput
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder={labels.customInput}
          aria-label={labels.customInput}
          autoComplete="off"
          spellCheck={false}
          className="md:text-2sm"
          onKeyDown={(event) => {
            if (event.key !== "Escape") event.stopPropagation()
          }}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            type="submit"
            size="icon-xs"
            aria-label={labels.custom(typed.trim())}
            disabled={!typed.trim()}
          >
            <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  )

  const purpose =
    page.kind === "purpose"
      ? purposes.find((item) => item.id === page.id)
      : undefined
  const setCount = purposes.filter((item) => item.value !== null).length

  const onPopupOpenChange = (next: boolean, reason: string) => {
    // Escape goes back a page first.
    if (!next && reason === "escape-key" && page.kind !== "main") {
      back()
      return
    }
    setOpen(next)
  }

  const body = (
    <>
      {/* Each page as high as its content, every one as wide: over its
          trigger, the popup keeps its bottom edge and the trigger's
          side, and only its top moves as its content turns. */}
      <div
        ref={pageRef}
        key={
          page.kind === "purpose" || page.kind === "groups"
            ? `${page.kind}-${page.id}`
            : page.kind
        }
        className={turned ? "animate-in motion-fade fade-in-0" : undefined}
      >
        {page.kind === "main" && header !== undefined && header !== null && (
          <div data-slot="model-picker-header" className="border-b">
            {header}
          </div>
        )}
        {page.kind === "main" && gone && (
          <p
            data-slot="model-picker-gone"
            // A line of the list's look, over it, its mark a warning's.
            className="mx-2 mt-1 flex items-start gap-2 px-2 py-1 text-2sm text-muted-foreground [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0"
          >
            <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
            {labels.valueGone(goneName)}
          </p>
        )}
        {subPage && (
          <PageHeader title={subPage.label} back={labels.back} onBack={back} />
        )}
        {(page.kind === "main" || subPage) && (
          <div className="relative">
            <SearchEnd>
              {flat ? null : needle ? (
                labels.count(matches.length, all.length)
              ) : shortcut && !mobile ? (
                <Kbd className="h-4 min-w-0 bg-transparent px-1 text-2xs text-subtle-foreground ring-1 ring-border ring-inset">
                  {shortcut}
                </Kbd>
              ) : null}
            </SearchEnd>
            <Command
              label={flat ? labels.title : labels.search}
              shouldFilter={false}
              className={searchLook}
              // Controlled, for cmdk to say when the highlight moves.
              value={highlight}
              onValueChange={(next) => {
                setHighlight(next)
                // A recent row's value differs from its row in a single
                // group's list, for cmdk to tell the two apart.
                const id = next.startsWith("model:")
                  ? next.slice("model:".length)
                  : next.startsWith("recent:")
                    ? next.slice("recent:".length)
                    : null
                setBrowsed(browsing.current ? id : null)
              }}
              onPointerMoveCapture={() => {
                browsing.current = false
              }}
              onKeyDown={(event) => {
                // The keys move the highlight, or type a search.
                browsing.current = true
                if (event.key !== "ArrowRight" && event.key !== "ArrowLeft")
                  return
                if (!single && !flat) {
                  const rtl =
                    getComputedStyle(event.currentTarget).direction === "rtl"
                  if (
                    !mobile &&
                    !query &&
                    event.target === search.current &&
                    event.key === (rtl ? "ArrowRight" : "ArrowLeft")
                  ) {
                    event.preventDefault()
                    rail.current
                      ?.querySelector<HTMLElement>('[tabindex="0"]')
                      ?.focus()
                  }
                  return
                }
                // Typed, the arrows move the caret.
                if (query || !thinking) return
                event.preventDefault()
                stepEffort(event.key === "ArrowRight" ? 1 : -1)
              }}
            >
              {flat && all.length === 0 && !busy && !error ? (
                // No models at all: no list, as cmdk's empty state.
                <p
                  data-slot="model-picker-none"
                  className="py-6 text-center text-sm"
                >
                  {labels.none}
                </p>
              ) : flat ? (
                // Focus on the list itself, its highlight its active
                // descendant; the keys move it, Enter chooses.
                <CommandList
                  ref={list}
                  tabIndex={0}
                  label={labels.title}
                  className="max-h-80 outline-none"
                >
                  {groups.map(
                    (group) =>
                      group.models.length > 0 && (
                        <GroupModels
                          key={group.id}
                          group={group}
                          models={group.models}
                          heading={single ? undefined : headingOf(group)}
                          header={<GroupHeader group={group} />}
                          value={value}
                          onSelect={choose}
                        />
                      )
                  )}
                </CommandList>
              ) : (
                <>
                  <CommandInput
                    ref={search}
                    value={query}
                    onValueChange={setQuery}
                    placeholder={labels.search}
                    aria-label={labels.search}
                  />
                  <div
                    data-slot={single ? undefined : "model-picker-panes"}
                    // No empty panes while a page's groups are coming.
                    hidden={(busy && all.length === 0) || undefined}
                    className={!single && !mobile ? "flex min-h-0" : undefined}
                    style={
                      !single && !mobile ? { height: paneHeight } : undefined
                    }
                  >
                    {!single &&
                      (mobile ? (
                        <Tabs
                          value={needle ? "" : active?.key}
                          onValueChange={(id) => {
                            if (typeof id === "string") activate(id)
                          }}
                        >
                          <div className="overflow-x-auto px-2 py-1">
                            <TabsList
                              aria-label={labels.groups}
                              className="w-max"
                            >
                              {entries.map((entry) => (
                                <TabsTrigger
                                  key={entry.key}
                                  value={entry.key}
                                  id={tabId(entry.key)}
                                  aria-controls={panelId}
                                >
                                  {entry.icon}
                                  {entry.section !== undefined && (
                                    <span className="text-subtle-foreground">
                                      {entry.section} ·
                                    </span>
                                  )}
                                  {entry.label}
                                  {entry.labelEnd}
                                </TabsTrigger>
                              ))}
                            </TabsList>
                          </div>
                        </Tabs>
                      ) : (
                        <div
                          ref={rail}
                          role="tablist"
                          aria-orientation="vertical"
                          aria-label={labels.groups}
                          className="min-h-0 w-36 shrink-0 overflow-y-auto overscroll-contain border-e p-1"
                          onKeyDown={(event) => {
                            const rtl =
                              getComputedStyle(event.currentTarget)
                                .direction === "rtl"
                            const at = entries.findIndex(
                              (entry) =>
                                tabId(entry.key) === document.activeElement?.id
                            )
                            const moves = [
                              "ArrowUp",
                              "ArrowDown",
                              "Home",
                              "End",
                            ]
                            if (moves.includes(event.key)) {
                              event.preventDefault()
                              event.stopPropagation()
                              // Automatic activation, clamped at either end.
                              const to =
                                event.key === "Home"
                                  ? 0
                                  : event.key === "End"
                                    ? entries.length - 1
                                    : Math.max(
                                        0,
                                        Math.min(
                                          entries.length - 1,
                                          at +
                                            (event.key === "ArrowDown" ? 1 : -1)
                                        )
                                      )
                              const entry = entries[to]
                              if (entry) {
                                activate(entry.key)
                                document
                                  .getElementById(tabId(entry.key))
                                  ?.focus()
                              }
                            } else if (
                              [
                                rtl ? "ArrowLeft" : "ArrowRight",
                                "Enter",
                                " ",
                              ].includes(event.key)
                            ) {
                              event.preventDefault()
                              event.stopPropagation()
                              search.current?.focus()
                            } else if (
                              event.key.length === 1 &&
                              !event.ctrlKey &&
                              !event.metaKey &&
                              !event.altKey
                            ) {
                              event.preventDefault()
                              event.stopPropagation()
                              setQuery((query) => query + event.key)
                              search.current?.focus()
                            }
                          }}
                        >
                          {entries.map((entry, index) => (
                            <React.Fragment key={entry.key}>
                              {entry.section !== undefined &&
                                entry.section !==
                                  entries[index - 1]?.section && (
                                  // Its section's name over its groups,
                                  // faint; said in each tab's name.
                                  <div
                                    aria-hidden="true"
                                    data-slot="model-picker-section"
                                    className="flex h-7 items-center gap-1 px-2 pt-3 text-xs text-subtle-foreground [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5"
                                    title={entry.section}
                                  >
                                    {entry.sectionIcon}
                                    <span className="min-w-0 truncate">
                                      {entry.section}
                                    </span>
                                  </div>
                                )}
                              <button
                                type="button"
                                role="tab"
                                {...(entry.section !== undefined
                                  ? { "aria-label": fullName(entry) }
                                  : {})}
                                id={tabId(entry.key)}
                                aria-controls={panelId}
                                aria-selected={
                                  !needle && active?.key === entry.key
                                }
                                tabIndex={active?.key === entry.key ? 0 : -1}
                                onClick={() => activate(entry.key)}
                                className={cn(
                                  composerSelectRow,
                                  "text-muted-foreground aria-selected:bg-muted aria-selected:font-medium aria-selected:text-foreground"
                                )}
                              >
                                {entry.icon}
                                <span
                                  className="min-w-0 flex-1 truncate"
                                  title={entry.label}
                                >
                                  {entry.label}
                                </span>
                                {entry.labelEnd}
                              </button>
                            </React.Fragment>
                          ))}
                        </div>
                      ))}
                    <div
                      className={
                        !single
                          ? "min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain"
                          : undefined
                      }
                      {...(!single
                        ? {
                            role: "tabpanel",
                            id: panelId,
                            "aria-labelledby": needle
                              ? undefined
                              : active && tabId(active.key),
                            "aria-label": needle ? labels.search : undefined,
                          }
                        : {})}
                    >
                      <CommandList
                        // Named, not cmdk's "Suggestions".
                        label={labels.title}
                        className={
                          !single && !mobile ? "max-h-none" : "max-h-80"
                        }
                      >
                        {!busy && !error && (
                          <CommandEmpty>
                            {all.length === 0 ? labels.none : labels.empty}
                          </CommandEmpty>
                        )}
                        {needle ? (
                          <>
                            {groups.map((group) => {
                              const found = matches.filter(
                                (entry) => entry.group === group
                              )
                              return (
                                found.length > 0 && (
                                  <CommandGroup
                                    key={group.id}
                                    heading={
                                      single ? undefined : headingOf(group)
                                    }
                                  >
                                    {found.map(({ model }) =>
                                      single ? (
                                        <CommandItem
                                          key={model.id}
                                          value={`model:${model.id}`}
                                          disabled={model.disabled ?? false}
                                          data-checked={model.id === value}
                                          onSelect={() => choose(model.id)}
                                        >
                                          <ModelLabel
                                            model={{
                                              id: model.id,
                                              label: model.label,
                                            }}
                                            query={needle}
                                          />
                                          <Detail reveal>{model.detail}</Detail>
                                        </CommandItem>
                                      ) : (
                                        <ModelItem
                                          key={model.id}
                                          model={model}
                                          group={group}
                                          value={value}
                                          query={needle}
                                          onSelect={choose}
                                        />
                                      )
                                    )}
                                  </CommandGroup>
                                )
                              )
                            })}
                            {onCustomModel && matches.length === 0 && (
                              <CommandGroup>
                                <CommandItem
                                  value={`custom:${query.trim()}`}
                                  data-slot="model-picker-custom"
                                  onSelect={() => {
                                    onCustomModel(
                                      query.trim(),
                                      customPlace(true)
                                    )
                                    setOpen(false)
                                  }}
                                >
                                  <HugeiconsIcon
                                    icon={PlusSignIcon}
                                    strokeWidth={2}
                                  />
                                  <span className="min-w-0 flex-1 truncate">
                                    {labels.custom(query.trim())}
                                  </span>
                                </CommandItem>
                              </CommandGroup>
                            )}
                          </>
                        ) : single ? (
                          <>
                            {recentModels.length > 0 && (
                              <CommandGroup heading={labels.recent}>
                                {recentModels.map((model) => (
                                  <CommandItem
                                    key={model.id}
                                    value={`recent:${model.id}`}
                                    disabled={model.disabled ?? false}
                                    data-checked={model.id === value}
                                    onSelect={() => choose(model.id)}
                                  >
                                    <ModelLabel model={model} />
                                    <Detail reveal>{model.detail}</Detail>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            )}

                            <GroupModels
                              group={single}
                              models={singleModels}
                              heading={single.label}
                              header={<GroupHeader group={single} />}
                              value={value}
                              onSelect={choose}
                            />
                          </>
                        ) : active?.recent ? (
                          <CommandGroup>
                            {paneModels.map((model) => (
                              <CommandItem
                                key={model.id}
                                value={`recent:${model.id}`}
                                disabled={model.disabled ?? false}
                                data-checked={model.id === value}
                                onSelect={() => choose(model.id)}
                                className="pointer-coarse:min-h-11"
                              >
                                <ModelLabel model={model} />
                                <Detail reveal>{model.detail}</Detail>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        ) : (
                          active && (
                            <GroupModels
                              key={active.key}
                              group={active}
                              models={paneModels}
                              header={
                                <GroupHeader
                                  // Its own, measured as it opens.
                                  ref={measureHeader}
                                  group={active}
                                />
                              }
                              value={value}
                              onSelect={choose}
                            />
                          )
                        )}
                      </CommandList>
                      {!single && !needle && (
                        <MoreModels
                          count={
                            (active?.models.length ?? 0) - paneModels.length
                          }
                          labels={labels}
                        />
                      )}
                      {!single && customField}
                    </div>
                  </div>
                  {single && !needle && (
                    <MoreModels
                      count={single.models.length - singleModels.length}
                      labels={labels}
                    />
                  )}
                  {single && customField}
                </>
              )}
            </Command>
            {/* Under the list, one section with no lines inside: the
                thinking, then rows inset 8px, as the list's (one left
                edge, the counts and chevrons in one column). */}
            {((thinking && slider.current) ||
              busy ||
              (error !== undefined && error !== null) ||
              (page.kind === "main" &&
                !needle &&
                value !== null &&
                (source !== undefined || onPinnedChange !== undefined)) ||
              (page.kind === "main" &&
                !needle &&
                (purposes.length > 0 ||
                  pages.length > 0 ||
                  React.Children.toArray(children).length > 0 ||
                  onManage))) && (
              <div data-slot="model-picker-more-rows" className="border-t py-1">
                {thinking && slider.current && (
                  <EffortSlider
                    // Another model's steps: a slider of its own.
                    key={sliderModel?.id}
                    efforts={efforts}
                    value={slider.current.value}
                    defaultValue={sliderModel?.defaultEffort}
                    onValueChange={(next) => onEffortChange?.(next)}
                    label={labels.effort}
                    toggle={sliderModel?.effortToggle ?? false}
                    note={labels.effortNote}
                    warning={
                      slider.missing
                        ? labels.effortMissing(slider.missing)
                        : null
                    }
                    formatDefault={labels.effortDefault}
                    formatReset={labels.effortReset}
                    // Its label on the rows' text, at 16px.
                    className="px-4"
                  />
                )}
                {busy && (
                  <div
                    role="status"
                    data-slot="model-picker-loading"
                    // A row of the list's look, inset as they are; nothing
                    // to choose.
                    className="mx-2 flex min-h-8 items-center gap-2 px-2 py-1 text-2sm text-muted-foreground"
                  >
                    <Spinner aria-hidden="true" />
                    {labels.loading}
                  </div>
                )}
                {!busy && error !== undefined && error !== null && (
                  <div
                    role="alert"
                    data-slot="model-picker-error"
                    className="mx-2 flex min-h-8 items-center gap-2 px-2 py-1 text-2sm text-muted-foreground [&>svg]:size-4 [&>svg]:shrink-0"
                  >
                    <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
                    <span className="min-w-0 flex-1">{error}</span>
                    {onRetry && (
                      <Button variant="outline" size="xs" onClick={onRetry}>
                        {labels.retry}
                      </Button>
                    )}
                  </div>
                )}
                {page.kind === "main" &&
                  !needle &&
                  value !== null &&
                  (source !== undefined || onPinnedChange) && (
                    <div
                      data-slot="model-picker-source"
                      // Where the chosen model comes from, and keeping it.
                      className="mx-2 flex min-h-8 items-center gap-2 px-2 py-1 text-2sm text-muted-foreground"
                    >
                      <span className="min-w-0 flex-1">{source}</span>
                      {pinSave === "saving" ? (
                        <span
                          role="status"
                          className="flex items-center gap-1 text-xs"
                        >
                          <Spinner aria-hidden="true" className="size-3.5" />
                          {labels.saving}
                        </span>
                      ) : pinSave === "failed" ? (
                        <span role="alert" className="text-xs">
                          {labels.saveFailed}
                        </span>
                      ) : null}
                      {onPinnedChange && (
                        <Button
                          variant="outline"
                          size="xs"
                          disabled={pinSave === "saving" || gone}
                          onClick={() => pin(!pinned)}
                        >
                          <HugeiconsIcon
                            icon={pinned ? PinOffIcon : PinIcon}
                            strokeWidth={2}
                          />
                          {pinned ? labels.unpin : labels.pin}
                        </Button>
                      )}
                    </div>
                  )}
                {page.kind === "main" && !needle && (
                  <div className="px-2">
                    {purposes.length > 0 && (
                      <button
                        type="button"
                        data-slot="model-picker-purposes"
                        onClick={() => go({ kind: "purposes" })}
                        className={composerSelectRow}
                      >
                        <HugeiconsIcon icon={Image01Icon} strokeWidth={2} />
                        <span className="min-w-0 truncate">
                          {labels.purposes}
                        </span>
                        <Detail>{labels.purposesSet(setCount)}</Detail>
                        <HugeiconsIcon
                          icon={ArrowRight01Icon}
                          strokeWidth={2}
                          className="text-muted-foreground"
                        />
                      </button>
                    )}
                    {pages.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        data-slot="model-picker-page"
                        onClick={() => go({ kind: "groups", id: item.id })}
                        className={composerSelectRow}
                      >
                        {item.icon}
                        <span className="min-w-0 truncate">{item.label}</span>
                        <Detail>{item.detail}</Detail>
                        <HugeiconsIcon
                          icon={ArrowRight01Icon}
                          strokeWidth={2}
                          className="text-muted-foreground"
                        />
                      </button>
                    ))}
                    {React.Children.toArray(children).length > 0 && (
                      <div data-slot="model-picker-extra">{children}</div>
                    )}
                    {onManage && (
                      <button
                        type="button"
                        data-slot="model-picker-manage"
                        onClick={() => {
                          setOpen(false)
                          onManage()
                        }}
                        className={composerSelectRow}
                      >
                        <HugeiconsIcon icon={Settings01Icon} strokeWidth={2} />
                        <span className="min-w-0 truncate">
                          {labels.manage}
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            <span role="status" className="sr-only">
              {said}
            </span>
          </div>
        )}
        {page.kind === "purposes" && (
          <>
            <PageHeader
              title={labels.purposes}
              back={labels.back}
              onBack={back}
            />
            <ul
              aria-label={labels.purposes}
              // Its rows inset as the main list's: icons 16px in.
              className="flex flex-col px-2 py-1"
              onKeyDown={moveFocus}
            >
              {purposes.map((item, index) => (
                <li key={item.id}>
                  <button
                    type="button"
                    data-row
                    tabIndex={index === 0 ? 0 : -1}
                    onClick={() => go({ kind: "purpose", id: item.id })}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowRight") {
                        event.preventDefault()
                        go({ kind: "purpose", id: item.id })
                      } else if (event.key === "ArrowLeft") {
                        event.preventDefault()
                        back()
                      }
                    }}
                    // Focus is put on the first row on entering, by a click
                    // too, where focus-visible would not show it.
                    className={cn(composerSelectRow, "focus:bg-muted")}
                  >
                    {item.icon}
                    <span className="min-w-0 truncate">{item.label}</span>
                    <Detail>
                      {item.models.find((model) => model.id === item.value)
                        ?.label ?? labels.purposeNotSet}
                    </Detail>
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      strokeWidth={2}
                      className="text-muted-foreground"
                    />
                  </button>
                </li>
              ))}
            </ul>
            {labels.purposesNote && (
              <p className={sectionNote}>{labels.purposesNote}</p>
            )}
          </>
        )}
        {purpose && (
          <>
            <PageHeader
              title={purpose.label}
              back={labels.back}
              onBack={back}
            />
            {purpose.models.length === 0 && (
              <Empty
                data-slot="model-picker-purpose-empty"
                className="gap-3 p-4"
              >
                <EmptyHeader>
                  <EmptyDescription>{labels.purposeEmpty}</EmptyDescription>
                </EmptyHeader>
                {purpose.empty && <EmptyContent>{purpose.empty}</EmptyContent>}
              </Empty>
            )}
            {/* A list of its own: choosing stays on the page. */}
            {purpose.models.length > 0 && (
              <ComposerSelectList
                aria-label={purpose.label}
                value={purpose.value}
                onValueChange={(model) => onPurposeChange?.(purpose.id, model)}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowLeft") return
                  event.preventDefault()
                  back()
                }}
              >
                {purpose.models.map((model) => (
                  <ComposerSelectItem
                    key={model.id}
                    value={model.id}
                    disabled={model.disabled ?? false}
                    detail={model.detail}
                  >
                    <ModelLabel model={model} />
                  </ComposerSelectItem>
                ))}
              </ComposerSelectList>
            )}
            {purpose.settings && purpose.settings.length > 0 && (
              <div
                role="group"
                aria-label={labels.conversation}
                className="border-t p-1"
              >
                <div aria-hidden className={sectionHeading}>
                  {labels.conversation}
                </div>
                {purpose.settings.map((setting) => (
                  <PurposeSetting
                    key={setting.id}
                    setting={setting}
                    onValueChange={(next) =>
                      onPurposeSettingChange?.(purpose.id, setting.id, next)
                    }
                  />
                ))}
              </div>
            )}
            {purpose.note && <p className={sectionNote}>{purpose.note}</p>}
          </>
        )}
      </div>
    </>
  )

  // A ComposerSelect: on a phone, a sheet from the bottom with the same
  // pages and horizontal group tabs.
  return (
    <ComposerSelect open={open} onOpenChange={onPopupOpenChange}>
      <ComposerSelectTrigger
        data-slot="model-picker"
        data-unavailable={unavailable ? "" : undefined}
        aria-label={labels.trigger(shown)}
        // Its name and the key that opens it, the app's.
        {...(shortcut
          ? {
              tooltip: (
                <>
                  {labels.title}
                  <Kbd>{shortcut}</Kbd>
                </>
              ),
            }
          : {})}
        className={className}
      >
        {unavailable ? (
          <>
            <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
            <ComposerSelectValue>
              {value === null ? labels.unavailable : goneName}
            </ComposerSelectValue>
          </>
        ) : (
          <>
            {selectedIcon}
            <ComposerSelectValue>
              {selected?.label ?? valueLabel ?? value}
            </ComposerSelectValue>
            {selected?.badge && (
              // Its route: another key, another provider. The space
              // keeps it a word of its own in the button's text.
              <>
                {" "}
                <span className={modelBadge}>{selected.badge}</span>
              </>
            )}
            {currentEffort && showEffort && (
              // In grey, a space either side of the dot (the button's gap
              // less 2px before it); gone where the toolbar folds.
              <span className="-ms-0.5 shrink-0 text-subtle-foreground group-hover/button:text-muted-foreground group-aria-expanded/button:text-muted-foreground group-data-folded/composer-toolbar:hidden @max-sm/composer-toolbar:hidden">
                · {currentEffort.label}
              </span>
            )}
          </>
        )}
        {triggerEnd !== undefined && triggerEnd !== null && (
          <span
            data-slot="model-picker-trigger-end"
            className="flex shrink-0 items-center"
          >
            {triggerEnd}
          </span>
        )}
      </ComposerSelectTrigger>
      <ComposerSelectContent
        title={labels.title}
        doneLabel={labels.done}
        // Not on a phone, where the keyboard would cover the list, and the
        // sheet is as wide as the screen.
        {...(mobile
          ? {}
          : {
              initialFocus: mainFlat ? list : search,
              // Every page as wide: one popup whose content turns.
              // One list as wide as one group's.
              className: mainSingle || mainFlat ? "w-84" : "w-120",
            })}
      >
        {body}
      </ComposerSelectContent>
    </ComposerSelect>
  )
}

/**
 * A setting of a purpose's model, as a row: its name, its value at the
 * end and a chevron; its options open over it.
 */
function PurposeSetting({
  setting,
  onValueChange,
}: {
  setting: ModelSetting
  onValueChange: (value: string) => void
}) {
  const id = React.useId()
  return (
    <Select
      items={setting.options}
      value={setting.value}
      onValueChange={(next) => {
        if (typeof next === "string") onValueChange(next)
      }}
    >
      <SelectPrimitive.Trigger
        data-slot="model-picker-setting"
        aria-labelledby={id}
        className={cn(composerSelectRow, "data-popup-open:bg-muted")}
      >
        <span id={id} className="min-w-0 flex-1 truncate">
          {setting.label}
        </span>
        <SelectValue className="flex-none text-xs text-foreground tabular-nums" />
        <SelectPrimitive.Icon className="grid size-4 shrink-0 place-items-center text-muted-foreground">
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            strokeWidth={2}
            className="size-3"
          />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectContent>
        {setting.options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
            {option.hint && (
              <span className="text-muted-foreground">{option.hint}</span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export {
  EffortSlider,
  ModelPicker,
  type ModelEffort,
  type ModelGroup,
  type ModelOption,
  type ModelPickerLabels,
  type ModelCustomPlace,
  type ModelPickerPage,
  type ModelPurpose,
  type ModelSetting,
}
