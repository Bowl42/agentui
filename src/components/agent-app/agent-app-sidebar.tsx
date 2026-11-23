"use client"

import * as React from "react"
import { cn } from "cn"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert02Icon,
  ArrowDown01Icon,
  ArrowRight01Icon,
  Folder01Icon,
  FolderOpenIcon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
  PlusSignIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons"

import { useFold } from "@/hooks/use-fold"
import {
  ConversationStatusMark,
  pressing,
  statusLabels,
  type ConversationStatus,
} from "./conversation-status"
import { projectNames, type AppProject } from "./project-picker"
import { opensElsewhere, useAgentAppLayout, useSidebarWidth } from "./agent-app"
import { AgentAppRailMenu, sidebarRow } from "./agent-app-rail"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type AppConversation = {
  id: string
  title: string
  /** What the reader should know of it from the list. */
  status?: ConversationStatus
  /** On a project's page, under its title: "3 messages · 2 hours ago". */
  description?: React.ReactNode
  /**
   * On a project's page, its facts in columns after its title, lined up
   * with the other rows' (its branch, its cost, when it was last active);
   * on a phone, a line under its title. One per column, in the same
   * order in every row; `null` leaves a column empty.
   */
  meta?: readonly React.ReactNode[] | undefined
  /**
   * Before its title, in the sidebar and on a project's page: what it is,
   * e.g. the agent that runs it, an icon (16px, in grey).
   */
  icon?: React.ReactNode
  /**
   * In the sidebar, a second line under its title, small and grey, cut
   * short where it is long: e.g. where it runs, "linux-box · a1b2-c3d4".
   */
  detail?: React.ReactNode
  /**
   * When it was last active, short, at its row's end in the sidebar:
   * "now", "2h", "3d"; e.g. a `<time>`.
   */
  time?: React.ReactNode
  /**
   * A small mark of the app's before its time, after its status: e.g. an
   * hourglass for one waiting on something outside it. 14px, in grey;
   * named by the app (an icon with `aria-label`, or text).
   */
  mark?: React.ReactNode
  /**
   * The conversations started from this one, under it, a level in, along
   * a line from its icon; it folds them (kept by `use-fold`), saying how
   * many it hides.
   */
  children?: AppConversation[]
}

/*
 * A conversation's own, a level in: each child's icon under its title,
 * joined to it by an elbow in the sidebar's tree line (`--sidebar-tree`,
 * 1.5px: `--sidebar-tree-width`). The line runs
 * 16px in under the parent's icon, from under its row (never through a
 * row's highlight), and its stub ends at the child row's edge, 8px on,
 * where the row's highlight begins: the child's row starts there, 8px
 * before its icon. ├ where more follow, the line going on beside the
 * child's second line and its own; a rounded └ at the last.
 */
/** The children's list: its rows from 8px past the parent's icon. */
// The parent's icon's middle: 16px in, in a top row as in a child.
const branches = "relative flex min-w-0 flex-col ps-6"
/** A child row: its icon 8px in, its highlight from the stub's end. */
const childRow = "ps-2"
/** The elbow's stub, from the line to the row's edge. */
const elbow =
  // grid: mark
  "before:pointer-events-none before:absolute before:-start-2 before:top-0 before:h-4 before:w-2 before:border-s-(length:--sidebar-tree-width) before:border-b-(length:--sidebar-tree-width) before:border-sidebar-tree max-sm:before:h-5.5 pointer-coarse:before:h-5.5"
/** ├: the line on to the next. */
const tee =
  "after:pointer-events-none after:absolute after:-start-2 after:top-0 after:bottom-0 after:border-s-(length:--sidebar-tree-width) after:border-sidebar-tree"
/** └: the last, its corner rounded. */
const corner = "before:rounded-es-md"
/** The line going on past a child's own, to its parent's next. */
const through = tee

/** The statuses of the conversations under one, at any depth. */
const statusesBelow = (conversation: AppConversation): ConversationStatus[] =>
  (conversation.children ?? []).flatMap((child) => [
    ...(child.status ? [child.status] : []),
    ...statusesBelow(child),
  ])

/** Whether a list holds a conversation, at any depth (a child's too). */
const holds = (
  conversations: readonly AppConversation[],
  id: string | undefined
): boolean =>
  id !== undefined &&
  conversations.some(
    (conversation) =>
      conversation.id === id || holds(conversation.children ?? [], id)
  )

/** Whether a conversation in a list has a status, at any depth. */
const showing = (
  conversations: readonly AppConversation[],
  status: ConversationStatus
) =>
  conversations.some(
    (conversation) =>
      conversation.status === status ||
      statusesBelow(conversation).includes(status)
  )

/** How many conversations are under one, at any depth. */
const descendants = (conversation: AppConversation): number =>
  (conversation.children ?? []).reduce(
    (count, child) => count + 1 + descendants(child),
    0
  )

type AppSidebarProject = AppProject & {
  /**
   * Its latest conversations, newest first: in a `tree`, the first few
   * are listed under it; in a `list`, they give its status, if not
   * `status`, and its count, if not `count`.
   */
  conversations?: AppConversation[]
  /** How many it has, if more than are given. */
  count?: number
  /**
   * At its row's end, in place of its count: e.g. what it costs, or
   * nothing (`null`).
   */
  meta?: React.ReactNode
  /**
   * Its conversations' most pressing status, where not all are given:
   * else it is found from those given.
   */
  status?: ConversationStatus
}

/**
 * A place projects live, e.g. a machine: its projects and its
 * conversations in no project, a section of the sidebar when grouped.
 */
type AppSidebarGroup = {
  /** Its unique id. */
  id: string
  /** Its name, its section's heading. */
  label: string
  /** Before its name, e.g. the kind of place it is (16px, grey). */
  icon?: React.ReactNode
  /** Why it cannot be used now, e.g. "Offline": shown after its name, muted. */
  unavailable?: string
  /** Its projects, in the order to show them; ids unique across groups. */
  projects: AppSidebarProject[]
  /** Its conversations in no project, newest first. */
  conversations?: AppConversation[]
  /** How many of those it has, if more than are given: "Show all (N)". */
  conversationCount?: number
}

/** Where the reader goes: a conversation, or a project's page. */
type AppTarget =
  | { conversation: string }
  | { project: string }
  /** The page of the conversations in no project. */
  | { noProject: true }
  /** A group's page of its conversations in no project. */
  | { noProject: true; group: string }

type AgentAppSidebarLabels = {
  /** The sidebar's landmark, a navigation. */
  navigation: string
  newConversation: string
  /** A project's own new conversation: "New conversation in agentui". */
  newConversationIn: (project: string) => string
  search: string
  projects: string
  /** The tabs between projects and groups, their tablist. */
  groupBy: string
  /** The tab for the projects, flat. */
  groupByProject: string
  /**
   * The tab for the groups: "Locations" by default; apps name
   * it with their word for a place, e.g. "Machines".
   */
  groupByGroup: string
  /** A group with no projects and no conversations. */
  groupEmpty: string
  /** A group's own add button: "Add project in linux-box". */
  addProjectIn: (group: string) => string
  addProject: string
  conversations: string
  /** To a project's page: "Show all (12)". */
  showAll: (conversations: number) => string
  noConversations: string
  projectMenu: (project: string) => string
  conversationMenu: (conversation: string) => string
  /** A folded conversation's "+2", said in full: "2 conversations". */
  childCount: (count: number) => string
  /** The button that folds a conversation's own: "Hide 2 under …". */
  hideChildren: (conversation: string, count: number) => string
  showChildren: (conversation: string, count: number) => string
  status: Record<ConversationStatus, string>
  unavailable: (reason: string) => string
  /** Its edge, which the reader drags to make it wider or narrower. */
  resize: string
}

