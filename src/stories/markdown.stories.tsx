import type { Meta, StoryObj } from "@storybook/react-vite"
import * as React from "react"
import { expect, fn, spyOn, userEvent, waitFor, within } from "storybook/test"

import { createMathPlugin, math } from "@streamdown/math"
import "katex/dist/katex.min.css"

import { mermaid } from "@streamdown/mermaid"

import { cn } from "cn"
import { Chip } from "@/components/chip"
import { Markdown } from "@/components/markdown"
import { registerLanguages } from "@/lib/highlighter"
import { Message, MessageContent } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"

import { foldedLines, frames, insideBorder } from "./code-fold"

const meta = {
  title: "Components/Markdown",
  component: Markdown,
  parameters: { layout: "padded" },
  decorators: [
    (Story, { parameters }) =>
      // A story in a conversation of its own, in a scroller.
      parameters.conversation ? (
        <Story />
      ) : (
        <div className="mx-auto w-3xl max-w-full">
          <Message>
            <MessageContent>
              <Story />
            </MessageContent>
          </Message>
        </div>
      ),
  ],
} satisfies Meta<typeof Markdown>

export default meta
type Story = StoryObj<typeof meta>

const answer = `I checked the new cache against real traffic: hit rates match what the benchmark predicted.

**What it covers**

- **Keys**:
  - Everything the old cache keyed on still works: the path, the query, the accepted language and the encoding. This line is long on purpose, to show where it starts again once it wraps.
  - What only the new one can key on:
    - a version per deploy, so a release clears it;
    - the user's plan, for pages that differ by plan;
    - the region a request came from.
- **Limits**: size, entry count and age, plus a cap per route.
- **Eviction**: least recently used, the same for every route.

## What it can't do yet

1. **Partial invalidation.** Clearing one route clears the whole cache.
2. **Stale while revalidating.** A miss always waits for the origin.

The change is in \`src/cache/config.ts\`:

\`\`\`ts
export const cache = { key: ["path", "query", "deploy"], maxAge: 300 }
\`\`\`

It ships with the next release, after the staging run.`

/**
 * An agent's long answer: blocks 12px apart, list items 4px apart, a
 * wrapped item's lines under its text, not its dot; a heading a size
 * above the text; fenced code a `CodeBlock`.
 */
export const Answer: Story = {
  args: { children: answer, mode: "static" },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>(
      "[data-slot=markdown]"
    )!
    const em = parseFloat(getComputedStyle(root).fontSize)
    const box = (element: Element) => element.getBoundingClientRect()

    // Paragraphs 12px apart.
    const [first, second] = [...root.children] as HTMLElement[]
    const gap = box(second!).top - box(first!).bottom
    await expect(gap).toBeCloseTo(12, 0)

    const items = [...root.querySelectorAll(":scope > ul > li")]
    // Items close: 4px between them, nothing around each.
    const item = getComputedStyle(items[1]!)
    await expect(parseFloat(item.paddingTop)).toBe(0)
    await expect(parseFloat(item.paddingBottom)).toBe(0)
    await expect(box(items[2]!).top - box(items[1]!).bottom).toBeCloseTo(4, 0)

    // A wrapped item hangs: its second line starts where its text does.
    const long = root.querySelector(":scope > ul > li > ul > li")!
    const range = document.createRange()
    range.selectNodeContents(long)
    const lines = [...range.getClientRects()].filter((rect) => rect.width > 0)
    const starts = new Set(lines.map((rect) => Math.round(rect.left)))
    await expect(Math.min(...starts)).toBeGreaterThanOrEqual(
      Math.round(box(long).left)
    )
    // Its dot before its text, in the space the item hangs by.
    const dot = getComputedStyle(long, "::before")
    await expect(dot.position).toBe("absolute")
    await expect(parseFloat(dot.left) + parseFloat(dot.width)).toBeLessThan(
      parseFloat(getComputedStyle(long).paddingLeft)
    )

    // A heading a step above the text (18px by 16px), not a page's.
    const heading = root.querySelector("h2")!
    await expect(em).toBe(16)
    await expect(parseFloat(getComputedStyle(heading).fontSize)).toBe(em + 2)

    // Fenced code is a CodeBlock with its language and a copy button.
    const code = await waitFor(() => {
      const block = root.querySelector("[data-slot=markdown-code-block]")
      expect(block).not.toBeNull()
      return block!
    })
    await expect(code).toHaveTextContent("ts")
    await expect(
      code.querySelector("[data-slot=code-block-copy-button]")
    ).not.toBeNull()
    // Code in a line of text stays in it.
    await expect(root.querySelector("p code")).toHaveTextContent(
      "src/cache/config.ts"
    )
  },
}

/** While it streams, an unfinished list and code still render. */
export const Streaming: Story = {
  args: {
    mode: "streaming",
    children: "Steps:\n\n- read the file\n- run the tes",
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll("li")).toHaveLength(2)
  },
}

/**
 * While the agent writes, a caret at the end of its words
 * (`caret="block"`, with `isAnimating`); gone once it stops.
 */
export const StreamingCaret: Story = {
  args: {
    mode: "streaming",
    isAnimating: true,
    caret: "block",
    children:
      "Checks passed and the tag is in place. Once you allow the push, I'll publish the registry and post the release notes",
  },
  play: async ({ canvasElement }) => {
    const last = canvasElement.querySelector<HTMLElement>(
      "[data-slot=markdown] > :last-child"
    )!
    await waitFor(() =>
      expect(getComputedStyle(last, "::after").content).toContain("▋")
    )
  },
}

const rich = `## What changed

The build now splits vendor code once and skips what nothing imports, as the [Rollup docs](https://rollupjs.org/configuration-options/) recommend.[^1]

- A \`manualChunks\` rule ships React in one cached chunk.
- \`lodash\` is gone; its two helpers are native now.
- Each route loads only its own CSS.[^2]

> Tests failed on one snapshot, which I left for you to review.

[^1]: [Configuration options](https://rollupjs.org/configuration-options/)
[^2]: [Building for production](https://vitejs.dev/guide/build)
`

/**
 * An answer: a heading a size above the text, lines 24px apart, a list
 * hanging from small grey dots, a quote as a rule and muted text;
 * footnotes are its sources, each mark a numbered tile and the notes a
 * list under a rule, with the site each links to.
 */
/**
 * The conversation's vertical rhythm: 12px between blocks, 24 over a
 * heading (after another heading too), 8 under it, 4 between a list's
 * items; inline code and a table's text at named sizes.
 */
export const Rhythm: Story = {
  args: {
    mode: "static",
    children: [
      "The deploy is slower since Tuesday.",
      "",
      "It waits on the cache.",
      "",
      "## Cause",
      "",
      "### Detail",
      "",
      "The `build` step runs twice:",
      "",
      "- once for the app",
      "- once for the worker",
      "",
      "| Step | Time |",
      "| ---- | ---- |",
      "| build | 2m |",
    ].join("\n"),
  },
  play: async ({ canvas, canvasElement }) => {
    const root = canvasElement.querySelector("[data-slot=markdown]")!
    const box = (element: Element) => element.getBoundingClientRect()
    const between = (above: Element, below: Element) =>
      box(below).top - box(above).bottom
    const [first, second] = root.querySelectorAll(":scope > p")
    await expect(between(first!, second!)).toBe(12)
    const cause = canvas.getByRole("heading", { name: "Cause" })
    const detail = canvas.getByRole("heading", { name: "Detail" })
    await expect(between(second!, cause)).toBe(24)
    await expect(between(cause, detail)).toBe(24)
    await expect(between(detail, detail.nextElementSibling!)).toBe(8)
    const items = root.querySelectorAll("li")
    await expect(between(items[0]!, items[1]!)).toBe(4)
    for (const line of root.querySelectorAll("p, li"))
      await expect(box(line).height % 4).toBe(0)
    await expect(
      getComputedStyle(canvas.getByText("build", { selector: "code" })).fontSize
    ).toBe("13px")
    await expect(getComputedStyle(root.querySelector("table")!).fontSize).toBe(
      "14px"
    )
  },
}

