import type {
  App,
  AppInput,
  AppOptions,
  Server,
  ServerOptions
} from '#types/server'

import { H3, serve } from 'h3'

import { registerMiddlewares } from './middlewares'
import { registerRoutes } from './routes'

type ServerState = 'idle' | 'starting' | 'listening' | 'closing'

/**
 * Creates an H3 application instance with the provided configuration.
 * Registers plugins, middlewares, and routes in the correct order.
 */
function createApp(options: AppOptions = {}): App {
  const { routes, middlewares, ...h3Config } = options

  // Create H3 App
  const app = new H3(h3Config)

  // Register all middlewares
  registerMiddlewares(app, middlewares)

  // Register all routes
  registerRoutes(app, routes)

  return app
}

/**
 * Creates an HTTP server controller from an H3 app or declarative app options.
 * Server-specific options are passed separately to srvx.
 */
function createServer(
  appOrOptions: AppInput = {},
  serverOptions: ServerOptions = {}
): Server {
  const {
    port = 0,
    hostname = '127.0.0.1',
    ...restOptions
  } = filterServerOptions(serverOptions)
  const app = isH3App(appOrOptions) ? appOrOptions : createApp(appOrOptions)
  let state: ServerState = 'idle'

  const server: Server = {
    app,
    raw: undefined,
    port: undefined,
    url: undefined,

    /**
     * Starts the server on the specified port.
     * Uses H3's serve() method internally to start the HTTP server.
     * Throws if the server has already been started.
     */
    listen: async (listenPort?: number): Promise<Server> => {
      if (state === 'listening') {
        throw new Error(
          '[katro] Server is already listening. Close it before listening again.'
        )
      }
      if (state !== 'idle') {
        throw new Error(`[katro] Cannot listen while server is ${state}.`)
      }

      const targetPort = listenPort ?? port
      let raw: Server['raw']
      state = 'starting'

      try {
        raw = serve(server.app, {
          port: targetPort,
          hostname,
          ...restOptions
        })
        server.raw = raw

        // Wait for the server to start
        await raw.ready()

        if (!raw.url) {
          throw new Error('[katro] Server started without a listening URL.')
        }

        const rawUrl = new URL(raw.url)
        const rawPort = resolveServerPort(rawUrl)

        if (rawUrl.hostname === '127.0.0.1') {
          rawUrl.hostname = 'localhost'
        }

        server.port = rawPort
        server.url = rawUrl.toString()
        state = 'listening'

        return server
      } catch (error) {
        try {
          if (raw) await raw.close(true)
        } catch {
          // Preserve the original startup error.
        } finally {
          if (!raw || server.raw === raw) {
            resetServerState(server)
          }
          state = 'idle'
        }

        throw error
      }
    },

    /**
     * Stops the server and cleans up resources.
     * Waits for pending requests to complete before shutting down.
     */
    close: async (): Promise<void> => {
      if (state === 'starting' || state === 'closing') {
        throw new Error(`[katro] Cannot close while server is ${state}.`)
      }
      if (state === 'idle') {
        resetServerState(server)
        return
      }

      state = 'closing'

      try {
        if (server.raw) await server.raw.close()
        resetServerState(server)
        state = 'idle'
      } catch (error) {
        state = 'listening'
        throw error
      }
    }
  }

  return server
}

/**
 * Checks whether the input is an H3 application instead of declarative options.
 * Uses H3 capabilities rather than instanceof so apps from another H3 copy work.
 */
function isH3App(input: AppInput): input is App {
  return (
    'fetch' in input &&
    typeof input.fetch === 'function' &&
    'register' in input &&
    typeof input.register === 'function' &&
    'on' in input &&
    typeof input.on === 'function' &&
    'use' in input &&
    typeof input.use === 'function'
  )
}

/**
 * Resolves the actual listening port from a server URL.
 * WHATWG URL omits the default port for HTTP and HTTPS URLs.
 */
function resolveServerPort(url: URL): number {
  if (url.port) {
    return Number.parseInt(url.port, 10)
  }

  if (url.protocol === 'http:') {
    return 80
  }

  if (url.protocol === 'https:') {
    return 443
  }

  throw new Error(`[katro] Unsupported server protocol: ${url.protocol}`)
}

/**
 * Removes srvx options controlled internally by H3 and Katro.
 * Runtime filtering is required because extra properties can bypass Omit types.
 */
function filterServerOptions(options: ServerOptions): ServerOptions {
  const filteredOptions = { ...options }

  Reflect.deleteProperty(filteredOptions, 'fetch')
  Reflect.deleteProperty(filteredOptions, 'manual')

  return filteredOptions
}

/**
 * Clears the runtime state associated with the active srvx server.
 */
function resetServerState(server: Server): void {
  server.raw = undefined
  server.port = undefined
  server.url = undefined
}

export { createApp, createServer }
