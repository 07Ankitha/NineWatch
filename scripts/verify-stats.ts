import { config } from 'dotenv'
import { readdir, readFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getDb } from '../api/_lib/db'
import { getStats, toNumber } from '../api/_lib/stats'

config()

type IncidentLog = Record<
  string,
  {
    days: number
    start: string
    incidents: Record<string, string>
  }
>

type TrueIncident = {
  key: string
  serviceId: string
  dayOffset: number
  windowStart: Date
  windowEnd: Date
  raw: string
}

const CHECK_MINUTES = 15
const API_URL = process.env.API_URL ?? 'http://localhost:3000'
const sampleDir = join(dirname(fileURLToPath(import.meta.url)), '../sample-data')

function pad(value: string, width: number): string {
  return value.length >= width ? value : `${value}${' '.repeat(width - value.length)}`
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart <= bEnd && bStart <= aEnd
}

function parseIncidentKey(key: string): { serviceId: string; dayOffset: number } {
  const match = /^(svc-[a-z0-9-]+) day (\d+)$/.exec(key)
  if (!match) {
    throw new Error(`Cannot parse incident key: ${key}`)
  }
  return { serviceId: match[1], dayOffset: Number(match[2]) }
}

function parseIncidentWindow(
  startDay: string,
  dayOffset: number,
  description: string,
): { windowStart: Date; windowEnd: Date } {
  const match = /check-points (\d+)-(\d+)/.exec(description)
  if (!match) {
    throw new Error(`Cannot parse incident window: ${description}`)
  }
  const day = new Date(`${startDay}T00:00:00.000Z`)
  day.setUTCDate(day.getUTCDate() + dayOffset)
  const windowStart = new Date(day.getTime() + Number(match[1]) * CHECK_MINUTES * 60 * 1000)
  // Last check-point is inclusive; the check covers the following 15-minute slot.
  const windowEnd = new Date(
    day.getTime() + (Number(match[2]) + 1) * CHECK_MINUTES * 60 * 1000,
  )
  return { windowStart, windowEnd }
}

function loadIncidents(log: IncidentLog, filename: string): TrueIncident[] {
  const entry = log[filename]
  if (!entry) {
    throw new Error(`No incident log entry for ${filename}`)
  }
  return Object.entries(entry.incidents).map(([key, raw]) => {
    const { serviceId, dayOffset } = parseIncidentKey(key)
    const { windowStart, windowEnd } = parseIncidentWindow(entry.start, dayOffset, raw)
    return { key, serviceId, dayOffset, windowStart, windowEnd, raw }
  })
}

async function findCompletedUploadId(filename: string): Promise<number | null> {
  const sql = getDb()
  const rows = await sql<Record<string, unknown>>`
    SELECT id
    FROM uploads
    WHERE filename = ${filename}
      AND status = 'completed'
    ORDER BY id DESC
    LIMIT 1
  `
  const id = rows[0]?.id
  return id == null ? null : toNumber(id)
}

async function uploadCsv(path: string): Promise<number> {
  const filename = basename(path)
  const text = await readFile(path, 'utf8')
  const response = await fetch(`${API_URL}/api/process-upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/csv',
      'x-filename': filename,
    },
    body: text,
  })
  const raw = await response.text()
  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    throw new Error(
      `Upload of ${filename} failed (${response.status}). Is \`npm run dev:api\` running?\n${raw}`,
    )
  }
  if (!response.ok || payload == null || typeof payload !== 'object') {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : raw
    throw new Error(`Upload of ${filename} failed (${response.status}): ${message}`)
  }
  const uploadId = (payload as { uploadId?: unknown }).uploadId
  if (typeof uploadId !== 'number') {
    throw new Error(`Upload of ${filename} did not return an uploadId`)
  }
  return uploadId
}

async function ensureUpload(path: string): Promise<number> {
  const filename = basename(path)
  const existing = await findCompletedUploadId(filename)
  if (existing != null) {
    console.log(`Using stored upload #${existing} for ${filename}`)
    return existing
  }
  console.log(`Uploading ${filename} via ${API_URL} ...`)
  const id = await uploadCsv(path)
  console.log(`Stored as upload #${id}`)
  return id
}

