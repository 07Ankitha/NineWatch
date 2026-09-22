import { useState } from 'react'
import { HOW_TO_READ_LINES, HOW_TO_READ_TITLE } from '../lib/copy.ts'

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={`h-5 w-5 shrink-0 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path
        d="M5 7.5L10 12.5L15 7.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function HowToRead() {
  const [open, setOpen] = useState(false)

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/50">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          {HOW_TO_READ_TITLE}
          <Chevron open={open} />
        </button>
      </h2>
      <div className={open ? 'border-t border-neutral-800 px-4 pb-4 pt-3' : 'hidden'}>
        <ul className="space-y-2 text-sm leading-relaxed text-neutral-300">
          {HOW_TO_READ_LINES.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}
