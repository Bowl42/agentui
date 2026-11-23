"use client"

import * as React from "react"
import { LexicalComposer } from "@lexical/react/LexicalComposer"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import {
  ContentEditableElement,
  type ContentEditableElementProps,
} from "@lexical/react/LexicalContentEditable"
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary"
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin"
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin"
import { useLexicalIsTextContentEmpty } from "@lexical/react/useLexicalIsTextContentEmpty"
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection"
import { cn } from "cn"
import {
  $addUpdateTag,
  $createLineBreakNode,
  $createNodeSelection,
  $createParagraphNode,
  $createRangeSelection,
  $createTextNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isLineBreakNode,
  $isNodeSelection,
  $isRangeSelection,
  $isRootOrShadowRoot,
  $isTextNode,
  $setSelection,
  BLUR_COMMAND,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  COMMAND_PRIORITY_NORMAL,
  DecoratorNode,
  DELETE_CHARACTER_COMMAND,
  HISTORIC_TAG,
  HISTORY_MERGE_TAG,
  HISTORY_PUSH_TAG,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  KEY_DOWN_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
  type EditorState,
  type ElementNode,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  ParagraphNode,
  type SerializedLexicalNode,
  type Spread,
  TextNode,
} from "lexical"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert02Icon,
  ArrowDown01Icon,
  ArrowExpand01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowShrink02Icon,
  ArrowUp02Icon,
  Attachment01Icon,
  Cancel01Icon,
  CornerUpRightIcon,
  Csv01Icon,
  File01Icon,
  FileAudioIcon,
  FileScriptIcon,
  FileVideoIcon,
  FileZipIcon,
  Globe02Icon,
  Image01Icon,
  Link01Icon,
  Note01Icon,
  Pdf01Icon,
  LinkSquare02Icon,
  Mic01Icon,
  PencilEdit02Icon,
  QuoteDownIcon,
  PlayListAddIcon,
  PlusSignIcon,
  SecurityCheckIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  Tick02Icon,
  RefreshIcon,
  StopIcon,
  TextIcon,
  WebDesign01Icon,
} from "@hugeicons/core-free-icons"

import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from "@/components/ui/attachment"
import { Chip, ChipDetail } from "@/components/chip"
import { LongText, type LongTextLabels } from "@/components/long-text"
import { Button, buttonVariants } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  InputGroup,
  InputGroupButton,
  inputGroupPopupOffset,
} from "@/components/ui/input-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Kbd } from "@/components/ui/kbd"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// Loaded when a draft is first previewed, not with the composer.
type MarkdownProps = React.ComponentProps<
  typeof import("@/components/markdown").Markdown
>
const Markdown = React.lazy(() =>
  import("@/components/markdown").then((module) => ({
    default: module.Markdown,
  }))
)

type ComposerFollowUp = "send" | "queue" | "steer"

type ComposerStatus = "ready" | "running" | "stopping"

/** A reference in the message, shown as a chip. */
type ComposerMention = {
  type: "mention"
  /** The character that started it, e.g. "@". */
  trigger: string
  /** The app's identity for what it refers to; opaque to the composer. */
  id: string
  /** What the chip shows. */
  label: string
}

/** A file in the message, shown as a chip. */
type ComposerAttachment = {
  type: "attachment"
  /** The app's identity for it, e.g. its upload; opaque to the composer. */
  id: string
  name: string
  /** Its MIME type, which picks the chip's icon. */
  mediaType?: string
  /** An image's address, shown as the chip's thumbnail. */
  preview?: string
  /** A few words after the name, e.g. "12 pages" or "182 lines". */
  detail?: string
}

/** Where an attachment's upload is, as the app tells it. */
type ComposerAttachmentState = {
  /**
   * From 0 to 1 while it uploads; `null` while it uploads with no way to
   * tell how far (a spinner, "Uploading").
   */
  progress?: number | null
  /** Why it failed, e.g. "Too large · 48 MB". */
  error?: string
}

/**
 * An address in the message, shown as a titled chip once the app has
 * resolved it (`resolveLink`); until then, as its address.
 */
type ComposerLink = {
  type: "link"
  url: string
  /** What the chip shows; without one, the address. */
  title?: string
  /** After the title, e.g. the site or a state ("Open"); by default the host. */
  detail?: string
  /** The site's icon, e.g. its favicon. */
  icon?: string
  /** The app's kind of link, e.g. "pull-request", for `renderLinkIcon`. */
  kind?: string
  /** A line or two about it, shown on the chip's card. */
  description?: string
  /** A picture of it, shown on the chip's card. */
  image?: string
  /** When its details were fetched, as the app writes it: "12:04". */
  fetched?: string
  /** Pasted as a preview: the app shows or sends the page, not only its link. */
  preview?: boolean
}

/** Words quoted from elsewhere, shown as a chip. */
type ComposerQuote = {
  type: "quote"
  /** Markdown-ish text, e.g. from selectionMarkdown. */
  text: string
  /** The app’s identity for its origin; opaque to the composer. */
  id?: string
  /** Its origin in a few words, shown on the card. */
  source?: string
}

/** What a chip in the message can be. */
type ComposerChipValue =
  ComposerMention | ComposerAttachment | ComposerLink | ComposerQuote

/** A message: text, and chips between it. */
type ComposerValue = (string | ComposerChipValue)[]

/** What the app's `resolveLink` finds out about an address. */
type ComposerLinkDetails = Omit<ComposerLink, "type" | "url" | "preview">

/** What the app can do to a composer from outside it. */
type ComposerActions = {
  /** Inserts at the caret, or at the end, as typing would (undoable). */
  insert: (value: ComposerValue) => void
  /**
   * Adds files that came with no place in the text, e.g. dropped on the
   * window: to the row of `ComposerAttachments`, or at the caret.
   */
  addFiles: (files: File[]) => void
  /**
   * Opens the file picker of the toolbar's `ComposerAttach`, as its "+"
   * or its menu's `ComposerAttachFiles` does: for the app's own shortcut
   * (⌘U), from the key's handler, since a browser opens a picker only
   * on the user's action. Nothing without a `ComposerAttach` or
   * `onAddFiles`.
   */
  pickFiles: () => void
  focus: () => void
}

type ComposerLabels = {
  /** Names quoted text on chips and their cards. */
  quote: string
  submit: string
  stop: string
  /** The submit's name while a turn runs, when sending queues. */
  queue: string
  /** The submit's name while a turn runs, when sending steers it. */
  steer: string
  /**
   * The submit's tooltip when it queues or steers, naming the other and
   * its modifier: "Queue · ⌘-click to steer".
   */
  followUpHint: (mode: "queue" | "steer", modifier: string) => string
  attach: string
  /** The add button's name, with a menu. */
  add: string
  /** The add menu's item that picks files. */
  upload: string
  expand: string
  collapse: string
  draft: string
  words: (count: number) => string
  write: string
  preview: string
  pasteAs: string
  pasteLink: string
  pastePreview: string
  pastePlain: string
  open: string
  retry: string
  remove: string
  showAsUrl: string
  /** After a link card's host: when its details were fetched, "fetched 12:04". */
  fetched: (time: string) => string
  /** The accessible name of a row chip's remove button. */
  removeItem: (name: string) => string
  /** The accessible name of a row chip's retry button. */
  retryItem: (name: string) => string
  /** The "+N" of a row that does not fit, for a screen reader. */
  more: (count: number) => string
  /**
   * A file card's line while it uploads: "Uploading · 64%"; "Uploading"
   * with no `percent` when how far is not known.
   */
  uploading: (percent?: string) => string
  /** Said when a chip is selected, with its text, e.g. "spec.pdf, 12 pages". */
  selected: (chip: string) => string
  /** The submit's name while a sent message is edited. */
  update: string
  /** The submit's label while a queued message is edited. */
  updateQueued: string
  /** Over the composer while a sent message is edited. */
  editing: string
  /** After `editing`, in grey: what saving it does. */
  editingDetail: string | null
  cancel: string
  /** Over the composer while a file is dragged over it. */
  drop: string
  /** Under `drop`, in grey; none by default. */
  dropDetail: string | null
  /** Over the composer when the text holds what looks like a secret. */
  secret: string
  /** After `secret`, in grey. */
  secretDetail: string | null
  keepSecret: string
  /** Saves the secret under its name: "Save as $STRIPE_KEY". */
  saveSecret: (name: string) => string
  /** While a sent message is recalled: "2 of 14 sent · ↓ newer · esc back to draft". */
  history: (position: number, count: number) => string
  /** The key that takes a suggested ending, shown after it. */
  acceptCompletion: string
}

const defaultLabels: ComposerLabels = {
  quote: "Quote",
  submit: "Send",
  stop: "Stop",
  queue: "Queue",
  steer: "Steer",
  followUpHint: (mode, modifier) =>
    mode === "queue"
      ? `Queue · ${modifier}-click to steer`
      : `Steer · ${modifier}-click to queue`,
  attach: "Attach files",
  add: "Add",
  upload: "Upload files",
  expand: "Expand",
  collapse: "Collapse",
  draft: "Draft",
  words: (count) => (count === 1 ? "1 word" : `${count} words`),
  write: "Write",
  preview: "Preview",
  pasteAs: "Paste as",
  pasteLink: "Link",
  pastePreview: "Preview",
  pastePlain: "Plain text",
  open: "Open",
  retry: "Retry",
  remove: "Remove",
  showAsUrl: "Show as URL",
  fetched: (time) => `fetched ${time}`,
  removeItem: (name) => `Remove ${name}`,
  retryItem: (name) => `Retry ${name}`,
  more: (count) => `Show ${count} more`,
  uploading: (percent) => (percent ? `Uploading · ${percent}` : "Uploading"),
  selected: (chip) => `${chip}, selected`,
  update: "Save",
  updateQueued: "Update",
  editing: "Editing your message",
  editingDetail: "· the turns after it rerun",
  cancel: "Cancel",
  drop: "Drop to attach",
  dropDetail: null,
  secret: "That looks like an API key.",
  secretDetail: "Save it instead of sending it?",
  keepSecret: "Keep as text",
  saveSecret: (name) => `Save as $${name}`,
  history: (position, count) =>
    `${position} of ${count} sent · ↓ newer · esc back to draft`,
  acceptCompletion: "Tab",
}

/**
 * A chip's text as it shows, for a screen reader, with what its card says
 * but the chip does not (an image's size).
 */
function selectedText(editor: LexicalEditor, key: NodeKey) {
  const element = editor.getElementByKey(key)
  const parts = Array.from(
    element?.querySelectorAll("[data-slot=composer-chip] > span") ?? [],
    (part) => part.textContent?.trim()
  )
  const chip = editor.getEditorState().read(() => {
    const node = $getNodeByKey(key)
    return $isChipNode(node) ? node.__chip : null
  })
  if (chip?.type === "attachment" && chip.preview && chip.detail)
    parts.push(chip.detail)
  return parts.filter(Boolean).join(", ") || (element?.textContent ?? "")
}

/** A link's host, without "www.". */
function hostOf(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, "")
  } catch {
    return url
  }
}

/** The plain text of a chip, as copying writes it. */
function chipText(chip: ComposerChipValue) {
  switch (chip.type) {
    case "quote":
      return (
        chip.text
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n") + "\n\n"
      )
    case "mention":
      return chip.trigger + chip.label
    case "attachment":
      return chip.name
    case "link":
      return chip.url
  }
}

/**
 * The message as plain text, chips written by `format`: by default a
 * mention as its trigger and label, a file as its name, a link as its
 * address.
 */
function composerText(
  value: ComposerValue,
  format: (chip: ComposerChipValue) => string = chipText
) {
  return value
    .map((part) => (typeof part === "string" ? part : format(part)))
    .join("")
}

const isAttachment = (
  part: string | ComposerChipValue
): part is ComposerAttachment =>
  typeof part !== "string" && part.type === "attachment"

/** A file's icon, by its type and name. */
function AttachmentIcon({ attachment }: { attachment: ComposerAttachment }) {
  const type = attachment.mediaType ?? ""
  const name = attachment.name.toLowerCase()
  if (type.startsWith("image/"))
    return <HugeiconsIcon icon={Image01Icon} strokeWidth={2} />
  if (type.startsWith("video/"))
    return <HugeiconsIcon icon={FileVideoIcon} strokeWidth={2} />
  if (type.startsWith("audio/"))
    return <HugeiconsIcon icon={FileAudioIcon} strokeWidth={2} />
  if (type === "text/plain")
    return <HugeiconsIcon icon={TextIcon} strokeWidth={2} />
  if (/\.(csv|tsv|xlsx?)$/.test(name))
    return <HugeiconsIcon icon={Csv01Icon} strokeWidth={2} />
  if (/\.(zip|tar|gz|tgz|7z|rar)$/.test(name))
    return <HugeiconsIcon icon={FileZipIcon} strokeWidth={2} />
  if (
    /\.(tsx?|jsx?|mjs|cjs|py|rs|go|rb|java|kt|swift|c|cc|cpp|h|cs|php|sh|json|ya?ml|toml|css|html?)$/.test(
      name
    )
  )
    return <HugeiconsIcon icon={FileScriptIcon} strokeWidth={2} />
  if (type === "application/pdf" || name.endsWith(".pdf"))
    return <HugeiconsIcon icon={Pdf01Icon} strokeWidth={2} />
  if (/\.(md|txt|docx?|rtf)$/.test(name))
    return <HugeiconsIcon icon={Note01Icon} strokeWidth={2} />
  return <HugeiconsIcon icon={File01Icon} strokeWidth={2} />
}

/**
 * A chip as the composer shows it: a mention, a file, a link or a quote,
 * 24px tall, in a line of text. In a sent message, `ComposerMessage` lays them out.
 */
