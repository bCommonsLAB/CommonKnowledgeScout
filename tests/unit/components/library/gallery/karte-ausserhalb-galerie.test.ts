/**
 * Waechter: Wer eine Galerie-Karte AUSSERHALB der Galerie zeigt, bringt den
 * Adressierungs-Anbieter mit.
 *
 * Hintergrund: Nach #234 brauchte `DocumentCard` einen
 * `GalleryNavigationProvider`. Innerhalb der Galerie liefert ihn der
 * Montagepunkt (`src/app/library/gallery/client.tsx`). Zwei Stellen ausserhalb
 * hatten keinen und warfen beim Rendern — darunter die oeffentliche
 * Root-Landingpage. Dieser Test zaehlt jede Datei ausserhalb des
 * Galerie (seit M4i: im Paket), die die Karte importiert, und verlangt fuer jede eine
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
 * `anbieterIn` ist die Datei, die `GalleryAppProviders` montiert — sie
 * wird unten wirklich geprueft, nicht nur behauptet.
 */
const BEKANNTE_AUFRUFSTELLEN: Record<string, { anbieterIn: string; warum: string }> = {
  'src/components/library/file-preview/gallery-teaser-card.tsx': {
    anbieterIn: 'src/components/library/file-preview/gallery-teaser-card.tsx',
    warum: 'Teaser im Job-Report-Tab; die Huelle bringt die Anbieter selbst mit.',
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

// Seit M4i kommt die Karte aus dem Paket: ein Import von `DocumentCard` aus `@ks/module-explorer/react`.
const IMPORTIERT_KARTE = /import\s*(?:type\s*)?\{[^}]*\bDocumentCard\b[^}]*\}\s*from\s*['"]@ks\/module-explorer\/react['"]/

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
        'Entweder GalleryTeaserCard verwenden oder GalleryAppProviders am ' +
        'Montagepunkt setzen — und die Stelle oben eintragen.'
    ).toEqual([])
  })

  it('kein Eintrag ist verwaist', () => {
    const verwaist = Object.keys(BEKANNTE_AUFRUFSTELLEN).filter((f) => !aufrufstellen.includes(f))
    expect(verwaist, `Eingetragen, aber importiert die Karte nicht mehr:\n${verwaist.join('\n')}`).toEqual([])
  })

  it('der benannte Anbieter montiert GalleryAppProviders wirklich', () => {
    const behauptet: string[] = []
    for (const [stelle, { anbieterIn }] of Object.entries(BEKANNTE_AUFRUFSTELLEN)) {
      const inhalt = readFileSync(join(REPO_ROOT, anbieterIn), 'utf-8')
      if (!/<GalleryAppProviders[\s>]/.test(inhalt)) behauptet.push(`${stelle} → ${anbieterIn}`)
    }
    expect(behauptet, `Anbieter behauptet, aber nicht montiert:\n${behauptet.join('\n')}`).toEqual([])
  })
})

/**
 * Seit M5 braucht auch `useGalleryData` den Gastgeber: Er holt sich dort die
 * Instanz (`useInstanz()`, Basis-URL). Ausserhalb des Pakets ruft ihn genau
 * eine Stelle — das Chat-Panel, das die Galerie als Story-Slot einhaengt.
 * Dieselbe Pruefung wie oben, damit #248 sich nicht ueber einen Hook wiederholt.
 */
const BEKANNTE_DATEN_NUTZER: Record<string, { anbieterIn: string; warum: string }> = {
  'src/components/library/chat/chat-panel.tsx': {
    anbieterIn: 'src/app/library/gallery/client.tsx',
    warum:
      'Das Chat-Panel haengt nur als storyPanel-Slot in der Galerie (LazyChatPanel), ' +
      'also innerhalb von GalleryAppProviders im Galerie-Montagepunkt.',
  },
}

const IMPORTIERT_DATEN = /import\s*(?:type\s*)?\{[^}]*\buseGalleryData\b[^}]*\}\s*from\s*['"]@ks\/module-explorer\/react['"]/

describe('Galerie-Daten ausserhalb der Galerie', () => {
  const quellen = collect(join(REPO_ROOT, 'src')).map((f) => relative(REPO_ROOT, f).replace(/\\/g, '/'))
  const aufrufstellen = quellen.filter((f) => IMPORTIERT_DATEN.test(readFileSync(join(REPO_ROOT, f), 'utf-8')))

  it('jede Aufrufstelle ist mit ihrem Anbieter eingetragen', () => {
    const unbekannt = aufrufstellen.filter((f) => !(f in BEKANNTE_DATEN_NUTZER))
    expect(
      unbekannt,
      `useGalleryData ausserhalb der Galerie ohne eingetragenen Anbieter:\n${unbekannt.join('\n')}\n` +
        'Der Hook braucht einen GalleryHostProvider (wirft sonst) — GalleryAppProviders am ' +
        'Montagepunkt setzen und die Stelle oben eintragen.'
    ).toEqual([])
  })

  it('kein Eintrag ist verwaist', () => {
    const verwaist = Object.keys(BEKANNTE_DATEN_NUTZER).filter((f) => !aufrufstellen.includes(f))
    expect(verwaist, `Eingetragen, aber ruft useGalleryData nicht mehr:\n${verwaist.join('\n')}`).toEqual([])
  })

  it('der benannte Anbieter montiert GalleryAppProviders wirklich', () => {
    const behauptet = Object.entries(BEKANNTE_DATEN_NUTZER)
      .filter(([, { anbieterIn }]) => !/<GalleryAppProviders[\s>]/.test(readFileSync(join(REPO_ROOT, anbieterIn), 'utf-8')))
      .map(([stelle, { anbieterIn }]) => `${stelle} → ${anbieterIn}`)
    expect(behauptet, `Anbieter behauptet, aber nicht montiert:\n${behauptet.join('\n')}`).toEqual([])
  })

  it('das Chat-Panel wird nirgends sonst montiert', () => {
    // Die Eintragung oben traegt nur, solange der Chat allein als Galerie-Slot haengt.
    const montagen = quellen
      .filter((f) => !f.startsWith('src/components/library/chat/'))
      .filter((f) => /['"]@\/components\/library\/chat\/chat-panel['"]/.test(readFileSync(join(REPO_ROOT, f), 'utf-8')))
    expect(montagen).toEqual(['src/app/library/gallery/client.tsx'])
  })
})
