import type { Context, Next } from 'hono'

// Reject cross-site POSTs during the prototype by comparing the Origin header to the Host.
// This is lightweight protection until real sessions/CSRF tokens arrive with authentication.
export async function sameSiteGuard(c: Context, next: Next): Promise<Response | void> {
  if (c.req.method === 'POST') {
    const origin = c.req.header('origin')
    if (origin) {
      let originHost = ''
      try {
        originHost = new URL(origin).host
      } catch {
        return c.text('Bad Request', 400)
      }
      if (originHost !== c.req.header('host')) {
        return c.text('Bad Request', 400)
      }
    }
  }
  await next()
}
