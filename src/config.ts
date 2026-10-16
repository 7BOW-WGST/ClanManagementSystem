function resolveDatabaseUrl(value: string | undefined): string {
  if (!value) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env and set it.')
  }

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error('DATABASE_URL is not a valid URL.')
  }

  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL must use the postgres:// or postgresql:// scheme.')
  }

  return value
}

function resolvePort(value: string | undefined): number {
  const port = Number(value ?? 3000)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be an integer between 1 and 65535 (got "${value}").`)
  }
  return port
}

export const config = {
  databaseUrl: resolveDatabaseUrl(process.env.DATABASE_URL),
  host: process.env.HOST ?? '127.0.0.1',
  port: resolvePort(process.env.PORT),
  devRoleSelector: process.env.DEV_ROLE_SELECTOR === 'true',
} as const
