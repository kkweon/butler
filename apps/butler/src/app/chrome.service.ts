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
}
