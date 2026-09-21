import { formatNumber, humanizeIssueType } from '../../lib/format.ts'

type DataQualityNoteProps = {
  issueCounts: Record<string, number>
}

export default function DataQualityNote({ issueCounts }: DataQualityNoteProps) {
  const rows = Object.entries(issueCounts).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    return a[0].localeCompare(b[0])
  })

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Data quality
      </h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">No cleaning issues recorded.</p>
      ) : (
        <ul className="mt-3 space-y-1.5 text-sm text-neutral-400">
          {rows.map(([type, count]) => (
            <li key={type} className="flex items-baseline justify-between gap-3">
              <span>{humanizeIssueType(type)}</span>
              <span className="tabular-nums text-neutral-300">{formatNumber(count)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-sm text-neutral-500">
        These issues were fixed or removed before the statistics above were calculated.
      </p>
    </section>
  )
}
