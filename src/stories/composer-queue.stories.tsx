import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { CommandIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
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
  composerText,
  type ComposerActions,
  type ComposerValue,
} from "@/components/composer"
import { ComposerQueue, type QueuedMessage } from "@/components/composer-queue"
import { FullToolbar } from "@/stories/composer-tools"
import { coarseHitSize } from "@/stories/touch"
import { quiet } from "@/stories/wait"

const three: QueuedMessage[] = [
  { id: "q1", text: "Also bump the changelog date", time: "2m" },
  {
    id: "q2",
    text: "Then open a PR against main with the release notes",
    time: "2m",
  },
  { id: "q3", text: "And tag it once CI is green", time: "3m" },
]

const twelve: QueuedMessage[] = [
  three[0]!,
  {
    id: "q2",
    text: "Then open a PR against main with the release notes, and request a review",
    time: "2m",
  },
  {
    id: "q3",
    text: "Use this mock for the pricing page and match the spacing of the hero section",
    time: "3m",
    attachments: [
      { id: "a1", name: "pricing.png", kind: "image" },
      { id: "a2", name: "hero.png", kind: "image" },
      { id: "a3", name: "pricing.md" },
    ],
  },
  {
    id: "q4",
    text: "Tag v0.1.9 once CI is green, then post the release notes in #releases",
    time: "4m",
  },
  {
    id: "q5",
    text: "Write a migration note: the rail API and which items to re-add",
    time: "4m",
  },
  {
    id: "q6",
    text: "Tell the app teams about the new composer parts",
    time: "4m",
  },
  { id: "q7", text: "Run the story tests in Chromium and WebKit", time: "5m" },
  {
    id: "q8",
    text: "Check contrast of the muted text in both themes",
    time: "6m",
  },
  {
    id: "q9",
    text: "Regenerate the registry and diff it against v0.1.8",
    time: "6m",
  },
  { id: "q10", text: "Update the screenshots in the README", time: "7m" },
  {
    id: "q11",
    text: "Close the stale issues about the old composer",
    time: "8m",
  },
  { id: "q12", text: "Draft the v0.2 plan from the review notes", time: "9m" },
]

type DemoProps = {
  initial: QueuedMessage[]
  sending?: boolean
  paused?: boolean
  pausedReason?: string
  /** A message sent at once, stopping the running turn. */
  onInterrupt: (text: string) => void
  onSendNow: (id: string) => void
  onReorder: (ids: string[]) => void
}

/**
 * A chat whose turn is running: Enter queues the message, Cmd+Enter
 * (Ctrl+Enter) sends it at once. The app owns the queue.
 */
function Demo({
  initial,
  sending,
  paused: initialPaused = false,
  pausedReason,
  onInterrupt,
  onSendNow,
  onReorder,
}: DemoProps) {
  const [items, setItems] = React.useState(initial)
  const [value, setValue] = React.useState<ComposerValue>([])
  const [editing, setEditing] = React.useState<string | null>(null)
  const [paused, setPaused] = React.useState(initialPaused)
  // What the composer held before an edit, to put back after it.
  const draft = React.useRef<ComposerValue>([])
  const nextId = React.useRef(0)
  const composer = React.useRef<ComposerActions>(null)

  const cancelEdit = () => {
    setEditing(null)
    setValue(draft.current)
  }

  return (
    <div className="flex w-2xl max-w-full flex-col">
      <ComposerQueue
        items={items}
        editing={editing}
        sending={sending}
        paused={paused}
        pausedReason={pausedReason}
        status={
          <>
            <span aria-hidden className="size-1.5 rounded-full bg-foreground" />
            Running · the next one is sent when this turn ends
          </>
        }
        statusDetail="1m 12s in"
        onReorder={(ids) => {
          onReorder(ids)
          setItems((current) =>
            ids.map((id) => current.find((item) => item.id === id)!)
          )
        }}
        onEdit={(id) => {
          draft.current = value
          setEditing(id)
          setValue([items.find((item) => item.id === id)!.text])
          // To go on typing at its end.
          requestAnimationFrame(() => composer.current?.focus())
        }}
        onCancelEdit={cancelEdit}
        onSaveEdit={(id, text) =>
          setItems((current) =>
            current.map((item) => (item.id === id ? { ...item, text } : item))
          )
        }
        onSendNow={(id) => {
          onSendNow(id)
          setItems((current) => current.filter((item) => item.id !== id))
        }}
        onRemove={(ids) =>
          setItems((current) =>
            current.filter((item) => !ids.includes(item.id))
          )
        }
        onClear={() => setItems([])}
        onPause={() => setPaused(true)}
        onResume={() => setPaused(false)}
      />
      <Composer
        value={value}
        actionsRef={composer}
        onValueChange={setValue}
        // A paused queue: the turn stopped, nothing runs.
        status={paused ? "ready" : "running"}
        // Escape puts an edited message back as it was, before it stops
        // the running turn.
        editing={editing ? "queued" : false}
        onCancelEdit={cancelEdit}
        onSubmit={(message, _event, { interrupt }) => {
          const text = composerText(message).trim()
          if (editing) {
            setItems((current) =>
              current.map((item) =>
                item.id === editing ? { ...item, text } : item
              )
            )
            setEditing(null)
            setValue(draft.current)
            return
          }
          setValue([])
          if (interrupt) {
            onInterrupt(text)
            return
          }
          nextId.current += 1
          setItems((current) => [
            ...current,
            { id: `new-${nextId.current}`, text, time: "now" },
          ])
        }}
      >
        <ComposerEditor aria-label="Message" placeholder="Ask anything" />
        <FullToolbar />
      </Composer>
    </div>
  )
}

