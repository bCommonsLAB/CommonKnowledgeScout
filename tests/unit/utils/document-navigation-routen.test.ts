/**
 * Characterization Tests fuer das Adressier-Verhalten der Galerie.
 *
 * `openDocumentBySlug` und `closeDocument` sind der Grund, warum die Galerie
 * heute nicht einbettbar ist: Sie kennen nicht nur einen Router, sondern zwei
 * fest verdrahtete Routen-Formen (`/explore/:slug` und `/library/gallery`) und
 * raten bei allem anderen (Galerie-Audit, Befund 2).
 *
 * Diese Tests bewerten das Verhalten NICHT — sie schreiben auf, wie es heute
 * ist. Sie sind das Netz fuer die Welle „Galerie-Adressierung": Wer die
 * Adressierung spaeter hinter ein Protokoll legt, muss diese Faelle
 * unveraendert bedienen, oder die Abweichung bewusst begruenden.
 *
 * Zwei Eigenheiten sind hier absichtlich festgehalten, weil sie beim
 * Umbau leicht unbemerkt verschwinden:
 *
 * 1. Auf einer `/library`-Route, die NICHT die Galerie ist, wird `push`
 *    benutzt (neuer History-Eintrag), sonst ueberall `replace`.
 * 2. Im Unbekannt-Fall gehen bestehende URL-Parameter VERLOREN — dieser Zweig
 *    baut die Parameter neu auf, statt die vorhandenen zu uebernehmen.
 *
 * Signatur-Aenderung (Teil A der Adressierungs-Welle): `libraryId` war ein
 * Parameter, den die Funktion nie gelesen hat — sechs Aufrufstellen reichten
 * ihn umsonst durch. Er ist entfallen; das Verhalten ist unveraendert.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { openDocumentBySlug, closeDocument } from '@/utils/document-navigation'

type FakeRouter = Parameters<typeof openDocumentBySlug>[1]

function createRouter() {
  return {
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }
}

/** Die Funktionen loggen ausfuehrlich; hier stummgeschaltet. */
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

const params = (query: string) => new URLSearchParams(query)

describe('openDocumentBySlug', () => {
  it('tut nichts ohne Slug', () => {
    const router = createRouter()
    openDocumentBySlug(
        '', router as unknown as FakeRouter, '/explore/klima', params(''))
    expect(router.push).not.toHaveBeenCalled()
    expect(router.replace).not.toHaveBeenCalled()
  })

  describe('auf der Explore-Route', () => {
    it('setzt doc und behaelt bestehende Parameter', () => {
      const router = createRouter()
      openDocumentBySlug(
        'mein-doc',
        router as unknown as FakeRouter,
        '/explore/klima',
        params('view=grid&jahr=2024')
      )
      expect(router.replace).toHaveBeenCalledWith(
        '/explore/klima?view=grid&jahr=2024&doc=mein-doc',
        { scroll: false }
      )
      expect(router.push).not.toHaveBeenCalled()
    })

    it('ersetzt ein bereits gesetztes doc', () => {
      const router = createRouter()
      openDocumentBySlug(
        'neu',
        router as unknown as FakeRouter,
        '/explore/klima',
        params('doc=alt')
      )
      expect(router.replace).toHaveBeenCalledWith('/explore/klima?doc=neu', { scroll: false })
    })

    it('navigiert nicht, wenn der Library-Slug im Pfad fehlt', () => {
      const router = createRouter()
      openDocumentBySlug(
        'mein-doc', router as unknown as FakeRouter, '/explore/', params(''))
      expect(router.push).not.toHaveBeenCalled()
      expect(router.replace).not.toHaveBeenCalled()
    })
  })

  describe('auf einer Library-Route', () => {
    it('ersetzt die Adresse, wenn schon die Galerie offen ist', () => {
      const router = createRouter()
      openDocumentBySlug(
        'mein-doc',
        router as unknown as FakeRouter,
        '/library/gallery',
        params('view=table')
      )
      expect(router.replace).toHaveBeenCalledWith('/library/gallery?view=table&doc=mein-doc', {
        scroll: false,
      })
      expect(router.push).not.toHaveBeenCalled()
    })

    it('ersetzt auch auf einer Unterseite der Galerie', () => {
      const router = createRouter()
      openDocumentBySlug(
        'mein-doc',
        router as unknown as FakeRouter,
        '/library/gallery/details',
        params('')
      )
      expect(router.replace).toHaveBeenCalledWith('/library/gallery?doc=mein-doc', { scroll: false })
    })

    it('legt einen History-Eintrag an, wenn die Galerie noch nicht offen ist', () => {
      // Eigenheit 1: hier `push`, sonst ueberall `replace`.
      const router = createRouter()
      openDocumentBySlug(
        'mein-doc',
        router as unknown as FakeRouter,
        '/library/archiv',
        params('ordner=abc')
      )
      expect(router.push).toHaveBeenCalledWith('/library/gallery?ordner=abc&doc=mein-doc', {
        scroll: false,
      })
      expect(router.replace).not.toHaveBeenCalled()
    })
  })

  describe('auf einer unbekannten Route', () => {
    it('springt zur Library-Galerie und VERLIERT bestehende Parameter', () => {
      // Eigenheit 2: dieser Zweig baut die Parameter neu auf.
      const router = createRouter()
      openDocumentBySlug(
        'mein-doc',
        router as unknown as FakeRouter,
        '/irgendwo',
        params('view=grid&jahr=2024')
      )
      expect(router.push).toHaveBeenCalledWith('/library/gallery?doc=mein-doc', { scroll: false })
    })

    it('behandelt einen fehlenden Pfad wie eine unbekannte Route', () => {
      const router = createRouter()
      openDocumentBySlug(
        'mein-doc', router as unknown as FakeRouter, null, params(''))
      expect(router.push).toHaveBeenCalledWith('/library/gallery?doc=mein-doc', { scroll: false })
    })
  })
})

