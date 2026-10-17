// Role handling for the local prototype (see DECISIONS X1/X4).

import type { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'

export const roles = ['owner', 'admin', 'member'] as const
export type Role = (typeof roles)[number]

// Type guard narrowing a string to a known role.
export function isRole(value: string | undefined): value is Role {
  return value !== undefined && roles.some((role) => role === value)
}

// Read the current role. There is no authentication yet: when the dev selector is enabled the
// role comes from a cookie, otherwise it defaults to owner (pre-auth prototype). The env is read
// directly (not via config) so the app stays importable without a database.
export function currentRole(c: Context): Role {
  if (process.env.DEV_ROLE_SELECTOR !== 'true') {
    return 'owner'
  }
  const value = getCookie(c, 'role')
  return isRole(value) ? value : 'owner'
}

// Guard a route so only the allowed roles may proceed.
export function requireRole(...allowed: Role[]) {
  return async (c: Context, next: Next): Promise<Response | void> => {
    const role = currentRole(c)
    if (!allowed.includes(role)) {
      return c.text('Forbidden', 403)
    }
    await next()
  }
}