function ComposerChip({
  value,
  variant,
  state,
  resolving = false,
  selected = false,
  icon,
  action,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & {
  value: ComposerChipValue
  /** An attachment's upload. */
  state?: ComposerAttachmentState | undefined
  /** A link whose title is being fetched. */
  resolving?: boolean
  selected?: boolean
  /** In place of the default icon, e.g. a link's kind. */
  icon?: React.ReactNode
  /** After the content, e.g. a remove button. */
  action?: React.ReactNode
  /** In place of the default content, e.g. a mention's icon and label. */
  children?: React.ReactNode
  /** `raised` on a tint, e.g. in a sent message's bubble. */
  variant?: "muted" | "raised" | undefined
}) {
  const labels = React.useContext(ComposerContext)?.labels ?? defaultLabels
  const error = value.type === "attachment" ? state?.error : undefined
  const progress = value.type === "attachment" ? uploadOf(state) : undefined
  const uploading = progress !== undefined
  let content: React.ReactNode = children
  if (content === undefined) {
    if (value.type === "mention") {
      content = <span className="truncate">{chipText(value)}</span>
    } else if (value.type === "quote") {
      content = (
        <>
          <HugeiconsIcon icon={QuoteDownIcon} strokeWidth={2} />
          <span className="truncate">
            <span className="sr-only">{labels.quote}: </span>
            {value.text.replace(/\s+/g, " ").trim()}
          </span>
        </>
      )
    } else if (value.type === "attachment") {
      content = <ChipContent attachment={value} state={state} icon={icon} />
    } else if (resolving) {
      content = (
        <>
          <Spinner />
          <span className="truncate">
            {value.url.replace(/^https?:\/\//, "")}
          </span>
        </>
      )
    } else {
      // After its title, its host; not when the title is its address.
      const host = hostOf(value.url)
      const detail = value.title
        ? (value.detail ?? (value.title.startsWith(host) ? undefined : host))
        : undefined
      content = (
        <>
          {icon ??
            (value.icon ? (
              <img src={value.icon} alt="" />
            ) : (
              <HugeiconsIcon icon={Globe02Icon} strokeWidth={2} />
            ))}
          <span className="truncate font-medium">
            {value.title ?? value.url.replace(/^https?:\/\//, "")}
          </span>
          {detail ? <ChipDetail>{detail}</ChipDetail> : null}
        </>
      )
    }
  }

  return (
    <Chip
      variant={variant}
      data-slot="composer-chip"
      data-kind={value.type}
      data-state={
        error
          ? "error"
          : uploading
            ? "uploading"
            : resolving
              ? "resolving"
              : undefined
      }
      data-selected={selected || undefined}
      className={cn(
        // 24px in a 28px line, so wrapped chips do not touch. The ring is
        // the chip's edge in either theme; the outline, transparent, draws
        // it in forced colors.
        "relative mx-px -mt-0.5 align-middle outline -outline-offset-1 outline-transparent select-none",
        "data-[kind=mention]:font-medium data-[state=error]:inset-ring-foreground/40 data-[state=resolving]:text-muted-foreground data-[state=error]:[&_[data-slot=chip-detail]]:text-foreground data-[state=error]:[&_svg]:text-foreground data-[state=uploading]:[&>img]:opacity-50",
        "data-selected:bg-accent data-selected:inset-ring-(length:--line-mark) data-selected:inset-ring-foreground data-selected:outline-(length:--line-mark) data-selected:-outline-offset-(length:--line-mark)",
        action && "pe-1",
        className
      )}
      {...props}
    >
      {content}
      {typeof progress === "number" ? (
        <span
          aria-hidden
          className="absolute start-0 bottom-0 h-0.5 bg-foreground transition-[width]"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      ) : null}
      {action}
    </Chip>
  )
}

const percent = (progress: number) => `${Math.round(progress * 100)}%`

/**
 * Where an upload is: its progress from 0 to 1, `null` when it uploads
 * with no way to tell how far, `undefined` when it does not upload (done,
 * failed, or never told).
 */
function uploadOf(state: ComposerAttachmentState | undefined) {
  if (!state || state.error) return undefined
  const { progress } = state
  if (progress === null) return null
  return progress !== undefined && progress < 1 ? progress : undefined
}

/**
 * A sent message as the composer showed it: its text, with its chips where
 * they were. With `onOpen`, a file's, mention's or quote's chip is a
 * button and a link's opens its page.
 */
function ComposerMessage({
  value,
  onOpen,
  renderMention,
  renderLinkIcon,
  labels,
  className,
  ...props
}: React.ComponentProps<"span"> & {
  value: ComposerValue
  /** A long run's buttons' words (`LongText`), for other languages. */
  labels?: Partial<LongTextLabels>
  onOpen?: (chip: ComposerMention | ComposerAttachment | ComposerQuote) => void
  renderMention?: (mention: ComposerMention) => React.ReactNode
  renderLinkIcon?: (link: ComposerLink) => React.ReactNode
}) {
  return (
    <span
      data-slot="composer-message"
      className={cn(
        "break-words whitespace-pre-wrap has-data-[slot=composer-chip]:leading-7",
        className
      )}
      {...props}
    >
      {value.map((part, index) => {
        if (typeof part === "string")
          // A long run without a space folded, its layout bounded.
          return (
            <LongText key={index} labels={labels}>
              {part}
            </LongText>
          )
        const chip = (
          // On a bubble's tint: the page's colour.
          <ComposerChip
            variant="raised"
            value={part}
            icon={part.type === "link" ? renderLinkIcon?.(part) : undefined}
          >
            {part.type === "mention" ? renderMention?.(part) : undefined}
          </ComposerChip>
        )
        if (part.type === "link") {
          return (
            <a
              key={index}
              href={part.url}
              target="_blank"
              rel="noopener noreferrer"
              className={chipControl}
            >
              {chip}
            </a>
          )
        }
        return onOpen ? (
          <button
            key={index}
            type="button"
            className={chipControl}
            onClick={() => onOpen(part)}
          >
            {chip}
          </button>
        ) : (
          <React.Fragment key={index}>{chip}</React.Fragment>
        )
      })}
    </span>
  )
}

// In the chip's place in the line, the chip inside it.
const chipControl =
  "mx-px -mt-0.5 inline-flex cursor-pointer rounded-md align-middle outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&>[data-slot=composer-chip]]:m-0 hover:[&>[data-slot=composer-chip]]:bg-accent"

type Placement = "inline" | "row"

type ChipCardTarget = { key: NodeKey; source: "selection" | "hover" }

type Recall = { index: number; draft: ComposerValue; shown: ComposerValue }

type PastedLink = {
  /** The node now in the text: the link's chip, or the text with its address. */
  key: NodeKey
  /** Where the address starts in that text. */
  offset: number
  url: string
  mode: "link" | "preview" | "plain"
}

type ComposerContextValue = {
  status: ComposerStatus
  followUp: ComposerFollowUp
  disabled: boolean
  submitDisabled: boolean
  submitOnEnter: boolean | undefined
  accept: string | undefined
  /** Whether the app takes files at all (`onAddFiles` is set). */
  takesFiles: boolean
  /** Null while files cannot be added. */
  addFiles: ((files: File[], at?: Range | null | "row") => void) | null
  /** Opens `ComposerAttach`'s file picker; set while one is mounted. */
  pickerRef: React.RefObject<(() => void) | null>
  labels: ComposerLabels
  stop: () => void
  renderMention: ((mention: ComposerMention) => React.ReactNode) | undefined
  renderLinkIcon: ((link: ComposerLink) => React.ReactNode) | undefined
  attachmentState:
    | ((attachment: ComposerAttachment) => ComposerAttachmentState | undefined)
    | undefined
  onOpenQuote: ((quote: ComposerQuote) => void) | undefined
  onOpenAttachment: ((attachment: ComposerAttachment) => void) | undefined
  onRetryAttachment: ((attachment: ComposerAttachment) => void) | undefined
  value: ComposerValue
  row: ComposerAttachment[]
  setRow: (row: ComposerAttachment[]) => void
  setPlacement: (placement: Placement | null) => void
  expanded: boolean
  setExpanded: (expanded: boolean) => void
  hoverChip: (key: NodeKey | null) => void
  pasted: PastedLink | null
  pasteAs: (mode: PastedLink["mode"]) => void
  dismissPaste: () => void
  /** Whether the submit in progress came from Cmd+Enter or Ctrl+Enter. */
  interrupt: React.RefObject<boolean>
  /** Whether a sent message (`true`) or a queued one is being edited. */
  editing: boolean | "queued"
  /** A recording in progress, for the editor's and the toolbar's place. */
  voice: VoiceSession | null
  setVoice: (voice: VoiceSession | null) => void
  /** Why a recording would not start, under the box until dismissed. */
  setVoiceError: (error: VoiceError | null) => void
  /** A sent message recalled into the box: which, of how many. */
  recall: { position: number; count: number } | null
  /** The id of the line under the box saying why it could not send. */
  errorId: string | undefined
  /** The app's suggestions of how the text goes on. */
  complete: ComposerProps["complete"]
  completeDelay: number
  /** The recording's input levels, outside React's state: they change often. */
  voiceLevels: Store<VoiceInput>
  /** Inserts at the caret, or at the end, and focuses. */
  insertValue: (value: ComposerValue) => void
  focus: () => void
  /**
   * Whether a list of suggestions is open: Enter takes one, so the send
   * button is grey meanwhile.
   */
  suggesting: boolean
  /** A list of suggestions opens (true) or closes (false). */
  suggest: (open: boolean) => void
}

/** A value that changes often, read with `useSyncExternalStore`. */
type Store<T> = {
  get: () => T
  set: (value: T) => void
  subscribe: (onChange: () => void) => () => void
}

function createStore<T>(initial: T): Store<T> {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    set: (next) => {
      if (next === value) return
      value = next
      listeners.forEach((listener) => listener())
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/** A recording's state, as `ComposerVoice` keeps it. */
type VoiceState = {
  /** When it started, by `performance.now()`. */
  startedAt: number
  /** Whether the words are being made out. */
  transcribing: boolean
  /** Whether they could not be: it waits for a Retry or Cancel. */
  failed: boolean
  /** Whether the mic is held down: let go, it finishes. */
  held: boolean
  /** Whether, held, it is slid back far enough to cancel when let go. */
  cancelling: boolean
  /** The longest it records, in seconds. */
  limit: number | undefined
}

/** A recording, as `ComposerVoice` runs it. */
type VoiceSession = VoiceState & {
  cancel: () => void
  /** Makes out its words; again, after they failed. */
  finish: () => void
  labels: ComposerVoiceLabels
}

/** Why a recording would not start, and its dismiss button's name. */
type VoiceError = { message: string; dismiss: string }

/** What the app tells of a recording as it goes. */
type VoiceInput = {
  levels: readonly number[]
  /** How long it has run, in seconds; else timed from its start. */
  duration?: number | undefined
  /** The words made out so far; given, a live transcript. */
  transcript?: string | undefined
  /** The words after them, still changing. */
  interim?: string | undefined
}

type ComposerVoiceLabels = {
  record: string
  recording: string
  cancel: string
  finish: string
  /** A live transcript with no words yet. */
  listening: string
  /** The words could not be made out. */
  failed: string
  retry: string
  /** Held: "Slide to cancel". */
  slide: string
  /** Held and slid back: "Release to cancel". */
  release: string
  /** The last seconds of `maxDuration`: "8s left". */
  left: (seconds: number) => string
  /** It would not start: the microphone not allowed. */
  denied: string
  /** None found. */
  noMicrophone: string
  /** Else. */
  unavailable: string
  /** Closes why it would not start. */
  dismiss: string
  /** The button beside the mic that opens the inputs to record from. */
  input: string
  /** The input the system records from, first of them. */
  systemDefault: string
  /** An input given no name: "Microphone 2", by its place among them. */
  unnamedInput: (place: number) => string
  /**
   * The mic's tooltip with a `shortcut`: "Hold Right ⌥ to talk". Empty,
   * no tooltip.
   */
  shortcut: string
}

/** An audio input the mic can record from, as the app lists them. */
type ComposerVoiceInput = {
  /** Its id, e.g. a `MediaDeviceInfo`'s `deviceId`; not empty. */
  id: string
  /** Its name, e.g. the device's `label`. */
  label: string
}

/** Text that looks like a secret, as the app's `detectSecret` finds it. */
type ComposerSecret = {
  /** The secret, as it is in the text. */
  text: string
  /** The name to save it under: "STRIPE_KEY". */
  name: string
}

const ComposerContext = React.createContext<ComposerContextValue | null>(null)

/**
 * A `ComposerTakeover`'s way back to the editor: the composer inside it
 * gives it its focus, which restores the caret where it was.
 */
const TakeoverContext = React.createContext<
  ((focus: () => void) => () => void) | null
>(null)

function useComposer() {
  const context = React.useContext(ComposerContext)
  if (!context) {
    throw new Error("Composer parts must be used within <Composer>.")
  }
  return context
}

// On touch screens there is no Shift key, so Enter adds a line there.
const coarsePointer = "(pointer: coarse)"

function subscribeToPointer(onChange: () => void) {
  const query = window.matchMedia(coarsePointer)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

function useCoarsePointer() {
  return React.useSyncExternalStore(
    subscribeToPointer,
    () => window.matchMedia(coarsePointer).matches,
    () => false
  )
}

const apple = () =>
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

/** ⌘⇧E on Apple's systems, Ctrl+Shift+E elsewhere; either works. */
const isExpandKey = (event: KeyboardEvent | React.KeyboardEvent) =>
  (event.metaKey || event.ctrlKey) &&
  event.shiftKey &&
  !event.altKey &&
  event.key.toLowerCase() === "e"

/** Whether a file matches an `accept` attribute's value. */
function accepts(accept: string | undefined, file: File) {
  const patterns = (accept ?? "")
    .split(",")
    .map((pattern) => pattern.trim().toLowerCase())
    .filter(Boolean)
  if (patterns.length === 0) return true
  const name = file.name.toLowerCase()
  const type = file.type.toLowerCase()
  return patterns.some((pattern) => {
    if (pattern.startsWith(".")) return name.endsWith(pattern)
    if (pattern.endsWith("/*")) return type.startsWith(pattern.slice(0, -1))
    return type === pattern
  })
}

/** The text position at a point on the page. */
function rangeAt(x: number, y: number): Range | null {
  if (document.caretPositionFromPoint) {
    const position = document.caretPositionFromPoint(x, y)
    if (!position) return null
    const range = document.createRange()
    range.setStart(position.offsetNode, position.offset)
    return range
  }
  return document.caretRangeFromPoint?.(x, y) ?? null
}

function carriesFiles(dataTransfer: DataTransfer | null) {
  return !!dataTransfer && Array.from(dataTransfer.types).includes("Files")
}

/** A single web address, and nothing else. */
const urlPattern = /^https?:\/\/[^\s<>"]+$/i

// The editor is Lexical; nothing of it is part of the composer's API.

type SerializedChipNode = Spread<
  { chip: ComposerChipValue; resolving?: boolean },
  SerializedLexicalNode
>

class ChipNode extends DecoratorNode<React.ReactNode> {
  __chip: ComposerChipValue
  /** A link whose title is being fetched; not part of the value. */
  __resolving: boolean

  static override getType() {
    return "composer-chip"
  }

  static override clone(node: ChipNode) {
    return new ChipNode(node.__chip, node.__resolving, node.__key)
  }

  static override importJSON(json: SerializedChipNode) {
    return new ChipNode(json.chip, json.resolving ?? false)
  }

  constructor(chip: ComposerChipValue, resolving = false, key?: NodeKey) {
    super(key)
    this.__chip = chip
    this.__resolving = resolving
  }

  override exportJSON(): SerializedChipNode {
    return {
      ...super.exportJSON(),
      chip: this.__chip,
      resolving: this.__resolving,
    }
  }

  override createDOM() {
    const element = document.createElement("span")
    element.dataset.slot = `composer-${this.__chip.type}`
    return element
  }

  override updateDOM(previous: ChipNode) {
    return previous.__chip.type !== this.__chip.type
  }

  override isInline() {
    return true
  }

  // Copying and the plain text of the editor.
  override getTextContent() {
    return chipText(this.__chip)
  }

  override decorate() {
    return (
      <ComposerChipView
        nodeKey={this.__key}
        chip={this.__chip}
        resolving={this.__resolving}
      />
    )
  }
}

function $isChipNode(node: LexicalNode | null | undefined): node is ChipNode {
  return node instanceof ChipNode
}

/**
 * A suggested ending after the caret, in grey: not part of the value, the
 * text or the undo history; it goes at the next key.
 */
class CompletionNode extends DecoratorNode<React.ReactNode> {
  __text: string

  static override getType() {
    return "composer-completion"
  }

  static override clone(node: CompletionNode) {
    return new CompletionNode(node.__text, node.__key)
  }

  static override importJSON(
    json: Spread<{ text: string }, SerializedLexicalNode>
  ) {
    return new CompletionNode(json.text)
  }

  constructor(text: string, key?: NodeKey) {
    super(key)
    this.__text = text
  }

  override exportJSON() {
    return { ...super.exportJSON(), text: this.__text }
  }

  override createDOM() {
    const element = document.createElement("span")
    element.dataset.slot = "composer-completion"
    element.contentEditable = "false"
    return element
  }

  override updateDOM() {
    return false
  }

  override isInline() {
    return true
  }

  override isKeyboardSelectable() {
    return false
  }

  override getTextContent() {
    return ""
  }

  override decorate() {
    return <CompletionView text={this.__text} />
  }
}

function $isCompletionNode(
  node: LexicalNode | null | undefined
): node is CompletionNode {
  return node instanceof CompletionNode
}

/**
 * Removes the suggested ending, if one is shown (`shown`: the keys of
 * those in the editor), outside the history.
 */
function $dropCompletion(shown: Set<NodeKey>) {
  let dropped = false
  for (const key of shown) {
    const node = $getNodeByKey(key)
    if (!$isCompletionNode(node)) continue
    node.remove()
    dropped = true
  }
  if (dropped) $addUpdateTag(HISTORIC_TAG)
  return dropped
}

function CompletionView({ text }: { text: string }) {
  const { labels } = useComposer()
  return (
    <>
      <span className="text-subtle-foreground">{text}</span>
      <Kbd
        aria-hidden
        className="ms-1 h-4 min-w-0 bg-transparent px-1 text-2xs text-subtle-foreground ring-1 ring-border ring-inset"
      >
        {labels.acceptCompletion}
      </Kbd>
    </>
  )
}

function ComposerChipView({
  nodeKey,
  chip,
  resolving,
}: {
  nodeKey: NodeKey
  chip: ComposerChipValue
  resolving: boolean
}) {
  const composer = useComposer()
  const [selected, setSelected, clearSelected] =
    useLexicalNodeSelection(nodeKey)
  const state =
    chip.type === "attachment" ? composer.attachmentState?.(chip) : undefined
  return (
    <ComposerChip
      value={chip}
      state={state}
      resolving={resolving}
      selected={selected}
      icon={chip.type === "link" ? composer.renderLinkIcon?.(chip) : undefined}
      onMouseEnter={() => composer.hoverChip(nodeKey)}
      onMouseLeave={() => composer.hoverChip(null)}
      // A click, or a tap, selects it: its card shows what can be done.
      onClick={() => {
        if (composer.disabled) return
        clearSelected()
        setSelected(true)
      }}
    >
      {chip.type === "mention" ? composer.renderMention?.(chip) : undefined}
    </ComposerChip>
  )
}

/** Appends text to a value, to the text it ends with if it does. */
function pushText(value: ComposerValue, text: string) {
  if (!text) return
  const last = value.at(-1)
  if (typeof last === "string") value[value.length - 1] = last + text
  else value.push(text)
}

/** A line's part of the value: its text and chips. */
function $lineValue(block: LexicalNode): ComposerValue {
  const value: ComposerValue = []
  if (!$isElementNode(block)) return value
  for (const node of block.getChildren()) {
    if ($isChipNode(node)) value.push(node.__chip)
    else pushText(value, $isLineBreakNode(node) ? "\n" : node.getTextContent())
  }
  return value
}

/** Lines' values as one, a line break between each two. */
function joinLines(lines: ComposerValue[]) {
  // Text alone, the usual draft: one string.
  const text = (line: ComposerValue) =>
    !line.length || (line.length === 1 && typeof line[0] === "string")
  if (lines.every(text)) {
    const joined = lines.map((line) => line[0] ?? "").join("\n")
    return joined ? [joined] : []
  }
  const value: ComposerValue = []
  lines.forEach((line, index) => {
    if (index > 0) pushText(value, "\n")
    for (const part of line)
      if (typeof part === "string") pushText(value, part)
      else value.push(part)
  })
  return value
}

function $readValue(): ComposerValue {
  return joinLines($getRoot().getChildren().map($lineValue))
}

/**
 * Reads the value each update leaves, a line at a time: a line it did not
 * touch is as it was, so a key in a long draft reads one line, not all.
 * The same array while the value is the same.
 */
function createValueReader() {
  let keys: NodeKey[] = []
  let lines: ComposerValue[] = []
  let value: ComposerValue = []
  return ({
    editorState,
    dirtyElements,
    dirtyLeaves,
    tags,
  }: {
    editorState: EditorState
    dirtyElements: Map<NodeKey, boolean>
    dirtyLeaves: Set<NodeKey>
    tags: Set<string>
  }) => {
    // Nothing changed: the caret moved.
    if (!dirtyElements.size && !dirtyLeaves.size) return value
    // Undo and redo set a state whose changes are not marked: all lines.
    const all = tags.has(HISTORIC_TAG)
    const before = new Map<NodeKey, ComposerValue>()
    const was = (key: NodeKey, index: number) => {
      if (keys[index] === key) return lines[index]
      if (!before.size) keys.forEach((k, i) => before.set(k, lines[i]!))
      return before.get(key)
    }
    const nextKeys: NodeKey[] = []
    const next = editorState.read(() =>
      $getRoot()
        .getChildren()
        .map((block, index) => {
          const key = block.getKey()
          nextKeys.push(key)
          const previous = was(key, index)
          if (previous && !all && !dirtyElements.has(key)) return previous
          const line = $lineValue(block)
          return previous && sameValue(line, previous) ? previous : line
        })
    )
    const changed =
      next.length !== lines.length || next.some((line, i) => line !== lines[i])
    keys = nextKeys
    lines = next
    if (changed) value = joinLines(next)
    return value
  }
}

function $createNodes(value: ComposerValue) {
  const nodes: LexicalNode[] = []
  for (const part of value) {
    if (typeof part !== "string") {
      nodes.push(new ChipNode(part))
      continue
    }
    part.split("\n").forEach((line, index) => {
      if (index > 0) nodes.push($createLineBreakNode())
      if (line) nodes.push($createTextNode(line))
    })
  }
  return nodes
}

function $writeValue(value: ComposerValue) {
  const root = $getRoot().clear()
  let line = $createParagraphNode()
  root.append(line)
  for (const node of $createNodes(value)) {
    if (!$isLineBreakNode(node)) line.append(node)
    else root.append((line = $createParagraphNode()))
  }
}

/*
 * Each line of the text is a paragraph of its own. The browser lays out a
 * paragraph as one, and Lexical's reconciler walks it as one: with a
 * draft's lines as line breaks in one paragraph, a key did both for the
 * whole draft; with a paragraph a line, for one line. What brings line
 * breaks in (Shift+Enter, a paste, an insert) is split at them here.
 */
function $splitLines(paragraph: ParagraphNode) {
  const children = paragraph.getChildren()
  // Where the breaks are among the children.
  const breaks = children.flatMap((node, i) =>
    $isLineBreakNode(node) ? [i] : []
  )
  if (!breaks.length) return
  // A point between this paragraph's children, by its line and its place
  // in it, as the children move (one in a text node moves with it).
  const selection = $getSelection()
  const points = (
    $isRangeSelection(selection) ? [selection.anchor, selection.focus] : []
  )
    .filter(
      (point) => point.type === "element" && point.key === paragraph.getKey()
    )
    .map((point) => {
      const line = breaks.filter((at) => at < point.offset).length
      const start = line ? breaks[line - 1]! + 1 : 0
      return { point, line, offset: point.offset - start }
    })
  const lines = [paragraph]
  for (const node of children.slice(breaks[0])) {
    const line = lines.at(-1)!
    if ($isLineBreakNode(node)) {
      const next = $createParagraphNode()
      line.insertAfter(next)
      lines.push(next)
      node.remove()
    } else line.append(node)
  }
  for (const { point, line, offset } of points)
    point.set(lines[line]!.getKey(), offset, "element")
}

/*
 * Markdown, styled as it is typed in the expanded editor. The text stays
 * as typed, marks and all: each run of one kind is a text node of its own,
 * the kind kept in its style as a custom property that styles nothing (so
 * Lexical merges like runs and keeps others apart), shown as `data-md`,
 * which the expanded editor's classes style. Only the lines an update
 * touches are looked at, and those after them that a code fence changes.
 */
type MarkdownKind =
  | "mark" // a heading's #s or a list item's marker
  | "heading"
  | "fence" // the ``` that opens a code block
  | "fence-end"
  | "code" // a line in a code block
  | "inline-code"

const markdownKinds: MarkdownKind[] = [
  "mark",
  "heading",
  "fence",
  "fence-end",
  "code",
  "inline-code",
]
const markdownStyle = (kind: MarkdownKind | null) =>
  kind ? `--composer-md: ${kind};` : ""
const kindOfStyle = new Map(markdownKinds.map((k) => [markdownStyle(k), k]))
const markdownKind = (node: TextNode) => kindOfStyle.get(node.getStyle())

/** A line's runs, each as where it ends and its kind. */
function markdownRuns(line: string, inCode: boolean) {
  const runs: [end: number, kind: MarkdownKind | null][] = []
  const run = (end: number, kind: MarkdownKind | null) => {
    const last = runs.at(-1)
    if (end <= (last?.[0] ?? 0)) return
    if (last && last[1] === kind) last[0] = end
    else runs.push([end, kind])
  }
  if (inCode) {
    const closes = /^ {0,3}(`{3,}|~{3,})\s*$/.test(line)
    run(line.length, closes ? "fence-end" : "code")
  } else if (/^ {0,3}(`{3,}|~{3,})/.test(line)) {
    run(line.length, "fence")
  } else {
    const heading = /^ {0,3}#{1,6}(?:[ \t]+|$)/.exec(line)?.[0]
    const item = /^\s*(?:[-*+]|\d{1,9}[.)])[ \t]+/.exec(line)?.[0]
    if (heading) {
      run(heading.length, "mark")
      run(line.length, "heading")
    } else {
      if (item) run(item.length, "mark")
      for (const span of line.matchAll(/`[^`]+`/g)) {
        if (span.index < (item?.length ?? 0)) continue
        run(span.index, null)
        run(span.index + span[0].length, "inline-code")
      }
      run(line.length, null)
    }
  }
  return runs
}

/**
 * Gives a line's text nodes their runs' kinds, splitting them where a run
 * ends; whether any changed, and whether the line after is in code.
 */
function $styleLine(nodes: LexicalNode[], inCode: boolean) {
  // A chip is one character of the line; a suggested ending, none.
  let line = ""
  for (const node of nodes)
    line += $isTextNode(node)
      ? node.getTextContent()
      : node.getTextContent()
        ? "\uFFFC"
        : ""
  const runs = markdownRuns(line, inCode)
  const kind = runs[0]?.[1]
  const after = inCode ? kind !== "fence-end" : kind === "fence"
  let changed = false
  let text = false
  let at = 0
  let run = 0
  for (const node of nodes) {
    if (!$isTextNode(node)) {
      if (node.getTextContent()) at++
      continue
    }
    const size = node.getTextContentSize()
    const start = at
    at += size
    if (size === 0) continue
    text = true
    while (runs[run]![0] <= start) run++
    const cuts: number[] = []
    const kinds = [runs[run]![1]]
    for (let next = run; runs[next]![0] < at; next++) {
      cuts.push(runs[next]![0] - start)
      kinds.push(runs[next + 1]![1])
    }
    const parts =
      cuts.length && node.isSimpleText() ? node.splitText(...cuts) : [node]
    if (parts.length > 1) changed = true
    parts.forEach((part, index) => {
      const style = markdownStyle(kinds[index]!)
      if (part.getStyle() === style) return
      part.setStyle(style)
      changed = true
    })
  }
  return { changed, text, after }
}

/**
 * Whether the lines before `line` leave a code block open: their last
 * text is code.
 */
function $inCodeBefore(line: LexicalNode) {
  for (
    let block = line.getPreviousSibling();
    block;
    block = block.getPreviousSibling()
  ) {
    if (!$isElementNode(block)) continue
    for (
      let node = block.getLastChild();
      node;
      node = node.getPreviousSibling()
    )
      if ($isTextNode(node) && node.getTextContentSize()) {
        const kind = markdownKind(node)
        return kind === "fence" || kind === "code"
      }
  }
  return false
}

/** Where a line stands in a code block. */
function $fenceOf(line: LexicalNode | null): "open" | "code" | "close" | null {
  if (!$isElementNode(line)) return null
  for (const node of line.getChildren()) {
    if (!$isTextNode(node) || !node.getTextContentSize()) continue
    const kind = markdownKind(node)
    return kind === "fence"
      ? "open"
      : kind === "fence-end"
        ? "close"
        : kind === "code"
          ? "code"
          : null
  }
  return $inCodeBefore(line) ? "code" : null
}

/** The anchor line and all lines touched by a range, in document order. */
function $selectionLines() {
  const selection = $getSelection()
  if (!$isRangeSelection(selection)) return null
  const anchor = selection.anchor.getNode().getTopLevelElement()
  const focus = selection.focus.getNode().getTopLevelElement()
  if (!anchor || !focus) return null
  const start = selection.isBackward() ? focus : anchor
  const end = selection.isBackward() ? anchor : focus
  const lines: ElementNode[] = []
  for (
    let line: LexicalNode | null = start;
    line;
    line = line.getNextSibling()
  ) {
    if ($isElementNode(line)) lines.push(line)
    if (line.is(end)) break
  }
  return { selection, anchor, lines }
}

const codeIndent = "  "

/** Enter writes a line in a fence, or leaves it at its end. */
function $fenceEnter(shift: boolean) {
  const range = $selectionLines()
  if (!range || !$fenceOf(range.anchor)) return false
  const { selection, anchor: line } = range
  const kind = $fenceOf(line)
  const text = line.getTextContent()
  const atEnd =
    selection.isCollapsed() &&
    (selection.anchor.type === "element"
      ? selection.anchor.offset === line.getChildrenSize()
      : selection.anchor.getNode().is(line.getLastChild()) &&
        selection.anchor.offset ===
          selection.anchor.getNode().getTextContentSize())
  const previous = line.getPreviousSibling()
  const next = line.getNextSibling()
  if (
    selection.isCollapsed() &&
    kind === "code" &&
    !text.trim() &&
    $fenceOf(previous) === "code" &&
    !previous!.getTextContent().trim() &&
    (!next || $fenceOf(next) === "close")
  ) {
    $addUpdateTag(HISTORY_PUSH_TAG)
    let close = next
    if (!close) {
      let open = previous!.getPreviousSibling()
      while (open && $fenceOf(open) !== "open") open = open.getPreviousSibling()
      const marker = /^ {0,3}(`{3,}|~{3,})/.exec(
        open?.getTextContent() ?? ""
      )?.[1]
      if (!marker) {
        selection.insertRawText("\n")
        return true
      }
      close = $createParagraphNode().append($createTextNode(marker))
      line.insertAfter(close)
    }
    const after = $createParagraphNode()
    close.insertAfter(after)
    line.remove()
    previous!.remove()
    after.selectStart()
  } else if (kind === "close" && atEnd) {
    const after = $createParagraphNode()
    line.insertAfter(after)
    after.selectStart()
  } else {
    const indent =
      !shift && kind === "code" && selection.isCollapsed()
        ? /^[ \t]*/.exec(text)![0]
        : ""
    selection.insertRawText("\n" + indent)
  }
  return true
}

/** Tab edits code indentation without moving the range off its characters. */
function $fenceTab(shift: boolean) {
  const range = $selectionLines()
  if (!range || !range.lines.every((line) => $fenceOf(line) === "code"))
    return false
  const { selection, lines } = range
  if (selection.isCollapsed() && !shift) {
    selection.insertRawText(codeIndent)
    return true
  }
  for (const line of lines) {
    const first = line.getFirstChild()
    if (!$isTextNode(first)) continue
    const text = first.getTextContent()
    const removed = shift ? (/^( {2}|\t| )/.exec(text)?.[0].length ?? 0) : 0
    const added = !shift && text.length ? codeIndent : ""
    const points = [selection.anchor, selection.focus]
      .filter(
        (point) =>
          point.key === first.getKey() ||
          (point.key === line.getKey() && point.offset === 0)
      )
      .map((point) => ({ point, offset: point.offset }))
    first.setTextContent(added + text.slice(removed))
    for (const { point, offset } of points)
      point.set(
        first.getKey(),
        Math.max(0, offset - removed) + added.length,
        "text"
      )
  }
  $setSelection(selection)
  return true
}

/**
 * Styles a line, and the lines after it while they change (a fence opened
 * or closed reaches to the next one).
 */
function $styleLinesFrom(line: ElementNode) {
  let inCode = $inCodeBefore(line)
  for (
    let next: LexicalNode | null = line, first = true;
    next;
    next = next.getNextSibling(), first = false
  ) {
    if (!$isElementNode(next)) continue
    const { changed, text, after } = $styleLine(next.getChildren(), inCode)
    if (!first && text && !changed) break
    inCode = after
  }
  // Typing goes on in the node the caret is in, in its style.
  const selection = $getSelection()
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return
  const anchor = selection.anchor.getNode()
  if ($isTextNode(anchor)) selection.style = anchor.getStyle()
}

/** Styles every line, for text the transforms have not seen. */
function $styleAllLines() {
  let inCode = false
  for (const line of $getRoot().getChildren())
    if ($isElementNode(line))
      inCode = $styleLine(line.getChildren(), inCode).after
}

/** Styles the Markdown in the text as it changes. */
function registerMarkdown(editor: LexicalEditor) {
  // Not while an input method composes: its text stays in one node; nor
  // in a paragraph about to be split into its lines.
  const $restyle = (line: LexicalNode | null) => {
    if (
      !editor.isComposing() &&
      $isElementNode(line) &&
      !$isRootOrShadowRoot(line) &&
      !line.getChildren().some($isLineBreakNode)
    )
      $styleLinesFrom(line)
  }
  let composing = false
  const unregister = [
    editor.registerNodeTransform(TextNode, (node) =>
      $restyle(node.getParent())
    ),
    // Lines joined, split or taken out, with no text changed.
    editor.registerNodeTransform(ParagraphNode, $restyle),
    editor.registerMutationListener(
      TextNode,
      (mutations) =>
        editor.getEditorState().read(() => {
          for (const [key, mutation] of mutations) {
            const node = $getNodeByKey(key)
            const element = editor.getElementByKey(key)
            if (mutation === "destroyed" || !$isTextNode(node) || !element)
              continue
            const kind = markdownKind(node)
            if (!kind) delete element.dataset.md
            // Fences look as the code they hold.
            else element.dataset.md = kind.startsWith("fence") ? "code" : kind
          }
        }),
      { skipInitialization: false }
    ),
    // What was composed is styled once it is in: the caret's line.
    editor.registerUpdateListener(() => {
      const now = editor.isComposing()
      if (composing && !now)
        editor.update(
          () => {
            const selection = $getSelection()
            if (!$isRangeSelection(selection)) return
            const node = selection.anchor.getNode()
            $restyle($isElementNode(node) ? node : node.getParent())
          },
          { tag: HISTORY_MERGE_TAG }
        )
      composing = now
    }),
  ]
  editor.update($styleAllLines, { tag: HISTORY_MERGE_TAG })
  return () => unregister.forEach((fn) => fn())
}

/** Takes the attachments out of the text, for the row. */
function $takeAttachments() {
  const taken: ComposerAttachment[] = []
  for (const block of $getRoot().getChildren()) {
    if (!$isElementNode(block)) continue
    for (const node of block.getChildren()) {
      if ($isChipNode(node) && node.__chip.type === "attachment") {
        taken.push(node.__chip)
        node.remove()
      }
    }
  }
  return taken
}

/** The chip right before (or after) a collapsed caret, if there is one. */
function $chipBeside(backward: boolean): ChipNode | null {
  const selection = $getSelection()
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return null
  const { anchor } = selection
  const node = anchor.getNode()
  let beside: LexicalNode | null = null
  if (anchor.type === "text") {
    const atEdge = backward
      ? anchor.offset === 0
      : anchor.offset === node.getTextContentSize()
    if (atEdge)
      beside = backward ? node.getPreviousSibling() : node.getNextSibling()
  } else if ($isElementNode(node)) {
    beside = node.getChildAtIndex(backward ? anchor.offset - 1 : anchor.offset)
  }
  return $isChipNode(beside) ? beside : null
}

/** The chip selected as a whole, if one is. */
function $selectedChip(): ChipNode | null {
  const selection = $getSelection()
  if (!$isNodeSelection(selection)) return null
  const nodes = selection.getNodes()
  return nodes.length === 1 && $isChipNode(nodes[0]) ? nodes[0] : null
}

/** Removes a chip and leaves the caret where it was. */
function $removeChip(chip: LexicalNode) {
  const previous = chip.getPreviousSibling()
  const next = chip.getNextSibling()
  if ($isTextNode(previous)) previous.select()
  else if ($isTextNode(next)) next.select(0, 0)
  else {
    const parent = chip.getParentOrThrow()
    const index = chip.getIndexWithinParent()
    parent.select(index, index)
  }
  chip.remove()
}

/** Puts the caret right before or after a chip. */
function $caretBeside(chip: LexicalNode, after: boolean) {
  const parent = chip.getParentOrThrow()
  const index = chip.getIndexWithinParent() + (after ? 1 : 0)
  parent.select(index, index)
}

/** Replaces the first `text` in a line of text with `value`'s nodes. */
function $replaceText(text: string, value: ComposerValue) {
  for (const block of $getRoot().getChildren()) {
    if (!$isElementNode(block)) continue
    for (const node of block.getChildren()) {
      if (!$isTextNode(node)) continue
      const at = node.getTextContent().indexOf(text)
      if (at < 0) continue
      const parts = node.splitText(at, at + text.length)
      const target = parts[at === 0 ? 0 : 1]!
      let last: LexicalNode = target
      for (const inserted of $createNodes(value)) {
        last.insertAfter(inserted)
        last = inserted
      }
      target.remove()
      last.selectNext(0, 0)
      return true
    }
  }
  return false
}

/** Runs each of the cleanups it is given. */
const mergeRegister =
  (...cleanups: (() => void)[]) =>
  () =>
    cleanups.forEach((cleanup) => cleanup())

// The same array first: an app that passes back what it was given needs
// no comparing. Then part by part: the text as strings, a chip serialized.
const sameValue = (a: ComposerValue, b: ComposerValue) =>
  a === b ||
  (a.length === b.length &&
    a.every((part, i) => {
      const other = b[i]
      return typeof part === "string" || typeof other === "string"
        ? part === other
        : JSON.stringify(part) === JSON.stringify(other)
    }))

/** Splits a value between the row of files and the text. */
function split(value: ComposerValue, placement: Placement | null) {
  if (placement !== "row") return { row: [], text: value }
  return {
    row: value.filter(isAttachment),
    text: value.filter((part) => !isAttachment(part)),
  }
}

type ComposerProps = Omit<
  React.ComponentProps<"form">,
  "onSubmit" | "defaultValue"
> & {
  value?: ComposerValue
  defaultValue?: ComposerValue
  onValueChange?: (value: ComposerValue) => void
  onSubmit?: (
    value: ComposerValue,
    event: React.FormEvent<HTMLFormElement>,
    /**
     * `interrupt`: the Cmd/Ctrl modifier was held on Enter or click.
     * `followUp`: the resolved action while running, swapping queue and
     * steer with the modifier; "send" otherwise, including while editing.
     */
    options: { interrupt: boolean; followUp: ComposerFollowUp }
  ) => void
  onStop?: () => void
  /**
   * Files added by the attach button, pasting or dropping. What it returns,
   * usually an attachment for each file, is inserted where they came in:
   * at the caret, where they were dropped, or in the row of
   * `ComposerAttachments`.
   */
  onAddFiles?: (accepted: File[], rejected: File[]) => ComposerValue | void
  /** File types to accept, as the `accept` attribute of a file input. */
  accept?: string
  /**
   * Data of the app's own types dropped on it, e.g. a file dragged from a
   * `Browser`'s list (`browserFileType`). What it returns, e.g. a
   * mention, is inserted where it was dropped.
   */
  onDropData?: (data: DataTransfer) => ComposerValue | void
  /** The types `onDropData` takes, as a `DataTransfer` names them. */
  dropTypes?: string[]
  /**
   * Pasted text this long or longer is added as a text file, like a pasted
   * file, instead of going into the input; e.g. a log or a document, which
   * the app can show as a chip. Off unless set, and only where the app
   * takes text files (`onAddFiles`, `accept`).
   */
  pasteAsFile?: { minLength: number; name?: string }
  /**
   * Finds a pasted address's title, icon and so on, e.g. from the page or,
   * for the app's own kinds of link, from its API. Null, or a failure,
   * leaves the address as text. Without it, addresses are pasted as text.
   */
  resolveLink?: (
    url: string,
    options: { signal: AbortSignal }
  ) => Promise<ComposerLinkDetails | null | undefined>
  /** An attachment's upload: its progress, or why it failed. */
  attachmentState?: (
    attachment: ComposerAttachment
  ) => ComposerAttachmentState | undefined
  /** Opens the origin of quoted text; Enter on its selected chip. */
  onOpenQuote?: (quote: ComposerQuote) => void
  /** Opens a file, e.g. in a side panel; Enter on its selected chip. */
  onOpenAttachment?: (attachment: ComposerAttachment) => void
  /** Uploads a failed file again. */
  onRetryAttachment?: (attachment: ComposerAttachment) => void
  /**
   * What Enter and the button do while a turn runs: "queue" waits until
   * after the turn; "steer" sends into it (adding to or stopping the turn
   * is the app's); "send" just sends, the default. With queue or steer,
   * Cmd+Enter (Ctrl+Enter) or Cmd-click (Ctrl-click) does the other one.
   */
  followUp?: ComposerFollowUp
  status?: ComposerStatus
  disabled?: boolean
  submitDisabled?: boolean
  /**
   * Whether Enter sends (Shift+Enter adds a line) or adds a line (the
   * button sends). By default it sends, but on a touch screen
   * (`pointer: coarse`), whose keyboard has no Shift+Enter, it adds a
   * line; `true` makes it send there too, e.g. an app's setting. The
   * on-screen keyboard's key says which ("send" or "enter").
   */
  submitOnEnter?: boolean
  labels?: Partial<ComposerLabels>
  /** What a mention's chip shows; by default its trigger and label. */
  renderMention?: (mention: ComposerMention) => React.ReactNode
  /** A link's icon by its `kind`; by default its `icon`, or a globe. */
  renderLinkIcon?: (link: ComposerLink) => React.ReactNode
  /** Inserts and focuses from outside the composer. */
  actionsRef?: React.Ref<ComposerActions>
  /**
   * A message is being edited; Escape calls `onCancelEdit`. A sent one
   * (`true`): a bar over the box says so, with a Cancel, and the submit
   * saves (✓). A queued one (`"queued"`): the queue's shelf says so, and
   * the submit is a labelled Update, with no stop beside it.
   */
  editing?: boolean | "queued"
  onCancelEdit?: () => void
  /**
   * Why the last message could not be sent, in a line under the box,
   * with a Retry (`onRetry`). The app puts the message back in the box.
   */
  error?: React.ReactNode
  onRetry?: () => void
  /**
   * Messages sent before, the latest first: Up on an empty box recalls
   * them, one older at each Up, Down newer, Escape back to the draft
   * (`ComposerHistoryHint` says where it is). Editing one keeps it.
   */
  history?: readonly ComposerValue[]
  /**
   * Finds what looks like a secret in the text, e.g. an API key: a bar
   * over the box offers to save it (`onSaveSecret`) or keep it as text.
   */
  detectSecret?: (text: string) => ComposerSecret | null | undefined
  /**
   * Saves a secret, e.g. as a named secret of the app's; what it returns,
   * e.g. a `$STRIPE_KEY` mention, takes the secret's place in the text.
   */
  onSaveSecret?: (secret: ComposerSecret) => ComposerValue | void
  /**
   * Suggests how the text goes on, once typing pauses with the caret at
   * its end: shown in grey after the caret, Tab takes it, typing or
   * Escape drops it. Null, or a failure, suggests nothing.
   */
  complete?: (
    value: ComposerValue,
    options: { signal: AbortSignal }
  ) => Promise<string | null | undefined>
  /** How long typing pauses before `complete` is asked, in ms. */
  completeDelay?: number
  /**
   * Where its toolbar's menus and pickers open: `"composer"`, 8px clear
   * of the whole composer, never over the text (the default); or
   * `"trigger"`, by the button that opened it, over the text if need be.
   */
  popups?: "composer" | "trigger"
}

function Composer(props: ComposerProps) {
  const [initialConfig] = React.useState(() => ({
    namespace: "composer",
    nodes: [ChipNode, CompletionNode],
    editable: !props.disabled,
    editorState: () => $writeValue(props.value ?? props.defaultValue ?? []),
    onError: (error: Error) => {
      throw error
    },
  }))

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <ComposerForm {...props} />
    </LexicalComposer>
  )
}

function ComposerForm({
  value: valueProp,
  defaultValue = [],
  onValueChange,
  onSubmit,
  onStop,
  onAddFiles,
  accept,
  onDropData,
  dropTypes,
  pasteAsFile,
  resolveLink,
  attachmentState,
  onOpenQuote,
  onOpenAttachment,
  onRetryAttachment,
  status = "ready",
  followUp = "send",
  disabled = false,
  submitDisabled = false,
  submitOnEnter,
  labels,
  renderMention,
  renderLinkIcon,
  actionsRef,
  editing = false,
  onCancelEdit,
  error,
  onRetry,
  history,
  detectSecret,
  onSaveSecret,
  complete,
  completeDelay = 400,
  popups = "composer",
  className,
  children,
  onPaste,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
  onKeyDown,
  onBlur,
  ...props
}: ComposerProps) {
  const [editor] = useLexicalComposerContext()
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue)
  const controlled = valueProp !== undefined
  const value = controlled ? valueProp : uncontrolledValue
  // What the editor and the row hold, so a value they reported is not
  // written back.
  const shown = React.useRef(value)
  // Where files go: in the text, or a row above it (`ComposerAttachments`).
  const [placement, setPlacement] = React.useState<Placement | null>(null)
  const placementRef = React.useRef(placement)
  const [row, setRowState] = React.useState<ComposerAttachment[]>([])
  const rowRef = React.useRef(row)
  // What is dragged over it: files, or data of the app's for the text.
  const [dragging, setDragging] = React.useState<"files" | "data" | null>(null)
  // How many lists of suggestions are open (one per trigger).
  const [suggesting, setSuggesting] = React.useState(0)
  // dragenter and dragleave fire for each element inside, so count them.
  const dragDepth = React.useRef(0)
  const [expanded, setExpandedState] = React.useState(false)
  const [card, setCard] = React.useState<ChipCardTarget | null>(null)
  const hoverTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined)
  const [pasted, setPasted] = React.useState<PastedLink | null>(null)
  // Resolutions in flight, by the node they resolve, and those done.
  const resolving = React.useRef(new Map<NodeKey, AbortController>())
  const resolved = React.useRef(new Map<string, ComposerLinkDetails | null>())
  const group = React.useRef<HTMLDivElement>(null)
  const interrupt = React.useRef(false)
  const [voice, setVoice] = React.useState<VoiceSession | null>(null)
  // Why a recording would not start, and the text then: once it is
  // written in, that is the reader's answer, and it goes.
  const [voiceErrorState, setVoiceErrorState] = React.useState<{
    error: VoiceError
    value: ComposerValue
  } | null>(null)
  const voiceError =
    voiceErrorState?.value === value ? voiceErrorState.error : null
  const valueRef = React.useRef(value)
  React.useLayoutEffect(() => {
    valueRef.current = value
  })
  const setVoiceError = React.useCallback(
    (error: VoiceError | null) =>
      setVoiceErrorState(error && { error, value: valueRef.current }),
    []
  )
  const [voiceLevels] = React.useState(() =>
    createStore<VoiceInput>({ levels: [] })
  )
  const errorId = React.useId()
  // A sent message recalled: which, what was in the box before, and what
  // was written, so an edit ends the recall.
  const [recall, setRecallState] = React.useState<Recall | null>(null)
  const recallRef = React.useRef<Recall | null>(null)
  const setRecall = React.useCallback((next: Recall | null) => {
    recallRef.current = next
    setRecallState(next)
  }, [])
  const historyRef = React.useRef(history)
  const cancelEditRef = React.useRef<(() => void) | undefined>(undefined)
  React.useLayoutEffect(() => {
    historyRef.current = history
    cancelEditRef.current = editing ? onCancelEdit : undefined
  })
  // Secrets kept as text, so they are not offered again.
  const [keptSecrets, setKeptSecrets] = React.useState<string[]>([])

  const allLabels: ComposerLabels = { ...defaultLabels, ...labels }

  // The latest handlers, for what reports a change outside React's events.
  const changed = React.useRef((next: ComposerValue) => {
    if (!controlled) setUncontrolledValue(next)
    onValueChange?.(next)
  })
  React.useLayoutEffect(() => {
    changed.current = (next) => {
      if (!controlled) setUncontrolledValue(next)
      onValueChange?.(next)
    }
  })

  /** Reports the row and the text as the value, if it changed. */
  const report = React.useCallback(
    (text: ComposerValue = editor.getEditorState().read($readValue)) => {
      const next = rowRef.current.length ? [...rowRef.current, ...text] : text
      if (sameValue(next, shown.current)) return
      shown.current = next
      changed.current(next)
    },
    [editor]
  )

  React.useEffect(() => {
    const read = createValueReader()
    return editor.registerUpdateListener((update) => report(read(update)))
  }, [editor, report])

  const setRow = React.useCallback(
    (next: ComposerAttachment[]) => {
      rowRef.current = next
      setRowState(next)
      report()
    },
    [report]
  )

  // In the commit that renders it, not after: a key typed between the
  // commit and a passive effect would be lost to the value the page
  // rendered before it (Firefox, WebKit, on a page slow to render).
  React.useLayoutEffect(() => {
    if (sameValue(value, shown.current)) return
    shown.current = value
    const parts = split(value, placementRef.current)
    rowRef.current = parts.row
    setRowState(parts.row)
    editor.update(() => {
      $writeValue(parts.text)
      // Leaves the focus where it is: a selection in the editor would
      // take it.
      if (editor.getRootElement() === document.activeElement) {
        $getRoot().selectEnd()
      } else {
        $setSelection(null)
      }
    })
  }, [editor, value])

  // With a row, the files already in the text move to it.
  React.useLayoutEffect(() => {
    placementRef.current = placement
    if (placement !== "row") return
    let taken: ComposerAttachment[] = []
    editor.update(
      () => {
        taken = $takeAttachments()
      },
      { discrete: true, tag: HISTORY_MERGE_TAG }
    )
    if (taken.length) setRow([...rowRef.current, ...taken])
  }, [editor, placement, setRow])

  React.useEffect(() => editor.setEditable(!disabled), [editor, disabled])

  // Up on an empty box recalls what was sent, Down comes back, Escape
  // returns to the draft; an edit keeps what was recalled.
  React.useEffect(() => {
    const show = (index: number | null) => {
      const current = recallRef.current
      const draft = current?.draft ?? $readValue()
      const shown =
        index === null ? draft : (historyRef.current?.[index] ?? draft)
      $writeValue(shown)
      $getRoot().selectEnd()
      setRecall(index === null ? null : { index, draft, shown })
    }
    const plainKey = (event: KeyboardEvent | null) =>
      !!event &&
      !event.shiftKey &&
      !event.altKey &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.isComposing
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        const current = recallRef.current
        if (current && !sameValue(editorState.read($readValue), current.shown))
          setRecall(null)
      }),
      editor.registerCommand(
        KEY_ARROW_UP_COMMAND,
        (event) => {
          const count = historyRef.current?.length ?? 0
          if (!plainKey(event) || count === 0) return false
          const current = recallRef.current
          if (!current && $getRoot().getTextContent() !== "") return false
          event!.preventDefault()
          show(Math.min(count - 1, (current?.index ?? -1) + 1))
          return true
        },
        COMMAND_PRIORITY_NORMAL
      ),
      editor.registerCommand(
        KEY_ARROW_DOWN_COMMAND,
        (event) => {
          const current = recallRef.current
          if (!plainKey(event) || !current) return false
          event!.preventDefault()
          show(current.index > 0 ? current.index - 1 : null)
          return true
        },
        COMMAND_PRIORITY_NORMAL
      ),
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        (event) => {
          if (event.isComposing || event.defaultPrevented) return false
          if (recallRef.current) {
            event.preventDefault()
            show(null)
            return true
          }
          // Editing a sent message, Escape puts it back, before it stops.
          const cancelEdit = cancelEditRef.current
          if (!cancelEdit) return false
          event.preventDefault()
          cancelEdit()
          return true
        },
        COMMAND_PRIORITY_NORMAL
      )
    )
  }, [editor, setRecall])

  /** Inserts at `at`, or at the caret, or at the end. */
  const insertInText = React.useCallback(
    (inserted: ComposerValue, at?: Range | null) => {
      editor.update(() => {
        if (at) {
          const point = $createRangeSelection()
          point.applyDOMRange(at)
          $setSelection(point)
        }
        let selection = $getSelection()
        if (!$isRangeSelection(selection)) {
          $getRoot().selectEnd()
          selection = $getSelection()
        }
        if ($isRangeSelection(selection)) {
          selection.insertNodes($createNodes(inserted))
        }
      })
    },
    [editor]
  )

  /**
   * Inserts in the text, but files in the row where there is one: always
   * with a row placement, or when `toRow` and a row is shown at all.
   */
  const insert = React.useCallback(
    (inserted: ComposerValue, at?: Range | null, toRow = false) => {
      const rowTakes =
        placementRef.current === "row" ||
        (toRow && placementRef.current !== null)
      if (!rowTakes) {
        insertInText(inserted, at)
        return
      }
      const files = inserted.filter(isAttachment)
      // What the app put between its chips, e.g. spaces, is for the text.
      const rest = inserted.filter(
        (part) =>
          !isAttachment(part) && !(typeof part === "string" && !part.trim())
      )
      if (rest.length) insertInText(rest, at)
      if (files.length) setRow([...rowRef.current, ...files])
    },
    [insertInText, setRow]
  )

  const stop = React.useCallback(() => {
    if (status === "running" && !disabled) onStop?.()
  }, [status, disabled, onStop])

  const addFiles = React.useMemo(() => {
    if (!onAddFiles || disabled) return null
    return (files: File[], at?: Range | null | "row") => {
      if (files.length === 0) return
      const accepted: File[] = []
      const rejected: File[] = []
      for (const file of files) {
        if (accepts(accept, file)) accepted.push(file)
        else rejected.push(file)
      }
      const inserted = onAddFiles(accepted, rejected)
      if (inserted?.length)
        insert(inserted, at === "row" ? null : at, at === "row")
    }
  }, [onAddFiles, disabled, accept, insert])

  const pickerRef = React.useRef<(() => void) | null>(null)
  React.useImperativeHandle(
    actionsRef,
    () => ({
      insert: (inserted) => {
        insert(inserted)
        editor.focus()
      },
      addFiles: (files) => addFiles?.(files, "row"),
      pickFiles: () => pickerRef.current?.(),
      focus: () => editor.focus(),
    }),
    [editor, insert, addFiles]
  )

  const registerFocus = React.useContext(TakeoverContext)
  React.useEffect(
    () => registerFocus?.(() => editor.focus()),
    [registerFocus, editor]
  )

  const setExpanded = React.useCallback(
    (next: boolean) => {
      setExpandedState(next)
      // The button that did it may go; the writing goes on.
      editor.focus()
    },
    [editor]
  )

  // The chip whose card shows: the selected one, else the one pointed at.
  React.useEffect(
    () =>
      editor.registerUpdateListener(({ editorState }) => {
        const key = editorState.read(() => $selectedChip()?.getKey() ?? null)
        setCard((current) =>
          key !== null
            ? current?.key === key
              ? current
              : { key, source: "selection" }
            : current?.source === "selection"
              ? null
              : current
        )
      }),
    [editor]
  )

  const hoverChip = React.useCallback((key: NodeKey | null) => {
    clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(
      () =>
        setCard((current) =>
          current?.source === "selection"
            ? current
            : key === null
              ? null
              : { key, source: "hover" }
        ),
      key === null ? 150 : 300
    )
  }, [])

  React.useEffect(() => () => clearTimeout(hoverTimer.current), [])

  /** A link's chip, as resolved so far: titled if it was, else resolving. */
  const linkChip = React.useCallback((url: string, preview: boolean) => {
    const done = resolved.current.get(url)
    const flag = preview ? { preview } : {}
    return done
      ? new ChipNode({ ...done, type: "link", url, ...flag })
      : new ChipNode({ type: "link", url, ...flag }, true)
  }, [])

  /** Fetches a resolving chip's title; a failure leaves its address. */
  const resolveChip = React.useCallback(
    (key: NodeKey, url: string) => {
      if (!resolveLink || resolved.current.has(url)) return
      const controller = new AbortController()
      resolving.current.set(key, controller)
      const settle = (details: ComposerLinkDetails | null) => {
        if (controller.signal.aborted) return
        resolving.current.delete(key)
        resolved.current.set(url, details)
        editor.update(
          () => {
            const node = $getNodeByKey(key)
            if (!$isChipNode(node) || node.__chip.type !== "link") return
            if (!details) {
              node.replace($createTextNode(url))
              return
            }
            const writable = node.getWritable()
            writable.__chip = { ...details, ...node.__chip }
            writable.__resolving = false
          },
          { tag: HISTORY_MERGE_TAG }
        )
        // A failed link is its address; the bar has nothing to change.
        if (!details)
          setPasted((current) => (current?.key === key ? null : current))
      }
      resolveLink(url, { signal: controller.signal }).then(
        (details) => settle(details ?? null),
        () => settle(null)
      )
    },
    [editor, resolveLink]
  )

  React.useEffect(() => {
    const inFlight = resolving.current
    return () => inFlight.forEach((controller) => controller.abort())
  }, [])

  const pasteAs = React.useCallback(
    (mode: PastedLink["mode"]) => {
      if (!pasted || pasted.mode === mode) return
      const { url } = pasted
      let next: PastedLink | null = null
      if (mode === "plain") {
        resolving.current.get(pasted.key)?.abort()
        resolving.current.delete(pasted.key)
        editor.update(
          () => {
            const node = $getNodeByKey(pasted.key)
            if (!node) return
            // The address may merge with the text before it; it is found
            // again by where it starts.
            const before = node.getPreviousSibling()
            const text = $createTextNode(url)
            node.replace(text)
            text.select()
            next =
              $isTextNode(before) && before.isSimpleText()
                ? {
                    key: before.getKey(),
                    offset: before.getTextContentSize(),
                    url,
                    mode,
                  }
                : { key: text.getKey(), offset: 0, url, mode }
          },
          { discrete: true, tag: HISTORY_MERGE_TAG }
        )
      } else if (pasted.mode === "plain") {
        let chipKey: NodeKey | null = null
        editor.update(
          () => {
            const node = $getNodeByKey(pasted.key)
            const start = pasted.offset
            if (
              !$isTextNode(node) ||
              node.getTextContent().slice(start, start + url.length) !== url
            )
              return
            const parts = node.splitText(start, start + url.length)
            const chip = linkChip(url, mode === "preview")
            parts[start === 0 ? 0 : 1]!.replace(chip)
            $caretBeside(chip, true)
            chipKey = chip.getKey()
          },
          { discrete: true, tag: HISTORY_MERGE_TAG }
        )
        if (chipKey !== null) {
          resolveChip(chipKey, url)
          next = { key: chipKey, offset: 0, url, mode }
        }
      } else {
        editor.update(
          () => {
            const node = $getNodeByKey(pasted.key)
            if (!$isChipNode(node) || node.__chip.type !== "link") return
            const link: ComposerLink = { ...node.__chip }
            if (mode === "preview") link.preview = true
            else delete link.preview
            node.getWritable().__chip = link
          },
          { discrete: true, tag: HISTORY_MERGE_TAG }
        )
        next = { ...pasted, mode }
      }
      setPasted(next)
    },
    [editor, pasted, linkChip, resolveChip]
  )

  const dismissPaste = React.useCallback(() => setPasted(null), [])

  // A link's address pasted: its chip, while the app resolves it.
  function pasteLink(url: string) {
    let key: NodeKey | null = null
    editor.update(
      () => {
        let selection = $getSelection()
        if (!$isRangeSelection(selection)) {
          $getRoot().selectEnd()
          selection = $getSelection()
        }
        if (!$isRangeSelection(selection)) return
        const chip = linkChip(url, false)
        selection.insertNodes([chip])
        key = chip.getKey()
      },
      { discrete: true }
    )
    if (key === null) return
    resolveChip(key, url)
    setPasted({ key, offset: 0, url, mode: "link" })
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const interrupting = interrupt.current
    interrupt.current = false
    if (disabled || submitDisabled) return
    const message = [
      ...rowRef.current,
      ...editor.getEditorState().read($readValue),
    ]
    // Nothing to send: no text but spaces, and no chips.
    if (!message.some((part) => typeof part !== "string" || part.trim())) return
    onSubmit?.(message, event, {
      interrupt: interrupting,
      followUp:
        status === "running" && followUp !== "send" && !editing
          ? interrupting
            ? followUp === "queue"
              ? "steer"
              : "queue"
            : followUp
          : "send",
    })
    setPasted(null)
    if (!controlled) setUncontrolledValue([])
  }

  // Paste and drop are handled on the way down, before the editor: the
  // app's handlers run first, and one that calls preventDefault() takes the
  // event, e.g. to handle its own kinds of data.
  function handlePaste(event: React.ClipboardEvent<HTMLFormElement>) {
    onPaste?.(event)
    if (event.defaultPrevented) {
      event.stopPropagation()
      return
    }
    const files = Array.from(event.clipboardData.files)
    const text = event.clipboardData.getData("text/plain")
    const inFence =
      editor.getRootElement()?.contains(event.target as Node) &&
      editor.getEditorState().read(() => {
        const range = $selectionLines()
        return !!range && !!$fenceOf(range.anchor)
      })
    if (inFence && text) {
      setPasted(null)
      if (!files.length) {
        event.preventDefault()
        event.stopPropagation()
        editor.update(
          () => {
            const selection = $getSelection()
            if ($isRangeSelection(selection)) selection.insertRawText(text)
          },
          { discrete: true }
        )
        return
      }
    }
    let textAsFile = false
    if (
      !inFence &&
      addFiles &&
      pasteAsFile &&
      text.length >= pasteAsFile.minLength
    ) {
      const file = new File([text], pasteAsFile.name ?? "Pasted text.txt", {
        type: "text/plain",
      })
      // Where the app does not take text files, it is pasted as text.
      if (accepts(accept, file)) {
        files.push(file)
        textAsFile = true
      }
    }
    if (addFiles && files.length > 0) {
      // Text pasted with the files is still pasted, unless it became one.
      if (textAsFile || !event.clipboardData.types.includes("text/plain")) {
        event.preventDefault()
        event.stopPropagation()
      }
      addFiles(files)
      return
    }
    // An address pasted into the text, not into the app's own fields.
    const url = text.trim()
    if (
      resolveLink &&
      !disabled &&
      files.length === 0 &&
      urlPattern.test(url) &&
      editor.getRootElement()?.contains(event.target as Node)
    ) {
      event.preventDefault()
      event.stopPropagation()
      pasteLink(url)
    }
  }

  // Data of the app's it takes, if the drag carries some.
  const carriesData = (dataTransfer: DataTransfer | null) =>
    !!onDropData &&
    !disabled &&
    !!dataTransfer &&
    Array.from(dataTransfer.types).some((type) => dropTypes?.includes(type))
  const takes = (dataTransfer: DataTransfer | null) =>
    carriesData(dataTransfer) || (!!addFiles && carriesFiles(dataTransfer))

  function handleDragEnter(event: React.DragEvent<HTMLFormElement>) {
    onDragEnter?.(event)
    if (!takes(event.dataTransfer)) return
    dragDepth.current += 1
    setDragging(carriesData(event.dataTransfer) ? "data" : "files")
  }

  function handleDragOver(event: React.DragEvent<HTMLFormElement>) {
    onDragOver?.(event)
    if (!takes(event.dataTransfer)) return
    // Allows the drop.
    event.preventDefault()
    event.dataTransfer.dropEffect = "copy"
  }

  function handleDragLeave(event: React.DragEvent<HTMLFormElement>) {
    onDragLeave?.(event)
    if (dragDepth.current === 0) return
    dragDepth.current -= 1
    if (dragDepth.current === 0) setDragging(null)
  }

  function handleDrop(event: React.DragEvent<HTMLFormElement>) {
    onDrop?.(event)
    dragDepth.current = 0
    setDragging(null)
    if (event.defaultPrevented) {
      event.stopPropagation()
      return
    }
    if (!takes(event.dataTransfer)) return
    event.preventDefault()
    event.stopPropagation()
    // Where they were dropped, if that is in the editor.
    const point = rangeAt(event.clientX, event.clientY)
    const root = editor.getRootElement()
    const at = point && root?.contains(point.startContainer) ? point : null
    if (carriesData(event.dataTransfer)) {
      const inserted = onDropData!(event.dataTransfer)
      if (inserted?.length) {
        insert(inserted, at)
        editor.focus()
      }
      return
    }
    // Not on the text: there is no place in it, so to the row if any.
    addFiles!(Array.from(event.dataTransfer.files), at ?? "row")
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    onKeyDown?.(event)
    if (event.defaultPrevented) return
    if (isExpandKey(event)) {
      event.preventDefault()
      setExpanded(!expanded)
    } else if (
      event.key === "Escape" &&
      expanded &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault()
      setExpanded(false)
    }
  }

  function handleBlur(event: React.FocusEvent<HTMLFormElement>) {
    onBlur?.(event)
    if (event.currentTarget.contains(event.relatedTarget)) return
    setPasted(null)
    setCard((current) => (current?.source === "selection" ? null : current))
  }

  // What looks like a secret in the text, unless kept as text.
  const secret = React.useMemo(() => {
    if (!detectSecret) return null
    const found = detectSecret(
      value.filter((part) => typeof part === "string").join("")
    )
    return found && !keptSecrets.includes(found.text) ? found : null
  }, [detectSecret, value, keptSecrets])

  // A paragraph a line, split before the Markdown's runs (which the
  // expanded editor styles) are looked at.
  React.useEffect(
    () =>
      mergeRegister(
        editor.registerNodeTransform(ParagraphNode, $splitLines),
        // Backspace at the very start deletes nothing, as in a text box: a
        // blank first line is not taken out.
        editor.registerCommand(
          DELETE_CHARACTER_COMMAND,
          (backward) => {
            const selection = $getSelection()
            if (!backward || !$isRangeSelection(selection)) return false
            const { anchor } = selection
            const node = anchor.getNode()
            const line = node.getTopLevelElement()
            return (
              selection.isCollapsed() &&
              anchor.offset === 0 &&
              !!line &&
              !line.getPreviousSibling() &&
              (node.is(line) || node.is(line.getFirstChild()))
            )
          },
          COMMAND_PRIORITY_LOW
        ),
        registerMarkdown(editor)
      ),
    [editor]
  )

  // The secret, while it is asked about, stands out in the text as code
  // (a mono chip); its own text node, which typing beside it leaves.
  const secretText = secret?.text ?? null
  React.useEffect(() => {
    const fix = (node: TextNode) => {
      if (!node.isAttached()) return
      const content = node.getTextContent()
      if (node.hasFormat("code")) {
        if (content !== secretText) node.toggleFormat("code")
        return
      }
      if (!secretText || !node.isSimpleText()) return
      const at = content.indexOf(secretText)
      if (at < 0) return
      const parts = node.splitText(at, at + secretText.length)
      parts[at === 0 ? 0 : 1]!.toggleFormat("code")
    }
    const unregister = editor.registerNodeTransform(TextNode, fix)
    editor.update(
      () => {
        for (const block of $getRoot().getChildren()) {
          if (!$isElementNode(block)) continue
          for (const node of block.getChildren())
            if ($isTextNode(node)) fix(node)
        }
      },
      { tag: HISTORY_MERGE_TAG }
    )
    return unregister
  }, [editor, secretText])

  const keepSecret = (found: ComposerSecret) =>
    setKeptSecrets((current) => [...current, found.text])

  function saveSecret(found: ComposerSecret) {
    const replacement = onSaveSecret?.(found)
    if (!replacement?.length) {
      keepSecret(found)
      return
    }
    editor.update(() => {
      if (!$replaceText(found.text, replacement)) return
    })
    editor.focus()
  }

  const context: ComposerContextValue = {
    status,
    followUp,
    disabled,
    submitDisabled,
    submitOnEnter,
    accept,
    takesFiles: !!onAddFiles,
    addFiles,
    pickerRef,
    labels: allLabels,
    stop,
    renderMention,
    renderLinkIcon,
    attachmentState,
    onOpenQuote,
    onOpenAttachment,
    onRetryAttachment,
    value,
    row,
    setRow,
    setPlacement,
    expanded,
    setExpanded,
    hoverChip,
    pasted,
    pasteAs,
    dismissPaste,
    interrupt,
    editing,
    voice,
    setVoice,
    setVoiceError,
    recall: recall
      ? { position: recall.index + 1, count: history?.length ?? 0 }
      : null,
    errorId: error ? errorId : undefined,
    complete,
    completeDelay,
    voiceLevels,
    insertValue: (inserted) => {
      insert(inserted)
      // Hidden (a take's words going in as it ends), it takes the focus
      // once shown (ComposerEditor): focused before, WebKit put the caret
      // back at the start.
      if (editor.getRootElement()?.getClientRects().length) editor.focus()
    },
    focus: () => editor.focus(),
    suggesting: suggesting > 0,
    suggest: (open) => setSuggesting((count) => count + (open ? 1 : -1)),
  }

  return (
    <ComposerContext.Provider value={context}>
      <form
        data-slot="composer"
        data-status={status}
        data-dragging={dragging ? "" : undefined}
        data-dragging-files={dragging === "files" ? "" : undefined}
        data-expanded={expanded ? "" : undefined}
        data-editing={editing ? "" : undefined}
        className={cn("w-full", className)}
        onSubmit={handleSubmit}
        onPasteCapture={handlePaste}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDropCapture={handleDrop}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        {...props}
      >
        {editing === true ? (
          <ComposerShelf>
            <ComposerShelfBar
              icon={<HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} />}
              detail={allLabels.editingDetail}
              actions={
                onCancelEdit ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => {
                      onCancelEdit()
                      editor.focus()
                    }}
                  >
                    {allLabels.cancel}
                    <Kbd className="ms-1 h-auto min-w-0 bg-transparent px-1 text-2xs text-muted-foreground">
                      Esc
                    </Kbd>
                  </Button>
                ) : null
              }
            >
              {allLabels.editing}
            </ComposerShelfBar>
          </ComposerShelf>
        ) : secret ? (
          <ComposerShelf>
            <ComposerShelfBar
              role="alert"
              icon={<HugeiconsIcon icon={SecurityCheckIcon} strokeWidth={2} />}
              detail={allLabels.secretDetail}
              aside={
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => keepSecret(secret)}
                >
                  {allLabels.keepSecret}
                </Button>
              }
              actions={
                onSaveSecret ? (
                  <Button
                    type="button"
                    size="xs"
                    onClick={() => saveSecret(secret)}
                  >
                    {allLabels.saveSecret(secret.name)}
                  </Button>
                ) : null
              }
            >
              {allLabels.secret}
            </ComposerShelfBar>
          </ComposerShelf>
        ) : null}
        <InputGroup
          ref={group}
          data-popups={popups}
          // The group is disabled as a whole: its placeholder, dimmed with
          // it, is the text of an inactive control.
          aria-disabled={disabled || undefined}
          className={cn(
            "h-auto flex-col",
            // It floats over the conversation: a soft shadow with its own
            // hairline, no border, so no focus outline either (the caret
            // is the editor's focus indicator). Forced colors drop the
            // shadow: a border there. The radius is the theme's
            // rounded-composer, written as its variable so that cn
            // replaces the group's rounded-lg.
            "rounded-(--radius-composer) border-0 bg-background shadow-float dark:bg-card forced-colors:border",
            // An error is said in the line under it, in grey; the field
            // stays as it is rather than ringed in red.
            "has-[[data-slot][aria-invalid=true]]:border-transparent has-[[data-slot][aria-invalid=true]]:ring-0",
            // Expanded, it takes the height of a page of writing.
            expanded && "h-[var(--composer-expanded-height,min(40rem,80dvh))]",
            // A drop target: its hairline darkens; dashed in forced colors.
            // For files, 96px at least, for its three lines; for the app's
            // data, as it is, its text where the reader drops it.
            "in-data-dragging:ring-1 in-data-dragging:ring-foreground/15 in-data-dragging-files:min-h-24 forced-colors:in-data-dragging:border-dashed",
            // Disabled, a muted field, dimmed once (an editor cannot be
            // :disabled, which shadcn's look keys on): its buttons do not
            // dim again inside it.
            disabled &&
              "bg-muted opacity-60 dark:bg-muted [&_button:is(:disabled,[data-disabled])]:opacity-100"
          )}
        >
          {children}
          {card ? (
            <ChipCard
              target={card}
              group={group}
              onPointerEnter={() => clearTimeout(hoverTimer.current)}
              onPointerLeave={() => hoverChip(null)}
              onClose={() => setCard(null)}
            />
          ) : null}
          {/* A chip selected by the keyboard has no caret to read it out. */}
          <span aria-live="polite" className="sr-only">
            {card?.source === "selection"
              ? allLabels.selected(selectedText(editor, card.key))
              : ""}
          </span>
          {/* Over it for files; the app's data goes in its text, seen. */}
          {dragging === "files" ? (
            <div
              aria-hidden
              data-slot="composer-drop"
              // Its lines a little over the middle: the icon 15px from
              // the top.
              className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 rounded-composer bg-background pb-1 text-muted-foreground dark:bg-card [&>svg]:size-5"
            >
              <HugeiconsIcon icon={Attachment01Icon} strokeWidth={2} />
              <span className="text-2sm font-medium text-foreground">
                {allLabels.drop}
              </span>
              {allLabels.dropDetail ? (
                <span className="text-xs text-subtle-foreground">
                  {allLabels.dropDetail}
                </span>
              ) : null}
            </div>
          ) : null}
        </InputGroup>
        {error ? (
          <div
            data-slot="composer-error"
            className="mt-2 flex min-h-6 items-center gap-2 px-2 text-2sm text-muted-foreground [&>svg]:size-3.5 [&>svg]:shrink-0"
          >
            <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
            <span id={errorId} className="min-w-0">
              {error}
            </span>
            {onRetry ? (
              <Button
                type="button"
                variant="outline"
                size="xs"
                // The row's grey is its message's, not the button's.
                className="ms-auto text-foreground"
                onClick={onRetry}
              >
                {allLabels.retry}
              </Button>
            ) : null}
          </div>
        ) : voiceError ? (
          <div
            data-slot="composer-voice-error"
            role="alert"
            className="mt-2 flex min-h-6 items-center gap-2 ps-2 text-2sm text-muted-foreground [&>svg]:size-3.5 [&>svg]:shrink-0"
          >
            <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
            <span className="min-w-0">{voiceError.message}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={voiceError.dismiss}
              className="ms-auto text-subtle-foreground hover:text-foreground"
              onClick={() => {
                setVoiceError(null)
                editor.focus()
              }}
            >
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
            </Button>
          </div>
        ) : null}
      </form>
    </ComposerContext.Provider>
  )
}

