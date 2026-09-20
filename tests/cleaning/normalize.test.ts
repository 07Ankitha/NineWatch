import { describe, expect, it } from 'vitest'
import {
  parseLatency,
  parseStatusCode,
  parseTimestamp,
} from '../../api/_lib/cleaning/normalize'

describe('parseTimestamp', () => {
  it('parses ISO UTC', () => {
    const result = parseTimestamp('2025-05-08T00:30:00Z')
    expect(result).not.toBeNull()
    expect(result?.kind).toBe('iso_utc')
    expect(result?.date.toISOString()).toBe('2025-05-08T00:30:00.000Z')
  })

  it('parses 10-digit unix epoch seconds', () => {
    const result = parseTimestamp('1746938700')
    expect(result).not.toBeNull()
    expect(result?.kind).toBe('epoch')
    expect(result?.date.toISOString()).toBe(
      new Date(1746938700 * 1000).toISOString(),
    )
  })

  it('parses 13-digit unix epoch milliseconds', () => {
    const result = parseTimestamp('1746938700000')
    expect(result).not.toBeNull()
    expect(result?.kind).toBe('epoch')
    expect(result?.date.toISOString()).toBe(
      new Date(1746938700000).toISOString(),
    )
  })

  it('parses ISO with a timezone offset', () => {
    const result = parseTimestamp('2025-05-08T06:00:00+05:30')
    expect(result).not.toBeNull()
    expect(result?.kind).toBe('offset')
    expect(result?.date.toISOString()).toBe('2025-05-08T00:30:00.000Z')
  })

  it('assumes UTC for naive ISO timestamps', () => {
    const result = parseTimestamp('2025-05-08T00:30:00')
    expect(result).not.toBeNull()
    expect(result?.kind).toBe('naive_assumed_utc')
    expect(result?.date.toISOString()).toBe('2025-05-08T00:30:00.000Z')
  })

  it('returns null for invalid values', () => {
    expect(parseTimestamp('')).toBeNull()
    expect(parseTimestamp('not-a-date')).toBeNull()
    expect(parseTimestamp('2025/05/08 00:30:00')).toBeNull()
  })

  it('rejects years outside 2000-2100', () => {
    expect(parseTimestamp('1999-12-31T23:59:59Z')).toBeNull()
    expect(parseTimestamp('2101-01-01T00:00:00Z')).toBeNull()
    expect(parseTimestamp('946684799')).toBeNull()
  })

  it('accepts the year bounds 2000 and 2100', () => {
    expect(parseTimestamp('2000-01-01T00:00:00Z')?.kind).toBe('iso_utc')
    expect(parseTimestamp('2100-12-31T23:59:59Z')?.kind).toBe('iso_utc')
  })
})

describe('parseStatusCode', () => {
  it('parses success and failure codes in range', () => {
    expect(parseStatusCode(200)).toBe(200)
    expect(parseStatusCode('200')).toBe(200)
    expect(parseStatusCode('503')).toBe(503)
  })

  it('rejects 999, non-integers, and blanks', () => {
    expect(parseStatusCode('999')).toBeNull()
    expect(parseStatusCode(999)).toBeNull()
    expect(parseStatusCode('abc')).toBeNull()
    expect(parseStatusCode('')).toBeNull()
  })
})

describe('parseLatency', () => {
  it('keeps millisecond values as-is', () => {
    expect(parseLatency('707', 'ms')).toEqual({
      value: 707,
      converted: false,
      problem: null,
    })
  })

  it('converts seconds to milliseconds rounded to 2 decimals', () => {
    expect(parseLatency('0.717', 's')).toEqual({
      value: 717,
      converted: true,
      problem: null,
    })
    expect(parseLatency('1.23456', 's')).toEqual({
      value: 1234.56,
      converted: true,
      problem: null,
    })
  })

  it('treats blank latency as missing', () => {
    expect(parseLatency('', 'ms')).toEqual({
      value: null,
      converted: false,
      problem: 'missing',
    })
    expect(parseLatency('   ', 's')).toEqual({
      value: null,
      converted: false,
      problem: 'missing',
    })
  })

  it('treats negative latency as a problem', () => {
    expect(parseLatency('-286', 'ms')).toEqual({
      value: null,
      converted: false,
      problem: 'negative',
    })
  })

  it('rejects unknown units', () => {
    expect(parseLatency('100', 'us')).toEqual({
      value: null,
      converted: false,
      problem: 'unknown_unit',
    })
  })

  it('rejects unparseable latency values', () => {
    expect(parseLatency('fast', 'ms')).toEqual({
      value: null,
      converted: false,
      problem: 'unparseable',
    })
  })
})
