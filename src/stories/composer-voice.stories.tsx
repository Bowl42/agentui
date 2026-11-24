import * as React from "react"
import { cn } from "cn"
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
  ComposerButton,
  ComposerEditor,
  ComposerSubmit,
  ComposerToolbar,
  ComposerVoice,
  type ComposerValue,
  type ComposerVoiceInput,
} from "@/components/composer"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { HugeiconsIcon } from "@hugeicons/react"
import { Clock01Icon } from "@hugeicons/core-free-icons"
import { onAPhone } from "@/stories/phone"
import { coarseHitSize } from "@/stories/touch"
import { reducedMotionAnimation } from "@/stories/motion"

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
  queue = false,
  ready = false,
  startDelay = 0,
  holdToTalk = false,
  atBottom = false,
  shortcut,
  name = "Message",
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
  /** A tool after the mic with a tooltip, as a queue button. */
  queue?: boolean
  /** Whether the app keeps the microphone open: a press records at once. */
  ready?: boolean
  /** How long opening the microphone takes, in ms. */
  startDelay?: number
  /** The key that drives the mic from anywhere, by its code. */
  shortcut?: string
  /** The editor's name. */
  name?: string
  /** Whether making out the words fails the first time. */
  failOnce?: boolean
  maxDuration?: number
  submitOnFinish?: boolean | "hold"
  /** The inputs the app found to record from. */
  inputs?: ComposerVoiceInput[]
  /** The one chosen before, kept by the app. */
  defaultInput?: string
  onSubmit?: (value: ComposerValue, options?: { talk: boolean }) => void
  /** Whether a long press on the composer talks, on a touch screen. */
  holdToTalk?: boolean
  /** At the bottom of a conversation, as in an app. */
  atBottom?: boolean
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
    <div
      className={cn(
        "mx-auto w-full max-w-2xl p-4",
        atBottom && "flex min-h-dvh flex-col justify-end gap-4"
      )}
    >
      {atBottom ? (
        <div className="flex flex-col gap-3 text-base leading-7">
          <p>Can you rename the upload helper?</p>
          <p className="text-muted-foreground">
            Sure: which name, and should the tests move with it?
          </p>
        </div>
      ) : null}
      <Composer
        onSubmit={(value, _event, options) => {
          onSubmit?.(value, options)
          return true
        }}
      >
        <ComposerEditor aria-label={name} placeholder="Ask anything" />
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
            shortcut={shortcut}
            ready={ready}
            holdToTalk={holdToTalk}
            // The app's words for its key; any other, the default.
            labels={
              shortcut === "AltRight"
                ? { shortcut: "Hold Right ⌥ to talk" }
                : undefined
            }
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
              if (startDelay)
                return new Promise<void>((resolve) =>
                  setTimeout(() => {
                    recorder.start()
                    resolve()
                  }, startDelay)
                )
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
          {queue ? (
            <Tooltip>
              <TooltipTrigger render={<ComposerButton aria-label="Queue" />}>
                <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} />
              </TooltipTrigger>
              <TooltipContent>Queue</TooltipContent>
            </Tooltip>
          ) : null}
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
/** The tooltip open, if any. */
const tooltipOf = () => document.querySelector("[data-slot=tooltip-content]")
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

/**
 * The editor has the focus again, the caret where the words went (or
 * where it was): `before` the text before it, nothing after it.
 */
async function caretAfter(before: RegExp) {
  // Shown again once the take is over.
  const editor = await screen.findByRole("textbox", { name: "Message" })
  await waitFor(() => expect(editor).toHaveFocus())
  await waitFor(() => {
    const selection = document.getSelection()!
    expect(selection.isCollapsed).toBe(true)
    expect(editor.contains(selection.anchorNode)).toBe(true)
    const range = document.createRange()
    range.selectNodeContents(editor)
    const caret = selection.getRangeAt(0)
    const after = range.cloneRange()
    after.setStart(caret.startContainer, caret.startOffset)
    range.setEnd(caret.startContainer, caret.startOffset)
    expect(after.toString()).toBe("")
    expect(range.toString()).toMatch(before)
  })
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
    await caretAfter(/import it$/)
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
    // Sent, the box empty: what is typed next starts a message.
    await waitFor(() => expect(editorOf()).toHaveTextContent(/^$/))
    await caretAfter(/^$/)
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
    await caretAfter(/^$/)
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
    await expect(await screen.findByText("Esc to cancel")).toBeVisible()
    await new Promise((resolve) => setTimeout(resolve, 400))
    await user.keyboard("[/Space]")
    await waitFor(() =>
      expect(editorOf()).toHaveTextContent("Rename the upload helper")
    )
    await caretAfter(/import it$/)
  },
}