/**
 * The card above a selected or pointed-at chip: a file's picture and what
 * went wrong, a link's page; open, retry, show as an address, remove.
 */
function ChipCard({
  target,
  group,
  onPointerEnter,
  onPointerLeave,
  onClose,
}: {
  target: ChipCardTarget
  group: React.RefObject<HTMLDivElement | null>
  onPointerEnter: () => void
  onPointerLeave: () => void
  onClose: () => void
}) {
  const composer = useComposer()
  const [editor] = useLexicalComposerContext()
  const [left, setLeft] = React.useState(0)
  const card = React.useRef<HTMLDivElement>(null)
  // Read on each render: the chip's link may resolve meanwhile.
  const node = editor
    .getEditorState()
    .read(() => $getNodeByKey(target.key) as LexicalNode | null)
  const chip = $isChipNode(node) && !node.__resolving ? node.__chip : null

  React.useLayoutEffect(() => {
    const element = editor.getElementByKey(target.key)
    const box = group.current?.getBoundingClientRect()
    if (!element || !box) return
    const width = card.current?.offsetWidth ?? 0
    // Its edge on the chip's.
    const shown = element.firstElementChild ?? element
    const at = shown.getBoundingClientRect().left - box.left
    setLeft(Math.max(0, Math.min(at, box.width - width)))
  }, [editor, group, target.key, chip])

  if (!chip || chip.type === "mention") return null

  const remove = () => {
    editor.update(() => {
      const chipNode = $getNodeByKey(target.key)
      if (chipNode) $removeChip(chipNode)
    })
    onClose()
    editor.focus()
  }
  const showAsUrl = () => {
    if (chip.type !== "link") return
    editor.update(() => {
      const chipNode = $getNodeByKey(target.key)
      if (!chipNode) return
      const text = $createTextNode(chip.url)
      chipNode.replace(text)
      text.select()
    })
    onClose()
    editor.focus()
  }
  const { labels } = composer
  const state =
    chip.type === "attachment" ? composer.attachmentState?.(chip) : undefined

  const action =
    "relative h-7 gap-1 px-2 text-xs font-normal text-muted-foreground hover:text-foreground pointer-coarse:after:absolute pointer-coarse:after:-inset-2"
  // Its key, after an action's words: a hairline square.
  const key =
    "ms-0.5 h-4 min-w-4 bg-transparent px-1 text-2xs text-subtle-foreground ring-1 ring-border ring-inset"
  return (
    <div
      ref={card}
      data-slot="composer-chip-card"
      style={{ left }}
      className={cn(
        "absolute bottom-full z-50 mb-2 max-w-full overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-float",
        // A file's is a picture's width, wider for a third action (Retry,
        // when it failed); a link's has its page's words.
        chip.type === "attachment"
          ? state?.error && composer.onRetryAttachment
            ? "w-80"
            : "w-64"
          : "w-84"
      )}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      // Keeps the focus, and the selection, in the editor.
      onMouseDown={(event) => event.preventDefault()}
    >
      {chip.type === "quote" ? (
        <>
          <div className="flex items-center gap-1 px-3 pt-3 pb-2 text-xs text-muted-foreground">
            <HugeiconsIcon icon={QuoteDownIcon} strokeWidth={2} />
            {labels.quote}
            {chip.source ? ` · ${chip.source}` : null}
          </div>
          <div className="max-h-40 overflow-y-auto px-3 pb-2 text-2sm break-words whitespace-pre-wrap">
            {chip.text}
          </div>
        </>
      ) : chip.type === "attachment" ? (
        <>
          {chip.preview && chip.mediaType?.startsWith("image/") ? (
            <img
              src={chip.preview}
              alt=""
              className="h-40 w-full bg-muted object-cover"
            />
          ) : null}
          <div className="flex items-baseline justify-between gap-3 px-3 pt-3 pb-2 text-2sm">
            <span className="truncate">{chip.name}</span>
            {chip.detail ? (
              <span className="shrink-0 text-xs text-subtle-foreground">
                {chip.detail}
              </span>
            ) : null}
          </div>
          {state?.error ? (
            <p className="flex items-center gap-1 px-3 pb-2 text-xs [&_svg]:size-3.5 [&_svg]:shrink-0">
              <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
              {state.error}
            </p>
          ) : null}
        </>
      ) : (
        <>
          {chip.image ? (
            <img
              src={chip.image}
              alt=""
              className="h-32 w-full bg-muted object-cover"
            />
          ) : null}
          <div className="px-3 pt-3 pb-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground [&_img]:size-3.5 [&_img]:rounded-xs [&_svg]:size-3.5">
              {composer.renderLinkIcon?.(chip) ??
                (chip.icon ? (
                  <img src={chip.icon} alt="" />
                ) : (
                  <HugeiconsIcon icon={Globe02Icon} strokeWidth={2} />
                ))}
              <span className="truncate">
                {hostOf(chip.url)}
                {chip.fetched ? ` · ${labels.fetched(chip.fetched)}` : null}
              </span>
            </div>
            <p className="mt-1 text-sm leading-5 font-medium">
              {chip.title ?? chip.url}
            </p>
            {chip.description ? (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {chip.description}
              </p>
            ) : null}
          </div>
        </>
      )}
      <div className="flex gap-0.5 border-t px-1 py-1">
        {chip.type === "link" ? (
          <>
            <a
              href={chip.url}
              target="_blank"
              rel="noopener noreferrer"
              tabIndex={-1}
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                action
              )}
            >
              <HugeiconsIcon icon={LinkSquare02Icon} strokeWidth={2} />
              {labels.open}
            </a>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              tabIndex={-1}
              className={action}
              onClick={showAsUrl}
            >
              <HugeiconsIcon icon={Link01Icon} strokeWidth={2} />
              {labels.showAsUrl}
            </Button>
          </>
        ) : chip.type === "quote" ? (
          composer.onOpenQuote ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              tabIndex={-1}
              aria-keyshortcuts="Enter"
              className={action}
              onClick={() => {
                composer.onOpenQuote?.(chip)
                onClose()
              }}
            >
              <HugeiconsIcon icon={ArrowExpand01Icon} strokeWidth={2} />
              {labels.open}
              <Kbd aria-hidden className={key}>
                ↵
              </Kbd>
            </Button>
          ) : null
        ) : (
          <>
            {composer.onOpenAttachment ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                tabIndex={-1}
                aria-keyshortcuts="Enter"
                className={action}
                onClick={() => {
                  composer.onOpenAttachment?.(chip)
                  onClose()
                }}
              >
                <HugeiconsIcon icon={ArrowExpand01Icon} strokeWidth={2} />
                {labels.open}
                <Kbd aria-hidden className={key}>
                  ↵
                </Kbd>
              </Button>
            ) : null}
            {state?.error && composer.onRetryAttachment ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                tabIndex={-1}
                className={action}
                onClick={() => composer.onRetryAttachment?.(chip)}
              >
                <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} />
                {labels.retry}
              </Button>
            ) : null}
          </>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          tabIndex={-1}
          aria-keyshortcuts="Backspace"
          className={action}
          onClick={remove}
        >
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
          {labels.remove}
          {chip.type !== "link" ? (
            <Kbd aria-hidden className={key}>
              ⌫
            </Kbd>
          ) : null}
        </Button>
      </div>
    </div>
  )
}

