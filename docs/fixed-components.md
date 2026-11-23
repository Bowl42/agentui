# Fixed components

Each is shadcn's `base-nova` file with the smallest change that fixes it,
marked in the code with an `// agentui:` comment. They are temporary: once
shadcn ships a fix, the item is deleted and apps take shadcn's file again
(`shadcn add <name> --overwrite`).

These are the fixes to behaviour, accessibility and looks. Every fixed
item, including those changed only to keep to the [grid](grid.md), is
described in full in its `registry.json` entry, and `pnpm upstream`
shows each diff from shadcn's file.

## `attachment`

Running titles pause out of view. A filled variant for pasted-text chips and a 64px square image tile variant with corner actions and scrolling snap; a focus ring on keyboard focus only. Depends on the fixed `button`.

## `bubble`

The reactions pill floats over the bubble's edge raised by `shadow-float`, not cut out by a ring of the card's colour, which in dark was a light ring on the page.

## `button`

In dark, an outline button is a hairline on the page's colour (recessed on a card), as in light, not shadcn's bright input-coloured edge on a white tint. A field's edge keeps its 3:1.

## `calendar`

Arrow keys move between days (the day button's ref was never attached); day names contain the visible number ("Sunday, 31 May 2026", WCAG 2.5.3); builds with `exactOptionalPropertyTypes`.

## `carousel`

Unsubscribes from Embla's `reInit` event. A pixel of room inside the clip, so a card's ring is not cut off.

## `code-block`

`CodeBlockCopyButton` takes `labels` (`copy`, `copied`) for its name and what it announces, so apps in other languages need no copy button of their own; it says copied only while its `value` is the one copied, so streaming output is not claimed as copied. Output that streams in renders and lays out only its new lines: lines are memoized, the header and footer are matched as children rather than with a descendant `:has()` (which restyled the whole block on every line), and the lines are a grid only when numbered. At 3,000 lines a chunk takes 2–4 ms instead of 30–45 ms (`pnpm perf`). A diff is in greys, as the theme is: added lines a light grey with their +, removed ones struck through in the faintest grey (`--subtle-foreground`) on no tint, with their −; code is 12px on 20px lines, as the interface around it is 13px; line tints and pressed toggles are tinted by the foreground, as `bg-muted` is the dark theme's code surface and vanished. The block has a hairline `border-border` and a card's corners (`rounded-xl`) (not a form field's `border-input`); the header is a 36px bar over a divider, its title in grey mono; line numbers are a step lighter; the copy button floating over the code is raised by `shadow-float`; the destructive block (failed output) is told in greys by weight, its text and title heavier, not red; the header's buttons and toggles are one size (28px, icons 16px); the content fades at the edges it scrolls past, down as well as sideways; and the content is `translate="no"`, so a page translator (Chrome's) leaves code, diffs and output as written.

## `combobox`

Names the icon-only trigger, clear and chip remove buttons; the trigger next to the input leaves the tab order. The list lines up with the whole field (its input is Base UI's input group). No ring on the popup: the theme's `shadow-md` and `shadow-lg` are `shadow-float`, which has its own hairline. Rows 32px tall with an 8px radius and 6px either side of a separator, the same in every menu.

## `command`

The separator is a presentational rule: a listbox may only contain options and groups. Rows 32px tall with an 8px radius and 6px either side of a separator, the same in every menu.

## `context-menu`

No ring on the popup: the theme's `shadow-md` and `shadow-lg` are `shadow-float`, which has its own hairline. Rows 32px tall with an 8px radius and 6px either side of a separator, the same in every menu. On a phone a long press opens it as a sheet from the bottom (`phone-sheet`).

## `drawer`

The grabber is the 36×5 bar drawn (shadcn's is 96×4), and the overlay is a flat scrim, without the blur of the page behind it.

## `dialog`, `sheet`

The close buttons take `closeLabel`, their name for other languages; "Close" was written in.

## `dropdown-menu`

No ring on the popup: the theme's `shadow-md` and `shadow-lg` are `shadow-float`, which has its own hairline. Rows 32px tall with an 8px radius and 6px either side of a separator, the same in every menu. On a phone it opens as a sheet from the bottom (`phone-sheet`).

## `hover-card`

No ring on the popup: the theme's `shadow-md` and `shadow-lg` are `shadow-float`, which has its own hairline.

## `input-group`

Looks disabled only when its input or textarea is: a disabled send button no longer greys out a field you can type in. A contenteditable control (the composer's) is `:focus-visible` whenever it has focus, even by pointer, so it darkens the border a step instead of taking the dark border and 3px ring. A popup opened from inside the group (a composer's toolbar menu) opens clear of the whole group, not over its text (`inputGroupPopupOffset`), and where the group folds its trigger away, from the button that stands for it (`inputGroupPopupAnchor`).

## `marker`

A marker that is a button or link takes a rounded focus ring, as the trace's, not the browser's square outline; the separator is a step smaller (12px text in a 24px row), as a divider in a conversation.

## `menubar`

No ring on the popup: the theme's `shadow-md` and `shadow-lg` are `shadow-float`, which has its own hairline. Rows 32px tall with an 8px radius and 6px either side of a separator, the same in every menu.

## `message`

8px between the parts of its content. What its parts follow (a footer lifts the avatar, a ghost bubble takes the header's and footer's padding) is set as variables by the message's own `:has()`, not by each part's `group-has-*/message`: those made the browser restyle the whole message for every node streamed into it, 60 ms a word at 2,000 paragraphs with an avatar or a footer (an `AgentTurnFooter` is one), 2 ms now (`pnpm perf`).

## `message-scroller`

Its primitive (`@shadcn/react` 0.3.1's) is part of it, as `message-scroller-primitive`: a scroll costs a few rect reads a frame, not every message's on every scroll event. Its messages are windowed: those far from the view keep their height but not their content. Scrolling, what the reader looks at stays put as messages above it mount at their real height, in WebKit and Firefox too. A message rebuilt in place while followed at the end (its nodes taken out and put back with a layout read between, as a renderer finishing a streamed reply does) keeps it followed: the browser moved the scroll up as if the message were gone, which read as the reader scrolling away, so in WebKit a reply was often left as it ended. With `autoScroll`, "Scroll to start" stays at the start: it jumps there, as @shadcn/react 0.3.1 pulls a smooth scroll back to the end. Call `scrollToStart({ behavior: "auto" })` yourself for the same reason. `scrollToMessage` keeps the message in place while the messages above it render at their real height (on a fresh mount it ended up several messages away), until the reader scrolls. Without `autoScroll`, the end it opens at (`defaultScrollPosition="end"`) or `scrollToEnd` goes to is held while messages settle, images load and more comes, until the reader scrolls or a new `scrollAnchor` message is anchored; it was left as soon as anything changed size. A row replaced by another (a waiting row by a decided one: as many rows as before) is not a new message: @shadcn/react 0.3.1 scrolled up to the first `scrollAnchor` message there when it mounted, which it never marks, and held it, so a conversation followed at the end was left for its top. Use the `useMessageScroller` this file exports. `useMessageScrollerRelease` ends a hold before the app scrolls to a find match. Its buttons take a finger at 44px, and hand the focus to the viewport once they have scrolled, where it fell to the page; with reduced motion they jump to the end too, and fade without sliding. They float raised by `shadow-float`, which shows in dark, as `shadow-md` hardly did.

## `navigation-menu`

Its popup floats as other popups do (`shadow-float`), not on Tailwind's default shadow and a ring.

## `pagination`

Page links are links, not buttons.

## `questionnaire`

Choices are light rows, not a stack of form fields: no border (but a keyboard focus's ring) and a grey row when checked; invalid, the choices and the Other field stay grey and the error is a line of an icon and red words under them; a choice's number key leads it in a hairline square and shows the choice, filled when checked, in place of the radio or checkbox; the Other field among the choices is one of their rows, its placeholder in grey, led by the key after the choices', which types in it.

## `popover`

No ring on the popup: the theme's `shadow-md` and `shadow-lg` are `shadow-float`, which has its own hairline. `PopoverContent` takes Base UI's `anchor`, for a popup whose trigger is hidden. On a phone it opens as a sheet from the bottom (`phone-sheet`).

## `scroll-area`

No unused `React` import (fails `noUnusedLocals`).

## `select`

No ring on the popup: the theme's `shadow-md` and `shadow-lg` are `shadow-float`, which has its own hairline. Rows 32px tall with an 8px radius and 6px either side of a separator, the same in every menu. On a phone its list opens as a sheet from the bottom (`phone-sheet`).

## `slider`

Takes `getAriaValueText` for its thumbs, so a slider of named steps (Low, Medium, High) says the step's name.

## `spinner`

Builds with Hugeicons: it no longer passes an SVG `strokeWidth` (a string or number) to `HugeiconsIcon`, which takes a number only.

## `switch`

Off, a light track with a hairline and a grey thumb, quieter than on; its size is in rem, so the thumb stays inside it at any root font size.

## `tabs`, `toggle-group`

`orientation` reaches Base UI, so vertical ones take ArrowUp and ArrowDown. The default tab list has a hairline round it, and the active tab a hairline edge and a faint shadow, without the bright border shadcn gives it in dark; only the line variant has a line under its tab, so a list scrolling sideways does not scroll down. In dark, a pressed toggle-group item is a step lighter than a hovered one; both were `bg-muted`, hardly off the background.

## `toast`

A dialog's radius and no border, as `shadow-lg` (the theme's `shadow-float`) has its own hairline.

## `sidebar`

`SidebarProvider` takes `sheet`: the sidebar is a sheet wider than a phone too, where the page has no room for it beside the main area; `Sidebar` takes `sheetClassName` for that sheet, e.g. to open it past a rail. `agent-app` folds its sidebar so on tablets and unfolded phones.

## `tooltip`

24px tall, a 6px radius, 11px words (`text-2xs`) and no arrow: a small label, as in the rest of agentui.

## `trace`

Running titles pause out of view. Pending and description text keep 4.5:1 contrast; a failed line is marked in greys, by weight, not red, and does not tint its fold's title; a fold's title and content are its rows' size (text-sm); a line's description is its result, smaller, at the line's end, so results line up in a column; with reduced motion a fold opens and its chevron turns at once.

## `use-highlighted-code`

Builds with `exactOptionalPropertyTypes` (used by `code-block`). Code in greys, as the theme is (keywords bold, strings lighter, comments lighter still and italic), each token 4.5:1 or more on the page, muted surfaces and diff tints; terminal output keeps its ANSI colours, at 4.5:1 too, and dimmed text (2m) a lighter step that still is (Shiki gave it half opacity); bold, italic, underline and strikethrough show.

## `use-mobile`

A phone below 640px (Tailwind's `sm`), not 768px; `useSyncExternalStore` instead of setting state in an effect.

## Known upstream issues

Not fixed here:

- `command` (cmdk): the empty state leaves the listbox without options.
- The shadcn CLI (`@shadcn/registry` 0.2.1), with `"rsc": false`, removes
  `"use client"` from every other file it writes, so which files keep it
  depends on the order they were added. It does nothing in a Vite app, but
  shows up in diffs: set `"rsc": true` in the app's `components.json` and
  every file keeps the directive as the registry serves it.
- `menubar` in Safari: Base UI gives the focus guards around an open menu
  `role="button"` for VoiceOver, which a menubar may not contain.