const meta = {
  title: "Components/Composer Queue",
  component: Demo,
  parameters: { layout: "centered" },
  args: {
    initial: three,
    onInterrupt: fn(),
    onSendNow: fn(),
    onReorder: fn(),
  },
} satisfies Meta<typeof Demo>

export default meta
type Story = StoryObj<typeof meta>

const rows = (element: HTMLElement) =>
  within(
    element.querySelector<HTMLElement>("[data-slot=composer-queue-list]")!
  ).getAllByRole("listitem")

const texts = (element: HTMLElement) =>
  rows(element).map(
    (row) => row.querySelector("[id]:not([data-slot])")?.textContent
  )

/**
 * While a turn runs, Enter queues the message on the shelf, marked for a
 * moment and read out; Cmd+Enter (Ctrl+Enter) sends it at once instead.
 */
export const Default: Story = {
  args: { initial: three.slice(0, 2) },
  play: async ({ canvas, canvasElement, args }) => {
    const shelf = canvas.getByRole("region", { name: /^2 queued/ })
    await expect(rows(canvasElement)).toHaveLength(2)
    // While it runs, stop and the raised send, even with the box empty.
    const stop = canvas.getByRole("button", { name: "Stop" })
    const send = canvas.getByRole("button", { name: "Send" })
    await expect(send).toHaveAttribute("aria-disabled", "true")
    await expect(getComputedStyle(send).color).toBe(
      getComputedStyle(canvasElement).color
    )
    await expect(
      send.getBoundingClientRect().left - stop.getBoundingClientRect().right
    ).toBe(10)

    // The header 4px inside the shelf's hairline; a row's handle a bare
    // 14px glyph, its index and text at 35 and 61.
    const box = shelf.getBoundingClientRect()
    const header = shelf.querySelector("[data-slot=composer-queue-header]")!
    await expect(header.getBoundingClientRect().top - box.top).toBe(5)
    const first = rows(canvasElement)[0]!
    const at = (selector: string) =>
      first.querySelector(selector)!.getBoundingClientRect().left - box.left
    await expect(
      first
        .querySelector("[data-slot=composer-queue-handle]")!
        .getBoundingClientRect().width
    ).toBe(14)
    await expect(at("[data-slot=composer-queue-index]")).toBe(35)
    await expect(at("[id]:not([data-slot])")).toBe(59)

    const editor = canvas.getByRole("textbox", { name: "Message" })
    await userEvent.click(editor)
    await userEvent.keyboard("And tag it once CI is green{Enter}")
    await waitFor(() =>
      expect(canvas.getByRole("region", { name: /^3 queued/ })).toBe(shelf)
    )
    const added = rows(canvasElement)[2]!
    await expect(added).toHaveTextContent("And tag it once CI is green")
    await expect(added).toHaveAttribute("data-fresh")
    await expect(within(shelf).getByRole("status")).toHaveTextContent(
      "Queued: And tag it once CI is green"
    )

    // Cmd+Enter (Ctrl+Enter) interrupts instead of queueing.
    await userEvent.keyboard("Do this first{Control>}{Enter}{/Control}")
    await waitFor(() =>
      expect(args.onInterrupt).toHaveBeenCalledWith("Do this first")
    )
    await expect(rows(canvasElement)).toHaveLength(3)
  },
}

