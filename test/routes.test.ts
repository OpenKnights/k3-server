import type { Routes } from '#types/routes'
import type { RouteOptions } from 'h3'

import { describe, expect, it, vi } from 'vitest'

import { defineRoutes, parseRoutes, registerRoutes } from '../src/routes'

describe('routes', () => {
  describe('parseRoutes', () => {
    it('should parse simple route handler', () => {
      const handler = vi.fn()
      const routes = { '/api': handler }
      const result = parseRoutes(routes)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        route: '/api',
        method: 'GET',
        handler
      })
    })

    it('should parse RouteConfig with GET method', () => {
      const handler = vi.fn()
      const routes = { '/api': { GET: handler } }
      const result = parseRoutes(routes)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        route: '/api',
        method: 'GET',
        handler
      })
    })

    it('should parse multiple HTTP methods', () => {
      const getHandler = vi.fn()
      const queryHandler = vi.fn()
      const routes = {
        '/api': {
          GET: getHandler,
          QUERY: queryHandler
        }
      }
      const result = parseRoutes(routes)

      expect(result).toHaveLength(2)
      expect(result[0].method).toBe('GET')
      expect(result[1].method).toBe('QUERY')
    })

    it('should parse every HTTP method supported by H3', () => {
      const handler = vi.fn()
      const routes: Routes = {
        '/api': {
          GET: handler,
          HEAD: handler,
          PATCH: handler,
          POST: handler,
          PUT: handler,
          DELETE: handler,
          CONNECT: handler,
          OPTIONS: handler,
          TRACE: handler,
          QUERY: handler
        }
      }
      const result = parseRoutes(routes)

      expect(result.map(({ method }) => method)).toEqual([
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
      ])
    })

    it('should accept a fetchable object as an HTTPHandler', () => {
      const handler = { fetch: vi.fn() }
      const routes: Routes = { '/api': handler }
      const result = parseRoutes(routes)

      expect(result[0]).toEqual({
        route: '/api',
        method: 'GET',
        handler
      })
    })

    it('should prefer a fetchable handler over conflicting config keys', () => {
      const handler = {
        fetch: vi.fn(),
        children: { ignored: true },
        GET: vi.fn()
      }
      const routes: Routes = { '/api': handler }
      const result = parseRoutes(routes)

      expect(result[0]).toEqual({
        route: '/api',
        method: 'GET',
        handler
      })
    })

    it('should parse an explicit ALL handler with route options', () => {
      const handler = { fetch: vi.fn() }
      const options: RouteOptions = { meta: { name: 'king3' } }
      const routes: Routes = {
        '/api': {
          ALL: {
            handler,
            meta: options.meta
          }
        }
      }
      const result = parseRoutes(routes)

      expect(result[0]).toEqual({
        route: '/api',
        method: 'ALL',
        handler,
        options
      })
    })

    it('should parse handler with options', () => {
      const handler = vi.fn()
      const middleware = vi.fn()
      const options: RouteOptions = {
        meta: { name: 'king3' },
        middleware: [middleware]
      }
      const routes: Routes = {
        '/api': {
          GET: {
            handler,
            meta: options.meta,
            middleware: options.middleware
          }
        }
      }
      const result = parseRoutes(routes)

      expect(result[0].options).toEqual(options)
    })

    it('should handle nested children routes', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      const routes = {
        '/api': {
          GET: handler1,
          children: {
            '/users': {
              GET: handler2
            }
          }
        }
      }
      const result = parseRoutes(routes)

      expect(result).toHaveLength(2)
      expect(result[0].route).toBe('/api')
      expect(result[1].route).toBe('/api/users')
    })

    it('should reject an invalid method handler with route context', () => {
      const routes = { '/api': { GET: 'invalid' } } as unknown as Routes

      expect(() => parseRoutes(routes)).toThrow(
        '[k3-server] Invalid route handler for GET /api.'
      )
    })

    it('should reject invalid route children with route context', () => {
      const routes = { '/api': { children: null } } as unknown as Routes

      expect(() => parseRoutes(routes)).toThrow(
        '[k3-server] Invalid children for route /api.'
      )
    })

    it('should reject an empty route configuration', () => {
      const routes = { '/api': {} } as unknown as Routes

      expect(() => parseRoutes(routes)).toThrow(
        '[k3-server] Invalid route configuration for /api.'
      )
    })

    it('should join paths correctly with basePath', () => {
      const handler = vi.fn()
      const routes = { '/users': handler }
      const result = parseRoutes(routes, '/api')

      expect(result[0].route).toBe('/api/users')
    })
  })

  describe('defineRoutes', () => {
    it('should return routes object unchanged', () => {
      const routes = { '/api': vi.fn() }
      const result = defineRoutes(routes)

      expect(result).toBe(routes)
    })
  })

  describe('registerRoutes', () => {
    it('should not fail with undefined routes', () => {
      const app = { all: vi.fn(), on: vi.fn() }
      expect(() => registerRoutes(app as any, undefined)).not.toThrow()
    })

    it('should register ALL method with app.all', () => {
      const app = { all: vi.fn(), on: vi.fn() }
      const handler = vi.fn()

      registerRoutes(app as any, { '/api': { ALL: handler } })

      expect(app.all).toHaveBeenCalledWith('/api', handler, undefined)
    })

    it('should register a direct handler as GET', () => {
      const app = { all: vi.fn(), on: vi.fn() }
      const handler = vi.fn()

      registerRoutes(app as any, { '/api': handler })

      expect(app.on).toHaveBeenCalledWith('GET', '/api', handler, undefined)
      expect(app.all).not.toHaveBeenCalled()
    })

    it('should register specific method with app.on', () => {
      const app = { all: vi.fn(), on: vi.fn() }
      const handler = vi.fn()

      registerRoutes(app as any, { '/api': { OPTIONS: handler } })

      expect(app.on).toHaveBeenCalledWith('OPTIONS', '/api', handler, undefined)
    })
  })
})
