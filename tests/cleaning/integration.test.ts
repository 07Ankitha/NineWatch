import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { cleanCsv } from '../../api/_lib/cleaning'

const sampleDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../sample-data',
)

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

describe('cleanCsv sample-data integration', () => {
  const files = readdirSync(sampleDir)
    .filter((name) => name.startsWith('monitoring_checks_') && name.endsWith('.csv'))
    .sort()

  it('cleans all five monitoring CSV files and holds invariants', () => {
    expect(files).toHaveLength(5)

    const summaries: Array<{
      file: string
      received: number
      kept: number
      dropped: number
      issueCounts: Record<string, number>
    }> = []

    for (const file of files) {
      const csvText = readFileSync(join(sampleDir, file), 'utf8')
      const result = cleanCsv(csvText)
      const { checks, summary } = result

      expect(summary.rowsKept + summary.rowsDropped).toBe(summary.rowsReceived)
      expect(summary.rowsKept).toBe(checks.length)

      const keys = checks.map(
        (row) => `${row.serviceId}|${row.checkedAt.toISOString()}`,
      )
      expect(new Set(keys).size).toBe(keys.length)

      expect(checks.every((row) => row.statusCode !== 999)).toBe(true)
      expect(
        checks.every(
          (row) => row.latencyMs === null || row.latencyMs >= 0,
        ),
      ).toBe(true)
      expect(checks.every((row) => row.checkedAt instanceof Date)).toBe(true)
      expect(
        checks.every((row) => !Number.isNaN(row.checkedAt.getTime())),
      ).toBe(true)

      for (let i = 1; i < checks.length; i += 1) {
        const prev = checks[i - 1]
        const curr = checks[i]
        const byTime = prev.checkedAt.getTime() - curr.checkedAt.getTime()
        expect(byTime).toBeLessThanOrEqual(0)
        if (byTime === 0) {
          expect(prev.serviceId.localeCompare(curr.serviceId)).toBeLessThanOrEqual(
            0,
          )
        }
      }

      expect(checks.some((row) => row.statusCode >= 500 && row.statusCode <= 599)).toBe(
        true,
      )

      const searchLatencies = checks
        .filter((row) => row.serviceId === 'svc-search' && row.latencyMs !== null)
        .map((row) => row.latencyMs as number)
      expect(searchLatencies.length).toBeGreaterThan(0)
      const searchMedian = median(searchLatencies)
      expect(searchMedian).toBeGreaterThanOrEqual(50)
      expect(searchMedian).toBeLessThanOrEqual(5000)

      summaries.push({
        file,
        received: summary.rowsReceived,
        kept: summary.rowsKept,
        dropped: summary.rowsDropped,
        issueCounts: summary.issueCounts,
      })
    }

    console.log('\nCleaning summary by file')
    console.table(
      summaries.map((row) => ({
        file: row.file,
        received: row.received,
        kept: row.kept,
        dropped: row.dropped,
        ...row.issueCounts,
      })),
    )
  })
})
