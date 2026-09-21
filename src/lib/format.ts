const ISSUE_LABELS: Record<string, string> = {
  duplicate_row: 'Duplicate rows removed',
  missing_latency: 'Missing latency values',
  negative_latency: 'Negative latency values',
  invalid_status: 'Invalid status codes',
  unit_converted: 'Latency converted from seconds to ms',
  timezone_normalized: 'Timestamps with timezone offset converted to UTC',
  epoch_converted: 'Unix timestamps converted',
  conflicting_duplicate: 'Conflicting duplicates resolved',
}

export function formatNumber(value: number): string {
  return value.toLocaleString('en-US')
}

export function formatDateTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(date)

  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? ''

  return `${read('day')} ${read('month')} ${read('year')}, ${read('hour')}:${read('minute')} UTC`
}

export function formatPercent(value: number, decimals = 3): string {
  return `${value.toFixed(decimals)}%`
}

export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes))
  if (total < 60) return `${total} min`

  const days = Math.floor(total / (24 * 60))
  const hours = Math.floor((total - days * 24 * 60) / 60)
  const mins = total % 60

  if (days > 0) {
    return hours > 0 ? `${days} d ${hours} h` : `${days} d`
  }
  return mins > 0 ? `${hours} h ${mins} min` : `${hours} h`
}

export function formatMs(ms: number): string {
  if (!Number.isFinite(ms)) return '—'
  if (Math.abs(ms) >= 1000) {
    return `${(ms / 1000).toFixed(1)} s`
  }
  return `${Number.isInteger(ms) ? String(ms) : ms.toFixed(0)} ms`
}

export function formatDay(value: string | Date): string {
  const date =
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T00:00:00.000Z`)
      : value instanceof Date
        ? value
        : new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  }).formatToParts(date)
  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? ''
  return `${read('day')} ${read('month')}`
}

export function humanizeIssueType(issueType: string): string {
  const mapped = ISSUE_LABELS[issueType]
  if (mapped) return mapped

  return issueType
    .split('_')
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}
