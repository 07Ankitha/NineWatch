import { CHECK_INTERVAL_MINUTES, SLA_TARGET_PCT } from './config'
import { getDb } from './db'

export type StatsUpload = {
  id: number
  filename: string
  uploadedAt: string
  dataStart: string | null
  dataEnd: string | null
  rowsReceived: number
  rowsKept: number
  rowsDropped: number
}

export type StatsOverall = {
  totalChecks: number
  failedChecks: number
  availabilityPct: number
  meetsSla: boolean
  allowedDowntimeMinutes: number
  actualDowntimeMinutes: number
}

export type StatsService = {
  serviceId: string
  serviceName: string
  totalChecks: number
  failedChecks: number
  availabilityPct: number
  meetsSla: boolean
  allowedDowntimeMinutes: number
  actualDowntimeMinutes: number
  downtimeBudgetUsedPct: number | null
  p50LatencyMs: number | null
  p95LatencyMs: number | null
  p99LatencyMs: number | null
  avgLatencyMs: number | null
  outageCount: number
  isolatedErrorCount: number
}

export type StatsOutage = {
  serviceId: string
  serviceName: string
  startedAt: string
  endedAt: string
  durationMinutes: number
  failedChecks: number
  statusCodes: number[]
}

export type StatsIncident = {
  serviceId: string
  serviceName: string
  startedAt: string
  endedAt: string
  windowMinutes: number
  failedChecks: number
  downtimeMinutes: number
  segments: number
  statusCodes: number[]
}

export type StatsErrorBreakdown = {
  serviceId: string
  statusCode: number
  count: number
}

export type StatsDailyAvailability = {
  serviceId: string
  day: string
  availabilityPct: number
  failedChecks: number
  totalChecks: number
}

export type StatsResponse = {
  upload: StatsUpload
  slaTargetPct: number
  overall: StatsOverall
  services: StatsService[]
  outages: StatsOutage[]
  incidents: StatsIncident[]
  errorBreakdown: StatsErrorBreakdown[]
  dailyAvailability: StatsDailyAvailability[]
  dataQuality: { issueCounts: Record<string, number> }
}

export type GetStatsResult =
  | { status: 'empty' }
  | { status: 'not_found' }
  | { status: 'ok'; body: StatsResponse }

export function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  throw new Error(`Expected a finite number, received ${String(value)}`)
}

export function toNumberOrNull(value: unknown): number | null {
  if (value == null) return null
  return toNumber(value)
}

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export function periodMinutes(firstCheckAt: Date, lastCheckAt: Date): number {
  const elapsedMs =
    lastCheckAt.getTime() + CHECK_INTERVAL_MINUTES * 60 * 1000 - firstCheckAt.getTime()
  return elapsedMs / 60_000
}

export function allowedDowntimeMinutes(firstCheckAt: Date, lastCheckAt: Date): number {
  return roundTo(
    periodMinutes(firstCheckAt, lastCheckAt) * (1 - SLA_TARGET_PCT / 100),
    3,
  )
}

export function actualDowntimeMinutes(failedChecks: number): number {
  return failedChecks * CHECK_INTERVAL_MINUTES
}

export function downtimeBudgetUsedPct(
  actualMinutes: number,
  allowedMinutes: number,
): number | null {
  if (allowedMinutes === 0) return null
  return roundTo((actualMinutes / allowedMinutes) * 100, 3)
}

export function meetsSla(availabilityPct: number): boolean {
  return availabilityPct >= SLA_TARGET_PCT
}

export function availabilityPct(successfulChecks: number, totalChecks: number): number {
  if (totalChecks <= 0) return 0
  return roundTo((successfulChecks / totalChecks) * 100, 3)
}

export function countFromGroupedIssue(
  occurrences: number,
  aggregateDetail: string | null,
): number {
  if (occurrences === 1 && aggregateDetail) {
    const match = /^(\d+)/.exec(aggregateDetail)
    if (match) return Number(match[1])
  }
  return occurrences
}

function toIso(value: unknown): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error('Invalid date')
    }
    return value.toISOString()
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
  }
  throw new Error(`Expected a date, received ${String(value)}`)
}

function toIsoOrNull(value: unknown): string | null {
  if (value == null) return null
  return toIso(value)
}

function toDate(value: unknown): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  throw new Error(`Expected a date, received ${String(value)}`)
}

function dayString(value: unknown): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10)
  }
  return toIso(value).slice(0, 10)
}

function toNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value.map(toNumber)
}