let wordSegmenter: Intl.Segmenter | undefined
const wordLike = /[\p{L}\p{N}]/u

/**
 * Counts the words of a message, for the expanded editor's header: words
 * as the language has them, so a line of Chinese or Japanese counts its words, not as
 * one. A line at a time, each kept for the next count (no word goes over
 * a line break): a key in a long draft counts one line again, not all.
 */
function createWordCounter() {
  let counted = new Map<string, number>()
  return (value: ComposerValue) => {
    wordSegmenter ??= new Intl.Segmenter(undefined, { granularity: "word" })
    const next = new Map<string, number>()
    let count = 0
    for (const line of composerText(value).split("\n")) {
      let words = next.get(line) ?? counted.get(line)
      if (words === undefined) {
        words = 0
        // A part with a letter or a digit, not `isWordLike`: Firefox has
        // the last CJK word before a space as not word-like.
        for (const part of wordSegmenter.segment(line))
          if (wordLike.test(part.segment)) words++
      }
      next.set(line, words)
      count += words
    }
    counted = next
    return count
  }
}

/** The count trails the typing, so a long draft's keys don't wait on it. */
function DraftWords({
  value,
  words,
}: {
  value: ComposerValue
  words: (count: number) => string
}) {
  const shown = React.useDeferredValue(value)
  const [wordCount] = React.useState(createWordCounter)
  const count = React.useMemo(() => wordCount(shown), [wordCount, shown])
  return <span>{words(count)}</span>
}

/** The message as Markdown, chips as their names and links. */
const markdownOf = (value: ComposerValue) =>
  composerText(value, (chip) =>
    chip.type === "link"
      ? `[${chip.title ?? chip.url}](${chip.url})`
      : chipText(chip)
  )

/** Whether the caret is collapsed at the very end of the text. */
function $caretAtEnd() {
  const selection = $getSelection()
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false
  const block = $getRoot().getLastChild()
  if (!$isElementNode(block)) return false
  let end = block.getLastChild()
  while ($isCompletionNode(end)) end = end.getPreviousSibling()
  const { anchor } = selection
  const node = anchor.getNode()
  if (anchor.type === "text")
    return node.is(end) && anchor.offset === node.getTextContentSize()
  return (
    node.is(block) &&
    anchor.offset >= (end ? end.getIndexWithinParent() + 1 : 0)
  )
}

function $completion(): CompletionNode | null {
  const block = $getRoot().getLastChild()
  if (!$isElementNode(block)) return null
  const last = block.getLastChild()
  return $isCompletionNode(last) ? last : null
}

/**
 * Asks the app how the text goes on once typing pauses with the caret at
 * its end, and shows it after the caret: Tab takes it, any other key, a
 * click elsewhere or Escape drops it.
 */
function useCompletion(complete: ComposerProps["complete"], delay: number) {
  const [editor] = useLexicalComposerContext()
  const latest = React.useRef({ complete, delay })
  React.useLayoutEffect(() => {
    latest.current = { complete, delay }
  })
  const on = !!complete

  React.useEffect(() => {
    if (!on) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let controller: AbortController | undefined
    // The endings in the editor, so a key drops them without a look
    // through a long draft.
    const shown = new Set<NodeKey>()
    const reset = () => {
      clearTimeout(timer)
      controller?.abort()
      controller = undefined
    }
    const schedule = () => {
      reset()
      timer = setTimeout(() => {
        const state = editor.getEditorState()
        const ready = state.read(
          () =>
            $caretAtEnd() &&
            !$completion() &&
            $getRoot().getTextContent().trim() !== ""
        )
        if (!ready || editor.isComposing()) return
        const asked = new AbortController()
        controller = asked
        latest.current
          .complete?.(state.read($readValue), { signal: asked.signal })
          .then(
            (text) => {
              if (asked.signal.aborted || !text) return
              if (editor.getEditorState() !== state) return
              editor.update(() => {
                const block = $getRoot().getLastChild()
                if (!$caretAtEnd() || !$isElementNode(block)) return
                block.append(new CompletionNode(text))
                $addUpdateTag(HISTORIC_TAG)
              })
            },
            () => {}
          )
      }, latest.current.delay)
    }
    const drop = () => {
      if (editor.getEditorState().read($completion))
        editor.update(() => {
          $dropCompletion(shown)
        })
    }
    const unregister = mergeRegister(
      editor.registerMutationListener(
        CompletionNode,
        (mutations) => {
          for (const [key, mutation] of mutations)
            if (mutation === "destroyed") shown.delete(key)
            else shown.add(key)
        },
        { skipInitialization: false }
      ),
      editor.registerUpdateListener(({ dirtyLeaves, dirtyElements, tags }) => {
        if (tags.has(HISTORIC_TAG)) return
        if (dirtyLeaves.size === 0 && dirtyElements.size === 0) {
          // The caret moved: an ending only goes after it at the end.
          if (!editor.getEditorState().read($caretAtEnd)) {
            reset()
            drop()
          }
          return
        }
        schedule()
      }),
      editor.registerCommand(
        KEY_TAB_COMMAND,
        (event) => {
          const node = $completion()
          if (!node || event.shiftKey) return false
          event.preventDefault()
          const text = $createTextNode(node.__text)
          node.replace(text)
          text.select(text.getTextContentSize(), text.getTextContentSize())
          return true
        },
        COMMAND_PRIORITY_NORMAL
      ),
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        (event) => {
          reset()
          if (!$dropCompletion(shown)) return false
          event.preventDefault()
          return true
        },
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand(
        KEY_DOWN_COMMAND,
        (event) => {
          const passes = [
            "Tab",
            "Escape",
            "Shift",
            "Meta",
            "Control",
            "Alt",
          ].includes(event.key)
          if (!passes) $dropCompletion(shown)
          return false
        },
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand(
        BLUR_COMMAND,
        () => {
          reset()
          $dropCompletion(shown)
          return false
        },
        COMMAND_PRIORITY_LOW
      ),
      reset
    )
    return () => {
      unregister()
      drop()
    }
  }, [editor, on])
}

function ComposerEditor({
  className,
  placeholder,
  previewProps,
  ...props
}: Omit<
  ContentEditableElementProps,
  "editor" | "children" | "placeholder" | "contentEditable"
> & {
  placeholder?: string
  /**
   * The expanded editor's Markdown preview: its `labels`, `headingOffset`
   * (so the draft's headings sit under the page's) and the rest of
   * Markdown's props, as the app gives its messages.
   */
  previewProps?: Omit<MarkdownProps, "children">
}) {
  const composer = useComposer()
  const [editor] = useLexicalComposerContext()
  const coarse = useCoarsePointer()
  const submitOnEnter = composer.submitOnEnter ?? !coarse
  const {
    disabled,
    submitDisabled,
    status,
    stop,
    expanded,
    setExpanded,
    labels,
    onOpenQuote,
    onOpenAttachment,
    onRetryAttachment,
    attachmentState,
    interrupt,
  } = composer
  const [tab, setTab] = React.useState<"write" | "preview">("write")
  const shownTab = expanded ? tab : "write"
  const [overflowing, setOverflowing] = React.useState(false)
  useCompletion(composer.complete, composer.completeDelay)
  const completes = !!composer.complete

  // A take over (Done, let go, sent, Cancel, Escape, at its longest):
  // the editor, shown again, has the focus back, the caret after the
  // words it put in or where it was. Not before: hidden while it
  // recorded, it could not take it, and the focus fell to the page,
  // where typing went nowhere (and, in WebKit, to a tool beside the mic,
  // its tooltip left open). Not taken from elsewhere the reader went.
  const recording = composer.voice !== null
  const wasRecording = React.useRef(recording)
  React.useLayoutEffect(() => {
    const was = wasRecording.current
    wasRecording.current = recording
    if (!was || recording) return
    const root = editor.getRootElement()
    const active = document.activeElement
    const box = root?.closest("[data-slot=composer]")
    if (!root || (active && active !== document.body && !box?.contains(active)))
      return
    // The caret after the words, or where it was. What Lexical has yet
    // to write first (the box cleared as the words were sent), so the
    // page's caret read is its last.
    editor.update(() => {}, { discrete: true })
    const page = document.getSelection()
    const kept =
      page?.rangeCount && root.contains(page.anchorNode)
        ? page.getRangeAt(0).cloneRange()
        : null
    // The page's caret, kept as the editor is focused: WebKit, focusing
    // it, put the caret at its start (Lexical's focus() too, as it does
    // not write a caret it already had).
    if (page && kept) {
      root.focus({ preventScroll: true })
      page.removeAllRanges()
      page.addRange(kept)
      return
    }
    // None on the page: Lexical's, written, which focuses the editor.
    editor.update(
      () => {
        const selection = $getSelection()
        if (selection) selection.dirty = true
        else $getRoot().selectEnd()
      },
      { discrete: true }
    )
    if (document.activeElement !== root) editor.focus()
  }, [recording, editor])

  React.useEffect(() => {
    const unregister = [
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (event) => {
          if (!event || event.defaultPrevented) return false
          // While an input method composes, Enter confirms what it is
          // composing. (Safari reports keyCode 229, not isComposing.)
          if (event.isComposing || event.keyCode === 229) return true
          // On a selected file, Enter opens it (or tries a failed one
          // again).
          const chip = editor.getEditorState().read(() => $selectedChip())
          if (chip?.__chip.type === "quote" && !event.shiftKey && onOpenQuote) {
            event.preventDefault()
            onOpenQuote(chip.__chip)
            return true
          }
          if (chip?.__chip.type === "attachment" && !event.shiftKey) {
            const attachment = chip.__chip
            const failed = !!attachmentState?.(attachment)?.error
            const act =
              failed && onRetryAttachment ? onRetryAttachment : onOpenAttachment
            if (act) {
              event.preventDefault()
              act(attachment)
              return true
            }
          }
          if (!event.metaKey && !event.ctrlKey && $fenceEnter(event.shiftKey)) {
            event.preventDefault()
            return true
          }
          if (event.shiftKey || !submitOnEnter) return false
          event.preventDefault()
          if (!disabled && !submitDisabled) {
            interrupt.current = event.metaKey || event.ctrlKey
            editor.getRootElement()?.closest("form")?.requestSubmit()
          }
          return true
        },
        COMMAND_PRIORITY_NORMAL
      ),
      editor.registerCommand(
        KEY_TAB_COMMAND,
        (event) => {
          if (
            event.defaultPrevented ||
            event.isComposing ||
            event.keyCode === 229 ||
            editor.isComposing() ||
            event.metaKey ||
            event.ctrlKey ||
            event.altKey
          )
            return false
          if (!$fenceTab(event.shiftKey)) return false
          event.preventDefault()
          return true
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        (event) => {
          if (event.defaultPrevented) return false
          if (event.isComposing || event.keyCode === 229) return false
          // Expanded, Escape collapses it first (the form does).
          if (status !== "running" || expanded) return false
          event.preventDefault()
          stop()
          return true
        },
        COMMAND_PRIORITY_LOW
      ),
      // Backspace or Delete beside a chip selects it; again, removes it.
      ...([true, false] as const).map((backward) =>
        editor.registerCommand(
          backward ? KEY_BACKSPACE_COMMAND : KEY_DELETE_COMMAND,
          (event) => {
            const selected = $selectedChip()
            if (selected) {
              event.preventDefault()
              $removeChip(selected)
              return true
            }
            const beside = $chipBeside(backward)
            if (!beside) return false
            event.preventDefault()
            const selection = $createNodeSelection()
            selection.add(beside.getKey())
            $setSelection(selection)
            return true
          },
          COMMAND_PRIORITY_LOW
        )
      ),
      // The arrows step onto a chip (Lexical selects it), then past it.
      ...([true, false] as const).map((backward) =>
        editor.registerCommand(
          backward ? KEY_ARROW_LEFT_COMMAND : KEY_ARROW_RIGHT_COMMAND,
          (event) => {
            const selected = $selectedChip()
            if (!selected || event.shiftKey) return false
            event.preventDefault()
            const rtl =
              getComputedStyle(editor.getRootElement()!).direction === "rtl"
            $caretBeside(selected, backward === rtl)
            return true
          },
          COMMAND_PRIORITY_LOW
        )
      ),
      // Typing on a selected chip types after it, not over it.
      editor.registerCommand(
        KEY_DOWN_COMMAND,
        (event) => {
          if (
            event.key.length !== 1 ||
            event.metaKey ||
            event.ctrlKey ||
            event.altKey
          )
            return false
          const selected = $selectedChip()
          if (!selected) return false
          event.preventDefault()
          $caretBeside(selected, true)
          const selection = $getSelection()
          if ($isRangeSelection(selection)) selection.insertText(event.key)
          return true
        },
        COMMAND_PRIORITY_LOW
      ),
    ]
    return () => unregister.forEach((fn) => fn())
  }, [
    editor,
    submitOnEnter,
    disabled,
    interrupt,
    submitDisabled,
    status,
    stop,
    expanded,
    attachmentState,
    onOpenQuote,
    onOpenAttachment,
    onRetryAttachment,
  ])

  // Whether the text is past its height, to offer the expanded editor.
  React.useEffect(() => {
    const root = editor.getRootElement()
    if (!root) return
    // Once a frame, as the browser lays it out anyway, not at each key.
    let frame = 0
    const measure = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        setOverflowing(root.scrollHeight > root.clientHeight + 1)
      })
    }
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    measure()
    const unregister = editor.registerUpdateListener(measure)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      unregister()
    }
  }, [editor])

  const empty = useLexicalIsTextContentEmpty(editor)
  const shortcut = apple() ? "⌘⇧E" : "Ctrl+Shift+E"

  return (
    <Tabs
      value={shownTab}
      onValueChange={(next) => setTab(next as "write" | "preview")}
      className="contents"
    >
      {expanded ? (
        <div
          data-slot="composer-header"
          className="order-first flex h-11 w-full shrink-0 items-center gap-2 border-b ps-4 pe-2 text-2sm text-muted-foreground"
        >
          <span className="font-medium text-foreground">{labels.draft}</span>
          <span aria-hidden>·</span>
          <DraftWords value={composer.value} words={labels.words} />
          <div className="ms-auto flex items-center gap-1">
            <TabsList className="w-36">
              <TabsTrigger value="write" className="text-xs">
                {labels.write}
              </TabsTrigger>
              <TabsTrigger value="preview" className="text-xs">
                {labels.preview}
              </TabsTrigger>
            </TabsList>
            <ExpandButton
              label={labels.collapse}
              shortcut={shortcut}
              onClick={() => setExpanded(false)}
            >
              <HugeiconsIcon icon={ArrowShrink02Icon} strokeWidth={2} />
            </ExpandButton>
          </div>
        </div>
      ) : null}
      {composer.voice ? <VoiceWave voice={composer.voice} /> : null}
      <TabsContent
        value="write"
        keepMounted
        data-slot="composer-editor"
        className={cn(
          "relative w-full min-w-0 flex-none",
          expanded && "min-h-0 flex-1",
          // While recording, the waveform takes its place.
          composer.voice && "hidden"
        )}
        // Without its tabs, the editor is not a tab panel.
        render={(panelProps) => {
          if (expanded) return <div {...panelProps} />
          const rest: React.ComponentProps<"div"> = { ...panelProps }
          delete rest.role
          delete rest.tabIndex
          delete rest["aria-labelledby"]
          return <div {...rest} />
        }}
      >
        <PlainTextPlugin
          contentEditable={
            <ContentEditableElement
              editor={editor}
              data-slot="input-group-control"
              aria-multiline
              aria-disabled={disabled}
              aria-keyshortcuts="Control+Shift+E Meta+Shift+E"
              // The on-screen keyboard's key says what Enter does.
              enterKeyHint={submitOnEnter ? "send" : "enter"}
              {...(placeholder ? { "aria-placeholder": placeholder } : {})}
              {...(composer.errorId
                ? {
                    "aria-invalid": true,
                    "aria-describedby": composer.errorId,
                  }
                : {})}
              className={cn(
                // 16px on phones, so iOS does not zoom in. Lines with chips
                // are 28px, for the chips' 24px. One line to eight, then it
                // scrolls.
                "max-h-[calc(8lh+1rem)] min-h-[calc(1lh+1rem)] w-full overflow-y-auto px-4 pt-3 pb-1 text-base leading-6 break-words whitespace-pre-wrap outline-none has-data-[slot=composer-chip]:leading-7",
                // A secret asked about: a mono chip.
                "[&_code]:rounded-sm [&_code]:bg-muted [&_code]:px-1 [&_code]:py-1 [&_code]:font-mono [&_code]:text-2sm [&_code]:ring-1 [&_code]:ring-border [&_code]:ring-inset dark:[&_code]:bg-background",
                // grid: clear (room for the 40px expand button)
                (overflowing || completes) && !expanded && "pe-10",
                expanded && "h-full max-h-none px-6 py-6",
                // Expanded, Markdown is styled as typed: the marks muted,
                // headings semibold, code in mono. Lines of text are 24px
                // (code 20px) and a blank line 12px, as between paragraphs.
                expanded &&
                  "leading-3 has-data-[slot=composer-chip]:leading-3 md:leading-3 md:has-data-[slot=composer-chip]:leading-3 [&_[data-lexical-text]]:leading-6 [&_[data-lexical-text][data-md=code]]:leading-5 [&_[data-md=code]]:font-mono [&_[data-md=code]]:text-xs [&_[data-md=code]]:text-muted-foreground [&_[data-md=heading]]:font-semibold [&_[data-md=inline-code]]:font-mono [&_[data-md=inline-code]]:text-2sm [&_[data-md=mark]]:text-subtle-foreground",
                className
              )}
              {...props}
            />
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        {placeholder && empty ? (
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-x-4 top-3 truncate text-base leading-6 text-subtle-foreground select-none",
              expanded && "inset-x-6 top-5"
            )}
          >
            {placeholder}
          </div>
        ) : null}
        {overflowing && !expanded ? (
          <ExpandButton
            label={labels.expand}
            shortcut={shortcut}
            className="absolute end-2 top-2"
            onClick={() => setExpanded(true)}
          >
            <HugeiconsIcon icon={ArrowExpand01Icon} strokeWidth={2} />
          </ExpandButton>
        ) : completes && !expanded ? (
          // Says that endings are suggested.
          <span
            aria-hidden
            data-slot="composer-completion-mark"
            className="pointer-events-none absolute end-2 top-2 grid size-6 place-items-center text-subtle-foreground [&>svg]:size-3.5"
          >
            <HugeiconsIcon icon={SparklesIcon} strokeWidth={2} />
          </span>
        ) : null}
        <PasteAsBar />
        <HistoryPlugin />
      </TabsContent>
      {expanded ? (
        <TabsContent
          value="preview"
          className="min-h-0 w-full flex-1 overflow-y-auto px-6 py-6"
        >
          {shownTab === "preview" ? (
            <React.Suspense fallback={null}>
              <Markdown {...previewProps}>
                {markdownOf(composer.value)}
              </Markdown>
            </React.Suspense>
          ) : null}
        </TabsContent>
      ) : null}
    </Tabs>
  )
}