/**
 * Hovering or focusing a row shows its actions: edit, send now (which
 * stops the running turn) and remove.
 */
export const Actions: Story = {
  play: async ({ canvas, canvasElement, args }) => {
    const second = rows(canvasElement)[1]!
    const actions = second.querySelector<HTMLElement>(
      "[data-slot=composer-queue-actions]"
    )!
    await expect(getComputedStyle(actions).opacity).toBe("0")
    within(second).getByRole("button", { name: "Move message 2" }).focus()
    await waitFor(() => expect(getComputedStyle(actions).opacity).toBe("1"))
    // 14px icons in 26px buttons.
    for (const icon of actions.querySelectorAll("svg"))
      await expect(icon.getBoundingClientRect().width).toBe(14)

    const send = within(second).getByRole("button", { name: "Send now" })
    await expect(send).toHaveAccessibleDescription(
      "Then open a PR against main with the release notes"
    )
    // 24px at least to a mouse (40px to a finger, by its size).
    await expect(coarseHitSize(send).height).toBeGreaterThanOrEqual(24)
    await userEvent.click(send)
    await expect(args.onSendNow).toHaveBeenCalledWith("q2")
    await waitFor(() => expect(rows(canvasElement)).toHaveLength(2))
    // Focus moves to the next one, not lost with the row.
    await expect(
      canvas.getByRole("button", { name: "Move message 2" })
    ).toHaveFocus()

    const remove = within(rows(canvasElement)[1]!).getByRole("button", {
      name: "Remove",
    })
    await userEvent.click(remove)
    await waitFor(() => expect(rows(canvasElement)).toHaveLength(1))
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Removed from the queue"
    )
  },
}

/**
 * Edit puts a message back in the composer and strikes it through on the
 * shelf; Enter saves it in its place, Escape puts it back unchanged.
 */
export const Edit: Story = {
  play: async ({ canvas, canvasElement }) => {
    const editor = canvas.getByRole("textbox", { name: "Message" })
    await userEvent.click(
      within(rows(canvasElement)[1]!).getByRole("button", { name: "Edit" })
    )
    await waitFor(() =>
      expect(editor).toHaveTextContent(
        "Then open a PR against main with the release notes"
      )
    )
    // The shelf fades in.
    await waitFor(() =>
      expect(
        canvas.getByRole("region", { name: "Editing queued message 2" })
      ).toBeVisible()
    )
    await expect(rows(canvasElement)[1]).toHaveAttribute("data-editing")
    // A labelled Update ↵ in the send's place, and no stop beside it.
    const update = canvas.getByRole("button", { name: "Update" })
    await expect(update).toHaveTextContent("Update↵")
    // 32px, once its transition from the round button ends.
    await waitFor(() => expect(update.getBoundingClientRect().height).toBe(32))
    await expect(canvas.queryByRole("button", { name: "Stop" })).toBeNull()

    // Escape: back as it was, and the turn keeps running.
    await waitFor(() => expect(editor).toHaveFocus())
    await userEvent.keyboard(", and request a review{Escape}")
    await waitFor(() =>
      expect(canvas.getByRole("region", { name: /^3 queued/ })).toBeVisible()
    )
    await expect(texts(canvasElement)[1]).toBe(
      "Then open a PR against main with the release notes"
    )
    await expect(editor.textContent).toBe("")
    await expect(canvas.getByRole("button", { name: "Stop" })).toBeVisible()

    // Enter: saved in its place.
    await userEvent.click(
      within(rows(canvasElement)[2]!).getByRole("button", { name: "Edit" })
    )
    await waitFor(() =>
      expect(editor).toHaveTextContent("And tag it once CI is green")
    )
    await waitFor(() => expect(editor).toHaveFocus())
    await userEvent.keyboard(" and the docs are up{Enter}")
    await waitFor(() =>
      expect(texts(canvasElement)[2]).toBe(
        "And tag it once CI is green and the docs are up"
      )
    )
    await expect(rows(canvasElement)).toHaveLength(3)
  },
}