function requireString(value: unknown, field: string): string {
  if (typeof value === 'string' && value !== '') return value
  throw new Error(`Expected ${field} to be a string`)
}

function isTrue(value: unknown): boolean {
  return value === true || value === 't' || value === 'true'
}

type OutageRow = StatsOutage & { isIsolated: boolean }

function mapUpload(row: Record<string, unknown>): StatsUpload {
  return {
    id: toNumber(row.id),
    filename: requireString(row.filename, 'filename'),
    uploadedAt: toIso(row.uploaded_at),
    dataStart: toIsoOrNull(row.data_start),
    dataEnd: toIsoOrNull(row.data_end),
    rowsReceived: toNumber(row.rows_received),
    rowsKept: toNumber(row.rows_kept),
    rowsDropped: toNumber(row.rows_dropped),
  }
}

export function mapServiceRow(
  row: Record<string, unknown>,
  outageCount: number,
  isolatedErrorCount: number,
): StatsService {
  const totalChecks = toNumber(row.total_checks)
  const failedChecks = toNumber(row.failed_checks)
  const availability = toNumber(row.availability_pct)
  const firstCheckAt = toDate(row.first_check_at)
  const lastCheckAt = toDate(row.last_check_at)
  const allowed = allowedDowntimeMinutes(firstCheckAt, lastCheckAt)
  const actual = actualDowntimeMinutes(failedChecks)
  return {
    serviceId: requireString(row.service_id, 'service_id'),
    serviceName: requireString(row.service_name, 'service_name'),
    totalChecks,
    failedChecks,
    availabilityPct: availability,
    meetsSla: meetsSla(availability),
    allowedDowntimeMinutes: allowed,
    actualDowntimeMinutes: actual,
    downtimeBudgetUsedPct: downtimeBudgetUsedPct(actual, allowed),
    p50LatencyMs: toNumberOrNull(row.p50_latency_ms),
    p95LatencyMs: toNumberOrNull(row.p95_latency_ms),
    p99LatencyMs: toNumberOrNull(row.p99_latency_ms),
    avgLatencyMs: toNumberOrNull(row.avg_latency_ms),
    outageCount,
    isolatedErrorCount,
  }
}

function mapOutageRow(row: Record<string, unknown>): OutageRow {
  return {
    serviceId: requireString(row.service_id, 'service_id'),
    serviceName: requireString(row.service_name, 'service_name'),
    startedAt: toIso(row.started_at),
    endedAt: toIso(row.ended_at),
    durationMinutes: toNumber(row.duration_minutes),
    failedChecks: toNumber(row.failed_checks),
    statusCodes: toNumberArray(row.status_codes),
    isIsolated: isTrue(row.is_isolated),
  }
}

function mapIncidentRow(row: Record<string, unknown>): StatsIncident {
  return {
    serviceId: requireString(row.service_id, 'service_id'),
    serviceName: requireString(row.service_name, 'service_name'),
    startedAt: toIso(row.started_at),
    endedAt: toIso(row.ended_at),
    windowMinutes: toNumber(row.window_minutes),
    failedChecks: toNumber(row.failed_checks),
    downtimeMinutes: toNumber(row.downtime_minutes),
    segments: toNumber(row.segments),
    statusCodes: toNumberArray(row.status_codes),
  }
}

function mapErrorRow(row: Record<string, unknown>): StatsErrorBreakdown {
  return {
    serviceId: requireString(row.service_id, 'service_id'),
    statusCode: toNumber(row.status_code),
    count: toNumber(row.count),
  }
}

function mapDailyRow(row: Record<string, unknown>): StatsDailyAvailability {
  return {
    serviceId: requireString(row.service_id, 'service_id'),
    day: dayString(row.day),
    availabilityPct: toNumber(row.availability_pct),
    failedChecks: toNumber(row.failed_checks),
    totalChecks: toNumber(row.total_checks),
  }
}

function issueCountsFromRows(rows: Array<Record<string, unknown>>): Record<string, number> {
  const issueCounts: Record<string, number> = {}
  for (const row of rows) {
    const issueType = requireString(row.issue_type, 'issue_type')
    const occurrences = toNumber(row.occurrences)
    const detail = row.aggregate_detail == null ? null : String(row.aggregate_detail)
    issueCounts[issueType] = countFromGroupedIssue(occurrences, detail)
  }
  return issueCounts
}

