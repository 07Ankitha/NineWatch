import { getStats, parseUploadIdParam } from './_lib/stats'

function jsonResponse(
  status: number,
  payload: unknown,
  extraHeaders?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  })
}

async function handleStats(request: Request): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' }, { Allow: 'GET' })
  }

  try {
    const uploadIdParam = new URL(request.url).searchParams.get('uploadId')
    const parsed = parseUploadIdParam(uploadIdParam)
    if (parsed === 'invalid') {
      return jsonResponse(400, { error: 'uploadId must be a number' })
    }

    const result = await getStats(parsed === 'missing' ? undefined : parsed)
    if (result.status === 'empty') {
      return jsonResponse(200, { upload: null })
    }
    if (result.status === 'not_found') {
      return jsonResponse(404, { error: 'Upload not found' })
    }
    return jsonResponse(200, result.body)
  } catch (error) {
    console.error('Failed to load stats:', error)
    return jsonResponse(500, { error: 'Internal server error' })
  }
}

export default {
  fetch(request: Request): Promise<Response> {
    return handleStats(request)
  },
}
