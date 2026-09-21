import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchStats, uploadCsv } from '../../src/lib/api.ts'
import { validateCsvFile } from '../../src/components/upload/UploadCard.tsx'

const summary = {
  rowsReceived: 10,
  rowsKept: 8,
  rowsDropped: 2,
  dataStart: '2025-05-08T00:00:00.000Z',
  dataEnd: '2025-05-14T23:59:00.000Z',
  issueCounts: { duplicate_row: 2 },
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('validateCsvFile', () => {
  it('rejects non-csv names', () => {
    expect(validateCsvFile({ name: 'log.txt', size: 12 })).toBe(
      'Please choose a .csv file.',
    )
  })

  it('rejects empty files', () => {
    expect(validateCsvFile({ name: 'log.csv', size: 0 })).toBe(
      'That file is empty. Please choose a CSV with some rows in it.',
    )
  })

  it('rejects files over 4 MB', () => {
    expect(validateCsvFile({ name: 'log.csv', size: 4_000_001 })).toBe(
      'That file is over 4 MB. Please choose a smaller CSV.',
    )
  })

  it('accepts a non-empty csv under the size limit', () => {
    expect(validateCsvFile({ name: 'LOG.CSV', size: 128 })).toBeNull()
  })
})

describe('uploadCsv', () => {
  it('POSTs the file text with csv headers and parses a 201 result', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        alreadyProcessed: false,
        uploadId: 42,
        filename: 'uptime.csv',
        summary,
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const file = new File(['service_id,ts\n1,2'], 'uptime.csv', {
      type: 'text/csv',
    })
    const result = await uploadCsv(file)

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      { method: string; headers: Record<string, string>; body: string },
    ]
    expect(url).toBe('/api/process-upload')
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('text/csv')
    expect(init.headers['x-filename']).toBe('uptime.csv')
    expect(init.body).toBe('service_id,ts\n1,2')
    expect(result).toEqual({
      alreadyProcessed: false,
      uploadId: 42,
      filename: 'uptime.csv',
      summary,
    })
  })

  it('falls back to the local filename when the 200 body omits it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          alreadyProcessed: true,
          uploadId: 7,
          summary,
        }),
      }),
    )

    const file = new File(['a,b'], 'replay.csv', { type: 'text/csv' })
    const result = await uploadCsv(file)
    expect(result.alreadyProcessed).toBe(true)
    expect(result.filename).toBe('replay.csv')
    expect(result.uploadId).toBe(7)
  })

  it('throws the server error message on a non-2xx JSON body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Request body is empty' }),
      }),
    )

    const file = new File(['x'], 'bad.csv', { type: 'text/csv' })
    await expect(uploadCsv(file)).rejects.toThrow('Request body is empty')
  })

  it('throws a generic message when the error body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('invalid json')
        },
      }),
    )

    const file = new File(['x'], 'bad.csv', { type: 'text/csv' })
    await expect(uploadCsv(file)).rejects.toThrow(
      'Upload failed. Please try again.',
    )
  })
})

const statsBody = {
  upload: {
    id: 8,
    filename: 'log.csv',
    uploadedAt: '2026-09-21T05:00:00.000Z',
    dataStart: '2025-04-03T00:00:00.000Z',
    dataEnd: '2025-04-23T23:45:00.000Z',
    rowsReceived: 10,
    rowsKept: 8,
    rowsDropped: 2,
  },
  slaTargetPct: 99.9,
  overall: {
    totalChecks: 8,
    failedChecks: 1,
    availabilityPct: 87.5,
    meetsSla: false,
    allowedDowntimeMinutes: 12.96,
    actualDowntimeMinutes: 15,
  },
  services: [],
  outages: [],
  incidents: [],
  errorBreakdown: [],
  dailyAvailability: [],
  dataQuality: { issueCounts: { duplicate_row: 2 } },
}

describe('fetchStats', () => {
  it('GETs /api/stats and returns null when no upload is stored', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ upload: null }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchStats()).resolves.toBeNull()
    expect(fetchMock).toHaveBeenCalledWith('/api/stats', expect.anything())
  })

  it('requests a specific uploadId and parses the body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => statsBody,
      }),
    )

    const result = await fetchStats(8)
    expect(result?.upload.id).toBe(8)
    expect(result?.slaTargetPct).toBe(99.9)
    expect(result?.dataQuality.issueCounts.duplicate_row).toBe(2)
  })

  it('throws the server error message on a non-2xx body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Upload not found' }),
      }),
    )

    await expect(fetchStats(99)).rejects.toThrow('Upload not found')
  })
})
