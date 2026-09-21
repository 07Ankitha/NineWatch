import { getDb } from './db'
import { toNumber, toNumberOrNull } from './stats'

export const DEFAULT_PAGE = 1
export const DEFAULT_PAGE_SIZE = 50
export const MAX_PAGE_SIZE = 200

export type LogsQuery = {
  uploadId: number | undefined
  from: string | null
  to: string | null
  service: string | null
  failuresOnly: boolean
  page: number
  pageSize: number
}

export type ParseLogsQueryResult =
  | { ok: true; value: LogsQuery }
  | { ok: false; error: string }

export type LogsUpload = {
  id: number
  filename: string
  dataStart: string | null
  dataEnd: string | null
}

export type LogsRow = {
  id: number
  serviceId: string
  serviceName: string
  checkedAt: string
  statusCode: number
  isSuccess: boolean
  latencyMs: number | null
  agent: string
  region: string
}

export type LogsResponse = {
  upload: LogsUpload
  filters: {
    from: string | null
    to: string | null
    service: string | null
    failuresOnly: boolean
  }
  rows: LogsRow[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type GetLogsResult =
  | { status: 'empty' }
  | { status: 'not_found' }
  | { status: 'ok'; body: LogsResponse }

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export function parseUtcDateString(raw: string): string | null {
  const match = DATE_RE.exec(raw)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function utcExclusiveRange(
  fromDay: string,
  toDay: string,
): { start: Date; endExclusive: Date } {
  const from = parseUtcDateString(fromDay)
  const to = parseUtcDateString(toDay)
  if (!from || !to) {
    throw new Error('utcExclusiveRange requires valid YYYY-MM-DD dates')
  }
  const start = new Date(`${from}T00:00:00.000Z`)
  const toDate = new Date(`${to}T00:00:00.000Z`)
  const endExclusive = new Date(toDate.getTime() + 24 * 60 * 60 * 1000)
  return { start, endExclusive }
}

function parsePositiveInt(raw: string | null, fallback: number): number | 'invalid' {
  if (raw == null || raw === '') return fallback
  if (!/^\d+$/.test(raw)) return 'invalid'
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < 1) return 'invalid'
  return value
}

function parseOptionalUploadId(raw: string | null): number | undefined | 'invalid' {
  if (raw == null || raw === '') return undefined
  if (!/^\d+$/.test(raw)) return 'invalid'
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value <= 0) return 'invalid'
  return value
}

function parseFailuresOnly(raw: string | null): boolean | 'invalid' {
  if (raw == null || raw === '') return false
  const normalized = raw.toLowerCase()
  if (normalized === 'true') return true
  if (normalized === 'false') return false
  return 'invalid'
}

export function parseLogsQuery(input: string | URL): ParseLogsQueryResult {
  const url = input instanceof URL ? input : new URL(input, 'http://localhost')
  const params = url.searchParams

  const uploadId = parseOptionalUploadId(params.get('uploadId'))
  if (uploadId === 'invalid') {
    return { ok: false, error: 'uploadId must be a number' }
  }

  const dateRaw = params.get('date')?.trim() || null
  const fromRaw = params.get('from')?.trim() || null
  const toRaw = params.get('to')?.trim() || null

  let from: string | null = null
  let to: string | null = null

  if (dateRaw) {
    const date = parseUtcDateString(dateRaw)
    if (!date) {
      if (!DATE_RE.test(dateRaw)) {
        return { ok: false, error: 'date must be YYYY-MM-DD' }
      }
      return { ok: false, error: `${dateRaw} is not a valid calendar date` }
    }
    from = date
    to = date
  } else {
    if (fromRaw) {
      const parsedFrom = parseUtcDateString(fromRaw)
      if (!parsedFrom) {
        if (!DATE_RE.test(fromRaw)) {
          return { ok: false, error: 'from must be YYYY-MM-DD' }
        }
        return { ok: false, error: `${fromRaw} is not a valid calendar date` }
      }
      from = parsedFrom
    }
    if (toRaw) {
      const parsedTo = parseUtcDateString(toRaw)
      if (!parsedTo) {
        if (!DATE_RE.test(toRaw)) {
          return { ok: false, error: 'to must be YYYY-MM-DD' }
        }
        return { ok: false, error: `${toRaw} is not a valid calendar date` }
      }
      to = parsedTo
    }
    if (from && to && from > to) {
      return { ok: false, error: 'from must be on or before to' }
    }
  }

  const page = parsePositiveInt(params.get('page'), DEFAULT_PAGE)
  if (page === 'invalid') {
    return { ok: false, error: 'page must be a positive integer' }
  }

  const pageSizeRaw = parsePositiveInt(params.get('pageSize'), DEFAULT_PAGE_SIZE)
  if (pageSizeRaw === 'invalid') {
    return { ok: false, error: 'pageSize must be a positive integer' }
  }
  const pageSize = Math.min(pageSizeRaw, MAX_PAGE_SIZE)

  const failuresOnly = parseFailuresOnly(params.get('failuresOnly'))
  if (failuresOnly === 'invalid') {
    return { ok: false, error: 'failuresOnly must be true or false' }
  }

  const serviceRaw = params.get('service')?.trim() || null

  return {
    ok: true,
    value: {
      uploadId,
      from,
      to,
      service: serviceRaw,
      failuresOnly,
      page,
      pageSize,
    },
  }
}

function utcDay(iso: string | null): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

function toIso(value: unknown): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error('Invalid date')
    return value.toISOString()
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
  }
  throw new Error('Expected a date')
}

