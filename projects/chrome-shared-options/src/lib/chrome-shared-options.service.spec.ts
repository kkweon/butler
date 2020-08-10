import { TestBed } from '@angular/core/testing'

import { ChromeSharedOptionsService } from './chrome-shared-options.service'

describe('ChromeSharedOptionsService', () => {
  let service: ChromeSharedOptionsService

  beforeEach(() => {
    TestBed.configureTestingModule({})
    service = TestBed.inject(ChromeSharedOptionsService)
  })

  it('should be created', () => {
    expect(service).toBeTruthy()
  })
})
