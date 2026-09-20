import type { PoolClient } from '@neondatabase/serverless'
import type { CleanCheck, CleaningIssue, CleaningResult } from './cleaning'
import { getPool } from './db'

const BATCH_SIZE = 1000

export type UploadRecord = {
  id: number
  filename: string
  status: 'processing' | 'completed' | 'failed'
  rowsReceived: number
  rowsKept: number
  rowsDropped: number
  dataStart: string | null
  dataEnd: string | null
}

export type UploadSummary = {
  rowsReceived: number
  rowsKept: number
  rowsDropped: number
  dataStart: string | null
  dataEnd: string | null
  issueCounts: Record<string, number>
}

export type SavedUpload = {
  alreadyProcessed: boolean
  uploadId: number
  filename: string
  summary: UploadSummary
}

type UploadRow = {
  id: string | number
  filename: string
  status: string
  rows_received: number
  rows_kept: number
  rows_dropped: number
  data_start: Date | string | null
  data_end: Date | string | null
}

type IssueCountRow = {
  issue_type: string
  occurrences: string | number
  aggregate_detail: string | null
}

function toId(value: string | number): number {
  return typeof value === 'number' ? value : Number(value)
}

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString()
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function mapUpload(row: UploadRow): UploadRecord {
  return {
    id: toId(row.id),
    filename: row.filename,
    status: row.status as UploadRecord['status'],
    rowsReceived: Number(row.rows_received),
    rowsKept: Number(row.rows_kept),
    rowsDropped: Number(row.rows_dropped),
    dataStart: toIso(row.data_start),
    dataEnd: toIso(row.data_end),
  }
}

function serializeSummary(result: CleaningResult): UploadSummary {
  return {
    rowsReceived: result.summary.rowsReceived,
    rowsKept: result.summary.rowsKept,
    rowsDropped: result.summary.rowsDropped,
    dataStart: toIso(result.summary.dataStart),
    dataEnd: toIso(result.summary.dataEnd),
    issueCounts: result.summary.issueCounts,
  }
}

function issueDetail(issue: CleaningIssue): string | null {
  if (issue.detail) return issue.detail
  if (issue.count == null) return null

  const n = issue.count
  switch (issue.issueType) {
    case 'unit_converted':
      return `${n} rows converted from seconds to milliseconds`
    case 'duplicate_row':
      return `${n} duplicate rows dropped`
    case 'timezone_normalized':
      return `${n} timestamps normalized to UTC`
    case 'epoch_converted':
      return `${n} epoch timestamps converted to UTC`
    case 'naive_timestamp_assumed_utc':
      return `${n} naive timestamps assumed UTC`
    default:
      return `${n} rows`
  }
}

function countFromGroupedIssue(occurrences: number, aggregateDetail: string | null): number {
  if (occurrences === 1 && aggregateDetail) {
    const match = /^(\d+)/.exec(aggregateDetail)
    if (match) return Number(match[1])
  }
  return occurrences
}

function isFileSha256Conflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const pgError = error as { code?: string; constraint?: string; detail?: string; message?: string }
  if (pgError.code !== '23505') return false
  const haystack = `${pgError.constraint ?? ''} ${pgError.detail ?? ''} ${pgError.message ?? ''}`
  return haystack.includes('file_sha256')
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size))
  }
  return batches
}

async function insertChecks(
  client: PoolClient,
  uploadId: number,
  checks: CleanCheck[],
): Promise<void> {
  for (const batch of chunk(checks, BATCH_SIZE)) {
    const values: unknown[] = []
    const placeholders: string[] = []
    let param = 1
    for (const row of batch) {
      placeholders.push(
        `($${param++}, $${param++}, $${param++}, $${param++}, $${param++}, $${param++}, $${param++}, $${param++}, $${param++})`,
      )
      values.push(
        uploadId,
        row.serviceId,
        row.serviceName,
        row.checkedAt.toISOString(),
        row.statusCode,
        row.isSuccess,
        row.latencyMs,
        row.agent,
        row.region,
      )
    }

    await client.query(
      `INSERT INTO checks (
         upload_id, service_id, service_name, checked_at, status_code,
         is_success, latency_ms, agent, region
       ) VALUES ${placeholders.join(', ')}`,
      values,
    )
  }
}

