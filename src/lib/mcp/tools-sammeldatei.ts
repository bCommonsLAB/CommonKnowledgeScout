/**
 * @fileoverview MCP-Werkzeuge `sammeldatei_anlegen`, `sammeldatei_pruefen`, `abhaengige_dokumente` (Welle E).
 *
 * @description
 * Einheiten bilden (Station 3 des Veranstaltungs-Plans): eine Sammeldatei
 * aus Quellen anlegen — derselbe Weg wie der Knopf „Sammel-Transkript"
 * (`buildCompositeReference`), mit Pruefung, dass jede Quelle existiert und
 * ein Transkript hat; eine bestehende Sammeldatei pruefen (derselbe
 * Nur-Pruefen-Modus wie vor `transformation_starten`); und nach einer
 * Korrektur die Sammeldateien finden, die eine Quelle enthalten (eine
 * Mongo-Abfrage ueber `compositeSources`, Owner 08.10.). Die Zuordnung der
 * Einheiten bleibt beim Menschen — die Bruecke schreibt nur, was er nennt.
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { buildCompositeReference, resolveCompositeTranscript } from '@/lib/creation/composite-transcript'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { getShadowTwinsBySourceIds } from '@/lib/repositories/shadow-twin-repo'
import { abhaengigeSammeldateien, korrekturStandDerQuelle, transformationenGegenStand } from '@/lib/shadow-twin/sammeldatei-abhaengigkeit'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'
import { ergaenzeSammeldateiFrontmatter } from './sammeldatei-frontmatter'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary, requireProvider, resolveScope } from './tool-shared'
import { resolveSourceItem, standardLlmModell, standardTemplate } from './tools-erschliessen-shared'
import { starteMarkdownTransformation } from './transformation-markdown'

const QUELLE = {
  sourceId: z.string().min(1).optional().describe('Storage-Id der Datei'),
  pfad: z.string().min(1).optional().describe('ALTERNATIVE: library-relativer Pfad der Datei'),
}

export function registerSammeldateiTools(server: McpServer): void {
  server.registerTool(
    'sammeldatei_anlegen',
    {
      title: 'Sammeldatei aus Quellen anlegen (SCHREIBT)',
      description:
        'Legt eine Sammeldatei (kind: composite-transcript, _source_files, _media_files) im Ordner an — ' +
        'derselbe Weg wie der Knopf „Sammel-Transkript" im UI. Vorher wird geprueft, dass jede Quelle ' +
        'existiert und ein Transkript hat (sonst Fehler mit Dateinamen, nichts geschrieben); ein ' +
        'vorhandener Dateiname wird nicht ueberschrieben. Mit transformieren: true startet danach ' +
        'transformation_starten (Vorlage: vorlage oder Standard der Library). Die Zuordnung, welche ' +
        'Quellen eine Einheit bilden, entscheidet der Mensch. SCHREIBT; nur nach Bestaetigung.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        dateiname: z.string().min(1).max(200).describe('Dateiname der Sammeldatei, endet auf .md'),
        quellenIds: z.array(z.string().min(1)).min(1).max(30).describe('Storage-Ids der Quellen (Audio, PDF, Markdown …) in Reihenfolge'),
        ordner: z.string().min(1).optional().describe('Ordnerpfad fuer die Sammeldatei; weglassen = Ordner der ersten Quelle'),
        ordnerId: z.string().min(1).optional().describe('ALTERNATIVE: Storage-Id des Ordners'),
        medien: z.array(z.string().min(1)).max(50).optional().describe('Zusaetzliche _media_files (Dateinamen relativ zum Ordner, z. B. Flyer-Bilder)'),
        titel: z.string().max(200).optional(),
        includeSelf: z.boolean().optional().describe('true = eigener Text der Sammeldatei geht als Quelle mit (_include_self)'),
        zielsprache: z.string().min(2).max(5).optional().describe('Default de'),
        transformieren: z.boolean().optional().describe('true = direkt transformation_starten anstossen'),
        vorlage: z.string().min(1).optional().describe('Vorlage fuer die Transformation; weglassen = Standard-Template der Library'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false },
    },
    async ({ libraryId, dateiname, quellenIds, ordner, ordnerId, medien, titel, includeSelf, zielsprache, transformieren, vorlage, begruendung }) => {
      try {
        return await mitProtokoll({ werkzeug: 'sammeldatei_anlegen', libraryId, akteur: mcpUserEmail(), begruendung, pfad: ordner }, async () => {
          if (!/\.md$/i.test(dateiname)) throw new Error(`dateiname "${dateiname}" muss auf .md enden`)
          const userEmail = mcpUserEmail()
          const library = await requireLibrary(userEmail, libraryId)
          const provider = await requireProvider(userEmail, libraryId)
          const sourceItems: Array<{ id: string; name: string; parentId: string }> = []
          for (const id of quellenIds) {
            const item = await provider.getItemById(id)
            if (!item || item.type !== 'file') throw new Error(`Quelle ${id} ist keine Datei oder existiert nicht`)
            sourceItems.push({ id: item.id, name: item.metadata.name, parentId: item.parentId })
          }
          const targetLanguage = zielsprache ?? 'de'
          const referenz = await buildCompositeReference({ libraryId, userEmail, targetLanguage, sourceItems, library })
          if (referenz.missingTranscripts.length > 0) {
            throw new Error(`Quellen ohne Transkript: ${referenz.missingTranscripts.join(', ')} — zuerst quelle_erschliessen. Nichts geschrieben.`)
          }
          const folderId = (await resolveScope({ userEmail, libraryId, folderId: ordnerId, pfad: ordner })) ?? sourceItems[0].parentId
          const vorhanden = (await provider.listItemsById(folderId)).find((i) => i.type === 'file' && i.metadata.name.toLowerCase() === dateiname.toLowerCase())
          if (vorhanden) throw new Error(`"${dateiname}" gibt es in diesem Ordner schon (${vorhanden.id}) — anderen Namen waehlen oder sammeldatei_pruefen`)
          const markdown = ergaenzeSammeldateiFrontmatter(referenz.markdown, { titel, includeSelf, medien })
          const datei = await provider.uploadFile(folderId, new File([markdown], dateiname, { type: 'text/markdown' }))
          let transformation: { jobId: string } | null = null
          if (transformieren) {
            transformation = await starteMarkdownTransformation({
              libraryId, userEmail, provider, source: { itemId: datei.id, parentId: folderId, name: dateiname },
              template: vorlage ?? standardTemplate(library), llmModel: standardLlmModell(library), zielsprache: targetLanguage,
            })
          }
          return jsonResult({
            sourceId: datei.id, name: dateiname, ordnerId: folderId, quellen: referenz.sourceFileNames,
            medienErkannt: referenz.mediaFiles.length, medienErgaenzt: medien ?? [],
            transformation,
            hinweis: transformation
              ? 'Transformation laeuft (job_status). Die Abhaengigkeit Sammeldatei → Quellen vermerkt der Job am Twin; danach findet abhaengige_dokumente sie.'
              : 'Angelegt, nicht transformiert. Die Abhaengigkeit Sammeldatei → Quellen wird beim ersten Transformationslauf vermerkt.',
          })
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    'sammeldatei_pruefen',
    {
      title: 'Sammeldatei pruefen (liest nur)',
      description:
        'Prueft eine bestehende Sammeldatei: sind alle _source_files am Pfad vorhanden und haben ein ' +
        'Transkript (derselbe Nur-Pruefen-Modus wie vor transformation_starten), ist die Abhaengigkeit ' +
        'am Twin vermerkt, welche Transformationen haengen daran. Meldet fehlende Quellen mit Namen. Liest nur.',
      inputSchema: { libraryId: LIBRARY_ID, ...QUELLE, zielsprache: z.string().min(2).max(5).optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ libraryId, sourceId, pfad, zielsprache }) => {
      try {
        const userEmail = mcpUserEmail()
        await requireLibrary(userEmail, libraryId)
        const provider = await requireProvider(userEmail, libraryId)
        const source = await resolveSourceItem(provider, sourceId, pfad)
        const markdown = await (await provider.getBinary(source.itemId)).blob.text()
        const { meta } = parseFrontmatter(markdown)
        if (meta['kind'] !== 'composite-transcript') throw new Error(`"${source.name}" ist keine Sammeldatei (kind: composite-transcript fehlt)`)
        const { unresolvedSources, sourceIds } = await resolveCompositeTranscript({
          libraryId, userEmail, targetLanguage: zielsprache ?? 'de', compositeMarkdown: markdown,
          parentId: source.parentId, compositeFileName: source.name, compositeSourceId: source.itemId, nurQuellenPruefen: true,
        })
        const doc = (await getShadowTwinsBySourceIds({ libraryId, sourceIds: [source.itemId] })).get(source.itemId)
        return jsonResult({
          sourceId: source.itemId, name: source.name,
          quellen: Array.isArray(meta['_source_files']) ? meta['_source_files'] : [],
          aufgeloest: sourceIds.length, fehlend: unresolvedSources,
          abhaengigkeitVermerkt: Array.isArray(doc?.compositeSources),
          transformationen: doc ? transformationenGegenStand(doc, null) : [],
          ok: unresolvedSources.length === 0,
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    'abhaengige_dokumente',
    {
      title: 'Sammeldateien, die eine Quelle enthalten (liest nur)',
      description:
        'Nach einer Korrektur am Transkript einer Quelle: welche Sammeldateien enthalten sie, je mit ' +
        'Vorlage, Sprache und Befund ueberholt (Transformation aelter als revised_at der Quelle). Eine ' +
        'Mongo-Abfrage ueber compositeSources — gefunden werden Sammeldateien, die seit Welle E einmal ' +
        'transformiert wurden; aeltere einmal mit transformation_starten erzwingen nachziehen. Liest nur.',
      inputSchema: { libraryId: LIBRARY_ID, ...QUELLE },
      annotations: { readOnlyHint: true },
    },
    async ({ libraryId, sourceId, pfad }) => {
      try {
        const userEmail = mcpUserEmail()
        await requireLibrary(userEmail, libraryId)
        const provider = await requireProvider(userEmail, libraryId)
        const source = await resolveSourceItem(provider, sourceId, pfad)
        const revisedAt = await korrekturStandDerQuelle(libraryId, source.itemId)
        const abhaengige = await abhaengigeSammeldateien({ libraryId, sourceId: source.itemId, revisedAt })
        return jsonResult({
          sourceId: source.itemId, name: source.name, korrigiertAm: revisedAt,
          sammeldateien: abhaengige, ueberholt: abhaengige.filter((a) => a.ueberholt).length,
          hinweis: abhaengige.length === 0
            ? 'Keine Sammeldatei mit vermerkter Abhaengigkeit. Sammeldateien, die vor Welle E zuletzt transformiert wurden, tragen das Feld noch nicht.'
            : 'Ueberholte Sammeldateien mit transformation_starten (erzwingen entscheidet der Server) erneuern.',
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
