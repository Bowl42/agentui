import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  expect,
  fireEvent,
  fn,
  screen,
  userEvent,
  waitFor,
  within,
} from "storybook/test"

import {
  Composer,
  ComposerEditor,
  ComposerSubmit,
  ComposerToolbar,
  ComposerVoice,
  type ComposerValue,
  type ComposerVoiceInput,
} from "@/components/composer"
import { onAPhone } from "@/stories/phone"
import { coarseHitSize } from "@/stories/touch"

/** What the made-up speaker says, a word at a time. */
const spoken =
  "Rename the upload helper to sendFile and update the tests that import it".split(
    " "
  )

/** Words still being made out, at the end, before they settle. */
const unsettled = 2

type Recorder = {
  levels: number[]
  duration: number
  heard: number
}

/**
 * A recorder as an app's would report it, made up: a level and a word
 * every `tick` ms, from `heard` words on.
 */
function useRecorder(tick: number, heard: number, duration: number) {
  const [state, setState] = React.useState<Recorder | null>(null)
  const timer = React.useRef<ReturnType<typeof setInterval>>(undefined)
  const stop = React.useCallback(() => {
    clearInterval(timer.current)
    setState(null)
  }, [])
  const start = React.useCallback(() => {
    clearInterval(timer.current)
    setState({ levels: [], duration, heard })
    let step = 0
    timer.current = setInterval(() => {
      step++
      setState(
        (current) =>
          current && {
            levels: [
              ...current.levels,
              0.15 +
                0.7 * Math.abs(Math.sin(step * 1.7)) * (step % 5 ? 1 : 0.3),
            ].slice(-60),
            duration: current.duration + tick / 1000,
            heard: Math.min(spoken.length, current.heard + (step % 2)),
          }
      )
    }, tick)
  }, [tick, heard, duration])
  React.useEffect(() => () => clearInterval(timer.current), [])
  return { state, start, stop }
}

function Demo({
  live = false,
  heard = 0,
  duration = 0,
  tick = 200,
  startError,
  startPending = false,
  failOnce = false,
  maxDuration,
  submitOnFinish,
  inputs,
  defaultInput = "",
  onSubmit,
  onStart,
  onCancel,
  onInputChange,
  onInputsOpen,
}: {
  /** Whether the app makes out words as they are said. */
  live?: boolean
  /** Words heard already, as it opens recording. */
  heard?: number
  /** Seconds recorded already, as it opens recording. */
  duration?: number
  tick?: number
  /** The `getUserMedia` error name a start fails with. */
  startError?: string
  /** Whether a start is never answered, as a prompt left open. */
  startPending?: boolean
  /** Whether making out the words fails the first time. */
  failOnce?: boolean
  maxDuration?: number
  submitOnFinish?: boolean | "hold"
  /** The inputs the app found to record from. */
  inputs?: ComposerVoiceInput[]
  /** The one chosen before, kept by the app. */
  defaultInput?: string
  onSubmit?: (value: ComposerValue) => void
  onStart?: () => void
  onCancel?: () => void
  onInputChange?: (id: string) => void
  onInputsOpen?: () => void
}) {
  const recorder = useRecorder(tick, heard, duration)
  const [input, setInput] = React.useState(defaultInput)
  const failed = React.useRef(false)
  const words = recorder.state?.heard ?? 0
  const settled = Math.max(0, words - unsettled)
  return (
    <div className="mx-auto w-full max-w-2xl p-4">
      <Composer
        onSubmit={(value) => {
          onSubmit?.(value)
          return true
        }}
      >
        <ComposerEditor aria-label="Message" placeholder="Ask anything" />
        <ComposerToolbar>
          <ComposerVoice
            className="ms-auto"
            levels={recorder.state?.levels}
            duration={recorder.state?.duration}
            {...(live && {
              transcript: spoken.slice(0, settled).join(" "),
              interim: spoken.slice(settled, words).join(" "),
            })}
            maxDuration={maxDuration}
            submitOnFinish={submitOnFinish}
            inputs={inputs}
            input={input}
            onInputChange={(id) => {
              onInputChange?.(id)
              setInput(id)
            }}
            onInputsOpen={onInputsOpen}
            onStart={() => {
              onStart?.()
              if (startError)
                return Promise.reject(new DOMException("", startError))
              if (startPending) return new Promise<void>(() => {})
              recorder.start()
            }}
            onCancel={() => {
              onCancel?.()
              recorder.stop()
            }}
            onFinish={async () => {
              if (failOnce && !failed.current) {
                failed.current = true
                throw new Error("The transcription service is unreachable")
              }
              recorder.stop()
              // Live, the words shown are what goes in the box.
              return live ? undefined : spoken.join(" ")
            }}
          />
          <ComposerSubmit />
        </ComposerToolbar>
      </Composer>
    </div>
  )
}