describe('closeDocument', () => {
  describe('auf der Explore-Route', () => {
    it('entfernt doc und laesst die uebrigen Parameter stehen', () => {
      const router = createRouter()
      closeDocument(router as unknown as FakeRouter, '/explore/klima', params('doc=x&view=grid'))
      expect(router.replace).toHaveBeenCalledWith('/explore/klima?view=grid', { scroll: false })
    })

    it('laesst das Fragezeichen weg, wenn nichts uebrig bleibt', () => {
      const router = createRouter()
      closeDocument(router as unknown as FakeRouter, '/explore/klima', params('doc=x'))
      expect(router.replace).toHaveBeenCalledWith('/explore/klima', { scroll: false })
    })

    it('navigiert nicht, wenn der Library-Slug im Pfad fehlt', () => {
      const router = createRouter()
      closeDocument(router as unknown as FakeRouter, '/explore/', params('doc=x'))
      expect(router.replace).not.toHaveBeenCalled()
    })
  })

  describe('auf einer Library-Route', () => {
    it('entfernt doc und behaelt die uebrigen Parameter', () => {
      const router = createRouter()
      closeDocument(router as unknown as FakeRouter, '/library/gallery', params('doc=x&view=table'))
      expect(router.replace).toHaveBeenCalledWith('/library/gallery?view=table', { scroll: false })
    })

    it('landet auch von einer anderen Library-Seite auf der Galerie', () => {
      const router = createRouter()
      closeDocument(router as unknown as FakeRouter, '/library/archiv', params('doc=x'))
      expect(router.replace).toHaveBeenCalledWith('/library/gallery', { scroll: false })
    })
  })

  describe('auf einer unbekannten Route', () => {
    it('springt zur Library-Galerie ohne Parameter', () => {
      const router = createRouter()
      closeDocument(router as unknown as FakeRouter, '/irgendwo', params('doc=x&view=grid'))
      expect(router.replace).toHaveBeenCalledWith('/library/gallery', { scroll: false })
    })

    it('behandelt einen fehlenden Pfad wie eine unbekannte Route', () => {
      const router = createRouter()
      closeDocument(router as unknown as FakeRouter, null, params(''))
      expect(router.replace).toHaveBeenCalledWith('/library/gallery', { scroll: false })
    })
  })
})
