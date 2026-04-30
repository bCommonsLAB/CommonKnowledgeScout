/**
 * @fileoverview Available-Media-Loader
 *
 * Server-side Helper, der die Liste tatsaechlich verfuegbarer Medien
 * fuer eine Quelldatei zusammenstellt. Die Liste wird verwendet von:
 *
 * 1. Validator (`media-existence-validator`) — prueft LLM-Output
 * 2. CONTEXT-Block fuer den LLM (in `phase-template.ts`)
 *
 * Das Modul kapselt zwei Storage-Quellen:
 *
 * - **Sibling-Files**: Dateien im selben Verzeichnis wie die Quelldatei
 * - **Binary-Fragments**: aus PDFs extrahierte Bilder (Mongo-Shadow-Twin)
 *
 * Hinweis: Aktuell werden NUR Sibling-Files geladen, weil das den
 * haeufigsten Use-Case abdeckt (manuell abgelegte Bilder neben Markdown).
 * Binary-Fragments folgen in spaeterer Iteration, wenn PDF-extrahierte
 * Bilder als Cover akzeptiert werden sollen.
 *
 * @see src/lib/templates/media-existence-validator.ts
 * @see docs/refactor/cover-image-deterministic-flow/
 */

import { getMediaKind, type MediaKind } from '@/lib/media-types'
import type { StorageProvider } from '@/lib/storage/types'
import type { AvailableMediaEntry } from '@/lib/templates/media-existence-validator'

/** MediaKinds, die als zuordnungsfaehige Medien gelten (parallel zu sibling-files API) */
const ASSIGNABLE_MEDIA_KINDS = new Set<MediaKind>(['image', 'pdf', 'link'])

/** Hard limit, um Token-Budget des LLM-CONTEXT nicht zu sprengen */
export const AVAILABLE_MEDIA_LIMIT = 50

export interface LoadAvailableMediaArgs {
  /** Storage-Provider (vom Aufrufer bereits initialisiert) */
  provider: StorageProvider
  /** ID der Quelldatei (z.B. der pctest.md) */
  sourceItemId: string
  /**
   * Optional: ID des Eltern-Ordners. Wenn nicht uebergeben, wird sie aus
   * dem Source-Item geladen (zusaetzlicher Provider-Call).
   */
  parentId?: string
}

export interface LoadAvailableMediaResult {
  /** Liste verfuegbarer Medien (max. AVAILABLE_MEDIA_LIMIT Eintraege) */
  entries: AvailableMediaEntry[]
  /** True, wenn die Liste durch Limit gekuerzt wurde */
  truncated: boolean
  /** Gesamtzahl vor Kuerzung (nur fuer Diagnose) */
  totalBeforeLimit: number
}

/**
 * Laedt die Liste verfuegbarer Medien fuer eine Quelldatei.
 *
 * Fehlerstrategie: Wirft bei Storage-Fehlern. KEIN stiller Fallback auf
 * leere Liste — sonst wuerde der nachgelagerte Validator alles rejecten.
 *
 * @throws Error wenn Quelldatei oder Verzeichnis-Listing fehlschlaegt
 */
export async function loadAvailableMediaForSource(
  args: LoadAvailableMediaArgs,
): Promise<LoadAvailableMediaResult> {
  const { provider, sourceItemId } = args
  let parentId = args.parentId

  // Parent-ID ermitteln, wenn nicht uebergeben
  if (!parentId) {
    const sourceItem = await provider.getItemById(sourceItemId)
    if (!sourceItem) {
      throw new Error(
        `Quelldatei nicht gefunden (sourceItemId=${sourceItemId}) — availableMedia kann nicht aufgebaut werden`,
      )
    }
    parentId = sourceItem.parentId
  }

  // Geschwister-Dateien listen
  const siblings = await provider.listItemsById(parentId)

  // Filter: keine Quelldatei selbst, keine Ordner, nur assignable kinds
  const allEntries: AvailableMediaEntry[] = siblings
    .filter(item => {
      if (item.id === sourceItemId) return false
      if (item.type === 'folder') return false
      const kind = getMediaKind(item)
      return ASSIGNABLE_MEDIA_KINDS.has(kind)
    })
    .map(item => ({
      name: item.metadata.name,
      mimeType: item.metadata.mimeType ?? 'application/octet-stream',
      source: 'sibling' as const,
    }))

  const totalBeforeLimit = allEntries.length
  const entries = allEntries.slice(0, AVAILABLE_MEDIA_LIMIT)
  const truncated = totalBeforeLimit > AVAILABLE_MEDIA_LIMIT

  return { entries, truncated, totalBeforeLimit }
}
