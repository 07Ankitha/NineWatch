import { describe, expect, it } from 'vitest'
import { CHECK_INTERVAL_MINUTES, INCIDENT_MERGE_GAP_MINUTES } from '../../api/_lib/config'
import {
  mergeOutagesIntoIncidents,
  type OutageSegment,
} from '../../api/_lib/incidents'

function segment(
  overrides: Partial<OutageSegment> &
    Pick<OutageSegment, 'startedAt' | 'endedAt' | 'failedChecks'>,
): OutageSegment {
  return {
    serviceId: 'svc-search',
    serviceName: 'search-api',
    statusCodes: [503],
    ...overrides,
  }
}

describe('mergeOutagesIntoIncidents', () => {
  it('merges when the gap is exactly 30 minutes', () => {
    const incidents = mergeOutagesIntoIncidents([
      segment({
        startedAt: new Date('2025-04-14T12:00:00.000Z'),
        endedAt: new Date('2025-04-14T13:00:00.000Z'),
        failedChecks: 4,
        statusCodes: [503],
      }),
      segment({
        startedAt: new Date('2025-04-14T13:30:00.000Z'),
        endedAt: new Date('2025-04-14T14:00:00.000Z'),
        failedChecks: 2,
        statusCodes: [502],
      }),
    ])

    expect(incidents).toHaveLength(1)
    expect(incidents[0].segments).toBe(2)
    expect(incidents[0].failedChecks).toBe(6)
    expect(incidents[0].statusCodes).toEqual([502, 503])
    expect(incidents[0].startedAt.toISOString()).toBe('2025-04-14T12:00:00.000Z')
    expect(incidents[0].endedAt.toISOString()).toBe('2025-04-14T14:00:00.000Z')
  })

  it('does not merge when the gap is 31 minutes', () => {
    const incidents = mergeOutagesIntoIncidents([
      segment({
        startedAt: new Date('2025-04-14T12:00:00.000Z'),
        endedAt: new Date('2025-04-14T13:00:00.000Z'),
        failedChecks: 4,
      }),
      segment({
        startedAt: new Date('2025-04-14T13:31:00.000Z'),
        endedAt: new Date('2025-04-14T14:00:00.000Z'),
        failedChecks: 2,
      }),
    ])

    expect(incidents).toHaveLength(2)
    expect(incidents[0].segments).toBe(1)
    expect(incidents[1].segments).toBe(1)
  })

  it('never merges outages from different services', () => {
    const incidents = mergeOutagesIntoIncidents([
      segment({
        startedAt: new Date('2025-04-14T12:00:00.000Z'),
        endedAt: new Date('2025-04-14T13:00:00.000Z'),
        failedChecks: 4,
      }),
      segment({
        serviceId: 'svc-auth',
        serviceName: 'auth-api',
        startedAt: new Date('2025-04-14T13:00:00.000Z'),
        endedAt: new Date('2025-04-14T13:30:00.000Z'),
        failedChecks: 2,
      }),
    ])

    expect(incidents).toHaveLength(2)
    expect(incidents.map((row) => row.serviceId).sort()).toEqual(['svc-auth', 'svc-search'])
  })

  it('sets downtime to failed checks * 15, not the window length', () => {
    const incidents = mergeOutagesIntoIncidents([
      segment({
        startedAt: new Date('2025-04-14T12:00:00.000Z'),
        endedAt: new Date('2025-04-14T13:00:00.000Z'),
        failedChecks: 3,
      }),
      segment({
        startedAt: new Date('2025-04-14T13:15:00.000Z'),
        endedAt: new Date('2025-04-14T16:00:00.000Z'),
        failedChecks: 5,
      }),
    ])

    expect(incidents).toHaveLength(1)
    expect(incidents[0].windowMinutes).toBe(240)
    expect(incidents[0].failedChecks).toBe(8)
    expect(incidents[0].downtimeMinutes).toBe(8 * CHECK_INTERVAL_MINUTES)
    expect(incidents[0].downtimeMinutes).not.toBe(incidents[0].windowMinutes)
  })

  it('uses the configured default merge gap of 30 minutes', () => {
    expect(INCIDENT_MERGE_GAP_MINUTES).toBe(30)
  })
})
