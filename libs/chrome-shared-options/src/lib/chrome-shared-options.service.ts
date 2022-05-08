import { Injectable } from '@angular/core'

export interface ChromeSharedOptions {
  includesBookmarks: boolean
  includesHistory: boolean
  includesTabs: boolean

  searchHistoryStartDateInUnixEpoch: number
}

const DEFAULT_CHROME_SHARED_OPTIONS: ChromeSharedOptions = {
  includesBookmarks: false,
  includesHistory: true,
  includesTabs: true,

  searchHistoryStartDateInUnixEpoch: 0,
}

@Injectable({
  providedIn: 'root',
})
export class ChromeSharedOptionsService {
  constructor() {}

  getOptions(): Promise<ChromeSharedOptions> {
    return new Promise((resolve) => {
      chrome.storage.sync.get(
        DEFAULT_CHROME_SHARED_OPTIONS,
        (sharedOptions: ChromeSharedOptions) => resolve(sharedOptions),
      )
    })
  }

  setOptions(options: Partial<ChromeSharedOptions>): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.sync.set(options, resolve)
    })
  }
}
