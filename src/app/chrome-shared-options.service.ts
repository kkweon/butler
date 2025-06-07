import { Injectable } from '@angular/core'

/**
 * Defines the structure for shared options across the Chrome extension.
 * These options are typically stored in `chrome.storage.sync`.
 */
export interface ChromeSharedOptions {
  /** Whether to include bookmarks in search results. */
  includesBookmarks: boolean
  /** Whether to include browsing history in search results. */
  includesHistory: boolean
  /** Whether to include open tabs in search results. */
  includesTabs: boolean
  /**
   * The start date for searching history, represented as a Unix epoch timestamp (milliseconds).
   * A value of 0 typically means searching all history.
   */
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
