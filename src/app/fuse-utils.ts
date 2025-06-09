import Fuse from 'fuse.js'

// Common Fuse.js properties (non-generic parts)
const COMMON_FUSE_PROPERTIES = {
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
  const options: Fuse.IFuseOptions<T> = {
    ...COMMON_FUSE_PROPERTIES,
    keys,
  }
  return new Fuse(list, options)
}
