/**
 * @fileoverview Datenmodell der Sitzungs-Sicht (Plan sitzungen-sichten-und-befunde, S1/S1b).
 *
 * @description
 * Eine Arbeitssitzung mit Claude liegt als Beleg `JJJJ-MM-TT Code|Chat <Titel>.md`
 * im Vorhabensordner; KnowledgeScout erzeugt daraus mit der Vorlage
 * `chatverlauf-de` eine Sitzungsnotiz (Transformation am Twin). Der
 * `SitzungsDatensatz` ist die Zeile, die Chronik und Bericht-Block daraus
 * rendern — gelesen aus Beleg-Dateiname (Datum, Art-Wort, Titel), Beleg-Kopf
 * (`vorhaben`, `hauptvorhaben`, `ende`; S1b, Owner 09.11.2026: Nebenvorhaben
 * erscheinen in jedem genannten Vorhaben) und Notiz-Frontmatter (teaser,
 * werkzeug, sitzung). Reine Funktionen, kein I/O.
 *
 * @module agent-view/sichten
 */

import type { TransformationZeile } from '@/lib/repositories/shadow-twin-transformationen'
import { asList, asString } from './bericht-lesen'

/** Dateiname der Chronik in `SICHTEN_ORDNER`. */
export const SITZUNGEN_FILE_NAME = 'SITZUNGEN.md'
/** Vorlage, deren Transformationen die Sitzungsnotizen sind (S2 macht das je Beleg-Typ konfigurierbar). */
export const SITZUNGS_VORLAGE = 'chatverlauf-de'
export const SITZUNGS_SPRACHE = 'de'

export type ArtWort = 'Code' | 'Chat'
/** Welche Sichten `sichten_regenerieren` erzeugt; Vorgabe sind alle drei. */
export type SichtName = 'aktuell' | 'projekte' | 'sitzungen'
export const ALLE_SICHTEN: readonly SichtName[] = ['aktuell', 'projekte', 'sitzungen']

/** Ein Vorhabensordner aus dem Scan. */
export interface VorhabenRef {
  pfad: string
  folderId: string
}

export interface SitzungsDatensatz {
  /** `JJJJ-MM-TT` aus dem Beleg-Namen (ersatzweise `datum` des Belegs, dann `date` der Notiz). */
  datum: string
  /** Letzter Tag einer mehrtaegigen Sitzung (`ende` des Belegs oder der Notiz); null = eintaegig/unbekannt. */
  ende: string | null
  titel: string
  /** Aus dem Beleg-Namen; null = Name ohne Art-Wort UND werkzeug unbekannt (Renderer schreibt „?"). */
  artWort: ArtWort | null
  werkzeug: string | null
  sitzungId: string | null
  /** Vorhaben, in dessen Ordner der Beleg liegt; null = ausserhalb eines Vorhabens. */
  vorhabenPfad: string | null
  vorhabenFolderId: string | null
  /** Pfad des Ordners, in dem der Beleg liegt (Querverweis „Beleg liegt in …"); null = Ordner nicht im Scan. */
  belegOrdnerPfad: string | null
  /** Weitere Vorhaben aus `vorhaben:` des Belegs, ohne das Ablage-Vorhaben, gegen den Scan aufgeloest. */
  weitereVorhaben: VorhabenRef[]
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

/** `vorhaben:` (Ordnernamen, Hauptvorhaben zuerst) und `hauptvorhaben:` aus dem Beleg-Kopf. */
export function belegVorhaben(fields: Record<string, unknown> | null): { vorhaben: string[]; hauptvorhaben: string | null } {
  if (fields === null) return { vorhaben: [], hauptvorhaben: null }
  return { vorhaben: asList(fields.vorhaben), hauptvorhaben: asString(fields.hauptvorhaben) }
}

function isoTag(wert: string | null): string | null {
  return wert !== null && ISO_TAG.test(wert) ? wert : null
}

export type SitzungErgebnis =
  | { ok: true; sitzung: SitzungsDatensatz }
  | { ok: false; beleg: string; grund: string }

/** Ablageort und Querverweise eines Belegs, vom Zuordner aufgeloest. */
export interface BelegOrt {
  vorhaben: VorhabenRef | null
  belegOrdnerPfad: string | null
  weitereVorhaben: VorhabenRef[]
}

/**
 * Baut den Datensatz aus einer Transformations-Zeile. Ohne lesbares Datum
 * (weder Name noch Beleg noch Notiz) wird der Beleg mit Grund zurueckgegeben,
 * nicht still an das Ende sortiert.
 */
export function sitzungAusTransformation(zeile: TransformationZeile, ort: BelegOrt): SitzungErgebnis {
  const fm = zeile.frontmatter ?? {}
  const beleg = zeile.sourceFrontmatter?.fields ?? {}
  const name = belegNameLesen(zeile.sourceName)
  const datum =
    name?.datum ?? zeile.sourceName.match(DATUM_PREFIX)?.[1] ?? isoTag(asString(beleg.datum)) ?? isoTag(asString(fm.date))
  if (datum === null) {
    return { ok: false, beleg: zeile.sourceName, grund: 'kein Datum: Name ohne JJJJ-MM-TT, Beleg ohne datum, Notiz ohne date' }
  }
  const werkzeug = asString(fm.werkzeug)
  const artWort = name?.artWort ?? (werkzeug !== null ? WERKZEUG_ART[werkzeug] ?? null : null)
  const ende = isoTag(asString(beleg.ende)) ?? isoTag(asString(fm.ende))
  return {
    ok: true,
    sitzung: {
      datum,
      ende: ende !== null && ende !== datum ? ende : null,
      titel: asString(fm.title) ?? name?.titel ?? belegOhneEndung(zeile.sourceName),
      artWort,
      werkzeug,
      sitzungId: asString(fm.sitzung),
      vorhabenPfad: ort.vorhaben?.pfad ?? null,
      vorhabenFolderId: ort.vorhaben?.folderId ?? null,
      belegOrdnerPfad: ort.belegOrdnerPfad,
      weitereVorhaben: ort.weitereVorhaben,
      belegName: belegOhneEndung(zeile.sourceName),
      teaser: asString(fm.teaser) ?? '',
      transformationAktualisiert: zeile.updatedAt,
      sourceId: zeile.sourceId,
    },
  }
}
