import { normalizeUrl, filterUniqueValues, isBrowserAction } from './utils'
import { SearchResult, BrowserAction } from './models'

describe('Utils', () => {
  describe('normalizeUrl', () => {
    it('should remove query strings from URL', () => {
      const url = 'https://example.com/path?q=search&tab=1'
      const normalized = normalizeUrl(url)
      expect(normalized).toBe('https://example.com/path')
    })

    it('should remove hash fragments from URL', () => {
      const url = 'https://example.com/path#section1'
      const normalized = normalizeUrl(url)
      expect(normalized).toBe('https://example.com/path')
    })

    it('should remove both query strings and hash fragments', () => {
      const url = 'https://example.com/path?q=search#section1'
      const normalized = normalizeUrl(url)
      expect(normalized).toBe('https://example.com/path')
    })

    it('should handle URLs without query strings or fragments', () => {
      const url = 'https://example.com/path'
      const normalized = normalizeUrl(url)
      expect(normalized).toBe('https://example.com/path')
    })

    it('should handle root URLs', () => {
      const url = 'https://example.com'
      const normalized = normalizeUrl(url)
      expect(normalized).toBe('https://example.com/')
    })

    it('should handle URLs with different protocols', () => {
      const url = 'http://example.com/path?q=test'
      const normalized = normalizeUrl(url)
      expect(normalized).toBe('http://example.com/path')
    })

    it('should return empty string for undefined URL', () => {
      const normalized = normalizeUrl(undefined)
      expect(normalized).toBe('')
    })

    it('should return empty string for empty URL', () => {
      const normalized = normalizeUrl('')
      expect(normalized).toBe('')
    })

    it('should return original URL for invalid URLs', () => {
      const invalidUrl = 'not-a-valid-url'
      const normalized = normalizeUrl(invalidUrl)
      expect(normalized).toBe(invalidUrl)
    })

    it('should handle URLs with subdomains', () => {
      const url = 'https://subdomain.example.com/path?query=value#fragment'
      const normalized = normalizeUrl(url)
      expect(normalized).toBe('https://subdomain.example.com/path')
    })
  })

  describe('filterUniqueValues', () => {
    it('should filter out duplicate URLs', () => {
      const results: SearchResult[] = [
        {
          name: 'Tab 1',
          url: 'https://example.com',
          faviconUrl: '',
          tab: {} as any,
        },
        {
          name: 'Tab 2',
          url: 'https://example.com',
          faviconUrl: '',
          tab: {} as any,
        },
        {
          name: 'Tab 3',
          url: 'https://different.com',
          faviconUrl: '',
          tab: {} as any,
        },
      ]

      const filtered = filterUniqueValues(results)
      expect(filtered.length).toBe(2)
      expect(filtered[0].url).toBe('https://example.com')
      expect(filtered[1].url).toBe('https://different.com')
    })
  })

  describe('isBrowserAction', () => {
    it('should return true for BrowserAction objects', () => {
      const action: BrowserAction = {
        name: 'Test Action',
        action: async () => {},
      }

      expect(isBrowserAction(action)).toBe(true)
    })

    it('should return false for SearchResult objects', () => {
      const result: SearchResult = {
        name: 'Test Result',
        url: 'https://example.com',
        faviconUrl: '',
      }

      expect(isBrowserAction(result)).toBe(false)
    })
  })
})
