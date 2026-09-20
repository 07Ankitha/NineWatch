import { config } from 'dotenv'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'

config()

function databaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set. Add it to .env (or the environment) before running migrations.')
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

function createClient(connectionString: string) {
  return new Client({
    connectionString,
    ssl: sslOption(connectionString),
  })
}

async function migrate() {
  const connectionString = databaseUrl()
  const client = createClient(connectionString)
  const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations')

  try {
    await client.connect()

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    const appliedResult = await client.query<{ filename: string }>(
      'SELECT filename FROM schema_migrations',
    )
    const applied = new Set(appliedResult.rows.map((row) => row.filename))

    const files = (await readdir(migrationsDir))
      .filter((name) => name.endsWith('.sql'))
      .sort()

    if (files.length === 0) {
      console.log('No .sql files found in db/migrations.')
      return
    }

    for (const filename of files) {
      if (applied.has(filename)) {
        console.log(`Skipped ${filename} (already applied)`)
        continue
      }

      const sql = await readFile(path.join(migrationsDir, filename), 'utf8')
      console.log(`Applying ${filename}...`)
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename])
      console.log(`Applied ${filename}`)
    }
  } finally {
    await client.end()
  }
}

migrate().catch((error) => {
  console.error('Migration failed:', error)
  process.exit(1)
})
