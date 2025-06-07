import Tab = chrome.tabs.Tab
import HistoryItem = chrome.history.HistoryItem
import BookmarkTreeNode = chrome.bookmarks.BookmarkTreeNode

export interface BrowserAction {
  name: string
  action: () => Promise<void>
}

export interface SearchResult {
  name: string
  url: string
  faviconUrl: string

  tab?: Tab
  history?: HistoryItem
  bookmark?: BookmarkTreeNode
}

export interface CombinedResults {
  actions: BrowserAction[]
  tabs: SearchResult[]
  bookmarks: SearchResult[]
  history: SearchResult[]
}
