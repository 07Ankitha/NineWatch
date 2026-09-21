export type UploadSummary = {
  rowsReceived: number
  rowsKept: number
  rowsDropped: number
  dataStart: string | null
  dataEnd: string | null
  issueCounts: Record<string, number>
}

export type UploadResult = {
  alreadyProcessed: boolean
  uploadId: number
  filename: string
  summary: UploadSummary
}

const GENERIC_UPLOAD_ERROR = 'Upload failed. Please try again.'

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function errorFromPayload(data: unknown): string {
  if (
    isRecord(data) &&
    typeof data.error === 'string' &&
    data.error.trim() !== ''
  ) {
    return data.error
  }
  return GENERIC_UPLOAD_ERROR
}

function parseIssueCounts(value: unknown): Record<string, number> | null {
  if (!isRecord(value)) return null
  const issueCounts: Record<string, number> = {}
  for (const [key, count] of Object.entries(value)) {
    if (typeof count !== 'number' || !Number.isFinite(count)) return null
    issueCounts[key] = count
  }
  return issueCounts
}

function parseSummary(value: unknown): UploadSummary | null {
  if (!isRecord(value)) return null
  if (typeof value.rowsReceived !== 'number') return null
  if (typeof value.rowsKept !== 'number') return null
  if (typeof value.rowsDropped !== 'number') return null
  if (value.dataStart !== null && typeof value.dataStart !== 'string') return null
  if (value.dataEnd !== null && typeof value.dataEnd !== 'string') return null
  const issueCounts = parseIssueCounts(value.issueCounts)
  if (!issueCounts) return null
  return {
    rowsReceived: value.rowsReceived,
    rowsKept: value.rowsKept,
    rowsDropped: value.rowsDropped,
    dataStart: value.dataStart,
    dataEnd: value.dataEnd,
    issueCounts,
  }
}

function parseUploadResult(data: unknown, fallbackFilename: string): UploadResult {
  if (!isRecord(data)) {
    throw new Error(GENERIC_UPLOAD_ERROR)
  }

  const summary = parseSummary(data.summary)
  if (
    typeof data.alreadyProcessed !== 'boolean' ||
    typeof data.uploadId !== 'number' ||
    !Number.isFinite(data.uploadId) ||
    !summary
  ) {
    throw new Error(GENERIC_UPLOAD_ERROR)
  }

  const filename =
    typeof data.filename === 'string' && data.filename.trim() !== ''
      ? data.filename
      : fallbackFilename

  return {
    alreadyProcessed: data.alreadyProcessed,
    uploadId: data.uploadId,
    filename,
    summary,
  }
}

export async function uploadCsv(file: File): Promise<UploadResult> {
  const text = await file.text()
  const response = await fetch('/api/process-upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/csv',
      'x-filename': file.name,
    },
    body: text,
  })

  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new Error(GENERIC_UPLOAD_ERROR)
  }

  if (!response.ok) {
    throw new Error(errorFromPayload(data))
  }

  return parseUploadResult(data, file.name)
}
