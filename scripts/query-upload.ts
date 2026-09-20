import { config } from 'dotenv'
import { Client } from 'pg'

config()

const uploadId = Number(process.argv[2])
if (!Number.isFinite(uploadId)) {
  console.error('Usage: tsx scripts/query-upload.ts <uploadId>')
  process.exit(1)
}

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
  const upload = await client.query(
    `SELECT id, filename, status, rows_kept FROM uploads WHERE id = $1`,
    [uploadId],
  )
  const row = upload.rows[0]
  if (!row) {
    console.error(`No uploads row with id ${uploadId}`)
    process.exit(1)
  }
  const checks = await client.query(
    `SELECT COUNT(*)::int AS count FROM checks WHERE upload_id = $1`,
    [uploadId],
  )
  const issues = await client.query(
    `SELECT COUNT(*)::int AS count FROM data_issues WHERE upload_id = $1`,
    [uploadId],
  )
  const checksCount = checks.rows[0].count
  console.log(JSON.stringify({
    uploadId: row.id,
    filename: row.filename,
    status: row.status,
    rowsKept: row.rows_kept,
    checksCount,
    dataIssuesCount: issues.rows[0].count,
    checksEqualsRowsKept: checksCount === row.rows_kept,
  }, null, 2))
} finally {
  await client.end()
}