const defaultLabels: AgentAppSidebarLabels = {
  navigation: "Projects and conversations",
  newConversation: "New conversation",
  newConversationIn: (project) => `New conversation in ${project}`,
  search: "Search",
  projects: "Projects",
  groupBy: "Group by",
  groupByProject: "Projects",
  groupByGroup: "Locations",
  groupEmpty: "Nothing here yet",
  addProjectIn: (group) => `Add project in ${group}`,
  addProject: "Add project",
  conversations: "Conversations",
  showAll: (conversations) => `Show all (${conversations})`,
  noConversations: "No conversations yet",
  projectMenu: (project) => `More for ${project}`,
  conversationMenu: (conversation) => `More for ${conversation}`,
  childCount: (count) =>
    count === 1 ? "1 conversation" : `${count} conversations`,
  hideChildren: (conversation, count) =>
    `Hide ${count === 1 ? "the conversation" : `${count} conversations`} under ${conversation}`,
  showChildren: (conversation, count) =>
    `Show ${count === 1 ? "the conversation" : `${count} conversations`} under ${conversation}`,
  status: statusLabels,
  unavailable: (reason) => `Unavailable: ${reason}`,
  resize: "Sidebar width",
}

/** A group's name: a step under its rows, in the faintest grey, so they lead. */
const groupLabel = "h-8 text-xs text-subtle-foreground"
/**
 * A group's add button, beside its label: 24px, centred on the label's
 * 32px (the group's 8px, then 12px down to its top), in its grey at
 * 14px, the plus at its end on the sidebar's trailing line: the rows'
 * counts', the search row's keys', the new conversation's icon's (the
 * group's padding and a row's, less the button's 4px; an inset sidebar's
 * groups have none of their own).
 */
const groupAction =
  "touch-target top-3 right-3 w-6 justify-end pe-1 text-subtle-foreground group-data-[variant=inset]:right-1 [&>svg]:size-3.5"

const noChange = () => () => {}

/** Where the reader is. */
type Current = {
  conversation?: string
  project?: string
  /** The page of the conversations in no project. */
  noProject?: boolean
  /** With `noProject`: the group whose page it is. */
  group?: string
}

type Navigation = {
  current: Current | undefined
  href: ((target: AppTarget) => string | undefined) | undefined
  onSelect: ((target: AppTarget, event: React.MouseEvent) => void) | undefined
  labels: AgentAppSidebarLabels
}

/** Whether the reader is at a target: its row is the current one. */
function isAt(current: Current | undefined, target: AppTarget) {
  if ("conversation" in target)
    return current?.conversation === target.conversation
  if ("project" in target) return current?.project === target.project
  return (
    current?.noProject === true &&
    current.group === ("group" in target ? target.group : undefined)
  )
}

/** Props for a row that goes somewhere: a link if it has an address. */
function useGo(navigation: Navigation, target: AppTarget) {
  const { setOpenMobile } = useSidebar()
  const href = navigation.href?.(target)
  return {
    render: href ? <a href={href} /> : <button type="button" />,
    onClick: (event: React.MouseEvent) => {
      // A new tab's, or a window's: the browser's, and the sidebar stays.
      if (href && opensElsewhere(event)) return
      navigation.onSelect?.(target, event)
      // On a phone the sidebar is a sheet over what was picked.
      setOpenMobile(false)
    },
  }
}

/**
 * Under a project's name, past its folder: its conversations' rows; a
 * conversation's icon, if any, takes the folder's place instead.
 */
const nested = "ps-8"

/**
 * A row whose mark asks for the reader (running, waiting for them, or
 * failed): its name in the text's colour, as the current row's.
 */
const running = "text-sidebar-foreground"

/** Its mark asks for the reader: it runs, waits for them, or failed. */
const stands = (status: ConversationStatus | undefined) =>
  status === "running" || status === "waiting" || status === "error"

/**
 * A conversation's row with a `detail`: two lines, as tall as they need,
 * its icon, status and time beside the first, where the row's button is.
 */
const twoLines =
  "h-auto items-start py-1 max-sm:h-auto max-sm:py-2 pointer-coarse:h-auto sm:pointer-coarse:h-auto sm:pointer-coarse:py-2"
/** Beside a row's first line: as tall as it, its content in its middle. */
const firstLine = "flex h-6 items-center"

/**
 * A row: 32px and 14px, the current one no bolder; on a phone a finger's
 * height, 44px, on a touch screen from `sm` 40px; its text 14px on a
 * touch screen, 16px on a phone (the phone's type scale, below `sm`).
 */
const row = cn(
  sidebarRow,
  "h-8 gap-2 px-2 text-sm max-sm:h-11 max-sm:text-base pointer-coarse:h-11 sm:pointer-coarse:h-10 data-active:font-normal"
)

/**
 * What is at a row's end, where its buttons show on hover or focus
 * (always on a touch screen): hidden while they are, in their place.
 */
const givesWay =
  "group-has-data-[sidebar=menu-action]/menu-item:group-hover/menu-item:hidden group-has-data-[sidebar=menu-action]/menu-item:group-focus-within/menu-item:hidden group-has-data-[sidebar=menu-action]/menu-item:group-has-data-popup-open/menu-item:hidden group-has-data-[sidebar=menu-action]/menu-item:not-pointer-fine:hidden"

/**
 * A row's facts at its end, a project's count or a conversation's time:
 * small, in the faintest grey. Where the row has buttons, they show in
 * its place on hover or focus (always on a touch screen).
 */
const rowMeta = cn(
  "ms-auto shrink-0 ps-1 text-xs text-subtle-foreground tabular-nums",
  givesWay
)

/**
 * A row with facts at its end: they take the place of its button, which
 * the row leaves room for only while it shows.
 */
/**
 * A project's row over its conversations, as a group's heading: its
 * name smaller, medium and muted (the text's colour on hover or on its
 * page), its conversations' titles in the text's.
 */
const projectHead =
  "text-2sm font-medium text-muted-foreground hover:text-sidebar-foreground data-active:font-medium data-active:text-sidebar-foreground max-sm:text-sm"

/**
 * Room at a row's end, while its buttons show (on hover or focus, always
 * on a touch screen), for what stands there, in columns shared by every
 * kind of row, from the end: the "…" button (4px in, 24px), then a
 * second 24px one 4px before it (a project's new conversation), where a
 * conversation's 16px mark is centred, then the status marks 8px before
 * that. `--row-end` is the room; at rest, the row's own 8px.
 */
const rowEnd = (shown: string) =>
  cn(
    "[--row-end:--spacing(2)] group-has-data-[sidebar=menu-action]/menu-item:pr-(--row-end) rtl:group-has-data-[sidebar=menu-action]/menu-item:pr-2 rtl:group-has-data-[sidebar=menu-action]/menu-item:pl-(--row-end)",
    shown
  )

const metaRoom = rowEnd(
  // grid: clear (the "…" button, 4px in and 24px, a 4px gap, then 4px so a 16px mark is centred where a second button would be)
  "group-hover/menu-item:[--row-end:--spacing(9)] group-focus-within/menu-item:[--row-end:--spacing(9)] group-has-data-popup-open/menu-item:[--row-end:--spacing(9)] not-pointer-fine:[--row-end:--spacing(9)]"
)

/** As `metaRoom`, for a row with two buttons. */
const twoActionsMeta = rowEnd(
  // grid: clear (two 24px buttons, 4px in and 4px apart, and 4px before them)
  "group-hover/menu-item:[--row-end:--spacing(15)] group-focus-within/menu-item:[--row-end:--spacing(15)] group-has-data-popup-open/menu-item:[--row-end:--spacing(15)] not-pointer-fine:[--row-end:--spacing(15)]"
)

/**
 * A row's button, shown on hover or focus, as shadcn's; always on a touch
 * screen, which cannot hover. `second`: before another. Its place
 * past its 24px box is 44px on a touch screen. In the middle of a
 * row's first line, where its marks are: 12px down a phone's 44px row,
 * 8px down a touch screen's 40px one from `sm`.
 */
function RowAction({
  second,
  className,
  ...props
}: React.ComponentProps<typeof SidebarMenuAction> & { second?: boolean }) {
  return (
    <SidebarMenuAction
      showOnHover
      className={cn(
        "touch-target w-6 peer-data-[size=default]/menu-button:top-1 aria-expanded:bg-muted max-sm:peer-data-[size=default]/menu-button:top-3 pointer-coarse:peer-data-[size=default]/menu-button:top-3 sm:pointer-coarse:peer-data-[size=default]/menu-button:top-2",
        // Its row's end, right to left too.
        "rtl:right-auto rtl:left-1",
        second && "right-8 rtl:left-8",
        className
      )}
      {...props}
    />
  )
}

