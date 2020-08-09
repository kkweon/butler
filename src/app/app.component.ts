import { Component, NgZone, OnInit } from '@angular/core'
import { FormControl } from '@angular/forms'
import { from, Observable } from 'rxjs'
import { map, switchMap, tap } from 'rxjs/operators'
import { MatSelectionListChange } from '@angular/material/list'
import { ChromeService } from './chrome.service'
import Tab = chrome.tabs.Tab
import HistoryItem = chrome.history.HistoryItem
import getCapturedTabs = chrome.tabCapture.getCapturedTabs

interface SearchResult {
  name: string
  url: string
  faviconUrl: string

  tab?: Tab
  history?: HistoryItem
}

function filterUniqueValues(results: SearchResult[]): SearchResult[] {
  const set = new Set()
  return results.filter(result => {
    if (set.has(result.url)) {
      // contains; no need to return
      return false
    }
    set.add(result.url)
    return true
  })
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  title = 'butler'
  searchInput: FormControl = new FormControl()

  tabResults$: Observable<SearchResult[]>
  historyResults$: Observable<SearchResult[]>

  isSearchingHistory = false

  constructor(private chromeService: ChromeService) {
  }

  ngOnInit(): void {
    this.tabResults$ = this.searchInput.valueChanges.pipe(
      switchMap(searchInputText => {
        if (!searchInputText) {
          return []
        }
        return this.chromeService.tabsQuery({}).then(tabs => {
          return tabs.filter(tab => tab.title?.includes(searchInputText) || tab.url?.includes(searchInputText)).map(tab => ({
            faviconUrl: tab.favIconUrl,
            name: tab.title,
            url: tab.url,
            tab,
          }))
        })
      }),
      map(results => filterUniqueValues(results)),
    )

    this.historyResults$ = this.searchInput.valueChanges.pipe(
      switchMap(searchInputText => {
        if (!searchInputText) {
          return []
        }
        this.isSearchingHistory = true
        return this.chromeService.historySearch({ text: searchInputText }).then(histories => {
          return histories.map(result => ({
            faviconUrl: '',
            name: result.title,
            url: result.url,
            history: result,
          }))
        })
      }),
      map(results => filterUniqueValues(results)),
      tap(() => {
        this.isSearchingHistory = false
      })
    )
  }

  async onClickItem(result: SearchResult): Promise<void> {
    if (result.tab) {
      const currentWindow = await this.chromeService.getCurrentWindow()
      if (currentWindow.id === result.tab.windowId) {
        await this.chromeService.activateTab(result.tab.id)
      } else {
        await this.chromeService.activateWindow(result.tab.windowId)
        await this.chromeService.activateTab(result.tab.id)
      }
      return
    }

    if (result.history) {
      chrome.tabs.create({
        active: true,
        url: result.url,
      }, tab => {
        this.searchInput.reset()
      })
    }
  }

  onSelectionChange(event: MatSelectionListChange): void {
    this.onClickItem(event.option.value)
  }
}
