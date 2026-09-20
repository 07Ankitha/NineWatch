import { config } from 'dotenv'
import { Client } from 'pg'

config()

function databaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set. Add it to .env (or the environment) before resetting.')
    process.exit(1)
  }
  return url
}

function sslOption(connectionString: string) {
  const lower = connectionString.toLowerCase()
  if (lower.includes('sslmode=require') || lower.includes('neon.tech')) {
    return { rejectUnauthorized: false }
  }
  return undefined
}

async function reset() {
  if (process.env.ALLOW_RESET !== 'true') {
    console.error('Refusing to reset: set ALLOW_RESET=true to drop development schema objects.')
    process.exit(1)
  }

  const connectionString = databaseUrl()
  const client = new Client({
    connectionString,
    ssl: sslOption(connectionString),
  })

  try {
    await client.connect()
    await client.query(`
      DROP TABLE IF EXISTS checks, data_issues, uploads, schema_migrations
    `)
    console.log('Dropped public schema objects: checks, data_issues, uploads, schema_migrations.')
  } finally {
    await client.end()
  }
}

reset().catch((error) => {
  console.error('Reset failed:', error)
  process.exit(1)
})
