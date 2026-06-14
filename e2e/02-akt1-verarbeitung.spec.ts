import { expect, test } from './fixtures'
import {
  Drehbuch,
  LIB_BUECHER,
  activateLibrary,
  gotoApp,
  gotoSettings,
  saveAndWait,
  vis,
} from './helpers'

const STORY_MARKER = 'E2E-Drehbuch: Was möchten Sie wissen?'

/**
 * Akt 1, Schritte 1.6–1.12: Verarbeitung (F11), Inhaltstyp, Explore-/Story-
 * Einstellungen, Erweitert-Aufräumcheck, Regressionscheck — auf den neuen Flow
 * + echte Selektoren ausgerichtet (07-folgeplan §3a). Speichern wird über den
 * Netzwerk-Effekt geprüft (saveAndWait), nicht über die unsichtbaren
 * use-toast-Erfolgsmeldungen. Ergebnis: tmp/e2e-results/akt1-verarbeitung.json
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
      await expect(vis(page.getByText(/Automatisch: Standard für/)).first()).toBeVisible({ timeout: 45_000 })
      await expect(vis(page.getByRole('button', { name: 'Verarbeitung speichern' })).first()).toBeDisabled()
      return 'Read-only-Vorlage angezeigt, Speichern ohne Änderung deaktiviert'
    })

    await d.step('1.6b', 'F11: falsche Vorlage (standard-session) wird beim Speichern blockiert', async () => {
      await gotoSettings(page, 'advanced')
      // Auf das SECRETARY-Formular scopen (stabiler Anker „Vorlage (Journalist)"),
      // damit „Einstellungen speichern" den richtigen Submit auslöst — die
      // Erweitert-Seite hat zwei gleichnamige Speichern-Buttons (RAG + F11). NICHT
      // über den __custom__-Select ankern: der verschwindet beim Moduswechsel.
      const secForm = vis(page.locator('form').filter({ hasText: 'Vorlage (Journalist)' })).first()
      const tplSelect = secForm.locator('select:has(option[value="__custom__"])')
      await expect(tplSelect).toBeVisible({ timeout: 45_000 })
      // Frische book-Library hat keine Mongo-Vorlagen → Weg über „Benutzerdefiniert…".
      // Sobald der Wert getippt ist, nimmt mergeTemplateNames ihn auf und die UI
      // schaltet zurück in den Select-Modus (standard-session ist nun eine Option).
      await tplSelect.selectOption('__custom__')
      await secForm.getByPlaceholder(/pdfanalyse-commoning/).fill('standard-session')
      // Live-Konsistenz-Hinweis wird rot (Inhaltstyp-Mismatch book ↔ session).
      await expect(secForm.getByText(/gehört zu einem anderen Inhaltstyp/)).toBeVisible({ timeout: 10_000 })
      // Speichern muss blockiert werden: KEINE erfolgreiche Library-Mutation.
      let blocked = true
      const noSave = page
        .waitForResponse(
          r => /\/api\/libraries/.test(r.url()) && ['POST', 'PATCH', 'PUT'].includes(r.request().method()) && r.ok(),
          { timeout: 4_000 },
        )
        .then(() => { blocked = false })
        .catch(() => undefined)
      await secForm.getByRole('button', { name: 'Einstellungen speichern' }).click()
      await noSave
      if (!blocked) throw new Error('Speichern wurde trotz Inkonsistenz NICHT blockiert')
      // Zurück auf „Automatisch" (leere Select-Option) → der rote Hinweis verschwindet.
      await tplSelect.selectOption('')
      await expect(secForm.getByText(/gehört zu einem anderen Inhaltstyp/)).toHaveCount(0)
      return 'Inkonsistenz (standard-session) blockiert (rot, keine Mutation); „Automatisch" wieder konsistent (Hinweis weg)'
    })

    d.manuell(
      '1.7',
      'Echtdaten: PDF in der App öffnen und Transformation anstoßen',
      'Echtdaten-Transformation benötigt den Secretary-Service + ingestierte PDF (lokal nicht verfügbar); die reine UI-Auslösung ist in 06-inbox-capture abgedeckt.',
    )

    await d.step('1.8', 'Inhaltstyp: empfohlene Filter übernehmen → bestätigen → speichern', async () => {
      await gotoSettings(page, 'archive')
      await expect(vis(page.getByText('Empfohlene Galerie-Filter')).first()).toBeVisible({ timeout: 45_000 })
      await vis(page.getByRole('button', { name: 'Übernehmen', exact: true })).first().click()
      // Bestätigungs-Dialog (ConfirmActionDialog)
      await page
        .getByRole('alertdialog')
        .getByRole('button', { name: /übernehmen/i })
        .click()
        .catch(() => undefined)
      // „Filter übernehmen" toastet über sonner (sichtbar) — Hinweis „bitte speichern".
      await expect(page.getByText(/Filter gesetzt/i).first()).toBeVisible({ timeout: 10_000 })
      await saveAndWait(page, () =>
        vis(page.getByRole('button', { name: 'Inhaltstyp speichern' })).first().click(),
      )
      return 'Bestätigungs-Dialog, Hinweis-Toast (sonner), gespeichert (PATCH bestätigt)'
    })

    await d.step('1.9', 'Explore-Settings: Karten-Raster/Gruppierung/Graph — keine Facetten, kein Encoding', async () => {
      await gotoSettings(page, 'explore')
      await expect(vis(page.getByText(/Karten-Raster/)).first()).toBeVisible({ timeout: 45_000 })
      await expect(vis(page.getByText(/Gruppierung/)).first()).toBeVisible()
      await expect(vis(page.getByText(/Graph-Modus/)).first()).toBeVisible()
      // Negativ-Checks auf die SPEZIFISCHEN Erweitert-Marker: die editierbare
      // Facetten-Tabelle (Button „Facette hinzufügen") und „Graph-Encoding".
      if ((await page.getByRole('button', { name: 'Facette hinzufügen' }).count()) > 0) throw new Error('Facetten-Tabelle (Facette hinzufügen) auf Explore sichtbar — gehört nach Erweitert')
      if ((await page.getByText('Graph-Encoding').count()) > 0) throw new Error('Graph-Encoding auf Explore sichtbar — gehört nach Erweitert')
      return 'Karten-Raster/Gruppierung/Graph vorhanden; Facetten-Tabelle/Encoding nicht hier'
    })

    await d.step('1.10', 'Story-Settings: Eingabefeld-Text ändern → persistiert (Reload) + best-effort App', async () => {
      await gotoSettings(page, 'story')
      const eingabe = vis(page.getByRole('textbox', { name: 'Platzhalter' })).first()
      await eingabe.waitFor({ state: 'visible', timeout: 45_000 })
      await eingabe.fill(STORY_MARKER)
      await saveAndWait(page, () =>
        vis(page.getByRole('button', { name: 'Story-Einstellungen speichern' })).first().click(),
      )
      // Wirkung prüfen statt unsichtbarem Toast: Reload → Wert persistiert.
      await gotoSettings(page, 'story')
      await expect(vis(page.getByRole('textbox', { name: 'Platzhalter' })).first()).toHaveValue(STORY_MARKER, { timeout: 30_000 })
      // Best-effort: in der Story-App sichtbar (nicht erfolgskritisch — App braucht ggf. Daten).
      let inApp = false
      await gotoApp(page, '/library').catch(() => undefined)
      await page.getByRole('link', { name: 'Story', exact: true }).first().click().catch(() => undefined)
      await page.waitForTimeout(2500)
      inApp = (await page.getByPlaceholder(STORY_MARKER).count()) + (await page.getByText(STORY_MARKER).count()) > 0
      return `Eingabefeld-Text gespeichert + nach Reload bestätigt${inApp ? '; auch in der Story-App sichtbar' : ' (App-Sicht best-effort, hier nicht bestätigt)'}`
    })

    await d.step('1.11', 'Erweitert: kein Shadow-Twin/Primary-Store; Facetten + Encoding liegen hier', async () => {
      await gotoSettings(page, 'advanced')
      await expect(vis(page.getByText('Graph-Encoding')).first()).toBeVisible({ timeout: 45_000 })
      await expect(vis(page.getByText(/Galerie-Filter \(Facetten\)/)).first()).toBeVisible()
      if ((await page.getByText('Shadow-Twin-Modus').count()) > 0) throw new Error('„Shadow-Twin-Modus"-Block noch sichtbar')
      if ((await page.getByText('Primary Store').count()) > 0) throw new Error('„Primary Store"-Dropdown noch sichtbar')
      return 'Erweitert aufgeräumt; Facetten + Encoding liegen hier (kein Shadow-Twin/Primary Store)'
    })

    await d.step('1.12', 'Regressionscheck: Erweitert-Save überschreibt Story-Einstellungen nicht', async () => {
      await gotoSettings(page, 'story')
      const before = await vis(page.getByRole('textbox', { name: 'Platzhalter' })).first().inputValue()
      await gotoSettings(page, 'advanced')
      const chunk = vis(page.getByRole('spinbutton', { name: 'Chunk Größe' })).first()
      await chunk.waitFor({ state: 'visible', timeout: 45_000 })
      const old = await chunk.inputValue()
      const neu = String(Number(old || '1000') + 50)
      await chunk.fill(neu)
      // Speichern-Button im SELBEN (sichtbaren) Formular wie das Chunk-Feld.
      const chunkForm = vis(page.locator('form').filter({ has: page.locator('input[name="embeddings.chunkSize"]') })).first()
      await saveAndWait(page, () =>
        chunkForm.getByRole('button', { name: 'Einstellungen speichern' }).first().click(),
      )
      await gotoSettings(page, 'story')
      const after = await vis(page.getByRole('textbox', { name: 'Platzhalter' })).first().inputValue()
      if (after !== before) throw new Error(`Story-Text überschrieben: "${before}" → "${after}"`)
      return `Chunk-Größe ${old} → ${neu} gespeichert; Story-Text unverändert ("${after}")`
    })
  } finally {
    d.save()
  }
})
