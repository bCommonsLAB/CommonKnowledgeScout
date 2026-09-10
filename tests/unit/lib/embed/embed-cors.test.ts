/**
 * CORS fuer das Embed (M5): Nur die Lese-Routen, die das anonyme Embed
 * braucht, antworten fremden Herkuenften — und nie mit Anmeldedaten.
 *
 * Owner-Entscheidung 2026-09-10: jede Herkunft, nur oeffentliche Libraries.
 * Ob eine Library oeffentlich ist, pruefen die Routen selbst; dieser Test haelt
 * fest, dass keine schreibende oder angemeldete Route in die Liste rutscht.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { EMBED_READ_ROUTES, embedCorsHeaders } from '@/lib/embed/embed-cors'

describe('embedCorsHeaders', () => {
  it.each([
    ['GET', '/api/public/libraries/aeced'],
    ['GET', '/api/chat/lib-1/docs'],
    ['GET', '/api/chat/lib-1/facets'],
    ['GET', '/api/chat/lib-1/doc-meta'],
    ['GET', '/api/library/lib-1/doc-relations'],
    ['POST', '/api/library/lib-1/doc-relations'],
    ['GET', '/api/libraries/lib-1/access-check'],
  ])('%s %s ist fuer fremde Herkuenfte lesbar', (method, path) => {
    expect(embedCorsHeaders(method, path)).toEqual({ 'Access-Control-Allow-Origin': '*' })
  })

  it.each([
    // Schreiben und Verwalten (Audit 03, Abschnitt C)
    ['DELETE', '/api/chat/lib-1/docs/delete'],
    ['POST', '/api/chat/lib-1/docs/publish'],
    ['POST', '/api/chat/lib-1/docs/publish-bulk'],
    ['POST', '/api/library/lib-1/doc-relations/recompute'],
    ['POST', '/api/library/lib-1/doc-similarity/recompute'],
    ['POST', '/api/library/lib-1/source-comments'],
    ['POST', '/api/library/lib-1/source-user-states'],
    ['PATCH', '/api/libraries/lib-1'],
    ['POST', '/api/libraries/lib-1/access-request'],
    ['PATCH', '/api/diva-texture/material-classification'],
    // Nur angemeldet oder nicht Teil des Embeds
    ['GET', '/api/library/explore-by-slug/aeced'],
    ['GET', '/api/chat/lib-1/docs/by-fileids'],
    ['GET', '/api/chat/lib-1/queries/q1'],
    ['GET', '/api/storage/streaming-url'],
    // Falsche Methode auf einer Lese-Route
    ['POST', '/api/chat/lib-1/docs'],
    ['DELETE', '/api/library/lib-1/doc-relations'],
  ])('%s %s bekommt keinen CORS-Kopf', (method, path) => {
    expect(embedCorsHeaders(method, path)).toBeNull()
  })

  it('beantwortet den Preflight nur fuer Lese-Routen, mit genau deren Methoden', () => {
    expect(embedCorsHeaders('OPTIONS', '/api/library/lib-1/doc-relations')).toMatchObject({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept-Language',
    })
    expect(embedCorsHeaders('OPTIONS', '/api/chat/lib-1/doc-meta')?.['Access-Control-Allow-Methods']).toBe('GET, OPTIONS')
    expect(embedCorsHeaders('OPTIONS', '/api/library/lib-1/doc-relations/recompute')).toBeNull()
    expect(embedCorsHeaders('OPTIONS', '/api/chat/lib-1/docs/delete')).toBeNull()
  })

  it('erlaubt nie Anmeldedaten', () => {
    const beispiele = ['/api/public/libraries/a', '/api/chat/l/docs', '/api/library/l/doc-relations', '/api/libraries/l/access-check']
    for (const path of beispiele) {
      for (const method of ['GET', 'POST', 'OPTIONS']) {
        const kopf = embedCorsHeaders(method, path) ?? {}
        expect(Object.keys(kopf).map((k) => k.toLowerCase())).not.toContain('access-control-allow-credentials')
      }
    }
  })

  it('die Liste kennt nur GET und, begruendet, POST', () => {
    for (const route of EMBED_READ_ROUTES) {
      for (const method of route.methods) expect(['GET', 'POST']).toContain(method)
      expect(route.zweck.length).toBeGreaterThan(0)
    }
  })
})

describe('Middleware und Embed-CORS', () => {
  const quelle = readFileSync(join(process.cwd(), 'src/middleware.ts'), 'utf-8')

  it('beantwortet den Preflight, bevor die Anmeldung geprueft wird', () => {
    // Sonst endet OPTIONS in auth.protect() als 404, und der Browser schickt die
    // eigentliche Anfrage nie ab (Audit 03, Befund 2).
    const preflight = quelle.indexOf("embedCorsHeaders('OPTIONS'")
    // Der Aufruf, nicht die Erwaehnung im Kommentar ueber dem Preflight.
    const schutz = quelle.indexOf('await auth.protect()')
    expect(preflight).toBeGreaterThan(-1)
    expect(schutz).toBeGreaterThan(-1)
    expect(preflight).toBeLessThan(schutz)
  })

  it('setzt die Lese-Kopfzeilen, bevor oeffentliche Antworten zurueckgehen', () => {
    const kopf = quelle.indexOf('embedCorsHeaders(req.method')
    const oeffentlich = quelle.indexOf('if (isPublic) return response')
    expect(kopf).toBeGreaterThan(-1)
    expect(kopf).toBeLessThan(oeffentlich)
  })
})
