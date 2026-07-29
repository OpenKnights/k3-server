# k3-server

> A lightweight, TypeScript-first tool for quickly creating HTTP servers, powered by [unjs/h3](https://github.com/unjs/h3).

[![npm version](https://img.shields.io/npm/v/k3-server.svg)](https://www.npmjs.com/package/k3-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[English](./README.md) | [中文](./README_zh.md)

## Features

- Start a real HTTP server with minimal configuration
- Define nested, method-specific routes declaratively
- Access the underlying H3 app and srvx server when needed

## Installation

```bash
npm install k3-server
```

k3-server is ESM-only and requires Node.js 20.16 or newer.

## Quick Start

```typescript
import { createServer } from 'k3-server'

const server = createServer({
  routes: {
    '/hello': () => ({ message: 'Hello!' })
  }
})

await server.listen()

console.log(`Server running at ${server.url}`)

await server.close()
```

The server uses port `0` by default, allowing the operating system to assign an
available port. The resolved address is exposed through `server.url` and
`server.port`.

Pass srvx server options as the second argument when you need a fixed port or
other runtime configuration:

```typescript
const server = createServer(
  {
    routes: {
      '/hello': () => 'Hello!'
    }
  },
  {
    hostname: '127.0.0.1',
    port: 3000
  }
)
```

Creating the controller does not start the server. It only begins listening
when `listen()` is called.

## Routes

A direct route handler responds to GET requests:

```typescript
const server = createServer({
  routes: {
    '/ping': () => 'pong'
  }
})
```

Use method keys for other HTTP methods, `ALL` to match every method, and
`children` to group nested routes:

```typescript
import { readBody } from 'h3'
import { createServer } from 'k3-server'

const server = createServer({
  routes: {
    '/api': {
      children: {
        '/users': {
          GET: () => [{ id: 1, name: 'Alice' }],
          POST: async (event) => ({
            id: 2,
            ...(await readBody(event))
          }),
          children: {
            '/:id': {
              GET: (event) => ({
                id: event.context.params.id
              })
            }
          }
        }
      }
    },
    '/all': {
      ALL: (event) => ({
        method: event.req.method
      })
    }
  }
})
```

H3 route options are placed alongside `handler`:

```typescript
const routes = {
  '/users': {
    POST: {
      handler: createUser,
      meta: { name: 'create-user' },
      middleware: [requireAuth]
    }
  }
}
```

`defineRoutes()` is an identity helper that provides type inference for
standalone route definitions. Inline routes passed to `createServer()` are
already typed.

```typescript
import { defineRoutes } from 'k3-server'

const routes = defineRoutes({
  '/health': () => 'ok'
})
```

## H3 Integration

The H3 app is exposed as `server.app`. Use it to register native H3 routes and
middleware before calling `listen()`:

```typescript
import { createServer } from 'k3-server'

const server = createServer()

server.app.get('/hello', () => 'Hello from H3')
server.app.post('/users', createUser)
server.app.use(requestLogger)

await server.listen()
```

Declarative routes and the native H3 API can be used together.

Use `createApp()` when you want to configure the app separately or pass an
existing H3 app to `createServer()`:

```typescript
import { createApp, createServer } from 'k3-server'

const app = createApp({
  debug: true,
  routes: {
    '/hello': () => 'Hello!'
  }
})

app.get('/health', () => 'ok')

const server = createServer(app, { port: 3000 })
await server.listen()
```

`AppOptions` extends H3's native `H3Config`, so H3 options such as `plugins`,
`onRequest`, `onResponse`, and `onError` can be passed directly.

## Middleware

Pass middleware functions directly, or add a route and H3 middleware options:

```typescript
import { createServer, defineMiddleware, defineMiddlewares } from 'k3-server'

const requestLogger = defineMiddleware(async (event, next) => {
  console.log(event.req.method, event.url.pathname)
  return next()
})

const middlewares = defineMiddlewares([
  requestLogger,
  {
    route: '/api/**',
    handler: (event, next) => next(),
    options: {
      method: 'POST'
    }
  }
])

const server = createServer({ middlewares })
```

Middleware runs in registration order. Use route middleware when behavior
belongs to one route:

```typescript
const routes = {
  '/secret': {
    GET: {
      handler: secretHandler,
      middleware: [requireAuth]
    }
  }
}
```

See the [H3 middleware guide](https://h3.dev/guide/basics/middleware) for
middleware behavior and lifecycle utilities.

## Plugins

`definePlugin` is re-exported from H3:

```typescript
import { createServer, definePlugin } from 'k3-server'

const healthPlugin = definePlugin((app) => {
  app.get('/health', () => 'ok')
})()

const server = createServer({
  plugins: [healthPlugin]
})
```

Plugins in the first argument are H3 app plugins. Plugins in the second
`serverOptions` argument are srvx server plugins.

See the [H3 plugin guide](https://h3.dev/guide/advanced/plugins) for more
details.

## API

### `createServer(appOrOptions?, serverOptions?)`

Creates a synchronous server controller without starting the HTTP listener.

- `appOrOptions`: An existing H3 app or declarative `AppOptions`
- `serverOptions`: srvx options except `fetch` and `manual`
- Default port: `0`
- Default hostname: `127.0.0.1`

The returned controller exposes:

- `app`: H3 application
- `raw`: srvx server after listening
- `port`: Resolved port after listening
- `url`: Resolved URL after listening
- `listen(port?)`: Start listening
- `close()`: Stop listening and clear runtime state

Calling `listen()` while the server is already running throws an error. Close
the server before listening again.

### `createApp(options?)`

Creates an H3 app from native H3 config plus declarative `routes` and
`middlewares`.

### Configuration helpers

- `defineRoutes(routes)`: Type helper for standalone route definitions
- `defineMiddlewares(middlewares)`: Type helper for standalone middleware definitions
- `defineMiddleware`: Re-export from H3
- `definePlugin`: Re-export from H3

See [playground/server.ts](./playground/server.ts) for a larger working example.

## Notes

- Register routes, middleware, and plugins before calling `listen()`.
- Always call `close()` when the server is no longer needed.
- Routes cannot be added to an H3 app after the server has initialized.

## Related Projects

- [unjs/h3](https://github.com/unjs/h3) — Minimal HTTP framework
- [h3js/srvx](https://github.com/h3js/srvx) — Universal server runtime

## License

[MIT](./LICENSE) © 2025-PRESENT [king3](https://github.com/coderking3)
