"use client"

import * as React from "react"
import { useShimmerPause } from "@/hooks/use-shimmer-pause"
import { mergeProps } from "@base-ui/react/merge-props"
import { cn } from "cn"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertCircleIcon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  AudioWave01Icon,
  Download01Icon,
  Image01Icon,
  ImageNotFound01Icon,
  LinkSquare02Icon,
  Video01Icon,
  VideoOffIcon,
} from "@hugeicons/core-free-icons"

import {
  Attachment,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { CopyButton, type CopyData } from "@/components/copy-button"
import { FloatingButton } from "@/components/floating-button"
import { useFullScreen } from "@/lib/full-screen"
import {
  MediaBar,
  defaultMediaViewerLabels,
  png,
  useMedia,
  useMediaElement,
  type MediaBarLabels,
  type MediaCrossOrigin,
  type MediaElementProps,
  type MediaKind,
} from "@/components/media-viewer"

/**
 * Where an image, a video or a recording is: made, being made
 * (`pending`), loaded only when the reader asks (`deferred`), or one that
 * could not be made (`error`).
 */
type MediaState = {
  /** Its key among the others; by default its place and `src`. */
  id?: string | undefined
  /** Once it is there; none while it is `pending` or `deferred`. */
  src?: string | undefined
  /**
   * `done` by default with a `src`, `pending` without: being made, a
   * placeholder of its shape saying so. `deferred`: not loaded until the
   * reader asks, by a button that calls `onLoadRequest` (the app then
   * gives its `src`). `error`: it could not be made.
   */
  status?: "done" | "pending" | "deferred" | "error" | undefined
  /** While it is `pending`, how long it has taken, as the app words it ("8s"). */
  elapsed?: string | undefined
  /** A `deferred` one's size, on its button: "2.4 MB". */
  fileSize?: string | undefined
  /** The reader asks for a `deferred` one. */
  onLoadRequest?: (() => void) | undefined
  /**
   * How it is fetched from another origin: e.g. "use-credentials" where
   * the server needs the reader's cookies. The app decides, per item.
   */
  crossOrigin?: MediaCrossOrigin | undefined
}

/** An image in a gallery. */
type MediaImage = MediaState & {
  kind?: "image" | undefined
  /** What it shows, for those who do not see it, e.g. its prompt. */
  alt: string
  /**
   * Its size in pixels, or the size asked for while it is made: its place
   * is kept at its shape before it loads. Without them, its size is read
   * as it loads.
   */
  width?: number | undefined
  height?: number | undefined
  /** Its shape (width / height) where its size is not known: 16 / 9. */
  aspectRatio?: number | undefined
  /**
   * A smaller copy: its thumbnail where it is one of several; where it is
   * larger, shown till it has loaded.
   */
  thumbnail?: string | undefined
  /**
   * Its copies to choose from, as `<img srcset>`: e.g. its thumbnail and
   * itself, "thumb.jpg 512w, full.jpg 2880w". The gallery says how wide
   * it is shown, and the browser loads the smallest sharp enough there.
   */
  srcSet?: string | undefined
  /**
   * Its stand-in in its place till it has loaded, under its `thumbnail`
   * as that loads: e.g. its ThumbHash drawn small, as a data URL, which
   * the browser draws blurred at its size.
   */
  placeholder?: string | undefined
  /**
   * Under it where it is at its own shape, as a video's: its `title` (e.g.
   * the model; by default its `alt`), then its `description` ("3:2 · 2K")
   * and `end` (its cost, "2 of 4") a shade lighter.
   */
  title?: React.ReactNode
  description?: React.ReactNode
  end?: React.ReactNode
  /**
   * What else can be done with it, where it is at its own shape:
   * `MediaGalleryAction`s, in its card before copying it and opening it
   * in a new tab (which every image has).
   */
  actions?: React.ReactNode
}

/**
 * What a video and a recording in a gallery have: their `status` as an
 * image's, a recording's placeholder where its controls go.
 */
type MediaPlayable = MediaState & {
  /** What it is, e.g. its file name; also the player's name. */
  title: string
  /** The app's words about it: "Screen recording". */
  description?: React.ReactNode
  /** Its length in seconds, if known before it loads. */
  duration?: number | undefined
  /** What is said in it, shown when asked for. */
  transcript?: React.ReactNode
  /** The app's buttons in its card, e.g. download. */
  actions?: React.ReactNode
  /** The app's props for the `<video>` or `<audio>`: its `ref`, its events. */
  mediaProps?: MediaElementProps | undefined
}

/** A video in a gallery: in a card, at its own shape, no taller than 400px. */
type MediaVideo = MediaPlayable & {
  kind: "video"
  /** Its size in pixels, if known (or the size asked for while it is made): its place is kept. */
  width?: number | undefined
  height?: number | undefined
  /** Its shape (width / height) where its size is not known: 16 / 9 by default. */
  aspectRatio?: number | undefined
  /** Its picture before it plays. */
  poster?: string | undefined
  /** Captions, as WebVTT. */
  captions?: { src: string; label: string; language: string }[] | undefined
}

/** A recording in a gallery: in a card, its controls under its title. */
type MediaAudio = MediaPlayable & { kind: "audio" }

type MediaItem = MediaImage | MediaVideo | MediaAudio

type MediaGalleryLabels = MediaBarLabels & {
  /** On the last thumbnail shown, for the images not shown: "3 more". */
  more: (images: number) => string
  /** Where the viewer is: "2 of 5". */
  position: (image: number, images: number) => string
  previous: string
  next: string
  /** The viewer's title for an image without `alt`. */
  image: string
  /** What is said when it cannot be shown or played. */
  failed: (kind: MediaKind) => string
  /** While one is made, before its `elapsed`. */
  pending: string
  /** A `deferred` one's button, before its `fileSize`. */
  load: (kind: MediaKind) => string
  transcript: string
  copyImage: string
  copied: string
  copyFailed: string
  /** Opening it in a new tab. */
  openImage: string
  /** The viewer's close button. */
  close: string
}

const defaultLabels: MediaGalleryLabels = {
  close: "Close",
  more: (images) => `${images} more`,
  position: (image, images) => `${image} of ${images}`,
  previous: "Previous image",
  next: "Next image",
  image: "Image",
  failed: defaultMediaViewerLabels.failed,
  pending: "Generating",
  load: (kind) =>
    kind === "image"
      ? "Load image"
      : kind === "video"
        ? "Load video"
        : "Load recording",
  transcript: defaultMediaViewerLabels.transcript,
  copyImage: "Copy image",
  copied: "Copied",
  copyFailed: "Could not copy",
  openImage: "Open in new tab",
  play: defaultMediaViewerLabels.play,
  pause: defaultMediaViewerLabels.pause,
  mute: defaultMediaViewerLabels.mute,
  unmute: defaultMediaViewerLabels.unmute,
  fullScreen: defaultMediaViewerLabels.fullScreen,
  seek: defaultMediaViewerLabels.seek,
}

// Where the pointer is a finger, a small button's place is as large as one
// (44px), its look the same.
const touch =
  "relative pointer-coarse:after:absolute pointer-coarse:after:-inset-2"
const touchLarge =
  "relative pointer-coarse:after:absolute pointer-coarse:after:-inset-3"

/** The tallest an image at its own shape is shown, in pixels. */
const imageHeight = 240
// One taller than wide, as tall as this: a phone's screenshot not a
// sliver.
const tallHeight = 320
/** The tallest a video is shown, in pixels. */
const videoHeight = 400

// What is not there to show: a surface a step off the card's, so that a
// floating button on it (the page's colour, `bg-muted` in dark) reads.
const stage = "bg-muted/50"

// What cannot be shown: greys, its icon and, where there is room, why.
const failure =
  "flex flex-col items-center justify-center gap-2 bg-muted/50 p-2 text-center text-xs text-balance text-muted-foreground [&>svg]:size-5"

/** Told when one starts playing, so that it pauses the one playing. */
const PlayingContext = React.createContext<
  ((element: HTMLMediaElement) => void) | null
>(null)

/** One playing at a time: playing another pauses it. */
function useOnePlaying() {
  const playing = React.useRef<HTMLMediaElement | null>(null)
  return React.useCallback((element: HTMLMediaElement) => {
    if (playing.current && playing.current !== element) playing.current.pause()
    playing.current = element
  }, [])
}

/**
 * Around a conversation: one video or recording of its galleries plays at
 * a time, and playing another pauses it. (In one gallery, it is so
 * without it.)
 */
function MediaGalleryProvider({ children }: { children: React.ReactNode }) {
  const started = useOnePlaying()
  return <PlayingContext value={started}>{children}</PlayingContext>
}

/** Whether the element is near the viewport, or was: what to load. */
function useNear(node: Element | null) {
  const [near, setNear] = React.useState(false)
  React.useEffect(() => {
    if (!node || near) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setNear(true)
      },
      { rootMargin: "400px 0px" }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [node, near])
  return near
}

/** "1:05", "1:02:09"; nothing for a stream, which has no end. */
function clock(seconds: number | undefined) {
  if (seconds === undefined || !Number.isFinite(seconds)) return undefined
  const whole = Math.round(seconds)
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const rest = String(whole % 60).padStart(2, "0")
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}`
    : `${minutes}:${rest}`
}

const isImage = (item: MediaItem): item is MediaImage =>
  item.kind === undefined || item.kind === "image"

/** What one is now: `done` with a `src`, `pending` without. */
const statusOf = (item: MediaState) =>
  item.status ?? (item.src ? "done" : "pending")

/** An image the viewer opens: one that is there to load. */
const opens = (image: MediaImage) =>
  statusOf(image) === "done" && image.src !== undefined

/**
 * An action on an image, in its card: an icon button as a video's, its
 * name in a tooltip.
 */
function MediaGalleryAction({
  label,
  className,
  children,
  ...props
}: React.ComponentProps<typeof Button> & {
  /** Its name, said and shown in its tooltip. */
  label: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={label}
            data-slot="media-gallery-action"
            className={cn(touchLarge, className)}
            {...props}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/**
 * In place of an image, a video or a recording that is not there to show:
 * being made, its words shimmering (still where less motion is asked) and
 * how long it has taken; deferred, a button that asks for it with its
 * size; or one that could not be made or loaded, its icon and why.
 */
function Placeholder({
  kind,
  state,
  item,
  name,
  compact = false,
  quiet = false,
  labels,
}: {
  kind: MediaKind
  state: "pending" | "deferred" | "error"
  item: MediaState
  /** What it is, for a screen reader, where it cannot be shown. */
  name: string
  /** A thumbnail's: the button its icon, its size under it, no words. */
  compact?: boolean
  /** Why it failed is said beside it, e.g. in a card's description. */
  quiet?: boolean
  labels: MediaGalleryLabels
}) {
  useShimmerPause()
  if (state === "pending")
    return (
      <div
        role="status"
        data-slot="media-gallery-pending"
        className={cn(
          "absolute inset-0 flex items-center justify-center p-2 text-center text-xs text-muted-foreground",
          stage
        )}
      >
        <span className="shimmer tabular-nums">
          {labels.pending}
          {item.elapsed && <span aria-hidden="true"> · {item.elapsed}</span>}
        </span>
      </div>
    )
  if (state === "deferred") {
    const load = labels.load(kind)
    return (
      <div
        data-slot="media-gallery-deferred"
        className={cn(
          "absolute inset-0 flex flex-col items-center justify-center gap-1 p-1 text-xs text-muted-foreground",
          stage
        )}
      >
        <FloatingButton
          size={compact ? "icon-sm" : "sm"}
          aria-label={
            compact
              ? item.fileSize
                ? `${load}, ${item.fileSize}`
                : load
              : undefined
          }
          onClick={item.onLoadRequest}
          className={touch}
        >
          <HugeiconsIcon
            icon={Download01Icon}
            strokeWidth={2}
            data-icon={compact ? undefined : "inline-start"}
          />
          {!compact && load}
          {!compact && item.fileSize && (
            <span className="text-muted-foreground tabular-nums">
              {item.fileSize}
            </span>
          )}
        </FloatingButton>
        {compact && item.fileSize && (
          <span aria-hidden="true" className="tabular-nums">
            {item.fileSize}
          </span>
        )}
      </div>
    )
  }
  return (
    <span
      role="img"
      aria-label={name}
      data-slot="media-gallery-failed"
      className={cn(failure, "absolute inset-0")}
    >
      <HugeiconsIcon
        icon={
          kind === "image"
            ? ImageNotFound01Icon
            : kind === "video"
              ? VideoOffIcon
              : AudioWave01Icon
        }
        strokeWidth={2}
        aria-hidden="true"
      />
      {!compact && !quiet && (
        <span aria-hidden="true">{labels.failed(kind)}</span>
      )}
    </span>
  )
}

/**
 * The image as the clipboard takes one, PNG: fetched as it is shown (with
 * the reader's cookies where its `crossOrigin` says so), and drawn again
 * where it is of another type.
 */

/** What every image there is can be: copied, and opened in a new tab. */
function ImageActions({
  src,
  crossOrigin,
  size = "icon-xs",
  labels,
}: {
  src: string
  crossOrigin: MediaCrossOrigin | undefined
  /** In a card, as its other actions; beside the viewer's close, as it. */
  size?: "icon-xs" | "icon"
  labels: MediaGalleryLabels
}) {
  // A finger's place as large as one (44px).
  const finger = size === "icon-xs" ? touchLarge : touch
  const copy = React.useMemo<CopyData>(
    () => ({ type: "image/png", data: () => png(src, crossOrigin) }),
    [src, crossOrigin]
  )
  return (
    <>
      <CopyButton
        value={copy}
        size={size}
        className={finger}
        labels={{
          copy: labels.copyImage,
          copied: labels.copied,
          failed: labels.copyFailed,
        }}
      />
      <Tooltip>
        <TooltipTrigger
          // A link, as it is one.
          render={
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              aria-label={labels.openImage}
              data-slot="media-gallery-action"
              className={cn(buttonVariants({ variant: "ghost", size }), finger)}
            />
          }
        >
          <HugeiconsIcon icon={LinkSquare02Icon} strokeWidth={2} />
        </TooltipTrigger>
        <TooltipContent>{labels.openImage}</TooltipContent>
      </Tooltip>
    </>
  )
}

/**
 * An image of the gallery: in a card at its own shape (no taller than
 * 240px), its title, caption and actions under it, as a video's; or a
 * square thumbnail. On the grid (docs/grid.md): alone, at most 6 of 12
 * columns; one of two 6, of more 4; a thumbnail 3.
 */
function ImageItem({
  image,
  thumbnail,
  span,
  more,
  labels,
  onOpen,
}: {
  image: MediaImage
  thumbnail: boolean
  /** Of several in cards: the columns of 12 each spans. */
  span?: 4 | 6 | undefined
  /** On the last thumbnail: how many more there are. */
  more: number
  labels: MediaGalleryLabels
  onOpen: ((opener: HTMLButtonElement) => void) | undefined
}) {
  const shown = (thumbnail && image.thumbnail) || image.src
  const [failed, setFailed] = React.useState(false)
  // Without `width` and `height`, its size as it loads.
  const [natural, setNatural] = React.useState<{ w: number; h: number }>()
  // Drawn: its stand-in gone.
  const [loaded, setLoaded] = React.useState(false)
  // Tried again, and measured again, if it changes.
  const [source, setSource] = React.useState(shown)
  if (source !== shown) {
    setSource(shown)
    setFailed(false)
    setNatural(undefined)
    setLoaded(false)
  }
  const status = statusOf(image)
  const state = status === "done" && (failed || !shown) ? "error" : status
  const width = image.width ?? natural?.w
  const height = image.height ?? natural?.h
  const ratio = width && height ? width / height : image.aspectRatio
  // Its own shape, no taller than `imageHeight` (`tallHeight` for one
  // taller than wide, e.g. a phone's screenshot), no wider than its
  // place nor than it is; square till its shape is known.
  const shape = ratio
    ? {
        width: Math.min(
          width ?? Infinity,
          ratio * (ratio < 1 ? tallHeight : imageHeight)
        ),
        aspectRatio: String(ratio),
      }
    : { width: imageHeight, aspectRatio: "1" }

  let picture: React.ReactNode
  if (state !== "done")
    picture = (
      <Placeholder
        kind="image"
        state={state}
        item={image}
        name={image.alt}
        compact={thumbnail}
        labels={labels}
      />
    )
  else
    picture = (
      <img
        src={shown}
        alt={image.alt}
        {...(image.crossOrigin ? { crossOrigin: image.crossOrigin } : {})}
        // Its shape, if known, before it loads.
        {...(image.width && image.height
          ? { width: image.width, height: image.height }
          : {})}
        {...(image.srcSet
          ? {
              srcSet: image.srcSet,
              // As wide as it is shown.
              sizes: thumbnail
                ? "(min-width: 40rem) 7rem, 6rem"
                : `${Math.round(shape.width)}px`,
            }
          : {})}
        loading="lazy"
        decoding="async"
        onLoad={(event) => {
          const element = event.currentTarget
          const { naturalWidth: w, naturalHeight: h } = element
          if (w && h && !(image.width && image.height)) setNatural({ w, h })
          // Its stand-in under it till it is drawn.
          void element
            .decode()
            .catch(() => {})
            .then(() => setLoaded(true))
        }}
        onError={() => setFailed(true)}
        // A thumbnail filled; in a card, across its box, which has its
        // shape. No percentage height in a flex item: WebKit lays out
        // every flex box around one again at each layout, which makes a
        // long conversation's scrolling jank.
        className={
          thumbnail
            ? "absolute inset-0 size-full object-cover"
            : "relative block h-auto w-full"
        }
      />
    )
  if (onOpen && opens(image))
    picture = (
      <button
        type="button"
        data-slot="media-gallery-open"
        // The images not shown are named on the last one shown.
        aria-label={more > 0 ? `${image.alt}, ${labels.more(more)}` : undefined}
        onClick={(event) => onOpen(event.currentTarget)}
        className="absolute inset-0 block cursor-zoom-in outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
      >
        {picture}
        {more > 0 && (
          <span
            aria-hidden="true"
            // Dimmed and blurred: what is under it does not show
            // through the number.
            className="absolute inset-0 flex items-center justify-center bg-black/60 text-lg font-medium text-white backdrop-blur-sm"
          >
            +{more}
          </span>
        )}
      </button>
    )

  // Its thumbnail (unless it is the one shown) over its placeholder, till
  // it is drawn.
  const under =
    state === "done" && !loaded
      ? standIn(
          shown === image.thumbnail ? undefined : image.thumbnail,
          image.placeholder
        )
      : undefined

  if (thumbnail)
    return (
      <figure
        data-slot="media-gallery-item"
        data-kind="image"
        data-status={state}
        aria-busy={state === "pending" || undefined}
        className={cn(
          "relative m-0 aspect-square w-span-3 shrink-0 overflow-hidden rounded-lg",
          // Its hairline over the picture, so it frames it at every edge;
          // darker where a click opens it.
          "after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-1 after:ring-foreground/10 after:ring-inset has-[[data-slot=media-gallery-open]:hover]:after:ring-foreground/30"
        )}
      >
        <div
          data-slot="media-gallery-picture"
          style={under}
          className={cn("absolute inset-0", state === "done" && "bg-muted")}
        >
          {picture}
        </div>
      </figure>
    )

  const title = image.title ?? image.alt
  const description = [image.description, image.end].filter(
    (part) => part !== undefined && part !== null && part !== ""
  )
  return (
    <Attachment
      data-slot="media-gallery-item"
      data-kind="image"
      data-status={state}
      aria-busy={state === "pending" || undefined}
      // Alone, as wide as its picture with the card's padding and edge,
      // up to 6 columns; of several, its columns.
      style={span ? undefined : { width: `calc(${shape.width}px + 1.625rem)` }}
      className={cn(
        span === 6 ? "w-span-6" : span === 4 ? "w-span-4" : "max-w-span-6"
      )}
    >
      {/* At its own shape, across the card; in its middle where the
          card is wider, for its title and actions. */}
      <div className="flex min-w-0 basis-full justify-center">
        <div
          data-slot="media-gallery-picture"
          style={{
            width: shape.width,
            aspectRatio: shape.aspectRatio,
            ...under,
          }}
          className={cn(
            "relative max-w-full overflow-hidden rounded-lg",
            // Its hairline over the picture, so it frames it at every edge;
            // darker where a click opens it.
            "after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-1 after:ring-foreground/10 after:ring-inset has-[[data-slot=media-gallery-open]:hover]:after:ring-foreground/30",
            // Under an image as it loads, and beside one narrower than its
            // card; a placeholder has its own.
            state === "done" && "bg-muted"
          )}
        >
          {picture}
        </div>
      </div>
      <AttachmentContent>
        <AttachmentTitle data-slot="media-gallery-caption-title">
          <HugeiconsIcon
            icon={Image01Icon}
            strokeWidth={2}
            aria-hidden="true"
            className="me-1 inline-block size-3.5 align-middle"
          />
          {title}
        </AttachmentTitle>
        {description.length > 0 && (
          <AttachmentDescription
            data-slot="media-gallery-caption"
            className="tabular-nums"
          >
            {description.map((part, at) => (
              <React.Fragment key={at}>
                {at > 0 && " · "}
                {part}
              </React.Fragment>
            ))}
          </AttachmentDescription>
        )}
      </AttachmentContent>
      {state === "done" && shown && (
        <AttachmentActions data-slot="media-gallery-actions">
          {image.actions}
          <ImageActions
            src={image.src ?? shown}
            crossOrigin={image.crossOrigin}
            labels={labels}
          />
        </AttachmentActions>
      )}
    </Attachment>
  )
}

/**
 * A video or a recording of the gallery: `MediaViewer`'s controls (over a
 * video, under a recording) in a card that says what it is, with the
 * app's actions and its transcript. Its metadata loads once it is near
 * the viewport.
 */
function PlayerItem({
  item,
  labels,
}: {
  item: MediaVideo | MediaAudio
  labels: MediaGalleryLabels
}) {
  const { kind, src, title, description, duration, transcript, actions } = item
  const started = React.useContext(PlayingContext)
  const [loadFailed, setFailed] = React.useState(false)
  const [loaded, setLoaded] = React.useState<number>()
  // Tried again, and measured again, if it changes.
  const [source, setSource] = React.useState(src)
  if (source !== src) {
    setSource(src)
    setFailed(false)
    setLoaded(undefined)
  }
  const [card, setCard] = React.useState<HTMLDivElement | null>(null)
  const near = useNear(card)
  const length = clock(loaded ?? duration)
  const video = item.kind === "video" ? item : undefined
  const status = statusOf(item)
  const failed = status === "error" || (status === "done" && loadFailed)
  const state = failed ? "error" : status
  // Its shape: its size, the shape asked for, or a video's.
  const ratio =
    video?.width && video.height
      ? `${video.width} / ${video.height}`
      : String(video?.aspectRatio ?? 16 / 9)

  const { ref: mediaRef, media: controls } = useMedia<HTMLMediaElement>()
  const media = useMediaElement(
    mediaRef,
    item.mediaProps,
    mergeProps<"video">(controls.events, {
      src,
      preload: near ? "metadata" : "none",
      ...(item.crossOrigin ? { crossOrigin: item.crossOrigin } : {}),
      "aria-label": title,
      onPlay: (event) => started?.(event.currentTarget),
      onLoadedMetadata: (event) => setLoaded(event.currentTarget.duration),
      onError: () => setFailed(true),
    })
  )
  const frame = React.useRef<HTMLDivElement>(null)
  const fullScreen = useFullScreen(frame)

  return (
    <Attachment
      ref={setCard}
      data-slot="media-gallery-player"
      data-kind={kind}
      data-status={state}
      aria-busy={state === "pending" || undefined}
      // Its hairline as any card's: the failure is said by its icon and
      // its description, in greys. A video spans at most 9 of the
      // column's 12 columns, as a user's message; a recording 6, as an
      // image.
      className={cn("w-full", video ? "max-w-span-9" : "max-w-span-6")}
    >
      {video && (
        <div
          ref={frame}
          data-slot="media-gallery-player-frame"
          style={{ aspectRatio: ratio, maxHeight: videoHeight }}
          className={cn(
            "relative w-full basis-full overflow-hidden rounded-lg",
            state === "done" && "flex items-center justify-center bg-black"
          )}
        >
          {state !== "done" ? (
            <Placeholder
              kind="video"
              state={state}
              item={item}
              name={title}
              // Why it failed is under it, as a recording's.
              quiet
              labels={labels}
            />
          ) : (
            <video
              {...media}
              poster={video.poster}
              playsInline
              className="absolute inset-0 size-full object-contain"
              onClick={controls.actions.toggle}
            >
              {video.captions?.map((track) => (
                <track
                  key={track.src}
                  kind="captions"
                  src={track.src}
                  label={track.label}
                  srcLang={track.language}
                />
              ))}
            </video>
          )}
          {state === "done" && (
            <MediaBar
              media={controls}
              labels={labels}
              duration={duration}
              className="inset-x-2 bottom-2 h-9"
              onFullScreen={fullScreen}
            />
          )}
        </div>
      )}
      {!video && (
        <AttachmentMedia>
          <HugeiconsIcon icon={AudioWave01Icon} strokeWidth={2} />
        </AttachmentMedia>
      )}
      <AttachmentContent>
        <AttachmentTitle>
          {video && (
            <HugeiconsIcon
              icon={Video01Icon}
              strokeWidth={2}
              aria-hidden="true"
              className="me-1 inline-block size-3.5 align-middle"
            />
          )}
          {title}
        </AttachmentTitle>
        {(failed || description || length) && (
          <AttachmentDescription data-slot="media-gallery-player-description">
            {failed ? (
              <>
                <HugeiconsIcon
                  icon={AlertCircleIcon}
                  strokeWidth={2}
                  aria-hidden="true"
                  className="me-1 inline-block size-3.5 align-middle"
                />
                {labels.failed(kind)}
              </>
            ) : (
              <>
                {description}
                {description && length && " · "}
                {length && (
                  <span data-slot="media-gallery-player-duration">
                    {length}
                  </span>
                )}
              </>
            )}
          </AttachmentDescription>
        )}
      </AttachmentContent>
      {actions && (
        // A finger's place for each, a button or a link (a download is
        // often `<a download>`).
        <AttachmentActions className="[&>:is(a,button)]:relative [&>:is(a,button)]:pointer-coarse:after:absolute [&>:is(a,button)]:pointer-coarse:after:-inset-3">
          {actions}
        </AttachmentActions>
      )}
      {!video && (state === "pending" || state === "deferred") && (
        // Where its controls go.
        <div
          data-slot="media-gallery-player-frame"
          className="relative h-9 basis-full overflow-hidden rounded-lg"
        >
          <Placeholder
            kind="audio"
            state={state}
            item={item}
            name={title}
            labels={labels}
          />
        </div>
      )}
      {!video && state === "done" && (
        <>
          <audio {...media} />
          <MediaBar
            media={controls}
            labels={labels}
            duration={duration}
            variant="inline"
            role="group"
            aria-label={title}
            className="basis-full"
          />
        </>
      )}
      {transcript && (
        <Collapsible className="basis-full">
          <CollapsibleTrigger
            render={<Button variant="ghost" size="xs" className={touchLarge} />}
          >
            {labels.transcript}
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              strokeWidth={2}
              aria-hidden="true"
              className="transition-transform in-aria-expanded:rotate-180"
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1 max-h-60 overflow-auto text-sm whitespace-pre-wrap text-muted-foreground">
            {transcript}
          </CollapsibleContent>
        </Collapsible>
      )}
    </Attachment>
  )
}

/**
 * What stands in for an image till it has loaded, as its place's
 * background: its thumbnail over its placeholder, at its shape.
 */
function standIn(...layers: (string | undefined)[]) {
  const urls = layers.filter((url): url is string => !!url)
  return urls.length > 0
    ? {
        backgroundImage: urls
          .map((url) => `url(${JSON.stringify(url)})`)
          .join(", "),
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : undefined
}

/** An image that says so when it cannot load, in the viewer. */
function Picture({
  image,
  failed: failedLabel,
  className,
  style,
}: {
  image: MediaImage & { src: string }
  /** What it says when the image cannot be shown. */
  failed: string
  className?: string
  style?: React.CSSProperties | undefined
}) {
  const [failed, setFailed] = React.useState(false)
  const [loaded, setLoaded] = React.useState(false)
  if (failed)
    return (
      <span
        role="img"
        aria-label={image.alt}
        data-slot="media-gallery-failed"
        // A frame of a video's shape: the viewer does not shrink to a
        // strip.
        className={cn(
          failure,
          "aspect-video max-h-dvh-75 w-full text-sm [&>svg]:size-6"
        )}
      >
        <HugeiconsIcon
          icon={ImageNotFound01Icon}
          strokeWidth={2}
          aria-hidden="true"
        />
        <span aria-hidden="true">{failedLabel}</span>
      </span>
    )
  return (
    <img
      src={image.src}
      alt={image.alt}
      {...(image.crossOrigin ? { crossOrigin: image.crossOrigin } : {})}
      // Its shape, if known, before it loads.
      {...(image.width && image.height
        ? { width: image.width, height: image.height }
        : {})}
      decoding="async"
      onLoad={(event) => {
        void event.currentTarget
          .decode()
          .catch(() => {})
          .then(() => setLoaded(true))
      }}
      onError={() => setFailed(true)}
      className={className}
      // Its thumbnail over its placeholder till it is drawn.
      style={{
        ...style,
        ...(loaded ? {} : standIn(image.thumbnail, image.placeholder)),
      }}
    />
  )
}

/**
 * Media in a message: images, videos and recordings, in their order.
 *
 * - An image on its own is in a card as a video is, at its own shape no
 *   taller than 240px nor wider than 6 of 12 columns, its title and
 *   caption under it and its actions beside them: the app's, then
 *   copying it and opening it in a new tab. More are square thumbnails,
 *   3 columns each (`max` of them, the last saying how many more), or
 *   each in its card, 6 columns each of two, 4 of more
 *   (`layout="flow"`). Each opens a viewer of them all (copied and opened from there too), gone through with the
 *   arrow keys or its buttons, that returns to it on closing (or the
 *   app's `onOpen`).
 * - One being made (`status="pending"`, of the size asked for) is a
 *   placeholder of its shape saying so, and for how long; one `deferred`
 *   loads when the reader asks (its size on the button, the app's
 *   `onLoadRequest`); one that could not be made or cannot load says so.
 *   The rest load as they near the viewport.
 * - A video or a recording is a card with `MediaViewer`'s controls (over
 *   a video, under a recording), its title, the app's description, its
 *   length, actions and transcript; a video at its own shape no taller
 *   than 400px. One plays at a time, in a gallery or, in a
 *   `MediaGalleryProvider`, in a conversation.
 *
 * Give each its size, if known, so it takes its place before it loads and
 * nothing below moves.
 */
function MediaGallery({
  items,
  max = 6,
  layout = "grid",
  onOpen,
  labels: labelsProp,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  items: readonly MediaItem[]
  /** Thumbnails shown, in a grid; the rest are in the viewer. */
  max?: number
  /**
   * Several images: square thumbnails (`grid`), or each in its card at
   * its own shape (`flow`), e.g. those an image model made.
   */
  layout?: "grid" | "flow"
  /**
   * A click on an image, in place of the gallery's viewer: e.g. to open
   * it in a `MediaViewer` beside the conversation.
   */
  onOpen?: ((image: MediaImage, index: number) => void) | undefined
  labels?: Partial<MediaGalleryLabels>
}) {
  const labels = { ...defaultLabels, ...labelsProp }
  const outer = React.useContext(PlayingContext)
  const own = useOnePlaying()
  const images = items.filter(isImage)
  const viewed = images.filter(opens)
  const [index, setIndex] = React.useState<number | null>(null)
  const opener = React.useRef<HTMLButtonElement | null>(null)
  const viewer = React.useRef<HTMLDivElement | null>(null)
  const thumbnails = images.length > 1 && layout === "grid"
  const shown = thumbnails ? Math.max(1, max) : images.length
  const rest = images.length - shown
  const current = index === null ? undefined : viewed[index]
  const go = (step: number) =>
    setIndex((at) =>
      at === null ? at : (at + step + viewed.length) % viewed.length
    )

  // Consecutive images in a row each; a video or a recording on its own.
  const rows: (
    | { kind: "images"; items: { image: MediaImage; at: number }[] }
    | { kind: "player"; item: MediaVideo | MediaAudio; at: number }
  )[] = []
  let image = 0
  items.forEach((item, at) => {
    if (!isImage(item)) {
      rows.push({ kind: "player", item, at })
      return
    }
    if (image++ >= shown) return
    const last = rows.at(-1)
    if (last?.kind === "images") last.items.push({ image: item, at })
    else rows.push({ kind: "images", items: [{ image: item, at }] })
  })
  const key = (item: MediaItem, at: number) =>
    item.id ?? `${at}:${item.src ?? ""}`

  return (
    <PlayingContext value={outer ?? own}>
      <div
        data-slot="media-gallery"
        data-layout={thumbnails ? "grid" : "flow"}
        className={cn("flex min-w-0 flex-col gap-3", className)}
        {...props}
      >
        {rows.map((row) =>
          row.kind === "player" ? (
            <PlayerItem
              key={key(row.item, row.at)}
              item={row.item}
              labels={labels}
            />
          ) : (
            <div
              key={`images:${row.items[0]!.at}`}
              data-slot="media-gallery-images"
              // The grid's gutter: spans side by side fill the row.
              className="flex min-w-0 flex-wrap items-start gap-4"
            >
              {row.items.map(({ image, at }) => {
                const last = images.indexOf(image) === shown - 1 && rest > 0
                return (
                  <ImageItem
                    key={key(image, at)}
                    image={image}
                    thumbnail={thumbnails}
                    span={
                      thumbnails || row.items.length === 1
                        ? undefined
                        : row.items.length === 2
                          ? 6
                          : 4
                    }
                    more={last ? rest : 0}
                    labels={labels}
                    onOpen={(button) => {
                      const open = viewed.indexOf(image)
                      if (onOpen) return onOpen(image, images.indexOf(image))
                      opener.current = button
                      setIndex(open)
                    }}
                  />
                )
              })}
            </div>
          )
        )}
        {viewed.length > 0 && (
          <Dialog
            open={current !== undefined}
            onOpenChange={(open) => {
              if (!open) setIndex(null)
            }}
          >
            <DialogContent
              ref={viewer}
              closeLabel={labels.close}
              // The viewer itself, named by its image, not its first
              // button (whose tooltip Escape would close first); back to
              // the image it was opened from, also where a click does not
              // focus a button (Safari).
              initialFocus={viewer}
              finalFocus={opener}
              className="gap-3 sm:max-w-5xl"
              onKeyDown={(event) => {
                if (viewed.length < 2) return
                const rtl =
                  getComputedStyle(event.currentTarget).direction === "rtl"
                if (event.key === "ArrowLeft") go(rtl ? 1 : -1)
                else if (event.key === "ArrowRight") go(rtl ? -1 : 1)
                else return
                event.preventDefault()
              }}
            >
              {current?.src !== undefined && index !== null && (
                <>
                  {/* Its actions beside the close button, as tall and as
                      high; the row as high as it. */}
                  <div className="-mt-2 flex h-8 min-w-0 items-center gap-1 pe-8">
                    <DialogTitle className="min-w-0 flex-1 truncate text-sm font-normal text-muted-foreground">
                      {current.alt || labels.image}
                    </DialogTitle>
                    <ImageActions
                      src={current.src}
                      crossOrigin={current.crossOrigin}
                      size="icon"
                      labels={labels}
                    />
                  </div>
                  <div className="flex min-h-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                    <Picture
                      key={current.src}
                      image={{ ...current, src: current.src }}
                      failed={labels.failed("image")}
                      className="block h-auto max-h-dvh-75 w-auto max-w-full object-contain"
                      // Of a known size, as large as it is shown before
                      // it loads: the viewer does not jump when it does.
                      style={
                        current.width && current.height
                          ? {
                              width: `min(${current.width}px, 100%, 75vh * ${current.width / current.height})`,
                            }
                          : undefined
                      }
                    />
                  </div>
                  {viewed.length > 1 && (
                    <div className="flex items-center justify-between gap-2">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        // Its place for a finger as large as one.
                        className={touch}
                        aria-label={labels.previous}
                        onClick={() => go(-1)}
                      >
                        <HugeiconsIcon
                          icon={ArrowLeft01Icon}
                          strokeWidth={2}
                          className="rtl:rotate-180"
                        />
                      </Button>
                      <span
                        aria-live="polite"
                        className="text-muted-foreground tabular-nums"
                      >
                        {labels.position(index + 1, viewed.length)}
                      </span>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        className={touch}
                        aria-label={labels.next}
                        onClick={() => go(1)}
                      >
                        <HugeiconsIcon
                          icon={ArrowRight01Icon}
                          strokeWidth={2}
                          className="rtl:rotate-180"
                        />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </DialogContent>
          </Dialog>
        )}
      </div>
    </PlayingContext>
  )
}

export {
  MediaGallery,
  MediaGalleryAction,
  MediaGalleryProvider,
  type MediaAudio,
  type MediaGalleryLabels,
  type MediaImage,
  type MediaItem,
  type MediaVideo,
}
