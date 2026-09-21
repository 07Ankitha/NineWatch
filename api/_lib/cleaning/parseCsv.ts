import Papa from 'papaparse'
import type { RawRow } from './types.js'

export const REQUIRED_HEADERS = [
  'service_id',
  'service_name',
  'timestamp',
  'status_code',
  'latency',
  'latency_unit',
  'agent',
  'region',
] as const

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export type ParsedCsvRow = {
  sourceRow: number
  raw: RawRow
}

function toRawRow(row: Record<string, string | undefined>): RawRow {
  return {
    service_id: row.service_id ?? '',
    service_name: row.service_name ?? '',
    timestamp: row.timestamp ?? '',
    status_code: row.status_code ?? '',
    latency: row.latency ?? '',
    latency_unit: row.latency_unit ?? '',
    agent: row.agent ?? '',
    region: row.region ?? '',
  }
}

export function parseCsv(csvText: string): ParsedCsvRow[] {
  if (csvText.trim() === '') {
    throw new ValidationError('CSV file is empty (0 data rows)')
  }

  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
    transform: (value) => value.trim(),
  })

  const fields = parsed.meta.fields ?? []
  const missing = REQUIRED_HEADERS.filter((header) => !fields.includes(header))
  if (missing.length > 0) {
    throw new ValidationError(
      `CSV is missing required columns: ${missing.join(', ')}`,
    )
  }

  if (parsed.data.length === 0) {
    throw new ValidationError('CSV file is empty (0 data rows)')
  }

  return parsed.data.map((row, index) => ({
    sourceRow: index + 2,
    raw: toRawRow(row),
  }))
}
