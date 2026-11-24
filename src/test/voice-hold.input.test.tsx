/*
 * The mic held by the real mouse, in Chromium and WebKit: it records
 * until let go, never opening the inputs beside it (a split button's
 * chevron), however the page's text was selected by the click before;
 * the words go in at the caret, spaced from the draft. A story's
 * synthetic events skip what the browser does between a press and its
 * click (the mousedown and click it keeps from a prevented pointerdown,
 * and where it sends that click).
 */
import "../index.css"

import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, expect, test } from "vitest"
import { commands, userEvent } from "vitest/browser"
import { composeStories } from "@storybook/react-vite"

import * as stories from "@/stories/composer-voice.stories"

const { Inputs } = composeStories(stories)

declare module "vitest/browser" {
  interface BrowserCommands {
    mouse: (action: "down" | "up" | "move", selector?: string) => Promise<void>
  }
}

let root: Root | undefined
let host: HTMLElement | undefined
let text: HTMLElement | undefined

afterEach(() => {
  act(() => root?.unmount())
  host?.remove()
  text?.remove()
})

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

test.each(["triple click", "double click", "drag"])(
  "held after a %s selected the page's text, it records",
  async (selecting) => {
    text = document.createElement("p")
    text.id = "page-text"
    text.textContent = "Some text on the page, selected before"
    document.body.prepend(text)
    host = document.createElement("div")
    document.body.append(host)
    const created = createRoot(host)
    root = created
    act(() => created.render(<Inputs />))
    const editor = host.querySelector<HTMLElement>("[data-lexical-editor]")!
    await userEvent.click(editor)
    await userEvent.keyboard("hello world")
    for (let step = 0; step < 6; step++) await userEvent.keyboard("{ArrowLeft}")

    if (selecting === "triple click") await userEvent.tripleClick(text)
    else if (selecting === "double click") await userEvent.dblClick(text)
    else {
      await commands.mouse("down", "#page-text")
      await commands.mouse("move", "[data-slot=composer-toolbar]")
      await commands.mouse("up")
    }
    await expect.poll(() => document.getSelection()?.toString()).not.toBe("")

    await commands.mouse("down", "[data-slot=composer-voice]")
    await expect.poll(() => host!.textContent).toContain("Slide to cancel")
    await wait(400)
    await commands.mouse("up")
    await expect
      .poll(() => editor.textContent)
      .toMatch(/^hello Rename the upload helper .* import it world$/)
    expect(document.querySelector("[role=menu]")).toBeNull()
  }
)
