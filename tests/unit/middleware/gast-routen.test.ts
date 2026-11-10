// @vitest-environment node
/**
 * Waechter fuer den Gast-Zugang des Testimonial-Recorders (Owner-Entscheidung
 * 12.09.2026, Dialog-Fall): Die API-Schicht (`/api/public/testimonials`,
 * `/api/public/secretary/*`) lief seit Januar ohne Konto, die Seite davor
 * (`/public/testimonial`) fehlte in der Liste der oeffentlichen Routen —
 * Clerk maskierte sie anonymen Besucher:innen als 404, der QR-Code lief ins
 * Leere (Analyse `docs/analysis/dialog-flow-bestand.md`, 1.3).
 *
 * Die Middleware laesst sich nicht ohne Clerk-Laufzeit importieren; der Test
 * liest deshalb die Routenliste aus dem Quelltext.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const quelle = readFileSync(join(process.cwd(), 'src/middleware.ts'), 'utf-8')

/** Die Eintraege des `createRouteMatcher([...])`-Aufrufs, ohne Kommentare. */
function oeffentlicheRouten(): string[] {
  const block = quelle.match(/createRouteMatcher\(\[([\s\S]*?)\]\)/)
  if (!block) throw new Error('createRouteMatcher([...]) nicht in src/middleware.ts gefunden')
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
}

describe('Middleware: Gast-Routen des Testimonial-Pfads', () => {
  it('fuehrt die Seite des Gast-Recorders als oeffentliche Route', () => {
    expect(oeffentlicheRouten()).toContain('/public/testimonial(.*)')
  })

  it('laesst die Gast-API weiterhin ohne Konto durch', () => {
    expect(oeffentlicheRouten()).toContain('/api/public(.*)')
  })
})

/**
 * Anonym lesbare Chat-Routen (Owner 10.11.2026): Die Story-Sektion der Startseite
 * laedt die Karten der zitierten Dokumente ueber `docs/by-fileids`. Die Route fehlte
 * in der Ausnahme — angemeldet kamen die Karten, anonym antwortete Clerk mit 404.
 * Der Test liest den Ausdruck aus dem Quelltext (die Middleware laesst sich ohne
 * Clerk-Laufzeit nicht importieren).
 */
function chatAusnahme(): RegExp {
  const treffer = quelle.match(/const isChatApiPath = (\/.+\/)\.test\(path\)/)
  if (!treffer) throw new Error('isChatApiPath nicht in src/middleware.ts gefunden')
  const roh = treffer[1]
  return new RegExp(roh.slice(1, roh.lastIndexOf('/')))
}

describe('Middleware: anonym lesbare Chat-Routen', () => {
  const lib = '/api/chat/67774136-d829-412b-8c78-7d0f2d3f4bcd'

  it('laesst die Kartendaten zitierter Dokumente (docs/by-fileids) ohne Konto durch', () => {
    expect(chatAusnahme().test(`${lib}/docs/by-fileids`)).toBe(true)
  })

  it('die bisherigen Lese-Routen bleiben offen', () => {
    for (const route of ['docs', 'facets', 'config', 'doc-meta', 'doc-by-slug', 'popular-questions']) {
      expect(chatAusnahme().test(`${lib}/${route}`)).toBe(true)
    }
  })

  it('oeffnet nichts darueber hinaus: andere Unterpfade von docs und schreibende Routen bleiben geschuetzt', () => {
    for (const route of ['docs/publish', 'docs/publish-bulk', 'docs/ids', 'docs/by-fileids/x', 'upsert-doc-meta', 'ingest', 'queries/admin/x']) {
      expect(chatAusnahme().test(`${lib}/${route}`)).toBe(false)
    }
  })
})