/**
 * A row's menu: beside the sidebar, or below the row on a phone. The
 * row's context menu (a right click, Shift+F10, the menu key) opens it
 * too, where its button opens it; a long press on a touch screen does
 * not, the button is there.
 */
function RowMenu({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  const { isMobile } = useSidebar()
  const [open, setOpen] = React.useState(false)
  const trigger = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    // Its row: the button's parent, with the row's own button in it.
    const row = trigger.current?.parentElement
    if (!row) return
    const opens = (event: MouseEvent) => {
      // A row inside it (a conversation's children) opened its own.
      if (event.defaultPrevented) return
      // Nor one inside it without a menu of its own.
      const item = (event.target as Element).closest("li")
      if (row.tagName === "LI" && item !== row) return
      if ((event as PointerEvent).pointerType === "touch") return
      event.preventDefault()
      setOpen(true)
    }
    row.addEventListener("contextmenu", opens)
    return () => row.removeEventListener("contextmenu", opens)
  }, [])
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        ref={trigger}
        aria-label={label}
        render={<RowAction />}
      >
        <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={isMobile ? "bottom" : "right"}
        align={isMobile ? "end" : "start"}
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** "Show all (12)": to the page of a list the sidebar shows the latest of. */
function ShowAllRow({
  target,
  total,
  here,
  isNested,
  navigation,
}: {
  target: AppTarget
  total: number
  /** Whether the reader is on that page. */
  here: boolean
  isNested: boolean
  navigation: Navigation
}) {
  const go = useGo(navigation, target)
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={go.render}
        onClick={go.onClick}
        isActive={here}
        aria-current={here ? "page" : undefined}
        className={cn(row, isNested && nested)}
      >
        {navigation.labels.showAll(total)}
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function ConversationRow({
  conversation,
  nested: isNested,
  timed,
  menu,
  navigation,
  branch,
  depth = 0,
}: {
  conversation: AppConversation
  /** How deep it is: 0 at the top. */
  depth?: number
  /** Under another: its elbow, ├ with more after it, └ the last. */
  branch?: "middle" | "last" | undefined
  /** In a project: its title under the project's name. */
  nested: boolean
  /**
   * Its list's rows have times: a column for its time, kept without one,
   * so the status marks before it stand in a column too.
   */
  timed: boolean
  menu: ((conversation: AppConversation) => React.ReactNode) | undefined
  navigation: Navigation
}) {
  const go = useGo(navigation, { conversation: conversation.id })
  const active = navigation.current?.conversation === conversation.id
  const labels = navigation.labels
  const items = menu?.(conversation)
  // A column for its time, or one kept where its list's rows have times.
  const timeColumn = conversation.time !== undefined || timed
  const children = conversation.children ?? []
  const parent = children.length > 0
  // Its own open by default, folded as the reader leaves it.
  const [open, setOpen] = useFold(`${conversation.id}:children`, true)
  // Opened where the reader arrives at one of its children, as a project
  // is; folded by them there, it stays folded.
  const arrived = holds(children, navigation.current?.conversation)
    ? navigation.current?.conversation
    : undefined
  const reopen = React.useEffectEvent(() => {
    if (!open) setOpen(true)
  })
  React.useEffect(() => {
    if (arrived !== undefined) reopen()
  }, [arrived])
  const hidden = parent && !open ? descendants(conversation) : 0
  // Folded, its mark the most pressing of its own and those it hides.
  const below = hidden ? statusesBelow(conversation) : []
  const status = hidden
    ? (pressing.find(
        (status) => status === conversation.status || below.includes(status)
      ) ?? conversation.status)
    : conversation.status
  const two = conversation.detail !== undefined && conversation.detail !== null
  // Folded, how many it hides, after its title: "+3", said in full to a
  // screen reader.
  const hiddenSaid = hidden > 0 && (
    <span className="sr-only">{`, ${labels.childCount(hidden)}`}</span>
  )
  const count = hidden > 0 && (
    <span
      data-slot="conversation-count"
      aria-hidden="true"
      className="shrink-0 text-2xs text-subtle-foreground tabular-nums"
    >
      +{hidden}
    </span>
  )
  return (
    <>
      <SidebarMenuItem
        data-slot="conversation"
        data-branch={branch}
        className={branch && cn(elbow, branch === "middle" ? tee : corner)}
      >
        <SidebarMenuButton
          render={go.render}
          onClick={go.onClick}
          isActive={active}
          aria-current={active ? "page" : undefined}
          // Past the project's icon, under its name.
          className={cn(
            row,
            // With an icon, the icon is in the project's folder's place
            // and the title still under its name.
            isNested && conversation.icon === undefined && nested,
            // Room for its button only while it shows: no gap at rest.
            metaRoom,
            stands(status) && running,
            two && twoLines,
            depth > 0 && childRow
          )}
        >
          {conversation.icon !== undefined && (
            <span
              data-slot="conversation-icon"
              aria-hidden="true"
              className={cn(
                "shrink-0 text-muted-foreground *:size-4",
                two ? firstLine : "flex",
                // Its fold's chevron in its place where the pointer or the
                // keys are on the row; folded, on a touch screen, always,
                // which has no pointer to show it.
                parent &&
                  "group-hover/menu-item:opacity-0 group-has-[[data-slot=conversation-fold]:focus-visible]/menu-item:opacity-0",
                hidden > 0 && "pointer-coarse:opacity-0"
              )}
            >
              {conversation.icon}
            </span>
          )}
          {two ? (
            <span className="flex min-w-0 flex-1 flex-col">
              <span className={cn(firstLine, "min-w-0 gap-1")}>
                <span className="truncate">
                  {conversation.title}
                  {hiddenSaid}
                </span>
                {count}
              </span>
              <span
                data-slot="conversation-detail"
                className="h-4 truncate text-2xs text-subtle-foreground max-sm:text-xs pointer-coarse:text-xs [&_svg]:inline [&_svg]:h-3 [&_svg]:w-3 [&_svg]:align-text-bottom"
              >
                {conversation.detail}
              </span>
            </span>
          ) : count ? (
            <span className="flex min-w-0 flex-1 items-center gap-1">
              <span className="truncate">
                {conversation.title}
                {hiddenSaid}
              </span>
              {count}
            </span>
          ) : (
            <span className="min-w-0 flex-1 truncate">
              {conversation.title}
              {hiddenSaid}
            </span>
          )}
          {/* At its end, with no time after it: beside its button while
              that shows, which the row leaves room for only then. */}
          <ConversationStatusMark
            status={status}
            label={labels.status[status ?? "unread"]}
            {...(two ? { className: firstLine } : {})}
          />
          {conversation.mark !== undefined && conversation.mark !== null && (
            <span
              data-slot="conversation-mark"
              className={cn(
                "shrink-0 text-muted-foreground [&_svg]:size-4",
                two ? firstLine : "flex"
              )}
            >
              {conversation.mark}
            </span>
          )}
          {timeColumn && (
            <span
              data-slot="conversation-time"
              aria-hidden="true"
              // As wide as "59m" or a two-character CJK time at least, its text at its end:
              // the marks before times of other widths stand in a column.
              className={cn(
                rowMeta,
                "min-w-9 text-end",
                two && cn(firstLine, "justify-end")
              )}
            >
              {conversation.time}
            </span>
          )}
        </SidebarMenuButton>
        {items && (
          <RowMenu label={labels.conversationMenu(conversation.title)}>
            {items}
          </RowMenu>
        )}
        {parent && (
          // Over its icon (or where one would be): folds its own.
          <button
            type="button"
            data-slot="conversation-fold"
            aria-expanded={open}
            aria-label={
              open
                ? labels.hideChildren(
                    conversation.title,
                    descendants(conversation)
                  )
                : labels.showChildren(
                    conversation.title,
                    descendants(conversation)
                  )
            }
            onClick={() => setOpen(!open)}
            className={cn(
              depth > 0 ? "start-0.5" : "start-1",
              "touch-target absolute top-1 flex size-6 items-center justify-center rounded-md text-muted-foreground ring-sidebar-ring outline-hidden hover:text-sidebar-foreground focus-visible:ring-2 max-sm:top-2 pointer-coarse:top-2 [&>svg]:size-3.5",
              conversation.icon !== undefined &&
                "opacity-0 group-hover/menu-item:opacity-100 focus-visible:opacity-100",
              conversation.icon !== undefined &&
                hidden > 0 &&
                "pointer-coarse:opacity-100"
            )}
          >
            <HugeiconsIcon
              icon={open ? ArrowDown01Icon : ArrowRight01Icon}
              strokeWidth={2}
              className="rtl:data-[open=false]:rotate-180"
              data-open={open}
            />
          </button>
        )}
      </SidebarMenuItem>
      {parent && open && (
        // A level in, along a line from its icon: each under its title.
        // A row of its own, not in the conversation's: hovering one of
        // them is not hovering it.
        <li
          data-slot="conversation-children"
          // Its parent's line goes on past it, to the next under that.
          className={cn("relative list-none", branch === "middle" && through)}
        >
          <ul className={branches}>
            {children.map((child, index) => (
              <ConversationRow
                key={child.id}
                conversation={child}
                nested={false}
                timed={timed}
                menu={menu}
                navigation={navigation}
                branch={index === children.length - 1 ? "last" : "middle"}
                depth={depth + 1}
              />
            ))}
          </ul>
        </li>
      )}
    </>
  )
}

/**
 * A project's facts for its row: how many conversations it has, their
 * most pressing status, and what its row ends with (its count, or the
 * app's `meta`).
 */
function projectFacts(project: AppSidebarProject) {
  const conversations = project.conversations ?? []
  const total = project.count ?? conversations.length
  const status =
    project.status ?? pressing.find((status) => showing(conversations, status))
  const meta = project.meta === undefined ? total || null : project.meta
  return { total, status, meta }
}

/** Whether a row's end has something to show. */
const hasMeta = (meta: React.ReactNode) =>
  meta !== null && meta !== undefined && meta !== false && meta !== ""

/**
 * A project's name, with what tells it apart, then, where it cannot be
 * used, why (beside its name: the row's end is for status, as its
 * conversations' is).
 */
function ProjectRowName({
  project,
  name,
  hint,
  labels,
}: {
  project: AppSidebarProject
  name: string
  hint: string | undefined
  labels: AgentAppSidebarLabels
}) {
  return (
    <>
      <span className="min-w-0 truncate">
        {/* The space outside its span: names read as words. */}
        {hint ? `${name} ` : name}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </span>
      {project.unavailable !== undefined && (
        <span title={project.unavailable} className="flex shrink-0">
          <HugeiconsIcon
            icon={Alert02Icon}
            strokeWidth={2}
            aria-hidden="true"
            className="text-muted-foreground"
          />
          <span className="sr-only">
            {labels.unavailable(project.unavailable)}
          </span>
        </span>
      )}
    </>
  )
}

/**
 * A project in a `list` sidebar: its folder and name, and at its end its
 * conversations' most pressing status, else how many it has; a link to
 * its page, the current row there.
 */
function ProjectListRow({
  project,
  name,
  hint,
  menu,
  navigation,
}: {
  project: AppSidebarProject
  name: string
  hint?: string
  menu?: (project: AppSidebarProject) => React.ReactNode
  navigation: Navigation
}) {
  const labels = navigation.labels
  const go = useGo(navigation, { project: project.id })
  const page = navigation.current?.project === project.id
  const { status, meta } = projectFacts(project)
  const counted = hasMeta(meta) && !status
  const items = menu?.(project)
  return (
    <SidebarMenuItem data-slot="project">
      <SidebarMenuButton
        render={go.render}
        onClick={go.onClick}
        isActive={page}
        aria-current={page ? "page" : undefined}
        className={cn(row, metaRoom, stands(status) && running)}
      >
        <HugeiconsIcon icon={Folder01Icon} strokeWidth={2} aria-hidden="true" />
        <ProjectRowName
          project={project}
          name={name}
          hint={hint}
          labels={labels}
        />
        <ConversationStatusMark
          status={status}
          label={labels.status[status ?? "unread"]}
        />
        {counted && (
          <span
            data-slot="project-count"
            aria-hidden="true"
            className={rowMeta}
          >
            {meta}
          </span>
        )}
      </SidebarMenuButton>
      {items && (
        <RowMenu label={labels.projectMenu(hint ? `${name} ${hint}` : name)}>
          {items}
        </RowMenu>
      )}
    </SidebarMenuItem>
  )
}

/** Whether projects are open: the app's, or each kept by `use-fold`. */
type ProjectsOpen = {
  open: Record<string, boolean> | undefined
  defaultOpen: boolean
  onOpenChange: ((project: string, open: boolean) => void) | undefined
}

function ProjectRow({
  project,
  name,
  hint,
  shown,
  onNewConversation,
  menu,
  conversationMenu,
  navigation,
  openState,
}: {
  project: AppSidebarProject
  name: string
  hint?: string
  shown: number
  openState: ProjectsOpen
  onNewConversation?: (project?: string) => void
  menu?: (project: AppSidebarProject) => React.ReactNode
  conversationMenu?: (conversation: AppConversation) => React.ReactNode
  navigation: Navigation
}) {
  const labels = navigation.labels
  const current = navigation.current
  // Its name with what tells it apart, for the names of its buttons.
  const label = hint ? `${name} ${hint}` : name
  // Where the reader is: its page, or one of its conversations.
  const conversations = project.conversations ?? []
  const here =
    current?.project === project.id ||
    holds(conversations, current?.conversation)
  // On its page: its row is the current one.
  const page = current?.project === project.id
  // Open by default: the reader folds one, and it is kept so (`use-fold`);
  // its first `shown` conversations and "Show all" keep it short.
  const [folded, setFolded] = useFold(
    `${project.id}:project`,
    openState.defaultOpen
  )
  // Or the app's, where it keeps whether each is open.
  const controlled = openState.open?.[project.id]
  const open = controlled ?? folded
  const onOpenChange = openState.onOpenChange
  const setOpen = React.useCallback(
    (next: boolean) => {
      setFolded(next)
      onOpenChange?.(project.id, next)
    },
    [setFolded, onOpenChange, project.id]
  )
  // Opened where the reader arrives, at its page or one of its
  // conversations; folded by them there, it stays folded, and left open
  // when they go: a project does not close by itself.
  const arrived = here ? (current?.conversation ?? current?.project) : undefined
  const reopen = React.useEffectEvent(() => {
    if (!open) setOpen(true)
  })
  React.useEffect(() => {
    if (arrived !== undefined) reopen()
  }, [arrived])
  const { total, status, meta } = projectFacts(project)
  const timed = conversations.some(
    (conversation) => conversation.time !== undefined
  )
  const items = menu?.(project)
  // Its count (or the app's meta) at its end, where no status takes its
  // place.
  const counted = hasMeta(meta) && !(!open && status)
  // None in a project that cannot be used.
  const newHere =
    onNewConversation && project.unavailable === undefined
      ? () => onNewConversation(project.id)
      : undefined

  return (
    // Its row and its conversations side by side, not one in the other:
    // hovering the project would show its conversations' buttons too.
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      // 16px from the project before, its rows close under it: each
      // project a group, though its rows' icons share the column.
      render={<li data-slot="project" className="not-first:mt-4" />}
    >
      <div data-slot="project-row" className="group/menu-item relative">
        <CollapsibleTrigger
          render={
            <SidebarMenuButton
              isActive={page}
              aria-current={page ? "page" : undefined}
              className={cn(
                row,
                projectHead,
                // Room for its buttons only while they show.
                newHere && items ? twoActionsMeta : metaRoom,
                !open && stands(status) && running
              )}
            />
          }
        >
          {/* Open or closed, as its folder. */}
          {open ? (
            <HugeiconsIcon
              icon={FolderOpenIcon}
              strokeWidth={2}
              aria-hidden="true"
            />
          ) : (
            <HugeiconsIcon
              icon={Folder01Icon}
              strokeWidth={2}
              aria-hidden="true"
            />
          )}
          <ProjectRowName
            project={project}
            name={name}
            hint={hint}
            labels={labels}
          />
          {/* While it is closed, its conversations' most pressing status. */}
          {!open && status && (
            <ConversationStatusMark
              status={status}
              label={labels.status[status]}
            />
          )}
          {/* How many conversations it has: in the place of the status,
              which says more, while closed. */}
          {counted && (
            <span
              data-slot="project-count"
              aria-hidden="true"
              className={rowMeta}
            >
              {meta}
            </span>
          )}
        </CollapsibleTrigger>
        {newHere && (
          <RowAction
            second={items !== undefined}
            aria-label={labels.newConversationIn(label)}
            onClick={newHere}
          >
            <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} />
          </RowAction>
        )}
        {items && <RowMenu label={labels.projectMenu(label)}>{items}</RowMenu>}
      </div>
      {/* Clipped as it opens and closes: room for its rows' focus rings. */}
      <CollapsibleContent className="-m-1 p-1">
        <SidebarMenu>
          {conversations.slice(0, shown).map((conversation) => (
            <ConversationRow
              key={conversation.id}
              conversation={conversation}
              nested
              timed={timed}
              menu={conversationMenu}
              navigation={navigation}
            />
          ))}
          {/* Under the project's name, as its conversations are. */}
          {total === 0 && (
            <li
              className={cn(
                "flex h-8 items-center text-sm text-subtle-foreground max-sm:h-11 max-sm:text-base pointer-coarse:h-11 sm:pointer-coarse:h-10",
                nested
              )}
            >
              {labels.noConversations}
            </li>
          )}
          {total > Math.min(shown, conversations.length) && (
            <ShowAllRow
              target={{ project: project.id }}
              total={total}
              here={current?.project === project.id}
              isNested
              navigation={navigation}
            />
          )}
        </SidebarMenu>
      </CollapsibleContent>
    </Collapsible>
  )
}

