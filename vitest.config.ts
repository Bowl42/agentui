import { storybookTest } from "@storybook/addon-vitest/vitest-plugin"
import { playwright } from "@vitest/browser-playwright"
import { defineConfig, mergeConfig } from "vitest/config"
import type { BrowserCommand } from "vitest/node"
import viteConfig from "./vite.config.ts"
import { firefoxLaunchOptions } from "./vitest.firefox.ts"

/**
 * The real mouse, as a reader's: its button `down` or `up`, or `move`d,
 * over the middle of the first element `selector` finds in the test
 * page (none given, where it is).
 */
const mouse: BrowserCommand<
  [action: "down" | "up" | "move", selector?: string]
> = async ({ page, iframe }, action, selector) => {
  if (selector) {
    const box = await iframe.locator(selector).first().boundingBox()
    if (!box) throw new Error(`Nothing to point at: ${selector}`)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  }
  if (action === "down") await page.mouse.down()
  else if (action === "up") await page.mouse.up()
}

/** Turns Windows high contrast emulation on or off for the test page. */
const emulateForcedColors: BrowserCommand<[active: boolean]> = async (
  { page },
  active
) => {
  await page.emulateMedia({ forcedColors: active ? "active" : "none" })
}

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // Some play functions wait on layout and timers, and miss their
      // timeout when the whole suite loads the machine; a test that
      // passes on a rerun is that, not a defect. One that fails three
      // times still fails.
      retry: 2,
      // A CI runner is many times slower than a developer's machine; on
      // that, the longest stories (a phone's or a tablet's app, some 8s)
      // pass 15s while other work loads it too.
      testTimeout: process.env.CI ? 60_000 : 30_000,
      projects: [
        {
          // Plain functions, e.g. a parser: in Node, no browser.
          extends: true,
          test: {
            name: "unit",
            include: ["src/**/*.test.ts"],
            environment: "node",
          },
        },
        {
          // Forced colours can only be emulated in Chromium.
          extends: true,
          test: {
            name: "forced-colors",
            include: ["src/**/*.browser.test.tsx"],
            browser: {
              enabled: true,
              headless: true,
              viewport: { width: 1280, height: 800 },
              provider: playwright(),
              instances: [{ browser: "chromium" }],
              commands: { emulateForcedColors },
            },
          },
        },
        {
          // What needs the browser's own input (a real wheel, which
          // WebKit scrolls on a thread of its own; a real mouse held),
          // in Chromium and WebKit.
          extends: true,
          test: {
            name: "input",
            include: ["src/**/*.input.test.tsx"],
            browser: {
              enabled: true,
              headless: true,
              viewport: { width: 1280, height: 800 },
              provider: playwright(),
              instances: [{ browser: "chromium" }, { browser: "webkit" }],
              commands: { mouse },
            },
          },
        },
        {
          // Every story is a browser test: it renders, runs its play function
          // and fails on accessibility violations.
          extends: true,
          plugins: [storybookTest({ configDir: ".storybook" })],
          test: {
            name: "storybook",
            browser: {
              enabled: true,
              headless: true,
              // Wider than the 768px mobile breakpoint (useIsMobile, md:).
              viewport: { width: 1280, height: 800 },
              provider: playwright(),
              instances: [
                { browser: "chromium" },
                {
                  browser: "firefox",
                  provider: playwright({
                    launchOptions: firefoxLaunchOptions(),
                  }),
                },
                { browser: "webkit" },
              ],
            },
          },
        },
        {
          // The stories again in the dark theme, so axe checks the colours
          // the components compose there. Contrast does not depend on the
          // engine, so Chromium is enough.
          extends: true,
          plugins: [storybookTest({ configDir: ".storybook" })],
          define: {
            "import.meta.env.VITE_STORY_THEME": JSON.stringify("dark"),
          },
          test: {
            name: "storybook-dark",
            browser: {
              enabled: true,
              headless: true,
              viewport: { width: 1280, height: 800 },
              provider: playwright(),
              instances: [{ browser: "chromium" }],
            },
          },
        },
      ],
    },
  })
)
