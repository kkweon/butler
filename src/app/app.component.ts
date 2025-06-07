import {
  Component,
  OnInit,
  ViewChild,
  HostListener,
  ElementRef,
} from '@angular/core'
import { CommonModule } from '@angular/common'
import { UntypedFormControl, ReactiveFormsModule } from '@angular/forms'
import { Observable, combineLatest, BehaviorSubject } from 'rxjs'
import { map, switchMap, tap, startWith, shareReplay } from 'rxjs/operators'
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

interface CombinedResults {
  actions: BrowserAction[]
  tabs: SearchResult[]
  history: SearchResult[]
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

  // Combined results observable
  allResults$: Observable<CombinedResults>

  // Individual observables derived from combined results
  tabResults$: Observable<SearchResult[]>
  historyResults$: Observable<SearchResult[]>
  browserActions$: Observable<BrowserAction[]>

  // Computed observables
  totalResults$: Observable<number>
  hasAnyResults$: Observable<boolean>

  isSearchingHistory = false
  private selectedIndexSubject = new BehaviorSubject<number>(0)
  selectedIndex$ = this.selectedIndexSubject.asObservable()

  constructor(
    private chromeService: ChromeService,
    private chromeSharedOptionsService: ChromeSharedOptionsService,
  ) {}

  get selectedIndex(): number {
    return this.selectedIndexSubject.value
  }

  set selectedIndex(value: number) {
    this.selectedIndexSubject.next(value)
  }

  async ngOnInit(): Promise<void> {
    const options = await this.chromeSharedOptionsService.getOptions()

    // Define base browser actions that are always available
    const getBaseBrowserActions = (): BrowserAction[] => [
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
    ]

    // Create a function that returns browser actions based on current tab state
    const getBrowserActions = async (): Promise<BrowserAction[]> => {
      const baseActions = getBaseBrowserActions()

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

    // Create individual observables for each result type
    const actions$ = this.searchInput.valueChanges.pipe(
      startWith(''),
      switchMap(async (searchInputText: string) => {
        try {
          if (!searchInputText) {
            return []
          }
          const browserActions = await getBrowserActions()
          return new Fuse<BrowserAction>(browserActions, {
            isCaseSensitive: false,
            keys: ['name'],
          })
            .search(searchInputText)
            .map((value) => value.item)
        } catch (error) {
          console.error('Failed to get browser actions:', error)
          return []
        }
      }),
    )

    const tabs$ = this.searchInput.valueChanges.pipe(
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
    )

    const history$ = this.searchInput.valueChanges.pipe(
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
    )

    // Combine all results into a single observable
    this.allResults$ = combineLatest([actions$, tabs$, history$]).pipe(
      map(([actions, tabs, history]) => ({ actions, tabs, history })),
      tap(() => {
        // Reset selection when results change
        this.selectedIndex = 0
      }),
      shareReplay(1),
    )

    // Create individual observables for template use
    this.browserActions$ = this.allResults$.pipe(
      map((results) => results.actions),
    )
    this.tabResults$ = this.allResults$.pipe(map((results) => results.tabs))
    this.historyResults$ = this.allResults$.pipe(
      map((results) => results.history),
    )

    // Initialize computed observables
    this.totalResults$ = this.allResults$.pipe(
      map(
        (results) =>
          results.actions.length + results.tabs.length + results.history.length,
      ),
    )

    this.hasAnyResults$ = this.totalResults$.pipe(map((total) => total > 0))
  }

  // Index calculation for result selection (now using observables)
  getActionIndex(actionIndex: number): number {
    return actionIndex
  }

  getTabIndex(tabIndex: number, allResults: CombinedResults): number {
    return allResults.actions.length + tabIndex
  }

  getHistoryIndex(historyIndex: number, allResults: CombinedResults): number {
    return allResults.actions.length + allResults.tabs.length + historyIndex
  }

  getActiveDescendantId(allResults: CombinedResults): string | null {
    const totalResults =
      allResults.actions.length +
      allResults.tabs.length +
      allResults.history.length
    if (totalResults === 0) {
      return null
    }

    const actionsCount = allResults.actions.length
    const tabsCount = allResults.tabs.length

    if (this.selectedIndex < actionsCount) {
      return `action-${this.selectedIndex}`
    } else if (this.selectedIndex < actionsCount + tabsCount) {
      return `tab-${this.selectedIndex - actionsCount}`
    } else {
      return `history-${this.selectedIndex - actionsCount - tabsCount}`
    }
  }

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (!this.searchInput.value || this.searchInput.value.length === 0) {
      return
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        this.navigateResults('down')
        break
      case 'Tab':
        event.preventDefault()
        if (event.shiftKey) {
          this.navigateResults('up')
        } else {
          this.navigateResults('down')
        }
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
    if (!this.allResults$) {
      return
    }

    // Get current results to calculate total
    this.allResults$
      .pipe(
        map(
          (results) =>
            results.actions.length +
            results.tabs.length +
            results.history.length,
        ),
      )
      .subscribe((totalResults) => {
        if (totalResults === 0) {
          return
        }

        if (direction === 'down') {
          this.selectedIndex = (this.selectedIndex + 1) % totalResults
        } else {
          this.selectedIndex =
            this.selectedIndex === 0 ? totalResults - 1 : this.selectedIndex - 1
        }

        // Scroll selected item into view
        this.scrollSelectedItemIntoView()
      })
      .unsubscribe()
  }

  private selectCurrentResult(): void {
    if (!this.allResults$) {
      return
    }

    this.allResults$
      .subscribe((results) => {
        const actionsCount = results.actions.length
        const tabsCount = results.tabs.length

        if (this.selectedIndex < actionsCount) {
          // Select from actions
          const action = results.actions[this.selectedIndex]
          if (action) {
            this.onClickItem(action)
          }
        } else if (this.selectedIndex < actionsCount + tabsCount) {
          // Select from tabs
          const tabIndex = this.selectedIndex - actionsCount
          const tab = results.tabs[tabIndex]
          if (tab) {
            this.onClickItem(tab)
          }
        } else {
          // Select from history
          const historyIndex = this.selectedIndex - actionsCount - tabsCount
          const history = results.history[historyIndex]
          if (history) {
            this.onClickItem(history)
          }
        }
      })
      .unsubscribe()
  }

  private scrollSelectedItemIntoView(): void {
    // Use setTimeout to ensure DOM has been updated after selectedIndex change
    setTimeout(() => {
      if (!this.allResults$) {
        return
      }

      this.allResults$
        .subscribe((results) => {
          const elementId = this.getActiveDescendantId(results)
          if (elementId) {
            const element = document.getElementById(elementId)
            if (element) {
              element.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'nearest',
              })
            }
          }
        })
        .unsubscribe()
    }, 0)
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
