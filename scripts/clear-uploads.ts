import { config } from 'dotenv'
import { Client } from 'pg'

config()

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const client = new Client({
  connectionString: url,
  ssl: url.toLowerCase().includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
})

await client.connect()
try {
  const before = await client.query(
    `SELECT COUNT(*)::int AS uploads FROM uploads`,
  )
  await client.query('DELETE FROM uploads')
  const after = await client.query(
    `SELECT
       (SELECT COUNT(*)::int FROM uploads) AS uploads,
       (SELECT COUNT(*)::int FROM checks) AS checks,
       (SELECT COUNT(*)::int FROM data_issues) AS data_issues`,
  )
  console.log(
    JSON.stringify(
      { deletedUploads: before.rows[0].uploads, remaining: after.rows[0] },
      null,
      2,
    ),
  )
} finally {
  await client.end()
}
