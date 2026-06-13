import { expect, test } from './fixtures'
import { Drehbuch, LIB_BUECHER, activateLibrary, expectSaved, gotoApp, gotoSettings } from './helpers'

const STORY_MARKER = 'E2E-Drehbuch: Was möchten Sie wissen?'

/**
 * Akt 1, Schritte 1.6–1.12: Verarbeitung (F11), Transformation, Inhaltstyp,
 * Explore-/Story-Einstellungen, Erweitert-Aufräumcheck, Regressionscheck.
 * Ergebnis: tmp/e2e-results/akt1-verarbeitung.json
 */
test('Akt 1 — Verarbeitung & Darstellung (1.6–1.12)', async ({ page }) => {
  test.setTimeout(900_000)
  const d = new Drehbuch('akt1-verarbeitung', page)

  try {
    await d.step('setup', 'TEST-Drehbuch Bücher aktivieren (Guard)', async () => {
      await page.goto('/')
      return `aktiv: ${await activateLibrary(page, LIB_BUECHER)}`
    })

    await d.step('1.6', 'Verarbeitung: Vorlage read-only (F11), Speichern erst bei Änderung', async () => {
      await gotoSettings(page, 'archive')
      await expect(page.getByText(/Automatisch: Standard für/).first()).toBeVisible({ timeout: 45_000 })
      await expect(page.getByRole('button', { name: 'Verarbeitung speichern' })).toBeDisabled()
      return 'Read-only-Vorlage angezeigt, Speichern ohne Änderung deaktiviert'
    })

    await d.step('1.6b', 'F11: falsche Vorlage (Session) wird beim Speichern blockiert', async () => {
      await gotoSettings(page, 'advanced')
      await expect(page.getByRole('heading', { name: 'Vorlage (Journalist)' })).toBeVisible({ timeout: 45_000 })
      const tplSelect = page.locator('select[name="pdfTemplate"]')
      await tplSelect.selectOption('standard-session')
      const saveBtn = page.getByRole('button', { name: 'Einstellungen speichern' })
      await saveBtn.click()
      await expect(page.getByText('Vorlage passt nicht zum Inhaltstyp')).toBeVisible({ timeout: 15_000 })
      // Zurück auf „Automatisch" (Wert "" = erster Eintrag) → Speichern muss durchgehen
      await tplSelect.selectOption('')
      await saveBtn.click()
      await expectSaved(page)
      return 'Blockier-Toast erschienen; mit „Automatisch" gespeichert'
    })

    await d.step('1.7', 'Echtdaten: PDF in der App öffnen und Transformation anstoßen', async () => {
      await gotoApp(page, '/library')
      const pdf = page.getByText(/GADERFORM/i).first()
      await expect(pdf).toBeVisible({ timeout: 60_000 })
      await pdf.click()
      const trigger = page
        .getByRole('tab', { name: 'Transformieren' })
        .or(page.getByRole('button', { name: 'Transformieren' }))
        .first()
      await trigger.click({ timeout: 20_000 })
      const start = page.getByRole('button', { name: /Transformieren|Starten|Verarbeiten/ }).last()
      await start.click({ timeout: 20_000 })
      await expect(
        page.getByText(/gestartet|läuft|wird verarbeitet|Job|Warteschlange|Sekretär/i).first(),
      ).toBeVisible({ timeout: 30_000 })
      return 'Transformation angestoßen — Endergebnis bitte im Anschluss prüfen'
    })

    await d.step('1.8', 'Inhaltstyp: empfohlene Filter übernehmen → bestätigen → speichern', async () => {
      await gotoSettings(page, 'archive')
      await expect(page.getByText('Empfohlene Galerie-Filter').first()).toBeVisible({ timeout: 45_000 })
      await page.getByRole('button', { name: /Filter übernehmen/i }).first().click()
      await page.getByRole('alertdialog').getByRole('button', { name: /übernehmen/i }).click()
      await expectSaved(page)
      await page.getByRole('button', { name: 'Inhaltstyp speichern' }).click()
      await expectSaved(page)
      return 'Bestätigungs-Dialog, Hinweis-Toast, gespeichert'
    })

    await d.step('1.9', 'Explore-Settings: Dichte/Gruppierung/Graph — keine Facetten, kein Encoding', async () => {
      await gotoSettings(page, 'explore')
      await expect(page.getByText(/Dichte/).first()).toBeVisible({ timeout: 45_000 })
      await expect(page.getByText(/Gruppierung/).first()).toBeVisible()
      await expect(page.getByText(/Graph/).first()).toBeVisible()
      if ((await page.getByText(/Facette/).count()) > 0) throw new Error('Facetten-Tabelle auf Explore sichtbar — gehört nach Erweitert')
      if ((await page.getByText(/Encoding/).count()) > 0) throw new Error('Graph-Encoding auf Explore sichtbar — gehört nach Erweitert')
      return 'Schalter vorhanden; Facetten/Encoding nicht hier'
    })

    await d.step('1.10', 'Story-Settings: Eingabefeld-Text ändern → in der App wirksam', async () => {
      await gotoSettings(page, 'story')
      const eingabe = page.locator('input[name="placeholder"]').first()
      await eingabe.waitFor({ state: 'visible', timeout: 45_000 })
      await eingabe.fill(STORY_MARKER)
      await page.getByRole('button', { name: 'Story-Einstellungen speichern' }).click()
      await expectSaved(page)
      await gotoApp(page, '/library')
      await page.getByRole('link', { name: 'Story', exact: true }).first().click().catch(() => undefined)
      await page.waitForTimeout(3000)
      const sichtbar = (await page.getByPlaceholder(STORY_MARKER).count()) + (await page.getByText(STORY_MARKER).count())
      if (sichtbar === 0) throw new Error('Geänderter Eingabefeld-Text in der Story-App nicht gefunden')
      return 'Eingabefeld-Text aus den Einstellungen erscheint in der App'
    })

    await d.step('1.11', 'Erweitert: Dateisystem-Optionen ohne Shadow-Twin/Primary-Store; Facetten + Encoding hier', async () => {
      await gotoSettings(page, 'advanced')
      await expect(page.getByText('Dateisystem-Optionen').first()).toBeVisible({ timeout: 45_000 })
      if ((await page.getByText('Shadow-Twin-Modus').count()) > 0) throw new Error('„Shadow-Twin-Modus"-Block noch sichtbar')
      if ((await page.getByText('Primary Store').count()) > 0) throw new Error('„Primary Store"-Dropdown noch sichtbar')
      if ((await page.getByText(/Facette/).count()) === 0) throw new Error('Facetten-Tabelle fehlt in Erweitert')
      if ((await page.getByText(/Encoding/).count()) === 0) throw new Error('Graph-Encoding fehlt in Erweitert')
      return 'Erweitert aufgeräumt; Facetten + Encoding liegen hier'
    })

    await d.step('1.12', 'Regressionscheck: Erweitert-Save überschreibt Story-Einstellungen nicht', async () => {
      await gotoSettings(page, 'story')
      const before = await page.locator('input[name="placeholder"]').first().inputValue()
      await gotoSettings(page, 'advanced')
      const chunk = page.locator('input[name="embeddings.chunkSize"]')
      await chunk.waitFor({ state: 'visible', timeout: 45_000 })
      const old = await chunk.inputValue()
      const neu = String(Number(old || '1000') + 50)
      await chunk.fill(neu)
      // Speichern-Button im selben Formular wie das Chunk-Feld
      await page
        .locator('form', { has: page.locator('input[name="embeddings.chunkSize"]') })
        .getByRole('button', { name: /speichern/i })
        .first()
        .click()
      await expectSaved(page)
      await gotoSettings(page, 'story')
      const after = await page.locator('input[name="placeholder"]').first().inputValue()
      if (after !== before) throw new Error(`Story-Text überschrieben: "${before}" → "${after}"`)
      return `Chunk-Größe ${old} → ${neu} gespeichert; Story-Text unverändert ("${after}")`
    })
  } finally {
    d.save()
  }
})
