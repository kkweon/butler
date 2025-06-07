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
