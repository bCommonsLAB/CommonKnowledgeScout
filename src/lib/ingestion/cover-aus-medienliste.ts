/**
 * @fileoverview Cover-Kandidat aus `_media_files` der Quelle.
 *
 * @description
 * Befund 07.11.2026 (SFSCON-Aufbau): Eine Sammeldatei ohne Transkript-Quellen
 * nennt ihr Sprecherfoto in `_media_files: ["cover.jpg"]`; das Bild liegt als
 * Nachbar neben der Datei. Laesst das Modell `coverImageUrl` leer, kannte der
 * Ingest den Namen nicht — 350 Eintraege mussten per `dokument_felder_setzen`
 * nachgezogen werden. Jetzt reicht die Template-Phase `_media_files` in den
 * Twin durch, und der Ingest nimmt daraus den Eintrag mit Cover-Namen als
 * letzten Ersatzweg vor „kein Cover". Kein beliebiges Bild: nur `cover.*`,
 * `<Basis> - Cover.*`, `<Basis>.cover.*` (dieselbe Regel wie bei den eigenen
 * Fragmenten). Reine Auswahlfunktion, ohne Speicherzugriff.
 *
 * @module ingestion
 */

import { COVER_DATEINAME } from './medien-aus-eigenen-fragmenten'

/** `_media_files` als Liste — Array oder JSON-Text (flaches Twin-Frontmatter), sonst leer. */
export function medienlisteAusMeta(meta: Record<string, unknown>): string[] {
  const raw = meta['_media_files']
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
  if (typeof raw === 'string' && raw.trim().startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    } catch {
      return []
    }
  }
  return []
}

/** Erster Eintrag aus `_media_files`, dessen Dateiname ein Cover-Name ist — oder null. */
export function coverKandidatAusMedienliste(meta: Record<string, unknown>): string | null {
  for (const eintrag of medienlisteAusMeta(meta)) {
    const dateiname = eintrag.split('/').pop() ?? eintrag
    if (COVER_DATEINAME.test(dateiname)) return eintrag
  }
  return null
}
