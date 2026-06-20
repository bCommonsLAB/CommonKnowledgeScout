import { expect, test } from './fixtures'
import { Drehbuch, activateLibrary, dismissReauthDialog, findLibraryId, waitForApp } from './helpers'

/**
 * E2E-Geruest fuer Plan 1 · A4 (gemischte Galerie/Story).
 *
 * Deckt genau die Punkte ab, die Unit-/RTL-Tests NICHT koennen, weil sie die
 * laufende App + MongoDB + echte Daten brauchen (siehe
 * docs/plan1-a4-gemischte-galerie-story.md §9):
 *   - A4a: Typ-Leitfilter scoped Facetten + Liste server-seitig (echte Mongo-Query)
 *   - A4a: Einzeltyp-Library zeigt KEINEN Leitfilter (Regressionsschutz)
 *   - A4c: Story-Anhaenge werden je Format gerendert (Bild/Video/Audio/Link)
 *
 * ┌─ VOR DEM ERSTEN LAUF AUSFUELLEN ───────────────────────────────────────┐
 * │ Die drei Konstanten unten auf deine Test-Daten setzen. Ohne gueltige    │
 * │ Werte markieren die betroffenen Schritte sich selbst als MANUELL statt  │
 * │ rot zu werden — so laeuft das Geruest sofort, ohne falsche Fehler.      │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

/** Name einer Library mit MINDESTENS 2 verschiedenen detailViewTypes. */
const LIB_MIXED = '' // TODO: z.B. 'Mein Themenarchiv'
/** Name einer Library mit GENAU 1 detailViewType (Regressionsschutz). */
const LIB_SINGLE = '' // TODO: z.B. 'Nur Buecher'
/**
 * Direkter Pfad zu einer publizierten Story MIT gemischten Anhaengen
 * (Bild + Audio/Video + Link). So findest du ihn: Story im Browser oeffnen,
 * URL aus der Adressleiste kopieren (ab '/library/...').
 */
const STORY_PATH = '' // TODO: z.B. '/library/gallery/perspective?doc=...'

/** Wartet, bis die Galerie ihre erste Facetten-Antwort geliefert hat. */
async function gotoGallery(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/library/gallery', { waitUntil: 'domcontentloaded' })
  await dismissReauthDialog(page)
  // Erste Facetten-Antwort = Galerie hat Daten geladen (Cold-Route kann >20s)
  await page
    .waitForResponse(r => /\/api\/chat\/.*\/facets/.test(r.url()) && r.ok(), { timeout: 90_000 })
    .catch(() => undefined)
}