function toIsoOrNull(value: unknown): string | null {
  if (value == null) return null
  return toIso(value)
}

function requireString(value: unknown, field: string): string {
  if (typeof value === 'string') return value
  throw new Error(`Expected ${field} to be a string`)
}

function isTrue(value: unknown): boolean {
  return value === true || value === 't' || value === 'true'
}

function queryRows(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) {
    return result as Array<Record<string, unknown>>
  }
  if (
    result !== null &&
    typeof result === 'object' &&
    Array.isArray((result as { rows?: unknown }).rows)
  ) {
    return (result as { rows: Array<Record<string, unknown>> }).rows
  }
  throw new Error('Unexpected query result')
}

async function latestCompletedUploadId(): Promise<number | null> {
  const sql = getDb()
  const rows = await sql<Record<string, unknown>>`
    SELECT id
    FROM uploads
    WHERE status = 'completed'
    ORDER BY uploaded_at DESC, id DESC
    LIMIT 1
  `
  const id = rows[0]?.id
  return id == null ? null : toNumber(id)
}

function mapUpload(row: Record<string, unknown>): LogsUpload {
  return {
    id: toNumber(row.id),
    filename: requireString(row.filename, 'filename'),
    dataStart: toIsoOrNull(row.data_start),
    dataEnd: toIsoOrNull(row.data_end),
  }
}

function mapCheckRow(row: Record<string, unknown>): LogsRow {
  return {
    id: toNumber(row.id),
    serviceId: requireString(row.service_id, 'service_id'),
    serviceName: requireString(row.service_name, 'service_name'),
    checkedAt: toIso(row.checked_at),
    statusCode: toNumber(row.status_code),
    isSuccess: isTrue(row.is_success),
    latencyMs: toNumberOrNull(row.latency_ms),
    agent: requireString(row.agent, 'agent'),
    region: requireString(row.region, 'region'),
  }
}

export async function getLogs(query: LogsQuery): Promise<GetLogsResult> {
  let uploadId = query.uploadId
  if (uploadId == null) {
    const latest = await latestCompletedUploadId()
    if (latest == null) return { status: 'empty' }
    uploadId = latest
  }

  const sql = getDb()
  const uploadRows = await sql<Record<string, unknown>>`
    SELECT id, filename, data_start, data_end
    FROM uploads
    WHERE id = ${uploadId}
  `
  if (uploadRows.length === 0) return { status: 'not_found' }
  const upload = mapUpload(uploadRows[0])

  const fromDay = query.from ?? utcDay(upload.dataStart)
  const toDay = query.to ?? utcDay(upload.dataEnd) ?? fromDay
  const resolvedFrom = fromDay ?? '1970-01-01'
  const resolvedTo = toDay ?? resolvedFrom
  const { start, endExclusive } = utcExclusiveRange(resolvedFrom, resolvedTo)

  const conditions = ['upload_id = $1', 'checked_at >= $2', 'checked_at < $3']
  const params: unknown[] = [uploadId, start.toISOString(), endExclusive.toISOString()]
  let next = 4
  if (query.service) {
    conditions.push(`service_id = $${next}`)
    params.push(query.service)
    next += 1
  }
  if (query.failuresOnly) {
    conditions.push('is_success = false')
  }
  const where = conditions.join(' AND ')
  const offset = (query.page - 1) * query.pageSize
  const limitIndex = next
  const offsetIndex = next + 1

  const listSql = `
    SELECT id, service_id, service_name, checked_at, status_code,
           is_success, latency_ms, agent, region
    FROM checks
    WHERE ${where}
    ORDER BY checked_at ASC, service_id ASC, id ASC
    LIMIT $${limitIndex} OFFSET $${offsetIndex}
  `
  const countSql = `SELECT COUNT(*)::int AS total FROM checks WHERE ${where}`

  const [listResult, countResult] = await Promise.all([
    sql.query(listSql, [...params, query.pageSize, offset]),
    sql.query(countSql, params),
  ])

  const listRows = queryRows(listResult)
  const countRows = queryRows(countResult)
  const total = toNumber(countRows[0]?.total ?? 0)
  const totalPages = total === 0 ? 0 : Math.ceil(total / query.pageSize)
  const rows = listRows.map(mapCheckRow)

  return {
    status: 'ok',
    body: {
      upload,
      filters: {
        from: fromDay,
        to: toDay,
        service: query.service,
        failuresOnly: query.failuresOnly,
      },
      rows,
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages,
    },
  }
}
