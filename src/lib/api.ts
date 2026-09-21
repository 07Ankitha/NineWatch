export type UploadSummary = {
  rowsReceived: number
  rowsKept: number
  rowsDropped: number
  dataStart: string | null
  dataEnd: string | null
  issueCounts: Record<string, number>
}

export type UploadResult = {
  alreadyProcessed: boolean
  uploadId: number
  filename: string
  summary: UploadSummary
}

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
  errorBreakdown: StatsErrorBreakdown[]
  dailyAvailability: StatsDailyAvailability[]
  dataQuality: { issueCounts: Record<string, number> }
}

const GENERIC_UPLOAD_ERROR = 'Upload failed. Please try again.'
const GENERIC_STATS_ERROR = 'Failed to load stats. Please try again.'

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function errorFromPayload(data: unknown, fallback: string): string {
  if (
    isRecord(data) &&
    typeof data.error === 'string' &&
    data.error.trim() !== ''
  ) {
    return data.error
  }
  return fallback
}

function parseIssueCounts(value: unknown): Record<string, number> | null {
  if (!isRecord(value)) return null
  const issueCounts: Record<string, number> = {}
  for (const [key, count] of Object.entries(value)) {
    if (typeof count !== 'number' || !Number.isFinite(count)) return null
    issueCounts[key] = count
  }
  return issueCounts
}

function parseSummary(value: unknown): UploadSummary | null {
  if (!isRecord(value)) return null
  if (typeof value.rowsReceived !== 'number') return null
  if (typeof value.rowsKept !== 'number') return null
  if (typeof value.rowsDropped !== 'number') return null
  if (value.dataStart !== null && typeof value.dataStart !== 'string') return null
  if (value.dataEnd !== null && typeof value.dataEnd !== 'string') return null
  const issueCounts = parseIssueCounts(value.issueCounts)
  if (!issueCounts) return null
  return {
    rowsReceived: value.rowsReceived,
    rowsKept: value.rowsKept,
    rowsDropped: value.rowsDropped,
    dataStart: value.dataStart,
    dataEnd: value.dataEnd,
    issueCounts,
  }
}

function parseUploadResult(data: unknown, fallbackFilename: string): UploadResult {
  if (!isRecord(data)) {
    throw new Error(GENERIC_UPLOAD_ERROR)
  }

  const summary = parseSummary(data.summary)
  if (
    typeof data.alreadyProcessed !== 'boolean' ||
    typeof data.uploadId !== 'number' ||
    !Number.isFinite(data.uploadId) ||
    !summary
  ) {
    throw new Error(GENERIC_UPLOAD_ERROR)
  }

  const filename =
    typeof data.filename === 'string' && data.filename.trim() !== ''
      ? data.filename
      : fallbackFilename

  return {
    alreadyProcessed: data.alreadyProcessed,
    uploadId: data.uploadId,
    filename,
    summary,
  }
}

export async function uploadCsv(file: File): Promise<UploadResult> {
  const text = await file.text()
  const response = await fetch('/api/process-upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/csv',
      'x-filename': file.name,
    },
    body: text,
  })

  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new Error(GENERIC_UPLOAD_ERROR)
  }

  if (!response.ok) {
    throw new Error(errorFromPayload(data, GENERIC_UPLOAD_ERROR))
  }

  return parseUploadResult(data, file.name)
}

function readNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(GENERIC_STATS_ERROR)
  }
  return value
}

function readNumberOrNull(record: Record<string, unknown>, key: string): number | null {
  const value = record[key]
  if (value == null) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(GENERIC_STATS_ERROR)
  }
  return value
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  if (typeof value !== 'string') {
    throw new Error(GENERIC_STATS_ERROR)
  }
  return value
}

function readStringOrNull(record: Record<string, unknown>, key: string): string | null {
  const value = record[key]
  if (value == null) return null
  if (typeof value !== 'string') {
    throw new Error(GENERIC_STATS_ERROR)
  }
  return value
}

function readBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key]
  if (typeof value !== 'boolean') {
    throw new Error(GENERIC_STATS_ERROR)
  }
  return value
}

