import type { MiddlewareOptions } from 'h3'

import { describe, expect, it, vi } from 'vitest'

import {
  defineMiddlewares,
  isMiddlewareConfig,
  parseMiddlewares,
  registerMiddlewares
} from '../src/middlewares'

describe('middlewares', () => {
  describe('isMiddlewareConfig', () => {
    it('should return true for configurations with a middleware function', () => {
      expect(isMiddlewareConfig({ handler: () => {} })).toBe(true)
      expect(isMiddlewareConfig({ handler: () => {}, route: '/api' })).toBe(
        true
      )
    })

    it('should return false for configurations without a middleware function', () => {
      expect(isMiddlewareConfig({ route: '/api' })).toBe(false)
      expect(isMiddlewareConfig({ handler: 'not a function' })).toBe(false)
      expect(isMiddlewareConfig({ handler: null })).toBe(false)
      expect(isMiddlewareConfig(null)).toBe(false)
      expect(isMiddlewareConfig(undefined)).toBe(false)
    })
  })

  describe('parseMiddlewares', () => {
    it('should parse plain middleware functions', () => {
      const mw = vi.fn()
      const result = parseMiddlewares([mw])

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual([mw])
    })

    it('should parse middleware with route', () => {
      const mw = vi.fn()
      const result = parseMiddlewares([{ handler: mw, route: '/api' }])

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(['/api', mw])
    })

    it('should parse middleware with options', () => {
      const mw = vi.fn()
      const options: MiddlewareOptions = { method: 'get' }
      const result = parseMiddlewares([{ handler: mw, options }])

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual([mw, options])
    })

    it('should parse middleware with route and options', () => {
      const mw = vi.fn()
      const options: MiddlewareOptions = { method: 'post' }
      const result = parseMiddlewares([{ handler: mw, route: '/api', options }])

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(['/api', mw, options])
    })

    it('should handle mixed middleware formats', () => {
      const mw1 = vi.fn()
      const mw2 = vi.fn()
      const mw3 = vi.fn()

      const result = parseMiddlewares([
        mw1,
        { handler: mw2, route: '/api' },
        { handler: mw3, options: { method: 'patch' } }
      ])

      expect(result).toHaveLength(3)
      expect(result[0]).toEqual([mw1])
      expect(result[1]).toEqual(['/api', mw2])
      expect(result[2]).toEqual([mw3, { method: 'patch' }])
    })
  })

  describe('defineMiddlewares', () => {
    it('should return middleware configurations unchanged', () => {
      const mw = vi.fn()
      const middlewares = [
        mw,
        {
          route: '/api/**',
          handler: vi.fn(),
          options: { method: 'POST' }
        }
      ]
      const result = defineMiddlewares(middlewares)

      expect(result).toBe(middlewares)
    })
  })

  describe('registerMiddlewares', () => {
    it('should not fail with undefined middlewares', () => {
      const app = { use: vi.fn() }
      expect(() => registerMiddlewares(app as any, undefined)).not.toThrow()
    })

    it('should not fail with empty array', () => {
      const app = { use: vi.fn() }
      expect(() => registerMiddlewares(app as any, [])).not.toThrow()
    })

    it('should register middlewares to app', () => {
      const app = { use: vi.fn() }
      const mw = vi.fn()

      registerMiddlewares(app as any, [mw])

      expect(app.use).toHaveBeenCalledWith(mw)
    })
  })
})
