import type { ParsedLatency, ParsedTimestamp, TimestampKind } from './types'

const MIN_YEAR = 2000
const MAX_YEAR = 2100

const ISO_UTC_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z$/
const ISO_OFFSET_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?[+-]\d{2}:\d{2}$/
const ISO_NAIVE_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?$/

function yearInRange(date: Date): boolean {
  if (Number.isNaN(date.getTime())) return false
  const year = date.getUTCFullYear()
  return year >= MIN_YEAR && year <= MAX_YEAR
}

function parsedDate(date: Date, kind: TimestampKind): ParsedTimestamp | null {
  if (!yearInRange(date)) return null
  return { date, kind }
}

export function parseTimestamp(raw: unknown): ParsedTimestamp | null {
  if (raw === null || raw === undefined) return null
  const text = String(raw).trim()
  if (text === '') return null

  if (/^\d{10}$/.test(text)) {
    return parsedDate(new Date(Number(text) * 1000), 'epoch')
  }
  if (/^\d{13}$/.test(text)) {
    return parsedDate(new Date(Number(text)), 'epoch')
  }

  if (ISO_UTC_RE.test(text)) {
    return parsedDate(new Date(text), 'iso_utc')
  }
  if (ISO_OFFSET_RE.test(text)) {
    return parsedDate(new Date(text), 'offset')
  }
  if (ISO_NAIVE_RE.test(text)) {
    return parsedDate(new Date(`${text}Z`), 'naive_assumed_utc')
  }

  return null
}

export function parseStatusCode(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null
  const text = String(raw).trim()
  if (!/^-?\d+$/.test(text)) return null
  const value = Number(text)
  if (!Number.isInteger(value) || value < 100 || value > 599) return null
  return value
}

function parseFiniteNumber(text: string): number | null {
  if (text === '' || !/^-?\d+(\.\d+)?$/.test(text)) return null
  const value = Number(text)
  return Number.isFinite(value) ? value : null
}

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100
}

export function parseLatency(raw: unknown, unit: unknown): ParsedLatency {
  const latencyText = raw === null || raw === undefined ? '' : String(raw).trim()
  const unitText = unit === null || unit === undefined ? '' : String(unit).trim().toLowerCase()

  if (latencyText === '') {
    return { value: null, converted: false, problem: 'missing' }
  }

  const parsed = parseFiniteNumber(latencyText)
  if (parsed === null) {
    return { value: null, converted: false, problem: 'unparseable' }
  }

  if (unitText !== 'ms' && unitText !== 's') {
    return { value: null, converted: false, problem: 'unknown_unit' }
  }

  if (parsed < 0) {
    return { value: null, converted: false, problem: 'negative' }
  }

  if (unitText === 's') {
    return { value: roundTo2(parsed * 1000), converted: true, problem: null }
  }

  return { value: parsed, converted: false, problem: null }
}
