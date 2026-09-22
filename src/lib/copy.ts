import type { StatsResponse, StatsService } from './api.ts'
import { formatDuration, formatPercent } from './format.ts'

export const APP_SUBTITLE =
  'Upload your service health logs and see how reliable your services really were.'

export const HOW_TO_READ_TITLE = 'How to read this page'

export const HOW_TO_READ_LINES = [
  'Uptime: the share of health checks that succeeded. A check runs every 15 minutes.',
  'Target: 99.9% uptime, about 43 minutes of allowed downtime per 30 days.',
  'Failed check: the service did not respond correctly when tested.',
  'Speed: how long a response took. Lower is better.',
] as const

export const DAILY_CHART_TITLE = 'How reliable each day was'
export const DAILY_CHART_CAPTION =
  'Each line shows how often a service worked each day. Dips mean bad days. The dashed line is the 99.9% target.'

export const SPEED_CHART_TITLE = 'Response speed by service'
export const SPEED_CHART_CAPTION =
  "How long responses took. Shorter bars are better. 'Slowest 5%' means the slowest 1 in 20 requests."

export const INCIDENTS_TITLE = 'Longer failures'
export const INCIDENTS_SUBTITLE =
  'Problems that lasted a while. Failures within 30 minutes of each other are grouped into one problem. Downtime counts only the failed checks.'

export const ERROR_BREAKDOWN_TITLE = 'What kind of errors happened'
export const ERROR_BREAKDOWN_CAPTION =
  'Server errors mean the service itself failed, not the user.'

export const DATA_CLEANING_TITLE = 'How we cleaned your data'
export const DATA_CLEANING_FOOTER =
  'This is routine cleaning. It was done before the numbers above were calculated.'

export const UPLOAD_DETAILS_NOTE =
  "Details are in 'How we cleaned your data' below."

export const LOGS_UTC_NOTE = 'All times are in UTC (universal time)'

export type SeverityId = 'meets' | 'slightly' | 'below' | 'far'

export type Severity = {
  id: SeverityId
  label: string
  /** Tailwind classes for badge background + text */
  badgeClass: string
  /** Tailwind classes for bordered panel accents */
  panelClass: string
  /** Tailwind classes for progress fill */
  barClass: string
}

const SEVERITIES: Record<SeverityId, Severity> = {
  meets: {
    id: 'meets',
    label: 'Meets target',
    badgeClass: 'bg-emerald-500/20 text-emerald-100',
    panelClass: 'border-emerald-500/40 bg-emerald-950/30',
    barClass: 'bg-emerald-400',
  },
  slightly: {
    id: 'slightly',
    label: 'Slightly below',
    badgeClass: 'bg-amber-500/20 text-amber-100',
    panelClass: 'border-amber-500/40 bg-amber-950/25',
    barClass: 'bg-amber-400',
  },
  below: {
    id: 'below',
    label: 'Below target',
    badgeClass: 'bg-orange-500/20 text-orange-100',
    panelClass: 'border-orange-500/40 bg-orange-950/25',
    barClass: 'bg-orange-400',
  },
  far: {
    id: 'far',
    label: 'Far below target',
    badgeClass: 'bg-rose-500/20 text-rose-100',
    panelClass: 'border-rose-500/40 bg-rose-950/30',
    barClass: 'bg-rose-400',
  },
}

export function getSeverity(availabilityPct: number): Severity {
  if (availabilityPct >= 99.9) return SEVERITIES.meets
  if (availabilityPct >= 99.5) return SEVERITIES.slightly
  if (availabilityPct >= 98) return SEVERITIES.below
  return SEVERITIES.far
}

export function describeStatus(code: number): string {
  if (code === 500) return 'Server error'
  if (code === 502) return 'Bad gateway'
  if (code === 503) return 'Service unavailable'
  if (code === 504) return 'Timeout'
  if (code >= 500 && code < 600) return `Server error (${code})`
  return `Error (${code})`
}

export function burstsLabel(segments: number): string {
  return segments === 1 ? '1 burst' : `${segments} bursts`
}

/** Ratio text when actual downtime exceeds allowance. Null when within budget. */
export function overAllowanceText(
  actualMinutes: number,
  allowedMinutes: number,
): string | null {
  if (allowedMinutes <= 0 || actualMinutes <= allowedMinutes) return null
  const times = actualMinutes / allowedMinutes
  if (times < 10) {
    const rounded = Math.round(times * 10) / 10
    const display = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
    return `About ${display}x more than allowed`
  }
  return `About ${Math.round(times)}x more than allowed`
}

export function periodDayCount(
  dataStart: string | null,
  dataEnd: string | null,
): number {
  if (!dataStart || !dataEnd) return 0
  const start = new Date(dataStart)
  const end = new Date(dataEnd)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  const startDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())
  const endDay = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())
  return Math.max(1, Math.round((endDay - startDay) / 86_400_000) + 1)
}

function dayWord(days: number): string {
  return days === 1 ? '1 day' : `${days} days`
}

function worstService(services: StatsService[]): StatsService | null {
  if (services.length === 0) return null
  return [...services].sort((a, b) => {
    if (a.availabilityPct !== b.availabilityPct) {
      return a.availabilityPct - b.availabilityPct
    }
    return a.serviceId.localeCompare(b.serviceId)
  })[0]
}

export function buildHeadline(stats: StatsResponse): string {
  const days = periodDayCount(stats.upload.dataStart, stats.upload.dataEnd)
  const dayPart = dayWord(days === 0 ? 1 : days)
  const actual = formatDuration(stats.overall.actualDowntimeMinutes)
  const allowed = formatDuration(stats.overall.allowedDowntimeMinutes)

  if (stats.overall.meetsSla || stats.overall.failedChecks === 0) {
    if (stats.overall.failedChecks === 0) {
      return `Over these ${dayPart}, your services met the 99.9% uptime target. Total downtime was about ${actual}, within the ${allowed} allowed.`
    }
    return `Over these ${dayPart}, your services met the 99.9% uptime target. Total downtime was about ${actual}, within the ${allowed} allowed.`
  }

  const worst = worstService(stats.services)
  const worstName = worst?.serviceName ?? 'One service'
  const worstPct = formatPercent(worst?.availabilityPct ?? stats.overall.availabilityPct)

  return `Over these ${dayPart}, your services were down for about ${actual} in total. The promise allowed no more than ${allowed}. ${worstName} was the worst, working correctly ${worstPct} of the time.`
}

export function targetBadgeLabel(meetsSla: boolean): string {
  return meetsSla ? 'Target met' : 'Target not met (goal: 99.9% uptime)'
}
