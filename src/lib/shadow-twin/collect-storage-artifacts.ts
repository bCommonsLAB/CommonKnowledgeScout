/**
 * @fileoverview Sammelt adoptierbare Artefakt-Dateien EINER Quelle aus dem Storage.
 *
 * @description
 * Gemeinsame Namens-Analyse fuer Migration (migrate/route.ts) und Sync-Engine
 * (adopt-storage-only-source, Welle 5a): welche Dateien im Twin-Ordner bzw.
 * neben der Quelle sind Transkript/Transformation DIESER Quelle?
 *
 * Arbeitet NUR auf Dateinamen (kein Inhalt-Lesen) — damit bleibt der
 * check-Modus der Engine auch bei ~1000 Quellen guenstig.
 *
 * Transkript-Guard (Bug-Fix Welle 5a): das KANONISCHE sprach-neutrale
 * Transkript `{base}.md` parst mit `targetLanguage: null` und wird als
 * `targetLanguage: ''` uebernommen — es darf NICHT verworfen werden
 * (alter Bug in migrate/route.ts und reconstruct-from-storage.ts).
 *
 * @module shadow-twin
 */

import path from 'path'
import { parseArtifactName } from '@/lib/shadow-twin/artifact-naming'
import type { StorageItem } from '@/lib/storage/types'

/** ArtifactKey-Teilmenge, die aus Dateinamen adoptierbar ist (kein raw/canonical). */
export interface AdoptableArtifactKey {
  sourceId: string
  kind: 'transcript' | 'transformation'
  /** '' = sprach-neutrales Transkript (`{base}.md`). */
  targetLanguage: string
  templateName?: string
}

export interface StorageArtifact {
  item: StorageItem
  key: AdoptableArtifactKey
}

/**
 * Sammelt alle Artefakt-Dateien einer Quelle (Twin-Ordner + Geschwister-Dateien).
 *
 * Regeln:
 * - Nur Dateien, deren Name mit `{base}.` beginnt (schuetzt vor page_001.en.md,
 *   die der konservative Parser-Fallback sonst als Transkript einstufen wuerde).
 * - Die Quelldatei selbst ist NIE ihr eigenes Artefakt (relevant seit dem
 *   Guard-Fix: eine Markdown-Quelle `X.md` parst als kanonisches Transkript).
 * - Existiert das kanonische Transkript `{base}.md`, werden weitere
 *   Transkript-Varianten (Legacy `{base}.{lang}.md`) NICHT mit-adoptiert —
 *   sonst wuerde die Variante das kanonische Transkript im sprach-neutralen
 *   Mongo-Slot ueberschreiben (Reihenfolge-Lotterie).
 */
export function collectStorageArtifactsForSource(args: {
  source: StorageItem
  parentItems: StorageItem[]
  shadowTwinFolderItems: StorageItem[]
}): StorageArtifact[] {
  const { source, parentItems, shadowTwinFolderItems } = args
  const sourceBaseName = path.parse(source.metadata.name).name
  const seen = new Set<string>()
  const artifacts: StorageArtifact[] = []

  const consider = (item: StorageItem) => {
    if (item.type !== 'file') return
    if (item.id === source.id) return
    if (seen.has(item.id)) return
    if (!item.metadata.name.toLowerCase().startsWith(`${sourceBaseName.toLowerCase()}.`)) return
    const parsed = parseArtifactName(item.metadata.name, sourceBaseName)
    // Nur transcript/transformation adoptieren; raw/canonical/unbekannt ueberspringen.
    if (parsed.kind !== 'transcript' && parsed.kind !== 'transformation') return
    // Transformation braucht Sprache + Template (ArtifactKey-Contract);
    // Transkript ist sprach-neutral: targetLanguage null ⇒ '' (kanonisches {base}.md).
    if (parsed.kind === 'transformation' && (!parsed.targetLanguage || !parsed.templateName)) return
    seen.add(item.id)
    artifacts.push({
      item,
      key: {
        sourceId: source.id,
        kind: parsed.kind,
        targetLanguage: parsed.targetLanguage ?? '',
        templateName: parsed.templateName || undefined,
      },
    })
  }

  for (const item of shadowTwinFolderItems) consider(item)
  for (const item of parentItems) consider(item)

  // Kanonisches Transkript gewinnt deterministisch gegen Legacy-Varianten.
  const canonicalLower = `${sourceBaseName}.md`.toLowerCase()
  const hasCanonical = artifacts.some(
    (a) => a.key.kind === 'transcript' && a.item.metadata.name.toLowerCase() === canonicalLower,
  )
  if (!hasCanonical) return artifacts
  return artifacts.filter(
    (a) => a.key.kind !== 'transcript' || a.item.metadata.name.toLowerCase() === canonicalLower,
  )
}
