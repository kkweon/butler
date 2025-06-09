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
import { BrowserActionsService } from './browser-actions.service'
import { BrowserAction, SearchResult, CombinedResults } from './models'
import { filterUniqueValues, isBrowserAction } from './utils'
import { createFuseInstance } from './fuse-utils'
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
  private latestResults: CombinedResults | null = null
  private selectedIndexSubject = new BehaviorSubject<number>(0)
  selectedIndex$ = this.selectedIndexSubject.asObservable()

  constructor(
    private chromeService: ChromeService,
    private chromeSharedOptionsService: ChromeSharedOptionsService,
    private browserActionsService: BrowserActionsService,
  ) {}

  get selectedIndex(): number {
    return this.selectedIndexSubject.value
  }

  set selectedIndex(value: number) {
    this.selectedIndexSubject.next(value)
  }

  async ngOnInit(): Promise<void> {
    const options = await this.chromeSharedOptionsService.getOptions()

    // Initialize individual observables for each result type
    const actions$ = this._initializeActionsStream()
    const tabs$ = this._initializeTabsStream(options)
    const history$ = this._initializeHistoryStream(options)
    const bookmarks$ = this._initializeBookmarksStream(options)

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
      tap((results) => {
        this.latestResults = results
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

  private _initializeActionsStream(): Observable<BrowserAction[]> {
    return this.searchInput.valueChanges.pipe(
      startWith(''),
      switchMap(async (searchInputText: string) => {
        try {
          const browserActions =
            await this.browserActionsService.getBrowserActions() // Get actions from service
          if (!searchInputText) {
            return browserActions // Return all actions if input is empty
          }
          // If input is not empty, then search
          return createFuseInstance<BrowserAction>(browserActions, ['name'])
            .search(searchInputText)
            .map((value) => value.item)
        } catch (error) {
          console.error('Failed to get browser actions:', error)
          return []
        }
      }),
    )
  }

  private _initializeTabsStream(
    options: ChromeSharedOptionsService['getOptions'] extends () => Promise<
      infer U
    >
      ? U
      : never,
  ): Observable<SearchResult[]> {
    return this.searchInput.valueChanges.pipe(
      startWith(''),
      switchMap((searchInputText: string) => {
        if (!options.includesTabs) {
          return of([]) // Return an observable of empty array
        }
        return this.chromeService
          .tabsQuery({})
          .then((tabs) => {
            // Fuse search; if searchInputText is empty, Fuse returns all items.
            const fuse = createFuseInstance<Tab>(tabs, ['title', 'url'])
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
  }

  private _initializeHistoryStream(
    options: ChromeSharedOptionsService['getOptions'] extends () => Promise<
      infer U
    >
      ? U
      : never,
  ): Observable<SearchResult[]> {
    return this.searchInput.valueChanges.pipe(
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
  }

  private _initializeBookmarksStream(
    options: ChromeSharedOptionsService['getOptions'] extends () => Promise<
      infer U
    >
      ? U
      : never,
  ): Observable<SearchResult[]> {
    return this.searchInput.valueChanges.pipe(
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
            const fuse = createFuseInstance<BookmarkTreeNode>(bookmarkItems, [
              'title',
              'url',
            ])

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
    // Handle Escape key unconditionally first, as it should always work.
    if (event.key === 'Escape') {
      event.preventDefault()
      this.searchInput.reset()
      this.searchInputRef?.nativeElement.focus()
      return // Escape action is done.
    }

    // For other keys, proceed only if we have results data.
    if (!this.latestResults) {
      // If latestResults is null (e.g., initial state before any results are processed),
      // and the key is not Escape, then do nothing.
      // Default browser action for Tab, Arrows, Enter will occur.
      return
    }

    const currentResults = this.latestResults
    const totalResults =
      currentResults.actions.length +
      currentResults.tabs.length +
      currentResults.bookmarks.length +
      currentResults.history.length

    // If there are no results, only Escape is handled (done above).
    // For other keys, if totalResults is 0, we don't preventDefault or navigate.
    if (totalResults === 0) {
      // Tab will do its default action. Arrows/Enter do nothing.
      return
    }

    // At this point, totalResults > 0.
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        this.navigateResults('down')
        break
      case 'Tab':
        event.preventDefault() // Prevent default because we are handling it.
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
        // Prevent default and select only if selectedIndex is valid for the current results.
        if (this.selectedIndex < totalResults) {
          event.preventDefault()
          this.selectCurrentResult()
        }
        break
    }
  }

  private navigateResults(direction: 'up' | 'down'): void {
    const currentLatestResults = this.latestResults
    if (!currentLatestResults) {
      return
    }

    const totalResults =
      currentLatestResults.actions.length +
      currentLatestResults.tabs.length +
      currentLatestResults.bookmarks.length +
      currentLatestResults.history.length

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
  }

  private selectCurrentResult(): void {
    const currentLatestResults = this.latestResults
    if (!currentLatestResults) {
      return
    }

    const actionsCount = currentLatestResults.actions.length
    const tabsCount = currentLatestResults.tabs.length
    const bookmarksCount = currentLatestResults.bookmarks.length

    if (this.selectedIndex < actionsCount) {
      // Select from actions
      const action = currentLatestResults.actions[this.selectedIndex]
      if (action) {
        this.onClickItem(action)
      }
    } else if (this.selectedIndex < actionsCount + tabsCount) {
      // Select from tabs
      const tabIndex = this.selectedIndex - actionsCount
      const tab = currentLatestResults.tabs[tabIndex]
      if (tab) {
        this.onClickItem(tab)
      }
    } else if (this.selectedIndex < actionsCount + tabsCount + bookmarksCount) {
      // Select from bookmarks
      const bookmarkIndex = this.selectedIndex - actionsCount - tabsCount
      const bookmark = currentLatestResults.bookmarks[bookmarkIndex]
      if (bookmark) {
        this.onClickItem(bookmark)
      }
    } else {
      // Select from history
      const historyIndex =
        this.selectedIndex - actionsCount - tabsCount - bookmarksCount
      const history = currentLatestResults.history[historyIndex]
      if (history) {
        this.onClickItem(history)
      }
    }
  }

  private scrollSelectedItemIntoView(): void {
    // Use setTimeout to ensure DOM has been updated after selectedIndex change
    setTimeout(() => {
      const currentLatestResults = this.latestResults
      if (!currentLatestResults) {
        return
      }
      const elementId = this.getActiveDescendantId(currentLatestResults)
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

  public handleResultItemClick(
    item: SearchResult | BrowserAction,
    globalIndex: number,
  ): void {
    this.selectedIndex = globalIndex
    this.onClickItem(item)
  }
}
