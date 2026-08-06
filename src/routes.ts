import type {
  ParsedRoute,
  RouteConfig,
  RouteHandler,
  RouteHandlerConfig,
  RouteMethod,
  Routes
} from '#types/routes'
import type { App } from '#types/server'
import type { HTTPHandler } from 'h3'

import {
  ALL_HTTP_METHOD,
  DEFAULT_HTTP_METHOD,
  ROUTE_METHODS
} from './constants'
import { isObject, joinPaths } from './util'

/**
 * Checks whether a value is accepted by H3 as an HTTP handler.
 */
function isHTTPHandler(handler: unknown): handler is HTTPHandler {
  return (
    typeof handler === 'function' ||
    (handler !== null &&
      typeof handler === 'object' &&
      'fetch' in handler &&
      typeof handler.fetch === 'function')
  )
}

/**
 * Checks if the given configuration object is a valid RouteHandlerConfig.
 */
function isRouteHandlerConfig(config: unknown): config is RouteHandlerConfig {
  return (
    isObject(config) &&
    'handler' in config &&
    Object.hasOwn(config, 'handler') &&
    isHTTPHandler(config.handler)
  )
}

/**
 * Checks whether a value is a direct or configured route handler.
 */
function isRouteHandler(config: unknown): config is RouteHandler {
  return isRouteHandlerConfig(config) || isHTTPHandler(config)
}

/**
 * Finds route configuration keys that make a plain handler object ambiguous.
 */
function findRouteHandlerConflict(
  config: object
): RouteMethod | 'children' | undefined {
  if (Object.hasOwn(config, 'children')) return 'children'

  return ROUTE_METHODS.find((method) => Object.hasOwn(config, method))
}

/**
 * Checks if the given object is a valid RouteConfig.
 * A RouteConfig must have at least one HTTP method property or a children property.
 */
function isRouteConfig(config: unknown): config is RouteConfig {
  if (!isObject(config) || isRouteHandler(config)) return false

  const cfg = config as RouteConfig
  return Boolean(
    (Object.hasOwn(cfg, 'children') && cfg.children !== undefined) ||
    ROUTE_METHODS.some(
      (method) => Object.hasOwn(cfg, method) && cfg[method] !== undefined
    )
  )
}

/**
 * Parses an HTTPHandler or a handler with flattened H3 route options.
 */
function parseRouteHandler(
  route: string,
  method: RouteMethod,
  routeHandler: RouteHandler
): ParsedRoute {
  if (isObject(routeHandler)) {
    const conflict = findRouteHandlerConflict(routeHandler)

    if (conflict !== undefined) {
      throw new TypeError(
        `[kaivo] Handler configuration for ${method} ${route} cannot include route key "${conflict}". Define children and HTTP methods at the route level instead.`
      )
    }
  }

  if (!isRouteHandlerConfig(routeHandler)) {
    return {
      route,
      method,
      handler: routeHandler
    }
  }

  const { handler, middleware, meta } = routeHandler
  const options = {
    ...(middleware !== undefined && { middleware }),
    ...(meta !== undefined && { meta })
  }

  return {
    route,
    method,
    handler,
    ...(Object.keys(options).length > 0 && { options })
  }
}

/**
 * Parses nested route structures into a flat array of route definitions.
 * Recursively processes route configurations and child routes, resolving
 * full paths and extracting handler configurations.
 */
function parseRoutes(routes: Routes, basePath = ''): ParsedRoute[] {
  const parsedRoutes: ParsedRoute[] = []

  for (const [path, config] of Object.entries(routes)) {
    const fullPath = joinPaths(basePath, path)

    if (isRouteHandler(config)) {
      // A direct handler uses GET by default.
      parsedRoutes.push(
        parseRouteHandler(fullPath, DEFAULT_HTTP_METHOD, config)
      )
    } else if (isRouteConfig(config)) {
      // Process RouteConfig type

      for (const method of ROUTE_METHODS) {
        const methodConfig = config[method]
        if (methodConfig === undefined) continue

        if (!isRouteHandler(methodConfig)) {
          throw new TypeError(
            `[kaivo] Invalid route handler for ${method} ${fullPath}.`
          )
        }

        parsedRoutes.push(parseRouteHandler(fullPath, method, methodConfig))
      }

      // Recursively process child routes
      if (config.children !== undefined) {
        if (!isObject(config.children)) {
          throw new TypeError(`[kaivo] Invalid children for route ${fullPath}.`)
        }

        parsedRoutes.push(...parseRoutes(config.children, fullPath))
      }
    } else {
      throw new TypeError(
        `[kaivo] Invalid route configuration for ${fullPath}.`
      )
    }
  }

  return parsedRoutes
}

/**
 * Defines routes with type safety and auto-completion.
 * This is a simple identity function that provides better TypeScript inference.
 */
const defineRoutes = (routes: Routes) => routes

/**
 * Registers all routes to an H3 application instance.
 * Parses the route configurations and registers them with the appropriate
 * HTTP methods and options.
 */
function registerRoutes(app: App, routes?: Routes): void {
  if (!isObject(routes)) return

  const parsedRoutes = parseRoutes(routes)

  for (const { route, method, handler, options } of parsedRoutes) {
    if (method === ALL_HTTP_METHOD) {
      app.all(route, handler, options)
    } else {
      app.on(method, route, handler, options)
    }
  }
}

export {
  defineRoutes,
  isHTTPHandler,
  isRouteConfig,
  isRouteHandler,
  isRouteHandlerConfig,
  parseRoutes,
  registerRoutes
}
