import {
  Component,
  OnInit,
  ViewChild,
  HostListener,
  ElementRef,
} from '@angular/core'
import { CommonModule } from '@angular/common'
import { UntypedFormControl, ReactiveFormsModule } from '@angular/forms'
import { Observable, combineLatest } from 'rxjs'
import { map, switchMap, tap, startWith } from 'rxjs/operators'
import { MatIconModule } from '@angular/material/icon'
import { ChromeService } from './chrome.service'
import Fuse from 'fuse.js'
import { ChromeSharedOptionsService } from './chrome-shared-options.service'
import Tab = chrome.tabs.Tab
import HistoryItem = chrome.history.HistoryItem

interface BrowserAction {
  name: string
  action: () => Promise<void>
}

interface SearchResult {
  name: string
  url: string
  faviconUrl: string

  tab?: Tab
  history?: HistoryItem
}

function filterUniqueValues(results: SearchResult[]): SearchResult[] {
  const set = new Set()
  return results.filter((result: SearchResult) => {
    if (set.has(result.url)) {
      // contains; no need to return
      return false
    }
    set.add(result.url)
    return true
  })
}

function isBrowserAction(
  result: SearchResult | BrowserAction,
): result is BrowserAction {
  return (result as BrowserAction).action !== undefined
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
})
export class AppComponent implements OnInit {
  title = 'butler'
  searchInput: UntypedFormControl = new UntypedFormControl()

  @ViewChild('searchInputRef') searchInputRef: ElementRef<HTMLInputElement>

  tabResults$: Observable<SearchResult[]>
  historyResults$: Observable<SearchResult[]>
  browserActions$: Observable<BrowserAction[]>

  isSearchingHistory = false
  selectedIndex = 0

  // Track current results for keyboard navigation
  private currentActions: BrowserAction[] = []
  private currentTabs: SearchResult[] = []
  private currentHistory: SearchResult[] = []

  constructor(
    private chromeService: ChromeService,
    private chromeSharedOptionsService: ChromeSharedOptionsService,
  ) {}

  get totalResults(): number {
    return (
      this.currentActions.length +
      this.currentTabs.length +
      this.currentHistory.length
    )
  }

  get hasAnyResults(): boolean {
    return this.totalResults > 0
  }

  async ngOnInit(): Promise<void> {
    const options = await this.chromeSharedOptionsService.getOptions()

    const BROWSER_ACTIONS: BrowserAction[] = [
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
          const currentTab = await this.chromeService.getCurrentTab()
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
        name: 'Sort tabs by URL',
        action: async () => {
          await this.chromeService.sortTabsInAllWindows()
        },
      },
    ]

    this.browserActions$ = this.searchInput.valueChanges.pipe(
      startWith(''),
      map((searchInputText: string) => {
        if (!searchInputText) {
          return []
        }
        return new Fuse<BrowserAction>(BROWSER_ACTIONS, {
          isCaseSensitive: false,
          keys: ['name'],
        })
          .search(searchInputText)
          .map((value) => {
            return value.item
          })
      }),
      tap((actions) => {
        this.currentActions = actions
        this.updateSelection()
      }),
    )

    this.tabResults$ = this.searchInput.valueChanges.pipe(
      startWith(''),
      switchMap((searchInputText) => {
        if (!searchInputText || !options.includesTabs) {
          return []
        }
        return this.chromeService.tabsQuery({}).then((tabs) => {
          const filteredTabs = new Fuse<Tab>(tabs, {
            keys: ['title', 'url'],
            isCaseSensitive: false,
          }).search(searchInputText)

          return filteredTabs.map(({ item: tab }) => ({
            faviconUrl: tab.favIconUrl,
            name: tab.title,
            url: tab.url,
            tab,
          }))
        })
      }),
      tap((tabs) => {
        this.currentTabs = tabs
        this.updateSelection()
      }),
    )

    this.historyResults$ = this.searchInput.valueChanges.pipe(
      startWith(''),
      switchMap((searchInputText) => {
        if (!searchInputText || !options.includesHistory) {
          return []
        }

        this.isSearchingHistory = true
        return this.chromeService
          .historySearch({
            text: searchInputText,
            startTime: options.searchHistoryStartDateInUnixEpoch,
          })
          .then((histories) => {
            return histories.map((result) => ({
              faviconUrl: '',
              name: result.title,
              url: result.url,
              history: result,
            }))
          })
      }),
      // there could be many duplicate for history. Hence, remove the duplicates.
      map((results) => filterUniqueValues(results)),
      tap(() => {
        this.isSearchingHistory = false
      }),
      tap((history) => {
        this.currentHistory = history
        this.updateSelection()
      }),
    )
  }

  // Helper method to reset selection when results change
  private updateSelection(): void {
    // Reset to first item when results change
    this.selectedIndex = 0
  }

  // Index calculation for result selection
  getActionIndex(actionIndex: number): number {
    return actionIndex
  }

  getTabIndex(tabIndex: number): number {
    return this.currentActions.length + tabIndex
  }

  getHistoryIndex(historyIndex: number): number {
    return this.currentActions.length + this.currentTabs.length + historyIndex
  }

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (!this.searchInput.value || this.searchInput.value.length === 0) {
      return
    }

    switch (event.key) {
      case 'ArrowDown':
      case 'Tab':
        event.preventDefault()
        this.navigateResults('down')
        break
      case 'ArrowUp':
        event.preventDefault()
        this.navigateResults('up')
        break
      case 'Enter':
        event.preventDefault()
        this.selectCurrentResult()
        break
      case 'Escape':
        event.preventDefault()
        this.searchInput.reset()
        this.searchInputRef?.nativeElement.focus()
        break
    }
  }

  private navigateResults(direction: 'up' | 'down'): void {
    if (this.totalResults === 0) {
      return
    }

    if (direction === 'down') {
      this.selectedIndex = (this.selectedIndex + 1) % this.totalResults
    } else {
      this.selectedIndex =
        this.selectedIndex === 0
          ? this.totalResults - 1
          : this.selectedIndex - 1
    }
  }

  private selectCurrentResult(): void {
    const actionsCount = this.currentActions.length
    const tabsCount = this.currentTabs.length

    if (this.selectedIndex < actionsCount) {
      // Select from actions
      const action = this.currentActions[this.selectedIndex]
      if (action) {
        this.onClickItem(action)
      }
    } else if (this.selectedIndex < actionsCount + tabsCount) {
      // Select from tabs
      const tabIndex = this.selectedIndex - actionsCount
      const tab = this.currentTabs[tabIndex]
      if (tab) {
        this.onClickItem(tab)
      }
    } else {
      // Select from history
      const historyIndex = this.selectedIndex - actionsCount - tabsCount
      const history = this.currentHistory[historyIndex]
      if (history) {
        this.onClickItem(history)
      }
    }
  }

  async onClickItem(result: SearchResult | BrowserAction): Promise<void> {
    if (isBrowserAction(result)) {
      await result.action()
    } else if (result.tab) {
      const currentWindow = await this.chromeService.getCurrentWindow()
      if (currentWindow.id === result.tab.windowId) {
        await this.chromeService.activateTab(result.tab.id)
      } else {
        await this.chromeService.activateWindow(result.tab.windowId)
        await this.chromeService.activateTab(result.tab.id)
      }
    } else if (result.history) {
      await this.chromeService.tabsCreate({ active: true, url: result.url })
      this.searchInput.reset()
    }
    // close the popup window.
    window.close()
  }
}
