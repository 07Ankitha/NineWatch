import { createHash } from 'node:crypto'
import { cleanCsv, ValidationError } from './_lib/cleaning'
import {
  deleteUpload,
  findUploadByHash,
  getUploadSummary,
  saveCleanResult,
} from './_lib/uploads'

const MAX_BODY_BYTES = 4_000_000

function jsonResponse(
  status: number,
  payload: unknown,
  extraHeaders?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  })
}

function fileSha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

async function readBodyText(request: Request): Promise<
  { ok: true; text: string } | { ok: false; response: Response }
> {
  const contentLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return {
      ok: false,
      response: jsonResponse(413, {
        error: 'Request body exceeds the 4,000,000 byte limit',
      }),
    }
  }

  const buffer = Buffer.from(await request.arrayBuffer())
  if (buffer.length > MAX_BODY_BYTES) {
    return {
      ok: false,
      response: jsonResponse(413, {
        error: 'Request body exceeds the 4,000,000 byte limit',
      }),
    }
  }
  if (buffer.length === 0) {
    return {
      ok: false,
      response: jsonResponse(400, { error: 'Request body is empty' }),
    }
  }

  return { ok: true, text: buffer.toString('utf8') }
}

async function handleProcessUpload(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' }, { Allow: 'POST' })
  }

  const body = await readBodyText(request)
  if (!body.ok) return body.response

  const filename = request.headers.get('x-filename')?.trim() || 'upload.csv'
  const hash = fileSha256(body.text)

  try {
    const existing = await findUploadByHash(hash)
    if (existing?.status === 'completed') {
      const summary = await getUploadSummary(existing.id)
      if (summary) {
        return jsonResponse(200, {
          alreadyProcessed: true,
          uploadId: existing.id,
          summary,
        })
      }
    } else if (existing && (existing.status === 'processing' || existing.status === 'failed')) {
      await deleteUpload(existing.id)
    }

    const result = cleanCsv(body.text)
    const saved = await saveCleanResult({
      filename,
      fileSha256: hash,
      result,
    })

    if (saved.alreadyProcessed) {
      return jsonResponse(200, {
        alreadyProcessed: true,
        uploadId: saved.uploadId,
        summary: saved.summary,
      })
    }

    return jsonResponse(201, {
      alreadyProcessed: false,
      uploadId: saved.uploadId,
      filename: saved.filename,
      summary: saved.summary,
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return jsonResponse(400, { error: error.message })
    }
    console.error('Failed to process upload:', error)
    return jsonResponse(500, { error: 'Internal server error' })
  }
}

export default {
  fetch(request: Request): Promise<Response> {
    return handleProcessUpload(request)
  },
}
