import { expect, test } from './fixtures'
import {
  Drehbuch,
  OWNER_EMAIL,
  TEST_PREFIX,
  activateLibrary,
  assertInboxBinaryRef,
  createLibraryViaUi,
  findAnalyzeJob,
  findLatestSubmission,
  findLibraryId,
  gotoApp,
} from './helpers'

/**
 * WP-3 — User-Story „Inhalte erfassen → Wartekorb" (ADR-0004 II, Welle II/III).
 *
 * Erste Story der vereinheitlichten E2E-Methode: prüft UX **und** Backend-
 * Invarianten in EINEM Spec (vgl. docs/wizards/status-und-testplan-2026-06.md).
 *
 * Fluss: Owner öffnet Galerie → „Inhalte erfassen" → PDF-Upload → pending-
 * Submission erscheint unter „Meine Beiträge"; Backend: Status pending,
 * Binärquelle im Inbox-Bereich, Analyse-Job mit providerScope='inbox'
 * (Erfassung berührt NIE den Ziel-Provider).
 *
 * ENTWURF (Cloud-bootstrapped, type-gecheckt): lokal grün iterieren —
 * Selektoren/Timing/Testdaten gegen echtes DOM + Services bestätigen.
 * Voraussetzungen: `pnpm dev`, MongoDB, Azure (Inbox-Blob). Der Analyse-LAUF
 * (Secretary) ist NICHT Teil dieser Story — nur die Job-Anlage (off-target).
 */

const LIB_INBOX = `${TEST_PREFIX} Inbox`
// Minimaler PDF-Buffer: für die Erfassung (Stufe A) genügt das Speichern der
// Bytes; ein echter PDF-Inhalt ist erst für die Analyse (Secretary) nötig.
const PDF_FILE = {
  name: 'inbox-e2e.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4\n% e2e inbox capture\n'),
}

test('Inbox: Erfassen → Wartekorb (WP-3)', async ({ page }) => {
  test.setTimeout(300_000)
  const d = new Drehbuch('inbox-capture', page)
  let libraryId = ''
  let submissionId = ''

  try {
    await d.step('I0', 'Test-Library sicherstellen + aktivieren (Owner darf erfassen)', async () => {
      // Idempotent: existiert die Library schon (Vorlauf), nur aktivieren.
      if (!(await findLibraryId(page, LIB_INBOX))) {
        await createLibraryViaUi(page, LIB_INBOX)
      }
      libraryId = await activateLibrary(page, LIB_INBOX)
      return `libraryId=${libraryId}`
    })

    await d.step('I1', 'Galerie: Button „Inhalte erfassen" ist sichtbar (rechte-gated)', async () => {
      await gotoApp(page, '/library/gallery')
      await expect(page.getByRole('button', { name: /Inhalte erfassen/i })).toBeVisible({ timeout: 30_000 })
      return 'Button sichtbar für Owner'
    })

    await d.step('I2', 'PDF hochladen → Erfolgsmeldung', async () => {
      await page.getByRole('button', { name: /Inhalte erfassen/i }).click()
      const dlg = page.getByRole('dialog')
      await dlg.locator('#capture-file').setInputFiles(PDF_FILE)
      await dlg.getByRole('button', { name: /Hochladen/i }).click()
      // Capture erzeugt die Submission; der Dialog stößt zusätzlich die Analyse an
      // (beide Toast-Varianten beginnen mit „Beitrag erfasst").
      await expect(page.getByText(/Beitrag erfasst/i).first()).toBeVisible({ timeout: 45_000 })
      return 'Upload bestätigt'
    })

    await d.step('I3', 'Backend: pending-Submission, Binärquelle im Inbox-Bereich', async () => {
      await expect
        .poll(async () => (await findLatestSubmission(libraryId, OWNER_EMAIL)) !== null, { timeout: 30_000 })
        .toBe(true)
      const sub = await findLatestSubmission(libraryId, OWNER_EMAIL)
      if (!sub) throw new Error('keine Submission in wizard_submissions gefunden')
      submissionId = String(sub._id)
      if (sub.status !== 'pending') throw new Error(`status=${sub.status}, erwartet pending`)
      if (sub.createdByRole !== 'owner') throw new Error(`createdByRole=${sub.createdByRole}, erwartet owner`)
      const where = assertInboxBinaryRef(sub) // wirft, falls nicht /inbox/
      return `status=pending, role=owner, blob=${where.slice(0, 60)}`
    })

    await d.step('I4', '„Meine Beiträge" zeigt die Submission', async () => {
      await gotoApp(page, '/library/my-submissions')
      await expect(page.getByText('Meine Beiträge')).toBeVisible({ timeout: 30_000 })
      // Titel der Stufe-A-Submission = Dateiname.
      await expect(page.getByText(PDF_FILE.name).first()).toBeVisible({ timeout: 30_000 })
      return 'Submission im eigenen Wartekorb sichtbar'
    })

    await d.step('I5', 'Invariante: Analyse-Job läuft off-target (providerScope=inbox)', async () => {
      await expect
        .poll(async () => (await findAnalyzeJob(submissionId)) !== null, { timeout: 30_000 })
        .toBe(true)
      const job = await findAnalyzeJob(submissionId)
      if (!job) throw new Error('kein Analyse-Job zur Submission gefunden')
      if (job.providerScope !== 'inbox') {
        throw new Error(`providerScope=${job.providerScope}, erwartet inbox (Ziel-Provider unberührt)`)
      }
      return `Job ${job.jobId} providerScope=inbox (status=${job.status})`
    })

    d.manuell(
      'I6',
      'Stufe-B-Analyse (Transkript/Transform → Flowback) end-to-end',
      'Benötigt Secretary-Service; eigene Story 07-inbox-analyse.spec.ts (Flowback: Body+Metadaten in der Submission).',
    )
  } finally {
    d.save()
  }
})