/** What renders rows, the same flat or in a group's section. */
type Rows = {
  layout: "list" | "tree"
  shown: number
  onNewConversation: ((project?: string) => void) | undefined
  projectMenu: ((project: AppSidebarProject) => React.ReactNode) | undefined
  conversationMenu:
    ((conversation: AppConversation) => React.ReactNode) | undefined
  navigation: Navigation
  openState: ProjectsOpen
}

function ProjectRows({
  projects,
  unavailable,
  ...rows
}: Rows & { projects: AppSidebarProject[]; unavailable?: boolean }) {
  const names = React.useMemo(() => projectNames(projects), [projects])
  return projects.map((project) => {
    const name = names.get(project.id) ?? { name: project.name ?? project.path }
    const common = {
      project,
      ...name,
      navigation: rows.navigation,
      ...(rows.projectMenu ? { menu: rows.projectMenu } : {}),
    }
    return rows.layout === "list" ? (
      <ProjectListRow key={project.id} {...common} />
    ) : (
      <ProjectRow
        key={project.id}
        {...common}
        shown={rows.shown}
        openState={rows.openState}
        {...(!unavailable && rows.onNewConversation
          ? { onNewConversation: rows.onNewConversation }
          : {})}
        {...(rows.conversationMenu
          ? { conversationMenu: rows.conversationMenu }
          : {})}
      />
    )
  })
}

