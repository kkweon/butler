import { SearchResult, BrowserAction } from './models'

export function filterUniqueValues(results: SearchResult[]): SearchResult[] {
  const set = new Set()
  return results.filter((result: SearchResult) => {
    if (set.has(result.url)) {
      return false
    }
    set.add(result.url)
    return true
  })
}

export function isBrowserAction(
  result: SearchResult | BrowserAction,
): result is BrowserAction {
  return (result as BrowserAction).action !== undefined
}

/**
 * Normalizes a URL by removing query strings and hash fragments.
 * Used for identifying duplicate tabs based on their base URL.
 * @param url The URL to normalize
 * @returns The normalized URL without query strings and fragments, or empty string if invalid
 */
export function normalizeUrl(url: string | undefined): string {
  if (!url) {
    return ''
  }

  try {
    const urlObj = new URL(url)
    // Return protocol + hostname + pathname (no search params or hash)
    return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`
  } catch (error) {
    // If URL parsing fails, return the original URL
    return url
  }
}
