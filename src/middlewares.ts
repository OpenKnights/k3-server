import type {
  MiddlewareConfig,
  Middlewares,
  ParsedMiddleware
} from '#types/middlewares'
import type { App } from '#types/server'

import { isEmptyArray, isObject } from './util'

/**
 * Checks if the given configuration object is a valid MiddlewareConfig.
 */
function isMiddlewareConfig(config: unknown): config is MiddlewareConfig {
  return (
    isObject(config) &&
    'handler' in config &&
    typeof config.handler === 'function'
  )
}

/**
 * Parses middleware configurations into a standardized tuple format.
 * Converts various middleware input formats into arrays that can be directly
 * spread into app.use() calls.
 */
function parseMiddlewares(middlewares: Middlewares): ParsedMiddleware[] {
  const parsedMiddlewares: ParsedMiddleware[] = []

  for (const middleware of middlewares) {
    if (isMiddlewareConfig(middleware)) {
      // MiddlewareConfig format
      const { route, handler, options } = middleware

      if (route && options) {
        parsedMiddlewares.push([route, handler, options])
      } else if (route) {
        parsedMiddlewares.push([route, handler])
      } else if (options) {
        parsedMiddlewares.push([handler, options])
      } else {
        parsedMiddlewares.push([handler])
      }
    } else {
      // Direct Middleware function format
      parsedMiddlewares.push([middleware])
    }
  }

  return parsedMiddlewares
}

/**
 * Defines a middleware configuration array with type safety and auto-completion.
 * This is an identity function for configurations consumed by parseMiddlewares.
 */
const defineMiddlewares = (middlewares: Middlewares): Middlewares => middlewares

/**
 * Registers all middlewares to an H3 application instance.
 * Parses the middleware configurations and applies them to the app in order.
 */
function registerMiddlewares(app: App, middlewares?: Middlewares): void {
  if (isEmptyArray(middlewares)) return

  const parsedMiddlewares = parseMiddlewares(middlewares)

  // Spread the array directly to app.use()
  for (const middleware of parsedMiddlewares) {
    // @ts-expect-error - spreading tuple types
    app.use(...middleware)
  }
}

export {
  defineMiddlewares,
  isMiddlewareConfig,
  parseMiddlewares,
  registerMiddlewares
}
