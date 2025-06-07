import Tab = chrome.tabs.Tab
import HistoryItem = chrome.history.HistoryItem
import BookmarkTreeNode = chrome.bookmarks.BookmarkTreeNode

/**
 * Represents a browser action that can be performed, e.g., "Open Settings".
 */
export interface BrowserAction {
  /** The display name of the action. */
  name: string
  /** The function to execute when the action is triggered. */
  action: () => Promise<void>
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
