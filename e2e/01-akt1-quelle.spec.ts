import { expect, test } from './fixtures'
import {
  Drehbuch,
  LIB_BUECHER,
  SOURCE_DIR,
  activateLibrary,
  assertAuthenticated,
  cleanupTestLibraries,
  createLibraryViaUi,
  getLibraries,
} from './helpers'

/**
 * Akt 1, Schritte 1.1–1.5 (docs/settings-ux/06-testdrehbuch.md):
 * Willkommens-Flow, Bibliothek anlegen, lokale Quelle über den Wizard.
 * Ergebnis: tmp/e2e-results/akt1-quelle.json (ein FAIL stoppt den Lauf nicht).
 */
test('Akt 1 — Quelle (1.1–1.5)', async ({ page }) => {
  test.setTimeout(600_000)
  const d = new Drehbuch('akt1-quelle', page)

  try {
    await d.step('0', 'Vorbereitung: Login prüfen + alte TEST-Drehbuch-Bibliotheken löschen', async () => {
      await page.goto('/')
      await assertAuthenticated(page)
      const removed = await cleanupTestLibraries(page)
      return removed.length ? `gelöscht: ${removed.join(', ')}` : 'keine Altlasten'
    })

    await d.step('1.1', 'Willkommens-Flow per /settings?newUser=true', async () => {
      const libsVorher = await getLibraries(page)
      await page.goto('/settings?newUser=true')
      await page.waitForTimeout(3000)
      const welcome = await page.getByText('Willkommen bei Knowledge Scout!').isVisible().catch(() => false)
      if (welcome) {
        await expect(page.getByRole('button', { name: 'Erste Bibliothek erstellen' })).toBeVisible()
        return 'Willkommens-Screen mit einer CTA sichtbar'
      }
      // Befund: Willkommens-Screen nicht erreichbar. Zwei Ursachen im Code:
      // (1) settings-client.tsx redirectet Creators beim Cold-Load auf '/'
      //     (isCreator hängt an libraries.length, das beim direkten Aufruf
      //     noch 0 ist — kein isLoaded-Guard, Z. 129-134).
      // (2) mit geladenen Libraries entfernt es den newUser-Param (Z. 137-144).
      // → Der Drehbuch-Tipp „newUser=true erzwingt den Flow auch mit
      //   bestehenden Libraries" trifft NICHT zu.
      throw new Error(
        `Willkommens-Screen erscheint NICHT (Owner hat ${libsVorher.length} Bibliotheken; landete auf ${new URL(page.url()).pathname}). Ursache: Cold-Load-Redirect in settings-client + newUser-Param-Stripping — Abweichung zum Drehbuch-Tipp`,
      )
    })

    await d.step('1.2', 'Bibliothek anlegen (Name) → über Switcher-Dialog', async () => {
      const id = await createLibraryViaUi(page, LIB_BUECHER)
      return `angelegt (${id}) über Switcher-Dialog. Hinweis: Inhaltstyp-KARTE nicht wählbar, da /settings-Übersicht wegen Cold-Load-Redirect in Automation nicht erreichbar — Default-Inhaltstyp`
    })

    await d.step('1.2w', 'TEST-Drehbuch Bücher als aktive Bibliothek setzen (Guard)', async () => {
      const id = await activateLibrary(page, LIB_BUECHER)
      return `aktiv: ${id}`
    })

    await d.step('1.3', 'Wizard: „Lokales Dateisystem" → Weiter überspringt Schritt 2', async () => {
      await page.goto('/settings/archive', { waitUntil: 'domcontentloaded' })
      await expect(page.getByText('Woher kommen die Dokumente dieser Bibliothek?')).toBeVisible({ timeout: 45_000 })
      await page.getByText('Lokales Dateisystem', { exact: true }).first().click()
      await page.getByRole('button', { name: 'Weiter', exact: true }).click()
      await expect(page.getByLabel('Speicherpfad')).toBeVisible({ timeout: 15_000 })
      return 'Schritt 3 (Verzeichnis) direkt erreicht — kein Anmelde-Schritt'
    })

    await d.step('1.4', 'Pfad übernehmen → Pflicht-Test startet automatisch und wird grün', async () => {
      await page.getByLabel('Speicherpfad').fill(SOURCE_DIR)
      await page.getByRole('button', { name: 'Übernehmen & Verbindung testen' }).click()
      await expect(page.getByText('Verbindung funktioniert')).toBeVisible({ timeout: 90_000 })
      await expect(page.getByRole('button', { name: 'Fertig', exact: true })).toBeEnabled()
      return 'Test grün, „Fertig" aktiv'
    })

    await d.step('1.5', 'Nach „Fertig": Read-only-Zusammenfassung + Abschnitte 2 und 3', async () => {
      await page.getByRole('button', { name: 'Fertig', exact: true }).click()
      await expect(page.getByText(/Quelle ändern/).first()).toBeVisible({ timeout: 30_000 })
      await expect(page.getByText(/2\s*·\s*Inhaltstyp/).first()).toBeVisible()
      await expect(page.getByText(/3\s*·\s*Verarbeitung/).first()).toBeVisible()
      await expect(page.getByText(/Journalist-Moment/).first()).toBeVisible()
      return 'Zusammenfassung read-only, Inhaltstyp + Verarbeitung sichtbar'
    })
  } finally {
    d.save()
  }
})