/** A viewport the story's tests run at too (Storybook sets it in Vitest). */
function viewport(name: string, width: number, height: number) {
  return {
    parameters: {
      viewport: {
        options: {
          [name]: {
            name,
            styles: { width: `${width}px`, height: `${height}px` },
            type: "mobile",
          },
        },
      },
    },
    globals: { viewport: { value: name, isRotated: false } },
  } satisfies Partial<Story>
}

/**
 * The theme's type: the platform's face, then its CJK faces; drawn
 * antialiased; a quarter em between CJK and Latin (not in code).
 * Lines break evenly, headings balanced.
 */
export const Type: Story = {
  args: {
    mode: "static",
    children: [
      "## デプロイが遅くなった理由",
      "",
      "キャッシュは deploy id ごとに計算されるため、デプロイのたびに 120 枚の画像を最適化し直していました。`contentHash` に変えてから速くなりました。",
    ].join("\n"),
  },
  play: async ({ canvas, canvasElement }) => {
    const html = getComputedStyle(document.documentElement)
    // Quoted or not, as each browser writes them.
    await expect(html.fontFamily.replaceAll('"', "")).toMatch(
      /Arial, PingFang SC, Hiragino Sans, Apple SD Gothic Neo, Microsoft YaHei, Yu Gothic UI, Malgun Gothic, Noto Sans CJK SC, Noto Sans CJK JP, Noto Sans CJK KR, sans-serif$/
    )
    // Firefox's is its own -moz-osx-font-smoothing, and only on macOS.
    if (CSS.supports("-webkit-font-smoothing", "antialiased"))
      await expect(html.getPropertyValue("-webkit-font-smoothing")).toMatch(
        /^(antialiased|grayscale)$/
      )
    if (CSS.supports("text-autospace", "normal")) {
      await expect(html.getPropertyValue("text-autospace")).toBe("normal")
      await expect(
        getComputedStyle(canvas.getByText("contentHash")).getPropertyValue(
          "text-autospace"
        )
      ).toBe("no-autospace")
    }
    const root = canvasElement.querySelector("[data-slot=markdown]")!
    // Where the browser has it (not Firefox's yet).
    if (CSS.supports("text-wrap-style", "pretty"))
      await expect(
        getComputedStyle(root.querySelector("p")!).textWrapStyle
      ).toBe("pretty")
    await expect(
      getComputedStyle(canvas.getByRole("heading")).textWrapStyle
    ).toBe("balance")
  },
}

/** On a phone, 16px on 28px lines: room between CJK text's dense lines. */
export const PhoneLines: Story = {
  ...viewport("phone", 390, 844),
  args: Rhythm.args,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector("[data-slot=markdown]")!
    for (const line of root.querySelectorAll("p, li, h3")) {
      await expect(getComputedStyle(line).fontSize).toBe("16px")
      await expect(getComputedStyle(line).lineHeight).toBe("28px")
    }
  },
}

export const Content: Story = {
  args: { children: rich, mode: "static" },
  play: async ({ canvas, canvasElement }) => {
    const heading = canvas.getByRole("heading", { name: "What changed" })
    await expect(getComputedStyle(heading).fontSize).toBe("18px")
    await expect(heading).not.toHaveAttribute("aria-level")
    // 8px over what it heads.
    await expect(
      heading.nextElementSibling!.getBoundingClientRect().top -
        heading.getBoundingClientRect().bottom
    ).toBe(8)
    const text = canvasElement.querySelector("[data-slot=markdown] p")!
    await expect(getComputedStyle(text).fontSize).toBe("16px")
    await expect(getComputedStyle(text).lineHeight).toBe("28px")
    // The mark goes to its source.
    const mark = canvasElement.querySelector<HTMLAnchorElement>(
      "sup a[data-footnote-ref]"
    )!
    await expect(mark).toHaveAttribute("href", "#user-content-fn-1")
    // Its tile centred on its line, not raised as a sup is: on the line
    // of the text before it, or (Firefox breaks before a tile) the next.
    const paragraph = mark.closest("p")!
    const tile = mark.getBoundingClientRect()
    const lineHeight = parseFloat(getComputedStyle(paragraph).lineHeight)
    const within =
      (tile.top + tile.height / 2 - paragraph.getBoundingClientRect().top) %
      lineHeight
    await expect(Math.abs(within - lineHeight / 2)).toBeLessThanOrEqual(1)
    const sources = canvasElement.querySelectorAll(
      "[data-slot=markdown-source]"
    )
    await expect(sources).toHaveLength(2)
    await expect(sources[0]).toHaveTextContent("Configuration options")
    await expect(canvas.getByText("rollupjs.org")).toBeVisible()
    await expect(canvas.getByText("vitejs.dev")).toBeVisible()
  },
}

const tables = `| Chunk | Before | After |
| :-- | --: | --: |
| index.js | 412 KB | 96 KB |
| vendor.js | — | 141 KB |
| pricing.css | 38 KB | 6 KB |

\`\`\`ts
export default defineConfig({
  build: {
    // one cached vendor chunk
    rollupOptions: { output: { manualChunks: { vendor: ["react", "react-dom"] } } },
    cssCodeSplit: true,
  },
})
\`\`\`
`

/**
 * A table has rules between rows only, its numbers lined up; code is
 * set in weights, not colours, its lines numbered.
 */
const blocks = `# Title

A paragraph first.

## Section

### Sub section

Text under it.

- one
- two

> A quote

| a | b |
|---|---|
| 1 | 2 |

---

#### Small heading
Right after it.`

/**
 * Its blocks are a flex column, not block flow (WebKit fills a block
 * flow's selection solid, margins and line ends, beside lists that show
 * only their text), spaced on the grid: 12px between blocks, 24 over a
 * heading (after another heading too), 8 under it, 24 either side of a
 * rule.
 */
export const Spacing: Story = {
  args: { children: blocks, mode: "static" },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>(
      "[data-slot=markdown]"
    )!
    await waitFor(() => expect(root.querySelector("table")).not.toBeNull())
    await expect(getComputedStyle(root).display).toBe("flex")
    const gaps = [...root.children]
      .slice(1)
      .map((child) =>
        Math.round(
          child.getBoundingClientRect().top -
            child.previousElementSibling!.getBoundingClientRect().bottom
        )
      )
    // h1 p h2 h3 p ul blockquote table hr h4 p
    await expect(gaps).toEqual([8, 24, 24, 8, 12, 12, 12, 24, 24, 8])
  },
}

export const TableAndCode: Story = {
  args: { children: tables, mode: "static" },
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector("table")!
    const [, before] = [...table.querySelectorAll("th")]
    await expect(getComputedStyle(before!).textAlign).toBe("right")
    await expect(getComputedStyle(table).fontVariantNumeric).toBe(
      "tabular-nums"
    )
    await expect(
      canvasElement.querySelectorAll("[data-slot=code-block-line]")
    ).toHaveLength(7)
    // A 36px header; the code 40px in from the border, its numbers
    // (one digit) in a gutter of two.
    const block = canvasElement.querySelector<HTMLElement>(
      "[data-slot=markdown-code-block]"
    )!
    await expect(
      block
        .querySelector("[data-slot=code-block-header]")!
        .getBoundingClientRect().height
    ).toBe(36)
    const text = block.querySelector("[data-slot=code-block-line-content]")!
    await expect(
      text.getBoundingClientRect().left -
        block.getBoundingClientRect().left -
        block.clientLeft
    ).toBe(40)
  },
}

const script = Array.from(
  { length: 40 },
  (_, line) => `const step${line + 1} = await run(${line + 1})`
).join("\n")

const onOpenCode = fn()

