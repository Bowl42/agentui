# agentui

Components for agent apps (conversations, tool calls, a composer, viewers
for what an agent opens) as a [shadcn/ui](https://ui.shadcn.com) registry.
They build on shadcn's `base-nova` components ([Base UI](https://base-ui.com)
and Tailwind CSS v4) and come with an accessible theme and fixes for a few
upstream components.

> **Status:** pre-release (0.x). Breaking changes can come in any release;
> its notes say what to change.

[See every component in Storybook](https://bowl42.github.io/agentui/).

This is not an npm package. As with shadcn, the CLI copies each component
into your app, where you own and edit it. Every component has stories that
are also its tests, run in Chromium, Firefox and WebKit, in light and dark,
with accessibility checks.

## Quick start

In an app set up for shadcn's `base-nova` style (for example
`pnpm dlx shadcn@latest init -t vite -b base -p nova`), with
`"iconLibrary": "hugeicons"` in its `components.json`, add the theme and
whatever components you need from a release, by their URLs:

```sh
pnpm dlx shadcn@latest add https://raw.githubusercontent.com/Bowl42/agentui/v0.1.26/public/r/theme.json
pnpm dlx shadcn@latest add https://raw.githubusercontent.com/Bowl42/agentui/v0.1.26/public/r/composer.json
```

Each item brings what it depends on, from the same release. For shorter
names, add the registry to `components.json`:

```json
{
  "registries": {
    "@bowl42": "https://raw.githubusercontent.com/Bowl42/agentui/v0.1.26/public/r/{name}.json"
  }
}
```

and add `@bowl42/<name>`:

```sh
pnpm dlx shadcn@latest add @bowl42/composer @bowl42/agent-turn
```

