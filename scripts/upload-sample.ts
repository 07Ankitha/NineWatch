import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'

const csvPath = process.argv[2]
if (!csvPath) {
  console.error('Usage: tsx scripts/upload-sample.ts <csv-path>')
  process.exit(1)
}

const text = await readFile(csvPath, 'utf8')
const response = await fetch('http://localhost:3000/api/process-upload', {
  method: 'POST',
  headers: {
    'Content-Type': 'text/csv',
    'x-filename': basename(csvPath),
  },
  body: text,
})

const raw = await response.text()
console.log(`HTTP ${response.status}`)
try {
  console.log(JSON.stringify(JSON.parse(raw), null, 2))
} catch {
  console.log(raw)
}

if (!response.ok) {
  process.exit(1)
}
