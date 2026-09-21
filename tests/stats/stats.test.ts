import { describe, expect, it } from 'vitest'
import {
  actualDowntimeMinutes,
  allowedDowntimeMinutes,
  availabilityPct,
  buildOverall,
  countFromGroupedIssue,
  downtimeBudgetUsedPct,
  mapServiceRow,
  meetsSla,
  parseUploadIdParam,
  periodMinutes,
  roundTo,
  toNumber,
  toNumberOrNull,
} from '../../api/_lib/stats'
import { SLA_TARGET_PCT } from '../../api/_lib/config'

describe('toNumber', () => {
  it('passes through finite numbers', () => {
    expect(toNumber(99.9)).toBe(99.9)
    expect(toNumber(0)).toBe(0)
  })

  it('coerces numeric strings from Postgres', () => {
    expect(toNumber('12.96')).toBe(12.96)
    expect(toNumber('42')).toBe(42)
    expect(toNumber('99.900')).toBe(99.9)
  })

  it('throws on non-numeric values', () => {
    expect(() => toNumber('n/a')).toThrow(/finite number/)
    expect(() => toNumber(null)).toThrow(/finite number/)
    expect(() => toNumber(Number.NaN)).toThrow(/finite number/)
  })
})

describe('toNumberOrNull', () => {
  it('returns null for nullish values', () => {
    expect(toNumberOrNull(null)).toBeNull()
    expect(toNumberOrNull(undefined)).toBeNull()
  })

  it('coerces present values', () => {
    expect(toNumberOrNull('1.5')).toBe(1.5)
  })
})

describe('downtime and SLA helpers', () => {
  const first = new Date('2025-05-08T00:00:00.000Z')
  const last = new Date('2025-05-16T23:45:00.000Z')

  it('treats the observed period as last check + 15 minutes minus first check', () => {
    expect(periodMinutes(first, last)).toBe(9 * 24 * 60)
  })

  it('allows 0.1% of the period as downtime', () => {
    expect(allowedDowntimeMinutes(first, last)).toBe(12.96)
    expect(periodMinutes(first, last) * (1 - SLA_TARGET_PCT / 100)).toBeCloseTo(
      12.96,
      10,
    )
  })

  it('counts each failed check as 15 minutes of downtime', () => {
    expect(actualDowntimeMinutes(6)).toBe(90)
    expect(actualDowntimeMinutes(0)).toBe(0)
  })

  it('returns null budget used when no downtime is allowed', () => {
    expect(downtimeBudgetUsedPct(15, 0)).toBeNull()
  })

  it('computes budget used as actual / allowed * 100', () => {
    expect(downtimeBudgetUsedPct(90, 12.96)).toBe(694.444)
  })

  it('meets SLA at or above 99.9%', () => {
    expect(meetsSla(99.9)).toBe(true)
    expect(meetsSla(100)).toBe(true)
    expect(meetsSla(99.899)).toBe(false)
    expect(meetsSla(0)).toBe(false)
  })

  it('rounds availability to 3 decimals', () => {
    expect(availabilityPct(999, 1000)).toBe(99.9)
    expect(availabilityPct(4319, 4319)).toBe(100)
    expect(availabilityPct(0, 0)).toBe(0)
    expect(roundTo(99.9004, 3)).toBe(99.9)
  })
})

describe('parseUploadIdParam', () => {
  it('treats a missing param as missing', () => {
    expect(parseUploadIdParam(null)).toBe('missing')
  })

  it('rejects non-numeric values', () => {
    expect(parseUploadIdParam('')).toBe('invalid')
    expect(parseUploadIdParam('12abc')).toBe('invalid')
    expect(parseUploadIdParam('-3')).toBe('invalid')
    expect(parseUploadIdParam('0')).toBe('invalid')
  })

  it('parses a positive integer', () => {
    expect(parseUploadIdParam('42')).toBe(42)
  })
})

describe('countFromGroupedIssue', () => {
  it('uses the leading count in a single aggregate detail', () => {
    expect(countFromGroupedIssue(1, '352 duplicate rows dropped')).toBe(352)
  })

  it('falls back to occurrence count', () => {
    expect(countFromGroupedIssue(4, null)).toBe(4)
    expect(countFromGroupedIssue(2, '352 duplicate rows dropped')).toBe(2)
  })
})

describe('mapServiceRow and buildOverall', () => {
  const row = {
    service_id: 'svc-reports',
    service_name: 'reports-api',
    total_checks: '864',
    failed_checks: '6',
    availability_pct: '99.306',
    first_check_at: '2025-05-08T00:00:00.000Z',
    last_check_at: '2025-05-16T23:45:00.000Z',
    p50_latency_ms: '120.0',
    p95_latency_ms: '400.5',
    p99_latency_ms: '800.1',
    avg_latency_ms: '210.25',
  }

  it('maps snake_case rows and computes SLA fields', () => {
    const service = mapServiceRow(row, 1, 2)
    expect(service.serviceId).toBe('svc-reports')
    expect(service.totalChecks).toBe(864)
    expect(service.failedChecks).toBe(6)
    expect(service.availabilityPct).toBe(99.306)
    expect(service.meetsSla).toBe(false)
    expect(service.allowedDowntimeMinutes).toBeCloseTo(12.96, 10)
    expect(service.actualDowntimeMinutes).toBe(90)
    expect(service.downtimeBudgetUsedPct).toBe(694.444)
    expect(service.p50LatencyMs).toBe(120)
    expect(service.outageCount).toBe(1)
    expect(service.isolatedErrorCount).toBe(2)
  })

  it('sums allowed downtime across services for overall', () => {
    const service = mapServiceRow(row, 1, 0)
    const overall = buildOverall([service, service])
    expect(overall.totalChecks).toBe(1728)
    expect(overall.failedChecks).toBe(12)
    expect(overall.actualDowntimeMinutes).toBe(180)
    expect(overall.allowedDowntimeMinutes).toBeCloseTo(25.92, 10)
    expect(overall.meetsSla).toBe(overall.availabilityPct >= SLA_TARGET_PCT)
  })
})