/**
 * Move to top on a row past the first, by its other actions, as dragging
 * and Alt+ArrowUp are not found by looking; the manager's button with
 * two or three too, wherever they can be moved.
 */
export const MoveToTop: Story = {
  play: async ({ canvas, canvasElement, args }) => {
    await expect(
      canvas.getByRole("button", { name: "Manage queue" })
    ).toBeInTheDocument()
    await expect(
      within(rows(canvasElement)[0]!).queryByRole("button", {
        name: "Move to top",
      })
    ).toBeNull()
    const third = rows(canvasElement)[2]!
    await userEvent.hover(third)
    await userEvent.click(
      within(third).getByRole("button", { name: "Move to top" })
    )
    await expect(args.onReorder).toHaveBeenLastCalledWith(["q3", "q1", "q2"])
    await waitFor(() =>
      expect(texts(canvasElement)[0]).toBe("And tag it once CI is green")
    )
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Moved to position 1 of 3"
    )
  },
}

/**
 * A command queued among messages ("Compact conversation"): its icon
 * before its words, and no text to edit, so no edit button nor E key on
 * it, on the shelf or in the manager; send now and remove as any.
 */
export const Command: Story = {
  args: {
    // Enough to have the manager's button.
    initial: [
      twelve[0]!,
      {
        id: "qc",
        text: "Compact conversation",
        icon: <HugeiconsIcon icon={CommandIcon} strokeWidth={2} />,
        editable: false,
      },
      ...twelve.slice(1, 6),
    ],
  },
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(
      canvasElement.querySelector<HTMLElement>(
        "[data-slot=composer-queue-more]"
      )!
    )
    await waitFor(() => expect(rows(canvasElement).length).toBeGreaterThan(1))
    const command = rows(canvasElement)[1]!
    const icon = command.querySelector("[data-slot=composer-queue-icon] svg")!
    await expect(icon.getBoundingClientRect().width).toBe(14)
    await expect(
      within(command).queryByRole("button", { name: "Edit" })
    ).toBeNull()
    await expect(
      within(command).getByRole("button", { name: "Send now" })
    ).toBeInTheDocument()
    await expect(
      within(command).getByRole("button", { name: "Remove" })
    ).toBeInTheDocument()
    // A message keeps its edit.
    await expect(
      within(rows(canvasElement)[2]!).getByRole("button", { name: "Edit" })
    ).toBeInTheDocument()

    await userEvent.click(canvas.getByRole("button", { name: "Manage queue" }))
    const dialog = await screen.findByRole("dialog", { name: "Queue" })
    await waitFor(() => expect(dialog).toBeVisible())
    const row = dialogRows(dialog)[1]!
    await expect(
      row.querySelector("[data-slot=composer-queue-icon] svg")
    ).not.toBeNull()
    await expect(within(row).queryByRole("button", { name: "Edit" })).toBeNull()
    within(row).getByRole("checkbox").focus()
    await userEvent.keyboard("e")
    await expect(
      within(dialog).queryByRole("textbox", { name: "Edit" })
    ).toBeNull()
    await userEvent.keyboard("{Escape}")
  },
}

/**
 * A message another agent or session sent waits in the queue as the
 * reader's do: where it comes from (`from`) before its text, a fainter
 * grey, cut to a third of the row so the text keeps it; read with it,
 * a link to the sender kept a link; over its text in the queue's
 * manager.
 */
