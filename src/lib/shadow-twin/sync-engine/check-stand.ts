/**
 * @fileoverview Fingerabdruck-Tor des check-Modus: nur lesen, was sich geaendert hat.
 *
 * @description
 * Der Check der Sync-Engine laed bisher fuer JEDE Quelle jede Markdown-Datei
 * ihrer Twin-Familie (`getBinary` je Datei, ~330 ms gegen OneDrive). Seit das
 * Archiv Mongo-only ist, ist die Antwort bei fast jeder Quelle dieselbe wie
 * beim letzten Lauf — und ob sie es ist, steht schon im Ordner-Listing.
 *
 * Dieses Modul rechnet daraus einen Fingerabdruck (SHA-1 ueber Name, Groesse,
 * Aenderungsdatum und — wo der Provider sie liefert — `version` aller Dateien
 * der Familie) und vergleicht ihn mit dem im Twin-Dokument abgelegten
 * `checkStand`. Stimmen Fingerabdruck, Mongo-Stand (`updatedAt`) und
 * Engine-Version ueberein, wird die letzte Report-Zeile wiederverwendet —
 * ohne einen einzigen `getBinary`-Aufruf.
 *
 * Hier passiert nur Listing-I/O und Rechnung; geplant wird nichts
 * (`sync-plan/` bleibt rein).
 *
 * @module shadow-twin/sync-engine
 */

import { createHash } from 'crypto'
import { generateShadowTwinFolderNameVariants } from '@/lib/storage/shadow-twin'
import type { ShadowTwinCheckStand, ShadowTwinDocument } from '@/lib/repositories/shadow-twin-repo'
import type { StorageItem } from '@/lib/storage/types'
import type { FolderCache } from './folder-cache'
import type { SourceSyncReportRow } from './report-types'
import { toDate } from './to-date'

/**
 * Version der Plan-Logik. Bei JEDER Aenderung an den Plan-Funktionen
 * (`sync-plan/**`) oder an dem, was `collect-*` einsammelt, hochzaehlen —
 * sonst reicht ein Deployment alte Plaene aus dem `checkStand` weiter.
 *
 * Der Brief nennt `run-library-sync.ts` als Ort; sie steht hier, weil das Tor
 * sie braucht und ein Import aus dem Orchestrator einen Zyklus ergaebe.
 */
export const SYNC_ENGINE_VERSION = '1'

/** Eine Datei im Fingerabdruck (nur Listing-Felder, kein Inhalt). */
interface FingerabdruckDatei {
  name: string
  size: number
  modifiedAt: string
  version?: string
}

/** Kennung eines Quell-Zustands — das, was verglichen und abgelegt wird. */
export interface CheckStandKennung {
  fingerabdruck: string
  dateien: number
  mongoUpdatedAt: string
  engineVersion: string
  /**
   * Pfadlaenge des Quell-Ordners aus dem Scan (Welle 5c, Pfad-Budget) — ein
   * Plan-Eingang wie das Listing, deshalb Teil der Kennung. `null` = unbekannt
   * (sourceIds-Scope); ein Lauf mit anderem Scope rechnet dann neu, statt
   * einen Plan mit anderem Budget zu erben.
   */
  parentPathLength: number | null
}

/** Ergebnis des Tors fuer EINE Quelle. */
export interface CheckStandTor {
  /** Aktueller Zustand — nach dem vollen Weg als `checkStand` abzulegen. */
  aktuell: CheckStandKennung
  /** Gesetzt, wenn der gespeicherte Stand passt: diese Zeile wiederverwenden. */
  zeile: SourceSyncReportRow | null
}

function isoOderLeer(value: unknown): string {
  return toDate(value)?.toISOString() ?? ''
}

/**
 * SHA-1 ueber die Listing-Merkmale aller uebergebenen Dateien, nach Namen
 * sortiert. Ordner bleiben draussen — sie tragen keinen Inhalt, den der Plan
 * liest.
 */
