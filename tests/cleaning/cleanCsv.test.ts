import { describe, expect, it } from 'vitest'
import { cleanCsv, ValidationError } from '../../api/_lib/cleaning'
import type { CleaningIssue } from '../../api/_lib/cleaning'

const HEADER =
  'service_id,service_name,timestamp,status_code,latency,latency_unit,agent,region'

function csv(...rows: string[]): string {
  return [HEADER, ...rows].join('\n')
}

function issuesOf(issues: CleaningIssue[], type: string): CleaningIssue[] {
  return issues.filter((issue) => issue.issueType === type)
}

describe('cleanCsv', () => {
  it('keeps the first-seen row when duplicate statuses agree', () => {
    const result = cleanCsv(
      csv(
        'svc-a,alpha,2025-05-08T00:00:00Z,200,100,ms,agent-1,ap-south-1',
        'svc-a,alpha,2025-05-08T00:00:00Z,200,110,ms,agent-2,ap-south-1',
      ),
    )
    expect(result.checks).toHaveLength(1)
    expect(result.checks[0].agent).toBe('agent-1')
    expect(result.checks[0].latencyMs).toBe(100)
    expect(result.summary.rowsReceived).toBe(2)
    expect(result.summary.rowsKept).toBe(1)
    expect(result.summary.rowsDropped).toBe(1)
    expect(result.summary.issueCounts.duplicate_row).toBe(1)
    expect(issuesOf(result.issues, 'duplicate_row')).toHaveLength(1)
    expect(issuesOf(result.issues, 'duplicate_row')[0].count).toBe(1)
    expect(issuesOf(result.issues, 'conflicting_duplicate')).toHaveLength(0)
  })

  it('keeps the failing row when duplicate statuses conflict', () => {
    const result = cleanCsv(
      csv(
        'svc-a,alpha,2025-05-08T00:00:00Z,200,100,ms,agent-1,ap-south-1',
        'svc-a,alpha,2025-05-08T00:00:00Z,503,120,ms,agent-2,ap-south-1',
      ),
    )
    expect(result.checks).toHaveLength(1)
    expect(result.checks[0].statusCode).toBe(503)
    expect(result.checks[0].isSuccess).toBe(false)
    expect(result.checks[0].agent).toBe('agent-2')
    expect(result.summary.issueCounts.duplicate_row).toBe(1)
    expect(result.summary.issueCounts.conflicting_duplicate).toBe(1)
    const flagged = issuesOf(result.issues, 'conflicting_duplicate')[0]
    expect(flagged.action).toBe('flagged')
    expect(flagged.detail).toContain('200')
    expect(flagged.detail).toContain('503')
    expect(flagged.detail).toContain('agent-1')
    expect(flagged.detail).toContain('agent-2')
  })

  it('drops a 999 status row', () => {
    const result = cleanCsv(
      csv(
        'svc-a,alpha,2025-05-08T00:00:00Z,200,100,ms,agent-1,ap-south-1',
        'svc-a,alpha,2025-05-08T00:15:00Z,999,100,ms,agent-1,ap-south-1',
      ),
    )
    expect(result.checks).toHaveLength(1)
    expect(result.checks.every((row) => row.statusCode !== 999)).toBe(true)
    expect(result.summary.rowsDropped).toBe(1)
    const dropped = issuesOf(result.issues, 'invalid_status')[0]
    expect(dropped.action).toBe('dropped')
    expect(dropped.detail).toBe('999')
    expect(dropped.sourceRow).toBe(3)
  })

  it('nulls negative latency but keeps the row', () => {
    const result = cleanCsv(
      csv('svc-a,alpha,2025-05-08T00:00:00Z,200,-286,ms,agent-1,ap-south-1'),
    )
    expect(result.checks).toHaveLength(1)
    expect(result.checks[0].latencyMs).toBeNull()
    const issue = issuesOf(result.issues, 'negative_latency')[0]
    expect(issue.action).toBe('nulled')
    expect(issue.sourceRow).toBe(2)
    expect(issue.rawRow).toBeDefined()
  })

  it('keeps blank latency as null', () => {
    const result = cleanCsv(
      csv('svc-a,alpha,2025-05-08T00:00:00Z,200,,ms,agent-1,ap-south-1'),
    )
    expect(result.checks).toHaveLength(1)
    expect(result.checks[0].latencyMs).toBeNull()
    expect(issuesOf(result.issues, 'missing_latency')[0].action).toBe('nulled')
  })

  it('converts epoch seconds and +05:30 offsets to the same UTC instant', () => {
    const result = cleanCsv(
      csv(
        'svc-a,alpha,1746664200,200,100,ms,agent-1,ap-south-1',
        'svc-b,beta,2025-05-08T06:00:00+05:30,200,100,ms,agent-1,ap-south-1',
      ),
    )
    expect(result.checks[0].checkedAt.toISOString()).toBe(
      '2025-05-08T00:30:00.000Z',
    )
    expect(result.checks[1].checkedAt.toISOString()).toBe(
      '2025-05-08T00:30:00.000Z',
    )
    expect(result.summary.issueCounts.epoch_converted).toBe(1)
    expect(result.summary.issueCounts.timezone_normalized).toBe(1)
  })

  it('converts second latencies to milliseconds', () => {
    const result = cleanCsv(
      csv('svc-search,search-api,2025-05-08T00:00:00Z,200,0.717,s,agent-1,ap-south-1'),
    )
    expect(result.checks[0].latencyMs).toBe(717)
    expect(result.summary.issueCounts.unit_converted).toBe(1)
    expect(issuesOf(result.issues, 'unit_converted')[0].action).toBe('fixed')
  })

  it('sorts by checkedAt then serviceId', () => {
    const result = cleanCsv(
      csv(
        'svc-z,z,2025-05-08T01:00:00Z,200,1,ms,agent-1,ap-south-1',
        'svc-b,b,2025-05-08T00:00:00Z,200,1,ms,agent-1,ap-south-1',
        'svc-a,a,2025-05-08T00:00:00Z,200,1,ms,agent-1,ap-south-1',
      ),
    )
    expect(result.checks.map((row) => `${row.checkedAt.toISOString()}|${row.serviceId}`)).toEqual(
      [
        '2025-05-08T00:00:00.000Z|svc-a',
        '2025-05-08T00:00:00.000Z|svc-b',
        '2025-05-08T01:00:00.000Z|svc-z',
      ],
    )
  })

  it('keeps 5xx outages', () => {
    const result = cleanCsv(
      csv('svc-a,alpha,2025-05-08T00:00:00Z,502,100,ms,agent-1,ap-south-1'),
    )
    expect(result.checks[0].statusCode).toBe(502)
    expect(result.checks[0].isSuccess).toBe(false)
  })

  it('throws ValidationError when required headers are missing', () => {
    expect(() =>
      cleanCsv('service_id,service_name,timestamp\nsvc-a,alpha,2025-05-08T00:00:00Z'),
    ).toThrow(ValidationError)
    expect(() =>
      cleanCsv('service_id,service_name,timestamp\nsvc-a,alpha,2025-05-08T00:00:00Z'),
    ).toThrow(/missing required columns/i)
    expect(() =>
      cleanCsv('service_id,service_name,timestamp\nsvc-a,alpha,2025-05-08T00:00:00Z'),
    ).toThrow(/status_code/)
  })

  it('throws ValidationError for an empty file', () => {
    expect(() => cleanCsv('')).toThrow(ValidationError)
    expect(() => cleanCsv('')).toThrow(/0 data rows/)
    expect(() => cleanCsv(HEADER)).toThrow(/0 data rows/)
  })

  it('never silently loses rows in the summary', () => {
    const result = cleanCsv(
      csv(
        'svc-a,alpha,2025-05-08T00:00:00Z,200,100,ms,agent-1,ap-south-1',
        'svc-a,alpha,2025-05-08T00:00:00Z,200,110,ms,agent-2,ap-south-1',
        'svc-a,alpha,2025-05-08T00:15:00Z,999,100,ms,agent-1,ap-south-1',
      ),
    )
    expect(result.summary.rowsKept + result.summary.rowsDropped).toBe(
      result.summary.rowsReceived,
    )
  })
})
