import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { UntypedFormControl, ReactiveFormsModule } from '@angular/forms'
import { Observable } from 'rxjs'
import { map, switchMap, tap } from 'rxjs/operators'
import { MatSelectionListChange, MatListModule } from '@angular/material/list'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatIconModule } from '@angular/material/icon'
import { ChromeService } from './chrome.service'
import Fuse from 'fuse.js'
import { ChromeSharedOptionsService } from 'chrome-shared-options'
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
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatListModule,
    MatIconModule,
  ],
})
export class AppComponent implements OnInit {
  title = 'butler'
  searchInput: UntypedFormControl = new UntypedFormControl()

  tabResults$: Observable<SearchResult[]>
  historyResults$: Observable<SearchResult[]>

  isSearchingHistory = false
  browserActions$: Observable<BrowserAction[]>

  constructor(
    private chromeService: ChromeService,
    private chromeSharedOptionsService: ChromeSharedOptionsService,
  ) {}

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
      map((searchInputText: string) => {
        return new Fuse<BrowserAction>(BROWSER_ACTIONS, {
          isCaseSensitive: false,
          keys: ['name'],
        })
          .search(searchInputText)
          .map((value) => {
            return value.item
          })
      }),
    )

    this.tabResults$ = this.searchInput.valueChanges.pipe(
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

    this.historyResults$ = this.searchInput.valueChanges.pipe(
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

  async onSelectionChange(event: MatSelectionListChange): Promise<void> {
    await this.onClickItem(event.options[0].value)
  }
}
