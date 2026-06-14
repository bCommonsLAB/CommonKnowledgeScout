import { expect, test } from './fixtures'
import { Drehbuch, LIB_CLOUD, activateLibrary, createLibraryViaWizard, dismissReauthDialog, findLibraryId, vis } from './helpers'

/**
 * Akt 2: Cloud-Quelle (OneDrive) — automatisiert nur bis VOR den
 * Microsoft-Login (keine echten Zugangsdaten im Test). OAuth, Verzeichnis-
 * Browser und Re-Auth bleiben manuell (§3a-Scope: ohne echte Cloud-Credentials
 * sauber als MANUELL markieren).
 * Ergebnis: tmp/e2e-results/akt2-cloud.json
 */
test('Akt 2 — Cloud-Quelle bis vor OneDrive-Login (2.1)', async ({ page }) => {
  test.setTimeout(300_000)
  const d = new Drehbuch('akt2-cloud', page)

  try {
    await d.step('2.1a', 'Zweite Bibliothek anlegen, OneDrive wählen → Anmelde-Schritt erscheint', async () => {
      await page.goto('/', { waitUntil: 'domcontentloaded' })
      if (!(await findLibraryId(page, LIB_CLOUD))) {
        await createLibraryViaWizard(page, LIB_CLOUD)
      }
      await activateLibrary(page, LIB_CLOUD)
      await page.goto('/settings/archive', { waitUntil: 'domcontentloaded' })
      await dismissReauthDialog(page)
      await expect(vis(page.getByText('Microsoft OneDrive', { exact: true })).first()).toBeVisible({ timeout: 45_000 })
      await vis(page.getByText('Microsoft OneDrive', { exact: true })).first().click()
      await vis(page.getByRole('button', { name: 'Weiter', exact: true })).first().click()
      // Wizard-Schritt 2 (OneDrive): „Anmeldung erforderlich" + Anmelde-Button —
      // Klick wird bewusst NICHT ausgeführt (kein echter Microsoft-Login).
      await expect(vis(page.getByRole('button', { name: /Bei OneDrive anmelden/ })).first()).toBeVisible({ timeout: 15_000 })
      return 'Wizard Schritt 2 mit Anmelde-Button — Klick bewusst NICHT ausgeführt'
    })

    d.manuell('2.1b', 'OAuth-Redirect + Rückkehr bei Wizard-Schritt 3 (sessionStorage-Resume)', 'echte Microsoft-Anmeldung erforderlich')
    d.manuell('2.2', 'Verzeichnis-Browser: navigieren, Ordner anlegen, Pflicht-Test grün', 'setzt OneDrive-Anmeldung voraus')
    d.manuell('2.3', 'Quelle-Zusammenfassung: maskierte Credentials, D1-Warn-Dialog, D2-Abmelde-Bestätigung', 'setzt OneDrive-Anmeldung voraus')
    d.manuell('2.4', 'Re-Auth: Token löschen → globaler Dialog außerhalb der Settings', 'setzt OneDrive-Anmeldung voraus')
  } finally {
    d.save()
  }
})
