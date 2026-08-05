# Katro

> A lightweight, TypeScript-first library built on [unjs/h3](https://github.com/unjs/h3) for quickly creating HTTP servers.

[![npm version](https://img.shields.io/npm/v/katro.svg)](https://www.npmjs.com/package/katro)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[English](./README.md) | [中文](./README_zh.md)

## Features

- Start a real HTTP server with minimal configuration
- Define nested, method-specific routes declaratively
- Configure middleware declaratively
- Control the server lifecycle and use an available random port by default
- Use native H3 handlers and access the underlying H3 app when needed

## Installation

```bash
npm install katro
```

Katro is ESM-only and requires Node.js 20.16 or newer.

## Quick Start

```typescript
import { createServer } from 'katro'

const server = createServer({
  routes: {
    '/hello': () => ({ message: 'Hello!' })
  }
})

await server.listen()

console.log(`Server running at ${server.url}`)
```

The server uses port `0` by default, allowing the operating system to assign an
available port. The resolved address is exposed through `server.url` and
`server.port`. Call `server.close()` when an embedding application or test no
longer needs the server.

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
import { createServer } from 'katro'

const server = createServer({
  routes: {
    '/api': {
      children: {
        '/users': {
          GET: () => [{ id: 1, name: 'Alice' }],
          POST: async (event) => {
            const body = await event.req.json()

            return {
              id: 2,
              body
            }
          },
          children: {
            '/:id': {
              GET: (event) => ({
                id: event.context.params?.id
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

Use `defineRoutes()` for type inference when routes are declared separately.
H3 route options are placed alongside `handler`:

```typescript
import { defineRoutes } from 'katro'

const routes = defineRoutes({
  '/users': {
    POST: {
      handler: createUser,
      meta: { name: 'create-user' },
      middleware: [requireAuth]
    }
  }
})
```

Inline routes passed to `createServer()` or `createApp()` are already typed.
See the [H3 routing guide](https://h3.dev/guide/basics/routing) for matching
behavior.

## Middleware

Pass middleware functions directly, or add a route and H3 middleware options:

```typescript
import { createServer, defineMiddleware, defineMiddlewares } from 'katro'

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
belongs to one route by placing it alongside the route handler:

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

Katro re-exports H3's `defineMiddleware()`. See the
[H3 middleware guide](https://h3.dev/guide/basics/middleware) for execution
semantics and lifecycle utilities.

## H3 Integration

Katro route handlers are native H3 handlers. You can return JavaScript values
or Web `Response` objects and use H3 utilities directly:

```typescript
const routes = {
  '/users': {
    POST: async (event) =>
      Response.json(await event.req.json(), {
        status: 201
      })
  }
}
```

Request parsing, response conversion, errors, cookies, CORS, redirects,
streams, proxying, SSE, and WebSocket support belong to H3 and the Web
platform. Refer to the H3 documentation for these capabilities:

- [Request utilities](https://h3.dev/utils/request)
- [Sending responses](https://h3.dev/guide/basics/response)
- [Error handling](https://h3.dev/guide/basics/error)
- [H3 utilities](https://h3.dev/utils)

The H3 app is exposed as `server.app`. Declarative configuration and native H3
APIs can be used together before listening:

```typescript
import { createApp, createServer } from 'katro'

const app = createApp({
  routes: {
    '/hello': () => 'Hello!'
  }
})

app.get('/health', () => 'ok')

const server = createServer(app, { port: 3000 })
await server.listen()
```

`AppOptions` extends H3's `H3Config`, so native H3 configuration can be passed
to `createApp()`. H3 app plugins belong in the first argument to
`createServer()`; srvx server plugins belong in the second argument. Katro
re-exports H3's `definePlugin()` for convenience. See the
[H3 plugin guide](https://h3.dev/guide/advanced/plugins) for plugin behavior.

## Common Use Cases

### Test Runners

Start the server in suite setup, use its resolved URL for real HTTP requests,
and close it during teardown. The default random port avoids conflicts between
test workers:

```typescript
import { createServer } from 'katro'
import { afterAll, beforeAll, expect, it } from 'vitest'

const server = createServer({
  routes: {
    '/users': () => [{ id: 1, name: 'Alice' }]
  }
})

beforeAll(async () => {
  await server.listen()
})

afterAll(() => server.close())

it('serves users over HTTP', async () => {
  const response = await fetch(new URL('/users', server.url!))

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual([{ id: 1, name: 'Alice' }])
})
```

Jest uses the same `beforeAll()` and `afterAll()` pattern. With `node:test`,
use its `before()` and `after()` hooks. See the setup documentation for
[Vitest](https://vitest.dev/guide/learn/setup-teardown),
[Jest](https://jestjs.io/docs/setup-teardown), or
[`node:test`](https://nodejs.org/api/test.html).

### Mocking Backend APIs

Katro can simulate backend APIs over real HTTP. With Vite, mount the H3 app
directly into the development server's middleware stack so the frontend and
mock APIs share the same origin without another port or proxy.

Keep the routes and Vite integration in separate files:

```text
mock/
├── routes.ts
└── vite.ts
vite.config.ts
```

```typescript
// mock/routes.ts
import { defineRoutes } from 'katro'

export const routes = defineRoutes({
  '/users': () => [{ id: 1, name: 'Alice' }]
})
```

Create a small Vite plugin that converts the H3 app into Node middleware:

```typescript
// mock/vite.ts
import type { Plugin } from 'vite'

import { toNodeHandler } from 'h3/node'
import { createApp } from 'katro'

import { routes } from './routes'

export function katroMock(): Plugin {
  return {
    name: 'katro-mock',
    apply: 'serve',

    configureServer(viteServer) {
      const app = createApp({ routes })

      viteServer.middlewares.use('/api', toNodeHandler(app))
    }
  }
}
```

The Vite configuration only needs to enable the plugin:

```typescript
// vite.config.ts
import { defineConfig } from 'vite'

import { katroMock } from './mock/vite'

export default defineConfig({
  plugins: [katroMock()]
})
```

The frontend can now request `/api/users` from the Vite origin. Connect removes
the `/api` mount prefix before invoking H3, so the corresponding Katro route is
`/users`.

With Vite's default config loader, `mock/vite.ts` and its statically imported
`mock/routes.ts` are config dependencies. Changing either file restarts the
development server and creates a new H3 app. The `native` config loader does
not detect imported config dependencies; see
[Vite config loading](https://vite.dev/config/#config-loading).

`toNodeHandler()` comes from the
[H3 Node adapter](https://h3.dev/utils/more). With webpack-dev-server and other
tools, the same routes can instead be used with a standalone Katro server and
an HTTP proxy. See the
[webpack-dev-server proxy options](https://webpack.js.org/configuration/dev-server/#devserverproxy).

### Standalone and End-to-End Usage

Use a fixed port when Katro is consumed by Postman, mobile or desktop
applications, SDK tests, or CI jobs. End-to-end tools such as Playwright and
Cypress can start the Katro entry file as a dependent process and stop it
after the test run.

## Server Lifecycle

Creating a controller is synchronous and does not start listening. Pass srvx
options as the second argument when a fixed port or other runtime configuration
is needed:

```typescript
const server = createServer(appOrOptions, {
  hostname: '127.0.0.1',
  port: 3000
})
```

- Register routes, middleware, and plugins before calling `listen()`.
- `listen()` resolves with the same controller after the raw server is ready.
- `raw`, `port`, and `url` are available only while listening.
- Calling `listen()` while running throws; call `close()` before listening
  again.
- `close()` clears the runtime state. Create a new app and controller when app
  configuration changes.

## API

### `createServer(appOrOptions?, serverOptions?)`

Creates a server controller from an existing H3 app or declarative
`AppOptions`. The second argument accepts srvx options except `fetch` and
`manual`.

The controller exposes `app`, `raw`, `port`, `url`, `listen(port?)`, and
`close()`.

### `createApp(options?)`

Creates an H3 app from native H3 configuration plus declarative `routes` and
`middlewares`.

### Configuration Helpers

- `defineRoutes(routes)`: Type helper for standalone route definitions
- `defineMiddlewares(middlewares)`: Type helper for standalone middleware definitions
- `defineMiddleware`: Re-export from H3
- `definePlugin`: Re-export from H3

See [playground/server.ts](./playground/server.ts) for a larger working example.

## Related Projects

- [unjs/h3](https://github.com/unjs/h3) — Minimal HTTP framework
- [h3js/srvx](https://github.com/h3js/srvx) — Universal server runtime

## License

[MIT](./LICENSE) © 2025-PRESENT [king3](https://github.com/coderking3)