function readRecords(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    throw new Error(GENERIC_STATS_ERROR)
  }
  return value.map((item) => {
    if (!isRecord(item)) throw new Error(GENERIC_STATS_ERROR)
    return item
  })
}

function parseStatsUpload(value: unknown): StatsUpload {
  if (!isRecord(value)) throw new Error(GENERIC_STATS_ERROR)
  return {
    id: readNumber(value, 'id'),
    filename: readString(value, 'filename'),
    uploadedAt: readString(value, 'uploadedAt'),
    dataStart: readStringOrNull(value, 'dataStart'),
    dataEnd: readStringOrNull(value, 'dataEnd'),
    rowsReceived: readNumber(value, 'rowsReceived'),
    rowsKept: readNumber(value, 'rowsKept'),
    rowsDropped: readNumber(value, 'rowsDropped'),
  }
}

function parseStatsOverall(value: unknown): StatsOverall {
  if (!isRecord(value)) throw new Error(GENERIC_STATS_ERROR)
  return {
    totalChecks: readNumber(value, 'totalChecks'),
    failedChecks: readNumber(value, 'failedChecks'),
    availabilityPct: readNumber(value, 'availabilityPct'),
    meetsSla: readBoolean(value, 'meetsSla'),
    allowedDowntimeMinutes: readNumber(value, 'allowedDowntimeMinutes'),
    actualDowntimeMinutes: readNumber(value, 'actualDowntimeMinutes'),
  }
}

function parseStatsService(value: Record<string, unknown>): StatsService {
  return {
    serviceId: readString(value, 'serviceId'),
    serviceName: readString(value, 'serviceName'),
    totalChecks: readNumber(value, 'totalChecks'),
    failedChecks: readNumber(value, 'failedChecks'),
    availabilityPct: readNumber(value, 'availabilityPct'),
    meetsSla: readBoolean(value, 'meetsSla'),
    allowedDowntimeMinutes: readNumber(value, 'allowedDowntimeMinutes'),
    actualDowntimeMinutes: readNumber(value, 'actualDowntimeMinutes'),
    downtimeBudgetUsedPct: readNumberOrNull(value, 'downtimeBudgetUsedPct'),
    p50LatencyMs: readNumberOrNull(value, 'p50LatencyMs'),
    p95LatencyMs: readNumberOrNull(value, 'p95LatencyMs'),
    p99LatencyMs: readNumberOrNull(value, 'p99LatencyMs'),
    avgLatencyMs: readNumberOrNull(value, 'avgLatencyMs'),
    outageCount: readNumber(value, 'outageCount'),
    isolatedErrorCount: readNumber(value, 'isolatedErrorCount'),
  }
}

function parseStatsOutage(value: Record<string, unknown>): StatsOutage {
  const codes = value.statusCodes
  if (!Array.isArray(codes) || codes.some((code) => typeof code !== 'number')) {
    throw new Error(GENERIC_STATS_ERROR)
  }
  return {
    serviceId: readString(value, 'serviceId'),
    serviceName: readString(value, 'serviceName'),
    startedAt: readString(value, 'startedAt'),
    endedAt: readString(value, 'endedAt'),
    durationMinutes: readNumber(value, 'durationMinutes'),
    failedChecks: readNumber(value, 'failedChecks'),
    statusCodes: codes,
  }
}

function parseStatsResponse(data: unknown): StatsResponse | null {
  if (!isRecord(data)) throw new Error(GENERIC_STATS_ERROR)
  if (data.upload === null) return null

  const dataQuality = data.dataQuality
  if (!isRecord(dataQuality)) throw new Error(GENERIC_STATS_ERROR)
  const issueCounts = parseIssueCounts(dataQuality.issueCounts)
  if (!issueCounts) throw new Error(GENERIC_STATS_ERROR)

  return {
    upload: parseStatsUpload(data.upload),
    slaTargetPct: readNumber(data, 'slaTargetPct'),
    overall: parseStatsOverall(data.overall),
    services: readRecords(data.services).map(parseStatsService),
    outages: readRecords(data.outages).map(parseStatsOutage),
    errorBreakdown: readRecords(data.errorBreakdown).map((row) => ({
      serviceId: readString(row, 'serviceId'),
      statusCode: readNumber(row, 'statusCode'),
      count: readNumber(row, 'count'),
    })),
    dailyAvailability: readRecords(data.dailyAvailability).map((row) => ({
      serviceId: readString(row, 'serviceId'),
      day: readString(row, 'day'),
      availabilityPct: readNumber(row, 'availabilityPct'),
      failedChecks: readNumber(row, 'failedChecks'),
      totalChecks: readNumber(row, 'totalChecks'),
    })),
    dataQuality: { issueCounts },
  }
}

