/**
 * @fileoverview MCP-Werkzeug `familie_uebergeben` (Wunschliste 8, W8-3).
 *
 * @description
 * Gibt eine Quelle samt Twin-Familie von Library A nach Library B und
 * hinterlaesst in A eine Verweis-Datei (`type: verweis`) mit der Adresse
 * `@<slug>/<pfad>`. Der Ablauf liegt in `shadow-twin/transfer-family.ts`;
 * hier werden nur die echten Ports verdrahtet (MongoDB beider Libraries,
 * Sync-Laeufe, Segmente, der Weg von `quelle_verwerfen`).
 *
 * Owner-Entscheide des Plans (Abschnitt 4), so gebaut: `herkunft` ist Pflicht
 * und hat KEINE Vorgabe (behalten = Kopie plus Verweis, verwerfen = nach
 * „zu klären"); geloescht wird nie. Seitenbilder werden nicht kopiert, sondern
 * in B neu erzeugt. Nur Owner beider Libraries.
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { baueAdresse } from '@/lib/library-adresse/adresse'
import { bestimmeSlugs } from '@/lib/library-adresse/slug'
import { getShadowTwinsBySourceIds, setzeQuellkennung } from '@/lib/repositories/shadow-twin-repo'
import { legeTwinInZielAn } from '@/lib/repositories/shadow-twin-uebergabe'
import { getTranscriptSegments, saveTranscriptSegments } from '@/lib/repositories/transcript-segments-repo'
import { LibraryService } from '@/lib/services/library-service'
import { verwirfQuelle } from '@/lib/shadow-twin/quelle-verwerfen'
import { runLibrarySync } from '@/lib/shadow-twin/sync-engine/run-library-sync'
import { uebergibFamilie, type TransferPorts } from '@/lib/shadow-twin/transfer-family'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'
import { resolveFolderIdByPath, resolveItemByPath } from './resolve-folder'
import { errorResult, jsonResult, mcpUserEmail, requireLibrary, requireProvider } from './tool-shared'

export function registerUebergebenTool(server: McpServer): void {
  server.registerTool(
    'familie_uebergeben',
    {
      title: 'Quelle samt Familie an eine andere Library uebergeben (SCHREIBT)',
      description:
        'Gibt eine Quelle MIT Twin-Familie (Transkript, Transformationen, Transkript-Segmente, Quellkennung) von ' +
        'Library A (vonLibraryId) in einen Ordner von Library B (nachLibraryId) und hinterlaesst in A die Datei ' +
        '„Verweis – <Quellname>.md" (type: verweis, Adresse @<slug>/<pfad>). herkunft ist Pflicht: behalten = die ' +
        'Datei bleibt in A neben dem Verweis; verwerfen = Quelle und Familie in A ziehen nach „zu klären" (wie ' +
        'quelle_verwerfen). Geloescht wird nie. NICHT kopiert: Vektoren (danach index_aktualisieren in B), ' +
        'Seitenbilder (in B neu erzeugen). Am Ziel darf keine Datei gleichen Namens liegen; Grenze 250 MB. Scheitert ' +
        'das Anlegen des Twins in B, wird die Kopie dort wieder entfernt und A bleibt unveraendert. vorschau: true ' +
        'zeigt nur den Plan. Nur Owner beider Libraries. Nur nach Bestaetigung durch den Menschen.',
      inputSchema: {
        vonLibraryId: z.string().min(1).describe('Library, in der die Quelle heute liegt'),
        sourceId: z.string().min(1).optional().describe('Storage-Id der Quelle in A'),
        quellPfad: z.string().min(1).optional().describe('ALTERNATIVE: Pfad der Quelle in A'),
        nachLibraryId: z.string().min(1).describe('Ziel-Library'),
        nachOrdnerId: z.string().min(1).optional().describe('Ziel-Ordner-Id in B'),
        nachOrdnerPfad: z.string().min(1).optional().describe('ALTERNATIVE: Pfad des Ziel-Ordners in B'),
        herkunft: z.enum(['behalten', 'verwerfen']).describe('Was in A mit der Datei geschieht (Pflicht, keine Vorgabe)'),
        vorschau: z.boolean().optional().describe('nur Plan zeigen, nichts schreiben'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async (e) => {
      try {
        const userEmail = mcpUserEmail()
        return await mitProtokoll(
          { werkzeug: 'familie_uebergeben', libraryId: e.vonLibraryId, akteur: userEmail, begruendung: e.begruendung, ...(e.sourceId ? { sourceId: e.sourceId } : {}), ...(e.quellPfad ? { pfad: e.quellPfad } : {}), ...(e.vorschau ? { modus: 'vorschau' as const } : {}) },
          async () => {
            if ((e.sourceId === undefined) === (e.quellPfad === undefined)) throw new Error('Genau eines: sourceId ODER quellPfad')
            if ((e.nachOrdnerId === undefined) === (e.nachOrdnerPfad === undefined)) throw new Error('Genau eines: nachOrdnerId ODER nachOrdnerPfad')
            const service = LibraryService.getInstance()
            for (const id of [e.vonLibraryId, e.nachLibraryId]) {
              if (!(await service.isOwner(userEmail, id))) throw new Error(`Nur Owner beider Libraries koennen uebergeben — nicht Owner von ${id}`)
            }
            const libVon = await requireLibrary(userEmail, e.vonLibraryId)
            const libNach = await requireLibrary(userEmail, e.nachLibraryId)
            const providerVon = await requireProvider(userEmail, e.vonLibraryId)
            const providerNach = await requireProvider(userEmail, e.nachLibraryId)
            const sourceId = e.sourceId ?? (await resolveItemByPath(providerVon, e.quellPfad as string, 'file')).id
            const zielOrdnerId = e.nachOrdnerId ?? (await resolveFolderIdByPath(providerNach, e.nachOrdnerPfad as string))
            const slugNach = bestimmeSlugs(await service.getUserLibraries(userEmail)).find((s) => s.libraryId === e.nachLibraryId)?.slug ?? null

            const ports: TransferPorts = {
              ladeTwin: async (libraryId, id) => (await getShadowTwinsBySourceIds({ libraryId, sourceIds: [id] })).get(id) ?? null,
              importiere: async (libraryId, id) => { await runLibrarySync({ libraryId, userEmail, mode: 'repair', preset: 'import', scope: { sourceIds: [id] } }) },
              exportiere: async (libraryId, id) => { await runLibrarySync({ libraryId, userEmail, mode: 'repair', preset: 'export', scope: { sourceIds: [id] } }) },
              legeTwinAn: (args) => legeTwinInZielAn({ ...args, userEmail }),
              kopiereSegmente: async (vonLib, vonId, nachLib, nachId) => {
                const seg = await getTranscriptSegments({ libraryId: vonLib, sourceId: vonId })
                if (!seg) return false
                await saveTranscriptSegments({
                  libraryId: nachLib, sourceId: nachId, targetLanguage: seg.targetLanguage, jobId: seg.jobId,
                  llmModel: seg.llmModel, dataLanguage: seg.dataLanguage, segments: seg.segments, translatedChunks: seg.translatedChunks ?? null,
                })
                return true
              },
              setzeKennung: async (libraryId, id, quellkennung) => { await setzeQuellkennung({ libraryId, sourceId: id, quellkennung }) },
              verwirf: async (id) => (await verwirfQuelle({ library: libVon, libraryId: e.vonLibraryId, userEmail, provider: providerVon, sourceId: id })).klaerOrdner,
              adresseInZiel: (pfad) => (slugNach === null ? null : baueAdresse({ slug: slugNach, pfad })),
              jetzt: () => new Date().toISOString(),
            }
            const ergebnis = await uebergibFamilie({
              von: { libraryId: e.vonLibraryId, libraryName: libVon.label, provider: providerVon },
              nach: { libraryId: e.nachLibraryId, libraryName: libNach.label, provider: providerNach },
              sourceId, zielOrdnerId, herkunft: e.herkunft, vorschau: e.vorschau === true,
            }, ports)
            return jsonResult({
              ...ergebnis,
              hinweis: ergebnis.vorschau
                ? 'Nur Plan — mit vorschau: false ausfuehren.'
                : 'Danach in beiden Libraries abdeckung_scannen (Teilbaum); in B index_aktualisieren mit der neuen sourceId.',
            })
          },
        )
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
