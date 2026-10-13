/**
 * @fileoverview Umzugs-Werkzeuge der MCP-Bruecke (Welle 0e ueber MCP).
 *
 * @description
 * Umbenennen/Verschieben gehoert in KnowledgeScout, nie in direkte
 * Dateisystem-Zugriffe des Agenten: `familie_umziehen` nutzt den
 * vorhandenen Service `moveFamily` (Import → Siblings → Quelle → Mongo →
 * alter Spiegel weg → Export, Contract §7) — Datenbank und Spiegel ziehen
 * in EINEM Zug mit. Fuer Dateien OHNE Twin-Familie (z. B. abgeschnittene
 * Sync-Reste) bewegt derselbe Weg nur die Datei. `ordner_umbenennen` ist
 * Storage-only und Mongo-transparent (Provider-Ids bleiben stabil, die
 * `_`-Ordner wandern mit ihrem Ordner mit).
 *
 * Loeschen ist BEWUSST kein Werkzeug — `quelle_verwerfen` (Pilot-Wunschliste
 * C4) ist der reversible Ersatz: Quelle + Familie ziehen in einen
 * „zu klären“-Unterordner ihres Elternordners (wird bei Bedarf angelegt);
 * Mongo bleibt konsistent (derselbe moveFamily-Weg). Ein eigenes
 * verworfen-Flag am Dokument ist eine dokumentierte Ausbaustufe.
 *
 * @module mcp
 */

import { z } from 'zod'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { moveFamily } from '@/lib/shadow-twin/move-family'
import { KLAER_ORDNER, verwirfQuelle } from '@/lib/shadow-twin/quelle-verwerfen'
import type { StorageProvider } from '@/lib/storage/types'
import { resolveFolderIdByPath, resolveItemByPath } from './resolve-folder'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary, requireProvider } from './tool-shared'
import { MAX_UMZUEGE, fuehreStapelUmzugAus } from './umzug-stapel'


async function resolveSourceId(provider: StorageProvider, sourceId?: string, quellPfad?: string): Promise<string> {
  if (sourceId && quellPfad) throw new Error('Entweder sourceId ODER quellPfad angeben — nicht beides')
  if (sourceId) return sourceId
  if (!quellPfad) throw new Error('sourceId oder quellPfad ist Pflicht')
  return (await resolveItemByPath(provider, quellPfad, 'file')).id
}

async function resolveTargetFolder(
  provider: StorageProvider,
  neuerOrdnerId?: string,
  neuerOrdnerPfad?: string,
): Promise<string | undefined> {
  if (neuerOrdnerId && neuerOrdnerPfad) {
    throw new Error('Entweder neuerOrdnerId ODER neuerOrdnerPfad angeben — nicht beides')
  }
  if (neuerOrdnerId) return neuerOrdnerId
  if (!neuerOrdnerPfad) return undefined
  return resolveFolderIdByPath(provider, neuerOrdnerPfad)
}

