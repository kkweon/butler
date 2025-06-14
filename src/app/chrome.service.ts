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

  tabsMove(
    tabId: number,
    moveProperties: chrome.tabs.MoveProperties,
  ): Promise<chrome.tabs.Tab> {
    return new Promise((resolve) => {
      chrome.tabs.move(tabId, moveProperties, (tab) => resolve(tab))
    })
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

  async moveCurrentTabToFirst(): Promise<void> {
    try {
      const activeTab = await this.getCurrentActiveTab()
      if (!activeTab || !activeTab.id || activeTab.windowId === undefined) {
        throw new Error('No active tab found')
      }

      const tabs = await this.tabsQuery({ windowId: activeTab.windowId })
      const pinnedTabs = tabs.filter((tab) => tab.pinned)
      const unpinnedTabs = tabs.filter((tab) => !tab.pinned)

      let targetIndex: number

      if (activeTab.pinned) {
        // Move to first position among pinned tabs
        targetIndex = 0
      } else {
        // Move to first position among unpinned tabs (after all pinned tabs)
        targetIndex = pinnedTabs.length
      }

      // Only move if the tab is not already at the target position
      if (activeTab.index !== targetIndex) {
        await this.tabsMove(activeTab.id, { index: targetIndex })
      }
    } catch (error) {
      console.error('Failed to move current tab to first position:', error)
      throw error
    }
  }

  async moveCurrentTabToLast(): Promise<void> {
    try {
      const activeTab = await this.getCurrentActiveTab()
      if (!activeTab || !activeTab.id || activeTab.windowId === undefined) {
        throw new Error('No active tab found')
      }

      const tabs = await this.tabsQuery({ windowId: activeTab.windowId })
      const pinnedTabs = tabs.filter((tab) => tab.pinned)
      const unpinnedTabs = tabs.filter((tab) => !tab.pinned)

      let targetIndex: number

      if (activeTab.pinned) {
        // Move to last position among pinned tabs
        targetIndex = pinnedTabs.length - 1
      } else {
        // Move to last position among all tabs
        targetIndex = tabs.length - 1
      }

      // Only move if the tab is not already at the target position
      if (activeTab.index !== targetIndex) {
        await this.tabsMove(activeTab.id, { index: targetIndex })
      }
    } catch (error) {
      console.error('Failed to move current tab to last position:', error)
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
                await this.tabsMove(sortedTabs[i].id, { index: i })
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
