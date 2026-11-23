import * as React from "react"
import { cn } from "cn"
import { HugeiconsIcon } from "@hugeicons/react"
import { PencilEdit02Icon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

type AgentLaunchLabels = {
  /** The button that opens a launch's settings to change: "Edit". */
  edit: string
  /** The button that closes them: "Done". */
  done: string
  /** Before a launch's title, its checkbox's name: "Start". */
  include: string
}

const defaultLabels: AgentLaunchLabels = {
  edit: "Edit",
  done: "Done",
  include: "Start",
}

type LaunchContext = {
  editing: boolean
  setTitle: (id: string | undefined) => void
}

const LaunchContext = React.createContext<LaunchContext | null>(null)
const ListContext = React.createContext(false)

/**
 * The launches an agent proposes, one under another, a rule between:
 * each an `AgentLaunch`, with its checkbox to leave it out.
 */
function AgentLaunchList({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ListContext value={true}>
      <ul
        data-slot="agent-launch-list"
        className={cn(
          "flex min-w-0 flex-col divide-y *:py-3 *:first:pt-0 *:last:pb-0",
          className
        )}
        {...props}
      />
    </ListContext>
  )
}

/**
 * A new task an agent proposes to start (a conversation of its own), in
 * an `AgentRequest` that asks the reader first. Read at a glance, three
 * lines in line with each other: its title (`AgentLaunchTitle`), what it
 * runs with as one quiet line (`AgentLaunchMeta`: the agent and model,
 * the permissions, the machine, the folder) and two lines of the first
 * message it is sent (`AgentLaunchMessage`).
 *
 * Its settings are not a form always open: a pencil at the title's end
 * opens them in place (`AgentLaunchEdit`), Done closes them. They are a
 * composer's: the message in a box, the pickers in a row along its foot.
 *
 * Given `included` (with `onIncludedChange`), a checkbox before its
 * title, to leave it out of several; left out, its title is muted.
 */
function AgentLaunch({
  included,
  onIncludedChange,
  editing: editingProp,
  defaultEditing = false,
  onEditingChange,
  editable = true,
  labels: labelsProp,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  /** Whether it is started with the others; with this, its checkbox. */
  included?: boolean
  onIncludedChange?: (included: boolean) => void
  /** Whether its settings are open to change. */
  editing?: boolean
  defaultEditing?: boolean
  onEditingChange?: (editing: boolean) => void
  /** Whether it has the pencil: not for one nothing of can change. */
  editable?: boolean
  /** Its words, for other languages. */
  labels?: Partial<AgentLaunchLabels>
  children?: React.ReactNode
}) {
  const inList = React.useContext(ListContext)
  const [editingState, setEditingState] = React.useState(defaultEditing)
  const editing = editingProp ?? editingState
  const setEditing = (next: boolean) => {
    setEditingState(next)
    onEditingChange?.(next)
  }
  const [title, setTitle] = React.useState<string>()
  const includeId = React.useId()
  const labels = { ...defaultLabels, ...labelsProp }
  const context = React.useMemo(() => ({ editing, setTitle }), [editing])
  // An item of a list's, else a block (typed as one: the same props).
  const Root = (inList ? "li" : "div") as "div"
  return (
    <LaunchContext value={context}>
      <Root
        data-slot="agent-launch"
        data-editing={editing || undefined}
        data-excluded={included === false || undefined}
        className={cn(
          // The checkbox, the title and the pencil on its first line;
          // all else under the title, to the end.
          "group/agent-launch grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] text-sm *:not-data-[slot=agent-launch-include]:not-data-[slot=agent-launch-title]:not-data-[slot=agent-launch-toggle]:col-[2/-1]",
          className
        )}
        {...props}
      >
        {included !== undefined && (
          <>
            <span id={includeId} hidden>
              {labels.include}
            </span>
            <Checkbox
              data-slot="agent-launch-include"
              checked={included}
              onCheckedChange={(checked) => onIncludedChange?.(checked)}
              aria-labelledby={title ? `${includeId} ${title}` : includeId}
              // Centred on the title's line, or its input while edited.
              className="col-start-1 row-start-1 me-2 self-center"
            />
          </>
        )}
        {children}
        {editable && (
          <Button
            data-slot="agent-launch-toggle"
            variant="ghost"
            size={editing ? "sm" : "icon-sm"}
            aria-expanded={editing}
            {...(!editing && { "aria-label": labels.edit })}
            {...(title ? { "aria-describedby": title } : {})}
            onClick={() => setEditing(!editing)}
            // On the title's line, not taller for it; beside its input
            // while edited.
            className="col-start-3 row-start-1 -my-1 ms-2 self-center text-subtle-foreground group-data-editing/agent-launch:my-0 group-data-editing/agent-launch:text-muted-foreground hover:text-foreground"
          >
            {editing ? (
              labels.done
            ) : (
              <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} />
            )}
          </Button>
        )}
      </Root>
    </LaunchContext>
  )
}

