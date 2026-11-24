import { describe, expect, test, vi } from "vitest"

import { enterFullScreen, fullScreenWay } from "@/lib/full-screen"

const fn = () => {}

describe("fullScreenWay", () => {
  test("the Fullscreen API, where it is enabled", () => {
    expect(
      fullScreenWay({
        fullscreenEnabled: true,
        element: { requestFullscreen: fn },
        video: { webkitEnterFullscreen: fn },
      })
    ).toBe("element")
  })

  test("the video's own, where the API is missing (an iPhone)", () => {
    expect(
      fullScreenWay({
        fullscreenEnabled: undefined,
        element: {},
        video: { webkitEnterFullscreen: fn },
      })
    ).toBe("video")
  })

  test("the video's own, where the API is there but not enabled (a web view)", () => {
    expect(
      fullScreenWay({
        fullscreenEnabled: false,
        element: { requestFullscreen: fn },
        video: { webkitEnterFullscreen: fn },
      })
    ).toBe("video")
  })

  test("none, with neither: no button", () => {
    expect(
      fullScreenWay({ fullscreenEnabled: false, element: {}, video: {} })
    ).toBeNull()
    expect(
      fullScreenWay({ fullscreenEnabled: undefined, element: {}, video: null })
    ).toBeNull()
  })
})

describe("enterFullScreen", () => {
  test("the stage by the API, a refusal swallowed", async () => {
    const requestFullscreen = vi.fn(() => Promise.reject(new TypeError()))
    enterFullScreen("element", { requestFullscreen } as unknown as HTMLElement)
    expect(requestFullscreen).toHaveBeenCalledOnce()
    await Promise.resolve()
  })

  test("else the video in it, its throw before metadata swallowed", () => {
    const webkitEnterFullscreen = vi.fn(() => {
      throw new DOMException("", "InvalidStateError")
    })
    const stage = {
      matches: () => false,
      querySelector: () => ({ webkitEnterFullscreen }),
    } as unknown as HTMLElement
    expect(() => enterFullScreen("video", stage)).not.toThrow()
    expect(webkitEnterFullscreen).toHaveBeenCalledOnce()
  })
})
