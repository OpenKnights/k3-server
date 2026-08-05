import type { App } from '#types/server'

import { H3, serve } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createApp, createServer } from '../src/server'

const RANDOM_PORT = 49_152

// Mock H3 and dependencies
vi.mock('h3', () => ({
  H3: vi.fn(
    class {
      fetch = vi.fn()
      use = vi.fn()
      register = vi.fn()
      all = vi.fn()
      on = vi.fn()
      get = vi.fn()
      post = vi.fn()
    }
  ),
  serve: vi.fn((app, options) => {
    const port = options.port === 0 ? RANDOM_PORT : (options.port ?? 3000)

    return {
      options,
      url: `${options.protocol ?? 'http'}://${options.hostname ?? 'localhost'}:${port}`,
      ready: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined)
    }
  }),
  defineMiddleware: vi.fn((middleware: unknown) => middleware),
  definePlugin: vi.fn((def: (h3: App, options: unknown) => void) => {
    return ((opts?: any) => (h3: App) => def(h3, opts)) as any
  })
}))

describe('server', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createApp', () => {
    it('should create H3 app instance', () => {
      const app = createApp()
      expect(app).toBeDefined()
    })

    it('should pass H3 config and register declarative options', () => {
      const route = vi.fn()
      const middleware = vi.fn()
      const plugin = vi.fn()
      const onRequest = vi.fn()

      const app = createApp({
        debug: true,
        onRequest,
        plugins: [plugin],
        routes: { '/api': route },
        middlewares: [middleware]
      })

      expect(H3).toHaveBeenCalledWith({
        debug: true,
        onRequest,
        plugins: [plugin]
      })
      expect(app.use).toHaveBeenCalledWith(middleware)
      expect(app.on).toHaveBeenCalledWith('GET', '/api', route, undefined)
      expect(app.register).not.toHaveBeenCalled()
    })
  })

  describe('createServer', () => {
    it('should create server instance', () => {
      const routes = { '/api': vi.fn() }
      const server = createServer({ routes })

      expect(server).toBeDefined()
      expect(server.listen).toBeInstanceOf(Function)
      expect(server.close).toBeInstanceOf(Function)

      // Not listening yet
      expect(server.port).toBeUndefined()
      expect(server.url).toBeUndefined()
      expect(server.raw).toBeUndefined()
    })

    it('should use default port 0 when no port is provided (random port)', async () => {
      const server = createServer()

      const listeningServer = await server.listen()

      expect(listeningServer).toBe(server)
      expect(server.raw).toBeDefined()
      expect(server.port).toBeDefined()
      expect(server.url).toBeDefined()
    })

    it('should listen on specified port', async () => {
      const routes = { '/api': vi.fn() }
      const server = createServer({ routes }, { port: 8080 })

      await server.listen()

      expect(server.port).toBe(8080)
      expect(server.url).toContain('8080')
    })

    it('should resolve the default HTTP port', async () => {
      const server = createServer({}, { port: 80 })

      await server.listen()

      expect(server.port).toBe(80)
      expect(server.url).toBe('http://localhost/')
    })

    it('should resolve the default HTTPS port', async () => {
      const server = createServer({}, { port: 443, protocol: 'https' })

      await server.listen()

      expect(server.port).toBe(443)
      expect(server.url).toBe('https://localhost/')
    })

    it('should reject when listen is called again', async () => {
      const routes = { '/api': vi.fn() }
      const server = createServer({ routes }, { port: 8080 })

      await server.listen()
      const previousRaw = server.raw!
      const previousClose = previousRaw.close

      await expect(server.listen(9090)).rejects.toThrow(
        '[katro] Server is already listening. Close it before listening again.'
      )

      expect(previousClose).not.toHaveBeenCalled()
      expect(server.raw).toBe(previousRaw)
      expect(server.port).toBe(8080)
      expect(server.url).toContain('8080')
    })

    it('should reject conflicting operations while starting', async () => {
      let resolveReady!: () => void
      const readyPromise = new Promise<void>((resolve) => {
        resolveReady = resolve
      })
      const pendingRaw = {
        url: 'http://127.0.0.1:8080',
        ready: vi.fn().mockReturnValue(readyPromise),
        close: vi.fn().mockResolvedValue(undefined)
      }
      vi.mocked(serve).mockReturnValueOnce(
        pendingRaw as unknown as ReturnType<typeof serve>
      )
      const server = createServer()

      const listening = server.listen()

      await expect(server.listen()).rejects.toThrow(
        '[katro] Cannot listen while server is starting.'
      )
      await expect(server.close()).rejects.toThrow(
        '[katro] Cannot close while server is starting.'
      )

      resolveReady()
      await expect(listening).resolves.toBe(server)
      expect(server.port).toBe(8080)
    })

    it('should clean up and allow retry after startup fails', async () => {
      const startupError = Object.assign(new Error('Address in use'), {
        code: 'EADDRINUSE'
      })
      const failedRaw = {
        url: undefined,
        ready: vi.fn().mockRejectedValue(startupError),
        close: vi.fn().mockResolvedValue(undefined)
      }
      vi.mocked(serve).mockReturnValueOnce(
        failedRaw as unknown as ReturnType<typeof serve>
      )
      const server = createServer()

      await expect(server.listen(3060)).rejects.toBe(startupError)

      expect(failedRaw.close).toHaveBeenCalledWith(true)
      expect(server.raw).toBeUndefined()
      expect(server.port).toBeUndefined()
      expect(server.url).toBeUndefined()

      await expect(server.listen()).resolves.toBe(server)
      expect(server.port).toBe(RANDOM_PORT)
    })

    it('should preserve the startup error when cleanup fails', async () => {
      const startupError = new Error('Startup failed')
      const failedRaw = {
        url: undefined,
        ready: vi.fn().mockRejectedValue(startupError),
        close: vi.fn().mockRejectedValue(new Error('Cleanup failed'))
      }
      vi.mocked(serve).mockReturnValueOnce(
        failedRaw as unknown as ReturnType<typeof serve>
      )
      const server = createServer()

      await expect(server.listen()).rejects.toBe(startupError)

      expect(server.raw).toBeUndefined()
      expect(server.port).toBeUndefined()
      expect(server.url).toBeUndefined()
    })

    it('should clean up when the listening URL is unavailable', async () => {
      const rawWithoutUrl = {
        url: undefined,
        ready: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined)
      }
      vi.mocked(serve).mockReturnValueOnce(
        rawWithoutUrl as unknown as ReturnType<typeof serve>
      )
      const server = createServer()

      await expect(server.listen()).rejects.toThrow(
        '[katro] Server started without a listening URL.'
      )

      expect(rawWithoutUrl.close).toHaveBeenCalledWith(true)
      expect(server.raw).toBeUndefined()
      expect(server.port).toBeUndefined()
      expect(server.url).toBeUndefined()
    })

    it('should reject conflicting operations while closing', async () => {
      let resolveClose!: () => void
      const closePromise = new Promise<void>((resolve) => {
        resolveClose = resolve
      })
      const server = createServer({}, { port: 8080 })

      await server.listen()
      vi.mocked(server.raw!.close).mockReturnValueOnce(closePromise)

      const closing = server.close()

      await expect(server.listen()).rejects.toThrow(
        '[katro] Cannot listen while server is closing.'
      )
      await expect(server.close()).rejects.toThrow(
        '[katro] Cannot close while server is closing.'
      )

      resolveClose()
      await expect(closing).resolves.toBeUndefined()
      await expect(server.listen()).resolves.toBe(server)
    })

    it('should remain listening when close fails', async () => {
      const closeError = new Error('Close failed')
      const server = createServer({}, { port: 8080 })

      await server.listen()
      vi.mocked(server.raw!.close).mockRejectedValueOnce(closeError)

      await expect(server.close()).rejects.toBe(closeError)
      await expect(server.listen()).rejects.toThrow(
        '[katro] Server is already listening. Close it before listening again.'
      )
      expect(server.port).toBe(8080)
      expect(server.url).toContain('8080')
    })

    it('should close server correctly', async () => {
      const routes = { '/api': vi.fn() }
      const server = createServer({ routes })

      await server.listen()

      await expect(server.close()).resolves.toBeUndefined()
      expect(server.raw).toBeUndefined()
      expect(server.port).toBeUndefined()
      expect(server.url).toBeUndefined()
    })

    it('should allow routes to be registered directly on the H3 app', () => {
      const server = createServer()
      const handler = vi.fn()

      server.app.get('/h3', handler)

      expect(server.app.get).toHaveBeenCalledWith('/h3', handler)
    })

    it('should use an existing app created with createApp', () => {
      const configuredHandler = vi.fn()
      const directHandler = vi.fn()
      const app = createApp({
        routes: {
          '/configured': configuredHandler
        }
      })
      const server = createServer(app, { port: 8080 })

      server.app.post('/direct', directHandler)

      expect(server.app).toBe(app)
      expect(server.app.on).toHaveBeenCalledWith(
        'GET',
        '/configured',
        configuredHandler,
        undefined
      )
      expect(server.app.post).toHaveBeenCalledWith('/direct', directHandler)
    })

    it('should pass srvx middleware and plugins through server options', async () => {
      const routes = { '/api': vi.fn() }
      const middleware = vi.fn()
      const plugin = vi.fn()
      const server = createServer(
        { routes },
        {
          middleware: [middleware as any],
          plugins: [plugin as any],
          port: 8080
        }
      )

      await server.listen()

      expect(serve).toHaveBeenCalledWith(
        server.app,
        expect.objectContaining({
          middleware: [middleware],
          plugins: [plugin],
          port: 8080
        })
      )
    })

    it('should filter fetch and manual from server options', async () => {
      const serverOptions = {
        fetch: vi.fn(),
        manual: true,
        port: 8080
      }
      const server = createServer({}, serverOptions)

      await server.listen()

      const passedOptions = vi.mocked(serve).mock.calls.at(-1)?.[1]
      expect(passedOptions).not.toHaveProperty('fetch')
      expect(passedOptions).not.toHaveProperty('manual')
      expect(passedOptions).toEqual(
        expect.objectContaining({
          hostname: '127.0.0.1',
          port: 8080
        })
      )
      expect(serverOptions.fetch).toBeDefined()
      expect(serverOptions.manual).toBe(true)
    })
  })
})
