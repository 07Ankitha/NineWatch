import { getLogs, parseLogsQuery } from './_lib/logs'

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

async function handleLogs(request: Request): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' }, { Allow: 'GET' })
  }

  try {
    const parsed = parseLogsQuery(request.url)
    if (!parsed.ok) {
      return jsonResponse(400, { error: parsed.error })
    }

    const result = await getLogs(parsed.value)
    if (result.status === 'empty') {
      return jsonResponse(200, { upload: null })
    }
    if (result.status === 'not_found') {
      return jsonResponse(404, { error: 'Upload not found' })
    }
    return jsonResponse(200, result.body)
  } catch (error) {
    console.error('Failed to load logs:', error)
    return jsonResponse(500, { error: 'Internal server error' })
  }
}

export default {
  fetch(request: Request): Promise<Response> {
    return handleLogs(request)
  },
}