/** Escape while Space holds it, as it says: dropped, not finished. */
export const HeldSpaceEscape: Story = {
  tags: ["!autodocs"],
  args: { live: true, heard: 6 },
  play: async ({ args }) => {
    const user = userEvent.setup()
    micOf().focus()
    await user.keyboard("[Space>]")
    await screen.findByText("Esc to cancel")
    await user.keyboard("{Escape}")
    await waitFor(() => expect(args.onCancel).toHaveBeenCalledOnce())
    await user.keyboard("[/Space]")
    await new Promise((resolve) => setTimeout(resolve, 300))
    await expect(args.onCancel).toHaveBeenCalledOnce()
    await expect(editorOf()).toHaveTextContent("")
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
    await caretAfter(/import it$/)
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

/** Types `text` in the editor, then moves the caret `left` back. */
async function draft(text: string, left = 0) {
  await userEvent.click(editorOf())
  await userEvent.keyboard(text)
  if (left) await userEvent.keyboard(`{ArrowLeft>${left}/}`)
}

/** The editor's text before the caret and after it, once focused again. */
async function caretBetween(before: string, after: string) {
  const editor = await screen.findByRole("textbox", { name: "Message" })
  await waitFor(() => expect(editor).toHaveFocus())
  await waitFor(() => {
    const selection = document.getSelection()!
    expect(selection.isCollapsed).toBe(true)
    const caret = selection.getRangeAt(0)
    const head = document.createRange()
    head.selectNodeContents(editor)
    const tail = head.cloneRange()
    head.setEnd(caret.startContainer, caret.startOffset)
    tail.setStart(caret.startContainer, caret.startOffset)
    expect(head.toString()).toBe(before)
    expect(tail.toString()).toBe(after)
  })
}

/**
 * The caret in the middle of the draft as the take starts: the words
 * go there, a space on either side, the caret after them.
 */
export const LiveInTheMiddle: Story = {
  args: { live: true, heard: 6, tick: 60_000 },
  play: async () => {
    await draft("hello world", 6)
    await userEvent.click(micOf())
    await userEvent.click(await screen.findByRole("button", { name: "Done" }))
    await waitFor(() =>
      expect(editorOf()).toHaveTextContent(
        /^hello Rename the upload helper to sendFile world$/
      )
    )
    await caretBetween("hello Rename the upload helper to sendFile", " world")
  },
}

/** Text selected as the take starts: the words take its place. */
export const LiveOverASelection: Story = {
  tags: ["!autodocs"],
  args: { live: true, heard: 6, tick: 60_000 },
  play: async () => {
    await draft("hello world")
    // "world" selected, as a double click would.
    const text = editorOf().querySelector("[data-lexical-text]")!.firstChild!
    document.getSelection()!.setBaseAndExtent(text, 6, text, 11)
    await waitFor(() =>
      expect(document.getSelection()!.toString()).toBe("world")
    )
    await wait(50)
    await userEvent.click(micOf())
    await userEvent.click(await screen.findByRole("button", { name: "Done" }))
    await caretAfter(/^hello Rename the upload helper to sendFile$/)
  },
}

/**
 * Japanese, written without spaces: the words go in beside it with
 * none.
 */
export const LiveBesideJapanese: Story = {
  tags: ["!autodocs"],
  args: { live: true, heard: 6, tick: 60_000 },
  play: async () => {
    await draft("ファイル名を")
    await userEvent.click(micOf())
    await userEvent.click(await screen.findByRole("button", { name: "Done" }))
    await caretAfter(/^ファイル名をRename the upload helper to sendFile$/)
  },
}

/**
 * Tapped with a draft, no live transcript: Done puts the words after
 * it, a space between.
 */
export const TappedInADraft: Story = {
  play: async () => {
    await draft("hello world")
    await userEvent.click(micOf())
    await expect(
      await screen.findByRole("status", { name: /^Recording 0:0/ })
    ).toBeVisible()
    await userEvent.click(screen.getByRole("button", { name: "Done" }))
    await waitFor(() =>
      expect(editorOf()).toHaveTextContent(
        /^hello world Rename the upload helper/
      )
    )
    await caretAfter(/^hello world Rename the upload helper.* import it$/)
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

/** Cancel, by its button: the editor again, as it was. */
export const FocusAfterCancel: Story = {
  tags: ["!autodocs"],
  play: async () => {
    await userEvent.click(editorOf())
    await userEvent.keyboard("Note: ")
    await userEvent.click(micOf())
    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }))
    await caretAfter(/^Note: $/)
  },
}

/** Escape while it records, tapped: dropped, the editor again. */
export const FocusAfterEscape: Story = {
  tags: ["!autodocs"],
  play: async ({ args }) => {
    await userEvent.click(micOf())
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Done" })).toHaveFocus()
    )
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(args.onCancel).toHaveBeenCalled())
    await caretAfter(/^$/)
  },
}

