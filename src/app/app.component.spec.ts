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

  it("should have as title 'butler'", () => {
    expect(component.title).toEqual('butler')
  })

  describe('Keyboard Navigation', () => {
    beforeEach(() => {
      // Set up search input with a value to enable keyboard handling
      component.searchInput.setValue('test')
      // Mock some results by setting private arrays
      ;(component as any).currentActions = [
        { name: 'action1', action: () => {} },
      ]
      ;(component as any).currentTabs = [
        { name: 'tab1', url: 'url1', faviconUrl: '' },
      ]
      ;(component as any).currentHistory = [
        { name: 'history1', url: 'url2', faviconUrl: '' },
      ]
      fixture.detectChanges()
    })

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

    it('should handle Tab key to navigate results', () => {
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

    it('should not handle keys when search input is empty', () => {
      // Ensure search input is empty
      component.searchInput.setValue('')

      // Spy on navigation methods
      spyOn(component as any, 'navigateResults')
      spyOn(component as any, 'selectCurrentResult')

      // Create a keydown event for ArrowDown
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' })
      spyOn(event, 'preventDefault')

      // Call the onKeyDown method directly
      component.onKeyDown(event)

      expect(event.preventDefault).not.toHaveBeenCalled()
      expect((component as any).navigateResults).not.toHaveBeenCalled()
    })

    it('should correctly navigate down through results', () => {
      component.selectedIndex = 0
      // totalResults is now a getter that calculates from arrays

      // Call navigateResults directly
      ;(component as any).navigateResults('down')

      expect(component.selectedIndex).toBe(1)
    })

    it('should wrap around when navigating down from last result', () => {
      component.selectedIndex = 2
      // totalResults should be 3 based on our mocked arrays

      // Call navigateResults directly
      ;(component as any).navigateResults('down')

      expect(component.selectedIndex).toBe(0)
    })

    it('should correctly navigate up through results', () => {
      component.selectedIndex = 1
      // totalResults should be 3 based on our mocked arrays

      // Call navigateResults directly
      ;(component as any).navigateResults('up')

      expect(component.selectedIndex).toBe(0)
    })

    it('should wrap around when navigating up from first result', () => {
      component.selectedIndex = 0
      // totalResults should be 3 based on our mocked arrays

      // Call navigateResults directly
      ;(component as any).navigateResults('up')

      expect(component.selectedIndex).toBe(2)
    })
  })
})
