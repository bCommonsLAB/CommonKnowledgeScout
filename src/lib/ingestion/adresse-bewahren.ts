/**
 * @fileoverview Adresse (Slug) eines Dokuments ueber spaetere Laeufe hinweg behalten.
 *
 * @description
 * Die Galerie oeffnet ein Dokument ueber `docMetaJson.slug` (`?doc=<slug>`). Der
 * Slug kommt aus dem Frontmatter der Transformation, und das fuellt das
 * Sprachmodell bei jeder Neuerzeugung neu — jeder weitergegebene Link lief
 * danach ins Leere (Befund 26.11.2026).
 *
 * Owner-Entscheid 26.11.2026: Eine einmal vergebene Adresse bleibt. Massgeblich
 * ist die Adresse am Meta-Dokument im Index, denn auf sie zeigen die Links.
 * Template-Phase und Ingest uebernehmen sie; ein neuer Vorschlag des Modells
 * wird verworfen und im Trace genannt. Wer eine Adresse bewusst aendern will,
 * setzt `slug` mit `dokument_felder_setzen` — das schreibt Twin und Index.
 *
 * @module ingestion
 */

import { getMetaByFileId } from '@/lib/repositories/vector-repo'

export interface SlugEntscheidung {
  /** Die Adresse, die gilt; leer, wenn es weder eine bestehende noch eine neue gibt. */
  slug: string
  herkunft: 'bestehend' | 'neu' | 'keine'
  /** Der verworfene neue Vorschlag, wenn er von der bestehenden Adresse abweicht. */
  verworfen: string | null
}

function text(wert: unknown): string {
  return typeof wert === 'string' ? wert.trim() : ''
}

/** Adresse eines Meta-Dokuments: `docMetaJson.slug` (das liest die Galerie), sonst das Feld `slug`. */
export function slugAusMetaDokument(doc: unknown): string | null {
  if (!doc || typeof doc !== 'object') return null
  const d = doc as { slug?: unknown; docMetaJson?: unknown }
  const ausJson = d.docMetaJson && typeof d.docMetaJson === 'object' ? text((d.docMetaJson as { slug?: unknown }).slug) : ''
  return ausJson || text(d.slug) || null
}

/** Die bestehende Adresse gewinnt; ohne bestehende gilt der neue Vorschlag. */
export function entscheideSlug(neu: unknown, bestehend: string | null): SlugEntscheidung {
  const vorschlag = text(neu)
  const vorhanden = text(bestehend)
  if (vorhanden) return { slug: vorhanden, herkunft: 'bestehend', verworfen: vorschlag && vorschlag !== vorhanden ? vorschlag : null }
  if (vorschlag) return { slug: vorschlag, herkunft: 'neu', verworfen: null }
  return { slug: '', herkunft: 'keine', verworfen: null }
}

/** Adresse des Dokuments im Index; null, wenn es noch nicht ingestiert wurde oder keine traegt. */
export async function ladeBestehendenSlug(libraryKey: string, fileId: string): Promise<string | null> {
  return slugAusMetaDokument(await getMetaByFileId(libraryKey, fileId))
}
