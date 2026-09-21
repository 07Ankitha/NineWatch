// Okabe–Ito palette without yellow/black so lines stay readable on a dark chart.
export const SERVICE_CHART_COLORS = [
  '#56B4E9',
  '#E69F00',
  '#009E73',
  '#CC79A7',
  '#0072B2',
  '#D55E00',
  '#882255',
] as const

export function colorForService(serviceId: string, serviceIds: readonly string[]): string {
  const unique = [...new Set(serviceIds)].sort()
  const index = unique.indexOf(serviceId)
  const fallback = index < 0 ? 0 : index
  return SERVICE_CHART_COLORS[fallback % SERVICE_CHART_COLORS.length]
}

export function dailyAvailabilityYDomain(values: number[]): [number, number] {
  const finite = values.filter((value) => Number.isFinite(value))
  if (finite.length === 0) return [99, 100]
  const min = Math.min(...finite)
  const lower = Math.min(99, Math.floor(min) - 1)
  return [lower, 100]
}