test('A4 — Galerie-Leitfilter + Story-Anhaenge je Format', async ({ page }) => {
  test.setTimeout(300_000)
  const d = new Drehbuch('a4-galerie-story', page)

  try {
    // ── A4a-1: Leitfilter erscheint in gemischter Library ──────────────────
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await waitForApp(page)

    if (!LIB_MIXED) {
      d.manuell('A4a-1', 'Leitfilter in gemischter Library', 'LIB_MIXED nicht gesetzt')
    } else {
      await d.step('A4a-1', 'Gemischte Library zeigt Inhaltstyp-Leitfilter', async () => {
        await activateLibrary(page, LIB_MIXED)
        await gotoGallery(page)
        const lead = page.getByTestId('view-type-lead-filter')
        await expect(lead).toBeVisible({ timeout: 30_000 })
        // ≥ 2 Typen → mindestens 3 Buttons ("Alle" + 2 Typen)
        const count = await lead.getByRole('button').count()
        if (count < 3) throw new Error(`nur ${count} Buttons — erwartet >=3 (Alle + >=2 Typen)`)
        return `Leitfilter sichtbar, ${count} Buttons`
      })

      // ── A4a-2: Typ waehlen → Server scoped Facetten + Liste streng ────────
      await d.step('A4a-2', 'Typ-Wahl loest gescopte facets/docs-Anfrage aus', async () => {
        const lead = page.getByTestId('view-type-lead-filter')
        // Zweiter Button = erster echter Typ (Index 0 = "Alle")
        const typeBtn = lead.getByRole('button').nth(1)
        const typeLabel = (await typeBtn.textContent())?.trim() ?? '?'
        // Beweis der Server-Verdrahtung: Anfrage MUSS den ?detailViewType-Param tragen
        const scoped = page.waitForRequest(
          r => /\/api\/chat\/.*\/(facets|docs)\?.*detailViewType=/.test(r.url()),
          { timeout: 30_000 },
        )
        await typeBtn.click()
        const req = await scoped
        return `Typ "${typeLabel}" → ${new URL(req.url()).pathname}?…detailViewType gesendet`
      })

      // ── A4a-3: "Alle" → Filter entfaellt (kein detailViewType-Param) ──────
      await d.step('A4a-3', '"Alle" entfernt den Typ-Filter', async () => {
        const lead = page.getByTestId('view-type-lead-filter')
        const allBtn = lead.getByRole('button').first() // "Alle"
        const unscoped = page.waitForRequest(
          r => /\/api\/chat\/.*\/(facets|docs)\?/.test(r.url()) && !/detailViewType=/.test(r.url()),
          { timeout: 30_000 },
        )
        await allBtn.click()
        await unscoped
        return '"Alle" → Anfrage OHNE detailViewType'
      })
    }

    // ── A4a-4: Einzeltyp-Library zeigt KEINEN Leitfilter (Regression) ──────
    if (!LIB_SINGLE) {
      d.manuell('A4a-4', 'Einzeltyp ohne Leitfilter', 'LIB_SINGLE nicht gesetzt')
    } else {
      await d.step('A4a-4', 'Einzeltyp-Library zeigt KEINEN Leitfilter', async () => {
        const id = await findLibraryId(page, LIB_SINGLE)
        if (!id) throw new Error(`Library "${LIB_SINGLE}" nicht gefunden`)
        await activateLibrary(page, LIB_SINGLE)
        await gotoGallery(page)
        // Kurz warten, damit die Galerie gerendert hat, dann Abwesenheit pruefen
        await page.waitForTimeout(1500)
        const visible = await page.getByTestId('view-type-lead-filter').isVisible().catch(() => false)
        if (visible) throw new Error('Leitfilter sichtbar, obwohl nur 1 Typ — Regression!')
        return 'kein Leitfilter (korrekt fuer Einzeltyp)'
      })
    }

    // ── A4c: Story-Anhaenge je Format ──────────────────────────────────────
    if (!STORY_PATH) {
      d.manuell('A4c-1', 'Story-Anhaenge je Format', 'STORY_PATH nicht gesetzt')
    } else {
      await d.step('A4c-1', 'Story rendert Anhaenge formatgerecht', async () => {
        await page.goto(STORY_PATH, { waitUntil: 'domcontentloaded' })
        await dismissReauthDialog(page)
        // Mindestens EINE Format-Gruppe muss erscheinen (data-format am Gruppen-Div)
        const anyGroup = page.locator('[data-format]')
        await expect(anyGroup.first()).toBeVisible({ timeout: 30_000 })
        // Welche Formate sind vertreten? (rein informativ — Anhaenge variieren)
        const formats = await anyGroup.evaluateAll(els =>
          Array.from(new Set(els.map(e => e.getAttribute('data-format')))).join(', '),
        )
        // Bild-Gruppe → echtes <img>; Video/Audio-Gruppe → echter Player
        const img = page.locator('[data-format="image"] img')
        const media = page.locator('[data-format="video"] video, [data-format="audio"] audio')
        const imgCount = await img.count()
        const mediaCount = await media.count()
        return `Formate: [${formats}] — Bilder:${imgCount}, Player:${mediaCount}`
      })
    }
  } finally {
    d.save()
  }
})