/** Escape while held: dropped, the editor again when let go. */
export const FocusAfterHeldEscape: Story = {
  tags: ["!autodocs"],
  args: { live: true, heard: 6 },
  play: async ({ args }) => {
    const x = await pressMic()
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(args.onCancel).toHaveBeenCalled())
    await letGo(x, 0)
    await caretAfter(/^$/)
  },
}

/** The words not made out, then Cancel: the editor again. */
export const FocusAfterFailure: Story = {
  tags: ["!autodocs"],
  args: { failOnce: true },
  play: async () => {
    await userEvent.click(micOf())
    await userEvent.click(await screen.findByRole("button", { name: "Done" }))
    await screen.findByRole("button", { name: "Retry" })
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))
    await caretAfter(/^$/)
  },
}

/**
 * A tool beside the mic with a tooltip: a take held by a pointer, let
 * go, leaves the focus in the editor, not on the page or that tool, and
 * no tooltip open.
 */
export const FocusBesideATool: Story = {
  tags: ["!autodocs"],
  args: { queue: true, live: true, heard: 6 },
  play: async () => {
    const x = await pressMic()
    await letGo(x, 400)
    await caretAfter(/^Rename the upload helper/)
    // A while later, still none.
    await new Promise((resolve) => setTimeout(resolve, 800))
    await expect(tooltipOf()).toBeNull()
    await expect(editorOf()).toHaveFocus()
  },
}

/** The same, held by Space: the focus was on the mic, hidden as it recorded. */
export const FocusBesideAToolSpace: Story = {
  tags: ["!autodocs"],
  args: { queue: true, live: true, heard: 6 },
  play: async () => {
    const user = userEvent.setup()
    micOf().focus()
    await user.keyboard("[Space>]")
    await screen.findByText("Esc to cancel")
    await new Promise((resolve) => setTimeout(resolve, 400))
    await user.keyboard("[/Space]")
    await caretAfter(/^Rename the upload helper/)
    await new Promise((resolve) => setTimeout(resolve, 800))
    await expect(tooltipOf()).toBeNull()
    await expect(editorOf()).toHaveFocus()
  },
}

