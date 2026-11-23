"use client"

import * as React from "react"
import { cn } from "cn"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Cancel01Icon,
  Mic01Icon,
  MicOff01Icon,
} from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"

/** Where a spoken conversation is. */
type VoiceModeState = "connecting" | "listening" | "thinking" | "speaking"

type VoiceModeLabels = {
  connecting: string
  listening: string
  thinking: string
  speaking: string
  /** Listening, but the microphone off. */
  muted: string
  /** The mute button's name (pressed, muted). */
  mute: string
  /** The end button's name. */
  end: string
  /** The orb's name while the agent speaks, given `onInterrupt`. */
  interrupt: string
  /** The captions' name. */
  captions: string
}

const defaultLabels: VoiceModeLabels = {
  connecting: "Connecting…",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
  muted: "Muted",
  mute: "Mute",
  end: "End voice mode",
  interrupt: "Interrupt",
  captions: "Captions",
}

type VoiceModeContext = {
  state: VoiceModeState
  variant: "full" | "bar"
  muted: boolean
  onMutedChange: ((muted: boolean) => void) | undefined
  onInterrupt: (() => void) | undefined
  labels: VoiceModeLabels
}

const VoiceModeContext = React.createContext<VoiceModeContext | null>(null)

function useVoiceMode(part: string) {
  const context = React.useContext(VoiceModeContext)
  if (!context) throw new Error(`${part} must be used within VoiceMode`)
  return context
}

/**
 * A spoken conversation with the agent: an orb that moves with the voice
 * heard (`VoiceModeOrb`), a word of where it is (`VoiceModeStatus`), the
 * last lines said (`VoiceModeCaptions`) and its buttons, mute and end
 * (`VoiceModeControls`). The app runs the audio; it says the `state`,
 * the `level` of whoever is heard, from 0 to 1, as often as it likes,
 * and whether the microphone is `muted`.
 *
 * `variant="full"` fills its place, a panel or a sheet: the orb in the
 * middle, the captions and buttons under it. `"bar"` is a row in the
 * composer's place, the conversation's messages above it: a small orb,
 * the status, the last line said, the buttons.
 */
function VoiceMode({
  state,
  level = 0,
  muted = false,
  onMutedChange,
  onInterrupt,
  variant = "full",
  labels: labelsProp,
  className,
  style,
  ...props
}: React.ComponentProps<"div"> & {
  state: VoiceModeState
  /** How loud whoever is heard is now, 0 to 1: the reader listening, the agent speaking. */
  level?: number
  muted?: boolean
  onMutedChange?: (muted: boolean) => void
  /** Stops the agent speaking: the orb, while it does, is a button. */
  onInterrupt?: () => void
  variant?: "full" | "bar"
  labels?: Partial<VoiceModeLabels>
}) {
  const labels = React.useMemo(
    () => ({ ...defaultLabels, ...labelsProp }),
    [labelsProp]
  )
  const context = React.useMemo(
    () => ({ state, variant, muted, onMutedChange, onInterrupt, labels }),
    [state, variant, muted, onMutedChange, onInterrupt, labels]
  )
  // Heard only while someone is.
  const heard =
    (state === "listening" && !muted) || state === "speaking"
      ? Math.min(1, Math.max(0, level))
      : 0
  return (
    <VoiceModeContext value={context}>
      <div
        data-slot="voice-mode"
        data-state={state}
        data-variant={variant}
        data-muted={muted || undefined}
        style={{ "--voice-level": heard, ...style } as React.CSSProperties}
        className={cn(
          "group/voice-mode",
          variant === "full"
            ? // The orb and its status in the middle of what is left over
              // the captions and buttons.
              "flex h-full min-h-0 w-full flex-col items-center px-6 pt-6 pb-8 pb-safe-or-8 *:data-[slot=voice-mode-orb]:mt-auto *:data-[slot=voice-mode-status]:mb-auto"
            : // As the composer's box: 56px, its corner and shadow.
              "flex h-14 w-full min-w-0 items-center gap-3 rounded-composer bg-background ps-3 pe-2 shadow-float dark:bg-card forced-colors:border",
          className
        )}
        {...props}
      />
    </VoiceModeContext>
  )
}

