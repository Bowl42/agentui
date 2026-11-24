"use client"

import * as React from "react"
import { cn } from "cn"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CancelCircleIcon,
  Copy01Icon,
  FullScreenIcon,
  Image01Icon,
  MusicNote01Icon,
  PauseIcon,
  PlayIcon,
  RepeatIcon,
  ArrowDown01Icon,
  SquareSplitHorizontalIcon,
  Tick02Icon,
  Video01Icon,
  VolumeHighIcon,
  VolumeMute02Icon,
} from "@hugeicons/core-free-icons"

import { mergeProps } from "@base-ui/react/merge-props"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Slider } from "@/components/ui/slider"
import { CopyButton, type CopyData } from "@/components/copy-button"
import { useFullScreen } from "@/lib/full-screen"
import {
  ImageComparison,
  type ImageComparisonLabels,
} from "@/components/image-comparison"
import {
  ImageEditor,
  checkerboard,
  markImages,
  type ImageEditorLabels,
  type ImageMark,
  type ImageSize,
} from "@/components/image-editor"
import {
  ViewerFrame,
  ViewerFrameTitlebar,
  ViewerStatusButton,
  ViewerTool,
  ViewerUnsupported,
  ViewerZoom,
  formatDuration,
  nextZoom,
  viewerTool,
  viewerToolLook,
  type ViewerFrameProps,
  type ViewerLabels,
} from "@/components/viewer"

type MediaViewerLabels = {
  play: string
  pause: string
  mute: string
  unmute: string
  fullScreen: string
  /** The seek bar's name. */
  seek: string
  /** Where it is: "0:12 of 0:48". */
  position: (current: string, duration: string) => string
  /** The speed's button: "Speed 1×". */
  speed: (rate: number) => string
  loop: string
  copyTranscript: string
  copied: string
  /** When the clipboard refuses, or the page has none (plain http). */
  copyFailed: string
  transcript: string
  /** What is said when it cannot be shown or played. */
  failed: (kind: MediaKind) => string
  /** An image's button to compare the version shown with the original. */
  compare: string
  /** The strip of an image's versions: its name. */
  versions: string
  /** The first of an image's versions. */
  original: string
  /** A later version, from 1: "Version 2". */
  version: (version: number) => string
  previousImage: string
  nextImage: string
  copyImage: string
  /** The facts while comparing: "Before 12:01", "After 12:04". */
  before: (when: string) => string
  after: (when: string) => string
  /** Comparing two versions of an image: its line's and labels' words. */
  comparison: Partial<ImageComparisonLabels>
  /** Marking an image: its tools' words. */
  editor: Partial<ImageEditorLabels>
}

/** What a media viewer shows. */
type MediaKind = "image" | "video" | "audio"

const defaultLabels: MediaViewerLabels = {
  play: "Play",
  pause: "Pause",
  mute: "Mute",
  unmute: "Unmute",
  fullScreen: "Full screen",
  seek: "Seek",
  position: (current, duration) => `${current} of ${duration}`,
  speed: (rate) => `Speed ${rate}×`,
  loop: "Loop",
  copyTranscript: "Copy transcript",
  copied: "Copied",
  copyFailed: "Could not copy",
  transcript: "Transcript",
  failed: (kind) =>
    kind === "image"
      ? "This image cannot be shown"
      : kind === "video"
        ? "This video cannot be played"
        : "This recording cannot be played",
  compare: "Compare with the original",
  versions: "Versions",
  original: "Original",
  version: (version) => `Version ${version}`,
  previousImage: "Previous image",
  nextImage: "Next image",
  copyImage: "Copy image",
  before: (when) => `Before ${when}`,
  after: (when) => `After ${when}`,
  comparison: {},
  editor: {},
}

const rates = [1, 1.25, 1.5, 2, 0.5, 0.75]

/** A line of a transcript: when it starts, in seconds, and what is said. */
type TranscriptCue = { start: number; text: string }

/** How a medium is fetched: "use-credentials" sends the app's cookies. */
type MediaCrossOrigin = "anonymous" | "use-credentials"

/** What every media viewer takes: the viewer's frame, and its words. */
type MediaViewerFrameProps = Omit<ViewerFrameProps, "labels"> & {
  labels?: Partial<MediaViewerLabels & ViewerLabels> | undefined
}

/** An earlier version of an image, e.g. before an edit. */
type MediaViewerImageVersion = {
  src: string
  /** What it shows, for those who do not see it. */
  alt: string
  /** Its name in the strip; by default "Original", then "Version 1"… */
  label?: string | undefined
  /** When it was, e.g. "12:01". */
  when?: string | undefined
  /** A smaller copy for its thumbnail. */
  thumbnail?: string | undefined
  /** Marks to show on it while not marking, e.g. those sent from it. */
  marks?: readonly ImageMark[] | undefined
  /** A mask of what changed in it, as the image's `highlight`. */
  highlight?: string | undefined
}

/**
 * An image: fitted or zoomed, among its versions (any shown, compared
 * with the original), among the app's images (back and forth), its areas
 * marked for the app.
 */
type MediaViewerImage = {
  kind: "image"
  src: string
  /** What it shows, for those who do not see it. */
  alt: string
  crossOrigin?: MediaCrossOrigin | undefined
  /**
   * Its size in pixels, if known before it loads: fitted, zoomed and
   * said in its facts before it has.
   */
  width?: number | undefined
  height?: number | undefined
  /**
   * Its stand-in till it has loaded, at its size (with `width` and
   * `height`), under its `thumbnail` as that loads: e.g. its ThumbHash
   * drawn small, as a data URL.
   */
  placeholder?: string | undefined
  /**
   * Its earlier versions, oldest first, the first the original; this one
   * is the latest. With them a strip under it of all its versions picks
   * the one shown, and a button compares that with the original.
   */
  versions?: readonly MediaViewerImageVersion[] | undefined
  /** This version's name in the strip; by default "Version" and its number. */
  label?: string | undefined
  /** When this version was, e.g. "12:04". */
  when?: string | undefined
  /** A smaller copy of this version for its thumbnail. */
  thumbnail?: string | undefined
  /** The version shown, from 0, the original; by default the latest. */
  version?: number | undefined
  onVersionChange?: ((version: number) => void) | undefined
  /** Comparing the version shown with the original: the viewer's own, or the app's. */
  comparing?: boolean | undefined
  onComparingChange?: ((comparing: boolean) => void) | undefined
  /**
   * Whether it has transparent parts, drawn on a checkerboard; by default
   * found as it loads (an image of another origin without CORS has one).
   */
  transparent?: boolean | undefined
  /**
   * Takes the reader's marks of areas of the version shown, by the button
   * beside them, e.g. to ask a model to change them (`markImages` makes
   * the mask); `version` says which, from 0, the original. With it (or
   * the shown version's `marks` or `highlight`), its marking tools are in
   * the toolbar, on any version but while comparing. While it runs the
   * button waits; if it throws, its message shows. Done, the marks are
   * cleared.
   */
  onMark?:
    | ((
        marks: ImageMark[],
        size: ImageSize,
        version: number
      ) => Promise<void> | void)
    | undefined
  /** The mark button's icon, the app's (`ImageEditor`'s `markIcon`). */
  markIcon?: React.ReactNode
  /** This version's marks to show while not marking, e.g. those sent. */
  marks?: readonly ImageMark[] | undefined
  /**
   * A mask of what changed in this version, as `markImages` makes
   * (transparent where it did): the rest dims, then clears, as it is
   * shown. Its URL must be the page's to use, e.g. a blob's.
   */
  highlight?: string | undefined
}

