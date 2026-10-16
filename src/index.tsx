import { app } from './app'
import { config } from './config'
import { closeDb } from './db'

const server = Bun.serve({
  hostname: config.host,
  port: config.port,
  fetch: app.fetch,
})

console.log(`Listening on http://${config.host}:${config.port}`)

async function shutdown(): Promise<void> {
  await server.stop()
  await closeDb()
  process.exit(0)
}

process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())