async function insertIssues(
  client: PoolClient,
  uploadId: number,
  issues: CleaningIssue[],
): Promise<void> {
  for (const batch of chunk(issues, BATCH_SIZE)) {
    const values: unknown[] = []
    const placeholders: string[] = []
    let param = 1
    for (const issue of batch) {
      placeholders.push(
        `($${param++}, $${param++}, $${param++}, $${param++}, $${param++}::jsonb, $${param++})`,
      )
      values.push(
        uploadId,
        issue.issueType,
        issue.action,
        issue.sourceRow ?? null,
        issue.rawRow === undefined ? null : JSON.stringify(issue.rawRow),
        issueDetail(issue),
      )
    }

    await client.query(
      `INSERT INTO data_issues (
         upload_id, issue_type, action, source_row, raw_row, detail
       ) VALUES ${placeholders.join(', ')}`,
      values,
    )
  }
}

async function insertUpload(
  client: PoolClient,
  filename: string,
  fileSha256: string,
  rowsReceived: number,
): Promise<number> {
  const result = await client.query<{ id: string | number }>(
    `INSERT INTO uploads (filename, file_sha256, status, rows_received)
     VALUES ($1, $2, 'processing', $3)
     RETURNING id`,
    [filename, fileSha256, rowsReceived],
  )
  return toId(result.rows[0].id)
}

export async function findUploadByHash(fileSha256: string): Promise<UploadRecord | null> {
  const result = await getPool().query<UploadRow>(
    `SELECT id, filename, status, rows_received, rows_kept, rows_dropped, data_start, data_end
     FROM uploads
     WHERE file_sha256 = $1`,
    [fileSha256],
  )
  const row = result.rows[0]
  return row ? mapUpload(row) : null
}

export async function deleteUpload(uploadId: number): Promise<void> {
  await getPool().query('DELETE FROM uploads WHERE id = $1', [uploadId])
}

export async function getUploadSummary(uploadId: number): Promise<UploadSummary | null> {
  const pool = getPool()
  const uploadResult = await pool.query<UploadRow>(
    `SELECT id, filename, status, rows_received, rows_kept, rows_dropped, data_start, data_end
     FROM uploads
     WHERE id = $1`,
    [uploadId],
  )
  const upload = uploadResult.rows[0]
  if (!upload) return null

  const issueResult = await pool.query<IssueCountRow>(
    `SELECT
       issue_type,
       COUNT(*)::int AS occurrences,
       MAX(detail) FILTER (WHERE source_row IS NULL) AS aggregate_detail
     FROM data_issues
     WHERE upload_id = $1
     GROUP BY issue_type`,
    [uploadId],
  )

  const issueCounts: Record<string, number> = {}
  for (const row of issueResult.rows) {
    issueCounts[row.issue_type] = countFromGroupedIssue(
      Number(row.occurrences),
      row.aggregate_detail,
    )
  }

  return {
    rowsReceived: Number(upload.rows_received),
    rowsKept: Number(upload.rows_kept),
    rowsDropped: Number(upload.rows_dropped),
    dataStart: toIso(upload.data_start),
    dataEnd: toIso(upload.data_end),
    issueCounts,
  }
}

async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    try {
      const value = await fn(client)
      await client.query('COMMIT')
      return value
    } catch (error) {
      try {
        await client.query('ROLLBACK')
      } catch (rollbackError) {
        console.error('Failed to roll back upload transaction:', rollbackError)
      }
      throw error
    }
  } finally {
    client.release()
  }
}

export async function saveCleanResult(options: {
  filename: string
  fileSha256: string
  result: CleaningResult
}): Promise<SavedUpload> {
  const { filename, fileSha256, result } = options
  const summary = serializeSummary(result)

  try {
    return await withTransaction(async (client) => {
      const uploadId = await insertUpload(
        client,
        filename,
        fileSha256,
        result.summary.rowsReceived,
      )
      await insertChecks(client, uploadId, result.checks)
      await insertIssues(client, uploadId, result.issues)
      await client.query(
        `UPDATE uploads
         SET status = 'completed',
             rows_kept = $2,
             rows_dropped = $3,
             data_start = $4,
             data_end = $5
         WHERE id = $1`,
        [
          uploadId,
          result.summary.rowsKept,
          result.summary.rowsDropped,
          summary.dataStart,
          summary.dataEnd,
        ],
      )
      return {
        alreadyProcessed: false,
        uploadId,
        filename,
        summary,
      }
    })
  } catch (error) {
    if (isFileSha256Conflict(error)) {
      const existing = await findUploadByHash(fileSha256)
      if (existing?.status === 'completed') {
        const existingSummary = await getUploadSummary(existing.id)
        if (existingSummary) {
          return {
            alreadyProcessed: true,
            uploadId: existing.id,
            filename: existing.filename,
            summary: existingSummary,
          }
        }
      }
    }
    throw error
  }
}