/** A video: on black, its controls over it. */
type MediaViewerVideo = {
  kind: "video"
  src: string
  /** Its picture before it plays. */
  poster?: string | undefined
  /** Captions as WebVTT. */
  captions?: readonly { src: string; label: string; language: string }[]
  crossOrigin?: MediaCrossOrigin | undefined
  /** The app's props for the `<video>`: its `ref`, its events. */
  mediaProps?: MediaElementProps | undefined
}

/** A recording: its waveform and transcript. */
type MediaViewerAudio = {
  kind: "audio"
  src: string
  crossOrigin?: MediaCrossOrigin | undefined
  /** The app's props for the `<audio>`: its `ref`, its events. */
  mediaProps?: MediaElementProps | undefined
  /** Its title over the waveform; by default its `name`. */
  title?: React.ReactNode
  /** Under its title: who or what made it, when. */
  description?: React.ReactNode
  /** Its loudness over time, each from 0 to 1: a bar each. */
  peaks?: readonly number[] | undefined
  transcript?: readonly TranscriptCue[]
  /** Copies the transcript; by default as lines of text to the clipboard. */
  onCopyTranscript?: ((text: string) => void) | undefined
}

type MediaViewerProps = MediaViewerFrameProps &
  (MediaViewerImage | MediaViewerVideo | MediaViewerAudio)

/**
 * Whether a touch began on a control inside `stage` (a side button, a
 * badge, a toolbar's or an overlay's button, a slider): its own, a tap
 * a click and never a gesture of the stage's.
 */
function onControl(stage: Element, event: TouchEvent) {
  const control =
    event.target instanceof Element
      ? event.target.closest(
          "button, a[href], input, select, textarea, label, [role=button], [role=slider], [role=link], [role=menuitem], [role=tab], [contenteditable=true]"
        )
      : null
  return control !== null && control !== stage && stage.contains(control)
}

/** A media element's state, and what changes it. */
function useMedia<Element extends HTMLMediaElement>() {
  const ref = React.useRef<Element>(null)
  const [state, setState] = React.useState({
    playing: false,
    current: 0,
    duration: Number.NaN,
    muted: false,
    rate: 1,
    loop: false,
    failed: false,
    width: 0,
    height: 0,
  })
  const read = (element: HTMLMediaElement, failed = false) =>
    setState({
      playing: !element.paused && !element.ended,
      current: element.currentTime,
      duration: element.duration,
      muted: element.muted,
      rate: element.playbackRate,
      loop: element.loop,
      failed,
      width: element instanceof HTMLVideoElement ? element.videoWidth : 0,
      height: element instanceof HTMLVideoElement ? element.videoHeight : 0,
    })
  const events = {
    onPlay: (event: React.SyntheticEvent<HTMLMediaElement>) =>
      read(event.currentTarget),
    onPause: (event: React.SyntheticEvent<HTMLMediaElement>) =>
      read(event.currentTarget),
    onEnded: (event: React.SyntheticEvent<HTMLMediaElement>) =>
      read(event.currentTarget),
    onTimeUpdate: (event: React.SyntheticEvent<HTMLMediaElement>) =>
      read(event.currentTarget),
    onSeeked: (event: React.SyntheticEvent<HTMLMediaElement>) =>
      read(event.currentTarget),
    onLoadedMetadata: (event: React.SyntheticEvent<HTMLMediaElement>) =>
      read(event.currentTarget),
    onDurationChange: (event: React.SyntheticEvent<HTMLMediaElement>) =>
      read(event.currentTarget),
    onVolumeChange: (event: React.SyntheticEvent<HTMLMediaElement>) =>
      read(event.currentTarget),
    onRateChange: (event: React.SyntheticEvent<HTMLMediaElement>) =>
      read(event.currentTarget),
    onError: (event: React.SyntheticEvent<HTMLMediaElement>) =>
      read(event.currentTarget, true),
  }
  const element = () => ref.current
  const actions = {
    toggle: () => {
      const media = element()
      if (!media) return
      if (media.paused || media.ended) void media.play().catch(() => {})
      else media.pause()
    },
    seek: (seconds: number) => {
      const media = element()
      if (!media) return
      const end = Number.isFinite(media.duration) ? media.duration : seconds
      media.currentTime = Math.min(end, Math.max(0, seconds))
      read(media)
    },
    mute: () => {
      const media = element()
      if (media) media.muted = !media.muted
    },
    nextRate: () => {
      const media = element()
      if (!media) return
      media.playbackRate =
        rates[(rates.indexOf(media.playbackRate) + 1) % rates.length] ?? 1
    },
    loop: () => {
      const media = element()
      if (!media) return
      media.loop = !media.loop
      read(media)
    },
  }
  return { ref, media: { state, events, actions } }
}

type Media = ReturnType<typeof useMedia>["media"]

/**
 * The app's props for the `<video>` or `<audio>`, as `MediaViewer`'s and
 * `MediaGallery`'s `mediaProps`: its `ref` to control it (e.g. go to a time), its events
 * (e.g. `onLoadedMetadata`). Its source and controls are the viewer's.
 */
type MediaElementProps = Omit<
  React.MediaHTMLAttributes<HTMLMediaElement>,
  "src" | "controls" | "children"
> & { ref?: React.Ref<HTMLMediaElement> | undefined }

/**
 * Gives a ref its element: a callback (its cleanup, if it returns one,
 * what undoes it), or an object's `current`. Returns how to undo it.
 */
function assign<T>(ref: React.Ref<T> | undefined, node: T): () => void {
  if (typeof ref === "function") {
    const cleanup = ref(node)
    return typeof cleanup === "function" ? cleanup : () => ref(null)
  }
  if (ref) {
    ref.current = node
    return () => {
      ref.current = null
    }
  }
  return () => {}
}

/**
 * The element's props: the app's `mediaProps` and the viewer's own, its
 * events called both, its ref given to both.
 */
function useMediaElement(
  ref: React.RefObject<HTMLMediaElement | null>,
  mediaProps: MediaElementProps | undefined,
  own: React.ComponentProps<"video">
) {
  const { ref: appRef, ...appProps } = mediaProps ?? {}
  const setRef = React.useCallback(
    (node: HTMLMediaElement | null) => {
      // React 19 calls it with null only for a ref that returns no cleanup.
      if (!node) return
      const undo = [assign(ref, node), assign(appRef, node)]
      return () => undo.forEach((fn) => fn())
    },
    [ref, appRef]
  )
  return {
    ...mergeProps<"video">(appProps as React.ComponentProps<"video">, own),
    ref: setRef,
  }
}