export function berechneFingerabdruck(
  items: readonly StorageItem[],
  parentPathLength: number | null,
): { fingerabdruck: string; dateien: number } {
  const dateien: FingerabdruckDatei[] = items
    .filter((it) => it.type === 'file')
    .map((it) => ({
      name: it.metadata.name,
      size: it.metadata.size,
      modifiedAt: isoOderLeer(it.metadata.modifiedAt),
      ...(typeof it.metadata.version === 'string' ? { version: it.metadata.version } : {}),
    }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))

  const hash = createHash('sha1').update(JSON.stringify({ parentPathLength, dateien })).digest('hex')
  return { fingerabdruck: hash, dateien: dateien.length }
}

/**
 * Sammelt die Dateien EINER Twin-Familie aus dem Listing: den Twin-Ordner
 * vollstaendig plus die Geschwister im Elternordner mit `{base}.`-Bezug (die
 * Quelldatei selbst faellt darunter — ihr `modifiedAt` speist den
 * Pipeline-Bedarf).
 *
 * Wirft, wenn ein Listing fehlschlaegt: der Aufrufer nimmt dann den vollen Weg
 * und der Fehler bleibt sichtbar (`no-silent-fallbacks`).
 */
async function sammleFamilienDateien(args: {
  doc: ShadowTwinDocument
  folderCache: FolderCache
}): Promise<StorageItem[]> {
  const { doc, folderCache } = args
  const sourceBaseName = (doc.sourceName || '').replace(/\.[^.]+$/, '')
  const parentItems = await folderCache.list(doc.parentId)

  const geschwister = parentItems.filter(
    (it) => it.type === 'file' && it.metadata.name.startsWith(`${sourceBaseName}.`),
  )

  // Twin-Ordner: erst der Mongo-Verweis, sonst ueber die Namensvarianten aus
  // dem bereits geladenen Eltern-Listing (kein zusaetzlicher Storage-Aufruf).
  let folderId = doc.filesystemSync?.shadowTwinFolderId || null
  if (!folderId) {
    const varianten = new Set(generateShadowTwinFolderNameVariants(doc.sourceName))
    folderId = parentItems.find((it) => it.type === 'folder' && varianten.has(it.metadata.name))?.id ?? null
  }
  const twinItems = folderId ? await folderCache.list(folderId) : []

  return [...geschwister, ...twinItems]
}

/**
 * Prueft das Tor fuer EINE Quelle: Fingerabdruck rechnen und mit dem
 * gespeicherten `checkStand` vergleichen.
 *
 * `null` heisst „fuer diese Quelle gibt es kein Tor" (kaputtes Dokument);
 * bei fehlgeschlagenem Listing wirft die Funktion. Beides fuehrt zum vollen
 * Weg und laesst den gespeicherten Stand unangetastet.
 */
export async function pruefeCheckStand(args: {
  doc: ShadowTwinDocument
  folderCache: FolderCache
  parentPathLength: number | null
}): Promise<CheckStandTor | null> {
  const { doc, folderCache, parentPathLength } = args
  // Kaputte Dokumente (ohne Dateinamen/Ordner) macht `collectSourceInput` ohne
  // jedes I/O ab — dafuer braucht es kein Tor, und ein Listing auf einer leeren
  // parentId waere ein Aufruf ins Nichts.
  if (!doc.sourceName || !doc.parentId) return null
  const items = await sammleFamilienDateien({ doc, folderCache })
  const { fingerabdruck, dateien } = berechneFingerabdruck(items, parentPathLength)

  const aktuell: CheckStandKennung = {
    fingerabdruck,
    dateien,
    mongoUpdatedAt: doc.updatedAt || '',
    engineVersion: SYNC_ENGINE_VERSION,
    parentPathLength,
  }

  const gespeichert: ShadowTwinCheckStand | undefined = doc.checkStand
  const passt =
    !!gespeichert &&
    gespeichert.fingerabdruck === aktuell.fingerabdruck &&
    gespeichert.dateien === aktuell.dateien &&
    gespeichert.mongoUpdatedAt === aktuell.mongoUpdatedAt &&
    gespeichert.engineVersion === aktuell.engineVersion &&
    (gespeichert.parentPathLength ?? null) === aktuell.parentPathLength

  return { aktuell, zeile: passt && gespeichert.zeile ? gespeichert.zeile : null }
}