/** Whether the next `key` going down past the page was prevented. */
function watchKey(code: string) {
  const seen: boolean[] = []
  const listener = (event: KeyboardEvent) => {
    if (event.code === code) seen.push(event.defaultPrevented)
  }
  document.addEventListener("keydown", listener)
  return {
    seen,
    stop: () => document.removeEventListener("keydown", listener),
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * A `shortcut` key, held alone from anywhere (here, nothing focused): it
 * records until let go ("Esc to cancel"), and with `submitOnFinish="hold"` sends; the key
 * itself does nothing else. The mic says so: in its tooltip, and as
 * `aria-keyshortcuts`.
 */
export const ShortcutHeld: Story = {
  args: { shortcut: "AltRight", live: true, heard: 6, submitOnFinish: "hold" },
  play: async ({ args }) => {
    // aria-keyshortcuts has no side for a key; the description does.
    await expect(micOf()).toHaveAttribute("aria-keyshortcuts", "Alt")
    await expect(micOf()).toHaveAccessibleDescription("Hold Right ⌥ to talk")
    await userEvent.hover(micOf())
    await waitFor(() =>
      expect(tooltipOf()).toHaveTextContent("Hold Right ⌥ to talk")
    )
    await userEvent.unhover(micOf())
    await waitFor(() => expect(tooltipOf()).toBeNull())
    ;(document.activeElement as HTMLElement | null)?.blur()

    const user = userEvent.setup()
    const key = watchKey("AltRight")
    await user.keyboard("[AltRight>]")
    key.stop()
    await expect(key.seen).toEqual([true])
    // Held by a key, nothing to slide: Escape cancels, and says so.
    await expect(await screen.findByText("Esc to cancel")).toBeVisible()
    await expect(screen.queryByText("Slide to cancel")).toBeNull()
    await wait(400)
    await user.keyboard("[/AltRight]")
    await waitFor(() => expect(args.onSubmit).toHaveBeenCalled())
  },
}

/**
 * No `labels.shortcut`: the tooltip and the description still name the
 * key exactly, from its code, as `aria-keyshortcuts` cannot.
 */
export const ShortcutDefaultLabel: Story = {
  tags: ["!autodocs"],
  args: { shortcut: "ControlRight" },
  play: async () => {
    await expect(micOf()).toHaveAttribute("aria-keyshortcuts", "Control")
    await expect(micOf()).toHaveAccessibleDescription("Hold Right Ctrl to talk")
    await userEvent.hover(micOf())
    await waitFor(() =>
      expect(tooltipOf()).toHaveTextContent("Hold Right Ctrl to talk")
    )
  },
}

/**
 * Tapped, it records until tapped again (or Done), the words then in the
 * box, not sent by `submitOnFinish="hold"`.
 */
export const ShortcutTapped: Story = {
  args: { shortcut: "AltRight", live: true, heard: 6, submitOnFinish: "hold" },
  play: async ({ args }) => {
    const user = userEvent.setup()
    await user.keyboard("[AltRight]")
    await expect(
      await screen.findByRole("button", { name: "Done" })
    ).toBeVisible()
    await wait(300)
    await user.keyboard("[AltRight]")
    await waitFor(() =>
      expect(editorOf()).toHaveTextContent(/^Rename the upload helper/)
    )
    await expect(args.onSubmit).not.toHaveBeenCalled()
    await expect(editorOf()).toHaveFocus()
  },
}

/**
 * Another key with it, as an Option or AltGr character is typed: no take
 * starts, the key goes through; one that had started is dropped.
 */
export const ShortcutWithAKey: Story = {
  args: { shortcut: "AltRight", live: true, heard: 6 },
  play: async ({ args }) => {
    const user = userEvent.setup()
    await user.click(editorOf())
    const key = watchKey("KeyE")
    await user.keyboard("[AltRight>][KeyE][/AltRight]")
    await wait(300)
    await expect(args.onStart).not.toHaveBeenCalled()
    await expect(key.seen).toEqual([false])

    // Held past its start, then another key: dropped.
    await user.keyboard("[AltRight>]")
    await waitFor(() => expect(args.onStart).toHaveBeenCalled())
    await screen.findByText("Esc to cancel")
    await user.keyboard("[KeyE]")
    key.stop()
    await expect(key.seen).toEqual([false, false])
    await waitFor(() => expect(args.onCancel).toHaveBeenCalled())
    await user.keyboard("[/AltRight]")
    await wait(300)
    await expect(
      screen.queryByRole("status", { name: /^Recording/ })
    ).toBeNull()
  },
}

/** Escape while it is held cancels; letting go then does nothing. */
export const ShortcutEscape: Story = {
  tags: ["!autodocs"],
  args: { shortcut: "AltRight", live: true, heard: 6 },
  play: async ({ args }) => {
    const user = userEvent.setup()
    await user.keyboard("[AltRight>]")
    await screen.findByText("Esc to cancel")
    await user.keyboard("{Escape}")
    await waitFor(() => expect(args.onCancel).toHaveBeenCalledOnce())
    await user.keyboard("[/AltRight]")
    await wait(300)
    await expect(args.onStart).toHaveBeenCalledOnce()
    await expect(args.onCancel).toHaveBeenCalledOnce()
    await expect(editorOf()).toHaveTextContent("")
  },
}

/**
 * The window losing the focus while it is held (its key-up never
 * comes): the take finishes, the words kept, not sent.
 */
export const ShortcutWindowBlur: Story = {
  tags: ["!autodocs"],
  args: { shortcut: "AltRight", live: true, heard: 6, submitOnFinish: "hold" },
  play: async ({ args }) => {
    const user = userEvent.setup()
    await user.keyboard("[AltRight>]")
    await screen.findByText("Esc to cancel")
    await wait(400)
    window.dispatchEvent(new FocusEvent("blur"))
    await waitFor(() =>
      expect(editorOf()).toHaveTextContent(/^Rename the upload helper/)
    )
    await expect(args.onSubmit).not.toHaveBeenCalled()
    await user.keyboard("[/AltRight]")
  },
}

const sideStart = fn()

/**
 * Two composers with the same key, a main one and a side panel's: the
 * one with the focus answers it, then still the one that last had it.
 */
export const ShortcutTwoComposers: Story = {
  tags: ["!autodocs"],
  args: { shortcut: "AltRight", live: true, heard: 6 },
  render: (args) => (
    <div className="grid gap-4 md:grid-cols-2">
      <Demo {...args} name="Main message" />
      <Demo {...args} name="Side message" onStart={sideStart} />
    </div>
  ),
  play: async ({ args }) => {
    sideStart.mockClear()
    const user = userEvent.setup()
    const side = screen.getByRole("textbox", { name: "Side message" })
    await user.click(side)
    await user.keyboard("[AltRight]")
    await waitFor(() => expect(sideStart).toHaveBeenCalledOnce())
    await expect(args.onStart).not.toHaveBeenCalled()
    await user.click(await screen.findByRole("button", { name: "Cancel" }))
    // Nothing focused now: the side panel's, as it last had it.
    ;(document.activeElement as HTMLElement | null)?.blur()
    await user.keyboard("[AltRight]")
    await waitFor(() => expect(sideStart).toHaveBeenCalledTimes(2))
    await expect(args.onStart).not.toHaveBeenCalled()
  },
}

/**
 * The app keeps the microphone open between takes: the idle mic says a
 * press records at once, its glyph in the text's colour with a dot at
 * its corner, and in its description.
 */
export const Ready: Story = {
  args: { ready: true },
  play: async () => {
    const mic = micOf()
    await expect(mic).toHaveAttribute("data-ready")
    await expect(mic).toHaveAccessibleDescription("Microphone ready")
    const dot = mic.querySelector("[data-slot=composer-voice-ready]")!
    await expect(dot).toBeVisible()
    // At the glyph's upper end corner, past it by 4px.
    const glyph = mic.querySelector("svg")!.getBoundingClientRect()
    const box = dot.getBoundingClientRect()
    await expect(Math.round(box.bottom - glyph.top)).toBe(4)
    const end =
      document.dir === "rtl" ? glyph.left - box.left : box.right - glyph.right
    await expect(Math.round(end)).toBe(4)
    // The text's colour, not the tools' grey.
    await expect(getComputedStyle(mic).color).toBe(
      getComputedStyle(editorOf()).color
    )
  },
}

/** Not ready (or not said): the mic as ever, no dot, no description. */
export const NotReady: Story = {
  tags: ["!autodocs"],
  play: async () => {
    const mic = micOf()
    await expect(mic).not.toHaveAttribute("data-ready")
    await expect(
      mic.querySelector("[data-slot=composer-voice-ready]")
    ).toBeNull()
    await expect(mic).toHaveAccessibleDescription("")
    await expect(getComputedStyle(mic).color).not.toBe(
      getComputedStyle(editorOf()).color
    )
  },
}

/**
 * A microphone slow to open: from the press until it has, a spinner in
 * the mic's glyph's place (still where the reader asks for less motion),
 * the mic busy and described as starting; then the recording.
 */
export const Starting: Story = {
  args: { startDelay: 1200, ready: true },
  play: async () => {
    const mic = micOf()
    await userEvent.click(mic)
    await waitFor(() => expect(mic).toHaveAttribute("aria-busy", "true"))
    await expect(mic).toHaveAccessibleDescription("Starting the microphone")
    await expect(mic).not.toHaveAttribute("data-ready")
    const spinner = mic.querySelector<SVGElement>("[data-slot=spinner]")!
    await expect(spinner).toBeVisible()
    await expect(reducedMotionAnimation(spinner)).toBe("none")
    await expect(
      await screen.findByRole(
        "status",
        { name: /^Recording/ },
        { timeout: 3000 }
      )
    ).toBeVisible()
  },
}

/** Held on a slow microphone and let go before it opened: a tap. */
export const StartingLetGo: Story = {
  tags: ["!autodocs"],
  args: { startDelay: 800 },
  play: async () => {
    const mic = micOf()
    const box = mic.getBoundingClientRect()
    const x = box.left + box.width / 2
    fireEvent.pointerDown(mic, { button: 0, pointerId: 7, clientX: x })
    await waitFor(() => expect(mic).toHaveAttribute("aria-busy", "true"))
    fireEvent.pointerUp(window, { pointerId: 7, clientX: x })
    await expect(
      await screen.findByRole("button", { name: "Done" }, { timeout: 3000 })
    ).toHaveFocus()
  },
}

const vibrate = fn()

/** A phone's touch screen, its vibration recorded. */
const onAPhoneScreen = {
  ...onAPhone,
  beforeEach: () => {
    vibrate.mockClear()
    const had = Object.getOwnPropertyDescriptor(navigator, "vibrate")
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: vibrate,
    })
    return () => {
      if (had) Object.defineProperty(navigator, "vibrate", had)
      else delete (navigator as { vibrate?: unknown }).vibrate
    }
  },
}

