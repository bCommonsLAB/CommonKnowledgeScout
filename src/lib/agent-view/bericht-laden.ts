/**
 * @fileoverview Bericht-Laden (F9, Werkbank W2): BERICHT.md eines Vorhabens on demand.
 *
 * @description
 * Reines Entscheidungsmodul der Bericht-Lese-Route (Aufbau wie die
 * Kurations-Route: Logik hier, duenne Route aussen). Der Bericht-Body wird
 * NIE persistiert (Projektauftrag v2 §5) — er kommt on demand aus dem
 * Storage, `kopf` wird SERVERSEITIG ueber die vorhandenen Leser aus
 * `sichten/bericht-lesen.ts` gebaut (kein zweiter Parser, der Client parst
 * kein Markdown-Geruest).
 *
 * Semantik (§F9): unbekannter Ordner → {@link OrdnerNichtGefundenError}
 * (Route: 404); Ordner ohne BERICHT.md → `grund: 'kein_bericht'` (legitimer
 * Domaenenzustand, KEIN Fehler); Body ueber dem Budget → Metadaten mit
 * `body: null` und `grund: 'zu_gross'` („im Archiv oeffnen" statt
 * abgeschnittener Vorschau). Kein stiller Fallback: jeder Leerzustand ist
 * benannt (`no-silent-fallbacks.mdc`).
 *
 * Aussenzugriffe laufen ueber Ports — ohne Storage unit-testbar
 * (`storage-abstraction.mdc`).
 *
 * @module agent-view
 */

import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { StorageError, type StorageItem } from '@/lib/storage/types'
import { BERICHT_FILE_NAME } from './archive-scan'
import { MAX_DOC_BYTES, toIso } from './archive-scan-readers'
import { ersterAbsatz, offenePunkte, titelLesen } from './sichten/bericht-lesen'

/** Serverseitig gebauter Kopf — die UI rendert, sie parst nicht (§F9). */
export interface BerichtKopf {
  /** H1 via `titelLesen`; '' = Bericht ohne Ueberschrift (sichtbar leer). */
  titel: string
  /** Erster Absatz nach der H1 (Kurzbeschreibung). */
  ersterAbsatz: string
  /** Offene Checkboxen unter „## Nächste Schritte". */
  offenePunkte: string[]
}

export interface BerichtDetail {
  fileId: string
  name: string
  /** ISO-Zeitstempel der letzten Aenderung; null = Provider kennt keinen. */
  modifiedAt: string | null
  sizeBytes: number
  /** Markdown-Body OHNE Frontmatter; null NUR bei `grund: 'zu_gross'`. */
  body: string | null
  /** Geparster Kopf; null NUR bei `grund: 'zu_gross'` (kein Body, kein Kopf). */
  kopf: BerichtKopf | null
}

export interface BerichtAntwort {
  bericht: BerichtDetail | null
  /** Benannter Leerzustand — nie stilles null (§F9). */
  grund?: 'kein_bericht' | 'zu_gross'
}

/** Ordner-Id existiert im Storage nicht — die Route antwortet 404. */
export class OrdnerNichtGefundenError extends Error {
  readonly code = 'ordner_nicht_gefunden' as const
}

/** Aussenzugriffe der Route — in Tests vollstaendig ersetzbar. */
export interface BerichtLadenPorts {
  /** Inhalt des Ordners; wirft den Provider-Fehler bei unbekannter Id. */
  listFolder(folderId: string): Promise<StorageItem[]>
  /** Roh-Markdown der Datei (inklusive Frontmatter). */
  readText(fileId: string): Promise<string>
}

/**
 * Not-Found-Signale der drei Backends — EXPLIZIT statt Substring-Raten
 * (`no-silent-fallbacks.mdc`): Filesystem wirft `StorageError`
 * `FILE_NOT_FOUND`, OneDrive `NOT_FOUND`; Nextcloud reicht den rohen
 * WebDAV-Fehler mit `status: 404` durch. Alles andere bleibt ein echter
 * Fehler (Route: 500), wird also NICHT als 404 verkleidet.
 */
export function istStorageNotFound(error: unknown): boolean {
  if (error instanceof StorageError) {
    return error.code === 'NOT_FOUND' || error.code === 'FILE_NOT_FOUND' || error.code === 'FOLDER_NOT_FOUND'
  }
  return typeof error === 'object' && error !== null && (error as { status?: unknown }).status === 404
}

function toDetailBase(item: StorageItem): Pick<BerichtDetail, 'fileId' | 'name' | 'modifiedAt' | 'sizeBytes'> {
  return {
    fileId: item.id,
    name: item.metadata.name,
    modifiedAt: toIso(item.metadata.modifiedAt),
    sizeBytes: item.metadata.size,
  }
}

/**
 * Laedt den BERICHT.md des Ordners nach der §F9-Semantik. Matching ist
 * EXAKT wie im Archiv-Scan (`BERICHT_FILE_NAME`) — dieselbe Regel, kein
 * Drift zwischen Scan und Route.
 */
export async function ladeBericht(folderId: string, ports: BerichtLadenPorts): Promise<BerichtAntwort> {
  let items: StorageItem[]
  try {
    items = await ports.listFolder(folderId)
  } catch (error) {
    if (istStorageNotFound(error)) {
      throw new OrdnerNichtGefundenError(`Ordner nicht gefunden: ${folderId}`)
    }
    throw error
  }

  const bericht = items.find((item) => item.type === 'file' && item.metadata.name === BERICHT_FILE_NAME)
  if (!bericht) return { bericht: null, grund: 'kein_bericht' }

  const base = toDetailBase(bericht)
  if (base.sizeBytes > MAX_DOC_BYTES) {
    return { bericht: { ...base, body: null, kopf: null }, grund: 'zu_gross' }
  }

  const raw = await ports.readText(bericht.id)
  // Provider-Metadaten koennen luegen (size 0/veraltet) — massgeblich ist die
  // tatsaechliche Groesse; das Budget gilt in beiden Richtungen sichtbar.
  const actualBytes = new TextEncoder().encode(raw).length
  if (actualBytes > MAX_DOC_BYTES) {
    return { bericht: { ...base, sizeBytes: actualBytes, body: null, kopf: null }, grund: 'zu_gross' }
  }

  const { body } = parseFrontmatter(raw)
  return {
    bericht: {
      ...base,
      body,
      kopf: {
        titel: titelLesen(body),
        ersterAbsatz: ersterAbsatz(body),
        offenePunkte: offenePunkte(body),
      },
    },
  }
}
