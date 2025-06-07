import {
  Component,
  OnInit,
  ViewChild,
  HostListener,
  ElementRef,
} from '@angular/core'
import { CommonModule } from '@angular/common'
import { UntypedFormControl, ReactiveFormsModule } from '@angular/forms'
import { Observable, combineLatest, BehaviorSubject, of } from 'rxjs'
import {
  map,
  switchMap,
  tap,
  startWith,
  shareReplay,
  catchError,
  take,
} from 'rxjs/operators'
import { MatIconModule } from '@angular/material/icon'
import { ChromeService } from './chrome.service'
import Fuse from 'fuse.js'
import { ChromeSharedOptionsService } from './chrome-shared-options.service'
import { BrowserAction, SearchResult, CombinedResults } from './models'
import { filterUniqueValues, isBrowserAction } from './utils'
import Tab = chrome.tabs.Tab
import HistoryItem = chrome.history.HistoryItem
import BookmarkTreeNode = chrome.bookmarks.BookmarkTreeNode

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
  bookmarksResults$: Observable<SearchResult[]>
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
          const browserActions = await getBrowserActions() // Get actions first
          if (!searchInputText) {
            return browserActions // Return all actions if input is empty
          }
          // If input is not empty, then search
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
      switchMap((searchInputText: string) => {
        if (!options.includesTabs) {
          return of([]) // Return an observable of empty array
        }
        return this.chromeService
          .tabsQuery({})
          .then((tabs) => {
            // Fuse search; if searchInputText is empty, Fuse returns all items.
            const fuse = new Fuse<Tab>(tabs, {
              keys: ['title', 'url'],
              isCaseSensitive: false,
            })
            const searchResults = fuse.search(searchInputText || '') // Ensure text is not null

            return searchResults.map(({ item: tab }) => ({
              faviconUrl: tab.favIconUrl,
              name: tab.title,
              url: tab.url,
              tab,
            }))
          })
          .catch((error) => {
            console.error('Error fetching or searching tabs:', error)
            return [] // Return empty array on error inside the promise
          })
      }),
    )

    const history$ = this.searchInput.valueChanges.pipe(
      startWith(''),
      switchMap((searchInputText: string) => {
        if (!options.includesHistory) {
          return of([]) // Return an observable of empty array
        }

        this.isSearchingHistory = true
        return this.chromeService
          .historySearch({
            text: searchInputText || '', // Ensure text is not null
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
          .catch((error) => {
            console.error('Error fetching or searching history:', error)
            // this.isSearchingHistory will be set to false by the subsequent tap operator
            return [] // Return empty array on error inside the promise
          })
      }),
      // there could be many duplicate for history. Hence, remove the duplicates.
      map((results) => filterUniqueValues(results)),
      tap(() => {
        this.isSearchingHistory = false // This ensures the flag is reset
      }),
    )

    const bookmarks$ = this.searchInput.valueChanges.pipe(
      startWith(''),
      switchMap((searchInputText: string) => {
        if (!options.includesBookmarks) {
          return of([]) // Return an observable of empty array
        }
        return this.chromeService
          .bookmarksSearch(searchInputText || '') // Ensure text is not null for API
          .then((bookmarks) => {
            // Filter out bookmark folders (they don't have URLs)
            const bookmarkItems = bookmarks.filter((bookmark) => bookmark.url)

            // Use Fuse.js for fuzzy search. If searchInputText is "", Fuse returns all items.
            const fuse = new Fuse<BookmarkTreeNode>(bookmarkItems, {
              keys: ['title', 'url'],
              isCaseSensitive: false,
            })

            return fuse
              .search(searchInputText || '')
              .map(({ item: bookmark }) => ({
                // Ensure text is not null for Fuse
                faviconUrl: `chrome://favicon/${bookmark.url}`,
                name: bookmark.title,
                url: bookmark.url,
                bookmark,
              }))
          })
          .catch((error) => {
            console.error('Error fetching or searching bookmarks:', error)
            return [] // Return empty array on error inside the promise
          })
      }),
    )

    // Combine all results into a single observable
    this.allResults$ = combineLatest([
      actions$,
      tabs$,
      bookmarks$,
      history$,
    ]).pipe(
      map(([actions, tabs, bookmarks, history]) => ({
        actions,
        tabs,
        bookmarks,
        history,
      })),
      tap(() => {
        // Reset selection when results change
        this.selectedIndex = 0
      }),
      shareReplay(1),
      catchError((error) => {
        console.error('Error in combined results stream:', error)
        // Fallback to an empty structure for all result types
        return of({ actions: [], tabs: [], bookmarks: [], history: [] })
      }),
    )

    // Create individual observables for template use
    this.browserActions$ = this.allResults$.pipe(
      map((results) => results.actions),
    )
    this.tabResults$ = this.allResults$.pipe(map((results) => results.tabs))
    this.bookmarksResults$ = this.allResults$.pipe(
      map((results) => results.bookmarks),
    )
    this.historyResults$ = this.allResults$.pipe(
      map((results) => results.history),
    )

    // Initialize computed observables
    this.totalResults$ = this.allResults$.pipe(
      map(
        (results) =>
          results.actions.length +
          results.tabs.length +
          results.bookmarks.length +
          results.history.length,
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

  getBookmarkIndex(bookmarkIndex: number, allResults: CombinedResults): number {
    return allResults.actions.length + allResults.tabs.length + bookmarkIndex
  }

  getHistoryIndex(historyIndex: number, allResults: CombinedResults): number {
    return (
      allResults.actions.length +
      allResults.tabs.length +
      allResults.bookmarks.length +
      historyIndex
    )
  }

  getActiveDescendantId(allResults: CombinedResults): string | null {
    const totalResults =
      allResults.actions.length +
      allResults.tabs.length +
      allResults.bookmarks.length +
      allResults.history.length
    if (totalResults === 0) {
      return null
    }

    const actionsCount = allResults.actions.length
    const tabsCount = allResults.tabs.length
    const bookmarksCount = allResults.bookmarks.length

    if (this.selectedIndex < actionsCount) {
      return `action-${this.selectedIndex}`
    } else if (this.selectedIndex < actionsCount + tabsCount) {
      return `tab-${this.selectedIndex - actionsCount}`
    } else if (this.selectedIndex < actionsCount + tabsCount + bookmarksCount) {
      return `bookmark-${this.selectedIndex - actionsCount - tabsCount}`
    } else {
      return `history-${this.selectedIndex - actionsCount - tabsCount - bookmarksCount}`
    }
  }

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    // Allow navigation and Escape key even if searchInput is empty.
    // The navigateResults and selectCurrentResult methods have their own guards
    // based on the actual number of results.

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
            results.bookmarks.length +
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
        const bookmarksCount = results.bookmarks.length

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
        } else if (
          this.selectedIndex <
          actionsCount + tabsCount + bookmarksCount
        ) {
          // Select from bookmarks
          const bookmarkIndex = this.selectedIndex - actionsCount - tabsCount
          const bookmark = results.bookmarks[bookmarkIndex]
          if (bookmark) {
            this.onClickItem(bookmark)
          }
        } else {
          // Select from history
          const historyIndex =
            this.selectedIndex - actionsCount - tabsCount - bookmarksCount
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
    } else if (result.bookmark || result.history) {
      await this.chromeService.tabsCreate({ active: true, url: result.url })
      this.searchInput.reset()
    }
    // close the popup window.
    window.close()
  }

  public onItemClicked(event: Event): void {
    let targetElement = event.target as HTMLElement
    let buttonElement: HTMLButtonElement | null = null

    // Traverse up to find the button.result-item
    while (targetElement && targetElement !== event.currentTarget) {
      if (
        targetElement.nodeName === 'BUTTON' &&
        targetElement.classList.contains('result-item')
      ) {
        buttonElement = targetElement as HTMLButtonElement
        break
      }
      targetElement = targetElement.parentElement
    }

    if (!buttonElement) {
      return // Click was not on a result item or its descendant
    }

    const id = buttonElement.id
    if (!id) {
      return
    }

    // Parse id (e.g., "action-0", "tab-1")
    const parts = id.split('-')
    if (parts.length !== 2) {
      return
    }
    const type = parts[0]
    const localIndex = parseInt(parts[1], 10)

    if (isNaN(localIndex)) {
      return
    }

    this.allResults$.pipe(take(1)).subscribe((results) => {
      let itemToClick: SearchResult | BrowserAction | undefined
      let globalIndex = 0 // To set the selectedIndex

      switch (type) {
        case 'action':
          if (localIndex < results.actions.length) {
            itemToClick = results.actions[localIndex]
            globalIndex = this.getActionIndex(localIndex)
          }
          break
        case 'tab':
          if (localIndex < results.tabs.length) {
            itemToClick = results.tabs[localIndex]
            globalIndex = this.getTabIndex(localIndex, results)
          }
          break
        case 'bookmark':
          if (localIndex < results.bookmarks.length) {
            itemToClick = results.bookmarks[localIndex]
            globalIndex = this.getBookmarkIndex(localIndex, results)
          }
          break
        case 'history':
          if (localIndex < results.history.length) {
            itemToClick = results.history[localIndex]
            globalIndex = this.getHistoryIndex(localIndex, results)
          }
          break
      }

      if (itemToClick) {
        this.selectedIndex = globalIndex // Update selected index to reflect the click
        this.onClickItem(itemToClick) // Perform the action
      }
    })
    // take(1) completes the observable, so explicit unsubscribe is not strictly needed here.
  }
}
