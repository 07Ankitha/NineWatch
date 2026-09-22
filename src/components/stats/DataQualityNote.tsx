import { DATA_CLEANING_FOOTER, DATA_CLEANING_TITLE } from '../../lib/copy.ts'
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
      <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
        {DATA_CLEANING_TITLE}
      </h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-300">No cleaning changes were needed.</p>
      ) : (
        <ul className="mt-3 space-y-1.5 text-sm text-neutral-300">
          {rows.map(([type, count]) => (
            <li key={type} className="flex items-baseline justify-between gap-3">
              <span>{humanizeIssueType(type)}</span>
              <span className="tabular-nums text-neutral-100">{formatNumber(count)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs leading-relaxed text-neutral-400">{DATA_CLEANING_FOOTER}</p>
    </section>
  )
}
