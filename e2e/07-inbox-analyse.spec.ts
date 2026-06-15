import { expect, test } from './fixtures'
import {
  Drehbuch,
  TEST_PREFIX,
  activateLibrary,
  assertInboxBinaryRef,
  createLibraryViaUi,
  findAnalyzeJob,
  findLibraryId,
  findSubmissionById,
} from './helpers'

/**
 * U5d — User-Story „Audio-Datei → Inbox-Analyse → Flowback" (ADR-0004 II, U5).
 *
 * Schließt die in 06-inbox-capture.spec.ts (I6) deferte Stufe-B-Story und prüft
 * die U5-Invariante „Compute off-target für alle Medien" am Audio-Fall:
 * Audio-Datei → Inbox-Submission → Analyse-Job (job_type='audio',
 * providerScope='inbox') → Transkript+Metadaten fließen in die Submission
 * zurück (Flowback). Der Ziel-Provider wird NIE berührt.
 *
 * Erfassung läuft hier bewusst über die **authentifizierte API** (page.request),
 * nicht über die UI: der generische Audio-Einstieg wird erst in U6 verdrahtet
 * (capture-content-button ist heute PDF-only). E2E-Specs dürfen API/Mongo direkt
 * prüfen (status-und-testplan-2026-06.md §4).
 *
 * ENTWURF (Cloud-bootstrapped, type-gecheckt): lokal grün iterieren —
 * Testdaten/Timing gegen echte Services bestätigen.
 * Voraussetzungen: `pnpm dev`, MongoDB, Azure (Inbox-Blob) UND **Secretary**
 * (Schritt B4 transkribiert+transformiert real). Für B4 eine echte, kurze
 * Audio-Datei nutzen — der Platzhalter-Buffer transkribiert nicht.
 */

const LIB_INBOX = `${TEST_PREFIX} Inbox`
// Platzhalter-Audio: genügt für Capture + Job-Anlage (B1–B3). Für den echten
// Flowback (B4) lokal durch eine kurze, echte Audio-Datei ersetzen.
const AUDIO_FILE = {
  name: 'inbox-e2e.mp3',
  mimeType: 'audio/mpeg',
  buffer: Buffer.from('ID3 e2e inbox audio placeholder'),
}
// Audio rendert als 'session' (Vortrag/Gespräch) — dafür existiert das
// Builtin-Standard-Template 'standard-session' (F11), das die Analyse-Pre-flight verlangt.
const CAPTURE = { wizardId: 'audio-upload', docType: 'session', detailViewType: 'session' }

test('Inbox: Audio → Analyse → Flowback (U5d)', async ({ page }) => {
  test.setTimeout(300_000)
  const d = new Drehbuch('inbox-analyse', page)
  let libraryId = ''
  let submissionId = ''
  let jobId = ''

  try {
    await d.step('B0', 'Test-Library sicherstellen + aktivieren (Owner darf erfassen)', async () => {
      if (!(await findLibraryId(page, LIB_INBOX))) {
        await createLibraryViaUi(page, LIB_INBOX)
      }
      libraryId = await activateLibrary(page, LIB_INBOX)
      return `libraryId=${libraryId}`
    })

    await d.step('B1', 'Audio-Datei über die authentifizierte API erfassen (off-target)', async () => {
      const res = await page.request.post('/api/submissions', {
        multipart: {
          file: AUDIO_FILE,
          libraryId,
          wizardId: CAPTURE.wizardId,
          docType: CAPTURE.docType,
          detailViewType: CAPTURE.detailViewType,
          markdownBody: '',
          metadata: JSON.stringify({ title: AUDIO_FILE.name }),
        },
      })
      if (res.status() !== 201) throw new Error(`Capture-Status ${res.status()}, erwartet 201: ${await res.text()}`)
      const json = (await res.json()) as { submission?: { id?: string } }
      submissionId = json.submission?.id ?? ''
      if (!submissionId) throw new Error('Capture lieferte keine submission.id')
      return `submissionId=${submissionId}`
    })

    await d.step('B2', 'Backend: pending-Submission, Audio-Quelle im Inbox-Bereich', async () => {
      const sub = await findSubmissionById(submissionId)
      if (!sub) throw new Error('Submission nicht in wizard_submissions gefunden')
      if (sub.status !== 'pending') throw new Error(`status=${sub.status}, erwartet pending`)
      const ref = sub.binaryRefs?.[0]
      if (ref?.contentType !== 'audio/mpeg') throw new Error(`contentType=${ref?.contentType}, erwartet audio/mpeg`)
      const where = assertInboxBinaryRef(sub) // wirft, falls nicht /inbox/
      return `status=pending, blob=${where.slice(0, 60)}`
    })

    await d.step('B3', 'Analyse starten → Audio-Job läuft off-target (providerScope=inbox)', async () => {
      const res = await page.request.post(`/api/submissions/${encodeURIComponent(submissionId)}/analyze`)
      if (res.status() !== 202) throw new Error(`Analyse-Status ${res.status()}, erwartet 202: ${await res.text()}`)
      jobId = ((await res.json()) as { jobId?: string }).jobId ?? ''
      if (!jobId) throw new Error('Analyse lieferte keine jobId')

      await expect.poll(async () => (await findAnalyzeJob(submissionId)) !== null, { timeout: 30_000 }).toBe(true)
      const job = await findAnalyzeJob(submissionId)
      if (job?.providerScope !== 'inbox') throw new Error(`providerScope=${job?.providerScope}, erwartet inbox`)
      if (job?.job_type !== 'audio') throw new Error(`job_type=${job?.job_type}, erwartet audio`)
      return `Job ${jobId} job_type=audio providerScope=inbox`
    })

    await d.step('B4', 'Flowback: Transkript+Metadaten landen in der Submission (Secretary)', async () => {
      // Wartet, bis die Analyse-Completion das Ergebnis in die Submission zurückgespielt hat
      // (submission-analysis.ts: erst Flowback, dann Job=completed). Braucht den Secretary.
      await expect
        .poll(
          async () => {
            const sub = await findSubmissionById(submissionId)
            return typeof sub?.markdownBody === 'string' && sub.markdownBody.trim().length > 0
          },
          { timeout: 240_000, intervals: [5_000] },
        )
        .toBe(true)

      const sub = await findSubmissionById(submissionId)
      if (!sub) throw new Error('Submission nach Flowback nicht gefunden')
      // Flowback ändert den Status NICHT (bleibt pending bis zur Abnahme/Publikation, W5).
      if (sub.status !== 'pending') throw new Error(`status=${sub.status}, erwartet pending (Flowback ändert Status nicht)`)
      // Invariante: weiterhin off-target — Quelle bleibt im Inbox-Bereich, kein Archiv-Schreib.
      assertInboxBinaryRef(sub)
      const metaKeys = Object.keys(sub.metadata ?? {}).length
      return `Flowback ok: markdownBody=${(sub.markdownBody ?? '').length}z, metadataKeys=${metaKeys}`
    })
  } finally {
    d.save()
  }
})
