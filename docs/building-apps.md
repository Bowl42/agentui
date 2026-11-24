# Building an app from agentui

agentui is open source and has no business logic: no sessions, agents,
approvals or protocols, only the standard UI those are made of. Apps adapt
to it. They own their screens, as shadcn intends, and compose them from
the parts below; they do not restyle or fork the parts, and do not make
their own primitives.

**The rule of thumb:** if shadcn has a part for it, use that part; if a
need does not fit, change the need before asking for a new part. A new
component is added here only when it is a general UI pattern that more than
one app needs, named after the pattern, with props that are view data and
callbacks.

## Where each need goes

| Need                                                                                   | Use                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| App layout: sidebar, main area, sheet on small screens                                 | the `agent-app` block, below: projects and conversations, header, composer. Other apps: shadcn's sidebar blocks, e.g. `shadcn add sidebar-07` or `sidebar-16`. A block is a starting point the app owns and edits.                                           |
| Lists in the sidebar: items, groups, nested items, actions menu, badges, loading       | `SidebarMenu`, `SidebarMenuButton` (`isActive`, pass `aria-current="page"`), `SidebarMenuAction` with a `DropdownMenu`, `SidebarMenuSub`, `SidebarMenuBadge`, `SidebarMenuSkeleton`, `SidebarGroupAction`                                                    |
| Lists elsewhere, master–detail, resources                                              | `Item`, `Table`, `Resizable`, `Tabs`, `Pagination`, `Empty`; rows that open something and have buttons: see Rows with actions below                                                                                                                          |
| One of a few choices: cards with words, or a segmented control                         | `RadioGroup` in `FieldLabel` cards; `ToggleGroup`; see Choices below                                                                                                                                                                                         |
| Long lists: thousands of files or results, in a scrolling panel                        | `virtual-list` with `Item`s, below                                                                                                                                                                                                                           |
| Page header with title and actions                                                     | `SidebarTrigger`, `Separator`, `Breadcrumb`, `Button`, `ButtonGroup`, `DropdownMenu` (as in `sidebar-16`)                                                                                                                                                    |
| Forms in a dialog                                                                      | `Dialog` with `Field`, `FieldError`, `Input`; errors set `aria-invalid`                                                                                                                                                                                      |
| Status of a connection or run                                                          | `status-mark` (a dot, below); `Badge` with the status colours where it is read on screen (`bg-success/10 text-success dark:bg-success/20`, see [the theme](theme.md))                                                                                        |
| Notices and errors                                                                     | `Alert` (inline), `Empty` (whole page, with `Spinner` while loading), `Toast` (transient)                                                                                                                                                                    |
| Find in a conversation, folded parts too                                               | `conversation-find`                                                                                                                                                                                                                                          |
| A conversation's details: where it runs, its branch and changes, its subagents         | `conversation-details`, below                                                                                                                                                                                                                                |
| Quoting or acting on text the reader selects in an answer                              | `selection-actions`, below; a quote goes in the composer as a quote chip                                                                                                                                                                                     |
| A request for permission or a decision                                                 | `agent-request`, below: the card while it asks in the composer's place (`ComposerTakeover`), one row in the conversation once decided; long text in `CodeBlock` or `ScrollArea`. Elsewhere, `Item` or `Card` with `Button`s, a group with an accessible name |
| New tasks the agent proposes to start (each a conversation)                            | `agent-launch` in an `agent-request`: each a title, a quiet line of what it runs with and two lines of its first message; its settings a pencil away, a composer's box; several an `AgentLaunchList` with a checkbox each                                    |
| A plan the agent proposes, to implement or revise                                      | `plan-card`, below                                                                                                                                                                                                                                           |
| Questions with choices                                                                 | `Questionnaire`; the agent's question inside an `agent-request` in the composer's place                                                                                                                                                                      |
| The conversation                                                                       | `MessageScroller` with `Message`; the user's a `user-message`, the agent's an `agent-turn` with `markdown`; user messages as `scrollAnchor`                                                                                                                  |
| Finding a turn in a long conversation; where unseen messages begin                     | `conversation-minimap` in the `MessageScroller`; a `MessageDivider` "New" with the scroll button's `summary`, below                                                                                                                                          |
| Work in progress, steps, reasoning, tool calls, plans                                  | `Marker` (working, notices), `Trace` (steps with status and details), `Collapsible`                                                                                                                                                                          |
| What is open in a conversation: a turn's work, reasoning, tool calls, long messages    | `use-fold` with `TraceCollapsible`, and `clamp`, below                                                                                                                                                                                                       |
| What the reader can do with a turn (copy, retry, fork), when it was and what it used   | `AgentTurnFooter` with `copy-button`, `AgentTurnRetry`, `AgentTurnAction`s, `AgentTurnMore` and `AgentTurnInfo`, below                                                                                                                                       |
| Code, terminal output, diffs                                                           | `CodeBlock`; a diff: `diff-block`; a whole file to read: `code-viewer`; a tool call's input and output: `tool-call-data`, below                                                                                                                              |
| A search's matches in text or code                                                     | `search-highlight`, below                                                                                                                                                                                                                                    |
| What is open beside the conversation: a preview, files, changes, output                | `browser` in the `agent-app` panel; small in a corner while it is closed: `picture-in-picture`                                                                                                                                                               |
| A file open in that panel: a folder, an image, video, audio, a PDF, a table, terminals | `viewer` and its viewers: `files-viewer`, `media-viewer` (images, video, audio), `pdf-viewer`, `table-viewer`, `terminal-viewer`, below                                                                                                                      |
| Choosing a folder, e.g. a project's directory on a machine                             | `folder-picker`                                                                                                                                                                                                                                              |
| Files and images the user sent                                                         | chips where they were in the message, as the composer showed them (`ComposerMessage` in `UserMessageText`): never larger once sent; a chip opens it beside (`media-viewer`)                                                                                  |
| Images, video and recordings the agent or a tool made                                  | `media-gallery`; `media-viewer` to zoom, compare and mark beside; see Media below                                                                                                                                                                            |
| A choice of an image's or video's size (1:1, 16:9, auto)                               | `ToggleGroup` or `Select` with `aspect-ratio-icon`, below                                                                                                                                                                                                    |
| How much is used now: a session's tokens, a quota, storage; a quota chip               | `usage-meter` (a ring or bar, its breakdown in a popover); in a `Badge` for a chip, below                                                                                                                                                                    |
| What a run cost, by unit, known or estimated                                           | `usage-summary`, below                                                                                                                                                                                                                                       |
| Connections to services, read: their status, one's details                             | `connection`, below                                                                                                                                                                                                                                          |
| Why a turn failed, its retries                                                         | `message-error`, below                                                                                                                                                                                                                                       |
| Use over time: tokens, calls, runs by the hour or day                                  | shadcn's `Chart`: a `Card`, its range a `ToggleGroup`, stacked `Bar`s, `ChartTooltipContent`; see Charts below                                                                                                                                               |
| Choosing many from a long list (models, tools), with a checkbox on each                | `Combobox` `inline` `multiple`, `ComboboxItem indicator="checkbox"`; see Choosing many below                                                                                                                                                                 |
| Command palette, search                                                                | `Command` (`CommandDialog`); its query and highlight, kept across a remount too: see Searching with Command below                                                                                                                                            |
| Mentions and suggestions while typing (`@file`, `#conversation`)                       | `composer`'s `ComposerSuggestions`, below                                                                                                                                                                                                                    |
| Settings                                                                               | a sidebar block, `Tabs`, `Field`, `Switch`, `Select`                                                                                                                                                                                                         |
| Sign-in                                                                                | `login-01`…`login-05`                                                                                                                                                                                                                                        |
| Chat input, mentions, attachments                                                      | `composer`, below                                                                                                                                                                                                                                            |
| Dictating a message; talking with the agent                                            | `composer`'s `ComposerVoice` (below); a spoken conversation: `voice-mode`, below                                                                                                                                                                             |
| Something of the app's own that floats over the page (a bar, a card, a jump button)    | `bg-popover shadow-float` (the theme's floating shadow, a hairline in it), no border; flat things a 1px `border`, no shadow                                                                                                                                  |

App-specific kinds of content (an agent's tool call, a background task's
result) map onto these parts in the app: the app turns its protocol into
the parts' props.

**Words in other languages.** A component's words are its `labels` prop,
English by default, each key optional. Every component exports their type
with every key required (`AgentTurnLabels`, `ComposerLabels`,
`UserMessageLabels`, …): type a translation with it, and a key added in a
release fails to compile instead of showing English. A viewer's words
include its frame's: `TableViewerLabels & ViewerLabels`.

```tsx
import type { AgentTurnLabels } from "@/components/agent-turn"

const turnLabels = {
  // …every key
} satisfies AgentTurnLabels
```

## Conversation content

**Markdown**, streamed or not, is agentui's `markdown`: [Streamdown](https://streamdown.ai)
(it renders unfinished code blocks, lists and tables while they stream)
at a conversation's rhythm, its fenced code a `CodeBlock`. Every app uses
it, so long answers read the same in each; don't restyle Streamdown in
the app.

```tsx
<Markdown
  mode={streaming ? "streaming" : "static"}
  components={{ a: PreviewLink }}
>
  {text}
</Markdown>
```

- Its props are Streamdown's. `components` the app gives replace
  agentui's, e.g. links that open beside the conversation, or `code`
  with an "Open beside" action (`MarkdownCodeBlock` is the default).
- The app's CSS adds Streamdown's own classes, beside the theme's:
  `@source "../node_modules/streamdown/dist/*.js";`