export const From: Story = {
  args: {
    initial: [
      twelve[0]!,
      {
        id: "qf",
        text: "The login test fails on a clean checkout; can you look before tagging?",
        from: (
          <a href="#review-agent">
            Review agent in another session with a long name
          </a>
        ),
      },
      ...twelve.slice(1, 6),
    ],
  },
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(
      canvasElement.querySelector<HTMLElement>(
        "[data-slot=composer-queue-more]"
      )!
    )
    await waitFor(() => expect(rows(canvasElement).length).toBeGreaterThan(1))
    const row = rows(canvasElement)[1]!
    const from = row.querySelector<HTMLElement>(
      "[data-slot=composer-queue-from]"
    )!
    const text = row.querySelector<HTMLElement>("[id]:not([data-slot])")!
    // Before the text, a third of the row at most, cut; the text keeps
    // the rest.
    const box = row.getBoundingClientRect()
    // A hair over in Firefox on Linux, its layout's rounding.
    await expect(from.getBoundingClientRect().right).toBeLessThanOrEqual(
      text.getBoundingClientRect().left + 0.01
    )
    // Within a pixel: WebKit under load lays it out a fraction wider.
    await expect(from.getBoundingClientRect().width).toBeLessThanOrEqual(
      box.width / 3 + 1
    )
    await expect(from.scrollWidth).toBeGreaterThan(from.clientWidth)
    await expect(text.getBoundingClientRect().width).toBeGreaterThan(
      box.width / 3
    )
    // Read with it: not hidden, and its buttons say whose it is.
    await expect(from.closest("[aria-hidden=true]")).toBeNull()
    await expect(
      within(row).getByRole("button", { name: "Edit" })
    ).toHaveAccessibleDescription(
      "Review agent in another session with a long name The login test fails on a clean checkout; can you look before tagging?"
    )
    // Its link is one, to focus.
    const link = within(row).getByRole("link", {
      name: "Review agent in another session with a long name",
    })
    link.focus()
    await expect(link).toHaveFocus()

    // In the manager, over its text.
    await userEvent.click(canvas.getByRole("button", { name: "Manage queue" }))
    const dialog = await screen.findByRole("dialog", { name: "Queue" })
    await waitFor(() => expect(dialog).toBeVisible())
    const managed = dialogRows(dialog)[1]!
    const over = managed.querySelector<HTMLElement>(
      "[data-slot=composer-queue-from]"
    )!
    await expect(over).toHaveTextContent(
      "Review agent in another session with a long name"
    )
    // Within layout's rounding (a hundred-thousandth of a pixel over in
    // Firefox and WebKit on Linux).
    await expect(over.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      within(managed)
        .getByText(/^The login test fails/)
        .getBoundingClientRect().top + 0.01
    )
    await expect(
      within(managed).getByRole("link", { name: /^Review agent/ })
    ).toBeInTheDocument()
    await userEvent.keyboard("{Escape}")
  },
}

/**
 * Alt+ArrowUp and Alt+ArrowDown (Option on a Mac) move a message; focus
 * stays on it and screen readers hear where it went.
 */
export const KeyboardReorder: Story = {
  play: async ({ canvas, canvasElement, args }) => {
    const handle = canvas.getByRole("button", { name: "Move message 1" })
    await expect(handle).toHaveAttribute(
      "aria-keyshortcuts",
      "Alt+ArrowUp Alt+ArrowDown"
    )
    handle.focus()
    await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}")
    await waitFor(() =>
      expect(args.onReorder).toHaveBeenCalledWith(["q2", "q1", "q3"])
    )
    await waitFor(() =>
      expect(texts(canvasElement)[1]).toBe("Also bump the changelog date")
    )
    await expect(rows(canvasElement)[1]).toContainElement(
      document.activeElement as HTMLElement
    )
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Moved to position 2 of 3"
    )
    await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}")
    await waitFor(() =>
      expect(texts(canvasElement)[2]).toBe("Also bump the changelog date")
    )
    await expect(rows(canvasElement)[2]).toContainElement(
      document.activeElement as HTMLElement
    )
    // Not past the end.
    await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}")
    await expect(args.onReorder).toHaveBeenCalledTimes(2)
  },
}

