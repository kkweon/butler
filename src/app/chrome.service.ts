import { Injectable } from '@angular/core'
import { Observable } from 'rxjs'

@Injectable({
  providedIn: 'root',
})
export class ChromeService {
  constructor() {
  }

  async getCurrentWindow(): Promise<chrome.windows.Window> {
    return new Promise((resolve) => {
      chrome.windows.getCurrent(window => {
        resolve(window)
      })
    })
  }

  async activateTab(tabId: number): Promise<chrome.tabs.Tab> {
    return new Promise(resolve => {
      chrome.tabs.update(tabId, { active: true }, tab => resolve(tab))
    })
  }

  async activateWindow(windowId: number): Promise<chrome.windows.Window> {
    return new Promise(resolve => {
      chrome.windows.update(windowId, {
        focused: true,
      }, window => resolve(window))
    })
  }

  tabsQuery(param: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> {
    return new Promise(resolve => chrome.tabs.query(param, tabs => resolve(tabs)))
  }

  historySearch(param: chrome.history.HistoryQuery): Promise<chrome.history.HistoryItem[]> {
    return new Promise(resolve => chrome.history.search(param, (results: chrome.history.HistoryItem[]) => {
      resolve(results)
    }))
  }
}
