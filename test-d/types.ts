import type { Routes } from '#types/routes'

export const routes: Routes = { '/valid': { GET: () => 'ok' } }

// @ts-expect-error - A route config must define a method or children.
export const emptyRoutes: Routes = { '/empty': {} }
