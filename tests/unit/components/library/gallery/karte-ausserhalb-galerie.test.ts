/**
 * Waechter: Wer eine Galerie-Karte AUSSERHALB der Galerie zeigt, bringt den
 * Adressierungs-Anbieter mit.
 *
 * Hintergrund: Nach #234 brauchte `DocumentCard` einen
 * `GalleryNavigationProvider`. Innerhalb der Galerie liefert ihn der
 * Montagepunkt (`src/app/library/gallery/client.tsx`). Zwei Stellen ausserhalb
 * hatten keinen und warfen beim Rendern — darunter die oeffentliche
 * Root-Landingpage. Dieser Test zaehlt jede Datei ausserhalb des
 * Galerie-Ordners, die die Karte importiert, und verlangt fuer jede eine
 * benannte Begruendung, wo der Anbieter sitzt.
 *
 * Eine neue Aufrufstelle faellt hier rot, bis sie eingetragen ist — mit dem
 * Anbieter, nicht mit einer Ausrede.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const REPO_ROOT = process.cwd()
const GALERIE = 'src/components/library/gallery/'

/**
 * Bekannte Aufrufstellen ausserhalb der Galerie und wo ihr Anbieter sitzt.
 * `anbieterIn` ist die Datei, die `NextGalleryNavigation` montiert — sie
 * wird unten wirklich geprueft, nicht nur behauptet.
 */
const BEKANNTE_AUFRUFSTELLEN: Record<string, { anbieterIn: string; warum: string }> = {
  'src/components/library/file-preview/gallery-teaser-card.tsx': {
    anbieterIn: 'src/components/library/file-preview/gallery-teaser-card.tsx',
    warum: 'Teaser im Job-Report-Tab; die Huelle bringt den Anbieter selbst mit.',
  },
  'src/components/library/website/website-landing-live.tsx': {
    anbieterIn: 'src/app/page.tsx',
    warum:
      'Wird an zwei Stellen montiert: in GalleryRoot (Anbieter vom Galerie-' +
      'Montagepunkt) und auf der Root-Landingpage — dort muss page.tsx ihn liefern.',
  },
}

function collect(dir: string, acc: string[] = []): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return acc
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.next') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) collect(full, acc)
    else if (/\.tsx?$/.test(entry)) acc.push(full)
  }
  return acc
}

const IMPORTIERT_KARTE = /from ['"]@\/components\/library\/gallery\/document-card['"]/

describe('Galerie-Karte ausserhalb der Galerie', () => {
  const aufrufstellen = collect(join(REPO_ROOT, 'src'))
    .map((f) => relative(REPO_ROOT, f).replace(/\\/g, '/'))
    .filter((f) => !f.startsWith(GALERIE))
    .filter((f) => IMPORTIERT_KARTE.test(readFileSync(join(REPO_ROOT, f), 'utf-8')))

  it('jede Aufrufstelle ausserhalb der Galerie ist mit ihrem Anbieter eingetragen', () => {
    const unbekannt = aufrufstellen.filter((f) => !(f in BEKANNTE_AUFRUFSTELLEN))
    expect(
      unbekannt,
      `Galerie-Karte ausserhalb der Galerie ohne eingetragenen Anbieter:\n${unbekannt.join('\n')}\n` +
        'DocumentCard braucht einen GalleryNavigationProvider (wirft sonst). ' +
        'Entweder GalleryTeaserCard verwenden oder NextGalleryNavigation am ' +
        'Montagepunkt setzen — und die Stelle oben eintragen.'
    ).toEqual([])
  })

  it('kein Eintrag ist verwaist', () => {
    const verwaist = Object.keys(BEKANNTE_AUFRUFSTELLEN).filter((f) => !aufrufstellen.includes(f))
    expect(verwaist, `Eingetragen, aber importiert die Karte nicht mehr:\n${verwaist.join('\n')}`).toEqual([])
  })

  it('der benannte Anbieter montiert NextGalleryNavigation wirklich', () => {
    const behauptet: string[] = []
    for (const [stelle, { anbieterIn }] of Object.entries(BEKANNTE_AUFRUFSTELLEN)) {
      const inhalt = readFileSync(join(REPO_ROOT, anbieterIn), 'utf-8')
      if (!/<NextGalleryNavigation[\s>]/.test(inhalt)) behauptet.push(`${stelle} → ${anbieterIn}`)
    }
    expect(behauptet, `Anbieter behauptet, aber nicht montiert:\n${behauptet.join('\n')}`).toEqual([])
  })
})
