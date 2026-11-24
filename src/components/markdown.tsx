"use client"

import * as React from "react"
import { cn } from "cn"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert02Icon,
  ArrowExpand01Icon,
  Globe02Icon,
  SourceCodeIcon,
  TextWrapIcon,
} from "@hugeicons/core-free-icons"
import {
  type Components,
  type DiagramPlugin,
  type MathPlugin,
  defaultComponents,
  defaultRehypePlugins,
  parseMarkdownIntoBlocks,
  type ExtraProps,
  Streamdown,
  type StreamdownProps,
  useIsCodeFenceIncomplete,
} from "streamdown"

import { CopyButton, type CopyData } from "@/components/copy-button"
import {
  defaultLongTextLabels,
  LongRun,
  longRun,
  longRunPattern,
  type LongTextLabels,
} from "@/components/long-text"
import { Button } from "@/components/ui/button"
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockFooter,
  CodeBlockHeader,
  CodeBlockLine,
  CodeBlockRest,
  CodeBlockTitle,
  cutLines,
  useCodeBlockCut,
  type CodeBlockLabels,
} from "@/components/ui/code-block"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useHighlightedCode } from "@/hooks/use-highlighted-code"

type MarkdownLabels = CodeBlockLabels &
  LongTextLabels & {
    /** The button that opens a code block whole, with `onOpenCode`. */
    open: string
    /** The toggle that wraps a code block's long lines. */
    wrap: string
    /** A diagram's name, to a screen reader. */
    diagram: string
    /** A formula wide enough to scroll, to a screen reader. */
    formula: string
    /** The toggle that shows a diagram's code in its place. */
    diagramCode: string
    /** Under a diagram's code when it could not be drawn. */
    diagramFailed: string
    /** A table's name in full screen. */
    table: string
    /** How large a table is: "12 rows · 3 columns". */
    tableSize: (rows: number, columns: number) => string
    /** The button that copies a table, for a spreadsheet or a document. */
    tableCopy: string
    tableCopied: string
    tableCopyFailed: string
    /** The button that shows a table full screen. */
    tableFullScreen: string
    /** Full screen's close button. */
    close: string
  }

const defaultLabels: MarkdownLabels = {
  ...defaultLongTextLabels,
  more: "Show all",
  less: "Show less",
  lines: (lines) => `${lines} ${lines === 1 ? "line" : "lines"}`,
  collapse: "Collapse",
  open: "Open",
  wrap: "Wrap lines",
  diagram: "Diagram",
  formula: "Formula",
  diagramCode: "Show code",
  diagramFailed: "The diagram could not be drawn.",
  table: "Table",
  tableSize: (rows, columns) =>
    `${rows} ${rows === 1 ? "row" : "rows"} · ${columns} ${columns === 1 ? "column" : "columns"}`,
  tableCopy: "Copy table",
  tableCopied: "Copied",
  tableCopyFailed: "Could not copy",
  tableFullScreen: "Full screen",
  close: "Close",
}

/** Code, as `onOpenCode` gets it, with its file name if the fence has one. */
type MarkdownCode = { code: string; language: string; title?: string }

/**
 * A fence's file name, from its meta as most Markdown tools write it:
 * ```ts title="build.ts" (or 'build.ts', or unquoted without spaces).
 */
function fenceTitle(meta: unknown) {
  if (typeof meta !== "string") return undefined
  const match = /(?:^|\s)title=(?:"([^"]*)"|'([^']*)'|(\S+))/.exec(meta)
  return match?.slice(1).find(Boolean)
}

// A code block in prose: the gutter of its numbers as wide as two
// digits, so its code starts 40px in, not 46px.
const codeBlockClass = "[--code-block-gutter-min:--spacing(4)]"

const MarkdownContext = React.createContext<{
  labels: MarkdownLabels
  codeLines: number
  codeWrap: boolean
  headingOffset: number
  onOpenCode?: ((code: MarkdownCode) => void) | undefined
  diagrams?: DiagramPlugin | undefined
  linkIcon?: ((href: string) => React.ReactNode) | undefined
}>({ labels: defaultLabels, codeLines: 12, codeWrap: false, headingOffset: 0 })

/** The theme's colours, solid, as Mermaid takes them: hex, not oklch. */
function themeColors(element: Element) {
  const style = getComputedStyle(element)
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = 1
  const context = canvas.getContext("2d", { willReadFrequently: true })
  const background = style.getPropertyValue("--background").trim() || "white"
  // A colour over the page's, so a translucent one (a border) is solid.
  const solid = (name: string, fallback: string) => {
    if (!context) return fallback
    context.fillStyle = background
    context.fillRect(0, 0, 1, 1)
    context.fillStyle = style.getPropertyValue(name).trim() || fallback
    context.fillRect(0, 0, 1, 1)
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data
    return `#${[r, g, b].map((v) => (v ?? 0).toString(16).padStart(2, "0")).join("")}`
  }
  return {
    background: solid("--background", "#ffffff"),
    foreground: solid("--foreground", "#171717"),
    muted: solid("--muted", "#f5f5f5"),
    mutedForeground: solid("--muted-foreground", "#737373"),
    card: solid("--card", "#ffffff"),
    border: solid("--border", "#e5e5e5"),
    input: solid("--input", "#a3a3a3"),
    dark: style.colorScheme.includes("dark"),
  }
}

/** Mermaid's theme in the page's greys: no accent, hairlines, its type. */
function diagramConfig(element: Element) {
  const color = themeColors(element)
  const style = getComputedStyle(element)
  return {
    startOnLoad: false,
    securityLevel: "strict",
    suppressErrorRendering: true,
    theme: "base",
    fontFamily: style.fontFamily,
    themeVariables: {
      darkMode: color.dark,
      fontFamily: style.fontFamily,
      fontSize: "13px",
      background: color.background,
      textColor: color.foreground,
      primaryColor: color.muted,
      primaryTextColor: color.foreground,
      primaryBorderColor: color.input,
      secondaryColor: color.card,
      secondaryTextColor: color.foreground,
      secondaryBorderColor: color.border,
      tertiaryColor: color.background,
      tertiaryTextColor: color.foreground,
      tertiaryBorderColor: color.border,
      lineColor: color.mutedForeground,
      edgeLabelBackground: color.background,
      clusterBkg: color.card,
      clusterBorder: color.border,
      noteBkgColor: color.muted,
      noteTextColor: color.foreground,
      noteBorderColor: color.border,
      actorBkg: color.muted,
      actorBorder: color.input,
      actorTextColor: color.foreground,
      actorLineColor: color.mutedForeground,
      signalColor: color.foreground,
      signalTextColor: color.foreground,
      labelBoxBkgColor: color.muted,
      labelBoxBorderColor: color.input,
      labelTextColor: color.foreground,
      loopTextColor: color.foreground,
      activationBkgColor: color.muted,
      activationBorderColor: color.input,
    },
  }
}

// Mermaid is one instance with one config: diagrams are drawn one by one,
// so one drawn in dark does not take another's light colours.
let drawing: Promise<unknown> = Promise.resolve()

/** Redraws when the theme changes: its class or style on the root. */
function useThemeVersion() {
  const [version, setVersion] = React.useState(0)
  React.useEffect(() => {
    const observer = new MutationObserver(() => setVersion((v) => v + 1))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"],
    })
    return () => observer.disconnect()
  }, [])
  return version
}

