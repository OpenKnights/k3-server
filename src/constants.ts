import type { AllHTTPMethod, HTTPMethod, RouteMethod } from '#types/routes'

/**
 * HTTP methods supported by H3.
 */
export const HTTP_METHODS = [
  'GET',
  'HEAD',
  'PATCH',
  'POST',
  'PUT',
  'DELETE',
  'CONNECT',
  'OPTIONS',
  'TRACE',
  'QUERY'
] as const satisfies readonly HTTPMethod[]

/**
 * Special HTTP method constant that matches all HTTP methods.
 * Used for registering handlers that respond to any HTTP method.
 */
export const ALL_HTTP_METHOD: AllHTTPMethod = 'ALL'

/**
 * Default method used by direct route handlers.
 */
export const DEFAULT_HTTP_METHOD: HTTPMethod = 'GET'

/**
 * Methods supported by declarative route configuration.
 */
export const ROUTE_METHODS = [
  ...HTTP_METHODS,
  ALL_HTTP_METHOD
] as const satisfies readonly RouteMethod[]
