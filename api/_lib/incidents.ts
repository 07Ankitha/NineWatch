import { CHECK_INTERVAL_MINUTES, INCIDENT_MERGE_GAP_MINUTES } from './config'

export type OutageSegment = {
  serviceId: string
  serviceName: string
  startedAt: Date
  endedAt: Date
  failedChecks: number
  statusCodes: number[]
}

export type MergedIncident = {
  serviceId: string
  serviceName: string
  startedAt: Date
  endedAt: Date
  windowMinutes: number
  failedChecks: number
  downtimeMinutes: number
  segments: number
  statusCodes: number[]
}

function gapMinutes(previousEndedAt: Date, nextStartedAt: Date): number {
  return (nextStartedAt.getTime() - previousEndedAt.getTime()) / 60_000
}

function mergeStatusCodes(segments: OutageSegment[]): number[] {
  const codes = new Set<number>()
  for (const segment of segments) {
    for (const code of segment.statusCodes) codes.add(code)
  }
  return [...codes].sort((a, b) => a - b)
}

function toIncident(segments: OutageSegment[]): MergedIncident {
  const startedAt = segments[0].startedAt
  const endedAt = segments.reduce(
    (latest, segment) => (segment.endedAt > latest ? segment.endedAt : latest),
    segments[0].endedAt,
  )
  const failedChecks = segments.reduce((sum, segment) => sum + segment.failedChecks, 0)
  return {
    serviceId: segments[0].serviceId,
    serviceName: segments[0].serviceName,
    startedAt,
    endedAt,
    windowMinutes: (endedAt.getTime() - startedAt.getTime()) / 60_000,
    failedChecks,
    downtimeMinutes: failedChecks * CHECK_INTERVAL_MINUTES,
    segments: segments.length,
    statusCodes: mergeStatusCodes(segments),
  }
}

/**
 * Merge consecutive multi-check outages for the same service when the gap
 * between one outage's endedAt and the next's startedAt is <= gapMinutes.
 */
export function mergeOutagesIntoIncidents(
  outages: OutageSegment[],
  gapMinutesLimit: number = INCIDENT_MERGE_GAP_MINUTES,
): MergedIncident[] {
  const sorted = [...outages].sort((a, b) => {
    if (a.serviceId !== b.serviceId) return a.serviceId.localeCompare(b.serviceId)
    if (a.startedAt.getTime() !== b.startedAt.getTime()) {
      return a.startedAt.getTime() - b.startedAt.getTime()
    }
    return a.endedAt.getTime() - b.endedAt.getTime()
  })

  const incidents: MergedIncident[] = []
  let current: OutageSegment[] = []

  for (const outage of sorted) {
    if (current.length === 0) {
      current = [outage]
      continue
    }
    const previous = current[current.length - 1]
    const sameService = previous.serviceId === outage.serviceId
    const withinGap = gapMinutes(previous.endedAt, outage.startedAt) <= gapMinutesLimit
    if (sameService && withinGap) {
      current.push(outage)
    } else {
      incidents.push(toIncident(current))
      current = [outage]
    }
  }

  if (current.length > 0) incidents.push(toIncident(current))
  return incidents
}
