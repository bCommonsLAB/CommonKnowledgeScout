/**
 * @fileoverview MCP-Werkzeuge `index_aktualisieren` und `index_entfernen` (Welle C).
 *
 * @description
 * Index folgt dem Twin: `index_aktualisieren` startet je Quelle NUR Phase 3
 * (Ingest der vorhandenen Transformation) — nach einer neuen Facette, einer
 * geaenderten Vorlage oder einer Twin-Korrektur. Quellen kommen als
 * sourceIds (bis 30) ODER als Ordner (+ rekursiv) hinter demselben Zaun wie
 * der Batch-Dialog. `index_entfernen` ist die Stapel-Form von
 * dokument_depublizieren. Beide schreiben; nur nach Bestaetigung.
 *
 * @module mcp
 */

import crypto from 'crypto'
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { enqueueIngestOnlyJob } from '@/lib/external-jobs/enqueue-ingest-job'
import { ZAUN_BESCHREIBUNG } from '@/lib/pipeline/batch-zaun'
import { getShadowTwinsBySourceIds } from '@/lib/repositories/shadow-twin-repo'
import { selectShadowTwinArtifact } from '@/lib/shadow-twin/shadow-twin-select'
import type { StorageProvider } from '@/lib/storage/types'
import { sammleOrdnerQuellen } from './ordner-quellen'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary, requireProvider, resolveScope } from './tool-shared'
import { JOB_HINWEIS, resolveSourceItem, type BatchRow, type ResolvedSource } from './tools-erschliessen-shared'
import { depubliziereQuelle } from './website-publizieren'

const MAX_STAPEL = 30
const MAX_ORDNER = 200

async function quellenAusAufruf(args: {
  provider: StorageProvider
  userEmail: string
  libraryId: string
  sourceIds?: string[]
  ordner?: string
  ordnerId?: string
  rekursiv?: boolean
}): Promise<{ quellen: Array<ResolvedSource | { fehler: string; quelle: string }>; zaun: Record<string, unknown> }> {
  const stapel = Array.isArray(args.sourceIds) && args.sourceIds.length > 0
  const ordner = Boolean(args.ordner) || Boolean(args.ordnerId)
  if (stapel && ordner) throw new Error('Entweder sourceIds ODER ordner/ordnerId — nicht beides')
  if (!stapel && !ordner) throw new Error('sourceIds oder ordner/ordnerId ist Pflicht')
  if (stapel) {
    const quellen = await Promise.all((args.sourceIds ?? []).map(async (id) => {
      try { return await resolveSourceItem(args.provider, id) } catch (error) {
        return { quelle: id, fehler: error instanceof Error ? error.message : String(error) }
      }
    }))
    return { quellen, zaun: {} }
  }
  const folderId = await resolveScope({ userEmail: args.userEmail, libraryId: args.libraryId, folderId: args.ordnerId, pfad: args.ordner })
  if (!folderId) throw new Error('Ordner nicht aufloesbar')
  const gesammelt = await sammleOrdnerQuellen({ provider: args.provider, folderId, rekursiv: args.rekursiv ?? false, maxQuellen: MAX_ORDNER })
  return {
    quellen: gesammelt.quellen,
    zaun: {
      zaun: ZAUN_BESCHREIBUNG,
      uebersprungeneOrdner: gesammelt.uebersprungeneOrdner,
      uebersprungeneDateien: gesammelt.uebersprungeneDateien,
      ...(gesammelt.abgeschnitten ? { hinweis: `Nur die ersten ${MAX_ORDNER} Quellen genommen — Ordner enger fassen` } : {}),
    },
  }
}

