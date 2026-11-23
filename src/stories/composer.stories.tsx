import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { cn } from "cn"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert02Icon,
  CornerUpRightIcon,
  File01Icon,
  GitPullRequestIcon,
  HashtagIcon,
  PlayListAddIcon,
  RecordIcon,
  Tag01Icon,
} from "@hugeicons/core-free-icons"
import {
  expect,
  fireEvent,
  fn,
  screen,
  spyOn,
  userEvent,
  waitFor,
  within,
} from "storybook/test"

import {
  Composer,
  ComposerAttach,
  ComposerAttachments,
  ComposerEditor,
  ComposerMessage,
  ComposerSubmit,
  ComposerToolbar,
  ComposerSuggestions,
  composerText,
  type ComposerFollowUp,
  type ComposerActions,
  type ComposerAttachment,
  type ComposerQuote,
  type ComposerAttachmentState,
  type ComposerLink,
  type ComposerLinkDetails,
  type ComposerStatus,
  type ComposerValue,
} from "@/components/composer"
import { Button } from "@/components/ui/button"
import { FullToolbar } from "@/stories/composer-tools"
import { coarseHitSize } from "@/stories/touch"
import { rendered } from "@/stories/wait"

const library = [
  { id: "file:1", label: "app.ts", description: "src/app.ts" },
  { id: "file:2", label: "app.test.ts", description: "src/app.test.ts" },
  { id: "file:3", label: "README.md", description: "README.md" },
]

const sessions = [
  { id: "session:1", label: "Release notes" },
  { id: "session:2", label: "Flaky test" },
]

/** "@" with nothing typed: kinds, each opening its own list. */
const kinds = [
  { id: "kind:new", label: "New conversation", opens: true },
  { id: "kind:sessions", label: "Conversations", opens: true },
  { id: "kind:files", label: "Files", opens: true },
]
const agents = [
  { id: "agent:1", label: "Reviewer" },
  { id: "agent:2", label: "Planner" },
]
const listOf: Record<string, { id: string; label: string }[]> = {
  "kind:new": agents,
  "kind:sessions": sessions,
  "kind:files": library,
}

/** What "@" shows: the kinds, a kind's list, or one search over all. */
function nestedItems(
  path: readonly { id: string }[],
  query: string | null
): { id: string; label: string; description?: string; opens?: boolean }[] {
  const matching = (items: { id: string; label: string }[]) =>
    items.filter((item) =>
      item.label.toLowerCase().includes((query ?? "").toLowerCase())
    )
  const kind = path.at(-1)
  if (kind) return matching(listOf[kind.id]!)
  return query ? matching([...sessions, ...library]) : kinds
}

/** Slash commands: some run when chosen, others become a chip. */
const commands = [
  {
    id: "clear",
    label: "clear",
    description: "Clear the conversation",
    execute: true,
  },
  {
    id: "compact",
    label: "compact",
    description: "Summarize and go on",
    execute: true,
  },
  { id: "review", label: "review", description: "Review the changes" },
]

/** What the app's resolver knows; anything else fails. */
const pages: Record<string, ComposerLinkDetails> = {
  "https://vite.dev/guide/build": {
    title: "Building for Production",
    detail: "vite.dev",
    fetched: "12:04",
    description:
      "When it is time to deploy your app for production, run the vite build command.",
  },
  "https://rollupjs.org/configuration-options/": {
    title: "Configuration Options",
    detail: "rollupjs.org",
  },
  "https://github.com/acme/web/pull/128": {
    title: "#128 Graphite theme tokens",
    detail: "Open",
    kind: "pull-request",
  },
}

/** Holds the resolver's answers until a story lets them go. */
let releaseLinks = () => {}
let linksHeld = Promise.resolve()
function holdLinks() {
  linksHeld = new Promise((resolve) => {
    releaseLinks = resolve
  })
}

type DemoProps = {
  followUp?: ComposerFollowUp
  onSubmitOptions: (options: {
    interrupt: boolean
    followUp: ComposerFollowUp
  }) => void
  onSubmit: (value: ComposerValue) => void
  onStop: () => void
  onAddFiles: (accepted: File[], rejected: File[]) => void
  onQueryChange: (query: string | null) => void
  onExecute: (command: string) => void
  onPathChange: (path: string[]) => void
  /** "@" opens kinds of things, each its own list. */
  nested?: boolean
  onOpenQuote: (quote: ComposerQuote) => void
  onOpenAttachment: (attachment: ComposerAttachment) => void
  onRetryAttachment: (attachment: ComposerAttachment) => void
  status?: ComposerStatus
  /** Whether a follow-up can be sent while a response runs. */
  followUps?: boolean
  submitOnEnter?: boolean
  disabled?: boolean
  error?: string
  /** Whether files can be attached. */
  files?: boolean
  accept?: string
  pasteAsFile?: { minLength: number; name?: string }
  /** How many files can be attached. */
  maxFiles?: number
  onPaste?: React.ClipboardEventHandler<HTMLFormElement>
  onDrop?: React.DragEventHandler<HTMLFormElement>
  /** Takes the app's own data dropped: a path, as a mention. */
  dropData?: boolean
  /** The message to start with, e.g. a restored draft. */
  initial?: ComposerValue
  /** The state of the file search. */
  search?: "done" | "loading" | "failed"
  /** Where files show; without, no `ComposerAttachments`. */
  placement?: "inline" | "row"
  /** How the row shows its files: cards, or chips as in the text. */
  variant?: "card" | "chip"
  windowDrops?: boolean
  /** Resolves pasted links, at once or when a story lets them go. */
  links?: "resolve" | "hold"
  /** The uploads' state, by attachment id. */
  uploads?: Record<string, ComposerAttachmentState>
  placeholder?: string
  /** The design's whole toolbar, at the design's width (668px). */
  full?: boolean
  previewProps?: React.ComponentProps<typeof ComposerEditor>["previewProps"]
}

const attachmentOf = (id: string, file: File): ComposerAttachment => ({
  type: "attachment",
  id,
  name: file.name,
  ...(file.type ? { mediaType: file.type } : {}),
  ...(file.type.startsWith("image/")
    ? { preview: URL.createObjectURL(file) }
    : {}),
})

/** A link's icon by its kind, as an app draws its own kinds. */
const linkIcon = (link: ComposerLink) =>
  link.kind === "pull-request" ? (
    <HugeiconsIcon icon={GitPullRequestIcon} strokeWidth={2} />
  ) : link.kind === "release" ? (
    <HugeiconsIcon icon={Tag01Icon} strokeWidth={2} />
  ) : link.kind === "issue" ? (
    <HugeiconsIcon icon={RecordIcon} strokeWidth={2} />
  ) : undefined

/** A chat that "runs" after each message until it is stopped. */
function Demo({
  onSubmit,
  onSubmitOptions,
  followUp,
  onStop,
  onAddFiles,
  onQueryChange,
  onExecute,
  onPathChange,
  nested = false,
  onOpenQuote,
  onOpenAttachment,
  onRetryAttachment,
  status: initialStatus = "ready",
  followUps = false,
  submitOnEnter,
  disabled,
  error,
  files: takesFiles = true,
  accept,
  pasteAsFile,
  maxFiles = Infinity,
  onPaste,
  onDrop,
  dropData = false,
  initial = [],
  search = "done",
  placement,
  variant,
  windowDrops,
  links,
  uploads,
  placeholder = "Ask anything",
  full = false,
  previewProps,
}: DemoProps) {
  const [value, setValue] = React.useState(initial)
  const [status, setStatus] = React.useState(initialStatus)
  const [notice, setNotice] = React.useState("")
  const [query, setQuery] = React.useState<string | null>(null)
  const [path, setPath] = React.useState<{ id: string; label: string }[]>([])
  const [sessionQuery, setSessionQuery] = React.useState<string | null>(null)
  const [commandQuery, setCommandQuery] = React.useState<string | null>(null)
  const nextId = React.useRef(0)
  const actions = React.useRef<ComposerActions>(null)
  const files = value.filter(
    (part) => typeof part !== "string" && part.type === "attachment"
  ).length

  return (
    <div
      className={cn(
        "flex max-w-full flex-col gap-2 pt-64",
        full ? "w-167" : "w-md"
      )}
      // The app's own shortcut for the file picker, ⌘U or Ctrl+U.
      onKeyDown={(event) => {
        if (
          event.key.toLowerCase() === "u" &&
          (event.metaKey || event.ctrlKey) &&
          !event.altKey &&
          !event.shiftKey
        ) {
          event.preventDefault()
          actions.current?.pickFiles()
        }
      }}
    >
      <Composer
        value={value}
        onValueChange={setValue}
        status={status}
        followUp={followUp}
        disabled={disabled}
        submitOnEnter={submitOnEnter}
        accept={accept}
        pasteAsFile={pasteAsFile}
        actionsRef={actions}
        // An empty box sends nothing anyway; while a response runs, only
        // where follow-ups are taken.
        submitDisabled={status !== "ready" && !followUps}
        renderMention={(mention) => (
          <>
            {mention.trigger === "#" ? (
              <HugeiconsIcon icon={HashtagIcon} strokeWidth={2} />
            ) : (
              <HugeiconsIcon icon={File01Icon} strokeWidth={2} />
            )}
            <span className="truncate">{mention.label}</span>
          </>
        )}
        renderLinkIcon={linkIcon}
        attachmentState={(attachment) => uploads?.[attachment.id]}
        onOpenQuote={onOpenQuote}
        onOpenAttachment={onOpenAttachment}
        onRetryAttachment={onRetryAttachment}
        {...(links
          ? {
              resolveLink: async (url: string) => {
                if (links === "hold") await linksHeld
                return pages[url] ?? null
              },
            }
          : {})}
        onSubmit={(message, _event, options) => {
          onSubmitOptions(options)
          onSubmit(message)
          setValue([])
          setStatus("running")
        }}
        onStop={() => {
          onStop()
          setStatus("stopping")
          setTimeout(() => setStatus("ready"), 300)
        }}
        onAddFiles={
          takesFiles
            ? (accepted, rejected) => {
                onAddFiles(accepted, rejected)
                setNotice(
                  rejected.length
                    ? `${rejected.map((file) => file.name).join(", ")} cannot be attached.`
                    : ""
                )
                // Each file becomes a chip where it came in.
                return accepted
                  .slice(0, Math.max(0, maxFiles - files))
                  .flatMap((file) => [
                    attachmentOf(`upload:${nextId.current++}`, file),
                    " ",
                  ])
              }
            : undefined
        }
        onPaste={onPaste}
        onDrop={onDrop}
        {...(dropData
          ? {
              dropTypes: ["application/x-path"],
              onDropData: (data: DataTransfer) => {
                const path = data.getData("application/x-path")
                return [mention("@", path, path.split("/").pop()!), " "]
              },
            }
          : {})}
      >
        <ComposerSuggestions
          trigger="@"
          label="Files"
          {...(nested && {
            path,
            onPathChange: (next: { id: string; label: string }[]) => {
              onPathChange(next.map((item) => item.id))
              setPath(next)
            },
          })}
          items={
            nested
              ? nestedItems(path, query)
              : search === "done"
                ? library.filter((file) =>
                    file.label
                      .toLowerCase()
                      .includes((query ?? "").toLowerCase())
                  )
                : []
          }
          loading={search === "loading"}
          error={search === "failed" ? "Search failed. Try again." : undefined}
          onQueryChange={(next) => {
            onQueryChange(next)
            setQuery(next)
          }}
          renderItem={
            nested
              ? undefined
              : (file: { label: string; description?: string }) => (
                  <>
                    <HugeiconsIcon icon={File01Icon} strokeWidth={2} />
                    <span className="truncate">{file.label}</span>
                    <span className="ms-auto truncate text-xs text-muted-foreground">
                      {file.description}
                    </span>
                  </>
                )
          }
        />
        <ComposerSuggestions
          trigger="#"
          label="Conversations"
          items={sessions.filter((session) =>
            session.label
              .toLowerCase()
              .includes((sessionQuery ?? "").toLowerCase())
          )}
          onQueryChange={setSessionQuery}
        />
        <ComposerSuggestions
          trigger="/"
          label="Commands"
          items={commands.filter((command) =>
            command.label.startsWith(commandQuery ?? "")
          )}
          onQueryChange={setCommandQuery}
          onExecute={(command) => onExecute(command.id)}
        />
        {placement ? (
          <ComposerAttachments
            placement={placement}
            variant={variant}
            windowDrops={windowDrops}
          />
        ) : null}
        <ComposerEditor
          aria-label="Message"
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "composer-error" : undefined}
          previewProps={previewProps}
        />
        {full ? (
          <FullToolbar />
        ) : (
          <ComposerToolbar>
            <ComposerAttach disabled={files >= maxFiles} />
            <ComposerSubmit className="ms-auto" />
          </ComposerToolbar>
        )}
      </Composer>
      {error ? (
        <p
          id="composer-error"
          className="flex items-center gap-2 px-1 text-sm text-muted-foreground [&_svg]:size-4 [&_svg]:shrink-0"
        >
          <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
          {error}
        </p>
      ) : null}
      <p aria-live="polite" className="text-sm text-destructive">
        {notice}
      </p>
      {full ? null : (
        <Button
          variant="outline"
          className="self-start"
          onClick={() =>
            actions.current?.insert([
              {
                type: "mention",
                trigger: "@",
                id: "quote:1",
                label: "“The build is green”",
              },
              " ",
            ])
          }
        >
          Quote a message
        </Button>
      )}
    </div>
  )
}

/** Files on a clipboard or being dragged, with optional text. */
function transfer(names: string[], text?: string) {
  const data = new DataTransfer()
  for (const name of names) {
    const type = name.endsWith(".png")
      ? "image/png"
      : name.endsWith(".pdf")
        ? "application/pdf"
        : "text/plain"
    data.items.add(new File(["…"], name, { type }))
  }
  if (text !== undefined) data.setData("text/plain", text)
  return data
}

// fireEvent drops what a DataTransfer holds, so these dispatch events of
// their own. Each returns false when the default action was prevented.

