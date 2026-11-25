/**
 * @fileoverview MCP-Werkzeug `dokument_uebersetzen` (25.11.2026).
 *
 * @description
 * Loest die Uebersetzung publizierter Galerie-Eintraege aus — auch fuer Seiten der Website, die
 * in der Galerie-Tabelle keinen Knopf „Publizieren" haben. Derselbe Auftrag wie dort: je
 * Zielsprache ein Job `phase-translations`, der das Ergebnis nach
 * `docMetaJson.translations.<gallery|detail>.<locale>` schreibt; bei website-Seiten prueft der
 * Worker, dass Sektions-Marker und Bild-Adressen erhalten bleiben (`website-translation-guard`).
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SUPPORTED_LOCALES } from '@ks/i18n'
import { getCollectionNameForLibrary, getMetaByFileId, setDocPublication } from '@/lib/repositories/vector-repo'
import { isModeratorOrOwner } from '@/lib/repositories/library-members-repo'
import { enqueueTranslationJobsForLocales } from '@/lib/external-jobs/enqueue-translations'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary } from './tool-shared'
import { planeUebersetzung } from './dokument-uebersetzen'

const MAX_STAPEL = 30

interface Zeile {
  fileId: string
  titel?: string
  quellsprache?: string
  zielsprachen?: string[]
  /** Job je Zielsprache — Fortschritt mit job_status. */
  jobs?: Record<string, string>
  fehler?: string
}

export function registerDokumentUebersetzenTool(server: McpServer): void {
  server.registerTool(
    'dokument_uebersetzen',
    {
      title: 'Galerie-Eintrag in die Zielsprachen uebersetzen (SCHREIBT, Sprachmodell)',
      description:
        'Startet je Zielsprache einen Uebersetzungs-Job fuer publizierte Galerie-Eintraege — auch fuer Seiten der ' +
        'Website (detailViewType website), die dokument_publizieren NICHT uebersetzt. Zielsprachen: `zielsprachen` ' +
        `(${SUPPORTED_LOCALES.join(', ')}), sonst die der Library (Einstellungen → Uebersetzungen); die Sprache des ` +
        'Dokuments selbst entfaellt. Setzt den Eintrag auf „published" wie der Knopf in der Galerie. ' +
        'Nach einer Textaenderung `erzwingen: true`, sonst kann eine vorhandene Uebersetzung stehen bleiben. ' +
        'Kostet Sprachmodell-Aufrufe (einer je Dokument und Sprache). Stapel via sourceIds (bis 30), Fehler je ' +
        'Zeile. Ergebnis mit job_status je Job. Nur Owner und Moderation, nur nach Bestaetigung durch den Menschen.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        sourceId: z.string().min(1).optional().describe('Storage-Id der Quelle (= fileId des Eintrags)'),
        sourceIds: z.array(z.string().min(1)).min(1).max(MAX_STAPEL).optional()
          .describe('STAPEL: mehrere Storage-Ids — eine Ergebniszeile je Eintrag'),
        zielsprachen: z.array(z.string().min(2).max(5)).min(1).max(SUPPORTED_LOCALES.length).optional()
          .describe('Zielsprachen fuer diesen Auftrag; ohne Angabe die der Library'),
        erzwingen: z.boolean().optional().describe('true = vorhandene Uebersetzungen neu erzeugen (Vorgabe false)'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false },
    },
    async ({ libraryId, sourceId, sourceIds, zielsprachen, erzwingen, begruendung }) => {
      try {
        return await mitProtokoll(
          { werkzeug: 'dokument_uebersetzen', libraryId, akteur: mcpUserEmail(), begruendung, sourceId },
          async () => {
            const userEmail = mcpUserEmail()
            const library = await requireLibrary(userEmail, libraryId)
            if (!(await isModeratorOrOwner(libraryId, userEmail))) {
              throw new Error(`Nur Owner und Moderation der Library ${libraryId} duerfen uebersetzen lassen`)
            }
            const stapel = Array.isArray(sourceIds) && sourceIds.length > 0
            if (sourceId && stapel) throw new Error('Entweder sourceId ODER sourceIds — nicht beides')
            const ids = stapel ? sourceIds ?? [] : sourceId ? [sourceId] : []
            if (ids.length === 0) throw new Error('sourceId oder sourceIds ist Pflicht')

            const libraryKey = getCollectionNameForLibrary(library)
            const konfiguriert = library.config?.translations?.targetLocales
            const zeilen: Zeile[] = []
            for (const fileId of ids) {
              try {
                const meta = await getMetaByFileId(libraryKey, fileId)
                if (!meta) throw new Error('Kein Galerie-Eintrag zu dieser Quelle — erst dokument_publizieren')
                const kopf = meta as { title?: unknown; fileName?: unknown; docMetaJson?: Record<string, unknown> }
                const docMetaJson = kopf.docMetaJson
                const plan = planeUebersetzung(docMetaJson, konfiguriert, zielsprachen)
                const titel = [kopf.title, docMetaJson?.title, kopf.fileName].find((t): t is string => typeof t === 'string' && t.trim() !== '')
                const gesetzt = await setDocPublication(libraryKey, fileId, { status: 'published', publishedBy: userEmail, targetLocales: plan.zielsprachen })
                if (!gesetzt) throw new Error('Publikationsstatus konnte nicht gesetzt werden')
                const jobs = await enqueueTranslationJobsForLocales(
                  {
                    libraryId, fileId, sourceLocale: plan.quellsprache, userEmail, force: erzwingen === true, sourceName: titel,
                    detailViewType: typeof docMetaJson?.detailViewType === 'string' ? docMetaJson.detailViewType : undefined,
                  },
                  plan.zielsprachen,
                )
                zeilen.push({ fileId, titel, quellsprache: plan.quellsprache, zielsprachen: plan.zielsprachen, jobs })
              } catch (error) {
                zeilen.push({ fileId, fehler: error instanceof Error ? error.message : String(error) })
              }
            }
            return jsonResult({
              zeilen,
              gestartet: zeilen.filter((z) => z.jobs).length,
              gescheitert: zeilen.filter((z) => z.fehler).length,
              zielsprachenDerLibrary: konfiguriert ?? [],
              hinweis: 'Je Zielsprache laeuft ein Job — Stand mit job_status. Die Seite zeigt die Uebersetzung, sobald der Job fertig ist, in der Sprache der Oberflaeche.',
            })
          },
        )
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
