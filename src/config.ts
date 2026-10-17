// Validate environment variables before starting the application.

// Validate the DATABASE_URL environment variable.
function resolveDatabaseUrl(value: string | undefined): string {
  // Check if the value is undefined or empty.
  if (!value) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env and set it.')
  }

  // Check if the value is a valid URL.
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error('DATABASE_URL is not a valid URL.')
  }

  // Check if the URL uses the postgres scheme.
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL must use the postgres:// or postgresql:// scheme.')
  }

  return value
}

// Validate the PORT environment variable.
function resolvePort(value: string | undefined): number {
  // If the value is undefined, use the default port 3000.
  const port = Number(value ?? 3000)

  // Check if the port is a valid integer between 1 and 65535.
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be an integer between 1 and 65535 (got "${value}").`)
  }
  return port
}

// Export config object with validated environment variables.
export const config = {
  databaseUrl: resolveDatabaseUrl(process.env.DATABASE_URL),
  host: process.env.HOST ?? '127.0.0.1',
  port: resolvePort(process.env.PORT),
  devRoleSelector: process.env.DEV_ROLE_SELECTOR === 'true',
} as const
