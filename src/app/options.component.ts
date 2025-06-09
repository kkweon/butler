import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import {
  MatSlideToggleChange,
  MatSlideToggleModule,
} from '@angular/material/slide-toggle'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { ChromeSharedOptionsService } from './chrome-shared-options.service'

function fixWrongInputDate(wrongDate: Date): Date {
  return new Date(
    wrongDate.getUTCFullYear(),
    wrongDate.getUTCMonth(),
    wrongDate.getUTCDate(),
  )
}

function getYYYYMMDD(unixEpoch: number | Date): string {
  if (unixEpoch instanceof Date) {
    return unixEpoch.toISOString().split('T')[0]
  }
  const date = new Date(unixEpoch)
  return date.toISOString().split('T')[0]
}

@Component({
  selector: 'app-options',
  templateUrl: './options.component.html',
  styleUrls: ['./options.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatSlideToggleModule,
    MatFormFieldModule,
    MatInputModule,
  ],
})
export class OptionsComponent implements OnInit {
  includesBookmarks: boolean
  includesTabs: boolean
  includesHistory: boolean
  sortPinnedTabs: boolean
  // YYYY-MM-DD
  startDate: string

  constructor(private chromeSharedOptionsService: ChromeSharedOptionsService) {}

  async ngOnInit(): Promise<void> {
    const options = await this.chromeSharedOptionsService.getOptions()
    this.includesBookmarks = options.includesBookmarks
    this.includesTabs = options.includesTabs
    this.includesHistory = options.includesHistory
    this.sortPinnedTabs = options.sortPinnedTabs

    this.startDate = getYYYYMMDD(options.searchHistoryStartDateInUnixEpoch)
  }

  async updateStartDate(event: Event): Promise<void> {
    const correctDate = fixWrongInputDate(
      (event.target as HTMLInputElement).valueAsDate,
    )

    await this.chromeSharedOptionsService.setOptions({
      searchHistoryStartDateInUnixEpoch: correctDate.getTime(),
    })

    this.startDate = getYYYYMMDD(correctDate)
  }

  async toggleBookmarks(event: MatSlideToggleChange): Promise<void> {
    await this.chromeSharedOptionsService.setOptions({
      includesBookmarks: event.checked,
    })
    this.includesBookmarks = event.checked
    return
  }

  async toggleTabs(event: MatSlideToggleChange): Promise<void> {
    await this.chromeSharedOptionsService.setOptions({
      includesTabs: event.checked,
    })
    this.includesTabs = event.checked
    return
  }

  async toggleHistory(event: MatSlideToggleChange): Promise<void> {
    await this.chromeSharedOptionsService.setOptions({
      includesHistory: event.checked,
    })
    this.includesHistory = event.checked
    return
  }

  async toggleSortPinnedTabs(event: MatSlideToggleChange): Promise<void> {
    await this.chromeSharedOptionsService.setOptions({
      sortPinnedTabs: event.checked,
    })
    this.sortPinnedTabs = event.checked
    return
  }
}
