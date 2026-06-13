import { expect, test } from './fixtures'
import { Drehbuch, LIB_BUECHER, activateLibrary, expectSaved, gotoSettings } from './helpers'

const SLUG = 'test-drehbuch-buecher'
const HEADLINE = 'E2E Überschrift Drehbuch'

/** Switch in der Zeile mit gegebenem Label-Text klicken */
async function toggleSwitchByRowText(page: import('@playwright/test').Page, text: string): Promise<void> {
  const row = page.locator('div').filter({ hasText: text }).filter({ has: page.getByRole('switch') }).last()
  await row.getByRole('switch').click()
}

/**
 * Akt 3 aus Owner-Sicht: Einladung (3.1/3.3), Veröffentlichung (3.5–3.7).
 * Inkognito wird durch einen frischen, nicht-eingeloggten Browser-Kontext
 * ersetzt (SSR-Smoke-Check der öffentlichen Seite). Schritte mit zweitem
 * Account bleiben manuell. Ergebnis: tmp/e2e-results/akt3-publish.json
 */
test('Akt 3 — weSpace/usSpace aus Owner-Sicht', async ({ page, browser }) => {
  test.setTimeout(600_000)
  const d = new Drehbuch('akt3-publish', page)

  try {
    await d.step('setup', 'TEST-Drehbuch Bücher aktivieren (Guard)', async () => {
      await page.goto('/')
      return `aktiv: ${await activateLibrary(page, LIB_BUECHER)}`
    })

    await d.step('3.1', 'Person einladen: EIN Dialog, drei erklärte Rollen (Leser zuerst)', async () => {
      await gotoSettings(page, 'public/members')
      await page.getByRole('button', { name: 'Person einladen' }).first().click({ timeout: 30_000 })
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      // Rollen-Select öffnen und die drei erklärten Rollen prüfen (Leser zuerst)
      await dialog.locator('#member-role').click()
      const optionen = page.getByRole('option')
      await expect(optionen.nth(0)).toContainText('Leser')
      await expect(page.getByRole('option', { name: /Moderator/ })).toBeVisible()
      await page.getByRole('option', { name: /Leser/ }).click()
      await dialog.locator('#member-email').fill('test-drehbuch@example.com')
      await dialog.locator('#invite-message').fill('Automatisierter Drehbuch-Test').catch(() => undefined)
      await dialog.getByRole('button', { name: 'Einladung senden' }).click()
      await expect(page.getByText(/Einladung|eingeladen|gesendet/i).first()).toBeVisible({ timeout: 15_000 })
      return 'Dialog mit Rollen-Erklärung (Leser zuerst); Einladung als Leser gesendet'
    })

    await d.step('3.3', 'Einladung erscheint auf der Personen-Seite', async () => {
      await page.reload()
      await expect(page.getByText('test-drehbuch@example.com').first()).toBeVisible({ timeout: 30_000 })
      return 'eingeladene Adresse gelistet'
    })

    d.manuell('3.2', 'Einladung annehmen → Bibliothek sichtbar, keine Settings', 'zweiter Clerk-Account nötig')
    d.manuell('3.4', 'Zugriff entziehen → sofort wirksam (kein 10s-Nachlauf)', 'zweiter Clerk-Account nötig')

    await d.step('3.5', 'Veröffentlichen: Status-Header wechselt Privat → Öffentlich', async () => {
      await gotoSettings(page, 'public')
      const statusAlert = page.locator('[role="alert"]').first()
      await expect(statusAlert).toContainText('Privat', { timeout: 45_000 })
      await toggleSwitchByRowText(page, 'Library veröffentlichen')
      await page.locator('input[name="slugName"]').fill(SLUG)
      await expect(statusAlert).toContainText('Öffentlich')
      return 'Header Privat → Öffentlich; Web-Adresse gesetzt (ungespeichert)'
    })

    await d.step('3.6', 'Galerie-Texte speichern → anonym unter /explore/<slug> sichtbar', async () => {
      // Galerie-Textfelder best-effort befüllen (Labels nicht durchweg assoziiert)
      const headlineField = page
        .getByLabel(/Überschrift|Titel/i)
        .or(page.locator('input[name*="headline" i], input[name*="title" i], textarea[name*="headline" i]'))
        .first()
      if (await headlineField.isVisible().catch(() => false)) await headlineField.fill(HEADLINE)
      await page.getByRole('button', { name: 'Veröffentlichung speichern' }).click()
      await expect(page.getByText(/gespeichert|veröffentlicht/i).first()).toBeVisible({ timeout: 20_000 })
      // Anonymer Kontext (kein Login, kein Testing-Token) → echter Fremdzugriff
      const anon = await browser.newContext()
      const anonPage = await anon.newPage()
      const resp = await anonPage.goto(`http://localhost:3000/explore/${SLUG}`, { waitUntil: 'domcontentloaded' })
      const status = resp?.status() ?? 0
      const headlineSichtbar = await anonPage.getByText(HEADLINE).first().isVisible().catch(() => false)
      await anon.close()
      if (status >= 400) throw new Error(`/explore/${SLUG} anonym → HTTP ${status}`)
      return headlineSichtbar
        ? `anonym sichtbar inkl. Überschrift "${HEADLINE}"`
        : `öffentliche Seite anonym erreichbar (HTTP ${status}); Überschrift-Feld nicht eindeutig lokalisiert`
    })

    await d.step('3.7', 'Freigabe-Pflicht: anonym kein direkter Zugriff mehr', async () => {
      await toggleSwitchByRowText(page, 'Zugriff nur für freigegebene Benutzer')
      await page.getByRole('button', { name: 'Veröffentlichung speichern' }).click()
      await expect(page.getByText(/gespeichert|veröffentlicht/i).first()).toBeVisible({ timeout: 20_000 })
      await expect(page.locator('[role="alert"]').first()).toContainText('Öffentlich mit Freigabe', { timeout: 15_000 })
      const anon = await browser.newContext()
      const anonPage = await anon.newPage()
      await anonPage.goto(`http://localhost:3000/explore/${SLUG}`, { waitUntil: 'domcontentloaded' })
      await anonPage.waitForTimeout(3000)
      const nochSichtbar = await anonPage.getByText(HEADLINE).count()
      const anfrageHinweis = await anonPage.getByText(/Zugriff|Anfrage|anmelden|Freigabe/i).count()
      await anon.close()
      if (nochSichtbar > 0) throw new Error('Galerie-Inhalte trotz Freigabe-Pflicht anonym sichtbar')
      return anfrageHinweis > 0 ? 'Inhalte gesperrt, Anfrage-/Anmelde-Weg sichtbar' : 'Inhalte anonym gesperrt'
    })

    d.manuell('3.8', 'Zugriffsanfrage stellen + genehmigen', 'zweiter Clerk-Account nötig')
    d.manuell('3.9', 'Moderator-Sicht der Settings (Moderation-Hinweis, Anfragen-Verwaltung)', 'zweiter Clerk-Account nötig')
  } finally {
    d.save()
  }
})
