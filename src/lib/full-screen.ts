import * as React from "react"

/**
 * How a video's stage goes full screen: by the Fullscreen API, the stage
 * itself (its own controls over the video), or, where that is missing (an
 * iPhone's WebKit, a web view that has not enabled element full screen),
 * the video alone in the system's own player (`webkitEnterFullscreen`).
 *
 * The webkit-prefixed `webkitRequestFullscreen` is not used: every
 * Safari this registry supports (16.4 and later, as Tailwind CSS 4) has
 * the unprefixed API.
 */
export type FullScreenWay = "element" | "video"

/** What a browser offers to go full screen with. */
export type FullScreenSupport = {
  /** `document.fullscreenEnabled`. */
  fullscreenEnabled?: boolean | undefined
  /** An element, or `HTMLElement.prototype`. */
  element: { requestFullscreen?: unknown }
  /** The video, or `HTMLVideoElement.prototype`; none for no video. */
  video?: { webkitEnterFullscreen?: unknown } | null | undefined
}

/** How it goes full screen, by what the browser offers; none, null. */
export function fullScreenWay({
  fullscreenEnabled,
  element,
  video,
}: FullScreenSupport): FullScreenWay | null {
  if (fullscreenEnabled && typeof element.requestFullscreen === "function")
    return "element"
  if (video && typeof video.webkitEnterFullscreen === "function")
    return "video"
  return null
}

type WebKitVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void }

/** Takes `stage` (or the video in it) full screen, `way`'s way. */
export function enterFullScreen(way: FullScreenWay, stage: HTMLElement) {
  if (way === "element") {
    // Refused (not allowed in a frame, say): it stays as it is.
    stage.requestFullscreen().catch(() => {})
    return
  }
  const video = (
    stage.matches("video") ? stage : stage.querySelector("video")
  ) as WebKitVideo | null
  try {
    video?.webkitEnterFullscreen?.()
  } catch {
    // Its metadata not loaded yet: WebKit has nothing to show.
  }
}

const never = () => () => {}

/**
 * Full screen for a video's stage, the way this browser can; none (no
 * full screen button), undefined. Undecided until hydrated.
 */
export function useFullScreen(
  stage: React.RefObject<HTMLElement | null>
): (() => void) | undefined {
  const way = React.useSyncExternalStore(
    never,
    () =>
      fullScreenWay({
        fullscreenEnabled: document.fullscreenEnabled,
        element: HTMLElement.prototype,
        video: HTMLVideoElement.prototype as WebKitVideo,
      }),
    () => null
  )
  if (!way) return undefined
  return () => {
    if (stage.current) enterFullScreen(way, stage.current)
  }
}