function LooseRows({
  conversations,
  total,
  target,
  shown,
  navigation,
  conversationMenu,
}: Rows & {
  conversations: AppConversation[]
  total: number
  target: AppTarget
}) {
  const timed = conversations.some(
    (conversation) => conversation.time !== undefined
  )
  return (
    <>
      {conversations.slice(0, shown).map((conversation) => (
        <ConversationRow
          key={conversation.id}
          conversation={conversation}
          nested={false}
          timed={timed}
          menu={conversationMenu}
          navigation={navigation}
        />
      ))}
      {total > Math.min(shown, conversations.length) && (
        <ShowAllRow
          target={target}
          total={total}
          here={isAt(navigation.current, target)}
          isNested={false}
          navigation={navigation}
        />
      )}
    </>
  )
}

/**
 * A group's section: its heading, which folds it (kept by `use-fold`,
 * opened again where the reader arrives), then its projects and its
 * conversations in no project.
 */
function GroupSection({
  group,
  rows,
  onAddProject,
}: {
  group: AppSidebarGroup
  rows: Rows
  onAddProject: ((group?: string) => void) | undefined
}) {
  const [open, setOpen] = useFold(`${group.id}:group`, true)
  const { current, labels } = rows.navigation
  const conversations = group.conversations ?? []
  const total = group.conversationCount ?? conversations.length
  const target = { noProject: true, group: group.id } as const
  const here =
    isAt(current, target) ||
    holds(conversations, current?.conversation) ||
    group.projects.some(
      (project) =>
        project.id === current?.project ||
        holds(project.conversations ?? [], current?.conversation)
    )
  React.useEffect(() => {
    if (here && !open) setOpen(true)
  }, [here, open, setOpen])
  const status = pressing.find(
    (status) =>
      group.projects.some(
        (project) => projectFacts(project).status === status
      ) || showing(conversations, status)
  )
  const add = onAddProject && group.unavailable === undefined
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      render={
        <SidebarGroup
          data-slot="agent-app-group"
          data-group={group.id}
          className="group-data-[variant=inset]:px-0"
        />
      }
    >
      <SidebarGroupLabel
        render={<h2 />}
        className={cn(
          groupLabel,
          "h-auto px-0 text-muted-foreground",
          // Room for its add button: where any group has one, the
          // chevrons stand in a column.
          // grid: clear (room for the 28px add button)
          onAddProject && "pe-7"
        )}
      >
        <CollapsibleTrigger className="touch-target flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-start ring-sidebar-ring outline-hidden focus-visible:ring-2">
          {group.icon && (
            <span
              aria-hidden="true"
              className="flex shrink-0 text-muted-foreground *:size-4"
            >
              {group.icon}
            </span>
          )}
          <span className="truncate">
            {group.label}
            {group.unavailable !== undefined && (
              <span className="text-subtle-foreground">
                {` · ${group.unavailable}`}
              </span>
            )}
          </span>
          <span className="ms-auto flex shrink-0 items-center gap-2">
            {!open && status && (
              <ConversationStatusMark
                status={status}
                label={labels.status[status]}
              />
            )}
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              aria-hidden="true"
              className={cn(
                "size-4 motion-safe:transition-transform",
                !open && "-rotate-90"
              )}
            />
          </span>
        </CollapsibleTrigger>
      </SidebarGroupLabel>
      {add && (
        <SidebarGroupAction
          className={groupAction}
          aria-label={labels.addProjectIn(group.label)}
          onClick={() => onAddProject(group.id)}
        >
          <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} />
        </SidebarGroupAction>
      )}
      {/* Clipped as it opens and closes: room for its rows' focus rings. */}
      <CollapsibleContent className="-m-1 p-1">
        <SidebarGroupContent>
          <SidebarMenu>
            <ProjectRows
              {...rows}
              projects={group.projects}
              unavailable={group.unavailable !== undefined}
            />
            <LooseRows
              {...rows}
              conversations={conversations}
              total={total}
              target={target}
            />
            {group.projects.length === 0 &&
              total === 0 &&
              conversations.length === 0 && (
                <li className="flex h-8 items-center px-2 text-sm text-subtle-foreground max-sm:h-11 max-sm:text-base pointer-coarse:h-11 sm:pointer-coarse:h-10">
                  {labels.groupEmpty}
                </li>
              )}
          </SidebarMenu>
        </SidebarGroupContent>
      </CollapsibleContent>
    </Collapsible>
  )
}

/**
 * The sidebar's edge, in an `AgentApp`: dragged, it makes the sidebar
 * wider or narrower; clicked, or by Enter or Space, it closes and opens
 * it. A splitter: the arrow keys change its width, Home and End to its
 * narrowest and widest. Under a finger, a handle to see on it (a thin
 * line 4 by 32px, 24px wide to take hold of), dragged without the page scrolling;
 * a tap on it does not close the sidebar.
 */
