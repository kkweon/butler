import { TestBed } from '@angular/core/testing'

import { ChromeService } from './chrome.service'

describe('ChromeService', () => {
  let service: ChromeService

  beforeEach(() => {
    TestBed.configureTestingModule({})
    service = TestBed.inject(ChromeService)
  })

  it('should be created', () => {
    expect(service).toBeTruthy()
  })

  describe('tab sorting', () => {
    it('should have getAllWindows method', () => {
      expect(service.getAllWindows).toBeDefined()
    })

    it('should have tabsMove method', () => {
      expect(service.tabsMove).toBeDefined()
    })

    it('should have sortTabsInAllWindows method', () => {
      expect(service.sortTabsInAllWindows).toBeDefined()
    })
  })
})