/** Expands or collapses the editor; its shortcut is in its tooltip. */
function ExpandButton({
  label,
  shortcut,
  className,
  children,
  onClick,
}: {
  label: string
  shortcut: string
  className?: string
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <InputGroupButton
            data-slot="composer-expand"
            type="button"
            size="icon-xs"
            aria-label={label}
            aria-keyshortcuts="Control+Shift+E Meta+Shift+E"
            className={cn(
              "relative text-muted-foreground hover:text-foreground pointer-coarse:after:absolute pointer-coarse:after:-inset-2",
              className
            )}
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>
        {label}
        <Kbd>{shortcut}</Kbd>
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * After an address is pasted: as a link, a preview, or plain text. It goes
 * at the next key, a click elsewhere, or Escape.
 */
function PasteAsBar() {
  const composer = useComposer()
  const [editor] = useLexicalComposerContext()
  const { pasted, pasteAs, dismissPaste, labels } = composer
  const bar = React.useRef<HTMLDivElement>(null)
  const [left, setLeft] = React.useState(0)

  React.useLayoutEffect(() => {
    if (!pasted) return
    const element = editor.getElementByKey(pasted.key)
    const parent = bar.current?.offsetParent
    if (!element || !parent) return
    const box = parent.getBoundingClientRect()
    const width = bar.current?.offsetWidth ?? 0
    const at = element.getBoundingClientRect().left - box.left - 4
    setLeft(Math.max(0, Math.min(at, box.width - width)))
  }, [editor, pasted])

  React.useEffect(() => {
    if (!pasted) return
    const unregister = [
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        (event) => {
          if (event.isComposing || event.keyCode === 229) return false
          event.preventDefault()
          dismissPaste()
          return true
        },
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand(
        KEY_DOWN_COMMAND,
        (event) => {
          if (
            !["Escape", "Tab", "Shift", "Meta", "Control", "Alt"].includes(
              event.key
            )
          )
            dismissPaste()
          return false
        },
        COMMAND_PRIORITY_HIGH
      ),
    ]
    const away = (event: PointerEvent) => {
      if (!bar.current?.contains(event.target as Node)) dismissPaste()
    }
    document.addEventListener("pointerdown", away)
    return () => {
      unregister.forEach((fn) => fn())
      document.removeEventListener("pointerdown", away)
    }
  }, [editor, pasted, dismissPaste])

  if (!pasted) return null
  const options = [
    {
      mode: "link",
      label: labels.pasteLink,
      icon: <HugeiconsIcon icon={Link01Icon} strokeWidth={2} />,
    },
    {
      mode: "preview",
      label: labels.pastePreview,
      icon: <HugeiconsIcon icon={WebDesign01Icon} strokeWidth={2} />,
    },
    {
      mode: "plain",
      label: labels.pastePlain,
      icon: <HugeiconsIcon icon={TextIcon} strokeWidth={2} />,
    },
  ] as const

  return (
    <div
      ref={bar}
      data-slot="composer-paste-as"
      role="group"
      aria-label={labels.pasteAs}
      style={{ left }}
      // At the address, over the composer's top edge.
      className="absolute bottom-full z-50 -mb-1 flex items-center gap-1 rounded-lg bg-popover p-1 text-xs text-popover-foreground shadow-float"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return
        event.preventDefault()
        event.stopPropagation()
        dismissPaste()
        editor.focus()
      }}
    >
      <span aria-hidden className="ps-2 pe-1 text-subtle-foreground">
        {labels.pasteAs}
      </span>
      {options.map((option) => (
        <Button
          key={option.mode}
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={pasted.mode === option.mode}
          className="relative h-7 gap-1 px-2 text-xs font-normal text-muted-foreground hover:text-foreground aria-pressed:bg-muted aria-pressed:text-foreground pointer-coarse:after:absolute pointer-coarse:after:-inset-2"
          onClick={() => pasteAs(option.mode)}
        >
          {option.icon}
          {option.label}
        </Button>
      ))}
      {/* Escape puts it away, keeping the link as it is. */}
      <span aria-hidden className="ps-1 pe-2 text-2xs text-subtle-foreground">
        Esc
      </span>
    </div>
  )
}

/**
 * Where files show: in the text at the caret (`inline`, the default), or
 * in a row above it (`row`), e.g. where the text cannot hold them. Either
 * way files with no place in the text, such as those dropped on the
 * composer around the text (or anywhere on the page, with `windowDrops`),
 * go to the row. A row that does not fit on one line ends in "+N".
 *
 * The row (`card`, the default) shows images as 64px tiles in a scrolling
 * first line, with progress or a warning over the image. Other files are
 * 44px cards on the next line, with the name over their state and a +N fold.
 * `chip` shows them as in the text instead, 24px, e.g. where the
 * row stands in for the text's chips.
 */