/**
 * A ```mermaid block, drawn with the app's Mermaid plugin in the page's
 * greys, light or dark: in a code block's frame, its code a toggle away
 * and copied by its button. While it streams, and if it cannot be drawn,
 * its code shows.
 */
function MarkdownDiagram({
  code,
  plugin,
  labels: labelsProp,
}: {
  code: string
  plugin: DiagramPlugin
  labels?: Partial<MarkdownLabels>
}) {
  const context = React.useContext(MarkdownContext)
  const labels = { ...context.labels, ...labelsProp }
  const incomplete = useIsCodeFenceIncomplete()
  const ref = React.useRef<HTMLDivElement>(null)
  const id = `markdown-diagram-${React.useId().replace(/[^a-zA-Z0-9]/g, "")}`
  const version = useThemeVersion()
  const [drawn, setDrawn] = React.useState<{ svg: string } | "failed" | null>(
    null
  )
  const [showCode, setShowCode] = React.useState(false)
  const lines = useHighlightedCode(code, "mermaid")

  React.useEffect(() => {
    const element = ref.current
    if (incomplete || !element) return
    let current = true
    const config = diagramConfig(element)
    const run = drawing.then(() =>
      plugin.getMermaid(config).render(`${id}-${version}`, code)
    )
    drawing = run.catch(() => undefined)
    run.then(
      ({ svg }) => current && setDrawn({ svg }),
      () => current && setDrawn("failed")
    )
    return () => {
      current = false
    }
  }, [code, incomplete, plugin, id, version])

  const svg = drawn !== null && drawn !== "failed" ? drawn.svg : null
  const failed = drawn === "failed"
  const codeShown = showCode || svg === null
  return (
    <CodeBlock
      ref={ref}
      data-slot="markdown-diagram"
      className={codeBlockClass}
    >
      <CodeBlockHeader>
        <CodeBlockTitle className="font-normal text-muted-foreground">
          mermaid
        </CodeBlockTitle>
        <CodeBlockActions>
          {svg !== null && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={labels.diagramCode}
                    aria-pressed={showCode}
                    onClick={() => setShowCode(!showCode)}
                  />
                }
              >
                <HugeiconsIcon icon={SourceCodeIcon} strokeWidth={2} />
              </TooltipTrigger>
              <TooltipContent>{labels.diagramCode}</TooltipContent>
            </Tooltip>
          )}
          <CodeBlockCopyButton value={code} />
        </CodeBlockActions>
      </CodeBlockHeader>
      {codeShown ? (
        <CodeBlockContent lineNumbers>
          {lines.map((line, index) => (
            <CodeBlockLine key={index}>{line}</CodeBlockLine>
          ))}
        </CodeBlockContent>
      ) : (
        <div
          role="img"
          aria-label={labels.diagram}
          data-slot="markdown-diagram-content"
          className="flex min-w-0 justify-center overflow-x-auto p-4 [&>svg]:h-auto [&>svg]:max-w-full"
          // Mermaid's own SVG, drawn with securityLevel "strict".
          dangerouslySetInnerHTML={{ __html: svg ?? "" }}
        />
      )}
      {failed && (
        <CodeBlockFooter className="flex items-center gap-2 border-t px-3 py-2 text-xs text-muted-foreground [&_svg]:size-3.5 [&_svg]:shrink-0">
          <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
          {labels.diagramFailed}
        </CodeBlockFooter>
      )}
    </CodeBlock>
  )
}

/**
 * A fenced block of code, as the rest of the conversation's code is,
 * with line numbers. Longer than `lines` (12), it folds to those in its
 * own card, fading out, a bar across its foot showing the rest
 * (`CodeBlock`'s `lines`); with `onOpen`, a button in its header opens
 * it whole, e.g. beside the conversation.
 */
function MarkdownCodeBlock({
  code,
  language,
  title,
  lines: max,
  onOpen,
  defaultWrap,
  labels: labelsProp,
}: {
  code: string
  language: string
  /** Its file name, shown in place of its language. */
  title?: string | undefined
  /** The lines shown before the rest is asked for. */
  lines?: number
  /** Whether its long lines start wrapped. */
  defaultWrap?: boolean
  onOpen?: (code: MarkdownCode) => void
  labels?: Partial<MarkdownLabels>
}) {
  const context = React.useContext(MarkdownContext)
  const labels = { ...context.labels, ...labelsProp }
  const open = onOpen ?? context.onOpenCode
  const [wrap, setWrap] = React.useState(defaultWrap ?? context.codeWrap)
  const content = React.useRef<HTMLPreElement>(null)
  const long = useLongLines(content, wrap, code)
  return (
    <CodeBlock
      data-slot="markdown-code-block"
      lines={max ?? context.codeLines}
      labels={labels}
      className={codeBlockClass}
    >
      <CodeBlockHeader>
        <CodeBlockTitle className="font-normal text-muted-foreground">
          {title ?? language}
        </CodeBlockTitle>
        <CodeBlockActions>
          {long && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={labels.wrap}
                    aria-pressed={wrap}
                    onClick={() => setWrap(!wrap)}
                  />
                }
              >
                <HugeiconsIcon icon={TextWrapIcon} strokeWidth={2} />
              </TooltipTrigger>
              <TooltipContent>{labels.wrap}</TooltipContent>
            </Tooltip>
          )}
          {open && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={labels.open}
                    onClick={() =>
                      open(
                        title ? { code, language, title } : { code, language }
                      )
                    }
                  />
                }
              >
                <HugeiconsIcon icon={ArrowExpand01Icon} strokeWidth={2} />
              </TooltipTrigger>
              <TooltipContent>{labels.open}</TooltipContent>
            </Tooltip>
          )}
          <CodeBlockCopyButton value={code} />
        </CodeBlockActions>
      </CodeBlockHeader>
      <MarkdownCodeContent
        ref={content}
        code={code}
        language={language}
        wrap={wrap}
      />
    </CodeBlock>
  )
}

/**
 * Whether a block's lines are too long for it: unwrapped, they scroll
 * sideways; wrapped, one takes more than a line. Only then does its
 * wrap toggle show. Measured again as it resizes and as its code grows.
 */
function useLongLines(
  ref: React.RefObject<HTMLPreElement | null>,
  wrap: boolean,
  code: string
) {
  const [long, setLong] = React.useState(false)
  React.useLayoutEffect(() => {
    const pre = ref.current
    if (!pre) return
    const measure = () => {
      if (!wrap) return setLong(pre.scrollWidth > pre.clientWidth)
      const lineHeight = parseFloat(getComputedStyle(pre).lineHeight)
      let wrapped = false
      for (const line of pre.querySelectorAll<HTMLElement>(
        "[data-slot=code-block-line]"
      ))
        if (line.offsetHeight > lineHeight * 1.5) {
          wrapped = true
          break
        }
      setLong(wrapped)
    }
    // agentui: told once laid out, as the observer starts, not read as
    // it mounts: a block mounting while the layout is dirty (a message
    // windowed in as the reader scrolls) would force a layout of the page.
    const observer = new ResizeObserver(measure)
    observer.observe(pre)
    return () => observer.disconnect()
  }, [ref, wrap, code])
  return long
}

/**
 * A fenced block's lines. Folded, only those it shows are highlighted
 * and rendered, the rest one plain text until it opens: a fence of
 * thousands of lines (a log, a generated file) costs a dozen.
 */
