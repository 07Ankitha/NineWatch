import type { LogsRow } from '../../lib/api.ts'
import { formatLogTime, formatMs } from '../../lib/format.ts'
import { formatStatus } from '../../lib/logsView.ts'

type LogsTableProps = {
  rows: LogsRow[]
  dimmed?: boolean
}

function StatusIcon({ ok }: { ok: boolean }) {
  if (ok) {
    return (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
        <path
          d="M3.5 8.5L6.5 11.5L12.5 4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
      <path
        d="M8 3L13.5 13H2.5L8 3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M8 7V9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="11.4" r="0.6" fill="currentColor" />
    </svg>
  )
}

export default function LogsTable({ rows, dimmed = false }: LogsTableProps) {
  return (
    <div className={`max-h-[32rem] overflow-auto rounded-xl border border-neutral-800 ${dimmed ? 'opacity-50' : ''}`}>
      <table className="min-w-full text-left text-sm" aria-label="Uptime checks">
        <caption className="sr-only">Uptime checks for the selected filters</caption>
        <thead className="sticky top-0 z-10 bg-neutral-950">
          <tr className="border-b border-neutral-800 text-neutral-500">
            <th className="whitespace-nowrap px-3 py-2 font-medium">Time (UTC)</th>
            <th className="whitespace-nowrap px-3 py-2 font-medium">Service</th>
            <th className="whitespace-nowrap px-3 py-2 font-medium">Status</th>
            <th className="whitespace-nowrap px-3 py-2 font-medium">Latency</th>
            <th className="whitespace-nowrap px-3 py-2 font-medium">Agent</th>
            <th className="whitespace-nowrap px-3 py-2 font-medium">Region</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-neutral-800/80 last:border-0">
              <td className="whitespace-nowrap px-3 py-2 tabular-nums text-neutral-200">
                {formatLogTime(row.checkedAt)}
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                <span className="text-neutral-100">{row.serviceName}</span>
                <span className="ml-2 text-xs text-neutral-500">{row.serviceId}</span>
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    row.isSuccess
                      ? 'bg-emerald-500/15 text-emerald-100'
                      : 'bg-rose-500/15 text-rose-100'
                  }`}
                >
                  <StatusIcon ok={row.isSuccess} />
                  {formatStatus(row.statusCode, row.isSuccess)}
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-2 tabular-nums text-neutral-200">
                {row.latencyMs == null ? (
                  <span
                    className="text-neutral-500"
                    title="Latency was blank or invalid in the source file"
                  >
                    —
                  </span>
                ) : (
                  formatMs(row.latencyMs)
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-neutral-300">{row.agent}</td>
              <td className="whitespace-nowrap px-3 py-2 text-neutral-300">{row.region}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
