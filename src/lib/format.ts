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

export function humanizeIssueType(issueType: string): string {
  const mapped = ISSUE_LABELS[issueType]
  if (mapped) return mapped

  return issueType
    .split('_')
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}