const meta = {
  title: "Components/Composer Voice",
  component: Demo,
  args: {
    onSubmit: fn(),
    onStart: fn(),
    onCancel: fn(),
    onInputChange: fn(),
    onInputsOpen: fn(),
  },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Demo>

export default meta
type Story = StoryObj<typeof meta>

const micOf = () => screen.getByRole("button", { name: "Voice input" })
const editorOf = () => screen.getByRole("textbox", { name: "Message" })

/** Presses the mic down and holds it, as a finger would. */
async function pressMic() {
  const mic = micOf()
  const box = mic.getBoundingClientRect()
  const x = box.left + box.width / 2
  fireEvent.pointerDown(mic, { button: 0, pointerId: 7, clientX: x })
  await screen.findByText("Slide to cancel")
  return x
}

/** Lets go of it after `held` ms, from `x`. */
async function letGo(x: number, held: number) {
  await new Promise((resolve) => setTimeout(resolve, held))
  fireEvent.pointerUp(window, { pointerId: 7, clientX: x })
}

/**
 * Tapped, without a live transcript: the time and a waveform in the
 * text's place; Done makes the words out and puts them in the box.
 */
export const Tapped: Story = {
  play: async () => {
    // No inputs given: the mic alone, as before.
    await expect(
      screen.queryByRole("button", { name: "Choose microphone" })
    ).toBeNull()
    await userEvent.click(micOf())
    await expect(
      await screen.findByRole("status", { name: /^Recording 0:0/ })
    ).toBeVisible()
    const done = screen.getByRole("button", { name: "Done" })
    await expect(done).toHaveFocus()
    await userEvent.click(done)
    await waitFor(() =>
      expect(editorOf()).toHaveTextContent("Rename the upload helper")
    )
  },
}

/**
 * Live: the words as they are made out, in the text's own size, the
 * last ones still changing in grey; the time and a smaller wave move
 * to the toolbar. Done keeps the words shown.
 */
export const Live: Story = {
  args: { live: true, heard: 9, duration: 4 },
  play: async () => {
    await userEvent.click(micOf())
    const words = await screen.findByText(/^Rename the upload helper/)
    await expect(words).toBeVisible()
    // Its words as the editor's: 16/24, from the same 16px in.
    const style = getComputedStyle(words)
    await expect(style.fontSize).toBe("16px")
    await expect(style.lineHeight).toBe("24px")
    // The time on the toolbar, its dot where the words start.
    const meter = screen.getByRole("status", { name: /^Recording/ })
    const dot = meter.firstElementChild!.getBoundingClientRect()
    const start =
      words.getBoundingClientRect().left + parseFloat(style.paddingLeft)
    await expect(Math.round(dot.left - start)).toBe(0)
    await userEvent.click(screen.getByRole("button", { name: "Done" }))
    await waitFor(() =>
      expect(editorOf()).toHaveTextContent(/^Rename the upload helper/)
    )
  },
}

/** Live, nothing heard yet: "Listening…". */
export const LiveListening: Story = {
  args: { live: true, tick: 60_000 },
  play: async () => {
    await userEvent.click(micOf())
    await expect(await screen.findByText("Listening…")).toBeVisible()
  },
}

/** Live on a phone: the box grows with the words, to eight lines. */
export const LiveOnAPhone: Story = {
  ...onAPhone,
  args: { live: true, heard: 14, duration: 9, tick: 60_000 },
  play: async () => {
    await userEvent.click(micOf())
    const words = await screen.findByText(/^Rename the upload/)
    await expect(words).toBeVisible()
    // The dot where the words start, as on a desktop.
    const meter = screen.getByRole("status", { name: /^Recording/ })
    await waitFor(() => {
      const dot = meter.firstElementChild!.getBoundingClientRect()
      const start =
        words.getBoundingClientRect().left +
        parseFloat(getComputedStyle(words).paddingLeft)
      expect(Math.round(dot.left - start)).toBe(0)
    })
  },
}

/**
 * Held: it records until let go, where to slide to cancel at the
 * toolbar's end, the mic lit; let go, the words go in the box, and with
 * `submitOnFinish="hold"` are sent.
 */
export const Held: Story = {
  args: { live: true, heard: 6, submitOnFinish: "hold" },
  play: async ({ args }) => {
    const x = await pressMic()
    await expect(screen.queryByRole("button", { name: "Done" })).toBeNull()
    await letGo(x, 400)
    await waitFor(() => expect(args.onSubmit).toHaveBeenCalled())
  },
}

/** Held and slid back: let go there, it cancels. */
export const HeldSlidBack: Story = {
  args: { live: true, heard: 6 },
  play: async ({ args }) => {
    const x = await pressMic()
    const back = document.dir === "rtl" ? x + 120 : x - 120
    fireEvent.pointerMove(window, { pointerId: 7, clientX: back })
    await expect(await screen.findByText("Release to cancel")).toBeVisible()
    await letGo(back, 400)
    await waitFor(() => expect(micOf()).toBeVisible())
    await expect(args.onCancel).toHaveBeenCalled()
    await expect(editorOf()).toHaveTextContent("")
  },
}

/** Held, but let go at once: a tap, so it records on until Done. */
export const HeldBriefly: Story = {
  tags: ["!autodocs"],
  play: async () => {
    const x = await pressMic()
    await letGo(x, 0)
    await expect(
      await screen.findByRole("button", { name: "Done" })
    ).toHaveFocus()
  },
}

/** Space held on the mic records until let go, as a press does. */
export const HeldSpace: Story = {
  tags: ["!autodocs"],
  play: async () => {
    // One user, so the key stays down between its calls.
    const user = userEvent.setup()
    micOf().focus()
    await user.keyboard("[Space>]")
    await expect(await screen.findByText("Slide to cancel")).toBeVisible()
    await new Promise((resolve) => setTimeout(resolve, 400))
    await user.keyboard("[/Space]")
    await waitFor(() =>
      expect(editorOf()).toHaveTextContent("Rename the upload helper")
    )
  },
}

/** Its last seconds of `maxDuration` counted down; at its end, Done. */
export const Limit: Story = {
  args: { maxDuration: 60, duration: 53, tick: 250 },
  play: async () => {
    await userEvent.click(micOf())
    await expect(await screen.findByText(/^\ds left$/)).toBeVisible()
    await waitFor(
      () => expect(editorOf()).toHaveTextContent("Rename the upload helper"),
      { timeout: 10_000 }
    )
  },
}

/** The microphone not allowed: a line under the box says how to. */
export const Denied: Story = {
  args: { startError: "NotAllowedError" },
  play: async () => {
    await userEvent.click(micOf())
    const alert = await screen.findByRole("alert")
    await expect(alert).toHaveTextContent(
      "Microphone access is off: allow it in the site's settings"
    )
    // Still the box, to type in instead.
    await expect(micOf()).toBeVisible()
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }))
    await expect(screen.queryByRole("alert")).toBeNull()
  },
}

