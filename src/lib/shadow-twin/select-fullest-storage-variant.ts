/**
 * @fileoverview I/O-Wrapper um selectBestArtifactVariant fuer Storage-Kandidaten.
 *
 * @description
 * Laedt den Inhalt mehrerer Storage-Varianten (StorageItem) und waehlt die
 * vollstaendigste via {@link selectBestArtifactVariant}. Geteilt von
 * artifact-resolver (pickBestTranscript), reconstruct-from-storage und
 * sync-from-storage — damit „vollstaendigster gewinnt" an EINER Stelle lebt.
 *
 * Reine Funktion bleibt `selectBestArtifactVariant` (kein I/O); hier nur das
 * Lesen der Datei-Inhalte.
 *
 * @module shadow-twin
 */

import type { StorageItem, StorageProvider } from '@/lib/storage/types'
import { FileLogger } from '@/lib/debug/logger'
import { ShadowTwinProviderIncompleteError } from './errors'
import { selectBestArtifactVariant, type SelectBestResult } from './select-best-artifact-variant'

/** Nur die fuer das Inhalt-Lesen benoetigte Teilmenge des Providers. */
type BinaryReader = Pick<StorageProvider, 'getBinary'>

/**
 * Waehlt die vollstaendigste Variante unter mehreren Storage-Dateien.
 * Laedt pro Kandidat den Markdown-Inhalt (nicht lesbare → leer).
 *
 * @param provider Storage-Provider (nur getBinary).
 * @param candidates Bereits gefilterte Kandidaten (gleicher Artefakt-Typ/Quelle).
 * @param canonicalName Bevorzugter Name bei Gleichstand identischen Inhalts (z.B. `{base}.md`).
 * @throws ShadowTwinProviderIncompleteError wenn der Provider kein `getBinary` hat.
 */
export async function selectFullestStorageVariant(
  provider: BinaryReader,
  candidates: StorageItem[],
  canonicalName: string,
): Promise<SelectBestResult<StorageItem>> {
  // Programmierfehler laut melden statt ihn als „nicht lesbar" zu schlucken:
  // Ohne getBinary zaehlte JEDE Variante als leer, und „vollstaendigster
  // gewinnt" liefe ins Leere (Befund 2026-09-10, Spread-Provider in batch-resolve).
  if (typeof provider.getBinary !== 'function') {
    throw new ShadowTwinProviderIncompleteError('getBinary', 'selectFullestStorageVariant')
  }

  const variants = await Promise.all(
    candidates.map(async (item) => {
      let markdown = ''
      try {
        const { blob } = await provider.getBinary(item.id)
        markdown = await blob.text()
      } catch (err) {
        // Bewusst toleriert: echte Lesefehler einer einzelnen Variante (404,
        // Netzwerk, Rechte). Sie zaehlt als leer; die uebrigen entscheiden.
        FileLogger.warn('select-fullest-storage-variant', 'Variante nicht lesbar – als leer gewertet', {
          fileName: item.metadata.name,
          error: err instanceof Error ? err.message : String(err),
        })
      }
      return { ref: item, markdown, origin: 'storage' as const, name: item.metadata.name }
    }),
  )
  return selectBestArtifactVariant(variants, canonicalName)
}
