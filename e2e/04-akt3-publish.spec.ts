import { expect, test } from './fixtures'
import { Drehbuch, LIB_BUECHER, activateLibrary, gotoSettings, saveAndWait, vis } from './helpers'

const HEADLINE = 'E2E Überschrift Drehbuch'
const INVITE_EMAIL = 'test-drehbuch@example.com'

/** Switch in der (sichtbaren) Zeile mit gegebenem Label-Text klicken. */
async function toggleSwitchByRowText(page: import('@playwright/test').Page, text: string): Promise<void> {
  const row = vis(
    page.locator('div').filter({ has: page.getByRole('switch') }).filter({ hasText: text }),
  ).last()
  await row.getByRole('switch').first().click()
}

/**
 * Akt 3 aus Owner-Sicht: Einladung (3.1/3.3), Veröffentlichung (3.5–3.7).
 * Inkognito wird durch einen frischen, nicht-eingeloggten Browser-Kontext
 * ersetzt (SSR-Smoke-Check der öffentlichen Seite). Schritte mit zweitem
 * Account bleiben manuell. Speichern/Einladung werden über die Wirkung geprüft
 * (Dialog-Schluss, Netzwerk-Effekt, API), nicht über die unsichtbaren
 * use-toast-Meldungen. Ergebnis: tmp/e2e-results/akt3-publish.json
 */
