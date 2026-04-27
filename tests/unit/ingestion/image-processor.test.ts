/**
 * Char-Tests fuer Klasse `ImageProcessor` aus
 * `src/lib/ingestion/image-processor.ts`.
 *
 * Welle 3, Schritt 3: Festschreibung des aktuellen Verhaltens.
 *
 * Vertrag (siehe `.cursor/rules/ingestion-contracts.mdc` §1, §2, §4, §5):
 * - Klasse hat klassen-statischen Cache → Tests muessen ihn vor jedem
 *   Test via `clearImageCache()` zuruecksetzen.
 * - Bei NICHT konfiguriertem Azure-Storage liefern alle Methoden ein
 *   "no-op"-Result (Markdown unveraendert, Cover null, Slides
 *   unveraendert) — KEIN Wurf.
 * - Result-Objekte fuer Bild-Verarbeitung: `imageErrors[]` fuer einzelne
 *   Fehler, `markdown`/`slides` immer im aktuellsten Stand.
 *
 * Mock-Strategie:
 * - `resolveAzureStorageConfig` → null (Azure unkonfiguriert) =
 *   einfachster Pfad, keine echten Azure- oder Mongo-Calls.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// Pfad-Aufloeser fuer Azure-Config-Mock: standardmaessig "unkonfiguriert"
// (returns null), damit ImageProcessor in den frueh-return-Pfad faellt.
vi.mock('@/lib/config/azure-storage', () => ({
  resolveAzureStorageConfig: vi.fn(() => null),
}))

// Sicherheitsnetz: AzureStorageService darf nicht echt instanziiert werden.
vi.mock('@/lib/services/azure-storage-service', () => ({
  AzureStorageService: vi.fn().mockImplementation(() => ({
    isConfigured: () => false,
    containerExists: vi.fn(),
  })),
  calculateImageHash: vi.fn(() => 'fakehash'),
}))

// Mongo-Repository-Aufrufe sind in den getesteten Pfaden nicht erreichbar
// (frueh-return greift), wir mocken vorsorglich gegen versehentliche Calls.
vi.mock('@/lib/repositories/shadow-twin-repo', () => ({
  getShadowTwinBinaryFragments: vi.fn(async () => null),
}))

import { ImageProcessor } from '@/lib/ingestion/image-processor'
import type { StorageProvider } from '@/lib/storage/types'

// Minimaler Storage-Provider-Stub: keine Methode wird in den getesteten
// Pfaden tatsaechlich aufgerufen (Azure-Frueh-Return greift), aber das
// Type-System will die Signatur sehen.
const fakeProvider = {} as unknown as StorageProvider

describe('ImageProcessor.clearImageCache', () => {
  it('laeuft ohne Wurf, auch wenn Cache leer ist', () => {
    expect(() => ImageProcessor.clearImageCache()).not.toThrow()
  })

  it('idempotent: zweimaliger Aufruf ist okay', () => {
    ImageProcessor.clearImageCache()
    expect(() => ImageProcessor.clearImageCache()).not.toThrow()
  })
})

describe('ImageProcessor.processMarkdownImages — Azure unkonfiguriert', () => {
  beforeEach(() => {
    ImageProcessor.clearImageCache()
  })

  it('liefert Markdown unveraendert + leere Errors zurueck', async () => {
    const markdown = 'Hier ein Bild: ![alt](relativer/pfad.jpg)'
    const result = await ImageProcessor.processMarkdownImages(
      markdown,
      fakeProvider,
      'lib1',
      'f1',
      undefined,
      'job1',
      false,
      null,
    )

    expect(result.markdown).toBe(markdown)
    expect(result.imageErrors).toEqual([])
    expect(result.imageMapping).toEqual([])
  })

  it('liefert leeren imageErrors-Array auch bei Markdown OHNE Bilder', async () => {
    const markdown = 'Nur Text, keine Bilder.'
    const result = await ImageProcessor.processMarkdownImages(
      markdown,
      fakeProvider,
      'lib1',
      'f1',
      undefined,
      undefined,
      false,
      null,
    )

    expect(result.markdown).toBe(markdown)
    expect(result.imageErrors).toEqual([])
    expect(result.imageMapping).toEqual([])
  })
})

describe('ImageProcessor.processCoverImage — Azure unkonfiguriert', () => {
  beforeEach(() => {
    ImageProcessor.clearImageCache()
  })

  it('liefert null zurueck, wenn Azure nicht konfiguriert ist', async () => {
    const result = await ImageProcessor.processCoverImage(
      fakeProvider,
      undefined,
      'lib1',
      'f1',
      undefined,
      false,
      undefined,
      null,
    )

    expect(result).toBeNull()
  })
})

describe('ImageProcessor.processSlideImages — Azure unkonfiguriert', () => {
  beforeEach(() => {
    ImageProcessor.clearImageCache()
  })

  it('liefert die slides unveraendert + leere errors-Liste', async () => {
    const slides: Array<Record<string, unknown>> = [
      { title: 'Slide 1', image_url: 'foo.jpg' },
      { title: 'Slide 2', image_url: 'bar.jpg' },
    ]

    const result = await ImageProcessor.processSlideImages(
      slides,
      fakeProvider,
      'lib1',
      'f1',
      undefined,
      null,
    )

    expect(result.slides).toEqual(slides)
    expect(result.errors).toEqual([])
  })

  it('liefert auch bei leerem slides-Array ein konsistentes Result', async () => {
    const result = await ImageProcessor.processSlideImages(
      [],
      fakeProvider,
      'lib1',
      'f1',
      undefined,
      null,
    )

    expect(result.slides).toEqual([])
    expect(result.errors).toEqual([])
  })
})
