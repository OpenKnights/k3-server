import type { HTTPHandler, HTTPMethod, RouteOptions } from 'h3'

/**
 * Special HTTP method constant that matches all HTTP methods.
 * When used, the route handler will respond to any HTTP method.
 */
type AllHTTPMethod = 'ALL'

/**
 * HTTP methods supported by route configuration.
 */
type RouteMethod = HTTPMethod | AllHTTPMethod

/**
 * H3 route options supported by configured route handlers.
 */
type SupportedRouteOptions = Pick<RouteOptions, 'middleware' | 'meta'>

/**
 * An H3 HTTP handler with route options at the same level.
 * Cannot be combined with children or HTTP method keys.
 */
type RouteHandlerConfig = {
  handler: HTTPHandler
  children?: never
} & SupportedRouteOptions &
  Partial<Record<RouteMethod, never>>

/**
 * A route handler can be any handler accepted by H3 or a configuration object
 * with a handler and route options.
 */
type RouteHandler = HTTPHandler | RouteHandlerConfig

/**
 * Makes at least one property from a configuration type required.
 */
type RequireAtLeastOne<T> = {
  [Key in keyof T]-?: Required<Pick<T, Key>> & Partial<Omit<T, Key>>
}[keyof T]

/**
 * Configuration object for defining routes with specific HTTP methods.
 * Supports every HTTP method exposed by H3 and nested child routes.
 */
type RouteConfig = RequireAtLeastOne<
  Partial<Record<RouteMethod, RouteHandler>> & {
    children?: Routes
  }
> & {
  handler?: never
  middleware?: never
  meta?: never
}

/**
 * Routes definition object mapping URL paths to handlers or configurations.
 *
 * - Keys are URL paths (can include parameters like `/:id`)
 * - Values can be:
 *   - A direct HTTPHandler (handles GET requests)
 *   - A RouteConfig object (defines method-specific handlers)
 */
interface Routes {
  [route: string]: RouteHandler | RouteConfig
}

/**
 * Internal representation of a parsed route after processing.
 * Used by the route registration system to apply routes to the H3 app.
 */
interface ParsedRoute {
  route: string
  method: RouteMethod
  handler: HTTPHandler
  options?: RouteOptions
}

export type { HTTPHandler, HTTPMethod } from 'h3'

export type {
  AllHTTPMethod,
  ParsedRoute,
  RouteConfig,
  RouteHandler,
  RouteHandlerConfig,
  RouteMethod,
  Routes
}
