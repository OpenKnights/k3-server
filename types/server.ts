import type { H3Config, H3 as H3Instance } from 'h3'
import type {
  Server as SrvxServer,
  ServerOptions as SrvxServerOptions
} from 'srvx'

import type { Middlewares } from './middlewares'
import type { Routes } from './routes'

/**
 * H3 application instance.
 * This is the core application object that manages routes, middlewares, and plugins.
 */
type App = H3Instance

/**
 * Configuration options for creating an H3 application.
 * All options are optional, allowing for flexible application setup.
 */
interface AppOptions extends H3Config {
  routes?: Routes
  middlewares?: Middlewares
}

/**
 * Input accepted by createServer for constructing or reusing an H3 app.
 */
type AppInput = App | AppOptions

/**
 * srvx server options managed by Kaivo.
 * H3 provides the fetch handler and Kaivo controls when listening starts.
 */
type ServerOptions = Omit<SrvxServerOptions, 'fetch' | 'manual'>

/**
 * Application server instance with server information and control methods.
 */
interface Server {
  /**
   * The raw srvx server instance returned by H3's serve().
   * Provides access to low-level server operations and configuration.
   * Undefined until `listen()` is called.
   */
  raw: SrvxServer | undefined

  /**
   * The H3 application instance.
   * Provides access to the configured H3 app with all routes, middlewares, and plugins.
   */
  app: App

  /**
   * The port number the server is listening on.
   * Undefined until `listen()` is called successfully.
   */
  port: number | undefined

  /**
   * The full URL where the server can be accessed.
   * Undefined until `listen()` is called successfully.
   * Format: 'http://localhost:{port}'
   */
  url: string | undefined

  /**
   * Starts the server on the specified port.
   * Uses H3's serve() method internally to start the HTTP server.
   * Returns this server controller after listening successfully.
   * Throws if the server has already been started.
   *
   * @param {number} [listenPort] - Optional port to override the default
   */
  listen: (listenPort?: number) => Promise<Server>

  /**
   * Async function to gracefully close the server.
   * Waits for pending requests to complete before shutting down.
   * Resets port, url, and raw to undefined after closing.
   */
  close: () => Promise<void>
}

export { App, AppInput, AppOptions, Server, ServerOptions, SrvxServer }
