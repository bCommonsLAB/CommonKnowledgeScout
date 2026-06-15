import { expect, test } from './fixtures'
import {
  Drehbuch,
  TEST_PREFIX,
  activateLibrary,
  createLibraryViaUi,
  findLibraryId,
  gotoApp,
} from './helpers'

/**
 * WP-3 / U6 — User-Story „Inhalte erfassen → Wizard" (ADR-0004 II; U6b).
 *
 * Seit U6 fuehrt „Inhalte erfassen" NICHT mehr in einen Inline-Upload-Dialog,
 * sondern in den generischen Erfassungs-Wizard (`/library/create/<wizard>`):
 * erklaeren → hochladen → Inhaltstyp waehlen → berechnen → pruefen → Wartekorb.
 * Diese Story prueft den Einstieg (Button → Wizard). Der vollstaendige Lauf
 * (Upload → Typ → Compute → pending-Submission) braucht den Secretary und ist
 * die Backend-Invarianten-Story 07-inbox-analyse.spec.ts.
 *
 * ENTWURF (Cloud-bootstrapped, type-gecheckt): lokal grün iterieren —
 * Selektoren/Timing gegen echtes DOM + Services bestätigen.
 * Voraussetzungen: `pnpm dev`, MongoDB, Azure (Inbox-Blob).
 */

const LIB_INBOX = `${TEST_PREFIX} Inbox`

test('Inbox: Erfassen → Wizard (WP-3 / U6)', async ({ page }) => {
  test.setTimeout(300_000)
  const d = new Drehbuch('inbox-capture', page)
  let libraryId = ''

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

    await d.step('I2', 'Klick → generischer Erfassungs-Wizard öffnet sich', async () => {
      await page.getByRole('button', { name: /Inhalte erfassen/i }).click()
      // Der Button navigiert in den Wizard (file-transcript-de); kein Inline-Dialog mehr.
      await expect(page).toHaveURL(/\/library\/create\/file-transcript-de/, { timeout: 30_000 })
      await expect(page.getByRole('heading', { name: /Datei transkribieren/i })).toBeVisible({ timeout: 30_000 })
      return 'Wizard-Route geöffnet, Einstiegs-Schritt sichtbar'
    })

    d.manuell(
      'I3',
      'Voller Lauf: Upload → Inhaltstyp wählen → Berechnen → Wartekorb',
      'Braucht Secretary (Transkript/Transform). Backend-Invarianten (pending-Submission, ' +
        'Inbox-Blob, Analyse-Job providerScope=inbox) deckt 07-inbox-analyse.spec.ts ab.',
    )
  } finally {
    d.save()
  }
})
