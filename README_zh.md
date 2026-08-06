# Kaivo

> 一个基于 [unjs/h3](https://github.com/unjs/h3) 构建的轻量级 TypeScript 工具库，用于快速创建 HTTP 服务。

[![npm version](https://img.shields.io/npm/v/kaivo.svg)](https://www.npmjs.com/package/kaivo)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[English](./README.md) | [中文](./README_zh.md)

## 特性

- 使用少量配置启动真实 HTTP 服务
- 通过声明式配置定义嵌套路由和不同 HTTP 方法
- 通过声明式配置注册 middleware
- 控制 Server 生命周期，默认使用可用的随机端口
- 使用原生 H3 Handler，并在需要时访问底层 H3 App

## 安装

```bash
npm install kaivo
```

Kaivo 仅提供 ESM 构建，需要 Node.js 20.16 或更高版本。

## 快速开始

```typescript
import { createServer } from 'kaivo'

const server = createServer({
  routes: {
    '/hello': () => ({ message: '你好！' })
  }
})

await server.listen()

console.log(`服务运行于 ${server.url}`)
```

服务默认使用端口 `0`，由操作系统分配可用端口。实际地址和端口可以通过
`server.url` 和 `server.port` 获取。嵌入应用或测试不再需要服务时，应调用
`server.close()`。

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
import { createServer } from 'kaivo'

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

单独定义 routes 时，可以使用 `defineRoutes()` 获得类型推导。H3 路由选项可以
直接与 `handler` 平级：

```typescript
import { defineRoutes } from 'kaivo'

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

直接写在 `createServer()` 或 `createApp()` 中的 routes 已经具备类型提示。
路由匹配行为可以参考 [H3 Routing 文档](https://h3.dev/guide/basics/routing)。

## 中间件

可以直接传入 middleware，也可以为其指定路径和 H3 middleware options：

```typescript
import { createServer, defineMiddleware, defineMiddlewares } from 'kaivo'

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

middleware 按注册顺序执行。仅属于单个路由的逻辑可以与 route handler
放在一起：

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

Kaivo 重新导出了 H3 的 `defineMiddleware()`。middleware 执行语义和生命周期
工具可以参考 [H3 Middleware 文档](https://h3.dev/guide/basics/middleware)。

## H3 集成

Kaivo 的 route handler 就是原生 H3 handler，可以返回 JavaScript 值或 Web
`Response`，也可以直接使用 H3 工具：

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

请求解析、响应转换、错误、Cookie、CORS、重定向、Stream、代理、SSE 和
WebSocket 都属于 H3 或 Web 平台能力，可以直接参考 H3 文档：

- [请求工具](https://h3.dev/utils/request)
- [返回响应](https://h3.dev/guide/basics/response)
- [错误处理](https://h3.dev/guide/basics/error)
- [H3 Utilities](https://h3.dev/utils)

可以通过 `server.app` 访问 H3 App。在开始监听前，声明式配置和 H3 原生 API
可以同时使用：

```typescript
import { createApp, createServer } from 'kaivo'

const app = createApp({
  routes: {
    '/hello': () => '你好！'
  }
})

app.get('/health', () => 'ok')

const server = createServer(app, { port: 3000 })
await server.listen()
```

`AppOptions` 扩展自 H3 的 `H3Config`，因此可以向 `createApp()` 传入 H3 原生
配置。`createServer()` 第一个参数中的 plugins 属于 H3 App，第二个参数中的
plugins 属于 srvx Server。Kaivo 重新导出了 H3 的 `definePlugin()`，插件行为
可以参考 [H3 Plugins 文档](https://h3.dev/guide/advanced/plugins)。

## 常见使用场景

### 测试框架

在测试套件初始化时启动 Server，通过解析出的 URL 发起真实 HTTP 请求，并在
测试结束后关闭。默认随机端口可以避免不同测试进程之间发生端口冲突：

```typescript
import { createServer } from 'kaivo'
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

it('通过 HTTP 返回用户列表', async () => {
  const response = await fetch(new URL('/users', server.url!))

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual([{ id: 1, name: 'Alice' }])
})
```

Jest 可以使用相同的 `beforeAll()` 和 `afterAll()` 模式；使用 `node:test` 时，
改用对应的 `before()` 和 `after()`。具体生命周期可以参考
[Vitest](https://vitest.dev/guide/learn/setup-teardown)、
[Jest](https://jestjs.io/docs/setup-teardown) 或
[`node:test`](https://nodejs.org/api/test.html) 文档。

### 模拟后端接口

Kaivo 可以通过真实 HTTP 模拟后端接口。在 Vite 中，可以将 H3 App 直接挂载到
开发服务器的 middleware 链，让前端页面与 Mock API 共享同一个来源，无需额外
端口或 Proxy。

将路由和 Vite 集成分别放在独立文件中：

```text
mock/
├── routes.ts
└── vite.ts
vite.config.ts
```

```typescript
// mock/routes.ts
import { defineRoutes } from 'kaivo'

export const routes = defineRoutes({
  '/users': () => [{ id: 1, name: 'Alice' }]
})
```

创建一个小型 Vite 插件，将 H3 App 转换为 Node middleware：

```typescript
// mock/vite.ts
import type { Plugin } from 'vite'

import { toNodeHandler } from 'h3/node'
import { createApp } from 'kaivo'

import { routes } from './routes'

export function kaivoMock(): Plugin {
  return {
    name: 'kaivo-mock',
    apply: 'serve',

    configureServer(viteServer) {
      const app = createApp({ routes })

      viteServer.middlewares.use('/api', toNodeHandler(app))
    }
  }
}
```

Vite 配置只需要启用该插件：

```typescript
// vite.config.ts
import { defineConfig } from 'vite'

import { kaivoMock } from './mock/vite'

export default defineConfig({
  plugins: [kaivoMock()]
})
```

前端现在可以直接通过 Vite 地址请求 `/api/users`。Connect 会在调用 H3 前移除
挂载路径 `/api`，因此对应的 Kaivo route 是 `/users`。

使用 Vite 默认配置加载器时，`mock/vite.ts` 及其静态导入的 `mock/routes.ts`
都会成为配置依赖。修改任一文件都会重启开发服务器并创建新的 H3 App。
`native` 配置加载器不会检测配置导入文件的变化，具体可以参考
[Vite 配置加载文档](https://vite.dev/config/#config-loading)。

`toNodeHandler()` 来自
[H3 Node adapter](https://h3.dev/utils/more)。对于 webpack-dev-server 和其他
工具，也可以将相同 routes 用于独立 Kaivo Server，再通过 HTTP Proxy 访问。
具体可以参考
[webpack-dev-server Proxy 配置](https://webpack.js.org/configuration/dev-server/#devserverproxy)。

### 独立服务与端到端测试

当 Postman、移动端或桌面端应用、SDK 测试或 CI 任务需要访问 Kaivo 时，可以
为其配置固定端口。Playwright、Cypress 等端到端测试工具也可以将 Kaivo 入口
文件作为依赖进程启动，并在测试结束后关闭。

## Server 生命周期

创建 controller 是同步操作，并不会立即开始监听。需要固定端口或其他运行时
配置时，将 srvx options 作为第二个参数传入：

```typescript
const server = createServer(appOrOptions, {
  hostname: '127.0.0.1',
  port: 3000
})
```

- 在调用 `listen()` 前注册 routes、middleware 和 plugins。
- `listen()` 会在底层 Server 准备完成后返回同一个 controller。
- `raw`、`port` 和 `url` 只在监听期间可用。
- 服务运行时重复调用 `listen()` 会抛出错误；需要先调用 `close()`。
- `close()` 会清理运行时状态。应用配置变化时，应创建新的 App 和 controller。

## API

### `createServer(appOrOptions?, serverOptions?)`

使用已有 H3 App 或声明式 `AppOptions` 创建 Server controller。第二个参数接受
除 `fetch` 和 `manual` 外的 srvx options。

controller 包含 `app`、`raw`、`port`、`url`、`listen(port?)` 和 `close()`。

### `createApp(options?)`

使用 H3 原生配置以及声明式 `routes`、`middlewares` 创建 H3 App。

### 配置辅助函数

- `defineRoutes(routes)`：为单独定义的 routes 提供类型提示
- `defineMiddlewares(middlewares)`：为单独定义的 middlewares 提供类型提示
- `defineMiddleware`：从 H3 重新导出
- `definePlugin`：从 H3 重新导出

更完整的实际用法可以参考 [playground/server.ts](./playground/server.ts)。

## 相关项目

- [unjs/h3](https://github.com/unjs/h3) — 轻量级 HTTP 框架
- [h3js/srvx](https://github.com/h3js/srvx) — 通用 Server runtime

## 许可证

[MIT](./LICENSE) © 2025-至今 [king3](https://github.com/coderking3)
