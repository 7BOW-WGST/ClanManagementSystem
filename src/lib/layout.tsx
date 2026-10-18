import type { FC, PropsWithChildren } from 'hono/jsx'
import type { Role } from './role'

// Top-level navigation entries (extended as new domains are added).
const navItems = [
  { href: '/members', label: 'Members' },
  { href: '/accounts', label: 'Accounts' },
]

// Shared page shell (Bootstrap 5 via CDN).
export const Layout: FC<PropsWithChildren<{ title: string; role: Role; flash?: string }>> = (props) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{props.title} · Clan Management System</title>
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
      />
    </head>
    <body>
      <nav class="navbar navbar-expand bg-dark" data-bs-theme="dark">
        <div class="container">
          <a class="navbar-brand" href="/">Clan Management System</a>
          {navItems.map((item) => (
            <a class="nav-link text-light" href={item.href}>
              {item.label}
            </a>
          ))}
          <span class="navbar-text ms-auto">role: {props.role}</span>
        </div>
      </nav>
      <main class="container py-4">
        {props.flash ? <div class="alert alert-success">{props.flash}</div> : null}
        {props.children}
      </main>
    </body>
  </html>
)
