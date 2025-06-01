import { TestBed, waitForAsync, ComponentFixture } from '@angular/core/testing'
import { AppComponent } from './app.component'
import { ReactiveFormsModule } from '@angular/forms'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatListModule } from '@angular/material/list'
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
        MatFormFieldModule,
        MatInputModule,
        MatListModule,
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

  it(`should have as title 'butler'`, () => {
    expect(component.title).toEqual('butler')
  })

  describe('Keyboard Navigation', () => {
    beforeEach(() => {
      // Set up search input with a value to enable keyboard handling
      component.searchInput.setValue('test')
      fixture.detectChanges()
    })

    it('should handle Tab key to move focus from input to first list option', () => {
      // Mock the selection list with options
      const mockOption = {
        _hostElement: { focus: jasmine.createSpy('focus') },
      }
      component.selectionList = {
        options: { toArray: () => [mockOption] },
      } as any

      // Mock document.activeElement to be the search input
      spyOnProperty(document, 'activeElement', 'get').and.returnValue(
        component.searchInputRef.nativeElement,
      )

      // Create a keydown event for Tab
      const event = new KeyboardEvent('keydown', { key: 'Tab' })
      spyOn(event, 'preventDefault')

      // Call the onKeyDown method directly
      component.onKeyDown(event)

      expect(event.preventDefault).toHaveBeenCalled()
      expect(mockOption._hostElement.focus).toHaveBeenCalled()
    })

    it('should handle j key press when focus is on list option', () => {
      // Spy on the navigateList method
      spyOn(component as any, 'navigateList')

      // Mock document.activeElement to be inside a mat-list-option
      const mockElement = document.createElement('div')
      const mockListOption = document.createElement('mat-list-option')
      mockListOption.appendChild(mockElement)
      spyOnProperty(document, 'activeElement', 'get').and.returnValue(
        mockElement,
      )
      spyOn(mockElement, 'closest').and.returnValue(mockListOption)

      // Create a keydown event for 'j'
      const event = new KeyboardEvent('keydown', { key: 'j' })
      spyOn(event, 'preventDefault')
      spyOn(event, 'stopPropagation')

      // Call the onKeyDown method directly
      component.onKeyDown(event)

      expect(event.preventDefault).toHaveBeenCalled()
      expect(event.stopPropagation).toHaveBeenCalled()
      expect((component as any).navigateList).toHaveBeenCalledWith('down')
    })

    it('should handle k key press when focus is on list option', () => {
      // Spy on the navigateList method
      spyOn(component as any, 'navigateList')

      // Mock document.activeElement to be inside a mat-list-option
      const mockElement = document.createElement('div')
      const mockListOption = document.createElement('mat-list-option')
      mockListOption.appendChild(mockElement)
      spyOnProperty(document, 'activeElement', 'get').and.returnValue(
        mockElement,
      )
      spyOn(mockElement, 'closest').and.returnValue(mockListOption)

      // Create a keydown event for 'k'
      const event = new KeyboardEvent('keydown', { key: 'k' })
      spyOn(event, 'preventDefault')
      spyOn(event, 'stopPropagation')

      // Call the onKeyDown method directly
      component.onKeyDown(event)

      expect(event.preventDefault).toHaveBeenCalled()
      expect(event.stopPropagation).toHaveBeenCalled()
      expect((component as any).navigateList).toHaveBeenCalledWith('up')
    })

    it('should not handle j/k keys when search input is empty', () => {
      // Ensure search input is empty
      component.searchInput.setValue('')
      fixture.detectChanges()

      // Spy on the navigateList method
      spyOn(component as any, 'navigateList')

      // Create a keydown event for 'j'
      const jEvent = new KeyboardEvent('keydown', { key: 'j' })
      spyOn(jEvent, 'preventDefault')

      // Call the onKeyDown method directly
      component.onKeyDown(jEvent)

      expect(jEvent.preventDefault).not.toHaveBeenCalled()
      expect((component as any).navigateList).not.toHaveBeenCalled()
    })

    it('should not handle j/k keys when focus is not on list option', () => {
      // Spy on the navigateList method
      spyOn(component as any, 'navigateList')

      // Mock document.activeElement to be outside of list options
      const mockElement = document.createElement('input')
      spyOnProperty(document, 'activeElement', 'get').and.returnValue(
        mockElement,
      )
      spyOn(mockElement, 'closest').and.returnValue(null)

      // Create a keydown event for 'j'
      const jEvent = new KeyboardEvent('keydown', { key: 'j' })
      spyOn(jEvent, 'preventDefault')

      // Call the onKeyDown method directly
      component.onKeyDown(jEvent)

      expect(jEvent.preventDefault).not.toHaveBeenCalled()
      expect((component as any).navigateList).not.toHaveBeenCalled()
    })

    it('should not handle arrow keys in custom onKeyDown handler', () => {
      // Spy on the navigateList method
      spyOn(component as any, 'navigateList')

      // Mock document.activeElement to be inside a mat-list-option
      const mockElement = document.createElement('div')
      const mockListOption = document.createElement('mat-list-option')
      mockListOption.appendChild(mockElement)
      spyOnProperty(document, 'activeElement', 'get').and.returnValue(
        mockElement,
      )
      spyOn(mockElement, 'closest').and.returnValue(mockListOption)

      // Create a keydown event for 'ArrowDown'
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' })
      spyOn(event, 'preventDefault')
      spyOn(event, 'stopPropagation')

      // Call the onKeyDown method directly
      component.onKeyDown(event)

      // Arrow keys should be ignored by our custom handler
      // to let Angular Material handle them natively
      expect(event.preventDefault).not.toHaveBeenCalled()
      expect(event.stopPropagation).not.toHaveBeenCalled()
      expect((component as any).navigateList).not.toHaveBeenCalled()
    })

    it('should not handle ArrowUp in custom onKeyDown handler', () => {
      // Spy on the navigateList method
      spyOn(component as any, 'navigateList')

      // Mock document.activeElement to be inside a mat-list-option
      const mockElement = document.createElement('div')
      const mockListOption = document.createElement('mat-list-option')
      mockListOption.appendChild(mockElement)
      spyOnProperty(document, 'activeElement', 'get').and.returnValue(
        mockElement,
      )
      spyOn(mockElement, 'closest').and.returnValue(mockListOption)

      // Create a keydown event for 'ArrowUp'
      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' })
      spyOn(event, 'preventDefault')
      spyOn(event, 'stopPropagation')

      // Call the onKeyDown method directly
      component.onKeyDown(event)

      // Arrow keys should be ignored by our custom handler
      expect(event.preventDefault).not.toHaveBeenCalled()
      expect(event.stopPropagation).not.toHaveBeenCalled()
      expect((component as any).navigateList).not.toHaveBeenCalled()
    })

    it('should call stopPropagation for j/k keys', () => {
      // Spy on the navigateList method
      spyOn(component as any, 'navigateList')

      // Mock document.activeElement to be inside a mat-list-option
      const mockElement = document.createElement('div')
      const mockListOption = document.createElement('mat-list-option')
      mockListOption.appendChild(mockElement)
      spyOnProperty(document, 'activeElement', 'get').and.returnValue(
        mockElement,
      )
      spyOn(mockElement, 'closest').and.returnValue(mockListOption)

      // Create a keydown event for 'j'
      const event = new KeyboardEvent('keydown', { key: 'j' })
      spyOn(event, 'preventDefault')
      spyOn(event, 'stopPropagation')

      // Call the onKeyDown method directly
      component.onKeyDown(event)

      expect(event.preventDefault).toHaveBeenCalled()
      expect(event.stopPropagation).toHaveBeenCalled()
      expect((component as any).navigateList).toHaveBeenCalledWith('down')
    })

    it('should ignore non-j/k/Tab keys', () => {
      // Spy on the navigateList method
      spyOn(component as any, 'navigateList')

      // Mock document.activeElement to be inside a mat-list-option
      const mockElement = document.createElement('div')
      const mockListOption = document.createElement('mat-list-option')
      mockListOption.appendChild(mockElement)
      spyOnProperty(document, 'activeElement', 'get').and.returnValue(
        mockElement,
      )
      spyOn(mockElement, 'closest').and.returnValue(mockListOption)

      // Create a keydown event for a different key
      const event = new KeyboardEvent('keydown', { key: 'a' })
      spyOn(event, 'preventDefault')

      // Call the onKeyDown method directly
      component.onKeyDown(event)

      expect(event.preventDefault).not.toHaveBeenCalled()
      expect((component as any).navigateList).not.toHaveBeenCalled()
    })
  })
})
