import { BrowserAction } from './models'
import { ChromeService } from './chrome.service'

/**
 * Factory function to create base browser actions.
 * Takes a ChromeService instance and returns an array of browser actions.
 */
export function createBaseBrowserActions(
  chromeService: ChromeService,
): BrowserAction[] {
  return [
    {
      name: 'Close other tabs',
      action: async () => {
        const tabs = await chromeService.tabsQuery({
          currentWindow: true,
          // Respect pinned
          pinned: false,
        })
        await chromeService.tabsRemove(
          tabs.filter((tab) => !tab.active).map((tab) => tab.id),
        )
      },
    },
    {
      name: 'Close tabs to the right',
      action: async () => {
        const currentTab = await chromeService.getCurrentActiveTab()
        const tabs = await chromeService.tabsQuery({
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
          await chromeService.tabsRemove(tabIds)
        }
      },
    },
    {
      name: 'Open settings',
      action: async () => {
        await chromeService.openSettings()
      },
    },
    {
      name: 'Sort tabs by domain',
      action: async () => {
        await chromeService.sortTabsInAllWindows()
      },
    },
    {
      name: 'Copy URL',
      action: async () => {
        const activeTab = await chromeService.getCurrentActiveTab()
        if (activeTab && activeTab.url) {
          await chromeService.copyToClipboard(activeTab.url)
        }
      },
    },
    {
      name: 'Move current tab to first',
      action: async () => {
        await chromeService.moveCurrentTabToFirst()
      },
    },
    {
      name: 'Move current tab to last',
      action: async () => {
        await chromeService.moveCurrentTabToLast()
      },
    },
  ]
}
