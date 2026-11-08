/**
 * @fileoverview MCP-Werkzeug `sitzungen_block_schreiben` (Plan sitzungen-sichten-und-befunde, S1).
 *
 * @description
 * Schreibt in jedes `BERICHT.md` des Scopes, dessen Vorhaben Sitzungsnotizen
 * (Transformationen der Vorlage `chatverlauf-de`) hat, den Block
 * „### Sitzungen mit Claude (erzeugt)" zwischen `<!-- sitzungen:start/end -->`.
 * Der Rest des Berichts bleibt byteidentisch. Ein handgeschriebener Block
 * „(nachgetragen …)" wird NUR mit `alteBloeckeUebernehmen` ersetzt, sonst als
 * Befund gemeldet (Owner-Entscheid E2, 08.11.2026). Scope per folderId/pfad;
 * Belege ausserhalb der gescannten Ordner werden gezaehlt, nicht geraten.
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ArchiveFolderNode } from '@/lib/agent-view/archive-types'
import { berichteScan } from '@/lib/agent-view/sichten/regenerate-sichten'
import { sitzungenBlock } from '@/lib/agent-view/sichten/sitzungen-render'
import { elternVonProvider, ordneSitzungenZu } from '@/lib/agent-view/sichten/sitzungen-sammeln'
import { SITZUNGS_SPRACHE, SITZUNGS_VORLAGE, type SitzungsDatensatz } from '@/lib/agent-view/sichten/sitzungen-types'
import { isoHeute } from '@/lib/agent-view/sichten/types'
import { berichtMitSitzungenBlock, type AlterBlockStatus } from '@/lib/agent-view/sitzungen-block'
import { findeTransformationenNachVorlage } from '@/lib/repositories/shadow-twin-transformationen'
import type { StorageProvider } from '@/lib/storage/types'
import { ersetzeTextDatei } from '@/lib/storage/update-text-file'
import { ARCHIVPFLEGE_HINWEIS, pruefeArchivpflege } from './archivpflege'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'
import { FOLDER_ID, LIBRARY_ID, SCOPE_PFAD, errorResult, jsonResult, mcpUserEmail, requireLibrary, requireProvider, resolveScope } from './tool-shared'

type BerichtStatus = 'vorschau' | 'geschrieben' | 'unveraendert' | 'befund' | 'kein_bericht'

interface BerichtZeile {
  pfad: string
  folderId: string
  sitzungen: number
  status: BerichtStatus
  alterBlock: AlterBlockStatus | null
  alteUeberschrift: string | null
  block?: string
}

/** Ein Vorhaben abarbeiten: Block rendern, Bericht lesen, ersetzen, schreiben. */
async function berichtSchreiben(args: {
  provider: StorageProvider
  folder: ArchiveFolderNode
  sitzungen: SitzungsDatensatz[]
  heute: string
  nurVorschau: boolean
  alteBloeckeUebernehmen: boolean
}): Promise<BerichtZeile> {
  const { folder } = args
  const pfad = folder.path || '(Scope-Wurzel)'
  const basis = { pfad, folderId: folder.folderId, sitzungen: args.sitzungen.length, alterBlock: null, alteUeberschrift: null }
  if (!folder.bericht) return { ...basis, status: 'kein_bericht' }
  const block = sitzungenBlock(args.sitzungen, args.heute)
  if (args.nurVorschau) return { ...basis, status: 'vorschau', block }
  const { blob } = await args.provider.getBinary(folder.bericht.fileId)
  const text = await blob.text()
  const e = berichtMitSitzungenBlock(text, block, args.alteBloeckeUebernehmen)
  const zeile = { ...basis, alterBlock: e.alterBlock, alteUeberschrift: e.alteUeberschrift }
  if (e.text === text) return { ...zeile, status: e.alterBlock === 'belassen' ? 'befund' : 'unveraendert' }
  // Welle ST1: an Ort und Stelle — der Bericht behaelt seine itemId.
  await ersetzeTextDatei({ provider: args.provider, fileId: folder.bericht.fileId, inhalt: e.text })
  return { ...zeile, status: 'geschrieben' }
}