function fmt(date: Date): string {
  return date.toISOString().replace('.000Z', 'Z')
}

async function main() {
  const log = JSON.parse(
    await readFile(join(sampleDir, 'dataset_incident_log.json'), 'utf8'),
  ) as IncidentLog

  const csvFiles = (await readdir(sampleDir))
    .filter((name) => name.startsWith('monitoring_checks_') && name.endsWith('.csv'))
    .sort()

  if (csvFiles.length !== 5) {
    throw new Error(`Expected 5 sample CSVs, found ${csvFiles.length}`)
  }

  type Row = {
    file: string
    incidents: number
    detected: number
    matched: number
    unmatched: number
    missed: number
    pass: boolean
  }

  const summary: Row[] = []
  let anyFail = false

  for (const file of csvFiles) {
    const incidents = loadIncidents(log, file)
    const uploadId = await ensureUpload(join(sampleDir, file))
    const result = await getStats(uploadId)
    if (result.status !== 'ok') {
      throw new Error(`getStats(${uploadId}) returned ${result.status}`)
    }

    const detected = result.body.outages
    const missed: TrueIncident[] = []
    let matchedIncidents = 0

    console.log(`\n${file} (upload #${uploadId})`)

    for (const incident of incidents) {
      const overlapping = detected.filter(
        (outage) =>
          outage.serviceId === incident.serviceId &&
          overlaps(
            new Date(outage.startedAt),
            new Date(outage.endedAt),
            incident.windowStart,
            incident.windowEnd,
          ),
      )
      if (overlapping.length === 0) {
        missed.push(incident)
        console.log(
          `  MISS  ${incident.key}  ${fmt(incident.windowStart)} – ${fmt(incident.windowEnd)}  (${incident.raw})`,
        )
        continue
      }
      matchedIncidents += 1
      console.log(
        `  HIT   ${incident.key}  ${fmt(incident.windowStart)} – ${fmt(incident.windowEnd)}  (${incident.raw})`,
      )
      for (const outage of overlapping) {
        console.log(
          `        outage ${outage.serviceId} ${outage.startedAt} – ${outage.endedAt}  (${outage.failedChecks} failed, ${outage.durationMinutes} min)`,
        )
      }
    }

    const unmatched = detected.filter(
      (outage) =>
        !incidents.some(
          (incident) =>
            incident.serviceId === outage.serviceId &&
            overlaps(
              new Date(outage.startedAt),
              new Date(outage.endedAt),
              incident.windowStart,
              incident.windowEnd,
            ),
        ),
    )
    if (unmatched.length > 0) {
      console.log('  Extra detected outages (informational)')
      for (const outage of unmatched) {
        console.log(
          `    ${outage.serviceId} ${outage.startedAt} – ${outage.endedAt}  (${outage.failedChecks} failed, ${outage.durationMinutes} min)`,
        )
      }
    }

    const pass = missed.length === 0
    if (!pass) anyFail = true
    summary.push({
      file,
      incidents: incidents.length,
      detected: detected.length,
      matched: matchedIncidents,
      unmatched: unmatched.length,
      missed: missed.length,
      pass,
    })
  }

  console.log('\nSummary')
  console.log(
    `${pad('dataset', 38)} ${pad('true', 6)} ${pad('found', 6)} ${pad('hit', 5)} ${pad('miss', 5)} ${pad('extra', 6)} result`,
  )
  for (const row of summary) {
    console.log(
      `${pad(row.file, 38)} ${pad(String(row.incidents), 6)} ${pad(String(row.detected), 6)} ${pad(String(row.matched), 5)} ${pad(String(row.missed), 5)} ${pad(String(row.unmatched), 6)} ${row.pass ? 'PASS' : 'FAIL'}`,
    )
  }
  console.log('result = PASS when every true incident was detected; extra outages are informational.')

  if (anyFail) {
    console.error('\nOne or more true incidents were missed.')
    process.exit(1)
  }

  console.log('\nAll true incidents were detected.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
