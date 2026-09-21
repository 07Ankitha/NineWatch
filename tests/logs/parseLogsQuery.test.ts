import { describe, expect, it } from 'vitest'
import {
  parseLogsQuery,
  parseUtcDateString,
  utcExclusiveRange,
} from '../../api/_lib/logs'

describe('parseUtcDateString', () => {
  it('accepts a real calendar day', () => {
    expect(parseUtcDateString('2025-05-08')).toBe('2025-05-08')
  })

  it('rejects a bad format', () => {
    expect(parseUtcDateString('2025/05/08')).toBeNull()
    expect(parseUtcDateString('2025-5-8')).toBeNull()
  })

  it('rejects an impossible date', () => {
    expect(parseUtcDateString('2025-02-31')).toBeNull()
    expect(parseUtcDateString('2025-02-29')).toBeNull()
  })

  it('accepts a leap day', () => {
    expect(parseUtcDateString('2024-02-29')).toBe('2024-02-29')
  })
})

describe('utcExclusiveRange', () => {
  it('uses UTC midnight of from and the day after to', () => {
    const range = utcExclusiveRange('2025-05-08', '2025-05-08')
    expect(range.start.toISOString()).toBe('2025-05-08T00:00:00.000Z')
    expect(range.endExclusive.toISOString()).toBe('2025-05-09T00:00:00.000Z')
  })

  it('crosses a month boundary', () => {
    const range = utcExclusiveRange('2025-01-31', '2025-02-01')
    expect(range.start.toISOString()).toBe('2025-01-31T00:00:00.000Z')
    expect(range.endExclusive.toISOString()).toBe('2025-02-02T00:00:00.000Z')
  })

  it('handles a leap day', () => {
    const range = utcExclusiveRange('2024-02-29', '2024-02-29')
    expect(range.start.toISOString()).toBe('2024-02-29T00:00:00.000Z')
    expect(range.endExclusive.toISOString()).toBe('2024-03-01T00:00:00.000Z')
  })
})

describe('parseLogsQuery', () => {
  it('parses a valid single date', () => {
    const result = parseLogsQuery('http://localhost/api/logs?date=2025-05-08')
    expect(result).toEqual({
      ok: true,
      value: {
        uploadId: undefined,
        from: '2025-05-08',
        to: '2025-05-08',
        service: null,
        failuresOnly: false,
        page: 1,
        pageSize: 50,
      },
    })
  })

  it('parses a valid from/to range', () => {
    const result = parseLogsQuery(
      'http://localhost/api/logs?from=2025-05-08&to=2025-05-10&service=svc-auth',
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.from).toBe('2025-05-08')
    expect(result.value.to).toBe('2025-05-10')
    expect(result.value.service).toBe('svc-auth')
  })

  it('lets date beat from/to', () => {
    const result = parseLogsQuery(
      'http://localhost/api/logs?date=2025-05-08&from=2025-05-01&to=2025-05-31',
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.from).toBe('2025-05-08')
    expect(result.value.to).toBe('2025-05-08')
  })

  it('rejects from later than to', () => {
    const result = parseLogsQuery(
      'http://localhost/api/logs?from=2025-05-10&to=2025-05-01',
    )
    expect(result).toEqual({
      ok: false,
      error: 'from must be on or before to',
    })
  })

  it('rejects a bad date format', () => {
    const result = parseLogsQuery('http://localhost/api/logs?date=08-05-2025')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/YYYY-MM-DD/)
  })

  it('rejects an impossible date', () => {
    const result = parseLogsQuery('http://localhost/api/logs?date=2025-02-31')
    expect(result).toEqual({
      ok: false,
      error: '2025-02-31 is not a valid calendar date',
    })
  })

  it('applies defaults', () => {
    const result = parseLogsQuery('http://localhost/api/logs')
    expect(result).toEqual({
      ok: true,
      value: {
        uploadId: undefined,
        from: null,
        to: null,
        service: null,
        failuresOnly: false,
        page: 1,
        pageSize: 50,
      },
    })
  })

  it('caps pageSize at 200', () => {
    const result = parseLogsQuery('http://localhost/api/logs?pageSize=500')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.pageSize).toBe(200)
  })

  it('parses failuresOnly', () => {
    const on = parseLogsQuery('http://localhost/api/logs?failuresOnly=true')
    expect(on.ok).toBe(true)
    if (on.ok) expect(on.value.failuresOnly).toBe(true)

    const off = parseLogsQuery('http://localhost/api/logs?failuresOnly=false')
    expect(off.ok).toBe(true)
    if (off.ok) expect(off.value.failuresOnly).toBe(false)

    const bad = parseLogsQuery('http://localhost/api/logs?failuresOnly=yes')
    expect(bad.ok).toBe(false)
  })

  it('rejects a non-numeric uploadId', () => {
    const result = parseLogsQuery('http://localhost/api/logs?uploadId=abc')
    expect(result).toEqual({ ok: false, error: 'uploadId must be a number' })
  })

  it('rejects invalid page and pageSize', () => {
    expect(parseLogsQuery('http://localhost/api/logs?page=0').ok).toBe(false)
    expect(parseLogsQuery('http://localhost/api/logs?page=abc').ok).toBe(false)
    expect(parseLogsQuery('http://localhost/api/logs?pageSize=-1').ok).toBe(false)
  })
})