function paste(target: Element, clipboardData: DataTransfer) {
  const event = new ClipboardEvent("paste", { bubbles: true, cancelable: true })
  // Set after, as Firefox hides the files of an event made with them.
  Object.defineProperty(event, "clipboardData", { value: clipboardData })
  return target.dispatchEvent(event)
}

function drag(
  type: "dragenter" | "dragover" | "dragleave" | "drop",
  target: Element,
  dataTransfer: DataTransfer,
  at: { clientX: number; clientY: number } = { clientX: 0, clientY: 0 }
) {
  return target.dispatchEvent(
    new DragEvent(type, {
      bubbles: true,
      cancelable: true,
      dataTransfer,
      ...at,
    })
  )
}

/** Picks files as the file picker would. */
function pick(canvasElement: HTMLElement, names: string[]) {
  const input =
    canvasElement.querySelector<HTMLInputElement>("input[type=file]")!
  input.files = transfer(names).files
  fireEvent.change(input)
}

const user = userEvent.setup()

/**
 * Types key by key, each once the editor has taken the one before, as a
 * person types: simulated keys sent at once outrun the editor in Firefox.
 */
async function type(keys: string) {
  for (const key of keys.match(/\{[^}]*\}|./gu) ?? []) {
    await user.keyboard(key)
    await rendered()
  }
}

/** The chips in the text: mentions, files and links. */
const chips = (editor: HTMLElement) =>
  Array.from(editor.querySelectorAll<HTMLElement>("[data-lexical-decorator]"))

/** Puts the caret in the editor, as a click there would. */
function caret(node: Node, offset: number) {
  getSelection()!.collapse(node, offset)
}

const suggestions = (canvas: { findByRole: typeof screen.findByRole }) =>
  canvas
    .findByRole("listbox")
    .then((list) =>
      list.closest<HTMLElement>("[data-slot=composer-suggestions]")!
    )

const names = (files: File[]) => files.map((file) => file.name)

/** The colour a CSS variable resolves to, as computed styles give it. */
function resolve(within: Element, variable: string) {
  const probe = document.createElement("span")
  probe.style.color = `var(${variable})`
  within.append(probe)
  const color = getComputedStyle(probe).color
  probe.remove()
  return color
}

const pixel = document.createElement("canvas").getContext("2d", {
  willReadFrequently: true,
})!

/** The relative luminance of colours painted over each other, bottom first. */
function luminance(...colors: string[]) {
  pixel.fillStyle = "#fff"
  pixel.fillRect(0, 0, 1, 1)
  for (const color of colors) {
    pixel.fillStyle = color
    pixel.fillRect(0, 0, 1, 1)
  }
  const [r, g, b] = Array.from(pixel.getImageData(0, 0, 1, 1).data, (c) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

const contrast = (a: number, b: number) =>
  (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

const mention = (trigger: string, id: string, label: string) => ({
  type: "mention" as const,
  trigger,
  id,
  label,
})

/** A file's chip in a value, whatever its preview's address. */
const attachment = (id: string, name: string) =>
  expect.objectContaining({ type: "attachment", id, name })

const meta = {
  title: "Components/Composer",
  component: Demo,
  args: {
    onSubmit: fn(),
    onSubmitOptions: fn(),
    onStop: fn(),
    onAddFiles: fn(),
    onQueryChange: fn(),
    onExecute: fn(),
    onPathChange: fn(),
    onOpenQuote: fn(),
    onOpenAttachment: fn(),
    onRetryAttachment: fn(),
  },
} satisfies Meta<typeof Demo>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ args, canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    const button = canvas.getByRole("button", { name: "Send" })
    await expect(editor).toHaveAttribute("aria-multiline", "true")
    await expect(editor).toHaveAttribute("aria-placeholder", "Ask anything")
    // Nothing to send yet; the button stays focusable but unavailable.
    await expect(button).toHaveAttribute("aria-disabled", "true")

    // Shift+Enter adds a line, Enter sends.
    await user.click(editor)
    await type("Hello{Shift>}{Enter}{/Shift}world")
    await expect(editor).toHaveTextContent("Helloworld")
    await type("{Enter}")
    await expect(args.onSubmit).toHaveBeenCalledWith(["Hello\nworld"])
    await waitFor(() => expect(editor).toHaveTextContent(""))

    // While it runs, the same button stops it, and so does Escape.
    await expect(button).toHaveAccessibleName("Stop")
    await type("{Escape}")
    await expect(args.onStop).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(button).toHaveAccessibleName("Send"))
  },
}

/** The button changes between Send and Stop without losing focus. */
export const KeepsFocus: Story = {
  play: async ({ args, canvas }) => {
    await user.click(canvas.getByRole("textbox", { name: "Message" }))
    await type("Run the tests")
    const button = canvas.getByRole("button", { name: "Send" })
    await user.click(button)
    await expect(args.onSubmit).toHaveBeenCalledWith(["Run the tests"])
    await expect(button).toHaveAccessibleName("Stop")
    await expect(button).toHaveFocus()

    await type("{Enter}")
    await expect(args.onStop).toHaveBeenCalledTimes(1)
    // Stopping: still there, unavailable, still focused.
    await expect(button).toHaveAttribute("aria-disabled", "true")
    await expect(button).toHaveFocus()
    await waitFor(() => expect(button).toHaveAccessibleName("Send"))
    await expect(button).toHaveFocus()
  },
}

