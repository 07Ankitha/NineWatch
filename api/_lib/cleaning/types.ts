export type RawRow = {
  service_id: string
  service_name: string
  timestamp: string
  status_code: string
  latency: string
  latency_unit: string
  agent: string
  region: string
}

export type CleanCheck = {
  serviceId: string
  serviceName: string
  checkedAt: Date
  statusCode: number
  isSuccess: boolean
  latencyMs: number | null
  agent: string
  region: string
}

export type CleaningIssueAction = 'dropped' | 'fixed' | 'nulled' | 'flagged'

export type CleaningIssue = {
  issueType: string
  action: CleaningIssueAction
  sourceRow?: number
  rawRow?: object
  detail?: string
  count?: number
}

export type CleaningSummary = {
  rowsReceived: number
  rowsKept: number
  rowsDropped: number
  dataStart: Date | null
  dataEnd: Date | null
  issueCounts: Record<string, number>
}

export type CleaningResult = {
  checks: CleanCheck[]
  issues: CleaningIssue[]
  summary: CleaningSummary
}

export type TimestampKind = 'iso_utc' | 'epoch' | 'offset' | 'naive_assumed_utc'

export type ParsedTimestamp = {
  date: Date
  kind: TimestampKind
}

export type ParsedLatency = {
  value: number | null
  converted: boolean
  problem: 'missing' | 'negative' | 'unparseable' | 'unknown_unit' | null
}
