#!/usr/bin/env node
/**
 * Testprozedur: Bild → Secretary Image Analyzer (POST /api/image-analyzer/process)
 * über denselben External-Job-Weg wie die UI (Integrationstest-Orchestrator).
 *
 * Voraussetzungen:
 *   - Next.js Dev-Server (npm run dev)
 *   - INTERNAL_TEST_TOKEN in .env / .env.local
 *   - Secretary mit Image-Analyzer (siehe docs/_secretary-service-docu/image-analyzer.md)
 *
 * PowerShell: Befehle mit Semikolon trennen, z. B.
 *   Set-Location $pwd; node scripts/test-image-pipeline.mjs
 *
 * Verwendung:
 *   node scripts/test-image-pipeline.mjs
 *   node scripts/test-image-pipeline.mjs --template "Diva-Texture-Analysis"
 *   node scripts/test-image-pipeline.mjs --testCaseId image_texture_analysis.diva_happy_path
 */

import { config } from 'dotenv'
import { existsSync } from 'fs'
import { resolve } from 'path'

for (const f of ['.env.development.local', '.env.local', '.env.development', '.env']) {
  const p = resolve(process.cwd(), f)
  if (existsSync(p)) config({ path: p })
}

const args = process.argv.slice(2)
function getArg(name, fallback) {
  const idx = args.findIndex((a) => a === `--${name}`)
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback
}

const BASE_URL = getArg('baseUrl', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
const LIBRARY_ID = getArg('libraryId', process.env.LIBRARY_ID || '4fd7473e-6bac-4577-85ed-ec68d96439f9')
const FILE_ID = getArg('fileId', process.env.FILE_ID || 'MDAwMTQ0NTY3OTAxMy90ZXh0dXJlcy9fdGV4LzkxMDZfMV9iYXNlY29sb3IuanBn')
const PARENT_ID = getArg('parentId', process.env.PARENT_ID || 'MDAwMTQ0NTY3OTAxMy90ZXh0dXJlcy9fdGV4')
const FILE_NAME = getArg('fileName', process.env.FILE_NAME || '9106_1_basecolor.jpg')
const TEMPLATE = getArg('template', process.env.TEMPLATE || 'Diva-Texture-Analysis')
const TOKEN = getArg('token', process.env.INTERNAL_TEST_TOKEN || process.env.INTERNAL_TOKEN || '')
const USER_EMAIL = getArg('userEmail', process.env.INTEGRATION_TEST_USER_EMAIL || 'peter.aichner@crystal-design.com')
/** Testfall aus test-cases.ts (target: image) */
const TEST_CASE_ID = getArg('testCaseId', 'image_texture_analysis.diva_happy_path')
const POLL_INTERVAL_MS = 3000
const MAX_POLL_ATTEMPTS = 60

if (!TOKEN) {
  console.error('❌ INTERNAL_TEST_TOKEN nicht gefunden.')
  console.error('   Beispiel: $env:INTERNAL_TEST_TOKEN="..."; node scripts/test-image-pipeline.mjs')
  process.exit(1)
}

const headers = {
  'Content-Type': 'application/json',
  'X-Internal-Token': TOKEN,
}

/**
 * End-to-End über /api/integration-tests/run: gleicher Pfad wie UI/Agent,
 * inkl. waitForJobCompletion und Validatoren.
 */
async function runIntegrationImageTest() {
  console.log('\n━━━ Integrationstest (Image Analyzer) ━━━')
  console.log(`  testCaseId: ${TEST_CASE_ID}`)
  console.log(`  fileKind:   image`)
  console.log(`  Library:    ${LIBRARY_ID}`)
  console.log(`  Datei:      ${FILE_NAME}`)

  const body = {
    libraryId: LIBRARY_ID,
    folderId: PARENT_ID,
    userEmail: USER_EMAIL,
    fileIds: [FILE_ID],
    fileKind: 'image',
    testCaseIds: [TEST_CASE_ID],
    templateName: TEMPLATE,
    jobTimeoutMs: 180_000,
  }

  const res = await fetch(`${BASE_URL}/api/integration-tests/run`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    console.error(`❌ Antwort ist kein JSON (${res.status}): ${text.slice(0, 500)}`)
    process.exit(1)
  }

  if (!res.ok) {
    console.error(`❌ Integration-Run fehlgeschlagen (${res.status}):`, data)
    process.exit(1)
  }

  console.log('\n━━━ Zusammenfassung ━━━')
  console.log(JSON.stringify(data.summary, null, 2))

  const results = Array.isArray(data.results) ? data.results : []
  for (const r of results) {
    const ok = r.ok ? '✓' : '✗'
    console.log(`\n  ${ok} ${r.testCaseId} | ${r.fileName} | jobId=${r.jobId}`)
    if (Array.isArray(r.messages)) {
      for (const m of r.messages) {
        const line = typeof m === 'object' && m?.message ? `${m.type || 'info'}: ${m.message}` : String(m)
        console.log(`      ${line}`)
      }
    }
  }

  const firstJobId = results[0]?.jobId
  if (firstJobId && firstJobId !== 'n/a') {
    console.log(`\n━━━ Optional: Job-Status abfragen ━━━`)
    console.log(`  GET ${BASE_URL}/api/external/jobs/${firstJobId}?userEmail=${encodeURIComponent(USER_EMAIL)}`)
    const job = await pollJob(firstJobId)
    showResult(job)
  }

  const failed = Number(data.summary?.failed || 0) > 0
  process.exit(failed ? 1 : 0)
}

async function pollJob(jobId) {
  const url = `${BASE_URL}/api/external/jobs/${jobId}?userEmail=${encodeURIComponent(USER_EMAIL)}`
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
    try {
      const res = await fetch(url, { headers })
      if (!res.ok) {
        console.log(`  [${i + 1}] HTTP ${res.status}`)
        continue
      }
      const job = await res.json()
      const status = job.status || 'unknown'
      const steps = (job.steps || []).map((s) => `${s.name}:${s.status}`).join(', ')
      console.log(`  [${i + 1}] ${status} | ${steps}`)
      if (status === 'completed' || status === 'failed') return job
    } catch (e) {
      console.log(`  [${i + 1}] ${e.message}`)
    }
  }
  console.log('  ⏰ Poll-Timeout')
  return null
}

function showResult(job) {
  if (!job) return
  if (job.status === 'failed' && job.error) {
    console.log(`  Letzter Fehler: ${job.error.code}: ${job.error.message}`)
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════╗')
  console.log('║  Image Pipeline (Secretary Image Analyzer)   ║')
  console.log('╚══════════════════════════════════════════════╝')
  console.log(`  Server:   ${BASE_URL}`)
  console.log(`  Datei:    ${FILE_NAME}`)
  console.log(`  Template: ${TEMPLATE}`)

  await runIntegrationImageTest()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