/** A finger on `target`, as a touch screen reports it. */
function finger(
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
  target: EventTarget,
  { x = 0, y = 0, id = 11, primary = true, pointerType = "touch" } = {}
) {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: id,
    pointerType,
    isPrimary: primary,
    clientX: x,
    clientY: y,
    button: type === "pointermove" ? -1 : 0,
  })
  target.dispatchEvent(event)
  return event
}

/** The middle of `element`. */
function middleOf(element: Element) {
  const box = element.getBoundingClientRect()
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
}

/** The editor, shown or not. */
const rootOf = () =>
  document.querySelector<HTMLElement>("[data-lexical-editor]")!
const overlayOf = () =>
  document.querySelector<HTMLElement>("[data-slot=composer-talk-overlay]")
const actionOf = () =>
  document.querySelector<HTMLElement>("[data-slot=composer-talk-action]")
const targetOf = (name: "cancel" | "text") =>
  document.querySelector<HTMLElement>(
    `[data-slot=composer-talk-target][data-target=${name}]`
  )!
/** The toolbar's background, beside its tools. */
const toolbarOf = () =>
  document.querySelector<HTMLElement>("[data-slot=composer-toolbar]")!
/** A point on the toolbar's background, clear of its tools. */
const toolbarSpot = () => {
  const box = toolbarOf().getBoundingClientRect()
  return { x: box.left + box.width / 2 - 40, y: box.top + box.height / 2 }
}

