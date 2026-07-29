# k3-server

> 一个由 [unjs/h3](https://github.com/unjs/h3) 驱动、用于快速创建 HTTP 服务的轻量级 TypeScript 工具库。

[![npm version](https://img.shields.io/npm/v/k3-server.svg)](https://www.npmjs.com/package/k3-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[English](./README.md) | [中文](./README_zh.md)

## 特性

- 使用少量配置启动真实 HTTP 服务
- 通过声明式配置定义嵌套路由和不同 HTTP 方法
- 需要时可以直接访问底层 H3 App 和 srvx Server

## 安装

```bash
npm install k3-server
```

k3-server 仅提供 ESM 构建，需要 Node.js 20.16 或更高版本。

## 快速开始

```typescript
import { createServer } from 'k3-server'

const server = createServer({
  routes: {
    '/hello': () => ({ message: '你好！' })
  }
})

await server.listen()

console.log(`服务运行于 ${server.url}`)

await server.close()
```

服务默认使用端口 `0`，由操作系统分配可用端口。实际地址和端口可以通过
`server.url` 和 `server.port` 获取。

需要固定端口或其他运行时配置时，将 srvx Server 配置作为第二个参数传入：

```typescript
const server = createServer(
  {
    routes: {
      '/hello': () => '你好！'
    }
  },
  {
    hostname: '127.0.0.1',
    port: 3000
  }
)
```

创建 controller 不会立即启动服务，只有调用 `listen()` 后才会开始监听。

## 路由

直接传入的路由处理函数默认响应 GET 请求：

```typescript
const server = createServer({
  routes: {
    '/ping': () => 'pong'
  }
})
```

使用方法名配置其他 HTTP 方法，使用 `ALL` 匹配全部方法，使用 `children`
组织嵌套路由：

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

H3 路由选项可以直接与 `handler` 平级：

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

`defineRoutes()` 是一个 identity helper，用于为单独定义的路由提供类型推导。
直接写在 `createServer()` 中的 routes 已经具备类型提示。

```typescript
import { defineRoutes } from 'k3-server'

const routes = defineRoutes({
  '/health': () => 'ok'
})
```

## H3 集成

可以通过 `server.app` 访问 H3 App，并在调用 `listen()` 前注册 H3 原生路由和
middleware：

```typescript
import { createServer } from 'k3-server'

const server = createServer()

server.app.get('/hello', () => 'Hello from H3')
server.app.post('/users', createUser)
server.app.use(requestLogger)

await server.listen()
```

声明式路由和 H3 原生 API 可以同时使用。

如果需要单独配置 App，或者将已有 H3 App 传给 `createServer()`，可以使用
`createApp()`：

```typescript
import { createApp, createServer } from 'k3-server'

const app = createApp({
  debug: true,
  routes: {
    '/hello': () => '你好！'
  }
})

app.get('/health', () => 'ok')

const server = createServer(app, { port: 3000 })
await server.listen()
```

`AppOptions` 扩展自 H3 原生 `H3Config`，因此可以直接传入 `plugins`、
`onRequest`、`onResponse` 和 `onError` 等 H3 配置。

## 中间件

可以直接传入 middleware，也可以为其指定路径和 H3 middleware options：

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

middleware 按注册顺序执行。仅属于单个路由的逻辑应使用 route middleware：

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

middleware 行为和生命周期工具可以参考
[H3 middleware 文档](https://h3.dev/guide/basics/middleware)。

## 插件

`definePlugin` 直接从 H3 重新导出：

```typescript
import { createServer, definePlugin } from 'k3-server'

const healthPlugin = definePlugin((app) => {
  app.get('/health', () => 'ok')
})()

const server = createServer({
  plugins: [healthPlugin]
})
```

第一个参数中的 plugins 是 H3 App plugins；第二个 `serverOptions` 参数中的
plugins 是 srvx Server plugins。

更多说明可以参考 [H3 plugin 文档](https://h3.dev/guide/advanced/plugins)。

## API

### `createServer(appOrOptions?, serverOptions?)`

创建同步 Server controller，但不会立即启动 HTTP 监听。

- `appOrOptions`：已有 H3 App 或声明式 `AppOptions`
- `serverOptions`：除 `fetch` 和 `manual` 外的 srvx 配置
- 默认端口：`0`
- 默认 hostname：`127.0.0.1`

返回的 controller 包含：

- `app`：H3 App
- `raw`：监听后创建的 srvx Server
- `port`：监听后解析出的实际端口
- `url`：监听后解析出的实际 URL
- `listen(port?)`：开始监听
- `close()`：停止监听并清理运行时状态

服务运行时重复调用 `listen()` 会抛出错误，需要先关闭服务再重新监听。

### `createApp(options?)`

使用 H3 原生配置以及声明式 `routes`、`middlewares` 创建 H3 App。

### 配置辅助函数

- `defineRoutes(routes)`：为单独定义的 routes 提供类型提示
- `defineMiddlewares(middlewares)`：为单独定义的 middlewares 提供类型提示
- `defineMiddleware`：从 H3 重新导出
- `definePlugin`：从 H3 重新导出

更完整的实际用法可以参考 [playground/server.ts](./playground/server.ts)。

## 注意事项

- 在调用 `listen()` 前注册 routes、middleware 和 plugins。
- 服务不再使用时应调用 `close()`。
- H3 App 初始化后不能继续添加路由。

## 相关项目

- [unjs/h3](https://github.com/unjs/h3) — 轻量级 HTTP 框架
- [h3js/srvx](https://github.com/h3js/srvx) — 通用 Server runtime

## 许可证

[MIT](./LICENSE) © 2025-至今 [king3](https://github.com/coderking3)
