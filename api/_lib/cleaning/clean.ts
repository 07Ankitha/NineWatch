import { parseCsv } from './parseCsv'
import { parseLatency, parseStatusCode, parseTimestamp } from './normalize'
import type {
  CleanCheck,
  CleaningIssue,
  CleaningResult,
  RawRow,
  TimestampKind,
} from './types'

type Candidate = {
  check: CleanCheck
  sourceRow: number
  rawRow: RawRow
  timestampKind: TimestampKind
  latencyConverted: boolean
}

function isSuccessStatus(statusCode: number): boolean {
  return statusCode >= 200 && statusCode <= 299
}

function dedupeKey(check: CleanCheck): string {
  return `${check.serviceId}|${check.checkedAt.toISOString()}`
}

function countIssue(issues: CleaningIssue[], issueType: string, increment = 1): void {
  const existing = issues.find((issue) => issue.issueType === issueType)
  if (existing) {
    existing.count = (existing.count ?? 1) + increment
    return
  }
  issues.push({
    issueType,
    action: issueType === 'naive_timestamp_assumed_utc' ? 'flagged' : 'fixed',
    count: increment,
  })
}

function buildIssueCounts(issues: CleaningIssue[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const issue of issues) {
    counts[issue.issueType] = (counts[issue.issueType] ?? 0) + (issue.count ?? 1)
  }
  return counts
}

export function cleanCsv(csvText: string): CleaningResult {
  const parsedRows = parseCsv(csvText)
  const issues: CleaningIssue[] = []
  const candidates: Candidate[] = []

  for (const { sourceRow, raw } of parsedRows) {
    const timestamp = parseTimestamp(raw.timestamp)
    if (!timestamp) {
      issues.push({
        issueType: 'bad_timestamp',
        action: 'dropped',
        sourceRow,
        rawRow: raw,
        detail: `unparseable timestamp: ${raw.timestamp}`,
      })
      continue
    }

    const statusCode = parseStatusCode(raw.status_code)
    if (statusCode === null) {
      issues.push({
        issueType: 'invalid_status',
        action: 'dropped',
        sourceRow,
        rawRow: raw,
        detail: String(raw.status_code),
      })
      continue
    }

    const latency = parseLatency(raw.latency, raw.latency_unit)
    if (latency.problem) {
      const issueType =
        latency.problem === 'unknown_unit'
          ? 'unknown_latency_unit'
          : `${latency.problem}_latency`
      issues.push({
        issueType,
        action: 'nulled',
        sourceRow,
        rawRow: raw,
        detail:
          latency.problem === 'unknown_unit'
            ? `unknown latency unit: ${raw.latency_unit}`
            : `latency ${latency.problem}: ${raw.latency}`,
      })
    }

    candidates.push({
      sourceRow,
      rawRow: raw,
      timestampKind: timestamp.kind,
      latencyConverted: latency.converted,
      check: {
        serviceId: raw.service_id,
        serviceName: raw.service_name,
        checkedAt: timestamp.date,
        statusCode,
        isSuccess: isSuccessStatus(statusCode),
        latencyMs: latency.value,
        agent: raw.agent,
        region: raw.region,
      },
    })
  }

  const groups = new Map<string, Candidate[]>()
  for (const candidate of candidates) {
    const key = dedupeKey(candidate.check)
    const group = groups.get(key)
    if (group) group.push(candidate)
    else groups.set(key, [candidate])
  }

  const kept: Candidate[] = []
  let duplicateDropped = 0

  for (const group of groups.values()) {
    if (group.length === 1) {
      kept.push(group[0])
      continue
    }

    const statusCodes = new Set(group.map((row) => row.check.statusCode))
    const statusesConflict = statusCodes.size > 1
    const winner =
      statusesConflict
        ? (group.find((row) => !row.check.isSuccess) ?? group[0])
        : group[0]

    kept.push(winner)

    for (const row of group) {
      if (row === winner) continue
      duplicateDropped += 1
      if (statusesConflict) {
        const other = winner
        issues.push({
          issueType: 'conflicting_duplicate',
          action: 'flagged',
          sourceRow: row.sourceRow,
          rawRow: row.rawRow,
          detail: `statuses ${row.check.statusCode} (${row.check.agent}) vs ${other.check.statusCode} (${other.check.agent})`,
        })
      }
    }
  }

  if (duplicateDropped > 0) {
    issues.push({
      issueType: 'duplicate_row',
      action: 'dropped',
      count: duplicateDropped,
    })
  }

  const checks = kept
    .map((row) => row.check)
    .sort((a, b) => {
      const byTime = a.checkedAt.getTime() - b.checkedAt.getTime()
      if (byTime !== 0) return byTime
      return a.serviceId.localeCompare(b.serviceId)
    })

  for (const row of kept) {
    if (row.timestampKind === 'offset') {
      countIssue(issues, 'timezone_normalized')
    } else if (row.timestampKind === 'epoch') {
      countIssue(issues, 'epoch_converted')
    } else if (row.timestampKind === 'naive_assumed_utc') {
      countIssue(issues, 'naive_timestamp_assumed_utc')
    }
    if (row.latencyConverted) {
      countIssue(issues, 'unit_converted')
    }
  }

  const times = checks.map((check) => check.checkedAt.getTime())
  const rowsReceived = parsedRows.length
  const rowsKept = checks.length
  const rowsDropped = rowsReceived - rowsKept

  return {
    checks,
    issues,
    summary: {
      rowsReceived,
      rowsKept,
      rowsDropped,
      dataStart: times.length ? new Date(Math.min(...times)) : null,
      dataEnd: times.length ? new Date(Math.max(...times)) : null,
      issueCounts: buildIssueCounts(issues),
    },
  }
}