/** Registriert die Umzugs-Werkzeuge (siehe Datei-Kommentar). */
export function registerUmzugTools(server: McpServer): void {
  server.registerTool(
    'familie_umziehen',
    {
      title: 'Familie umziehen (SCHREIBT)',
      description:
        'Benennt eine QUELLDATEI um und/oder verschiebt sie MIT ihrer Twin-Familie — in fester ' +
        'Reihenfolge: Import (Handkorrekturen retten) → Siblings → Quelle → MongoDB nachziehen → ' +
        'alter Spiegel weg → Export am neuen Ort. Dateien ohne Twin-Familie (z. B. Sync-Reste, ' +
        'Befund datei_ohne_endung) werden einfach umbenannt/verschoben. STAPEL: sourceIds (bis ' +
        `${MAX_UMZUEGE}) zieht mehrere Quellen in DENSELBEN Ziel-Ordner — ein Aufruf statt einem je ` +
        'Datei; Fehler einer Quelle brechen den Stapel nicht ab. Umbenennen bleibt Einzeloperation. ' +
        'NIE Dateien direkt im Dateisystem anfassen — sonst zeigen die Mongo-Dokumente ins Leere. ' +
        'REIHENFOLGE: erst umbenennen, DANN erschliessen. Wer nach dem Erschliessen umbenennt, ' +
        'setzt jede betroffene Familie auf twin_stale (gemessen: 23 Familien nach einem Lauf; ' +
        'derselbe Ordner vorher umbenannt — 28 Umzuege, null twin_stale). ' +
        'SCHREIBT in Storage und MongoDB; nur nach Bestaetigung durch den Menschen ausfuehren.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        sourceId: z.string().min(1).optional().describe('Storage-Id der Quelldatei (targetId aus Befunden / sourceId aus Familien)'),
        quellPfad: z.string().min(1).optional().describe('ALTERNATIVE: library-relativer Pfad der Quelldatei'),
        sourceIds: z.array(z.string().min(1)).min(1).max(MAX_UMZUEGE).optional()
          .describe(`STAPEL statt sourceId/quellPfad: bis ${MAX_UMZUEGE} Quelldateien, alle in DENSELBEN Ziel-Ordner (neuerOrdnerId/-Pfad Pflicht, neuerName verboten)`),
        neuerName: z.string().min(1).optional().describe('Neuer Dateiname INKL. Endung (nur Einzel-Umzug)'),
        neuerOrdnerId: z.string().min(1).optional().describe('Ziel-Ordner-Id (aus der Ordnerliste von abdeckung_lesen)'),
        neuerOrdnerPfad: z.string().min(1).optional().describe('ALTERNATIVE: library-relativer Pfad des Ziel-Ordners'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ libraryId, sourceId, quellPfad, sourceIds, neuerName, neuerOrdnerId, neuerOrdnerPfad , begruendung }) => {
      try {
        return await mitProtokoll({ werkzeug: 'familie_umziehen', libraryId, akteur: mcpUserEmail(), begruendung, sourceId }, async () => {
          const userEmail = mcpUserEmail()
          const library = await requireLibrary(userEmail, libraryId)
          const provider = await requireProvider(userEmail, libraryId)
          const newParentId = await resolveTargetFolder(provider, neuerOrdnerId, neuerOrdnerPfad)

          // Stapel (ST9): mehrere Quellen, EIN Ziel-Ordner, kein Umbenennen.
          if (sourceIds && sourceIds.length > 0) {
            if (sourceId || quellPfad) throw new Error('Entweder sourceId/quellPfad ODER sourceIds — nicht beides')
            if (neuerName) throw new Error('neuerName ist im Stapel nicht erlaubt — Umbenennen bleibt Einzeloperation')
            if (!newParentId) throw new Error('Stapel braucht einen Ziel-Ordner (neuerOrdnerId/neuerOrdnerPfad)')
            const batch = await fuehreStapelUmzugAus({
              sourceIds,
              name: async (id) => (await provider.getItemById(id)).metadata.name,
              bewege: async (id) => {
                await moveFamily({ library, libraryId, userEmail, provider, sourceId: id, newParentId })
              },
            })
            return jsonResult({
              ok: batch.gescheitert === 0,
              ...batch,
              hinweis: 'Danach EIN abdeckung_scannen ueber den betroffenen Teilbaum — nicht je Datei.',
            })
          }

          const resolvedSourceId = await resolveSourceId(provider, sourceId, quellPfad)
          if (!neuerName && !newParentId) {
            throw new Error('neuerName und/oder ein Ziel-Ordner (neuerOrdnerId/neuerOrdnerPfad) ist Pflicht')
          }
          const result = await moveFamily({
            library, libraryId, userEmail, provider,
            sourceId: resolvedSourceId, newName: neuerName, newParentId,
          })
          return jsonResult({
            ok: true,
            result,
            hinweis:
              (result.sourceIdChanged
                ? `Die Storage-Id hat sich geaendert (pfadbasierter Provider): ab jetzt ${result.newSourceId} verwenden, ` +
                  `nicht mehr ${resolvedSourceId}. Twin-Dokument und Schaufenster sind umgeschrieben. `
                : '') +
              'Danach abdeckung_scannen (Teilbaum), damit der Report den neuen Stand zeigt.',
          })
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    'quelle_verwerfen',
    {
      title: 'Quelle verwerfen (SCHREIBT, reversibel)',
      description:
        'Reversibler Loesch-Ersatz (C4): verschiebt eine Quelle MIT ihrer Twin-Familie in den ' +
        `Unterordner „${KLAER_ORDNER}“ ihres Elternordners (wird bei Bedarf angelegt). Nichts wird ` +
        'geloescht — Mongo zieht mit (moveFamily), rueckgaengig = familie_umziehen zurueck. ' +
        'SCHREIBT in Storage und MongoDB; nur nach Bestaetigung durch den Menschen ausfuehren.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        sourceId: z.string().min(1).optional().describe('Storage-Id der Quelldatei (targetId aus Befunden)'),
        quellPfad: z.string().min(1).optional().describe('ALTERNATIVE: library-relativer Pfad der Quelldatei'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ libraryId, sourceId, quellPfad , begruendung }) => {
      try {
        return await mitProtokoll({ werkzeug: 'quelle_verwerfen', libraryId, akteur: mcpUserEmail(), begruendung, sourceId }, async () => {
          const userEmail = mcpUserEmail()
          const library = await requireLibrary(userEmail, libraryId)
          const provider = await requireProvider(userEmail, libraryId)
          const resolvedSourceId = await resolveSourceId(provider, sourceId, quellPfad)
          // Wunschliste 8, W8-3: derselbe Weg wie familie_uebergeben (herkunft: verwerfen).
          const { klaerOrdner, result } = await verwirfQuelle({ library, libraryId, userEmail, provider, sourceId: resolvedSourceId })
          return jsonResult({
            ok: true,
            verschobenNach: klaerOrdner,
            result,
            hinweis:
              'Reversibel: familie_umziehen mit dem alten Ordner als Ziel macht es rueckgaengig. ' +
              'Danach abdeckung_scannen (Teilbaum).',
          })
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
