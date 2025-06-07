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
    let mockChrome: any

    beforeEach(() => {
      mockChrome = {
        windows: {
          getAll: jasmine.createSpy('getAll'),
        },
        tabs: {
          query: jasmine.createSpy('query'),
          move: jasmine.createSpy('move'),
        },
      }
      ;(window as any).chrome = mockChrome
    })

    describe('getAllWindows', () => {
      it('should resolve with windows from chrome.windows.getAll', async () => {
        const mockWindows = [
          { id: 1, type: 'normal' },
          { id: 2, type: 'normal' },
        ]
        mockChrome.windows.getAll.and.callFake((callback: any) => {
          callback(mockWindows)
        })

        const result = await service.getAllWindows()

        expect(mockChrome.windows.getAll).toHaveBeenCalled()
        expect(result).toEqual(mockWindows as any)
      })
    })

    describe('tabsMove', () => {
      it('should resolve with moved tab from chrome.tabs.move', async () => {
        const mockTab = { id: 1, index: 2 }
        const moveProperties = { index: 0 }
        mockChrome.tabs.move.and.callFake(
          (tabId: any, props: any, callback: any) => {
            callback(mockTab)
          },
        )

        const result = await service.tabsMove(1, moveProperties)

        expect(mockChrome.tabs.move).toHaveBeenCalledWith(
          1,
          moveProperties,
          jasmine.any(Function),
        )
        expect(result).toEqual(mockTab as any)
      })
    })

    describe('getCurrentActiveTab', () => {
      it('should resolve with active tab from chrome.tabs.query', async () => {
        const mockTab = { id: 1, url: 'https://example.com', active: true }
        mockChrome.tabs.query = jasmine
          .createSpy('query')
          .and.callFake((queryInfo: any, callback: any) => {
            callback([mockTab])
          })

        const result = await service.getCurrentActiveTab()

        expect(mockChrome.tabs.query).toHaveBeenCalledWith(
          { active: true, currentWindow: true },
          jasmine.any(Function),
        )
        expect(result).toEqual(mockTab as any)
      })
    })

    describe('copyToClipboard', () => {
      it('should use navigator.clipboard.writeText when available', async () => {
        const text = 'https://example.com'
        const mockWriteText = jasmine
          .createSpy('writeText')
          .and.returnValue(Promise.resolve())

        spyOnProperty(navigator, 'clipboard', 'get').and.returnValue({
          writeText: mockWriteText,
        } as any)

        await service.copyToClipboard(text)

        expect(mockWriteText).toHaveBeenCalledWith(text)
      })

      it('should use fallback method when navigator.clipboard is not available', async () => {
        spyOnProperty(navigator, 'clipboard', 'get').and.returnValue(undefined)

        // Mock document methods
        const mockTextArea = {
          value: '',
          style: { position: '', left: '', top: '' },
          focus: jasmine.createSpy('focus'),
          select: jasmine.createSpy('select'),
        } as any

        spyOn(document, 'createElement').and.returnValue(mockTextArea)
        spyOn(document.body, 'appendChild')
        spyOn(document.body, 'removeChild')
        spyOn(document, 'execCommand').and.returnValue(true)

        const text = 'https://example.com'
        await service.copyToClipboard(text)

        expect(document.createElement).toHaveBeenCalledWith('textarea')
        expect(mockTextArea.value).toBe(text)
        expect(document.body.appendChild).toHaveBeenCalledWith(mockTextArea)
        expect(mockTextArea.focus).toHaveBeenCalled()
        expect(mockTextArea.select).toHaveBeenCalled()
        expect(document.execCommand).toHaveBeenCalledWith('copy')
        expect(document.body.removeChild).toHaveBeenCalledWith(mockTextArea)
      })

      it('should throw error when clipboard operations fail', async () => {
        const mockWriteText = jasmine
          .createSpy('writeText')
          .and.returnValue(
            Promise.reject(new Error('Clipboard not accessible')),
          )

        spyOnProperty(navigator, 'clipboard', 'get').and.returnValue({
          writeText: mockWriteText,
        } as any)

        await expectAsync(service.copyToClipboard('test')).toBeRejected()
      })
    })

    describe('extractDomain', () => {
      it('should extract domain correctly', () => {
        expect((service as any).extractDomain('https://example.com')).toBe(
          'example.com',
        )
        expect((service as any).extractDomain('https://www.example.com')).toBe(
          'www.example.com',
        )
        expect((service as any).extractDomain('https://sub.example.com')).toBe(
          'sub.example.com',
        )
        expect((service as any).extractDomain('http://example.com')).toBe(
          'example.com',
        )
        expect((service as any).extractDomain(undefined)).toBe('\uFFFF')
        expect((service as any).extractDomain('invalid-url')).toBe(
          'invalid-url',
        )
      })
    })

    describe('sortTabsInAllWindows', () => {
      beforeEach(() => {
        spyOn(service, 'getAllWindows')
        spyOn(service, 'tabsQuery')
        spyOn(service, 'tabsMove')
      })

      it('should sort tabs by domain in each window', async () => {
        const mockWindows = [{ id: 1 }]
        const mockTabs = [
          { id: 1, url: 'https://z.com', pinned: false, index: 0 },
          { id: 2, url: 'https://a.com', pinned: false, index: 1 },
          { id: 3, url: 'https://m.com', pinned: false, index: 2 },
        ]

        ;(service.getAllWindows as jasmine.Spy).and.returnValue(
          Promise.resolve(mockWindows),
        )
        ;(service.tabsQuery as jasmine.Spy).and.returnValue(
          Promise.resolve(mockTabs),
        )
        ;(service.tabsMove as jasmine.Spy).and.returnValue(Promise.resolve({}))

        await service.sortTabsInAllWindows()

        expect(service.tabsMove).toHaveBeenCalledWith(2, { index: 0 }) // a.com to position 0
        expect(service.tabsMove).toHaveBeenCalledWith(3, { index: 1 }) // m.com to position 1
        expect(service.tabsMove).toHaveBeenCalledWith(1, { index: 2 }) // z.com to position 2
      })

      it('should group same domain tabs together and sort by full URL within domain', async () => {
        const mockWindows = [{ id: 1 }]
        const mockTabs = [
          { id: 1, url: 'https://example.com/z', pinned: false, index: 0 },
          { id: 2, url: 'https://another.com/page', pinned: false, index: 1 },
          { id: 3, url: 'https://example.com/a', pinned: false, index: 2 },
          { id: 4, url: 'https://example.com/m', pinned: false, index: 3 },
        ]

        ;(service.getAllWindows as jasmine.Spy).and.returnValue(
          Promise.resolve(mockWindows),
        )
        ;(service.tabsQuery as jasmine.Spy).and.returnValue(
          Promise.resolve(mockTabs),
        )
        ;(service.tabsMove as jasmine.Spy).and.returnValue(Promise.resolve({}))

        await service.sortTabsInAllWindows()

        // another.com should come first (alphabetically)
        expect(service.tabsMove).toHaveBeenCalledWith(2, { index: 0 }) // another.com/page to position 0
        // example.com tabs should be grouped together and sorted by full URL
        expect(service.tabsMove).toHaveBeenCalledWith(3, { index: 1 }) // example.com/a to position 1
        expect(service.tabsMove).toHaveBeenCalledWith(4, { index: 2 }) // example.com/m to position 2
        expect(service.tabsMove).toHaveBeenCalledWith(1, { index: 3 }) // example.com/z to position 3
      })

      it('should handle subdomains correctly by grouping them with main domain', async () => {
        const mockWindows = [{ id: 1 }]
        const mockTabs = [
          { id: 1, url: 'https://z.example.com', pinned: false, index: 0 },
          { id: 2, url: 'https://other.com', pinned: false, index: 1 },
          { id: 3, url: 'https://a.example.com', pinned: false, index: 2 },
          { id: 4, url: 'https://www.example.com', pinned: false, index: 3 },
        ]

        ;(service.getAllWindows as jasmine.Spy).and.returnValue(
          Promise.resolve(mockWindows),
        )
        ;(service.tabsQuery as jasmine.Spy).and.returnValue(
          Promise.resolve(mockTabs),
        )
        ;(service.tabsMove as jasmine.Spy).and.returnValue(Promise.resolve({}))

        await service.sortTabsInAllWindows()

        // Domains should be sorted: a.example.com, other.com, www.example.com, z.example.com
        expect(service.tabsMove).toHaveBeenCalledWith(3, { index: 0 }) // a.example.com to position 0
        // other.com (id:2) is already at index 1, so no move needed
        expect(service.tabsMove).toHaveBeenCalledWith(4, { index: 2 }) // www.example.com to position 2
        expect(service.tabsMove).toHaveBeenCalledWith(1, { index: 3 }) // z.example.com to position 3
      })

      it('should handle different protocols (http vs https) correctly', async () => {
        const mockWindows = [{ id: 1 }]
        const mockTabs = [
          { id: 1, url: 'https://example.com/page1', pinned: false, index: 0 },
          { id: 2, url: 'http://example.com/page2', pinned: false, index: 1 },
          { id: 3, url: 'https://another.com', pinned: false, index: 2 },
        ]

        ;(service.getAllWindows as jasmine.Spy).and.returnValue(
          Promise.resolve(mockWindows),
        )
        ;(service.tabsQuery as jasmine.Spy).and.returnValue(
          Promise.resolve(mockTabs),
        )
        ;(service.tabsMove as jasmine.Spy).and.returnValue(Promise.resolve({}))

        await service.sortTabsInAllWindows()

        // Should group by domain regardless of protocol
        expect(service.tabsMove).toHaveBeenCalledWith(3, { index: 0 }) // another.com to position 0
        // example.com tabs should be grouped and sorted by full URL
        // http://example.com/page2 is already at index 1 so no move call for it
        expect(service.tabsMove).toHaveBeenCalledWith(1, { index: 2 }) // https://example.com/page1 to position 2
        // Verify only 2 move calls were made (not 3)
        expect(service.tabsMove).toHaveBeenCalledTimes(2)
      })

      it('should handle malformed URLs gracefully', async () => {
        const mockWindows = [{ id: 1 }]
        const mockTabs = [
          { id: 1, url: 'https://valid.com', pinned: false, index: 0 },
          { id: 2, url: 'not-a-valid-url', pinned: false, index: 1 },
          { id: 3, url: 'https://another.com', pinned: false, index: 2 },
        ]

        ;(service.getAllWindows as jasmine.Spy).and.returnValue(
          Promise.resolve(mockWindows),
        )
        ;(service.tabsQuery as jasmine.Spy).and.returnValue(
          Promise.resolve(mockTabs),
        )
        ;(service.tabsMove as jasmine.Spy).and.returnValue(Promise.resolve({}))

        await service.sortTabsInAllWindows()

        // Valid domains should be sorted first, malformed URLs should use lexical sorting
        expect(service.tabsMove).toHaveBeenCalledWith(3, { index: 0 }) // another.com to position 0
        // not-a-valid-url (id:2) is already at index 1, so no move needed
        expect(service.tabsMove).toHaveBeenCalledWith(1, { index: 2 }) // valid.com to position 2
      })

      it('should keep pinned tabs before unpinned tabs', async () => {
        const mockWindows = [{ id: 1 }]
        const mockTabs = [
          { id: 1, url: 'https://z.com', pinned: true, index: 0 },
          { id: 2, url: 'https://a.com', pinned: true, index: 1 },
          { id: 3, url: 'https://m.com', pinned: false, index: 2 },
          { id: 4, url: 'https://b.com', pinned: false, index: 3 },
        ]

        ;(service.getAllWindows as jasmine.Spy).and.returnValue(
          Promise.resolve(mockWindows),
        )
        ;(service.tabsQuery as jasmine.Spy).and.returnValue(
          Promise.resolve(mockTabs),
        )
        ;(service.tabsMove as jasmine.Spy).and.returnValue(Promise.resolve({}))

        await service.sortTabsInAllWindows()

        // Pinned tabs should be sorted among themselves: a.com, z.com
        expect(service.tabsMove).toHaveBeenCalledWith(2, { index: 0 }) // a.com pinned to position 0
        expect(service.tabsMove).toHaveBeenCalledWith(1, { index: 1 }) // z.com pinned to position 1
        // Unpinned tabs should be sorted after pinned: b.com, m.com
        expect(service.tabsMove).toHaveBeenCalledWith(4, { index: 2 }) // b.com unpinned to position 2
        expect(service.tabsMove).toHaveBeenCalledWith(3, { index: 3 }) // m.com unpinned to position 3
      })

      it('should handle tabs with no URL by placing them at end', async () => {
        const mockWindows = [{ id: 1 }]
        const mockTabs = [
          { id: 1, url: 'https://b.com', pinned: false, index: 0 },
          { id: 2, url: undefined, pinned: false, index: 1 },
          { id: 3, url: 'https://a.com', pinned: false, index: 2 },
        ]

        ;(service.getAllWindows as jasmine.Spy).and.returnValue(
          Promise.resolve(mockWindows),
        )
        ;(service.tabsQuery as jasmine.Spy).and.returnValue(
          Promise.resolve(mockTabs),
        )
        ;(service.tabsMove as jasmine.Spy).and.returnValue(Promise.resolve({}))

        await service.sortTabsInAllWindows()

        expect(service.tabsMove).toHaveBeenCalledWith(3, { index: 0 }) // a.com to position 0
        expect(service.tabsMove).toHaveBeenCalledWith(1, { index: 1 }) // b.com to position 1
        // Tab with no URL (id: 2) should remain at end (position 2)
      })

      it('should handle tab move failures gracefully', async () => {
        const mockWindows = [{ id: 1 }]
        const mockTabs = [
          { id: 1, url: 'https://z.com', pinned: false, index: 0 },
          { id: 2, url: 'https://a.com', pinned: false, index: 1 },
        ]

        ;(service.getAllWindows as jasmine.Spy).and.returnValue(
          Promise.resolve(mockWindows),
        )
        ;(service.tabsQuery as jasmine.Spy).and.returnValue(
          Promise.resolve(mockTabs),
        )
        ;(service.tabsMove as jasmine.Spy).and.returnValue(
          Promise.reject(new Error('Tab was closed')),
        )

        spyOn(console, 'warn')

        await expectAsync(service.sortTabsInAllWindows()).toBeResolved()
        expect(console.warn).toHaveBeenCalled()
      })

      it('should continue with other windows if one fails', async () => {
        const mockWindows = [{ id: 1 }, { id: 2 }]

        ;(service.getAllWindows as jasmine.Spy).and.returnValue(
          Promise.resolve(mockWindows),
        )
        ;(service.tabsQuery as jasmine.Spy).and.callFake((queryInfo: any) => {
          if (queryInfo.windowId === 1) {
            return Promise.reject(new Error('Window not accessible'))
          }
          return Promise.resolve([
            { id: 1, url: 'https://test.com', pinned: false, index: 0 },
          ])
        })
        ;(service.tabsMove as jasmine.Spy).and.returnValue(Promise.resolve({}))

        spyOn(console, 'warn')

        await expectAsync(service.sortTabsInAllWindows()).toBeResolved()
        expect(console.warn).toHaveBeenCalled()
        expect(service.tabsQuery).toHaveBeenCalledTimes(2) // Called for both windows
      })

      it('should handle getAllWindows failure gracefully', async () => {
        ;(service.getAllWindows as jasmine.Spy).and.returnValue(
          Promise.reject(new Error('No access to windows')),
        )

        spyOn(console, 'error')

        await expectAsync(service.sortTabsInAllWindows()).toBeResolved()
        expect(console.error).toHaveBeenCalledWith(
          'Failed to get windows for tab sorting:',
          jasmine.any(Error),
        )
      })
    })
  })
})
