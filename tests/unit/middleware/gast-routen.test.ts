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