- Fenced code over 12 lines (`codeLines`) folds in its own card, as
  `CodeBlock`'s `lines` (below): those lines, fading out, and "Show all
  · 148 lines" across its foot. Folded, only those 12 are highlighted
  and rendered, so a fence of 20,000 lines (a log, a generated file)
  mounts in what a short one takes. Give `onOpenCode` to add a button to
  every block's header that opens it whole (`{ code, language, title }`),
  e.g. in a `code-viewer` beside the conversation. A block whose lines
  are too long for it has a toggle in its header that wraps them ("Wrap
  lines", `aria-pressed`), off by default; `codeWrap` starts them
  wrapped. A short block has none.
- A fence names its file as most Markdown tools write it,
  ` ```ts title="scripts/build.ts" ` (or `'…'`, or unquoted without
  spaces): the header shows the name in place of the language.
- `headingOffset` puts its headings under the page's: with
  `headingOffset={2}` a `#` heading is announced as level 3
  (`aria-level`, at most 6), its size unchanged.
- Long words and paths wrap within the text lane. Wrapped inline code
  keeps its frame on each line; links rendered as chips keep the
  punctuation immediately after them. Fenced code keeps its own scroll.
- Numbered lists show their numbers in small grey circles (from the
  list's `start`), growing to pills for wider numbers with a shared gutter.
- Tables have rules between rows only; the Markdown's column alignment
  (`--:`) lines numbers up on the right. Cells wrap, align at the top and
  have a 24rem cap. In a message scroller, a table wider than the text
  takes the room either side, centred, as wide as its columns need (at
  most the scroller less 56px each side, 48 past a scrollbar, clear of a
  conversation map, and 1152px); with no more room, it scrolls
  horizontally and takes focus to scroll by keyboard. Over each table, its size and a button that copies
  it (an HTML table, so a spreadsheet or document pastes it as one, plus
  Markdown text with the alignment kept) and one that opens it full
  screen, its heading pinned as it scrolls (`labels.table*`,
  `labels.close`). While it streams, a table shows whole rows only, each
  fading in: a row waits for its line's end, the heading row for the
  rule under it, so it never shows as pipes first, its columns never
  shift with each word, and it only widens.
- **Sources** are GFM footnotes: `[^1]` in the text is a numbered tile
  linking to its note, and the notes are a list under a rule, each with
  the site its link goes to (`rollupjs.org`). Turn the protocol's
  citations into footnotes: `text[^1]` and `[^1]: [Title](url)`.
- **Diagrams**: give it Streamdown's Mermaid plugin, and a ` ```mermaid `
  block is a diagram in the theme's greys, light or dark (redrawn when
  the theme changes), in a code block's frame with a copy button and a
  toggle to its code. While its fence streams, and if Mermaid cannot read
  it, its code shows (the latter with a grey line saying so). Mermaid is
  the app's dependency, loaded only by the apps that pass it:
  `pnpm add @streamdown/mermaid`, then
  `<Markdown plugins={{ mermaid }}>` (`import { mermaid } from "@streamdown/mermaid"`).
- **Math**: Streamdown's math plugin renders `$$…$$` formulas with KaTeX
  in the text's colour. While streaming or on failure, their TeX shows as
  code; copying a formula copies its written source. Wide block formulas
  scroll and take keyboard focus. The app adds `pnpm add @streamdown/math katex`,
  imports `"katex/dist/katex.min.css"` once, and passes
  `<Markdown plugins={{ math }}>` (`import { math } from "@streamdown/math"`).
  `createMathPlugin({ singleDollarTextMath: true })` also reads `$…$`;
  this is off by default so prices stay text.
- `labels` gives its words in other languages
  (`{ more, less, lines: (n) => …, collapse, open, wrap, diagram, diagramCode, diagramFailed, formula }`;
  the first four are the fold's, as `CodeBlock`'s).
- While the agent writes, give it `isAnimating` and `caret="block"`:
  a caret at the end of its words, gone once it stops. New blocks fade in
  while it streams (opacity, 600ms), never with reduced motion or when a
  finished message opens.

**Terminal output** is a `CodeBlock` with the `ansi` language:
`useHighlightedCode(output, "ansi")` turns ANSI colours into lines, and
re-highlights only the new lines while output is appended. Give
`CodeBlockContent` a maximum height (`max-h-64`) so long output scrolls,
or fold it with `CodeBlock`'s `lines` (below).
For output that is still coming, `use-follow-end` keeps it at the end:

```tsx
const { ref, atEnd, scrollToEnd } = useFollowEnd<HTMLPreElement>()
const lines = useHighlightedCode(output, "ansi")

<CodeBlockContent ref={ref} className="max-h-64">
  {lines.map((line, index) => <CodeBlockLine key={index}>{line}</CodeBlockLine>)}
</CodeBlockContent>
{atEnd ? null : <Button onClick={scrollToEnd}>Jump to end</Button>}
```

It starts at the end and follows what is added, including lines that
grow as they are highlighted and output added while it was hidden. The
reader scrolling up (wheel, touch, an up key, the scrollbar) stops it;
scrolling back to the end, or `scrollToEnd()`, starts it again. Use it
only where output is live: a finished result opens at its start. Trimming
the output and stripping control sequences other than colours are the
app's.

**Open beside.** An action on a code block, such as opening it in the
panel beside the conversation, is an icon `Button` with a `Tooltip` in
`CodeBlockActions`, before the copy button; the tooltip's words are its
name. In an answer's Markdown, `onOpenCode` adds one to every block; for
another per block, give `components.code` a `MarkdownCodeBlock` with
`onOpen`.

```tsx
<CodeBlockHeader>
  <CodeBlockTitle>{file}</CodeBlockTitle>
  <CodeBlockActions>
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Open beside"
            onClick={() => openBeside(file)}
          />
        }
      >
        <HugeiconsIcon icon={SidebarRightIcon} strokeWidth={2} />
      </TooltipTrigger>
      <TooltipContent>Open beside</TooltipContent>
    </Tooltip>
    <CodeBlockCopyButton value={code} />
  </CodeBlockActions>
</CodeBlockHeader>
```

**Long code folds in its own card.** Give `CodeBlock` `lines` and a
block longer than that shows those, fading out, and a bar across its
foot, inside its border, says "Show all · 148 lines"; open, it says
"Show less", and the block's header sticks to the top of what scrolls
with a button that folds it again, the block's start brought back into
view. Don't wrap a code block or a diff in `Clamp`: its row would be a
separate thing under the card.

```tsx
<CodeBlock
  lines={12}
  labels={{
    more: "Alles anzeigen",
    less: "Einklappen",
    lines: (n) => `${n} Zeilen`,
    collapse: "Einklappen",
  }}
>
  <CodeBlockHeader>…</CodeBlockHeader>
  <CodeBlockContent lineNumbers>{code}</CodeBlockContent>
</CodeBlock>
```

- It folds after whole lines, never inside one: a wrapped line counts
  each line it takes; a diff's @@ lines (`data-diff="hunk"`) are shown
  but not counted. The count is of lines of code.
- `open`, `defaultOpen` and `onOpenChange` control it, e.g. with
  `useFold` to keep the reader's choice.
- All of it stays in the page: copying copies it all, and focus or find
  in the page reaching the folded part opens it. The lines are measured
  after layout (one `ResizeObserver` for every block), only those up to
  the fold, so output streaming in costs the same at any length.
- The header sticks inside its nearest ancestor that scrolls or clips:
  no `overflow: hidden` between the block and the scroller. Without a
  header, only the bar folds it.

**Thousands of lines cost what is shown.** The lines past the fold can
be one plain text, `CodeBlockRest`, instead of a line each: hidden until
found (`hidden="until-found"`), so find in the page reaches it and opens
the block, but never laid out while folded. Open, the lines are
rendered 250 at a time as the rest nears the view, each where its text
was, and the rest's text is laid out only near the view
(`content-visibility: auto`). `CodeBlockContent` does this for its own
text (`lineNumbers`), as do Markdown's fences and `DiffBlock`; for lines
of the app's own, `useCodeBlockCut()` says how many to render
(undefined: all) and `cutLines(text, cut)` splits text there:

```tsx
function Output({ text }: { text: string }) {
  const [head, rest] = cutLines(text.replace(/\n$/, ""), useCodeBlockCut())
  const lines = useHighlightedCode(rest === null ? text : `${head}\n`, "ansi")
  return (
    <CodeBlockContent lineNumbers>
      {lines.map((line, index) => (
        <CodeBlockLine key={index}>{line}</CodeBlockLine>
      ))}
      {rest !== null && <CodeBlockRest>{rest}</CodeBlockRest>}
    </CodeBlockContent>
  )
}
// <CodeBlock lines={12}><Output text={output} /></CodeBlock>
```

A folded fence of 20,000 lines mounts in 6 ms (TypeScript, 10 ms)
rather than 0.8 s (2.3 s), holds 0.1 MB rather than 15 MB (58 MB), and
opens in 10 ms (41 ms); a line streamed into a folded 5,000-line block
costs 1 ms rather than 11 ms (`pnpm perf`, code-fold).

**Status lines and pending requests.** What the conversation is waiting
on goes after its last turn, in the conversation, as a `Marker`: one
quiet line, a `Spinner` or an icon and the app's words. Give it
`role="status"` so screen readers hear it change, and keep it one line
at a time, the latest state.

```tsx
<MessageScrollerItem>
  <AgentTurn … />
</MessageScrollerItem>
{state === "reconnecting" && (
  <MessageScrollerItem>
    <Marker role="status">
      <MarkerIcon><Spinner /></MarkerIcon>
      <MarkerContent>Reconnecting…</MarkerContent>
    </Marker>
  </MessageScrollerItem>
)}
{pending && (
  <MessageScrollerItem>
    <AgentRequest icon={…} waiting={{ summary: pending.summary, meta: "Waiting for you below" }} />
  </MessageScrollerItem>
)}
```

- A request the agent waits on (a permission, a question) is not a line
  in the conversation: it takes the composer's place, a `ComposerTakeover`
  with the `agent-request` card (see `composer`). In the conversation,
  after the last turn, show nothing or its `waiting` row; once decided,
  its decided row, or a `decision` step in the turn.
- States without a request ("Reconnecting…", "Queued, 2 ahead", "Stopped
  by you", "The agent is offline") are `Marker`s. A failure says so in
  words, with an `Alert02Icon`, in the greys of the rest; red is for the
  words of an error only, never a frame.
- Remove the line when the state ends; don't stack them.

Each appended chunk renders and lays out only the lines that changed, as
long as the finished lines are passed again unchanged: the nodes
`useHighlightedCode` returns, or the same strings. Keep the extra props
of a `CodeBlockLine` stable too (no inline `style` objects or handlers),
or every line renders again. A few thousand lines stream at a few
milliseconds a chunk; trimming lines from the start renders and
highlights them all again, so trim in large steps, not line by line.

**Diffs** are a `CodeBlock` per file (its name in `CodeBlockTitle`) with
a `CodeBlockLine` per line: `variant="added"` or `"removed"` marks the
line, with a `+` or `−` that is not copied. The app parses the unified
diff into lines; to colour the code as well, highlight the lines without
their `+`/`-` (`useHighlightedCode`) and put each in its `CodeBlockLine`.

**Scrolling the conversation.** A message with `scrollAnchor` (the
user's) is scrolled to the top of the view when it arrives, the answer
streaming in below it, with the end of the message before it still
showing (`scrollPreviousItemPeek`, 64px by default, on
`MessageScrollerProvider`). When the conversation is short, what was
above is out of view, not gone. To keep earlier messages in view, give
`scrollPreviousItemPeek` more, or leave `scrollAnchor` off to follow the
end instead.

Keep a message's React key when it changes: a message shown at once and
then replaced by the server's copy keeps the key it was shown with (its
client id), so the item is updated, not swapped. A row that is a new
element (a working row replaced by a waiting one, a waiting row by the
decision) is fine: only a `scrollAnchor` item that is a new element is
scrolled to, so the view stays where it was, at the end if it followed
it.

**Exchanges.** With one gap between all messages, a question sits as
far from its answer as from the turn before it, and the conversation
reads as a list of messages, not of exchanges. Give the user's message
more room above it than the gap, on its item:
`<MessageScrollerItem scrollAnchor className="not-first:mt-4">`. The
margin is outside the item, so where `scrollAnchor` puts it is the
same.

**Long conversations.** The scroller windows its messages: each
`MessageScrollerItem` stays in the content at its height, but the
content of those more than a few views from what is shown is unmounted,
and mounts again as the reader comes near (`windowed`, on by default on
`MessageScrollerProvider`). A thousand turns of Markdown, code and tool
rows scroll at the display's rate in WebKit, with some 2,700 elements
mounted instead of 66,000, and open in 4 s instead of 33. Pass every
message as an item; nothing else is needed. While the reader scrolls,
what they look at stays put as the messages above it mount at their real
height, in every browser; nothing is read before a frame's layout and
the scroll is never moved but by them, except by how much a message
above the view changed size (told after layout, before paint): over
messages already seen, not at all. A code block's long lines are told by
a ResizeObserver, not read as it mounts. A message holding the focus or a selection
stays mounted, and `useMessageScrollerShowAll(active)` mounts them all
while `active` (a `ConversationFind` does so while it is open, so it
searches every message). What a message keeps in its own state is lost
as it unmounts: keep folds in a `FoldProvider` (`useFold`), and a clamp's
`open` in the app's state if it matters. `windowed={false}` keeps every
message mounted, the browser skipping those off screen
(`content-visibility`). Each time the streaming answer grows a line the
scroller still looks over every message, with frames of 11 ms at 1,000
and 28 ms at 3,000 (mostly the browser's layout), so render the latest messages, a
thousand at most, and load earlier
ones above when the reader asks, with a `MessageScrollerLoadEarlier` in
the `MessageScroller` (rendered while there are earlier ones): it floats
at the top while the reader is at the start, and the app sets its
`loading` until they are there. The scroller keeps the messages in view
where they are when others are added above them
(`preserveScrollOnPrepend`, on by default on `MessageScrollerViewport`).
It tells by its first item moving down, so nothing else goes first in
the content: a "load earlier" button there stays first, the messages
come in after it, and the reader is moved.
Memoize each message, so a streaming answer renders only itself.

```tsx
<MessageScroller>
  <MessageScrollerViewport>…</MessageScrollerViewport>
  {hasEarlier && (
    <MessageScrollerLoadEarlier loading={loading} onClick={loadEarlier} />
  )}
  <MessageScrollerButton />
</MessageScroller>
```

Give `MessageScrollerButton` a `summary`, e.g.
`summary="2 queued · a question waits"`, to show a pill with its label and
muted words on what waits below (or above for `direction="start"`). Long
summaries truncate to fit; the full text stays in its accessible name.
Without a summary it stays a round icon button; `labels` overrides its
`scrollToEnd` and `scrollToStart` names. Changes announce nothing: an app
that wants announcements renders its own live region.

**Opening at the end.** Without `autoScroll`, the end the scroller opens
at, and the end `scrollToEnd` (from this registry's `useMessageScroller`)
goes to, are held while messages render at their real height, images
load and more comes, until the reader scrolls, another scroll starts or
a new `scrollAnchor` message is anchored.

**New since the last visit.** The app knows the last message the reader
saw. Before the first unseen message, put a `MessageDivider` with "New"
(the app's own words) in a `MessageScrollerItem` with a `messageId`.
Open there with `scrollToMessage(thatId)` from this registry's
`useMessageScroller()` in an effect on mount. The place is held while
messages settle, until the reader scrolls. Say how many are new in
`MessageScrollerButton`'s `summary`, such as "3 new".

```tsx
function OpenAtNew() {
  const { scrollToMessage } = useMessageScroller()
  React.useEffect(() => {
    scrollToMessage("new")
  }, [scrollToMessage])
  return null
}

// Inside MessageScrollerProvider, alongside MessageScroller.
<OpenAtNew />
// In MessageScrollerContent, before the first unseen message.
<MessageScrollerItem messageId="new">
  <MessageDivider>New</MessageDivider>
</MessageScrollerItem>
// Beside the viewport, inside MessageScroller.
<MessageScrollerButton summary="3 new" />
```

Once the reader has seen them, the app moves its watermark. Keep the
divider until the conversation is left, so it does not jump away.

**Folding.** A finished turn shows its answer and folds its work away;
what runs, and what failed, is open. Each part that opens or closes
takes its `open` from `useFold(key, rule)`: the rule is what the app
says for the part as it is now, and the reader's choice, once made,
wins over it. While a turn runs, nothing opens or closes by itself.
Apps should follow the same rules:

| Part                                                                                 | Open when                                                                                  | Shows when closed                                                                                                                          |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| A turn's work: everything before its answer, what the agent said in between included | it runs, it failed or was stopped, it has no answer, or the reader touched it while it ran | "Worked for 6m 12s", "Failed after 1m 40s"; decisions, media and steps under way                                                           |
| Work before and after a steer                                                        | the same rule as the turn's work                                                           | each its own time: "Worked for 40s"; the last "Working" while it runs, counted from its steer                                              |
| A superseded attempt                                                                 | never by itself                                                                            | "Superseded attempt", then its reason                                                                                                      |
| A run: the steps between two things the agent said                                   | never by itself                                                                            | "Explored 6 files, edited 4, ran 4 commands", "⚠ 1 failed" at its end; decisions and media under it; while live, it says the step it is at |
| Reads, searches and listings in a row, in a run                                      | never by itself                                                                            | "Read 6 files, searched 3 times"                                                                                                           |
| A step: a tool call (a file's edits merged), reasoning, a decision                   | never by itself                                                                            | its icon and what it did: "Edited agent-turn.tsx", "4 edits · +38 −12" at its end                                                          |
| A user's long message (`clamp`)                                                      | never by itself                                                                            | its first 6 lines, fading out, and "Show all · 38 lines"                                                                                   |
| A long code block or diff (`CodeBlock`'s `lines`)                                    | never by itself                                                                            | its first 12 lines, fading out, and "Show all · 148 lines" across its foot                                                                 |
| The answer: what the agent said after its last tool call                             | always open                                                                                |                                                                                                                                            |

- **The answer** is the text after the turn's last work. Everything
  before it folds as one, so a turn that has ended reads as its title
  and its answer. While the turn runs every part is in its work, in the
  order it came, what the agent says at the answer's size and edge: nothing
  moves into a fold or remounts as the next step comes. The work folds
  once, when the turn ends, and only if the reader never opened or closed
  anything in it while it ran; the answer, at the end of the scroller,
  does not move.
- **Kept in sight:** decisions keep their row; a call's `media` stays under its line. Both stay just after a folded run's line or the folded work's title, in order, and show once, in place, when opened. A step still under way stays in sight under the folded work of a turn that has ended.
- **A line says what was done, not what was typed.** A tool call's kind
  and data are enough: a read is "Read composer.tsx", an edit "Edited
  agent-turn.tsx". A shell command is read by `describeCommand`, first
  rule that holds: a read (`cat`, `head`, `tail`, `sed -n`, `nl`) is
  "Read composer.tsx" or "Read 3 files"; `grep`/`rg` "Searched for
  useSyncExternalStore"; `ls`/`find`/`tree` "Listed files in build/out";
  `sed -i`/`perl -i` "Edited agent-turn.stories.tsx"; a short command
  (one, no pipe, `;` or `&&`, 40 characters at most) "Ran pnpm build";
  else the agent's own description, as it is, the same while it runs and
  once done (the icon tells the state); else "Ran a script". A leading
  `cd somewhere &&` is left out. The whole command shows when the line is
  opened. Files are their names, the path on hover.
- **A step is a line**: a 14px icon for its kind (16px on a phone), a
  grey fainter than its words, then its verb and what it acted on a step
  lighter, at 13px (15px on a phone); no timeline, no dots. The step the
  agent is at has a spinner for its icon, its words shimmering; one
  waiting for the reader a shield, "Wants to run pnpm publish --dry-run"
  and "Waiting for you" at its end. One that failed
  keeps its icon and says so at its end, an alert and "Exit 2", by weight
  and shade rather than a colour; how long a step took shows only on
  hover or focus, not when opened ("⚠ Exit 1" alone at its end).
- **A command opened** shows itself whole and its output's last lines,
  12px on 18px lines on the side's grey (the page's in dark), each line
  in its tone: what failed strong ("✗ …", "error TS2305:", in the
  foreground, heavier), the output muted, passes and the tally faint
  ("✓ …", "Tests 1 failed | 41 passed"). `agentOutputTone` tells them
  by what most tools print; give the turn `outputTone(line, call)` for a
  tool of the app's own (wrap `agentOutputTone`).
- **One row a thing.** In a run, a file's edits are one row ("4 edits ·
  +38 −12"; opened, their hunks in the file's order, each line with its
  number in the new file); files written in a row are one ("Wrote
  two.py, three.py"); reads, searches and listings in a row are one nested
  line that opens to theirs.
- **Runs** keep a turn of dozens of tool calls to a few lines: the steps
  between two things the agent said fold under one line that counts by
  kind, files once each ("Explored 6 files, edited 4, ran 4 commands");
  past three kinds it keeps edits, commands and reads, in that order of
  priority, and counts the rest ("… and 6 other actions"),
  and, at its end, the failures nothing later made good (a failed command
  that later ran again and passed is not counted); on a phone the number
  alone, so the line keeps its words. The live run is folded too, one
  line: while a tool runs, its line says that step ("Running pnpm test",
  a spinner, shimmering), each step's in turn as they come, so the turn
  does not grow; opened, its sum, and the step under way under the list.
  A step waiting for the reader, one with a progress line or media, and
  one the reader opened stand under the line. A run the reader opened
  stays open, and new steps join it. Key a
  run by its first step, so it keeps the reader's choice as steps come.
  A step alone between two things it said (one command, one subagent)
  has no line over it and is a level under one: 12px in the faintest grey
  (4.5:1), its icon 14px; it still opens, its details at their size. A
  step under way is not lowered.
- **Folded**, a failure nothing made good is still seen at the title's
  end ("⚠ 1 failed", on a phone "⚠ 1"), as a run's line has it, and
  read as the title's description.
- **Under the open work** the answer is as close as what the agent said
  between steps (6px) when the work ends with what it said; under its
  last step's line, the folded title, a thought alone, or more it said,
  a paragraph's distance (12px). Text that is not Markdown is 14/23 (16/26
  on a phone), as Markdown is.
- **Stopped or failed**, the title says so ("Stopped after 2m 03s") and
  the last row where ("Stopped while running Type-check the app").
  Stopped, what it had said is kept, dimmed; under it the whole footer,
  its facts how it ended ("Stopped by you · 12:06"), so retry is a press
  away.
- **A thought alone** (a done turn whose work is only reasoning) is its
  line, "Thought for 12s", with no "Worked for" title over it. While a
  turn only thinks, its title stands bare, no chevron and no rule; they
  show in their places when the first step comes, so nothing moves.
- **Between steps**, a step done and the next not come, the work's next
  line is a spinner alone, right under the last step, its icon in the
  steps' column; the step that comes takes its place, so nothing moves.
  With the work folded, or nothing come yet, it is under the title.
- **A turn the user steers** (a message sent while it runs) keeps it as
  a `steer` part where it came, at the turn's end edge, always seen,
  as the user's message is (`UserMessageText`'s bubble and text, cut
  to 6 lines over "Show all" where long; `labels.steerClamp` its
  fold's words). The work before it and after it each fold under a
  title as a turn's work does, by the same rule, with its own time: the
  last "Working" while it runs, counted from its steer's `startedAt`,
  the others "Worked for" theirs (the first steer's `before`, then each
  steer's `duration`), or "Working" while a step of theirs is still
  under way; only the last says the turn failed or stopped. Steers back
  to back split it once.
  Where it is split is the app's data, not a guess of the UI's.
- **A superseded attempt** (cut off by a steer, replaced by a retry) is
  one closed line, "Superseded attempt · Cut off by a steer", that opens
  to its parts. Don't mark an attempt whose reply finished: the reader
  needs it.
- **What came from outside** (a line of a stream the agent watches, a
  background task's end, a wake-up) is an `event` part where it came,
  an `AgentEvent`: a light pill, never folded into a run of steps. Done,
  one after the last step stays in sight with the answer; ones before
  it fold with the work.

- **Reasoning** while it streams is the turn's title, shimmering
  ("Thinking · 4s"), and under it a running step's spinner and its
  newest bold heading, else its newest paragraph's first sentence,
  with Markdown stripped, muted, where a step's words are; nothing opens.
  While the turn runs its title is in the text's colour, as a running
  step's words are, so it is not taken for a turn done. It runs only while it is the end of the running
  work: once a step follows it, it is a quiet line ("Thought for 12s",
  `labels.thought(duration)`) that opens to its paragraphs, set off by a
  rule.

The `agent-turn` block does all of this but the user's messages (a
steer, sent while the turn runs, is its `steer` part); its `Conversation` story is the whole of it. Closed parts are
not rendered (`CollapsibleContent` unmounts them after closing), so
a long conversation of folded turns is light. A fold the reader opens
or closes keeps its line where it is on screen, the nearest scroller
scrolled as the fold changes height, except while a `MessageScroller`
is at its live end, which it keeps.

**Media.** Where a picture, a video or a recording comes from decides
how it is shown:

| What                                                   | Shown as                                                                                                                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A file or an image the user sent                       | its chip where it was in their message (`ComposerMessage`), as the `composer` showed it; an image's chip has its thumbnail and opens it beside, not a `media-gallery`          |
| Images in a message (made by the agent, or by a tool)  | `media-gallery`: one at its own shape, more as thumbnails, each opening a viewer                                                                                               |
| Images the agent is making or made with an image model | `media-gallery` with `layout="flow"`: each in its card with its caption (model, size, cost), actions, copy and open; a placeholder while it is made (`status="pending"`)       |
| A video or a recording                                 | `media-gallery`: `media-viewer`'s controls (play, a seek bar, sound; do not make another player) in a card with its title, length, actions and transcript; one plays at a time |
| Any other file (PDF, archive)                          | an `Attachment` that opens or downloads it                                                                                                                                     |

- Give each image and video its `width` and `height` if the protocol
  has them: it takes its place before it loads, so nothing below moves
  and the scroller keeps its place.
- An image loads progressively where the app has the means: its
  `placeholder` (e.g. its ThumbHash drawn small, as a data URL) and its
  `thumbnail` stand in for it, at its shape, till it is drawn; with
  `srcSet` ("thumb.jpg 512w, full.jpg 2880w") the browser loads the copy
  sharp enough for the width it is shown at. `MediaViewer` takes the
  same `placeholder` and `thumbnail`, with `width` and `height` to fit
  it before it loads, markable (`onMark`) or not: its marking tools come
  once it has loaded. `ImageEditor` takes the same four.
- Every image has an `alt` saying what it shows; a video or a recording
  has a `title`, its name, and a video its `captions` if there are any.
  A recording of speech, such as a voice message, has a `transcript`.
- A video or a recording that cannot be played says so; so does an
  image.
- In an `agent-turn`, what the agent made for the reader is in its
  answer (a `content` part), outside the fold; a screenshot a tool took
  goes in that call's `media`, seen under its line and kept in sight when folded.
- Where a file is served from, how it is signed or authorized
  (`crossOrigin`), and whether it may be downloaded are the app's.

**Under a turn.** An `AgentTurnFooter` (in the `agent-turn` block) under
a turn marks where it ends: on the left what the reader can do with it,
on the right its facts. Which actions there are, when each is offered
and what they do are the app's; how they look is the same in every app:

```tsx
<Message>
  <MessageContent>
    <AgentTurn … />
    <AgentTurnFooter visibility={isLast ? "always" : "hover"}>
      <CopyButton value={markdown} labels={{ copied: "Copied as Markdown" }} />
      <AgentTurnRetry onClick={retry}>
        <DropdownMenuItem>…</DropdownMenuItem>   // other ways to retry
      </AgentTurnRetry>
      <AgentTurnAction label="Branch from here" optional onClick={branch}>
        <HugeiconsIcon icon={GitBranchIcon} strokeWidth={2} />
      </AgentTurnAction>
      <AgentTurnMore>
        <DropdownMenuItem>…</DropdownMenuItem>   // what is needed less often
      </AgentTurnMore>
      <AgentTurnInfo
        details={
          <>
            <AgentTurnDetails>
              <AgentTurnDetail label="Model" note="High">Opus 5.5</AgentTurnDetail>
              <AgentTurnDetail label="Took" note="9 steps">48s</AgentTurnDetail>
            </AgentTurnDetails>
            <AgentTurnDetails>
              <AgentTurnDetail label="Input" note="12.0k cached">18.2k</AgentTurnDetail>
              <AgentTurnDetail label="Cost">$0.04</AgentTurnDetail>
            </AgentTurnDetails>
          </>
        }
      >
        <span>Opus 5.5</span>
        <span>48s</span>
        <AgentTurnFact tooltip="Saturday, Nov 8 · 12:04:03">
          <time dateTime={turn.endedAt}>12:04</time>
        </AgentTurnFact>
      </AgentTurnInfo>
    </AgentTurnFooter>
  </MessageContent>
</Message>
```

- Render it for every turn: it hides itself while the `AgentTurn` just
  before it runs, and shows once it has ended.
- Only the last turn's actions are always shown (`visibility="always"`);
  the ones before it (`"hover"`) show while their message is hovered or
  holds the focus, and keep their place meanwhile, so nothing moves.
  Their facts stay. Where nothing can hover (a touch screen) they are
  always shown.
- Actions, left: copy (the answer's source, e.g. its Markdown, not the
  work), `AgentTurnRetry` (its `children`, if any, are a menu of other
  ways to retry: with more thinking, with another model), the app's
  `AgentTurnAction`s, and `AgentTurnMore`, a menu of what is needed
  less often (copy as plain text, read aloud, hide the turn): 14px
  icons on 30px buttons, in the faintest grey, dark when hovered. Each
  is named and has a tooltip; shortcuts and hints ("⌘R", "Max", "Faster")
  go in the menus' items as `DropdownMenuShortcut`s, plain small text
  there. Retry's menu opens from the whole retry group.
- Facts, right: `AgentTurnInfo`'s children are joined by " · ": the
  model, how long it took, and the time last; a turn that was stopped
  says so ("Stopped by you · 12:06") and keeps its actions. A fact in an
  `AgentTurnFact` says more on hover, alone, in its own tooltip (the
  time's full date). With `details`, pressing them (a pointer, touch,
  keyboard) shows `AgentTurnDetails` of
  `AgentTurnDetail`s, a rule between two lists, each under its `label`
  if it has one ("This turn", "Tokens"). Numbers in the reader's
  locale, `note` for what qualifies one ("12.0k cached"). Which numbers
  there are is the app's; if they are loaded when opened, show
  `Skeleton`s in a `role="status"` while they load.
- Under a finger its buttons are 40px, their icons 14px still. On a
  phone (the footer narrower than 24rem) its buttons are 40px and
  their icons 18px, `optional` actions and Retry's menu are left out
  (put them in `AgentTurnMore` too), and of the facts only the last
  shows.

The `Footer…` stories of the `agent-turn` block are this, and so is its
`Conversation`.

## Choosing many

Many to choose from, such as the models an app may use: an `inline`,
`multiple` `Combobox`, each `ComboboxItem` with `indicator="checkbox"` (a
box before it, there before it is chosen). From its search field the
arrows go through the list, also the items a `virtualized` list has not
mounted, and Enter chooses. Its groups are `ComboboxGroup` with a
`ComboboxLabel`, which is only text: a listbox holds only options.

```tsx
<Combobox
  inline
  multiple
  items={shownGroups}
  filter={null}
  inputValue={query}
  onInputValueChange={setQuery}
  value={chosen}
  onValueChange={setChosen}
>
  <ComboboxInput showTrigger={false} aria-label="Search models" />
  <ComboboxList aria-label="Models">
    {(group) => (
      <ComboboxGroup key={group.value} items={group.items}>
        <ComboboxLabel>{group.value}</ComboboxLabel>
        <ComboboxCollection>
          {(model) => (
            <ComboboxItem key={model} value={model} indicator="checkbox">
              {model}
            </ComboboxItem>
          )}
        </ComboboxCollection>
      </ComboboxGroup>
    )}
  </ComboboxList>
</Combobox>
```

- **A group at once**: outside the list, a `DropdownMenu` beside the
  search field, a `DropdownMenuCheckboxItem` for each group the search
  shows, checked when all its shown items are chosen, its count in the
  text ("GPT 1/4" when some are). Choosing it chooses or unchooses the
  group's _shown_ items: filter with the app's own `filter` (and
  `filter={null}`), so the app knows what is shown.
- **Below the list**: how many are chosen, then the commands. Keep two
  apart: one on what is shown ("Choose shown", "Unchoose shown"), and
  the app's own clearing of everything chosen ("Clear"), also what the
  search does not show or the list no longer has.
- The `Combobox/CheckboxIndicator` story is this, tested.

## Charts

Charts are shadcn's `Chart` (Recharts), coloured by the theme's
`--chart-1`…`--chart-5`. The app turns its data into rows; the chart is
its own composition, as in shadcn's examples. "Usage Over Time" in
Storybook (`src/stories/chart.stories.tsx`) is one to copy:

- A `Card` with the range in a `ToggleGroup` in its `CardAction`. The
  app keeps the range and loads the rows for it; pressing the chosen one
  again keeps it.
- A `BarChart` with one `Bar` a measure, the same `stackId` (input and
  output tokens), rounded at the stack's ends only.
- Dates and numbers by `Intl` in the reader's locale: the `XAxis`'s
  `tickFormatter` and a few `ticks` (the first, the last, two between),
  not one label a bar; the `YAxis` in compact notation, `width="auto"`:
  a fixed width cuts "200万" short, more so at a larger text size.
- `ChartTooltipContent` with a `labelFormatter` (when, and the calls, or
  "No calls") and a `formatter` adding the total after the last.
- With nothing in the range, `Empty` in the chart's place.
- For a screen reader, the chart is a named `img`, and a `sr-only`
  table has the same numbers.
- From the keyboard: `accessibilityLayer` on the `BarChart` puts the
  chart in the tab order, and the arrow keys move its tooltip from bar
  to bar. shadcn's `ChartContainer` hides the chart's own outline, so
  give the container the ring: `rounded-md
has-[.recharts-surface:focus-visible]:ring-3
has-[.recharts-surface:focus-visible]:ring-ring/50`
  ("UsageKeyboard" tests it).
- Colours: one `--chart-n` a series, named in the `ChartConfig`
  (`{ inputTokens: { label, color: "var(--chart-1)" } }`), the bars'
  `fill` `var(--color-inputTokens)`; the theme's five are told apart in
  either theme. A single measure can stay `--chart-1`; greys are for
  what is not a category (the grid, the axis).

```tsx
<ChartContainer config={config} role="img" aria-label="Usage · 24 hours"
  className="aspect-auto h-50 w-full rounded-md has-[.recharts-surface:focus-visible]:ring-3 has-[.recharts-surface:focus-visible]:ring-ring/50">
  <BarChart accessibilityLayer data={buckets}>
    <CartesianGrid vertical={false} />
    <XAxis dataKey="startedAt" ticks={ticks} tickLine={false} axisLine={false}
      tickFormatter={(value) => when.format(value)} />
    <YAxis width="auto" tickLine={false} axisLine={false}
      tickFormatter={(value) => short.format(value)} />
    <ChartTooltip content={<ChartTooltipContent labelFormatter={…} formatter={…} />} />
    <ChartLegend content={<ChartLegendContent />} />
    <Bar dataKey="inputTokens" stackId="tokens" fill="var(--color-inputTokens)" radius={[0, 0, 4, 4]} />
    <Bar dataKey="outputTokens" stackId="tokens" fill="var(--color-outputTokens)" radius={[4, 4, 0, 0]} />
  </BarChart>
</ChartContainer>
```

Every word comes from the app; the chart has none of its own. How much
is used _now_ (a quota, a session) is a `usage-meter`, not a chart.

## Rows with actions

Search results, conversations, files in a page of their own: rows that
open something and have their own buttons are shadcn's `Item`s in an
`ItemGroup` (a list; each `role="listitem"`). The "Item/RowsWithActions"
story is this, tested.

```tsx
<ItemGroup aria-label="Results">
  <Item
    role="listitem"
    size="sm"
    className="relative has-[a:focus-visible]:border-ring has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/50 has-[a:hover]:bg-muted/50"
  >
    <ItemContent>
      <ItemTitle>
        <a
          href={href}
          className="outline-none after:absolute after:inset-0 after:rounded-lg"
        >
          {title}
        </a>
      </ItemTitle>
      <ItemDescription>{when}</ItemDescription>
      <ItemDescription>
        <SearchHighlight terms={terms}>{snippet}</SearchHighlight>
      </ItemDescription>
    </ItemContent>
    <ItemActions className="relative">
      <Button variant="ghost" size="icon-sm" aria-label={`Pin ${title}`}>
        …
      </Button>
      <DropdownMenu>…</DropdownMenu>
    </ItemActions>
  </Item>
</ItemGroup>
```

- The title is a link stretched over the row (`after:absolute
after:inset-0`, the `Item` `relative`): a click anywhere opens it, a
  middle click opens it in a new tab, and it is one tab stop. Not the
  whole `Item` as a link (`render={<a />}`) where it has buttons: a
  button in a link is not allowed.
- `ItemActions` (`relative`, so above the stretched link) hold the
  buttons and menus, each named with the row ("Pin Cache images…").
- A snippet is a second `ItemDescription`, its matches marked by
  `search-highlight`.
- A row with no address (a draft, something not yet saved) is no link:
  its title is text, and the row does not light on hover.
- Without buttons, the whole `Item` is the link (`render={<a href />}`,
  the "Item/AsLink" story).

## Menus and popovers on a phone

On a phone (narrower than 640px, `useIsMobile`) a `DropdownMenu`, a
`ContextMenu` (after a long press), a `Popover` and a `Select`'s list
open as a sheet from the bottom, as the platform's action sheets do,
with nothing for the app to do: across the screen over a scrim that
closes it when tapped, a handle to swipe it down by, rows 44px tall,
clear of the home indicator. It stays Base UI's popup, so its roles,
focus, keys and `onOpenChange` are as on a desktop; a swipe closes it as
Escape does. `sheetTitle` on the content puts a heading on top, e.g. the
file a menu acts on; a destructive item is red there as in a menu.

`sheet={false}` keeps one anchored to its trigger on a phone too: a
toolbar by a selection (`selection-actions` does), or a list under a
field being typed in, where the keyboard covers the bottom of the
screen. A `Combobox` stays anchored for that reason, under its input;
`composer-select` and `model-picker` are sheets of their own, with a
Done button. Tooltips do not open on touch.

## Sizes and places the components keep

What an app used to write at each use is the component's own:

- **Dialogs** (`Dialog`, `AlertDialog`, `CommandDialog`) are no taller
  than the window, 1rem from its edges. Taller content scrolls: in a
  `DialogBody` between `DialogHeader` and `DialogFooter`, which stay in
  place (it is keyboard-reachable while it scrolls); without one, the
  whole dialog scrolls, its title with it, its footer kept at its foot (a
  default-size one's; a `wide` or `full` one lays its footer out there).
  The close button is on the title's line, the title clear of it.
- **On a phone** (under 640px) a `Dialog` (default size) and an
  `AlertDialog` are sheets from the bottom: the screen's width, at most
  90% of it, clear of the home indicator. No `Drawer` of the app's for
  it, and no restyled header or footer. On a short screen (`short:`)
  their footer's buttons are in a row. `sheet={false}` keeps a dialog
  that places itself where it is.
- **`CommandDialog size="fixed"`**: 32rem tall and centred whatever its
  results, so it does not jump as a query narrows them; its list fills
  it. `size="wide"` is the same at 42rem wide, for a palette of groups
  and shortcuts.
- **`AlertAction`** is a column of its own beside the words, as wide as
  its buttons (two of them, one saving with a `Spinner`, keep clear of
  the title); where the alert is under 28rem wide, its buttons go under
  the words, at the end.
- **`Drawer`** from the bottom is clear of the home indicator (its
  footer pads to `max(1rem, env(safe-area-inset-bottom))`; without a
  footer last, its content pads to the inset). `DrawerContent size`:
  `"default"` up to 6rem short of the screen, `"tall"` up to 1rem under
  its top (the status bar's edge), `"full"` that tall always. On a short
  screen (a phone on its side, under 30rem: the theme's `short:`
  variant, for an app's own too) its footer's buttons are side by side,
  the first at the end.
- **`Popover`**, as a menu, is no wider or taller than there is room
  for (`--available-width`, `--available-height`); what is taller
  scrolls.
- **`Toaster position`**: `"bottom-end"` (default) or `"top-end"`, under
  `AgentApp`'s titlebar and the status bar. `--toast-inset-end` on the
  root keeps it clear of what the app has at the window's end (e.g. a
  native view the page cannot cover). `pinned` is a card that stays
  there, not a toast (e.g. asking to allow notifications), the toasts
  beside it.
- **`ScrollArea`** takes a max-height: `<ScrollArea className="max-h-96">`
  is as tall as its content up to that, then scrolls.
- **`grid-cols-fill-<n>`** (the theme's): as many columns as fit, each
  at least n spacing steps wide, or the whole width where that is less:
  `grid grid-cols-fill-54 gap-3` for cards of at least 216px.

## Type

The theme sets the type; an app sets its language.

- **`lang`** on `<html>` (`lang="en"`, `lang="ja"`, `lang="zh-Hans"`): the
  browser picks a language's glyphs, line breaks and punctuation by it.
  Japanese or Chinese text in a `lang="en"` page breaks and spaces as
  Latin does.
- **Faces**: the platform's UI face, then its faces for Chinese, Japanese
  and Korean (PingFang SC, Hiragino Sans and Apple SD Gothic Neo on
  Apple's; Microsoft YaHei, Yu Gothic UI and Malgun Gothic on Windows;
  Noto Sans CJK on Linux and Android), so Latin letters and digits are
  the UI face's in CJK text too. `--font-sans` in an app's stylesheet changes them.
- **Spacing**: a quarter em between CJK and Latin letters or digits
  (`text-autospace`, where the browser has it), not in code; an app's
  text has no spaces of its own typed there.
- **Shadcn's Geist**: `shadcn init` imports `@fontsource-variable/geist`;
  the theme does not use it, so an app can remove the import and the
  package.
- **The conversation's text**: an answer (`Markdown`, `AgentTurn`), the
  reader's message (`UserMessage`) and the composer 16px, the answer and
  the message on 28px lines, as ChatGPT's and Claude's: about 85
  characters to the column's 752px, 47 CJK ones. The interface
  around them (steps, rows, menus) stays 13–14px. Lines break evenly,
  headings balanced (h1 22px, h2 18px, h3 and down 16px, bold).

## Motion

Motion is for a change of state or of space, never for the keyboard:
the theme's tokens time it, the same in every component, and where the
reader asks for less motion (`prefers-reduced-motion`) it is gone.

| Utility           | Time              | For                                                                               |
| ----------------- | ----------------- | --------------------------------------------------------------------------------- |
| `motion-hover`    | 100ms             | a row's background as the pointer comes (only then: a key's highlight is at once) |
| `motion-fade`     | 150ms             | what fades or swaps in place: a page of a picker, an icon, a chevron's turn       |
| `motion-size`     | 200ms             | what changes size: a collapsible's height, a panel opening beside, the sidebar    |
| `motion-slide`    | 400ms             | a surface crossing the screen: a sheet, a drawer, a toast, a menu's viewport      |
| `motion-pop`      | 150ms, 100ms      | a popup: a menu, popover, tooltip, select or dialog, in and (faster) out          |
| `animate-wait-in` | 300ms, then 150ms | a loading state: unseen for `--motion-wait`, then faded in (see below)            |
| `animate-pulse`   | 2s, repeating     | a `Skeleton`'s pulse (`--motion-pulse`), stopped where less motion is asked       |

| Curve          | Tailwind      | For                                                     |
| -------------- | ------------- | ------------------------------------------------------- |
| `--ease-ui`    | `ease-in-out` | what changes in place (motion-hover, -fade, -size)      |
| `--ease-enter` | `ease-out`    | what arrives: fast, then settling (motion-pop's way in) |
| `--ease-exit`  | `ease-in`     | what leaves, gathering speed (motion-pop's way out)     |
| `--ease-slide` | —             | a surface under a finger, as the platform's sheets      |
| `--ease-loop`  | —             | what repeats, evenly both ways (a skeleton's pulse)     |

Each utility sets the duration and curve of a transition and of
tw-animate-css's `animate-in` and `animate-out`, e.g.
`transition-[height,opacity] motion-size`; `motion-hover` is the whole
transition of a background on hover. `motion-pop` takes its way out
where the element is `data-closed`, `data-ending-style` or
`data-active=false`. Menu, select, combobox, command and
`composer-select` items have `motion-hover` from the theme. Tailwind's
own timings are the theme's: a bare `transition-colors` is the fade on
`--ease-ui`, `ease-out` and `ease-in` the curves above. Durations are
the `--motion-*` properties (`--motion-mark`, 1200ms, is how long
`animate-highlight` marks a message), all 0s where less motion is asked.
`check-grid` fails on a component's own `duration-200` or `ease-[…]`.

- `CollapsibleContent` opens and closes in height and fades, clipped
  meanwhile: what draws past its edges (a focus ring on its first row)
  needs room inside it, e.g. `-m-0.5 p-0.5`.
- `AgentAppPanels`' panel widens from nothing and narrows to it as a
  button opens and closes it (not as it is dragged), and the main area
  narrows to nothing and widens from it as `AgentAppPanelExpand` expands
  the panel beside it and back; its group carries `data-panel-motion`
  meanwhile (`opening`, `closing`, `settling`, `expanding`,
  `collapsing`).
- `PictureInPicture` changes size from a card to a pill and back, its
  corner kept; with `open={false}` it shrinks and fades out as a popup
  does, and is then gone.
- `FloatingButton` fades and grows in; with `visible` it stays rendered
  and fades and shrinks out too.

What will move starts where it ends, so it need not move:
`AgentAppStart` puts its children (the composer, and a notice or an
alert over it, 24px apart) in an `AgentAppDock`, where the
conversation's composer will be, on a phone, a foldable on its side
and a desktop alike, and centres its heading in the room above; sending
the first message, the app swaps it for the conversation and its dock
and nothing of the composer moves. In a short window the heading's room
shrinks and scrolls first.

No curve overshoots (a spring's bounce): what arrives settles on
`--ease-enter`, fast then still, so a popup is read where it lands and
not watched.

### Loading

What loads shows nothing for a moment, then a skeleton of what comes,
then what came:

- Put `animate-wait-in` on what holds the loading state (its
  `role="status"`, with `Skeleton`s or a `Spinner` in it): it stays
  unseen for `--motion-wait` (300ms) and then fades in by
  `motion-fade`, so a load quicker than that never flashes one. Where
  less motion is asked the wait stays and the fade goes. Render it from
  the start; the wait is the theme's, not a timer of the app's.
- A `Skeleton` pulses on the theme's timing, and not at all where less
  motion is asked; it needs no `motion-reduce:animate-none`.
- What came replaces the skeleton at once, in its place: no fade and no
  cross-fade, which would only hold back what the reader waited for
  (and a quick load shows no skeleton at all). Keep the skeleton the
  size of what comes, so nothing moves as it does.

### Rows coming and going

A row added to or removed from a list (a sidebar's `SidebarMenuItem`,
an `ItemGroup`'s `Item`) appears and goes at once, on purpose: a list
is where the reader looks for a row, and rows sliding or growing in
move the others under the pointer as it reaches for one. The change
shows itself otherwise: a new conversation is the current row (its
background, and scrolled into view), and what is removed can be undone
from a toast.

## Edges and marks

What covers the window's edges is the theme's to clear, not a view's own
`env(safe-area-inset-*)`: the home indicator below, and above, AgentApp's
titlebar (`--agent-app-titlebar`) or the status bar, whichever is lower.

| Utility                    | Is                                                     |
| -------------------------- | ------------------------------------------------------ |
| `pb-safe`                  | padding clear of the home indicator                    |
| `pb-safe-or-<n>`           | n steps of padding, or more where the indicator is     |
| `bottom-safe-offset-<n>`   | n steps above the indicator (a toast)                  |
| `pt-safe-or-<n>`           | n steps of padding, or clear of the titlebar           |
| `top-safe-offset-<n>`      | n steps under the titlebar or status bar (a toast)     |
| `grid-cols-icon`           | a 16px icon's column and the rest (a line of a turn)   |
| `grid-cols-icon-end`       | the same and an end column (a time, an action)         |
| `--line-mark`              | 1.5px: an icon's stroke, a selected cell's edge, e.g.  |
|                            | `ring-(length:--line-mark)`                            |
| `shadow-mark-start`        | a current row's mark at its start edge (`--line-mark`) |
| `shadow-rule`              | a bar's rule below it, taking no room (line tabs)      |
| `--mark`, `--mark-current` | a search's tints: `::highlight(mark)`, `mark-current`  |
|                            | and a highlight of a component's own name              |
| `bg-checkerboard`          | behind a transparent image                             |
| `bg-dot-grid`              | an empty page's ground                                 |

`DialogContent size="full"` is a reader's or a viewer's: the window but
for 32px round it (a `className`'s `sm:max-w-*` or `sm:max-h-*` keeps it
centred), on a phone the whole screen.

## Choices

One of a few, each with words of its own (a plan, a mode): radio cards,
shadcn's Field "choice card": a `RadioGroup` whose items are each in a
`FieldLabel` card round a horizontal `Field`. The card picks it, the
arrow keys move between them ("Radio Group/ChoiceCards").

```tsx
<FieldSet>
  <FieldLegend variant="label">Plan</FieldLegend>
  <RadioGroup value={plan} onValueChange={setPlan}>
    <FieldLabel htmlFor="plan-team">
      <Field orientation="horizontal">
        <FieldContent>
          <FieldTitle>Team</FieldTitle>
          <FieldDescription>
            Shared projects, for up to ten people.
          </FieldDescription>
        </FieldContent>
        <RadioGroupItem value="team" id="plan-team" />
      </Field>
    </FieldLabel>
    …
  </RadioGroup>
</FieldSet>
```

One of a few short ones side by side (a range, a view, a size), a
segmented control: a `ToggleGroup` (`variant="outline"`, `size="sm"`),
one always chosen as the chart's range has it (`onValueChange` keeps the
current one when it is pressed again). Many of a list: "Choosing many",
above.

## A form while it is sent

Disable a form while it is sent with a plain `<fieldset disabled>`, left
a block, and lay its fields out in a `div` inside it. Not a `FieldSet`
nor a fieldset made `flex` or `grid` (or `contents`): in Chrome 156 a
flex fieldset whose `disabled` changes, an error then put above its
`FieldGroup`, can leave the field groups (size containers, for their
own container queries) drawn 0px tall, until something else lays the
page out again (seen on a sign-in page).

```tsx
<form onSubmit={send}>
  <fieldset disabled={sending}>
    <div className="flex flex-col gap-6">
      {error && <Alert variant="destructive">…</Alert>}
      <FieldGroup>…</FieldGroup>
    </div>
  </fieldset>
</form>
```

`FieldSet` is for a group with a legend (a plan, a list of choices),
not for disabling a form.

## Searching a workspace

A search through every folder, not only the loaded ones, is the
server's; `FilesViewer` keeps its field and shows what comes back, flat,
as Finder does ("Files Viewer/SearchResults").

```tsx
const [query, setQuery] = useState("")
const { results, pending } = useSearch(folder, query)   // the app's: debounced, recursive

<FilesViewer
  name={folder.name}
  files={query ? results : folder.children}   // results: { …file, description: "src/lib" }
  query={query}
  onQueryChange={setQuery}
  filtering="manual"                          // the server matched; shown as given
  searching={pending}
  folderAction={query ? "open" : "expand"}    // a folder found is gone into
  onOpen={(file) => {
    if (!file.directory) return openFile(file)
    setQuery("")                              // leaves the search, closes the field
    goTo(file)
  }}
  …
/>
```

- Each result's `description` is the folder it is in, after its name;
  the query is marked in the names. Results are flat (no `children`):
  the disclosure still expands a folder found, asking the app by
  `onExpandedChange`.
- The first result is selected when the current selection is absent. Up and
  Down in the field move the selection without leaving the input; Enter
  opens the selected result. Its row shows “↵ Open”. A double click also
  opens it; with `folderAction="open"`, folders call `onOpen` too.
  Escape, in the field or the
  results, empties the query (`onQueryChange("")`): the app shows its
  folder again.
- The open field replaces the search tool button; its clear button closes
  it. The results status bar shows “In <folder>”, keyboard hints, and
  results shown out of `count.items` (the supplied files, including children).
  App `controls` and `details` remain. Customize these with `labels.open`,
  `labels.searchIn`, `labels.searchHints`, and `labels.resultsOf`.
- While `searching`, the field's icon spins and the status bar says
  "Searching…"; none found, "No matches" (`labels.searching`,
  `labels.noMatches`). `sort={null}` keeps the server's order (e.g. by
  relevance).

## Searching with Command

A search palette whose query and highlighted hit live in the app, e.g.
to keep them when a page below `sm` gives way to a `CommandDialog`
(the Command mounts again):

```tsx
const [query, setQuery] = useState("")
const [highlight, setHighlight] = useState("")   // the highlighted hit's value

<Command shouldFilter={false} value={highlight} onValueChange={setHighlight}>
  <CommandInput value={query} onValueChange={setQuery} />
  <CommandList>
    {hits.map((hit) => (                         // the app's, for `query`
      <CommandItem key={hit.id} value={hit.id} onSelect={() => open(hit)}>
        {hit.title}
      </CommandItem>
    ))}
  </CommandList>
</Command>
```

- Mounted with a query and a value, the hit given stays highlighted
  until the reader acts (a key, the pointer, typing); a query typed then
  highlights its first hit. A value no longer in the list gives way to
  the first hit.
- `defaultValue` in place of `value` leaves the highlight to the
  Command; `onValueChange` hears each change either way, as does cmdk's
  `useCommandState((state) => state.value)` inside the Command.
- The arrows scroll the highlighted hit into view and make it the
  input's `aria-activedescendant`, with the rows memoized or compiled by
  the React Compiler too: no workaround in the app.
- A preview of the highlighted hit goes beside the list, outside it.

## Components agentui adds

### `composer`

A chat's message box: text with chips in it for mentions, files and
links, suggestions while typing a trigger such as `@`, one button that
submits or stops a response while one runs, files that come in by an
attach button, pasting or dropping, and a long draft that expands to a
page of writing. shadcn has the parts (`InputGroup`, `InputGroupButton`)
but not the behaviour every chat needs.

The editor is [Lexical](https://lexical.dev), so that a chip can sit in
the text; it is the composer's own business. Apps see plain data: a
message is a `ComposerValue`, text and chips in order, and ids are the
app's own.

```ts
type ComposerMention = {
  type: "mention"
  trigger: string
  id: string
  label: string
}
type ComposerAttachment = {
  type: "attachment"
  id: string // the app's, e.g. its upload
  name: string
  mediaType?: string // picks the icon
  preview?: string // an image's address, the chip's thumbnail
  detail?: string // e.g. "12 pages", "182 lines"
}
type ComposerLink = {
  type: "link"
  url: string
  title?: string // without one, the chip shows the address
  detail?: string // after the title: a site, or a state ("Open"); by default the host
  icon?: string // e.g. a favicon
  kind?: string // the app's kind, e.g. "pull-request", for renderLinkIcon
  description?: string // on the chip's card
  image?: string // on the chip's card
  preview?: boolean // pasted as a preview
}
type ComposerValue = (
  string | ComposerMention | ComposerAttachment | ComposerLink
)[]

// e.g.
;[
  "Compare ",
  { type: "mention", trigger: "@", id: "file:42", label: "app.ts" },
  " with ",
  { type: "attachment", id: "upload:7", name: "spec.pdf", detail: "12 pages" },
  "\nper ",
  {
    type: "link",
    url: "https://vite.dev/guide/build",
    title: "Building for Production",
  },
]
```

It is made of parts, like shadcn's components:

```tsx
<Composer
  value={draft}
  onValueChange={setDraft}
  onSubmit={(message, event) => send(message)}
  onStop={stop}
  status={status} // "ready" | "running" | "stopping"
  submitDisabled={!canSend}
  renderMention={(mention) => (
    <>
      <HugeiconsIcon icon={File01Icon} strokeWidth={2} />
      {mention.label}
    </>
  )}
  actionsRef={composer} // composer.current.insert([...]), .addFiles(files), .pickFiles(), .focus()
  onAddFiles={(accepted, rejected) => attachmentsFor(accepted, rejected)}
  attachmentState={(file) => uploads.get(file.id)} // { progress } or { error }
  onOpenAttachment={(file) => openInPanel(file.id)}
  onRetryAttachment={(file) => upload(file.id)}
  resolveLink={(url, { signal }) => fetchTitle(url, signal)}
  accept="image/*,.pdf"
>
  <ComposerSuggestions
    trigger="@"
    label="Files"
    items={results} // for the query, filtered by the app
    onQueryChange={search} // the text after "@", or null when closed
    loading={searching}
    error={searchError}
    renderItem={(file) => (
      <>
        <HugeiconsIcon icon={File01Icon} strokeWidth={2} />
        {file.label}
      </>
    )}
  />
  {/* placement="row" where the text cannot hold chips */}
  <ComposerAttachments />
  <ComposerEditor
    aria-label="Message"
    aria-invalid={!!error}
    aria-describedby="send-error"
  />
  <InputGroupAddon align="block-end">
    <ComposerAttach disabled={files.length >= limit} />
    {/* the app's other tools, e.g. a model picker */}
    <ComposerSubmit className="ms-auto" />
  </InputGroupAddon>
</Composer>
```

#### Text, sending and stopping

- `Composer` is a `<form>` around an `InputGroup`, which floats: a soft
  shadow and a hairline, no hard border. The value is controlled
  (`value`, `onValueChange`) or not (`defaultValue`); setting `value`
  replaces the message, e.g. to restore a draft or to clear it after
  sending. `onSubmit(value, event)` replaces the form's own `onSubmit` and
  gets the message first. `composerText(value, format?)` writes a message
  as plain text, chips by `format` (by default a mention as its trigger
  and label, a file as its name, a link as its address), e.g. to check
  whether it is empty.
- `ComposerEditor` is the editor, a multi-line `textbox`: props such as
  `aria-*` and `id` go to it. Its `placeholder` is the app's, none if it
  gives none; nothing else is written in the composer (shortcuts
  are in tooltips). It grows with its text up to eight lines, then
  scrolls, and has `enterKeyHint="send"`. Its text is 16px on phones, so
  iOS does not zoom in, and 14px from `md` up; its buttons take a finger
  at 40px or more (`pointer: coarse`). `previewProps` go to the
  expanded editor's Markdown preview: the `labels` and `headingOffset`
  the app gives its messages.
- `actionsRef` gives the app `insert(value)`, which inserts text and
  chips at the caret (or at the end) as typing would, so undo takes it
  back; `addFiles(files)`, for files with no place in the text, e.g.
  dropped on the window (they go to the row, see below); `pickFiles()`,
  which opens `ComposerAttach`'s file picker, as its "+" or its menu's
  `ComposerAttachFiles` does, for the app's own shortcut (call it from
  the key's handler: a browser opens a picker only on the user's
  action); and `focus()`.
- `ComposerSubmit` is one button that submits while `ready`, and stops
  while `running` or `stopping`, except that while `running` with
  follow-ups taken (`submitDisabled` unset) a stop goes before it and it
  stays a raised send, waiting for the follow-up, so one can be sent on
  touch screens too. Its icon and name show `followUp`: "send" (default),
  "queue" or "steer". Queue and steer have a tooltip naming the
  Cmd/Ctrl-click alternative. It is the same element throughout, so focus
  stays on it when it changes; its accessible name follows (`labels`, default
  "Send" and "Stop"). While a queued message is edited
  (`editing="queued"`) it is a labelled "Update ↵", with no stop. Its
  `reason`, the stop and it are one group, and `className` is the
  group's: `className="ms-auto"` puts them all at the toolbar's end.
- **Enter** submits and **Shift+Enter** adds a line. Enter does nothing
  while an input method is composing. On touch screens
  (`pointer: coarse`) Enter adds a line and the button submits;
  `submitOnEnter` chooses, e.g. from the reader's setting
  (`submitOnEnter` true: Enter sends on a phone too). The on-screen
  keyboard's Enter key says which ("send" or "enter").
- **In a code block**, Enter adds a line, keeping its indent, and never
  sends; Cmd/Ctrl+Enter still sends when `submitOnEnter` is true. Enter at
  the closing fence or after two blank code lines leaves the block (closing
  an open fence). Tab and Shift+Tab indent and outdent code lines; pastes
  stay typed text and mentions are not suggested. Move the caret outside
  the block with the arrows or Enter on the closing fence before Tab moves
  focus again.
- **Escape** calls `onStop` while `running`, unless an open list of
  suggestions, the paste bar or the expanded editor takes it, or an input
  method is composing (Escape then cancels the composition).
- While `running`, Enter still submits unless `submitDisabled` is set:
  whether a follow-up can be sent during a response is the app's choice.
  `followUp="queue"` queues it for after the turn; `followUp="steer"`
  sends it into the running turn (what steering does is the app's).
  Cmd+Enter (Ctrl+Enter) or Cmd-click (Ctrl-click) swaps queue and steer.
  `onSubmit`'s third argument is `{ interrupt, followUp }`: `interrupt`
  records the modifier, and `followUp` is the resolved action, or "send"
  when ready, editing, or using the default `followUp="send"`.
- With `submitDisabled`, neither Enter nor the button calls `onSubmit`.
  While `stopping`, the stop button is disabled and Escape does nothing.
- A disabled button does not make the field look disabled; `disabled` on
  `Composer` disables the whole input, files included.
- Text is the app's: `labels` (send, stop, `queue`, `steer`,
  `followUpHint(mode, modifier)`, attach, expand, collapse,
  draft, words, write, preview, the paste bar's and the chip card's
  words, a file card's `uploading(percent)`), `placeholder`, `aria-label` and the suggestions' `label` and
  `messages` are props with English defaults.

#### Chips

- Mentions, files and links are chips: 24px, in a 28px line (a line with
  chips is that tall), the same look for each, their names 500; in dark,
  the page's colour, recessed in the composer's. A short name takes its
  own width; the detail after it ("12 pages", a link's host, none when
  the title already starts with the host) is cut first. The caret goes around a
  chip, not into it. Copying writes it as `composerText` does.
- **Backspace** (or Delete) next to a chip selects it; again, removes it;
  undo brings it back. The **arrows** step onto a chip (selecting it),
  then past it. Typing on a selected chip types after it. A click or a
  tap selects it too.
- A selected file or link, or one the pointer rests on, shows a card
  above it: a file's picture, name, `detail` and why it failed, with Open
  (`onOpenAttachment`, also **Enter** on the selected chip), Retry
  (`onRetryAttachment`, for a failed one; Enter then retries) and Remove;
  a link's site (and "· fetched 12:04" with its `fetched`, the
  `labels.fetched` words), title, `description` and `image`, its edge
  on the chip's, with Open (its page,
  in a new tab), Show as URL and Remove. A mention has no card.
- A quote (`{ type: "quote", text, id, source }`, e.g. from
  `selection-actions` below) is a chip of its first words, named
  "Quote: …" (`labels.quote`) for screen readers. Its card has the
  `source` ("Answer · 12:04") and the whole text, scrolling when long,
  with Open (`onOpenQuote`, e.g. to scroll to where it came from;
  also **Enter** on the selected chip) and Remove. Copying writes it as a
  Markdown quote (`> ` before each line) and a blank line.
- A mention's chip shows `renderMention` (by default its trigger and
  label); a link's icon is `renderLinkIcon(link)` (e.g. by `kind`), else
  its `icon`, else a globe. The look of chips is the composer's.
- The same `id` can appear more than once; each chip is its own.
  Removing one does not touch the others.

#### Mentions

- `ComposerSuggestions` opens when its `trigger` starts a word ("a@b"
  does not), and closes at a space, when the caret leaves, or on Escape
  (until the caret leaves that trigger). Several, with different
  triggers, can be in one composer.
- The app searches: `onQueryChange` gets the text after the trigger, and
  `items` are what to show for it. Results for an older query are the
  app's to drop. `loading`, `error` and an empty `items` show a notice
  instead (`messages.loading`, `messages.empty`).
- The editor keeps the focus. It points at the list (`aria-controls`) and
  at the highlighted item (`aria-activedescendant`), and the number of
  items is announced (`messages.count`). Up and Down move through them;
  Enter or Tab, or a click, chooses one; while composing, Enter is the
  input method's. With nothing to choose, Enter sends.
- Choosing puts a chip in place of the trigger and query, with the
  item's `id` and `label`, then a space. It does not send.
- An item with `execute` runs instead, as a slash command that acts at
  once (`/clear`): the trigger and query go, the caret stays where they
  began, and `onExecute` gets the item once the text is without them.
  Items without it, in the same list, still become chips.
- An item with `opens` opens a list of its own in place of this one
  (kinds under "@" with nothing typed: "Conversations", "Files"). The
  trigger stays and the caret after it; what was typed after it goes.
  `onPathChange` gets the items opened, outermost first (or pass `path`
  to keep it yourself), and `onQueryChange` the query typed in that list:
  the app gives its items for both. A row at the list's top, with the
  opening item's label, goes back (`messages.back` names it), and so do
  Left or Backspace with nothing typed, and Escape; at the first list
  Escape closes. The path is emptied when the list closes.
- On a touch screen the footer shows no keys. The list is as high as
  the room over the composer in what is seen of the page (over a phone's
  keyboard), 320px at most with a mouse, and in a composer narrower than
  40rem as wide as it. A tap on it leaves the focus in the editor.

```tsx
<ComposerSuggestions
  trigger="/"
  label="Commands"
  items={[
    {
      id: "clear",
      label: "clear",
      description: "Clear the conversation",
      execute: true,
    },
  ]}
  onQueryChange={setCommandQuery}
  onExecute={(command) => run(command.id)}
/>
```

#### Files

Files are part of the message: each becomes an attachment chip in the
text, where it came in. `onAddFiles` returns what to insert for them,
usually an attachment per file with an id of the app's (`upload:…`), and
uploads them; deleting the chip is removing the file. The upload's state
is not in the value: `attachmentState(attachment)` gives it, `{ progress }`
from 0 to 1 while it uploads (a bar along the chip's foot, and the
percentage; in the row, a ring over an image tile or a file card's icon,
with "Uploading · 64%" in the status), `{ progress: null }` while it uploads with no way to tell how
far (a turning quarter ring, "Uploading"), or `{ error }` once it failed (the chip or card says why; a
chip's edge darkens, a card or image tile's is dashed; image tiles show a warning over the image). Which files to take beyond their types, how many and how large,
and what to say about the rest, is the app's call.

```tsx
onAddFiles={(accepted, rejected) => {
  if (rejected.length) toast(`${names(rejected)} cannot be attached.`)
  return accepted.flatMap((file) => {
    const id = upload(file) // e.g. "upload:7"
    return [
      {
        type: "attachment",
        id,
        name: file.name,
        mediaType: file.type,
        preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      },
      " ",
    ]
  })
}}
attachmentState={(file) => uploads.get(file.id)} // { progress: 0.62 } | { error: "Too large · 48 MB" }
```

- `onAddFiles(accepted, rejected)` receives the files that match
  `accept` (MIME types, `type/*` and extensions, as the `accept`
  attribute) and those that do not, so the app can say why a file was
  not added (a `FieldError` or a toast). What it returns is inserted at
  the caret (or at the end), or, for a drop, where the files were
  dropped; returning nothing inserts nothing. Without `onAddFiles`,
  nothing is taken and `ComposerAttach` renders nothing.
- `ComposerAttach` is a button (label `labels.attach`, default "Attach
  files") that opens the file picker. It is the keyboard and touch way to
  add files; dragging is never the only way (WCAG 2.5.7). Set `disabled`
  on it when no more files can be added: the message can still be edited
  and sent. `multiple` (default `true`) is the picker's.
- Pasting files adds them at the caret; text pasted with them is still
  pasted. An image copied from a page comes with its address, which is
  not pasted.
- `pasteAsFile={{ minLength, name }}` adds pasted text of `minLength`
  characters or more as a text file (`name`, default "Pasted text.txt"),
  through `onAddFiles` like a pasted file, instead of pasting it: a log
  or a document becomes a chip the app can upload or show. It is off
  unless set, and text is pasted as text where the app takes no text
  files (no `onAddFiles`, or an `accept` without `text/plain`). It also
  keeps drafts short: each keystroke reads the whole draft, about 1 ms
  at 1,000 lines.
- While files are dragged over the input it shows a dashed drop target
  (`data-dragging` on `Composer`); dropping adds them.
- Data of the app's own types (`dropTypes`, as a `DataTransfer` names
  them) is a drop target too: `onDropData(dataTransfer)` returns what to
  insert where it was dropped, e.g. a mention of a file dragged from a
  `Browser`'s list (`dropTypes={[browserFileType]}`, then
  `browserFileFrom(data)`). Other data, e.g. text, is not taken. As for
  files, dragging is not the only way: the app's `@` suggestions, or
  `insert`.
- The app's `onPaste` and `onDrop` run first, before the editor; one that
  calls `event.preventDefault()` takes the event: `Composer` adds no
  files from it and the editor pastes nothing. This is how an app handles
  kinds of data of its own, such as a reference to a file it already
  has, which it can then `insert`.
- A message of files alone is not empty: its chips are in the value.

#### The row of files

`ComposerAttachments` is where files go that have no place in the text,
and, with `placement="row"`, where all files go: a row above the text,
each with a remove button (and a retry button when it failed and
`onRetryAttachment` is set; it opens with `onOpenAttachment`).
Backspace or Delete on one removes it. A row that does not fit on one
line ends in "+N", which shows them all.

- `variant="card"` (the default): images with a `preview` are 64px square
  tiles in their own sideways-scrolling line with snap, never folded into
  "+N". A progress ring or warning covers the image; remove and retry actions
  sit on its corner, shown on hover or focus and always on touch or error.
  Opening uses `onOpenAttachment`; a tooltip gives the name and status, also
  available to screen readers. Other files follow as 44px cards, 8px apart,
  with the existing one-line fit and "+N" fold counting only cards. Their
  32px icon tile precedes the name and status (error, `labels.uploading`, or
  `detail`); remove stays on the corner and Retry follows the name.
- `variant="chip"`: the text's 24px chips, e.g. where the row stands
  in for chips the text cannot hold; the × over a chip's end on a hover
  or focus.

- `placement="inline"` (the default): files go into the text, at the
  caret or where they were dropped. Files dropped on the composer around
  the text, given to `actions.addFiles`, or, with `windowDrops`, dropped
  anywhere on the page where nothing else took them (`preventDefault`),
  go to the row.
- `placement="row"`: every file goes to the row, e.g. where the text
  cannot hold chips. Files already in the text move to it.
- In the value, the row's files come first, then the text. Without
  `ComposerAttachments`, there is no row and every file goes into the
  text.

#### Links

With `resolveLink(url, { signal })`, a pasted address (alone, `http` or
`https`) becomes a link chip: it shows the address while the app looks it
up, then what the app returned (`title`, `detail`, `icon`, `kind`,
`description`, `image`). Null, or a failure, leaves the address as text.
What a link is, e.g. a pull request with its number and state, is the
app's: agentui knows no site.

```tsx
resolveLink={async (url, { signal }) => {
  const pull = matchPull(url) // the app's
  if (pull) {
    const { title, state } = await getPull(pull, { signal })
    return { title: `#${pull.number} ${title}`, detail: state, kind: "pull-request" }
  }
  return await fetchPageTitle(url, { signal }) // { title, detail: host, icon } or null
}}
renderLinkIcon={(link) => (link.kind === "pull-request" ? <HugeiconsIcon icon={GitPullRequestIcon} strokeWidth={2} /> : undefined)}
```

- After a paste, a bar above the link offers it as a **Link** (the
  default), a **Preview** (`preview: true` in the value: the app shows or
  sends the page, not only its address) or **Plain text** (the address).
  It goes at the next key, a click elsewhere, or Escape. Its buttons are
  in the tab order after the editor.
- Without `resolveLink`, addresses are pasted as text. Text with an
  address in it is pasted as text.
- Results are kept per address for the composer's life; a link removed
  or turned to text while it resolves is not changed after.

#### Long text

Past eight lines the editor scrolls and shows an expand button in its
corner ("Expand", its shortcut in its tooltip). **⌘⇧E** (Ctrl+Shift+E)
expands or collapses it at any length; **Escape** collapses it.

- Expanded, the composer is as tall as a page of writing
  (`--composer-expanded-height`, by default `min(40rem, 80dvh)`): a
  header says "Draft" and the number of words, with Write and Preview
  tabs and a collapse button; the toolbar stays below. Its place in the
  layout grows upward when the composer sits at the foot of the
  conversation.
- Write styles the Markdown as it is typed, its marks kept: a heading's
  line semibold and its `#`s muted, a list item's marker muted, a code
  block (fences included) and inline code in mono; lines of text are
  24px, code 20px, and a blank line 12px, so a heading sits 36px above
  its paragraph. Only the look changes: the value is the text as typed,
  and copying gives the same Markdown. Collapsed, it is plain text.
- Preview shows the message as Markdown (the `markdown` item, loaded the
  first time), links as links. Write is the same editor, so nothing is
  lost either way.

A mode that lets the agent act unasked is `tone: "destructive"` in
`ComposerModePicker`'s `modes`: chosen, the toolbar shows it in the
destructive colour, its icon too, and its icon so in the list, so it is
not mistaken for a safer one.

A line about the modes goes in its `footer`, under them past a
hairline: small grey text with a link or a button in it ("Applies to
this conversation only · Learn more"), underlined, after the modes by
Tab. Any picker has it as `ComposerSelectContent`'s `footer`; it stays
in sight while the list scrolls, and at a sheet's foot on a phone.

#### A narrow toolbar

A narrower toolbar gives up room in steps, by its own width, not the
window's, so a narrow composer in a wide window (beside a side panel)
and a wide one in a narrow window each keep what fits:

- under 36rem the hints go (why it cannot send, the history's place);
- under 32rem the permissions picker is only its icon and the context
  meter only its bar; the model keeps its "· High";
- under 24rem (a phone, or a composer beside the sidebar on an unfolded
  foldable) it keeps `+`, the model by its name, voice and send; the
  settings set once a conversation fold behind one button. Wider, it
  folds so too where, unfolded, its tools do not fit (a picker's value
  cut short, e.g. an app's picker more), until it is as wide as they
  need.

Folding goes a step at a time where a tool says how. A
`ComposerOptionsFold` that is `compact` folds in place first, its same
trigger opening its same picker or popover: its value
(`ComposerSelectValue`) goes, its icon and the rest stay (a provider's
icon and its usage; the permissions as their icon, tinted when
destructive); a usage meter keeps its bar and its percentage. Where even
so they do not fit, compact ones not `keep` fold away into the options
button. Kept ones, e.g. the meters a reader watches, never fold away:
the model's name is cut short instead. What a narrow toolbar keeps is
the app's to choose: these are opt-in, and a tool outside any fold
stays as it is.

```tsx
<ComposerOptionsFold compact>{/* icon only, then away */}
  <ComposerModePicker … />
</ComposerOptionsFold>
<ComposerOptionsFold keep>{/* icon and usage, always */}
  <EndpointPicker />                  {/* its name a ComposerSelectValue */}
</ComposerOptionsFold>
<ComposerOptionsFold keep>
  <UsageMeterBreakdown … />
</ComposerOptionsFold>
```

```tsx
<ComposerToolbar>
  <ComposerAttach>…</ComposerAttach>
  <ComposerOptionsFold>                      {/* hidden under 24rem */}
    <ComposerModePicker … />
  </ComposerOptionsFold>
  <ModelPicker … />
  <ComposerOptionsFold>
    <UsageMeterBreakdown className="ms-auto" … />
  </ComposerOptionsFold>
  <ComposerOptions className="ms-auto">      {/* shown under 24rem */}
    <ComposerOptionsItem icon={…} value="Ask first" onClick={openModes}>
      Permissions
    </ComposerOptionsItem>
    <ComposerOptionsItem icon={…} value="High" onClick={openModels}>
      Thinking
    </ComposerOptionsItem>
  </ComposerOptions>
  <ComposerVoice … />
  <ComposerSubmit />
</ComposerToolbar>
```

- `ComposerOptions` is a toolbar button (sliders) that opens a sheet
  titled `label` ("Options"); each `ComposerOptionsItem` is a row of an
  icon, what it sets, its `value` and a chevron. A row opens its picker
  (the pickers take `open` and `onOpenChange`); a picker folded away
  opens from the `ComposerOptions` button, as a sheet on a phone.
- The toolbar's menus and pickers open 8px above the composer, never
  over its text (`popups="trigger"` on `Composer`: by their buttons,
  over the text if need be); a list of suggestions opens under its trigger, and the
  send button is grey while it is open (Enter takes a suggestion).

#### Voice input

`ComposerVoice` is the toolbar's mic. The app records (`onStart`) and
makes out the words (`onFinish`); the composer shows the recording and
puts the words in the text where the caret was as the take started
(over what was selected; the end with no caret), to edit before
sending.

```tsx
<ComposerVoice
  onStart={recorder.start} // rejects with getUserMedia's error
  onFinish={recorder.transcribe} // the words; a rejection keeps the take
  onCancel={recorder.discard}
  levels={recorder.levels} // 0 to 1, the latest last
  transcript={live.final} // optional: words as they are made out
  interim={live.interim}
  maxDuration={120} // its last 10 seconds count down
  submitOnFinish="hold" // send at once when held, not tapped
/>
```

- Tapped, it records until Done (Escape or Cancel drops it); held,
  pointer or Space, until let go, slid back past 80px to cancel ("Slide
  to cancel", then "Release to cancel"); held by a key (Space, or the
  `shortcut`), nothing slides, so it says "Esc to cancel"
  (`labels.escape`). A press shorter than 300ms is a tap, so a quick
  click never cuts a take short.
- While it records, the editor is read only: the draft stays in view
  as it will be, a copy of the editor's text and chips. Without a
  `transcript`, the time and a waveform are above it (alone in an empty
  box), and the words come at Done. With one (even empty: "Listening…"
  in an empty box), the words are in the draft where they will go, as
  its text (16/24), the `interim` ones grey, the time and a smaller wave
  on the toolbar; Done keeps the words shown when `onFinish` returns
  nothing.
- The words are spaced from the draft as a script needs: one space on
  either side where the text beside them has none and both are letters
  or digits of a script written with spaces (Latin, Cyrillic, Greek,
  Hangul…), or the text before ends a sentence, a clause or a bracket
  (". , ! ? ; :", ")"); none beside Chinese, Japanese or Thai, nor
  before punctuation. "hello world" and "big" with the caret after
  "hello" make "hello big world", the caret after "big". The rule is
  `dictationSpaces` in `@/lib/dictation`, for an app that puts words in
  its own text.
- If `onStart` rejects, a line under the box says why, by the
  `getUserMedia` error's name: `NotAllowedError` (access off, where to
  allow it), `NotFoundError` (no microphone), anything else
  (unavailable); a ✕ or typing dismisses it.
- If `onFinish` rejects, the take is kept: the box says the words could
  not be made out, with Retry (`onFinish` again) and Cancel. Keep the
  audio until one of them.
- Opening a microphone takes about half a second, and seconds the
  first time in WebKit. While `onStart` is pending, a spinner takes the
  mic's glyph's place (still with reduced motion), the mic busy and
  described as starting (`labels.starting`); a hold let go meanwhile is
  a tap. An app that keeps the microphone open between takes (after
  one, on hover, always), so a press records at once, says so with
  `ready`: the idle mic's glyph in the text's colour, a status mark's
  dot at its corner, described as `labels.ready` ("Microphone ready").
- `holdToTalk`: on a touch screen, a tap on the composer types (the
  editor focused, the keyboard up, as ever) and a long press talks. A
  finger held still for 400ms (before the platform's own long press)
  starts a take, as a held mic does (starting, `ready`, live words and
  levels alike), with a short vibration where the device has one. With
  the keyboard down (the editor not focused), anywhere on the composer
  counts, the editor too, its text not selected nor its callout opened
  for that press; with the editor focused, its text keeps the
  platform's long press (select, the caret, paste) and only the rest
  (the toolbar's background, the box's padding) talks. Controls (a
  button, a link, a chip) keep theirs. A finger that moves over 10px
  before 400ms is a scroll; a mouse or pen is as before.

  Held, over the conversation, above the composer, are its words, time
  and waveform (and the last seconds of `maxDuration`), what letting go
  does ("Release to send", `labels.releaseToSend`), and two targets to
  slide to, Cancel and To text, the one under the finger lit and saying
  what letting go there does ("Release to cancel", "Release to
  convert"), a pulse on each. Let go on Cancel, the take is dropped; on
  To text, its words go in at the caret (or the end), the editor
  focused to edit them before sending; anywhere else, they are sent
  alone, the draft kept (`onSubmit`'s `options.talk` is true, so a
  controlled app keeps its `value`); the editor has the focus after
  only if it had it before. At `maxDuration` it is sent. Escape cancels.
  A second finger or the touch taken by the system drops it; the page
  hidden or the window left puts its words in the text, not sent; let
  go before the microphone opened, nothing is recorded.
- However a take ends (Done, let go, sent, Cancel, Escape, at
  `maxDuration`, a failed one cancelled), the editor has the focus
  again, the caret after the words it put in or where it was, unless
  the reader went elsewhere meanwhile.
- `shortcut` gives it a key that drives it from anywhere in the window,
  by its `KeyboardEvent.code`, pressed alone; `labels.shortcut` says so
  in the mic's tooltip and description (by default "Hold Right Alt to
  talk", from the code), and the mic has it as `aria-keyshortcuts`. That
  names a key by its `KeyboardEvent.key`, with no side ("AltRight" is
  "Alt"), so the label is the one that names it exactly:

  ```tsx
  <ComposerVoice
    shortcut="AltRight" // the right Option or Alt key alone
    labels={{ shortcut: "Hold Right ⌥ to talk" }}
    submitOnFinish="hold"
    …
  />
  ```

  Held, it records until let go, sent by `submitOnFinish` as a held mic
  is; Escape cancels. Tapped (let go within 300ms), it records until
  tapped again or Done, not sent by `"hold"`. A take starts once the key
  has been held alone for 150ms (its first 150ms of speech are not
  recorded): another key before that, as an Option or AltGr character
  is typed, starts none, and during a take cancels it, that key going
  through either way. The key does nothing else (a lone Alt opens no
  menu); repeats are ignored. If the window loses the focus while it is
  held (its key-up never comes), the take finishes, the words kept, not
  sent. With several composers mounted (a main one and a side panel's)
  each with the key, the one with the focus answers it, else the one
  that last had it, else the first mounted.
- To choose what it records from (a reader whose default input is
  silent or virtual, a loopback driver, a headset unplugged), give it
  `inputs`: a chevron beside the mic, a split button, opens them, the
  system default first ("System default"), a sheet on a phone. Tap,
  hold and Space stay the mic's; the chevron is its own target (Enter,
  Space or ArrowDown open it). It goes with the tools while recording
  and is disabled while a recording starts. The app owns the devices:

  ```tsx
  const [inputs, setInputs] = useState<ComposerVoiceInput[]>([])
  const list = () =>
    navigator.mediaDevices.enumerateDevices().then((devices) =>
      setInputs(
        devices
          .filter((d) => d.kind === "audioinput" && d.deviceId && d.deviceId !== "default")
          .map((d, i) => ({ id: d.deviceId, label: d.label || `Microphone ${i + 1}` }))
      )
    )
  // list() on mount and on navigator.mediaDevices' "devicechange"

  <ComposerVoice
    inputs={inputs} // none: the mic alone
    input={input} // "" or none: the system default
    onInputChange={setInput} // keep it, and record from it:
    onInputsOpen={list} // names come once the mic was allowed
    onStart={() =>
      recorder.start({ audio: input ? { deviceId: { exact: input } } : true })
    }
  />
  ```

  An `input` no longer among `inputs` shows as the system default; an
  input with no name is named by its place ("Microphone 2",
  `labels.unnamedInput`). Its words are `labels.input` and
  `labels.systemDefault`.

#### A sent message

`ComposerMessage` shows a sent `ComposerValue` with its chips where they
were, as the composer did, e.g. in the user's bubble:

```tsx
<Bubble variant="muted" align="end">
  <BubbleContent>
    <ComposerMessage
      value={message}
      onOpen={(chip) => chip.type === "attachment" && openInPanel(chip.id)}
      renderMention={renderMention}
      renderLinkIcon={renderLinkIcon}
    />
  </BubbleContent>
</Bubble>
```

- With `onOpen`, a file's, mention's or quote's chip is a button; a link's chip is
  a link to its page, in a new tab.
- `ComposerChip` is the chip alone (`value`, and `state`, `selected`,
  `icon` or `children`), for a list of files or any place a chip shows.

#### Shelves

Use `ComposerShelf` with `ComposerShelfBar` for a notice over the composer.
Shelves are a little narrower, tuck under its top edge, and stack edge to
edge with square corners and one hairline where they meet. Use
`ComposerShelfTab` for a small content-width tab at the top-right edge,
with a count such as "Stash 3" or "Drafts 2": `icon`, the words as
`children`, `count`, and the button's own props (`onClick`,
`aria-expanded`). Its count lifts once when it rises, not with reduced
motion. `ComposerShelf size="content"` is the same small shelf around
anything else.

```tsx
<div className="flex w-2xl max-w-full flex-col">
  <ComposerShelf>
    <ComposerShelfBar>Working in a sandbox</ComposerShelfBar>
  </ComposerShelf>
  <ComposerShelf>
    <ComposerShelfBar>Usage limit nearly reached</ComposerShelfBar>
  </ComposerShelf>
  <Composer value={value} onValueChange={setValue} onSubmit={send}>
    <ComposerEditor aria-label="Message" />
  </Composer>
</div>
```

Render shelves in a fixed order, for example the environment first, then
what needs the reader, so rows never swap places as notices come and go.
The app decides which show and every word.

A setting the reader may not expect, such as full access kept from the
last conversation, is a bar that says what it is, in its `detail` what it
means, and in its `actions` a way back and a way to close it:

```tsx
<ComposerShelfBar
  icon={<HugeiconsIcon icon={ShieldEnergyIcon} />}
  detail="It won't ask first."
  actions={
    <>
      <Button size="xs" variant="ghost" onClick={askFirst}>
        Ask first again
      </Button>
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label="Dismiss"
        onClick={hide}
      >
        <HugeiconsIcon icon={Cancel01Icon} />
      </Button>
    </>
  }
>
  Full access kept from your last chat.
</ComposerShelfBar>
```

#### A request in its place

While the agent waits for the reader (to allow a tool call, to answer a
question), the request takes the composer's place at the foot of the
conversation: `ComposerTakeover` around the composer, and the request,
an `agent-request` card, as its `request`.

```tsx
const approval = approvals[0] // approvals before questions: the app's order
const current = approval ?? question
<ComposerTakeover
  request={
    approval ? <Approval key={approval.id} … /> : question ? <Question key={question.id} … /> : undefined
  }
  status={approvals.length > 1 ? `${approvals.length} waiting` : approval ? "Needs your approval" : "A question for you"}
  onStop={stopTurn}
  // A question can be set aside to chat; an approval here cannot.
  {...(!approval && question && {
    aside: asideId === question.id,
    onAsideChange: (aside) => setAsideId(aside ? question.id : null),
  })}
  labels={{ setAside: "Chat instead", resume: "Back to question", stop: "Stop" }}
>
  <Composer …>…</Composer>
</ComposerTakeover>
```

- One request at a time, in the composer's frame: as wide, the same
  radius and soft shadow, so the swap does not jump. Over it a line of
  the app's `status`, which screen readers hear as it changes, a toggle
  with `onAsideChange`, and a stop with `onStop`.
- A request arriving while the reader types waits until they pause for
  `holdWhileTyping` (1500ms by default; `false` or `0` shows it at once),
  or at once on blur or send. The composer keeps focus and keystrokes;
  `labels.held` supplies the quiet hint, announced politely.
- The composer stays mounted, hidden and inert, while a request shows:
  its draft, chips and files are there when it comes back.
- Set aside (`aside`), the composer shows and the request stays mounted,
  hidden, as it was left (a choice made in a `Questionnaire` stays).
- Focus moves to the request's card when one shows, and back to the
  editor, with its caret, when it goes or is set aside; not if the reader
  is elsewhere in the page. A `key` per request moves focus to the next.
- On a phone it is where the composer was, at the foot in the thumb's
  reach, and the card's footer is its phone footer.
- The app's: which request shows (approvals before questions, the
  oldest first), the count and every word, which can be set aside and
  remembering that (by the request's id, so a new one shows), and what
  stop does. In the conversation it shows the decided rows, and while one
  waits, nothing or `agent-request`'s `waiting` row.

### `composer-queue`

The messages sent while a turn runs, queued on a shelf above the
composer and sent in order, one each time a turn ends. Enter queues;
Cmd+Enter (Ctrl+Enter) or Cmd/Ctrl-click steers at once (`onSubmit`'s
`followUp === "steer"`), here stopping the turn for the message. The app
owns the queue: `items` is its array, and the shelf asks for changes by
callbacks.

```tsx
<div className="flex flex-col">
  <ComposerQueue
    items={queue} // { id, text, attachments?, time?, icon?, editable? }[]
    editing={editingId}
    sending={sendingFirst}
    paused={paused}
    pausedReason="the last turn stopped with an error"
    status={<>Running · the next one is sent when this turn ends</>}
    onReorder={(ids) => reorder(ids)}
    onEdit={(id) => putBackInComposer(id)} // then editing={id}
    onCancelEdit={restoreDraft}
    onSaveEdit={(id, text) => update(id, text)} // edits in the manager
    onSendNow={(id) => interruptWith(id)}
    onRemove={(ids) => remove(ids)}
    onClear={clear}
    onPause={pause}
    onResume={resume}
  />
  <Composer
    status="running"
    followUp="queue"
    onSubmit={(message, event, { followUp }) =>
      followUp === "steer" ? interruptWith(message) : enqueue(message)
    }
    // The submit says Update; Escape puts the message back before it
    // stops the turn.
    editing={editingId ? "queued" : false}
    onCancelEdit={restoreDraft}
  >
    …
  </Composer>
</div>
```

- Each row shows its place, its files (thumbnails and how many) and its
  text; hovering or focusing it (always, under a finger) shows edit,
  move to top (past the first, or the one being sent, with
  `onReorder`), send now and remove. The manager's button is in the
  header wherever they can be moved (`onReorder`), with two or three
  too. A
  message that has just been queued is marked for a moment, and screen
  readers hear it.
- A queued command among the messages (e.g. "Compact conversation") has
  its `icon` before its text, 14px in grey, and `editable: false`: no
  edit button nor E key on it, on the shelf or in the manager; send now
  and remove as any message.
- A message that did not come from the reader (another agent or
  session sent it to wait in the queue) says where it came from in
  `from`: before its text on the shelf, by weight as a sender's name, cut
  to a third of the row so the text keeps the rest; over its text in the
  manager. It is read with the message (its buttons are described by it
  and the text), and may hold a link to the sender; a link in it is
  underlined when focused, as a ring would be cut. Keep `icon` for a
  mark: it is hidden from screen readers.
- **Edit** calls `onEdit`: the app puts the message back in the composer
  and sets `editing`, which strikes it through and says so in the header.
  Sending saves it in its place; Escape (`onCancelEdit`) leaves it as it
  was. The composer's `editing="queued"` makes its submit a labelled
  "Update ↵" (`labels.updateQueued`) with no stop, and Escape there calls
  its `onCancelEdit`.
- **Moving**: drag a row by its handle (mouse, pen or finger), or press
  Alt+ArrowUp and Alt+ArrowDown (Option on a Mac) on it. Focus stays on
  the row and screen readers hear its new place. `onReorder` gets every
  id in the new order. A dragged row lifts 10px aside, its actions
  hidden.
- Past `collapseAfter` (3) the shelf shows the first and how many more,
  with Clear all and a button that opens the manager: a dialog that
  filters the messages (`/`), selects some (Space) to send next, move to
  the top or bottom or remove together, edits one in place (E, with
  `onSaveEdit`; without it, `onEdit`), moves one (Alt and the arrows),
  removes (Delete) and sends now (Cmd+Enter). Escape leaves an edit, then
  the selection, then the dialog.
- `sending` marks the first as being sent. `paused` says the queue waits
  (`pausedReason` says why) and offers `onResume` and `onClear`.
- On a phone the shelf is one row over the composer: the next message
  and how many more; pressed, it opens the manager, full screen. While a
  message is edited it is the shelf again.
- Its text is `labels`, with English defaults; `labels.queuedDetail`
  says, after the count, when they go ("sent when this turn ends").

### `composer-select`

A choice of one from the composer's toolbar: a mode, an agent, a
profile. The trigger says the choice; the items are a label, a line of
description, a detail at the end and a tick on the one chosen. It opens
over the composer, and on a phone (below `sm`, 640px) as a sheet from the
bottom with its `title` and Done. Arrow keys move, Enter, Space or a
click chooses and closes, and the focus goes back to the trigger.

```tsx
<InputGroupAddon align="block-end">
  <ComposerSelect value={mode} onValueChange={setMode}>
    <ComposerSelectTrigger aria-label={`Mode: ${label}`}>
      <ComposerSelectValue>{label}</ComposerSelectValue>
    </ComposerSelectTrigger>
    <ComposerSelectContent title="Mode">
      <ComposerSelectList aria-label="Mode">
        <ComposerSelectItem
          value="plan"
          description="Reads and plans; changes nothing."
          icon={<HugeiconsIcon icon={TaskDone01Icon} strokeWidth={2} />}
        >
          Plan
        </ComposerSelectItem>
      </ComposerSelectList>
    </ComposerSelectContent>
  </ComposerSelect>
</InputGroupAddon>
```

- A list with its own `value` and `onValueChange` stays open when one is
  chosen, e.g. on a page of a bigger picker; `onOpenChange` says why it
  closes (`"escape-key"`), so a picker with pages can take Escape back a
  page first. `ModelPicker` is built so.
- Of many items (a checkout of 160 branches), make the search's text the
  app's with `search` and `onSearchChange`. The app can then render a
  few items while it is empty and all of them while there is a search,
  with `searchFrom={0}` so the field is always shown. A `pinned` item is
  never filtered out and its label is not marked, so it can read the
  search: "New worktree fix-login". Enter chooses it when it comes
  first. Clear the search in the select's `onOpenChange` as it closes.
- For two to four choices always in view, use a `ToggleGroup` instead.

### `message-error`

Why a turn failed and what comes next, where its answer would have
gone. Its `status` is told by its mark and words: `waiting` (a clock and
a countdown to `retry.at`), `retrying` (a spinner), `exhausted` ("Gave
up after 5 attempts", from `retry.attempts`), `failed`, `cancelled`,
`unknown` (no answer came: it may have gone through, so the reader checks
before trying again). By default it is waiting while `retry.at` counts
down, then retrying, else failed. Nothing is tried on its own: at the
countdown's end it says it retries, and the app does, or the reader by
"Retry now" (`onRetry`). `action` holds the app's buttons, one or
several ("Check status", "Send again"); they wrap where narrow.

### `model-picker`

Picks a conversation's model and how hard it thinks, from a trigger in
the composer's toolbar. Models, their groups (e.g. providers), thinking
steps and purposes are the app's data; nothing about a provider is in
agentui.

```tsx
<InputGroupAddon align="block-end">
  <ModelPicker
    groups={[{ id: "a", label: "Provider A", icon, models: [{ id, label, detail: "200k · $15", badge, efforts, defaultEffort }] }]}
    recent={["opus", "sonnet"]} // ids, most recent first
    value={model}
    onValueChange={setModel}
    effort={effort} // null: the model's default
    onEffortChange={setEffort}
    purposes={[{ id: "images", label: "Images", icon: <HugeiconsIcon icon={Image01Icon} strokeWidth={2} />, value, models, settings, note }]}
    onPurposeChange={(purpose, model) => …}
    onPurposeSettingChange={(purpose, setting, value) => …}
    onManage={openSettings}
  />
  <ComposerSubmit className="ms-auto" />
</InputGroupAddon>
```

`showGroupIcon` puts the chosen model's group's `icon` before its name
in the trigger, where groups look alike (a provider's models once per
agent); without an icon, or without it, the trigger is as before.

- The trigger shows the model, its `badge` (the route it takes, e.g.
  "OpenRouter") and its step ("Opus 5.5 · High", "Opus 5.5 · Off"); a
  model without thinking, its name alone. With `value={null}`, or a
  `disabled` model, it says "Pick a model" after a warning sign. With
  `shortcut`, a tooltip over it says the popover's name and the key.
- A model's row is its name (its `badge` after it) and the tick; its
  `detail` shows on the highlighted row only, and is in every row's
  name for a screen reader.
- With `searchFrom` models or fewer (10 by default), and no
  `onCustomModel`, there is no search and no rail: one list of all of
  them under their groups' names, focused on the chosen model, ↑↓ and
  Enter to choose, ←→ the thinking. `searchFrom={0}` always searches.
- With more, and several groups, a rail beside the list has one entry per group,
  its `icon` and its name ("Recent" first when there are recent models),
  and the list shows the models of the one chosen, its first `groupLimit`
  and how many more; the two as tall as the taller of the rail and that
  list (up to 320px, then scrolled), the popover's bottom where it was
  as another group is chosen. Every row of the popover is 32px; under
  the list one section, with no lines inside, holds the thinking, the
  purposes, the app's rows and Manage models (`onManage`), the last row. It opens on the chosen model's group. The rail is a
  tablist controlling the list: ← from an empty search goes to it, ↑↓
  change the group, → or typing goes back to the search (mirrored right
  to left). On a phone (below `sm`) the popover is a sheet from the
  bottom, titled, with Done, and the groups are a row of tabs above the
  list.
- With one group, its models are directly in the list under its name,
  cut short at `groupLimit` with how many more too, and recent models
  show only while it is cut short.
- Typing in the search lists matches from every group under their
  groups' names (no group chosen in the rail meanwhile; cleared, the
  rail's group is back), and how many of all ("3 of 49").
- `EffortSlider` is the thinking steps, one row: its name, a `Slider` of
  named steps (its thumb says the step's name to screen readers, and
  "the default" after the model's default) with a dot for each, the
  chosen step's name, and, off the model's default, a button back to it
  ("Back to the default, Medium"); `note` and
  `warning` are lines under it. A model with `effortToggle` only turns
  thinking on or off: a switch, off its first step and on its second. It
  shows the selected model's `efforts`; a model without them has none.
  With one group, ←→ from the list change the step (with several, Tab
  reaches the slider). An `effort` the model does not have runs at its
  default, and a warning under the slider says so. It can be used on its
  own.
- The last row turns the popover to the purposes (images, video,
  speech…), each with the model it uses ("Not set" without one); a
  purpose's page lists its models and its `settings` for this
  conversation, each a row that opens its options. Escape goes back a
  page before it closes.
- A group's `section` (its heading in the rail, e.g. the source of a
  family's models) may have a mark before it: the section's first
  group's `sectionIcon`, e.g. a machine's OS. It stays text, said with
  the group's name ("Local · Claude").
- A model's `section` (e.g. its family, "Claude Opus") lists a group's
  models in runs under a heading each, in the order a section first
  comes, after those with none; a search lists matches by group alone.
- `customInput` (with `onCustomModel`) keeps a field at the bottom of
  the list, the pane's on a desktop however far it scrolls, for a model
  id not in it (`labels.customInput`); Enter or its button gives it to
  `onCustomModel`. Without it, a search that matches nothing offers the
  typed id as a row. `onCustomModel(id, { group, page })` says where it
  was typed: the group whose pane (or tab) it was under, none from the
  recent ones, a list of all or a search across groups; and the page,
  none for the main one.
- `pages` (`{ id, label, icon, detail, groups }`) are rows under the
  list, after the purposes, each opening a page of its own groups (rail,
  search, recent models among them) under a back header; Back or
  Escape returns. Its models are picked as the list's; the trigger names
  a model of any page. `onPageChange(id)` says a page opened, and
  `onPageChange(null)` that it was left, by Back or as the picker
  closes on it: e.g. to fetch its groups then. A page's `loading` says
  they are coming: "Refreshing models…" with a spinner, no empty panes,
  no "No models found".
- Its text is `labels`, with English defaults.

#### What cannot be used, and where the choice comes from

- A model that cannot be used now has a `disabledReason` ("Not in your
  plan"): it is disabled, and the reason is at its row's end, in its
  name too.
- A chosen model gone from the list (or disabled) stays chosen: the
  trigger keeps its name (`valueLabel` when the list no longer has it)
  with a warning, "Opus 4, not available", and a line over the list says
  it stays until the reader picks another. Nothing replaces it.
- `source` says where the chosen model comes from ("The project's
  default"), under the list; with `onPinnedChange`, a Pin or Unpin
  button by it. Return a promise to show "Saving…" until it settles; a
  rejection says it failed, the button there to try again.
- No models at all says "No models yet"; a search with none, "No models
  found". `error` (with `onRetry`) is a row under the list with Retry;
  what it has stays listed.

### `voice-mode`

A spoken conversation with the agent. The app runs the audio (a
realtime session, its own speech recognition and voice); the component
shows where it is and gives the reader mute and end.

```tsx
<VoiceMode
  state={state} // "connecting" | "listening" | "thinking" | "speaking"
  level={level} // 0 to 1: the reader's voice listening, the agent's speaking
  muted={muted}
  onMutedChange={setMuted}
  onInterrupt={stopSpeaking} // the orb, while the agent speaks, stops it
>
  <VoiceModeOrb />
  <VoiceModeStatus />
  <VoiceModeCaptions>
    {lines.map((line) => (
      <VoiceModeCaption
        key={line.id}
        speaker={line.speaker}
        interim={line.interim}
      >
        {line.text}
      </VoiceModeCaption>
    ))}
  </VoiceModeCaptions>
  <VoiceModeControls>
    <VoiceModeMute />
    <VoiceModeEnd onClick={end} />
  </VoiceModeControls>
</VoiceMode>
```

- `variant="full"` fills its place: a panel, a `Sheet` or a page on a
  phone. The orb (192px, 160px on a phone) and its status in the middle,
  the last three lines said under it, the latest at the foot, older ones
  fading out; the buttons at the foot, over the home indicator.
- `variant="bar"` is a 56px row in the composer's place, the
  conversation above it (the lines said as its messages): a small orb,
  the status (read out, not shown, on a phone), the latest line, its end
  kept in sight as it grows, the buttons.
- `level` can change every frame: it sets a CSS variable that the orb's
  rings and disc scale by. Muted or thinking, the rings rest; with less
  motion asked for, the orb is still and the status says it all.
- More buttons (captions on or off, a keyboard to type instead) are
  `VoiceModeButton`s, round, `pressed` for a toggle.

### `long-text`

A run of text without a space, a long address, base64, a hash, is laid
out as one word broken anywhere, and its layout grows with it: in WebKit
with its length, and in Chromium, kerned in the system font, with its
square (256 KiB of one letter took 3s a layout, the page frozen).
`Markdown` folds any run past 1,024 characters, not in code blocks:
its first 512, an ellipsis, "Show 261,632 more characters" (16,384 more
at a time) and a button to copy it whole; in a link, only its start.
Text shown as written folds the same with `LongText`, as
`ComposerMessage` does. Words, however many, are as they were.

| 256 KiB, laid out again (ms) | Chromium | WebKit | Firefox |
| ---------------------------- | -------- | ------ | ------- |
| One letter, before           | 2963     | 558    | 5       |
| Base64, before               | 17       | 762    | 30      |
| Either, folded               | < 1      | < 1    | ≤ 1     |

### `copy-button`

An icon button that copies a value, e.g. a reply.

```tsx
<CopyButton
  value={markdown}
  labels={{ copy: "Antwort kopieren", copied: "Kopiert" }}
/>
```

- For a while after, its name and its tooltip say "Copied" (pressed, the
  tooltip stays open to say so), and screen readers hear it. When the clipboard refuses, it says "Could not copy"
  (`labels.failed`) the same way; nothing claims a value was copied once
  it has changed (as an answer streams).
- It takes `Button`'s props; `variant` and `size` are `ghost` and
  `icon-sm` by default.
- In a `CodeBlock`, use its own `CodeBlockCopyButton`: it says "Could
  not copy" (`labels.failed`) the same way. Both, and the media viewer's
  Copy transcript (`labels.copyFailed`), fail without throwing on a page
  that has no clipboard (plain http on a local network is not a secure
  context).

### `qr-code`

A string as an SVG QR code, e.g. a one-time link for a phone to scan.

```tsx
<QrCode
  value={link}
  size={240}
  caption="Scan with your phone"
  labels={{ qrCode: "Pairing code" }}
/>
```

- One `<path>` for all modules, `shape-rendering: crispEdges`, a quiet
  zone of 4 modules inside `size` (px, 160 by default).
- `level` is the error correction, `L`, `M` (default), `Q` or `H`: more
  of it, a denser code. A link of 200 characters at `M` is 61 modules a
  side (69 with the quiet zone), so give it a `size` of 240 or more
  (3.5px a module) for a camera to read.
- It is `role="img"` named by `label`, or `labels.qrCode` ("QR code"); never
  the value, which may be a secret. `caption` is under the plate.
- The plate is white with black modules in the dark theme too: scanners
  need dark on light and many phone cameras fail on an inverted code, so
  it does not follow the theme.
- To let people copy the same link, put a `CopyButton` with the same
  value beside it, for those on the device that shows the code:

```tsx
<div className="flex flex-col items-center gap-3">
  <QrCode value={link} size={240} caption="Scan to pair" />
  <CopyButton value={link} variant="outline" labels={{ copy: "Copy link" }} />
</div>
```

### `media-gallery`

Media in a message: images, videos and recordings, in their order.

```tsx
<MediaGalleryProvider>
  {" "}
  {/* once, around a conversation: one plays at a time */}
  <MediaGallery
    items={[
      ...result.images.map((image) => ({
        src: image.url,
        alt: image.description,
        width: image.width, // if known: its place is kept
        height: image.height,
        thumbnail: image.thumbUrl, // a smaller copy: thumbnails, and till it loads
        srcSet: `${image.thumbUrl} 512w, ${image.url} ${image.width}w`, // the browser picks
        placeholder: thumbHashDataUrl, // drawn blurred till it loads
        crossOrigin: "use-credentials", // as the app's server needs
      })),
      {
        kind: "video", // or "audio"
        src: file.url,
        title: file.name,
        description: "Screen recording", // the app's words; its length follows
        width: 1280,
        height: 720,
        poster: file.thumbnail,
        captions: [{ src: file.vtt, label: "English", language: "en" }],
        transcript: file.transcript, // shown when asked for
        actions: (
          <Button variant="ghost" size="icon-xs" aria-label="Download">
            …
          </Button>
        ),
        mediaProps: { ref, onEnded }, // to the <video> or <audio>
      },
    ]}
  />
</MediaGalleryProvider>
```

Images an image model made, or is making, each with what it was made
with:

```tsx
<MediaGallery
  layout="flow" // each at its own shape, not thumbnails
  onOpen={(image) => openBeside(image)} // e.g. a MediaViewer; else its own viewer
  items={images.map((image) => ({
    id: image.id,
    src: image.url, // none while it is made: status "pending"
    status: image.failed ? "error" : undefined,
    alt: image.prompt,
    width: image.width, // the size asked for, while it is made
    height: image.height, // (or aspectRatio: 3 / 2)
    elapsed: image.url ? undefined : "8s", // the app updates it
    title: "gpt-image-2",
    description: "3:2 · 2K",
    end: "$0.06",
    actions: (
      <>
        <MediaGalleryAction label="Edit" onClick={…}><HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} /></MediaGalleryAction>
        <MediaGalleryAction label="Download" onClick={…}><HugeiconsIcon icon={Download01Icon} strokeWidth={2} /></MediaGalleryAction>
      </>
    ),
  }))}
/>
```

- Images: one is in a card as a video is, at its own shape no taller
  than 240px and no wider than the message (its card at least 240px
  wide, a narrower picture on grey in it), its size read as it loads
  where it is not given (square till then); more are square
  thumbnails, `max` of them (6), the last saying how many more ("+3",
  named "…, 3 more"), or each in its card with `layout="flow"`. Give the size of each, or the
  size asked for while it is made, so nothing moves when it arrives.
- Where an image is in its card, its `title` (its `alt` by default) is
  under it, then its `description` and `end` a shade lighter, and its
  actions beside them: the app's `actions` (`MediaGalleryAction`s, icon
  buttons named in a tooltip, as a video's; what they do is the app's),
  then "Copy image" (as PNG; an image of another origin needs CORS) and
  "Open in new tab", which every image has. Do not add your own copy.
- Each image opens a viewer of them all (or the app's `onOpen`), with
  copy and open beside its close button: the arrow keys and its buttons
  go through them, round from the last to
  the first, and it says where it is ("2 of 5"). Closing it returns
  focus to the image it was opened from.
- Images, videos and recordings have one `status`, shown the same way.
  `status="pending"` (or no `src`): being made, a placeholder of its
  shape (a video's `width` and `height` or `aspectRatio`, 16:9 by
  default; a recording's where its controls go) saying "Generating"
  (`labels.pending`) to screen readers once, shimmering (still where
  less motion is asked), its `elapsed` time on screen only.
  `status="deferred"`: not loaded until the reader asks, by a button
  with its `fileSize` ("Load image 2.4 MB", "Load video",
  "Load recording": `labels.load(kind)`) that calls `onLoadRequest`;
  the app then gives its `src`. `status="error"`, or one that cannot
  load: it says so, named by its `alt` or `title`. Images load as they
  near the viewport (`loading="lazy"`).
- A video is at its own shape in a black frame no taller than 400px,
  `media-viewer`'s controls over it; a recording is a card with the
  controls under its title. Around them, an `Attachment` card says what
  it is: its `title`, the app's `description` and its length (from
  `duration`, in seconds, until it has loaded its own). It loads its
  length and size (`preload="metadata"`) once it nears the viewport,
  the rest when played. One that cannot be played says so in place of
  its controls. Its `actions` are buttons or links (a download is
  `<a download>`), each a finger's size under a finger.
- One plays at a time in a gallery; across a conversation in a
  `MediaGalleryProvider`. The app controls one through `mediaProps`: a
  `ref` to the element, to go to a time (`ref.current.currentTime =
83`) when the reader clicks "1:23" in an answer, and its events
  (`onPlay`, `onEnded`).
- `labels` gives its words in other languages.

### `virtual-list`

A list too long to render whole, such as a workspace's files: it renders
the items near the view and a space for the rest. shadcn has the items
(`Item`) but nothing that leaves most of them out.

```tsx
const list = React.useRef<VirtualListActions>(null)

<VirtualList
  role="list"
  aria-label="Files"
  items={files}
  getKey={(file) => file.id}
  estimateSize={56}             // px, before an item is measured
  actionsRef={list}             // list.current.scrollToKey(id), .scrollToOffset(0)
  className="h-80"              // the list scrolls: give it a height
  renderItem={(file, index) => (
    <Item role="listitem" aria-setsize={files.length} aria-posinset={index + 1}>
      …
    </Item>
  )}
/>
```

- `VirtualList` is the scrolling element; props such as `role`,
  `aria-label` and `className` go to it. It needs a height, or a maximum
  height, from its `className` or its parent.
- Items are measured as they render and again whenever their height
  changes, for their content, width or font size, so they can be of any
  height; `estimateSize` only places the ones not yet rendered. Heights
  belong to keys, so `getKey` must give each item a key that stays the
  same while it is in the list (an id, not the index). It may be written
  inline, but must depend only on the item: the list reads it again when
  `items` changes, not when only `getKey` does.
- While the list is hidden (`display: none` on it or a parent) its
  heights and its place are kept.
- `scrollToKey(key, { align })` scrolls to an item, rendered or not, and
  returns `false` if no item has that key; `align` is `"auto"` (as little
  as needed, the default), `"start"`, `"center"` or `"end"`. Use it for a
  keyboard cursor, a link to an item, or `scrollToOffset(0)` to go back
  to the top when the list changes to another folder or search.
- When items are removed, e.g. by a filter, the view stays on items.
- Only the rendered items are in the DOM, so:
  - a find in the page cannot see the others; give the list a filter;
  - set `aria-setsize` and `aria-posinset` on items whose role allows
    them (`listitem`, `option`, `row` in a treegrid…), so a screen reader
    tells their place in the whole list;
  - a list whose items cannot take focus needs `tabIndex={0}`, so it can
    be scrolled by keyboard; with `aria-activedescendant` (a listbox),
    keep the active item rendered by scrolling to it with `scrollToKey`.
- For a grid, such as icons, make each item a row of tiles: split the
  items into rows by how many fit.
- The conversation is not a `VirtualList`: it is `MessageScroller`.

### `virtual-grid`

Items in columns, too many to render all: a library of files, a file
picker. `grid` lays them in rows; `masonry` puts each in the shortest
column at its own height, so a long screenshot is whole, not cut to a
square.

```tsx
const grid = React.useRef<VirtualGridActions>(null)

<VirtualGrid
  role="list"
  aria-label="Files"
  layout="masonry"
  items={files}
  getKey={(file) => file.id}
  minItemWidth={160}                     // as many columns as fit
  gap={8}
  padding={8}
  estimateHeight={(file, width) =>       // before it is measured
    file.aspect ? width / file.aspect + 40 : 136
  }
  onEndReached={loadNextPage}            // once for each length
  actionsRef={grid}                      // scrollToKey, focusKey
  renderItem={(file) => (
    <div role="listitem"><FileCard file={file} /></div>
  )}
/>
```

- Each item is as wide as its column and as tall as it renders: heights
  are measured (fractions too) and laid out again as they change, when
  the width changes the columns, a font size, an image loads. A grid's
  row is as tall as its tallest item. `estimateHeight` is a first guess
  (by default square): from a picture's known aspect ratio it is exact;
  with none, the card shows a box of its own, not a guessed shape.
- Only the items near the view are rendered (`overscan`, 400px beyond
  it). Hidden and shown again, it keeps its heights and its place;
  filtered shorter, it shows items, not empty space.
- `onEndReached` is called once for each length of `items` when the
  reader is within `endThreshold` (20) items of the end: load the next
  page there; a new `endKey` (e.g. the first page loaded again, as many
  items) asks again, its heights and place kept. Loading, filtering and
  selecting are the app's.
- The arrow keys move the focus from item to item by where they are
  (right and left along the order; up and down a grid's column, or in
  masonry the item above or below in its column), Home and End to the
  first and last: each scrolled to, rendered, then its first control
  focused, or an element with a `tabIndex` of -1 (one tab stop for all,
  as `files-viewer` has), or the item. Not from a text field. `focusKey(key)` does the
  same; `scrollToKey(key, { align })` only scrolls.
- `fullWidth(item)` puts an item on a row of its own, as wide as the
  grid, e.g. a group's heading: the next items start a new row; the
  arrow keys pass it by (up and down in a grid go to the nearest item in
  the next row).
- `skip(item)`: the arrow keys, Home and End pass it by, e.g. a
  disabled item; it is shown as the rest.
- A one-column list is `virtual-list`'s.

### `table-preview`

A table of the app's to look at, copy and download, e.g. a CSV file or a
table in a document. A table in a reply's Markdown is the Markdown
renderer's; this one is for a table the app has as rows.

```tsx
<TablePreview
  title="deploys.csv" // the full-screen view's title
  fileName="deploys" // the downloads' name
  columns={["Region", "Deploys"]}
  rows={[
    ["eu-west", "42"],
    ["us-east", "17"],
  ]}
  renderCell={(value) => (
    // e.g. a search's marks
    <SearchHighlight terms={[query]}>{value}</SearchHighlight>
  )}
  onDownload={(file, format) => save(file)} // by default, a file
/>
```

- In a code block's frame, its header the same: its `title`, its size
  ("12 rows · 3 columns", `labels.size`), "Copy as text" (tab-separated,
  a cell with a tab, a quote or a line quoted, as a spreadsheet takes
  it; it says when the clipboard refuses),
  "Download" (CSV with CRLF lines and RFC 4180 quoting, or Markdown with
  pipes escaped and lines as `<br>`), and "Full screen".
- It scrolls sideways where it is wider than its place, by keyboard too
  (a region, named by its `title`); long cells wrap at 20rem.
- Full screen, a dialog: its title and size, the same buttons, the focus
  on the table to scroll it by keys, the heading row kept at the top;
  closed, the focus back on its button.
- No rows: it says "No data". `tableToTsv`, `tableToCsv` and
  `tableToMarkdown` are exported for the app's own use.

### `diff-block`

A diff in a reply or a tool's details, from its unified diff's text as
`git diff`, `git show`, `git format-patch` or `diff -u` write it: a code
block for each file.

```tsx
<DiffBlock diff={patch} />                     // the text
<DiffBlock diff={parseUnifiedDiff(patch)} />   // or what was read from it
<DiffBlock
  diff={files}
  size="sm"
  wrap
  lines={12}                                    // each file folds past 12
  actions={(file) => <CodeBlockCopyButton value={…} />}   // in each header
/>
```

- `parseUnifiedDiff(text)` gives the files: `{ oldPath, newPath, name,
status, binary, oldMode?, newMode?, similarity?, hunks, added, removed }`,
  `status` added, deleted, modified, renamed or copied (a path is null on
  the side it does not exist); each hunk `{ header, oldStart, oldLines,
newStart, newLines, section?, lines }`, each line `{ type, text,
oldLine?, newLine?, noNewline? }` (`type` context, added or removed;
  `noNewline` for "\ No newline at end of file"). Quoted paths and
  `diff -u`'s timestamps are read; a commit's message and a patch's mail
  around it are left out. Combined diffs (`diff --cc`) are not read.
- Each file's header: its name ("old → new" renamed or copied,
  `labels.moved`) and what it adds and removes ("+3 −1",
  `labels.changes`, `DiffStat`), then the app's `actions`. Each hunk
  under its `@@` line (`DiffHunkHeader`); a binary file and one with no
  lines changed (a rename, a mode) say so (`labels.binary`,
  `labels.unchanged`).
- With `lines`, each file longer than that folds in its own block, as
  `CodeBlock`'s `lines`; its @@ lines are not counted, and `labels`
  takes the fold's words too (`more`, `less`, `lines`, `collapse`).
  `AgentTurnChanges` passes `lines` to a single file's diff; a card of
  several files stays as it is. It draws a 1.5px dotted border-colour rule
  before the card, with 16px above and below the rule; callers add no spacing.
- `DiffFileContent` is one file's lines alone, a `CodeBlockContent`, e.g.
  under the app's own heading, as the browser's `diff` page has it;
  `diffInset` on that heading puts it in line with the code (the lines
  start a gutter in, clear of their signs). `diffTotals(files)` adds up
  what they add and remove.
  `touch` hides the numbers and hunk headers on coarse pointers, keeping
  signs in their own column (32px to the text on phones, 34px from 640px).
  The browser diff page uses it and shows a file icon, name and
  `labels.diff.unified` ("Unified") above the code, even with a file list.
  Its touch tabs have equal segments: across the bar on phones, within
  a content-wide group from 640px.

### `usage-meter`

How much of something is used: a session's tokens, a day's requests,
storage. A meter (`role="meter"`), a ring or a bar in the foreground's
greys; every word is the app's.

```tsx
<UsageMeter value={82} max={100} label="Requests today" valueText="82 of 100">
  82/100                                         // shown after it
</UsageMeter>

<UsageMeterBreakdown                             // a button that opens the breakdown
  value={62_000}
  max={200_000}
  label="Tokens"                                 // its name, the popover's title
  valueText="62k of 200k"                        // said, and under the title
  rows={[
    { label: "Instructions", value: "3.1k", amount: 3_100 },
    { label: "Messages", value: "41.2k", amount: 41_200 },
    { label: "Free", value: "138k" },            // no amount: a row of words
  ]}
  footer="Older messages are summarised near the limit."
>
  31%
</UsageMeterBreakdown>
```

- `variant`: `ring` (16px, e.g. beside the composer's buttons) or
  `bar`. `min` and `max` are 0 and 100 by default; `valueText` is what a
  screen reader says (by default a percentage).
- `rings`: several meters as concentric rings in the ring's 16px,
  outermost first, each a `UsageMeterListEntry` (`label`, `value`,
  `valueText`, `tone`, `detail`), e.g. a plan's limits, the week's
  outside and five hours' inside. Two at most (1.5px strokes 1.5px
  apart; a third blurs at 16px on a 1x screen, so more are neither
  drawn nor said: show them in a `UsageMeterList`). `UsageMeter` is
  then a group named by `label`, each ring a meter, its label and value
  said; `UsageMeterGraphic` takes `rings` too. `UsageMeterBreakdown`
  with `rings` is named by `label` and each ring ("Plan limits: Weekly:
  41% used, 5 hours: 78% used"), then its `children`; its popover shows
  them as a `UsageMeterList` in place of the bar, then `rows` (optional
  here), and `valueText` is optional.

  ```tsx
  <UsageMeterBreakdown
    label="Plan limits"
    rings={[
      { label: "Weekly", value: 41, valueText: "41% used", detail: "Resets Mon 09:00" },
      { label: "5 hours", value: 78, valueText: "78% used", tone: "warning" },
    ]}
  />
  ```

- `UsageMeterBreakdown`: a ghost button with the meter and `children`,
  named by `label` and them ("Tokens: 31%"), or by `label` and
  `valueText` with none. Its popover: `title` (by default `label`),
  `description` (by default `valueText`) at the title's end, a bar of
  the whole, the rows (`label` and `value`, as the app words them, in
  grey) and `footer`. Rows with an `amount` (on the meter's scale) are
  parts of the bar, each a grey of its own, in the rows' order; a row's
  `separator` starts a group under a line (e.g. cost after context).
  `side` and `align` place it (above, at the end, by default); in a
  composer's toolbar it opens above the composer. `open`,
  `defaultOpen` and `onOpenChange` are the popover's: a footer button
  that compacts closes it by setting `open` to false.
- A quota chip is a `Badge` with a `UsageMeter` in it:

  ```tsx
  <Badge variant="outline">
    <UsageMeter
      value={82}
      variant="bar"
      label="Requests today"
      valueText="82 of 100"
    >
      82/100
    </UsageMeter>
  </Badge>
  ```

  To show its breakdown too, use `UsageMeterBreakdown` with the same
  words in its place; a chip that only says a number is a `Badge`.

### `usage-summary`

What a run used and cost, by unit. Amounts of different units (dollars,
credits, searches) are never added: the app adds what it can, by unit,
and passes each total. Each amount says how far it is to be trusted, in
words: `estimated` (≈ and "Estimated"), `partial`, `unreconciled`,
`unpriced` ("No price"); one not known (`value: null`) reads "Unknown",
never 0.

```tsx
<UsageSummary
  totals={[{ value: "$1.16", unit: "USD", completeness: "estimated" }]}
  running={false} // "So far" while the run goes on
  missing={["Web search"]} // used, with no price
>
  <UsageSummaryRows rows={rows} /> // label, value, unit, completeness, source,
  reason
</UsageSummary>
```

A row with a `source` or `reason` has a button that explains it, a
popover, so touch reaches it too. `UsageSummaryRows` alone goes in an
`AgentTurnInfo`'s `details`.

### `connection`

Connections to services, a model provider's or a tool server's, read,
not managed: no editing, no secrets. A list beside one's details:

```tsx
<ConnectionList loading={loading} error={error} onRetry={refetch} empty={query && "No match"}>
  {items.map((item) => (
    <ConnectionListItem
      key={item.id}
      label={item.label}
      status={item.enabled ? item.status : "disabled"} // available, rejected, unknown, disabled
      checkedAt="2h ago"
      stale={isOld(item.checkedAt)}
      reason={item.reason}
      selected={item.id === selectedId}
      onSelect={() => select(item.id)}
    />
  ))}
</ConnectionList>

<ConnectionDetails state={selected ? "ready" : "none"}>
  <ConnectionDetailsHeader label={…} status={…} checkedAt={…} reason={…} />
  <ConnectionNotice title="Enter its key again" action={<Button nativeButton={false} render={<a href={guide} />}>How to</Button>} />
  <ConnectionDetailsField label="Addresses">
    <ConnectionTarget>{url}</ConnectionTarget>
  </ConnectionDetailsField>
  <ConnectionDetailsField label="Credential">
    <ConnectionCredential>API key sk-…7f3a</ConnectionCredential>
  </ConnectionDetailsField>
</ConnectionDetails>
```

- A status is told by its mark's shape (a dot, a diamond, a ring, a
  bar) and its word, never its colour alone; a check too old to go by
  says "May be out of date".
- A long name is one line in the list, whole in its details. An address
  is one line too, with a button that shows it whole where it is cut
  short, and one that copies it: pass only what is not secret.
- `ConnectionCredential` shows the app's summary, already masked. There
  is no way to show or enter a secret here.
- Filtering and pages are the app's: an `Input` over the list and
  `Pagination` under it. It fetches nothing.

### `code-viewer`

A whole file's code to read, e.g. in the `browser`'s panel: the code
block, with what an editor's reader needs. A code block in a reply stays
`CodeBlock`.

```tsx
<CodeViewer
  title="src/images.ts"          // its header; its extension its language
  code={text}
  wrap={wrap}                    // the app's to keep, e.g. for every file
  onWrapChange={setWrap}
  lineVariant={(line) => (changed.has(line) ? "added" : undefined)}
  actions={<Button …/>}          // the app's, before its own
/>
```

- Coloured, its lines numbered; folding by indentation in any language
  (a button at each fold's first line, the numbers kept); none past
  20,000 lines. `foldRanges(lines)` is exported.
- Its buttons: wrap, format (for JSON that is not formatted already;
  `formatJson` is exported), find, copy (what is shown).
- Find: Ctrl+F or ⌘F while the focus is in it, not the page's or the
  app's; Enter and Shift+Enter, or the arrows, to the next and previous
  match; "3 of 12", each match counted, marked in the coloured code, the
  one gone to filled and scrolled to, a fold it is in opened; `:120` goes
  to line 120; Escape closes it, the focus back on the code.
- `lineVariant` is the app's look for a line (`added`, `removed`,
  `highlighted`), of the code as given: not while it shows formatted.
- Every word is in `labels`.

### `tool-call-data`

A tool call's input or output, for a call the app has no view of its own
for (e.g. an MCP tool's), in the call's details: a JSON object read as
its fields, not one long line of JSON.

```tsx
const name = mcpToolName(call.tool) // mcp__github__create_issue: github, create_issue
const title = name ? `${name.tool} · ${name.server}` : call.tool

<ToolCallData title="Input" value={call.input} />
<ToolCallData
  title="Output"
  value={call.output}            // text, JSON or not
  language="ansi"                // for text that is not a JSON object
  note={truncated && "Truncated"}
  actions={<Button …/>}          // the app's, before its own
/>
```

- A JSON object, as text or a value: each field its key beside its value
  (over it where narrow). Text is text, wrapped, its lines kept, cut to 6
  lines over "Show all"; a number, true, false or null is code; an
  object, an array or text that is one in JSON is a formatted JSON
  block, folding past 8 lines.
- Anything else is text in `language`, folding past 12 lines; plain
  text and JSON wrap, other languages (a terminal's) do not.
- Its buttons: a toggle to the JSON as it came, formatted (`raw`,
  `defaultRaw`, `onRawChange`), and copy, which copies it as it came.
- Every word is in `labels`.

### `search-highlight`

Where a search's terms are, marked: in text, or a node of text such as a
line of coloured code (a match across its elements is marked in each).
Matched as the reader would find them: any case, full-width or not, a
letter and its accents one (`textMatches`, at the text's own places).
Each match is a soft tint, the current one filled.

```tsx
<SearchHighlight terms={[query]} current={0}>
  {title}
</SearchHighlight>
```

`markMatches(node, matches, mark)` marks a node by the app's own
matches, e.g. ones the server found.

### `auth-page`

A sign-in or sign-up page: the app gives its form and words, no styles.

```tsx
<AuthPage
  title="Sign in"
  description="Use your work email."
  brand={<Logo />}
  switchTo={
    <>
      No account? <a href="/sign-up">Sign up</a>
    </>
  }
  aside={{ title: "Agents that finish the job", description: "…" }}
  terms={
    <>
      By continuing you agree to the <a href="/terms">Terms</a>.
    </>
  }
>
  <SignInForm />
</AuthPage>
```

- Wide (48rem and up, by its own width): two halves, the `aside` on the
  muted grey at the start (the brand at the top, its title, an h2, and
  words at the foot, `children` for more), the form on the page's colour
  at the end, its title an h1 (`text-display`); `switchTo` at the top's
  end, on the brand's line; `terms` at the foot.
- Narrow: the form on a card on the grey, the brand and `switchTo` above
  it, the terms under it. The aside shows there only with
  `asideOnNarrow`.

### `aspect-ratio-icon`

A shape's aspect ratio as an icon, beside its text in a choice of an
image's or video's size: a frame of that shape, its long side the icon's.
It reads "16:9", "16/9", "16x9" or a number (width over height); one it
cannot read, such as "auto", is a dashed square. It is an icon as
Hugeicons' are, so it takes their size and colour in a `ToggleGroupItem`,
`SelectItem` or `DropdownMenuItem`, and the ratio's text names it.

```tsx
<ToggleGroupItem value="16:9">
  <AspectRatioIcon ratio="16:9" />
  16:9
</ToggleGroupItem>
```

### `status-mark`

A status as a small mark, such as a conversation's, a connection's or a
task's: a dot in its tone's colour, or a spinner while it is `busy`
(still where the reader asks for less motion). A `warning` is a ring
and a `destructive` a diamond, so they are told apart from the dots by
shape, not colour alone. Its `label` names it for screen readers, so a
row ending in one is named "GitHub Connected", and shows in a tooltip
while the pointer is on the mark or the keyboard on its row (the
tooltip is mounted only then: a list of marks costs no more). Where the
status should be read on screen too, use a `Badge` with the status
colours instead.

```tsx
<StatusMark tone="success" label="Connected" />
<StatusMark busy label="Syncing" />
```

Tones: `neutral`, `info`, `success`, `warning`, `destructive`. The app
maps its own states to them, as `agent-app` does a conversation's.

### `use-fold`

Whether a part of a conversation is open, by the app's rule until the
reader decides:

```tsx
;<FoldProvider> // once, around the conversation …</FoldProvider>

function ToolCall({ call }) {
  const [open, setOpen] = useFold(call.id, call.status !== "done")
  return (
    <TraceCollapsible open={open} onOpenChange={setOpen}>
      …
    </TraceCollapsible>
  )
}
```

- The rule is a value, not an effect: `call.status !== "done"` opens it
  while it runs and closes it when it is done, with nothing to call.
- Once the reader opens or closes a part, the rule changes nothing for
  it: a step closed while it runs stays closed.
- `FoldProvider` keeps the choices by key, so a message that unmounts
  (out of the window of messages) is as the reader left it when it
  mounts again. Keys are the app's: an id that stays the same, with a
  suffix for each part of it (`${turn.id}:work`, `${message.id}:clamp`).
- To keep choices across reloads, pass `defaultValue` and save what
  `onValueChange` gives (e.g. in `sessionStorage`).
- Without a `FoldProvider`, a choice lasts as long as the component.
- `useSetFold()` opens or closes a part by its key as the reader would,
  e.g. to show a search's match: `setFold(key, true)` for each fold it
  is in.

`FoldFindable` provides whether a conversation find is open;
`useFoldFindable()` returns that boolean (false without a provider).
While it is open, a closed fold renders `FoldFindText` where its content
goes: what the content says, as one plain text read from the app's data
(`text`, a function read only then), hidden until found. Its
`beforematch` calls `onFound`, which opens the fold through its `useFold`
setter (a reader's choice), and the content takes the text's place. The
closed content itself is not mounted: a find over 200 turns of 30 folded
steps costs about 7MB and 400 DOM nodes to open, not 300MB and 220,000.

### `clamp`

Content cut to `lines` lines (6 by default), fading out, with a row
under it: "Show all", how many lines and words it has ("38 lines ·
412 words", `labels.lines(lines, words)`), and the app's `actions`.
`user-message` is it in a bubble; use it directly for other long text.

```tsx
const [open, setOpen] = useFold(`${message.id}:clamp`, false)

<Clamp open={open} onOpenChange={setOpen} title="Your message"
  actions={<CopyButton value={message.text} />}>
  {message.text}
</Clamp>
```

- The row is there only when there are more lines; lines are counted
  as the reader sees them, wrapped lines included. `labels` gives its
  text in other languages:
  ``{ more: "Alles anzeigen", less: "Einklappen", lines: (n) => `${n} Zeilen insgesamt`, collapse: "Einklappen" }``.
- Open and scrolled past its start, a bar sticks to the top of what
  scrolls: `title`, how many lines, how far the reader is, and
  "Collapse", which closes it and brings its start back into view. The
  bar spans the scroller's width, not the clamp's, on the page's colour
  with what passes under it blurred. It sticks inside its nearest
  ancestor that is not clipped: no `overflow: hidden` between it and the
  scroller (`user-message` takes that off its bubble). The surface it is
  on sets `--clamp-muted` (the count's colour; by default the text's
  own).
- Its buttons are a tint of the text's color, so they suit any `Bubble`
  variant.
- All of the content stays in the page, for screen readers, copying and
  find in the page; focus moving into the cut-off part (Tab to a link)
  opens it.
- A bubbling `revealmatch` CustomEvent with `detail.range` opens the clamp
  when that range extends below its cut, through `onOpenChange`.
- For output in a `CodeBlock`, give `CodeBlockContent` a maximum height
  instead, so it scrolls.

### `user-message`

A message the user sent: `UserMessage` (a `Message` at the end of the
line) with its parts. For very long pasted text, use Attachment's
`variant="filled"`: a muted, borderless 44px chip with an 8px corner,
a 32px icon tile and a regular-weight title at the named `text-2sm` step
(13px). `variant="tile"` is a reusable 64px square image tile for a composer,
gallery or sent message: the image covers the bordered, `rounded-lg` surface,
the name and status stay available to screen readers, and corner actions show
on hover or focus, always on touch or error. Tiles snap in an `AttachmentGroup`
that scrolls sideways. The default attachment keeps its bordered card styling.
Attachment focus rings appear only on keyboard focus.
Each user message starts with a
screen-reader heading naming its author (`labels.author`, "You"), an h3
by default (`headingLevel`), so readers move message to message by
heading.

```tsx
<UserMessage>
  {message.queued && (
    <UserMessageHeader>
      <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} />
      Sent from queue
    </UserMessageHeader>
  )}
  {message.pastes.map((paste) => (
    // too long for a bubble
    <Attachment key={paste.id} variant="filled" size="sm" className="self-end">
      <AttachmentMedia>
        <HugeiconsIcon icon={TextIcon} strokeWidth={2} />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>Pasted text</AttachmentTitle>
        <AttachmentDescription>
          4,812 lines · 212 KB · log
        </AttachmentDescription>
      </AttachmentContent>
      <AttachmentTrigger
        aria-label="Open Pasted text"
        onClick={() => openInPanel(paste)}
      />
    </Attachment>
  ))}
  <UserMessageText
    open={open}
    onOpenChange={setOpen}
    onOpen={() => setReading(message)}
    actions={<CopyButton value={text} />}
  >
    {parts} // text and MessageMentions
  </UserMessageText>
  <UserMessageFooter>
    <span>{message.edited ? "Edited · 12:03" : "12:03"}</span>
    <UserMessageAction label="Edit" onClick={edit}>
      <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} />
    </UserMessageAction>
    <CopyButton value={text} />
  </UserMessageFooter>
</UserMessage>
```

- `UserMessageText` is a muted `Bubble` with a `clamp` (6 lines). Its
  row has the app's `actions` and, with `onOpen`, a button that opens
  the message whole: a `message-reader`, or a phone's full screen. Open
  and scrolled past, its bar says "Your message" (`labels.title`).
- Text too long for a message (a log thousands of lines long; the
  composer's `pasteAsFile`) is an `Attachment` over the bubble that
  opens it in the app's panel (e.g. a `code-viewer` in the `browser`);
  the bubble keeps only what the user wrote.
- `MessageMention` is a file, an image or a link in its text, as the
  composer showed it: an icon or a thumbnail (`<img alt="">`), a
  `MessageMentionLabel` and a `detail` ("12 pages"); with `onClick` it
  is a button, e.g. opening it beside the conversation.
- `MessageCommand` is a command in its text (`/review`), the composer's
  `/` chip in monospace; what follows it is the message's.
- A message that is only a command (`/compact`, `/clear`) is an order to
  the app, not words to the model: a `UserMessageCommand` in place of
  `UserMessageText`, a quiet monospace line on a hairline, no bubble.
  What it did follows as the app's own, e.g. a `MessageDivider`
  "Context compacted". Which text is a command is the app's to say.
- `UserMessageFooter` shows while the pointer is on the message or focus
  is in it, and always on touch screens; `UserMessageAction` is an icon
  button named by its `label`, in a tooltip.

A message someone else wrote in the user's place (another agent, a
subagent's report, an automation, the system) takes `from`: an optional
icon, a label and its text as `summary`. It starts folded to one row, so
the user's own messages are easy to find: the icon, the label, the
summary's first non-empty line and a chevron, a button opening it whole; the label also names its
screen-reader heading. Opening the row shows all children, kept mounted while
folded. `defaultOpen` starts it open; `open` and `onOpenChange` control it.
These props have no effect without `from`.

```tsx
<UserMessage
  from={{
    icon: <HugeiconsIcon icon={AiBrain01Icon} strokeWidth={2} />,
    label: "Subagent",
    summary: report,
  }}
>
  <UserMessageText>{report}</UserMessageText>
  <UserMessageFooter>
    <span>12:03</span>
    <CopyButton value={report} />
  </UserMessageFooter>
</UserMessage>
```

### `message-outline`

A long answer with its outline, so the reader knows where they are.

```tsx
<MessageOutline onOpen={() => setReading(turn)}>
  <Markdown>{answer}</Markdown>
</MessageOutline>
```

- It shows once the answer is `minScreens` views tall (3) and has two
  headings or more (`h1`–`h4`, not the footnotes'). Where there is room
  right of the message, in the element that scrolls it, the outline is
  there, sticking to the top: the section being read marked, those read
  darker, how far the reader is, buttons to the previous and next
  section and, with `onOpen`, one that opens a `message-reader`.
  Without room it is a button sticking to the top ("Upgrade 3 / 7"), on
  a band of the page's colour (`bg-background`) so the text scrolling
  past doesn't show round it, that opens the same outline. `side`
  forces one or the other.
- While more than a view of it is below, "Jump to end · 4 screens" sticks
  to the bottom of the view.
- A heading chosen scrolls into view (smoothly, unless the reader asks
  for less motion) and takes focus. Markdown headings keep clear of a
  bar 4rem tall over them (`scroll-mt-16`).
- Leave room right of a long answer for it (about 15rem) where the
  window is wide, e.g. by centring a narrower conversation column.
- Wrap every answer in it: until an answer has two headings it costs no
  layout (it only watches the answer's DOM), and it follows the scroll
  only once the answer is `minScreens` views tall.
- `useMessageOutline(ref, { minScreens })` and `MessageOutlineNav` are
  its parts, for an outline elsewhere (the reader uses them).

### `conversation-minimap`

A map of a long conversation, inside `MessageScrollerProvider` only: it
uses this registry's scroller hooks.

```tsx
<MessageScroller>
  <MessageScrollerViewport>…</MessageScrollerViewport>
  <ConversationMinimap
    items={turns.map((turn) => ({ id: turn.userMessageId, label: turn.text }))}
  />
  <MessageScrollerButton />
</MessageScroller>
```

- One tick per supplied user message or app mark. The ticks fall off as
  a dock's icons: the one being read (`aria-current`) is the longest
  (24px) and darkest, each row further a step shorter and lighter (18,
  14, 11px), and from the fifth row on they are all short and faint
  (8px). Under the pointer the falloff centres on the row pointed at,
  and on the focused one from the keyboard; it returns to the current
  one as they leave. A section or a mark is a step behind a turn at the
  same distance. Every tick (and a failed turn's diamond) starts at the
  rail's outer edge, its `side`, and grows towards the content. `resting="quiet"` halves the lengths and greys the
  ticks until the pointer or focus is on it. The first non-empty line of
  `label` names the tick and its tooltip. `labels` supplies the
  navigation's words.
- The ticks are one Tab stop. ArrowUp/ArrowDown and Home/End move focus
  without scrolling; click, Enter or Space jumps instantly to that turn.
  Previous and next turn buttons jump from the turn being read.
- `kind` is `"message"` by default, `"mark"` for a shorter tick, or
  `"error"` for a graphite diamond, such as a failed turn. Error names and
  tooltips start with `labels.failed` ("Failed" by default).
- `onSelect(id, scrolled)` runs after a jump is attempted. With `scrolled`
  false, the app can load earlier messages that are not rendered yet.
- Hidden with fewer than two items, when the conversation fits, on touch
  screens and in the agent-app's phone layout.
- It shows only where the margin beside an `AgentAppColumn` has room.
  Below a pinned `ConversationDetails` card, it starts 12px below the card
  and hides when too little height is left. Without a column, it assumes room.

### `message-reader`

A message to read on its own, over the conversation: what ⤢ on a long
message or answer opens.

```tsx
<MessageReader
  open={reading !== null}
  onOpenChange={(open) => !open && setReading(null)}
  title="Release notes for v0.1.9"
  description="Assistant · 2,140 words · 9 min"
  actions={
    <>
      <CopyButton value={text} />
      <AgentTurnAction label="Branch">…</AgentTurnAction>
    </>
  }
>
  <Markdown>{text}</Markdown>
</MessageReader>
```

- Its outline is beside the text where the dialog is wide enough
  (48rem, a container query, not the window's width), how far the reader
  is along its top, and its text at a reading size (15px, on a phone
  16px). Ctrl or ⌘ F searches its text alone; Enter and Shift+Enter go
  through the matches, drawn with the CSS Custom Highlight API (where a
  browser lacks it, matches are found and scrolled to, not drawn).
- On a phone (`useIsMobile`) it is the whole screen: back, the title,
  the text, and a bar of the outline, search, how far and the `actions`.
- `menu` is the app's ⋯ (e.g. a `DropdownMenu`) at the header's end:
  before close, and on a phone opposite back, as big as it.
- Escape or back closes it, and focus returns to what opened it.
- Very long pasted text and logs go to the app's panel (a `code-viewer`
  in the `browser`), not here.

### `conversation-find`

Find in the whole mounted conversation, including folded work, details,
clamped messages, folded code and messages skipped by `content-visibility`.

```tsx
<MessageScrollerProvider>
  <FoldProvider>
    <ConversationFind>
      <MessageScroller className="h-96">
        <MessageScrollerViewport>
          <MessageScrollerContent>{messages}</MessageScrollerContent>
        </MessageScrollerViewport>
        <ConversationFindBar />
      </MessageScroller>
    </ConversationFind>
  </FoldProvider>
</MessageScrollerProvider>
```

Ctrl/⌘F bubbling inside the root opens the bar and selects its query.
Enter and Shift+Enter wrap through matches; Escape or Close find closes
it and returns focus to the element focused before opening (or the
viewport if that element is gone). The query is kept. An app that wants
a global shortcut drives `open` and `onOpenChange` itself.
`useConversationFind()` exposes open/setOpen, query/setQuery, total,
current (an index, or -1), step and inputRef for the app's controls.

All words are labels. For example:

```tsx
<ConversationFindBar
  labels={{
    find: "Rechercher dans la conversation",
    previous: "Résultat précédent",
    next: "Résultat suivant",
    close: "Fermer la recherche",
    count: (current, total) => `${current} sur ${total}`,
    none: "Aucun résultat",
  }}
/>
```

Closed folds that unmount their content render a `FoldFindText` of it
while the find is open (see `use-fold`): its plain text, hidden until
found. `revealMatch(range)` dispatches `beforematch` to the hidden ancestors
of a match, outermost first, as the browser's own find in the page does;
the fold opens, its content takes the text's place, and the find goes to
the same match there (the same count of matches into the fold), a fold
in a fold a frame or two later. AgentTurn already does this for its
work, runs, steps, superseded attempts and a command's earlier output
lines. A fold's text is read from data, so a match in it that its
content does not render (e.g. a call's words the app replaced) lands on
the nearest one there. Deferred steps are not requested.

Parts that clip text instead listen for a bubbling `revealmatch`
CustomEvent on their content, with `detail.range`, and open if necessary.
Clamp already does this. Apps can use these two contracts for their own
folds. Search skips the bar, hidden content other than until-found,
aria-hidden, inert, sr-only, scripts, styles and form fields.

Matches are CSS Custom Highlights in greys, up to 1000 (then "1 of
1000+", `labels.count(current, total, more)`), so a letter typed alone
in a long conversation does not block typing. Where `CSS.highlights` is
missing, count, navigation, reveal and instant scrolling still work,
without drawing highlights. Streaming text is re-searched at most once
per animation frame, retaining the current match when possible; only
going to a match (typing, Enter, the buttons) scrolls the view.
Messages the app has not mounted (a window of messages or “load earlier”)
and a turn's steps not loaded yet (`steps="deferred"`) are out of scope.

### `todo-list`

A list of things to do, such as an agent's plan: flat in the
conversation (a 1px border, no shadow), its title and how many are done,
then each item, the one in progress in bold with a spinner, those done
struck through.

```tsx
<TodoList
  title="Plan"
  items={plan.map((step) => ({
    id: step.id,
    title: step.text,
    status: step.state, // "pending" | "running" | "done"
  }))}
/>
```

- In an `agent-turn`, a plan the agent shows the reader is a `content`
  part; one it updates as it goes is re-rendered with the new statuses.
- `labels` gives "2 of 5" and each status (read by screen readers) in
  other languages.

### `plan-card`

A proposed plan in the conversation: a flat card with folded Markdown,
copy and app actions in the header, then Revise and Implement at its foot.

```tsx
<PlanCard
  status={plan.status}
  onAccept={() => implementPlan(plan.id)}
  onRevise={() => {
    setPlanStatus("revising")
    composerRef.current?.focus()
  }}
  meta="12:04"
  actions={
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Save to file"
      onClick={savePlan}
    >
      <HugeiconsIcon icon={Download01Icon} strokeWidth={2} />
    </Button>
  }
>
  {plan.markdown}
</PlanCard>
```

- Place it in an `agent-turn`'s `content` part. While proposed, the
  composer stays the composer; Revise is the app's cue to focus it.
- Set `status` to `accepted`, `revising` or `rejected` after a decision.
  The card becomes an `AgentRequest` decided row; opening it shows the
  original plan, copy and actions, without the footer. `meta` follows
  the outcome; `open`, `defaultOpen` and `onOpenChange` control the fold.
- If focus was inside the proposed card, deciding moves it to the row's
  button. The app can then move focus to the composer when revising.
- Its copy button is "Copy plan", apart from its code blocks' "Copy".
- `labels` translates the title, choices, outcome, copy and fold words;
  nested labels merge with their English defaults. `title` overrides
  the default title, and `lines` defaults to 12.

### `conversation-skeleton`

A conversation not here yet, e.g. while the app loads its messages:
`<ConversationSkeleton />` in the scroller's place, a message asked in a
bubble the user's message's size and the lines of an answer, in the
conversation's type. It is a status (`label`, "Loading conversation") and
shows only past a short wait (`animate-wait-in`), so a quick load never
flashes it. `SkeletonLines` is its lines alone, each on a line of the
text's height, for any text not here yet: `<SkeletonLines
className="text-sm leading-5" widths={["w-1/3", "w-2/3"]} />`.

### `message-divider`

An event in a conversation between its messages: a day, the context
compacted, the model switched, a branch. One centred line between rules.

```tsx
<MessageDivider>
  <HugeiconsIcon icon={ArrowShrink02Icon} strokeWidth={2} />
  Context compacted · 182k → 41k
  <MessageDividerAction onClick={showSummary}>
    View summary
  </MessageDividerAction>
</MessageDivider>
```

- What can be followed is a `MessageDividerAction` (a button, a finger's
  size on touch screens); the rest is text.

### `agent-event`

What came to the agent from outside, neither the reader nor the agent
speaking: a line of a stream it watches (`kind="monitor"`), a background
task's end (`"task"`), a wake-up it had set (`"wake"`). One light grey
pill at the start edge, as wide as it needs: its kind's icon, its source
(the kind's word, or the app's `source`), what it said (cut short, whole
on hover), when. A divider is the conversation's own event; this is an
input the agent answers.

```tsx
<AgentEvent kind="monitor" title="contacts: 1204 rows, 0 errors" time="14:31" />
<AgentEvent
  kind="task"
  status="failed"
  title='Agent "Migrate profiles" stopped on an error'
  time="14:41"
  meta="12 tool uses · 1m 03s"
  details={<Markdown>{report}</Markdown>}
/>
```

- With `details` (a task's report) the pill is a button: closed, its
  summary alone; opened, the report under it in a bordered box that
  scrolls past 24rem, `meta` (what it cost) at its foot. Without
  `details`, `meta` is at the line's end.
- `status`: `"failed"` and `"stopped"` (a task killed) say so after its
  words, an alert or a stop before them, by weight, not a colour.
- In a turn it is a part: `{ type: "event", id, kind, title, time, … }`,
  where it came among the steps and what the agent said; events in a
  row sit close. Between turns, render `AgentEvent` itself.
- `foldKey` keeps it opened under a `FoldProvider`; in a turn its key is
  `${id}:event`. All words are `labels`; in a turn, the turn's
  `labels.event` for all its events, a part's own `labels` over them.

### `browser`

Pages in tabs, as a browser has: what is open beside a conversation. A
page is the app's data; the browser shows each kind:

| `content.type`   | Shown as                                                                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `web`            | a frame, a spinner until it loads; its address can be changed                                                                                      |
| `image`          | a `MediaViewer` (`kind="image"`); `markable`, its marking tools, for `onMarkImage`                                                                 |
| `video`, `audio` | a `MediaViewer` (`heading`, `description`, `peaks`, `transcript` for a recording)                                                                  |
| `pdf`            | a `PdfViewer`: the app's `pages`, or the browser's own viewer of `src`                                                                             |
| `table`          | a `TableViewer` of a `csv` (`parseCsv`), or of `columns` and `rows`                                                                                |
| `code`           | an embedded `CodeViewer` (`language`, `lineVariant`, `defaultFormatted`): its tools in the viewer's toolbar, Wrap and its length below             |
| `diff`           | a viewer of `diff` (a unified diff's text, or what `parseUnifiedDiff` read): each file under its name and its +N −M, its hunks (`DiffFileContent`) |
| `terminal`       | a `TerminalViewer`: its `output` (`live` while it runs, `status`), then the app's `sessions`                                                       |
| `files`          | a `FilesViewer` (`view`: list, grid, columns or gallery); a file opened goes to `onOpenFile`                                                       |
| `custom`         | the app's `element`                                                                                                                                |

```tsx
const browser = useBrowser()

// A file the agent wrote, in a new tab, or its tab if open.
browser.open({
  id: `file:${path}`,
  title: name,
  location: path,
  content: { type: "code", code, language: "ts" },
})

// Under a titlebar, its tabs in the titlebar's row over the panel.
function PanelBrowser(props: React.ComponentProps<typeof Browser>) {
  return <Browser barContainer={useAgentAppPanelBar()} {...props} />
}

<AgentAppPanels
  title="Browser"
  bar={false}                          // its tabs are the panel's bar
  panel={
    <PanelBrowser
      browser={browser}
      actions={
        <>
          <AgentAppPanelExpand />
          <AgentAppPanelClose />
        </>
      }
      onOpenFile={(file, { newTab }) =>
        (newTab ? browser.open : browser.navigate)(pageFor(file))
      }
    />
  }
  …
/>
```

- `AgentAppPanelExpand` expands the panel and back: beside the
  conversation, over it, the conversation narrowing to nothing as the
  panel widens (and back), as wide as it was and cut meanwhile; as a sheet (no room beside) or a phone's
  drawer, over the whole window, clear of its safe areas. It goes back
  to its size when the panel closes.
- `open(page)` opens it in a new tab after the one shown, or goes to the
  tab already showing it (the same `id`); `navigate(page, tab?)` goes to
  it in a tab (by default the one shown), back returning; `update(page)` changes it wherever it
  is open, e.g. as output comes or a file loads (no new history).
  `back`, `forward`, `select` and `close` take a tab's id. Back on a
  list of files, its directories are open as the reader left them, its
  file picked.
- **Viewers**: an image, video, audio, a PDF, a table, a terminal and
  files show in their viewer (`viewer` and its kinds, below), with the
  viewer's toolbar instead of the browser's: back and forward (the
  tab's, only where there is somewhere to go), where it is (its
  `location`'s folders, then its title), its own tools, `pageActions`,
  "@" and download (the content's `download` link), and `pageMenu`; its
  status bar's facts end with the content's `details`. All in the
  browser at once, not loaded apart: none adds a dependency.

  ```tsx
  browser.navigate({
    id: `file:${path}`,
    title: "plans.csv",
    location: "data/plans.csv",
    content: { type: "table", csv: text, details: ["CSV"], download: url },
  })

  <Browser
    browser={browser}
    onAddToChat={(page, part) => mention(page, part)} // part: { cell } | { session } | { file }
    pageMenu={(page) => <DropdownMenuItem onClick={() => reveal(page)}>Reveal in folder</DropdownMenuItem>}
    onNewTerminal={(page) => spawn()}
    onStopTerminal={(page, session) => stop(session.id)}
    onClearTerminal={(page, session) => clear(session.id)}
    onOpenFile={(file, { newTab }) => (newTab ? browser.open : browser.navigate)(pageFor(file))}
  />
  ```

  - A `files` page opens a file by Enter or a double click (⌘ or Ctrl,
    or a middle click: a new tab); a `BrowserFile` may have what a
    `FilesViewer` shows (`modified`, `size`, `status`, `thumbnail`,
    `caption`, …). "@" there gives the file picked.
  - A `terminal` page's own process is the first tab (its title,
    `output`, `live` as running, `status`); `sessions` are more beside
    it. "Send output to chat" gives `{ session }`.
  - Their words: `labels.viewers` (the bars', and `files`, `image`,
    `media`, `pdf`, `table`, `terminal` for each kind's).

- A file or a directory of a list is dragged out: as `browserFileType`,
  read by `browserFileFrom(data)` (`{ name, path, directory }`), and as
  its path in text, for any input. A `Composer` takes it with
  `dropTypes` and `onDropData`; what it becomes is the app's.
- Its state (`{ tabs, active }`) is its own, or the app's with `value`
  and `onValueChange`, e.g. to keep it per conversation.
- **Panes**: the reader drags a tab along the tabs to reorder it (a line
  shows where it goes), onto another pane's tabs or pages to move it
  there, or to the left or right third of a pane's pages to split the
  browser, a new pane there (a dashed area shows where). Panes are side
  by side, as wide as the reader drags them (`labels.resizePanes`); a
  pane left with no tabs goes. `open` and `navigate` go to the pane the
  reader was last in (`focus(pane)` for the app). Where the browser is
  too narrow for them side by side (280px each, e.g. in a phone's
  sheet), only the pane the reader is in shows, and "1/2" at the end of
  its bar (`labels.panes`, "Pane 1/2": a name with what it shows in it)
  goes to another. The others are hidden, not unmounted: a web page, or
  the app's, stays as the reader left it; side by side again once it is
  wide enough. Dragging is not the
  only way: a tab's menu (right click or a long press) and its keys
  move it left and right (Ctrl+Shift+PageUp and PageDown, on into the
  pane beside at either end), to a new pane (`Ctrl+\`) or to another
  pane. The app can too: `move(tab, { pane, index })`, `split(tab,
{ side, beside })`. In the state, where it is split, `panes` lists
  them in order, each with its shown tab, and each tab its `pane`; one
  pane is as before, with neither, and `active` is the shown tab of the
  pane the reader was last in. A dragged tab carries its `location` as
  text, e.g. into an input.
- A tab closes by its ×, a middle click, or Delete; the tab after it is
  shown, or before it. A hidden tab stays rendered, so a web page keeps
  its place; "Reload" loads it again.
- A tab `pinned` (`{ id, pages, index, pinned: true }`) is one of the
  app's fixed areas (Changes, Files, Terminal): no ×, and neither
  Delete, a middle click nor its menu closes it, so the reader cannot
  lose it and nothing needs reopening. It still moves and splits as any
  tab; the app may `close` it.
- The address bar says where a page is (`location`, or a web page's URL,
  or its title), as read (no scheme, its host grey) until it is
  focused; empty, it says `labels.addressPlaceholder` ("Enter an
  address"; "Search or enter address" where the app's resolver
  searches). Only a web page's can be changed. Every address goes to
  `resolveAddress`, typed or a `recent` one picked: by default
  `resolveWebAddress`, an http or https URL; without a scheme, "http://"
  for a local address (`localhost:5173`, `127.0.0.1:3000`, a one-word
  host and its port, `*.local`) and "https://" for the rest; nothing
  else goes anywhere. An app's own (e.g. a search, or its own pages)
  can fall back to it:

  ```tsx
  <Browser
    browser={browser}
    resolveAddress={(address) => ownPage(address) ?? resolveWebAddress(address)}
    labels={{ addressPlaceholder: "Search or enter address" }}
  />
  ```

- A web page's frame is sandboxed: scripts, forms and popups, on their
  own origin. A page served from the app's own origin needs a stricter
  `sandbox`, without `allow-same-origin`, or it could reach the app.
  Pages the server forbids framing (`X-Frame-Options`) cannot be shown:
  open them in a new window (its toolbar's "More" menu).
- **A web page's states** (`browser-web.tsx`): agentui draws the
  chrome and the overlays; the page and its states are the app's, on
  its `content`, changed with `update(page)`:

  ```tsx
  browser.update({
    id: "dev",
    title: "Browser",
    location: "http://localhost:5173/pricing",
    content: {
      type: "web",
      url,
      screenshot,                  // a picture instead of a frame, e.g. a remote browser's
      remote: { frame, cursor, caret, select, dialog }, // a remote browser's live page (below)
      running: true,               // a dot in the address bar; false: "Nothing is running on …"
      error: "The server answered 502", // or true: "Could not load …", with Retry
      agent: {                     // while the agent drives it
        action: "Clicking “Get started”",
        cursor: { x: 104, y: 230, label: "Click" },   // in the page's CSS pixels
        target: { x: 32, y: 214, width: 99, height: 32 },
      },
      console: [{ id, level: "error", text, source: "pricing.tsx:41", count: 3 }],
      network: [{ id, method: "GET", url: "/api/plans", status: 404, time: 88, size: 112 }],
    },
  })

  <Browser
    browser={browser}
    onPickElement={(page, element, request) => addToChat(element, request)}
    inspectElement={(page, { x, y }) => remote.elementAt(x, y)}  // a picture, or a frame of another origin
    onTakeOver={(page) => stopAgent()}
    onAskAgent={(page, message) => ask(message)}
    onRefreshNetwork={(page) => remote.readRequests(page)}
    notRunningActions={(page) => <Button onClick={startDevServer}>Run pnpm dev</Button>}
    recent={[{ address: "localhost:6006", meta: "Storybook" }]}
    onReload={(page) => probe(page)}   // Reload and Retry: clear `error`, look again
  />
  ```

  - Its toolbar: back, forward, the address with reload in it, then
    "Point at an element" (only with `onPickElement`), "Viewport", the
    console (disabled without `console` or `network`; its errors counted
    on it) and "More" (open in a new window). The page sits right under it, as wide as
    the panel.
  - **Agent at work** (`agent`): a dark bar over the page says so and
    what it does, a line goes round the page, its pointer and target
    show, and the reader's input waits; "Take over" calls
    `onTakeOver`, for the app to stop it and clear `agent`. The button
    uses a light tint of the bar.
  - **Pointing at an element**: the element under the pointer is
    outlined, dashed, with its tag, selector and size; a click picks it
    and the reader writes what to do with it; Enter or "Add to chat"
    gives `onPickElement(page, element, request)` (`{ selector, tag,
box, text }`). A frame's own document is read where it is the
    app's origin; otherwise, and for a `screenshot`, `inspectElement`
    finds the element (e.g. by the remote browser's protocol). Escape
    leaves it.
  - **A remote browser's page** (`remote`): the page itself, live, as
    a remote browser draws it, in place of a frame or a picture. The app
    streams `frame`, with `width` and `height` the viewport's CSS
    size: `{ src }` (a data or blob URL of a picture), `{ canvas }` (a
    canvas of the app's, its first frame drawn before it is given, that
    the app goes on drawing into) or `{ video }` (a video of the app's,
    playing, e.g. a stream's as its `srcObject`, muted). Where the
    frames come from is the app's. A canvas or a video goes in the
    picture's place, as wide as the room at `width` / `height`, filling
    that box; it stays the app's (agentui never draws on it, plays or
    pauses it), and its own pixels are the app's, e.g. the room's times
    the `resize` input's `devicePixelRatio` for a sharp picture. None
    yet: a spinner, "Connecting". It also
    gives the page's `cursor` (a CSS keyword), its `caret` (the focused
    field's box, where an input method's window opens), an open native
    `select` (`{ box, options, multiple }`) and a script's `dialog`
    (`alert`, `confirm`, `prompt` or `beforeunload`, with its message).
    Each frame shows once it can be drawn whole (a picture decoded, a
    video with a frame, a canvas at once), the last staying till then,
    so frames never flicker, nor a change of kind; none moves
    in a transition. `onRemoteInput(page, input)` gives the reader's
    input in the page's CSS pixels, to send on (e.g. as DevTools
    Input events): `resize` (the page's room and the device pixel
    ratio, at once and again once it settles, to size the remote
    viewport to), `pointer` (move, down, up; button, buttons,
    clickCount, modifiers; moves once a frame), `wheel`, `key` (down
    and up, with the text it types, Enter as `"\r"`), `composition`
    (start, update, end with the text committed), `text` (typed by no
    key: dictation, an emoji picker), `paste`, `select` or
    `select-cancel`, and `dialog` (`accept`, a prompt's `text`). A press
    focuses the page. By touch or a pen, the screen's keyboard comes up
    only while `remote.caret` is set (a field of the page's is focused),
    not for a tap anywhere else; a hardware keyboard's keys still go to
    the page. Its keys then are the page's, Tab and the arrows
    too, but for those `remoteShortcut(event)` keeps for the app. ⌘C or
    Ctrl+C copies `copyRemoteSelection(page)`'s text. Pointing at an
    element needs `inspectElement`; the agent's layer, the devices and
    the drawer work as on a frame; "Dark color scheme" is the view's
    `dark`, for the app to apply remotely: `onWebViewChange(page, view)` gives
    a page's view as the reader changes it.
  - **Viewport**: the panel's size, or a laptop's, a tablet's or a
    phone's in a rounded bezel on a dotted canvas, scaled to fit. A size
    pill sits inside the canvas at its bottom. The menu shows the panel's
    actual width; "Rotate" has an R hint. "Dark color scheme" sets the
    frame's `colorScheme` to dark without closing the menu. Device, rotation
    and scheme are kept by tab, as are the console and picking.
  - **Console**: a fixed 250px drawer under the page, with its list
    scrolling inside: errors on a darker row, a filter, "Ask agent" on an error (with `onAskAgent`). With the
    page's `network`, a Network tab beside it: each request's method,
    address, status (none: "Pending", 0: "Failed"), time and size, the
    failed ones darker; the filter works in either. With
    `onRefreshNetwork(page)`, the Network tab has "Refresh requests":
    the app reads them again (e.g. from a remote browser) and gives the
    new `network`. Its button always shows, enabled with either.
  - **Not running** (`running: false`): which address, the app's
    `notRunningActions`, "Open another address" (to the address bar)
    and the `recent` addresses.
  - **Did not load** (`error`: `true`, or why): in the frame's place,
    "Could not load localhost:5173" (`labels.loadFailed`), the app's
    reason (or `labels.loadFailedHint`), Retry, "Open another address"
    and the `recent` ones, the same look as not running. A browser
    cannot read why another origin's frame failed, so the app says so
    (e.g. its proxy's answer, or a `fetch` that fails). Retry, as the
    address bar's Reload, loads the page again and calls
    `onReload(page)`: the app clears `error` (`update(page)`) and sets
    it again if it still fails. Where the address bar names a page
    the frame's `url` proxies, the page's `location` names it.

- A tab says a page's `count` after its title, e.g. "Changes 3". Its ×
  shows on the tab shown and under the pointer, always under a finger.
- Its bar is as tall as the app's header; `actions` go at its end and
  `pageActions(page)` in its toolbar (e.g. "Copy path").
- An image page is a `MediaViewer`; one `markable` (its marking words
  in `labels.image`) has its areas marked, sent to `onMarkImage(page,
marks, size)`, and shows its `marks` and `highlight`. The words of
  image, video and audio pages are `labels.viewers.media`.
- A page with navigation of its own, e.g. a desktop app's native web
  view in a `custom` page that knows its history, has `toolbar: false`
  and its own toolbar: a `BrowserToolbar` with `BrowserToolbarButton`s
  and an `InputGroup` for its address, so it looks the same.
- `labels` gives its words in other languages.

### `picture-in-picture`

What an agent is on, small in a corner while the conversation goes on,
e.g. its pages and terminals when the panel is closed:

```tsx
<main className="relative">
  {" "}
  {/* its place: the nearest positioned ancestor */}…
  {items.length > 0 && !panelOpen && (
    <PictureInPicture
      items={[
        {
          id: "pricing",
          title: "Pricing",
          icon: <Favicon />,
          preview: <img src={frame} alt="" className="size-full" />,
        },
        {
          id: "tests",
          title: "pnpm test",
          icon: <TerminalIcon />,
          line: lastLine,
          status: "Running · 12s",
          preview: <PictureInPictureLines lines={output} />,
          form: "pill",
        },
      ]}
      active={agentIsOn} // it follows this one
      onShownChange={(id) => stream(id)} // frames for the one shown only
      onExpand={(id) => openPanel(id)} // into the panel; it then goes
      onClose={() => hideForNow()} // what is open stays open
    />
  )}
</main>
```

- **Following.** It shows the item the agent is on (`active`) and goes
  with it. The reader goes through the others by a swipe across the
  preview, a sideways scroll, the left and right arrows or a dot (past
  seven, "2/12"); it then stays there, and "Follow" takes it back
  (`following`, `onFollowingChange`). Under a finger each dot is 28px
  wide, so a tap takes the dot under it, not its neighbour; past four,
  and in a pill, a count ("2/3") stands for them.
- **Card or pill.** A card has its title and `preview` (16:10,
  `aspectRatio`; 320px wide, 240px on a phone, upright or on its side); a pill is one line: its
  icon, `line` and `status`, up to 384px (240px on a phone, as its card,
  so it has corners to go to). An item opens as its `form`
  says (a card if it has a preview); Minimize makes it a pill, and the
  pill's line a card again (or, with no preview, expands it). A
  terminal is best a pill of its last line, `PictureInPictureLines`
  its last lines when it is a card.
- **Moving.** Dragged by any part but its buttons (and what has
  `data-no-drag`), it lands in the corner it is let go nearest or thrown
  towards, rising a little while held; a tap on the preview is still a
  press, and a finger's press moved less than 10px is a tap. A swipe
  across a preview of several turns while it stays within it; taken on
  past its side it is a move, the window catching up with the finger
  (on a phone the preview is most of it). Let go with its middle past
  a side, or thrown out past the side it is at, it tucks into that
  side, only a 24px tab
  showing (its alert icon while it calls for the reader); the tab, or a
  drag back, brings it out (`tucked`, `defaultTucked`,
  `onTuckedChange`): on a phone, the conversation whole without closing
  it. Shift and the arrow keys move it, out past its side tuck it. `corner`, `defaultCorner`, `onCornerChange` by the
  reading direction; 16px (`inset`) from its place's edges and the safe
  areas.
- **Closing.** Rendered only while shown, it goes at once; to see it
  out, keep it rendered and set `open={false}`: it shrinks and fades
  out, then is gone, and comes back as it first came when `open` is
  true again.
- **Calling for the reader.** An item's `attention` is a strip under a
  card or the pill's line, in the text's colour with a ring, read out,
  and the window is nudged once; it never expands by itself.

### `viewer`

One thing open in a panel, e.g. a file beside a conversation, with the
same skeleton whatever it is: a toolbar above (back, where it is, its own
tools, the app's, "@" to add it to the chat, download, more), its content
to the edges, and a status bar below (controls at the start, facts at the
end). The toolbar is islands, as a desktop chat app's, with no line
under it: each a pill 36px high on the page's colour with a hairline
and a faint shadow (a step lighter than the panel in dark), its buttons
28px, apart from the next. Back and the path, as wide as they are; then
its tools (`ViewerTools`), each group (`ViewerToolGroup`) an island of
its own, a lone tool a round island: the viewer's own; the app's; "@",
download and more; an overlay's (a `ViewerToolGroup` outside
`ViewerTools` too, for a bar of the app's own). A group with nothing in
it is not there. Where the app's tab already names it, `start={null}`
leaves the path out. Where the path has no room, its folders fold into
a menu at its start; where its name would still be cut short of 6rem
(a phone's width beside six tools), the path takes a row of its own
over the tools, nothing hidden; a name is cut keeping its extension. A kind's own controls go
at the start, after the path (`lead`: an image's compare); its zoom is
its percent at the end (`zoom`: a `ViewerZoom`, a menu of Fit, in, out
and the steps). A kind with no status bar (`statusBar={false}`, an
image's) has its facts at the top of More, and what it shows to its foot.
Ways to change what it shows float at the content's foot, in its middle
(`ViewerEditBar`): a handle to drag the bar aside by (its arrow keys too;
Escape puts it back), the kind's own (an image's Mark an area, through
`ViewerEditSlot`), then the app's `edits`, `ViewerEditButton`s (icon and
word; the icon alone where the viewer is under 24rem), e.g. remove the
background, erase, resize; with none, there is no bar. A `ViewerOverlay`
covers the whole window, one surface to its edges: the viewer's toolbar
is the window's top row (`ViewerFrameTitlebar`), as tall as an
AgentApp's titlebar, past the window's own buttons and dragging the
window but by its controls (`[data-titlebar]`; a host that drags the
window itself does so on a pointerdown there whose target is not a
control). Its name is at its start, its facts after it, quieter
("home.png · 1600 × 900 · PNG", not in More, which is there only for the
app's `menu`), then the kind's `lead` (an image's versions, a menu, and
compare); at its end only Open in side panel and Close. The tools for the image are under it, as in a photo app: islands
at the middle of the stage's foot, over the composer and never over the
image, ways to change it (an image's Mark, a mode whose tools come after
it, then Clear marks and the send, and the app's `edits`, in place of
the floating bar), then the zoom with the viewer's and the app's tools,
add to chat, download and More; on two rows where they have no room on
one. The strip of the conversation's images is under that
row at the start, the buttons to the one before and after show while a
mouse points at the image (always under a finger), and the composer is
under the image: the panel and the overlay trade places with one click. More has the facts at its top (where there is no
status bar) and the app's `menu`: rarer actions (show in the file's
folder, open in another app) go in `menu`, frequent ones in `actions`. The viewers below are made of it; a kind of its
own, the app's, is too.

```tsx
<ViewerFrame
  name="notes.txt" // the last of its path
  icon={<HugeiconsIcon icon={File01Icon} strokeWidth={2} />}
  path={[
    { label: "agentui", onSelect: () => openFolder("") },
    { label: "docs" },
  ]}
  onBack={back} // no button without it
  onForward={forward} // after back, e.g. a browser's history
  actions={
    <ViewerTool label="Copy path" onClick={copy}>
      <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
    </ViewerTool>
  }
  onAddToChat={() => mention(file)} // "@"
  download={url} // a link, or the app's () => void
  menu={<DropdownMenuItem onClick={reveal}>Reveal in folder</DropdownMenuItem>}
  controls={<ViewerStatusButton onClick={wrap}>Wrap</ViewerStatusButton>}
  facts={["Text", "1.2 KB"]} // a dot between each
>
  {content}
</ViewerFrame>
```

- Its parts compose a viewer by hand: `Viewer`, `ViewerToolbar`
  (`ViewerBack`, `ViewerPath`, `ViewerTools` with `ViewerTool`s,
  `ViewerAddToChat`, `ViewerDownload`, `ViewerMenu`), `ViewerContent`,
  `ViewerStatusBar` (`ViewerStatusButton`, `ViewerStatusValue`,
  `ViewerStatusText`, `ViewerStatusSeparator`, `ViewerFacts`).
  `ViewerFrame`'s `start` takes the place of back and the path (a
  terminal's tabs); every viewer takes it, `start={null}` leaving only
  its tools where a tab already names what is open.
- A `ViewerTool` is an icon named by its tooltip; with `pressed` it is a
  toggle (`aria-pressed`). Each small button has a finger's place (44px)
  on a touch screen.
- `ViewerZoom`: out, the value, in, and "Fit" (pressed while it fits).
- `ViewerUnsupported`: a file with no preview says so, its icon and the
  app's way out (download, open elsewhere) under it.
- Every viewer below takes the frame's props (`name`, `icon`, `path`, `start`,
  `onBack`, `onForward`, `actions`, `onAddToChat`, `download`, `menu`) and `details`,
  the app's facts after its own ("PNG", "412 KB"). `labels` gives their
  words, the frame's too.

### `files-viewer`

A folder in a viewer, as Finder has it, four ways: a tree of rows, a
grid of thumbnails, columns, and a gallery. The files, loading a
folder, the previews and what opening does are the app's.

`tree={false}` shows a flat top-level listbox with folder chevrons.
Enter/Right opens folders and Left/Backspace asks `onUp`. `openOn="click"`
opens after picking on a single click or tap. `loading` shows the loading
label and spinner instead of the empty view while files arrive. Other views
ignore `tree`. `header={false}` leaves out the list's column header (the
sort stays in the menu); `filter={false}` the toolbar's filter, where the
app filters by its own field. A disabled entry takes no focus, by a click
or the keys, unless every entry is disabled. One column alone keeps a
column's width; it fills the view only where the others folded away.
Under a coarse pointer (a finger) the list's and the columns' rows are
44px tall. It has no fill of its own (other viewers have the page's): it takes
the surface it sits on, e.g. a dialog's.

```tsx
<FilesViewer
  name="agentui"
  files={[                                  // a folder's own children under it
    { id: "src", name: "src", directory: true, modified, children: [ … ] },
    { id: "package.json", name: "package.json", modified, size: 2253, status: "M" },
    { id: "node_modules", name: "node_modules", directory: true, dimmed: true },
  ]}
  selected={selected}
  onSelect={(file) => setSelected(file.id)}
  onOpen={(file) => open(file)}             // Enter or a double click on a file
  onExpandedChange={(expanded, folder) => { if (!folder.children) load(folder) }}
  fileProps={(file) => ({ draggable: true, onDragStart: … })}
  preview={(file) => <MediaViewer kind="image" … />}     // the picked file large: columns, gallery
  controls={<ViewerStatusButton onClick={create}><HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} />New file</ViewerStatusButton>}
/>

<FilesViewer                                 // the app's order, in its groups
  name="Recent"
  groups={[
    { key: "today", label: "Today", files: today },
    { key: "earlier", label: "Earlier", files: earlier },
  ]}
  defaultSort={null}
  views={["list", "grid"]}                   // the toolbar's views, in its order
  …
/>
```

- The views (`view` or `defaultView`, `onViewChange`): `list`, `grid`,
  `columns` and `gallery`, the toolbar's buttons for those in `views`
  (all four by default; one, no buttons).
- `disabled` on a file: shown, dimmed, not picked or opened (e.g. a
  file where only a folder can be chosen); the arrow keys, Home and End
  pass it by in every view.
- `start`: the app's control in the toolbar in the path's place (the
  filter takes it while open), e.g. a select of places.
- The order: sorted by name, "Modified" or "Size", folders first (the
  header's buttons, again the other way; the more menu too), or the
  app's own with `sort` or `defaultSort` `null` ("None" in the menu);
  `onSortChange` gives either.
- `groups` in place of `files`: `{ key, label, files }[]`, each under
  its heading in the list, the grid (on a row of its own) and the first
  column; an empty group is left out, the keys pass the headings by, and
  a file says its group to a screen reader (`aria-description`). Sorted,
  each group is sorted within itself.
- The list: when each changed is short ("now", "5h", "2d", `labels.time`), its size
  `labels.bytes`; a column no loaded file has (folders alone have neither)
  is left out, header and rows alike. A `status` letter after a changed file's name, said in
  full to a screen reader (`labels.status`: M modified, A added, …), and
  its `description` after it, lighter ("Draft"; in the columns too).
  Only the rows in view are drawn.
- A tree (`role="tree"`): up and down pick, right opens a folder or goes
  into it, left closes it or goes to its folder, Enter opens a file or
  toggles a folder (or opens it, with `folderAction="open"`); one tab
  stop. A folder without `children` shows
  "Loading…" under it while open. The open folders are its own
  (`defaultExpanded`), or the app's (`expanded`).
- The grid: the folder's own files as tiles, `thumbnail` (an `<img>` or `<video>`
  covers it) or the type's `icon`, `badge` on it ("▶ 0:42"), `caption`
  under the name ("1600 × 1067"). The arrow keys pick by where they are;
  Enter or a double click opens, a folder too.
- The columns: the folder, then each folder on the way to the picked
  file (or the folder picked), lit; one picked whose `children` are not
  loaded says "Loading…" and asks the app once by `onExpandedChange`.
  A column draws only the rows in view, however many a folder has.
  Up and down (Home, End) pick in a column, right or Enter goes into a
  folder, left back to the folder of its column, Enter opens a file. A
  file picked shows `preview(file)` beside the columns, or below where
  there is no room (columns 11rem, the preview 15rem); columns with no
  room fold away from the start, "Back to src" and "Forward to lib"
  (`labels.backTo`, `labels.forwardTo`) show them without changing the
  pick.
- A column's border resizes it, as in Finder: dragged, or focused
  (`labels.resizeColumn`, a separator whose value is its width in
  pixels) with left and right (Shift, more), Home and End to the
  narrowest and widest (10rem to 30rem, or the room the other columns
  shown leave it, so it never pushes itself out of view); a double
  click or Enter puts
  it back to 11rem. The line lights on hover and focus; under a coarse
  pointer there is none. The widths are by depth (0 the folder shown, in
  CSS pixels), the viewer's own (`defaultColumnWidths`) or the app's
  (`columnWidths`, `onColumnWidthsChange` once a drag is let go or a key
  pressed, e.g. to keep); the columns that fit follow them. A drag sets
  the width on the column alone, no rows drawn again.
- The gallery: the picked file large, `preview(file)` or its thumbnail
  (or icon), name and caption, over a strip of its folder's files. Left
  and right (Home, End) pick, Enter or a double click opens; up and down
  are left to the preview.
- `folderAction`: what Enter and a double click do to a folder in the
  list and the columns, `"expand"` (by default: the list opens it under
  itself, the columns go into it) or `"open"`, `onOpen(folder)` as a
  file, e.g. the app going into it. The list's disclosure and the right
  arrow still expand. The grid and the gallery always open a folder.
- The filter (its search button) keeps what matches by name, its
  matches marked, and the folders on the way open; down goes to the
  first shown, Escape (in the field or the rows) closes it. Its text is
  the viewer's, or the app's (`query`, `onQueryChange`; the app
  emptying it closes the field). `filtering="manual"`: the app matches,
  `files` its results, shown as given (only marked); `searching` puts
  a spinner in the field and "Searching…" in the status bar (and in
  place of "No matches" while there are none yet). "Searching a
  workspace", above.
- `levelFilter={{ folder, prefix }}`: one folder's files (`folder` by
  id, `null` the top level) filtered as a typed path's last segment
  filters them, the enabled ones whose names start with `prefix` (case
  and width insensitive), driven by the app's own input (`folder-picker`'s
  path): no field opens. The other levels stay whole and the columns to
  its left keep their place; no column follows a folder filtered out.
  The prefix is marked, the facts say "3 of 5000 items"
  (`labels.resultsOf`), and a level with none says "No matches" (a
  column's note, a row under the folder in the list). An empty prefix
  filters nothing; while the toolbar's filter has text, that filters
  instead.
- Its facts: how many, how many changed; in the grid and the gallery,
  how many shown and their size. `count="level"` counts only the filtered top
  level for item and changed facts; `{ folder }` only that folder's files
  (`null` the top level); `"all"` (default) counts loaded descendants.
  Search result totals are unchanged.

### `folder-picker`

A folder chooser in a dialog, or a panel embedded in a page. The app owns the
tree and filesystem operations.

```tsx
<FolderPicker
  open={open}
  onOpenChange={setOpen}
  folder={home}
  selected={selected}
  onSelect={(folder) => setSelected(folder.id)}
  onLoad={loadFolder}
  onNavigate={goToPath}
  onCreateFolder={createFolder}
  onChoose={(folder) => {
    addProject(folder.id)
    setOpen(false)
  }}
/>
```

- Pass a folder with its tree in `children`; undefined children mean loading.
  `onLoad(folder, { signal })` asks the app to put children into the tree.
  Return a promise to mark completion; stop and do not apply results when the
  signal aborts. Hover (150 ms, mouse or pen) and focus prefetch unloaded folders.
  Loads deduplicate; a prefetch becoming shown is retained. Moving away aborts
  unwanted loads, changing place cancels old requests, and closing aborts all.
  Each loading column or expanded loading row stays independent and usable.
  Expanded folders can be
  controlled with `expanded` and `onExpandedChange`.
- Update the tree as React state is updated: a level that changes (a
  folder's children loaded) is a new array, and the levels it does not
  touch are the same ones. The picker keeps what it made of each level
  by the level, so opening it again, or a folder loading into a tree of
  100,000, makes again only what changed (10 ms, not 20, to open; `pnpm
perf`). A level changed in place is not seen.
- Files are hidden by default; `files="dimmed"` shows them disabled for context.
  The status count is the level being picked in: the folder typed into, or
  the picked folder's own (on a phone, the folder shown); folders, plus
  dimmed files when shown.
- `views`, `defaultView`, `view` and `onViewChange` offer columns and a list.
  On phones, a flat list shows one folder at a time. Tap a folder to go in;
  the toolbar breadcrumb goes up. Choose picks the folder shown. Up/Down
  highlight rows without navigating; Enter/Right goes in, Left/Backspace goes
  up. Path completion highlights a match without going in until accepted.
- `columnWidths`, `defaultColumnWidths` and `onColumnWidthsChange` are
  FilesViewer's, for the columns' widths on a larger screen.
- The editable path field shows `pathOf(target)`, the id by default, where
  `target` is the selected folder or the root when none is selected.
  The folder part navigates via `onNavigate` at "/". The last segment
  filters the folder typed into, as VS Code's "Open Folder" does: only
  that level (FilesViewer's `levelFilter`; the columns to its left and
  the list's other branches stay whole), its folders whose names start
  with it (case-insensitive), "1 of 3 items" in the status bar, "No
  matches" where none do. The first match is selected with inline
  completion; with none, or an empty segment, the typed folder itself is.
  Unloaded folders show loading and filter when their children arrive.
  Tab, End or Right accepts and steps in (the new level whole until more
  is typed); Up/Down cycle the filtered folders; Backspace removes the
  completion, further deletes widen the filter; Enter goes to the
  trimmed path. Cmd/Ctrl+Enter chooses. Escape drops completion, then
  restores the picked path before closing. While editing, selection
  keeps the typed text; blur reflects the picked folder. A folder with no
  path (`pathOf` gives `""`, e.g. a place such as Recent) leaves the field
  empty with its placeholder. On a larger screen the field is in the
  browser's toolbar, the only location (no breadcrumb) and the only filter
  (no toolbar filter), and has the focus when the dialog opens; on a phone
  it is above the browser, whose toolbar has the breadcrumb, `path` the
  folders before `folder`'s. With places, the phone's places select stands
  for the place's root in the breadcrumb: no crumb repeats it, and choosing
  the place again goes back to its root.
- `places`, `place` and `onPlaceChange` provide a side navigation (each
  place's `icon` before its name, rows as ModelPicker's rail has them), or
  on a phone a Select at the start of the breadcrumb.
- `onCreateFolder(parent, name)` enables New folder. The parent is captured when
  clicked; a rejection stays beside the name field. Escape cancels that row.
- `status` is a polite note above the buttons; `canChoose` disables choosing
  folders the app cannot use.
- Choose gives the picked folder, or the shown folder when none is picked.
  Enter and double click expand folders; Cmd/Ctrl+Enter chooses. `labels` and
  `viewerLabels` supply the words.
- `FolderPicker` supplies the dialog, title, description and Cancel button.
  `FolderPickerPanel` supplies the same chooser for a page; `footer` can place
  its buttons in an app's footer; `autoFocus` focuses its path field as it
  is shown, as the dialog does.

### `media-viewer`

`MediaViewer`: an image, a video or a recording open in a panel, by its
`kind` (a message's are `media-gallery`'s).

```tsx
<MediaViewer
  kind="image"
  name="hero.png"
  src={url}
  alt="The pricing page's hero"
  details={["PNG", "412 KB"]}              // after its size, which it reads
  versions={[{ src: before, alt: "The hero before the edit", when: "12:01" }]}
  when="12:04"                             // this one, the latest
  position={{ index: 30, count: 60 }}      // among the folder's images
  onPrevious={showPrevious}
  onNext={showNext}
  onMark={async (marks, size) => {         // with none, nothing to mark
    const bytes = await (await fetch(url, { credentials: "include" })).blob()
    const { mask, annotated } = await markImages(bytes, marks)
    await askToEdit({ mask, annotated })    // the app's: upload, the composer
  }}
  marks={sent}                             // shown while not marking
  highlight={changedMaskBlobUrl}           // what an edit changed, lit
/>

<MediaViewer kind="video" name="demo.mp4" src={url} poster={poster} details={["MP4", "8.1 MB"]} />

<MediaViewer
  kind="audio"
  name="narration.mp3"
  src={url}
  title="Release notes, read aloud"
  description="eleven-v3 · generated 12:04"
  peaks={peaks}                              // 0…1, a bar each, e.g. 100
  transcript={[{ start: 0, text: "…" }, { start: 9, text: "…" }]}
/>
```

- Image: with small rounded corners and the theme's floating shadow to
  keep its edge visible, on a checkerboard if it has transparent parts
  (found as it loads, or the app's `transparent`); fitted to its place
  with a margin, never larger than itself. Zoom by the status bar, Ctrl
  or Cmd with the wheel (a pinch), or + − and 0 on the image; zoomed, it
  scrolls. A step in or out is the status bar's next (10%, 25%, 50%,
  75%, 100%, 125%…), at least a fifth larger or smaller: from a fitted
  72%, in is 100%, not 75%. "Copy image" copies it as a PNG.
- With `versions` (its earlier ones, oldest first, the first the
  original; each `src`, `alt`, and `label`, `when`, `thumbnail` if the
  app has them), a strip under it of all of them, a thumbnail and a name
  each ("Original", "Version 1"…, or their `label`), picks the one shown
  (a radio group: the arrow keys move between them; `version` and
  `onVersionChange` may be the app's). A button compares the one shown
  with the original, a line dragged between (the original left of it in
  any language, each at its own shape; the line a slider, the arrow keys
  5%, Home and End; a finger drags it sideways while a vertical swipe
  scrolls), the facts saying when each was; `comparing` may be the
  app's. Marking (below) is on the latest.
- One of the app's others, e.g. a folder's images or a turn's files:
  `position` (`{ index: 30, count: 60 }`) says "30 / 60" at the foot of
  what it shows, and `onPrevious` and `onNext` go back and forth, by
  round buttons at its sides (none at the ends). They are any
  `ViewerFrame`'s, so a video, a PDF or a page embedded in a panel has
  them too; an image adds the left and right arrows on it (while it is not zoomed past
  its place, where they scroll). The comparison has the same floating
  edge; its divider and grip follow the background colour in either theme.
  Its words are `labels.comparison`.
- With `onMark(marks, size)`, `marks` or `highlight`, its areas are
  marked (`labels.editor`): "Mark an area", in the viewer's floating bar
  of edits before the app's `edits`, shows the
  tools, a brush (`[` and `]` change its width), a lasso and a
  rectangle, and Undo (Ctrl+Z or ⌘Z); marks are in the image's pixels.
  Beside them, "Edit this" (`labels.editor.send`) calls `onMark`: it
  waits while that runs ("Preparing…"), shows its error's message if it
  throws, and stops marking when done; Escape clears the marks. Its
  zoom is the status bar's as any image's, its steps the same; a click
  zooms in where it is, Alt+click out. It is drawn as when only looked
  at: fitted to the edges, flat, a checkerboard only if it has
  transparent parts.
- `markImages(bytes, marks)` makes from the image's bytes (fetched by
  the app, with its credentials, so the canvas can be read) `mask`, as
  large as the image, transparent where marked and black elsewhere (as
  image models take for an edit), and `annotated`, the image with the
  marks tinted over it, at most `edge` (2048) pixels long. Uploading
  them, and what is asked, is the app's. `highlight`, a mask of what
  changed (transparent where it did), dims the rest as the image opens,
  then clears; its URL must be the page's to use, e.g. a blob's.
- Video: on black, its controls over it in the dark theme's colours in
  either (play, the time, a seek bar that shows the frame under the
  pointer, mute, full screen). Its size and length below. Where the
  Fullscreen API is missing (an iPhone's WebKit, a web view without
  element full screen), full screen is the video alone in the system's
  player (`webkitEnterFullscreen`); with neither, there is no full
  screen button. A `media-gallery` video's is the same.
- Audio: a play button, its title; the waveform of the app's `peaks` is
  a slider (a click or a drag, the arrow keys 5 seconds, Home and End),
  the bars played filled. The transcript's line being said is lit
  (`aria-current`); a line goes to its time. The app measures the peaks
  (e.g. from the file's samples once); none, a plain bar.
- Video and audio: speed (1×, 1.25×, 1.5×, 2×, 0.5×, 0.75×) and loop
  below; Space plays and pauses, the arrows go 5 seconds. "Copy
  transcript" copies its lines with their times (or
  `onCopyTranscript`).
- What cannot be shown or played says so (`labels.failed(kind)`).
- Each takes `crossOrigin` (e.g. `"use-credentials"` for the app's
  session); video and audio `mediaProps`, as `media-gallery`'s: the
  `<video>` or `<audio>`'s `ref` (e.g. to go to a time) and its events
  (e.g. `onLoadedMetadata`), called with the viewer's own.
- Its image editor and comparison (`image-editor.tsx`,
  `image-comparison.tsx`) are its own files, installed with it; use
  them through `MediaViewer`.

### `pdf-viewer`

```tsx
// The app's pages, e.g. rendered with PDF.js: its canvas and text layer.
<PdfViewer
  name="release-notes.pdf"
  pages={pages.map((page) => ({
    width: page.width, height: page.height,     // at 100%, CSS pixels
    content: <PdfPage page={page} />,
    thumbnail: <img src={page.thumbnailUrl} alt="" />,
  }))}
  details={["1.4 MB"]}
/>

// Only a file: the browser's own viewer.
<PdfViewer name="spec.pdf" src={url} pageCount={12} />
```

- With `pages`: a rail of them (where there is room), the pages one under
  another on paper (white in either theme), the page in view in the
  status bar ("2 / 12"), the page buttons and the rail going there; zoom,
  "Fit" to the width. Ctrl or Cmd+F opens a find bar over it: what it
  finds in the pages' text is marked by the CSS Custom Highlight API (no
  elements added to the app's pages; a browser without it counts, but
  does not mark), Enter and Shift+Enter go from one to the next.
- With only `src`, a frame of the browser's own PDF viewer, told
  `#page=…&zoom=…` (Chrome and Firefox follow it; Safari shows the file
  as it can). Its own find (Ctrl+F in it) and thumbnails are the
  browser's. No new dependency either way: rendering pages, e.g. with
  PDF.js, is the app's choice.

### `table-viewer`

```tsx
const [columns, ...rows] = parseCsv(text)   // RFC 4180
<TableViewer
  name="plans.csv"
  columns={columns}                          // or { name, type: "number" }
  rows={rows}
  totalRows={1284}                           // where only some were read
  onAddToChat={(cell) => mention(cell)}      // { row, column, value, name } or null
  details={["CSV"]}
/>
```

- Row numbers, each column's type under its name (`number` if all its
  cells are, to the end, an empty one "—"); only the rows in view are
  drawn, so any number scroll.
- A grid: a cell is picked by a click or the keys (arrows, Page Up and
  Down, Home and End, Shift with them to the first or last row); the
  status bar says which ("Row 4 · seats") and a column of numbers' sum.
  The picked cell may be the app's (`selected`).
- Filter (rows with the text) and sort (the picked cell's column, then
  the other way, then not; `aria-sort` on its header).

### `terminal-viewer`

```tsx
<TerminalViewer
  sessions={[
    {
      id: "dev",
      title: "pnpm dev",
      output,
      running: true,
      status: "Running · 12m",
    },
    { id: "zsh", title: "zsh", output: zsh, status: "Exited 0" },
  ]}
  onNew={newTerminal}
  onStop={(session) => stop(session.id)}
  onClear={(session) => clear(session.id)}
  onSendToChat={(session) => mention(session.output)}
/>
```

- A tab per process (a filled dot while it runs, said as "Running"),
  the shown one the viewer's or the app's (`active`); `onBack`, `onForward`
  and `actions` before and after them. Its output with
  its ANSI colours, following its end while it comes ("Jump to end"
  once the reader scrolls up).
- Stop (only while it runs), Clear and "Send output to chat" below, the
  app's `status` at the end.

### `conversation-details`

A small details card in the conversation's empty margin, or a popover
under its header button where there is less room.

```tsx
<AgentApp
  sidebar={
    <AgentAppSidebar projects={projects} conversations={conversations} />
  }
>
  <ConversationDetails
    labels={{ title: "Details" }}
    details={
      <>
        <ConversationDetailsSection title="Workspace" hideTitle>
          <ConversationDetailsRow
            icon={<HugeiconsIcon icon={ComputerIcon} strokeWidth={2} />}
            action={
              <ConversationDetailsAction
                label="Open folder"
                onClick={openFolder}
              >
                <HugeiconsIcon icon={Folder01Icon} strokeWidth={2} />
              </ConversationDetailsAction>
            }
          >
            {workspaceName}
          </ConversationDetailsRow>
        </ConversationDetailsSection>
        <ConversationDetailsSection title="Subagents" meta="3 running">
          <ConversationDetailsRow
            status={{ busy: true, label: "Running" }}
            meta="19s"
            onClick={openSubagent}
          >
            Share link docs
          </ConversationDetailsRow>
        </ConversationDetailsSection>
      </>
    }
  >
    <AgentAppHeader title={title} actions={<ConversationDetailsTrigger />} />
    <ConversationDetailsArea>
      <MessageScrollerProvider>
        <MessageScroller>
          <MessageScrollerViewport aria-label="Conversation">
            <AgentAppColumn render={<MessageScrollerContent />}>
              {messages}
            </AgentAppColumn>
          </MessageScrollerViewport>
        </MessageScroller>
      </MessageScrollerProvider>
      <AgentAppDock>{composer}</AgentAppDock>
    </ConversationDetailsArea>
  </ConversationDetails>
</AgentApp>
```

- **Placement**: wrap the header and the conversation in
  `ConversationDetails`, its trigger in the header's `actions`, and the
  scroller and dock in `ConversationDetailsArea`. Where that area leaves
  room beside its column's content (`AgentAppColumn`, as laid out: the
  192px card, 12px from the area's edge and from the content; with the
  column's 752px of content, an area 1184px wide, e.g. 1440px with the
  sidebar open), the card is pinned at its top right, over the
  empty margin; else the trigger opens it as a popover under it. It
  floats (`bg-popover shadow-float`, no border), no taller than the area
  or the window, and scrolls inside.
- **Open**: `open`, `defaultOpen` (true) and `onOpenChange` are whether
  the pinned card shows; the trigger shows and hides it
  (`aria-expanded`). The popover is closed until the trigger opens it,
  and closes where the area gets room; Escape or a press outside closes
  it, and focus goes back to the trigger.
- **Sections** (`ConversationDetailsSection`): a small grey `title`, the
  app's `meta` after it ("Subagents · 3 running") and its `actions` at
  its end (a `ConversationDetailsAction` opening a menu); `hideTitle`
  keeps it only as the section's name for screen readers. A hairline
  between sections; a section with no rows is not shown.
- **Rows** (`ConversationDetailsRow`, in a section): 32px, an `icon`, the
  value cut short, an optional `label` (a muted name before the value,
  read first: "Effort High"), `meta` at the end in mono ("+38 −12", "19s"), a
  `chevron` where it opens something, `disabled` in grey. A `status`
  (`{ tone, busy, label }`, a grey `StatusMark`) sits at the icon's
  corner, a spinner while `busy`, and its label is part of the row's
  name. A row is a button (`onClick`), a link (`render={<a href />}`) or
  a menu's trigger (`render={<DropdownMenuTrigger />}`); its `action`, a
  `ConversationDetailsAction` (e.g. open the folder), is a button of its
  own after it. With `plain`, it is a fact, not a control: a div, not
  focusable, with no hover; the same height, so rows line up.
- **Screen readers**: the pinned card is a region, the popover a dialog,
  both named by `labels.title` ("Details"), as the trigger is.
- The app's: every row and word, the menus, and what a row opens.

### `selection-actions`

A small toolbar by text the reader selects in a region, e.g. an answer:
Quote, and the app's own actions.

```tsx
<SelectionActions
  maxLength={4000}
  actions={
    <>
      <SelectionQuote
        onQuote={({ text }) => {
          composer.current?.insert([
            { type: "quote", text, id: turn.id, source: "Answer" },
          ])
          composer.current?.focus()
        }}
      />
      <SelectionAction onAction={({ text }) => explain(text)}>
        <HugeiconsIcon icon={Comment01Icon} strokeWidth={2} />
        Explain
      </SelectionAction>
    </>
  }
>
  <Markdown>{text}</Markdown>
</SelectionActions>
```

- **When**: a selection with some text in it, starting and ending inside
  the region and not in a field. It shows once a mouse drag ends, a frame
  after a keyboard or script selection, and on touch once the selection
  has held still (300ms), so it never moves under a finger dragging the
  handles. Wrap each answer (an `agent-turn`'s `content` part), or the
  whole conversation and find the message from the `range`. However many
  there are, they share one set of document listeners, and a change of
  selection renders only the region it is in.
- **Where**: above the selection, below it on a touch screen, where the
  OS shows its own menu above. It does not take focus or the selection;
  it follows the selection as the page scrolls and hides while the
  selection is out of view.
- **Keyboard**: Tab moves into it, the arrows move between its buttons,
  Escape hides it (the selection stays; it shows again when the selection
  changes) and focus goes back to where it was.
- **Actions**: `SelectionQuote` (`onQuote`) and `SelectionAction`
  (`onAction`) get `{ text, range }`: `text` is the selection as Markdown
  (`selectionMarkdown`: bold, inline code, links, lists, headings, quotes
  and fenced code with its language kept; buttons and what screen readers skip left out),
  `range` a copy of the selection's. After an action the selection is
  cleared and the toolbar goes. What an action does is the app's; a quote
  usually goes in the composer as a quote chip (above).
- **Too long**: past `maxLength` characters (no limit by default) the
  toolbar says so (`labels.tooLong`, "Selection is too long to quote", a
  status) instead of its actions.
- **Words**: `labels.toolbar` names it ("Selection actions");
  `SelectionQuote`'s `labels.quote` is its button's ("Quote").

### `agent-request`

The agent asks the reader: to allow a tool call, or a question.

```tsx
<AgentRequest
  icon={<HugeiconsIcon icon={Shield01Icon} strokeWidth={2} />}
  decision={
    request.decided && {
      summary: (
        <>
          Allowed <AgentTurnTarget code>git push origin main</AgentTurnTarget>
        </>
      ),
      meta: "Once · by you",
    }
  }
>
  <AgentRequestTitle>Allow the agent to push?</AgentRequestTitle>
  <AgentRequestDescription>
    It pushes main and the v0.1.9 tag.
  </AgentRequestDescription>
  <AgentRequestContent>
    <CodeBlock size="sm">
      <CodeBlockContent wrap>{command}</CodeBlockContent>
    </CodeBlock>
  </AgentRequestContent>
  <AgentRequestFooter>
    <AgentRequestStatus>Asked 4s ago</AgentRequestStatus>
    <Button variant="ghost" size="sm" onClick={deny}>
      Deny
    </Button>
    <Button variant="ghost" size="sm" onClick={always}>
      Always allow
    </Button>
    <Button size="sm" onClick={once}>
      Allow once
    </Button>
  </AgentRequestFooter>
</AgentRequest>
```

- While it asks, it is a card in the composer's place
  (`ComposerTakeover`, in `composer`) and its frame, its icon beside its
  title; the title names it and the description describes it to screen
  readers, and focus moves to it (it takes focus, `tabIndex={-1}`, so
  its keys work there). The reader's choices are in its footer, the
  default last; narrow, as on a phone, the default across and the
  others under it at a finger's size.
- **A notice** of its title and a choice or two alone ("Working in
  another app", Take over) is one row of 44px, the choices at its end on
  the card, with no band under it and no chevron, at any width: give it
  no description or content and it takes that form by itself.
- **In the conversation**, while it waits below, show nothing, or the
  same item with `waiting` (`{ summary, meta: "Waiting for you below" }`):
  a still row, as the decided one.
- **A question** is a `Questionnaire` around the card, its
  `QuestionnaireItem` (`aria-labelledby` the title's `id`) in
  `AgentRequestContent` and a `QuestionnaireNavigation` in the footer;
  `shortcuts="numbers"` lets number keys choose. Each choice is led by
  its number in grey, the chosen one's bold on a grey row; where several
  may be chosen (`multiple`), a checkbox follows the number, filled when
  checked. Of one question, the navigation is its Submit (and Skip, if
  it is optional).
- **Several questions** are one request and one `Questionnaire`, each a
  `QuestionnaireItem` with its `QuestionnaireTitle`, shown one at a
  time; see below.
- **Once decided**, give it `decision`: it is one quiet row, as a step,
  its icon, the `summary` of what was asked and what came of it
  (`<>Where should the release go? <AgentRequestAnswer>Open a PR
</AgentRequestAnswer></>`) and its `meta` ("Answered", "Once · by
  you") at the end. Allowed and denied look the same, only the words
  differ. Opened (`open`, `onOpenChange`, e.g. from `useFold`), it shows
  the card as it was, to read: its footer is gone, and a question shows
  its options as `AgentRequestOptions`, the chosen one `chosen`, in
  place of the `Questionnaire`.
- Where the decision was a tool call's, an `agent-turn` can show it as a
  step instead (a `decision` part), where the agent asked.
- Shortcuts (Enter to allow, Esc to deny) are the app's; name them in a
  tooltip, not in the buttons.

#### Several questions

The agent asks several things at once: one card under a header bar
(`AgentRequestHeader`: its icon and how many there are, over a rule),
the questions one at a time, and a footer that always has a way on. A
choice's `description` is under its words, 12px in the lighter grey.

```tsx
<Questionnaire
  defaultItem={questions[0].name}
  shortcuts="numbers"
  items={items}
  onSubmit={answer}
>
  <AgentRequest>
    <AgentRequestHeader
      icon={<HugeiconsIcon icon={HelpCircleIcon} strokeWidth={2} />}
    >
      The agent has {questions.length} questions
    </AgentRequestHeader>
    <AgentRequestContent>
      {questions.map((question) => (
        <QuestionnaireItem
          key={question.name}
          name={question.name}
          required={question.required}
          multiple={question.multiple}
        >
          <QuestionnaireTitle>{question.title}</QuestionnaireTitle>
          {question.choices ? (
            <QuestionnaireChoices>
              {question.choices.map((choice) => (
                <QuestionnaireChoice key={choice.value} value={choice.value}>
                  {choice.label}
                </QuestionnaireChoice>
              ))}
            </QuestionnaireChoices>
          ) : (
            <QuestionnaireInput aria-label={question.title} />
          )}
          <QuestionnaireError />
        </QuestionnaireItem>
      ))}
    </AgentRequestContent>
    <AgentRequestFooter>
      <QuestionnaireProgress />
      <QuestionnaireNavigation
        size="sm"
        onDecline={decline}
        labels={{ submit: "Answer" }}
      />
    </AgentRequestFooter>
  </AgentRequest>
</Questionnaire>
```

- **The footer**: `QuestionnaireProgress` first ("Question 2 of 4"; it
  shows nothing for one question), the app's own buttons, then
  `QuestionnaireNavigation`: Decline (with `onDecline`), Previous but on
  the first question, Skip on an optional one, Next but on the last,
  Submit on the last. Each shows only where it applies, so whatever the
  question, the reader can go on. Render it whole; a footer with only
  `QuestionnaireSubmit` leaves the first of several questions with no
  way on.
- **Declining the whole request**: `onDecline` adds a quiet (ghost)
  Decline before the navigation, on every question, required ones too;
  the app tells the agent the reader declined (e.g. an "ask the user"
  tool's result). Its words are `labels.decline` ("Dismiss", "Skip
  all"). It is not `QuestionnaireSkip`, which skips one optional
  question, and it submits nothing. In a `QuestionnaireActions` row it
  sits at the start, the navigation at the end; `QuestionnaireDecline`
  is the button alone, for a footer of the app's. A question can also
  be set aside to chat (`ComposerTakeover`'s `aside`).
- **The keys**: a single choice's number key (or a click, or Space)
  chooses it and goes on to the next question; on the last, it waits
  for Enter or Submit. The arrow keys move between the options without
  going on. Several choices toggle with their number keys and go on
  with Enter; a text question takes focus when it shows and goes on
  with Enter. Outside a field, ← goes back and → on once answered.
  `advance={false}` on the `Questionnaire` keeps a single choice from
  going on. (It is on by default: no prop is needed for a choice to go
  on as it is picked.)
- **Waiting**, the row in the conversation can say how far the reader
  is: track each item's `onStatusChange` and give `waiting` a meta of
  "2 of 4 answered · Waiting below".
- **Decided**, the row says what came of them (`summary`: `<>4
questions <AgentRequestAnswer>3 answered, 1 skipped
</AgentRequestAnswer></>`); its card, opened, has each question as an
  `AgentRequestQuestion` (`title`, `meta="Skipped"` for one skipped)
  over its `AgentRequestOptions`, a text answer as one `chosen` option.

**Migrating** a footer of `QuestionnaireSkip` and `QuestionnaireSubmit`:
put `<QuestionnaireProgress />` first and
`<QuestionnaireNavigation size="sm" labels={{ submit: "Answer" }} />`
last in its place; a skip-everything button becomes its `onDecline`
(`labels.decline` for its words). Give each item its question as a
`QuestionnaireTitle` and the card a title for the whole request.

## Blocks agentui adds

### `agent-app`

An agent app's shell. A **project** is the directory a conversation
starts in: a conversation's project is picked before it starts and
fixed after, so a conversation never moves to another project
("continue in another project" is a new conversation).

```tsx
<FoldProvider>
  <AgentApp
    sidebar={
      <AgentAppSidebar
        projects={projects}           // most recently active first, each with its latest conversations
        conversations={loose}         // the conversations in no project, newest first
        conversationCount={looseTotal}
        current={{ conversation: id }}
        href={(target) => …}          // rows are links
        onSelect={(target, event) => { event.preventDefault(); navigate(target) }} // a plain click only
        onNewConversation={(project) => startDraft(project)}
        onSearch={openPalette}        // also ⌘K / Ctrl+K
        onAddProject={chooseDirectory}
        projectMenu={(project) => <DropdownMenuItem>…</DropdownMenuItem>}
        conversationMenu={(conversation) => …}
        footer={<Account />}
      />
    }
  >
    <AgentAppPanels
      title="Files"                   // the app's panel beside the main area
      panel={<Files />}
      open={filesOpen}
      onOpenChange={setFilesOpen}
    >
      <AgentAppHeader
        project={project}
        title={conversation.title}
        onProjectSelect={…}
        actions={<AgentAppPanelTrigger />}
      />
      <MessageScroller>…</MessageScroller>
      <Composer …>
        <ComposerContext
          started={!draft}            // gone once it has started
          projects={projects}
          value={draftProject}        // null for none
          onValueChange={setDraftProject}
          onAddProject={chooseDirectory}
        />
        <ComposerEditor … />
        <InputGroupAddon align="block-end">…</InputGroupAddon>
      </Composer>
    </AgentAppPanels>
  </AgentApp>
</FoldProvider>
```

`chooseDirectory` can open a `FolderPicker` for the group's machine.

- **Conversations under conversations**: a conversation's `children`
  (those started from it) are under it, a level in, each icon under its
  title, joined by elbows in the theme's `--sidebar-tree` line
  (`--sidebar-tree-width`, 1.5px): ├ where more follow, a rounded └ at
  the last; a child's highlight starts where its elbow ends, and no line
  crosses a row's highlight. The parent folds them by its icon (a
  chevron where the pointer or the keys are, a button named for what it
  hides), kept by `use-fold`, and stays a link of its own. A row's
  `mark` is a small mark of the app's before its time, e.g. an
  hourglass for one waiting on something outside it.

- **Layout**: the main area is a card beside the sidebar, on its color
  (shadcn's `variant="inset"`; pass another `variant` for a sidebar
  ruled off from the page); right after the rail while the sidebar is
  closed or folded (a tablet, a foldable), but not on a phone. The
  panel is in the same card, split from the conversation by one line;
  neither the header nor the panel's bar is ruled off. As a book, each
  is a card of its own on its screen, 8px in from the screen's edges.
- **Areas**: the app's `rail` (`AgentAppRail`, below): a column of icons
  beside the sidebar, always there from 640px wide; on a phone, icons
  over their names across the foot of the sidebar's sheet, each a
  finger's size, closing it. With `railPlacement="sidebar"` they are that
  bar at the sidebar's foot at every width (icons only, named for
  screen readers, where a name has no room), and there is no column: not
  for the app's areas, nor for a folded sidebar's buttons. Folded (a
  tablet, a foldable), the sidebar is then a sheet from the window's
  edge, opened by the header's button, and the conversation has the
  column's room too.
- **Widths** (tablets, foldables): the conversation is never narrower
  than `minMainWidth` (600px). Where the sidebar's width leaves it less,
  the sidebar is drawn narrower, down to `minSidebarWidth` (208px); the
  width it was given or dragged to is kept, for a wider window. On a
  touch screen (a tablet upright), where it has no room even so, a
  list and its page first: the rail stays a column, and the sidebar
  stays open beside a conversation as narrow as `minTouchMainWidth`
  (432px, a large phone's width, so the conversation is never
  narrower than a phone's: beside the rail, from 704px; `false` to
  fold instead); the reader may still close it. Where it
  has no room beside it even so, the sidebar folds: the rail stays, its first items the sidebar's
  button, a new conversation and search (the `AgentAppSidebar`'s, where
  it has them), and the sidebar opens as a sheet past the rail. An app
  without a rail gets that column of the sidebar's alone, so the start
  edge always has one. On a touch screen the rail is the desktop's (48px,
  32px icons, their targets 44px unseen); the open sidebar keeps its own
  new conversation and search, 28px wider (268px) for its rows.
  Where an open panel has no room beside the
  conversation either, the panel is a sheet from the end; it opens no
  wider than leaves the conversation its 600px (the reader may drag it
  wider). So at 690×880 (an unfolded phone) the sidebar is folded, under a
  finger as under a mouse, the conversation 634px; at 768×1024, under
  a finger, the sidebar is open, 268px, beside the conversation and the
  panel a sheet, and under a mouse folded; at 880×690 the sidebar is 208px beside
  the conversation; at 720 wide with `minMainWidth={420}` (a foldable
  half open, an app's choice) it is 236px (212 under a finger); at 1024×640 or 1024×768 the panel is
  beside the conversation, the sidebar folded while it is open. Narrower
  than 640px is a phone's layout (below). On a foldable open as a book
  (`horizontal-viewport-segments: 2`) the conversation is on one screen
  and the panel on the other, nothing over the hinge
  (`window.viewport.segments`; at the window's middle where the browser
  has none), not dragged nor expanded (no `AgentAppPanelExpand`). With
  no panel open, a list and its page: the sidebar is the first screen,
  open, its rows 8px short of the hinge, and the conversation the
  second's card (under a titlebar, flat, it reaches the second screen's
  edge, the rule between them there); the sidebar's background goes
  under the hinge, where nothing shows. Nothing closes the sidebar there
  (no button on the rail, the header or the titlebar, no edge to drag),
  which would leave the first screen empty. Half open as a laptop (tabletop,
  `vertical-viewport-segments: 2`), the conversation is on the top
  screen and the `AgentAppDock` the bottom one, its composer 12px under
  the hinge. `useAgentAppLayout()` tells an app's own parts which
  (`phone`, `folded`, `book`, `pinned`, `tabletop`: the hinge's edges).
- **Touch and type scale**: sizes for a finger follow the pointer
  (`pointer: coarse`), not the width: 44px targets (the theme's
  `touch-target`), 40px sidebar rows (44px on a phone), the desktop's
  rail (its icons' targets 44px, unseen), a handle on the sidebar's edge
  to drag it wider or narrower (a tap does not close it), 44px buttons in the header's `actions` and the panel's
  bar (the panel's trigger filled while it is open). The type scale follows the width: the phone's (16px
  body, 16px sidebar rows) below Tailwind's `sm`, 640px, where the app
  is a phone's layout too (`max-sm:` in the components, `useIsMobile()`
  in their code, the sidebar a sheet); from 640px the
  desktop's (14px interface, 16px conversation text, 14px rows), on a
  foldable or a tablet as on a narrow desktop window. Fields are the
  exception: 16px below 768px, as shadcn's `Input` and `Textarea` have
  them (and the composer), since iOS zooms into a smaller field as it
  takes the focus. A mouse at a phone's width keeps the small sizes.
- **Sidebar**: a top bar as tall as the main area's header, with the
  app's `header` (its name or logo) and search as an icon (⌘K or
  Ctrl+K, not while an input method composes, nor where the page has
  taken the key: `preventDefault()` it first to keep it); a new
  conversation; then projects and conversations, as its `layout` has
  them:
  - `list` (the default): the projects flat, each a link to its page
    with its count (or its conversations' most pressing status) at its
    end; then "Conversations", the app's `conversations`, e.g. the
    current project's latest or the latest of all, their "Show all
    (N)" to `conversationsTarget` (e.g. `{ project }`; by default the
    page of the conversations in no project).
  - `tree`: projects, then the conversations in no project (the others
    are in their projects, so a project's activity moves it to the
    top). An open project lists its first `shown` (5) conversations and
    "Show all (12)", to its page; so do the conversations in no
    project, to theirs (`{ noProject: true }`). Projects are open; the
    reader folds one, and it stays folded (`use-fold`, kept by a
    `FoldProvider`) until the reader opens it or arrives in it (its
    page, or one of its conversations). Each project is a group: 16px
    from the one before, its row a heading (its name 13px, medium,
    muted; the text's colour on hover or on its page) over its
    conversations, so they read as its own though their icons share
    its column.

  Pass `groups` for places projects live. Their projects and loose
  conversations merge by default; with multiple groups segmented `Tabs`
  switches to a collapsible section per group, in either layout. Keep
  `groupBy` with `onGroupByChange` in the app, or use `defaultGroupBy`.
  Empty groups show "Nothing here yet"; unavailable groups show their reason
  and cannot add projects or start conversations in their projects.
  `onAddProject(group)` receives the group's id; its loose conversations'
  "Show all" goes to `{ noProject: true, group }`. Apps rename
  `labels.groupByGroup` ("Locations"), e.g. to "Machines".

  On a phone the sidebar is a sheet four fifths of the screen wide, its
  search row a field's box.

- **Sidebar width**: the reader drags the sidebar's edge to make it
  wider or narrower (`defaultSidebarWidth` 240px, from
  `minSidebarWidth` 208 to `maxSidebarWidth` 480); a click on it, Enter
  or Space closes and opens the sidebar. By the keyboard it is a
  splitter (`labels.resize`, "Sidebar width"): the arrows move it 16px
  (64 with Shift), Home and End to its narrowest and widest. To keep
  it, save what `onSidebarWidthChange` gives (pixels, once the reader
  lets go) and pass it back as `defaultSidebarWidth`.
- **Status**: a conversation's `status` is a mark named for screen
  readers, its name in a tooltip, in greys (the sidebar has no colour),
  told apart by their shapes: running (a spinner, its row's title in
  the text's colour), needs you (`waiting`, a ring), failed (`error`, a
  diamond), all three in the text's colour, unread (a grey dot). A
  project in a `list`, or a closed one in a `tree`, shows the most
  pressing of its conversations', or the project's own `status` where
  the app lists only some of them.
- **A conversation's row**: its title, status and `time` ("now", "2h");
  an `icon` before the title (e.g. the agent that runs it, 16px in grey,
  on the project's page too; under a project, in its folder's place, the
  title still under its name); a `detail` as a second line, small and
  grey, cut short (e.g. where it runs: "linux-box · a1b2-c3d4"; an icon
  in it 12px). With a `detail` the row is as tall as its two lines, its
  icon, status, time and menu beside the first. `description` is the
  project's page's line, not the sidebar's.
- **Names**: a project is named by its directory; two of the same name
  say the directories above that tell them apart ("api web", "api
  cli"). Its full path is in tooltips.
- **A project that cannot be used** (`unavailable`, with why: the
  directory is gone, its machine is offline) is shown, with why, and
  cannot be picked or started in: its row has no new-conversation
  button.
- **A new conversation** from the top is in the project of where the
  reader is, or none (with `newConversationProject="none"`, always none);
  from a project's row, in that project. Either way
  it is picked again above the composer (`ComposerContext`), with
  search, "No project" and "Add project…". With `groups`, projects are
  grouped by where they live, e.g. a machine: each headed by its label,
  with its own "No project" and "Add project…"; an unavailable group's
  rows are disabled, with why in its heading. `onValueChange(project, group)`
  and `onAddProject(group)` get the group's id; with more than one group
  the trigger reads "alpha · Spare Laptop", and search matches a group's
  label too. With one group the list is flat and its rows use plain
  "No project" / "Add project…" names, as the trigger is the name alone.
  Once it has started, the
  row is gone, its project in the header; if the app shows more in it
  (`children`, e.g. the machine it runs on), the row stays, its project
  shown, not picked. In a form of the app's (a dialog to start one, a
  project's settings), `ProjectPicker` with `variant="outline"` is the
  field: as wide as it, as a select's trigger, named by its label (give
  it the label's `id`).
- **Header**: the sidebar's button (the rail's, where it is folded or on a touch screen), then "project / title", the project
  a link to its page; on its page, the project alone. The title is the
  page's heading (h1), as a conversation has no other; a page with its
  own (`AgentAppPage`) gives the header no `title`.
- **Titlebar** (`titlebar`, for a desktop app's window, from 640px): a
  bar across the window's top, 40px or the window's own title bar's
  height (`env(titlebar-area-height)`). At its start, past the window's
  own buttons (`env(titlebar-area-x)`, macOS's), back and forward, the
  app's (`{ back: { onClick, disabled }, forward: { onClick, disabled } }`,
  named by `labels.back` and `labels.forward`), and the sidebar's button;
  they stay where they are as the sidebar opens and closes. The header
  (`AgentAppHeader`, unchanged) is in the bar from the sidebar's edge,
  its actions at the end, and none in the main area; closed, it follows
  the buttons. Under the bar, on the window's colour (`--sidebar`), the
  rail, then one card of the sidebar and the main area, 8px from the
  window's end and foot, its corners rounded, a rule between them (the sidebar `variant="sidebar"` by
  default); closed, the main area alone in it. The folded sidebar's
  sheet opens under the bar. The window is dragged by the bar
  (`app-region: drag`), not by its buttons and links. `true` gives a
  bar with the sidebar's button alone. On a phone, no bar.
  A panel beside the main area (`AgentAppPanels`) has its bar in the
  titlebar's row over it, as wide as it, the line between them on up
  through the bar, not a row of its own under it: its own bar (title,
  actions) by itself; a content's own bar, e.g. a `Browser`'s tabs, by
  `useAgentAppPanelBar()`, called in the panel's content and given to
  `Browser`'s `barContainer`. While it is there, the header's
  `AgentAppPanelTrigger` is not, and the bar's `AgentAppPanelClose` is
  that button (the panel's icon and title, expanded) at the window's
  end: one button for the panel, in one place, open or closed.
  A window with no Window Controls Overlay (a WKWebView's, Tauri's on
  macOS) has no `env(titlebar-area-*)`: the app sets its own buttons'
  inset and the bar's height on the root, e.g. `:root {
--agent-app-titlebar-inset: 72px; --agent-app-titlebar-height: 52px }`
  (defaults 0 and 40px). WebKit ignores `app-region`, so the host drags
  the window itself, on a pointerdown in
  `[data-slot=agent-app-titlebar]` whose target is not in
  `agentAppTitlebarControls` (`target.closest(agentAppTitlebarControls)`,
  its buttons, links, fields and focusable elements); both are stable.
  A window with a Window Controls Overlay but no titlebar of the app's
  (e.g. a narrow one) marks the root, `<html
data-window-controls-overlay>` (a PWA's `display-mode:
window-controls-overlay` does by itself): the window's own buttons
  keep their place, the rail and a sidebar's header under them, the
  sidebar's bar and a header at the window's edge past them, the
  sidebar's edge rail and the skip link below them. The app writes none
  of it.
- **Landmarks**: the sidebar is a navigation (`labels.navigation`,
  default "Projects and conversations"); `AgentApp`'s main area, the
  main.
- **A project's page** (`AgentAppProject`, in place of the
  conversation): its name and directory, "New conversation" and the
  app's `actions`; all its conversations, newest first, each with the
  app's `description` ("3 messages · 2 hours ago") and its status, as
  many as the app has loaded ("Load more" while `onLoadMore` is given);
  then the app's own sections, each an `AgentAppProjectSection` with a
  heading, an `action` and a `description` under the heading (its
  instructions, its files, its settings). A row is shadcn's `Item`: its
  title a link over the whole row (none without `href` or `onSelect`),
  and at its end its status, the app's `conversationActions` (icon
  buttons, named by the app) and `conversationMenu` (`DropdownMenuItem`s
  behind a "More for …" button, `labels.conversationMenu`), which stay
  above the link.
  With none of its conversations, the list says so, the header starts one; with
  the app's sections under it, a line says there are none, leaving the
  page to them (`AgentAppConversationList`'s `quiet`). A project that
  cannot be used says why, and has no "New conversation".
- **Conversations in no project**: the sidebar's last section, as
  Codex's "Chats"; in the header, the title alone; above the composer,
  "No project". Their page (`AgentAppConversations`) lists them all as a
  project's page does, and starts one in no project. `conversationCount`
  is how many that page has: with the app's own there too (an agent's
  earlier work), count them, and with none in no project yet the group
  is "Show all (N)" alone. A conversation
  stays where it started: to go on in a project, start one there.
- **Pages**: `AgentAppPage` is the frame of both (title, what it is
  under it, buttons; then sections), and `AgentAppConversationList` their
  list, for the app's own pages. A page under another (Settings → Security,
  a list → one item on a phone) has `back`, `{ label, href, onClick }`:
  above the title, in its column, a muted link with an arrow named by
  the parent page (`onClick` to route, as a row's `onSelect`). A page
  whose content names itself (a form with its own heading) has no
  `title`; the way back and the column stay, its heading under the link
  as a title would be.
  Its `footer` stays at the page's foot as it scrolls, on its colour, in
  its column (at the foot of a short page too): unsaved changes, an
  `Alert variant="warning" role="status"` with its `AlertAction`s. Its
  `description` wraps, read whole. A page of thousands (a long list in a
  `VirtualList`) is `fill`: the page
  does not scroll, and its content (`min-h-0 flex-1`) takes the rest of
  its height under the head and scrolls itself.
- **Rail** (`rail`, an `AgentAppRail`): the app's areas, e.g. chat,
  files and settings, as a column of icons at the window's edge before
  the sidebar (shadcn's `--sidebar-width-icon`, 48px, on a touch screen
  too, its icons' targets 44px), kept while the sidebar is closed or
  folded; its first item is level with the header, its last with a row
  in the sidebar's footer (a `SidebarMenuButton`). The sidebar is the area's, an
  `AgentAppSidebar` for chat, the app's own `Sidebar` for the others.
  An item that is a switch, not an area (the dark theme), has
  `pressed`: a toggle button whose icon says its state, which
  leaves a phone's sidebar open where an area closes it.

  ```tsx
  <AgentApp
    rail={
      <AgentAppRail label="Areas">
        <AgentAppRailItem icon={<HugeiconsIcon icon={BubbleChatIcon} strokeWidth={2} />} label="Chat"
          href="/chat" current={area === "chat"} onClick={route} />
        <AgentAppRailItem icon={<HugeiconsIcon icon={Folder01Icon} strokeWidth={2} />} label="Files" … />
        <AgentAppRailItem icon={<HugeiconsIcon icon={Search01Icon} strokeWidth={2} />} label="Search" onClick={openPalette} />
        <AgentAppRailFooter>      {/* at its foot */}
          <AgentAppRailItem icon={<HugeiconsIcon icon={Settings02Icon} strokeWidth={2} />} label="Settings" … />
        </AgentAppRailFooter>
      </AgentAppRail>
    }
    sidebar={area === "files" ? <FilesSidebar /> : <AgentAppSidebar … />}
  >
  ```

  An app's own item that is another trigger (a popover's, a menu's)
  takes the rail's size and touch target from `railItem`:
  `<PopoverTrigger render={<SidebarMenuButton aria-label="Connect a phone" className={railItem} />}>`.

  An item's name is its tooltip; `current` marks the area the reader is
  in (`aria-current="page"`). With `href` it is a link, and ⌘, Ctrl or
  Shift and a click are the browser's (a new tab); `onClick` gets the
  rest, e.g. `event.preventDefault()` and route. The rail is a
  navigation named by its `label`. On a phone there is no column: the
  same items are a bar across the foot of the sidebar's sheet, each icon
  over its name and a finger's size, where an `AgentAppRailMenu` is (an
  `AgentAppSidebar` has one at its foot; put one last in the app's own
  sidebars), and going to one closes the sheet.

- **Panel** (`AgentAppPanels`): one panel of the app's beside the main
  area, e.g. the conversation's files: on the right, as wide as the
  reader drags it (`defaultSize` "40", `minSize` 280px; the keyboard
  moves its handle too), its bar as tall as the header, with its
  `title`, the app's `actions` and a close button; with `bar={false}`
  its content's own bar is, e.g. a `browser`'s tabs, with an
  `AgentAppPanelClose` at its end. A browser's first tab, its page's
  toolbar start 12px in, and its bar's last button and the toolbar's
  end 12px from the end: one pair of lines down the panel. (A new
  tab's page is the conversation's column, 16px in.) `AgentAppPanelTrigger`
  in the header's `actions` opens and closes it; the app may open it
  itself (a file the agent wrote) and keeps whether it is open, e.g.
  closed where it has nothing to show. Closed with focus in it, focus
  goes back to the trigger, or, with none, to the main area. To keep its width, save what
  `onSizeChange` gives (pixels) and pass it back as `defaultSize`: it
  is read as the panel opens, so a new one while it is open waits for
  the next time. Its handle is named by its title (`labels.resize`).
  `AgentAppPanelExpand` in its bar expands it over the main area (which
  stays rendered, hidden) and back (`labels.expand`, `labels.collapse`);
  it closes unexpanded. `ConversationDetailsTrigger` is another header
  `actions` button; wrap the conversation's scroller and dock in
  `ConversationDetailsArea` for its floating details card (see above).
- **Phone** (narrower than 640px): the header is the sidebar's button, the title in the
  middle (16px) with its project under it, and the app's `actions`,
  each at least 40px. Give them icon buttons (`size="icon"`, with an
  `aria-label`) on phones: a button with text takes the title's room. There is no rail column. The sidebar is a sheet, closed once a row is
  picked; the panel is a sheet from the bottom, nearly the screen's
  height, swiped down to close, with the bar it has beside. Crossing that width, nothing is rendered
  again: the main area stays where it is, and the panel's content is
  one element moved between its place beside it and the sheet (keeping
  a frame's page where the browser moves elements so, e.g. Chrome and
  Firefox; elsewhere a frame loads again), so the app's state in them,
  a draft, a folder open, marks on an image, is kept. ⌘B or Ctrl+B opens and closes the
  sidebar elsewhere.
- **Links**: where `href` gives a row its address (and `projectHref`
  the header's project), a click with ⌘, Ctrl, Shift or Alt, or by
  another button than the main one, is the browser's (a new tab or
  window): `onSelect` and `onProjectSelect` are not called and the
  sidebar stays open, so they may `preventDefault()` every click they
  get and route. `opensElsewhere(event)` tells such a click for the
  app's own links.
- A link first in the page skips to the main area.
- **Labels**: `AgentApp`'s `labels.skip` and `labels.toggleSidebar` (the rail's button), `AgentAppHeader`'s
  `labels.toggleSidebar`, `AgentAppPanels`' `labels.close` (its close
  button, the sheet's too) and `labels.resize`, `AgentAppSidebar`'s
  `labels`. Only the phone's sidebar sheet keeps shadcn's English name.
- The app's: its data and order, addresses and routing, the menus'
  items, adding a project (choosing a directory), search, the account,
  a project's own sections and what the panel shows.

### `agent-turn`

An agent's turn, folded by the rules above. It is a block: `shadcn add`
copies it into the app, which owns it from then on and may change it.

```tsx
<FoldProvider>
  {" "}
  // once, around the conversation
  <Message>
    <MessageContent>
      <AgentTurn
        id={turn.id} // the same for the turn's life
        status={turn.status} // "running" | "done" | "error" | "stopped"
        duration="6m 12s"
        kinds={{ agent: (n) => `explored with ${n} agents` }} // the app's own kinds
        onExpand={(call) => openInPanel(call)} // optional: a command opened in the app's view
        parts={[
          { type: "reasoning", id, text, status: "running" },
          {
            type: "tool",
            id,
            kind: "read",
            path: "src/app.tsx",
            status: "done",
          },
          {
            type: "tool",
            id,
            kind: "command",
            status: "error",
            command:
              "pnpm exec tsc -p tsconfig.app.json --noEmit 2>&1 | head -5",
            description: "Type-check the app", // the agent's own words
            output,
            exitCode: 2,
            duration: "14s",
          },
          {
            type: "tool",
            id,
            kind: "edit",
            path,
            diff,
            added: 1,
            removed: 1,
            status: "done",
          },
          { type: "tool", id, kind: "write", path, status: "done" },
          { type: "content", id, content: <Streamdown>{text}</Streamdown> },
        ]}
      />
    </MessageContent>
  </Message>
</FoldProvider>
```

- A `content` part is anything the agent said or showed: Markdown, a
  `MediaGallery` of images it made, a video.
- `parts` are in the order they happened. The app turns its protocol's
  events into them; a tool call gives its `kind` and its data, and the
  turn words it in each state ("Reading", "Read", "Wants to read",
  "Stopped while reading"):
  - `kind`: `"read"`, `"search"`, `"list"`, `"edit"`, `"write"`,
    `"command"`, or the app's own (a subagent's `"agent"`, `"web"`);
  - `command` and `description`: a shell command and the agent's own
    words for it (`describeCommand` says what it did); `output` and
    `exitCode`: its last lines show when opened, "Exit 2" at its end if
    it failed;
  - `path`, `pattern`: the file or folder, what was searched for;
  - `added`, `removed`, `diff`: an edit's or a write's lines, and its
    change as a unified diff (its hunks, with their numbers; a file's
    edits are merged into one row and one diff).
    `icon`, `title`, `outcome` and `details` take the place of the turn's
    (a subagent's robot and "Exploring the build scripts"); `progress` is
    a line under its words while it is closed ("Reading scripts/build.ts").
- Parts are compared by identity: a part that changes (a step done, more
  of its output, more words) is a new object, and the rest are the same
  ones, as a store's immutable updates give them. A run whose parts are
  all the same objects is not rendered again, so a chunk streamed into a
  turn of 300 steps costs what it costs in a turn of 30 (0.6 ms, not
  2.6 ms; `pnpm perf`). A part changed in place is not seen.
- `describeCommand(command, description?)` (in `src/lib`, exported from
  the block too) is the same rule for an app's own use: it gives
  `{ kind: "read", paths }`, `{ kind: "search", pattern, paths }`,
  `{ kind: "list", path }`, `{ kind: "edit", paths }`, `{ kind: "run",
command }`, `{ kind: "described", description }` or `{ kind: "script"
}`.
- `kinds` says what calls of the app's own kinds did, for a run's line
  ("explored with 3 agents"); calls of a kind it does not name are "used
  2 tools".
- `outputTone(line, call)` tones each line of a command's output, opened:
  `"strong"` (what failed), `"plain"` or `"faint"` (passes, the tally).
  Without it, `agentOutputTone(line)`, which reads what most tools print
  (a cross, FAIL, "error TS…:", "TypeError:" strong; a tick, PASS,
  "Tests …", "Found 1 error", "Done in …" faint).
- While the turn runs its title says how long: the time since
  `startedAt` (milliseconds since the epoch), counted each second
  (`labels.elapsed`, "12s", "1m 05s"), or else `duration`, which the app
  then updates; then the app's `metrics` ("Working · 47s · 38 tok/s").
- While nothing at its end is seen going (between steps; not while a step
  runs or waits for the reader, a thought runs or words come), its end
  has a spinner, still where the reader asks for less motion. With
  nothing come yet that line is all the turn shows, with the title's
  words (no `Marker` needed). Put the turn's `AgentTurnFooter` right
  after it, in the message's content: the footer takes the line's place
  as the turn ends, so nothing under it moves.
- `connection`, while it runs and the app's link to the agent is lost:
  `{ attempt: 2, attempts: 5 }` says "Reconnecting 2/5" at its end,
  shimmering, a Wi-Fi mark in place of the spinner (none between steps
  either); `"offline"`, "Disconnected", once the app stops trying. A
  status, read as it changes (`labels.reconnecting`, `labels.offline`).
- What the turn changed and drew on (`AgentTurnChanges`,
  `AgentTurnSources`) go under its answer once it has ended (done, failed
  or stopped), never while it runs: until then its edits are its steps',
  each opening on its diff, and the card would grow and move under the
  reader with each one. A subagent's turn, in a step's details, has none:
  its edits are the outer turn's. `AgentTurnChanges` includes its own 1.5px
  dotted border-colour rule, with 16px above and below the rule between
  the answer and card; do not add spacing at the call site.
  To open the changes from the turn's footer instead, put an
  `AgentTurnChangesProvider diff={…}` around the `AgentTurn` and its
  `AgentTurnFooter` (in the `MessageContent`), `<AgentTurnChanges />` under
  the answer, and `<AgentTurnChangesTrigger />` as the first child of the
  footer's `AgentTurnInfo`: one of the turn's facts ("3 files changed +6
  −1 ›", a dot after it), in their size and grey, kept where the footer
  is narrow (with the last fact, its words cut first) and where the
  actions show on hover only. Its words are its own `labels`
  (`filesChanged`, one file too, e.g. short, "3 files"; `changes`), apart
  from the card's. It opens the card there, no rule. Closed by default;
  `open` / `defaultOpen` / `onOpenChange` on the provider keep it where the
  app does.
- Ids stay the same for a part's life: what is open is kept by them.
- `labels` gives its words in other languages: the titles (`worked`,
  `failed`, `stopped`, given the turn's `duration` or `undefined`),
  `verb(kind, state)` ("Read", "Reading", "Wants to read", "Stopped while
  reading"), `summary(count, kinds, others)` and `looked(count)` for the lines
  over a run and its reads (`count` is `{ read, searched, listed, edited,
ran, other }`, files once each), `failures`, `edits`, `changes`, `exit`,
  `steer`, `steerClamp`, `superseded`, `cutOffBySteer`,
  `waiting`, `earlierLines`, `allLines`, `copy`, `expand` and the rest.
  Past three groups, `summary` gets three (edits, commands, reads, the
  app's kinds, other tools, in that order of priority) and `others`, what
  `otherActions` says of the rest ("6 other actions"), else "":
  ``{ worked: (d) => (d ? `Gearbeitet: ${d}` : "Fertig"), summary: (c) => `${c.read} Dateien gelesen…` }``.
- `AgentTurnStep` is a call's line alone, outside a turn (a request card,
  a search's match).
- A steered turn has a `steer` part in `parts` (`id`, `content`, optional
  `startedAt`, `duration`, and on the first `before`). Its user bubble
  stays visible between the work folds; the work before and after it each
  has its own fold, titled as a turn's work with its own time ("Worked
  for 1m 30s" before, from `before`; "Worked for 40s" after, from
  `duration`; the last "Working", counted from `startedAt`, while it
  runs). Back-to-back steers split once, using the last steer's duration.
  Where the turn is split is the app's data.
- A `superseded` part (`id`, `parts`, optional `reason`) is an attempt the
  agent replaced, folded to one line. Without a reason, a steer immediately
  after it supplies "Cut off by a steer". `steps` and `onLoadSteps` load its
  parts lazily, with loading and Retry states. Do not mark an attempt whose
  reply finished: the reader needs it; this is the app's call.
- **A subagent** is a tool call of the app's kind (`"agent"`), one line
  as any step: its `icon` (a robot, `Robot01Icon`), what it does
  ("Exploring the build scripts") and, at the line's end, its `outcome`
  in the app's words: "3 steps", "No steps", "Failed", "Stopped". While
  it runs, `progress` says what it is at now ("Reading
  scripts/build.ts"), a smaller line under its words that shimmers; it is
  shown while the call is closed. Its `details` are an `AgentTurn` of its
  own, with its own `id` (its folds are kept by it), its parts and its
  status: in a step's details a turn has no title, rule or answer of its
  own; its steps are listed under the call's words, one level, as they
  came, with no run's line over them (the call's words are that line)
  and its reads each a row, what it said a size smaller and lighter, and
  the step shows a chevron while it is open. It takes the outer turn's
  `outputTone` too. It takes the outer turn's `labels` and `kinds`. What
  it handed back is its last `content` part, an `AgentTurnResult` (its
  label is `labels.result`, "Result", or its `label`): a long one is cut
  to `lines` (6), fading, over "Show all" and how many lines and words it has
  (`clampLabels` for other languages; `lines={false}` shows it all). Done with
  nothing, give it no `details`: the line does not open. Subagents under
  way each stand under their run's line; done, they join it ("Explored
  with 3 agents"). With an `href`, its `AgentTurnTarget` is a link (e.g.
  to the subagent's conversation) on its step's line, shimmering with
  its words while it runs; in a fold's line saying the step under way,
  a button, it is its words alone.

  ```tsx
  {
    type: "tool", id: call.id, kind: "agent", status: call.status,
    icon: <HugeiconsIcon icon={Robot01Icon} strokeWidth={2} />,
    title: <>{running ? "Exploring" : "Explored"} <AgentTurnTarget>{call.task}</AgentTurnTarget></>,
    outcome: call.steps ? `${call.steps} steps` : running ? undefined : "No steps",
    progress: running ? call.current : undefined, // "Reading scripts/build.ts"
    details: call.parts.length > 0
      ? <AgentTurn id={`${call.id}:turn`} status={call.status} parts={[
          ...call.parts,
          ...(call.result ? [{ type: "content", id: `${call.id}:result`,
            content: <AgentTurnResult>{call.result}</AgentTurnResult> }] : []),
        ]} />
      : undefined,
  }
  ```

- **A decision** (the reader allowed or denied a call, or answered a
  question) is a step of its own once made, where the agent asked:
  `{ type: "decision", id, icon: <HugeiconsIcon icon={Shield01Icon}
strokeWidth={2} />, title: <>Allowed
<AgentTurnTarget code>git push origin main</AgentTurnTarget></>, meta:
"Once · by you", details }`. Its icon is before its words, as a call's;
  allowed and denied look the same, only the words differ. While the agent
  waits, its tool call is `waiting` and the question is an
  `agent-request` after the turn.
- **Showing a part** (a search's match, a link to a tool call):
  `agentTurnFolds(turn, partId)` gives the keys of the folds it is in
  (give the turn's `status` too while it runs); open them with
  `useSetFold`, and its own (its id) for its details, then
  `scrollToMessage(messageId, { part: partId })` (`useMessageScroller`)
  puts it 16px below the viewport's start once it is drawn, and holds it
  there while what is above it settles. A call merged into another's
  row (a file's second edit) is in that row's fold.

  ```tsx
  const setFold = useSetFold()
  const { scrollToMessage } = useMessageScroller()
  const show = (turn: Turn, part: string) => {
    for (const key of agentTurnFolds(turn, part)) setFold(key, true)
    scrollToMessage(turn.id, { part })
  }
  ```

For DOM text search across these folds, use `conversation-find`; the folds
keep their content hidden until found only while its find is open.