/** No microphone: so it says. Typing dismisses it. */
export const NoMicrophone: Story = {
  args: { startError: "NotFoundError" },
  play: async () => {
    await userEvent.click(micOf())
    await expect(await screen.findByRole("alert")).toHaveTextContent(
      "No microphone found"
    )
    await userEvent.click(editorOf())
    await userEvent.keyboard("x")
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull())
  },
}

/**
 * The words not made out: the recording stays, with a Retry that tries
 * again, not lost.
 */
export const TranscriptionFailed: Story = {
  args: { failOnce: true },
  play: async () => {
    await userEvent.click(micOf())
    await userEvent.click(await screen.findByRole("button", { name: "Done" }))
    await expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't make out the words"
    )
    const retry = screen.getByRole("button", { name: "Retry" })
    await waitFor(() => expect(retry).toHaveFocus())
    await userEvent.click(retry)
    await waitFor(() =>
      expect(editorOf()).toHaveTextContent("Rename the upload helper")
    )
  },
}

/** Inputs as an app finds them, made up: one virtual, one silent. */
const inputs: ComposerVoiceInput[] = [
  { id: "built-in", label: "Built-in microphone" },
  { id: "usb-headset", label: "USB headset" },
  { id: "loopback", label: "Loopback audio (virtual device for recording)" },
]

const chooserOf = () =>
  screen.getByRole("button", { name: "Choose microphone" })

/**
 * Given inputs, a chevron beside the mic chooses what it records from:
 * the system default first and checked, the app told as it opens (to
 * list them again) and of the one chosen. The mic still records as
 * tapped, and the chevron goes with the tools while it does.
 */
