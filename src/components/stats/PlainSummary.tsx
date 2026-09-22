import type { StatsResponse } from '../../lib/api.ts'
import { buildHeadline } from '../../lib/copy.ts'

type PlainSummaryProps = {
  stats: StatsResponse
}

export default function PlainSummary({ stats }: PlainSummaryProps) {
  return (
    <p className="rounded-xl border border-neutral-800 bg-neutral-950/40 px-4 py-3 text-sm leading-relaxed text-neutral-200">
      {buildHeadline(stats)}
    </p>
  )
}
