import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  expect,
  fireEvent,
  fn,
  screen,
  userEvent,
  waitFor,
} from "storybook/test"

import {
  Composer,
  ComposerEditor,
  ComposerSubmit,
  ComposerToolbar,
  ComposerVoice,
  type ComposerValue,
} from "@/components/composer"
import { onAPhone } from "@/stories/phone"

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
  failOnce = false,
  maxDuration,
  submitOnFinish,
  onSubmit,
  onStart,
  onCancel,
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
  /** Whether making out the words fails the first time. */
  failOnce?: boolean
  maxDuration?: number
  submitOnFinish?: boolean | "hold"
  onSubmit?: (value: ComposerValue) => void
  onStart?: () => void
  onCancel?: () => void
}) {
  const recorder = useRecorder(tick, heard, duration)
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
            onStart={() => {
              onStart?.()
              if (startError)
                return Promise.reject(new DOMException("", startError))
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
  args: { onSubmit: fn(), onStart: fn(), onCancel: fn() },
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
