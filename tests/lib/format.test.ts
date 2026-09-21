import { describe, expect, it } from 'vitest'
import {
  formatDateTime,
  formatNumber,
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