/** Dragging a row's handle moves it; a dashed slot shows where it lands. */
export const DragReorder: Story = {
  play: async ({ canvasElement, args }) => {
    const handle = rows(canvasElement)[0]!.querySelector<HTMLElement>(
      "[data-slot=composer-queue-handle]"
    )!
    const box = handle.getBoundingClientRect()
    const x = box.left + box.width / 2
    const y = box.top + box.height / 2
    const height = rows(canvasElement)[0]!.offsetHeight
    fireEvent.pointerDown(handle, {
      button: 0,
      pointerId: 1,
      clientX: x,
      clientY: y,
    })
    fireEvent.pointerMove(handle, {
      pointerId: 1,
      clientX: x,
      clientY: y + height * 1.2,
    })
    await waitFor(() =>
      expect(
        canvasElement.querySelector("[data-slot=composer-queue-slot]")
      ).toBeInTheDocument()
    )
    const lifted = rows(canvasElement)[0]!
    await expect(lifted).toHaveAttribute("data-dragging")
    // Lifted: 8px right of the rows, with no row actions and a grey
    // handle.
    await expect(lifted.getBoundingClientRect().left).toBeCloseTo(
      rows(canvasElement)[2]!.getBoundingClientRect().left + 8,
      0
    )
    await expect(
      lifted.querySelector("[data-slot=composer-queue-actions]")
    ).toBeNull()
    await expect(getComputedStyle(handle).color).toBe(
      getComputedStyle(
        rows(canvasElement)[2]!.querySelector(
          "[data-slot=composer-queue-handle]"
        )!
      ).color
    )
    fireEvent.pointerUp(handle, {
      pointerId: 1,
      clientX: x,
      clientY: y + height * 1.2,
    })
    await expect(args.onReorder).toHaveBeenCalledWith(["q2", "q1", "q3"])
    await waitFor(() =>
      expect(texts(canvasElement)).toEqual([
        "Then open a PR against main with the release notes",
        "Also bump the changelog date",
        "And tag it once CI is green",
      ])
    )
    await expect(
      canvasElement.querySelector("[data-slot=composer-queue-slot]")
    ).toBeNull()
  },
}

