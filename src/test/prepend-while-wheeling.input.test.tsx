/*
 * Earlier messages put above the view among the reader's real wheel
 * steps up: the place kept over them must not lose a step. WebKit
 * scrolls a wheel's step on a thread of its own and tells the page a
 * moment later, so a scroll of the page's made from a scrollTop without
 * the step put the viewport back over it. Real input, in Chromium and
 * WebKit; a story's synthetic wheel scrolls on the page's thread.
 */
import "../index.css"

import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, expect, test } from "vitest"
import { userEvent } from "vitest/browser"

import { PrependWhileScrolling } from "@/stories/prepend-while-scrolling"

let root: Root | undefined
let host: HTMLElement | undefined

afterEach(() => {
  act(() => root?.unmount())
  host?.remove()
})

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve))

/** Once scrollTop has not changed for some frames. */
async function still(viewport: HTMLElement) {
  let last = -1
  for (let same = 0; same < 6;) {
    await frame()
    if (viewport.scrollTop === last) same++
    else [same, last] = [0, viewport.scrollTop]
  }
}

// Each run renders it afresh: the steps fall at other moments around
// the earlier messages' arrival. Some 1 in 5 lost a step in WebKit.
test("every wheel step up is kept as earlier messages come", async () => {
  const moved: number[] = []
  for (let run = 0; run < 8; run++) {
    host = document.createElement("div")
    document.body.append(host)
    const created = createRoot(host)
    root = created
    act(() => created.render(<PrependWhileScrolling delay={20 + run * 4} />))
    const viewport = host.querySelector<HTMLElement>(
      "[data-slot=message-scroller-viewport]"
    )!
    await still(viewport)
    const box = viewport.getBoundingClientRect()
    const anchor = document
      .elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)!
      .closest<HTMLElement>("[data-message-id]")!
    const before = anchor.getBoundingClientRect().top
    for (let step = 0; step < 3; step++)
      await userEvent.wheel(viewport, { delta: { y: -100 } })
    await expect
      .poll(() => viewport.querySelectorAll("[data-message-id]").length)
      .toBe(73)
    await still(viewport)
    moved.push(Math.round(anchor.getBoundingClientRect().top - before))
    act(() => created.unmount())
    host.remove()
    root = undefined
    host = undefined
  }
  expect(moved).toEqual(Array(8).fill(300))
})