export function buildOverall(services: StatsService[]): StatsOverall {
  const totalChecks = services.reduce((sum, service) => sum + service.totalChecks, 0)
  const failedChecks = services.reduce((sum, service) => sum + service.failedChecks, 0)
  const allowed = services.reduce((sum, service) => sum + service.allowedDowntimeMinutes, 0)
  const availability = availabilityPct(totalChecks - failedChecks, totalChecks)
  return {
    totalChecks,
    failedChecks,
    availabilityPct: availability,
    meetsSla: meetsSla(availability),
    allowedDowntimeMinutes: allowed,
    actualDowntimeMinutes: actualDowntimeMinutes(failedChecks),
  }
}

export function parseUploadIdParam(raw: string | null): 'missing' | 'invalid' | number {
  if (raw == null) return 'missing'
  if (!/^\d+$/.test(raw)) return 'invalid'
  const id = Number(raw)
  if (!Number.isSafeInteger(id) || id <= 0) return 'invalid'
  return id
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

export async function getStats(uploadId?: number): Promise<GetStatsResult> {
  let id = uploadId
  if (id == null) {
    const latest = await latestCompletedUploadId()
    if (latest == null) return { status: 'empty' }
    id = latest
  }

  const sql = getDb()
  const [uploadRows, serviceRows, outageRows, incidentRows, errorRows, dailyRows, issueRows] =
    await Promise.all([
      sql<Record<string, unknown>>`
        SELECT
          id, filename, uploaded_at, data_start, data_end,
          rows_received, rows_kept, rows_dropped
        FROM uploads
        WHERE id = ${id}
      `,
      sql<Record<string, unknown>>`
        SELECT *
        FROM v_service_availability
        WHERE upload_id = ${id}
        ORDER BY service_id
      `,
      sql<Record<string, unknown>>`
        SELECT *
        FROM v_outages
        WHERE upload_id = ${id}
        ORDER BY started_at DESC
      `,
      sql<Record<string, unknown>>`
        SELECT *
        FROM v_incidents
        WHERE upload_id = ${id}
        ORDER BY started_at DESC
      `,
      sql<Record<string, unknown>>`
        SELECT *
        FROM v_error_breakdown
        WHERE upload_id = ${id}
        ORDER BY service_id, status_code
      `,
      sql<Record<string, unknown>>`
        SELECT
          service_id,
          day::text AS day,
          total_checks,
          failed_checks,
          availability_pct
        FROM v_daily_availability
        WHERE upload_id = ${id}
        ORDER BY service_id, day
      `,
      sql<Record<string, unknown>>`
        SELECT
          issue_type,
          COUNT(*)::int AS occurrences,
          MAX(detail) FILTER (WHERE source_row IS NULL) AS aggregate_detail
        FROM data_issues
        WHERE upload_id = ${id}
        GROUP BY issue_type
      `,
    ])

  if (uploadRows.length === 0) return { status: 'not_found' }

  const mappedOutages = outageRows.map(mapOutageRow)
  const incidents = incidentRows.map(mapIncidentRow)
  const incidentCountByService = new Map<string, number>()
  const isolatedCountByService = new Map<string, number>()
  for (const incident of incidents) {
    incidentCountByService.set(
      incident.serviceId,
      (incidentCountByService.get(incident.serviceId) ?? 0) + 1,
    )
  }
  for (const outage of mappedOutages) {
    if (outage.isIsolated) {
      isolatedCountByService.set(
        outage.serviceId,
        (isolatedCountByService.get(outage.serviceId) ?? 0) + 1,
      )
    }
  }

  const services = serviceRows.map((row) => {
    const serviceId = requireString(row.service_id, 'service_id')
    return mapServiceRow(
      row,
      incidentCountByService.get(serviceId) ?? 0,
      isolatedCountByService.get(serviceId) ?? 0,
    )
  })

  const outages: StatsOutage[] = mappedOutages
    .filter((outage) => !outage.isIsolated)
    .map((outage) => ({
      serviceId: outage.serviceId,
      serviceName: outage.serviceName,
      startedAt: outage.startedAt,
      endedAt: outage.endedAt,
      durationMinutes: outage.durationMinutes,
      failedChecks: outage.failedChecks,
      statusCodes: outage.statusCodes,
    }))

  return {
    status: 'ok',
    body: {
      upload: mapUpload(uploadRows[0]),
      slaTargetPct: SLA_TARGET_PCT,
      overall: buildOverall(services),
      services,
      outages,
      incidents,
      errorBreakdown: errorRows.map(mapErrorRow),
      dailyAvailability: dailyRows.map(mapDailyRow),
      dataQuality: { issueCounts: issueCountsFromRows(issueRows) },
    },
  }
}