/** A message with files shows their thumbnails and how many there are. */
export const Attachments: Story = {
  args: {
    initial: [
      {
        id: "q1",
        text: "Use this mock for the pricing page",
        attachments: [
          { id: "a1", name: "pricing.png", kind: "image" },
          { id: "a2", name: "pricing.md" },
        ],
      },
      three[1]!,
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(rows(canvasElement)[0]).toHaveTextContent("2 files")
    await expect(
      rows(canvasElement)[0]!.querySelectorAll(
        "[data-slot=composer-queue-thumb]"
      )
    ).toHaveLength(2)
  },
}

/**
 * Past three messages, the shelf shows the first and how many more; the
 * button shows them all, and the corner one opens the manager.
 */
export const Long: Story = {
  args: { initial: twelve.slice(0, 6) },
  play: async ({ canvas, canvasElement }) => {
    await expect(rows(canvasElement)).toHaveLength(1)
    const more = canvas.getByRole("button", { name: "5 more" })
    await expect(more).toHaveAttribute("aria-expanded", "false")
    await userEvent.click(more)
    await expect(rows(canvasElement)).toHaveLength(6)
    await userEvent.click(canvas.getByRole("button", { name: "Show less" }))
    await expect(rows(canvasElement)).toHaveLength(1)
  },
}

/** Clear all empties the queue, and the shelf goes. */
export const LongClear: Story = {
  tags: ["!autodocs"],
  args: Long.args,
  play: async ({ canvas }) => {
    const clear = canvas.getByRole("button", { name: "Clear all" })
    // In the text's colour, as a button's words; not the header's grey.
    await expect(getComputedStyle(clear).color).toBe(
      getComputedStyle(document.body).color
    )
    await userEvent.click(clear)
    await waitFor(() =>
      expect(canvas.queryByRole("region", { name: /queued/ })).toBeNull()
    )
  },
}

const dialogRows = (dialog: HTMLElement) =>
  within(within(dialog).getByRole("list", { name: "Queue" })).getAllByRole(
    "listitem"
  )

/**
 * The manager lists every message: filter them, select some to move or
 * remove together, edit one in place, and move one with Alt and the arrow
 * keys. Escape leaves an edit, then a selection, then the dialog.
 */
export const Manager: Story = {
  args: { initial: twelve },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Manage queue" }))
    const dialog = await screen.findByRole("dialog", { name: "Queue" })
    await waitFor(() => expect(dialog).toBeVisible())
    // Focus has moved in, so it does not move again under the test.
    await waitFor(() =>
      expect(dialog).toContainElement(document.activeElement as HTMLElement)
    )
    await expect(dialogRows(dialog)).toHaveLength(12)
    await expect(dialog).toHaveAccessibleDescription(
      "Running · the next one is sent when this turn ends · 1m 12s in"
    )

    // Select two and move them to the top.
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: "Select message 3" })
    )
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: "Select message 5" })
    )
    const toolbar = within(dialog).getByRole("toolbar", { name: "2 selected" })
    await userEvent.click(
      within(toolbar).getByRole("button", { name: "Move to top" })
    )
    await expect(args.onReorder).toHaveBeenLastCalledWith([
      "q3",
      "q5",
      ...twelve
        .map((item) => item.id)
        .filter((id) => id !== "q3" && id !== "q5"),
    ])
    await waitFor(() =>
      expect(dialogRows(dialog)[0]).toHaveTextContent(
        "Use this mock for the pricing page"
      )
    )
    // Escape clears the selection first.
    await userEvent.keyboard("{Escape}")
    await waitFor(() =>
      expect(within(dialog).queryByRole("toolbar")).toBeNull()
    )
    await expect(dialog).toBeVisible()
    // Focus leaves the bar for the first that was selected.
    await waitFor(() =>
      expect(
        within(dialog).getByRole("checkbox", { name: "Select message 1" })
      ).toHaveFocus()
    )

    // The keyboard: arrows move between rows, E edits in place.
    const first = within(dialog).getByRole("checkbox", {
      name: "Select message 1",
    })
    first.focus()
    await userEvent.keyboard("{ArrowDown}")
    await expect(
      within(dialog).getByRole("checkbox", { name: "Select message 2" })
    ).toHaveFocus()
    await userEvent.keyboard("{Alt>}{ArrowUp}{/Alt}")
    await waitFor(() =>
      expect(dialogRows(dialog)[0]).toHaveTextContent("Write a migration note")
    )
    await userEvent.keyboard("e")
    const edit = within(dialog).getByRole("textbox", { name: "Edit" })
    await waitFor(() => expect(edit).toHaveFocus())
    await userEvent.keyboard(" for the apps{Enter}")
    await waitFor(() =>
      expect(dialogRows(dialog)[0]).toHaveTextContent(
        "Write a migration note: the rail API and which items to re-add for the apps"
      )
    )

    // Filter.
    await userEvent.keyboard("/")
    const filter = within(dialog).getByRole("searchbox", { name: "Filter" })
    await expect(filter).toHaveFocus()
    await userEvent.keyboard("readme")
    await waitFor(() => expect(dialogRows(dialog)).toHaveLength(1))
    await expect(dialog).toHaveTextContent("1 of 12")

    // Escape with nothing selected closes it.
    await userEvent.click(dialogRows(dialog)[0]!)
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  },
}

/**
 * The manager as the design draws it: three selected, with what the bar
 * does to them and that Escape clears them, and one edited in place.
 */
export const ManagerSelected: Story = {
  args: { initial: twelve },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Manage queue" }))
    const dialog = await screen.findByRole("dialog", { name: "Queue" })
    await waitFor(() => expect(dialog).toBeVisible())
    await waitFor(() =>
      expect(dialog).toContainElement(document.activeElement as HTMLElement)
    )
    for (const position of [2, 3, 5]) {
      await userEvent.click(
        within(dialog).getByRole("checkbox", {
          name: `Select message ${position}`,
        })
      )
    }
    const toolbar = within(dialog).getByRole("toolbar", { name: "3 selected" })
    await expect(toolbar).toHaveTextContent("Esc to clear")
    // Measured once it has zoomed in and its toolbar come.
    await quiet(dialog)
    // Rows 40px apart.
    const items = [
      ...dialog.querySelectorAll("[data-slot=composer-queue-dialog-item]"),
    ]
    await expect(
      items[1]!.getBoundingClientRect().top -
        items[0]!.getBoundingClientRect().top
    ).toBe(40)

    // Edited in place: the text stays where it was, Cancel and Save under.
    // (In its row: the list may scroll it into view.)
    const inRow = (element: Element) => {
      const box = element.getBoundingClientRect()
      const row = items[3]!.getBoundingClientRect()
      return [box.left - row.left, box.top - row.top, box.height]
    }
    const text = inRow(items[3]!.querySelector("div[id]")!)
    within(dialog).getByRole("checkbox", { name: "Select message 4" }).focus()
    await userEvent.keyboard("e")
    const edit = within(dialog).getByRole("textbox", { name: "Edit" })
    await waitFor(() => expect(edit).toHaveFocus())
    await expect(inRow(edit)).toEqual(text)
    const field = edit.getBoundingClientRect()
    const save = within(dialog).getByRole("button", { name: "Save" })
    await expect(save).toBeVisible()
    await expect(save.getBoundingClientRect().top).toBe(field.bottom + 8)
  },
}

