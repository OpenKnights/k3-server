/* eslint-disable no-console */
import { parseArgs } from 'node:util'

import {
  defineMiddleware,
  getQuery,
  getRouterParam,
  readBody,
  redirect
} from 'h3'

import {
  createApp,
  createServer,
  defineMiddlewares,
  definePlugin,
  defineRoutes
} from '../src'

const { values } = parseArgs({
  options: {
    port: {
      type: 'string',
      short: 'p',
      default: '3080'
    }
  }
})

const PORT = Number(values.port)

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65_535) {
  throw new Error(`Invalid port: ${values.port}`)
}

const requestLogger = defineMiddleware(async (event, next) => {
  const startedAt = performance.now()
  const response = await next()
  const duration = Math.round(performance.now() - startedAt)

  console.log(
    `${event.req.method} ${event.url.pathname} completed in ${duration}ms`
  )

  return response
})

const middlewares = defineMiddlewares([
  requestLogger,
  {
    route: '/api/**',
    handler: (event) => {
      console.log(`API request: ${event.req.method} ${event.url.pathname}`)
    },
    options: {
      method: 'POST'
    }
  }
])

const playgroundPlugin = definePlugin((app) => {
  app.get('/plugin', () => ({
    message: 'This route was registered by an H3 plugin.'
  }))
})()

const routes = defineRoutes({
  // A direct handler is registered as GET by default.
  '/': () => ({
    name: 'k3-server playground',
    endpoints: [
      'GET /api/hello',
      'POST /api/hello',
      'GET /api/users/:id?active=true',
      'GET /redirect',
      'ANY /all',
      'GET /plugin',
      'GET /h3'
    ]
  }),

  '/api': {
    children: {
      '/hello': {
        GET: () => ({
          message: 'Hello world!'
        }),

        // H3 route options are placed alongside the handler.
        POST: {
          handler: async (event) => ({
            message: 'Request body received.',
            body: await readBody(event)
          }),
          meta: {
            name: 'create-hello'
          },
          middleware: [
            () => {
              console.log('Route middleware: POST /api/hello')
            }
          ]
        }
      },

      // A nested direct handler also defaults to GET.
      '/users/:id': (event) => ({
        id: getRouterParam(event, 'id'),
        query: getQuery(event)
      })
    }
  },

  '/redirect': () => redirect('/api/hello'),

  // ALL explicitly matches every HTTP method.
  '/all': {
    ALL: (event) => ({
      method: event.req.method,
      message: 'This route accepts every HTTP method.'
    })
  }
})

const app = createApp({
  routes,
  middlewares,
  plugins: [playgroundPlugin]
})

// The configured API and the native H3 API can be used together before listen().
app.get('/h3', () => ({
  message: 'This route was registered directly through the H3 app.'
}))

const server = await createServer(app, {
  hostname: '127.0.0.1',
  port: PORT,
  silent: true
}).listen()

const ansi = {
  reset: '\u001B[0m',
  bold: '\u001B[1m',
  dim: '\u001B[2m',
  green: '\u001B[32m',
  yellow: '\u001B[33m',
  magenta: '\u001B[35m',
  cyan: '\u001B[36m'
}

const method = (name: string, color: string) =>
  `${ansi.bold}${color}${name.padEnd(5)}${ansi.reset}`

console.log(`
${ansi.bold}${ansi.green}╭─ k3-server playground${ansi.reset}
${ansi.green}│${ansi.reset}  ${ansi.dim}Listening on${ansi.reset}  ${ansi.cyan}${server.url}${ansi.reset}
${ansi.green}╰─ Ready${ansi.reset}

${ansi.bold}${ansi.yellow}Try these commands${ansi.reset}
  ${method('GET', ansi.green)} curl -s http://127.0.0.1:${PORT}/ | jq
  ${method('GET', ansi.green)} curl -s http://127.0.0.1:${PORT}/api/hello | jq
  ${method('POST', ansi.yellow)} curl -s -X POST -H "content-type: application/json" -d '{"name":"king3"}' http://127.0.0.1:${PORT}/api/hello | jq
  ${method('GET', ansi.green)} curl -s "http://127.0.0.1:${PORT}/api/users/123?active=true" | jq
  ${method('PATCH', ansi.magenta)} curl -s -X PATCH http://127.0.0.1:${PORT}/all | jq
  ${method('GET', ansi.green)} curl -s http://127.0.0.1:${PORT}/plugin | jq
  ${method('GET', ansi.green)} curl -s http://127.0.0.1:${PORT}/h3 | jq
`)
