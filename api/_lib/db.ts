import { neon, neonConfig, Pool } from '@neondatabase/serverless'

if (typeof WebSocket !== 'undefined') {
  neonConfig.webSocketConstructor = WebSocket
}

let pool: Pool | undefined

function databaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL is not set. Add it to the environment before querying the database.')
  }
  return url
}

export function getDb() {
  return neon(databaseUrl())
}

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: databaseUrl() })
    pool.on('error', (error: Error) => {
      console.error('Unexpected database pool error:', error)
    })
  }
  return pool
}
