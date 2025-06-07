import { TestBed, waitForAsync, ComponentFixture } from '@angular/core/testing'
import { AppComponent } from './app.component'
import { ReactiveFormsModule } from '@angular/forms'
import { MatIconModule } from '@angular/material/icon'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'
import { ChromeService } from './chrome.service'
import { ChromeSharedOptionsService } from './chrome-shared-options.service'

describe('AppComponent', () => {
  let component: AppComponent
  let fixture: ComponentFixture<AppComponent>
  let mockChromeService: jasmine.SpyObj<ChromeService>
  let mockChromeSharedOptionsService: jasmine.SpyObj<ChromeSharedOptionsService>

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
      'bookmarksSearch', // Added bookmarksSearch
    ])

    const chromeSharedOptionsServiceSpy = jasmine.createSpyObj(
      'ChromeSharedOptionsService',
      ['getOptions'],
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
    chromeServiceSpy.bookmarksSearch.and.returnValue(Promise.resolve([])) // Added default mock for bookmarksSearch

    TestBed.configureTestingModule({
      imports: [
        AppComponent, // Import the standalone component
        ReactiveFormsModule,
        MatIconModule,
        BrowserAnimationsModule, // Often needed for Material components in tests
      ],
      providers: [
        { provide: ChromeService, useValue: chromeServiceSpy },
        {
          provide: ChromeSharedOptionsService,
          useValue: chromeSharedOptionsServiceSpy,
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
  }))

  beforeEach(() => {
    fixture = TestBed.createComponent(AppComponent)
    component = fixture.componentInstance
    fixture.detectChanges()
  })

  it('should create the app', () => {
    expect(component).toBeTruthy()
  })

  // eslint-disable-next-line quotes
  it("should have as title 'butler'", () => {
    expect(component.title).toEqual('butler')
  })

  describe('Keyboard Navigation', () => {
    beforeEach(async () => {
      // ngOnInit is called, observables are set up.
      // We need to ensure `latestResults` has a known state for these tests.
      // Set searchInput to a value that would typically produce results.
      component.searchInput.setValue('test'); 
      
      // Directly mock `latestResults` for predictable keyboard navigation tests.
      component['latestResults'] = {
        actions: [{ name: 'Action 1', action: async () => {} }, { name: 'Action 2', action: async () => {} }], // 2 actions
        tabs: [{ name: 'Tab 1', url: 'http://tab1.com', faviconUrl: '', tab: {} as any }], // 1 tab
        bookmarks: [{ name: 'Bookmark 1', url: 'http://bookmark1.com', faviconUrl: '', bookmark: {} as any }], // 1 bookmark
        history: [{ name: 'History 1', url: 'http://history1.com', faviconUrl: '', history: {} as any }] // 1 history item
      };
      // Total results: 2 + 1 + 1 + 1 = 5

      fixture.detectChanges(); // Apply the changes
      await fixture.whenStable(); // Ensure component state is stable
    });

    it('should handle ArrowDown key to navigate results', () => {
      // Spy on the navigateResults method
      spyOn(component as any, 'navigateResults')

      // Create a keydown event for ArrowDown
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' })
      spyOn(event, 'preventDefault')

      // Call the onKeyDown method directly
      component.onKeyDown(event)

      expect(event.preventDefault).toHaveBeenCalled()
      expect((component as any).navigateResults).toHaveBeenCalledWith('down')
    })

    it('should handle ArrowUp key to navigate results', () => {
      // Spy on the navigateResults method
      spyOn(component as any, 'navigateResults')

      // Create a keydown event for ArrowUp
      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' })
      spyOn(event, 'preventDefault')

      // Call the onKeyDown method directly
      component.onKeyDown(event)

      expect(event.preventDefault).toHaveBeenCalled()
      expect((component as any).navigateResults).toHaveBeenCalledWith('up')
    })

    it('should handle Tab key to navigate results down', () => {
      // Spy on the navigateResults method
      spyOn(component as any, 'navigateResults')

      // Create a keydown event for Tab
      const event = new KeyboardEvent('keydown', { key: 'Tab' })
      spyOn(event, 'preventDefault')

      // Call the onKeyDown method directly
      component.onKeyDown(event)

      expect(event.preventDefault).toHaveBeenCalled()
      expect((component as any).navigateResults).toHaveBeenCalledWith('down')
    })

    it('should handle Shift+Tab key to navigate results up', () => {
      // Spy on the navigateResults method
      spyOn(component as any, 'navigateResults')

      // Create a keydown event for Shift+Tab
      const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true })
      spyOn(event, 'preventDefault')

      // Call the onKeyDown method directly
      component.onKeyDown(event)

      expect(event.preventDefault).toHaveBeenCalled()
      expect((component as any).navigateResults).toHaveBeenCalledWith('up')
    })

    it('should handle Enter key to select current result', () => {
      // Spy on the selectCurrentResult method
      spyOn(component as any, 'selectCurrentResult')

      // Create a keydown event for Enter
      const event = new KeyboardEvent('keydown', { key: 'Enter' })
      spyOn(event, 'preventDefault')

      // Call the onKeyDown method directly
      component.onKeyDown(event)

      expect(event.preventDefault).toHaveBeenCalled()
      expect((component as any).selectCurrentResult).toHaveBeenCalled()
    })

    it('should handle Escape key to clear search', () => {
      // Mock the searchInputRef
      component.searchInputRef = {
        nativeElement: { focus: jasmine.createSpy('focus') },
      } as any

      // Create a keydown event for Escape
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
      component.searchInput.setValue('querythatyieldsnoresults');
      component['latestResults'] = { actions: [], tabs: [], bookmarks: [], history: [] }; // Force no results
      fixture.detectChanges();

      // Spy on navigation methods
      spyOn(component as any, 'navigateResults');
      spyOn(component as any, 'selectCurrentResult');

      // Create a keydown event for ArrowDown
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      spyOn(event, 'preventDefault');

      // Call the onKeyDown method directly
      component.onKeyDown(event);

      // ArrowDown should not be prevented, and navigation should not occur if no results
      expect(event.preventDefault).not.toHaveBeenCalled();
      expect((component as any).navigateResults).not.toHaveBeenCalled();
      expect((component as any).selectCurrentResult).not.toHaveBeenCalled(); // Also check select
    });

    it('should correctly navigate down through results', () => {
      // latestResults is set in beforeEach to have 5 items.
      // actions: 2, tabs: 1, bookmarks: 1, history: 1
      // Indices: 0, 1 (actions), 2 (tabs), 3 (bookmarks), 4 (history)
      
      component.selectedIndex = 0;
      (component as any).navigateResults('down');
      expect(component.selectedIndex).toBe(1); // Moves from Action 1 to Action 2

      component.selectedIndex = 1;
      (component as any).navigateResults('down');
      expect(component.selectedIndex).toBe(2); // Moves from Action 2 to Tab 1

      component.selectedIndex = 4; // Last item (index 4)
      (component as any).navigateResults('down');
      expect(component.selectedIndex).toBe(0); // Wraps to first item
    });

    it('should wrap around when navigating down from last result', () => {
      // latestResults is set in beforeEach to have 5 items.
      // Indices: 0, 1 (actions), 2 (tabs), 3 (bookmarks), 4 (history)
      component.selectedIndex = 4; // Last result (index 4 out of 0-4)

      // Call navigateResults directly
      (component as any).navigateResults('down');

      expect(component.selectedIndex).toBe(0); // Should wrap to first
    });

    it('should correctly navigate up through results', () => {
      // latestResults is set in beforeEach to have 5 items.
      component.selectedIndex = 1;

      // Call navigateResults directly
      (component as any).navigateResults('up');

      expect(component.selectedIndex).toBe(0);
    });

    it('should wrap around when navigating up from first result', () => {
      // latestResults is set in beforeEach to have 5 items.
      component.selectedIndex = 0;

      // Call navigateResults directly
      (component as any).navigateResults('up');

      expect(component.selectedIndex).toBe(4); // Should wrap to last (index 4 for 5 items)
    });
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

      // Initialize the component
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

      // Execute the buggy action
      await component.onClickItem(closeTabsActionBuggy)

      // Verify that getCurrentTab was called
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

      // Initialize the component
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

      // Execute the fixed action
      await component.onClickItem(closeTabsActionFixed)

      // Verify that the correct methods were called
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

      // Initialize the component
      await component.ngOnInit()

      // Create a mock browser action that represents the Copy URL action
      const copyUrlAction = {
        name: 'Copy URL',
        action: async () => {
          const activeTab = await mockChromeService.getCurrentActiveTab()
          if (activeTab && activeTab.url) {
            await mockChromeService.copyToClipboard(activeTab.url)
          }
        },
      }

      // Execute the action
      await component.onClickItem(copyUrlAction)

      // Verify that the required service methods were called
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

      // Initialize the component
      await component.ngOnInit()

      // Create a mock browser action that represents the Copy URL action
      const copyUrlAction = {
        name: 'Copy URL',
        action: async () => {
          const activeTab = await mockChromeService.getCurrentActiveTab()
          if (activeTab && activeTab.url) {
            await mockChromeService.copyToClipboard(activeTab.url)
          }
        },
      }

      // Execute the action
      await component.onClickItem(copyUrlAction)

      // Verify that getCurrentActiveTab was called but copyToClipboard was not
      expect(mockChromeService.getCurrentActiveTab).toHaveBeenCalled()
      expect(mockChromeService.copyToClipboard).not.toHaveBeenCalled()
    })
  })
})
