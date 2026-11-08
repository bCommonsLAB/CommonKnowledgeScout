/**
 * @fileoverview Datenmodell der Sitzungs-Sicht (Plan sitzungen-sichten-und-befunde, S1).
 *
 * @description
 * Eine Arbeitssitzung mit Claude liegt als Beleg `JJJJ-MM-TT Code|Chat <Titel>.md`
 * im Vorhabensordner; KnowledgeScout erzeugt daraus mit der Vorlage
 * `chatverlauf-de` eine Sitzungsnotiz (Transformation am Twin). Der
 * `SitzungsDatensatz` ist die Zeile, die Chronik und Bericht-Block daraus
 * rendern — gelesen aus Beleg-Dateiname (Datum, Art-Wort, Titel) und
 * Transformations-Frontmatter (teaser, werkzeug, sitzung, date, ende).
 * Reine Funktionen, kein I/O.
 *
 * @module agent-view/sichten
 */

import type { TransformationZeile } from '@/lib/repositories/shadow-twin-transformationen'
import { asString } from './bericht-lesen'

/** Dateiname der Chronik in `SICHTEN_ORDNER`. */
export const SITZUNGEN_FILE_NAME = 'SITZUNGEN.md'
/** Vorlage, deren Transformationen die Sitzungsnotizen sind (S2 macht das je Beleg-Typ konfigurierbar). */
export const SITZUNGS_VORLAGE = 'chatverlauf-de'
export const SITZUNGS_SPRACHE = 'de'

export type ArtWort = 'Code' | 'Chat'
/** Welche Sichten `sichten_regenerieren` erzeugt; Vorgabe sind alle drei. */
export type SichtName = 'aktuell' | 'projekte' | 'sitzungen'
export const ALLE_SICHTEN: readonly SichtName[] = ['aktuell', 'projekte', 'sitzungen']

export interface SitzungsDatensatz {
  /** `JJJJ-MM-TT` aus dem Beleg-Namen (ersatzweise `date` der Notiz). */
  datum: string
  /** Letzter Tag einer mehrtaegigen Sitzung (`ende` der Notiz); null = eintaegig/unbekannt. */
  ende: string | null
  titel: string
  /** Aus dem Beleg-Namen; null = Name ohne Art-Wort UND werkzeug unbekannt (Renderer schreibt „?"). */
  artWort: ArtWort | null
  werkzeug: string | null
  sitzungId: string | null
  /** Library-relativer Pfad des Vorhabensordners; null = Beleg liegt ausserhalb eines Vorhabens. */
  vorhabenPfad: string | null
  vorhabenFolderId: string | null
  /** Beleg-Dateiname ohne `.md` — das Ziel des Wikilinks. */
  belegName: string
  teaser: string
  transformationAktualisiert: string | null
  sourceId: string
}

const BELEG_NAME = /^(\d{4}-\d{2}-\d{2}) (Code|Chat) (.+)\.md$/
/** Datum am Namensanfang auch ohne Art-Wort (Notizen und Alt-Belege ohne Konvention). */
const DATUM_PREFIX = /^(\d{4}-\d{2}-\d{2}) /
const ISO_TAG = /^\d{4}-\d{2}-\d{2}$/
/** `werkzeug` der Notiz → Art-Wort, wenn der Dateiname keines traegt. Unbekannte Werte bleiben null. */
const WERKZEUG_ART: Readonly<Record<string, ArtWort>> = {
  'claude-code': 'Code', code: 'Code',
  'claude-chat': 'Chat', chat: 'Chat', 'claude-cowork': 'Chat', cowork: 'Chat',
}

/** Zerlegt `JJJJ-MM-TT Code|Chat <Titel>.md`; null = Name folgt der Konvention nicht. */
export function belegNameLesen(name: string): { datum: string; artWort: ArtWort; titel: string } | null {
  const match = name.match(BELEG_NAME)
  if (!match) return null
  return { datum: match[1], artWort: match[2] as ArtWort, titel: match[3].trim() }
}

export function belegOhneEndung(name: string): string {
  return name.replace(/\.md$/i, '')
}

export type SitzungErgebnis =
  | { ok: true; sitzung: SitzungsDatensatz }
  | { ok: false; beleg: string; grund: string }

/**
 * Baut den Datensatz aus einer Transformations-Zeile. Ohne lesbares Datum
 * (weder Name noch `date`) wird der Beleg mit Grund zurueckgegeben, nicht
 * still an das Ende sortiert.
 */
export function sitzungAusTransformation(
  zeile: TransformationZeile,
  vorhaben: { pfad: string; folderId: string } | null,
): SitzungErgebnis {
  const fm = zeile.frontmatter ?? {}
  const name = belegNameLesen(zeile.sourceName)
  const fmDatum = asString(fm.date)
  const datum =
    name?.datum ??
    zeile.sourceName.match(DATUM_PREFIX)?.[1] ??
    (fmDatum !== null && ISO_TAG.test(fmDatum) ? fmDatum : null)
  if (datum === null) {
    return { ok: false, beleg: zeile.sourceName, grund: 'kein Datum: Name ohne JJJJ-MM-TT und Notiz ohne date' }
  }
  const werkzeug = asString(fm.werkzeug)
  const artWort = name?.artWort ?? (werkzeug !== null ? WERKZEUG_ART[werkzeug] ?? null : null)
  const fmEnde = asString(fm.ende)
  return {
    ok: true,
    sitzung: {
      datum,
      ende: fmEnde !== null && ISO_TAG.test(fmEnde) && fmEnde !== datum ? fmEnde : null,
      titel: asString(fm.title) ?? name?.titel ?? belegOhneEndung(zeile.sourceName),
      artWort,
      werkzeug,
      sitzungId: asString(fm.sitzung),
      vorhabenPfad: vorhaben?.pfad ?? null,
      vorhabenFolderId: vorhaben?.folderId ?? null,
      belegName: belegOhneEndung(zeile.sourceName),
      teaser: asString(fm.teaser) ?? '',
      transformationAktualisiert: zeile.updatedAt,
      sourceId: zeile.sourceId,
    },
  }
}

/** Chronologisch, aelteste zuerst; gleicher Tag nach Beleg-Name. */
export function sortiereSitzungen(sitzungen: readonly SitzungsDatensatz[]): SitzungsDatensatz[] {
  return [...sitzungen].sort((a, b) => a.datum.localeCompare(b.datum) || a.belegName.localeCompare(b.belegName, 'de'))
}

export interface VorhabenGruppe {
  /** null = „Ohne Vorhaben" (immer zuletzt). */
  pfad: string | null
  sitzungen: SitzungsDatensatz[]
}

/** Je Vorhaben eine Gruppe in Archiv-Ordnung (Pfad, numerisch: „9." vor „10."), Sitzungen chronologisch. */
export function gruppiereNachVorhaben(sitzungen: readonly SitzungsDatensatz[]): VorhabenGruppe[] {
  const gruppen = new Map<string | null, SitzungsDatensatz[]>()
  for (const s of sitzungen) gruppen.set(s.vorhabenPfad, [...(gruppen.get(s.vorhabenPfad) ?? []), s])
  const mitVorhaben = [...gruppen.entries()]
    .filter((e): e is [string, SitzungsDatensatz[]] => e[0] !== null)
    .sort((a, b) => a[0].localeCompare(b[0], 'de', { numeric: true }))
    .map(([pfad, liste]) => ({ pfad, sitzungen: sortiereSitzungen(liste) }))
  const ohne = gruppen.get(null)
  return ohne ? [...mitVorhaben, { pfad: null, sitzungen: sortiereSitzungen(ohne) }] : mitVorhaben
}
