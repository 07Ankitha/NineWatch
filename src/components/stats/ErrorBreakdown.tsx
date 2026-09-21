import type { StatsErrorBreakdown } from '../../lib/api.ts'
import { formatNumber } from '../../lib/format.ts'

type ErrorBreakdownProps = {
  errorBreakdown: StatsErrorBreakdown[]
}

export default function ErrorBreakdown({ errorBreakdown }: ErrorBreakdownProps) {
  const statusCodes = [...new Set(errorBreakdown.map((row) => row.statusCode))].sort(
    (a, b) => a - b,
  )
  const serviceIds = [...new Set(errorBreakdown.map((row) => row.serviceId))].sort()
  const counts = new Map(
    errorBreakdown.map((row) => [`${row.serviceId}:${row.statusCode}`, row.count]),
  )

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
        Error breakdown
      </h3>
      {errorBreakdown.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-400">No non-2xx responses in this upload.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-neutral-500">
                <th className="whitespace-nowrap py-2 pr-4 font-medium">Service</th>
                {statusCodes.map((code) => (
                  <th key={code} className="whitespace-nowrap py-2 pr-4 font-medium tabular-nums">
                    {code}
                  </th>
                ))}
                <th className="whitespace-nowrap py-2 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {serviceIds.map((serviceId) => {
                const total = statusCodes.reduce(
                  (sum, code) => sum + (counts.get(`${serviceId}:${code}`) ?? 0),
                  0,
                )
                return (
                  <tr
                    key={serviceId}
                    className="border-b border-neutral-800/80 last:border-0"
                  >
                    <td className="whitespace-nowrap py-2 pr-4 text-neutral-200">{serviceId}</td>
                    {statusCodes.map((code) => (
                      <td
                        key={code}
                        className="whitespace-nowrap py-2 pr-4 tabular-nums text-neutral-300"
                      >
                        {formatNumber(counts.get(`${serviceId}:${code}`) ?? 0)}
                      </td>
                    ))}
                    <td className="whitespace-nowrap py-2 font-medium tabular-nums text-neutral-100">
                      {formatNumber(total)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
