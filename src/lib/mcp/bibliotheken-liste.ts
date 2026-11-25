/**
 * @fileoverview Zeilen von `bibliotheken_auflisten`: eigene UND geteilte Libraries.
 *
 * @description
 * Befund 25.11.2026: Ein eingeladener Mitarbeiter (Co-Creator) sah ueber die
 * Bruecke keine einzige Library, obwohl jedes Werkzeug ihn mit der Library-Id
 * durchgelassen haette — die Liste nannte nur Libraries, die dem Konto selbst
 * gehoeren. Jetzt stehen geteilte Libraries mit ihrer Rolle dabei.
 *
 * Slugs: Die eigenen werden wie bisher ueber die ganze eigene Liste bestimmt
 * (Kollisionen benannt). Geteilte Libraries bekommen ihren Slug einzeln — sie
 * duerfen die Eindeutigkeit der eigenen nicht veraendern.
 *
 * @module mcp
 */

import { bestimmeSlugs, type LibrarySlug } from '@/lib/library-adresse/slug'
import type { Library } from '@/types/library'
import { archivpflegeAktiv } from './archivpflege'

export type BibliothekRolle = 'eigene' | 'co-creator' | 'reader'

export interface BibliothekZeile {
  id: string
  name: string
  rolle: BibliothekRolle
  archivpflege: boolean
  slug: string | null
  slugHerkunft: string | null
  slugKonflikt?: string
  frueherSlugs?: string[]
}

export type GeteilteLibrary = Library & { accessRole: 'co-creator' | 'reader' }

function zeile(library: Library, rolle: BibliothekRolle, eintrag: LibrarySlug | undefined): BibliothekZeile {
  return {
    id: library.id,
    name: library.label,
    rolle,
    archivpflege: archivpflegeAktiv(library),
    slug: eintrag?.slug ?? null,
    slugHerkunft: eintrag?.herkunft ?? null,
    ...(eintrag?.konflikt ? { slugKonflikt: eintrag.konflikt } : {}),
    ...(eintrag && eintrag.frueher.length > 0 ? { frueherSlugs: eintrag.frueher } : {}),
  }
}

export function bibliothekenZeilen(
  eigene: readonly Library[],
  geteilte: readonly GeteilteLibrary[],
): BibliothekZeile[] {
  const eigeneSlugs = new Map(bestimmeSlugs(eigene).map((eintrag) => [eintrag.libraryId, eintrag]))
  const eigeneIds = new Set(eigene.map((library) => library.id))
  return [
    ...eigene.map((library) => zeile(library, 'eigene', eigeneSlugs.get(library.id))),
    ...geteilte
      .filter((library) => !eigeneIds.has(library.id))
      .map((library) => zeile(library, library.accessRole, bestimmeSlugs([library])[0])),
  ]
}
