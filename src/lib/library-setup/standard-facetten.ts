/**
 * @fileoverview Standard-Facetten je Inhaltstyp (Owner-Entscheid E8, Plan
 * speicher-verbindungen-und-library-anlage, C1) — analog F11 der Standard-Vorlagen.
 *
 * @description
 * Eine neue Library bekommt als Facetten-Vorschlag: die verbindlichen
 * Basis-Facetten (`BASE_FACET_DEFS`) plus die filtertauglichen Felder, die
 * die Standard-Vorlage ihres Inhaltstyps (`standard-<typ>`) tatsaechlich
 * erzeugt. Abgeleitet, nicht abgeschrieben: welche Felder eine Vorlage hat,
 * kommt aus `getBuiltinDefaultTemplate`; hier steht nur, WELCHE Felder als
 * Filter taugen und wie. Ein CI-Test belegt, dass jede Standard-Facette ein
 * Feld der Standard-Vorlage ist und kein Kandidat tot ist.
 *
 * @module library-setup
 */

import { BASE_FACET_DEFS, type BaseFacetType } from '@/lib/detail-view-types/base-fields'
import type { DetailViewType } from '@/lib/detail-view-types/registry'
import { getBuiltinDefaultTemplate } from '@/lib/templates/default-templates'

export interface StandardFacette {
  metaKey: string
  label: string
  type: BaseFacetType
  multi: boolean
  visible: boolean
  mandatory?: boolean
}

/**
 * Filtertaugliche Felder (diskrete Werte), in Anzeige-Reihenfolge. Freitext,
 * URLs, Bilder und Messwerte gehoeren nicht hierher.
 */
export const FACETTEN_KANDIDATEN: readonly StandardFacette[] = [
  { metaKey: 'year', label: 'Year', type: 'number', multi: true, visible: true },
  { metaKey: 'event', label: 'Event', type: 'string', multi: true, visible: true },
  { metaKey: 'track', label: 'Track', type: 'string', multi: true, visible: true },
  { metaKey: 'speakers', label: 'Speakers', type: 'string[]', multi: true, visible: true },
  { metaKey: 'organisation', label: 'Organisation', type: 'string', multi: true, visible: false },
  { metaKey: 'location', label: 'Location', type: 'string', multi: true, visible: false },
  { metaKey: 'category', label: 'Category', type: 'string', multi: true, visible: true },
  { metaKey: 'arbeitsgruppe', label: 'Arbeitsgruppe', type: 'string', multi: true, visible: true },
  { metaKey: 'lv_zustaendigkeit', label: 'Zuständigkeit', type: 'string', multi: true, visible: false },
  { metaKey: 'author_role', label: 'Role', type: 'string', multi: true, visible: false },
  { metaKey: 'dokumentTyp', label: 'Dokumenttyp', type: 'string', multi: true, visible: true },
  { metaKey: 'lieferant', label: 'Lieferant', type: 'string', multi: true, visible: true },
  { metaKey: 'material_class', label: 'Materialklasse', type: 'string', multi: true, visible: true },
  { metaKey: 'color_family', label: 'Farbfamilie', type: 'string', multi: true, visible: true },
  { metaKey: 'geraetetyp', label: 'Gerätetyp', type: 'string', multi: true, visible: true },
  { metaKey: 'betriebssystem', label: 'Betriebssystem', type: 'string', multi: true, visible: false },
  { metaKey: 'region', label: 'Region', type: 'string', multi: true, visible: true },
  { metaKey: 'docType', label: 'DocType', type: 'string', multi: true, visible: true },
  { metaKey: 'topics', label: 'Topics', type: 'string[]', multi: true, visible: false },
  { metaKey: 'language', label: 'Language', type: 'string', multi: true, visible: false },
]

/** Feldschluessel der Standard-Vorlage eines Inhaltstyps. */
export function felderDerStandardVorlage(typ: DetailViewType): Set<string> {
  return new Set(getBuiltinDefaultTemplate(typ).metadata.fields.map((f) => f.key))
}

/** Facetten-Vorschlag fuer eine neue Library dieses Inhaltstyps. */
export function standardFacettenFuer(typ: DetailViewType): StandardFacette[] {
  const felder = felderDerStandardVorlage(typ)
  const basis: StandardFacette[] = BASE_FACET_DEFS.map((d) => ({ ...d }))
  const basisSchluessel = new Set(basis.map((f) => f.metaKey))
  const zusatz = FACETTEN_KANDIDATEN.filter((k) => felder.has(k.metaKey) && !basisSchluessel.has(k.metaKey)).map((k) => ({ ...k }))
  return [...basis, ...zusatz]
}
