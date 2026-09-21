import { describe, expect, it } from 'vitest'
import {
  formatDateTime,
  formatDay,
  formatDuration,
  formatLogTime,
  formatMs,
  formatNumber,
  formatPercent,
  humanizeIssueType,
} from '../../src/lib/format.ts'

describe('formatNumber', () => {
  it('adds grouping separators', () => {
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber(1284)).toBe('1,284')
    expect(formatNumber(1000000)).toBe('1,000,000')
  })
})

describe('formatDateTime', () => {
  it('formats an ISO timestamp in UTC', () => {
    expect(formatDateTime('2025-05-08T00:00:00.000Z')).toBe(
      '8 May 2025, 00:00 UTC',
    )
  })

  it('formats a Date instance in UTC', () => {
    expect(formatDateTime(new Date('2025-05-14T23:59:00.000Z'))).toBe(
      '14 May 2025, 23:59 UTC',
    )
  })

  it('returns Unknown for invalid input', () => {
    expect(formatDateTime('not-a-date')).toBe('Unknown')
  })
})

describe('humanizeIssueType', () => {
  it('maps known cleaning issue types', () => {
    expect(humanizeIssueType('duplicate_row')).toBe('Duplicate rows removed')
    expect(humanizeIssueType('missing_latency')).toBe('Missing latency values')
    expect(humanizeIssueType('negative_latency')).toBe('Negative latency values')
    expect(humanizeIssueType('invalid_status')).toBe('Invalid status codes')
    expect(humanizeIssueType('unit_converted')).toBe(
      'Latency converted from seconds to ms',
    )
    expect(humanizeIssueType('timezone_normalized')).toBe(
      'Timestamps with timezone offset converted to UTC',
    )
    expect(humanizeIssueType('epoch_converted')).toBe('Unix timestamps converted')
    expect(humanizeIssueType('conflicting_duplicate')).toBe(
      'Conflicting duplicates resolved',
    )
  })

  it('title-cases unknown issue types and removes underscores', () => {
    expect(humanizeIssueType('naive_timestamp_assumed_utc')).toBe(
      'Naive Timestamp Assumed Utc',
    )
  })
})

describe('formatPercent', () => {
  it('uses 3 decimal places by default', () => {
    expect(formatPercent(99.9)).toBe('99.900%')
    expect(formatPercent(98.77)).toBe('98.770%')
  })
})

describe('formatDuration', () => {
  it('formats minutes, hours, and days', () => {
    expect(formatDuration(45)).toBe('45 min')
    expect(formatDuration(135)).toBe('2 h 15 min')
    expect(formatDuration(60)).toBe('1 h')
    expect(formatDuration(1620)).toBe('1 d 3 h')
    expect(formatDuration(1440)).toBe('1 d')
  })
})

describe('formatMs', () => {
  it('uses ms below one second and seconds at or above', () => {
    expect(formatMs(146)).toBe('146 ms')
    expect(formatMs(1200)).toBe('1.2 s')
  })
})

describe('formatDay', () => {
  it('formats a UTC calendar day', () => {
    expect(formatDay('2025-04-03')).toBe('3 Apr')
  })
})

describe('formatLogTime', () => {
  it('includes seconds', () => {
    expect(formatLogTime('2025-05-08T00:30:00.000Z')).toBe(
      '8 May 2025, 00:30:00',
    )
  })
})