export const Inputs: Story = {
  args: { inputs },
  play: async ({ args }) => {
    const chooser = chooserOf()
    // Beside the mic, as tall, 24px wide.
    const mic = micOf().getBoundingClientRect()
    const box = chooser.getBoundingClientRect()
    await expect(box.width).toBe(24)
    await expect(box.height).toBe(mic.height)
    await expect(Math.abs(box.left - mic.right)).toBeLessThanOrEqual(1)

    await userEvent.click(chooser)
    const group = await screen.findByRole("group", {
      name: "Choose microphone",
    })
    await expect(args.onInputsOpen).toHaveBeenCalledOnce()
    const items = within(group).getAllByRole("menuitemradio")
    await expect(items.map((item) => item.textContent)).toEqual([
      "System default",
      ...inputs.map((input) => input.label),
    ])
    await expect(items[0]).toHaveAttribute("aria-checked", "true")
    await userEvent.click(
      screen.getByRole("menuitemradio", { name: "USB headset" })
    )
    await expect(args.onInputChange).toHaveBeenCalledWith("usb-headset")
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull())

    await userEvent.click(chooser)
    await expect(
      await screen.findByRole("menuitemradio", { name: "USB headset" })
    ).toHaveAttribute("aria-checked", "true")
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull())

    // The mic records as before; while it does, no choice.
    await userEvent.click(micOf())
    await screen.findByRole("button", { name: "Done" })
    await expect(chooser).not.toBeVisible()
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))
    await waitFor(() => expect(chooserOf()).toBeVisible())
  },
}

/**
 * From the keyboard: Tab from the mic to the chevron, Enter opens the
 * inputs at the chosen one, the arrows and Enter choose another, the
 * focus back on the chevron. Space on the mic still records.
 */
export const InputsKeyboard: Story = {
  args: { inputs, defaultInput: "built-in" },
  play: async ({ args }) => {
    micOf().focus()
    await userEvent.tab()
    await expect(chooserOf()).toHaveFocus()
    await userEvent.keyboard("{Enter}")
    const chosen = await screen.findByRole("menuitemradio", {
      name: "Built-in microphone",
    })
    await expect(chosen).toHaveAttribute("aria-checked", "true")
    await waitFor(() =>
      expect(screen.getAllByRole("menuitemradio")).toContain(
        document.activeElement
      )
    )
    // To the last, the virtual one.
    await userEvent.keyboard("{End}{Enter}")
    await expect(args.onInputChange).toHaveBeenCalledWith("loopback")
    await waitFor(() => expect(chooserOf()).toHaveFocus())
    await userEvent.keyboard("{ArrowDown}")
    await expect(
      await screen.findByRole("menuitemradio", { name: /^Loopback audio/ })
    ).toHaveAttribute("aria-checked", "true")
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(chooserOf()).toHaveFocus())
  },
}

/**
 * On a phone: the chevron is as tall as the mic's 40px, and under a
 * finger reaches past its end and above and below it, never over the
 * mic; the inputs open as a sheet, titled.
 */
export const InputsOnAPhone: Story = {
  ...onAPhone,
  args: { inputs },
  play: async ({ args }) => {
    const chooser = chooserOf()
    const mic = micOf().getBoundingClientRect()
    const box = chooser.getBoundingClientRect()
    await expect(box.height).toBe(40)
    await expect(box.width).toBe(24)
    const hit = coarseHitSize(chooser)
    await expect(hit.width).toBeGreaterThanOrEqual(24)
    await expect(hit.height).toBeGreaterThanOrEqual(44)
    // Its finger's reach starts at its own start, after the mic.
    const after = getComputedStyle(chooser, "::after")
    await expect(after.insetInlineStart).not.toMatch(/^-/)
    await expect(Math.abs(box.left - mic.right)).toBeLessThanOrEqual(1)
    await userEvent.click(chooser)
    const first = await screen.findByRole("menuitemradio", {
      name: "System default",
    })
    await waitFor(() => expect(first).toBeVisible())
    await expect(screen.getByText("Choose microphone")).toBeVisible()
    await userEvent.click(
      screen.getByRole("menuitemradio", { name: "USB headset" })
    )
    await expect(args.onInputChange).toHaveBeenCalledWith("usb-headset")
  },
}

/**
 * Inputs as listed before the microphone was allowed, with no names:
 * each named by its place; and one chosen before, now unplugged, shows
 * as the system default.
 */
export const InputsUnnamed: Story = {
  tags: ["!autodocs"],
  args: {
    inputs: [
      { id: "a", label: "" },
      { id: "b", label: " " },
    ],
    defaultInput: "unplugged",
  },
  play: async () => {
    await userEvent.click(chooserOf())
    const items = await screen.findAllByRole("menuitemradio")
    await expect(items.map((item) => item.textContent)).toEqual([
      "System default",
      "Microphone 1",
      "Microphone 2",
    ])
    await expect(items[0]).toHaveAttribute("aria-checked", "true")
  },
}

/** A recording starting (the browser asking for the microphone): no choice. */
export const InputsWhileStarting: Story = {
  tags: ["!autodocs"],
  args: { inputs, startPending: true },
  play: async () => {
    await userEvent.click(micOf())
    await waitFor(() => expect(chooserOf()).toBeDisabled())
  },
}
