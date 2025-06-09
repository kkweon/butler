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
      'openSettings',
      'sortTabsInAllWindows',
      'copyToClipboard',
      'toggleTabPin',
      'moveCurrentTabToFirst',
      'moveCurrentTabToLast',
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
      expect(actions.length).toBe(8)
      expect(actions.map((a) => a.name)).toEqual([
        'Close other tabs',
        'Close tabs to the right',
        'Open settings',
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
      const mockTab = createMockTab({ pinned: false })
      mockChromeService.getCurrentActiveTab.and.returnValue(
        Promise.resolve(mockTab),
      )

      const actions = await service.getBrowserActions()

      expect(actions).toBeDefined()
      expect(actions.length).toBe(9) // 8 base + 1 pin action
      expect(actions[0].name).toBe('Pin the current tab')
    })

    it('should show unpin action when tab is pinned', async () => {
      const mockTab = createMockTab({ pinned: true })
      mockChromeService.getCurrentActiveTab.and.returnValue(
        Promise.resolve(mockTab),
      )

      const actions = await service.getBrowserActions()

      expect(actions[0].name).toBe('Unpin the current tab')
    })

    it('should return only base actions when getCurrentActiveTab fails', async () => {
      spyOn(console, 'error') // Suppress console.error for this test

      mockChromeService.getCurrentActiveTab.and.returnValue(
        Promise.reject(new Error('Failed to get tab')),
      )

      const actions = await service.getBrowserActions()

      expect(actions).toBeDefined()
      expect(actions.length).toBe(8) // Only base actions
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

  describe('Move current tab to first action', () => {
    it('should call moveCurrentTabToFirst on ChromeService', async () => {
      const baseActions = service.getBaseBrowserActions()
      const moveToFirstAction = baseActions.find(
        (action) => action.name === 'Move current tab to first',
      )

      expect(moveToFirstAction).toBeDefined()

      mockChromeService.moveCurrentTabToFirst.and.returnValue(Promise.resolve())

      await moveToFirstAction!.action()

      expect(mockChromeService.moveCurrentTabToFirst).toHaveBeenCalled()
    })
  })

  describe('Move current tab to last action', () => {
    it('should call moveCurrentTabToLast on ChromeService', async () => {
      const baseActions = service.getBaseBrowserActions()
      const moveToLastAction = baseActions.find(
        (action) => action.name === 'Move current tab to last',
      )

      expect(moveToLastAction).toBeDefined()

      mockChromeService.moveCurrentTabToLast.and.returnValue(Promise.resolve())

      await moveToLastAction!.action()

      expect(mockChromeService.moveCurrentTabToLast).toHaveBeenCalled()
    })
  })
})