function ComposerAttachments({
  placement = "inline",
  variant = "card",
  windowDrops = false,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  placement?: Placement
  variant?: "card" | "chip"
  /** Takes files dropped anywhere on the page that nothing else took. */
  windowDrops?: boolean
}) {
  const composer = useComposer()
  const { setPlacement, addFiles, row, setRow, labels, attachmentState } =
    composer
  const list = React.useRef<HTMLDivElement>(null)
  const cardList = React.useRef<HTMLDivElement>(null)
  const cards = variant === "card"
  // Keep original row indices while arranging images before the file cards.
  const indexedRow = row.map((attachment, index) => ({ attachment, index }))
  const tiles = cards
    ? indexedRow.filter(({ attachment }) => attachment.preview)
    : []
  const files = cards
    ? indexedRow.filter(({ attachment }) => !attachment.preview)
    : indexedRow
  const display = [...tiles, ...files]
  const [width, setWidth] = React.useState(0)
  // How many chips fit on one line with the "+N"; measured again whenever
  // the files or the width change.
  const [fit, setFit] = React.useState<{
    row: ComposerAttachment[]
    width: number
    limit: number | null
  }>({ row, width, limit: null })
  // "+N" shows all of these files; more files fold again.
  const [unfolded, setUnfolded] = React.useState(0)
  const all = files.length <= unfolded
  const any = row.length > 0
  const hasFiles = files.length > 0
  const limit = fit.row === row && fit.width === width ? fit.limit : null
  const shown = all
    ? files.length
    : Math.min(limit ?? files.length, files.length)

  React.useLayoutEffect(() => {
    setPlacement(placement)
    return () => setPlacement(null)
  }, [placement, setPlacement])

  React.useEffect(() => {
    if (!windowDrops || !addFiles) return
    const over = (event: DragEvent) => {
      if (event.defaultPrevented || !carriesFiles(event.dataTransfer)) return
      event.preventDefault()
      event.dataTransfer!.dropEffect = "copy"
    }
    const drop = (event: DragEvent) => {
      if (event.defaultPrevented || !carriesFiles(event.dataTransfer)) return
      event.preventDefault()
      addFiles(Array.from(event.dataTransfer!.files), "row")
    }
    window.addEventListener("dragover", over)
    window.addEventListener("drop", drop)
    return () => {
      window.removeEventListener("dragover", over)
      window.removeEventListener("drop", drop)
    }
  }, [windowDrops, addFiles])

  React.useLayoutEffect(() => {
    const element = cardList.current
    if (!element) return
    // Before the first paint, so the row is measured once.
    setWidth(element.clientWidth)
    const observer = new ResizeObserver(() => setWidth(element.clientWidth))
    observer.observe(element)
    return () => observer.disconnect()
  }, [any, hasFiles])

  // A file removed with the focus in it: the focus goes to the one in its
  // place (or before it), or to the text.
  const refocus = React.useRef<number | null>(null)
  React.useLayoutEffect(() => {
    const at = refocus.current
    if (at === null) return
    refocus.current = null
    const chips = list.current?.querySelectorAll(
      "[data-slot=composer-chip], [data-slot=composer-attachment-card], [data-slot=composer-attachment-tile-item]"
    )
    const next =
      chips?.[Math.min(at, chips.length - 1)]?.querySelector("button")
    if (next) next.focus()
    else composer.focus()
  }, [row, composer])

  // First all, then as many as fit before the first that wraps, then one
  // fewer while the "+N" wraps.
  React.useLayoutEffect(() => {
    const element = cardList.current
    if (!element || all) return
    const items = Array.from(element.children) as HTMLElement[]
    const top = items[0]?.offsetTop ?? 0
    const wrapped = items.findIndex((item) => item.offsetTop > top)
    if (wrapped === -1) return
    if (limit === null) setFit({ row, width, limit: Math.max(1, wrapped) })
    else if (limit > 1) setFit({ row, width, limit: limit - 1 })
  }, [row, width, limit, all])

  if (row.length === 0) return null

  const hidden = files.length - shown
  const renderAttachment = (item: (typeof indexedRow)[number]) => {
    const { attachment, index } = item
    const state = attachmentState?.(attachment)
    const name = attachment.name
    const retry = !!state?.error && !!composer.onRetryAttachment
    const remove = (event: React.SyntheticEvent<HTMLElement>) => {
      // Focus goes on to the file that takes its place, once it is
      // there, or to the text.
      if (event.currentTarget.contains(document.activeElement))
        refocus.current = display.indexOf(item)
      setRow(row.filter((_, i) => i !== index))
    }
    // Backspace or Delete on it removes it, as in the text.
    const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key !== "Backspace" && event.key !== "Delete") return
      if (composer.disabled) return
      event.preventDefault()
      remove(event)
    }
    const retryButton = retry ? (
      <RowButton
        label={labels.retryItem(name)}
        onClick={() => composer.onRetryAttachment?.(attachment)}
        className={cards ? "me-2" : "ms-0.5"}
      >
        <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} />
      </RowButton>
    ) : null
    const open = composer.onOpenAttachment
      ? () => composer.onOpenAttachment?.(attachment)
      : undefined
    if (cards && attachment.preview) {
      return (
        <AttachmentTile
          key={`${attachment.id}-${index}`}
          attachment={attachment}
          state={state}
          onOpen={open}
          onKeyDown={onKeyDown}
          onRemove={remove}
        />
      )
    }
    if (cards) {
      return (
        <AttachmentCard
          key={`${attachment.id}-${index}`}
          attachment={attachment}
          state={state}
          onOpen={open}
          onKeyDown={onKeyDown}
          action={retryButton}
        >
          {/* On its corner, round, always shown: a card is removed by it. */}
          <button
            type="button"
            aria-label={labels.removeItem(name)}
            aria-keyshortcuts="Backspace Delete"
            disabled={composer.disabled}
            onClick={remove}
            className="absolute -end-2 -top-2 grid size-5 cursor-pointer place-items-center rounded-full bg-background text-muted-foreground shadow-xs ring-1 ring-border outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:invisible pointer-coarse:after:absolute pointer-coarse:after:-inset-3 [&_svg]:size-3"
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
          </button>
        </AttachmentCard>
      )
    }
    return (
      <ComposerChip
        key={`${attachment.id}-${index}`}
        value={attachment}
        state={state}
        onKeyDown={onKeyDown}
        className={cn(
          "group/row-chip rounded-sm ps-1",
          // Its remove button shows over its end on a hover or focus;
          // to a finger, always, after it.
          !retry && "pe-2 pointer-coarse:pe-1"
        )}
        action={
          <>
            {retryButton}
            <RowButton
              label={labels.removeItem(name)}
              aria-keyshortcuts="Backspace Delete"
              disabled={composer.disabled}
              onClick={remove}
              className={cn(
                retry
                  ? undefined
                  : "absolute end-0.5 top-1/2 -translate-y-1/2 bg-muted opacity-0 group-focus-within/row-chip:opacity-100 group-hover/row-chip:opacity-100 pointer-coarse:relative pointer-coarse:ms-0.5 pointer-coarse:translate-y-0 pointer-coarse:opacity-100"
              )}
            >
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
            </RowButton>
          </>
        }
      >
        {open ? (
          <button
            type="button"
            className="inline-flex min-w-0 cursor-pointer items-center gap-1 rounded-sm text-start outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            onClick={open}
          >
            <ChipContent attachment={attachment} state={state} />
          </button>
        ) : (
          <ChipContent attachment={attachment} state={state} />
        )}
      </ComposerChip>
    )
  }
  return (
    <div
      ref={list}
      data-slot="composer-attachments"
      data-placement={placement}
      data-variant={variant}
      className={cn(
        "flex w-full flex-col px-2",
        cards
          ? // Cards 8px apart and 12px from the box's edges, room for the
            // × on their corners.
            "gap-2 px-3 pt-3"
          : // The chips as in a line of text, 24px, 8px apart, 8px from
            // the top; four of them and a "+N" fit a composer's width.
            "gap-2 pt-2 [&>[data-slot=composer-chip]]:m-0",
        className
      )}
      {...props}
    >
      {tiles.length > 0 ? (
        <AttachmentGroup
          data-slot="composer-attachment-tiles"
          className="-my-1 w-full gap-2"
        >
          {tiles.map(renderAttachment)}
        </AttachmentGroup>
      ) : null}
      {files.length > 0 ? (
        <div
          ref={cardList}
          data-slot="composer-attachment-cards"
          className={cn(
            "flex w-full flex-wrap",
            cards ? "gap-2" : "gap-2 [&>[data-slot=composer-chip]]:m-0"
          )}
        >
          {files.slice(0, shown).map(renderAttachment)}
          {hidden > 0 ? (
            <button
              type="button"
              aria-label={labels.more(hidden)}
              aria-expanded={false}
              className={cn(
                "relative mx-px inline-flex cursor-pointer items-center text-2sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:after:absolute pointer-coarse:after:-inset-2",
                // As tall as the files it stands for.
                cards
                  ? "h-11 rounded-lg border bg-background px-3"
                  : "h-6 rounded-sm bg-muted px-2 inset-ring inset-ring-border dark:inset-ring-foreground/15"
              )}
              onClick={() => setUnfolded(files.length)}
            >
              +{hidden}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/** Shared status text for row cards and image tiles. */
function attachmentStatus(
  attachment: ComposerAttachment,
  state: ComposerAttachmentState | undefined,
  labels: ReturnType<typeof useComposer>["labels"]
) {
  const error = state?.error
  const progress = uploadOf(state)
  const uploading = progress !== undefined
  const status =
    error ??
    (uploading
      ? labels.uploading(progress === null ? undefined : percent(progress))
      : attachment.detail)
  return uploading
    ? { error, progress, uploading: true as const, status }
    : { error, progress: undefined, uploading: false as const, status }
}

/**
 * An image in the row as a 64px tile (Attachment's `tile` variant): the
 * picture covering it, the upload's ring or a failure's mark over it,
 * Retry and Remove on its corner on a hover or focus (always to a finger,
 * or when it failed). Its name is its trigger's, its state the trigger's
 * description; the tooltip shows both.
 */
function AttachmentTile({
  attachment,
  state,
  onOpen,
  onRemove,
  ...props
}: React.ComponentProps<"div"> & {
  attachment: ComposerAttachment
  state: ComposerAttachmentState | undefined
  onOpen: (() => void) | undefined
  onRemove: (event: React.SyntheticEvent<HTMLElement>) => void
}) {
  const composer = useComposer()
  const { labels } = composer
  const description = React.useId()
  const { error, progress, uploading, status } = attachmentStatus(
    attachment,
    state,
    labels
  )
  const remove = (
    <AttachmentAction
      aria-label={labels.removeItem(attachment.name)}
      aria-keyshortcuts="Backspace Delete"
      disabled={composer.disabled}
      onClick={onRemove}
    >
      <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
    </AttachmentAction>
  )
  return (
    <Attachment
      variant="tile"
      state={error ? "error" : uploading ? "uploading" : "done"}
      data-slot="composer-attachment-tile-item"
      {...props}
    >
      <AttachmentMedia variant="image">
        <img src={attachment.preview} alt="" />
      </AttachmentMedia>
      {error || uploading ? (
        <span
          aria-hidden
          className={cn(
            "absolute inset-0 grid place-items-center bg-background/60",
            error && "text-destructive"
          )}
        >
          {error ? (
            <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
          ) : (
            <ProgressRing value={progress ?? null} />
          )}
        </span>
      ) : null}
      <AttachmentContent>
        <AttachmentTitle>{attachment.name}</AttachmentTitle>
        <AttachmentDescription id={description}>{status}</AttachmentDescription>
      </AttachmentContent>
      {onOpen ? (
        <Tooltip>
          <TooltipTrigger
            aria-label={attachment.name}
            aria-describedby={description}
            render={<AttachmentTrigger onClick={onOpen} />}
          />
          {/* The name, and why it failed, for those who see only the picture. */}
          <TooltipContent>
            {attachment.name}
            {status ? <div>{status}</div> : null}
          </TooltipContent>
        </Tooltip>
      ) : null}
      <AttachmentActions>
        {error && composer.onRetryAttachment ? (
          <AttachmentAction
            aria-label={labels.retryItem(attachment.name)}
            onClick={() => composer.onRetryAttachment?.(attachment)}
          >
            <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} />
          </AttachmentAction>
        ) : null}
        {remove}
      </AttachmentActions>
    </Attachment>
  )
}

/**
 * A file in the row as a card, 44px: a tile with its picture or icon (the
 * upload's progress over it, or a failure's mark), its name over its
 * state, and its `children`, e.g. the remove button on its corner. A
 * failed file's edge is dashed. It has the page's colour and its tile the
 * box's: in dark, a card is set into the raised box.
 */
function AttachmentCard({
  attachment,
  state,
  onOpen,
  action,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  attachment: ComposerAttachment
  state: ComposerAttachmentState | undefined
  /** Opens the file: the tile and the words are a button. */
  onOpen?: (() => void) | undefined
  /** After the words, e.g. a retry button. */
  action?: React.ReactNode
}) {
  const { labels } = useComposer()
  const { error, progress, uploading, status } = attachmentStatus(
    attachment,
    state,
    labels
  )
  const picture = attachment.preview ? (
    <img src={attachment.preview} alt="" className="size-full object-cover" />
  ) : null
  const content = (
    <>
      <span
        data-slot="composer-attachment-tile"
        className="relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-sm bg-muted text-muted-foreground dark:bg-card [&>svg]:size-4"
      >
        {error ? (
          <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
        ) : (
          (picture ??
          (uploading ? null : <AttachmentIcon attachment={attachment} />))
        )}
        {uploading ? (
          // Over the picture, faded; or alone in the tile.
          <span
            aria-hidden
            className={cn(
              "absolute inset-0 grid place-items-center",
              picture && "bg-background/60"
            )}
          >
            <ProgressRing value={progress} />
          </span>
        ) : null}
      </span>
      <span className="flex min-w-0 flex-col">
        <span
          data-slot="composer-attachment-name"
          className="truncate text-2sm leading-4 text-foreground"
        >
          {attachment.name}
        </span>
        {status ? (
          <span
            data-slot="composer-attachment-status"
            className="truncate text-2xs leading-4 text-subtle-foreground"
          >
            {status}
          </span>
        ) : null}
      </span>
    </>
  )
  // The tile 4px in from the card's start (inside its hairline), 12px
  // after the words (8px before an action).
  const body = cn(
    "flex min-w-0 items-center gap-2 self-stretch ps-1 text-start",
    action ? "pe-2" : "pe-3"
  )
  return (
    <div
      data-slot="composer-attachment-card"
      data-state={error ? "error" : uploading ? "uploading" : undefined}
      className={cn(
        "group/card relative inline-flex h-11 max-w-64 min-w-0 items-center rounded-lg border bg-background select-none data-[state=error]:border-dashed",
        className
      )}
      {...props}
    >
      {onOpen ? (
        <button
          type="button"
          className={cn(
            body,
            "cursor-pointer rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          )}
          onClick={onOpen}
        >
          {content}
        </button>
      ) : (
        <span className={body}>{content}</span>
      )}
      {action}
      {children}
    </div>
  )
}

/**
 * An upload's progress as a ring, 20px, from the top clockwise; with no
 * way to tell how far (`null`), a quarter of it turning (still where the
 * reader asks for less motion).
 */
function ProgressRing({ value }: { value: number | null }) {
  // A circle of radius 6.5 in a 16 box: its length, 2π × 6.5.
  const length = 2 * Math.PI * 6.5
  const known = value !== null
  const shown = known ? value : 0.25
  return (
    <svg
      aria-hidden="true"
      data-slot="composer-attachment-progress"
      data-indeterminate={known ? undefined : ""}
      viewBox="0 0 16 16"
      fill="none"
      className={cn(
        "size-5 -rotate-90",
        !known && "animate-spin motion-reduce:animate-none"
      )}
    >
      <circle cx="8" cy="8" r="6.5" strokeWidth="2" className="stroke-border" />
      <circle
        cx="8"
        cy="8"
        r="6.5"
        strokeWidth="2"
        strokeLinecap={shown > 0 ? "round" : "butt"}
        strokeDasharray={`${shown * length} ${length}`}
        className="stroke-muted-foreground transition-[stroke-dasharray]"
      />
    </svg>
  )
}

/** What a file's chip shows: its picture or icon, name and state. */
function ChipContent({
  attachment,
  state,
  icon,
}: {
  attachment: ComposerAttachment
  state: ComposerAttachmentState | undefined
  icon?: React.ReactNode
}) {
  const error = state?.error
  const progress = uploadOf(state)
  // Its words in a composer, or alone (a sent message's chip).
  const labels = React.useContext(ComposerContext)?.labels ?? defaultLabels
  // An image's thumbnail says what it is: its size is on its card.
  const detail =
    error ??
    (progress !== undefined
      ? progress === null
        ? labels.uploading()
        : percent(progress)
      : attachment.preview
        ? undefined
        : attachment.detail)
  return (
    <>
      {error ? (
        <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
      ) : (
        (icon ??
        (attachment.preview ? (
          <img src={attachment.preview} alt="" />
        ) : (
          <AttachmentIcon attachment={attachment} />
        )))
      )}
      {/* Its detail is cut first; an error's words, which say what went
          wrong, share the room, the name never cut to nothing. */}
      <span className={cn("truncate font-medium", error && "min-w-16")}>
        {attachment.name}
      </span>
      {detail ? (
        <ChipDetail className={cn(error && "shrink")}>{detail}</ChipDetail>
      ) : null}
    </>
  )
}

function RowButton({
  label,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"button">, "type"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "relative inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-xs text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 pointer-coarse:after:absolute pointer-coarse:after:-inset-3 [&_svg]:size-3",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

/** A suggestion for a mention. */
type ComposerSuggestion = {
  /** Becomes the mention's id. */
  id: string
  /** Becomes the mention's label. */
  label: string
  /** A line under its label: what a command does. */
  description?: string
  /** At its end, in grey: a file's folder, "now", "38%". */
  detail?: React.ReactNode
  /** Before its label, in grey. */
  icon?: React.ReactNode
  /** Its kind, a heading over a run of items: "Files", "Agents". */
  group?: string
  /** Where the label matches the query, by character: shown in bold. */
  highlight?: readonly number[]
  /**
   * Chosen, it runs at once instead of becoming a chip, e.g. a slash
   * command such as "/clear": what was typed for it goes, and the
   * suggestions' `onExecute` gets it.
   */
  execute?: boolean
  /**
   * Chosen, it opens a list of its own in place of this one, e.g. a
   * kind ("Conversations", "Files") with an empty query: the trigger
   * stays, what was typed after it goes, and the suggestions' `path`
   * ends with it. The app gives that list's items for the query.
   */
  opens?: boolean
}

/** The query after `trigger` before the caret, if the caret is in one. */
function $matchTrigger(trigger: string): string | null {
  const selection = $getSelection()
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return null
  const node = selection.anchor.getNode()
  if (!$isTextNode(node)) return null
  const before = node.getTextContent().slice(0, selection.anchor.offset)
  const start = before.lastIndexOf(trigger)
  if (start < 0) return null
  // A trigger starts a word: "a@b" is not one.
  if (start > 0 && !/\s/.test(before[start - 1]!)) return null
  const query = before.slice(start + trigger.length)
  if (/\s/.test(query)) return null
  // In code, a trigger is code: a decorator, an address.
  return $fenceOf(node.getTopLevelElement()) ? null : query
}

function ComposerSuggestions<Item extends ComposerSuggestion>({
  trigger,
  items,
  path: pathProp,
  onPathChange,
  onQueryChange,
  onExecute,
  renderItem = (item) => <SuggestionContent item={item} trigger={trigger} />,
  loading = false,
  error,
  label,
  total,
  hints,
  messages,
  className,
}: {
  /** The character that opens the suggestions, e.g. "@". */
  trigger: string
  /** The suggestions for the current query; the app filters them. */
  items: readonly Item[]
  /**
   * The items with `opens` the list is in, outermost first; none, the
   * first list. Given, it is the app's (with `onPathChange`); else the
   * list keeps it. It is emptied as the list closes.
   */
  path?: readonly Item[]
  /** An item with `opens` chosen, or a list left for the one it was in. */
  onPathChange?: (path: Item[]) => void
  /** The text typed after the trigger, or null when closed. */
  onQueryChange?: (query: string | null) => void
  /** Runs a chosen item with `execute`; what was typed for it is gone. */
  onExecute?: (item: Item) => void
  renderItem?: (item: Item) => React.ReactNode
  loading?: boolean
  /** Shown instead of the items, e.g. when a search failed. */
  error?: string
  /** The accessible name of the list, e.g. "Files"; its footer's end. */
  label: string
  /** How many there are in all, shown "5 of 1,204" in place of `label`. */
  total?: number
  /**
   * The keys in its footer and what they do; by default ↑↓ move, ↵
   * insert, esc close (← back, in a list an item opened). None, no
   * keys; not on a touch screen, which has none of them.
   */
  hints?: readonly { keys: string[]; label: string }[]
  messages?: {
    loading?: string
    empty?: string
    count?: (count: number) => string
    /** "5 of 1,204". */
    of?: (shown: number, total: number) => string
    /** The name of the row back to the list an item opened this from. */
    back?: (parent: string) => string
  }
  className?: string
}) {
  const [editor] = useLexicalComposerContext()
  const [match, setMatch] = React.useState<string | null>(null)
  // Escape closes the list until the caret leaves the trigger.
  const [dismissed, setDismissed] = React.useState(false)
  const id = React.useId()
  const query = dismissed ? null : match
  const open = query !== null
  const [pathState, setPathState] = React.useState<readonly Item[]>([])
  const path = pathProp ?? pathState
  // The highlighted item, back at the first whenever the query, or the
  // list, changes.
  const level = `${path.map((item) => item.id).join("\u0000")}\u0000${query}`
  const [activeState, setActiveState] = React.useState({ level, index: 0 })
  const active = activeState.level === level ? activeState.index : 0
  const setPath = React.useCallback(
    (next: Item[]) => {
      if (pathProp === undefined) setPathState(next)
      // At the first item of the list it opens, or goes back to.
      setActiveState({ level: "", index: 0 })
      onPathChange?.(next)
    },
    [pathProp, onPathChange]
  )
  const parent = path.at(-1)
  // Its trigger gone, it opens at the first list again.
  const leave = React.useEffectEvent(() => {
    if (path.length > 0) setPath([])
  })
  const optionId = (index: number) => `${id}-option-${index}`
  const highlighted =
    open && items.length > 0 ? Math.min(active, items.length - 1) : -1

  React.useEffect(
    () =>
      editor.registerUpdateListener(({ editorState }) => {
        const next = editorState.read(() => $matchTrigger(trigger))
        setMatch(next)
        if (next === null) {
          setDismissed(false)
          leave()
        }
      }),
    [editor, trigger]
  )

  const queryChanged = React.useEffectEvent((next: string | null) =>
    onQueryChange?.(next)
  )
  React.useEffect(() => queryChanged(query), [query])

  // Under the trigger: the list's start where its labels line up with
  // the trigger, within the composer.
  const list = React.useRef<HTMLDivElement>(null)
  const [start, setStart] = React.useState(0)
  const coarse = useCoarsePointer()
  // In a narrow composer (a phone's), the composer's width.
  const [span, setSpan] = React.useState(false)
  // As high as there is room over the composer in what is seen of the
  // page (not under a phone's keyboard), 320px at most for a mouse.
  const [height, setHeight] = React.useState<number>()
  React.useLayoutEffect(() => {
    const element = list.current
    const box = element?.offsetParent
    if (!open || !element || !box) return
    const view = window.visualViewport
    const fit = () => {
      const rem = parseFloat(
        getComputedStyle(document.documentElement).fontSize
      )
      // Its gap over the composer, and as much again from the top.
      const room = Math.floor(
        box.getBoundingClientRect().top - (view?.offsetTop ?? 0) - rem
      )
      setHeight(Math.max(5.5 * rem, coarse ? room : Math.min(room, 20 * rem)))
    }
    fit()
    view?.addEventListener("resize", fit)
    view?.addEventListener("scroll", fit)
    window.addEventListener("resize", fit)
    return () => {
      view?.removeEventListener("resize", fit)
      view?.removeEventListener("scroll", fit)
      window.removeEventListener("resize", fit)
    }
  }, [open, coarse])
  React.useLayoutEffect(() => {
    const element = list.current
    const box = element?.offsetParent
    if (!open || !element || !box) return
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize)
    const narrow = box.clientWidth < 40 * rem
    setSpan(narrow)
    if (narrow) return setStart(0)
    const at = editor.getEditorState().read(() => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) return null
      const node = selection.anchor.getNode()
      const before = node.getTextContent().slice(0, selection.anchor.offset)
      const text = editor.getElementByKey(node.getKey())?.firstChild
      const index = before.lastIndexOf(trigger)
      if (!text || index < 0) return null
      const range = document.createRange()
      range.setStart(text, index)
      range.setEnd(text, index + trigger.length)
      return range.getBoundingClientRect()
    })
    if (!at || getComputedStyle(element).direction === "rtl") return setStart(0)
    // The list's padding, a row's and its icon and gap: 6 + 8 + 16 + 8.
    const x = at.left - box.getBoundingClientRect().left - 38
    setStart(Math.max(0, Math.min(x, box.clientWidth - element.offsetWidth)))
  }, [editor, open, query, trigger])

  const { suggest } = useComposer()
  const suggestOpen = React.useEffectEvent(suggest)
  React.useEffect(() => {
    if (!open) return
    suggestOpen(true)
    return () => suggestOpen(false)
  }, [open])

  const select = React.useCallback(
    (item: Item) => {
      editor.update(
        () => {
          const selection = $getSelection()
          if (!$isRangeSelection(selection)) return
          const node = selection.anchor.getNode()
          if (!$isTextNode(node)) return
          const end = selection.anchor.offset
          const start = node.getTextContent().slice(0, end).lastIndexOf(trigger)
          if (start < 0) return
          // A list of its own: the trigger stays, the caret after it.
          if (item.opens) {
            if (end > start + trigger.length)
              node.spliceText(
                start + trigger.length,
                end - start - trigger.length,
                "",
                true
              )
            return
          }
          const parts = node.splitText(start, end)
          const typed = start === 0 ? parts[0] : parts[1]
          // A command goes with what was typed for it; the caret stays.
          if (item.execute) return typed!.remove()
          const mention = new ChipNode({
            type: "mention",
            trigger,
            id: item.id,
            label: item.label,
          })
          typed!.replace(mention)
          const space = $createTextNode(" ")
          mention.insertAfter(space)
          space.select(1, 1)
        },
        // Run once the text no longer has it, so the app reads it without.
        { onUpdate: () => item.execute && onExecute?.(item) }
      )
      if (item.opens) setPath([...path, item])
    },
    [editor, trigger, onExecute, path, setPath]
  )
  const back = React.useCallback(
    () => setPath(path.slice(0, -1)),
    [path, setPath]
  )

  React.useEffect(() => {
    if (!open) return
    const move = (by: number) => (event: KeyboardEvent | null) => {
      if (items.length === 0) return false
      event?.preventDefault()
      setActiveState((state) => ({
        level,
        index:
          ((state.level === level ? state.index : 0) + by + items.length) %
          items.length,
      }))
      return true
    }
    const choose = (event: KeyboardEvent | null) => {
      if (event?.isComposing || event?.keyCode === 229) return false
      const item = items[highlighted]
      if (!item) return false
      event?.preventDefault()
      select(item)
      return true
    }
    // In a list an item opened, with nothing typed: back to the one it
    // was in, instead of leaving the trigger or deleting it.
    const up = (event: KeyboardEvent | null) => {
      if (!parent || query !== "" || event?.isComposing) return false
      if (event?.shiftKey || event?.altKey || event?.metaKey || event?.ctrlKey)
        return false
      event?.preventDefault()
      back()
      return true
    }
    const unregister = [
      editor.registerCommand(KEY_ARROW_LEFT_COMMAND, up, COMMAND_PRIORITY_HIGH),
      editor.registerCommand(KEY_BACKSPACE_COMMAND, up, COMMAND_PRIORITY_HIGH),
      editor.registerCommand(
        KEY_ARROW_DOWN_COMMAND,
        move(1),
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand(
        KEY_ARROW_UP_COMMAND,
        move(-1),
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand(KEY_ENTER_COMMAND, choose, COMMAND_PRIORITY_HIGH),
      editor.registerCommand(KEY_TAB_COMMAND, choose, COMMAND_PRIORITY_HIGH),
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        (event) => {
          if (event.isComposing || event.keyCode === 229) return false
          event.preventDefault()
          if (parent) back()
          else setDismissed(true)
          return true
        },
        COMMAND_PRIORITY_HIGH
      ),
    ]
    return () => unregister.forEach((fn) => fn())
  }, [editor, open, level, query, items, highlighted, select, parent, back])

  // The editor keeps the focus; the list is announced through it.
  React.useEffect(() => {
    const root = editor.getRootElement()
    if (!root || !open) return
    root.setAttribute("aria-controls", `${id}-list`)
    root.setAttribute("aria-autocomplete", "list")
    if (highlighted >= 0) {
      const option = `${id}-option-${highlighted}`
      root.setAttribute("aria-activedescendant", option)
      document.getElementById(option)?.scrollIntoView({ block: "nearest" })
    } else {
      root.removeAttribute("aria-activedescendant")
    }
    return () => {
      root.removeAttribute("aria-controls")
      root.removeAttribute("aria-activedescendant")
      root.setAttribute("aria-autocomplete", "none")
    }
  }, [editor, open, id, highlighted])

  if (!open) return null

  const notice = error
    ? error
    : loading
      ? (messages?.loading ?? "Loading…")
      : items.length === 0
        ? (messages?.empty ?? "No matches")
        : null
  const count =
    messages?.count ??
    ((n: number) => (n === 1 ? "1 suggestion" : `${n} suggestions`))

  const of =
    messages?.of ??
    ((shown: number, all: number) =>
      `${shown.toLocaleString()} of ${all.toLocaleString()}`)
  const footer = (hints ?? defaultHints).length > 0
  // A touch screen has none of the keys.
  const keys = coarse ? [] : (hints ?? (parent ? backHints : defaultHints))
  const backLabel =
    parent &&
    (messages?.back ?? ((name: string) => `Back to ${name}`))(parent.label)
  // Runs of items of one group, each under its heading.
  const runs: { group: string | undefined; start: number; items: Item[] }[] = []
  items.forEach((item, index) => {
    const last = runs.at(-1)
    if (last && last.group === item.group) last.items.push(item)
    else runs.push({ group: item.group, start: index, items: [item] })
  })
  const option = (item: Item, index: number) => (
    <div
      key={item.id}
      id={optionId(index)}
      role="option"
      aria-selected={index === highlighted}
      data-highlighted={index === highlighted ? "" : undefined}
      className={cn(
        // 32px; 44px to a finger.
        "group/suggestion flex min-h-8 w-full cursor-default items-center gap-2 rounded-md px-2 py-1 text-2sm select-none data-highlighted:bg-muted pointer-coarse:min-h-11 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&>svg]:text-muted-foreground",
        // With a line under it: its icon by its label's line.
        item.description && "items-start py-2 [&>svg]:mt-0.5"
      )}
      // Keeps the focus, and the caret, in the editor.
      onMouseDown={(event) => event.preventDefault()}
      onMouseMove={() => setActiveState({ level, index })}
      onClick={() => select(item)}
    >
      {renderItem(item)}
    </div>
  )

  return (
    <div
      ref={list}
      data-slot="composer-suggestions"
      style={{
        ...(start ? { insetInlineStart: start } : {}),
        ...(height !== undefined ? { maxHeight: height } : {}),
      }}
      className={cn(
        "absolute start-0 bottom-full z-50 mb-2 flex max-h-80 w-96 max-w-full flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-float",
        span && "w-full",
        className
      )}
      // Keeps the focus, and the caret and a phone's keyboard, in the
      // editor: a tap on its rows, its headings, its edges.
      onMouseDown={(event) => event.preventDefault()}
    >
      {backLabel ? (
        <button
          type="button"
          tabIndex={-1}
          aria-label={backLabel}
          data-slot="composer-suggestions-back"
          className="m-1 mb-0 flex min-h-8 shrink-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-start text-2sm font-medium outline-none select-none hover:bg-muted pointer-coarse:min-h-11 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground"
          onClick={back}
        >
          <HugeiconsIcon
            icon={ArrowLeft01Icon}
            strokeWidth={2}
            className="rtl:rotate-180"
          />
          <span className="truncate">{parent!.label}</span>
        </button>
      ) : null}
      <span id={`${id}-label`} className="sr-only">
        {label}
      </span>
      <div
        id={`${id}-list`}
        role="listbox"
        aria-labelledby={`${id}-label`}
        className={cn(
          "min-h-0 overflow-y-auto overscroll-contain",
          notice === null && "p-1"
        )}
      >
        {notice === null
          ? runs.map((run) =>
              run.group ? (
                <div
                  key={`${run.group}-${run.start}`}
                  role="group"
                  aria-label={run.group}
                >
                  <div
                    aria-hidden
                    data-slot="composer-suggestions-group"
                    className="flex h-6 items-center px-2 text-2xs font-medium text-subtle-foreground"
                  >
                    {run.group}
                  </div>
                  {run.items.map((item, at) => option(item, run.start + at))}
                </div>
              ) : (
                run.items.map((item, at) => option(item, run.start + at))
              )
            )
          : null}
      </div>
      {notice !== null ? (
        <div
          className={cn(
            "px-3 py-2 text-2sm",
            error ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {notice}
        </div>
      ) : null}
      {footer ? (
        <div
          aria-hidden
          data-slot="composer-suggestions-footer"
          className="flex h-8 shrink-0 items-center gap-3 border-t px-3 text-2xs text-subtle-foreground"
        >
          {keys.map((hint) => (
            <span key={hint.label} className="flex items-center gap-0.5">
              {hint.keys.map((key) => (
                <Kbd
                  key={key}
                  className="h-4 min-w-0 bg-transparent px-1 text-2xs text-muted-foreground ring-1 ring-border ring-inset"
                >
                  {key}
                </Kbd>
              ))}
              <span className="ms-0.5">{hint.label}</span>
            </span>
          ))}
          <span className="ms-auto tabular-nums">
            {total !== undefined && notice === null
              ? of(items.length, total)
              : label}
          </span>
        </div>
      ) : null}
      <div role="status" className="sr-only">
        {notice ?? count(items.length)}
      </div>
    </div>
  )
}

const defaultHints = [
  { keys: ["↑", "↓"], label: "move" },
  { keys: ["↵"], label: "insert" },
  { keys: ["esc"], label: "close" },
]

const backHints = [
  { keys: ["↑", "↓"], label: "move" },
  { keys: ["↵"], label: "insert" },
  { keys: ["←"], label: "back" },
]

/**
 * A suggestion as it shows by default: its icon, its label with what
 * matches in bold, a line under it, a detail at its end.
 */
function SuggestionContent({
  item,
  trigger,
}: {
  item: ComposerSuggestion
  trigger: string
}) {
  const marks = new Set(item.highlight)
  const label = item.highlight?.length
    ? Array.from(item.label).map((char, index) =>
        marks.has(index) ? (
          <b key={index} className="font-semibold">
            {char}
          </b>
        ) : (
          char
        )
      )
    : item.label
  return (
    <>
      {item.icon}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">
          {trigger === "/" ? "/" : null}
          {label}
        </span>
        {item.description ? (
          <span className="truncate text-xs leading-4 text-subtle-foreground group-data-highlighted/suggestion:text-muted-foreground">
            {item.description}
          </span>
        ) : null}
      </span>
      {item.detail !== undefined ? (
        <span className="ms-auto shrink-0 ps-2 text-xs leading-5 text-subtle-foreground group-data-highlighted/suggestion:text-muted-foreground">
          {item.detail}
        </span>
      ) : null}
      {item.opens ? (
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          strokeWidth={2}
          data-slot="composer-suggestion-opens"
          className="ms-auto rtl:rotate-180"
        />
      ) : null}
    </>
  )
}

/**
 * The look of what sits over a composer and tucks under its top edge: a
 * queue, an edit, a warning.
 */
// Its edge a border, not a ring: none at the bottom, under the composer
// or the next shelf, so a joint has one hairline.
const composerShelf =
  // grid: clear (16px under the composer and 4px above it)
  "relative mx-2 -mb-4 rounded-t-xl border border-b-0 border-foreground/5 bg-muted/50 px-1 pt-1 pb-5 motion-safe:transition-opacity motion-pop motion-safe:starting:opacity-0 dark:bg-black/40 [&:has(+[data-composer-shelf])]:mb-0 [&:has(+[data-composer-shelf])]:pb-1 [[data-composer-shelf]+&]:rounded-t-none"

/**
 * Over the composer, tucked under its top edge, a little narrower. Several
 * join edge to edge: square where they meet, one hairline between. Each
 * fades in. `size="content"` is as wide as its content, at the top-right.
 */
function ComposerShelf({
  size = "default",
  className,
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "content" }) {
  return (
    <div
      data-slot="composer-shelf"
      data-composer-shelf=""
      data-size={size}
      className={cn(
        composerShelf,
        // grid: clear (16px under the composer and 4px above it)
        size === "content" && "ms-auto me-2 w-fit p-1 pb-5",
        className
      )}
      {...props}
    />
  )
}

/**
 * A small shelf as wide as its words, at the composer's top-right edge:
 * a button such as "Stash 3" or "Drafts 2". Its count lifts once when it
 * rises (not with reduced motion); the app opens what it counts.
 */
function ComposerShelfTab({
  icon,
  count,
  children,
  className,
  ...props
}: React.ComponentProps<"button"> & {
  icon?: React.ReactNode
  count?: number
}) {
  const [previous, setPrevious] = React.useState(count)
  const [pulse, setPulse] = React.useState(0)
  if (count !== previous) {
    setPrevious(count)
    if (count !== undefined && previous !== undefined && count > previous) {
      setPulse(pulse + 1)
    }
  }
  return (
    <ComposerShelf size="content">
      <button
        type="button"
        data-slot="composer-shelf-tab"
        className={cn(
          "flex h-7 items-center gap-1 rounded-lg px-2 text-2sm text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:text-foreground [&>svg]:size-3.5 [&>svg]:shrink-0",
          className
        )}
        {...props}
      >
        {icon}
        {children}
        {/* A space for its name, "Stash 3"; the flex row drops it. */}
        {count !== undefined ? " " : null}
        {count !== undefined ? (
          <span
            key={pulse}
            data-pulse={pulse > 0 ? "" : undefined}
            className={cn(
              "text-subtle-foreground tabular-nums",
              pulse > 0 &&
                "motion-pop motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:zoom-in-110"
            )}
          >
            {count}
          </span>
        ) : null}
      </button>
    </ComposerShelf>
  )
}

/**
 * A line of a shelf: an icon, what it is, a detail in grey, a choice
 * between the words and its actions at the end.
 */
function ComposerShelfBar({
  icon,
  detail,
  aside,
  actions,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  icon?: React.ReactNode
  /** After it, in grey. */
  detail?: React.ReactNode
  /** Between the words and actions: a lesser choice, a button `size="xs"`. */
  aside?: React.ReactNode
  /** At its end: buttons, `size="xs"`, the primary last. */
  actions?: React.ReactNode
}) {
  // In the text's colour: the bar's grey is its words'.
  const buttons = "flex shrink-0 items-center gap-1 text-foreground"
  return (
    <div
      data-slot="composer-shelf-bar"
      className={cn(
        "flex min-h-8 items-center gap-2 pe-1 text-2sm text-muted-foreground [&>svg]:size-3.5 [&>svg]:shrink-0",
        // grid: track (its icon on the composer's leading line: past the
        // shelf's 8px tuck, its 1px edge and its 4px padding)
        "ps-[calc(var(--composer-lead)-(--spacing(3))-1px)]",
        className
      )}
      {...props}
    >
      {icon}
      <span className="min-w-0 truncate">
        {children}
        {detail ? (
          <span className="text-subtle-foreground"> {detail}</span>
        ) : null}
      </span>
      {aside ? <span className={cn(buttons, "ms-auto")}>{aside}</span> : null}
      {actions ? (
        <span className={cn(buttons, "ms-auto")}>{actions}</span>
      ) : null}
    </div>
  )
}

/**
 * The composer's row of tools under the text: 44px, the add button at
 * its start, the send button at its end; 50px on a phone. While a voice
 * recording runs, its Cancel and Done take the row. Narrower, it gives
 * up room by its own width, not the window's: under 36rem the hints go,
 * under 32rem labels (permissions an icon, the context meter its bar),
 * under 24rem the options fold (`ComposerOptions`).
 */
/** Nothing to send: no text but spaces, and no chips. */
const isEmpty = (value: ComposerValue) =>
  !value.some((part) => typeof part !== "string" || part.trim() !== "")

/** What a toolbar cuts short when its tools do not fit: a picker's value. */
const cutShort = "[data-slot=composer-select-value]"

/**
 * How far a toolbar folds its `ComposerOptionsFold` tools, past what
 * under 24rem always does: 1, they fold (a `compact` one to its compact
 * form, the others away); 2, the compact ones not `keep` away too. It
 * folds a step where, so far, its tools do not fit, a picker's value cut
 * short, and unfolds a step once it is as wide as that step needed (its
 * width then and what each value lacked), so it does not fold and unfold
 * at every step of a resize. Kept ones never fold away: the model's name
 * is cut short first.
 */
function useToolbarFold(ref: React.RefObject<HTMLDivElement | null>) {
  const [state, setState] = React.useState<{
    level: 0 | 1 | 2
    needs: readonly number[]
  }>({ level: 0, needs: [] })
  const recheck = React.useRef<() => void>(() => {})
  // A step taken, its tools laid out again: whether they fit now. (The
  // value still cut short may not change size, so no observer says.)
  React.useEffect(() => {
    if (state.level === 0) return
    const frame = requestAnimationFrame(() => recheck.current())
    return () => cancelAnimationFrame(frame)
  }, [state.level])
  React.useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === "undefined") return
    const check = () => {
      const width = element.clientWidth
      setState((was) => {
        let level = was.level
        while (level > 0 && width >= was.needs[level - 1]!) level--
        if (level !== was.level)
          return { level, needs: was.needs.slice(0, level) }
        let lacks = 0
        for (const value of element.querySelectorAll<HTMLElement>(cutShort))
          lacks += Math.max(0, value.scrollWidth - value.clientWidth)
        // A second step only where it folds a tool more away.
        const most = element.querySelector(
          "[data-slot=composer-options-fold][data-compact]:not([data-keep])"
        )
          ? 2
          : 1
        // A tool gone, a step it no longer takes.
        if (level > most)
          return { level: most, needs: was.needs.slice(0, most) }
        if (lacks <= 1 || level >= most) return was
        return {
          level: (level + 1) as 1 | 2,
          needs: [...was.needs, width + lacks],
        }
      })
    }
    recheck.current = check
    const observer = new ResizeObserver(check)
    const watch = () => {
      observer.disconnect()
      observer.observe(element)
      for (const value of element.querySelectorAll(cutShort))
        observer.observe(value)
    }
    // Tools come and go (a picker shown once there are agents to choose).
    const mutations = new MutationObserver(watch)
    mutations.observe(element, { childList: true, subtree: true })
    watch()
    return () => {
      recheck.current = () => {}
      observer.disconnect()
      mutations.disconnect()
    }
  }, [ref])
  return state.level
}

function ComposerToolbar({
  className,
  children,
  onClick,
  ...props
}: React.ComponentProps<"div">) {
  const composer = useComposer()
  const [editor] = useLexicalComposerContext()
  const voice = composer.voice
  const toolbar = React.useRef<HTMLDivElement>(null)
  const fold = useToolbarFold(toolbar)
  return (
    <div
      ref={toolbar}
      role="toolbar"
      data-slot="composer-toolbar"
      data-folded={fold > 0 ? fold : undefined}
      className={cn(
        "group/composer-toolbar @container/composer-toolbar order-last flex h-11 w-full min-w-0 shrink-0 cursor-text items-center gap-0.5 pe-2 max-sm:h-12 max-sm:gap-0",
        // grid: track (its first button's glyph on the composer's leading
        // line, where its text starts: a 28px button 6px wider each side
        // than its 16px glyph, 12px on a phone's 40px)
        "ps-[calc(var(--composer-lead)-(--spacing(1.5)))] max-sm:ps-[calc(var(--composer-lead)-(--spacing(3)))]",
        // A usage meter in it: a quiet button, its bar small; under 32rem
        // of toolbar, only the bar.
        "[&_[data-slot=usage-meter-breakdown]]:gap-1 [&_[data-slot=usage-meter-breakdown]]:px-2 [&_[data-slot=usage-meter-breakdown]]:text-xs [&_[data-slot=usage-meter-breakdown]]:font-normal [&_[data-slot=usage-meter-breakdown]]:text-subtle-foreground [&_[data-slot=usage-meter-breakdown]]:hover:text-foreground [&_[data-slot=usage-meter-breakdown]]:aria-expanded:text-foreground @max-lg/composer-toolbar:[&_[data-slot=usage-meter-value]:not([data-compact]_*)]:hidden",
        // grid: mark (the meter's bar)
        "[&_[data-slot=usage-meter-graphic][data-variant=bar]]:h-1 [&_[data-slot=usage-meter-graphic][data-variant=bar]]:w-5.5 [&_[data-slot=usage-meter-graphic][data-variant=bar]]:bg-muted [&_[data-slot=usage-meter-graphic][data-variant=bar]]:ring-1 [&_[data-slot=usage-meter-graphic][data-variant=bar]]:ring-border [&_[data-slot=usage-meter-graphic][data-variant=bar]]:ring-inset [&_[data-slot=usage-meter-graphic][data-variant=bar]>span]:bg-muted-foreground",
        className
      )}
      onClick={(event) => {
        onClick?.(event)
        if (event.target === event.currentTarget && !voice) editor.focus()
      }}
      {...props}
    >
      <div className={voice ? "hidden" : "contents"}>{children}</div>
      {voice ? <VoiceControls voice={voice} /> : null}
    </div>
  )
}

/** A tool of the toolbar: an icon, 28px, in grey; 40px on a phone. */
function ComposerButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      data-slot="composer-button"
      className={cn(
        "relative text-subtle-foreground hover:text-foreground aria-expanded:text-foreground max-sm:size-10 max-sm:rounded-lg pointer-coarse:after:absolute pointer-coarse:after:-inset-2",
        className
      )}
      {...props}
    />
  )
}

/**
 * Where the toolbar is narrow (under 24rem: a phone, or a composer beside
 * a sidebar on an unfolded foldable), or its tools do not fit unfolded
 * (an app's picker more), the settings it folds away
 * (`ComposerOptionsFold`: permissions, the context meter) behind one
 * button, which opens a sheet of their rows (`ComposerOptionsItem`). A
 * folded picker opened from a row opens from this button, a sheet on a
 * phone. With the room, the button is not shown.
 */
function ComposerOptions({
  label = "Options",
  open,
  defaultOpen,
  onOpenChange,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "children"> & {
  /** The button's name and the sheet's title. */
  label?: string
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** Its rows, `ComposerOptionsItem`s. */
  children: React.ReactNode
}) {
  return (
    <Drawer
      {...(open !== undefined ? { open } : {})}
      {...(defaultOpen !== undefined ? { defaultOpen } : {})}
      onOpenChange={(next) => onOpenChange?.(next)}
      // A handle to swipe it away by.
      showSwipeHandle
    >
      <DrawerTrigger
        render={
          <ComposerButton
            data-slot="composer-options"
            aria-label={label}
            data-input-group-fold=""
            className={cn(
              "@sm/composer-toolbar:not-group-data-folded/composer-toolbar:hidden",
              className
            )}
            {...props}
          />
        }
      >
        <HugeiconsIcon icon={SlidersHorizontalIcon} strokeWidth={2} />
      </DrawerTrigger>
      <DrawerContent data-slot="composer-options-content">
        <DrawerHeader className="px-4 pt-1 pb-2 group-data-[swipe-axis=y]/drawer-popup:text-start">
          <DrawerTitle className="text-md font-semibold">{label}</DrawerTitle>
        </DrawerHeader>
        <div className="flex flex-col">{children}</div>
      </DrawerContent>
    </Drawer>
  )
}

/**
 * A row of the options sheet: its icon, what it sets, its value and a
 * chevron; pressed, the app opens that setting, e.g. its picker.
 */
function ComposerOptionsItem({
  icon,
  value,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"button">, "value"> & {
  icon?: React.ReactNode
  /** At its end, in grey: "Ask first", "76k of 200k". */
  value?: React.ReactNode
}) {
  return (
    <button
      type="button"
      data-slot="composer-options-item"
      className={cn(
        "flex h-13 w-full items-center gap-3 border-t px-4 text-start text-md outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset [&_svg]:shrink-0 [&>svg]:size-5 [&>svg]:text-muted-foreground",
        className
      )}
      {...props}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {value !== undefined ? (
        <span className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground tabular-nums">
          {value}
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            strokeWidth={2}
            className="size-3.5"
          />
        </span>
      ) : null}
    </button>
  )
}

/**
 * Tools of the toolbar that a narrow one folds into `ComposerOptions`,
 * e.g. the permissions picker and the context meter: where the toolbar
 * is under 24rem, as on a phone, or where unfolded its tools do not fit,
 * a picker's value cut short.
 *
 * `compact` ones fold to a compact form in place first, the same trigger
 * opening the same picker or popover: its value (`ComposerSelectValue`)
 * goes, its icon and the rest stay, e.g. a provider's icon and its usage;
 * a usage meter keeps its bar and its percentage. Where even so they do
 * not fit, those not `keep` fold away too; kept ones stay, the model's
 * name cut short instead.
 */
function ComposerOptionsFold({
  compact = false,
  keep = false,
  children,
}: {
  /** Folds to its compact form in place before it folds away. */
  compact?: boolean
  /** Compact, never folds away, e.g. a meter of usage. */
  keep?: boolean
  children: React.ReactNode
}) {
  const inPlace = compact || keep
  return (
    <div
      data-slot="composer-options-fold"
      data-compact={inPlace || undefined}
      data-keep={keep || undefined}
      className={cn(
        "contents",
        inPlace
          ? // Its value goes; the rest stays, a little closer in.
            "group-data-folded/composer-toolbar:[&_[data-slot=composer-select-trigger]]:px-1 group-data-folded/composer-toolbar:[&_[data-slot=composer-select-value]]:hidden @max-sm/composer-toolbar:[&_[data-slot=composer-select-value]]:hidden group-data-folded/composer-toolbar:[&_[data-slot=usage-meter-breakdown]]:gap-1 group-data-folded/composer-toolbar:[&_[data-slot=usage-meter-breakdown]]:px-1"
          : "group-data-folded/composer-toolbar:hidden @max-sm/composer-toolbar:hidden",
        inPlace && !keep && "group-data-[folded=2]/composer-toolbar:hidden"
      )}
    >
      {children}
    </div>
  )
}

/** Picks files, from `ComposerAttach`'s menu. */
const AttachContext = React.createContext<(() => void) | null>(null)

/**
 * The add button: "+" at the toolbar's start. Alone it picks files; with
 * children, `ComposerAttachItem`s (and `ComposerAttachFiles`), it opens a
 * menu of them over the composer.
 */
function ComposerAttach({
  className,
  disabled,
  onClick,
  multiple = true,
  icon,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "type"> & {
  /** Its icon; by default "+". */
  icon?: React.ReactNode
  /** Whether more than one file can be picked at a time. */
  multiple?: boolean
}) {
  const composer = useComposer()
  const input = React.useRef<HTMLInputElement>(null)
  const trigger = React.useRef<HTMLButtonElement>(null)
  const pick = React.useCallback(() => input.current?.click(), [])
  // The picker the app's `actionsRef.pickFiles()` opens.
  const { pickerRef, takesFiles } = composer
  React.useEffect(() => {
    if (!takesFiles) return
    pickerRef.current = pick
    return () => {
      if (pickerRef.current === pick) pickerRef.current = null
    }
  }, [pickerRef, pick, takesFiles])
  if (!composer.takesFiles && !children) return null

  return (
    <>
      {children ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <ComposerButton
                ref={trigger}
                data-slot="composer-attach"
                aria-label={composer.labels.add}
                disabled={composer.disabled || disabled}
                className={className}
                {...props}
              />
            }
          >
            {icon ?? <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} />}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="start"
            // Above the composer, not over its text; its start at the
            // composer's.
            sideOffset={({ side }) =>
              inputGroupPopupOffset(trigger.current, side)
            }
            alignOffset={() => {
              const button = trigger.current
              const box = button?.closest("[data-slot=composer]")
              if (!button || !box) return 0
              const at = button.getBoundingClientRect()
              const edge = box.getBoundingClientRect()
              const rtl = getComputedStyle(box).direction === "rtl"
              return rtl ? at.right - edge.right : edge.left - at.left
            }}
            // 256px.
            className="w-64 p-1"
          >
            <AttachContext value={composer.takesFiles ? pick : null}>
              {children}
            </AttachContext>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <ComposerButton
          data-slot="composer-attach"
          aria-label={composer.labels.attach}
          disabled={composer.disabled || disabled}
          onClick={(event) => {
            onClick?.(event)
            if (!event.defaultPrevented) pick()
          }}
          className={className}
          {...props}
        >
          {icon ?? <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} />}
        </ComposerButton>
      )}
      {composer.takesFiles ? (
        <input
          ref={input}
          type="file"
          hidden
          tabIndex={-1}
          accept={composer.accept}
          multiple={multiple}
          onChange={(event) => {
            composer.addFiles?.(Array.from(event.currentTarget.files ?? []))
            // So picking the same file again adds it again.
            event.currentTarget.value = ""
          }}
        />
      ) : null}
    </>
  )
}

/** An item of the add menu: an icon in grey, its words, a shortcut. */
function ComposerAttachItem({
  icon,
  shortcut,
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuItem> & {
  icon?: React.ReactNode
  /** At its end, in grey: "⌘U", "@". */
  shortcut?: React.ReactNode
}) {
  return (
    <DropdownMenuItem
      className={cn(
        "gap-2 px-2 text-2sm [&>svg]:text-muted-foreground",
        className
      )}
      {...props}
    >
      {icon}
      {children}
      {shortcut ? (
        <DropdownMenuShortcut className="tracking-normal text-subtle-foreground">
          {shortcut}
        </DropdownMenuShortcut>
      ) : null}
    </DropdownMenuItem>
  )
}

/** The add menu's item that picks files. */
function ComposerAttachFiles({
  children,
  ...props
}: Omit<React.ComponentProps<typeof ComposerAttachItem>, "onClick">) {
  const pick = React.useContext(AttachContext)
  const { labels } = useComposer()
  return (
    <ComposerAttachItem
      icon={<HugeiconsIcon icon={Attachment01Icon} strokeWidth={2} />}
      disabled={!pick}
      onClick={() => pick?.()}
      {...props}
    >
      {children ?? labels.upload}
    </ComposerAttachItem>
  )
}

/**
 * Sends, a round button at the toolbar's end: grey while there is
 * nothing to send, ✓ while a sent message is edited. While a response
 * runs it stops it; with a follow-up typed, a stop goes before it and it
 * shows the follow-up mode (send, queue or steer). Its reason, the stop
 * and it are one group:
 * `className` is the group's ("ms-auto" puts all of them at the end).
 */
function ComposerSubmit({
  className,
  reason,
  ...props
}: Omit<
  React.ComponentProps<typeof Button>,
  "type" | "onClick" | "children" | "disabled"
> & {
  /** Why it cannot send, said before it: "Waiting for 1 upload". */
  reason?: React.ReactNode
}) {
  const composer = useComposer()
  // Set on a click, read by the submit that follows it.
  const { interrupt: interruptRef } = composer
  const reasonId = React.useId()
  const hintId = React.useId()
  // One element throughout, so focus stays on it as it changes. While a
  // response runs it stops it, unless a follow-up can be sent: then a
  // stop goes before it, and it waits, raised, for the follow-up. A
  // queued message being edited is put back with a labelled Update.
  // Nothing to send: no text but spaces, and no chips.
  const empty = isEmpty(composer.value)
  const queued = composer.editing === "queued"
  const submits =
    queued ||
    composer.status === "ready" ||
    (composer.status === "running" && !composer.submitDisabled)
  const followUp = submits && !queued && composer.status === "running"
  const mode = followUp && !composer.editing ? composer.followUp : "send"
  const hint =
    mode !== "send"
      ? composer.labels.followUpHint(mode, apple() ? "⌘" : "Ctrl")
      : undefined
  // While suggestions are open, Enter takes one rather than sending.
  const unavailable =
    composer.disabled ||
    (submits
      ? composer.submitDisabled || empty || composer.suggesting
      : composer.status === "stopping")
  const label = queued
    ? composer.labels.updateQueued
    : submits
      ? composer.editing
        ? composer.labels.update
        : mode === "send"
          ? composer.labels.submit
          : composer.labels[mode]
      : composer.labels.stop
  // To a finger, 40px.
  const round =
    "relative rounded-full max-sm:size-9 pointer-coarse:after:absolute pointer-coarse:after:-inset-1"
  const stopIcon = (
    <HugeiconsIcon icon={StopIcon} strokeWidth={2} className="size-3.5" />
  )

  return (
    <div
      data-slot="composer-submit-group"
      // The toolbar's gaps between them, as when they were its own.
      className={cn(
        "flex min-w-0 items-center gap-0.5 max-sm:gap-0",
        className
      )}
    >
      {reason && unavailable ? (
        <span
          id={reasonId}
          data-slot="composer-submit-reason"
          // The first to go from a narrow toolbar; still its description.
          className="me-2 min-w-0 truncate text-xs text-subtle-foreground @max-xl/composer-toolbar:hidden"
        >
          {reason}
        </span>
      ) : null}
      {followUp ? (
        <Button
          type="button"
          size="icon"
          data-slot="composer-stop"
          // The send column, where the toolbar's popups at its end end.
          data-input-group-end=""
          aria-label={composer.labels.stop}
          disabled={composer.disabled}
          onClick={composer.stop}
          className={cn(round, "ms-1 me-1")}
        >
          {stopIcon}
        </Button>
      ) : null}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              data-slot="composer-submit"
              data-input-group-end=""
              data-follow-up={followUp ? mode : undefined}
              data-action={submits ? "submit" : "stop"}
              type={submits ? "submit" : "button"}
              size={queued ? "default" : "icon"}
              aria-label={label}
              aria-keyshortcuts={queued ? "Enter" : undefined}
              aria-describedby={
                [reason && unavailable ? reasonId : null, hint ? hintId : null]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
              // Stays focusable, so a keyboard user does not lose their place
              // while the button is unavailable for a moment.
              disabled={unavailable}
              focusableWhenDisabled
              onClick={
                submits
                  ? (event) => {
                      interruptRef.current = event.metaKey || event.ctrlKey
                    }
                  : composer.stop
              }
              className={cn(
                queued
                  ? // 32px; to a finger, 40px.
                    "relative h-8 rounded-lg text-2sm max-sm:h-9 pointer-coarse:after:absolute pointer-coarse:after:-inset-1"
                  : round,
                // 6px from the tool before it, the toolbar's gap and this; 10
                // from the stop.
                "ms-1",
                "data-disabled:pointer-events-none",
                // A follow-up while it runs: raised, beside the stop, and so
                // while the box is still empty.
                followUp &&
                  "bg-muted text-foreground inset-ring inset-ring-border hover:bg-accent",
                // Unavailable, a light circle with a hairline and a grey mark.
                !(followUp && !composer.disabled) &&
                  "data-disabled:bg-muted data-disabled:text-subtle-foreground data-disabled:inset-ring data-disabled:inset-ring-border"
              )}
              {...props}
            />
          }
        >
          {queued ? (
            <>
              {label}
              <Kbd
                aria-hidden
                className="h-auto min-w-0 bg-transparent px-1 text-2xs text-current opacity-60"
              >
                ↵
              </Kbd>
            </>
          ) : !submits ? (
            stopIcon
          ) : composer.editing ? (
            <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} />
          ) : (
            <HugeiconsIcon
              icon={
                mode === "queue"
                  ? PlayListAddIcon
                  : mode === "steer"
                    ? CornerUpRightIcon
                    : ArrowUp02Icon
              }
              strokeWidth={2}
            />
          )}
        </TooltipTrigger>
        {hint ? <TooltipContent>{hint}</TooltipContent> : null}
      </Tooltip>
      {hint ? (
        <span id={hintId} className="sr-only">
          {hint}
        </span>
      ) : null}
    </div>
  )
}

const defaultVoiceLabels: ComposerVoiceLabels = {
  record: "Voice input",
  recording: "Recording",
  cancel: "Cancel",
  finish: "Done",
  listening: "Listening…",
  failed: "Couldn't make out the words",
  retry: "Retry",
  slide: "Slide to cancel",
  release: "Release to cancel",
  left: (seconds) => `${seconds}s left`,
  denied: "Microphone access is off: allow it in the site's settings",
  noMicrophone: "No microphone found",
  unavailable: "Couldn't start the microphone",
  dismiss: "Dismiss",
  input: "Choose microphone",
  systemDefault: "System default",
  unnamedInput: (place) => `Microphone ${place}`,
  shortcut: "",
}

/** Held this long or more, the mic records until let go; less, a tap. */
const holdDelay = 300
/**
 * Held alone this long, a `shortcut` key starts a take: an Option or
 * AltGr held for a character's key (Right ⌥ E, AltGr Q) never starts one.
 */
const keyDelay = 150

/** A mounted mic's `shortcut`, and the composer it is in. */
type VoiceShortcut = { box: () => Element | null }
const voiceShortcuts: VoiceShortcut[] = []
let lastVoiceShortcut: VoiceShortcut | null = null
let watchingShortcutFocus = false

/**
 * The mic a `shortcut` drives, of several mounted (a main composer and a
 * side panel's): the one whose composer has the focus, else the one
 * that last had it, else the first mounted.
 */
function voiceShortcutOwner() {
  const active = document.activeElement
  return (
    voiceShortcuts.find((entry) => entry.box()?.contains(active)) ??
    (lastVoiceShortcut && voiceShortcuts.includes(lastVoiceShortcut)
      ? lastVoiceShortcut
      : voiceShortcuts[0])
  )
}

function watchShortcutFocus() {
  if (watchingShortcutFocus) return
  watchingShortcutFocus = true
  document.addEventListener("focusin", (event) => {
    const into = voiceShortcuts.find((entry) =>
      entry.box()?.contains(event.target as Node)
    )
    if (into) lastVoiceShortcut = into
  })
}

/** A `KeyboardEvent.code` as `aria-keyshortcuts` names it. */
function ariaKey(code: string) {
  const modifier = /^(Alt|Control|Meta|Shift)(Left|Right)$/.exec(code)
  if (modifier) return modifier[1]!
  const key = /^(?:Key|Digit)(.)$/.exec(code)
  return key ? key[1]! : code
}

/** How far a held mic slides back, in px, to cancel when let go. */
const slideToCancel = 80
/** The seconds left of `maxDuration` that the time counts down. */
const countdown = 10

/**
 * What a recording that would not start says: the browser's
 * `getUserMedia` errors by their names, anything else as unavailable.
 */
function voiceErrorOf(error: unknown, labels: ComposerVoiceLabels) {
  const name = error instanceof Error ? error.name : ""
  if (name === "NotAllowedError" || name === "SecurityError")
    return labels.denied
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return labels.noMicrophone
  return labels.unavailable
}

/** The words of a live transcript, the settled and the still changing. */
function liveText(input: VoiceInput) {
  return [input.transcript, input.interim]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ")
}

/**
 * Voice input: the mic of the toolbar. It records through the app
 * (`onStart`) and on Done puts what `onFinish` makes of it, the
 * transcript, in the text at the caret, to edit before sending. Cancel
 * or Escape drops it (`onCancel`).
 *
 * While it records, the time and a waveform of the app's `levels` take
 * the text's place; given a live `transcript` (and its `interim` words,
 * still changing, in grey), the words do, the time and a smaller wave
 * going to the toolbar. Its tools' place, Cancel and Done.
 *
 * Tapped, it records until Done; held (pointer or Space), until let go,
 * slid back to cancel. `submitOnFinish` sends what it made out at once:
 * always, or (`"hold"`) only when it was held. `maxDuration` counts its
 * last seconds down and finishes at its end.
 *
 * If it will not start, a line under the box says why: `onStart`'s
 * rejection, by the browser's `getUserMedia` error names (access off, no
 * microphone). If `onFinish` fails, the recording stays, with a Retry.
 *
 * Given `inputs`, a button beside the mic (a split button's chevron:
 * tapped, pressed or Enter, Space or ArrowDown from the keyboard, as
 * the mic's own press and hold record) opens a choice of what to record
 * from, the system default first, a sheet on a phone. The app lists the
 * inputs (`enumerateDevices`, again on `devicechange` and on
 * `onInputsOpen`), keeps the choice and records from it; the mic only
 * shows it (`input`) and tells of a new one (`onInputChange`). It is not
 * offered while recording, as the tools are not, nor while a recording
 * starts.
 *
 * Given a `shortcut` (a `KeyboardEvent.code`, e.g. `"AltRight"`), that
 * key drives it from anywhere in the window, pressed alone: held, it
 * records until let go (sent by `submitOnFinish` as a held mic is;
 * Escape cancels); tapped, it records until tapped again (or Done), not
 * sent by `"hold"`. A take starts once the key has been held alone for
 * 150ms; another key before that (an Option or AltGr character) starts
 * none, and during a take cancels it, the key going through either way.
 * The key itself does nothing else (a lone Alt opens no menu); repeats
 * are ignored. The window losing the focus while it is held finishes
 * the take, the words kept, not sent. Of several mics with one, the one
 * whose composer has the focus answers it, else the one that last had
 * it, else the first mounted. `labels.shortcut` says so in its tooltip.
 */
function ComposerVoice({
  onStart,
  onCancel,
  onFinish,
  levels = noLevels,
  duration,
  transcript,
  interim,
  maxDuration,
  submitOnFinish = false,
  inputs,
  input,
  onInputChange,
  onInputsOpen,
  shortcut,
  labels,
  className,
  onClick,
  onKeyDown,
  onPointerDown,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "children"> & {
  /**
   * Starts recording, e.g. asks for the microphone. A rejection starts
   * nothing and says why under the box: a `getUserMedia` error's name
   * picks the words (`NotAllowedError`, `NotFoundError`).
   */
  onStart: () => void | Promise<void>
  onCancel?: () => void
  /**
   * Stops recording; its transcript, if any, goes in the text (nothing
   * returned, the live `transcript`). A rejection keeps the recording,
   * with a Retry that calls it again.
   */
  onFinish: () =>
    ComposerValue | string | void | Promise<ComposerValue | string | void>
  /** Recent input levels from 0 to 1, the latest last. */
  levels?: readonly number[]
  /** How long it has recorded, in seconds, as the app's recorder says. */
  duration?: number
  /**
   * The words made out so far, as they are: given (even empty), they
   * are shown in the text's place while it records.
   */
  transcript?: string
  /** The words after them still being made out, shown in grey. */
  interim?: string
  /** The longest it records, in seconds: its last 10 count down. */
  maxDuration?: number
  /** Sends the words once made out: always, or only when held. */
  submitOnFinish?: boolean | "hold"
  /**
   * The inputs it can record from besides the system default: with any,
   * a button beside the mic chooses among them. With `inputs`,
   * `className` goes on the group of the two, as it places the tool.
   */
  inputs?: readonly ComposerVoiceInput[]
  /**
   * The id of the input it records from; `""` or none, the system
   * default, as is one no longer among `inputs` (unplugged).
   */
  input?: string
  /** Another input chosen: its id, `""` for the system default. */
  onInputChange?: (id: string) => void
  /** The inputs about to show: the app can list them again. */
  onInputsOpen?: () => void
  /**
   * A key that drives it from anywhere in the window, pressed alone, by
   * its `KeyboardEvent.code`: `"AltRight"`, `"F13"`. None, no key.
   */
  shortcut?: string
  labels?: Partial<ComposerVoiceLabels>
}) {
  const composer = useComposer()
  const [editor] = useLexicalComposerContext()
  const all = { ...defaultVoiceLabels, ...labels }
  const [session, setSession] = React.useState<VoiceState | null>(null)
  // Asked to start, not started or refused yet (the browser may ask for
  // the microphone meanwhile).
  const [starting, setStarting] = React.useState(false)
  const group = React.useRef<HTMLDivElement>(null)
  const sessionRef = React.useRef(session)
  // A pointer or Space holding the mic down: where and when it started.
  const hold = React.useRef<{ at: number; x: number; rtl: boolean } | null>(
    null
  )
  const latest = React.useRef({
    onCancel,
    onFinish,
    all,
    composer,
    submitOnFinish,
  })
  const { voiceLevels, setVoice, setVoiceError } = composer
  React.useLayoutEffect(() => {
    latest.current = { onCancel, onFinish, all, composer, submitOnFinish }
  })
  React.useLayoutEffect(() => {
    voiceLevels.set({ levels, duration, transcript, interim })
  }, [voiceLevels, levels, duration, transcript, interim])

  // Kept in the ref at once: a release may come before React renders.
  const commit = React.useCallback((next: VoiceState | null) => {
    sessionRef.current = next
    setSession(next)
  }, [])
  const update = React.useCallback(
    (change: Partial<VoiceState>) => {
      const current = sessionRef.current
      if (current) commit({ ...current, ...change })
    },
    [commit]
  )

  const actions = React.useMemo(() => {
    const end = () => {
      hold.current = null
      // The editor takes the focus once shown again (ComposerEditor).
      commit(null)
    }
    const cancel = () => {
      latest.current.onCancel?.()
      end()
    }
    const finish = () => {
      const current = sessionRef.current
      if (!current || current.transcribing) return
      const send =
        latest.current.submitOnFinish === true ||
        (latest.current.submitOnFinish === "hold" && current.held)
      const live = liveText(voiceLevels.get())
      update({ transcribing: true, failed: false, cancelling: false })
      Promise.resolve()
        .then(() => latest.current.onFinish())
        .then(
          (result) => {
            const words = result?.length ? result : live
            end()
            if (!words.length) return
            latest.current.composer.insertValue(
              typeof words === "string" ? [words] : words
            )
            if (send)
              // Once the editor has the words.
              requestAnimationFrame(() =>
                editor.getRootElement()?.closest("form")?.requestSubmit()
              )
          },
          () => update({ transcribing: false, failed: true, held: false })
        )
    }
    return { cancel, finish }
  }, [editor, commit, update, voiceLevels])

  React.useLayoutEffect(() => {
    setVoice(
      session ? { ...session, ...actions, labels: latest.current.all } : null
    )
  }, [session, actions, setVoice])

  React.useEffect(() => () => setVoice(null), [setVoice])

  // At its longest, it finishes.
  React.useEffect(() => {
    if (!session || session.transcribing || session.failed || !maxDuration)
      return
    const elapsed = duration ?? (performance.now() - session.startedAt) / 1000
    const timer = setTimeout(
      actions.finish,
      Math.max(0, (maxDuration - elapsed) * 1000)
    )
    return () => clearTimeout(timer)
  }, [session, maxDuration, duration, actions])

  const start = (held: boolean, press?: { aborted: boolean }) => {
    setVoiceError(null)
    setStarting(true)
    Promise.resolve(onStart())
      .finally(() => setStarting(false))
      .then(
        () => {
          // A shortcut's press given up as it started: stopped again.
          if (press?.aborted) {
            hold.current = null
            latest.current.onCancel?.()
            return
          }
          commit({
            startedAt: performance.now(),
            transcribing: false,
            failed: false,
            // Let go while it was starting: a tap.
            held: held && hold.current !== null,
            cancelling: false,
            limit: maxDuration,
          })
        },
        (error: unknown) => {
          hold.current = null
          setVoiceError({
            message: voiceErrorOf(error, latest.current.all),
            dismiss: latest.current.all.dismiss,
          })
        }
      )
  }

  // Let go: a tap records on, a hold finishes, or cancels slid back.
  const release = () => {
    const held = hold.current
    hold.current = null
    const current = sessionRef.current
    if (!held || !current?.held) return
    if (performance.now() - held.at < holdDelay)
      return update({ held: false, cancelling: false })
    if (current.cancelling) actions.cancel()
    else actions.finish()
  }

  const press = (x: number, target: HTMLElement) => {
    hold.current = {
      at: performance.now(),
      x,
      rtl: getComputedStyle(target).direction === "rtl",
    }
    start(true)
  }

  const disabled = composer.disabled || props.disabled
  const keyRef = React.useRef({ start, release, disabled })
  React.useLayoutEffect(() => {
    keyRef.current = { start, release, disabled }
  })

  // The `shortcut` key, from anywhere in the window.
  React.useEffect(() => {
    if (!shortcut) return
    const entry: VoiceShortcut = {
      box: () =>
        editor.getRootElement()?.closest("[data-slot=composer]") ?? null,
    }
    voiceShortcuts.push(entry)
    watchShortcutFocus()
    // The press under way: when it went down, whether a take was under
    // way then (this press ends it), and whether this one started one.
    let down: {
      at: number
      ending: boolean
      started: boolean
      aborted: boolean
      timer: ReturnType<typeof setTimeout> | undefined
    } | null = null
    const giveUp = () => {
      if (!down) return
      clearTimeout(down.timer)
      down.aborted = true
      const started = down.started
      down = null
      if (!started) return
      hold.current = null
      // Under way: dropped (a start still pending stops as it comes).
      if (sessionRef.current) actions.cancel()
    }
    // Another modifier with it: not alone.
    const withOthers = (event: KeyboardEvent) =>
      (event.ctrlKey && !shortcut.startsWith("Control")) ||
      (event.metaKey && !shortcut.startsWith("Meta")) ||
      (event.shiftKey && !shortcut.startsWith("Shift")) ||
      (event.altKey && !shortcut.startsWith("Alt"))
    const keyDown = (event: KeyboardEvent) => {
      if (event.code !== shortcut) {
        // Another key while it is held: the take is given up, the key
        // goes through. Escape while held cancels as it does (VoiceControls).
        if (down && event.key !== "Escape") giveUp()
        else if (down) {
          clearTimeout(down.timer)
          down = null
        }
        return
      }
      if (event.isComposing) return
      if (event.repeat || down) {
        if (down) event.preventDefault()
        return
      }
      const session = sessionRef.current
      if (keyRef.current.disabled || withOthers(event)) return
      if (!session && voiceShortcutOwner() !== entry) return
      // Not a menu's, nor anything else's.
      event.preventDefault()
      const press = {
        at: performance.now(),
        ending: session !== null,
        started: false,
        aborted: false,
        timer: undefined as ReturnType<typeof setTimeout> | undefined,
      }
      down = press
      if (press.ending) return
      press.timer = setTimeout(() => {
        if (down !== press) return
        press.started = true
        hold.current = { at: press.at, x: 0, rtl: false }
        keyRef.current.start(true, press)
      }, keyDelay)
    }
    const keyUp = (event: KeyboardEvent) => {
      if (event.code !== shortcut || !down) return
      event.preventDefault()
      const press = down
      clearTimeout(press.timer)
      down = null
      const session = sessionRef.current
      // Tapped again: done, as a tapped take is (not sent by "hold").
      if (press.ending) {
        if (session) {
          if (session.held) update({ held: false, cancelling: false })
          actions.finish()
        }
        return
      }
      // Let go before it started: a tap, recording until tapped again.
      if (!press.started) return keyRef.current.start(false)
      keyRef.current.release()
    }
    // The window left while held: finished, the words kept, not sent.
    const blur = () => {
      if (!down) return
      const press = down
      if (!press.started || !sessionRef.current) return giveUp()
      clearTimeout(press.timer)
      down = null
      hold.current = null
      update({ held: false, cancelling: false })
      actions.finish()
    }
    window.addEventListener("keydown", keyDown, true)
    window.addEventListener("keyup", keyUp, true)
    window.addEventListener("blur", blur)
    return () => {
      giveUp()
      window.removeEventListener("keydown", keyDown, true)
      window.removeEventListener("keyup", keyUp, true)
      window.removeEventListener("blur", blur)
      voiceShortcuts.splice(voiceShortcuts.indexOf(entry), 1)
      if (lastVoiceShortcut === entry) lastVoiceShortcut = null
    }
  }, [shortcut, editor, actions, update])

  const button = (
    <ComposerButton
      data-slot="composer-voice"
      aria-label={all.record}
      aria-keyshortcuts={shortcut ? ariaKey(shortcut) : undefined}
      disabled={disabled}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        if (event.defaultPrevented || event.button !== 0 || hold.current) return
        // Not a focus, a selection or a scroll, but a press.
        event.preventDefault()
        press(event.clientX, event.currentTarget)
        const pointer = event.pointerId
        const move = (moved: PointerEvent) => {
          const held = hold.current
          if (moved.pointerId !== pointer || !held) return
          const back = (held.x - moved.clientX) * (held.rtl ? -1 : 1)
          const cancelling = back > slideToCancel
          if (
            sessionRef.current?.held &&
            sessionRef.current.cancelling !== cancelling
          )
            update({ cancelling })
        }
        const up = (ended: PointerEvent) => {
          if (ended.pointerId !== pointer) return
          window.removeEventListener("pointermove", move)
          window.removeEventListener("pointerup", up)
          window.removeEventListener("pointercancel", up)
          if (ended.type === "pointercancel" && sessionRef.current?.held) {
            hold.current = null
            return actions.cancel()
          }
          release()
        }
        window.addEventListener("pointermove", move)
        window.addEventListener("pointerup", up)
        window.addEventListener("pointercancel", up)
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (event.defaultPrevented || event.key !== " ") return
        // Space held records until let go; not as a click.
        event.preventDefault()
        if (event.repeat || hold.current) return
        press(0, event.currentTarget)
        const up = (ended: KeyboardEvent) => {
          if (ended.key !== " ") return
          ended.preventDefault()
          window.removeEventListener("keyup", up)
          release()
        }
        window.addEventListener("keyup", up)
      }}
      onClick={(event) => {
        onClick?.(event)
        // Enter's click; a pointer's press started it already.
        if (!event.defaultPrevented && event.detail === 0 && !hold.current)
          start(false)
      }}
      onContextMenu={(event) => event.preventDefault()}
      className={cn("touch-none select-none", !inputs?.length && className)}
      {...props}
    >
      <HugeiconsIcon icon={Mic01Icon} strokeWidth={2} />
    </ComposerButton>
  )
  // Its shortcut, said in a tooltip.
  const mic =
    shortcut && all.shortcut ? (
      <Tooltip>
        <TooltipTrigger render={button} />
        <TooltipContent>{all.shortcut}</TooltipContent>
      </Tooltip>
    ) : (
      button
    )
  if (!inputs?.length) return mic

  const chosen =
    input && inputs.some((choice) => choice.id === input) ? input : ""
  return (
    <ButtonGroup
      ref={group}
      data-slot="composer-voice-group"
      className={cn(
        "rounded-lg has-aria-expanded:bg-muted has-aria-expanded:text-foreground dark:has-aria-expanded:bg-muted/50",
        className
      )}
    >
      {mic}
      <DropdownMenu
        onOpenChange={(open) => {
          if (open) onInputsOpen?.()
        }}
      >
        <DropdownMenuTrigger
          render={
            <ComposerButton
              data-slot="composer-voice-input"
              aria-label={all.input}
              disabled={disabled || starting}
              // A split button's chevron: 24px wide, a target's least
              // beside another (WCAG 2.5.8), as tall as the mic. Under a
              // finger it reaches past its end, not over the mic.
              className="w-6 aria-expanded:bg-transparent max-sm:w-6 pointer-coarse:after:start-0"
            />
          }
        >
          {/* 12px, as a split button's chevron: smaller than the mic. */}
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            strokeWidth={2}
            className="size-3"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          align="end"
          anchor={group}
          sheetTitle={all.input}
          // 288px: a device's long name goes on to a second line.
          className="w-72"
        >
          <DropdownMenuRadioGroup
            aria-label={all.input}
            value={chosen}
            onValueChange={(id) => {
              if (id !== chosen) onInputChange?.(String(id))
            }}
          >
            <DropdownMenuRadioItem value="" closeOnClick>
              {all.systemDefault}
            </DropdownMenuRadioItem>
            {inputs.map((choice, index) => (
              <DropdownMenuRadioItem
                key={choice.id}
                value={choice.id}
                closeOnClick
              >
                {choice.label.trim() || all.unnamedInput(index + 1)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  )
}

/**
 * The toolbar while recording. Tapped: Cancel, and Done that keeps the
 * words (with a live transcript, the time and a wave before them); the
 * words not made out, Retry. Held: where to slide to cancel, and the mic.
 */
function VoiceControls({ voice }: { voice: VoiceSession }) {
  const { voiceLevels } = useComposer()
  const live = React.useSyncExternalStore(
    voiceLevels.subscribe,
    () => isLive(voiceLevels.get()),
    () => isLive(voiceLevels.get())
  )
  const done = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (!voice.held) done.current?.focus()
  }, [voice.held, voice.failed])
  // Held, Escape cancels too: the focus is not here.
  const { held, cancel } = voice
  React.useEffect(() => {
    if (!held) return
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      cancel()
    }
    window.addEventListener("keydown", escape)
    return () => window.removeEventListener("keydown", escape)
  }, [held, cancel])
  return (
    <div
      data-slot="composer-voice-controls"
      data-held={voice.held || undefined}
      className="flex min-w-0 flex-1 items-center"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return
        event.preventDefault()
        voice.cancel()
      }}
    >
      {live && !voice.failed ? <VoiceMeter voice={voice} small /> : null}
      {voice.held ? (
        <>
          <span
            aria-live="polite"
            className={cn(
              "ms-auto me-3 flex items-center gap-1 text-2sm text-muted-foreground [&>svg]:size-3.5",
              voice.cancelling && "text-foreground"
            )}
          >
            {voice.cancelling ? null : (
              <HugeiconsIcon
                icon={ArrowLeft01Icon}
                strokeWidth={2}
                className="rtl:rotate-180"
              />
            )}
            {voice.cancelling ? voice.labels.release : voice.labels.slide}
          </span>
          <span
            aria-hidden
            data-slot="composer-voice-held"
            // Where the finger is, near enough: the mic, lit; let go of
            // to cancel, struck out.
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-colors max-sm:size-9 [&>svg]:size-4",
              voice.cancelling &&
                "bg-muted text-muted-foreground inset-ring inset-ring-border"
            )}
          >
            <HugeiconsIcon
              icon={voice.cancelling ? Cancel01Icon : Mic01Icon}
              strokeWidth={2}
            />
          </span>
        </>
      ) : (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ms-auto me-3"
            disabled={voice.transcribing}
            onClick={voice.cancel}
          >
            {voice.labels.cancel}
          </Button>
          {voice.failed ? (
            <Button ref={done} type="button" size="sm" onClick={voice.finish}>
              {voice.labels.retry}
            </Button>
          ) : (
            <Button
              ref={done}
              type="button"
              size="icon"
              aria-label={voice.labels.finish}
              disabled={voice.transcribing}
              focusableWhenDisabled
              onClick={voice.finish}
              className="relative rounded-full max-sm:size-9"
            >
              {voice.transcribing ? (
                <Spinner />
              ) : (
                <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} />
              )}
            </Button>
          )}
        </>
      )}
    </div>
  )
}