export function registerIndexTools(server: McpServer): void {
  server.registerTool(
    'index_aktualisieren',
    {
      title: 'Index aus vorhandener Transformation neu schreiben (SCHREIBT, langlaufend)',
      description:
        'Startet je Quelle NUR Phase 3: die vorhandene Transformation am Twin wird neu in den Index ' +
        'geschrieben (Meta-Dokument, Chunks, Vorspann) — nach einer neuen Facette, geaenderter Vorlage ' +
        'oder Twin-Korrektur. Kein Secretary-Aufruf, keine neue Transformation. Quellen ohne ' +
        'Transformation werden je Zeile als Fehler genannt. Quellen als sourceIds (bis 30) ODER ' +
        `ordner/ordnerId (+ rekursiv, bis ${MAX_ORDNER}); ${ZAUN_BESCHREIBUNG} und werden genannt. ` +
        'Antwortet sofort mit batchId und jobIds — Bilanz mit batch_bilanz. SCHREIBT; nur nach Bestaetigung.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        sourceIds: z.array(z.string().min(1)).min(1).max(MAX_STAPEL).optional().describe('Storage-Ids der Quellen (bis 30)'),
        ordner: z.string().min(1).optional().describe('ALTERNATIVE: library-relativer Ordnerpfad'),
        ordnerId: z.string().min(1).optional().describe('ALTERNATIVE: Storage-Id des Ordners'),
        rekursiv: z.boolean().optional().describe('Unterordner mitnehmen (Default false)'),
        zielsprache: z.string().min(2).max(5).optional().describe('Sprache der Transformation (Default de)'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ libraryId, sourceIds, ordner, ordnerId, rekursiv, zielsprache, begruendung }) => {
      try {
        return await mitProtokoll({ werkzeug: 'index_aktualisieren', libraryId, akteur: mcpUserEmail(), begruendung, pfad: ordner }, async () => {
          const userEmail = mcpUserEmail()
          await requireLibrary(userEmail, libraryId)
          const provider = await requireProvider(userEmail, libraryId)
          const sprache = zielsprache ?? 'de'
          const { quellen, zaun } = await quellenAusAufruf({ provider, userEmail, libraryId, sourceIds, ordner, ordnerId, rekursiv })
          const aufgeloest = quellen.filter((q): q is ResolvedSource => 'itemId' in q)
          const twins = await getShadowTwinsBySourceIds({ libraryId, sourceIds: aufgeloest.map((q) => q.itemId) })
          const batchId = aufgeloest.length > 1 ? crypto.randomUUID() : undefined
          const zeilen: BatchRow[] = quellen.filter((q): q is { fehler: string; quelle: string } => 'fehler' in q)
          for (const source of aufgeloest) {
            try {
              const doc = twins.get(source.itemId)
              const artefakt = doc ? selectShadowTwinArtifact(doc, 'transformation', sprache) : null
              if (!artefakt?.record.markdown?.trim()) {
                throw new Error(`Keine Transformation (${sprache}) am Twin — zuerst transformation_starten`)
              }
              const template = artefakt.templateName
              if (!template) throw new Error(`Transformation (${sprache}) am Twin traegt keinen Vorlagennamen — Artefakt-Schluessel unvollstaendig`)
              const { jobId } = await enqueueIngestOnlyJob({
                libraryId, userEmail, source, template, targetLanguage: sprache, batchId,
              })
              zeilen.push({ quelle: source.name, jobId, hinweis: `Vorlage ${template}` })
            } catch (error) {
              zeilen.push({ quelle: source.name, fehler: error instanceof Error ? error.message : String(error) })
            }
          }
          return jsonResult({
            ok: zeilen.every((z) => !z.fehler),
            batchId: batchId ?? null,
            gestartet: zeilen.filter((z) => z.jobId).length,
            gescheitert: zeilen.filter((z) => z.fehler).length,
            jobs: zeilen,
            ...zaun,
            hinweis: JOB_HINWEIS,
          })
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    'index_entfernen',
    {
      title: 'Galerie-Eintraege im Stapel zuruecknehmen (SCHREIBT)',
      description:
        'Stapel-Form von dokument_depublizieren: nimmt bis zu 30 Eintraege samt Vektoren aus dem ' +
        'Index. Twin und Quelle bleiben; ein erneutes dokument_publizieren oder index_aktualisieren ' +
        'stellt den Eintrag wieder her. Gedacht fuer Befunde aus bestand_pruefen (Doppelgaenger, ' +
        'Twin-/Testordner). Fehler je Zeile, kein Abbruch. SCHREIBT; nur nach Bestaetigung.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        sourceIds: z.array(z.string().min(1)).min(1).max(MAX_STAPEL).describe('Storage-Ids (= fileId der Eintraege)'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ libraryId, sourceIds, begruendung }) => {
      try {
        return await mitProtokoll({ werkzeug: 'index_entfernen', libraryId, akteur: mcpUserEmail(), begruendung }, async () => {
          const library = await requireLibrary(mcpUserEmail(), libraryId)
          const zeilen: Array<{ sourceId: string; warPubliziert?: boolean; fehler?: string }> = []
          for (const sourceId of sourceIds) {
            try {
              zeilen.push(await depubliziereQuelle({ library, fileId: sourceId }).then((r) => ({ sourceId, warPubliziert: r.warPubliziert })))
            } catch (error) {
              zeilen.push({ sourceId, fehler: error instanceof Error ? error.message : String(error) })
            }
          }
          return jsonResult({
            entfernt: zeilen.filter((z) => z.warPubliziert === true).length,
            nichtPubliziert: zeilen.filter((z) => z.warPubliziert === false).length,
            gescheitert: zeilen.filter((z) => z.fehler).length,
            zeilen,
          })
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
