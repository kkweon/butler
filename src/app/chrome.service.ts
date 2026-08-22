import { Injectable } from '@angular/core'
import { ChromeSharedOptionsService } from './chrome-shared-options.service'

@Injectable({
  providedIn: 'root',
})
export class ChromeService {
  constructor(private chromeSharedOptionsService: ChromeSharedOptionsService) {}

  getCurrentWindow(): Promise<chrome.windows.Window> {
    return new Promise((resolve) => {
      chrome.windows.getCurrent((window) => {
        resolve(window)
      })
    })
  }

  activateTab(tabId: number): Promise<chrome.tabs.Tab> {
    return new Promise((resolve) => {
      chrome.tabs.update(tabId, { active: true }, (tab) => resolve(tab))
    })
  }

  activateWindow(windowId: number): Promise<chrome.windows.Window> {
    return new Promise((resolve) => {
      chrome.windows.update(
        windowId,
        {
          focused: true,
        },
        (window) => resolve(window),
      )
    })
  }

  tabsQuery(queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> {
    return new Promise((resolve) =>
      chrome.tabs.query(queryInfo, (tabs) => resolve(tabs)),
    )
  }

  historySearch(
    historyQuery: chrome.history.HistoryQuery,
  ): Promise<chrome.history.HistoryItem[]> {
    return new Promise((resolve) =>
      chrome.history.search(
        historyQuery,
        (results: chrome.history.HistoryItem[]) => {
          resolve(results)
        },
      ),
    )
  }

  bookmarksSearch(query: string): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    return new Promise((resolve) =>
      chrome.bookmarks.search(
        query,
        (results: chrome.bookmarks.BookmarkTreeNode[]) => {
          resolve(results)
        },
      ),
    )
  }

  tabsCreate(
    createProperties: chrome.tabs.CreateProperties,
  ): Promise<chrome.tabs.Tab> {
    return new Promise((resolve) =>
      chrome.tabs.create(createProperties, (tab) => resolve(tab)),
    )
  }

  async getCurrentTab(): Promise<chrome.tabs.Tab> {
    return new Promise((resolve) => {
      return chrome.tabs.getCurrent(resolve)
    })
  }

