/**
 * @fileoverview MCP-Werkzeuge fuer den Tagesabschluss (Wunschliste 2, W2 + W5b).
 *
 * @description
 * - `aenderungen_seit`: „Was ist seit X neu?" — Dateien und Artefakte seit
 *   einem Zeitpunkt, mit Erschliessungszustand; der Einstieg in die Schleife
 *   Aenderungen → erschliessen → Berichte → scannen → Sichten.
 * - `erschliessung_block_schreiben`: Abloesung von erschliessung.py — der
 *   Erschliessungs-Block zwischen den Markern in jedem `_INDEX.md` des Scopes.
 *
 * Beide laufen ueber einen Scan des Scopes (Teilbaum per folderId/pfad oder
 * ganze Library). Grenze ausgewiesen: kein Provider-Delta → Geloeschtes/
 * Umbenanntes ist nicht erkennbar; grosse Scopes dauern (Dauer in der Antwort).
 *
 * @module mcp
 */

import { z } from 'zod'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { aenderungenSeit } from '@/lib/agent-view/aenderungen-seit'
import { scanArchive } from '@/lib/agent-view/archive-scan'
import { toRawTwinFamily } from '@/lib/agent-view/run-coverage-scan'
import { erschliessungsBloecke, indexMitBlock } from '@/lib/agent-view/erschliessung-block'
import { getAllShadowTwins } from '@/lib/repositories/shadow-twin-repo'
import { effectiveScanExcludeGlobs } from '@/lib/shadow-twin/sync-engine/scan-exclude'
import type { Library } from '@/types/library'
import type { StorageProvider } from '@/lib/storage/types'
import { ersetzeTextDatei } from '@/lib/storage/update-text-file'
import { FOLDER_ID, LIBRARY_ID, SCOPE_PFAD, errorResult, jsonResult, mcpUserEmail, requireLibrary, requireProvider, resolveScope } from './tool-shared'

const SCAN_CONCURRENCY = 10

async function scanScope(library: Library, provider: StorageProvider, scope: string | undefined, docs: 'alle' | 'nur-bericht') {
  const started = Date.now()
  const scan = await scanArchive({
    provider, rootFolderId: scope ?? 'root',
    excludeGlobs: effectiveScanExcludeGlobs(library.config?.scanExcludeGlobs),
    concurrency: SCAN_CONCURRENCY, docs,
  })
  const families = (await getAllShadowTwins(library.id)).map(toRawTwinFamily)
  return { scan, families, dauerMs: Date.now() - started }
}

export function registerAenderungenTools(server: McpServer): void {
  server.registerTool(
    'aenderungen_seit',
    {
      title: 'Aenderungen seit Zeitpunkt',
      description:
        'Listet Dateien und Twin-Artefakte, die seit `seit` neu oder geaendert sind — je mit Art ' +
        '(quelle/markdown/contract/artefakt) und Erschliessungszustand (kein_twin/transkript/' +
        'transformation). Der Einstieg in den Tagesabschluss. Scope per folderId/pfad; ohne Scope ' +
        'die ganze Library (dauert, Dauer steht in der Antwort). Geloeschtes/Umbenanntes ist ohne ' +
        'Provider-Delta NICHT erkennbar (ausgewiesen). Liest nur.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        seit: z.string().min(4).describe('ISO-Zeitpunkt oder Datum, z. B. "2026-08-21" oder "2026-08-21T18:00:00Z"'),
        folderId: FOLDER_ID,
        pfad: SCOPE_PFAD,
        maxEintraege: z.number().int().min(1).max(1000).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ libraryId, seit, folderId, pfad, maxEintraege }) => {
      try {
        const userEmail = mcpUserEmail()
        const library = await requireLibrary(userEmail, libraryId)
        const provider = await requireProvider(userEmail, libraryId)
        const seitDate = new Date(seit)
        if (Number.isNaN(seitDate.getTime())) throw new Error(`"seit" ist kein gueltiger Zeitpunkt: ${seit}`)
        const scope = await resolveScope({ userEmail, libraryId, folderId, pfad })
        const { scan, families, dauerMs } = await scanScope(library, provider, scope, 'nur-bericht')
        const result = aenderungenSeit({ folders: scan.folders, families, seit: seitDate, max: maxEintraege })
        return jsonResult({
          seit: seitDate.toISOString(), scope: scope ?? '(Library)', dauerMs,
          gescannteOrdner: scan.folders.length, ...result,
          hinweis: 'Geloeschte/umbenannte Dateien sind ohne Provider-Delta nicht erkennbar; Quellen mit kein_twin → quelle_erschliessen.',
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    'erschliessung_block_schreiben',
    {
      title: 'Erschliessungs-Block in _INDEX.md (SCHREIBT)',
      description:
        'Abloesung von erschliessung.py: schreibt je _INDEX.md im Scope den Block zwischen ' +
        '<!-- erschliessung:start/end --> neu (Quellen: erschlossen/teil/offen aus den Twin-Familien ' +
        'in MongoDB); der Rest der Datei bleibt unberuehrt. nurVorschau=true zeigt die Bloecke ohne ' +
        'zu schreiben. SCHREIBT in Contract-Dateien (nur den Block); nur nach Bestaetigung.',
      inputSchema: {
        libraryId: LIBRARY_ID, folderId: FOLDER_ID, pfad: SCOPE_PFAD,
        nurVorschau: z.boolean().optional(),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ libraryId, folderId, pfad, nurVorschau , begruendung }) => {
      try {
        return await mitProtokoll({ werkzeug: 'erschliessung_block_schreiben', libraryId, akteur: mcpUserEmail(), begruendung, folderId }, async () => {
          const userEmail = mcpUserEmail()
          const library = await requireLibrary(userEmail, libraryId)
          const provider = await requireProvider(userEmail, libraryId)
          const scope = await resolveScope({ userEmail, libraryId, folderId, pfad })
          const { scan, families, dauerMs } = await scanScope(library, provider, scope, 'alle')
          const bloecke = erschliessungsBloecke({ folders: scan.folders, families, heute: new Date().toISOString().slice(0, 10) })
          const geschrieben: string[] = []
          const unveraendert: string[] = []
          if (nurVorschau !== true) {
            for (const b of bloecke) {
              const folder = scan.folders.find((f) => f.folderId === b.folderId)
              const index = folder?.index
              if (!folder || !index) continue
              const { blob } = await provider.getBinary(index.fileId)
              const text = await blob.text()
              const neu = indexMitBlock(text, b.block)
              if (neu === text) { unveraendert.push(b.path || '(Wurzel)'); continue }
              // Welle ST1: an Ort und Stelle statt loeschen + hochladen. Die
              // _INDEX.md behaelt ihre itemId — gespeicherte fileIds (Report,
              // Twin-Familien) laufen danach nicht ins NOT_FOUND.
              await ersetzeTextDatei({ provider, fileId: index.fileId, inhalt: neu })
              geschrieben.push(b.path || '(Wurzel)')
            }
          }
          return jsonResult({
            modus: nurVorschau === true ? 'vorschau' : 'geschrieben', scope: scope ?? '(Library)', dauerMs,
            indizes: bloecke.map(({ block, ...rest }) => ({ ...rest, ...(nurVorschau === true ? { block } : {}) })),
            geschrieben, unveraendert,
          })
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
