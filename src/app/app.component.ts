import {
  Component,
  OnInit,
  ViewChild,
  HostListener,
  ElementRef,
  ChangeDetectionStrategy,
} from '@angular/core'
import { CommonModule } from '@angular/common'
import { UntypedFormControl, ReactiveFormsModule } from '@angular/forms'
import { Observable, combineLatest, BehaviorSubject, of, from } from 'rxjs'
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
import {
  BrowserAction,
  SearchResult,
  CombinedResults,
  MoveTarget,
  PaletteMode,
} from './models'
import { filterUniqueValues, hostnameOf, isBrowserAction } from './utils'
import { createFuseInstance } from './fuse-utils'
import Tab = chrome.tabs.Tab
import HistoryItem = chrome.history.HistoryItem
import BookmarkTreeNode = chrome.bookmarks.BookmarkTreeNode

/** The synthetic "pop these tabs out on their own" destination. */
const NEW_WINDOW_TARGET: MoveTarget = {
  kind: 'new-window',
  windowId: null,
  label: 'New window',
  subtitle: 'Pop out on its own',
  faviconUrl: '',
  tabTitles: [],
  tabUrls: [],
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
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

  // --- "Move tabs to another window" sub-panel ---------------------------
  // These are field initializers rather than being built in `ngOnInit`,
  // because the sub-panel state has to survive a second `ngOnInit` call.
  moveSearchInput: UntypedFormControl = new UntypedFormControl('')
  private paletteModeSubject = new BehaviorSubject<PaletteMode>({
    kind: 'search',
  })
  paletteMode$ = this.paletteModeSubject.asObservable()
  private moveSelectedIndexSubject = new BehaviorSubject<number>(0)
  moveSelectedIndex$ = this.moveSelectedIndexSubject.asObservable()
  private latestMoveTargets: MoveTarget[] | null = null
  moveTargets$: Observable<MoveTarget[]>
  moveError: string | null = null

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

  get paletteMode(): PaletteMode {
    return this.paletteModeSubject.value
  }

  get isMoveMode(): boolean {
    return this.paletteMode.kind === 'move'
  }

  get movingTabs(): Tab[] | null {
    const mode = this.paletteMode
    return mode.kind === 'move' ? mode.tabs : null
  }

  /**
   * The single search box is bound to whichever control the current stage owns.
   * Swapping the control (rather than rewriting one control's value) means the
   * search streams stay idle while the sub-panel is open, so leaving it restores
   * the previous query and selection for free.
   */
  get activeSearchControl(): UntypedFormControl {
    return this.isMoveMode ? this.moveSearchInput : this.searchInput
  }

  get moveTargets(): MoveTarget[] {
    return this.latestMoveTargets ?? []
  }

  get moveSelectedIndex(): number {
    return this.moveSelectedIndexSubject.value
  }

  set moveSelectedIndex(value: number) {
    this.moveSelectedIndexSubject.next(value)
  }

  ngOnInit(): void {
    const options$ = from(this.chromeSharedOptionsService.getOptions()).pipe(
      shareReplay(1),
    )

    // Combine all results into a single observable
    this.allResults$ = options$.pipe(
      switchMap((options) => {
        const actions$ = this._initializeActionsStream()
        const tabs$ = this._initializeTabsStream(options)
        const history$ = this._initializeHistoryStream(options)
        const bookmarks$ = this._initializeBookmarksStream(options)

        return combineLatest([actions$, tabs$, bookmarks$, history$])
      }),
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

    // Windows are fetched once per entry into the sub-panel and then filtered
    // in memory, so typing never costs a round trip to Chrome.
    const moveCandidates$ = this.paletteMode$.pipe(
      switchMap((mode) =>
        mode.kind === 'move'
          ? from(this.buildMoveTargets(mode.tabs)).pipe(
              catchError((error) => {
                console.error('Failed to load windows to move tabs to:', error)
                return of([] as MoveTarget[])
              }),
            )
          : of([] as MoveTarget[]),
      ),
      shareReplay(1),
    )

    this.moveTargets$ = combineLatest([
      moveCandidates$,
      this.moveSearchInput.valueChanges.pipe(startWith('')),
    ]).pipe(
      map(([candidates, query]) =>
        this.filterMoveTargets(candidates, query ?? ''),
      ),
      tap((targets) => {
        this.latestMoveTargets = targets
        // Mirrors the search-mode reset above.
        this.moveSelectedIndex = 0
      }),
      shareReplay(1),
    )

    // The keyboard handler reads `latestMoveTargets`, so it must not depend on
    // the template happening to subscribe. `shareReplay` keeps this and the
    // async pipe on a single source subscription. Nothing unsubscribes: the
    // popup document is torn down wholesale when it closes.
    this.moveTargets$.subscribe()
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
      startWith([]),
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
        if (!searchInputText) {
          return of([]) // Return empty array if input is empty
        }
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
      startWith([]),
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
      tap(() => {
        this.isSearchingHistory = true
      }),
      switchMap((searchInputText: string) => {
        if (!searchInputText) {
          return of([]) // Return empty array if input is empty
        }
        if (!options.includesHistory) {
          return of([]) // Return an observable of empty array
        }

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
            return [] // Return empty array on error inside the promise
          })
      }),
      // there could be many duplicate for history. Hence, remove the duplicates.
      map((results) => filterUniqueValues(results)),
      tap(() => {
        this.isSearchingHistory = false // This ensures the flag is reset
      }),
      startWith([]),
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
        if (!searchInputText) {
          return of([]) // Return empty array if input is empty
        }
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
      startWith([]),
    )
  }

  /**
   * Builds the destination list for the move sub-panel.
   *
   * `getHighlightedTabs` queries the current window, so every source tab shares
   * one `windowId` and one `incognito` value and eligibility is a single check.
   */
  private async buildMoveTargets(sourceTabs: Tab[]): Promise<MoveTarget[]> {
    if (0 === sourceTabs.length) {
      return []
    }

    const [sourceTab] = sourceTabs
    const windows = await this.chromeService.getAllWindowsWithTabs()
    const sourceWindow = windows.find((win) => win.id === sourceTab.windowId)
    const sourceTabCount = sourceWindow?.tabs?.length ?? 0

    const windowTargets = windows
      .filter((win) => win.id !== undefined)
      .filter((win) => win.id !== sourceTab.windowId)
      .filter((win) => (win.type ?? 'normal') === 'normal')
      // Chrome refuses to move tabs between normal and incognito windows, so
      // these are filtered out rather than offered and then failing.
      .filter((win) => win.incognito === sourceTab.incognito)
      .map((win) => this.toMoveTarget(win))

    // Moving every tab out of a window closes it and recreates the same set
    // elsewhere, so the new-window entry would be a no-op with worse placement.
    return sourceTabs.length < sourceTabCount
      ? [NEW_WINDOW_TARGET, ...windowTargets]
      : windowTargets
  }

  private toMoveTarget(win: chrome.windows.Window): MoveTarget {
    const tabs = win.tabs ?? []
    const activeTab = tabs.find((tab) => tab.active) ?? tabs[0]
    const label =
      activeTab?.title?.trim() ||
      hostnameOf(activeTab?.url) ||
      'Untitled window'
    const countLabel = `${tabs.length} ${tabs.length === 1 ? 'tab' : 'tabs'}`
    // A preview of the other tabs is what actually tells two windows apart when
    // both happen to be showing the same site.
    const otherTitles = tabs
      .filter((tab) => tab !== activeTab)
      .map((tab) => tab.title?.trim())
      .filter((title): title is string => !!title)

    return {
      kind: 'window',
      windowId: win.id,
      label,
      subtitle: otherTitles.length
        ? `${countLabel} · ${otherTitles.slice(0, 3).join(', ')}`
        : countLabel,
      faviconUrl: activeTab?.favIconUrl ?? '',
      tabTitles: tabs.map((tab) => tab.title ?? ''),
      tabUrls: tabs.map((tab) => tab.url ?? ''),
    }
  }

  private filterMoveTargets(
    targets: MoveTarget[],
    query: string,
  ): MoveTarget[] {
    const trimmed = query.trim()
    if (!trimmed) {
      // Empty query lists every destination, like the browser actions stream.
      return targets
    }

    // "New window" is matched literally rather than fuzzily, and always sorts
    // first when it matches. Index 0 is the Enter target, so which entry sits
    // there has to be predictable; a fuzzy match on a two-word constant would
    // leave it hovering near the top for unrelated queries.
    const newWindow = targets.filter(
      (target) =>
        target.kind === 'new-window' &&
        target.label.toLowerCase().includes(trimmed.toLowerCase()),
    )
    const matches = createFuseInstance<MoveTarget>(
      targets.filter((target) => target.kind === 'window'),
      ['label', 'tabTitles', 'tabUrls'],
    )
      .search(trimmed)
      .map((result) => result.item)

    return [...newWindow, ...matches]
  }

  getMoveActiveDescendantId(targets: MoveTarget[]): string | null {
    return targets.length === 0 ? null : `move-target-${this.moveSelectedIndex}`
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
    // The move sub-panel owns every key while it is open, including Escape,
    // which steps back to the search results instead of closing the popup.
    if (this.isMoveMode) {
      this.onMoveModeKeyDown(event)
      return
    }

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

  private onMoveModeKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault()
      this.exitMoveMode()
      return
    }

    const targets = this.latestMoveTargets
    if (!targets || targets.length === 0) {
      return
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        this.navigateMoveTargets('down')
        break
      case 'Tab':
        event.preventDefault()
        this.navigateMoveTargets(event.shiftKey ? 'up' : 'down')
        break
      case 'ArrowUp':
        event.preventDefault()
        this.navigateMoveTargets('up')
        break
      case 'Enter': {
        const target = targets[this.moveSelectedIndex]
        if (target) {
          event.preventDefault()
          void this.commitMove(target)
        }
        break
      }
    }
  }

  private navigateMoveTargets(direction: 'up' | 'down'): void {
    const total = this.latestMoveTargets?.length ?? 0
    if (total === 0) {
      return
    }

    if (direction === 'down') {
      this.moveSelectedIndex = (this.moveSelectedIndex + 1) % total
    } else {
      this.moveSelectedIndex =
        this.moveSelectedIndex === 0 ? total - 1 : this.moveSelectedIndex - 1
    }

    this.scrollSelectedMoveTargetIntoView()
  }

  private scrollSelectedMoveTargetIntoView(): void {
    // Use setTimeout to ensure DOM has been updated after the index change
    setTimeout(() => {
      const elementId = this.getMoveActiveDescendantId(this.moveTargets)
      if (!elementId) {
        return
      }
      const element = document.getElementById(elementId)
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest',
        })
      }
    }, 0)
  }

  /** Opens the destination picker for the tabs selected in Chrome. */
  async enterMoveMode(): Promise<void> {
    const tabs = await this.chromeService.getHighlightedTabs()
    if (0 === tabs.length) {
      return
    }

    this.moveError = null
    this.moveSelectedIndex = 0
    // `moveSearchInput` is deliberately left alone: it is already empty, and
    // resetting it without an emission would leave a stale query cached in the
    // `combineLatest` above.
    this.paletteModeSubject.next({ kind: 'move', tabs })
    this.searchInputRef?.nativeElement.focus()
  }

  /** Returns to the search results, leaving the previous query untouched. */
  exitMoveMode(): void {
    this.moveError = null
    // Must emit so the cached query in `moveTargets$` is cleared too.
    this.moveSearchInput.setValue('')
    this.paletteModeSubject.next({ kind: 'search' })
    this.searchInputRef?.nativeElement.focus()
  }

  async commitMove(target: MoveTarget, follow = true): Promise<void> {
    const mode = this.paletteMode
    if (mode.kind !== 'move') {
      return
    }
    const tabs = mode.tabs

    try {
      if (target.kind === 'new-window' || target.windowId === null) {
        // `windows.create` already focuses the window and activates the tab.
        await this.chromeService.moveTabsToNewWindow(tabs, follow)
      } else {
        await this.chromeService.moveTabsToWindow(tabs, target.windowId)
        if (follow) {
          // Activate the tab before focusing the window: focusing another
          // window blurs this popup and Chrome tears it down, so the focus call
          // has to be the last thing we do. This deliberately inverts the order
          // used by `onClickItem`.
          await this.chromeService.activateTab(tabs[0].id)
          await this.chromeService.activateWindow(target.windowId)
        }
      }
    } catch (error) {
      console.error('Failed to move tabs:', error)
      this.moveError = 'Could not move those tabs. They may have been closed.'
      // Stay in the sub-panel so another destination can be picked.
      return
    }

    // Note: when the source window is left empty Chrome closes it, which can
    // tear down this popup before we get here. The move itself has already
    // landed by then.
    window.close()
  }

  handleMoveTargetClick(target: MoveTarget, index: number): void {
    this.moveSelectedIndex = index
    void this.commitMove(target)
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
      if (result.panel === 'move-tabs-to-window') {
        // Opens a sub-panel rather than acting, so the popup must stay open.
        await this.enterMoveMode()
        return
      }
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