  async getCurrentActiveTab(): Promise<chrome.tabs.Tab> {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs[0])
      })
    })
  }

  /**
   * Gets the tabs the user has multi-selected in the current window.
   *
   * Chrome keeps the active tab highlighted at all times, so without an
   * explicit multi-selection this resolves to just the active tab, and every
   * caller degrades to single tab behaviour. The fallback only covers the case
   * where the query comes back empty.
   */
  async getHighlightedTabs(): Promise<chrome.tabs.Tab[]> {
    const tabs = await this.tabsQuery({
      highlighted: true,
      currentWindow: true,
    })
    if (0 < tabs.length) {
      return tabs
    }

    const activeTab = await this.getCurrentActiveTab()
    return activeTab ? [activeTab] : []
  }

  async tabsRemove(tabIds: number[]): Promise<void> {
    return new Promise((resolve) => {
      chrome.tabs.remove(tabIds, () => resolve())
    })
  }

  async openSettings(): Promise<void> {
    return new Promise((resolve) => {
      chrome.runtime.openOptionsPage(resolve)
    })
  }

  async openChromeSettings(): Promise<void> {
    await this.tabsCreate({ active: true, url: 'chrome://settings' })
  }

  async openExtensions(): Promise<void> {
    await this.tabsCreate({ active: true, url: 'chrome://extensions' })
  }

  async openExtensionShortcuts(): Promise<void> {
    await this.tabsCreate({
      active: true,
      url: 'chrome://extensions/shortcuts',
    })
  }

  async tabsUpdate(
    tabId: number,
    updateProperties: chrome.tabs.UpdateProperties,
  ): Promise<chrome.tabs.Tab> {
    return new Promise((resolve) => {
      chrome.tabs.update(tabId, updateProperties, (tab) => resolve(tab))
    })
  }

  async toggleTabPin(tabId: number, pinned: boolean): Promise<chrome.tabs.Tab> {
    return this.tabsUpdate(tabId, { pinned })
  }

  /**
   * Pins or unpins several tabs at once. Pinning reorders tabs, so this runs
   * sequentially to keep the tabs in their original relative order.
   */
  async setTabsPinned(tabIds: number[], pinned: boolean): Promise<void> {
    for (const tabId of tabIds) {
      await this.toggleTabPin(tabId, pinned)
    }
  }

  async copyToClipboard(text: string): Promise<void> {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea')
        textArea.value = text
        // Position the textarea off-screen to hide it from view
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      throw error
    }
  }

  getAllWindows(): Promise<chrome.windows.Window[]> {
    return new Promise((resolve) => {
      chrome.windows.getAll((windows) => resolve(windows))
    })
  }

  /**
   * Gets the normal browser windows with their tabs populated, so callers can
   * describe a window by what is inside it.
   *
   * Kept separate from `getAllWindows` because that one is called without query
   * options and several callers depend on its bare signature.
   */
  getAllWindowsWithTabs(): Promise<chrome.windows.Window[]> {
    return new Promise((resolve) => {
      chrome.windows.getAll(
        { populate: true, windowTypes: ['normal'] },
        (windows) => resolve(windows),
      )
    })
  }

  /**
   * Moves the given tabs to consecutive positions starting at
   * `moveProperties.index`, keeping their relative order.
   */
  tabsMove(
    tabIds: number[],
    moveProperties: chrome.tabs.MoveProperties,
  ): Promise<chrome.tabs.Tab[]> {
    return new Promise((resolve) => {
      chrome.tabs.move(tabIds, moveProperties, (tabs) => resolve(tabs))
    })
  }

  /**
   * Reads `chrome.runtime.lastError` without assuming `chrome.runtime` exists,
   * so partially stubbed test doubles keep working.
   */
  private lastErrorMessage(): string | null {
    const lastError = chrome.runtime?.lastError
    return lastError
      ? (lastError.message ?? 'Unknown chrome.runtime error')
      : null
  }

  /**
   * Moves tabs to the end of another window.
   *
   * Unlike the other wrappers this one rejects on `chrome.runtime.lastError`.
   * A silently dropped move would leave the user staring at an unchanged window
   * with no idea why, which is far worse than a failed tab switch.
   */
  private moveTabsToWindowRaw(
    tabIds: number[],
    windowId: number,
  ): Promise<chrome.tabs.Tab[]> {
    return new Promise((resolve, reject) => {
      chrome.tabs.move(tabIds, { windowId, index: -1 }, (tabs) => {
        const error = this.lastErrorMessage()
        if (error) {
          reject(new Error(error))
          return
        }
        resolve(tabs)
      })
    })
  }

  /** Opens a new window containing only `tabId`. Rejects on `lastError`. */
  private createWindowWithTab(
    tabId: number,
    focused: boolean,
  ): Promise<chrome.windows.Window | undefined> {
    return new Promise((resolve, reject) => {
      // Do not pass `incognito` here: the moved tab already determines the new
      // window's profile, and an explicit mismatch makes `create` throw.
      chrome.windows.create({ tabId, focused }, (window) => {
        const error = this.lastErrorMessage()
        if (error) {
          reject(new Error(error))
          return
        }
        resolve(window)
      })
    })
  }

  /**
   * `index: -1` means "end of the tab strip", which is not a legal position for
   * a pinned tab, and Chrome has historically dropped the pinned flag on
   * cross-window moves. Re-assert it rather than relying on either behaviour;
   * this is a no-op when the flag survived.
   */
  private async restorePinnedState(
    sourceTabs: chrome.tabs.Tab[],
    movedTabs: chrome.tabs.Tab[],
  ): Promise<void> {
    const movedById = new Map(movedTabs.map((tab) => [tab.id, tab]))
    const unpinnedIds = sourceTabs
      .filter((tab) => tab.pinned && movedById.get(tab.id)?.pinned === false)
      .map((tab) => tab.id)

    if (0 < unpinnedIds.length) {
      await this.setTabsPinned(unpinnedIds, true)
    }
  }

  /** Moves tabs to the end of `windowId`, keeping order and pinned state. */
  async moveTabsToWindow(
    tabs: chrome.tabs.Tab[],
    windowId: number,
  ): Promise<void> {
    if (0 === tabs.length) {
      return
    }

    const moved = await this.moveTabsToWindowRaw(
      tabs.map((tab) => tab.id),
      windowId,
    )
    await this.restorePinnedState(tabs, moved ?? [])
  }

  /**
   * Pops tabs out into a window of their own, keeping order and pinned state.
   * @returns The new window's id, when Chrome reported one.
   */
  async moveTabsToNewWindow(
    tabs: chrome.tabs.Tab[],
    focused = true,
  ): Promise<number | undefined> {
    if (0 === tabs.length) {
      return undefined
    }

    // `chrome.windows.create` accepts a single tabId, so the rest follow.
    const [firstTab, ...restTabs] = tabs
    const created = await this.createWindowWithTab(firstTab.id, focused)
    const windowId = created?.id
    let movedTabs = created?.tabs ?? []

    if (0 < restTabs.length && windowId !== undefined) {
      const moved = await this.moveTabsToWindowRaw(
        restTabs.map((tab) => tab.id),
        windowId,
      )
      movedTabs = [...movedTabs, ...(moved ?? [])]
    }

    await this.restorePinnedState(tabs, movedTabs)
    return windowId
  }

  private extractDomain(url: string | undefined): string {
    if (!url) {
      return '\uFFFF' // Use high Unicode value for tabs without URL
    }

    try {
      const urlObj = new URL(url)
      const hostname = urlObj.hostname.toLowerCase()

      // Extract main domain by taking the last two parts (domain.tld)
      // This handles subdomains like www.example.com -> example.com
      const parts = hostname.split('.')
      if (parts.length >= 2) {
        return parts.slice(-2).join('.')
      }

      return hostname
    } catch (error) {
      // If URL parsing fails, use the original URL for sorting
      return url.toLowerCase()
    }
  }

  /**
   * Gets the multi-selected tabs that can actually be moved, i.e. the ones
   * Chrome reported with an id and a window.
   */
  private async getMovableSelectedTabs(): Promise<chrome.tabs.Tab[]> {
    const selectedTabs = await this.getHighlightedTabs()
    const movableTabs = selectedTabs.filter(
      (tab) => tab && tab.id && tab.windowId !== undefined,
    )

    if (movableTabs.length === 0) {
      throw new Error('No active tab found')
    }

    return movableTabs
  }

  /**
   * Moves `tabsToMove` to consecutive positions starting at `startIndex`,
   * preserving their relative order. Does nothing if they already sit there.
   */
  private async moveTabsTo(
    tabsToMove: chrome.tabs.Tab[],
    startIndex: number,
  ): Promise<void> {
    if (tabsToMove.length === 0) {
      return
    }

    const orderedTabs = [...tabsToMove].sort((a, b) => a.index - b.index)
    const isAlreadyInPlace = orderedTabs.every(
      (tab, offset) => tab.index === startIndex + offset,
    )
    if (isAlreadyInPlace) {
      return
    }

    await this.tabsMove(
      orderedTabs.map((tab) => tab.id),
      { index: startIndex },
    )
  }

  /**
   * Moves the multi-selected tabs to the front of their own region: selected
   * pinned tabs go to the front of the pinned block, selected unpinned tabs go
   * right after it.
   */
  async moveSelectedTabsToFirst(): Promise<void> {
    try {
      const selectedTabs = await this.getMovableSelectedTabs()
      const tabs = await this.tabsQuery({ windowId: selectedTabs[0].windowId })
      const pinnedTabsCount = tabs.filter((tab) => tab.pinned).length

      // Move to first position among pinned tabs
      await this.moveTabsTo(
        selectedTabs.filter((tab) => tab.pinned),
        0,
      )
      // Move to first position among unpinned tabs (after all pinned tabs)
      await this.moveTabsTo(
        selectedTabs.filter((tab) => !tab.pinned),
        pinnedTabsCount,
      )
    } catch (error) {
      console.error('Failed to move selected tabs to first position:', error)
      throw error
    }
  }

  /**
   * Moves the multi-selected tabs to the end of their own region: selected
   * pinned tabs go to the end of the pinned block, selected unpinned tabs go to
   * the end of the window.
   */
  async moveSelectedTabsToLast(): Promise<void> {
    try {
      const selectedTabs = await this.getMovableSelectedTabs()
      const tabs = await this.tabsQuery({ windowId: selectedTabs[0].windowId })
      const pinnedTabsCount = tabs.filter((tab) => tab.pinned).length

      const selectedPinnedTabs = selectedTabs.filter((tab) => tab.pinned)
      const selectedUnpinnedTabs = selectedTabs.filter((tab) => !tab.pinned)

      // Move to last position among pinned tabs
      await this.moveTabsTo(
        selectedPinnedTabs,
        pinnedTabsCount - selectedPinnedTabs.length,
      )
      // Move to last position among all tabs
      await this.moveTabsTo(
        selectedUnpinnedTabs,
        tabs.length - selectedUnpinnedTabs.length,
      )
    } catch (error) {
      console.error('Failed to move selected tabs to last position:', error)
      throw error
    }
  }

  async sortTabsInAllWindows(): Promise<void> {
    try {
      const [options, windows] = await Promise.all([
        this.chromeSharedOptionsService.getOptions(),
        this.getAllWindows(),
      ])

      for (const window of windows) {
        try {
          const tabs = await this.tabsQuery({ windowId: window.id })

          // Separate pinned and unpinned tabs
          const pinnedTabs = tabs.filter((tab) => tab.pinned)
          const unpinnedTabs = tabs.filter((tab) => !tab.pinned)

          // Sort each group by domain first, then by full URL (case-insensitive)
          // Handle tabs with no URL by placing them at the end of their group
          const sortByDomainThenUrl = (
            a: chrome.tabs.Tab,
            b: chrome.tabs.Tab,
          ) => {
            const domainA = this.extractDomain(a.url)
            const domainB = this.extractDomain(b.url)

            // First sort by domain
            const domainComparison = domainA.localeCompare(domainB)
            if (domainComparison !== 0) {
              return domainComparison
            }

            // If domains are the same, sort by full URL
            const urlA = a.url || '\uFFFF'
            const urlB = b.url || '\uFFFF'
            return urlA.toLowerCase().localeCompare(urlB.toLowerCase())
          }

          // Only sort pinned tabs if the option is enabled
          if (options.sortPinnedTabs) {
            pinnedTabs.sort(sortByDomainThenUrl)
          }
          unpinnedTabs.sort(sortByDomainThenUrl)

          // Combine: pinned first, then unpinned
          const sortedTabs = [...pinnedTabs, ...unpinnedTabs]

          // Move tabs to their new positions
          for (let i = 0; i < sortedTabs.length; i++) {
            if (sortedTabs[i].index !== i) {
              try {
                await this.tabsMove([sortedTabs[i].id], { index: i })
              } catch (error) {
                // Skip tabs that can't be moved (e.g., if they were closed during operation)
                console.warn('Failed to move tab:', sortedTabs[i].id, error)
              }
            }
          }
        } catch (error) {
          // Continue with other windows if one fails
          console.warn('Failed to sort tabs in window:', window.id, error)
        }
      }
    } catch (error) {
      console.error('Failed to get windows for tab sorting:', error)
    }
  }
}