function SidebarEdge({ label }: { label: string }) {
  const sidebarWidth = useSidebarWidth()
  const { toggleLabel, pinned } = useAgentAppLayout()
  const { open, toggleSidebar, isMobile } = useSidebar()
  // A drag ends with a click, which is not one.
  const dragged = React.useRef(false)
  // Nor is a finger's tap: the sidebar closes by its button.
  const tapped = React.useRef(false)
  // None on a sheet, nor as a book's first screen: its width the screen's.
  if (isMobile || pinned) return null
  if (!sidebarWidth) return <SidebarRail label={toggleLabel} />
  const { width, min, max, resize, commit, setDragging } = sidebarWidth
  // Its side: the edge's distance is the sidebar's on the left, less on
  // the right.
  const along = (element: HTMLElement) =>
    element.closest("[data-side=right]") ? -1 : 1

  // Followed on the window, where the pointer goes as it drags.
  function startDrag(event: React.PointerEvent<HTMLButtonElement>) {
    tapped.current = event.pointerType === "touch"
    if (event.button !== 0 || !open) return
    const x = event.clientX
    const sign = along(event.currentTarget)
    const from = width
    let moved = false
    const to = (event: PointerEvent) => from + (event.clientX - x) * sign
    const move = (event: PointerEvent) => {
      if (!moved && Math.abs(event.clientX - x) < 4) return
      if (!moved) setDragging(true)
      moved = true
      resize(to(event))
    }
    const end = (event: PointerEvent) => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", end)
      window.removeEventListener("pointercancel", end)
      if (!moved) return
      setDragging(false)
      if (event.type === "pointercancel") return resize(from)
      dragged.current = true
      // Where the pointer left the edge, the click is not the edge's.
      setTimeout(() => (dragged.current = false))
      commit(to(event))
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", end)
    window.addEventListener("pointercancel", end)
  }

  return (
    <SidebarRail
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={open ? width : 0}
      aria-valuemin={0}
      aria-valuemax={max}
      title={undefined}
      tabIndex={0}
      className={cn(
        "cursor-ew-resize! touch-none focus-visible:outline-none focus-visible:after:bg-ring",
        // Under a finger: 24px wide, a thin line on its line while it is
        // open (4 by 32px, no edge, as a tablet's split screen's), darker
        // as it is held.
        "pointer-coarse:w-6 pointer-coarse:group-data-[side=left]:-right-6 pointer-coarse:before:absolute pointer-coarse:before:top-1/2 pointer-coarse:before:left-1/2 pointer-coarse:before:h-8 pointer-coarse:before:w-1 pointer-coarse:before:-translate-1/2 pointer-coarse:before:rounded-full pointer-coarse:before:bg-foreground/20 pointer-coarse:group-data-[state=collapsed]:before:hidden pointer-coarse:active:before:bg-foreground/40"
      )}
      onPointerDown={startDrag}
      onClick={() => {
        const tap = tapped.current
        tapped.current = false
        if (!dragged.current && !tap) toggleSidebar()
      }}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 64 : 16
        const grow = along(event.currentTarget)
        const keys: Record<string, (() => void) | undefined> = {
          ArrowLeft: open ? () => commit(width - step * grow) : undefined,
          ArrowRight: open ? () => commit(width + step * grow) : undefined,
          Home: open ? () => commit(min) : undefined,
          End: open ? () => commit(max) : undefined,
        }
        const act = keys[event.key]
        if (!act) return
        event.preventDefault()
        act()
      }}
    />
  )
}

/**
 * An agent app's sidebar: its name and a new conversation, a search row
 * with its keys, then its projects and conversations, two ways:
 *
 * - `list` (the default): the projects flat, each to its page, then
 *   "Conversations", the app's: e.g. the current project's latest, or
 *   the latest of all.
 * - `tree`: projects, each opening to its latest conversations, then the
 *   conversations in no project. Projects are open; the reader folds one
 *   (kept by `use-fold`, or by the app with `projectsOpen`), and it opens
 *   again where the reader arrives.
 *
 * With more than one of `groups` (places projects live, e.g. machines), a
 * segmented control (tabs) under the search row lists them by project, as above, or by
 * group: a section each, folded by its heading, with its projects then its
 * conversations in no project. An empty one says so; an unavailable one
 * says why after its name, and starts nothing. The app keeps `groupBy`
 * with `onGroupByChange`, or starts at `defaultGroupBy`.
 *
 * Rows are 28px of 13px, a project's count and a conversation's time at
 * their ends. A project shows its conversations' most pressing status
 * (needs you, failed, running, unread) in place of its count, in a tree
 * while it is closed; in greys, told apart by their shapes. Rows are
 * links where `href` gives an address.
 */