/**
 * A code block over 12 lines folds in its own card: those, whole, fading
 * out, and a bar across its foot, "Show all · 40 lines", that shows the
 * rest; with `onOpenCode`, a button in its header opens it whole, e.g.
 * beside the conversation. Copying copies it all. Its fence names its
 * file (```ts title="scripts/build.ts"), shown in place of the language.
 */
export const LongCode: Story = {
  args: {
    mode: "static",
    children:
      'Here is the script:\n\n```ts title="scripts/build.ts"\n' +
      script +
      "\n```",
    onOpenCode,
  },
  play: async ({ canvas }) => {
    const writeText = spyOn(navigator.clipboard, "writeText")
    writeText.mockResolvedValue()
    const more = await canvas.findByRole("button", {
      name: "Show all 40 lines",
    })
    // Its card: the bar is its last part.
    const block = more.parentElement!
    // The file name from the fence.
    const header = block.querySelector("[data-slot=code-block-header]")!
    await expect(header).toHaveTextContent(/^scripts\/build.ts$/)
    await expect(foldedLines(block)).toMatchObject({ whole: 12, cut: 0 })
    await expect(insideBorder(more, block)).toBe(true)
    await userEvent.click(canvas.getByRole("button", { name: "Copy" }))
    await expect(writeText).toHaveBeenCalledWith(script)
    await userEvent.click(more)
    await expect(foldedLines(block)).toMatchObject({ whole: 40, cut: 0 })
    await expect(more).toHaveAccessibleName("Show less 40 lines")
    await expect(more).toHaveAttribute("aria-expanded", "true")
    await userEvent.click(canvas.getByRole("button", { name: "Collapse" }))
    await expect(more).toHaveAttribute("aria-expanded", "false")
    await userEvent.click(canvas.getByRole("button", { name: "Open" }))
    await expect(onOpenCode).toHaveBeenCalledWith({
      code: script,
      language: "ts",
      title: "scripts/build.ts",
    })
  },
}

// A generated file of five thousand lines.
const generated = Array.from(
  { length: 5000 },
  (_, index) => `export const value${index + 1} = ${index + 1} // generated`
).join("\n")

/**
 * A fence of thousands of lines (a log, a generated file) costs the
 * twelve it shows: only those are highlighted and rendered, the rest one
 * plain text, hidden until found. Open, it goes on highlighting from
 * there, a few screens of lines at a time, the code where it was.
 */
export const LongFence: Story = {
  args: {
    mode: "static",
    children: "Generated:\n\n```ts\n" + generated + "\n```",
  },
  play: async ({ canvas }) => {
    const writeText = spyOn(navigator.clipboard, "writeText")
    writeText.mockResolvedValue()
    const more = await canvas.findByRole("button", {
      name: "Show all 5000 lines",
    })
    const block = more.parentElement!
    const lines = () =>
      block.querySelectorAll<HTMLElement>("[data-slot=code-block-line]")
    await waitFor(() =>
      expect(lines()[11]!.querySelector("[class^='code-']")).not.toBeNull()
    )
    await expect(lines()).toHaveLength(12)
    const rest = block.querySelector<HTMLElement>(
      "[data-slot=code-block-rest]"
    )!
    await expect(rest).toHaveAttribute("hidden", "until-found")
    await expect(rest.querySelector("[class^='code-']")).toBeNull()
    await expect(rest.textContent).toMatch(/value5000 = 5000 \/\/ generated$/)
    await expect(foldedLines(block)).toMatchObject({ whole: 12, cut: 0 })
    const start = lines()[0]!.getBoundingClientRect().left
    const code = lines()[0]!.querySelector("span span")!
    const left = code.getBoundingClientRect().left

    await userEvent.click(canvas.getByRole("button", { name: "Copy" }))
    await expect(writeText).toHaveBeenCalledWith(generated)

    await userEvent.click(more)
    await expect(more).toHaveAccessibleName("Show less 5000 lines")
    // A few screens of lines, 250 at a time, the rest still text.
    const shown = lines().length
    await expect(shown).toBeGreaterThanOrEqual(262)
    await expect(shown).toBeLessThan(5000)
    // Highlighted on from where it was cut; the code where it was.
    await expect(lines()[12]!.querySelector("[class^='code-']")).not.toBeNull()
    await expect(lines()[shown - 1]).toHaveTextContent(
      `value${shown} = ${shown}`
    )
    await expect(lines()[0]!.getBoundingClientRect().left).toBe(start)
    await expect(code.getBoundingClientRect().left).toBe(left)
  },
}

const flow = `flowchart LR
  A[Push to main] --> B{Checks pass?}
  B -- yes --> C[Tag the release]
  B -- no --> D[Fix and push again]
  D --> A
  C --> E[(Registry)]`

/**
 * With Streamdown's Mermaid plugin, a \`\`\`mermaid block is a diagram in
 * the page's greys, light or dark, its code a toggle away.
 */
export const Diagram: Story = {
  args: {
    mode: "static",
    plugins: { mermaid },
    children: "How a release goes out:\n\n```mermaid\n" + flow + "\n```",
  },
  play: async ({ canvas, canvasElement }) => {
    const diagram = await canvas.findByRole(
      "img",
      { name: "Diagram" },
      { timeout: 5000 }
    )
    const svg = diagram.querySelector("svg")!
    await expect(svg).toBeInTheDocument()
    // No colour but greys: every fill and stroke has r = g = b.
    const colours = [...svg.querySelectorAll<SVGElement>("rect, path, polygon")]
      .flatMap((shape) => {
        const style = getComputedStyle(shape)
        return [style.fill, style.stroke]
      })
      .filter((value) => value.startsWith("rgb"))
    await expect(colours.length).toBeGreaterThan(0)
    for (const colour of colours) {
      const [r, g, b] = colour.match(/\d+(\.\d+)?/g)!.map(Number)
      await expect(Math.max(r!, g!, b!) - Math.min(r!, g!, b!)).toBeLessThan(3)
    }

    // Its code, a toggle away.
    const toggle = canvas.getByRole("button", { name: "Show code" })
    await userEvent.click(toggle)
    await expect(toggle).toHaveAttribute("aria-pressed", "true")
    await expect(canvas.queryByRole("img", { name: "Diagram" })).toBeNull()
    await expect(
      canvasElement.querySelector("[data-slot=code-block-content]")
    ).toHaveTextContent("Push to main")
    await userEvent.click(toggle)
    await expect(canvas.getByRole("img", { name: "Diagram" })).toBeVisible()
  },
}

/** A diagram Mermaid cannot read shows its code, and says so in grey. */
export const DiagramFailed: Story = {
  args: {
    mode: "static",
    plugins: { mermaid },
    children: "```mermaid\nflowchart LR\n  A --> \n  ((\n```",
  },
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByText(
        "The diagram could not be drawn.",
        {},
        { timeout: 5000 }
      )
    ).toBeVisible()
    await expect(canvas.queryByRole("img", { name: "Diagram" })).toBeNull()
    await expect(canvas.queryByRole("button", { name: "Show code" })).toBeNull()
  },
}

// Mermaid, watched: a diagram drawn asks it for Mermaid first.
const watchedMermaid = { ...mermaid, getMermaid: fn(mermaid.getMermaid) }

/** While its fence is open, as it streams, its code shows. */
export const DiagramStreaming: Story = {
  args: {
    mode: "streaming",
    plugins: { mermaid: watchedMermaid },
    isAnimating: true,
    children: "```mermaid\nflowchart LR\n  A[Push] --> B",
  },
  beforeEach: () => {
    watchedMermaid.getMermaid.mockClear()
  },
  play: async ({ canvasElement }) => {
    // Its effects run, and a drawing they started would have asked.
    await frames(2)
    await expect(watchedMermaid.getMermaid).not.toHaveBeenCalled()
    await expect(
      canvasElement.querySelector("[data-slot=markdown-diagram-content]")
    ).toBeNull()
    await expect(
      canvasElement.querySelector("[data-slot=code-block-content]")
    ).toHaveTextContent("A[Push] --> B")
  },
}

