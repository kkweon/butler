import { TestBed } from '@angular/core/testing'
import { BrowserActionsService } from './browser-actions.service'
import { ChromeService } from './chrome.service'

/**
 * Helper function to create mock Chrome tabs with only necessary properties
 */
function createMockTab(
  overrides: Partial<chrome.tabs.Tab> = {},
): chrome.tabs.Tab {
  return {
    id: 1,
    index: 0,
    groupId: -1,
    pinned: false,
    highlighted: false,
    windowId: 1,
    active: false,
    incognito: false,
    selected: false,
    discarded: false,
    autoDiscardable: true,
    frozen: false,
    lastAccessed: 0,
    url: 'https://example.com/page',
    title: 'Mock Tab',
    ...overrides,
  }
}

describe('BrowserActionsService', () => {
  let service: BrowserActionsService
  let mockChromeService: jasmine.SpyObj<ChromeService>

  beforeEach(() => {
    const chromeServiceSpy = jasmine.createSpyObj('ChromeService', [
      'tabsQuery',
      'tabsRemove',
      'getCurrentActiveTab',
      'getHighlightedTabs',
      'openSettings',
      'openChromeSettings',
      'openExtensions',
      'openExtensionShortcuts',
      'sortTabsInAllWindows',
      'copyToClipboard',
      'toggleTabPin',
      'setTabsPinned',
      'moveSelectedTabsToFirst',
      'moveSelectedTabsToLast',
    ])

    TestBed.configureTestingModule({
      providers: [{ provide: ChromeService, useValue: chromeServiceSpy }],
    })

    service = TestBed.inject(BrowserActionsService)
    mockChromeService = TestBed.inject(
      ChromeService,
    ) as jasmine.SpyObj<ChromeService>
  })

  it('should be created', () => {
    expect(service).toBeTruthy()
  })

  describe('getBaseBrowserActions', () => {
    it('should return all base browser actions', () => {
      const actions = service.getBaseBrowserActions()

      expect(actions).toBeDefined()
      expect(actions.length).toBe(12)
      expect(actions.map((a) => a.name)).toEqual([
        'Close other tabs',
        'Close tabs to the right',
        'Close tabs to the left',
        'Open settings',
        'Open Chrome settings',
        'Open Chrome extensions',
        'Open Chrome keyboard shortcuts',
        'Sort tabs by domain',
        'Copy URL',
        'Close duplicate tabs',
        'Move current tab to first',
        'Move current tab to last',
      ])
    })

    it('should have executable actions', () => {
      const actions = service.getBaseBrowserActions()

      actions.forEach((action) => {
        expect(action.action).toBeDefined()
        expect(typeof action.action).toBe('function')
      })
    })
  })

  describe('getBrowserActions', () => {
    it('should include pin action when active tab is available', async () => {
      const mockTab = createMockTab({ pinned: false, highlighted: true })
      mockChromeService.getHighlightedTabs.and.returnValue(
        Promise.resolve([mockTab]),
      )

      const actions = await service.getBrowserActions()

      expect(actions).toBeDefined()
      expect(actions.length).toBe(13) // 12 base + 1 pin action
      expect(actions[0].name).toBe('Pin the current tab')
    })

    it('should show unpin action when tab is pinned', async () => {
      const mockTab = createMockTab({ pinned: true, highlighted: true })
      mockChromeService.getHighlightedTabs.and.returnValue(
        Promise.resolve([mockTab]),
      )

      const actions = await service.getBrowserActions()

      expect(actions[0].name).toBe('Unpin the current tab')
    })

    it('should return only base actions when getHighlightedTabs fails', async () => {
      spyOn(console, 'error') // Suppress console.error for this test

      mockChromeService.getHighlightedTabs.and.returnValue(
        Promise.reject(new Error('Failed to get tab')),
      )

      const actions = await service.getBrowserActions()

      expect(actions).toBeDefined()
      expect(actions.length).toBe(12) // Only base actions
    })

    it('should label the selection-aware actions with the selected tab count', async () => {
      const selectedTabs = [
        createMockTab({ id: 1, index: 0, highlighted: true, active: true }),
        createMockTab({ id: 2, index: 1, highlighted: true }),
        createMockTab({ id: 3, index: 2, highlighted: true }),
      ]
      mockChromeService.getHighlightedTabs.and.returnValue(
        Promise.resolve(selectedTabs),
      )

      const actions = await service.getBrowserActions()

      expect(actions.map((action) => action.name)).toEqual([
        'Pin 3 tabs',
        'Close other tabs',
        'Close tabs to the right',
        'Close tabs to the left',
        'Open settings',
        'Open Chrome settings',
        'Open Chrome extensions',
        'Open Chrome keyboard shortcuts',
        'Sort tabs by domain',
        'Copy 3 URLs',
        'Close duplicate tabs',
        'Move 3 tabs to first',
        'Move 3 tabs to last',
      ])
    })

    it('should unpin the whole selection only when every selected tab is pinned', async () => {
      const selectedTabs = [
        createMockTab({ id: 1, pinned: true, highlighted: true }),
        createMockTab({ id: 2, pinned: true, highlighted: true }),
      ]
      mockChromeService.getHighlightedTabs.and.returnValue(
        Promise.resolve(selectedTabs),
      )
      mockChromeService.setTabsPinned.and.returnValue(Promise.resolve())

      const actions = await service.getBrowserActions()

      expect(actions[0].name).toBe('Unpin 2 tabs')

      await actions[0].action()

      expect(mockChromeService.setTabsPinned).toHaveBeenCalledWith(
        [1, 2],
        false,
      )
    })

    it('should pin the whole selection when only some selected tabs are pinned', async () => {
      const selectedTabs = [
        createMockTab({ id: 1, pinned: true, highlighted: true }),
        createMockTab({ id: 2, pinned: false, highlighted: true }),
      ]
      mockChromeService.getHighlightedTabs.and.returnValue(
        Promise.resolve(selectedTabs),
      )
      mockChromeService.setTabsPinned.and.returnValue(Promise.resolve())

      const actions = await service.getBrowserActions()

      expect(actions[0].name).toBe('Pin 2 tabs')

      await actions[0].action()

      expect(mockChromeService.setTabsPinned).toHaveBeenCalledWith([1, 2], true)
    })
  })

  describe('Close other tabs action', () => {
    let closeOtherTabsAction: () => Promise<void>

    beforeEach(() => {
      closeOtherTabsAction = service
        .getBaseBrowserActions()
        .find((a) => a.name === 'Close other tabs')!.action
      mockChromeService.tabsRemove.and.returnValue(Promise.resolve())
    })

    it('should keep every multi-selected tab', async () => {
      const allTabs = [
        createMockTab({ id: 1, index: 0 }),
        createMockTab({ id: 2, index: 1, highlighted: true, active: true }),
        createMockTab({ id: 3, index: 2, highlighted: true }),
        createMockTab({ id: 4, index: 3 }),
      ]
      mockChromeService.getHighlightedTabs.and.returnValue(
        Promise.resolve([allTabs[1], allTabs[2]]),
      )
      mockChromeService.tabsQuery.and.returnValue(Promise.resolve(allTabs))

      await closeOtherTabsAction()

      expect(mockChromeService.tabsRemove).toHaveBeenCalledWith([1, 4])
    })

    it('should keep only the active tab when nothing else is selected', async () => {
      const allTabs = [
        createMockTab({ id: 1, index: 0 }),
        createMockTab({ id: 2, index: 1, highlighted: true, active: true }),
      ]
      mockChromeService.getHighlightedTabs.and.returnValue(
        Promise.resolve([allTabs[1]]),
      )
      mockChromeService.tabsQuery.and.returnValue(Promise.resolve(allTabs))

      await closeOtherTabsAction()

      expect(mockChromeService.tabsRemove).toHaveBeenCalledWith([1])
    })

    it('should not call tabsRemove when there is nothing else to close', async () => {
      const allTabs = [
        createMockTab({ id: 1, index: 0, highlighted: true, active: true }),
      ]
      mockChromeService.getHighlightedTabs.and.returnValue(
        Promise.resolve(allTabs),
      )
      mockChromeService.tabsQuery.and.returnValue(Promise.resolve(allTabs))

      await closeOtherTabsAction()

      expect(mockChromeService.tabsRemove).not.toHaveBeenCalled()
    })
  })

  describe('Close tabs to the right/left actions', () => {
    const allTabs = [
      createMockTab({ id: 1, index: 0 }),
      createMockTab({ id: 2, index: 1, highlighted: true, active: true }),
      createMockTab({ id: 3, index: 2, highlighted: true }),
      createMockTab({ id: 4, index: 3 }),
    ]

    function actionNamed(name: string): () => Promise<void> {
      return service.getBaseBrowserActions().find((a) => a.name === name)!
        .action
    }

    beforeEach(() => {
      mockChromeService.tabsRemove.and.returnValue(Promise.resolve())
      mockChromeService.tabsQuery.and.returnValue(Promise.resolve(allTabs))
      mockChromeService.getHighlightedTabs.and.returnValue(
        Promise.resolve([allTabs[1], allTabs[2]]),
      )
    })

    it('should close tabs right of the last selected tab', async () => {
      await actionNamed('Close tabs to the right')()

      expect(mockChromeService.tabsRemove).toHaveBeenCalledWith([4])
    })

    it('should close tabs left of the first selected tab', async () => {
      await actionNamed('Close tabs to the left')()

      expect(mockChromeService.tabsRemove).toHaveBeenCalledWith([1])
    })

    it('should do nothing when there is no tab beyond the selection', async () => {
      mockChromeService.getHighlightedTabs.and.returnValue(
        Promise.resolve([allTabs[0], allTabs[3]]),
      )

      await actionNamed('Close tabs to the right')()
      await actionNamed('Close tabs to the left')()

      expect(mockChromeService.tabsRemove).not.toHaveBeenCalled()
    })
  })

  describe('Copy URL action', () => {
    it('should copy every selected URL on its own line', async () => {
      const selectedTabs = [
        createMockTab({ id: 1, url: 'https://example.com/a' }),
        createMockTab({ id: 2, url: 'https://example.com/b' }),
      ]
      mockChromeService.getHighlightedTabs.and.returnValue(
        Promise.resolve(selectedTabs),
      )
      mockChromeService.copyToClipboard.and.returnValue(Promise.resolve())

      const action = service
        .getBaseBrowserActions(2)
        .find((a) => a.name === 'Copy 2 URLs')!.action
      await action()

      expect(mockChromeService.copyToClipboard).toHaveBeenCalledWith(
        'https://example.com/a\nhttps://example.com/b',
      )
    })

    it('should skip tabs without a URL', async () => {
      mockChromeService.getHighlightedTabs.and.returnValue(
        Promise.resolve([createMockTab({ id: 1, url: undefined })]),
      )
      mockChromeService.copyToClipboard.and.returnValue(Promise.resolve())

      const action = service
        .getBaseBrowserActions()
        .find((a) => a.name === 'Copy URL')!.action
      await action()

      expect(mockChromeService.copyToClipboard).not.toHaveBeenCalled()
    })
  })

  describe('Close duplicate tabs action', () => {
    let closeDuplicateTabsAction: () => Promise<void>

    beforeEach(() => {
      const actions = service.getBaseBrowserActions()
      const closeDuplicateTabsActionObj = actions.find(
        (a) => a.name === 'Close duplicate tabs',
      )
      closeDuplicateTabsAction = closeDuplicateTabsActionObj!.action
    })

    it('should close duplicate tabs correctly', async () => {
      const mockTabs = [
        createMockTab({
          id: 1,
          url: 'https://example.com/page?query=1',
          title: 'Tab 1',
        }),
        createMockTab({
          id: 2,
          url: 'https://example.com/page#fragment',
          title: 'Tab 2 (duplicate)',
        }),
        createMockTab({
          id: 3,
          url: 'https://example.com/page',
          title: 'Tab 3 (duplicate)',
        }),
        createMockTab({
          id: 4,
          url: 'https://different.com/page',
          title: 'Tab 4 (unique)',
        }),
      ]

      mockChromeService.tabsQuery.and.returnValue(Promise.resolve(mockTabs))
      mockChromeService.tabsRemove.and.returnValue(Promise.resolve())

      await closeDuplicateTabsAction()

      expect(mockChromeService.tabsQuery).toHaveBeenCalledWith({
        currentWindow: true,
        pinned: false,
      })
      // Should remove tabs 2 and 3 (duplicates of tab 1), keeping tab 1 and tab 4
      expect(mockChromeService.tabsRemove).toHaveBeenCalledWith([2, 3])
    })

    it('should handle no duplicates scenario', async () => {
      const mockTabs = [
        createMockTab({
          id: 1,
          url: 'https://example.com/page1',
          title: 'Tab 1',
        }),
        createMockTab({
          id: 2,
          url: 'https://example.com/page2',
          title: 'Tab 2',
        }),
      ]

      mockChromeService.tabsQuery.and.returnValue(Promise.resolve(mockTabs))
      mockChromeService.tabsRemove.and.returnValue(Promise.resolve())

      await closeDuplicateTabsAction()

      expect(mockChromeService.tabsQuery).toHaveBeenCalledWith({
        currentWindow: true,
        pinned: false,
      })
      // Should not remove any tabs since there are no duplicates
      expect(mockChromeService.tabsRemove).not.toHaveBeenCalled()
    })

    it('should handle tabs without URLs', async () => {
      const mockTabs = [
        createMockTab({
          id: 1,
          url: undefined,
          title: 'Tab 1 (no URL)',
        }),
        createMockTab({
          id: 2,
          url: 'https://example.com/page',
          title: 'Tab 2',
        }),
      ]

      mockChromeService.tabsQuery.and.returnValue(Promise.resolve(mockTabs))
      mockChromeService.tabsRemove.and.returnValue(Promise.resolve())

      await closeDuplicateTabsAction()

      expect(mockChromeService.tabsQuery).toHaveBeenCalledWith({
        currentWindow: true,
        pinned: false,
      })
      // Should not remove any tabs since tab with undefined URL is ignored
      expect(mockChromeService.tabsRemove).not.toHaveBeenCalled()
    })
  })

  describe('Chrome internal page actions', () => {
    it('should open chrome://settings via ChromeService', async () => {
      const action = service
        .getBaseBrowserActions()
        .find((a) => a.name === 'Open Chrome settings')

      expect(action).toBeDefined()
      mockChromeService.openChromeSettings.and.returnValue(Promise.resolve())

      await action!.action()

      expect(mockChromeService.openChromeSettings).toHaveBeenCalled()
    })

    it('should open chrome://extensions via ChromeService', async () => {
      const action = service
        .getBaseBrowserActions()
        .find((a) => a.name === 'Open Chrome extensions')

      expect(action).toBeDefined()
      mockChromeService.openExtensions.and.returnValue(Promise.resolve())

      await action!.action()

      expect(mockChromeService.openExtensions).toHaveBeenCalled()
    })

    it('should open chrome://extensions/shortcuts via ChromeService', async () => {
      const action = service
        .getBaseBrowserActions()
        .find((a) => a.name === 'Open Chrome keyboard shortcuts')

      expect(action).toBeDefined()
      mockChromeService.openExtensionShortcuts.and.returnValue(
        Promise.resolve(),
      )

      await action!.action()

      expect(mockChromeService.openExtensionShortcuts).toHaveBeenCalled()
    })
  })

  describe('Move current tab to first action', () => {
    it('should call moveSelectedTabsToFirst on ChromeService', async () => {
      const baseActions = service.getBaseBrowserActions()
      const moveToFirstAction = baseActions.find(
        (action) => action.name === 'Move current tab to first',
      )

      expect(moveToFirstAction).toBeDefined()

      mockChromeService.moveSelectedTabsToFirst.and.returnValue(
        Promise.resolve(),
      )

      await moveToFirstAction!.action()

      expect(mockChromeService.moveSelectedTabsToFirst).toHaveBeenCalled()
    })
  })

  describe('Move current tab to last action', () => {
    it('should call moveSelectedTabsToLast on ChromeService', async () => {
      const baseActions = service.getBaseBrowserActions()
      const moveToLastAction = baseActions.find(
        (action) => action.name === 'Move current tab to last',
      )

      expect(moveToLastAction).toBeDefined()

      mockChromeService.moveSelectedTabsToLast.and.returnValue(
        Promise.resolve(),
      )

      await moveToLastAction!.action()

      expect(mockChromeService.moveSelectedTabsToLast).toHaveBeenCalled()
    })
  })
})
