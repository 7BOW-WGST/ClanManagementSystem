import { Hono } from 'hono'

export const app = new Hono()

app.get('/', (c) =>
  c.html(
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Clan Management System</title>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
        />
      </head>
      <body>
        <main class="container py-4">
          <h1 class="h3">Clan Management System</h1>
          <p class="text-muted mb-0">Phase 1 skeleton. The members module comes next.</p>
        </main>
      </body>
    </html>,
  ),
)
