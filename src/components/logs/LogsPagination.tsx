import { showingChecksLabel } from '../../lib/logsView.ts'

type LogsPaginationProps = {
  page: number
  pageSize: number
  total: number
  totalPages: number
  onPage: (page: number) => void
  onPageSize: (pageSize: number) => void
}

const PAGE_SIZES = [25, 50, 100]

export default function LogsPagination({
  page,
  pageSize,
  total,
  totalPages,
  onPage,
  onPageSize,
}: LogsPaginationProps) {
  const lastPage = Math.max(1, totalPages)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-neutral-300" aria-live="polite">
        {showingChecksLabel(page, pageSize, total)}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-neutral-400">
          Page size
          <select
            value={pageSize}
            onChange={(event) => onPageSize(Number(event.target.value))}
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <p className="text-neutral-400">
          Page {page} of {Math.max(totalPages, 1)}
        </p>
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="rounded-lg border border-neutral-600 px-3 py-1 text-neutral-100 hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={page >= lastPage || total === 0}
          onClick={() => onPage(page + 1)}
          className="rounded-lg border border-neutral-600 px-3 py-1 text-neutral-100 hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  )
}