const inlineMath = createMathPlugin({ singleDollarTextMath: true })
const energy =
  "Energy is $E = mc^2$, so a gram is worth $9 \\times 10^{13}$ joules."

/** Inline formulas share the surrounding text's colour. */
export const MathInline: Story = {
  args: { mode: "static", plugins: { math: inlineMath }, children: energy },
  play: async ({ canvasElement }) => {
    const formula = canvasElement.querySelector(
      "[data-slot=markdown-math][data-display=inline]"
    )!
    await expect(formula.querySelector(".katex")).toBeInTheDocument()
    await expect(getComputedStyle(formula.querySelector(".katex")!).color).toBe(
      getComputedStyle(canvasElement.querySelector("p")!).color
    )
    await expect(
      formula.querySelector('annotation[encoding="application/x-tex"]')
    ).toHaveTextContent("E = mc^2")
  },
}

/** A short block formula fits without a keyboard scrolling stop. */
export const MathBlock: Story = {
  args: {
    mode: "static",
    plugins: { math },
    children: "$$\n\\int_0^1 \\frac{x^2}{2}\\,dx\n$$",
  },
  play: async ({ canvasElement }) => {
    const formula = canvasElement.querySelector(
      "[data-slot=markdown-math][data-display=block]"
    )!
    await expect(formula.querySelector(".katex-display")).toBeInTheDocument()
    await expect(formula).not.toHaveAttribute("tabindex")
    await expect(formula).not.toHaveAttribute("role")
  },
}

/** A formula KaTeX cannot read shows its TeX as code. */
export const MathFailed: Story = {
  args: {
    mode: "static",
    plugins: { math },
    children: "Formula:\n\n$$\n\\frac{1}{\n$$",
  },
  play: async ({ canvasElement }) => {
    const source = canvasElement.querySelector(
      "[data-slot=markdown-math-source]"
    )!
    await expect(source).toBeVisible()
    await expect(source).toHaveTextContent("\\frac{1}{")
    await expect(canvasElement.querySelector(".katex, .katex-error")).toBeNull()
    await expect(getComputedStyle(source).fontFamily).not.toBe(
      getComputedStyle(canvasElement.querySelector("p")!).fontFamily
    )
  },
}

/** An unfinished formula stays code while the answer streams. */
export const MathStreaming: Story = {
  args: {
    mode: "streaming",
    isAnimating: true,
    plugins: { math },
    children: "Area:\n\n$$\n\\int_0^1 x^2",
  },
  play: async ({ canvasElement }) => {
    await frames(2)
    await expect(
      canvasElement.querySelector("[data-slot=markdown-math-source]")
    ).toHaveTextContent("\\int_0^1 x^2")
    await expect(canvasElement.querySelector(".katex")).toBeNull()
  },
}

/** A wide formula scrolls inside the answer's lane. */
export const MathWide: Story = {
  args: {
    mode: "static",
    plugins: { math },
    children: `$$\n${Array.from({ length: 60 }, (_, i) => `a_{${i + 1}}`).join(" + ")}\n$$`,
  },
  play: async ({ canvas, canvasElement }) => {
    const formula = canvasElement.querySelector<HTMLElement>(
      "[data-slot=markdown-math][data-display=block]"
    )!
    await waitFor(async () => {
      await expect(formula.scrollWidth).toBeGreaterThan(formula.clientWidth)
      await expect(formula.tabIndex).toBe(0)
      await expect(canvas.getByRole("group", { name: "Formula" })).toBe(formula)
    })
    const root = canvasElement.querySelector<HTMLElement>(
      "[data-slot=markdown]"
    )!
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth + 1)
  },
}

/** Copying a formula keeps its written TeX and delimiters. */
export const MathCopy: Story = {
  args: {
    mode: "static",
    plugins: { math: inlineMath },
    children: "Energy is $E = mc^2$.",
  },
  play: async ({ canvasElement }) => {
    const formula = canvasElement.querySelector("[data-slot=markdown-math]")!
    const selection = document.getSelection()!
    const range = document.createRange()
    const copy = () => {
      selection.removeAllRanges()
      selection.addRange(range)
      const event = new ClipboardEvent("copy", {
        bubbles: true,
        cancelable: true,
        clipboardData: new DataTransfer(),
      })
      formula.dispatchEvent(event)
      return event
    }
    try {
      range.selectNodeContents(formula)
      const event = copy()
      await expect(event.clipboardData!.getData("text/plain")).toBe(
        "$E = mc^2$"
      )
      await expect(event.defaultPrevented).toBe(true)
      const paragraph = canvasElement.querySelector("p")!
      range.setStart(paragraph.firstChild!, 7)
      range.setEndAfter(formula)
      await expect(copy().clipboardData!.getData("text/plain")).toContain(
        "is $E = mc^2$"
      )
    } finally {
      selection.removeAllRanges()
    }
  },
}

/** Inline and block formulas inherit light text on a dark page. */
export const MathDark: Story = {
  globals: { theme: "dark" },
  args: {
    mode: "static",
    plugins: { math: inlineMath },
    children: "Energy is $E = mc^2$.\n\n$$\nE = mc^2\n$$",
  },
  play: async ({ canvasElement }) => {
    const colour = getComputedStyle(canvasElement.querySelector("p")!).color
    const formulas = canvasElement.querySelectorAll(
      "[data-slot=markdown-math] .katex"
    )
    await expect(formulas).toHaveLength(2)
    for (const formula of formulas)
      await expect(getComputedStyle(formula).color).toBe(colour)
  },
}

const paragraphs = "The checks passed.\n\nThe release is ready for review."

/** New blocks fade in while the agent streams its answer. */
export const StreamingFade: Story = {
  args: { mode: "streaming", isAnimating: true, children: paragraphs },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector("[data-slot=markdown]")!
    await expect(root).toHaveAttribute("data-streaming")
    await expect(
      getComputedStyle(root.firstElementChild!).transitionProperty
    ).toContain("opacity")
  },
}

/** A finished answer opens without fading its blocks. */
export const FinishedNoFade: Story = {
  args: { mode: "static", isAnimating: false, children: paragraphs },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector("[data-slot=markdown]")!
    await expect(root).not.toHaveAttribute("data-streaming")
    await expect(
      getComputedStyle(root.firstElementChild!).transitionProperty
    ).not.toContain("opacity")
  },
}

/** Headings sit below the page's headings, keeping their visual size. */
export const HeadingOffset: Story = {
  args: {
    headingOffset: 2,
    mode: "static",
    children: "# Title\n\n## Section\n\n### Part\n\n#### Deep\n\n##### Deeper",
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("h1")).toHaveAttribute(
      "aria-level",
      "3"
    )
    await expect(canvasElement.querySelector("h2")).toHaveAttribute(
      "aria-level",
      "4"
    )
    await expect(canvasElement.querySelector("h4")).toHaveAttribute(
      "aria-level",
      "6"
    )
    // At most 6.
    await expect(canvasElement.querySelector("h5")).toHaveAttribute(
      "aria-level",
      "6"
    )
    await expect(canvasElement.querySelector("h1")).toHaveClass(
      "text-display/7"
    )
  },
}

const wideCode =
  '```ts\nconst message = "' +
  "A long line of code to wrap. ".repeat(12) +
  '"\n```'

/** Each code block can wrap its long lines, then turn wrapping off. */
export const CodeWrap: Story = {
  args: { mode: "static", children: wideCode },
  play: async ({ canvas, canvasElement }) => {
    const toggle = await canvas.findByRole("button", { name: "Wrap lines" })
    const pre = canvasElement.querySelector("[data-slot=code-block-content]")!
    await expect(toggle).toHaveAttribute("aria-pressed", "false")
    await expect(pre).not.toHaveAttribute("data-wrap")
    await userEvent.click(toggle)
    await expect(toggle).toHaveAttribute("aria-pressed", "true")
    await expect(pre).toHaveAttribute("data-wrap")
    await userEvent.click(toggle)
    await expect(toggle).toHaveAttribute("aria-pressed", "false")
    await expect(pre).not.toHaveAttribute("data-wrap")
  },
}

