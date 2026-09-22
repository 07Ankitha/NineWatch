import { describeStatus } from './copy.ts'
import { formatNumber } from './format.ts'

export type ServiceOption = {
  serviceId: string
  serviceName: string
}

export function formatStatus(statusCode: number, isSuccess: boolean): string {
  if (isSuccess) return 'OK'
  return describeStatus(statusCode)
}

export function showingChecksLabel(
  page: number,
  pageSize: number,
  total: number,
): string {
  if (total <= 0) return 'Showing 0 of 0 checks'
  const start = (page - 1) * pageSize + 1
  if (start > total) return `Showing 0 of ${formatNumber(total)} checks`
  const end = Math.min(page * pageSize, total)
  return `Showing ${formatNumber(start)}-${formatNumber(end)} of ${formatNumber(total)} checks`
}

export function isStartAfterEnd(from: string, to: string): boolean {
  if (from === '' || to === '') return false
  return from > to
}

export function utcDateInputValue(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}
