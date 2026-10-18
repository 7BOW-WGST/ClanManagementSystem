import { Hono } from 'hono'
import { setCookie } from 'hono/cookie'
import { accountRoutes } from './accounts/routes'
import { awardRoutes } from './awards/routes'
import { sameSiteGuard } from './lib/middleware'
import { isRole } from './lib/role'
import { memberRoutes } from './members/routes'
import { rankRoutes } from './ranks/routes'
import { sectionRoutes } from './sections/routes'

// Create a new Hono application/router instance
export const app = new Hono()

// Apply shared middleware to every route.
app.use('*', sameSiteGuard)

// Health check (no database access).
app.get('/health', (c) => c.text('ok'))

// Home redirects to the members list.
app.get('/', (c) => c.redirect('/members'))

// Dev-only role switcher: sets the role cookie read by currentRole.
app.get('/dev/role/:role', (c) => {
  if (process.env.DEV_ROLE_SELECTOR !== 'true') {
    return c.notFound()
  }
  const role = c.req.param('role')
  if (!isRole(role)) {
    return c.text('Unknown role', 400)
  }
  setCookie(c, 'role', role, { httpOnly: true, sameSite: 'Lax', path: '/' })
  return c.redirect('/members')
})

// Domain routers.
app.route('/', memberRoutes)
app.route('/', accountRoutes)
app.route('/', sectionRoutes)
app.route('/', rankRoutes)
app.route('/', awardRoutes)