/**
 * What the task is: "Fix the flaky upload test", one line. While its
 * launch is edited, its `editor` in its place: an `Input`.
 */
function AgentLaunchTitle({
  id: idProp,
  editor,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  /** In its place while its launch is edited: an `Input` of it. */
  editor?: React.ReactNode
}) {
  const context = React.useContext(LaunchContext)
  const generated = React.useId()
  const id = idProp ?? generated
  const setTitle = context?.setTitle
  React.useLayoutEffect(() => {
    setTitle?.(id)
    return () => setTitle?.(undefined)
  }, [setTitle, id])
  const editing = context?.editing && editor !== undefined
  return (
    <div
      data-slot="agent-launch-title"
      className={cn(
        "col-start-2 row-start-1 min-w-0 self-center",
        !editing &&
          "truncate leading-5 font-medium text-foreground group-data-excluded/agent-launch:text-muted-foreground",
        className
      )}
      {...props}
    >
      {/* Named by its words even while its input shows. */}
      <span id={id} className={editing ? "sr-only" : undefined}>
        {children}
      </span>
      {editing && editor}
    </div>
  )
}

/**
 * What it runs with, one quiet line, its values a dot apart and the
 * line cut short where it is too long: each an `AgentLaunchMetaItem`
 * ("Claude Opus · High", "Ask first", "linux-box", "~/code/app"). While
 * its launch is edited, only its `fixed` items, what cannot change (a
 * copy's agent, machine and folder; put first), over the box that edits
 * the rest.
 */
function AgentLaunchMeta({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="agent-launch-meta"
      className={cn(
        "mt-0.5 min-w-0 truncate text-2sm leading-5 text-muted-foreground",
        // A dot between values, of those shown, not read out.
        "*:not-first:before:mx-1 *:not-first:before:text-subtle-foreground *:not-first:before:content-['·'_/_'']",
        // Edited, its fixed values only (first, so no dot leads them).
        "group-data-editing/agent-launch:mt-2 group-data-editing/agent-launch:hidden group-data-editing/agent-launch:*:not-data-fixed:hidden group-data-editing/agent-launch:has-data-fixed:block",
        className
      )}
      {...props}
    />
  )
}

/**
 * One thing it runs with, its value as words: "Ask first". `fixed`: it
 * cannot change, so it stays while its launch is edited.
 */
function AgentLaunchMetaItem({
  fixed = false,
  className,
  ...props
}: React.ComponentProps<"span"> & {
  /** Whether it cannot change: shown while its launch is edited too. */
  fixed?: boolean
}) {
  return (
    <span
      data-slot="agent-launch-meta-item"
      data-fixed={fixed || undefined}
      className={cn("inline", className)}
      {...props}
    />
  )
}

/**
 * The first message the task is sent: two lines of it, in line with the
 * title; the whole in its editor. Plain text, the app's. Hidden while its
 * launch is edited.
 */
function AgentLaunchMessage({
  className,
  ...props
}: React.ComponentProps<"p">) {
  const context = React.useContext(LaunchContext)
  if (context?.editing) return null
  return (
    <p
      data-slot="agent-launch-message"
      className={cn(
        "mt-1 line-clamp-2 min-w-0 text-2sm leading-5 text-pretty wrap-break-word text-foreground/80 group-data-excluded/agent-launch:text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

/**
 * Its settings, in place of its meta (but what is `fixed`) and message
 * while its launch is edited: a composer's box, an `InputGroup` of the
 * message (`InputGroupTextarea`, three lines to eight) and, along its
 * foot (`InputGroupAddon align="block-end"`), `AgentLaunchControls`.
 */
function AgentLaunchEdit({ className, ...props }: React.ComponentProps<"div">) {
  const context = React.useContext(LaunchContext)
  if (!context?.editing) return null
  return (
    <div
      data-slot="agent-launch-edit"
      className={cn(
        "mt-2 min-w-0",
        "[&_textarea]:max-h-44 [&_textarea]:min-h-16 [&_textarea]:text-2sm [&_textarea]:leading-5",
        className
      )}
      {...props}
    />
  )
}

/**
 * The pickers along the foot of its box, as a composer's toolbar has
 * them, quiet until pointed at: the agent and model (`ComposerSelect`, a
 * model picker), `ComposerModePicker`, the machine, the folder, and an
 * option as a `ComposerOptionButton` pressed or not (`aria-pressed`).
 */
function AgentLaunchControls({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="agent-launch-controls"
      className={cn(
        // Their words in line with the message's: a pill's padding out.
        "-ms-2 flex min-w-0 flex-1 flex-wrap items-center gap-0.5",
        // An option pressed, in the text's colour; not, struck quiet.
        "[&>[aria-pressed=true]]:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  AgentLaunch,
  AgentLaunchControls,
  AgentLaunchEdit,
  AgentLaunchList,
  AgentLaunchMessage,
  AgentLaunchMeta,
  AgentLaunchMetaItem,
  AgentLaunchTitle,
  type AgentLaunchLabels,
}
