import Fuse from 'fuse.js'

// Common Fuse.js options
const DEFAULT_FUSE_OPTIONS: Fuse.IFuseOptions<unknown> = {
  isCaseSensitive: false,
  threshold: 0.45,
  ignoreLocation: true,
}

/**
 * Creates a new Fuse.js instance with common options.
 * @param list The list of items to search.
 * @param keys The keys to search on.
 * @returns A new Fuse.js instance.
 */
export function createFuseInstance<T>(
  list: ReadonlyArray<T>,
  keys: string[],
): Fuse<T> {
  return new Fuse(list, {
    ...DEFAULT_FUSE_OPTIONS,
    keys,
  })
}
