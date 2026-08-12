import { Injectable } from '@angular/core'
import { BrowserAction } from './models'
import { ChromeService } from './chrome.service'
import { normalizeUrl } from './utils'

@Injectable({
  providedIn: 'root',
})
export class BrowserActionsService {
  constructor(private chromeService: ChromeService) {}

  /**
   * Gets the base browser actions that are always available
   * @param selectedTabsCount Number of tabs the user multi-selected in Chrome,
   *   used to label the actions that operate on the whole selection
   * @returns Array of base browser actions
   */
  getBaseBrowserActions(selectedTabsCount = 1): BrowserAction[] {
    const hasMultiSelection = 1 < selectedTabsCount

    return [
      {
        name: 'Close other tabs',
        action: async () => {
          const [selectedTabs, tabs] = await Promise.all([
            this.chromeService.getHighlightedTabs(),
            this.chromeService.tabsQuery({
              currentWindow: true,
              // Respect pinned
              pinned: false,
            }),
          ])

          const selectedTabIds = new Set(selectedTabs.map((tab) => tab.id))
          const tabIds = tabs
            .filter((tab) => !selectedTabIds.has(tab.id))
            .map((tab) => tab.id)
          if (0 < tabIds.length) {
            await this.chromeService.tabsRemove(tabIds)
          }
        },
      },
      {
        name: 'Close tabs to the right',
        action: async () => {
          await this.closeTabsBesideSelection('right')
        },
      },
      {
        name: 'Close tabs to the left',
        action: async () => {
          await this.closeTabsBesideSelection('left')
        },
      },
      {
        name: 'Open settings',
        action: async () => {
          await this.chromeService.openSettings()
        },
      },
      {
        name: 'Open Chrome settings',
        action: async () => {
          await this.chromeService.openChromeSettings()
        },
      },
      {
        name: 'Open Chrome extensions',
        action: async () => {
          await this.chromeService.openExtensions()
        },
      },
      {
        name: 'Open Chrome keyboard shortcuts',
        action: async () => {
          await this.chromeService.openExtensionShortcuts()
        },
      },
      {
        name: 'Sort tabs by domain',
        action: async () => {
          await this.chromeService.sortTabsInAllWindows()
        },
      },
      {
        name: hasMultiSelection ? `Copy ${selectedTabsCount} URLs` : 'Copy URL',
        action: async () => {
          const selectedTabs = await this.chromeService.getHighlightedTabs()
          const urls = selectedTabs.map((tab) => tab?.url).filter((url) => url)
          if (0 < urls.length) {
            await this.chromeService.copyToClipboard(urls.join('\n'))
          }
        },
      },
      {
        name: 'Close duplicate tabs',
        action: async () => {
          await this.closeDuplicateTabs()
        },
      },
      {
        name: hasMultiSelection
          ? `Move ${selectedTabsCount} tabs to first`
          : 'Move current tab to first',
        action: async () => {
          await this.chromeService.moveSelectedTabsToFirst()
        },
      },
      {
        name: hasMultiSelection
          ? `Move ${selectedTabsCount} tabs to last`
          : 'Move current tab to last',
        action: async () => {
          await this.chromeService.moveSelectedTabsToLast()
        },
      },
    ]
  }

  /**
   * Closes every unpinned tab beyond the multi-selection: to the right of the
   * last selected tab, or to the left of the first one.
   */
  private async closeTabsBesideSelection(
    direction: 'left' | 'right',
  ): Promise<void> {
    const [selectedTabs, tabs] = await Promise.all([
      this.chromeService.getHighlightedTabs(),
      this.chromeService.tabsQuery({
        currentWindow: true,
        pinned: false,
      }),
    ])

    if (selectedTabs.length === 0) {
      // do nothing
      return
    }

    const selectedIndexes = selectedTabs.map((tab) => tab.index)
    const tabIds =
      direction === 'right'
        ? tabs
            .filter((tab) => Math.max(...selectedIndexes) < tab.index)
            .map((tab) => tab.id)
        : tabs
            .filter((tab) => tab.index < Math.min(...selectedIndexes))
            .map((tab) => tab.id)

    if (0 < tabIds.length) {
      await this.chromeService.tabsRemove(tabIds)
    }
  }

  /**
   * Gets all browser actions including dynamic ones based on current tab state
   * @returns Promise resolving to array of all browser actions
   */
  async getBrowserActions(): Promise<BrowserAction[]> {
    try {
      const selectedTabs = await this.chromeService.getHighlightedTabs()
      const baseActions = this.getBaseBrowserActions(selectedTabs.length)

      // Unpin is only offered once every selected tab is pinned, so a mixed
      // selection pins the whole group first.
      const isEveryTabPinned = this.isEveryTabPinned(selectedTabs)
      const hasMultiSelection = 1 < selectedTabs.length

      // Add pin/unpin action at the beginning if we can get tab state
      const pinAction: BrowserAction = {
        name: isEveryTabPinned
          ? hasMultiSelection
            ? `Unpin ${selectedTabs.length} tabs`
            : 'Unpin the current tab'
          : hasMultiSelection
            ? `Pin ${selectedTabs.length} tabs`
            : 'Pin the current tab',
        action: async () => {
          try {
            const currentTabs = await this.chromeService.getHighlightedTabs()
            const tabIds = currentTabs
              .filter((tab) => tab?.id)
              .map((tab) => tab.id)
            if (0 < tabIds.length) {
              await this.chromeService.setTabsPinned(
                tabIds,
                !this.isEveryTabPinned(currentTabs),
              )
            }
          } catch (error) {
            console.error('Failed to toggle tab pin state:', error)
          }
        },
      }

      return [pinAction, ...baseActions]
    } catch (error) {
      console.error('Failed to get current tab state:', error)
      // Return only base actions if we can't get tab state
      return this.getBaseBrowserActions()
    }
  }

  private isEveryTabPinned(tabs: chrome.tabs.Tab[]): boolean {
    return 0 < tabs.length && tabs.every((tab) => tab?.pinned)
  }

  /**
   * Closes duplicate tabs based on normalized URLs
   * Keeps the first tab in each group and closes the rest
   */
  private async closeDuplicateTabs(): Promise<void> {
    const tabs = await this.chromeService.tabsQuery({
      currentWindow: true,
      // Respect pinned tabs - only close unpinned duplicates
      pinned: false,
    })

    // Group tabs by normalized URL (without query strings and fragments)
    const tabGroups = new Map<string, chrome.tabs.Tab[]>()

    for (const tab of tabs) {
      const normalizedUrl = normalizeUrl(tab.url)
      if (normalizedUrl) {
        if (!tabGroups.has(normalizedUrl)) {
          tabGroups.set(normalizedUrl, [])
        }
        tabGroups.get(normalizedUrl)!.push(tab)
      }
    }

    // Collect tab IDs to close (all duplicates except the first in each group)
    const tabIdsToClose: number[] = []
    for (const [normalizedUrl, tabGroup] of tabGroups) {
      if (tabGroup.length > 1) {
        // Keep the first tab, close the rest
        const duplicateTabs = tabGroup.slice(1)
        tabIdsToClose.push(...duplicateTabs.map((tab) => tab.id))
      }
    }

    if (tabIdsToClose.length > 0) {
      await this.chromeService.tabsRemove(tabIdsToClose)
    }
  }
}
