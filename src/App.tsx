import { useState, type ReactNode } from 'react'
import StatsSection from './components/stats/StatsSection.tsx'
import UploadCard from './components/upload/UploadCard.tsx'
import type { UploadResult } from './lib/api.ts'

function activeUploadLabel(upload: UploadResult | null): string | null {
  if (!upload) return null
  return `Active upload: #${upload.uploadId} - ${upload.filename}`
}

function PlaceholderCard({
  title,
  children,
  activeUpload,
}: {
  title: string
  children: ReactNode
  activeUpload: UploadResult | null
}) {
  const label = activeUploadLabel(activeUpload)

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-6 shadow-sm">
      <h2 className="text-lg font-semibold tracking-tight text-neutral-50">
        {title}
      </h2>
      <div className="mt-3 space-y-2">
        <p className="text-sm text-neutral-400">{children}</p>
        {label && <p className="text-sm text-neutral-300">{label}</p>}
      </div>
    </section>
  )
}

function App() {
  const [activeUpload, setActiveUpload] = useState<UploadResult | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [statsOpen, setStatsOpen] = useState(true)

  function handleUploaded(result: UploadResult): void {
    setActiveUpload(result)
    setRefreshKey((key) => key + 1)
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-50 sm:text-4xl">
            NineWatch
          </h1>
          <p className="mt-2 max-w-2xl text-base text-neutral-400">
            Turn messy uptime logs into trustworthy SLA numbers.
          </p>
        </header>

        <UploadCard onUploaded={handleUploaded} />

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-6 shadow-sm">
          <h2>
            <button
              type="button"
              aria-expanded={statsOpen}
              onClick={() => setStatsOpen((open) => !open)}
              className="flex w-full items-center justify-between gap-3 rounded-lg text-left text-lg font-semibold tracking-tight text-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
            >
              SLA Stats
              <svg
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
                className={`h-5 w-5 shrink-0 text-neutral-400 transition-transform ${statsOpen ? 'rotate-180' : ''}`}
              >
                <path
                  d="M5 7.5L10 12.5L15 7.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </h2>
          {statsOpen && (
            <div className="mt-4">
              <StatsSection
                uploadId={activeUpload?.uploadId}
                refreshKey={refreshKey}
              />
            </div>
          )}
        </section>

        <PlaceholderCard title="Check Logs" activeUpload={activeUpload}>
          Log table will appear here.
        </PlaceholderCard>
      </div>
    </div>
  )
}

export default App
