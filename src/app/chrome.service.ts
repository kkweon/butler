import { Injectable } from '@angular/core'

@Injectable({
  providedIn: 'root',
})
export class ChromeService {
  constructor() {}

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

  async sortTabsInAllWindows(): Promise<void> {
    try {
      const windows = await this.getAllWindows()

      for (const window of windows) {
        try {
          const tabs = await this.tabsQuery({ windowId: window.id })

          // Separate pinned and unpinned tabs
          const pinnedTabs = tabs.filter((tab) => tab.pinned)
          const unpinnedTabs = tabs.filter((tab) => !tab.pinned)

          // Sort each group by URL (case-insensitive)
          // Handle tabs with no URL by placing them at the end of their group
          pinnedTabs.sort((a, b) => {
            const urlA = a.url || '\uFFFF' // Use high Unicode value for tabs without URL
            const urlB = b.url || '\uFFFF'
            return urlA.toLowerCase().localeCompare(urlB.toLowerCase())
          })
          unpinnedTabs.sort((a, b) => {
            const urlA = a.url || '\uFFFF'
            const urlB = b.url || '\uFFFF'
            return urlA.toLowerCase().localeCompare(urlB.toLowerCase())
          })

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
