import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fn, screen, userEvent, waitFor } from "storybook/test"

import {
  VoiceMode,
  VoiceModeCaption,
  VoiceModeCaptions,
  VoiceModeControls,
  VoiceModeEnd,
  VoiceModeMute,
  VoiceModeOrb,
  VoiceModeStatus,
  type VoiceModeState,
} from "@/components/voice-mode"
import { onAPhone } from "@/stories/phone"

/** A voice's level, made up: it rises and falls as speech does. */
function useLevel(moving: boolean) {
  const [level, setLevel] = React.useState(0.4)
  React.useEffect(() => {
    if (!moving) return
    let frame = 0
    const step = (time: number) => {
      setLevel(
        Math.max(
          0,
          0.45 * Math.abs(Math.sin(time / 260)) +
            0.35 * Math.abs(Math.sin(time / 97)) -
            0.1
        )
      )
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [moving])
  return level
}

const lines = [
  { speaker: "you", text: "What's left before we can tag the release?" },
  {
    speaker: "agent",
    text: "Two things: the changelog needs the new upload limits, and one test on the sync worker still flakes.",
  },
] as const

function Demo({
  state = "listening",
  variant = "full",
  defaultMuted = false,
  interim,
  still = false,
  onEnd,
  onInterrupt,
}: {
  state?: VoiceModeState
  variant?: "full" | "bar"
  defaultMuted?: boolean
  /** Words of the reader's still being made out, after the lines. */
  interim?: string
  /** A level that does not move, for the picture. */
  still?: boolean
  onEnd?: () => void
  onInterrupt?: () => void
}) {
  const [muted, setMuted] = React.useState(defaultMuted)
  const level = useLevel(!still)
  return (
    <VoiceMode
      state={state}
      level={level}
      variant={variant}
      muted={muted}
      onMutedChange={setMuted}
      onInterrupt={onInterrupt}
    >
      <VoiceModeOrb />
      <VoiceModeStatus />
      <VoiceModeCaptions>
        {lines.map((line, index) => (
          <VoiceModeCaption key={index} speaker={line.speaker}>
            {line.text}
          </VoiceModeCaption>
        ))}
        {interim ? (
          <VoiceModeCaption speaker="you" interim>
            {interim}
          </VoiceModeCaption>
        ) : null}
      </VoiceModeCaptions>
      <VoiceModeControls>
        <VoiceModeMute />
        <VoiceModeEnd onClick={onEnd} />
      </VoiceModeControls>
    </VoiceMode>
  )
}

const meta = {
  title: "Blocks/Voice Mode",
  component: Demo,
  args: { onEnd: fn(), onInterrupt: fn() },
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story, { args }) =>
      args.variant === "bar" ? (
        // In the composer's place, under the conversation.
        <div className="flex h-dvh flex-col justify-end">
          <div className="mx-auto w-full max-w-3xl px-4 pb-4">
            <Story />
          </div>
        </div>
      ) : (
        <div className="h-dvh">
          <Story />
        </div>
      ),
  ],
} satisfies Meta<typeof Demo>

export default meta
type Story = StoryObj<typeof meta>

const orbOf = () =>
  document.querySelector<HTMLElement>("[data-slot=voice-mode-orb]")!

/**
 * Listening: the rings swell with the reader's voice; the captions the
 * last lines said, the latest at the foot.
 */
export const Listening: Story = {
  args: { interim: "And the docs for" },
  play: async () => {
    await expect(screen.getByRole("status")).toHaveTextContent("Listening")
    // The orb in the middle, over the captions and buttons.
    await expect(orbOf().getBoundingClientRect().width).toBe(192)
    await expect(screen.getByRole("log", { name: "Captions" })).toBeVisible()
  },
}

/** Mute: the disc grey with the mic struck out, the button filled. */
export const Muted: Story = {
  args: { still: true },
  play: async () => {
    const mute = screen.getByRole("button", { name: "Mute" })
    await expect(mute).toHaveAttribute("aria-pressed", "false")
    await userEvent.click(mute)
    await expect(mute).toHaveAttribute("aria-pressed", "true")
    await expect(screen.getByRole("status")).toHaveTextContent("Muted")
    // Muted, not heard: the rings at rest.
    await expect(
      getComputedStyle(orbOf().closest("[data-slot=voice-mode]")!)
        .getPropertyValue("--voice-level")
        .trim()
    ).toBe("0")
  },
}

/** Thinking: the disc breathes, the rings at rest. */
export const Thinking: Story = {
  args: { state: "thinking" },
  play: async () => {
    await expect(screen.getByRole("status")).toHaveTextContent("Thinking")
  },
}

/**
 * Speaking: the rings move with the agent's voice; the orb a button
 * that interrupts it, given `onInterrupt`.
 */
export const Speaking: Story = {
  args: { state: "speaking" },
  play: async ({ args }) => {
    await userEvent.click(screen.getByRole("button", { name: "Interrupt" }))
    await expect(args.onInterrupt).toHaveBeenCalled()
    await userEvent.click(
      screen.getByRole("button", { name: "End voice mode" })
    )
    await expect(args.onEnd).toHaveBeenCalled()
  },
}

/** Connecting: the disc faint, pulsing. */
export const Connecting: Story = {
  args: { state: "connecting" },
  play: async () => {
    await expect(screen.getByRole("status")).toHaveTextContent("Connecting…")
    // Not speaking: the orb no button.
    await expect(screen.queryByRole("button", { name: "Interrupt" })).toBeNull()
  },
}

/** On a phone: the orb 160px, the buttons over the home indicator. */
export const OnAPhone: Story = {
  ...onAPhone,
  args: { state: "speaking" },
  play: async () => {
    await waitFor(() => expect(orbOf().getBoundingClientRect().width).toBe(160))
  },
}

/**
 * A bar in the composer's place, the conversation's messages above it:
 * a small orb, the status, the latest line said, the buttons.
 */
export const Bar: Story = {
  args: { variant: "bar", state: "speaking" },
  play: async () => {
    const bar = document.querySelector("[data-slot=voice-mode]")!
    await expect(bar.getBoundingClientRect().height).toBe(56)
    // Only the latest line, on one line.
    const captions = screen.getByRole("log", { name: "Captions" })
    await expect(captions.getBoundingClientRect().height).toBeLessThanOrEqual(
      20
    )
    await expect(
      screen.getByText(/^Two things/).getBoundingClientRect().height
    ).toBeGreaterThan(0)
  },
}

/** A bar on a phone: the status word read out, not shown; the orb says it. */
export const BarOnAPhone: Story = {
  ...onAPhone,
  args: { variant: "bar", state: "listening" },
  play: async () => {
    await waitFor(() =>
      expect(
        screen.getByRole("status").getBoundingClientRect().width
      ).toBeLessThanOrEqual(1)
    )
  },
}
