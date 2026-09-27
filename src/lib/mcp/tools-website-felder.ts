/**
 * @fileoverview MCP-Werkzeug: `dokument_felder_setzen` (B2).
 *
 * @description
 * Setzt flache Felder und Tags an publizierten Dokumenten — Twin-Frontmatter
 * UND Meta-Dokument, in dieser Reihenfolge. Anlass: die Fokus-Markierung von
 * rund 30 Massnahmen (Tag `fokus`), die sonst 30 Klicks im Frontmatter-Editor
 * waeren. Die `_`-Twin-Ordner bleiben fuer datei_patchen gesperrt; hier
 * schreibt die Bruecke ueber denselben Dienst wie die App.
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createMarkdownWithFrontmatter } from '@/lib/markdown/compose'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { patchMetaDokumentFelder } from '@/lib/repositories/doc-meta-felder'
import { getShadowTwinsBySourceIds } from '@/lib/repositories/shadow-twin-repo'
import { getCollectionNameForLibrary } from '@/lib/repositories/vector-repo'
import { selectShadowTwinArtifact } from '@/lib/shadow-twin/shadow-twin-select'
import { ShadowTwinService } from '@/lib/shadow-twin/store/shadow-twin-service'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary, requireProvider } from './tool-shared'
import { wendeFelderAn } from './website-felder'

const MAX_STAPEL = 30
const SKALAR = z.union([z.string(), z.number(), z.boolean()])

interface Zeile {
  sourceId: string
  quelle?: string
  geaendert?: Record<string, unknown>
  metaDokument?: 'aktualisiert' | 'nicht_publiziert'
  fehler?: string
}

export function registerWebsiteFelderTool(server: McpServer): void {
  server.registerTool(
    'dokument_felder_setzen',
    {
      title: 'Flache Felder/Tags an Dokumenten setzen (SCHREIBT)',
      description:
        'Setzt flache Frontmatter-Felder (`felder`, Skalare) und ergaenzt/entfernt Listeneintraege ' +
        '(`listen`, `entfernen`, z. B. tags: ["fokus"]) an bis zu 30 Quellen. Schreibt zuerst das ' +
        'Frontmatter der Transformation am Twin, dann das Meta-Dokument (docMetaJson + gespiegelte ' +
        'Facetten) — beide oder keins je Quelle. Gesperrt: Felder, die die Pipeline rechnet ' +
        '(prioritaets_index, bewertung_*) und Pflichtfelder des Typs. Ist die Quelle nicht publiziert, ' +
        'wird nur der Twin geaendert und die Zeile sagt es. Nur nach Bestaetigung durch den Menschen.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        sourceIds: z.array(z.string().min(1)).min(1).max(MAX_STAPEL).describe('Storage-Ids der Quellen'),
        felder: z.record(SKALAR).optional().describe('Skalare setzen, flache snake_case-Keys'),
        listen: z.record(z.array(z.string().min(1)).min(1)).optional().describe('Listeneintraege ergaenzen'),
        entfernen: z.record(z.array(z.string().min(1)).min(1)).optional().describe('Listeneintraege entfernen'),
        zielsprache: z.string().min(2).max(5).optional().describe('Sprache der Transformation (Default de)'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false },
    },
    async ({ libraryId, sourceIds, felder, listen, entfernen, zielsprache, begruendung }) => {
      try {
        return await mitProtokoll(
          { werkzeug: 'dokument_felder_setzen', libraryId, akteur: mcpUserEmail(), begruendung },
          async () => {
            if (!felder && !listen && !entfernen) throw new Error('felder, listen oder entfernen ist Pflicht')
            const userEmail = mcpUserEmail()
            const library = await requireLibrary(userEmail, libraryId)
            const provider = await requireProvider(userEmail, libraryId)
            const libraryKey = getCollectionNameForLibrary(library)
            const sprache = zielsprache ?? 'de'
            const twins = await getShadowTwinsBySourceIds({ libraryId, sourceIds })

            const zeilen: Zeile[] = []
            for (const sourceId of sourceIds) {
              try {
                const doc = twins.get(sourceId)
                if (!doc) throw new Error('Kein Twin in MongoDB — Quelle zuerst erschliessen oder publizieren')
                const artefakt = selectShadowTwinArtifact(doc, 'transformation', sprache)
                if (!artefakt?.record.markdown) throw new Error(`Keine Transformation (${sprache}) am Twin`)
                const { meta, body } = parseFrontmatter(artefakt.record.markdown)
                const typ = typeof meta['detailViewType'] === 'string' ? meta['detailViewType'] : null
                const { meta: neu, geaendert } = wendeFelderAn(meta, { felder, listen, entfernen }, typ)
                if (Object.keys(geaendert).length === 0) {
                  zeilen.push({ sourceId, quelle: doc.sourceName, geaendert: {} })
                  continue
                }
                const twin = new ShadowTwinService({
                  library, userEmail, sourceId, sourceName: doc.sourceName, parentId: doc.parentId, provider,
                })
                await twin.upsertMarkdown({
                  kind: 'transformation', targetLanguage: artefakt.targetLanguage,
                  templateName: artefakt.templateName, markdown: createMarkdownWithFrontmatter(body, neu),
                })
                const publiziert = await patchMetaDokumentFelder(libraryKey, sourceId, geaendert)
                zeilen.push({
                  sourceId, quelle: doc.sourceName, geaendert,
                  metaDokument: publiziert ? 'aktualisiert' : 'nicht_publiziert',
                })
              } catch (error) {
                zeilen.push({ sourceId, fehler: error instanceof Error ? error.message : String(error) })
              }
            }
            return jsonResult({
              zeilen,
              geaendert: zeilen.filter((z) => z.geaendert && Object.keys(z.geaendert).length > 0).length,
              gescheitert: zeilen.filter((z) => z.fehler).length,
            })
          },
        )
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
