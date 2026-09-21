import { describe, expect, it } from 'vitest'
import { colorForService, dailyAvailabilityYDomain } from '../../src/lib/chart.ts'

describe('dailyAvailabilityYDomain', () => {
  it('uses floor(min) - 1 and caps the top at 100', () => {
    expect(dailyAvailabilityYDomain([99.802, 100, 99.9])).toEqual([98, 100])
    expect(dailyAvailabilityYDomain([100])).toEqual([99, 100])
    expect(dailyAvailabilityYDomain([50.2])).toEqual([49, 100])
  })

  it('defaults near the SLA band when there is no data', () => {
    expect(dailyAvailabilityYDomain([])).toEqual([99, 100])
  })
})

describe('colorForService', () => {
  it('assigns stable colors by sorted service id', () => {
    const ids = ['svc-search', 'svc-auth']
    expect(colorForService('svc-auth', ids)).toBe(colorForService('svc-auth', ['svc-auth', 'svc-search']))
    expect(colorForService('svc-auth', ids)).not.toBe(colorForService('svc-search', ids))
  })
})
