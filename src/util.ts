const DUPLICATE_SLASHES_RE = /\/+/g
const TRAILING_SLASH_RE = /\/$/

/**
 * Checks if a value is a plain object.
 * Returns false for arrays, null, and non-object types.
 */
export const isObject = (value: unknown): value is object => {
  return !!value && value.constructor === Object
}

/**
 * Checks if a value is undefined, null, or an empty array.
 * Useful for validating optional array parameters.
 */
export const isEmptyArray = (value: unknown): value is undefined | null | [] =>
  value === undefined ||
  value === null ||
  !Array.isArray(value) ||
  value.length === 0

/**
 * Joins multiple path segments into a single normalized path.
 * Removes duplicate slashes, trailing slashes, and handles empty segments.
 * Returns '/' for empty or all-falsy inputs.
 */
export function joinPaths(...paths: string[]): string {
  return (
    paths
      .filter(Boolean)
      .join('/')
      .replace(DUPLICATE_SLASHES_RE, '/')
      .replace(TRAILING_SLASH_RE, '') || '/'
  )
}