/**
 * Who is heard, as a shape: a disc, and rings around it that swell with
 * the level. Listening, they move with the reader's voice; speaking,
 * with the agent's; thinking, the disc breathes; connecting, it is
 * faint; muted, it is grey with the mic struck out. With the
 * `onInterrupt` of its `VoiceMode`, while the agent speaks, a button
 * that stops it. Still, where the reader asks for less motion.
 */
function VoiceModeOrb({ className, ...props }: React.ComponentProps<"div">) {
  const { state, muted, onInterrupt, labels, variant } =
    useVoiceMode("VoiceModeOrb")
  const interrupts = state === "speaking" && onInterrupt !== undefined
  const ring =
    "absolute inset-0 rounded-full bg-foreground transition-transform duration-(--motion-hover) motion-reduce:scale-100!"
  const shape = (
    <>
      {/* Its rings: at rest, inside the disc's edge. */}
      <span
        aria-hidden
        className={cn(
          ring,
          "scale-[calc(0.5+var(--voice-level)*0.5)] opacity-5"
        )}
      />
      <span
        aria-hidden
        className={cn(
          ring,
          "scale-[calc(0.5+var(--voice-level)*0.3)] opacity-10"
        )}
      />
      <span
        aria-hidden
        data-slot="voice-mode-disc"
        className={cn(
          "relative grid size-1/2 place-items-center rounded-full bg-foreground text-background transition-[transform,background-color] duration-(--motion-fade)",
          "scale-[calc(1+var(--voice-level)*0.08)] motion-reduce:scale-100!",
          state === "connecting" &&
            "bg-subtle-foreground motion-safe:animate-pulse",
          state === "thinking" && "motion-safe:animate-pulse",
          muted && "bg-muted-foreground",
          variant === "full" ? "[&>svg]:size-6" : "[&>svg]:size-3"
        )}
      >
        {muted ? <HugeiconsIcon icon={MicOff01Icon} strokeWidth={2} /> : null}
      </span>
    </>
  )
  const box = cn(
    "relative grid shrink-0 place-items-center rounded-full",
    variant === "full" ? "size-48 max-sm:size-40" : "size-9",
    className
  )
  return interrupts ? (
    <button
      type="button"
      data-slot="voice-mode-orb"
      aria-label={labels.interrupt}
      onClick={onInterrupt}
      className={cn(
        box,
        "cursor-pointer outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      )}
      {...(props as React.ComponentProps<"button">)}
    >
      {shape}
    </button>
  ) : (
    <div data-slot="voice-mode-orb" className={box} {...props}>
      {shape}
    </div>
  )
}

/**
 * Where the conversation is, in a word ("Listening"), announced as it
 * changes; its `children`, if any, in place of the word.
 */
function VoiceModeStatus({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const { state, muted, labels, variant } = useVoiceMode("VoiceModeStatus")
  const word = state === "listening" && muted ? labels.muted : labels[state]
  return (
    <div
      data-slot="voice-mode-status"
      role="status"
      className={cn(
        "text-muted-foreground",
        variant === "full"
          ? "mt-6 text-sm"
          : "w-20 shrink-0 truncate text-2sm max-sm:sr-only",
        className
      )}
      {...props}
    >
      {children ?? word}
    </div>
  )
}

/**
 * The last lines said, the latest at the foot, older ones fading out
 * above it: each a `VoiceModeCaption`. In a bar, only the latest, on
 * one line: too long, its end, the words just said, its start faded.
 * Not announced: the voice is heard.
 */
function VoiceModeCaptions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { labels, variant } = useVoiceMode("VoiceModeCaptions")
  const ref = React.useRef<HTMLDivElement>(null)
  // In a bar, whether the latest line runs past it, after each change:
  // set on the element, not in state, as the words come often.
  React.useLayoutEffect(() => {
    const element = ref.current
    if (!element || variant !== "bar") return
    const line = element.lastElementChild as HTMLElement | null
    const over = line !== null && line.scrollWidth > element.clientWidth
    element.toggleAttribute("data-overflowing", over)
  })
  return (
    <div
      ref={ref}
      data-slot="voice-mode-captions"
      role="log"
      aria-live="off"
      aria-label={labels.captions}
      className={cn(
        variant === "full"
          ? // Three lines of 28px, the earliest faded, from the foot up.
            "mt-8 flex h-21 w-full max-w-xl flex-col justify-end overflow-hidden mask-t-from-50% text-center text-lg leading-7 text-pretty"
          : "flex min-w-0 flex-1 overflow-hidden text-sm whitespace-nowrap *:shrink-0 *:not-last:hidden data-overflowing:justify-end data-overflowing:[mask-image:linear-gradient(to_right,transparent,black_--spacing(12))] rtl:data-overflowing:[mask-image:linear-gradient(to_left,transparent,black_--spacing(12))]",
        className
      )}
      {...props}
    />
  )
}

/**
 * A line said: the agent's in the text's colour, the reader's (`you`)
 * grey; `interim`, still being made out, greyer.
 */
function VoiceModeCaption({
  speaker = "agent",
  interim = false,
  className,
  ...props
}: React.ComponentProps<"p"> & {
  speaker?: "agent" | "you"
  interim?: boolean
}) {
  return (
    <p
      data-slot="voice-mode-caption"
      data-speaker={speaker}
      data-interim={interim || undefined}
      className={cn(
        "shrink-0",
        speaker === "agent" ? "text-foreground" : "text-muted-foreground",
        interim && "text-subtle-foreground",
        className
      )}
      {...props}
    />
  )
}

/** Its buttons in a row: `VoiceModeMute`, `VoiceModeEnd`, the app's. */
function VoiceModeControls({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { variant } = useVoiceMode("VoiceModeControls")
  return (
    <div
      data-slot="voice-mode-controls"
      className={cn(
        "flex shrink-0 items-center",
        variant === "full" ? "mt-8 gap-4" : "gap-1",
        className
      )}
      {...props}
    />
  )
}

/**
 * A round button of its row: 48px, 36px in a bar. `pressed`, a toggle,
 * filled while on.
 */
function VoiceModeButton({
  pressed,
  className,
  ...props
}: React.ComponentProps<typeof Button> & { pressed?: boolean }) {
  const { variant } = useVoiceMode("VoiceModeButton")
  return (
    <Button
      data-slot="voice-mode-button"
      type="button"
      variant="secondary"
      size="icon"
      aria-pressed={pressed}
      className={cn(
        "rounded-full",
        variant === "full"
          ? "size-12 [&_svg:not([class*='size-'])]:size-5"
          : "size-9",
        pressed && "bg-foreground text-background hover:bg-foreground/90",
        className
      )}
      {...props}
    />
  )
}

/** Turns the microphone off and on: `muted`, `onMutedChange`. */
function VoiceModeMute(
  props: Omit<React.ComponentProps<typeof VoiceModeButton>, "pressed">
) {
  const { muted, onMutedChange, labels } = useVoiceMode("VoiceModeMute")
  return (
    <VoiceModeButton
      data-slot="voice-mode-mute"
      aria-label={labels.mute}
      pressed={muted}
      onClick={() => onMutedChange?.(!muted)}
      {...props}
    >
      <HugeiconsIcon icon={muted ? MicOff01Icon : Mic01Icon} strokeWidth={2} />
    </VoiceModeButton>
  )
}

/** Ends the spoken conversation: its `onClick`, the app's. */
function VoiceModeEnd({
  className,
  ...props
}: React.ComponentProps<typeof VoiceModeButton>) {
  const { labels } = useVoiceMode("VoiceModeEnd")
  return (
    <VoiceModeButton
      data-slot="voice-mode-end"
      aria-label={labels.end}
      variant="default"
      className={className}
      {...props}
    >
      <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
    </VoiceModeButton>
  )
}

export {
  VoiceMode,
  VoiceModeButton,
  VoiceModeCaption,
  VoiceModeCaptions,
  VoiceModeControls,
  VoiceModeEnd,
  VoiceModeMute,
  VoiceModeOrb,
  VoiceModeStatus,
  type VoiceModeLabels,
  type VoiceModeState,
}