/** Code can start wrapped, with the toggle's words supplied by the app. */
export const CodeWrapByDefault: Story = {
  args: {
    mode: "static",
    codeWrap: true,
    labels: { wrap: "Zeilen umbrechen" },
    children: wideCode,
  },
  play: async ({ canvas, canvasElement }) => {
    const toggle = await canvas.findByRole("button", {
      name: "Zeilen umbrechen",
    })
    await expect(toggle).toHaveAttribute("aria-pressed", "true")
    await expect(
      canvasElement.querySelector("[data-slot=code-block-content]")
    ).toHaveAttribute("data-wrap")
  },
}

/** A block whose lines fit has no wrap toggle, wrapped or not. */
export const CodeWrapOnlyWhenLong: Story = {
  args: {
    mode: "static",
    children: "```sh\npnpm install\n```\n\n" + wideCode,
  },
  play: async ({ canvas, canvasElement }) => {
    await canvas.findByRole("button", { name: "Wrap lines" })
    const [short, long] = canvasElement.querySelectorAll(
      "[data-slot=markdown-code-block]"
    )
    await expect(
      within(short as HTMLElement).queryByRole("button", { name: "Wrap lines" })
    ).toBeNull()
    // Wrapped, the long block keeps its toggle to unwrap it.
    const toggle = within(long as HTMLElement).getByRole("button", {
      name: "Wrap lines",
    })
    await userEvent.click(toggle)
    await expect(toggle).toHaveAttribute("aria-pressed", "true")
    await expect(toggle).toBeVisible()
  },
}

/** Starting wrapped, a short block has no toggle either. */
export const CodeWrapByDefaultShort: Story = {
  args: {
    mode: "static",
    codeWrap: true,
    children: wideCode + "\n\n```sh\nls\n```",
  },
  play: async ({ canvas, canvasElement }) => {
    await canvas.findByRole("button", { name: "Wrap lines" })
    await expect(
      canvas.getAllByRole("button", { name: "Wrap lines" })
    ).toHaveLength(1)
    await expect(
      canvasElement.querySelectorAll("[data-slot=markdown-code-block]")
    ).toHaveLength(2)
  },
}

const longPath =
  "/Users/someone/projects/agentui/node_modules/.pnpm/some-very-long-package-name@1.2.3/".repeat(
    3
  )
const narrow: Story["decorators"] = [
  (Story) => (
    <div className="w-72">
      <Story />
    </div>
  ),
]

/** A long path wraps within a narrow conversation. */
export const LongPath: Story = {
  decorators: narrow,
  args: { mode: "static", children: longPath },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>(
      "[data-slot=markdown]"
    )!
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth)
    await expect(
      root.querySelector("p")!.getBoundingClientRect().width
    ).toBeLessThanOrEqual(root.parentElement!.clientWidth)
  },
}

/** Inline code keeps its frame on each wrapped line. */
export const WrappingInlineCode: Story = {
  decorators: narrow,
  args: { mode: "static", children: `Use \`${longPath}\` here.` },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>(
      "[data-slot=markdown]"
    )!
    const code = root.querySelector("p code")!
    await expect(code.getClientRects().length).toBeGreaterThanOrEqual(2)
    await expect(
      getComputedStyle(code).getPropertyValue("box-decoration-break") ||
        getComputedStyle(code).getPropertyValue("-webkit-box-decoration-break")
    ).toBe("clone")
    // Chromium breaks the lines without the clone's end padding: they
    // may pass the lane by at most that, 0.36em of the code's 12px.
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth + 5)
  },
}

/** A chip carries its punctuation onto the same line while streaming. */
export const ChipPunctuation: Story = {
  decorators: narrow,
  args: {
    mode: "streaming",
    children:
      "For the full instructions see [spec.pdf](https://example.com/spec.pdf).\n\nA [plain link](https://example.com/plain), then `inline code`, continue.",
    components: {
      a: ({ href, children }) =>
        href?.endsWith("spec.pdf") ? (
          <Chip>{children}</Chip>
        ) : (
          <a href={href}>{children}</a>
        ),
    },
  },
  play: async ({ canvasElement }) => {
    const chip = canvasElement.querySelector("[data-slot=chip]")!
    const wrapper = chip.closest("[data-slot=markdown-nowrap]")!
    await expect(wrapper).not.toBeNull()
    await expect(wrapper.textContent).toBe("spec.pdf.")
    // Only a chip's pair is kept whole: a link or code still wraps inside.
    await expect(getComputedStyle(wrapper).whiteSpace).toBe("nowrap")
    const range = document.createRange()
    range.selectNodeContents(wrapper.lastChild!)
    const line = range.getBoundingClientRect()
    const box = chip.getBoundingClientRect()
    // Inline text sits on the chip's baseline within its taller box.
    await expect(line.top).toBeGreaterThanOrEqual(box.top - 1)
    await expect(line.top).toBeLessThan(box.bottom)
    await expect(
      canvasElement.querySelectorAll("[data-slot=markdown-nowrap]")
    ).toHaveLength(3)
    const link = canvasElement.querySelector("a")!.parentElement!
    await expect(link).toHaveAttribute("data-slot", "markdown-nowrap")
    await expect(getComputedStyle(link).whiteSpace).not.toBe("nowrap")
    await expect(
      canvasElement.querySelector("p code")!.parentElement
    ).toHaveAttribute("data-slot", "markdown-nowrap")
  },
}

/**
 * A wide table: its cells at most 24rem, wrapping, aligned to the top;
 * ordinary words stay whole, and what is still wider scrolls.
 */
export const WideTable: Story = {
  args: {
    mode: "static",
    children: `| Sentence | Path | Word | Notes |\n| -- | -- | -- | -- |\n| ${"A sentence with several ordinary words to wrap. ".repeat(12)} | ${longPath} | Documentation | ${"0123456789abcdef".repeat(4)} |`,
  },
  play: async ({ canvasElement }) => {
    const cells = [...canvasElement.querySelectorAll("td")]
    const scroller = canvasElement.querySelector<HTMLElement>(
      "[data-slot=markdown-table-content]"
    )!
    // What is wider than the lane scrolls (a long token, in Chromium and
    // WebKit), and a keyboard can scroll it.
    await expect(scroller.tabIndex).toBe(0)
    for (const cell of cells) {
      await expect(cell.getBoundingClientRect().width).toBeLessThanOrEqual(385)
      await expect(getComputedStyle(cell).verticalAlign).toBe("top")
    }
    const range = document.createRange()
    range.selectNodeContents(cells[0]!)
    await expect(range.getBoundingClientRect().height).toBeGreaterThan(
      parseFloat(getComputedStyle(cells[0]!).lineHeight)
    )
    range.selectNodeContents(cells[2]!)
    await expect(range.getClientRects()).toHaveLength(1)
  },
}

/**
 * A table in Japanese, in a narrow lane: CJK text can break after any
 * character, yet a column of short labels keeps each on one line, and the
 * longer cells wrap no narrower than 12rem; what does not fit scrolls.
 */
