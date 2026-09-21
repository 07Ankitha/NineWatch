import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { StatsDailyAvailability } from '../../lib/api.ts'
import { colorForService, dailyAvailabilityYDomain } from '../../lib/chart.ts'
import { formatDay, formatPercent } from '../../lib/format.ts'

type DailyAvailabilityChartProps = {
  dailyAvailability: StatsDailyAvailability[]
  slaTargetPct: number
}

const tooltipStyle = {
  backgroundColor: '#171717',
  border: '1px solid #404040',
  borderRadius: '8px',
  color: '#f5f5f5',
}

export default function DailyAvailabilityChart({
  dailyAvailability,
  slaTargetPct,
}: DailyAvailabilityChartProps) {
  const serviceIds = [...new Set(dailyAvailability.map((row) => row.serviceId))].sort()
  const days = [...new Set(dailyAvailability.map((row) => row.day))].sort()
  const lookup = new Map(
    dailyAvailability.map((row) => [`${row.serviceId}:${row.day}`, row.availabilityPct]),
  )
  const points = days.map((day) => {
    const point: Record<string, string | number | null> = { day }
    for (const serviceId of serviceIds) {
      point[serviceId] = lookup.get(`${serviceId}:${day}`) ?? null
    }
    return point
  })
  const yValues = dailyAvailability.map((row) => row.availabilityPct)
  const domain = dailyAvailabilityYDomain(yValues)

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
        Daily availability
      </h3>
      {points.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-400">No daily availability data.</p>
      ) : (
        <div className="mt-4 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
              <XAxis
                dataKey="day"
                tickFormatter={formatDay}
                tick={{ fill: '#a3a3a3', fontSize: 11 }}
                stroke="#525252"
              />
              <YAxis
                domain={domain}
                tickFormatter={(value: number) => formatPercent(value, 1)}
                tick={{ fill: '#a3a3a3', fontSize: 11 }}
                stroke="#525252"
                width={64}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(label) => formatDay(String(label))}
                formatter={(value, name) => [
                  typeof value === 'number' ? formatPercent(value) : '—',
                  String(name),
                ]}
              />
              <Legend wrapperStyle={{ color: '#e5e5e5', fontSize: 12 }} />
              <ReferenceLine
                y={slaTargetPct}
                stroke="#fafafa"
                strokeDasharray="6 4"
                label={{
                  value: `SLA ${formatPercent(slaTargetPct, 1)}`,
                  fill: '#d4d4d4',
                  fontSize: 11,
                  position: 'insideTopRight',
                }}
              />
              {serviceIds.map((serviceId) => (
                <Line
                  key={serviceId}
                  type="monotone"
                  dataKey={serviceId}
                  name={serviceId}
                  stroke={colorForService(serviceId, serviceIds)}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