/** A finger held on `target` until its take is up. */
async function longPress(
  target: Element,
  at: { x: number; y: number } = middleOf(target)
) {
  finger("pointerdown", target, at)
  await waitFor(() => expect(targetOf("cancel")).toBeVisible())
  return at
}

/**
 * `holdToTalk`, on a phone with the keyboard down (the editor not
 * focused): a long press anywhere on the composer, the editor too, talks
 * (its text not selected meanwhile), a short vibration as it starts.
 * Over the conversation, above the composer: its words, time and
 * waveform, what letting go does, and where to slide to. Let go there,
 * its words are sent alone, the draft kept, the keyboard left down.
 */
export const HoldToTalk: Story = {
  ...onAPhoneScreen,
  args: { holdToTalk: true, live: true, heard: 6, atBottom: true },
  play: async ({ args }) => {
    await userEvent.click(editorOf())
    await userEvent.keyboard("Draft")
    editorOf().blur()
    const style = rootOf().style.cssText
    const at = await longPress(rootOf())
    await expect(vibrate).toHaveBeenCalledOnce()
    await expect(getComputedStyle(rootOf()).userSelect).toBe("none")
    await expect(actionOf()).toHaveTextContent("Release to send")
    const box = document
      .querySelector("[data-slot=composer]")!
      .getBoundingClientRect()
    await expect(overlayOf()!.getBoundingClientRect().bottom).toBeLessThan(
      box.top
    )
    await expect(
      await screen.findByText(/^Rename the upload helper/)
    ).toBeVisible()
    await wait(300)
    finger("pointerup", window, at)
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(
        [expect.stringMatching(/^Rename the upload helper/)],
        expect.objectContaining({ talk: true })
      )
    )
    await waitFor(() => expect(overlayOf()).toBeNull())
    await expect(rootOf()).toHaveTextContent(/^Draft$/)
    await expect(rootOf()).not.toHaveFocus()
    await waitFor(() => expect(rootOf().style.cssText).toBe(style))
  },
}