/** Space plays and pauses, the arrows go 5 seconds back or on. */
function mediaKeys(event: React.KeyboardEvent, media: Media) {
  if (event.target !== event.currentTarget) return
  if (event.altKey || event.ctrlKey || event.metaKey) return
  const { current } = media.state
  if (event.key === " " || event.key === "k") media.actions.toggle()
  else if (event.key === "ArrowLeft") media.actions.seek(current - 5)
  else if (event.key === "ArrowRight") media.actions.seek(current + 5)
  else return
  event.preventDefault()
}

/** The words of `MediaBar`. */
type MediaBarLabels = Pick<
  MediaViewerLabels,
  "play" | "pause" | "mute" | "unmute" | "fullScreen" | "seek"
>

/** The frame at a time of the seek bar, over it. */
function SeekPreview({
  src,
  crossOrigin,
  time,
}: {
  src: string
  crossOrigin?: "anonymous" | "use-credentials" | undefined
  time: number
}) {
  const preview = React.useRef<HTMLVideoElement>(null)
  React.useEffect(() => {
    if (preview.current) preview.current.currentTime = time
  }, [time])
  return (
    <>
      <video
        ref={preview}
        src={src}
        crossOrigin={crossOrigin}
        muted
        preload="metadata"
        playsInline
        tabIndex={-1}
        className="aspect-video w-full object-cover"
      />
      <span className="block text-center leading-4">
        {formatDuration(time)}
      </span>
    </>
  )
}

/**
 * Play, where it is, a seek bar, sound and full screen, in a row: over a
 * video in any theme (`overlay`, the dark theme's colours on black), or
 * under a recording (`inline`, a round play button first).
 */
function MediaBar({
  media,
  labels,
  duration: durationProp,
  variant = "overlay",
  onFullScreen,
  preview,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  media: Media
  labels: MediaBarLabels
  /** Its length, if known before it loads. */
  duration?: number | undefined
  variant?: "overlay" | "inline"
  onFullScreen?: (() => void) | undefined
  /** What is shown over the seek bar where the pointer is: a frame. */
  preview?: ((fraction: number) => React.ReactNode) | undefined
}) {
  const { state, actions } = media
  const seekId = React.useId()
  // Where the pointer is over the seek bar, a fraction.
  const [hover, setHover] = React.useState<number>()
  const duration = Number.isFinite(state.duration)
    ? state.duration
    : (durationProp ?? 0)
  const overlay = variant === "overlay"
  return (
    <div
      data-slot="media-bar"
      data-variant={variant}
      className={cn(
        "flex items-center gap-1 text-2xs tabular-nums",
        overlay
          ? // Over the picture in any theme: the dark one's colours, a
            // light hairline round it, seen on black too.
            "dark absolute inset-x-3 bottom-3 h-10 rounded-xl bg-black/70 px-2 text-foreground ring-1 ring-white/10 backdrop-blur-md"
          : "h-9 text-muted-foreground",
        className
      )}
      {...props}
    >
      <Button
        variant={overlay ? "ghost" : "default"}
        size="icon-sm"
        aria-label={state.playing ? labels.pause : labels.play}
        className={cn(!overlay && "me-1 rounded-full")}
        onClick={actions.toggle}
      >
        {state.playing ? (
          <HugeiconsIcon icon={PauseIcon} strokeWidth={2} />
        ) : (
          <HugeiconsIcon icon={PlayIcon} strokeWidth={2} />
        )}
      </Button>
      <span>{formatDuration(state.current)}</span>
      <div
        className="relative mx-2 flex flex-1 items-center"
        onPointerMove={(event) => {
          if (!preview) return
          const box = event.currentTarget.getBoundingClientRect()
          setHover(
            Math.min(1, Math.max(0, (event.clientX - box.left) / box.width))
          )
        }}
        onPointerLeave={() => setHover(undefined)}
      >
        <span id={seekId} className="sr-only">
          {labels.seek}
        </span>
        <Slider
          aria-labelledby={seekId}
          min={0}
          max={duration || 1}
          step={0.1}
          value={[state.current]}
          onValueChange={(value) =>
            actions.seek(Array.isArray(value) ? value[0]! : value)
          }
        />
        {preview && hover !== undefined && duration > 0 && (
          <span
            aria-hidden="true"
            data-slot="media-bar-preview"
            className="pointer-events-none absolute bottom-4 w-24 -translate-x-1/2 overflow-hidden rounded-md bg-black ring-1 ring-white/15"
            style={{ left: `${hover * 100}%` }}
          >
            {preview(hover)}
          </span>
        )}
      </div>
      <span>{formatDuration(duration)}</span>
      <ViewerTool
        label={state.muted ? labels.unmute : labels.mute}
        onClick={actions.mute}
      >
        {state.muted ? (
          <HugeiconsIcon icon={VolumeMute02Icon} strokeWidth={2} />
        ) : (
          <HugeiconsIcon icon={VolumeHighIcon} strokeWidth={2} />
        )}
      </ViewerTool>
      {onFullScreen && (
        <ViewerTool label={labels.fullScreen} onClick={onFullScreen}>
          <HugeiconsIcon icon={FullScreenIcon} strokeWidth={2} />
        </ViewerTool>
      )}
    </div>
  )
}

/** Speed and loop, at the start of the status bar. */
function MediaControls({
  media,
  labels,
  children,
}: {
  media: Media
  labels: MediaViewerLabels
  children?: React.ReactNode
}) {
  return (
    <>
      <ViewerStatusButton
        aria-label={labels.speed(media.state.rate)}
        onClick={media.actions.nextRate}
        className="min-w-8 tabular-nums"
      >
        {`${media.state.rate}×`}
      </ViewerStatusButton>
      <ViewerTool
        label={labels.loop}
        pressed={media.state.loop}
        onClick={media.actions.loop}
      >
        <HugeiconsIcon icon={RepeatIcon} strokeWidth={2} />
      </ViewerTool>
      {children}
    </>
  )
}

/**
 * A video to watch: on black, its controls over it (play, where it is,
 * a seek bar that shows the frame under the pointer, sound, full screen),
 * speed and loop below with its size and length. Space plays and pauses;
 * the arrows go 5 seconds back or on.
 */