export const CjkTable: Story = {
  args: {
    mode: "static",
    children: [
      "| # | 部品 | 内容 | 利用者 | 移行元 |",
      "| - | -- | -- | -- | -- |",
      "| 1 | 通信形式の型定義 | 四種類の形式の要求、応答、ストリームのイベントを、そのままの形で読み書きする | すべて | api、web |",
      "| 2 | ストリーム分割 | 上限つきの SSE の読み書きと、イベントストリーム | すべて、ゲートウェイのみ | api の `frame` |",
    ].join("\n"),
  },
  render: (args) => (
    <div className="w-120">
      <Markdown {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const label = canvasElement.querySelector("tbody td:nth-child(2)")!
    const range = document.createRange()
    range.selectNodeContents(label)
    // "通信形式の型定義", one line, not a character a line.
    await expect(range.getClientRects()).toHaveLength(1)
    await expect(label).toHaveAttribute("data-short")
    const long = canvasElement.querySelector("tbody td:nth-child(3)")!
    await expect(long).not.toHaveAttribute("data-short")
    await expect(long.getBoundingClientRect().width).toBeGreaterThanOrEqual(192)
    const scroller = canvasElement.querySelector<HTMLElement>(
      "[data-slot=markdown-table-content]"
    )!
    await expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth)
  },
}

/**
 * Under a table, a button copies it: as an HTML table (a spreadsheet or
 * document pastes it as one) and as Markdown text, its alignment kept.
 */
export const TableCopy: Story = {
  args: { children: tables, mode: "static" },
  play: async ({ canvasElement }) => {
    const write = spyOn(navigator.clipboard, "write").mockResolvedValue()
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Copy table" }))
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1))
    const [item] = write.mock.calls[0]![0] as ClipboardItem[]
    await expect([...item!.types].sort()).toEqual(["text/html", "text/plain"])
    const text = await (await item!.getType("text/plain")).text()
    await expect(text).toBe(
      [
        "| Chunk | Before | After |",
        "| :--- | ---: | ---: |",
        "| index.js | 412 KB | 96 KB |",
        "| vendor.js | — | 141 KB |",
        "| pricing.css | 38 KB | 6 KB |",
      ].join("\n")
    )
    const html = await (await item!.getType("text/html")).text()
    const table = new DOMParser()
      .parseFromString(html, "text/html")
      .querySelector("table")!
    await expect(table.querySelectorAll("thead th")).toHaveLength(3)
    await expect(table.querySelectorAll("tbody tr")).toHaveLength(3)
    await waitFor(() =>
      expect(canvas.getByRole("button", { name: "Copied" })).toBeVisible()
    )
    write.mockRestore()
  },
}

/**
 * Full screen, a table has the room it needs, its size said, its heading
 * held at the top as it scrolls; Escape closes it, back on its button.
 */
export const TableFullScreen: Story = {
  args: {
    mode: "static",
    children: [
      "| Chunk | Before | After |",
      "| :-- | --: | --: |",
      ...Array.from(
        { length: 60 },
        (_, at) =>
          `| chunk-${at + 1}.js | ${at * 7 + 12} KB | ${at * 3 + 4} KB |`
      ),
    ].join("\n"),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const open = canvas.getByRole("button", { name: "Full screen" })
    await userEvent.click(open)
    const dialog = await within(document.body).findByRole("dialog")
    // Once it has faded in.
    await waitFor(() =>
      expect(within(dialog).getByText("60 rows · 3 columns")).toBeVisible()
    )
    await expect(
      within(dialog).getByRole("button", { name: "Copy table" })
    ).toBeVisible()
    const scroller = dialog.querySelector<HTMLElement>(
      "[data-slot=markdown-table-content]"
    )!
    await waitFor(() => expect(document.activeElement).toBe(scroller))
    await expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight)
    const heading = dialog.querySelector("th")!
    const top = heading.getBoundingClientRect().top
    scroller.scrollTop = 400
    await waitFor(() =>
      expect(heading.getBoundingClientRect().top).toBeCloseTo(top, 0)
    )
    await expect(getComputedStyle(heading).position).toBe("sticky")
    await userEvent.keyboard("{Escape}")
    await waitFor(() =>
      expect(within(document.body).queryByRole("dialog")).toBeNull()
    )
    await waitFor(() => expect(document.activeElement).toBe(open))
  },
}

const plans = [
  "| Tier | Pick | Price | Spec |",
  "| --- | --- | --- | --- |",
  "| Small services (a few containers, a bot, monitoring) | Alpha KVM 2, at its sale price until the 14th | about $8.79 a month | 2 cores, 8 GB, 100 GB NVMe |",
  "| Main server (a database, cluster nodes) | Beta RS 1000 or 2000, in the flash sale | €15.2 a month for 4 cores, €31.4 for 8 | dedicated cores, DDR5 |",
  "| Dedicated (many services, much memory) | Gamma LE-6, back in stock now and then | $31.9 a month | 16 cores, 128 GB, 2×4 TB and 2×512 GB NVMe |",
]
const plansAnswer = `For services only, compare what each price buys.\n\n${plans.join("\n")}\n\nThe flash sale is the one to wait for.`

/** An answer in a conversation's column, in a scroller as wide as given. */
function InAConversation({
  className,
  children,
}: {
  className: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "h-150 max-w-full overflow-hidden rounded-xl border",
        className
      )}
    >
      <MessageScrollerProvider>
        <MessageScroller>
          <MessageScrollerViewport aria-label="Conversation">
            <MessageScrollerContent className="mx-auto w-full max-w-column px-4 py-4">
              <Message>
                <MessageContent>{children}</MessageContent>
              </Message>
            </MessageScrollerContent>
          </MessageScrollerViewport>
        </MessageScroller>
      </MessageScrollerProvider>
    </div>
  )
}

/**
 * Over a table, its size and its buttons, where the eye comes to it:
 * seen as the table's, not the answer's.
 */
export const TableHeader: Story = {
  args: { children: tables, mode: "static" },
  play: async ({ canvas, canvasElement }) => {
    const header = canvasElement.querySelector<HTMLElement>(
      "[data-slot=markdown-table-header]"
    )!
    const table = canvasElement.querySelector("table")!
    await expect(header.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      table.getBoundingClientRect().top
    )
    await expect(header).toHaveTextContent("3 rows · 3 columns")
    for (const name of ["Copy table", "Full screen"])
      await expect(header.contains(canvas.getByRole("button", { name }))).toBe(
        true
      )
  },
}

/**
 * In a wide conversation, a table wider than the text takes the room
 * either side, centred, as wide as its columns need, clear of the
 * scroller's edges by 48px (past a scrollbar too); the text keeps its width, and a table that
 * fits keeps the text's.
 */
export const TableSpread: Story = {
  parameters: { conversation: true },
  args: { mode: "static", children: `${plansAnswer}\n\n${tables}` },
  render: (args) => (
    <InAConversation className="w-320">
      <Markdown {...args} />
    </InAConversation>
  ),
  play: async ({ canvasElement }) => {
    const lane = canvasElement
      .querySelector("[data-slot=markdown]")!
      .getBoundingClientRect()
    const viewport = canvasElement
      .querySelector("[data-slot=message-scroller-viewport]")!
      .getBoundingClientRect()
    const [wide, fits] = [
      ...canvasElement.querySelectorAll<HTMLElement>(
        "[data-slot=markdown-table]"
      ),
    ].map((table) => table.getBoundingClientRect())
    await expect(wide!.width).toBeGreaterThan(lane.width + 32)
    // Centred on the text.
    await expect(
      Math.abs(lane.left - wide!.left - (wide!.right - lane.right))
    ).toBeLessThanOrEqual(1)
    await expect(wide!.left - viewport.left).toBeGreaterThanOrEqual(48)
    await expect(viewport.right - wide!.right).toBeGreaterThanOrEqual(48)
    await expect(fits!.width).toBe(lane.width)
    await expect(fits!.left).toBe(lane.left)
    // Its columns whole: nothing to scroll.
    const content = canvasElement.querySelector<HTMLElement>(
      "[data-slot=markdown-table-content]"
    )!
    await expect(content.scrollWidth).toBeLessThanOrEqual(content.clientWidth)
  },
}

/**
 * In a conversation with no room beside the text, a wide table keeps
 * the text's width and scrolls.
 */
