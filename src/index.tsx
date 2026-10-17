import { app } from './app'
import { config } from './config'
import { closeDb } from './db'

// Start the Bun HTTP server
const server = Bun.serve({
  hostname: config.host,
  port: config.port,
  fetch: app.fetch, // Hono app handles incoming requests
})

console.log(`Listening on http://${config.host}:${config.port}`) // Log the server URL to the console (startup log)

// Graceful shutdown routine
async function shutdown(): Promise<void> {
  await server.stop()
  await closeDb()
  process.exit(0)
}

process.on('SIGINT', () => void shutdown()) // Ctrl+C
process.on('SIGTERM', () => void shutdown()) // Service / OS termination signal