export async function fetchStats(
  uploadId?: number,
  signal?: AbortSignal,
): Promise<StatsResponse | null> {
  const url =
    uploadId == null ? '/api/stats' : `/api/stats?uploadId=${encodeURIComponent(String(uploadId))}`
  const response = await fetch(url, { signal })

  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new Error(GENERIC_STATS_ERROR)
  }

  if (!response.ok) {
    throw new Error(errorFromPayload(data, GENERIC_STATS_ERROR))
  }

  return parseStatsResponse(data)
}

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

export type FetchLogsParams = {
  uploadId?: number
  date?: string
  from?: string
  to?: string
  service?: string
  failuresOnly?: boolean
  page?: number
  pageSize?: number
}

const GENERIC_LOGS_ERROR = 'Failed to load logs. Please try again.'

function parseLogsResponse(data: unknown): LogsResponse | null {
  if (!isRecord(data)) throw new Error(GENERIC_LOGS_ERROR)
  if (data.upload === null) return null
  if (!isRecord(data.upload) || !isRecord(data.filters)) {
    throw new Error(GENERIC_LOGS_ERROR)
  }

  const rows = data.rows
  if (!Array.isArray(rows)) throw new Error(GENERIC_LOGS_ERROR)

  return {
    upload: {
      id: readNumber(data.upload, 'id'),
      filename: readString(data.upload, 'filename'),
      dataStart: readStringOrNull(data.upload, 'dataStart'),
      dataEnd: readStringOrNull(data.upload, 'dataEnd'),
    },
    filters: {
      from: readStringOrNull(data.filters, 'from'),
      to: readStringOrNull(data.filters, 'to'),
      service: readStringOrNull(data.filters, 'service'),
      failuresOnly: readBoolean(data.filters, 'failuresOnly'),
    },
    rows: rows.map((item) => {
      if (!isRecord(item)) throw new Error(GENERIC_LOGS_ERROR)
      return {
        id: readNumber(item, 'id'),
        serviceId: readString(item, 'serviceId'),
        serviceName: readString(item, 'serviceName'),
        checkedAt: readString(item, 'checkedAt'),
        statusCode: readNumber(item, 'statusCode'),
        isSuccess: readBoolean(item, 'isSuccess'),
        latencyMs: readNumberOrNull(item, 'latencyMs'),
        agent: readString(item, 'agent'),
        region: readString(item, 'region'),
      }
    }),
    page: readNumber(data, 'page'),
    pageSize: readNumber(data, 'pageSize'),
    total: readNumber(data, 'total'),
    totalPages: readNumber(data, 'totalPages'),
  }
}

export async function fetchLogs(
  params: FetchLogsParams = {},
  signal?: AbortSignal,
): Promise<LogsResponse | null> {
  const search = new URLSearchParams()
  if (params.uploadId != null) search.set('uploadId', String(params.uploadId))
  if (params.date) search.set('date', params.date)
  if (params.from) search.set('from', params.from)
  if (params.to) search.set('to', params.to)
  if (params.service) search.set('service', params.service)
  if (params.failuresOnly) search.set('failuresOnly', 'true')
  if (params.page != null) search.set('page', String(params.page))
  if (params.pageSize != null) search.set('pageSize', String(params.pageSize))

  const query = search.toString()
  const url = query === '' ? '/api/logs' : `/api/logs?${query}`
  const response = await fetch(url, { signal })

  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new Error(GENERIC_LOGS_ERROR)
  }

  if (!response.ok) {
    throw new Error(errorFromPayload(data, GENERIC_LOGS_ERROR))
  }

  return parseLogsResponse(data)
}