function AgentAppSidebar({
  projects: projectsProp,
  conversations: conversationsProp,
  conversationCount: conversationCountProp,
  groups,
  groupBy: groupByProp,
  defaultGroupBy = "project",
  onGroupByChange,
  conversationsTarget = { noProject: true },
  layout = "list",
  current,
  href,
  onSelect,
  onNewConversation,
  newConversationProject = "current",
  onSearch,
  onAddProject,
  projectMenu,
  conversationMenu,
  shown = 5,
  projectsOpen,
  defaultProjectsOpen = true,
  onProjectOpenChange,
  header,
  footer,
  labels: labelsProp,
  variant,
  ...props
}: Omit<React.ComponentProps<typeof Sidebar>, "onSelect"> & {
  /**
   * In the order to show them, e.g. most recently active first. With
   * `groups`, the groups' by default, in their order.
   */
  projects?: AppSidebarProject[]
  /**
   * The places projects live, e.g. machines: with more than one, tabs
   * lists them by project (all merged) or by group, a section each.
   */
  groups?: AppSidebarGroup[]
  /** By project or by group, where the app keeps it. */
  groupBy?: "project" | "group"
  /** By project or by group at first: by project by default. */
  defaultGroupBy?: "project" | "group"
  /** As the reader changes it, for the app to keep. */
  onGroupByChange?: (groupBy: "project" | "group") => void
  /**
   * The "Conversations" group's, newest first; the first `shown` are
   * listed. In a `tree`, the conversations in no project (the others are
   * under theirs); in a `list`, the app's: e.g. the current project's.
   * With `groups`, theirs by default, in their order.
   */
  conversations?: AppConversation[]
  /**
   * How many their page has, if more than are given: "Show all (N)". With
   * none given but some on the page (e.g. the app's own under them), the
   * group is "Show all" alone. With `groups` and no `conversations`, the
   * sum of theirs.
   */
  conversationCount?: number
  /**
   * Where the group's "Show all" goes: the page of the conversations in no
   * project by default; e.g. `{ project }` where it lists a project's.
   */
  conversationsTarget?: AppTarget
  /**
   * `list`: the projects flat, to their pages, then the conversations;
   * `tree`: each project opening to its conversations.
   */
  layout?: "list" | "tree"
  /** Where the reader is. */
  current?: Current
  /** A target's address, to make its row a link. */
  href?: (target: AppTarget) => string | undefined
  /**
   * On going to a target; e.g. `event.preventDefault()` and route. Not
   * for a click that opens a row's address elsewhere (⌘ or Ctrl, a new
   * tab), which is the browser's.
   */
  onSelect?: (target: AppTarget, event: React.MouseEvent) => void
  /**
   * A new conversation: in a project from its row; from the top, as
   * `newConversationProject` says, to change before it starts.
   */
  onNewConversation?: (project?: string) => void
  /**
   * Where a new conversation from the top (its button, the rail's and its
   * keys) starts: `current`, the project of where the reader is, or none;
   * `none`, in no project. A project's row always gives its project.
   */
  newConversationProject?: "current" | "none"
  /** Search, also by ⌘K or Ctrl+K. */
  onSearch?: () => void
  /** Add a project: by group, in that group (its id). */
  onAddProject?: (group?: string) => void
  /** `DropdownMenuItem`s for a project: e.g. open its page, remove it. */
  projectMenu?: (project: AppSidebarProject) => React.ReactNode
  /** `DropdownMenuItem`s for a conversation: e.g. rename, delete. */
  conversationMenu?: (conversation: AppConversation) => React.ReactNode
  /**
   * The conversations an open project, or the group, lists: `Infinity`
   * for all.
   */
  shown?: number
  /**
   * Which projects are open, by id, to keep (e.g. in the app's settings):
   * one not in it is as `defaultProjectsOpen`. Without it, each is kept
   * by `use-fold` (a `FoldProvider`'s `defaultValue` and
   * `onValueChange` persist them).
   */
  projectsOpen?: Record<string, boolean>
  /** Whether projects are open at first: all of them (true) or none. */
  defaultProjectsOpen?: boolean
  /** As the reader opens or closes a project, or arrives in one. */
  onProjectOpenChange?: (project: string, open: boolean) => void
  /**
   * In its top bar, beside search: e.g. the app's name or logo; an
   * `AgentAppSidebarTitle` where it is a button.
   */
  header?: React.ReactNode
  /** Below: e.g. the reader's account. */
  footer?: React.ReactNode
  labels?: Partial<AgentAppSidebarLabels>
}) {
  const projects = React.useMemo(
    () => projectsProp ?? groups?.flatMap((group) => group.projects) ?? [],
    [projectsProp, groups]
  )
  const conversations =
    conversationsProp ??
    groups?.flatMap((group) => group.conversations ?? []) ??
    []
  const conversationCount =
    conversationCountProp ??
    (groups && !conversationsProp
      ? groups.reduce(
          (sum, group) =>
            sum + (group.conversationCount ?? group.conversations?.length ?? 0),
          0
        )
      : undefined)
  const [grouping, setGrouping] = React.useState(defaultGroupBy)
  const groupBy = groupByProp ?? grouping
  const canGroup = (groups?.length ?? 0) > 1
  const grouped = canGroup && groupBy === "group"
  const labels = { ...defaultLabels, ...labelsProp }
  const navigation: Navigation = { current, href, onSelect, labels }
  const openState: ProjectsOpen = {
    open: projectsOpen,
    defaultOpen: defaultProjectsOpen,
    onOpenChange: onProjectOpenChange,
  }
  // The project of where the reader is, for a new conversation.
  const looseTotal = conversationCount ?? conversations.length
  const currentProject =
    newConversationProject === "none"
      ? undefined
      : (current?.project ??
        (groups?.flatMap((group) => group.projects) ?? projects).find(
          (project) => holds(project.conversations ?? [], current?.conversation)
        )?.id)

  const rows: Rows = {
    layout,
    shown,
    onNewConversation,
    projectMenu,
    conversationMenu,
    navigation,
    openState,
  }
  return (
    <SidebarShell
      header={header}
      footer={footer}
      {...(variant ? { variant } : {})}
      labels={labels}
      onSearch={onSearch}
      {...(onNewConversation
        ? { onNewConversation: () => onNewConversation(currentProject) }
        : {})}
      beforeContent={
        canGroup && (
          <SidebarHeader className="py-2 group-data-[variant=inset]:px-0">
            {/* A segmented control: it changes how the rows below are
                grouped, so no panels of its own. */}
            <Tabs
              value={groupBy}
              onValueChange={(value) => {
                if (value !== "project" && value !== "group") return
                if (groupByProp === undefined) setGrouping(value)
                onGroupByChange?.(value)
              }}
            >
              <TabsList aria-label={labels.groupBy} className="w-full">
                <TabsTrigger value="project" className="touch-target">
                  {labels.groupByProject}
                </TabsTrigger>
                <TabsTrigger value="group" className="touch-target">
                  {labels.groupByGroup}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </SidebarHeader>
        )
      }
      {...props}
    >
      {grouped ? (
        groups?.map((group) => (
          <GroupSection
            key={group.id}
            group={group}
            rows={rows}
            onAddProject={onAddProject}
          />
        ))
      ) : (
        <>
          <SidebarGroup
            data-slot="agent-app-projects"
            className="group-data-[variant=inset]:px-0"
          >
            <SidebarGroupLabel className={groupLabel}>
              {labels.projects}
            </SidebarGroupLabel>
            {onAddProject && (
              <SidebarGroupAction
                className={groupAction}
                aria-label={labels.addProject}
                onClick={() => onAddProject()}
              >
                <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} />
              </SidebarGroupAction>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                <ProjectRows {...rows} projects={projects} />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {/* With more than it lists, even none: "Show all" goes to them. */}
          {looseTotal > 0 && (
            <SidebarGroup
              data-slot="agent-app-conversations"
              className="group-data-[variant=inset]:px-0"
            >
              <SidebarGroupLabel className={groupLabel}>
                {labels.conversations}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <LooseRows
                    {...rows}
                    conversations={conversations}
                    total={looseTotal}
                    target={conversationsTarget}
                  />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </>
      )}
    </SidebarShell>
  )
}

/** The words a sidebar's shell says. */
type ShellLabels = Pick<
  AgentAppSidebarLabels,
  "navigation" | "newConversation" | "search" | "resize"
>

/**
 * A sidebar's shell, the same in each: its top bar (the app's `header`
 * and a new conversation), a search row with its keys (⌘K or Ctrl+K),
 * the app's `footer`, its edge to resize and reopen it, the rail's menu
 * on a phone; folded, its new conversation and search the rail's.
 */
function SidebarShell({
  header,
  footer,
  onNewConversation,
  onSearch,
  labels,
  variant: variantProp,
  beforeContent,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Sidebar>, "onSelect"> & {
  header?: React.ReactNode
  footer?: React.ReactNode
  onNewConversation?: () => void
  onSearch?: (() => void) | undefined
  labels: ShellLabels
  /** Between the search and the rows: e.g. their grouping's tabs. */
  beforeContent?: React.ReactNode
}) {
  const hasNew = onNewConversation !== undefined
  const hasSearch = onSearch !== undefined
  const newLabel = labels.newConversation
  const searchLabel = labels.search
  const { setOpenMobile, state: sidebarState, isMobile } = useSidebar()
  const collapsedAway =
    !isMobile &&
    sidebarState === "collapsed" &&
    (props.collapsible ?? "offcanvas") === "offcanvas"
  const {
    phone,
    folded,
    railControls,
    railInSidebar,
    setSidebarActions,
    setSidebarVariant,
    titlebar,
  } = useAgentAppLayout()
  // Under a titlebar, flat in its card beside the main area.
  const variant = variantProp ?? (titlebar ? "sidebar" : "inset")
  // Where the rail has them, the sidebar's name stands alone.
  const inRail = railControls && !folded && !railInSidebar && !phone
  // Inset, the main area is a card on it, while it is folded too.
  React.useLayoutEffect(() => {
    setSidebarVariant(variant)
    return () => setSidebarVariant(null)
  }, [setSidebarVariant, variant])
  // Known only in the browser; "Ctrl K" where it is rendered on a server.
  const mac = React.useSyncExternalStore(
    noChange,
    () => /Mac|iP/.test(navigator.platform),
    () => false
  )

  const search = React.useEffectEvent(() => onSearch?.())
  React.useEffect(() => {
    if (!onSearch) return
    const onKeyDown = (event: KeyboardEvent) => {
      // Not while a key composes text (an input method), nor where the
      // page has taken the key.
      if (event.isComposing || event.defaultPrevented) return
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        search()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onSearch])

  // Folded, its new conversation and search are the rail's too.
  const latest = React.useRef({ newConversation: () => {}, search: () => {} })
  React.useLayoutEffect(() => {
    latest.current = {
      newConversation: () => onNewConversation?.(),
      search: () => onSearch?.(),
    }
  })
  const keys = mac ? "Meta+K" : "Control+K"
  React.useLayoutEffect(() => {
    setSidebarActions({
      ...(hasNew
        ? {
            newConversation: {
              label: newLabel,
              run: () => latest.current.newConversation(),
            },
          }
        : {}),
      ...(hasSearch
        ? {
            search: {
              label: searchLabel,
              run: () => latest.current.search(),
              keys,
            },
          }
        : {}),
    })
    return () => setSidebarActions(null)
  }, [setSidebarActions, hasNew, hasSearch, newLabel, searchLabel, keys])

  return (
    // By default the main area is a card beside it, on its color.
    <Sidebar
      variant={variant}
      // As a sheet, named as its navigation.
      sheetTitle={labels.navigation}
      sheetDescription={null}
      // Folded, its sheet opens past the rail, which stays in sight; on a
      // phone, four fifths of its width.
      {...(folded && !railInSidebar
        ? {
            sheetClassName: cn(
              "data-[side=left]:left-12 pointer-coarse:data-[side=left]:left-18",
              // Under the titlebar, which keeps its buttons in sight.
              titlebar &&
                "data-[side=left]:top-(--agent-app-titlebar) data-[side=left]:h-auto"
            ),
          }
        : phone
          ? { sheetClassName: "data-[side=left]:w-4/5" }
          : {})}
      {...props}
    >
      {/* A landmark: shadcn's sidebar is a plain box. Collapsed off the
          canvas, its rows are not focused or read, nor seen once it has
          slid away: wider than it slides (a column for the rail in it),
          a part would stay in the window, under the rail and the
          window's own buttons. */}
      <nav
        data-slot="agent-app-sidebar-navigation"
        aria-label={labels.navigation}
        inert={collapsedAway}
        className="flex min-h-0 flex-1 flex-col transition-[visibility] motion-size group-data-[collapsible=offcanvas]:invisible"
      >
        {/* Its name and a new conversation: level with the main area's
          header, as tall where it is a bar of its own (a rule under it
          beside a main area that is not a card on it, none in a sheet);
          a 32px row in an inset sidebar's padding, 36px on a touch
          screen, its middle the header's. */}
        <div
          data-slot="agent-app-sidebar-bar"
          className={cn(
            "flex shrink-0 items-center gap-1 border-sidebar-border ps-4 pe-2",
            phone
              ? "h-12"
              : titlebar
                ? // Under the titlebar, the card's first row: no rule.
                  "mt-1 h-10"
                : "h-12 not-in-data-[mobile=true]:border-b group-data-[variant=inset]:mt-2 group-data-[variant=inset]:h-8 group-data-[variant=inset]:border-b-0 group-data-[variant=inset]:ps-2 group-data-[variant=inset]:pe-0 pointer-coarse:h-13 group-data-[variant=inset]:pointer-coarse:h-9"
          )}
        >
          <div className="min-w-0 flex-1 truncate text-sm font-semibold has-data-[slot=agent-app-sidebar-title]:overflow-visible pointer-coarse:text-base">
            {header}
          </div>
          {onNewConversation && !inRail && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    // Its icon on the trailing line, as the rows'
                    // counts are: 2px past the bar's padding.
                    className="touch-target relative me-0.5 text-muted-foreground"
                    aria-label={labels.newConversation}
                    onClick={() => {
                      onNewConversation()
                      setOpenMobile(false)
                    }}
                  />
                }
              >
                <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} />
              </TooltipTrigger>
              <TooltipContent>{labels.newConversation}</TooltipContent>
            </Tooltip>
          )}
        </div>
        {onSearch && !inRail && (
          // A row that opens the app's search, its keys at its end; on a
          // phone, a field's box.
          <SidebarHeader
            data-slot="agent-app-sidebar-search"
            className="pt-2 pb-2 group-data-[variant=inset]:px-0"
          >
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className={cn(
                    row,
                    "text-subtle-foreground max-sm:rounded-xl max-sm:bg-background max-sm:inset-ring max-sm:inset-ring-sidebar-border"
                  )}
                  aria-keyshortcuts={keys}
                  onClick={onSearch}
                >
                  <HugeiconsIcon icon={Search01Icon} strokeWidth={2} />
                  <span>{labels.search}</span>
                  <kbd
                    aria-hidden="true"
                    className="ms-auto font-sans text-2xs text-subtle-foreground max-sm:hidden pointer-coarse:hidden"
                  >
                    {mac ? "⌘K" : "Ctrl K"}
                  </kbd>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>
        )}
        {beforeContent}
        {/* Its rows fade where they scroll under its edges. */}
        <SidebarContent className="scroll-fade-y">{children}</SidebarContent>
        {footer && (
          <SidebarFooter className="group-data-[variant=inset]:px-0">
            {footer}
          </SidebarFooter>
        )}
        <AgentAppRailMenu />
      </nav>
      {/* Its edge beside its rows, not in them: collapsed, it still opens
          it again. */}
      <SidebarEdge label={labels.resize} />
    </Sidebar>
  )
}

/** A row of an area's sidebar: a place in it, e.g. "Images". */
type AppAreaItem = {
  id: string
  label: string
  icon?: React.ReactNode
  /** At its end, in the faintest grey: how many it has, "128". */
  count?: React.ReactNode
  /** Where the reader is: its row is the current one. */
  current?: boolean
  /** Its address: the row is a link. */
  href?: string
  /**
   * On going to it; e.g. `event.preventDefault()` and route. Not for a
   * click that opens its address elsewhere (⌘ or Ctrl, a new tab).
   */
  onSelect?: (event: React.MouseEvent) => void
}

/** A group of an area's rows, under its label if it has one. */
type AppAreaSection = {
  id: string
  label?: string
  items: AppAreaItem[]
}

/** AgentAppAreaSidebar's words, for other languages. */
type AgentAppAreaSidebarLabels = ShellLabels

/**
 * The sidebar of an area of the app other than its conversations, e.g.
 * its files: the conversations' sidebar's top bar, search row (⌘K),
 * footer, edge and sheet, with the app's `sections` of rows in their
 * look, each a place to go: its icon, its label, a count at its end.
 */
function AgentAppAreaSidebar({
  sections,
  header,
  footer,
  onNewConversation,
  onSearch,
  labels: labelsProp,
  variant,
  ...props
}: Omit<React.ComponentProps<typeof Sidebar>, "onSelect"> & {
  sections: AppAreaSection[]
  /** In its top bar: e.g. the app's name or logo. */
  header?: React.ReactNode
  /** Below: e.g. the reader's account. */
  footer?: React.ReactNode
  /** A new conversation, from its top bar (and the rail's, folded). */
  onNewConversation?: () => void
  /** Search, also by ⌘K or Ctrl+K. */
  onSearch?: () => void
  labels?: Partial<AgentAppAreaSidebarLabels>
}) {
  const labels = { ...defaultLabels, ...labelsProp }
  return (
    <SidebarShell
      header={header}
      footer={footer}
      {...(variant ? { variant } : {})}
      labels={labels}
      onSearch={onSearch}
      {...(onNewConversation ? { onNewConversation } : {})}
      {...props}
    >
      {sections.map((section) => (
        <SidebarGroup
          key={section.id}
          data-slot="agent-app-area-section"
          className="group-data-[variant=inset]:px-0"
        >
          {section.label !== undefined && (
            <SidebarGroupLabel className={groupLabel}>
              {section.label}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {section.items.map((item) => (
                <AreaRow key={item.id} item={item} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </SidebarShell>
  )
}

/** An area's row: a link if it has an address, the current one lit. */
function AreaRow({ item }: { item: AppAreaItem }) {
  const { setOpenMobile } = useSidebar()
  const { href } = item
  return (
    <SidebarMenuItem data-slot="agent-app-area-item">
      <SidebarMenuButton
        render={href ? <a href={href} /> : <button type="button" />}
        onClick={(event: React.MouseEvent) => {
          // A new tab's, or a window's: the browser's, and the sidebar
          // stays.
          if (href && opensElsewhere(event)) return
          item.onSelect?.(event)
          // On a phone the sidebar is a sheet over what was picked.
          setOpenMobile(false)
        }}
        isActive={item.current ?? false}
        aria-current={item.current ? "page" : undefined}
        className={row}
      >
        {item.icon}
        <span className="min-w-0 truncate">{item.label}</span>
        {item.count !== undefined && item.count !== null && (
          <span data-slot="agent-app-area-count" className={rowMeta}>
            {item.count}
          </span>
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

/**
 * The sidebar's `header` as a button (e.g. renaming the workspace): its
 * words where a title's are, as heavy, and its hover's grey around
 * them, 8px out; a chevron after them with `chevron`, where it opens a
 * menu.
 */
function AgentAppSidebarTitle({
  className,
  children,
  chevron = false,
  ...props
}: React.ComponentProps<"button"> & {
  /** Whether a chevron follows its words, where it opens a menu. */
  chevron?: boolean
}) {
  return (
    <button
      type="button"
      data-slot="agent-app-sidebar-title"
      className={cn(
        "touch-target relative -ms-2 flex h-8 max-w-full min-w-0 items-center gap-1 rounded-md px-2 font-semibold outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring aria-expanded:bg-sidebar-accent [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
        className
      )}
      {...props}
    >
      <span className="min-w-0 truncate">{children}</span>
      {chevron && <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} />}
    </button>
  )
}

export {
  AgentAppAreaSidebar,
  AgentAppSidebar,
  AgentAppSidebarTitle,
  SidebarEdge,
  type AgentAppAreaSidebarLabels,
  type AppAreaItem,
  type AppAreaSection,
  type AgentAppSidebarLabels,
  type AppConversation,
  type AppSidebarProject,
  type AppSidebarGroup,
  type AppTarget,
  type ConversationStatus,
}
