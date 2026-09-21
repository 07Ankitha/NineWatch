import { describe, expect, it } from 'vitest'
import {
  formatStatus,
  isStartAfterEnd,
  showingChecksLabel,
} from '../../src/lib/logsView.ts'

describe('formatStatus', () => {
  it('labels 2xx as OK and others as Error', () => {
    expect(formatStatus(200, true)).toBe('200 OK')
    expect(formatStatus(503, false)).toBe('503 Error')
  })
})

describe('showingChecksLabel', () => {
  it('formats a normal page range', () => {
    expect(showingChecksLabel(1, 50, 1234)).toBe('Showing 1-50 of 1,234 checks')
    expect(showingChecksLabel(2, 50, 1234)).toBe('Showing 51-100 of 1,234 checks')
  })

  it('handles an empty or past-the-end page', () => {
    expect(showingChecksLabel(1, 50, 0)).toBe('Showing 0 of 0 checks')
    expect(showingChecksLabel(9999, 50, 1234)).toBe('Showing 0 of 1,234 checks')
  })
})

describe('isStartAfterEnd', () => {
  it('detects an inverted UTC date range', () => {
    expect(isStartAfterEnd('2025-05-10', '2025-05-01')).toBe(true)
    expect(isStartAfterEnd('2025-05-01', '2025-05-10')).toBe(false)
    expect(isStartAfterEnd('', '2025-05-10')).toBe(false)
  })
})