- **Pin a release.** Each item and everything it depends on is read at
  the tag in the URL; the [releases](https://github.com/Bowl42/agentui/releases)
  list them, and their notes say what to change. Change the tag to
  upgrade, and re-add every item you use, in one call.
- **Icons.** The components draw [Hugeicons](https://hugeicons.com).
  Set `"iconLibrary": "hugeicons"` before you add shadcn's own components,
  so that theirs match.
- **shadcn's components.** Add them from shadcn's registry as usual. Where
  this registry has a fixed version (see [below](#fixed-shadcn-components)),
  add it after shadcn's, and again after any update from shadcn:
  `pnpm dlx shadcn@latest add --overwrite @bowl42/use-mobile`.
- **Without a release.** `pnpm dlx shadcn@latest add Bowl42/agentui/<name>`
  reads main, one request per file. To use a local checkout, run
  `pnpm registry:build` in it and add the built file:
  `pnpm dlx shadcn@latest add ../agentui/public/r/<name>.json`.

[Building an app](docs/building-apps.md) shows how the pieces make an agent
app's screens.

## What's in it

### Theme

`theme` is shadcn's neutral theme. Its changes:

- It meets WCAG 2.2 AA contrast.
- It uses the platform's system fonts.
- It adds tokens: a third grey, status colours (success, warning, info),
  colour-blind-safe chart colours, a floating shadow, and extra type and
  radius steps.
- An app can set its own palette from seven base colours, and the rest is
  derived from them.

[docs/theme.md](docs/theme.md) has all of it. [docs/grid.md](docs/grid.md)
covers the spacing and sizing grid the components keep to, and `check-grid`
checks it for an app's own code.

### Blocks

Copied into your app as a starting point to edit.

| Item         | What it is                                                                                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agent-app`  | An agent app's shell: a sidebar of projects and conversations, a header, the project picker for a new conversation, and a resizable side panel. It adapts to tablets, foldables and phones. |
| `agent-turn` | An agent's turn: its reasoning, tool calls and messages, folded to a one-line summary above its answer when done ("Worked for 6m 12s").                                                     |

### Conversation

| Item                            | What it is                                                                                            |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `markdown`                      | An agent's Markdown, streamed or not, at a conversation's reading rhythm.                             |
| `user-message`                  | A message the user sent: a bubble cut to six lines, its files and links as chips, its actions.        |
| `agent-launch`                  | New tasks the agent proposes to start, each a title, a line of meta and its message, edited in place. |
| `agent-request`                 | The agent asks: approve a tool call or answer a question, in the composer's place.                    |
| `agent-event`                   | Something from outside, e.g. a monitor's line, a background task's end or a wake-up.                  |
| `agent-turn-changes`            | What a turn changed and drew on: files edited, sources read.                                          |
| `tool-call-data`                | A tool call's input or output, for a tool the app has no view of its own for.                         |
| `plan-card`                     | A proposed plan to revise or implement.                                                               |
| `todo-list`                     | An agent's to-do list: how many are done and which item is in progress.                               |
| `message-error`                 | Why a turn failed and what to do next.                                                                |
| `message-divider`               | An event between messages: a day, the context compacted, the model switched.                          |
| `message-outline`               | A long answer's outline, beside it or in a button at its top.                                         |
| `message-reader`                | A message read on its own, over the conversation, with its outline and search.                        |
| `message-scroller-load-earlier` | Loads earlier messages of a long conversation.                                                        |
| `conversation-skeleton`         | A conversation not here yet: a message asked and the lines of an answer.                              |
| `conversation-find`             | Ctrl/⌘F through a conversation, folded parts included.                                                |
| `conversation-minimap`          | A conversation's map, a tick per user message, in the margin.                                         |
| `conversation-details`          | A conversation's details: where it runs, its branch and changes, its subagents.                       |
| `selection-actions`             | A toolbar by selected text: quote it, or the app's own actions.                                       |
| `media-gallery`                 | Images, videos and recordings in a message, opening a viewer of them all.                             |
| `diff-block`                    | A unified diff, a code block per file.                                                                |
| `table-preview`                 | A table to look at, copy and download, framed as a code block.                                        |
| `clamp`                         | Content cut to a number of lines, with a row that shows the rest.                                     |
| `chip`                          | The one chip look for files, images, links and mentions.                                              |

### Composer

| Item              | What it is                                                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `composer`        | A chat's message box, built on [Lexical](https://lexical.dev): mentions, files and links as chips, attach, paste and drop, dictation, send or stop, an expanded editor with preview. |
| `composer-queue`  | Messages queued while a turn runs, to edit, reorder or send now.                                                                                                                     |
| `composer-select` | A choice of one from the composer's toolbar, such as a mode or an agent.                                                                                                             |
| `model-picker`    | A model and how hard it thinks.                                                                                                                                                      |
| `voice-mode`      | A spoken conversation with the agent: an orb that moves with the voice, captions, mute and end; a page of its own or a bar in the composer's place.                                  |
| `long-text`       | Text with long runs without a space (an address, base64, a hash) folded, so its layout stays bounded.                                                                                |

### Viewers

For a side panel, or over the whole window.

| Item              | What it is                                                                        |
| ----------------- | --------------------------------------------------------------------------------- |
| `viewer`          | The frame every viewer shares: toolbar, find, zoom, status bar.                   |
| `viewer-overlay`  | A viewer over the whole window, e.g. for a conversation's image.                  |
| `browser`         | Tabs of pages, each with its own history: web pages, files, media, the app's own. |
| `code-viewer`     | A file's code: highlighted, numbered, folding, find and go-to-line.               |
| `files-viewer`    | A folder's files as a tree, list, columns or grid.                                |
| `folder-picker`   | A folder chooser, in a dialog or a panel.                                         |
| `media-viewer`    | An image (zoom, versions, compare, mark areas), a video or a recording.           |
| `pdf-viewer`      | A PDF from the app's rendered pages: thumbnails, outline, find.                   |
| `table-viewer`    | A table such as a CSV file: column types, sort, filter.                           |
| `terminal-viewer` | Terminal output with ANSI colours, a tab per process.                             |

### Other components

| Item                | What it is                                                          |
| ------------------- | ------------------------------------------------------------------- |
| `auth-page`         | A sign-in or sign-up page around the app's form.                    |
| `copy-button`       | An icon button that copies a value and says so.                     |
| `floating-button`   | A round button floating over content, e.g. jump to end.             |
| `status-mark`       | A status as a small mark: a dot, ring or diamond, or a spinner.     |
| `usage-meter`       | How much is used, as a ring or a bar.                               |
| `stat`              | Headline numbers and facts of a page.                               |
| `code-readout`      | A short code to type elsewhere, such as a one-time code.            |
| `qr-code`           | A string as an SVG QR code.                                         |
| `search-highlight`  | A search's terms highlighted in text, as a reader would match them. |
| `aspect-ratio-icon` | An aspect ratio drawn as an icon.                                   |
| `virtual-list`      | A list of thousands of items that renders only those in view.       |
| `virtual-grid`      | The same for a grid or masonry.                                     |

### Hooks and helpers

| Item                | What it is                                                                           |
| ------------------- | ------------------------------------------------------------------------------------ |
| `use-fold`          | Whether a part of a conversation is open, by the app's rule and the reader's choice. |
| `use-follow-end`    | Keeps a growing element scrolled to its end until the reader scrolls away.           |
| `use-overflow`      | Whether an element's content overflows it.                                           |
| `use-shimmer-pause` | Pauses shimmering text while it is out of view.                                      |
| `phone-sheet`       | Opens menus, popovers and selects as a sheet from the bottom on a phone.             |
| `zoom`              | The zoom steps the viewers share.                                                    |
| `check-grid`        | A script that lists what in an app's code is off the grid.                           |

### Fixed shadcn components

Fixed versions of shadcn's `base-nova` components. Each makes the smallest
change that fixes accessibility, a bug, or its fit with the theme, and
the change is marked `// agentui:` in the code. Each is dropped once
shadcn ships a fix.

`accordion`, `alert`, `alert-dialog`, `attachment`, `avatar`, `badge`,
`breadcrumb`, `bubble`, `button`, `button-group`, `calendar`, `card`,
`carousel`, `chart`, `code-block`, `collapsible`, `combobox`, `command`,
`context-menu`, `dialog`, `drawer`, `dropdown-menu`, `empty`, `field`,
`hover-card`, `input`, `input-group`, `input-otp`, `item`, `marker`,
`menubar`, `message`, `message-scroller`, `native-select`,
`navigation-menu`, `pagination`, `popover`, `questionnaire`,
`scroll-area`, `select`, `sheet`, `sidebar`, `slider`, `spinner`,
`switch`, `tabs`, `textarea`, `toast`, `toggle`, `toggle-group`,
`tooltip`, `trace`, `use-highlighted-code`, `use-mobile`.

[docs/fixed-components.md](docs/fixed-components.md) lists the fixes, and
`registry.json` describes each item.

## Development

Requires Node 24 or later and pnpm.

```sh
scripts/setup.sh   # enable the git hooks
pnpm install
pnpm exec playwright install chromium-headless-shell firefox webkit
pnpm storybook     # http://localhost:6006
pnpm check:quick   # lint, format, types, registry (the pre-commit hook)
pnpm check:pr      # those and the story tests in Chromium (CI on a pull request)
pnpm check         # everything, with the story tests in three browsers
```

See [CONTRIBUTING.md](CONTRIBUTING.md). Security issues go to
[SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