export function registerSitzungenTool(server: McpServer): void {
  server.registerTool(
    'sitzungen_block_schreiben',
    {
      title: 'Sitzungen-Block in BERICHT.md (SCHREIBT)',
      description:
        ARCHIVPFLEGE_HINWEIS +
        'Schreibt je BERICHT.md im Scope den Block "### Sitzungen mit Claude (erzeugt)" zwischen ' +
        '<!-- sitzungen:start/end --> neu: eine Zeile je Sitzungsnotiz (Vorlage chatverlauf-de in MongoDB), ' +
        'chronologisch, mit Wikilink auf den Beleg und Teaser; der Rest des Berichts bleibt byteidentisch. ' +
        'Ein handgeschriebener Block "### Sitzungen … (nachgetragen …)" wird NUR mit alteBloeckeUebernehmen=true ' +
        'ersetzt, sonst als Befund gemeldet. nurVorschau=true zeigt die Bloecke ohne zu schreiben. ' +
        'Scope per folderId/pfad (Belege ausserhalb der gescannten Ordner werden gezaehlt, nicht zugeordnet); ' +
        'ohne Scope die ganze Library (OneDrive ~20-40 s). SCHREIBT in Berichte (nur den Block); nur nach Bestaetigung.',
      inputSchema: {
        libraryId: LIBRARY_ID, folderId: FOLDER_ID, pfad: SCOPE_PFAD,
        nurVorschau: z.boolean().optional().describe('true = Bloecke nur rendern und zurueckgeben'),
        alteBloeckeUebernehmen: z.boolean().optional()
          .describe('true = handgeschriebene Bloecke "(nachgetragen …)" durch den erzeugten Block ersetzen (Altbestand, einmalig)'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ libraryId, folderId, pfad, nurVorschau, alteBloeckeUebernehmen, begruendung }) => {
      try {
        return await mitProtokoll({
          werkzeug: 'sitzungen_block_schreiben', libraryId, akteur: mcpUserEmail(), begruendung, folderId, pfad,
          modus: nurVorschau === true ? 'vorschau' : undefined,
        }, async () => {
          const userEmail = mcpUserEmail()
          const library = await requireLibrary(userEmail, libraryId)
          pruefeArchivpflege(library, 'sitzungen_block_schreiben')
          const provider = await requireProvider(userEmail, libraryId)
          const scope = await resolveScope({ userEmail, libraryId, folderId, pfad })
          const started = Date.now()
          const { scan, vorhabenMuster } = await berichteScan(library, provider, scope ?? 'root')
          const alleZeilen = await findeTransformationenNachVorlage({ libraryId: library.id, template: SITZUNGS_VORLAGE, language: SITZUNGS_SPRACHE })
          // Im Teilbaum: nur Belege in gescannten Ordnern — alles andere liegt ausserhalb des Scopes oder tiefer.
          const gescannt = new Set(scan.folders.map((f) => f.folderId))
          const zeilen = scope ? alleZeilen.filter((z) => gescannt.has(z.parentId)) : alleZeilen
          const zuordnung = await ordneSitzungenZu({ zeilen, folders: scan.folders, vorhabenMuster, elternVon: elternVonProvider(provider) })
          const jeVorhaben = new Map<string, SitzungsDatensatz[]>()
          for (const s of zuordnung.sitzungen) {
            if (s.vorhabenFolderId !== null) jeVorhaben.set(s.vorhabenFolderId, [...(jeVorhaben.get(s.vorhabenFolderId) ?? []), s])
          }
          const byId = new Map(scan.folders.map((f) => [f.folderId, f]))
          const heute = isoHeute(new Date())
          const berichte: BerichtZeile[] = []
          for (const [vorhabenId, sitzungen] of jeVorhaben) {
            const folder = byId.get(vorhabenId)
            if (!folder) throw new Error(`Vorhabensordner ${vorhabenId} nicht im Scan — Zuordnung inkonsistent`)
            berichte.push(await berichtSchreiben({
              provider, folder, sitzungen, heute,
              nurVorschau: nurVorschau === true, alteBloeckeUebernehmen: alteBloeckeUebernehmen === true,
            }))
          }
          berichte.sort((a, b) => a.pfad.localeCompare(b.pfad, 'de', { numeric: true }))
          const befunde = berichte
            .filter((b) => b.alterBlock === 'belassen')
            .map((b) => `${b.pfad}: handgeschriebener Block „${b.alteUeberschrift}" belassen — mit alteBloeckeUebernehmen=true ersetzen`)
          return jsonResult({
            modus: nurVorschau === true ? 'vorschau' : 'geschrieben', scope: scope ?? '(Library)', dauerMs: Date.now() - started,
            gescannteOrdner: scan.folders.length,
            sitzungen: zuordnung.sitzungen.length,
            ohneVorhaben: zuordnung.sitzungen.filter((s) => s.vorhabenPfad === null).length,
            nichtImScope: alleZeilen.length - zeilen.length,
            berichte,
            geschrieben: berichte.filter((b) => b.status === 'geschrieben').map((b) => b.pfad),
            unveraendert: berichte.filter((b) => b.status === 'unveraendert').map((b) => b.pfad),
            alteBloeckeErsetzt: berichte.filter((b) => b.alterBlock === 'ersetzt').map((b) => b.pfad),
            befunde,
            uebersprungen: zuordnung.uebersprungen,
            hinweise: zuordnung.hinweise,
          })
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
