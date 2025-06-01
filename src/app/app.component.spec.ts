import { TestBed, waitForAsync, ComponentFixture } from '@angular/core/testing'
import { AppComponent } from './app.component'
import { ReactiveFormsModule } from '@angular/forms'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatListModule } from '@angular/material/list'
import { MatIconModule } from '@angular/material/icon'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'
import { ChromeService } from './chrome.service'
import { ChromeSharedOptionsService } from 'chrome-shared-options'

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
    it('should handle j key press and simulate ArrowDown', () => {
      // Set up search input with a value to enable keyboard handling
      component.searchInput.setValue('test')
      fixture.detectChanges()

      // Spy on the simulateArrowKey method
      spyOn(component as any, 'simulateArrowKey')

      // Create a keydown event for 'j'
      const event = new KeyboardEvent('keydown', { key: 'j' })
      spyOn(event, 'preventDefault')

      // Call the onKeyDown method directly
      component.onKeyDown(event)

      expect(event.preventDefault).toHaveBeenCalled()
      expect((component as any).simulateArrowKey).toHaveBeenCalledWith(
        'ArrowDown',
      )
    })

    it('should handle k key press and simulate ArrowUp', () => {
      // Set up search input with a value to enable keyboard handling
      component.searchInput.setValue('test')
      fixture.detectChanges()

      // Spy on the simulateArrowKey method
      spyOn(component as any, 'simulateArrowKey')

      // Create a keydown event for 'k'
      const event = new KeyboardEvent('keydown', { key: 'k' })
      spyOn(event, 'preventDefault')

      // Call the onKeyDown method directly
      component.onKeyDown(event)

      expect(event.preventDefault).toHaveBeenCalled()
      expect((component as any).simulateArrowKey).toHaveBeenCalledWith(
        'ArrowUp',
      )
    })

    it('should not handle j/k keys when search input is empty', () => {
      // Ensure search input is empty
      component.searchInput.setValue('')
      fixture.detectChanges()

      // Spy on the simulateArrowKey method
      spyOn(component as any, 'simulateArrowKey')

      // Create a keydown event for 'j'
      const jEvent = new KeyboardEvent('keydown', { key: 'j' })
      spyOn(jEvent, 'preventDefault')

      // Call the onKeyDown method directly
      component.onKeyDown(jEvent)

      expect(jEvent.preventDefault).not.toHaveBeenCalled()
      expect((component as any).simulateArrowKey).not.toHaveBeenCalled()
    })

    it('should ignore non-j/k keys', () => {
      // Set up search input with a value to enable keyboard handling
      component.searchInput.setValue('test')
      fixture.detectChanges()

      // Spy on the simulateArrowKey method
      spyOn(component as any, 'simulateArrowKey')

      // Create a keydown event for a different key
      const event = new KeyboardEvent('keydown', { key: 'a' })
      spyOn(event, 'preventDefault')

      // Call the onKeyDown method directly
      component.onKeyDown(event)

      expect(event.preventDefault).not.toHaveBeenCalled()
      expect((component as any).simulateArrowKey).not.toHaveBeenCalled()
    })
  })
})
