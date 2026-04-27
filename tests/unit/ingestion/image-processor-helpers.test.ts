/**
 * Char-Tests fuer die in Welle 3 (Schritt 4) extrahierten pure Helper aus
 * `src/lib/ingestion/image-processor-helpers.ts`.
 *
 * Vor der Extraktion lebten diese Funktionen als `private static` in der
 * Klasse `ImageProcessor` und waren nicht direkt testbar. Diese Tests
 * schreiben das beobachtete Verhalten als Char-Tests fest.
 */

import { describe, expect, it } from 'vitest'
import {
  formatImageError,
  getImageCacheKey,
  normalizeImagePath,
} from '@/lib/ingestion/image-processor-helpers'

describe('getImageCacheKey', () => {
  it('joined libraryId, scope, hash, extension mit Doppelpunkt', () => {
    expect(getImageCacheKey('lib1', 'books', 'abc123', 'jpg'))
      .toBe('lib1:books:abc123:jpg')
  })

  it('liefert unterschiedliche Keys fuer unterschiedliche Scopes', () => {
    const a = getImageCacheKey('lib1', 'books', 'h', 'png')
    const b = getImageCacheKey('lib1', 'sessions', 'h', 'png')
    expect(a).not.toBe(b)
  })

  it('idempotent: gleiche Eingabe → gleicher Key', () => {
    expect(getImageCacheKey('lib1', 'books', 'h', 'jpg'))
      .toBe(getImageCacheKey('lib1', 'books', 'h', 'jpg'))
  })
})

describe('normalizeImagePath — gueltige Pfade', () => {
  it('entfernt fuehrende Slashes', () => {
    expect(normalizeImagePath('/img/a.jpg')).toEqual({ success: true, path: 'img/a.jpg' })
  })

  it('entfernt nachgestellte Slashes', () => {
    expect(normalizeImagePath('img/a.jpg/')).toEqual({ success: true, path: 'img/a.jpg' })
  })

  it('entfernt mehrere fuehrende und nachgestellte Slashes', () => {
    expect(normalizeImagePath('///img/a.jpg///'))
      .toEqual({ success: true, path: 'img/a.jpg' })
  })

  it('akzeptiert Pfade ohne Slashes unveraendert', () => {
    expect(normalizeImagePath('img.jpg')).toEqual({ success: true, path: 'img.jpg' })
  })

  it('akzeptiert leeren String (kein Wurf, leerer Pfad)', () => {
    expect(normalizeImagePath('')).toEqual({ success: true, path: '' })
  })
})

describe('normalizeImagePath — Path-Traversal-Schutz', () => {
  it('lehnt einfaches ".." ab', () => {
    const result = normalizeImagePath('../etc/passwd')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Path traversal erkannt')
  })

  it('lehnt eingebettetes ".." ab', () => {
    const result = normalizeImagePath('img/../../secrets.txt')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Path traversal erkannt')
  })

  it('liefert keine path-Eigenschaft bei Path-Traversal-Fehler', () => {
    const result = normalizeImagePath('../foo')
    expect(result.path).toBeUndefined()
  })
})

describe('formatImageError — Phasen-Praefix [Schritt: Bild-Upload]', () => {
  it('mappt "not found" auf "Bild nicht gefunden"', () => {
    expect(formatImageError('image not found', 'img/a.jpg'))
      .toBe('[Schritt: Bild-Upload] Bild nicht gefunden: img/a.jpg')
  })

  it('mappt "nicht gefunden" auf dieselbe Meldung (DE-Variante)', () => {
    expect(formatImageError('Datei nicht gefunden', 'img/a.jpg'))
      .toBe('[Schritt: Bild-Upload] Bild nicht gefunden: img/a.jpg')
  })

  it('mappt "does not exist" auf eigene Meldung', () => {
    expect(formatImageError('file does not exist', 'img/a.jpg'))
      .toBe('[Schritt: Bild-Upload] Bild-Datei existiert nicht: img/a.jpg')
  })

  it('mappt "Upload fehlgeschlagen" und entfernt redundantes Praefix', () => {
    const result = formatImageError('Upload fehlgeschlagen: 503 Service Unavailable', 'img/a.jpg')
    expect(result).toBe('[Schritt: Bild-Upload] Upload fehlgeschlagen für img/a.jpg: 503 Service Unavailable')
  })

  it('liefert Default-Praefix fuer unbekannte Fehlermeldungen', () => {
    expect(formatImageError('Etwas Generisches', 'img/a.jpg'))
      .toBe('[Schritt: Bild-Upload] Etwas Generisches')
  })
})