function MarkdownCodeContent({
  ref,
  code,
  language,
  wrap,
}: {
  ref: React.Ref<HTMLPreElement>
  code: string
  language: string
  wrap: boolean
}) {
  const [head, rest] = cutLines(
    code.endsWith("\n") ? code.slice(0, -1) : code,
    useCodeBlockCut()
  )
  // The hook drops a last newline: given one, an empty last line stays.
  const lines = useHighlightedCode(rest === null ? code : `${head}\n`, language)
  return (
    <CodeBlockContent
      ref={ref}
      lineNumbers
      wrap={wrap}
      // Its fence's language, e.g. for a quote of it (selectionMarkdown).
      data-language={language || undefined}
    >
      {lines.map((line, index) => (
        <CodeBlockLine key={index}>{line}</CodeBlockLine>
      ))}
      {rest !== null && <CodeBlockRest>{rest}</CodeBlockRest>}
    </CodeBlockContent>
  )
}

/** A fenced block: a diagram in the diagram plugin's language, else code. */
function FencedCode({
  code,
  language,
  title,
}: {
  code: string
  language: string
  title?: string | undefined
}) {
  const { diagrams } = React.useContext(MarkdownContext)
  return diagrams && language === diagrams.language ? (
    <MarkdownDiagram code={code} plugin={diagrams} />
  ) : (
    <MarkdownCodeBlock code={code} language={language} title={title} />
  )
}

type ElementProps<Tag extends keyof React.JSX.IntrinsicElements> =
  React.ComponentProps<Tag> & ExtraProps

/** An element's props without react-markdown's `node`, not for the DOM. */
function domProps<Props extends ExtraProps>({ node, ...props }: Props) {
  void node
  return props
}

/** A node of the HTML tree Streamdown renders, as far as it is read here. */
type MarkdownNode = {
  type: string
  tagName?: string
  value?: string
  properties?: Record<string, unknown>
  children?: MarkdownNode[]
}

