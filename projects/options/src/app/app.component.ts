import { Component, OnInit } from '@angular/core'
import { MatSlideToggleChange } from '@angular/material/slide-toggle'
import { ChromeSharedOptionsService } from 'chrome-shared-options'

function fixWrongInputDate(wrongDate: Date): Date {
  return new Date(
    wrongDate.getUTCFullYear(),
    wrongDate.getUTCMonth(),
    wrongDate.getUTCDate(),
  )
}

// Get YYYY-MM-DD
function getYYYYMMDD(unixEpoch: number | Date): string {
  if (unixEpoch instanceof Date) {
    return unixEpoch.toISOString().split('T')[0]
  }
  const date = new Date(unixEpoch)
  return date.toISOString().split('T')[0]
}

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatSlideToggleModule,
    MatInputModule,
  ],
})
export class AppComponent implements OnInit {
  title = 'options'
  includesBookmarks: boolean
  includesTabs: boolean
  includesHistory: boolean
  // YYYY-MM-DD
  startDate: string

  constructor(private chromeSharedOptionsService: ChromeSharedOptionsService) {}

  async ngOnInit(): Promise<void> {
    const options = await this.chromeSharedOptionsService.getOptions()
    this.includesBookmarks = options.includesBookmarks
    this.includesTabs = options.includesTabs
    this.includesHistory = options.includesHistory

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
}
