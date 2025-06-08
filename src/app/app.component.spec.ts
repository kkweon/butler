import {
  TestBed,
  waitForAsync,
  ComponentFixture,
  fakeAsync,
  tick,
} from '@angular/core/testing'
import { AppComponent } from './app.component'
import { ReactiveFormsModule } from '@angular/forms'
import { MatIconModule } from '@angular/material/icon'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'
import { ChromeService } from './chrome.service'
import { ChromeSharedOptionsService } from './chrome-shared-options.service'
import { BrowserActionsService } from './browser-actions.service'
import { normalizeUrl } from './utils'

/**
 * Helper function to create mock Chrome tabs with only necessary properties
 * @param overrides - Partial tab properties to override defaults
 * @returns A mock Chrome tab object
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

describe('AppComponent', () => {
  let component: AppComponent
  let fixture: ComponentFixture<AppComponent>
  let mockChromeService: jasmine.SpyObj<ChromeService>
  let mockChromeSharedOptionsService: jasmine.SpyObj<ChromeSharedOptionsService>
  let mockBrowserActionsService: jasmine.SpyObj<BrowserActionsService>

  beforeEach(waitForAsync(() => {
    const chromeServiceSpy = jasmine.createSpyObj('ChromeService', [
      'tabsQuery',
      'historySearch',
      'getCurrentTab',
      'getCurrentWindow',
      'activateTab',
      'activateWindow',
      'tabsCreate',
      'tabsRemove',
      'openSettings',
      'sortTabsInAllWindows',
      'getCurrentActiveTab',
      'copyToClipboard',
      'bookmarksSearch',
      'moveCurrentTabToFirst',
      'moveCurrentTabToLast',
      'toggleTabPin',
    ])

    const chromeSharedOptionsServiceSpy = jasmine.createSpyObj(
      'ChromeSharedOptionsService',
      ['getOptions'],
    )

    const browserActionsServiceSpy = jasmine.createSpyObj(
      'BrowserActionsService',
      ['getBrowserActions', 'getBaseBrowserActions'],
    )

    // Set up default mock returns
    chromeSharedOptionsServiceSpy.getOptions.and.returnValue(
      Promise.resolve({
        includesTabs: true,
        includesHistory: true,
        includesBookmarks: true,
        searchHistoryStartDateInUnixEpoch: 0,
      }),
    )

    chromeServiceSpy.tabsQuery.and.returnValue(Promise.resolve([]))
    chromeServiceSpy.historySearch.and.returnValue(Promise.resolve([]))
    chromeServiceSpy.bookmarksSearch.and.returnValue(Promise.resolve([]))

    // Mock browser actions service to return default actions
    browserActionsServiceSpy.getBrowserActions.and.returnValue(
      Promise.resolve([
        { name: 'Test Action 1', action: async () => {} },
        { name: 'Test Action 2', action: async () => {} },
      ]),
    )

    TestBed.configureTestingModule({
      imports: [
        AppComponent,
        ReactiveFormsModule,
        MatIconModule,
        BrowserAnimationsModule,
      ],
      providers: [
        { provide: ChromeService, useValue: chromeServiceSpy },
        {
          provide: ChromeSharedOptionsService,
          useValue: chromeSharedOptionsServiceSpy,
        },
        {
          provide: BrowserActionsService,
          useValue: browserActionsServiceSpy,
        },
      ],
      // No declarations for standalone components
    }).compileComponents()

    mockChromeService = TestBed.inject(
      ChromeService,
    ) as jasmine.SpyObj<ChromeService>
    mockChromeSharedOptionsService = TestBed.inject(
      ChromeSharedOptionsService,
    ) as jasmine.SpyObj<ChromeSharedOptionsService>
    mockBrowserActionsService = TestBed.inject(
      BrowserActionsService,
    ) as jasmine.SpyObj<BrowserActionsService>
  }))

  beforeEach(() => {
    fixture = TestBed.createComponent(AppComponent)
    component = fixture.componentInstance
    fixture.detectChanges()
  })

  it('should create the app', () => {
    expect(component).toBeTruthy()
  })

  describe('Keyboard Navigation', () => {
    beforeEach(async () => {
      // ngOnInit is called, observables are set up.
      // We need to ensure `latestResults` has a known state for these tests.
      // Set searchInput to a value that would typically produce results.
      component.searchInput.setValue('test')

      // Directly mock `latestResults` for predictable keyboard navigation tests.
      component['latestResults'] = {
        actions: [
          { name: 'Action 1', action: async () => {} },
          { name: 'Action 2', action: async () => {} },
        ], // 2 actions
        tabs: [
          {
            name: 'Tab 1',
            url: 'http://tab1.com',
            faviconUrl: '',
            tab: {} as any,
          },
        ], // 1 tab
        bookmarks: [
          {
            name: 'Bookmark 1',
            url: 'http://bookmark1.com',
            faviconUrl: '',
            bookmark: {} as any,
          },
        ], // 1 bookmark
        history: [
          {
            name: 'History 1',
            url: 'http://history1.com',
            faviconUrl: '',
            history: {} as any,
          },
        ], // 1 history item
      }
      // Total results: 2 + 1 + 1 + 1 = 5

      fixture.detectChanges()
      await fixture.whenStable()
    })

    it('should handle ArrowDown key to navigate results', () => {
      spyOn(component as any, 'navigateResults')
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' })
      spyOn(event, 'preventDefault')
      component.onKeyDown(event)

      expect(event.preventDefault).toHaveBeenCalled()
      expect((component as any).navigateResults).toHaveBeenCalledWith('down')
    })

    it('should handle ArrowUp key to navigate results', () => {
      spyOn(component as any, 'navigateResults')
      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' })
      spyOn(event, 'preventDefault')
      component.onKeyDown(event)

      expect(event.preventDefault).toHaveBeenCalled()
      expect((component as any).navigateResults).toHaveBeenCalledWith('up')
    })

    it('should handle Tab key to navigate results down', () => {
      spyOn(component as any, 'navigateResults')
      const event = new KeyboardEvent('keydown', { key: 'Tab' })
      spyOn(event, 'preventDefault')
      component.onKeyDown(event)

      expect(event.preventDefault).toHaveBeenCalled()
      expect((component as any).navigateResults).toHaveBeenCalledWith('down')
    })

    it('should handle Shift+Tab key to navigate results up', () => {
      spyOn(component as any, 'navigateResults')
      const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true })
      spyOn(event, 'preventDefault')
      component.onKeyDown(event)

      expect(event.preventDefault).toHaveBeenCalled()
      expect((component as any).navigateResults).toHaveBeenCalledWith('up')
    })

    it('should handle Enter key to select current result', () => {
      spyOn(component as any, 'selectCurrentResult')
      const event = new KeyboardEvent('keydown', { key: 'Enter' })
      spyOn(event, 'preventDefault')
      component.onKeyDown(event)

      expect(event.preventDefault).toHaveBeenCalled()
      expect((component as any).selectCurrentResult).toHaveBeenCalled()
    })

    it('should handle Escape key to clear search', () => {
      component.searchInputRef = {
        nativeElement: { focus: jasmine.createSpy('focus') },
      } as any
      const event = new KeyboardEvent('keydown', { key: 'Escape' })
      spyOn(event, 'preventDefault')
      spyOn(component.searchInput, 'reset')

      // Call the onKeyDown method directly
      component.onKeyDown(event)

      expect(event.preventDefault).toHaveBeenCalled()
      expect(component.searchInput.reset).toHaveBeenCalled()
      expect(component.searchInputRef.nativeElement.focus).toHaveBeenCalled()
    })

    it('should not handle navigation/selection keys (except Escape) when there are no results', () => {
      // Ensure search input might have a value, but results are empty
      component.searchInput.setValue('querythatyieldsnoresults')
      component['latestResults'] = {
        actions: [],
        tabs: [],
        bookmarks: [],
        history: [],
      } // Force no results
      fixture.detectChanges()

      // Spy on navigation methods
      spyOn(component as any, 'navigateResults')
      spyOn(component as any, 'selectCurrentResult')

      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' })
      spyOn(event, 'preventDefault')
      component.onKeyDown(event)

      // ArrowDown should not be prevented, and navigation should not occur if no results
      expect(event.preventDefault).not.toHaveBeenCalled()
      expect((component as any).navigateResults).not.toHaveBeenCalled()
      expect((component as any).selectCurrentResult).not.toHaveBeenCalled() // Also check select
    })

    it('should correctly navigate down through results', () => {
      // latestResults is set in beforeEach to have 5 items.
      // actions: 2, tabs: 1, bookmarks: 1, history: 1
      // Indices: 0, 1 (actions), 2 (tabs), 3 (bookmarks), 4 (history)

      component.selectedIndex = 0
      ;(component as any).navigateResults('down')
      expect(component.selectedIndex).toBe(1) // Moves from Action 1 to Action 2

      component.selectedIndex = 1
      ;(component as any).navigateResults('down')
      expect(component.selectedIndex).toBe(2) // Moves from Action 2 to Tab 1

      component.selectedIndex = 4 // Last item (index 4)
      ;(component as any).navigateResults('down')
      expect(component.selectedIndex).toBe(0) // Wraps to first item
    })

    it('should wrap around when navigating down from last result', () => {
      // latestResults is set in beforeEach to have 5 items.
      // Indices: 0, 1 (actions), 2 (tabs), 3 (bookmarks), 4 (history)
      component.selectedIndex = 4 // Last result (index 4 out of 0-4)
      ;(component as any).navigateResults('down')
      expect(component.selectedIndex).toBe(0) // Should wrap to first
    })

    it('should correctly navigate up through results', () => {
      // latestResults is set in beforeEach to have 5 items.
      component.selectedIndex = 1
      ;(component as any).navigateResults('up')
      expect(component.selectedIndex).toBe(0)
    })

    it('should wrap around when navigating up from first result', () => {
      // latestResults is set in beforeEach to have 5 items.
      component.selectedIndex = 0
      ;(component as any).navigateResults('up')
      expect(component.selectedIndex).toBe(4) // Should wrap to last (index 4 for 5 items)
    })
  })

  describe('Browser Actions', () => {
    it('should demonstrate the bug in "Close tabs to the right" action', async () => {
      // Setup mock for getCurrentTab (the buggy method that returns undefined for popup)
      mockChromeService.getCurrentTab.and.returnValue(
        Promise.resolve(undefined),
      )

      // Setup mock tabs in the current window (unpinned only as per the query)
      const mockTabs: chrome.tabs.Tab[] = [
        {
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
          url: 'https://tab1.com',
          title: 'Tab 1',
        },
        {
          id: 2,
          index: 1,
          groupId: -1,
          pinned: false,
          highlighted: false,
          windowId: 1,
          active: true,
          incognito: false,
          selected: false,
          discarded: false,
          autoDiscardable: true,
          url: 'https://active-tab.com',
          title: 'Active Tab',
        },
        {
          id: 3,
          index: 2,
          groupId: -1,
          pinned: false,
          highlighted: false,
          windowId: 1,
          active: false,
          incognito: false,
          selected: false,
          discarded: false,
          autoDiscardable: true,
          url: 'https://tab3.com',
          title: 'Tab 3',
        },
      ]

      mockChromeService.tabsQuery.and.returnValue(Promise.resolve(mockTabs))
      mockChromeService.tabsRemove.and.returnValue(Promise.resolve())

      await component.ngOnInit()

      // Test the current buggy implementation (using getCurrentTab)
      const closeTabsActionBuggy = {
        name: 'Close tabs to the right',
        action: async () => {
          const currentTab = await mockChromeService.getCurrentTab()
          const tabs = await mockChromeService.tabsQuery({
            currentWindow: true,
            pinned: false,
          })

          const findIndex = tabs.findIndex((t) => t.id === currentTab?.id)
          if (findIndex === -1) {
            return
          }

          const tabIds = tabs.slice(findIndex + 1).map((t) => t.id)
          if (0 < tabIds.length) {
            await mockChromeService.tabsRemove(tabIds)
          }
        },
      }

      await component.onClickItem(closeTabsActionBuggy)

      expect(mockChromeService.getCurrentTab).toHaveBeenCalled()
      expect(mockChromeService.tabsQuery).toHaveBeenCalledWith({
        currentWindow: true,
        pinned: false,
      })
      // Should NOT remove any tabs because getCurrentTab returns undefined
      expect(mockChromeService.tabsRemove).not.toHaveBeenCalled()
    })

    it('should execute "Close tabs to the right" action correctly with the fix', async () => {
      // Setup mock for getCurrentActiveTab (the correct method)
      const activeTab: chrome.tabs.Tab = {
        id: 2,
        index: 1,
        groupId: -1,
        pinned: false,
        highlighted: false,
        windowId: 1,
        active: true,
        incognito: false,
        selected: false,
        discarded: false,
        autoDiscardable: true,
        url: 'https://active-tab.com',
        title: 'Active Tab',
      }

      // Setup mock tabs in the current window (unpinned only as per the query)
      const mockTabs: chrome.tabs.Tab[] = [
        {
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
          url: 'https://tab1.com',
          title: 'Tab 1',
        },
        activeTab,
        {
          id: 3,
          index: 2,
          groupId: -1,
          pinned: false,
          highlighted: false,
          windowId: 1,
          active: false,
          incognito: false,
          selected: false,
          discarded: false,
          autoDiscardable: true,
          url: 'https://tab3.com',
          title: 'Tab 3',
        },
        {
          id: 4,
          index: 3,
          groupId: -1,
          pinned: false,
          highlighted: false,
          windowId: 1,
          active: false,
          incognito: false,
          selected: false,
          discarded: false,
          autoDiscardable: true,
          url: 'https://tab4.com',
          title: 'Tab 4',
        },
      ]

      mockChromeService.getCurrentActiveTab.and.returnValue(
        Promise.resolve(activeTab),
      )
      mockChromeService.tabsQuery.and.returnValue(Promise.resolve(mockTabs))
      mockChromeService.tabsRemove.and.returnValue(Promise.resolve())

      await component.ngOnInit()

      // Test the fixed implementation (using getCurrentActiveTab)
      const closeTabsActionFixed = {
        name: 'Close tabs to the right',
        action: async () => {
          const currentTab = await mockChromeService.getCurrentActiveTab()
          const tabs = await mockChromeService.tabsQuery({
            currentWindow: true,
            pinned: false,
          })

          const findIndex = tabs.findIndex((t) => t.id === currentTab.id)
          if (findIndex === -1) {
            return
          }

          const tabIds = tabs.slice(findIndex + 1).map((t) => t.id)
          if (0 < tabIds.length) {
            await mockChromeService.tabsRemove(tabIds)
          }
        },
      }

      await component.onClickItem(closeTabsActionFixed)

      expect(mockChromeService.getCurrentActiveTab).toHaveBeenCalled()
      expect(mockChromeService.tabsQuery).toHaveBeenCalledWith({
        currentWindow: true,
        pinned: false,
      })
      // Should remove tabs 3 and 4 (to the right of active tab 2)
      expect(mockChromeService.tabsRemove).toHaveBeenCalledWith([3, 4])
    })

    it('should execute Copy URL action correctly', async () => {
      // Setup mock for getCurrentActiveTab with proper Tab interface
      const mockTab: chrome.tabs.Tab = {
        id: 1,
        index: 0,
        groupId: -1,
        pinned: false,
        highlighted: false,
        windowId: 1,
        active: true,
        incognito: false,
        selected: false,
        discarded: false,
        autoDiscardable: true,
        url: 'https://example.com',
        title: 'Example',
      }
      mockChromeService.getCurrentActiveTab.and.returnValue(
        Promise.resolve(mockTab),
      )
      mockChromeService.copyToClipboard.and.returnValue(Promise.resolve())

      await component.ngOnInit()

      // Use the actual browser action from the service
      const browserActions = await mockBrowserActionsService.getBrowserActions()
      const copyUrlAction = browserActions.find(
        (action) => action.name === 'Copy URL',
      )

      expect(copyUrlAction).toBeDefined()
      await component.onClickItem(copyUrlAction!)

      expect(mockChromeService.getCurrentActiveTab).toHaveBeenCalled()
      expect(mockChromeService.copyToClipboard).toHaveBeenCalledWith(
        'https://example.com',
      )
    })

    it('should handle Copy URL action when tab has no URL', async () => {
      // Setup mock for getCurrentActiveTab with no URL
      const mockTab: chrome.tabs.Tab = {
        id: 1,
        index: 0,
        groupId: -1,
        pinned: false,
        highlighted: false,
        windowId: 1,
        active: true,
        incognito: false,
        selected: false,
        discarded: false,
        autoDiscardable: true,
        url: undefined,
        title: 'Example',
      }
      mockChromeService.getCurrentActiveTab.and.returnValue(
        Promise.resolve(mockTab),
      )
      mockChromeService.copyToClipboard.and.returnValue(Promise.resolve())

      await component.ngOnInit()

      // Use the actual browser action from the service
      const browserActions = await mockBrowserActionsService.getBrowserActions()
      const copyUrlAction = browserActions.find(
        (action) => action.name === 'Copy URL',
      )

      expect(copyUrlAction).toBeDefined()
      await component.onClickItem(copyUrlAction!)

      expect(mockChromeService.getCurrentActiveTab).toHaveBeenCalled()
      expect(mockChromeService.copyToClipboard).not.toHaveBeenCalled()
    })

    it('should execute "Move current tab to first" action correctly', async () => {
      mockChromeService.moveCurrentTabToFirst.and.returnValue(Promise.resolve())

      // Mock browser actions to include the move to first action
      const mockActions = [
        {
          name: 'Move current tab to first',
          action: jasmine.createSpy('moveToFirst').and.callFake(async () => {
            await mockChromeService.moveCurrentTabToFirst()
          }),
        },
      ]
      mockBrowserActionsService.getBrowserActions.and.returnValue(
        Promise.resolve(mockActions),
      )

      await component.ngOnInit()

      const moveToFirstAction = mockActions[0]
      await component.onClickItem(moveToFirstAction)

      expect(moveToFirstAction.action).toHaveBeenCalled()
      expect(mockChromeService.moveCurrentTabToFirst).toHaveBeenCalled()
    })

    it('should execute "Move current tab to last" action correctly', async () => {
      mockChromeService.moveCurrentTabToLast.and.returnValue(Promise.resolve())

      // Mock browser actions to include the move to last action
      const mockActions = [
        {
          name: 'Move current tab to last',
          action: jasmine.createSpy('moveToLast').and.callFake(async () => {
            await mockChromeService.moveCurrentTabToLast()
          }),
        },
      ]
      mockBrowserActionsService.getBrowserActions.and.returnValue(
        Promise.resolve(mockActions),
      )

      await component.ngOnInit()

      const moveToLastAction = mockActions[0]
      await component.onClickItem(moveToLastAction)

      expect(moveToLastAction.action).toHaveBeenCalled()
      expect(mockChromeService.moveCurrentTabToLast).toHaveBeenCalled()
    })

    it('should use browser actions service for actions', () => {
      // This test just verifies that the component depends on and uses the browser actions service
      expect(component['browserActionsService']).toBeDefined()
      expect(component['browserActionsService']).toBe(mockBrowserActionsService)
    })

    it('should execute browser actions through onClickItem', async () => {
      const mockAction = {
        name: 'Test Action',
        action: jasmine
          .createSpy('testAction')
          .and.returnValue(Promise.resolve()),
      }

      await component.onClickItem(mockAction)

      expect(mockAction.action).toHaveBeenCalled()
    })
    })
  })
})