/**
 * The editor focused (the keyboard up): a long press on its text is the
 * platform's (select, the caret, paste), not a take; on the toolbar's
 * background it talks, and after, the editor has the focus again.
 */
export const HoldToTalkTyping: Story = {
  ...onAPhoneScreen,
  args: { holdToTalk: true, live: true, heard: 6, atBottom: true },
  play: async ({ args }) => {
    await userEvent.click(editorOf())
    await userEvent.keyboard("Draft")
    const text = finger("pointerdown", rootOf(), middleOf(rootOf()))
    await wait(700)
    finger("pointerup", window, middleOf(rootOf()))
    await expect(text.defaultPrevented).toBe(false)
    await expect(args.onStart).not.toHaveBeenCalled()
    await expect(overlayOf()).toBeNull()

    const at = await longPress(toolbarOf(), toolbarSpot())
    finger("pointerup", window, at)
    await waitFor(() => expect(args.onSubmit).toHaveBeenCalled())
    await waitFor(() => expect(rootOf()).toHaveFocus())
    await expect(rootOf()).toHaveTextContent(/^Draft$/)
  },
}

/**
 * Slid onto To text and let go: its words go in at the caret (or the
 * end), the editor focused to edit them before sending; nothing sent.
 * Each target lit and saying what letting go there does as the finger
 * comes on it, with a pulse.
 */