/** Bars of the waveform shown at once; in the toolbar, fewer. */
const waveSlots = 44
const smallWaveSlots = 16

const noLevels: readonly number[] = []

/** Whether the app gives a live transcript. */
const isLive = (input: VoiceInput) =>
  input.transcript !== undefined || input.interim !== undefined

/** How long it has recorded, ticking where the app does not say. */
function useVoiceTime(voice: VoiceSession, input: VoiceInput) {
  const [now, setNow] = React.useState(voice.startedAt)
  React.useEffect(() => {
    const timer = setInterval(() => setNow(performance.now()), 250)
    return () => clearInterval(timer)
  }, [])
  const seconds = Math.max(
    0,
    Math.floor(input.duration ?? (now - voice.startedAt) / 1000)
  )
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
  const left =
    voice.limit !== undefined && voice.limit - seconds <= countdown
      ? Math.max(0, Math.ceil(voice.limit - seconds))
      : null
  return { time, left }
}

/**
 * A dot, the time (its last seconds counted down) and the waveform: in
 * the text's place, or `small` in the toolbar's start.
 */
function VoiceMeter({
  voice,
  small = false,
}: {
  voice: VoiceSession
  small?: boolean
}) {
  const { voiceLevels } = useComposer()
  const input = React.useSyncExternalStore(
    voiceLevels.subscribe,
    voiceLevels.get,
    voiceLevels.get
  )
  const { time, left } = useVoiceTime(voice, input)
  const slots = small ? smallWaveSlots : waveSlots
  const shown = input.levels.slice(-slots)
  const tall = small ? 12 : 20
  return (
    <div
      data-slot="composer-voice-meter"
      role="status"
      aria-label={`${voice.labels.recording} ${time}`}
      className={cn(
        "flex min-w-0 items-center gap-2 text-sm",
        small && "text-2sm",
        // grid: track (its dot on the text's leading line: the toolbar
        // starts where a button would, its glyph 6px in, 12px on a phone)
        small && "ms-[calc(--spacing(1.5))] max-sm:ms-3",
        // Slid back to cancel: what it would drop, faded.
        voice.cancelling && "opacity-40"
      )}
    >
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full bg-foreground motion-safe:animate-pulse"
      />
      <span aria-hidden className="text-muted-foreground tabular-nums">
        {time}
      </span>
      {left !== null ? (
        <span
          aria-hidden
          // A dot from the time before it.
          className="text-foreground tabular-nums before:me-2 before:text-subtle-foreground before:content-['·'_/_'']"
        >
          {voice.labels.left(left)}
        </span>
      ) : null}
      {/* Said once as the count starts, not at each second. */}
      {left !== null ? (
        <span aria-live="polite" className="sr-only">
          {voice.labels.left(countdown)}
        </span>
      ) : null}
      <span
        aria-hidden
        className={cn(
          "flex min-w-0 items-center gap-0.5 overflow-hidden",
          small ? "h-4" : "h-6 flex-1"
        )}
      >
        {shown.map((level, index) => (
          <span
            key={index}
            // grid: mark (a bar of the wave)
            className="w-0.75 shrink-0 rounded-full bg-muted-foreground"
            style={{
              height: `${4 + Math.round(Math.min(1, Math.max(0, level)) * tall)}px`,
            }}
          />
        ))}
        {Array.from({ length: slots - shown.length }, (_, index) => (
          <span
            key={`rest-${index}`}
            // grid: mark (a bar of the wave)
            className="h-1 w-0.75 shrink-0 rounded-full bg-subtle-foreground/60"
          />
        ))}
      </span>
    </div>
  )
}