/** Enter confirms what an input method is composing; it does not send. */
export const Composing: Story = {
  play: async ({ args, canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    await user.click(editor)
    await type("nihao")
    fireEvent.keyDown(editor, { key: "Enter", isComposing: true })
    fireEvent.keyDown(editor, { key: "Enter", keyCode: 229 })
    await expect(args.onSubmit).not.toHaveBeenCalled()
    await type("{Enter}")
    await expect(args.onSubmit).toHaveBeenCalledWith(["nihao"])
  },
}

/** Escape cancels what an input method is composing; it does not stop. */
export const ComposingWhileRunning: Story = {
  args: { status: "running" },
  play: async ({ args, canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    await user.click(editor)
    fireEvent.keyDown(editor, { key: "Escape", isComposing: true })
    fireEvent.keyDown(editor, { key: "Escape", keyCode: 229 })
    await expect(args.onStop).not.toHaveBeenCalled()
    fireEvent.keyDown(editor, { key: "Escape" })
    await expect(args.onStop).toHaveBeenCalledTimes(1)
  },
}

/**
 * With follow-ups allowed, a stop and a raised send while it runs, both
 * at the toolbar's end (the submit's `ms-auto` is their group's); the
 * send takes the follow-up once there is text.
 */
export const FollowUp: Story = {
  args: { status: "running", followUps: true },
  play: async ({ args, canvas }) => {
    const stop = canvas.getByRole("button", { name: "Stop" })
    const button = canvas.getByRole("button", { name: "Send" })
    // 10px apart, the send at the toolbar's end.
    await expect(
      button.getBoundingClientRect().left - stop.getBoundingClientRect().right
    ).toBe(10)
    const toolbar = button.closest<HTMLElement>("[data-slot=composer-toolbar]")!
    await expect(
      Math.round(
        toolbar.getBoundingClientRect().right -
          button.getBoundingClientRect().right
      )
    ).toBe(Math.round(parseFloat(getComputedStyle(toolbar).paddingRight)))
    await expect(button).toHaveAttribute("aria-disabled", "true")
    await user.click(canvas.getByRole("textbox", { name: "Message" }))
    await type("Also check the docs")
    await expect(button).toHaveAttribute("aria-disabled", "false")
    await user.click(button)
    await expect(args.onSubmit).toHaveBeenCalledWith(["Also check the docs"])
    await expect(button).toHaveAccessibleName("Send")
    await user.click(stop)
    await expect(args.onStop).toHaveBeenCalledTimes(1)
  },
}

/** The button names Enter's action and describes the modifier alternative. */
export const FollowUpQueue: Story = {
  args: { status: "running", followUps: true, followUp: "queue" },
  play: async ({ args, canvas }) => {
    const button = canvas.getByRole("button", { name: "Queue" })
    await expect(button).toHaveAttribute("data-follow-up", "queue")
    await expect(button.querySelector("svg")!.innerHTML).toBe(
      document.querySelector("[data-testid=queue-icon] svg")!.innerHTML
    )
    // Unavailable while the box is empty; with text, its tooltip.
    await user.click(canvas.getByRole("textbox", { name: "Message" }))
    await type("Later")
    await user.hover(button)
    await waitFor(
      async () => {
        await expect(
          document.querySelector("[data-slot=tooltip-content]")
        ).toHaveTextContent(/^Queue · (⌘|Ctrl)-click to steer$/)
      },
      { timeout: 2000 }
    )
    await expect(button).toHaveAccessibleDescription(
      /Queue · (⌘|Ctrl)-click to steer/
    )
    await user.unhover(button)
    await type("{Enter}")
    await expect(args.onSubmitOptions).toHaveBeenLastCalledWith({
      interrupt: false,
      followUp: "queue",
      talk: false,
    })
    await user.click(canvas.getByRole("button", { name: "Stop" }))
    await waitFor(async () => {
      await expect(button).toHaveAccessibleName("Send")
    })
    await expect(button).not.toHaveAttribute("data-follow-up")
  },
  render: (args) => (
    <>
      <Demo {...args} />
      <span hidden data-testid="queue-icon">
        <HugeiconsIcon icon={PlayListAddIcon} strokeWidth={2} />
      </span>
    </>
  ),
}

export const FollowUpSteer: Story = {
  args: { status: "running", followUps: true, followUp: "steer" },
  play: async ({ args, canvas }) => {
    const button = canvas.getByRole("button", { name: "Steer" })
    await expect(button).toHaveAttribute("data-follow-up", "steer")
    await expect(button.querySelector("svg")!.innerHTML).toBe(
      document.querySelector("[data-testid=steer-icon] svg")!.innerHTML
    )
    // Unavailable while the box is empty; with text, its tooltip.
    await user.click(canvas.getByRole("textbox", { name: "Message" }))
    await type("Now")
    await user.hover(button)
    await waitFor(
      async () => {
        await expect(
          document.querySelector("[data-slot=tooltip-content]")
        ).toHaveTextContent(/^Steer · (⌘|Ctrl)-click to queue$/)
      },
      { timeout: 2000 }
    )
    await expect(button).toHaveAccessibleDescription(
      /Steer · (⌘|Ctrl)-click to queue/
    )
    await user.unhover(button)
    await type("{Enter}")
    await expect(args.onSubmitOptions).toHaveBeenLastCalledWith({
      interrupt: false,
      followUp: "steer",
      talk: false,
    })
  },
  render: (args) => (
    <>
      <Demo {...args} />
      <span hidden data-testid="steer-icon">
        <HugeiconsIcon icon={CornerUpRightIcon} strokeWidth={2} />
      </span>
    </>
  ),
}

export const FollowUpModifierClick: Story = {
  args: { status: "running", followUps: true, followUp: "queue" },
  play: async ({ args, canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    const button = canvas.getByRole("button", { name: "Queue" })
    await user.click(editor)
    await type("Now")
    await user.keyboard("{Control>}")
    await user.click(button)
    await user.keyboard("{/Control}")
    await expect(args.onSubmitOptions).toHaveBeenLastCalledWith({
      interrupt: true,
      followUp: "steer",
      talk: false,
    })
    await expect(button).toHaveFocus()
    await user.click(editor)
    await type("Again{Control>}{Enter}{/Control}")
    await expect(args.onSubmitOptions).toHaveBeenLastCalledWith({
      interrupt: true,
      followUp: "steer",
      talk: false,
    })
    await user.click(editor)
    await type("Later")
    await user.click(button)
    await expect(args.onSubmitOptions).toHaveBeenLastCalledWith({
      interrupt: false,
      followUp: "queue",
      talk: false,
    })
    await expect(button).toHaveFocus()
  },
}

/** Without follow-ups, Enter does nothing while a response runs. */
export const Running: Story = {
  args: { status: "running" },
  play: async ({ args, canvas }) => {
    await user.click(canvas.getByRole("textbox", { name: "Message" }))
    await type("One more thing{Enter}")
    await expect(args.onSubmit).not.toHaveBeenCalled()
    const stop = canvas.getByRole("button", { name: "Stop" })
    await expect(stop).not.toHaveAttribute("aria-disabled", "true")
    // An outlined square, smaller than the send arrow, as in the design.
    await expect(stop.querySelector("svg")!.getBoundingClientRect().width).toBe(
      14
    )
  },
}

export const Stopping: Story = {
  args: { status: "stopping" },
  play: async ({ args, canvas }) => {
    await expect(canvas.getByRole("button", { name: "Stop" })).toHaveAttribute(
      "aria-disabled",
      "true"
    )
    await user.click(canvas.getByRole("textbox", { name: "Message" }))
    await type("{Escape}")
    await expect(args.onStop).not.toHaveBeenCalled()
  },
}

/** As on touch screens: Enter adds a line, the button sends. */
export const EnterAddsLine: Story = {
  args: { submitOnEnter: false },
  play: async ({ args, canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    // The on-screen keyboard's key says so.
    await expect(editor).toHaveAttribute("enterkeyhint", "enter")
    await user.click(editor)
    await type("First{Enter}Second")
    await expect(args.onSubmit).not.toHaveBeenCalled()
    await user.click(canvas.getByRole("button", { name: "Send" }))
    await expect(args.onSubmit).toHaveBeenCalledWith(["First\nSecond"])
  },
}

/** As a touch screen's pointer: `(pointer: coarse)` matches. */
const coarsePointer = () => {
  const matchMedia = window.matchMedia
  window.matchMedia = (query) =>
    query.includes("pointer: coarse")
      ? ({
          matches: true,
          media: query,
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => false,
        } satisfies MediaQueryList)
      : matchMedia.call(window, query)
  return () => {
    window.matchMedia = matchMedia
  }
}

/** A touch screen, by default: Enter adds a line, its key says "enter". */
export const TouchEnter: Story = {
  tags: ["!autodocs"],
  beforeEach: coarsePointer,
  play: async ({ args, canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    await expect(editor).toHaveAttribute("enterkeyhint", "enter")
    await user.click(editor)
    await type("First{Enter}Second")
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/**
 * A touch screen with `submitOnEnter` (e.g. the reader's setting): Enter
 * sends, its key says "send".
 */
export const TouchEnterSends: Story = {
  tags: ["!autodocs"],
  args: { submitOnEnter: true },
  beforeEach: coarsePointer,
  play: async ({ args, canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    await expect(editor).toHaveAttribute("enterkeyhint", "send")
    await user.click(editor)
    await type("Ship it{Enter}")
    await expect(args.onSubmit).toHaveBeenCalledWith(["Ship it"])
  },
}

const group = (element: HTMLElement) =>
  element.closest<HTMLElement>("[data-slot=input-group]")!

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ args, canvas, canvasElement }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    await expect(editor).toHaveAttribute("contenteditable", "false")
    await expect(editor).toHaveAttribute("aria-disabled", "true")
    // A disabled composer dims as a whole, once: its buttons not again.
    await expect(getComputedStyle(group(editor)).opacity).toBe("0.6")
    for (const name of ["Attach files", "Send"]) {
      await expect(
        getComputedStyle(canvas.getByRole("button", { name })).opacity
      ).toBe("1")
    }
    // It still says what it is for.
    await expect(within(group(editor)).getByText("Ask anything")).toBeVisible()
    // No files either, by any way.
    await expect(
      canvas.getByRole("button", { name: "Attach files" })
    ).toBeDisabled()
    paste(editor, transfer(["a.png"]))
    drag("drop", editor, transfer(["a.png"]))
    pick(canvasElement, ["a.png"])
    await expect(args.onAddFiles).not.toHaveBeenCalled()
  },
}

/** An unavailable button does not make the field look disabled. */
export const NotDimmed: Story = {
  play: async ({ canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    await expect(getComputedStyle(group(editor)).opacity).toBe("1")
  },
}

export const WithError: Story = {
  args: { error: "The agent is offline. Try again in a moment." },
  play: async ({ canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    await expect(editor).toHaveAttribute("aria-invalid", "true")
    await expect(editor).toHaveAccessibleDescription(
      "The agent is offline. Try again in a moment."
    )
  },
}

/** Long text grows the field up to eight lines, then scrolls. */
export const LongText: Story = {
  args: {
    initial: [Array.from({ length: 80 }, (_, i) => `Line ${i}`).join("\n")],
  },
  play: async ({ canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    const style = getComputedStyle(editor)
    await expect(editor.clientHeight).toBeCloseTo(
      8 * parseFloat(style.lineHeight) +
        parseFloat(style.paddingTop) +
        parseFloat(style.paddingBottom),
      0
    )
    await expect(editor.scrollHeight).toBeGreaterThan(editor.clientHeight)
  },
}

/**
 * Typing a trigger opens its suggestions; the editor keeps the focus and
 * points at the highlighted one. Choosing one makes a chip.
 */
export const Mention: Story = {
  play: async ({ args, canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    await user.click(editor)
    await type("Look at @app")
    await expect(args.onQueryChange).toHaveBeenLastCalledWith("app")

    const list = await canvas.findByRole("listbox", { name: "Files" })
    await expect(editor).toHaveAttribute("aria-controls", list.id)
    await expect(editor).toHaveAttribute("aria-autocomplete", "list")
    const options = canvas.getAllByRole("option")
    await expect(options).toHaveLength(2)
    await expect(options[0]).toHaveAttribute("aria-selected", "true")
    await expect(editor).toHaveAttribute(
      "aria-activedescendant",
      options[0]!.id
    )
    await expect(canvas.getByRole("status")).toHaveTextContent("2 suggestions")

    // The arrows move through them and wrap.
    await type("{ArrowDown}")
    await expect(editor).toHaveAttribute(
      "aria-activedescendant",
      options[1]!.id
    )
    await type("{ArrowDown}")
    await expect(options[0]).toHaveAttribute("aria-selected", "true")
    await type("{ArrowUp}")
    await expect(options[1]).toHaveAttribute("aria-selected", "true")

    // Enter chooses, and does not send.
    await type("{Enter}")
    await expect(args.onSubmit).not.toHaveBeenCalled()
    await expect(canvas.queryByRole("listbox")).toBeNull()
    await expect(editor).not.toHaveAttribute("aria-controls")
    await expect(editor).not.toHaveAttribute("aria-activedescendant")
    await expect(args.onQueryChange).toHaveBeenLastCalledWith(null)

    await type("please{Enter}")
    await expect(args.onSubmit).toHaveBeenCalledWith([
      "Look at ",
      mention("@", "file:2", "app.test.ts"),
      " please",
    ])
  },
}

/** Tab and a click choose too; Escape closes without stopping. */
export const MentionKeys: Story = {
  args: { status: "running", followUps: true },
  play: async ({ args, canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    await user.click(editor)
    await type("@read")
    await canvas.findByRole("listbox", { name: "Files" })
    await type("{Tab}")
    await expect(editor).toHaveFocus()
    await expect(
      editor.querySelector("[data-slot=composer-mention]")
    ).toHaveTextContent("README.md")

    await type("#")
    await canvas.findByRole("listbox", { name: "Conversations" })
    await type("{Escape}")
    await expect(canvas.queryByRole("listbox")).toBeNull()
    await expect(args.onStop).not.toHaveBeenCalled()
    // It stays closed while typing on in the same word.
    await type("fla")
    await expect(canvas.queryByRole("listbox")).toBeNull()

    // A new trigger opens it again; a click chooses.
    await type(" #fla")
    await user.click(await canvas.findByRole("option", { name: "Flaky test" }))
    await expect(editor).toHaveFocus()
    await type("{Enter}")
    await expect(args.onSubmit).toHaveBeenCalledWith([
      mention("@", "file:3", "README.md"),
      " #fla ",
      mention("#", "session:2", "Flaky test"),
      " ",
    ])
  },
}

/** A trigger starts a word, and a space ends the query. */
export const NotAMention: Story = {
  play: async ({ canvas }) => {
    await user.click(canvas.getByRole("textbox", { name: "Message" }))
    await type("sam@example.com")
    await rendered()
    await expect(canvas.queryByRole("listbox")).toBeNull()
    await type(" @app ")
    await rendered()
    await expect(canvas.queryByRole("listbox")).toBeNull()
  },
}

/**
 * A suggestion with `execute` runs when chosen, as a slash command: what
 * was typed for it goes, the rest stays, and nothing is sent. One without
 * it becomes a chip.
 */
export const ExecuteOnSelect: Story = {
  play: async ({ args, canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    await user.click(editor)
    await type("Then /cl")
    const list = await canvas.findByRole("listbox", { name: "Commands" })
    await expect(within(list).getAllByRole("option")).toHaveLength(1)
    await type("{Enter}")
    await waitFor(() => expect(args.onExecute).toHaveBeenCalledWith("clear"))
    await expect(args.onSubmit).not.toHaveBeenCalled()
    await expect(canvas.queryByRole("listbox")).toBeNull()
    await expect(editor).toHaveTextContent(/^Then$/)
    await expect(
      editor.querySelector("[data-slot=composer-mention]")
    ).toBeNull()
    // The caret is where the command began.
    await type("go")
    await expect(editor).toHaveTextContent(/^Then go$/)

    // A click runs one too; one without `execute` is a chip.
    await type(" /")
    await user.click(await canvas.findByRole("option", { name: /^\/compact/ }))
    await waitFor(() => expect(args.onExecute).toHaveBeenCalledWith("compact"))
    await type("/rev{Enter}")
    await expect(
      editor.querySelector("[data-slot=composer-mention]")
    ).toHaveTextContent("review")
    await expect(args.onExecute).toHaveBeenCalledTimes(2)
  },
}

/**
 * An item with `opens` opens a list of its own: "@" alone shows kinds,
 * a kind its items. The trigger and the caret stay; what is typed then
 * looks in that list. Left or Backspace with nothing typed, Escape, or
 * the row at its top go back a list; at the first, Escape closes. With a
 * query at the first list, the app's search over all.
 */
export const NestedSuggestions: Story = {
  args: { nested: true },
  play: async ({ args, canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    // Each row's label, without the line under it.
    const names = () =>
      canvas
        .getAllByRole("option")
        .map((option) => option.querySelector(".truncate")!.textContent)
    await user.click(editor)
    await type("Ask @")
    await canvas.findByRole("listbox", { name: "Files" })
    await expect(names()).toEqual([
      "New conversation",
      "Conversations",
      "Files",
    ])
    await expect(canvas.queryByRole("button", { name: /^Back/ })).toBeNull()

    // Enter opens a kind: its items, the "@" and the caret where they were.
    await type("{ArrowDown}{Enter}")
    await expect(args.onPathChange).toHaveBeenLastCalledWith(["kind:sessions"])
    await waitFor(() =>
      expect(names()).toEqual(["Release notes", "Flaky test"])
    )
    await expect(editor).toHaveTextContent(/^Ask @$/)
    await expect(args.onQueryChange).toHaveBeenLastCalledWith("")
    const back = canvas.getByRole("button", { name: "Back to Conversations" })
    await expect(back).toHaveTextContent("Conversations")
    await expect(canvas.getAllByRole("option")[0]).toHaveAttribute(
      "aria-selected",
      "true"
    )

    // What is typed looks in this list; Backspace deletes it, then goes back.
    await type("fla")
    await waitFor(() => expect(names()).toEqual(["Flaky test"]))
    await type("{Backspace}{Backspace}{Backspace}")
    await expect(names()).toEqual(["Release notes", "Flaky test"])
    await type("{Backspace}")
    await expect(args.onPathChange).toHaveBeenLastCalledWith([])
    await waitFor(() => expect(names()).toHaveLength(3))
    await expect(editor).toHaveTextContent(/^Ask @$/)

    // Left goes back, and Escape; at the first list, Escape closes.
    await type("{ArrowDown}{ArrowDown}{Enter}")
    await waitFor(() => expect(names()).toEqual(library.map((f) => f.label)))
    await type("{ArrowLeft}")
    await waitFor(() => expect(names()).toHaveLength(3))
    await type("{Enter}")
    await waitFor(() => expect(names()).toEqual(["Reviewer", "Planner"]))
    await type("{Escape}")
    await waitFor(() => expect(names()).toHaveLength(3))
    await type("{Escape}")
    await expect(canvas.queryByRole("listbox")).toBeNull()
    await expect(editor).toHaveTextContent(/^Ask @$/)

    // A tap opens a kind, and the row back: the editor keeps the focus.
    await type(" @")
    await user.click(await canvas.findByRole("option", { name: "Files" }))
    await expect(editor).toHaveFocus()
    await waitFor(() => expect(names()).toEqual(library.map((f) => f.label)))
    await user.click(canvas.getByRole("button", { name: "Back to Files" }))
    await expect(editor).toHaveFocus()
    await waitFor(() => expect(names()).toHaveLength(3))

    // Typed at the first list: the app's one search over all.
    await type("rel")
    await waitFor(() => expect(names()).toEqual(["Release notes"]))
    await type("{Enter}")
    await expect(
      [...editor.querySelectorAll("[data-slot=composer-mention]")].map(
        (chip) => chip.textContent
      )
    ).toEqual(["Release notes"])
    // Closed, it opens at the first list again.
    await type(" @")
    await waitFor(() => expect(names()).toHaveLength(3))
  },
}

/**
 * On a phone: the list as wide as the composer, as high as the room over
 * it in what is seen of the page, no keys in its footer; a tap on its
 * heading or its edge leaves the keyboard up.
 */
export const NestedSuggestionsPhone: Story = {
  args: { nested: true },
  globals: { viewport: { value: "phone", isRotated: false } },
  beforeEach: coarsePointer,
  play: async ({ canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    await user.click(editor)
    await type("@")
    const list = await suggestions(canvas)
    const box = list.offsetParent!.getBoundingClientRect()
    await waitFor(() =>
      expect(list.getBoundingClientRect().width).toBe(box.width)
    )
    await expect(list.getBoundingClientRect().left).toBe(box.left)
    const room = box.top - (window.visualViewport?.offsetTop ?? 0) - 16
    await expect(parseFloat(list.style.maxHeight)).toBe(Math.floor(room))
    const footer = list.querySelector(
      "[data-slot=composer-suggestions-footer]"
    )!
    await expect(footer.querySelector("[data-slot=kbd]")).toBeNull()
    await expect(footer).toHaveTextContent("Files")
    await user.click(canvas.getByRole("option", { name: "Conversations" }))
    await user.pointer({
      keys: "[MouseLeft]",
      target: list.querySelector("[data-slot=composer-suggestions-footer]")!,
    })
    await expect(editor).toHaveFocus()
  },
}

/** Enter confirms an input method's text; it does not choose. */
export const ComposingInSuggestions: Story = {
  play: async ({ canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    await user.click(editor)
    await type("@app")
    await canvas.findByRole("listbox", { name: "Files" })
    fireEvent.keyDown(editor, { key: "Enter", isComposing: true })
    fireEvent.keyDown(editor, { key: "Enter", keyCode: 229 })
    await expect(canvas.getByRole("listbox")).toBeVisible()
    await expect(
      editor.querySelector("[data-slot=composer-mention]")
    ).toBeNull()
  },
}

/** A chip is deleted as a whole, and undo brings it back. */
export const DeleteMention: Story = {
  args: { initial: ["See ", mention("@", "file:1", "app.ts")] },
  play: async ({ args, canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    const chip = () => editor.querySelector("[data-slot=composer-mention]")
    await expect(chip()).toHaveTextContent("app.ts")
    await expect(chip()).toHaveAttribute("contenteditable", "false")

    await user.click(editor)
    const paragraph = editor.firstElementChild!
    caret(paragraph, paragraph.childNodes.length)
    await rendered()
    // Backspace selects it, then removes it.
    await type("{Backspace}")
    await expect(chip()!.firstElementChild).toHaveAttribute("data-selected")
    await type("{Backspace}")
    await expect(chip()).toBeNull()
    await expect(editor).toHaveTextContent("See")

    await type(
      navigator.platform.startsWith("Mac")
        ? "{Meta>}z{/Meta}"
        : "{Control>}z{/Control}"
    )
    await waitFor(() => expect(chip()).not.toBeNull())
    await type("{Enter}")
    await expect(args.onSubmit).toHaveBeenCalledWith([
      "See ",
      mention("@", "file:1", "app.ts"),
    ])
  },
}

/** The state of an app's search: loading, failed, nothing found. */
export const SuggestionStates: Story = {
  args: { search: "loading" },
  play: async ({ canvas }) => {
    await user.click(canvas.getByRole("textbox", { name: "Message" }))
    await type("@app")
    const list = await suggestions(canvas)
    await expect(list).toHaveTextContent("Loading…")
    await expect(
      getComputedStyle(
        within(list).getByText("Loading…", { ignore: "[role=status]" })
      ).color
    ).toBe(resolve(list, "--muted-foreground"))
    await expect(canvas.getByRole("status")).toHaveTextContent("Loading…")
    await expect(canvas.queryAllByRole("option")).toHaveLength(0)
  },
}

export const SuggestionsFailed: Story = {
  args: { search: "failed" },
  play: async ({ canvas }) => {
    await user.click(canvas.getByRole("textbox", { name: "Message" }))
    await type("@app")
    const list = await suggestions(canvas)
    await expect(list).toHaveTextContent("Search failed. Try again.")
    // An error reads as one, unlike loading or nothing found.
    await expect(
      getComputedStyle(
        within(list).getByText("Search failed. Try again.", {
          ignore: "[role=status]",
        })
      ).color
    ).toBe(resolve(list, "--destructive"))
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Search failed. Try again."
    )
  },
}

export const NoSuggestions: Story = {
  play: async ({ args, canvas }) => {
    await user.click(canvas.getByRole("textbox", { name: "Message" }))
    await type("@zzz")
    await expect(await suggestions(canvas)).toHaveTextContent("No matches")
    // With nothing to choose, Enter sends.
    await type("{Enter}")
    await expect(args.onSubmit).toHaveBeenCalledWith(["@zzz"])
  },
}

/** The app inserts at the caret from outside: a quote, a restored file. */
export const Insert: Story = {
  args: { initial: ["Before after"] },
  play: async ({ args, canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    await user.click(editor)
    caret(editor.querySelector("[data-lexical-text]")!.firstChild!, 7)
    await rendered()
    await user.click(canvas.getByRole("button", { name: "Quote a message" }))
    await waitFor(() => expect(editor).toHaveFocus())
    await type("{Enter}")
    await expect(args.onSubmit).toHaveBeenCalledWith([
      "Before ",
      mention("@", "quote:1", "“The build is green”"),
      " after",
    ])
  },
}

/** A restored draft, chips and all; its plain text writes them out. */
export const Restore: Story = {
  args: {
    initial: [
      "Compare ",
      mention("@", "file:1", "app.ts"),
      " with ",
      mention("@", "file:1", "app.ts"),
      "\nfrom ",
      mention("#", "session:1", "Release notes"),
      " and ",
      { type: "attachment", id: "upload:9", name: "spec.pdf" },
      " per ",
      {
        type: "link",
        url: "https://vite.dev/guide/build",
        title: "Building for Production",
      },
    ],
  },
  play: async ({ args, canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    await expect(
      editor.querySelectorAll("[data-slot=composer-mention]")
    ).toHaveLength(3)
    await expect(
      editor.querySelector("[data-slot=composer-attachment]")
    ).toHaveTextContent("spec.pdf")
    await expect(
      editor.querySelector("[data-slot=composer-link]")
    ).toHaveTextContent("Building for Production")
    await expect(
      composerText(args.initial!, (chip) =>
        chip.type === "link" ? chip.url : `[${chip.id}]`
      )
    ).toBe(
      "Compare [file:1] with [file:1]\nfrom [session:1] and [upload:9] per https://vite.dev/guide/build"
    )
    // A mention as its trigger and label, a file as its name, a link as
    // its address.
    await expect(composerText(args.initial!)).toBe(
      "Compare @app.ts with @app.ts\nfrom #Release notes and spec.pdf per https://vite.dev/guide/build"
    )
  },
}

const quote = (n: number) => mention("@", `quote:${n}`, "“The build is green”")

/**
 * Chips show on the field in either theme, and keep the lines' rhythm: a
 * line with chips is as tall as one without, and wrapped chips do not
 * touch.
 */
export const ChipLines: Story = {
  args: {
    initial: [
      "One line\nthen ",
      ...[1, 2, 3, 4, 5].flatMap((n) => [quote(n), " "]),
      "\nlast line",
    ],
  },
  play: async ({ canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    const line = parseFloat(getComputedStyle(editor).lineHeight)
    const found = chips(editor)
    const tops = [
      ...new Set(found.map((chip) => chip.getBoundingClientRect().top)),
    ]
    await expect(tops.length).toBeGreaterThan(1)
    for (const chip of found) {
      await expect(chip.getBoundingClientRect().height).toBeLessThan(line)
    }
    // Rows of chips are a line apart, so there is a gap between them.
    for (const [index, top] of tops.slice(1).entries()) {
      await expect(top - tops[index]!).toBeCloseTo(line, 0)
    }
    // Every line, with chips or without, is one line high.
    await expect(
      editor.lastElementChild!.getBoundingClientRect().bottom -
        editor.firstElementChild!.getBoundingClientRect().top
    ).toBeCloseTo((tops.length + 2) * line, 0)

    // The chip stands out from the field by its fill (darker, in the dark
    // theme) or its edge; its text reads.
    const page = resolve(editor, "--background")
    const field = getComputedStyle(group(editor)).backgroundColor
    const element = found[0]!.querySelector("[data-slot=composer-chip]")!
    const chip = getComputedStyle(element)
    const under = luminance(page, field)
    const fill = luminance(page, field, chip.backgroundColor)
    // Its edge is an inset ring: the first colour of its shadows that shows.
    const ring = chip.boxShadow
      .match(/[a-z]+\([^()]*(?:\([^()]*\)[^()]*)*\)/g)!
      .find((color) => luminance("#fff", color) !== luminance("#fff"))!
    const edge = luminance(page, field, chip.backgroundColor, ring)
    await expect(
      Math.max(contrast(under, fill), contrast(under, edge))
    ).toBeGreaterThan(1.15)
    await expect(contrast(fill, luminance(chip.color))).toBeGreaterThan(4.5)
  },
}

/**
 * The attach button opens the file picker; the app turns picked files into
 * chips, which are deleted like any other.
 */
export const Attach: Story = {
  play: async ({ args, canvas, canvasElement }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    const input =
      canvasElement.querySelector<HTMLInputElement>("input[type=file]")!
    await expect(input).toHaveAttribute("multiple")
    const attach = canvas.getByRole("button", { name: "Attach files" })
    // Its icon starts where the text does, on the composer's leading line.
    await expect(
      attach.querySelector("svg")!.getBoundingClientRect().left
    ).toBeCloseTo(
      editor.getBoundingClientRect().left +
        parseFloat(getComputedStyle(editor).paddingLeft),
      0
    )
    const open = spyOn(input, "click").mockImplementation(() => {})
    await user.click(attach)
    await expect(open).toHaveBeenCalledTimes(1)

    pick(canvasElement, ["notes.pdf", "photo.png"])
    await expect(args.onAddFiles).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(chips(editor)).toHaveLength(2))
    await expect(chips(editor)[0]).toHaveTextContent("notes.pdf")
    // An image shows its picture; another file, an icon.
    await expect(chips(editor)[1]!.querySelector("img")).not.toBeNull()
    await expect(chips(editor)[0]!.querySelector("img")).toBeNull()
    // The picker is cleared, so the same file can be picked again.
    await expect(input.value).toBe("")

    await user.click(editor)
    const paragraph = editor.firstElementChild!
    caret(paragraph, paragraph.childNodes.length)
    await rendered()
    // The space after it, then the chip: selected, then removed.
    await type("{Backspace}{Backspace}")
    await expect(chips(editor)).toHaveLength(2)
    await type("{Backspace}")
    await expect(chips(editor)).toHaveLength(1)
    await type("{Enter}")
    await expect(args.onSubmit).toHaveBeenCalledWith([
      attachment("upload:0", "notes.pdf"),
      " ",
    ])
  },
}

/**
 * The app's shortcut opens the same picker as "+": `actionsRef`'s
 * `pickFiles()`, from the key's handler.
 */
export const PickFilesShortcut: Story = {
  play: async ({ args, canvas, canvasElement }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    const input =
      canvasElement.querySelector<HTMLInputElement>("input[type=file]")!
    const open = spyOn(input, "click").mockImplementation(() => {})
    await user.click(editor)
    await type("{Control>}u{/Control}")
    await expect(open).toHaveBeenCalledTimes(1)
    pick(canvasElement, ["notes.pdf"])
    await expect(args.onAddFiles).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(chips(editor)).toHaveLength(1))
  },
}

/** Files that do not match `accept` are handed over as rejected. */
export const Accept: Story = {
  args: { accept: "image/*, .PDF" },
  play: async ({ args, canvas, canvasElement }) => {
    await expect(
      canvasElement.querySelector("input[type=file]")
    ).toHaveAttribute("accept", "image/*, .PDF")
    pick(canvasElement, ["photo.png", "spec.pdf", "notes.txt"])
    const [accepted, rejected] = (args.onAddFiles as ReturnType<typeof fn>).mock
      .calls[0] as [File[], File[]]
    await expect(names(accepted)).toEqual(["photo.png", "spec.pdf"])
    await expect(names(rejected)).toEqual(["notes.txt"])
    await expect(
      canvas.getByText("notes.txt cannot be attached.")
    ).toBeVisible()
  },
}

/** Files alone can be sent, when the app allows it. */
export const FilesOnly: Story = {
  play: async ({ args, canvas, canvasElement }) => {
    const button = canvas.getByRole("button", { name: "Send" })
    await expect(button).toHaveAttribute("aria-disabled", "true")
    pick(canvasElement, ["photo.png"])
    await waitFor(() =>
      expect(button).not.toHaveAttribute("aria-disabled", "true")
    )
    await user.click(button)
    await expect(args.onSubmit).toHaveBeenCalledWith([
      attachment("upload:0", "photo.png"),
      " ",
    ])
  },
}

/**
 * Pasted files become chips at the caret; text pasted with them is still
 * pasted.
 */
export const Paste: Story = {
  args: { initial: ["See "] },
  play: async ({ args, canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    await user.click(editor)
    caret(editor.querySelector("[data-lexical-text]")!.firstChild!, 4)
    await rendered()
    await expect(paste(editor, transfer(["screenshot.png"]))).toBe(false)
    await expect(args.onAddFiles).toHaveBeenLastCalledWith(
      [expect.objectContaining({ name: "screenshot.png" })],
      []
    )
    await waitFor(() => expect(chips(editor)).toHaveLength(1))

    // An image copied from a page comes with its address; that is not text.
    const image = transfer(["logo.png"])
    image.setData("text/uri-list", "https://example.com/logo.png")
    await expect(paste(editor, image)).toBe(false)
    await waitFor(() => expect(chips(editor)).toHaveLength(2))

    paste(editor, transfer(["chart.png"], "for Q3"))
    await waitFor(() => expect(chips(editor)).toHaveLength(3))
    await waitFor(() => expect(editor).toHaveTextContent("for Q3"))

    // Text alone is left to the editor.
    paste(editor, transfer([], "!"))
    await expect(args.onAddFiles).toHaveBeenCalledTimes(3)
    await rendered()
    await type("{Enter}")
    await expect(args.onSubmit).toHaveBeenCalledWith([
      "See ",
      attachment("upload:0", "screenshot.png"),
      " ",
      attachment("upload:1", "logo.png"),
      " ",
      attachment("upload:2", "chart.png"),
      " for Q3!",
    ])
  },
}

/**
 * With `pasteAsFile`, long pasted text is added as a text file and becomes
 * a chip; shorter text is pasted as text.
 */
export const PasteLongText: Story = {
  args: { pasteAsFile: { minLength: 20 } },
  play: async ({ args, canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    await user.click(editor)
    await rendered()
    paste(editor, transfer([], "Short."))
    await waitFor(() => expect(editor).toHaveTextContent("Short."))
    await expect(args.onAddFiles).not.toHaveBeenCalled()

    const log = "line 1\nline 2\nline 3\nline 4\n"
    await expect(paste(editor, transfer([], log))).toBe(false)
    await waitFor(() => expect(chips(editor)).toHaveLength(1))
    await expect(editor).not.toHaveTextContent("line 1")
    const [file] = (args.onAddFiles as ReturnType<typeof fn>).mock
      .calls[0]![0] as File[]
    await expect(file!.name).toBe("Pasted text.txt")
    await expect(file!.type).toBe("text/plain")
    await expect(await file!.text()).toBe(log)
    await type("{Enter}")
    await expect(args.onSubmit).toHaveBeenCalledWith([
      "Short.",
      attachment("upload:0", "Pasted text.txt"),
      " ",
    ])
  },
}

/** Where the app does not take text files, long text is pasted as text. */
export const PasteLongTextNotTaken: Story = {
  args: { pasteAsFile: { minLength: 5 }, accept: "image/*" },
  play: async ({ args, canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    await user.click(editor)
    await rendered()
    paste(editor, transfer([], "A long enough text."))
    await waitFor(() => expect(editor).toHaveTextContent("A long enough text."))
    await expect(args.onAddFiles).not.toHaveBeenCalled()
  },
}

/** Without `onAddFiles`, long text is pasted as text. */
export const PasteLongTextNoFiles: Story = {
  args: { pasteAsFile: { minLength: 5 }, files: false },
  play: async ({ canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    await user.click(editor)
    await rendered()
    paste(editor, transfer([], "A long enough text."))
    await waitFor(() => expect(editor).toHaveTextContent("A long enough text."))
  },
}

/**
 * Dragging files over the input shows a drop target; dropped files become
 * chips where they were dropped.
 */
export const Drop: Story = {
  args: { initial: ["Before after"] },
  play: async ({ args, canvas, canvasElement }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    const form = canvasElement.querySelector("form")!
    // A drop target, its hairline darkens.
    const edge = getComputedStyle(group(editor)).boxShadow

    // Moving between elements inside keeps the target shown.
    drag("dragenter", form, transfer(["a.png"]))
    drag("dragenter", editor, transfer(["a.png"]))
    drag("dragleave", form, transfer(["a.png"]))
    await waitFor(() => expect(form).toHaveAttribute("data-dragging"))
    await expect(getComputedStyle(group(editor)).boxShadow).not.toBe(edge)
    await expect(drag("dragover", editor, transfer(["a.png"]))).toBe(false)
    drag("dragleave", editor, transfer(["a.png"]))
    await waitFor(() => expect(form).not.toHaveAttribute("data-dragging"))
    await expect(getComputedStyle(group(editor)).boxShadow).toBe(edge)

    drag("dragenter", editor, transfer(["a.png"]))
    await waitFor(() => expect(form).toHaveAttribute("data-dragging"))
    // Between "Before " and "after".
    const text = editor.querySelector("[data-lexical-text]")!.firstChild!
    const range = document.createRange()
    range.setStart(text, 7)
    const box = range.getClientRects()[0] ?? range.getBoundingClientRect()
    drag("drop", editor, transfer(["a.png", "b.pdf"]), {
      clientX: box.left + 1,
      clientY: box.top + box.height / 2,
    })
    await waitFor(() => expect(form).not.toHaveAttribute("data-dragging"))
    await expect(
      names(
        (args.onAddFiles as ReturnType<typeof fn>).mock.calls[0]![0] as File[]
      )
    ).toEqual(["a.png", "b.pdf"])
    await user.click(canvas.getByRole("button", { name: "Send" }))
    await expect(args.onSubmit).toHaveBeenCalledWith([
      "Before ",
      attachment("upload:0", "a.png"),
      " ",
      attachment("upload:1", "b.pdf"),
      " after",
    ])
  },
}

/**
 * Data of the app's own type, e.g. a file from a browser's list, is a drop
 * target too; what the app makes of it goes where it was dropped. Other
 * data is not.
 */
export const DropData: Story = {
  args: { initial: ["Before after"], dropData: true },
  // At the foot of its place, as an app's: grown, it would move its text.
  decorators: [
    (Story) => (
      <div className="flex h-96 flex-col justify-end">
        <Story />
      </div>
    ),
  ],
  play: async ({ args, canvas, canvasElement }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    const form = canvasElement.querySelector("form")!
    const path = () => {
      const data = new DataTransfer()
      data.setData("application/x-path", "src/deploy.ts")
      data.setData("text/plain", "src/deploy.ts")
      return data
    }

    drag("dragenter", editor, transfer([], "Hello"))
    await rendered()
    await expect(form).not.toHaveAttribute("data-dragging")
    drag("dragleave", editor, transfer([], "Hello"))

    // Where the reader aims, before the drag: the text stays there, not
    // covered nor moved, as it is dragged over.
    const text = editor.querySelector("[data-lexical-text]")!.firstChild!
    const range = document.createRange()
    range.setStart(text, 7)
    const box = range.getClientRects()[0] ?? range.getBoundingClientRect()
    const before = editor.getBoundingClientRect()
    drag("dragenter", editor, path())
    await waitFor(() => expect(form).toHaveAttribute("data-dragging"))
    await expect(drag("dragover", editor, path())).toBe(false)
    await expect(
      canvasElement.querySelector("[data-slot=composer-drop]")
    ).toBeNull()
    await expect(editor.getBoundingClientRect().toJSON()).toEqual(
      before.toJSON()
    )
    // Not dropped as text too.
    await expect(
      drag("drop", editor, path(), {
        clientX: box.left + 1,
        clientY: box.top + box.height / 2,
      })
    ).toBe(false)
    await waitFor(() => expect(form).not.toHaveAttribute("data-dragging"))
    await expect(args.onAddFiles).not.toHaveBeenCalled()
    await user.click(canvas.getByRole("button", { name: "Send" }))
    await expect(args.onSubmit).toHaveBeenCalledWith([
      "Before ",
      mention("@", "src/deploy.ts", "deploy.ts"),
      " after",
    ])
  },
}

/** Dragging something other than files is not a drop target for files. */
export const DragText: Story = {
  play: async ({ canvas, canvasElement }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    drag("dragenter", editor, transfer([], "Hello"))
    await rendered()
    await expect(canvasElement.querySelector("form")).not.toHaveAttribute(
      "data-dragging"
    )
  },
}

/**
 * The app's handlers run first; one that calls preventDefault() takes the
 * event, e.g. to handle its own kinds of data, and nothing is pasted.
 */
export const AppTakesEvents: Story = {
  args: {
    onPaste: (event) => event.preventDefault(),
    onDrop: (event) => event.preventDefault(),
  },
  play: async ({ args, canvas, canvasElement }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    await user.click(editor)
    paste(editor, transfer(["a.png"], "text"))
    const form = canvasElement.querySelector("form")!
    drag("dragenter", editor, transfer(["a.png"]))
    await waitFor(() => expect(form).toHaveAttribute("data-dragging"))
    drag("drop", editor, transfer(["a.png"]))
    await expect(args.onAddFiles).not.toHaveBeenCalled()
    await rendered()
    await expect(editor).toHaveTextContent("")
    // The drop target goes away all the same.
    await waitFor(() => expect(form).not.toHaveAttribute("data-dragging"))
  },
}

/** At the app's limit, only the attach button is disabled. */
export const FileLimit: Story = {
  args: { maxFiles: 1 },
  play: async ({ args, canvas, canvasElement }) => {
    const attach = canvas.getByRole("button", { name: "Attach files" })
    pick(canvasElement, ["a.png"])
    await waitFor(() => expect(attach).toBeDisabled())
    const editor = canvas.getByRole("textbox", { name: "Message" })
    await expect(editor).toHaveAttribute("contenteditable", "true")
    await user.click(editor)
    const paragraph = editor.firstElementChild!
    caret(paragraph, paragraph.childNodes.length)
    await rendered()
    await type("Hi{Enter}")
    await expect(args.onSubmit).toHaveBeenCalledWith([
      attachment("upload:0", "a.png"),
      " Hi",
    ])
  },
}

/** Without `onAddFiles` there is no attach button, and files are ignored. */
export const NoFiles: Story = {
  args: { files: false },
  play: async ({ args, canvas, canvasElement }) => {
    await expect(
      canvas.queryByRole("button", { name: "Attach files" })
    ).toBeNull()
    await expect(canvasElement.querySelector("input[type=file]")).toBeNull()
    const editor = canvas.getByRole("textbox", { name: "Message" })
    paste(editor, transfer(["a.png"]))
    drag("drop", editor, transfer(["a.png"]))
    await expect(args.onAddFiles).not.toHaveBeenCalled()
  },
}

/** A page that takes long to render each time the value changes. */
function SlowPage() {
  const [value, setValue] = React.useState<ComposerValue>([])
  // Busy, as a page of many conversations re-rendering might be.
  let busy = 0
  for (let step = 0; step < 15_000_000; step++) busy += Math.sqrt(step)
  return (
    <div
      data-busy={busy > 0 || undefined}
      className="flex w-md max-w-full flex-col gap-2"
    >
      <Composer value={value} onValueChange={setValue}>
        <ComposerEditor aria-label="Message" placeholder="Ask anything" />
      </Composer>
      <output aria-label="Value">{composerText(value)}</output>
    </div>
  )
}

/**
 * Typed fast on a page slow to render: no keystroke is lost to the value
 * the page renders a moment late.
 */
export const SlowPageTyping: Story = {
  render: () => <SlowPage />,
  play: async ({ canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    await user.click(editor)
    await waitFor(() => expect(editor).toHaveFocus())
    // At once, as fast as keys come.
    await user.keyboard("Add a health check to the deploy")
    await waitFor(() =>
      expect(canvas.getByRole("status", { name: "Value" })).toHaveTextContent(
        "Add a health check to the deploy"
      )
    )
    await expect(editor).toHaveTextContent("Add a health check to the deploy")
  },
}

/** A picture for an image's thumbnail. */
const picture = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="214"><defs><radialGradient id="g" cx=".7" cy=".35" r=".6"><stop offset="0" stop-color="#9f9fa6"/><stop offset="1" stop-color="#e4e4e7"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>'
)}`

const hero: ComposerAttachment = {
  type: "attachment",
  id: "upload:hero",
  name: "hero.png",
  mediaType: "image/png",
  preview: picture,
  detail: "1600 × 1067 · 412 KB",
}
const spec: ComposerAttachment = {
  type: "attachment",
  id: "upload:spec",
  name: "spec.pdf",
  mediaType: "application/pdf",
  detail: "12 pages",
}
const pastedText: ComposerAttachment = {
  type: "attachment",
  id: "upload:pasted",
  name: "Pasted text",
  mediaType: "text/plain",
  detail: "182 lines",
}
const pricing: ComposerAttachment = {
  type: "attachment",
  id: "upload:pricing",
  name: "pricing.tsx",
}
const viteLink: ComposerLink = {
  type: "link",
  url: "https://vite.dev/guide/build",
  ...pages["https://vite.dev/guide/build"],
}

const chipOf = (editor: HTMLElement, name: string) =>
  chips(editor)
    .map((chip) =>
      chip.querySelector<HTMLElement>("[data-slot=composer-chip]")!
    )
    .find((chip) => chip.textContent?.includes(name))!

/**
 * Files, links and mentions are chips in the text, where they came in; a
 * line with them is 28px, for their 24px. A short name takes its own
 * width.
 */
export const FilesInText: Story = {
  args: {
    full: true,
    initial: [
      "Make ",
      hero,
      " match ",
      spec,
      ", use the copy from ",
      pastedText,
      " and the layout in ",
      viteLink,
      ". Keep ",
      pricing,
      " as the entry.",
    ],
  },
  play: async ({ canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    await expect(chips(editor)).toHaveLength(5)
    await expect(getComputedStyle(editor).lineHeight).toBe("28px")
    const chip = chipOf(editor, "hero.png")
    await expect(chip.getBoundingClientRect().height).toBe(24)
    // A short name takes its own width, no more, before its detail.
    const name = chipOf(editor, "spec.pdf").querySelector("span")!
    await expect(name.getBoundingClientRect().width).toBeLessThan(64)
    await expect(name.scrollWidth).toBe(name.clientWidth)
    // An image's picture; another file's detail; a link's title and site.
    await expect(chip.querySelector("img")).not.toBeNull()
    await expect(chipOf(editor, "spec.pdf")).toHaveTextContent(
      "spec.pdf12 pages"
    )
    await expect(chipOf(editor, "Building")).toHaveTextContent(
      "Building for Productionvite.dev"
    )
  },
}

const uploadStates = {
  args: {
    initial: [
      "Compare ",
      { ...hero, id: "upload:mock", name: "mock-1.png", detail: "" },
      " with ",
      {
        type: "attachment",
        id: "upload:demo",
        name: "demo.mov",
        mediaType: "video/quicktime",
      },
      " and tell me what's off",
    ],
    uploads: {
      "upload:mock": { progress: 0.62 },
      "upload:demo": { error: "Too large · 48 MB" },
    },
  },
} satisfies Story

/**
 * An upload in progress shows a bar along the chip's foot; a failed one says
 * why. A click selects a chip and shows its card.
 */
export const UploadStates: Story = {
  ...uploadStates,
  args: { ...uploadStates.args, full: true },
  play: async ({ canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    const uploading = chipOf(editor, "mock-1.png")
    await expect(uploading).toHaveAttribute("data-state", "uploading")
    await expect(uploading).toHaveTextContent("mock-1.png62%")
    const bar = uploading.querySelector<HTMLElement>("[aria-hidden]")!
    await expect(
      bar.getBoundingClientRect().width /
        uploading.getBoundingClientRect().width
    ).toBeCloseTo(0.62, 1)

    const failed = chipOf(editor, "demo.mov")
    await expect(failed).toHaveAttribute("data-state", "error")
    await expect(failed).toHaveTextContent("demo.movToo large · 48 MB")

    // A click selects it; its card offers to try again or remove it.
    await user.click(failed)
    await waitFor(() => expect(failed).toHaveAttribute("data-selected"))
    const card = await waitFor(() =>
      within(
        canvas
          .getByText("Retry")
          .closest<HTMLElement>("[data-slot=composer-chip-card]")!
      )
    )
    await expect(card.getByText("Too large · 48 MB")).toBeVisible()
  },
}

/** A failed file's card tries it again, or removes it. */
export const RetryOrRemove: Story = {
  ...uploadStates,
  play: async ({ args, canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    await user.click(chipOf(editor, "demo.mov"))
    const card = await waitFor(() =>
      within(
        canvas
          .getByText("Retry")
          .closest<HTMLElement>("[data-slot=composer-chip-card]")!
      )
    )
    await user.click(card.getByRole("button", { name: "Retry" }))
    await expect(args.onRetryAttachment).toHaveBeenCalledWith(
      expect.objectContaining({ id: "upload:demo" })
    )
    await user.click(card.getByRole("button", { name: "Remove" }))
    await waitFor(() => expect(chips(editor)).toHaveLength(1))
    await expect(editor).toHaveFocus()
  },
}

/**
 * The keyboard: Backspace or an arrow selects a chip (its card shows);
 * Enter opens a selected file, the arrows step past it, and typing goes
 * after it.
 */
export const SelectChip: Story = {
  args: { initial: ["Make ", hero, " match"] },
  play: async ({ args, canvas, canvasElement }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    const chip = () => chipOf(editor, "hero.png")
    await user.click(editor)
    const after = editor.querySelectorAll("[data-lexical-text]")[1]!
    caret(after.firstChild!, 0)
    await rendered()

    await type("{Backspace}")
    await waitFor(() => expect(chip()).toHaveAttribute("data-selected"))
    const card = await waitFor(() =>
      canvas
        .getByRole("button", { name: "Remove" })
        .closest<HTMLElement>("[data-slot=composer-chip-card]")!
    )
    await expect(within(card).getByText("1600 × 1067 · 412 KB")).toBeVisible()
    // There is no caret on it to read it out; it is announced.
    await expect(
      canvasElement.querySelector("form [aria-live]")
    ).toHaveTextContent("hero.png, 1600 × 1067 · 412 KB, selected")
    await expect(
      within(card).getByRole("button", { name: "Open" })
    ).toBeVisible()
    // Enter opens it, and does not send.
    await type("{Enter}")
    await expect(args.onOpenAttachment).toHaveBeenCalledWith(hero)
    await expect(args.onSubmit).not.toHaveBeenCalled()

    // The arrows step past it, then onto it again.
    await type("{ArrowRight}")
    await expect(chip()).not.toHaveAttribute("data-selected")
    await expect(canvas.queryByRole("button", { name: "Remove" })).toBeNull()
    await type("{ArrowLeft}")
    await expect(chip()).toHaveAttribute("data-selected")
    await type("{ArrowLeft}")
    await expect(chip()).not.toHaveAttribute("data-selected")
    await type("X")
    await type("{ArrowRight}")
    await expect(chip()).toHaveAttribute("data-selected")
    // Typing on it types after it.
    await type("!")
    await expect(chips(editor)).toHaveLength(1)
    await type("{Enter}")
    await expect(args.onSubmit).toHaveBeenCalledWith([
      "Make X",
      hero,
      "! match",
    ])
  },
}

/**
 * A pasted address shows while the app resolves it, then its title. A bar
 * offers it as a link, a preview or plain text; Escape puts the bar away.
 */
export const PasteLink: Story = {
  args: { full: true, links: "hold" },
  beforeEach: () => holdLinks(),
  play: async ({ args, canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    await user.click(editor)
    await type("Read ")
    await expect(
      paste(editor, transfer([], "https://vite.dev/guide/build"))
    ).toBe(false)
    const link = () =>
      editor.querySelector<HTMLElement>(
        "[data-slot=composer-link] [data-slot=composer-chip]"
      )
    await waitFor(() =>
      expect(link()).toHaveAttribute("data-state", "resolving")
    )
    await expect(link()).toHaveTextContent("vite.dev/guide/build")
    const bar = await canvas.findByRole("group", { name: "Paste as" })
    await expect(
      within(bar).getByRole("button", { name: "Link" })
    ).toHaveAttribute("aria-pressed", "true")

    releaseLinks()
    await waitFor(() =>
      expect(link()).toHaveTextContent("Building for Productionvite.dev")
    )
    await expect(link()).not.toHaveAttribute("data-state")

    // As plain text, then back.
    await user.click(within(bar).getByRole("button", { name: "Plain text" }))
    await waitFor(() => expect(link()).toBeNull())
    await expect(editor).toHaveTextContent("Read https://vite.dev/guide/build")
    await user.click(within(bar).getByRole("button", { name: "Link" }))
    await waitFor(() =>
      expect(link()).toHaveTextContent("Building for Production")
    )
    await user.click(within(bar).getByRole("button", { name: "Preview" }))
    await expect(
      within(bar).getByRole("button", { name: "Preview" })
    ).toHaveAttribute("aria-pressed", "true")
    await type("{Escape}")
    await waitFor(() =>
      expect(canvas.queryByRole("group", { name: "Paste as" })).toBeNull()
    )
    await expect(editor).toHaveFocus()

    await type(" now{Enter}")
    await expect(args.onSubmit).toHaveBeenCalledWith([
      "Read ",
      { ...viteLink, preview: true },
      " now",
    ])
  },
}

/**
 * A pasted address while the app resolves it: a grey chip with a spinner
 * and the address, the text going on around it. The app never answers
 * here, so it stays so.
 */
export const PasteLinkResolving: Story = {
  args: { full: true, links: "hold" },
  beforeEach: () => holdLinks(),
  play: async ({ canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    await user.click(editor)
    await type("Read ")
    paste(editor, transfer([], "https://vite.dev/guide/build"))
    const link = () =>
      editor.querySelector<HTMLElement>(
        "[data-slot=composer-link] [data-slot=composer-chip]"
      )
    await waitFor(() =>
      expect(link()).toHaveAttribute("data-state", "resolving")
    )
    // Typing on puts the bar away; the chip still resolves.
    await type(" and apply it to our config")
    await waitFor(() =>
      expect(canvas.queryByRole("group", { name: "Paste as" })).toBeNull()
    )
    await expect(link()).toHaveAttribute("data-state", "resolving")
    await expect(editor).toHaveTextContent(
      "Read vite.dev/guide/build and apply it to our config"
    )
  },
}

/**
 * An address the app cannot resolve stays as text, and the bar goes; the
 * next key puts the bar away too.
 */
export const PasteLinkFails: Story = {
  args: { links: "resolve" },
  play: async ({ args, canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    await user.click(editor)
    paste(editor, transfer([], "https://example.com/nothing"))
    await waitFor(() =>
      expect(editor).toHaveTextContent("https://example.com/nothing")
    )
    await waitFor(() =>
      expect(editor.querySelector("[data-slot=composer-link]")).toBeNull()
    )
    await expect(canvas.queryByRole("group", { name: "Paste as" })).toBeNull()

    await type(" ")
    paste(editor, transfer([], "https://vite.dev/guide/build"))
    await canvas.findByRole("group", { name: "Paste as" })
    await type(" ok")
    await expect(canvas.queryByRole("group", { name: "Paste as" })).toBeNull()

    // Text with an address in it is text.
    paste(editor, transfer([], " see https://vite.dev"))
    await rendered()
    await type("{Enter}")
    await expect(args.onSubmit).toHaveBeenCalledWith([
      "https://example.com/nothing ",
      viteLink,
      " ok see https://vite.dev",
    ])
  },
}

/**
 * The app's own kinds of link, e.g. a pull request with its state, have
 * the app's icons; pointing at one shows its card, which can show it as
 * its address again.
 */
export const LinkKinds: Story = {
  args: {
    full: true,
    initial: [
      "Fix the review comments on ",
      {
        type: "link",
        url: "https://github.com/acme/web/pull/128",
        ...pages["https://github.com/acme/web/pull/128"],
      },
      " and close ",
      {
        type: "link",
        url: "https://github.com/acme/web/issues/131",
        title: "#131",
        detail: "Bug",
        kind: "issue",
      },
      ", see ",
      viteLink,
    ],
  },
  play: async ({ canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    const pr = chipOf(editor, "#128")
    await expect(pr).toHaveTextContent("#128 Graphite theme tokensOpen")
    await expect(pr.querySelector("svg path")?.getAttribute("d")).toBe(
      GitPullRequestIcon[0]?.[1].d
    )

    const vite = chipOf(editor, "Building")
    await user.hover(vite)
    const card = await canvas.findByText(
      "When it is time to deploy your app for production, run the vite build command."
    )
    const box = card.closest<HTMLElement>("[data-slot=composer-chip-card]")!
    // Its host, with when it was fetched; its edge on the chip's.
    await expect(box).toHaveTextContent("vite.dev · fetched 12:04")
    await waitFor(() =>
      expect(box.getBoundingClientRect().left).toBeCloseTo(
        vite.getBoundingClientRect().left,
        0
      )
    )
    const actions = within(box)
    await expect(actions.getByRole("link", { name: "Open" })).toHaveAttribute(
      "href",
      "https://vite.dev/guide/build"
    )
    await user.click(actions.getByRole("button", { name: "Show as URL" }))
    await waitFor(() =>
      expect(editor).toHaveTextContent(", see https://vite.dev/guide/build")
    )
    await expect(chips(editor)).toHaveLength(2)
  },
}

/**
 * Where the text cannot hold them, files show in a row above it, out of
 * the text, as the text's chips (`variant="chip"`); a row that does not
 * fit on one line ends in "+N".
 */
export const Row: Story = {
  args: {
    full: true,
    placement: "row",
    variant: "chip",
    initial: [
      hero,
      spec,
      pastedText,
      { ...hero, id: "upload:mock", name: "mock-1.png", detail: "" },
      pricing,
      { ...spec, id: "upload:spec-2", name: "spec-2.pdf" },
      { ...hero, id: "upload:logo", name: "logo.png", detail: "" },
      "Use these for the pricing page",
    ],
    uploads: { "upload:mock": { progress: 0.62 } },
  },
  play: async ({ canvas, canvasElement }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    const row = canvasElement.querySelector<HTMLElement>(
      "[data-slot=composer-attachments]"
    )!
    await expect(chips(editor)).toHaveLength(0)
    await expect(editor).toHaveTextContent("Use these for the pricing page")
    const more = await within(row).findByRole("button", {
      name: /^Show \d more$/,
    })
    const shown = row.querySelectorAll("[data-slot=composer-chip]").length
    await expect(more).toHaveTextContent(`+${7 - shown}`)
    const tops = new Set(
      Array.from(row.children, (child) => (child as HTMLElement).offsetTop)
    )
    await expect(tops.size).toBe(1)
    // As in a line of text: 24px, radius 6; as many as fit (how many is
    // the font's), and the "+N".
    await expect(shown).toBeGreaterThan(1)
    await expect(shown).toBeLessThan(7)
    const first = row.querySelector<HTMLElement>("[data-slot=composer-chip]")!
    await expect(first.getBoundingClientRect().height).toBe(24)
    await expect(getComputedStyle(first).borderRadius).toBe("6px")
    await expect(more.getBoundingClientRect().height).toBe(24)

    // Its remove button shows only on a hover or focus.
    const remove = within(first).getByRole("button", {
      name: "Remove hero.png",
    })
    await expect(getComputedStyle(remove).opacity).toBe("0")
    // Backspace on it removes it, focus going on to the next.
    remove.focus()
    await waitFor(() => expect(getComputedStyle(remove).opacity).toBe("1"))
    await user.keyboard("{Backspace}")
    await waitFor(() =>
      expect(
        within(row).queryByRole("button", { name: "Remove hero.png" })
      ).toBeNull()
    )
    await waitFor(() =>
      expect(
        row
          .querySelector("[data-slot=composer-chip]")!
          .contains(document.activeElement)
      ).toBe(true)
    )
  },
}

/** Files picked go to the row; "+N" shows them all; each can be removed. */
export const RowFiles: Story = {
  args: {
    placement: "row",
    initial: ["Use these for the pricing page"],
    uploads: {
      "upload:3": { progress: 0.62 },
      "upload:6": { error: "Too large · 48 MB" },
    },
  },
  play: async ({ args, canvas, canvasElement }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    pick(canvasElement, [
      "hero.png",
      "spec.pdf",
      "notes.txt",
      "mock-1.png",
      "pricing.tsx",
      "chart.png",
      "logo.png",
      "architecture.pdf",
      "release-notes.txt",
      "data.csv",
    ])
    const row = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLElement>(
        "[data-slot=composer-attachments]"
      )
      expect(element).not.toBeNull()
      return element!
    })
    // Not in the text, and the text keeps its place.
    await expect(chips(editor)).toHaveLength(0)
    const more = await within(row).findByRole("button", {
      name: /^Show \d more$/,
    })
    const card = "[data-slot=composer-attachment-card]"
    const shown = row.querySelectorAll(card).length
    await expect(more).toHaveTextContent(`+${6 - shown}`)
    await expect(
      row.querySelectorAll("[data-slot=composer-attachment-tile-item]")
    ).toHaveLength(4)
    await expect(
      row.querySelector("[data-slot=composer-attachment-progress]")
    ).not.toBeNull()
    // Cards stay on one line.
    const tops = new Set(
      Array.from(
        row.querySelector("[data-slot=composer-attachment-cards]")!.children,
        (child) => (child as HTMLElement).offsetTop
      )
    )
    await expect(tops.size).toBe(1)

    await user.click(more)
    await waitFor(() => expect(row.querySelectorAll(card)).toHaveLength(6))
    await user.click(
      within(row).getByRole("button", { name: "Remove notes.txt" })
    )
    await waitFor(() =>
      expect(
        row.querySelectorAll("[data-slot=composer-attachment-card]")
      ).toHaveLength(5)
    )

    // A failed file: its edge dashed, its error under its name, a Retry
    // after it. Backspace removes it; focus goes to the next displayed file.
    const failed = within(row)
      .getByText("logo.png")
      .closest<HTMLElement>("[data-slot=composer-attachment-tile-item]")!
    await expect(getComputedStyle(failed).borderTopStyle).toBe("dashed")
    await expect(
      within(failed).getByRole("button", { name: "logo.png" })
    ).toHaveAccessibleDescription("Too large · 48 MB")
    await expect(
      getComputedStyle(failed.querySelector("[data-slot=attachment-actions]")!)
        .opacity
    ).toBe("1")
    await expect(failed.querySelector(".text-destructive svg")).not.toBeNull()
    const retry = within(failed).getByRole("button", { name: "Retry logo.png" })
    await user.click(retry)
    await expect(args.onRetryAttachment).toHaveBeenCalledWith(
      attachment("upload:6", "logo.png")
    )
    await expect(retry).toHaveFocus()
    await user.keyboard("{Backspace}")
    await waitFor(() =>
      expect(
        row.querySelectorAll("[data-slot=composer-attachment-tile-item]")
      ).toHaveLength(3)
    )
    await waitFor(() =>
      expect(
        within(row).getByRole("button", { name: /^spec.pdf/ })
      ).toHaveFocus()
    )

    await user.click(canvas.getByRole("button", { name: "Send" }))
    const [sent] = (args.onSubmit as ReturnType<typeof fn>).mock.calls[0] as [
      ComposerValue,
    ]
    await expect(sent.at(-1)).toBe("Use these for the pricing page")
    await expect(sent.slice(0, 2)).toEqual([
      attachment("upload:0", "hero.png"),
      attachment("upload:1", "spec.pdf"),
    ])
    await expect(sent).toHaveLength(9)
  },
}

/**
 * Inline, files dropped on the text go where they were dropped; dropped
 * around it, with no place in it, they go to the row.
 */
export const DropAroundText: Story = {
  args: { full: true, placement: "inline", initial: ["Before after"] },
  play: async ({ canvas, canvasElement }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    const form = canvasElement.querySelector("form")!
    const send = canvas
      .getByRole("button", { name: "Send" })
      .getBoundingClientRect()
    drag("dragenter", form, transfer(["a.png"]))
    drag("drop", form, transfer(["a.png"]), {
      clientX: send.left - 40,
      clientY: send.top + send.height / 2,
    })
    const row = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLElement>(
        "[data-slot=composer-attachments]"
      )
      expect(element).not.toBeNull()
      return element!
    })
    await expect(row).toHaveTextContent("a.png")
    await expect(chips(editor)).toHaveLength(0)

    const text = editor.querySelector("[data-lexical-text]")!.firstChild!
    const range = document.createRange()
    range.setStart(text, 7)
    const box = range.getClientRects()[0] ?? range.getBoundingClientRect()
    drag("drop", editor, transfer(["b.pdf"]), {
      clientX: box.left + 1,
      clientY: box.top + box.height / 2,
    })
    await waitFor(() => expect(chips(editor)).toHaveLength(1))
    await expect(
      row.querySelectorAll("[data-slot=composer-attachment-tile-item]")
    ).toHaveLength(1)
  },
}

/** With `windowDrops`, files dropped anywhere on the page go to the row. */
export const WindowDrops: Story = {
  args: { placement: "inline", windowDrops: true },
  play: async ({ canvasElement }) => {
    await expect(drag("dragover", document.body, transfer(["page.png"]))).toBe(
      false
    )
    await expect(drag("drop", document.body, transfer(["page.png"]))).toBe(
      false
    )
    await waitFor(() =>
      expect(
        canvasElement.querySelector("[data-slot=composer-attachments]")
      ).toHaveTextContent("page.png")
    )
  },
}

const releaseNotes = [
  "## Release notes for v0.1.9",
  "",
  "This release moves the conversation and the right panel onto one surface and adds a rail of the app's areas beside the sidebar. The composer queues a message while a turn runs, and every popover now shares one row style.",
  "",
  "- Bundle: 412 KB → 96 KB",
  "- First load: 1.8 s → 0.9 s",
  "- The Preview tab is now Browser",
  "",
  "### Upgrade",
  "",
  "Run the update and check the theme.",
].join("\n")

const releaseLink: ComposerLink = {
  type: "link",
  url: "https://github.com/acme/web/releases/tag/v0.1.9",
  title: "v0.1.9",
  detail: "Release",
  kind: "release",
}

/** A draft in Markdown: headings, a list, a code block, a chip. */
const releaseDraft: ComposerValue = [
  [
    "## Release notes for v0.1.9",
    "",
    "This release moves the conversation and the right panel onto one surface and adds a rail of the app's areas beside the sidebar. The composer queues a message while a turn runs; ⌘↵ interrupts.",
    "",
    "- Bundle: 412 KB → 96 KB",
    "- First load: 1.8 s → 0.9 s",
    "- The Preview tab is now Browser",
    "",
    "### Upgrade",
    "",
    "```sh",
    "pnpm dlx shadcn@latest add @agentui/composer",
    "```",
    "",
    "Read the full notes at ",
  ].join("\n"),
  releaseLink,
  ".",
]

/** The text node in the editor that holds `text`. */
const run = (editor: HTMLElement, text: string) =>
  Array.from(editor.querySelectorAll<HTMLElement>("[data-lexical-text]")).find(
    (node) => node.textContent === text
  )!

const mac = () => navigator.platform.startsWith("Mac")

/**
 * Past eight lines the text scrolls and an expand button shows (its
 * shortcut in its tooltip). Expanded, the editor is a page of writing with
 * its word count and a preview; Escape or the shortcut collapses it, and
 * the text stays.
 */
/** The preview takes Markdown's props: its headings under the page's. */
export const ExpandPreviewProps: Story = {
  args: {
    full: true,
    initial: [releaseNotes],
    previewProps: { headingOffset: 2 },
  },
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(await canvas.findByRole("button", { name: "Expand" }))
    await waitFor(() =>
      expect(canvasElement.querySelector("form")).toHaveAttribute(
        "data-expanded"
      )
    )
    await userEvent.click(canvas.getByRole("tab", { name: "Preview" }))
    await expect(
      await canvas.findByRole(
        "heading",
        { name: "Release notes for v0.1.9", level: 4 },
        { timeout: 5000 }
      )
    ).toBeVisible()
  },
}

export const Expand: Story = {
  args: { full: true, initial: [releaseNotes] },
  play: async ({ canvas, canvasElement }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    const field = group(editor)
    const expand = await canvas.findByRole("button", { name: "Expand" })
    await expect(expand).toHaveAttribute(
      "aria-keyshortcuts",
      "Control+Shift+E Meta+Shift+E"
    )
    await user.hover(expand)
    const tip = await waitFor(
      () => {
        const element = document.querySelector("[data-slot=tooltip-content]")
        expect(element).not.toBeNull()
        return element
      },
      { timeout: 2000 }
    )
    await expect(tip).toHaveTextContent(/^Expand(⌘⇧E|Ctrl\+Shift\+E)$/)
    await user.unhover(expand)
    const collapsed = field.getBoundingClientRect().height

    await user.click(expand)
    await waitFor(() =>
      expect(canvasElement.querySelector("form")).toHaveAttribute(
        "data-expanded"
      )
    )
    await expect(field.getBoundingClientRect().height).toBeGreaterThan(
      collapsed + 100
    )
    await expect(editor).toHaveFocus()
    const header = canvasElement.querySelector<HTMLElement>(
      "[data-slot=composer-header]"
    )!
    await expect(header).toHaveTextContent("Draft·")
    await expect(header).toHaveTextContent(/\d+ words/)
    // Nothing scrolls out of sight.
    await expect(editor.scrollHeight).toBeLessThanOrEqual(editor.clientHeight)

    await user.click(canvas.getByRole("tab", { name: "Preview" }))
    // Markdown loads the first time a draft is previewed.
    await expect(
      await canvas.findByRole(
        "heading",
        { name: "Release notes for v0.1.9" },
        { timeout: 5000 }
      )
    ).toBeVisible()
    // The panels swap as the tab's state lands, a moment later when slow.
    await waitFor(() => expect(editor).not.toBeVisible())
    await user.click(canvas.getByRole("tab", { name: "Write" }))
    await waitFor(() => expect(editor).toBeVisible())

    await user.click(editor)
    await type("{Escape}")
    await waitFor(() =>
      expect(canvasElement.querySelector("form")).not.toHaveAttribute(
        "data-expanded"
      )
    )
    await expect(editor).toHaveTextContent("Release notes for v0.1.9")
    await type("{Control>}{Shift>}E{/Shift}{/Control}")
    await waitFor(() =>
      expect(canvasElement.querySelector("form")).toHaveAttribute(
        "data-expanded"
      )
    )
    await type("{Meta>}{Shift>}E{/Shift}{/Meta}")
    await waitFor(() =>
      expect(canvasElement.querySelector("form")).not.toHaveAttribute(
        "data-expanded"
      )
    )
  },
}

/** Expanded while a response runs, Escape collapses; it does not stop. */
export const ExpandedWhileRunning: Story = {
  args: { initial: [releaseNotes], status: "running" },
  play: async ({ args, canvas, canvasElement }) => {
    await user.click(await canvas.findByRole("button", { name: "Expand" }))
    await waitFor(() =>
      expect(canvasElement.querySelector("form")).toHaveAttribute(
        "data-expanded"
      )
    )
    await type("{Escape}")
    await waitFor(() =>
      expect(canvasElement.querySelector("form")).not.toHaveAttribute(
        "data-expanded"
      )
    )
    await expect(args.onStop).not.toHaveBeenCalled()
    await type("{Escape}")
    await expect(args.onStop).toHaveBeenCalledTimes(1)
  },
}

/** Without a placeholder of the app's, the box is empty: no words of its own. */
export const NoPlaceholder: Story = {
  render: () => (
    <Composer className="w-md">
      <ComposerEditor aria-label="Message" />
    </Composer>
  ),
  play: async ({ canvas, canvasElement }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    await expect(editor).not.toHaveAttribute("aria-placeholder")
    await expect(canvasElement.innerText.trim()).toBe("")
  },
}

/** To a finger, the composer's buttons are 40px or more. */
export const Touch: Story = {
  args: {
    initial: [releaseNotes],
    placement: "row",
  },
  play: async ({ canvas, canvasElement }) => {
    pick(canvasElement, ["a.png"])
    const buttons = [
      canvas.getByRole("button", { name: "Attach files" }),
      canvas.getByRole("button", { name: "Send" }),
      await canvas.findByRole("button", { name: "Expand" }),
      await canvas.findByRole("button", { name: "Remove a.png" }),
    ]
    for (const button of buttons) {
      const size = coarseHitSize(button)
      await expect(Math.min(size.width, size.height)).toBeGreaterThanOrEqual(40)
    }
  },
}

/**
 * A sent message keeps its chips where they were; a file's opens it, a
 * link's opens its page.
 */
export const Sent: Story = {
  render: (args) => (
    <div className="flex w-md justify-end">
      <div className="rounded-xl bg-muted px-3 py-2 text-sm">
        <ComposerMessage
          value={[
            "Make ",
            hero,
            " match ",
            spec,
            ", use the copy from ",
            pastedText,
            " and keep ",
            pricing,
            " as the entry, per ",
            viteLink,
            ".",
          ]}
          onOpen={(chip) => {
            if (chip.type === "attachment") args.onOpenAttachment(chip)
          }}
          renderLinkIcon={linkIcon}
        />
      </div>
    </div>
  ),
  play: async ({ args, canvas }) => {
    await user.click(canvas.getByRole("button", { name: /spec\.pdf/ }))
    await expect(args.onOpenAttachment).toHaveBeenCalledWith(spec)
    await expect(
      canvas.getByRole("link", { name: /Building for Production/ })
    ).toHaveAttribute("href", "https://vite.dev/guide/build")
    const chip = canvas
      .getByRole("button", { name: /hero\.png/ })
      .querySelector("[data-slot=composer-chip]")!
    await expect(chip.getBoundingClientRect().height).toBe(24)
  },
}

/** The bar after a pasted address, over its resolved chip. */
export const PasteAsBar: Story = {
  args: { full: true, links: "resolve", initial: ["Compare with "] },
  play: async ({ canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    await user.click(editor)
    const paragraph = editor.firstElementChild!
    caret(paragraph, paragraph.childNodes.length)
    await rendered()
    paste(editor, transfer([], "https://rollupjs.org/configuration-options/"))
    const bar = await canvas.findByRole("group", { name: "Paste as" })
    await waitFor(() =>
      expect(editor).toHaveTextContent("Configuration Options")
    )
    // Over the chip it is about.
    const chip = chipOf(editor, "Configuration Options").getBoundingClientRect()
    await expect(bar.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      chip.top
    )
  },
}

/**
 * Expanded: a page of writing, with its word count, and its tabs. Its
 * Markdown is styled as typed, the marks kept: a heading semibold, its #s
 * and a list's markers muted, code in mono, paragraphs 12px apart.
 */
export const Expanded: Story = {
  args: {
    full: true,
    placement: "row",
    variant: "chip",
    initial: [
      { ...hero, id: "upload:notes", name: "release-notes.png", detail: "" },
      {
        type: "attachment",
        id: "upload:changelog",
        name: "CHANGELOG.md",
        detail: "3 KB",
      },
      ...releaseDraft,
    ],
  },
  play: async ({ canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    // Collapsed, it is plain text.
    await expect(
      getComputedStyle(run(editor, "Release notes for v0.1.9")).fontWeight
    ).toBe("400")

    await user.click(await canvas.findByRole("button", { name: "Expand" }))
    await expect(
      await canvas.findByRole("tab", { name: "Write", selected: true })
    ).toBeVisible()
    const header = editor
      .closest("form")!
      .querySelector<HTMLElement>("[data-slot=composer-header]")!
    await expect(getComputedStyle(header).fontSize).toBe("13px")

    const heading = run(editor, "Release notes for v0.1.9")
    await waitFor(() =>
      expect(getComputedStyle(heading).fontWeight).toBe("600")
    )
    const muted = resolve(editor, "--subtle-foreground")
    for (const mark of ["## ", "- ", "### "])
      await expect(getComputedStyle(run(editor, mark)).color).toBe(muted)
    await expect(getComputedStyle(run(editor, "Upgrade")).fontWeight).toBe(
      "600"
    )
    const code = getComputedStyle(
      run(editor, "pnpm dlx shadcn@latest add @agentui/composer")
    )
    // The theme's mono, as this browser writes it.
    const probe = document.createElement("span")
    probe.className = "font-mono"
    editor.parentElement!.append(probe)
    const mono = getComputedStyle(probe).fontFamily
    probe.remove()
    await expect(code.fontFamily).toBe(mono)
    await expect(code.lineHeight).toBe("20px")
    await expect(code.color).toBe(resolve(editor, "--muted-foreground"))
    await expect(getComputedStyle(run(editor, "```sh")).fontFamily).toBe(
      code.fontFamily
    )

    // A heading to its paragraph: its line and a blank one, 24 + 12px.
    const top = (text: string) => run(editor, text).getBoundingClientRect().top
    const paragraph = run(editor, releaseDraft[0]!.toString().split("\n")[2]!)
    await expect(
      Math.round(
        paragraph.getBoundingClientRect().top -
          heading.getBoundingClientRect().top
      )
    ).toBe(36)
    // A list's lines, 24px apart.
    await expect(
      Math.round(
        top("First load: 1.8 s → 0.9 s") - top("Bundle: 412 KB → 96 KB")
      )
    ).toBe(24)
  },
}

/**
 * The word count counts words as their language has them: a line of
 * Chinese (or Japanese), with no spaces, is its words, not one; the count follows the
 * typing.
 */
export const ExpandedWords: Story = {
  // Twelve lines, past the box's height, so it offers to expand.
  args: {
    full: true,
    initial: [Array(12).fill("帮我把这个函数改一下").join("\n")],
  },
  play: async ({ canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    await user.click(await canvas.findByRole("button", { name: "Expand" }))
    const header = editor
      .closest("form")!
      .querySelector<HTMLElement>("[data-slot=composer-header]")!
    const count = () => Number(/(\d+) words/.exec(header.textContent!)?.[1])
    // Each engine has its own dictionary: the words, at least 4 a line, not
    // the 12 lines.
    await waitFor(() => expect(count()).toBeGreaterThanOrEqual(48))
    const before = count()
    // At the end: in the middle of a word, the line's words would change.
    const paragraph = editor.firstElementChild!
    caret(paragraph, paragraph.childNodes.length)
    await rendered()
    await type(" then run the tests")
    await waitFor(() => expect(count()).toBe(before + 4))
  },
}

/**
 * Typed, Markdown is styled line by line; the message is the text as
 * typed. Undo takes it back, and collapsed it is plain again.
 */
export const ExpandedTyping: Story = {
  args: { full: true, initial: releaseDraft },
  play: async ({ args, canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    await user.click(await canvas.findByRole("button", { name: "Expand" }))
    await user.click(editor)
    const paragraph = editor.lastElementChild!
    caret(paragraph, paragraph.childNodes.length)
    await rendered()
    await type("{Shift>}{Enter}{Enter}{/Shift}## Next")
    await waitFor(() =>
      expect(getComputedStyle(run(editor, "Next")).fontWeight).toBe("600")
    )
    await expect(getComputedStyle(run(editor, "## ")).color).toBe(
      resolve(editor, "--subtle-foreground")
    )
    // A mention in a heading: the heading goes on around its chip.
    await type(" @app")
    await canvas.findByRole("listbox", { name: "Files" })
    await type("{Enter}")
    await waitFor(() => expect(chipOf(editor, "app.ts")).toBeDefined())
    await expect(run(editor, "Next ")).toHaveAttribute("data-md", "heading")
    // Pasted, the same.
    paste(editor, transfer([], "\n- `a` item"))
    await waitFor(() =>
      expect(run(editor, "`a`")).toHaveAttribute("data-md", "inline-code")
    )
    await expect(run(editor, " item")).not.toHaveAttribute("data-md")
    // A fence makes what follows code, up to the next fence.
    await type("{Shift>}{Enter}{/Shift}```{Shift>}{Enter}{/Shift}npm i")
    await waitFor(() =>
      expect(run(editor, "npm i")).toHaveAttribute("data-md", "code")
    )
    await type("{Shift>}{Enter}{/Shift}- `x` and y")
    await expect(run(editor, "- `x` and y")).toHaveAttribute("data-md", "code")
    // The fence taken out: the lines after it are text again.
    // Each line is a paragraph: the fence is the line before.
    const fence = run(editor, "npm i").parentElement!.previousElementSibling!
      .firstElementChild!
    await expect(fence).toHaveTextContent(/^```$/)
    caret(fence.firstChild!, 3)
    await rendered()
    await type("{Backspace}{Backspace}{Backspace}")
    await waitFor(() =>
      expect(run(editor, "`x`")).toHaveAttribute("data-md", "inline-code")
    )
    await expect(run(editor, "- ")).toHaveAttribute("data-md", "mark")
    await expect(run(editor, "npm i")).not.toHaveAttribute("data-md")

    // Undo brings the fence back, a key at a time, and the code with it.
    for (const fence of ["`", "``", "```"]) {
      await type(mac() ? "{Meta>}z{/Meta}" : "{Control>}z{/Control}")
      await waitFor(() => expect(run(editor, fence)).toBeDefined())
    }
    await expect(run(editor, "```")).toHaveAttribute("data-md", "code")
    await expect(run(editor, "npm i")).toHaveAttribute("data-md", "code")

    // Collapsed, the same text, plain.
    await type("{Escape}")
    await waitFor(() =>
      expect(getComputedStyle(run(editor, "Next ")).fontWeight).toBe("400")
    )
    await user.click(canvas.getByRole("button", { name: "Send" }))
    const [text, link, end] = releaseDraft
    await expect(args.onSubmit).toHaveBeenCalledWith([
      text,
      link,
      `${end}\n\n## Next `,
      mention("@", "file:1", "app.ts"),
      " \n- `a` item\n```\nnpm i\n- `x` and y",
    ])
  },
}

/** The preview is the message as it will show once sent. */
export const ExpandedPreview: Story = {
  args: { full: true, initial: releaseDraft },
  play: async ({ canvas }) => {
    await user.click(await canvas.findByRole("button", { name: "Expand" }))
    await user.click(await canvas.findByRole("tab", { name: "Preview" }))
    await expect(
      await canvas.findByRole("heading", { name: "Upgrade" }, { timeout: 5000 })
    ).toBeVisible()
  },
}

/** Enter keeps code indentation and leaves a closing fence before sending. */
export const FenceEnter: Story = {
  play: async ({ args, canvas }) => {
    await user.click(canvas.getByRole("textbox", { name: "Message" }))
    await type("```{Enter}if (a) {{{Enter}  b(){Enter}b(){Enter}")
    await expect(args.onSubmit).not.toHaveBeenCalled()
    await type("{Backspace}{Backspace}```{Enter}done{Enter}")
    await expect(args.onSubmit).toHaveBeenCalledWith([
      "```\nif (a) {\n  b()\n  b()\n```\ndone",
    ])
  },
}

/** Two trailing blank code lines close an open fence in one edit. */
export const FenceEnterTwoBlankLines: Story = {
  play: async ({ args, canvas }) => {
    await user.click(canvas.getByRole("textbox", { name: "Message" }))
    await type("```{Enter}code{Enter}{Enter}{Enter}")
    await expect(args.onSubmit).not.toHaveBeenCalled()
    const editor = canvas.getByRole("textbox", { name: "Message" })
    const lines = () => Array.from(editor.children, (line) => line.textContent)
    await waitFor(() => expect(lines()).toEqual(["```", "code", "```", ""]))
    // One undo brings the blank lines back.
    await type(mac() ? "{Meta>}z{/Meta}" : "{Control>}z{/Control}")
    await waitFor(() => expect(lines()).toEqual(["```", "code", "", ""]))
    await type("{Enter}done{Enter}")
    await expect(args.onSubmit).toHaveBeenCalledWith(["```\ncode\n```\ndone"])
  },
}

/** Enter stays in an unclosed fence; the send shortcut still submits. */
export const FenceEnterNotSending: Story = {
  play: async ({ args, canvas }) => {
    await user.click(canvas.getByRole("textbox", { name: "Message" }))
    await type("```{Enter}code{Enter}more")
    await expect(args.onSubmit).not.toHaveBeenCalled()
    await type(mac() ? "{Meta>}{Enter}{/Meta}" : "{Control>}{Enter}{/Control}")
    await expect(args.onSubmit).toHaveBeenCalledWith(["```\ncode\nmore"])
  },
}

/** Tab edits code lines and moves focus again on prose. */
export const FenceTab: Story = {
  args: { initial: ["```\na\nb\n```\nprose"] },
  play: async ({ args, canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    await user.click(editor)
    caret(run(editor, "a").firstChild!, 0)
    await rendered()
    await type("{Tab}")
    await waitFor(() => expect(run(editor, "  a")).toBeDefined())
    const selection = getSelection()!
    selection.setBaseAndExtent(
      run(editor, "  a").firstChild!,
      2,
      run(editor, "b").firstChild!,
      1
    )
    await rendered()
    await type("{Tab}")
    await waitFor(() => expect(run(editor, "    a")).toBeDefined())
    await expect(run(editor, "  b")).toBeDefined()
    await expect([selection.anchorOffset, selection.focusOffset]).toEqual([
      4, 3,
    ])
    await type("{Shift>}{Tab}{/Shift}")
    await waitFor(() => expect(run(editor, "  a")).toBeDefined())
    await expect(run(editor, "b")).toBeDefined()
    await expect([selection.anchorOffset, selection.focusOffset]).toEqual([
      2, 1,
    ])
    caret(run(editor, "prose").firstChild!, 5)
    await rendered()
    await type("{Tab}")
    await expect(editor).not.toHaveFocus()
    await expect(
      canvas.getByRole("button", { name: "Attach files" })
    ).toHaveFocus()
    await user.click(canvas.getByRole("button", { name: "Send" }))
    await expect(args.onSubmit).toHaveBeenCalledWith([
      "```\n  a\nb\n```\nprose",
    ])
  },
}

/** Code pastes stay text, while prose still resolves pasted links. */
export const FencePaste: Story = {
  args: { full: true, links: "hold", pasteAsFile: { minLength: 20 } },
  beforeEach: () => holdLinks(),
  play: async ({ args, canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    await user.click(editor)
    await type("```{Enter}")
    const url = "https://vite.dev/guide/build"
    paste(editor, transfer([], url))
    await waitFor(() => expect(editor).toHaveTextContent(url))
    await type("{Enter}")
    const long = "a long line of plain code text"
    paste(editor, transfer([], long))
    await waitFor(() => expect(editor).toHaveTextContent(long))
    await type("{Enter}")
    paste(editor, transfer([], "@app"))
    await waitFor(() => expect(editor).toHaveTextContent("@app"))
    await expect(chips(editor)).toHaveLength(0)
    await expect(canvas.queryByRole("group", { name: "Paste as" })).toBeNull()
    await expect(canvas.queryByRole("listbox")).toBeNull()
    await expect(args.onAddFiles).not.toHaveBeenCalled()
    await type("{Enter}```{Enter}done{Enter}")
    await expect(args.onSubmit).toHaveBeenCalledWith([
      "```\n" + url + "\n" + long + "\n@app\n```\ndone",
    ])
    await user.click(editor)
    paste(editor, transfer([], "https://vite.dev"))
    await waitFor(() =>
      expect(editor.querySelector("[data-slot=composer-link]")).not.toBeNull()
    )
    releaseLinks()
  },
}

/** Two whitespace-only lines leave an existing closing fence intact. */
export const FenceEnterExistingClose: Story = {
  args: { initial: ["~~~~ts\ncode\n \n\t\n~~~~"] },
  play: async ({ args, canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    await user.click(editor)
    caret(run(editor, "\t").firstChild!, 1)
    await rendered()
    await type("{Enter}done{Enter}")
    await expect(args.onSubmit).toHaveBeenCalledWith([
      "~~~~ts\ncode\n~~~~\ndone",
    ])
  },
}

/** Closing an unclosed fence repeats its marker's character and length. */
export const FenceEnterTildes: Story = {
  args: { initial: ["  ~~~~ts\ncode\n\n"] },
  play: async ({ args, canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    await user.click(editor)
    const last = editor.lastElementChild!
    caret(last, 0)
    await rendered()
    await type("{Enter}done{Enter}")
    await expect(args.onSubmit).toHaveBeenCalledWith([
      "  ~~~~ts\ncode\n~~~~\ndone",
    ])
  },
}

/** Images scroll as tiles; other files retain their cards. */
export const AttachmentTiles: Story = {
  args: {
    placement: "row",
    initial: [
      spec,
      ...Array.from({ length: 9 }, (_, index) => ({
        ...hero,
        id: `tile:${index}`,
        name: `Screenshot ${index + 1}.png`,
      })),
      "Review these screenshots",
    ],
  },
  play: async ({ args, canvas, canvasElement }) => {
    const group = canvasElement.querySelector<HTMLElement>(
      "[data-slot=composer-attachment-tiles]"
    )!
    await expect(
      group.querySelectorAll("[data-slot=composer-attachment-tile-item]")
    ).toHaveLength(9)
    const tile = group.firstElementChild as HTMLElement
    await expect([
      tile.getBoundingClientRect().width,
      tile.getBoundingClientRect().height,
    ]).toEqual([64, 64])
    await expect(getComputedStyle(tile).padding).toBe("0px")
    await expect(group.scrollWidth).toBeGreaterThan(group.clientWidth)
    await expect(getComputedStyle(group).scrollSnapType).toContain("x")
    await expect(getComputedStyle(tile).scrollSnapAlign).toBe("start")
    await expect(
      canvasElement.querySelector("[data-slot=composer-attachment-card]")
    ).toHaveTextContent(spec.name)
    const trigger = canvas.getByRole("button", {
      name: "Screenshot 1.png",
    })
    await user.click(trigger)
    await expect(args.onOpenAttachment).toHaveBeenCalledWith(
      expect.objectContaining({ id: "tile:0" })
    )
    await user.tab()
    const remove = canvas.getByRole("button", {
      name: "Remove Screenshot 1.png",
    })
    await expect(remove).toHaveFocus()
    await waitFor(() =>
      expect(getComputedStyle(remove.parentElement!).opacity).toBe("1")
    )
    await user.keyboard("{Enter}")
    await waitFor(() =>
      expect(
        canvas.queryByRole("button", { name: "Screenshot 1.png" })
      ).not.toBeInTheDocument()
    )
    const next = canvas.getByRole("button", {
      name: "Screenshot 2.png",
    })
    await waitFor(() => expect(next).toHaveFocus())
    await user.keyboard("{Backspace}")
    await waitFor(() =>
      expect(
        canvas.queryByRole("button", { name: "Screenshot 2.png" })
      ).not.toBeInTheDocument()
    )
    await waitFor(() =>
      expect(
        canvas.getByRole("button", { name: "Screenshot 3.png" })
      ).toHaveFocus()
    )
  },
}

const quoted: ComposerQuote = {
  type: "quote",
  text: "The build is green.\nAll 42 tests pass.",
  source: "Answer",
}
export const QuoteChip: Story = {
  args: { initial: [quoted, "Why?"] },
  play: async ({ args, canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    await expect(editor.querySelector('[data-kind="quote"]')).toHaveTextContent(
      "The build is green."
    )
    await user.click(editor)
    const after = editor.querySelector("[data-lexical-text]")!
    caret(after.firstChild!, 0)
    await rendered()
    await type("{Backspace}")
    await waitFor(() =>
      expect(editor.querySelector('[data-kind="quote"]')).toHaveAttribute(
        "data-selected"
      )
    )
    const card = canvas
      .getByRole("button", { name: "Open" })
      .closest<HTMLElement>('[data-slot="composer-chip-card"]')!
    await expect(card).toHaveTextContent("Answer")
    await expect(card).toHaveTextContent("All 42 tests pass.")
    await type("{Enter}")
    await expect(args.onOpenQuote).toHaveBeenCalledWith(quoted)
    await type("{Backspace}")
    await waitFor(() => expect(chips(editor)).toHaveLength(0))
    await expect(composerText([quoted, "Why?"])).toBe(
      "> The build is green.\n> All 42 tests pass.\n\nWhy?"
    )
  },
}
