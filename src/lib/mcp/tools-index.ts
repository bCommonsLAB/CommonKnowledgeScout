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
import { getByFileIds, getCollectionNameForLibrary } from '@/lib/repositories/vector-repo'
import { getShadowTwinsBySourceIds } from '@/lib/repositories/shadow-twin-repo'
import { MAX_ORDNER, MAX_STAPEL, quellenAusAufruf, waehleFuerIndex } from './index-quellen'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary, requireProvider } from './tool-shared'
import { JOB_HINWEIS, type BatchRow } from './tools-erschliessen-shared'
import { depubliziereQuelle } from './website-publizieren'

interface TransformationsRecord { markdown?: string; updatedAt?: string }

/**
 * Transformation in der Zielsprache: mit `vorlage` genau diese, sonst die
 * juengste (wie `selectShadowTwinArtifact`). Nur Records mit Inhalt zaehlen.
 */
function waehleTransformation(
  transformationen: Record<string, Record<string, TransformationsRecord> | undefined>,
  sprache: string,
  vorlage?: string,
): { template: string } | null {
  let beste: { template: string; updatedAt: string } | null = null
  for (const [template, sprachen] of Object.entries(transformationen)) {
    if (vorlage && template.toLowerCase() !== vorlage.toLowerCase()) continue
    const record = sprachen?.[sprache]
    if (!record?.markdown?.trim()) continue
    const updatedAt = record.updatedAt ?? ''
    if (!beste || updatedAt > beste.updatedAt) beste = { template, updatedAt }
  }
  return beste ? { template: beste.template } : null
}

export function registerIndexTools(server: McpServer): void {
  server.registerTool(
    'index_aktualisieren',
    {
      title: 'Index aus vorhandener Transformation neu schreiben (SCHREIBT, langlaufend)',
      description:
        'Startet je Quelle NUR Phase 3: die vorhandene Transformation am Twin wird neu in den Index ' +
        'geschrieben (Meta-Dokument, Chunks, Vorspann) — nach einer neuen Facette, geaenderter Vorlage ' +
        'oder Twin-Korrektur. Kein Secretary-Aufruf, keine neue Transformation. nurPublizierte (Vorgabe ' +
        'TRUE): nur Quellen, die schon in der Galerie stehen — der Index folgt dem Twin, er erweitert den ' +
        'Bestand nicht (Neues ueber dokument_publizieren). vorlage: nur Transformationen dieser Vorlage. ' +
        'Uebersprungenes und Quellen ohne Transformation stehen je Zeile mit Grund und Pfad da. Quellen als ' +
        `sourceIds (bis ${MAX_STAPEL}) ODER ordner/ordnerId (+ rekursiv, bis ${MAX_ORDNER}); ${ZAUN_BESCHREIBUNG} und werden genannt. ` +
        'Antwortet sofort mit batchId und jobIds — Bilanz mit batch_bilanz. SCHREIBT; nur nach Bestaetigung.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        sourceIds: z.array(z.string().min(1)).min(1).max(MAX_STAPEL).optional().describe('Storage-Ids der Quellen (bis 30)'),
        ordner: z.string().min(1).optional().describe('ALTERNATIVE: library-relativer Ordnerpfad'),
        ordnerId: z.string().min(1).optional().describe('ALTERNATIVE: Storage-Id des Ordners'),
        rekursiv: z.boolean().optional().describe('Unterordner mitnehmen (Default false)'),
        zielsprache: z.string().min(2).max(5).optional().describe('Sprache der Transformation (Default de)'),
        nurPublizierte: z.boolean().optional().describe('Vorgabe true: nur Quellen mit Galerie-Eintrag; false nimmt jede Quelle mit Transformation'),
        vorlage: z.string().min(1).optional().describe('nur Transformationen dieser Vorlage (z. B. "vortrag-session-de")'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ libraryId, sourceIds, ordner, ordnerId, rekursiv, zielsprache, nurPublizierte, vorlage, begruendung }) => {
      try {
        return await mitProtokoll({ werkzeug: 'index_aktualisieren', libraryId, akteur: mcpUserEmail(), begruendung, pfad: ordner }, async () => {
          const userEmail = mcpUserEmail()
          const library = await requireLibrary(userEmail, libraryId)
          const provider = await requireProvider(userEmail, libraryId)
          const sprache = zielsprache ?? 'de'
          const nurPub = nurPublizierte ?? true
          const { kandidaten, fehler, zaun } = await quellenAusAufruf({ provider, userEmail, libraryId, sourceIds, ordner, ordnerId, rekursiv })
          const ids = kandidaten.map((k) => k.source.itemId)
          const twins = await getShadowTwinsBySourceIds({ libraryId, sourceIds: ids })
          const publiziert = nurPub && ids.length > 0
            ? new Set((await getByFileIds(getCollectionNameForLibrary(library), libraryId, ids)).keys())
            : new Set<string>()
          const uebersprungen: Array<{ quelle: string; grund: string }> = []
          const auswahl = kandidaten.filter(({ source, anzeige }) => {
            const transformationen = twins.get(source.itemId)?.artifacts.transformation ?? {}
            const vorlagenDesTwins = Object.entries(transformationen)
              .filter(([, sprachen]) => Boolean(sprachen?.[sprache]?.markdown?.trim()))
              .map(([name]) => name)
            const wahl = waehleFuerIndex({ publiziert: publiziert.has(source.itemId), nurPublizierte: nurPub, vorlagenDesTwins, vorlage })
            if (!wahl.nehmen) uebersprungen.push({ quelle: anzeige, grund: wahl.grund ?? 'ausgelassen' })
            return wahl.nehmen
          })
          const batchId = auswahl.length > 1 ? crypto.randomUUID() : undefined
          const zeilen: BatchRow[] = [...fehler]
          for (const { source, anzeige } of auswahl) {
            try {
              const doc = twins.get(source.itemId)
              const artefakt = doc ? waehleTransformation(doc.artifacts.transformation ?? {}, sprache, vorlage) : null
              if (!artefakt) throw new Error(`Keine Transformation (${sprache}) am Twin — zuerst transformation_starten`)
              const { jobId } = await enqueueIngestOnlyJob({
                libraryId, userEmail, source, template: artefakt.template, targetLanguage: sprache, batchId,
              })
              zeilen.push({ quelle: anzeige, jobId, hinweis: `Vorlage ${artefakt.template}` })
            } catch (error) {
              zeilen.push({ quelle: anzeige, fehler: error instanceof Error ? error.message : String(error) })
            }
          }
          return jsonResult({
            ok: zeilen.every((z) => !z.fehler),
            batchId: batchId ?? null,
            nurPublizierte: nurPub,
            vorlage: vorlage ?? null,
            gestartet: zeilen.filter((z) => z.jobId).length,
            gescheitert: zeilen.filter((z) => z.fehler).length,
            jobs: zeilen,
            uebersprungen,
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