export const HoldToTalkToText: Story = {
  ...onAPhoneScreen,
  args: { holdToTalk: true, live: true, heard: 6, atBottom: true },
  play: async ({ args }) => {
    await userEvent.click(editorOf())
    await userEvent.keyboard("Draft: ")
    editorOf().blur()
    await longPress(rootOf())
    const cancel = middleOf(targetOf("cancel"))
    finger("pointermove", window, cancel)
    await waitFor(() => expect(targetOf("cancel")).toHaveAttribute("data-over"))
    await expect(targetOf("cancel")).toHaveTextContent("Release to cancel")
    await expect(actionOf()).toHaveTextContent("Release to cancel")
    const text = middleOf(targetOf("text"))
    finger("pointermove", window, text)
    await waitFor(() => expect(targetOf("text")).toHaveAttribute("data-over"))
    await expect(targetOf("cancel")).not.toHaveAttribute("data-over")
    await expect(targetOf("text")).toHaveTextContent("Release to convert")
    await expect(vibrate).toHaveBeenCalledTimes(3)
    finger("pointerup", window, text)
    await waitFor(() =>
      expect(editorOf()).toHaveTextContent(/^Draft: Rename the upload helper/)
    )
    await caretAfter(/^Draft: Rename the upload helper/)
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/** Slid onto Cancel and let go: dropped, nothing sent. */
export const HoldToTalkCancel: Story = {
  ...onAPhoneScreen,
  tags: ["!autodocs"],
  args: { holdToTalk: true, live: true, heard: 6, atBottom: true },
  play: async ({ args }) => {
    await longPress(toolbarOf(), toolbarSpot())
    const cancel = middleOf(targetOf("cancel"))
    finger("pointermove", window, cancel)
    await waitFor(() => expect(targetOf("cancel")).toHaveAttribute("data-over"))
    finger("pointerup", window, cancel)
    await waitFor(() => expect(args.onCancel).toHaveBeenCalled())
    await waitFor(() => expect(overlayOf()).toBeNull())
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/**
 * Not a long press: a tap (the editor's, as ever: nothing prevented), a
 * finger that moves first (a scroll), a press on a control, a mouse.
 */
export const HoldToTalkNotAPress: Story = {
  ...onAPhoneScreen,
  tags: ["!autodocs"],
  args: { holdToTalk: true, live: true, heard: 6, atBottom: true },
  play: async ({ args }) => {
    const at = middleOf(rootOf())
    const down = finger("pointerdown", rootOf(), at)
    await wait(100)
    const up = finger("pointerup", window, at)
    await expect([down.defaultPrevented, up.defaultPrevented]).toEqual([
      false,
      false,
    ])
    finger("pointerdown", rootOf(), at)
    finger("pointermove", window, { ...at, y: at.y - 30 })
    await wait(600)
    finger("pointerup", window, { ...at, y: at.y - 30 })
    const send = screen.getByRole("button", { name: "Send" })
    finger("pointerdown", send, middleOf(send))
    await wait(600)
    finger("pointerup", window, middleOf(send))
    finger("pointerdown", rootOf(), { ...at, pointerType: "mouse" })
    await wait(600)
    finger("pointerup", window, { ...at, pointerType: "mouse" })
    await expect(args.onStart).not.toHaveBeenCalled()
    await expect(overlayOf()).toBeNull()
  },
}

/**
 * What else ends a take held: a second finger and the touch cancelled
 * (by the system) drop it; the page hidden puts its words in the text,
 * not sent.
 */
export const HoldToTalkInterrupted: Story = {
  ...onAPhoneScreen,
  tags: ["!autodocs"],
  args: { holdToTalk: true, live: true, heard: 6, atBottom: true },
  play: async ({ args }) => {
    let at = await longPress(toolbarOf(), toolbarSpot())
    finger("pointerdown", toolbarOf(), { ...at, id: 12, primary: false })
    await waitFor(() => expect(args.onCancel).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(overlayOf()).toBeNull())
    finger("pointerup", window, at)

    at = await longPress(toolbarOf(), toolbarSpot())
    finger("pointercancel", window, at)
    await waitFor(() => expect(args.onCancel).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(overlayOf()).toBeNull())

    await longPress(toolbarOf(), toolbarSpot())
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    })
    document.dispatchEvent(new Event("visibilitychange"))
    delete (document as { visibilityState?: unknown }).visibilityState
    await waitFor(() =>
      expect(editorOf()).toHaveTextContent(/^Rename the upload helper/)
    )
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/**
 * A microphone slow to open: over the conversation, that it is starting;
 * let go before it opened, nothing is recorded or sent.
 */
export const HoldToTalkStarting: Story = {
  ...onAPhoneScreen,
  tags: ["!autodocs"],
  args: { holdToTalk: true, startDelay: 800, atBottom: true },
  play: async ({ args }) => {
    const at = toolbarSpot()
    finger("pointerdown", toolbarOf(), at)
    await waitFor(() =>
      expect(actionOf()).toHaveTextContent("Starting the microphone")
    )
    await expect(micOf()).toHaveAttribute("aria-busy", "true")
    finger("pointerup", window, at)
    await waitFor(() => expect(args.onCancel).toHaveBeenCalled(), {
      timeout: 2000,
    })
    await expect(overlayOf()).toBeNull()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/** Its last seconds counted down over the conversation; at its end, sent. */
export const HoldToTalkLimit: Story = {
  ...onAPhoneScreen,
  tags: ["!autodocs"],
  args: {
    holdToTalk: true,
    maxDuration: 60,
    duration: 53,
    tick: 250,
    atBottom: true,
  },
  play: async ({ args }) => {
    await longPress(toolbarOf(), toolbarSpot())
    await waitFor(() => expect(overlayOf()).toHaveTextContent(/\ds left/))
    await waitFor(() => expect(args.onSubmit).toHaveBeenCalled(), {
      timeout: 10_000,
    })
    await waitFor(() => expect(overlayOf()).toBeNull())
  },
}

/** Without `holdToTalk`, a long press on the composer is the page's. */
export const HoldToTalkOff: Story = {
  ...onAPhoneScreen,
  tags: ["!autodocs"],
  args: { atBottom: true },
  play: async ({ args }) => {
    finger("pointerdown", rootOf(), middleOf(rootOf()))
    await wait(700)
    finger("pointerup", window, middleOf(rootOf()))
    await expect(args.onStart).not.toHaveBeenCalled()
    await expect(overlayOf()).toBeNull()
  },
}
