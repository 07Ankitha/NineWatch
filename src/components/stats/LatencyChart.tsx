import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { StatsService } from '../../lib/api.ts'
import { formatMs } from '../../lib/format.ts'

type LatencyChartProps = {
  services: StatsService[]
}

const tooltipStyle = {
  backgroundColor: '#171717',
  border: '1px solid #404040',
  borderRadius: '8px',
  color: '#f5f5f5',
}

const LATENCY_SERIES = [
  { key: 'p50', label: 'p50', color: '#56B4E9' },
  { key: 'p95', label: 'p95', color: '#E69F00' },
  { key: 'p99', label: 'p99', color: '#CC79A7' },
] as const

export default function LatencyChart({ services }: LatencyChartProps) {
  const ordered = [...services].sort((a, b) => a.serviceId.localeCompare(b.serviceId))
  const data = ordered.map((service) => ({
    service: service.serviceName,
    p50: service.p50LatencyMs,
    p95: service.p95LatencyMs,
    p99: service.p99LatencyMs,
  }))

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
        Latency by service
      </h3>
      {data.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-400">No latency data.</p>
      ) : (
        <div className="mt-4 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
              <XAxis
                dataKey="service"
                tick={{ fill: '#a3a3a3', fontSize: 11 }}
                stroke="#525252"
              />
              <YAxis
                tickFormatter={(value: number) => formatMs(value)}
                tick={{ fill: '#a3a3a3', fontSize: 11 }}
                stroke="#525252"
                width={64}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value, name) => [
                  typeof value === 'number' ? formatMs(value) : '—',
                  String(name),
                ]}
              />
              <Legend wrapperStyle={{ color: '#e5e5e5', fontSize: 12 }} />
              {LATENCY_SERIES.map((series) => (
                <Bar
                  key={series.key}
                  dataKey={series.key}
                  name={series.label}
                  fill={series.color}
                  maxBarSize={28}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
