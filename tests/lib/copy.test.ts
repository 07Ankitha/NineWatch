import { describe, expect, it } from 'vitest'
import type { StatsResponse } from '../../src/lib/api.ts'
import {
  buildHeadline,
  describeStatus,
  getSeverity,
  overAllowanceText,
  periodDayCount,
} from '../../src/lib/copy.ts'

function baseStats(overrides: Partial<StatsResponse> = {}): StatsResponse {
  return {
    upload: {
      id: 1,
      filename: 'sample.csv',
      uploadedAt: '2025-04-10T00:00:00.000Z',
      dataStart: '2025-04-10T00:00:00.000Z',
      dataEnd: '2025-04-21T23:45:00.000Z',
      rowsReceived: 100,
      rowsKept: 90,
      rowsDropped: 10,
    },
    slaTargetPct: 99.9,
    overall: {
      totalChecks: 1000,
      failedChecks: 20,
      availabilityPct: 98.0,
      meetsSla: false,
      allowedDowntimeMinutes: 151,
      actualDowntimeMinutes: 1860,
    },
    services: [
      {
        serviceId: 'svc-search',
        serviceName: 'search-api',
        totalChecks: 500,
        failedChecks: 15,
        availabilityPct: 97.0,
        meetsSla: false,
        allowedDowntimeMinutes: 75,
        actualDowntimeMinutes: 225,
        downtimeBudgetUsedPct: 300,
        p50LatencyMs: 100,
        p95LatencyMs: 200,
        p99LatencyMs: 300,
        avgLatencyMs: 120,
        outageCount: 1,
        isolatedErrorCount: 2,
      },
      {
        serviceId: 'svc-auth',
        serviceName: 'auth-api',
        totalChecks: 500,
        failedChecks: 5,
        availabilityPct: 99.0,
        meetsSla: false,
        allowedDowntimeMinutes: 75,
        actualDowntimeMinutes: 75,
        downtimeBudgetUsedPct: 100,
        p50LatencyMs: 80,
        p95LatencyMs: 150,
        p99LatencyMs: 200,
        avgLatencyMs: 90,
        outageCount: 0,
        isolatedErrorCount: 5,
      },
    ],
    outages: [],
    incidents: [],
    errorBreakdown: [],
    dailyAvailability: [],
    dataQuality: { issueCounts: {} },
    ...overrides,
  }
}

describe('getSeverity', () => {
  it('classifies the availability boundaries', () => {
    expect(getSeverity(99.9).label).toBe('Meets target')
    expect(getSeverity(100).label).toBe('Meets target')
    expect(getSeverity(99.5).label).toBe('Slightly below')
    expect(getSeverity(99.89).label).toBe('Slightly below')
    expect(getSeverity(98).label).toBe('Below target')
    expect(getSeverity(98.5).label).toBe('Below target')
    expect(getSeverity(97.999).label).toBe('Far below target')
  })
})

describe('describeStatus', () => {
  it('maps common status codes to plain labels', () => {
    expect(describeStatus(500)).toBe('Server error')
    expect(describeStatus(502)).toBe('Bad gateway')
    expect(describeStatus(503)).toBe('Service unavailable')
    expect(describeStatus(504)).toBe('Timeout')
    expect(describeStatus(599)).toBe('Server error (599)')
    expect(describeStatus(404)).toBe('Error (404)')
  })
})

describe('overAllowanceText', () => {
  it('returns null when within allowance', () => {
    expect(overAllowanceText(100, 100)).toBeNull()
    expect(overAllowanceText(50, 100)).toBeNull()
    expect(overAllowanceText(10, 0)).toBeNull()
  })

  it('uses one decimal under 10x and whole numbers at or above', () => {
    expect(overAllowanceText(151 * 12.3, 151)).toBe('About 12x more than allowed')
    expect(overAllowanceText(151 * 2.5, 151)).toBe('About 2.5x more than allowed')
    expect(overAllowanceText(151 * 1.2, 151)).toBe('About 1.2x more than allowed')
    expect(overAllowanceText(151 * 9.4, 151)).toBe('About 9.4x more than allowed')
  })
})

describe('periodDayCount', () => {
  it('counts inclusive UTC calendar days', () => {
    expect(
      periodDayCount('2025-04-10T00:00:00.000Z', '2025-04-21T23:45:00.000Z'),
    ).toBe(12)
    expect(
      periodDayCount('2025-05-08T00:00:00.000Z', '2025-05-08T23:45:00.000Z'),
    ).toBe(1)
  })
})

describe('buildHeadline', () => {
  it('describes a missed target with the worst service', () => {
    const text = buildHeadline(baseStats())
    expect(text).toContain('Over these 12 days')
    expect(text).toContain('down for about')
    expect(text).toContain('search-api was the worst')
    expect(text).toContain('97.000%')
  })

  it('describes a met target', () => {
    const text = buildHeadline(
      baseStats({
        overall: {
          totalChecks: 1000,
          failedChecks: 1,
          availabilityPct: 99.95,
          meetsSla: true,
          allowedDowntimeMinutes: 151,
          actualDowntimeMinutes: 15,
        },
      }),
    )
    expect(text).toContain('met the 99.9% uptime target')
    expect(text).toContain('within the')
  })

  it('uses singular day wording for one day', () => {
    const text = buildHeadline(
      baseStats({
        upload: {
          id: 1,
          filename: 'sample.csv',
          uploadedAt: '2025-04-10T00:00:00.000Z',
          dataStart: '2025-04-10T00:00:00.000Z',
          dataEnd: '2025-04-10T23:45:00.000Z',
          rowsReceived: 100,
          rowsKept: 90,
          rowsDropped: 10,
        },
        overall: {
          totalChecks: 480,
          failedChecks: 0,
          availabilityPct: 100,
          meetsSla: true,
          allowedDowntimeMinutes: 7.2,
          actualDowntimeMinutes: 0,
        },
      }),
    )
    expect(text).toContain('Over these 1 day')
    expect(text).toContain('met the 99.9% uptime target')
  })

  it('handles zero failures as meeting the target', () => {
    const text = buildHeadline(
      baseStats({
        overall: {
          totalChecks: 1000,
          failedChecks: 0,
          availabilityPct: 100,
          meetsSla: true,
          allowedDowntimeMinutes: 151,
          actualDowntimeMinutes: 0,
        },
      }),
    )
    expect(text).toContain('met the 99.9% uptime target')
    expect(text).toContain('0 min')
  })
})
