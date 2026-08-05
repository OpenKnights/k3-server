# AGENTS.md — Katro

## Project Overview

A lightweight, TypeScript-first library built on
[unjs/h3](https://github.com/unjs/h3) for quickly creating HTTP servers.

## Tech Stack

- **Language**: TypeScript (strict mode, ESNext target)
- **HTTP Framework**: h3 v2.0.1-rc.26
- **Server Runtime**: srvx v0.12
- **Package Manager**: pnpm
- **Build**: tsdown (outputs ESM + CJS + d.ts to `dist/`)
- **Test**: Vitest
- **Lint**: ESLint (`@king-3/eslint-config`)
- **Format**: Prettier (`@king-3/prettier-config`)
- **Package**: ESM-first (`"type": "module"`), dual format exports

## Commands

- `pnpm test` — Run the Vitest suite once
- `pnpm typecheck` — Run TypeScript without emitting files
- `pnpm build` — Build via tsdown
- `pnpm lint` / `pnpm lint:fix` — Lint
- `pnpm format` — Format with prettier
- `pnpm play` — Run the playground on port 3080
- `pnpm play --port <port>` — Run the playground on a custom port
- `pnpm release` — Version bump via bumpp

After changing runtime code or public types, run `pnpm typecheck`, `pnpm test`,
`pnpm lint`, and `pnpm build`. Run typecheck before build because the build
cleans and recreates `dist/`. For documentation-only changes, run Prettier
checking and `git diff --check`.

## Project Structure

```
src/
  index.ts        — Public API exports
  server.ts       — createApp(), createServer()
  routes.ts       — defineRoutes(), parseRoutes(), registerRoutes()
  middlewares.ts  — defineMiddlewares(), parseMiddlewares(), registerMiddlewares()
  util.ts         — joinPaths() and type guards
  constants.ts    — H3 HTTP methods, ALL, and the default GET method
types/            — TypeScript type definitions (routes, middlewares, server)
test/             — Vitest test files mirroring src/ modules
playground/
  server.ts       — Runnable example and manual integration check
tsdown.config.ts  — ESM, CJS, and declaration build configuration
README.md         — Concise English usage guide
README_zh.md      — Concise Chinese usage guide
```

## Path Aliases

- `#/*` → project root (`./`)
- `#types/*` → `./types/*`

Configured in both `tsconfig.json` and `package.json` imports.

## Architecture & Conventions

- Routes and middlewares follow a **define → parse → register** pattern (e.g., `defineRoutes` → `parseRoutes` → `registerRoutes`)
- Direct route handlers register as GET; use an `ALL` method entry for handlers that match every HTTP method
- Routes support nesting via `children`, every HTTP method exposed by H3, and flattened H3 route options
- Middlewares support global, route-specific, and method-restricted scopes
- `createApp()` accepts native H3 config plus declarative routes and middlewares; H3 registers config plugins during construction
- `createServer()` accepts an existing H3 app or declarative app options as its first argument and srvx server options as its second argument
- `ServerOptions` excludes `fetch` and `manual`; both keys are also removed at runtime in case callers bypass the TypeScript type
- The default hostname is `127.0.0.1` and the default port is `0`, allowing the operating system to select an available port
- `createServer()` returns a synchronous `Server` object with `listen()` and `close()` for lifecycle management
- `listen()` returns the same `Server` controller after the underlying srvx server is ready
- Repeated `listen()` calls throw while the server is running; close it before listening again
- `raw`, `port`, and `url` are undefined before listening and are reset after a successful close
- Register H3 routes, middleware, and plugins before `listen()`; H3 freezes the app when serving starts
- H3 plugins run when the app is created; srvx plugins run whenever a new raw server is created by `listen()`
- There is no `restart()` API. Host integrations that reload app configuration must close the old controller and create a new app and server
- srvx 0.12.4 adds graceful-shutdown process listeners per raw server and does not remove them on close. Integrations that recreate servers, such as a Vite plugin, should use `gracefulShutdown: false` and let the host own process signals

## Coding Style

- Use `type` imports for type-only imports (`import type ...`)
- Prefer functional style; avoid classes
- Keep modules small and focused on a single responsibility
- Treat `defineRoutes()` and `defineMiddlewares()` as identity helpers for type-safe standalone configuration
- Re-export H3's `defineMiddleware()` and `definePlugin()` directly for convenience
- Keep H3-specific handler and route option types aligned with the installed H3 version
- Preserve the separation between H3 app options and srvx server options
- Keep `README.md` and `README_zh.md` synchronized, concise, and focused on public usage; do not duplicate generated type declarations or document internal parse/register helpers in detail

## Git Workflow

- Main branch: `main`
- Commit messages: use conventional commits with emoji prefixes (e.g., `♻️ refactor:`, `chore:`)