function VideoView({
  kind,
  src,
  poster,
  captions = [],
  crossOrigin,
  mediaProps,
  details = [],
  labels: labelsProp,
  icon = <HugeiconsIcon icon={Video01Icon} strokeWidth={2} />,
  ...frame
}: MediaViewerFrameProps & MediaViewerVideo) {
  const labels = { ...defaultLabels, ...labelsProp }
  const { ref: mediaRef, media } = useMedia<HTMLVideoElement>()
  const { state, actions } = media
  const stage = React.useRef<HTMLDivElement>(null)
  const fullScreen = useFullScreen(stage)
  const duration = Number.isFinite(state.duration) ? state.duration : 0
  const element = useMediaElement(mediaRef, mediaProps, {
    src,
    poster,
    crossOrigin,
    preload: "metadata",
    playsInline: true,
    className: "size-full object-contain",
    onClick: actions.toggle,
    ...media.events,
  })

  return (
    <ViewerFrame
      data-viewer={kind}
      icon={icon}
      labels={labelsProp}
      controls={
        !state.failed && <MediaControls media={media} labels={labels} />
      }
      facts={[
        state.width ? `${state.width} × ${state.height}` : undefined,
        duration ? formatDuration(duration) : undefined,
        ...details,
      ]}
      {...frame}
    >
      {state.failed ? (
        <ViewerUnsupported
          icon={<HugeiconsIcon icon={Video01Icon} strokeWidth={2} />}
          title={labels.failed("video")}
          description={frame.name}
        />
      ) : (
        <div
          ref={stage}
          role="group"
          aria-label={frame.name}
          tabIndex={0}
          data-slot="media-viewer-stage"
          className="relative grid min-h-0 flex-1 place-items-center bg-black outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
          onKeyDown={(event) => mediaKeys(event, media)}
        >
          <video {...element}>
            {captions.map((track) => (
              <track
                key={track.src}
                kind="captions"
                src={track.src}
                label={track.label}
                srcLang={track.language}
              />
            ))}
          </video>
          <MediaBar
            media={media}
            labels={labels}
            onFullScreen={fullScreen}
            preview={(fraction) => (
              <SeekPreview
                src={src}
                crossOrigin={crossOrigin}
                time={fraction * duration}
              />
            )}
          />
        </div>
      )}
    </ViewerFrame>
  )
}

/**
 * A recording to listen to: its title, a waveform to seek on (the app's
 * peaks), and its transcript line by line, the one being said lit, each
 * going there; speed, loop and copying the transcript below.
 */