/** When a turn ends, the first is sent: it shows it is sending. */
export const Sending: Story = {
  args: { initial: three.slice(0, 2), sending: true },
  play: async ({ canvasElement }) => {
    const first = rows(canvasElement)[0]!
    await expect(first).toHaveAttribute("data-sending")
    await expect(first).toHaveTextContent("Sending…")
    await expect(
      within(first).queryByRole("button", { name: "Move message 1" })
    ).toBeNull()
    // The one going out in the text's colour, the rest grey.
    await expect(getComputedStyle(first).color).toBe(
      getComputedStyle(canvasElement).color
    )
    await expect(getComputedStyle(rows(canvasElement)[1]!).color).not.toBe(
      getComputedStyle(canvasElement).color
    )
  },
}

/**
 * On a phone, one row over the composer: the next message and how many
 * more; pressed, the whole queue, full screen.
 */
export const Phone: Story = {
  parameters: {
    viewport: {
      options: {
        phone: {
          name: "Phone",
          styles: { width: "390px", height: "844px" },
          type: "mobile",
        },
      },
    },
  },
  globals: { viewport: { value: "phone", isRotated: false } },
  play: async ({ canvas, canvasElement }) => {
    const shelf = canvas.getByRole("region", { name: "3 queued" })
    await expect(
      shelf.querySelectorAll("[data-slot=composer-queue-item]")
    ).toHaveLength(0)
    const row = within(shelf).getByRole("button", {
      name: "Also bump the changelog date +2",
    })
    // 36px over the composer, 9px in from its sides: the shelf's inset
    // and its edge.
    const composer = canvasElement
      .querySelector("[data-slot=composer] [data-slot=input-group]")!
      .getBoundingClientRect()
    const box = row.getBoundingClientRect()
    await expect(composer.top - box.top).toBe(36)
    await expect([
      box.left - composer.left,
      composer.right - box.right,
    ]).toEqual([9, 9])

    await userEvent.click(row)
    const dialog = await screen.findByRole("dialog", { name: "Queue" })
    await waitFor(() =>
      expect(dialog.getBoundingClientRect().width).toBe(window.innerWidth)
    )
    await expect(dialog.getBoundingClientRect().height).toBe(window.innerHeight)
  },
}

/**
 * When a turn fails or is stopped, the queue waits: the app pauses it,
 * says why, and offers to resume or clear it.
 */
export const Paused: Story = {
  args: {
    initial: three.slice(0, 2),
    paused: true,
    pausedReason: "the last turn stopped with an error",
  },
  play: async ({ canvas }) => {
    // The shelf fades in.
    await waitFor(() =>
      expect(
        canvas.getByRole("region", {
          name: "Queue paused · the last turn stopped with an error",
        })
      ).toBeVisible()
    )
    // The turn has stopped: nothing to stop, the send button is back.
    await expect(canvas.getByRole("button", { name: "Send" })).toBeVisible()
    await expect(canvas.queryByRole("button", { name: "Stop" })).toBeNull()
  },
}

/** Resume: the queue sends again when the next turn ends. */
export const PausedResume: Story = {
  tags: ["!autodocs"],
  args: Paused.args,
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Resume" }))
    await waitFor(() =>
      expect(canvas.getByRole("region", { name: /^2 queued/ })).toBeVisible()
    )
  },
}