export const TableSpreadNoRoom: Story = {
  parameters: { conversation: true },
  args: { mode: "static", children: plansAnswer },
  render: (args) => (
    <InAConversation className="w-196">
      <Markdown {...args} />
    </InAConversation>
  ),
  play: async ({ canvasElement }) => {
    const lane = canvasElement
      .querySelector("[data-slot=markdown]")!
      .getBoundingClientRect()
    const table = canvasElement
      .querySelector("[data-slot=markdown-table]")!
      .getBoundingClientRect()
    await expect(table.width).toBe(lane.width)
    await expect(table.left).toBe(lane.left)
  },
}

/**
 * While it streams, a table shows whole rows only: a heading row waits
 * for its rule (never pipes in a paragraph first), a row for its line's
 * end.
 */
export const TableStreamingRows: Story = {
  args: { mode: "streaming", isAnimating: true, children: "" },
  render: (args) => (
    <div className="flex flex-col gap-6">
      {[
        "Compare them.\n\n| Tier | Pick |\n| --",
        `Compare them.\n\n${plans.slice(0, 3).join("\n")}\n| Dedicated (many`,
        // Not a table: pipes in code are code.
        "```text\n| a | b |\n| c",
      ].map((text) => (
        <div key={text} data-case>
          <Markdown {...args}>{text}</Markdown>
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const [heading, rows, code] = canvasElement.querySelectorAll("[data-case]")
    await expect(heading!.querySelector("table")).toBeNull()
    await expect(heading).not.toHaveTextContent("|")
    await expect(heading).toHaveTextContent("Compare them.")
    await expect(rows!.querySelectorAll("tbody tr")).toHaveLength(1)
    await expect(rows).not.toHaveTextContent("Dedicated")
    await waitFor(() => expect(code).toHaveTextContent("| c"))
  },
}

/** An answer written a few characters at a time, as an agent streams. */
function Streamed({ text }: { text: string }) {
  const [at, setAt] = React.useState(0)
  React.useEffect(() => {
    if (at >= text.length) return
    const timer = setTimeout(() => setAt((at) => at + 4), 8)
    return () => clearTimeout(timer)
  }, [at, text])
  return (
    <Markdown mode="streaming" isAnimating={at < text.length}>
      {text.slice(0, at)}
    </Markdown>
  )
}

/**
 * A table as it streams in a wide conversation: rows come whole, each
 * fading in; it only widens, centred, until its columns have their room.
 */
export const TableStreaming: Story = {
  parameters: { conversation: true },
  args: { children: "" },
  render: () => (
    <InAConversation className="w-320">
      <Streamed text={plansAnswer} />
    </InAConversation>
  ),
  play: async ({ canvasElement }) => {
    const cells = new Set(
      plans
        .slice(2)
        .flatMap((row) => row.split("|").slice(1, -1))
        .map((cell) => cell.trim())
    )
    const partial: string[] = []
    const widths: number[] = []
    // Each row drawn once (so faded in once), each fading in.
    const rows = new Set<Element>()
    let fading = false
    const observer = new MutationObserver(() => {
      for (const cell of canvasElement.querySelectorAll("td"))
        if (!cells.has(cell.textContent!.trim()))
          partial.push(cell.textContent!)
      const table = canvasElement.querySelector("[data-slot=markdown-table]")
      if (table) widths.push(table.getBoundingClientRect().width)
      for (const row of canvasElement.querySelectorAll("tbody tr")) {
        rows.add(row)
        if (getComputedStyle(row).transitionProperty.includes("opacity"))
          fading = true
      }
    })
    observer.observe(canvasElement, {
      childList: true,
      subtree: true,
      characterData: true,
    })
    await waitFor(
      () =>
        expect(canvasElement).toHaveTextContent(
          "The flash sale is the one to wait for."
        ),
      { timeout: 10000 }
    )
    observer.disconnect()
    await expect(partial).toEqual([])
    await expect(widths.length).toBeGreaterThan(0)
    for (const [at, width] of widths.entries())
      await expect(width).toBeGreaterThanOrEqual(widths[at - 1] ?? 0)
    await expect(rows.size).toBe(3)
    await expect(fading).toBe(true)
  },
}

/** Three-digit markers share a wider gutter; short lists keep theirs. */
export const ListFrom98: Story = {
  args: {
    mode: "static",
    children:
      "98. a\n99. b\n100. c\n101. d\n\nText between lists.\n\n1. a\n2. b",
  },
  play: async ({ canvasElement }) => {
    const lists = canvasElement.querySelectorAll("ol")
    const items = [...lists[0]!.querySelectorAll("li")]
    const pads = items.map((item) =>
      parseFloat(getComputedStyle(item).paddingInlineStart)
    )
    await expect(new Set(pads).size).toBe(1)
    await expect(pads[0]).toBeGreaterThan(28)
    const short = lists[1]!.querySelector("li")!
    await expect(
      parseFloat(getComputedStyle(short).paddingInlineStart)
    ).toBeCloseTo(28, 1)
    await expect(
      parseFloat(getComputedStyle(short, "::before").width)
    ).toBeCloseTo(20, 1)
    const last = items[3]!
    const marker = getComputedStyle(last, "::before")
    const probe = document.createElement("span")
    probe.style.fontFamily = marker.fontFamily
    probe.style.fontSize = marker.fontSize
    probe.style.display = "inline-block"
    probe.style.fontVariantNumeric = "tabular-nums"
    probe.textContent = "101"
    canvasElement.append(probe)
    const needed = probe.getBoundingClientRect().width
    probe.remove()
    await expect(parseFloat(marker.width)).toBeGreaterThanOrEqual(needed)
    const range = document.createRange()
    range.selectNodeContents(last)
    await expect(range.getBoundingClientRect().left).toBeGreaterThan(
      last.getBoundingClientRect().left + parseFloat(marker.width)
    )
  },
}

// An app's own language, registered before its code is shown.
registerLanguages({ elm: () => import("shiki/langs/elm.mjs") }, { el: "elm" })

const fence = (language: string, code: string) =>
  `\`\`\`${language}\n${code}\n\`\`\``

const polyglot = [
  fence("go", 'func main() {\n\tfmt.Println("hi", 42)\n}'),
  fence(
    "rust",
    'fn main() {\n    let n: u32 = 7; // seven\n    println!("{n}");\n}'
  ),
  fence("dockerfile", "FROM node:22\nRUN pnpm install"),
  fence("toml", '[package]\nname = "agent"'),
  fence("el", 'main = text "hi"'),
].join("\n\n")

/** A token of a kind in the code: its element. */
const token = (root: Element, text: string, kind: string) =>
  [...root.querySelectorAll<HTMLElement>(`.code-${kind}`)].find(
    (element) => element.textContent?.trim() === text
  )

/**
 * Code in colour: each kind of token its theme colour (--code-keyword,
 * …), in many languages, an app's own too; under data-code-tone
 * "graphite", the same code in greys, keywords by weight.
 */
export const SyntaxColours: Story = {
  args: { children: polyglot },
  render: (args) => (
    <div className="flex flex-col gap-4">
      <div data-testid="color">
        <Markdown {...args} />
      </div>
      <div data-testid="graphite" data-code-tone="graphite">
        <Markdown {...args} />
      </div>
    </div>
  ),
  play: async ({ canvas }) => {
    const color = canvas.getByTestId("color")
    const grey = canvas.getByTestId("graphite")
    await waitFor(
      () => {
        for (const [text, kind] of [
          ["func", "keyword"],
          ['"hi"', "string"],
          ["42", "number"],
          ["fn", "keyword"],
          ["u32", "type"],
          ["// seven", "comment"],
          ["FROM", "keyword"],
          ["main", "function"],
        ] as const)
          expect(token(color, text, kind), `${text} as ${kind}`).toBeDefined()
        // TOML's keys, the app's Elm.
        expect(color.querySelector(".code-property, .code-type")).not.toBeNull()
        expect(token(color, '"hi"', "string")).toBeDefined()
        // Five languages load the first time they are used.
      },
      { timeout: 8000 }
    )
    const foreground = getComputedStyle(color).color
    const keyword = token(color, "func", "keyword")!
    const string = token(color, '"hi"', "string")!
    // In colour: not the text's colour, each kind its own.
    await expect(getComputedStyle(keyword).color).not.toBe(foreground)
    await expect(getComputedStyle(keyword).color).not.toBe(
      getComputedStyle(string).color
    )
    await expect(getComputedStyle(keyword).fontWeight).toBe(
      getComputedStyle(color).fontWeight
    )
    // In greys: the keyword the text's colour, by its weight.
    await waitFor(() => expect(token(grey, "func", "keyword")).toBeDefined())
    const greyKeyword = token(grey, "func", "keyword")!
    await expect(getComputedStyle(greyKeyword).color).toBe(
      getComputedStyle(grey).color
    )
    await expect(getComputedStyle(greyKeyword).fontWeight).toBe("600")
  },
}

// A site's icon, drawn, so the story needs no network.
const siteIcon = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="4" fill="#22c55e"/></svg>'
)}`

/**
 * Links with the app's icon for their site (`linkIcon`): centred on the
 * line beside Japanese and Latin text alike, apart from the text before
 * it, on the line of the words after it; a bare address breaks anywhere.
 */
export const LinkIcons: Story = {
  args: {
    mode: "static",
    linkIcon: () => <img src={siteIcon} alt="" />,
    children:
      "詳しくは[公式ドキュメント](https://developer.mozilla.org/ja/docs/Web/API/Intersection_Observer_API)を参照し、https://developer.mozilla.org/ja/docs/Web/API/Intersection_Observer_API を開いてください。\n\nSee [the guide](https://example.com/guide) first.",
  },
  play: async ({ canvasElement }) => {
    const links = await waitFor(() => {
      const found = [
        ...canvasElement.querySelectorAll<HTMLElement>(
          "[data-slot=markdown-link-icon]"
        ),
      ].map((icon) => icon.parentElement!)
      expect(found).toHaveLength(3)
      return found
    })
    for (const link of links) {
      const image = link.querySelector("img")!
      await waitFor(() => expect(image.complete).toBe(true))
      const icon = image.getBoundingClientRect()
      await expect(icon.width).toBe(14)
      // In the middle of its words' first line: the same line, centred.
      const text = document.createRange()
      text.selectNodeContents(link.lastChild!)
      const first = text.getClientRects()[0]!
      await expect(
        Math.abs(first.top + first.height / 2 - (icon.top + icon.height / 2))
      ).toBeLessThanOrEqual(1)
      // Apart from the text before it, where that is on its line.
      const before = document.createRange()
      before.selectNodeContents(link.previousSibling!)
      const words = [...before.getClientRects()].at(-1)!
      if (Math.abs(words.top - first.top) < 4)
        await expect(icon.left - words.right).toBeGreaterThanOrEqual(1.5)
    }
  },
}

/**
 * A bullet list in Japanese, a list in it, and the same at a tool
 * result's smaller size: each dot on the middle of its item's first line,
 * whatever the line's height.
 */
export const BulletsCentred: Story = {
  args: {
    mode: "static",
    children:
      "- まずレジストリのビルドログを確認する\n- 次に linux 上の依存関係のバージョンを確認し、必要なら再インストールして、その結果をメモに書く。この項目は二行に折り返す\n  - 入れ子の項目\n- 最後にリリースする",
  },
  render: (args) => (
    <div className="flex max-w-sm flex-col gap-6">
      <Markdown {...args} />
      <div className="text-2sm/5 *:text-2sm/5">
        <Markdown {...args} />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const items = canvasElement.querySelectorAll<HTMLElement>("ul > li")
    await expect(items.length).toBe(8)
    for (const item of items) {
      const style = getComputedStyle(item)
      const dot = getComputedStyle(item, "::before")
      const middle =
        parseFloat(style.paddingTop) + parseFloat(style.lineHeight) / 2
      const centre = parseFloat(dot.top) + parseFloat(dot.height) / 2
      await expect(Math.abs(centre - middle)).toBeLessThanOrEqual(0.5)
    }
    // The answer's 28px lines and the smaller one's 20px both met.
    await expect(
      new Set([...items].map((item) => getComputedStyle(item).lineHeight))
    ).toEqual(new Set(["28px", "20px"]))
  },
}

/**
 * An app's own links (`linkProtocols`): `vesper://…` kept, for the app to
 * render through `components.a`, e.g. as a chip; a protocol it did not
 * allow still blocked.
 */
export const AppLinks: Story = {
  args: {
    mode: "static",
    linkProtocols: ["vesper"],
    components: {
      a: ({ href, children }) =>
        href?.startsWith("vesper:") ? (
          <Chip data-testid="app-link" data-href={href}>
            {children}
          </Chip>
        ) : (
          <a href={href}>{children}</a>
        ),
    },
    children:
      "See [the release thread](vesper://conversation/42) and [the reviewer](vesper://agent/7), not [this](other://x).",
  },
  play: async ({ canvas }) => {
    const links = await canvas.findAllByTestId("app-link")
    await expect(links.map((link) => link.dataset.href)).toEqual([
      "vesper://conversation/42",
      "vesper://agent/7",
    ])
    await expect(links[0]).toHaveTextContent("the release thread")
    // Not allowed: blocked, as before.
    await expect(canvas.getByText(/\[blocked\]/)).toBeVisible()
  },
}

const streamedDoc = `# Release notes

The build now **splits vendor code** once, and skips what nothing
imports.

- Faster cold starts
- Smaller bundles

  with a second paragraph in the item

\`\`\`ts
export default defineConfig({
  build: { cssCodeSplit: true },
})
\`\`\`

> A quote over
> two lines

| Step | Time |
| ---- | ---- |
| Build | 12s |
| Test | 40s |

1. one
2. two

Setext heading
--------------

And a last paragraph with \`code\` and a [link](https://example.com).`

/** Two streamed answers: one updated in place, one mounted afresh each step. */
function StreamedTwice({ length }: { length: number }) {
  const text = streamedDoc.slice(0, length)
  return (
    <div className="grid grid-cols-2 gap-6">
      <div data-testid="kept">
        <Markdown isAnimating>{text}</Markdown>
      </div>
      <div data-testid="fresh">
        <Markdown key={length} isAnimating>
          {text}
        </Markdown>
      </div>
    </div>
  )
}

/**
 * Streamed, an answer splits again only its last blocks, keeping the
 * rest: each step renders as the same text split whole does.
 */
export const StreamedBlocks: Story = {
  tags: ["!autodocs"],
  parameters: { conversation: true },
  render: function Render() {
    const [length, setLength] = React.useState(0)
    React.useEffect(() => {
      if (length >= streamedDoc.length) return
      const timer = setTimeout(() => setLength((was) => was + 9), 0)
      return () => clearTimeout(timer)
    }, [length])
    return (
      <div data-length={length}>
        <StreamedTwice length={length} />
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>("[data-length]")!
    // Its code's highlighting left out: it comes in when the highlighter
    // is done, in one before the other.
    const html = (id: string) => {
      const copy = canvasElement
        .querySelector(`[data-testid=${id}] [data-slot=markdown]`)!
        .cloneNode(true) as Element
      for (const line of copy.querySelectorAll(
        "[data-slot=code-block-line-content]"
      ))
        line.replaceChildren(line.textContent ?? "")
      return copy.innerHTML.replace(/_r_[\w]+_/g, "id")
    }
    let seen = -1
    while (Number(root.dataset.length) < streamedDoc.length) {
      await waitFor(() =>
        expect(Number(root.dataset.length)).toBeGreaterThan(seen)
      )
      seen = Number(root.dataset.length)
      await expect(html("kept")).toBe(html("fresh"))
    }
  },
}