/**
 * In the text's place while recording: the meter, or the live
 * transcript, its interim words grey, kept scrolled to its end; the
 * words not made out, why.
 */
function VoiceWave({ voice }: { voice: VoiceSession }) {
  const { voiceLevels } = useComposer()
  const input = React.useSyncExternalStore(
    voiceLevels.subscribe,
    voiceLevels.get,
    voiceLevels.get
  )
  const words = React.useRef<HTMLDivElement>(null)
  React.useLayoutEffect(() => {
    const element = words.current
    if (element) element.scrollTop = element.scrollHeight
  }, [input.transcript, input.interim])
  if (voice.failed)
    return (
      <div
        data-slot="composer-voice-failed"
        role="alert"
        className="flex min-h-11 w-full items-center gap-2 px-4 pt-3 pb-1 text-sm text-muted-foreground [&>svg]:size-4 [&>svg]:shrink-0"
      >
        <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
        {voice.labels.failed}
      </div>
    )
  if (!isLive(input))
    return (
      <div className="flex min-h-11 w-full items-center px-4 pt-3 pb-1">
        <VoiceMeter voice={voice} />
      </div>
    )
  const settled = input.transcript?.trim() ?? ""
  const changing = input.interim?.trim() ?? ""
  return (
    <div
      ref={words}
      data-slot="composer-voice-transcript"
      className={cn(
        // As the text it becomes: 16/24, one line to eight.
        "max-h-[calc(8lh+1rem)] min-h-[calc(1lh+1rem)] w-full overflow-y-auto px-4 pt-3 pb-1 text-base leading-6 break-words whitespace-pre-wrap",
        voice.cancelling && "opacity-40"
      )}
    >
      {settled}
      {changing ? (
        <span className="text-muted-foreground">
          {settled ? " " : ""}
          {changing}
        </span>
      ) : null}
      {settled || changing ? null : (
        <span className="text-subtle-foreground">{voice.labels.listening}</span>
      )}
    </div>
  )
}

/**
 * Says where the box is while a sent message is recalled (`history`):
 * "2 of 14 sent · ↓ newer · esc back to draft". In the toolbar.
 */
function ComposerHistoryHint({
  className,
  ...props
}: React.ComponentProps<"span">) {
  const { recall, labels } = useComposer()
  if (!recall) return null
  return (
    <span
      data-slot="composer-history-hint"
      className={cn(
        // The first to go from a narrow toolbar.
        "ms-2 min-w-0 truncate text-xs text-subtle-foreground @max-xl/composer-toolbar:hidden",
        className
      )}
      {...props}
    >
      {labels.history(recall.position, recall.count)}
    </span>
  )
}

type ComposerTakeoverLabels = {
  held: string
  stop: string
  setAside: string
  resume: string
}

const defaultTakeoverLabels: ComposerTakeoverLabels = {
  held: "A request is waiting · it shows when you pause",
  stop: "Stop",
  setAside: "Chat instead",
  resume: "Back to question",
}

/**
 * The composer's place, taken over by what the agent waits for: a
 * pending `AgentRequest` (an approval, a question) shows where the
 * composer was, in its frame, one at a time, under a line of the app's
 * status ("Needs your approval", "3 waiting") and a stop. The composer,
 * its children, stays mounted and hidden, so its draft, chips and files
 * are there when it comes back.
 *
 * A request arriving while the reader types waits for a pause, blur or
 * send, with a quiet hint; the composer keeps focus and keystrokes.
 *
 * Focus goes with it: to the request when it shows, back to the editor
 * when it goes or is set aside, unless the reader is elsewhere.
 */
function ComposerTakeover({
  holdWhileTyping = 1500,
  request,
  status,
  onStop,
  aside = false,
  onAsideChange,
  labels,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  /** Pause in typing before an arriving request shows, in ms; false or 0 shows it at once. */
  holdWhileTyping?: number | false
  /** What the agent waits for, the app's choice of one; none, the composer. */
  request?: React.ReactNode
  /** Over it, in the app's words: "Needs your approval", "3 waiting". */
  status?: React.ReactNode
  /** Stops the turn that waits; without it, no stop. */
  onStop?: () => void
  /** Whether the reader has set the request aside to chat. */
  aside?: boolean
  /** Shows the toggle that sets the request aside and brings it back. */
  onAsideChange?: (aside: boolean) => void
  labels?: Partial<ComposerTakeoverLabels>
}) {
  const allLabels = { ...defaultTakeoverLabels, ...labels }
  const pending = request !== undefined && request !== null && request !== false
  const shown = pending && !aside
  // Whether the reader is typing in the composer: a request that comes
  // then waits for a pause, so a stray Enter or digit does not answer it.
  const [typing, setTyping] = React.useState(false)
  const composer = React.useRef<HTMLDivElement>(null)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const stopTyping = React.useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
    setTyping(false)
  }, [])
  React.useEffect(() => {
    const element = composer.current
    if (!element || !holdWhileTyping) return
    // beforeinput, not input: the editor takes the edit and cancels it.
    const typed = () => {
      if (!element.contains(document.activeElement)) return
      setTyping(true)
      if (timer.current !== null) clearTimeout(timer.current)
      timer.current = setTimeout(stopTyping, holdWhileTyping)
    }
    element.addEventListener("beforeinput", typed)
    return () => {
      element.removeEventListener("beforeinput", typed)
      stopTyping()
    }
  }, [holdWhileTyping, stopTyping])
  const [previousShown, setPreviousShown] = React.useState(shown)
  const [held, setHeld] = React.useState(false)
  if (shown !== previousShown) {
    setPreviousShown(shown)
    setHeld(shown && typing && !!holdWhileTyping)
  }
  if (held && (!typing || !holdWhileTyping)) setHeld(false)
  const visible = shown && !held
  const root = React.useRef<HTMLDivElement>(null)
  const area = React.useRef<HTMLDivElement>(null)
  const focusEditor = React.useRef<(() => void) | null>(null)
  const registerFocus = React.useCallback((focus: () => void) => {
    focusEditor.current = focus
    return () => {
      if (focusEditor.current === focus) focusEditor.current = null
    }
  }, [])
  // The request that has focus moved to it, to move it once per request.
  const focused = React.useRef<HTMLElement | null>(null)

  React.useLayoutEffect(() => {
    const target = visible
      ? (area.current?.querySelector<HTMLElement>(
          '[data-slot="agent-request-card"]'
        ) ?? area.current)
      : null
    const previous = focused.current
    if (target === previous) return
    focused.current = target
    // Only focus that would be lost moves: from what hides, or none.
    const active = document.activeElement
    if (active && active !== document.body && !root.current?.contains(active))
      return
    if (target) target.focus()
    else if (previous) {
      if (focusEditor.current) focusEditor.current()
      else
        root.current
          ?.querySelector<HTMLElement>('[contenteditable="true"]')
          ?.focus()
    }
  })

  return (
    <TakeoverContext value={registerFocus}>
      <div
        ref={root}
        data-slot="composer-takeover"
        data-state={
          visible ? "request" : held ? "held" : pending ? "aside" : "composer"
        }
        className={cn("flex w-full min-w-0 flex-col gap-2", className)}
        {...props}
      >
        {/* Heard when a request comes or how many wait changes. */}
        <span role="status" className="sr-only">
          {held ? allLabels.held : pending ? status : null}
        </span>
        {pending && (held || status || onAsideChange || onStop) && (
          <div
            data-slot="composer-takeover-bar"
            className="flex min-h-7 min-w-0 items-center gap-1 ps-3 text-xs text-muted-foreground pointer-coarse:min-h-10 pointer-coarse:[&>[data-slot=button]]:h-10"
          >
            <span aria-hidden="true" className="me-auto min-w-0 truncate">
              {held ? allLabels.held : status}
            </span>
            {onAsideChange && !held && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onAsideChange(!aside)}
              >
                {aside ? allLabels.resume : allLabels.setAside}
              </Button>
            )}
            {onStop && (
              <Button type="button" variant="ghost" size="sm" onClick={onStop}>
                <HugeiconsIcon
                  icon={StopIcon}
                  strokeWidth={2}
                  data-icon="inline-start"
                  className="fill-current"
                />
                {allLabels.stop}
              </Button>
            )}
          </div>
        )}
        {pending && (
          <div
            ref={area}
            data-slot="composer-takeover-request"
            hidden={!visible}
            tabIndex={-1}
            className="min-w-0 outline-none"
          >
            {request}
          </div>
        )}
        <div
          data-slot="composer-takeover-composer"
          ref={composer}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) stopTyping()
          }}
          onSubmit={stopTyping}
          hidden={visible}
          inert={visible}
          className="min-w-0"
        >
          {children}
        </div>
      </div>
    </TakeoverContext>
  )
}

export {
  Composer,
  ComposerTakeover,
  ComposerEditor,
  ComposerSuggestions,
  ComposerAttach,
  ComposerAttachFiles,
  ComposerAttachItem,
  ComposerButton,
  ComposerHistoryHint,
  ComposerOptions,
  ComposerOptionsFold,
  ComposerOptionsItem,
  ComposerShelf,
  ComposerShelfBar,
  ComposerShelfTab,
  ComposerToolbar,
  ComposerVoice,
  composerShelf,
  ComposerAttachments,
  ComposerSubmit,
  ComposerChip,
  ComposerMessage,
  composerText,
  type ComposerActions,
  type ComposerAttachment,
  type ComposerAttachmentState,
  type ComposerChipValue,
  type ComposerQuote,
  type ComposerFollowUp,
  type ComposerLabels,
  type ComposerLink,
  type ComposerLinkDetails,
  type ComposerMention,
  type ComposerSecret,
  type ComposerStatus,
  type ComposerSuggestion,
  type ComposerTakeoverLabels,
  type ComposerValue,
  type ComposerVoiceInput,
  type ComposerVoiceLabels,
}
