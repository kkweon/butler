import Tab = chrome.tabs.Tab
import HistoryItem = chrome.history.HistoryItem
import BookmarkTreeNode = chrome.bookmarks.BookmarkTreeNode

/**
 * Sub-panels that a browser action can open instead of running immediately.
 */
export type BrowserActionPanel = 'move-tabs-to-window'

/**
 * Represents a browser action that can be performed, e.g., "Open Settings".
 */
export interface BrowserAction {
  /** The display name of the action. */
  name: string
  /** The function to execute when the action is triggered. */
  action: () => Promise<void>
  /**
   * When set, selecting this action opens the named sub-panel instead of
   * running `action` and closing the popup.
   */
  panel?: BrowserActionPanel
}

/** Which stage of the command palette is currently on screen. */
export type PaletteMode =
  { readonly kind: 'search' } | { readonly kind: 'move'; readonly tabs: Tab[] }

/**
 * A destination shown in the "move tabs to another window" sub-panel.
 */
export interface MoveTarget {
  /** `new-window` is the synthetic first entry; `window` wraps an open window. */
  readonly kind: 'new-window' | 'window'
  /** The `chrome.windows.Window` id, or null for the new-window entry. */
  readonly windowId: number | null
  /** Primary row text: the window's active tab title, or "New window". */
  readonly label: string
  /** Secondary row text, e.g. "5 tabs · GitHub, Gmail, Docs". */
  readonly subtitle: string
  /** Favicon of the window's active tab. Empty for the new-window entry. */
  readonly faviconUrl: string
  /**
   * Every tab title in the window. Kept as an array because Fuse indexes array
   * values element-wise, so a window matches on any tab it contains.
   */
  readonly tabTitles: string[]
  /** Every tab URL in the window, indexed the same way as `tabTitles`. */
  readonly tabUrls: string[]
}

/**
 * Represents a generic search result item, which could be a tab, history entry, or bookmark.
 */
export interface SearchResult {
  /** The display name or title of the search result. */
  name: string
  /** The URL associated with the search result. */
  url: string
  /** The URL of the favicon for the search result. Can be empty. */
  faviconUrl: string

  /** Optional Chrome Tab object if the result is an open tab. */
  tab?: Tab
  /** Optional Chrome HistoryItem object if the result is from browsing history. */
  history?: HistoryItem
  /** Optional Chrome BookmarkTreeNode object if the result is a bookmark. */
  bookmark?: BookmarkTreeNode
}

/**
 * Represents the combined set of results from all search categories (actions, tabs, bookmarks, history).
 */
export interface CombinedResults {
  /** Array of browser actions matching the search query. */
  actions: BrowserAction[]
  /** Array of open tabs matching the search query. */
  tabs: SearchResult[]
  /** Array of bookmarks matching the search query. */
  bookmarks: SearchResult[]
  /** Array of browsing history items matching the search query. */
  history: SearchResult[]
}