test('Akt 3 — weSpace/usSpace aus Owner-Sicht', async ({ page, browser }) => {
  test.setTimeout(600_000)
  const d = new Drehbuch('akt3-publish', page)
  let libraryId = ''
  // Slug pro Lauf eindeutig (aus der Library-ID) — vermeidet Kollisionen mit
  // bereits vergebenen Slugs (check-slug deaktiviert sonst den Speichern-Button).
  let slug = ''

  try {
    await d.step('setup', 'TEST-Drehbuch Bücher aktivieren (Guard)', async () => {
      await page.goto('/')
      libraryId = await activateLibrary(page, LIB_BUECHER)
      slug = `e2e-${libraryId.slice(0, 8)}`
      return `aktiv: ${libraryId}; slug=${slug}`
    })

    await d.step('3.1', 'Person einladen: EIN Dialog, drei erklärte Rollen (Leser zuerst)', async () => {
      // Owner-Gate der Mitglieder-Seite (isOwner → getUserLibraries) liefert für
      // frisch angelegte Libraries sporadisch „Keine Berechtigung" (gleiche
      // getUserLibraries-Inkonsistenz wie der storage-test-Befund). Reload-Retry,
      // bis „Person einladen" erscheint.
      const inviteBtn = vis(page.getByRole('button', { name: 'Person einladen' })).first()
      let sichtbar = false
      for (let v = 0; v < 8 && !sichtbar; v++) {
        await gotoSettings(page, 'public/members')
        sichtbar = await inviteBtn.isVisible({ timeout: 8_000 }).catch(() => false)
        if (!sichtbar) await page.waitForTimeout(5_000)
      }
      await inviteBtn.click({ timeout: 30_000 })
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      // Rollen-Select öffnen und die erklärten Rollen prüfen (Leser zuerst)
      await dialog.locator('#member-role').click()
      const optionen = page.getByRole('option')
      await expect(optionen.nth(0)).toContainText('Leser')
      await expect(page.getByRole('option', { name: /Moderator/ })).toBeVisible()
      await page.getByRole('option', { name: /Leser/ }).click()
      await dialog.locator('#member-email').fill(INVITE_EMAIL)
      await dialog.locator('#invite-message').fill('Automatisierter Drehbuch-Test').catch(() => undefined)
      // Erfolg = Dialog schließt (use-members-actions schließt ihn nur bei Erfolg);
      // robuster als der unsichtbare Toast bzw. ein knappes Response-Fenster.
      await dialog.getByRole('button', { name: 'Einladung senden' }).click()
      await expect(dialog).toBeHidden({ timeout: 60_000 })
      return 'Dialog mit Rollen-Erklärung (Leser zuerst); Einladung als Leser gesendet (Dialog geschlossen)'
    })

    await d.step('3.3', 'Einladung registriert: erscheint als Zugriffsanfrage (pending)', async () => {
      // Leser-Einladungen laufen über die invites-API (LibraryAccessRequest) und
      // tauchen auf der Personen-Seite erst NACH Annahme auf (3.2, zweiter Account).
      // Automatisiert prüfbar ist die Registrierung als pending-Zugriffsanfrage.
      await expect
        .poll(
          async () => {
            const res = await page.request.get(`/api/libraries/${libraryId}/access-requests?status=pending`)
            if (!res.ok()) return false
            const data = (await res.json()) as { requests?: Array<{ userEmail?: string }> }
            return (data.requests ?? []).some(r => (r.userEmail ?? '').toLowerCase() === INVITE_EMAIL)
          },
          { timeout: 30_000 },
        )
        .toBe(true)
      return 'Leser-Einladung als pending-Zugriffsanfrage registriert (Personen-Seite zeigt sie nach Annahme — 3.2 manuell)'
    })

    d.manuell('3.2', 'Einladung annehmen → Bibliothek sichtbar, keine Settings', 'zweiter Clerk-Account nötig')
    d.manuell('3.4', 'Zugriff entziehen → sofort wirksam (kein 10s-Nachlauf)', 'zweiter Clerk-Account nötig')

    await d.step('3.5', 'Veröffentlichen: Status-Header wechselt Privat → Öffentlich', async () => {
      await gotoSettings(page, 'public')
      const statusAlert = vis(page.locator('[role="alert"]')).first()
      await expect(statusAlert).toContainText('Privat', { timeout: 45_000 })
      await toggleSwitchByRowText(page, 'Library veröffentlichen')
      await vis(page.locator('input[name="slugName"]')).first().fill(slug)
      await expect(statusAlert).toContainText('Öffentlich')
      return 'Header Privat → Öffentlich; Web-Adresse gesetzt (ungespeichert)'
    })

    await d.step('3.6', 'Galerie-Texte speichern → anonym unter /explore/<slug> sichtbar', async () => {
      // Pflichtfeld „Öffentliche Beschreibung" (description, ≥10 Zeichen) — sonst
      // ist das Formular invalide und „Veröffentlichung speichern" sendet nicht.
      await vis(page.locator('[name="description"]')).first().fill('E2E-Drehbuch: öffentliche Beschreibung dieser Test-Bibliothek.')
      // Überschrift (galleryHeadline) best-effort befüllen.
      const headlineField = vis(page.locator('input[name="galleryHeadline"]')).first()
      if (await headlineField.isVisible().catch(() => false)) await headlineField.fill(HEADLINE)
      // Auf aktivierten (slug verfügbar) Speichern-Button warten, dann speichern.
      const saveBtn = vis(page.getByRole('button', { name: 'Veröffentlichung speichern' })).first()
      await expect(saveBtn).toBeEnabled({ timeout: 15_000 })
      await saveAndWait(page, () => saveBtn.click(), 60_000)
      // Anonymer Kontext (kein Login, kein Testing-Token) → echter Fremdzugriff
      const anon = await browser.newContext()
      const anonPage = await anon.newPage()
      const resp = await anonPage.goto(`http://localhost:3000/explore/${slug}`, { waitUntil: 'domcontentloaded' })
      const status = resp?.status() ?? 0
      const headlineSichtbar = await anonPage.getByText(HEADLINE).first().isVisible().catch(() => false)
      await anon.close()
      if (status >= 400) throw new Error(`/explore/${slug} anonym → HTTP ${status}`)
      return headlineSichtbar
        ? `anonym sichtbar inkl. Überschrift "${HEADLINE}"`
        : `öffentliche Seite anonym erreichbar (HTTP ${status}); Überschrift-Feld nicht eindeutig lokalisiert`
    })

    await d.step('3.7', 'Freigabe-Pflicht: anonym kein direkter Zugriff mehr', async () => {
      // Frisches, gesettletes Formular laden: nach 3.6 läuft ein langsamer
      // Re-Fetch/Reset (check-slug ~30s) — direktes Toggeln + Speichern ginge
      // dabei verloren (der Reset überschreibt den Schalter, kein PUT).
      await gotoSettings(page, 'public')
      await toggleSwitchByRowText(page, 'Zugriff nur für freigegebene Benutzer')
      const saveBtn = vis(page.getByRole('button', { name: 'Veröffentlichung speichern' })).first()
      await expect(saveBtn).toBeEnabled({ timeout: 30_000 })
      await saveBtn.click()
      await expect(vis(page.locator('[role="alert"]')).first()).toContainText('Öffentlich mit Freigabe', { timeout: 20_000 })
      // Wirkung statt Response-Fenster prüfen: anonym so lange pollen, bis die
      // Freigabe-Pflicht greift (der Save kann serverseitig etwas brauchen).
      let gesperrt = false
      let anfrageHinweis = 0
      for (let v = 0; v < 8 && !gesperrt; v++) {
        const anon = await browser.newContext()
        const anonPage = await anon.newPage()
        await anonPage.goto(`http://localhost:3000/explore/${slug}`, { waitUntil: 'domcontentloaded' }).catch(() => undefined)
        await anonPage.waitForTimeout(2000)
        const nochSichtbar = await anonPage.getByText(HEADLINE).count()
        anfrageHinweis = await anonPage.getByText(/Zugriff|Anfrage|anmelden|Freigabe/i).count()
        await anon.close()
        gesperrt = nochSichtbar === 0
        if (!gesperrt) await page.waitForTimeout(3000)
      }
      if (!gesperrt) throw new Error('Galerie-Inhalte trotz Freigabe-Pflicht anonym sichtbar')
      return anfrageHinweis > 0 ? 'Inhalte gesperrt, Anfrage-/Anmelde-Weg sichtbar' : 'Inhalte anonym gesperrt'
    })

    d.manuell('3.8', 'Zugriffsanfrage stellen + genehmigen', 'zweiter Clerk-Account nötig')
    d.manuell('3.9', 'Moderator-Sicht der Settings (Moderation-Hinweis, Anfragen-Verwaltung)', 'zweiter Clerk-Account nötig')
  } finally {
    d.save()
  }
})