function AudioView({
  kind,
  src,
  title,
  description,
  peaks,
  transcript = [],
  onCopyTranscript,
  crossOrigin,
  mediaProps,
  details = [],
  labels: labelsProp,
  icon = <HugeiconsIcon icon={MusicNote01Icon} strokeWidth={2} />,
  ...frame
}: MediaViewerFrameProps & MediaViewerAudio) {
  const labels = { ...defaultLabels, ...labelsProp }
  const { ref: mediaRef, media } = useMedia<HTMLAudioElement>()
  const { state, actions } = media
  const duration = Number.isFinite(state.duration) ? state.duration : 0
  const progress = duration ? state.current / duration : 0
  const now = transcript.findLastIndex((cue) => cue.start <= state.current)
  const [copied, setCopied] = React.useState<boolean | null>(null)
  React.useEffect(() => {
    if (copied === null) return
    const timer = setTimeout(() => setCopied(null), 1500)
    return () => clearTimeout(timer)
  }, [copied])
  const text = transcript
    .map((cue) => `${formatDuration(cue.start)} ${cue.text}`)
    .join("\n")

  const follow = (event: React.PointerEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const fraction = Math.min(
      1,
      Math.max(0, (event.clientX - box.left) / box.width)
    )
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl"
    actions.seek((rtl ? 1 - fraction : fraction) * duration)
  }
  const element = useMediaElement(mediaRef, mediaProps, {
    src,
    crossOrigin,
    preload: "metadata",
    ...media.events,
  })

  return (
    <ViewerFrame
      data-viewer={kind}
      icon={icon}
      labels={labelsProp}
      controls={
        !state.failed && (
          <MediaControls media={media} labels={labels}>
            {transcript.length > 0 && (
              <ViewerStatusButton
                onClick={() => {
                  if (onCopyTranscript) {
                    onCopyTranscript(text)
                    setCopied(true)
                    return
                  }
                  // Copied only when it was: a page without a clipboard
                  // (not a secure context) fails as a refusal does.
                  Promise.resolve()
                    .then(() => navigator.clipboard.writeText(text))
                    .then(
                      () => setCopied(true),
                      () => setCopied(false)
                    )
                }}
              >
                {copied ? (
                  <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} />
                ) : copied === false ? (
                  <HugeiconsIcon
                    icon={CancelCircleIcon}
                    strokeWidth={2}
                    className="text-destructive"
                  />
                ) : (
                  <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
                )}
                {copied
                  ? labels.copied
                  : copied === false
                    ? labels.copyFailed
                    : labels.copyTranscript}
              </ViewerStatusButton>
            )}
          </MediaControls>
        )
      }
      facts={[duration ? formatDuration(duration) : undefined, ...details]}
      {...frame}
    >
      <audio {...element} />
      {state.failed ? (
        <ViewerUnsupported
          icon={<HugeiconsIcon icon={MusicNote01Icon} strokeWidth={2} />}
          title={labels.failed("audio")}
          description={frame.name}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-3 px-6 pt-6 pb-4">
            <Button
              size="icon-lg"
              aria-label={state.playing ? labels.pause : labels.play}
              className="size-11 rounded-full [&_svg:not([class*='size-'])]:size-5"
              onClick={actions.toggle}
            >
              {state.playing ? (
                <HugeiconsIcon icon={PauseIcon} strokeWidth={2} />
              ) : (
                <HugeiconsIcon icon={PlayIcon} strokeWidth={2} />
              )}
            </Button>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                {title ?? frame.name}
              </div>
              {description && (
                <div className="truncate text-xs text-muted-foreground">
                  {description}
                </div>
              )}
            </div>
          </div>
          <div
            role="slider"
            tabIndex={0}
            aria-label={labels.seek}
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(state.current)}
            aria-valuetext={labels.position(
              formatDuration(state.current),
              formatDuration(duration)
            )}
            data-slot="media-viewer-waveform"
            className="mx-6 flex h-14 cursor-pointer touch-none items-center gap-0.5 rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            onPointerDown={(event) => {
              if (event.button !== 0) return
              try {
                event.currentTarget.setPointerCapture(event.pointerId)
              } catch {
                // Not a pointer of the browser's.
              }
              follow(event)
            }}
            onPointerMove={(event) => {
              if (event.buttons !== 0) follow(event)
            }}
            onKeyDown={(event) => {
              const next =
                event.key === "ArrowLeft" || event.key === "ArrowDown"
                  ? state.current - 5
                  : event.key === "ArrowRight" || event.key === "ArrowUp"
                    ? state.current + 5
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? duration
                        : undefined
              if (next !== undefined) {
                event.preventDefault()
                actions.seek(next)
              } else mediaKeys(event, media)
            }}
          >
            {peaks && peaks.length > 0 ? (
              peaks.map((peak, index) => (
                <i
                  key={index}
                  aria-hidden="true"
                  data-played={
                    (index + 0.5) / peaks.length <= progress || undefined
                  }
                  // grid: mark (a bar of the wave)
                  className="min-h-0.75 flex-1 rounded-xs bg-border data-played:bg-foreground"
                  style={{ height: `${Math.max(0, Math.min(1, peak)) * 100}%` }}
                />
              ))
            ) : (
              <span
                aria-hidden="true"
                className="relative h-1 flex-1 overflow-hidden rounded-full bg-border"
              >
                <span
                  className="absolute inset-y-0 start-0 bg-foreground"
                  style={{ width: `${progress * 100}%` }}
                />
              </span>
            )}
          </div>
          <div
            aria-hidden="true"
            className="flex justify-between border-b px-6 pt-1 pb-4 text-2xs text-muted-foreground tabular-nums"
          >
            <span>{formatDuration(state.current)}</span>
            <span>{formatDuration(duration)}</span>
          </div>
          {transcript.length > 0 && (
            <ol
              aria-label={labels.transcript}
              data-slot="media-viewer-transcript"
              className="min-h-0 flex-1 overflow-y-auto p-2"
            >
              {transcript.map((cue, index) => (
                <li key={index}>
                  <button
                    type="button"
                    aria-current={index === now ? "time" : undefined}
                    className={cn(
                      "flex w-full gap-3 rounded-lg px-3 py-2 text-start text-2sm leading-5 text-muted-foreground outline-none hover:bg-muted/50 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                      "aria-[current]:bg-muted aria-[current]:text-foreground",
                      // Its time fainter than its words; on a grey row (the
                      // one said, or hovered) a step darker, to read.
                      "hover:[&>[data-slot=media-viewer-cue-time]]:text-muted-foreground aria-[current]:[&>[data-slot=media-viewer-cue-time]]:text-muted-foreground"
                    )}
                    onClick={() => actions.seek(cue.start)}
                  >
                    <span
                      data-slot="media-viewer-cue-time"
                      className="w-9 shrink-0 font-mono text-2xs leading-5 text-subtle-foreground"
                    >
                      {formatDuration(cue.start)}
                    </span>
                    <span>{cue.text}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </ViewerFrame>
  )
}

/** The image's place: the box it is drawn in, fitted or zoomed. */
function useSize(node: HTMLElement | null) {
  const [size, setSize] = React.useState({ width: 0, height: 0 })
  React.useLayoutEffect(() => {
    if (!node) return
    const measure = () => {
      if (node.getClientRects().length === 0) return
      setSize({ width: node.clientWidth, height: node.clientHeight })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [node])
  return size
}

/**
 * What stands in for an image till it has loaded, as its background: its
 * thumbnail over its placeholder.
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
    : {}
}

/**
 * A point of an image under the fingers: from 0 to 1 across it, and
 * where they are; a double tap's, kept once.
 */
type Pinned = { u: number; v: number; x: number; y: number; once?: boolean }

/** Scrolls its place so that the point is under the fingers again. */
function keepUnder(
  place: HTMLElement | null,
  image: HTMLImageElement | null,
  at: Pinned | null
) {
  if (!at || !place || !image) return
  const rect = image.getBoundingClientRect()
  place.scrollLeft += rect.left + at.u * rect.width - at.x
  place.scrollTop += rect.top + at.v * rect.height - at.y
}

// As far as a pinch zooms: the viewer's least and most.
const minZoom = 0.1
const maxZoom = 8

/**
 * Whether an image has transparent parts, by its pixels drawn small;
 * undefined where they cannot be read (another origin without CORS).
 */
function hasTransparency(image: HTMLImageElement) {
  try {
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 32
    const context = canvas.getContext("2d", { willReadFrequently: true })
    if (!context) return undefined
    context.drawImage(image, 0, 0, 32, 32)
    const { data } = context.getImageData(0, 0, 32, 32)
    for (let index = 3; index < data.length; index += 4)
      if (data[index]! < 255) return true
    return false
  } catch {
    return undefined
  }
}

/** An image as a PNG, for the clipboard, which takes no other kind. */
async function png(src: string, crossOrigin: MediaCrossOrigin | undefined) {
  const response = await fetch(
    src,
    crossOrigin === "use-credentials" ? { credentials: "include" } : {}
  )
  if (!response.ok) throw new Error(`${src}: ${response.status}`)
  const blob = await response.blob()
  if (blob.type === "image/png") return blob
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement("canvas")
    // An SVG without a size: a replaced element's default.
    canvas.width = image.naturalWidth || 300
    canvas.height = image.naturalHeight || 150
    canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (drawn) => (drawn ? resolve(drawn) : reject(new Error(src))),
        "image/png"
      )
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** An image to copy, the same object while it is the same image. */
function useImageCopy(src: string, crossOrigin: MediaCrossOrigin | undefined) {
  return React.useMemo<CopyData>(
    () => ({ type: "image/png", data: () => png(src, crossOrigin) }),
    [src, crossOrigin]
  )
}

/**
 * An image's versions in a row, a thumbnail and its name each; the one
 * shown chosen, as a radio, the arrow keys moving between them.
 */
function ImageVersions({
  versions,
  shown,
  onShownChange,
  label,
}: {
  versions: readonly (MediaViewerImageVersion & { label: string })[]
  shown: number
  onShownChange: (version: number) => void
  label: string
}) {
  const row = React.useRef<HTMLDivElement>(null)
  const go = (version: number) => {
    const next = (version + versions.length) % versions.length
    onShownChange(next)
    row.current?.querySelectorAll<HTMLElement>("[role=radio]")[next]?.focus()
  }
  return (
    <div
      ref={row}
      role="radiogroup"
      aria-label={label}
      data-slot="media-viewer-versions"
      className="flex shrink-0 scrollbar-thin gap-3 overflow-x-auto border-t px-3 py-3"
    >
      {versions.map((version, index) => (
        <button
          key={index}
          type="button"
          role="radio"
          aria-checked={index === shown}
          tabIndex={index === shown ? 0 : -1}
          data-slot="media-viewer-version"
          className="group/version flex w-14 shrink-0 cursor-pointer flex-col items-center gap-1 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          onClick={() => onShownChange(index)}
          onKeyDown={(event) => {
            // Later to the right in a left-to-right page, and down.
            const rtl =
              getComputedStyle(event.currentTarget).direction === "rtl"
            const step =
              event.key === "ArrowDown" ||
              event.key === (rtl ? "ArrowLeft" : "ArrowRight")
                ? 1
                : event.key === "ArrowUp" ||
                    event.key === (rtl ? "ArrowRight" : "ArrowLeft")
                  ? -1
                  : 0
            if (!step) return
            event.preventDefault()
            go(index + step)
          }}
        >
          <img
            src={version.thumbnail ?? version.src}
            alt=""
            draggable={false}
            className={cn(
              "size-12 rounded-md object-cover ring-1 ring-border transition-shadow",
              "group-aria-checked/version:ring-2 group-aria-checked/version:ring-foreground"
            )}
          />
          <span className="max-w-full truncate text-xs text-muted-foreground group-hover/version:text-foreground group-aria-checked/version:font-medium group-aria-checked/version:text-foreground">
            {version.label}
          </span>
        </button>
      ))}
    </div>
  )
}

/**
 * An image's versions in a titlebar's row: the one shown, in words, a
 * menu of them all (a thumbnail and its name each) picking another.
 */
function ImageVersionsMenu({
  versions,
  shown,
  onShownChange,
  label,
}: {
  versions: readonly (MediaViewerImageVersion & { label: string })[]
  shown: number
  onShownChange: (version: number) => void
  label: string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            aria-label={`${label}, ${versions[shown]!.label}`}
            data-slot="media-viewer-versions"
            className={cn(viewerToolLook, "h-8 gap-1 px-3 font-normal")}
          />
        }
      >
        <span className="max-w-32 truncate">{versions[shown]!.label}</span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          strokeWidth={2}
          className="size-3.5 text-muted-foreground"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto min-w-48">
        <DropdownMenuRadioGroup
          value={String(shown)}
          onValueChange={(value) => onShownChange(Number(value))}
        >
          {versions.map((version, index) => (
            <DropdownMenuRadioItem
              key={index}
              value={String(index)}
              data-slot="media-viewer-version"
            >
              <img
                src={version.thumbnail ?? version.src}
                alt=""
                draggable={false}
                className="size-8 rounded-sm object-cover ring-1 ring-border"
              />
              <span className="truncate">{version.label}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * An image to look at: on a checkerboard if it has transparent parts,
 * fitted to its place or zoomed (the status bar's buttons, Ctrl or Cmd
 * with the wheel, + − and 0), its size and the app's facts below. With
 * `versions`, a strip of them under it picks the one shown, and a button
 * compares that with the original, a line dragged between them. With
 * `onPrevious` and `onNext`, buttons by its sides and the arrow keys go
 * to the app's others. With `onMark`, or the shown version's `marks` or
 * `highlight`, the version shown is marked by the image editor in it, its
 * tools in a floating bar under the image, its zoom the status bar's.
 */
function ImageView({
  kind,
  src: latestSrc,
  alt: latestAlt,
  crossOrigin,
  width: widthProp,
  height: heightProp,
  placeholder,
  versions: earlier,
  label: latestLabel,
  when: latestWhen,
  thumbnail: latestThumbnail,
  version: versionProp,
  onVersionChange,
  comparing: comparingProp,
  onComparingChange,
  transparent,
  position,
  onPrevious,
  onNext,
  onMark,
  markIcon,
  marks,
  highlight,
  details = [],
  labels: labelsProp,
  icon = <HugeiconsIcon icon={Image01Icon} strokeWidth={2} />,
  ...frame
}: MediaViewerFrameProps & MediaViewerImage) {
  const labels = { ...defaultLabels, ...labelsProp }
  // All its versions, the original first, this one last.
  const versions = [
    ...(earlier ?? []),
    {
      src: latestSrc,
      alt: latestAlt,
      label: latestLabel,
      when: latestWhen,
      thumbnail: latestThumbnail,
      marks,
      highlight,
    },
  ].map((version, index) => ({
    ...version,
    label:
      version.label ?? (index === 0 ? labels.original : labels.version(index)),
  }))
  const latest = versions.length - 1
  const [ownVersion, setOwnVersion] = React.useState(latest)
  const shownIndex = Math.min(latest, Math.max(0, versionProp ?? ownVersion))
  const {
    src,
    alt,
    marks: shownMarks,
    highlight: shownHighlight,
  } = versions[shownIndex]!
  const original = versions[0]!
  const showVersion = (next: number) => {
    setOwnVersion(next)
    onVersionChange?.(next)
  }

  const [ownComparing, setOwnComparing] = React.useState(false)
  const comparing = shownIndex > 0 && (comparingProp ?? ownComparing)
  // Marked, or to be: the editor, on the version shown, unless comparing.
  const editing =
    !comparing &&
    (onMark !== undefined ||
      shownMarks !== undefined ||
      shownHighlight !== undefined)
  const [zoom, setZoom] = React.useState<number | "fit">("fit")
  // The editor's: the scale it draws at.
  const [edited, setEdited] = React.useState<number>()
  const [natural, setNatural] = React.useState<{
    width: number
    height: number
  }>()
  const [failed, setFailed] = React.useState(false)
  const [found, setFound] = React.useState<boolean>()
  const [source, setSource] = React.useState(src)
  // The image another took the place of, fading out over it as it comes.
  const [leaving, setLeaving] = React.useState<{
    src: string
    width: number
    height: number
  } | null>(null)
  if (source !== src) {
    setSource(src)
    setLeaving(natural ? { src: source, ...natural } : null)
    setNatural(undefined)
    setFailed(false)
    setFound(undefined)
  }
  // Its size, read as it loads, comparing or not, and whether it has
  // transparent parts, unless the app says.
  React.useEffect(() => {
    const image = new Image()
    if (crossOrigin) image.crossOrigin = crossOrigin
    image.onload = async () => {
      // Drawn at once when shown: in place of its stand-in, whole.
      await image.decode().catch(() => {})
      if (image.onload === null) return
      if (image.naturalWidth)
        setNatural({ width: image.naturalWidth, height: image.naturalHeight })
      if (transparent === undefined) setFound(hasTransparency(image))
    }
    image.onerror = () => setFailed(true)
    image.src = src
    return () => {
      image.onload = null
      image.onerror = null
    }
  }, [src, crossOrigin, transparent])
  // A checkerboard unless it is known to have no transparent parts.
  const checkered = (transparent ?? found) !== false
  const width =
    natural?.width ?? (shownIndex === latest ? widthProp : undefined)
  const height =
    natural?.height ?? (shownIndex === latest ? heightProp : undefined)

  // A node in state, not a ref: the stage comes and goes (marking,
  // failing), and its size and wheel are watched again each time.
  const [place, setPlace] = React.useState<HTMLDivElement | null>(null)
  // The editor's, where it marks: swiped across too.
  const [editorPlace, setEditorPlace] = React.useState<HTMLDivElement | null>(
    null
  )
  const room = useSize(place)
  const fit = (width: number | undefined, height: number | undefined) =>
    width && height && room.width > 0
      ? Math.min(
          1,
          Math.max(0.01, room.width / width),
          Math.max(0.01, room.height / height)
        )
      : 1
  const scaleOf = (width: number | undefined, height: number | undefined) =>
    editing ? (edited ?? 1) : zoom === "fit" ? fit(width, height) : zoom
  const scale = scaleOf(width, height)
  const drawn =
    width && height
      ? { width: width * scale, height: height * scale }
      : undefined

  const zoomTo = (next: number | "fit") => setZoom(next)
  const step = (direction: 1 | -1) => zoomTo(nextZoom(scale, direction))

  // The wheel with Ctrl or Cmd (a pinch on a trackpad) zooms: not the page.
  const latestStep = React.useRef(step)
  React.useLayoutEffect(() => {
    latestStep.current = step
  })
  React.useEffect(() => {
    const node = place
    if (!node) return
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      latestStep.current(event.deltaY < 0 ? 1 : -1)
    }
    node.addEventListener("wheel", onWheel, { passive: false })
    return () => node.removeEventListener("wheel", onWheel)
  }, [place])

  // Fingers on it: a pinch zooms about its middle, as far as the
  // fingers go (not by steps); one finger pans it zoomed in, as a scroll;
  // a double tap fits it or zooms in to 200% there; a swipe across it
  // fitted goes to the image before or after. Not the page's pinch.
  const imageRef = React.useRef<HTMLImageElement>(null)
  // The point of the image kept under the fingers, from 0 to 1 across
  // it, and where they are; a double tap's, once.
  const pinned = React.useRef<Pinned | null>(null)
  React.useLayoutEffect(() => {
    keepUnder(place, imageRef.current, pinned.current)
    if (pinned.current?.once) pinned.current = null
  }, [place, scale])
  const gesture = React.useRef({
    scale,
    fitted: true,
    zoomable: false,
    zoomTo,
    onPrevious,
    onNext,
  })
  React.useLayoutEffect(() => {
    gesture.current = {
      scale,
      fitted: zoom === "fit",
      zoomable: drawn !== undefined && !comparing,
      zoomTo,
      onPrevious,
      onNext,
    }
  })
  React.useEffect(() => {
    // The stage, or the editor's place: there it zooms itself, and only
    // swipes are the viewer's.
    const node = place ?? editorPlace
    if (!node) return
    // What scrolls the image.
    const scroller = () =>
      node.querySelector<HTMLElement>("[data-slot=image-editor-frame]") ?? node
    let pinch: { distance: number; scale: number } | null = null
    let swipe: { x: number; y: number; time: number } | null = null
    let tap: { x: number; y: number; time: number } | null = null
    const between = (a: Touch, b: Touch) => ({
      x: (a.clientX + b.clientX) / 2,
      y: (a.clientY + b.clientY) / 2,
      distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
    })
    // Where a point is on the image, from 0 to 1 across it.
    const on = (x: number, y: number) => {
      const rect = imageRef.current?.getBoundingClientRect()
      return rect && rect.width > 0 && rect.height > 0
        ? {
            u: (x - rect.left) / rect.width,
            v: (y - rect.top) / rect.height,
            x,
            y,
          }
        : null
    }
    // A touch on a control is the control's, to its end.
    let control = false
    const start = (event: TouchEvent) => {
      if (onControl(node, event)) {
        control = true
        pinch = null
        swipe = null
        tap = null
        pinned.current = null
        return
      }
      if (control && event.touches.length > 1) return
      control = false
      const { zoomable } = gesture.current
      // Marking: its fingers draw.
      if (getComputedStyle(scroller()).touchAction === "none") return
      if (event.touches.length === 2 && zoomable) {
        const at = between(event.touches[0]!, event.touches[1]!)
        pinch = { distance: at.distance || 1, scale: gesture.current.scale }
        pinned.current = on(at.x, at.y)
        swipe = null
        tap = null
      } else if (event.touches.length === 1 && !pinch) {
        const finger = event.touches[0]!
        swipe = { x: finger.clientX, y: finger.clientY, time: event.timeStamp }
      } else swipe = null
    }
    const move = (event: TouchEvent) => {
      if (control || !pinch || event.touches.length < 2) return
      event.preventDefault()
      const at = between(event.touches[0]!, event.touches[1]!)
      if (pinned.current) {
        pinned.current.x = at.x
        pinned.current.y = at.y
      }
      const next = Math.min(
        maxZoom,
        Math.max(minZoom, (pinch.scale * at.distance) / pinch.distance)
      )
      if (Math.abs(next - gesture.current.scale) < 1e-4)
        keepUnder(node, imageRef.current, pinned.current)
      else gesture.current.zoomTo(next)
    }
    const end = (event: TouchEvent) => {
      if (control) {
        if (event.touches.length === 0) control = false
        return
      }
      if (pinch) {
        if (event.touches.length < 2) {
          pinch = null
          pinned.current = null
        }
        return
      }
      const finger = event.changedTouches[0]
      if (!swipe || !finger || event.touches.length > 0) return
      const dx = finger.clientX - swipe.x
      const dy = finger.clientY - swipe.y
      const time = event.timeStamp - swipe.time
      swipe = null
      const { fitted, zoomTo, onPrevious, onNext } = gesture.current
      if (Math.hypot(dx, dy) < 10 && time < 300) {
        if (!gesture.current.zoomable) return
        const again =
          tap &&
          event.timeStamp - tap.time < 300 &&
          Math.hypot(finger.clientX - tap.x, finger.clientY - tap.y) < 30
        tap = again
          ? null
          : { x: finger.clientX, y: finger.clientY, time: event.timeStamp }
        if (!again) return
        event.preventDefault()
        if (fitted) {
          const at = on(finger.clientX, finger.clientY)
          pinned.current = at && { ...at, once: true }
          zoomTo(2)
        } else zoomTo("fit")
        return
      }
      // Across it, while nothing of it is out of sight sideways.
      const sideways = scroller()
      if (
        sideways.scrollWidth <= sideways.clientWidth + 1 &&
        Math.abs(dx) > 48 &&
        Math.abs(dx) > 2 * Math.abs(dy) &&
        time < 600
      ) {
        const rtl = getComputedStyle(node).direction === "rtl"
        const forth = rtl ? dx > 0 : dx < 0
        if (forth) onNext?.()
        else onPrevious?.()
      }
    }
    const cancel = () => {
      control = false
      pinch = null
      swipe = null
      pinned.current = null
    }
    node.addEventListener("touchstart", start, { passive: true })
    node.addEventListener("touchmove", move, { passive: false })
    node.addEventListener("touchend", end, { passive: false })
    node.addEventListener("touchcancel", cancel)
    return () => {
      node.removeEventListener("touchstart", start)
      node.removeEventListener("touchmove", move)
      node.removeEventListener("touchend", end)
      node.removeEventListener("touchcancel", cancel)
    }
  }, [place, editorPlace])

  const copy = useImageCopy(src, crossOrigin)
  // Over the window, its toolbar the window's top row: its versions a
  // menu at its start, not a strip under it.
  const titlebar = React.useContext(ViewerFrameTitlebar)

  const facts = comparing
    ? [
        original.when && labels.before(original.when),
        versions[shownIndex]!.when && labels.after(versions[shownIndex]!.when!),
      ]
    : [width && height ? `${width} × ${height}` : undefined, ...details]

  return (
    <ViewerFrame
      data-viewer={kind}
      icon={icon}
      labels={{
        previous: labels.previousImage,
        next: labels.nextImage,
        ...labelsProp,
      }}
      // Back and forth among the app's images: by its sides, and the
      // arrows while it is not wider than its place (else they scroll it).
      position={position}
      {...(failed ? {} : { onPrevious, onNext })}
      lead={
        versions.length > 1 && (
          <>
            {titlebar && (
              <ImageVersionsMenu
                versions={versions}
                shown={shownIndex}
                onShownChange={showVersion}
                label={labels.versions}
              />
            )}
            <ViewerTool
              label={labels.compare}
              pressed={comparing}
              disabled={shownIndex === 0}
              onClick={() => {
                setOwnComparing(!comparing)
                onComparingChange?.(!comparing)
              }}
            >
              <HugeiconsIcon icon={SquareSplitHorizontalIcon} strokeWidth={2} />
            </ViewerTool>
          </>
        )
      }
      tools={
        <>
          {!failed && (
            <CopyButton
              value={copy}
              className={viewerTool}
              labels={{
                copy: labels.copyImage,
                copied: labels.copied,
                failed: labels.copyFailed,
              }}
            />
          )}
        </>
      }
      statusBar={false}
      zoom={
        !failed &&
        (!editing || edited !== undefined) && (
          <ViewerZoom
            zoom={scale}
            fit={zoom === "fit"}
            onZoomChange={zoomTo}
            onFit={() => zoomTo("fit")}
            labels={labelsProp ?? {}}
          />
        )
      }
      facts={facts}
      footer={
        versions.length > 1 &&
        !titlebar && (
          <ImageVersions
            versions={versions}
            shown={shownIndex}
            onShownChange={showVersion}
            label={labels.versions}
          />
        )
      }
      {...frame}
    >
      {failed ? (
        <ViewerUnsupported
          icon={<HugeiconsIcon icon={Image01Icon} strokeWidth={2} />}
          title={labels.failed("image")}
          description={frame.name}
        />
      ) : editing ? (
        <div
          ref={setEditorPlace}
          className="relative flex min-h-0 flex-1 flex-col"
        >
          <ImageEditor
            // Its own marks, and its highlight shown again, per version.
            key={shownIndex}
            src={src}
            alt={alt}
            crossOrigin={crossOrigin}
            onMark={
              onMark && ((marks, size) => onMark(marks, size, shownIndex))
            }
            markIcon={markIcon}
            marks={shownMarks}
            highlight={shownHighlight}
            zoom={zoom}
            onZoomChange={zoomTo}
            onScaleChange={setEdited}
            viewer
            checkered={checkered}
            // The latest's size and stand-in, till it has loaded.
            width={width}
            height={height}
            {...(shownIndex === latest
              ? { thumbnail: latestThumbnail, placeholder }
              : {})}
            labels={{ failed: labels.failed("image"), ...labels.editor }}
            className="min-h-0 flex-1"
          />
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div
            ref={setPlace}
            role="group"
            aria-label={alt}
            tabIndex={0}
            data-slot="media-viewer-stage"
            data-checkered={checkered || undefined}
            className={cn(
              "grid min-h-0 flex-1 touch-pan-x touch-pan-y overflow-auto outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
              checkered && checkerboard
            )}
            onKeyDown={(event) => {
              if (event.altKey || event.ctrlKey || event.metaKey) return
              const node = event.currentTarget
              const scrolls = node.scrollWidth > node.clientWidth + 1
              const rtl = getComputedStyle(node).direction === "rtl"
              const back = rtl ? "ArrowRight" : "ArrowLeft"
              const forth = rtl ? "ArrowLeft" : "ArrowRight"
              if (event.key === "+" || event.key === "=") step(1)
              else if (event.key === "-") step(-1)
              else if (event.key === "0") zoomTo("fit")
              else if (event.key === back && onPrevious && !scrolls)
                onPrevious()
              else if (event.key === forth && onNext && !scrolls) onNext()
              else return
              event.preventDefault()
            }}
          >
            {/* Centred while it is smaller than its place; scrolled from its
                start once larger. */}
            <div
              className="col-start-1 row-start-1 m-auto"
              style={drawn ? {} : { maxWidth: "100%" }}
            >
              {comparing ? (
                <div style={drawn ?? { width: "100%", height: 320 }}>
                  <ImageComparison
                    before={{ src: original.src, alt: original.alt }}
                    after={{ src, alt }}
                    crossOrigin={crossOrigin}
                    labels={labels.comparison}
                    className="min-h-0 p-0"
                  />
                </div>
              ) : (
                <img
                  key={src}
                  ref={imageRef}
                  src={src}
                  alt={alt}
                  draggable={false}
                  {...(crossOrigin ? { crossOrigin } : {})}
                  data-slot="media-viewer-image"
                  style={{
                    ...drawn,
                    // The latest's thumbnail over its placeholder, at its
                    // size, till it has loaded.
                    ...(!natural && drawn && shownIndex === latest
                      ? standIn(latestThumbnail, placeholder)
                      : {}),
                  }}
                  className={cn(
                    "block max-w-none",
                    !drawn && "max-w-full",
                    leaving && "animate-in motion-fade fade-in-0"
                  )}
                  onError={() => setFailed(true)}
                />
              )}
            </div>
            {leaving && !comparing && (
              <div
                aria-hidden="true"
                className="pointer-events-none col-start-1 row-start-1 m-auto"
              >
                <img
                  src={leaving.src}
                  alt=""
                  draggable={false}
                  {...(crossOrigin ? { crossOrigin } : {})}
                  style={{
                    width:
                      leaving.width * scaleOf(leaving.width, leaving.height),
                    height:
                      leaving.height * scaleOf(leaving.width, leaving.height),
                  }}
                  className="block max-w-none animate-out motion-fade fade-out-0 fill-mode-forwards"
                  onAnimationEnd={() => setLeaving(null)}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </ViewerFrame>
  )
}

/**
 * An image, a video or a recording open in a panel, in a viewer's frame
 * (its path, the app's actions, its facts), by its `kind`:
 *
 * - `image`: on a checkerboard if it has transparent parts, fitted or
 *   zoomed (the status bar, Ctrl or Cmd with the wheel, + − and 0),
 *   copied; its `versions` in a strip under it, the one shown compared
 *   with the original by a line dragged between them; the app's others
 *   back and forth (`onPrevious`, `onNext`, `position`); its areas marked
 *   for the app (`onMark`), and `marks` or a `highlight` shown.
 * - `video`: on black, its controls over it in any theme (play, where it
 *   is, a seek bar showing the frame under the pointer, sound, full
 *   screen), speed and loop below with its size and length.
 * - `audio`: its title, a waveform of the app's `peaks` to seek on, and
 *   its transcript line by line, the line being said lit, each going
 *   there; speed, loop and copying the transcript below.
 *
 * Space plays and pauses, the arrows go 5 seconds. What cannot be shown
 * or played says so. `crossOrigin` and `mediaProps` give the app the
 * element, to go to a time, and its events.
 */
function MediaViewer(props: MediaViewerProps) {
  switch (props.kind) {
    case "image":
      return <ImageView {...props} />
    case "video":
      return <VideoView {...props} />
    default:
      return <AudioView {...props} />
  }
}

export {
  MediaBar,
  MediaViewer,
  SeekPreview,
  defaultLabels as defaultMediaViewerLabels,
  markImages,
  mediaKeys,
  png,
  useMedia,
  useMediaElement,
  type ImageComparisonLabels,
  type ImageEditorLabels,
  type ImageMark,
  type ImageSize,
  type MediaBarLabels,
  type MediaCrossOrigin,
  type MediaElementProps,
  type MediaKind,
  type MediaViewerAudio,
  type MediaViewerImage,
  type MediaViewerImageVersion,
  type MediaViewerLabels,
  type MediaViewerProps,
  type MediaViewerVideo,
  type TranscriptCue,
}
