/**
 * Minimaler CLI-Runner für Integrationstests (Agent/CI freundlich).
 *
 * Nutzung (Beispiele):
 *   INTERNAL_TEST_TOKEN=... node scripts/run-integration-tests.mjs --libraryId <id> --folderId <id>
 *   node scripts/run-integration-tests.mjs --libraryId <id> --folderId <id> --userEmail <mail> --testCaseIds a,b,c
 *
 * Exit-Codes:
 *  - 0: alle Tests grün
 *  - 1: mindestens ein Test fehlgeschlagen / HTTP Fehler / Exception
 */

// WICHTIG:
// Wir laden `.env`, damit INTERNAL_TEST_TOKEN / NEXT_PUBLIC_APP_URL etc. im CLI verfügbar sind.
// (Ohne das müsste man alle Variablen manuell in der Shell exportieren.)
import 'dotenv/config'

const args = process.argv.slice(2)

function getArg(name, fallback) {
  const idx = args.findIndex(a => a === `--${name}`)
  if (idx < 0) return fallback
  const val = args[idx + 1]
  return typeof val === 'string' ? val : fallback
}

function parseCsv(value) {
  if (!value) return undefined
  const list = value.split(',').map(s => s.trim()).filter(Boolean)
  return list.length ? list : undefined
}

const baseUrl = (getArg('baseUrl', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000') || 'http://localhost:3000').replace(/\/$/, '')
const libraryId = getArg('libraryId', '')
const folderId = getArg('folderId', 'root') || 'root'
const userEmail = getArg('userEmail', process.env.INTEGRATION_TEST_USER_EMAIL || '')
const testCaseIds = parseCsv(getArg('testCaseIds', '')) // optional
const fileIds = parseCsv(getArg('fileIds', '')) // optional
const fileKind = getArg('fileKind', '') || undefined
const templateName = getArg('templateName', '') || undefined
const jobTimeoutMsRaw = getArg('jobTimeoutMs', '')
const jobTimeoutMs = jobTimeoutMsRaw ? Number(jobTimeoutMsRaw) : undefined

if (!libraryId) {
  console.error('Fehler: --libraryId ist erforderlich')
  process.exit(1)
}
if (!userEmail) {
  console.error('Fehler: --userEmail ist erforderlich (oder env INTEGRATION_TEST_USER_EMAIL)')
  process.exit(1)
}

const token = String(process.env.INTERNAL_TEST_TOKEN || '').trim()
if (!token) {
  console.error('Fehler: INTERNAL_TEST_TOKEN fehlt (muss gesetzt sein)')
  process.exit(1)
}

async function main() {
  const body = {
    libraryId,
    folderId,
    userEmail,
    // Wenn keine testCaseIds übergeben werden, interpretiert die API das als "alle Testfälle".
    testCaseIds: testCaseIds,
    fileIds,
    fileKind: (fileKind === 'audio' || fileKind === 'pdf') ? fileKind : undefined,
    jobTimeoutMs: Number.isFinite(jobTimeoutMs) ? jobTimeoutMs : undefined,
    templateName: templateName === 'auto' ? undefined : templateName,
  }

  const res = await fetch(`${baseUrl}/api/integration-tests/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': token,
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = { raw: text } }

  if (!res.ok) {
    console.error(JSON.stringify({ ok: false, status: res.status, statusText: res.statusText, response: json }, null, 2))
    process.exit(1)
  }

  // Maschine-lesbar ausgeben:
  console.log(JSON.stringify(json, null, 2))

  const failed = json?.summary?.failed
  if (typeof failed === 'number' && failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error('Exception:', e?.message || String(e))
  process.exit(1)
})

