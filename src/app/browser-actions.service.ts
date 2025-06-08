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
   * @returns Array of base browser actions
   */
  getBaseBrowserActions(): BrowserAction[] {
    return [
      {
        name: 'Close other tabs',
        action: async () => {
          const tabs = await this.chromeService.tabsQuery({
            currentWindow: true,
            // Respect pinned
            pinned: false,
          })
          await this.chromeService.tabsRemove(
            tabs.filter((tab) => !tab.active).map((tab) => tab.id),
          )
        },
      },
      {
        name: 'Close tabs to the right',
        action: async () => {
          const currentTab = await this.chromeService.getCurrentActiveTab()
          const tabs = await this.chromeService.tabsQuery({
            currentWindow: true,
            pinned: false,
          })

          const findIndex = tabs.findIndex((t) => t.id === currentTab.id)
          if (findIndex === -1) {
            // do nothing
            return
          }

          const tabIds = tabs.slice(findIndex + 1).map((t) => t.id)
          if (0 < tabIds.length) {
            await this.chromeService.tabsRemove(tabIds)
          }
        },
      },
      {
        name: 'Open settings',
        action: async () => {
          await this.chromeService.openSettings()
        },
      },
      {
        name: 'Sort tabs by domain',
        action: async () => {
          await this.chromeService.sortTabsInAllWindows()
        },
      },
      {
        name: 'Copy URL',
        action: async () => {
          const activeTab = await this.chromeService.getCurrentActiveTab()
          if (activeTab && activeTab.url) {
            await this.chromeService.copyToClipboard(activeTab.url)
          }
        },
      },
      {
        name: 'Close duplicate tabs',
        action: async () => {
          await this.closeDuplicateTabs()
        },
      },
    ]
  }

  /**
   * Gets all browser actions including dynamic ones based on current tab state
   * @returns Promise resolving to array of all browser actions
   */
  async getBrowserActions(): Promise<BrowserAction[]> {
    const baseActions = this.getBaseBrowserActions()

    try {
      const activeTab = await this.chromeService.getCurrentActiveTab()

      // Add pin/unpin action at the beginning if we can get tab state
      const pinAction: BrowserAction = {
        name: activeTab?.pinned
          ? 'Unpin the current tab'
          : 'Pin the current tab',
        action: async () => {
          try {
            const currentTab = await this.chromeService.getCurrentActiveTab()
            if (currentTab?.id) {
              await this.chromeService.toggleTabPin(
                currentTab.id,
                !currentTab.pinned,
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
      return baseActions
    }
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