/** Keep the original delimiters, which KaTeX's output no longer holds. */
function remarkMathSource() {
  type SourceNode = MarkdownNode & {
    lang?: string
    position?: { start: { offset?: number }; end: { offset?: number } }
    data?: { hProperties?: Record<string, unknown> }
  }
  return function walk(node: SourceNode, file: { value: unknown }) {
    if (
      node.type === "inlineMath" ||
      node.type === "math" ||
      (node.type === "code" && node.lang === "math")
    ) {
      const start = node.position?.start.offset
      const end = node.position?.end.offset
      if (start !== undefined && end !== undefined) {
        const source = String(file.value).slice(start, end)
        const lines = source.split("\n")
        const marker = /^[`~]+/.exec(lines[0]!.trim())?.[0]
        const fence =
          node.type === "code" && marker
            ? new RegExp(`^${marker[0]}{${marker.length},}$`)
            : /^\${2,}$/
        node.data ??= {}
        node.data.hProperties = {
          ...node.data.hProperties,
          dataMathSource: source,
          ...(node.type !== "inlineMath" &&
          (lines.length === 1 || !fence.test(lines.at(-1)!.trim()))
            ? { dataMathOpen: true }
            : {}),
        }
      }
    }
    for (const child of node.children ?? []) walk(child as SourceNode, file)
  }
}

function mathProperty(node: MarkdownNode, name: string) {
  return (
    node.properties?.[name] ??
    node.properties?.[
      name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
    ]
  )
}

function mathClasses(node: MarkdownNode) {
  const value = node.properties?.className
  return Array.isArray(value)
    ? value.map(String)
    : String(value ?? "").split(/\s+/)
}

function nodeText(node: MarkdownNode): string {
  return node.value ?? (node.children ?? []).map(nodeText).join("")
}

/** Wrap before KaTeX replaces the code, keeping its source beside it. */
function rehypeMathFormula() {
  return function walk(node: MarkdownNode) {
    if (!node.children) return
    node.children = node.children.map((child) => {
      const block = child.tagName === "pre"
      const code = block ? child.children?.[0] : child
      if (
        code?.tagName === "code" &&
        mathClasses(code).some((name) =>
          block
            ? name === "math-display" || name === "language-math"
            : name === "math-inline"
        )
      ) {
        const text = nodeText(code)
        const tex = block ? text.replace(/\n$/, "") : text
        const source =
          mathProperty(child, "dataMathSource") ??
          mathProperty(code, "dataMathSource")
        const open =
          (mathProperty(child, "dataMathOpen") ??
            mathProperty(code, "dataMathOpen")) !== undefined
        if (open)
          code.properties = {
            ...code.properties,
            className: mathClasses(code).filter(
              (name) =>
                !["math-inline", "math-display", "language-math"].includes(name)
            ),
          }
        return {
          type: "element",
          tagName: "markdown-math",
          properties: {
            dataTex: tex,
            dataSource: source ?? (block ? `$$\n${tex}\n$$` : `$$${tex}$$`),
            dataDisplay: block ? "block" : "inline",
            ...(open ? { dataOpen: true } : {}),
          },
          children: [child],
        }
      }
      walk(child)
      return child
    })
  }
}

function rehypeMathFailed() {
  const failed = (node: MarkdownNode): boolean =>
    mathClasses(node).includes("katex-error") ||
    (node.children ?? []).some(failed)
  return function walk(node: MarkdownNode) {
    if (node.tagName === "markdown-math" && failed(node))
      node.properties = { ...node.properties, dataFailed: true }
    for (const child of node.children ?? []) walk(child)
  }
}

let mathCopies = 0
const mathSelector = '[data-slot="markdown-math"]'

/** Copy the written formula, including when a selection cuts through it. */
function copyMath(event: ClipboardEvent) {
  const selection = document.getSelection()
  if (!event.clipboardData || !selection?.rangeCount || selection.isCollapsed)
    return
  const range = selection.getRangeAt(0).cloneRange()
  if (range.collapsed) return
  const formula = (node: Node) =>
    (node instanceof Element ? node : node.parentElement)?.closest(mathSelector)
  const start = formula(range.startContainer)
  const end = formula(range.endContainer)
  if (start) range.setStartBefore(start)
  if (end) range.setEndAfter(end)
  const fragment = range.cloneContents()
  const formulas = fragment.querySelectorAll<HTMLElement>(mathSelector)
  if (!formulas.length) return
  for (const element of formulas)
    element.replaceWith(document.createTextNode(element.dataset.source ?? ""))
  const text = document.createElement("div")
  text.setAttribute("aria-hidden", "true")
  text.style.position = "fixed"
  text.style.left = "-10000px"
  text.append(fragment)
  document.body.append(text)
  try {
    event.clipboardData.setData("text/plain", text.innerText)
    event.preventDefault()
  } finally {
    text.remove()
  }
}

function MarkdownMath({
  children,
  ...props
}: React.PropsWithChildren<{
  "data-tex"?: string
  "data-source"?: string
  "data-display"?: string
  "data-open"?: boolean
  "data-failed"?: boolean
}>) {
  const { labels } = React.useContext(MarkdownContext)
  const ref = React.useRef<HTMLDivElement>(null)
  const [wide, setWide] = React.useState(false)
  const block = props["data-display"] === "block"
  const source = props["data-open"] || props["data-failed"]
  React.useEffect(() => {
    if (mathCopies++ === 0) document.addEventListener("copy", copyMath)
    return () => {
      if (--mathCopies === 0) document.removeEventListener("copy", copyMath)
    }
  }, [])
  React.useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => setWide(element.scrollWidth > element.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    if (element.firstElementChild) observer.observe(element.firstElementChild)
    return () => observer.disconnect()
  }, [children, source])
  const content = source ? (
    block ? (
      <pre
        data-slot="markdown-math-source"
        className="scrollbar-thin overflow-x-auto rounded-md bg-muted/60 px-3 py-2 font-mono text-2sm whitespace-pre ring-1 ring-border ring-inset"
      >
        {props["data-tex"]}
      </pre>
    ) : (
      <code
        data-slot="markdown-math-source"
        className="rounded-xs bg-muted/60 box-decoration-clone px-1 py-px font-mono text-2sm ring-1 ring-border ring-inset"
      >
        {props["data-tex"]}
      </code>
    )
  ) : (
    children
  )
  return block ? (
    <div
      ref={ref}
      data-slot="markdown-math"
      data-display="block"
      data-source={props["data-source"]}
      tabIndex={wide ? 0 : undefined}
      role={wide ? "group" : undefined}
      aria-label={wide ? labels.formula : undefined}
      className="w-full max-w-full min-w-0 scrollbar-thin overflow-x-auto overflow-y-hidden rounded-xs py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_.katex-display]:my-0"
    >
      {content}
    </div>
  ) : (
    <span
      data-slot="markdown-math"
      data-display="inline"
      data-source={props["data-source"]}
      className="wrap-normal"
    >
      {content}
    </span>
  )
}

/**
 * Its blocks parsed again from the second-last block on, the rest kept:
 * an answer streaming in grows at its end, so all but its last blocks are
 * as they were. Streamdown splits the whole text each update otherwise,
 * 256 KiB of it for a long answer. Whole where that would not be the
 * same: footnotes (their references join the text into one block), or
 * text that did not grow from what was split.
 */
function useStreamedBlocks() {
  const last = React.useRef<{ text: string; blocks: string[] } | null>(null)
  return React.useCallback((text: string) => {
    const was = last.current
    let blocks: string[] | undefined
    if (was && was.blocks.length > 2 && !text.includes("[^")) {
      const keep = was.blocks.length - 2
      let at = 0
      for (let index = 0; index < keep; index++) at += was.blocks[index]!.length
      if (text.startsWith(was.text.slice(0, at)))
        blocks = [
          ...was.blocks.slice(0, keep),
          ...parseMarkdownIntoBlocks(text.slice(at)),
        ]
    }
    blocks ??= parseMarkdownIntoBlocks(text)
    last.current = { text, blocks }
    return blocks
  }, [])
}

/** Short digests of plugin options, by the object, made once. */
const digests = new WeakMap<object, string>()

/**
 * A plugin's options as Streamdown keys its processor cache by them: it
 * writes each render's options out as JSON, every update of a streamed
 * answer, a sanitizer's schema and all. A copy whose `toJSON` is a digest
 * of them, made once: the same options, the same key, for a fraction of
 * the work. The plugin sees the same fields.
 */
function keyedOptions(options: unknown): unknown {
  if (typeof options !== "object" || options === null) return options
  let digest = digests.get(options)
  if (digest === undefined) {
    // FNV-1a over the JSON, as two 32-bit halves.
    const json = JSON.stringify(options) ?? ""
    let low = 0x811c9dc5
    let high = 0x01000193
    for (let index = 0; index < json.length; index++) {
      const code = json.charCodeAt(index)
      low = Math.imul(low ^ code, 16777619)
      high = Math.imul(high ^ code, 2246822519)
    }
    digest = `${json.length}:${(low >>> 0).toString(36)}${(high >>> 0).toString(36)}`
    digests.set(options, digest)
  }
  const copy = Object.assign(
    Object.create(Object.getPrototypeOf(options) as object) as object,
    options
  )
  const key = digest
  Object.defineProperty(copy, "toJSON", { value: () => key })
  return copy
}

/**
 * A link or inline code and the punctuation right after it in one span,
 * kept on one line when it holds a chip: a browser may break after an
 * inline-flex chip even before a period, starting a line with it. Plain
 * links and code still wrap inside, and never break before the period.
 */
function rehypeKeepPunctuation() {
  return function walk(node: MarkdownNode) {
    if (node.tagName === "pre" || !node.children) return
    for (let index = 0; index < node.children.length; index++) {
      const child = node.children[index]!
      walk(child)
      const next = node.children[index + 1]
      if (
        child.type !== "element" ||
        (child.tagName !== "a" && child.tagName !== "code") ||
        next?.type !== "text"
      )
        continue
      const punctuation = /^[.,:;!?…)\]}"'’”]+/.exec(next.value ?? "")?.[0]
      if (!punctuation) continue
      const rest = (next.value ?? "").slice(punctuation.length)
      node.children.splice(
        index,
        2,
        {
          type: "element",
          tagName: "span",
          properties: {
            dataSlot: "markdown-nowrap",
            className: ["has-[[data-slot=chip]]:whitespace-nowrap"],
          },
          children: [child, { type: "text", value: punctuation }],
        },
        ...(rest ? [{ type: "text", value: rest }] : [])
      )
    }
  }
}

/**
 * Marks the answer's long runs (`LongRun`) for its `span` to fold: in
 * its text, not in a code block (which scrolls, a line unbroken).
 */
const unfolded = new Set(["pre", "markdown-math", "math", "svg"])

function rehypeLongRuns() {
  return (tree: MarkdownNode) => walk(tree, false)
  function walk(node: MarkdownNode, inLink: boolean) {
    if (!node.children || unfolded.has(node.tagName ?? "")) return
    const link = inLink || node.tagName === "a"
    for (let index = 0; index < node.children.length; index++) {
      const child = node.children[index]!
      if (child.type === "element") {
        if (child.properties?.dataSlot !== "markdown-long-run")
          walk(child, link)
        continue
      }
      const value = child.type === "text" ? (child.value ?? "") : ""
      if (value.length <= longRun) continue
      const parts: MarkdownNode[] = []
      let at = 0
      for (const match of value.matchAll(longRunPattern)) {
        if (match.index > at)
          parts.push({ type: "text", value: value.slice(at, match.index) })
        parts.push({
          type: "element",
          tagName: "span",
          properties: {
            dataSlot: "markdown-long-run",
            ...(link && { dataPlain: "" }),
          },
          children: [{ type: "text", value: match[0] }],
        })
        at = match.index + match[0].length
      }
      if (at === 0) continue
      if (at < value.length)
        parts.push({ type: "text", value: value.slice(at) })
      node.children.splice(index, 1, ...parts)
      index += parts.length - 1
    }
  }
}

/** A span of the answer's: a long run marked to fold, or as it is. */
function MarkdownSpan(all: React.ComponentProps<"span"> & ExtraProps) {
  const { children, ...props } = domProps(all)
  const { labels } = React.useContext(MarkdownContext)
  const own = props as Record<string, unknown>
  if (own["data-slot"] === "markdown-long-run" && typeof children === "string")
    return (
      <LongRun
        text={children}
        plain={own["data-plain"] !== undefined}
        labels={labels}
      />
    )
  return <span {...props}>{children}</span>
}

/** Whether a link's words are its address, as an autolink's are. */
const isAddress = (children: React.ReactNode, href: string | undefined) =>
  typeof children === "string" &&
  (children === href || /^[a-z][a-z\d+.-]*:\/\/\S+$/i.test(children))

/**
 * A link in the answer, with the app's icon for its site before it
 * (`linkIcon`): centred on the line in any script, a little apart from
 * the text before it, kept with the words after it; an address breaks
 * anywhere, going on beside it.
 */
function MarkdownLink({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Link>) {
  const { linkIcon } = React.useContext(MarkdownContext)
  const href = typeof props.href === "string" ? props.href : undefined
  const icon = href && linkIcon ? linkIcon(href) : null
  const shown = icon !== undefined && icon !== null && icon !== false
  return (
    <Link
      className={cn(
        "font-normal text-foreground decoration-muted-foreground underline-offset-3 hover:decoration-foreground",
        isAddress(children, href) && "break-all",
        className
      )}
      {...props}
    >
      {shown && (
        // A line tall, at the line's top: its icon in the middle of the
        // line, where the text's glyphs are centred (not by the Latin
        // x-height, which leaves it low beside CJK text).
        <span
          aria-hidden="true"
          data-slot="markdown-link-icon"
          className="ms-0.5 me-1 inline-flex h-lh items-center align-top no-underline *:shrink-0 [&>img]:size-3.5 [&>img]:object-contain [&>svg]:size-3.5"
        >
          {icon}
        </span>
      )}
      {/* No break between the icon and its words. */}
      {shown && "\u2060"}
      {children}
    </Link>
  )
}

const InlineCode = defaultComponents.code!
const ListItem = defaultComponents.li!
const Link = defaultComponents.a!
const Superscript = defaultComponents.sup!
const Section = defaultComponents.section!

/** The first link's address in a node, but a footnote's way back. */
function firstHref(node: React.ReactNode): string | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const href = firstHref(child)
      if (href) return href
    }
    return undefined
  }
  if (!React.isValidElement<Record<string, unknown>>(node)) return undefined
  const { href, children } = node.props
  if (typeof href === "string" && !("data-footnote-backref" in node.props))
    return href
  return firstHref(children as React.ReactNode)
}

/** A web address's host, without "www.", or nothing. */
function host(href: string | undefined) {
  if (!href) return undefined
  try {
    return new URL(href).host.replace(/^www\./, "")
  } catch {
    return undefined
  }
}

/**
 * Lists hang from their markers, so a wrapped line starts under the text,
 * not the marker; items and nested lists close, as a chat's are.
 */
function UnorderedList(all: ElementProps<"ul">) {
  const { className, ...props } = domProps(all)
  return (
    <ul
      data-streamdown="unordered-list"
      role="list"
      className={cn(
        "flex list-none flex-col gap-1 ps-0 [li>&]:mt-1",
        // Its marks small grey dots, the text hanging 8px after them.
        "[&>li]:relative [&>li]:ps-4 [&>li]:before:absolute [&>li]:before:start-1 [&>li]:before:size-1 [&>li]:before:rounded-full [&>li]:before:bg-subtle-foreground [&>li]:before:content-['']",
        // grid: mark (a 4px dot centred on the first line, at any line
        // height: half a line, less half the dot)
        "[&>li]:before:top-[calc(0.5lh-(--spacing(0.5)))]",
        className
      )}
      {...props}
    />
  )
}

/**
 * Its numbers in small grey circles, the items' text hanging after them;
 * still a list to a screen reader (`list-none` makes it none in Safari).
 * The footnotes' list, the sources, numbers its own.
 */
function OrderedList(all: ElementProps<"ol">) {
  const { className, start, style, ...props } = domProps(all)
  const count = React.Children.toArray(props.children).filter(
    React.isValidElement
  ).length
  const digits = String((start ?? 1) + count - 1).length
  return (
    <ol
      data-streamdown="ordered-list"
      role="list"
      start={start}
      // From `start`, as the numbers it would have shown.
      style={
        {
          counterReset: `list ${(start ?? 1) - 1}`,
          "--markdown-list-digits": digits,
          ...style,
        } as React.CSSProperties
      }
      className={cn(
        "list-none ps-0 [&>li+li:not([data-slot=markdown-source])]:mt-1 [li>&]:mt-1",
        "[&>li:not([data-slot=markdown-source])]:relative [&>li:not([data-slot=markdown-source])]:ps-[max(calc(7*var(--spacing)),calc(var(--markdown-list-digits)*1ch*0.6875_+_4*var(--spacing)))] [&>li:not([data-slot=markdown-source])]:[counter-increment:list]",
        // Keep the 20px circle and 8px gap, the circle centred on the first
        // 24px line; wider numbers share a pill. grid: mark
        "[&>li:not([data-slot=markdown-source])]:before:absolute [&>li:not([data-slot=markdown-source])]:before:start-0 [&>li:not([data-slot=markdown-source])]:before:top-1 [&>li:not([data-slot=markdown-source])]:before:grid [&>li:not([data-slot=markdown-source])]:before:h-5 [&>li:not([data-slot=markdown-source])]:before:w-[max(--spacing(5),calc(var(--markdown-list-digits)*1ch_+_--spacing(2)))] [&>li:not([data-slot=markdown-source])]:before:place-items-center [&>li:not([data-slot=markdown-source])]:before:rounded-full [&>li:not([data-slot=markdown-source])]:before:bg-muted [&>li:not([data-slot=markdown-source])]:before:px-0.5 [&>li:not([data-slot=markdown-source])]:before:text-2xs [&>li:not([data-slot=markdown-source])]:before:leading-none [&>li:not([data-slot=markdown-source])]:before:text-muted-foreground [&>li:not([data-slot=markdown-source])]:before:tabular-nums [&>li:not([data-slot=markdown-source])]:before:content-[counter(list)]",
        className
      )}
      {...props}
    />
  )
}

/**
 * A list item; a footnote's is a source: its number, its title (the
 * footnote's text) and the host it links to.
 */
function Item({ className, children, ...props }: ElementProps<"li">) {
  if (props.id?.startsWith("user-content-fn-")) {
    const site = host(firstHref(children))
    return (
      <ListItem
        data-slot="markdown-source"
        className={cn(
          "flex min-h-7 items-center gap-2 ps-0 [counter-increment:source] [&_[data-streamdown=link]]:text-muted-foreground [&_[data-streamdown=link]]:no-underline [&_[data-streamdown=link]:hover]:text-foreground [&_[data-streamdown=link]:hover]:underline",
          className
        )}
        {...props}
      >
        <span
          aria-hidden="true"
          className="grid h-4 min-w-4 shrink-0 place-items-center rounded-sm bg-muted px-1 text-2xs leading-none font-medium tabular-nums before:content-[counter(source)]"
        />
        <HugeiconsIcon
          icon={Globe02Icon}
          strokeWidth={2}
          aria-hidden="true"
          className="size-3.5 shrink-0"
        />
        <span className="min-w-0 truncate *:inline">{children}</span>
        {site && (
          <span className="ms-auto shrink-0 ps-3 text-subtle-foreground">
            {site}
          </span>
        )}
      </ListItem>
    )
  }
  return (
    <ListItem className={cn("py-0", className)} {...props}>
      {children}
    </ListItem>
  )
}

const heading = (Tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6", size: string) =>
  function MarkdownHeading(all: ElementProps<typeof Tag>) {
    const { headingOffset: offset } = React.useContext(MarkdownContext)
    const level = Number(Tag.slice(1))
    const { className, ...props } = domProps(all)
    return (
      <Tag
        data-streamdown={`heading-${Tag.slice(1)}`}
        aria-level={offset > 0 ? Math.min(level + offset, 6) : undefined}
        // Jumped to (an outline), it stays clear of a bar over it, and
        // the focus it is given shows no ring: it is not a control. 8px
        // over what it heads, nearer it than the blocks are to each other.
        className={cn(
          // 24px over it (12 past the column's 12), after another
          // heading or a rule as well, 8 under it (4 less than the 12):
          // the conversation's rhythm (docs/grid.md).
          "mt-3 -mb-1 scroll-mt-16 font-semibold text-balance outline-none first:mt-0 [:is(h1,h2,h3,h4,h5,h6)+&]:mt-4 [hr+&]:mt-0",
          size,
          className
        )}
        {...props}
      />
    )
  }

/** A table's rows, as text, and each column's alignment, from its tree. */
function tableCells(node: MarkdownNode | undefined) {
  const rows: string[][] = []
  const align: (string | undefined)[] = []
  const walk = (parent: MarkdownNode) => {
    for (const child of parent.children ?? []) {
      if (child.tagName === "tr") {
        const cells = (child.children ?? []).filter(
          (cell) => cell.tagName === "th" || cell.tagName === "td"
        )
        if (rows.length === 0)
          for (const cell of cells)
            align.push(
              typeof cell.properties?.align === "string"
                ? cell.properties.align
                : undefined
            )
        rows.push(
          cells.map((cell) => nodeText(cell).trim().replace(/\s+/g, " "))
        )
      } else walk(child)
    }
  }
  if (node) walk(node)
  return { rows, align }
}

/** A table in Markdown, its columns' alignment kept, pipes escaped. */
function cellsToMarkdown(
  rows: readonly string[][],
  align: readonly (string | undefined)[]
) {
  const columns = Math.max(0, ...rows.map((row) => row.length))
  const line = (row: readonly string[]) =>
    `| ${Array.from({ length: columns }, (_, at) =>
      (row[at] ?? "").replaceAll("|", "\\|")
    ).join(" | ")} |`
  const rule = Array.from({ length: columns }, (_, at) =>
    align[at] === "center"
      ? ":---:"
      : align[at] === "right"
        ? "---:"
        : align[at] === "left"
          ? ":---"
          : "---"
  )
  const [head = [], ...body] = rows
  return [line(head), `| ${rule.join(" | ")} |`, ...body.map(line)].join("\n")
}

/** A table as HTML, its first row the heading: a spreadsheet's paste. */
function cellsToHtml(rows: readonly string[][]) {
  const escape = (text: string) =>
    text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
  const [head = [], ...body] = rows
  const row = (cells: readonly string[], tag: "th" | "td") =>
    `<tr>${cells.map((cell) => `<${tag}>${escape(cell)}</${tag}>`).join("")}</tr>`
  return `<table><thead>${row(head, "th")}</thead><tbody>${body
    .map((cells) => row(cells, "td"))
    .join("")}</tbody></table>`
}

/** A line that is a table's row: it starts with a pipe (in a quote too). */
const tableRow = /^[ \t]*(?:>[ \t]*)*\|/
/** A line that opens or closes fenced code. */
const codeFence = /^[ \t]*(?:>[ \t]*)*(`{3,}|~{3,})/

/** Whether `markdown`'s end is inside fenced code, where pipes are code. */
function inCode(markdown: string) {
  let open: string | undefined
  for (const line of markdown.split("\n")) {
    const fence = codeFence.exec(line)?.[1]
    if (!fence) continue
    if (open === undefined) open = fence
    else if (fence[0] === open[0] && fence.length >= open.length)
      open = undefined
  }
  return open !== undefined
}

/**
 * A streaming answer up to its tables' whole rows: the row being
 * written waits for its line's end, and a heading row for the rule under
 * it. So a table is never pipes in a paragraph that become a table, nor
 * do its columns shift with each word of a row. Its columns then only
 * widen as rows come, until it is as wide as it may be.
 */
function wholeTableRows(markdown: string) {
  let text = markdown
  const end = text.lastIndexOf("\n")
  if (tableRow.test(text.slice(end + 1))) text = text.slice(0, end + 1)
  if (text.endsWith("\n")) {
    // The last whole line, a heading row alone: its rule not here yet.
    const start = text.lastIndexOf("\n", text.length - 2)
    const before =
      start < 0 ? "" : text.slice(text.lastIndexOf("\n", start - 1) + 1, start)
    if (tableRow.test(text.slice(start + 1, -1)) && !tableRow.test(before))
      text = text.slice(0, start + 1)
  }
  return text === markdown || inCode(text) ? markdown : text
}

const tableClass =
  "w-full border-collapse text-sm leading-5 break-normal wrap-normal tabular-nums [&_tbody_tr:last-child>td]:border-b-0"

/**
 * A table of the answer's: rules between rows only, numbers lined up.
 * Over it, its size, a button that copies it (as an HTML table, which a
 * spreadsheet or a document pastes as one, and as Markdown text) and one
 * that shows it full screen, its heading held at the top as it scrolls.
 * In a message scroller, wider than the text where it needs to be.
 */
function Table(all: ElementProps<"table">) {
  const { labels } = React.useContext(MarkdownContext)
  const { className, children, ...props } = domProps(all)
  const [full, setFull] = React.useState(false)
  const scroller = React.useRef<HTMLDivElement>(null)
  const node = all.node as MarkdownNode | undefined
  const { html, markdown, rows, columns } = React.useMemo(() => {
    const { rows, align } = tableCells(node)
    return {
      html: cellsToHtml(rows),
      markdown: cellsToMarkdown(rows, align),
      rows: Math.max(0, rows.length - 1),
      columns: Math.max(0, ...rows.map((row) => row.length)),
    }
  }, [node])
  const copy = React.useMemo<CopyData[]>(
    () => [
      {
        type: "text/html",
        data: async () => new Blob([html], { type: "text/html" }),
      },
      {
        type: "text/plain",
        data: async () => new Blob([markdown], { type: "text/plain" }),
      },
    ],
    [html, markdown]
  )
  const size = labels.tableSize(rows, columns)
  const copyButton = (
    <CopyButton
      value={copy}
      labels={{
        copy: labels.tableCopy,
        copied: labels.tableCopied,
        failed: labels.tableCopyFailed,
      }}
      className="text-muted-foreground pointer-coarse:size-10"
    />
  )
  return (
    <div
      data-slot="markdown-table"
      className={cn(
        "flex min-w-0 flex-col",
        // In a message scroller (itself `@container/message-scroller`),
        // a table of the answer's own wider than the text takes the room
        // either side, centred, as wide as it needs: at most the scroller
        // less 56px each side (past a scrollbar, 48: clear of a
        // conversation map there), and 1152px.
        // Never narrower than the text; where there is no more room, it
        // scrolls as before.
        "@min-[0px]/message-scroller:[[data-slot=markdown]>&]:w-max @min-[0px]/message-scroller:[[data-slot=markdown]>&]:max-w-[min(100cqw-7rem,72rem)] @min-[0px]/message-scroller:[[data-slot=markdown]>&]:min-w-full @min-[0px]/message-scroller:[[data-slot=markdown]>&]:self-center"
      )}
    >
      {/* Over it, its size and its buttons: seen as the table's, where
          the eye comes to it. */}
      <div
        data-slot="markdown-table-header"
        className="-me-2 flex items-center gap-0.5 pointer-coarse:-me-3"
      >
        <span
          // A screen reader says a table's size itself.
          aria-hidden="true"
          className="min-w-0 flex-1 truncate text-xs text-muted-foreground tabular-nums"
        >
          {size}
        </span>
        {copyButton}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={labels.tableFullScreen}
                className="text-muted-foreground pointer-coarse:size-10"
                onClick={() => setFull(true)}
              />
            }
          >
            <HugeiconsIcon icon={ArrowExpand01Icon} strokeWidth={2} />
          </TooltipTrigger>
          <TooltipContent>{labels.tableFullScreen}</TooltipContent>
        </Tooltip>
      </div>
      <div
        data-slot="markdown-table-content"
        // Wider than the lane it scrolls: a keyboard can focus it to scroll.
        tabIndex={0}
        className="w-full min-w-0 scrollbar-thin overflow-x-auto rounded-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <table
          data-streamdown="table"
          className={cn(tableClass, className)}
          {...props}
        >
          {children}
        </table>
      </div>
      <Dialog open={full} onOpenChange={setFull}>
        <DialogContent
          data-slot="markdown-table-dialog"
          closeLabel={labels.close}
          // On the table: the arrow keys scroll it.
          initialFocus={scroller}
          size="full"
          // As wide as a wide table needs, and no wider.
          className="gap-3 sm:max-h-240 sm:max-w-6xl"
        >
          <DialogHeader>
            <DialogTitle>{labels.table}</DialogTitle>
            <div className="flex items-center gap-0.5">
              <DialogDescription className="min-w-0 flex-1">
                {size}
              </DialogDescription>
              {copyButton}
            </div>
          </DialogHeader>
          <div
            ref={scroller}
            data-slot="markdown-table-content"
            tabIndex={0}
            className="-mx-2 min-h-0 flex-1 scrollbar-thin overflow-auto rounded-md px-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {/* Its heading held at the top, on the dialog's surface, its
                rule kept with it. */}
            <table
              data-streamdown="table"
              className={cn(
                tableClass,
                "[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-popover [&_th]:shadow-[inset_0_-1px_var(--border)]",
                className
              )}
              {...props}
            >
              {children}
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/**
 * A cell's width in half-ems, roughly: a CJK or full-width character is
 * two, any other one. Up to `shortCell`, a cell is a label, a name or a
 * number, kept on one line.
 */
function cellWidth(node: MarkdownNode | undefined) {
  let width = 0
  for (const character of node ? nodeText(node).trim() : "")
    width +=
      /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/.test(
        character
      )
        ? 2
        : 1
  return width
}
const shortCell = 24

/**
 * A table's cell. Text in CJK can break after any character, so a column
 * of short labels would be squeezed to one character a line while the
 * others take the room. A short cell keeps to one line instead, and a
 * longer one wraps no narrower than 12rem nor wider than 24rem; a table
 * wider than its lane then scrolls.
 */
const tableCell =
  "border-b py-2 pe-3 align-top last:pe-0 data-[short]:whitespace-nowrap not-data-[short]:max-w-96 not-data-[short]:min-w-48 not-data-[short]:text-pretty not-data-[short]:wrap-break-word"

function TableHeaderCell(all: ElementProps<"th">) {
  const { className, ...props } = domProps(all)
  return (
    <th
      data-streamdown="table-header-cell"
      data-short={
        cellWidth(all.node as MarkdownNode | undefined) <= shortCell ||
        undefined
      }
      className={cn(
        tableCell,
        "text-start text-xs font-medium text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function TableCell(all: ElementProps<"td">) {
  const { className, ...props } = domProps(all)
  return (
    <td
      data-streamdown="table-cell"
      data-short={
        cellWidth(all.node as MarkdownNode | undefined) <= shortCell ||
        undefined
      }
      className={cn(tableCell, className)}
      {...props}
    />
  )
}

const components: Components = {
  "markdown-math": MarkdownMath as React.ComponentType<
    Record<string, unknown> & ExtraProps
  >,
  span: MarkdownSpan,
  ul: UnorderedList,
  ol: OrderedList,
  li: Item,
  // In a conversation, headings a step above the text, not a page's:
  // h1 22px, h2 18px, h3 and down the text's own 16px (weight sets them
  // apart), on its 28px lines.
  h1: heading("h1", "text-display/7"),
  h2: heading("h2", "text-lg/7"),
  h3: heading("h3", ""),
  h4: heading("h4", ""),
  h5: heading("h5", ""),
  h6: heading("h6", "text-muted-foreground"),
  // A link in the answer (a footnote's) is a link, not an outside one.
  a: ({ className, ...props }) =>
    props.href?.startsWith("#") ? (
      "data-footnote-backref" in props ? null : (
        <a {...domProps(props)} className={className} />
      )
    ) : (
      <MarkdownLink className={className} {...props} />
    ),
  // 24px either side: 12 past the column's 12.
  hr: ({ className, ...props }) => {
    const Rule = defaultComponents.hr!
    return <Rule className={cn("my-3", className)} {...props} />
  },
  blockquote: ({ className, ...props }) => {
    const Quote = defaultComponents.blockquote!
    return (
      <Quote
        className={cn(
          "my-0 border-s-2 border-border ps-3 not-italic",
          className
        )}
        {...props}
      />
    )
  },
  // A footnote's mark is a citation: its number in a small tile,
  // centred on the text: not raised half an em, as a sup is (preflight).
  sup: ({ className, ...props }) => (
    <Superscript
      className={cn(
        "relative -top-px ms-0.5 align-baseline text-2xs leading-none [&>a]:inline-grid [&>a]:h-4 [&>a]:min-w-4 [&>a]:place-items-center [&>a]:rounded-sm [&>a]:bg-muted [&>a]:px-1 [&>a]:text-2xs [&>a]:leading-none [&>a]:font-medium [&>a]:text-muted-foreground [&>a]:tabular-nums [&>a]:no-underline [&>a:hover]:text-foreground",
        className
      )}
      {...props}
    />
  ),
  // The footnotes are the answer's sources, under a rule.
  section: ({ className, ...props }) => (
    <Section
      className={cn(
        "border-t pt-2 text-xs text-muted-foreground [&>ol]:list-none [&>ol]:ps-0 [&>ol]:[counter-reset:source]",
        className
      )}
      {...props}
    />
  ),
  thead: ({ className, ...props }) => (
    <thead
      data-streamdown="table-header"
      className={className}
      {...domProps(props)}
    />
  ),
  table: Table,
  th: TableHeaderCell,
  td: TableCell,
  code: (props) =>
    "data-block" in props ? (
      <FencedCode
        code={String(props.children ?? "").replace(/\n$/, "")}
        language={/language-(\S+)/.exec(props.className ?? "")?.[1] ?? "text"}
        // The fence's meta, which Streamdown passes on as `metastring`.
        title={fenceTitle((props as { metastring?: unknown }).metastring)}
      />
    ) : (
      <InlineCode
        {...props}
        className={cn(
          "rounded-xs bg-muted/60 box-decoration-clone px-1 py-px text-2sm ring-1 ring-border ring-inset",
          props.className
        )}
      />
    ),
}

/**
 * An agent's Markdown, streamed or not: Streamdown's, at the rhythm of a
 * conversation (blocks 12px apart, lines at a reading height, lists
 * close and hanging from their markers, headings a step above the text,
 * tables with rules between rows only) and its fenced code as
 * `CodeBlock`, folded to `codeLines` lines. Footnotes are its sources:
 * each mark a numbered tile, the notes a list under a rule. Its props
 * are Streamdown's; the app's `components` replace these, e.g. links
 * that open beside the conversation. With Streamdown's Mermaid plugin
 * (`plugins={{ mermaid }}`, from `@streamdown/mermaid`), ```mermaid
 * blocks are diagrams in the page's greys (`MarkdownDiagram`).
 * With Streamdown's math plugin (`plugins={{ math }}`, from
 * `@streamdown/math`), formulas are KaTeX in the text's colour, their
 * TeX shown as code while streaming or on failure and copied as written.
 * With `isAnimating`, new blocks fade in (opacity, 600ms) while streaming,
 * never with reduced motion or when a finished message opens; a table
 * comes a whole row at a time, each fading in.
 */
function MarkdownRoot({
  className,
  components: own,
  labels,
  codeLines = 12,
  codeWrap = false,
  headingOffset = 0,
  onOpenCode,
  linkIcon,
  linkProtocols,
  ...props
}: StreamdownProps & {
  labels?: Partial<MarkdownLabels>
  /** The lines of a code block shown before the rest is asked for. */
  codeLines?: number | undefined
  /** Whether code blocks start with their lines wrapped. */
  codeWrap?: boolean
  /**
   * The levels the answer's headings sit below the page's and message's
   * headings, so `#` is announced below them; their visual size is kept.
   */
  headingOffset?: number
  /** Opens a code block whole, e.g. beside the conversation. */
  onOpenCode?: (code: MarkdownCode) => void
  /**
   * The icon before a link, by its address: e.g. its site's favicon, an
   * `img` (14px); none for null. Centred on the line in any script.
   */
  linkIcon?: (href: string) => React.ReactNode
  /**
   * Link protocols the app allows besides the web's, mail and phone: e.g.
   * `["vesper"]` for `vesper://…` links, its own pages, which it renders
   * through `components.a`. Otherwise such a link is blocked.
   */
  linkProtocols?: readonly string[] | undefined
}) {
  const math = React.useMemo<MathPlugin | undefined>(() => {
    const app = props.plugins?.math
    if (!app) return undefined
    return {
      ...app,
      remarkPlugin: { plugins: [app.remarkPlugin, remarkMathSource] },
      rehypePlugin: {
        plugins: [rehypeMathFormula, app.rehypePlugin, rehypeMathFailed],
      },
    }
  }, [props.plugins?.math])
  const protocols = linkProtocols?.join(" ") ?? ""
  const rehypePlugins = React.useMemo(() => {
    const plugins = props.rehypePlugins ?? Object.values(defaultRehypePlugins)
    const sanitize = (defaultRehypePlugins.sanitize as unknown[])[0]
    return [
      ...plugins.map((plugin) => {
        // The sanitizer by its function: the default's, or an app's own
        // with a schema of its own.
        if (
          (!math && !protocols) ||
          !Array.isArray(plugin) ||
          plugin[0] !== sanitize
        )
          return plugin
        const schema = plugin[1] as {
          attributes: Record<string, unknown[]>
          protocols?: Record<string, string[]>
        }
        const allowed = protocols ? protocols.split(" ") : []
        return [
          plugin[0],
          {
            ...schema,
            ...(allowed.length > 0 && {
              protocols: {
                ...schema.protocols,
                href: [...(schema.protocols?.href ?? []), ...allowed],
              },
            }),
            attributes: !math
              ? schema.attributes
              : {
                  ...schema.attributes,
                  code: [
                    ["className", /^language-./, "math-inline", "math-display"],
                    ...(schema.attributes.code ?? []),
                    "dataMathSource",
                    "dataMathOpen",
                  ],
                  pre: [
                    ...(schema.attributes.pre ?? []),
                    "dataMathSource",
                    "dataMathOpen",
                  ],
                },
          },
        ] as typeof plugin
      }),
      rehypeKeepPunctuation,
      rehypeLongRuns,
    ].map((plugin) =>
      Array.isArray(plugin) && plugin.length > 1
        ? ([
            plugin[0],
            keyedOptions(plugin[1]),
            ...plugin.slice(2),
          ] as typeof plugin)
        : plugin
    )
  }, [props.rehypePlugins, math, protocols])
  const merged = React.useMemo(() => ({ ...components, ...own }), [own])
  const context = React.useMemo(
    () => ({
      labels: { ...defaultLabels, ...labels },
      codeLines,
      codeWrap,
      headingOffset,
      onOpenCode,
      linkIcon,
      diagrams: props.plugins?.mermaid,
    }),
    [
      labels,
      codeLines,
      codeWrap,
      headingOffset,
      onOpenCode,
      linkIcon,
      props.plugins?.mermaid,
    ]
  )
  const streaming = props.isAnimating && props.mode !== "static"
  const streamedBlocks = useStreamedBlocks()
  return (
    <MarkdownContext.Provider value={context}>
      <Streamdown
        data-slot="markdown"
        // While it streams, each new block fades in (opacity only): a
        // starting style applies only to an element just inserted, and
        // only under data-streaming, so a finished answer opens as it is.
        data-streaming={streaming ? "" : undefined}
        // 16px lines 28px apart, as ChatGPT's and Claude's answers, about
        // 85 characters to the conversation's 752px (47 CJK ones),
        // room between CJK text's dense lines. Lines break evenly (no word
        // alone on the last), headings balanced.
        className={cn(
          // Its blocks in a column 12px apart: a flex column, not block
          // flow, as WebKit fills the margins and the line ends of a block
          // flow's selection solid (lists, flex, only their text). So no
          // margins collapse: headings and rules space by their own.
          // (space-y-0: Streamdown's own space-y-4 out.)
          "flex min-w-0 flex-col gap-3 space-y-0 text-base/7 text-pretty wrap-anywhere",
          // motion: words fading in as they stream, slower than a control
          // (one rule, not one a property: each rule on `> *` is tried on
          // every element of the page, every restyle)
          "motion-safe:data-streaming:*:[transition:opacity_600ms_var(--ease-out)] motion-safe:data-streaming:*:starting:opacity-0",
          // and a table's rows, whole, as they come
          "motion-safe:data-streaming:[&_tbody>tr]:[transition:opacity_600ms_var(--ease-out)] motion-safe:data-streaming:[&_tbody>tr]:starting:opacity-0",
          className
        )}
        components={merged}
        {...(streaming && { parseMarkdownIntoBlocksFn: streamedBlocks })}
        {...props}
        rehypePlugins={rehypePlugins}
        {...(streaming &&
          typeof props.children === "string" && {
            children: wholeTableRows(props.children),
          })}
        {...(math ? { plugins: { ...props.plugins, math } } : {})}
        // An unfinished formula stays source until its closing fence arrives.
        remend={{ katex: false, ...props.remend }}
      />
    </MarkdownContext.Provider>
  )
}

/**
 * Rendered again only when its props change: an answer already done,
 * its text the same, is not parsed or rendered again as a conversation
 * that maps all its turns each update renders around it. (Pass props that
 * keep their identity, as `components` and `labels` from a constant or a
 * memo, for this to hold.)
 */
const Markdown = React.memo(MarkdownRoot)

export {
  Markdown,
  MarkdownCodeBlock,
  MarkdownDiagram,
  type MarkdownCode,
  type MarkdownLabels,
}
