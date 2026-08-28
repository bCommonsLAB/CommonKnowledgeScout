/**
 * @fileoverview Storage-Werkzeug: `verschieben` (Welle ST4).
 *
 * @description
 * Deckt Umbenennen mit ab (gleicher Elternordner, neuer Name). Kennt
 * bewusst KEINE Twin-Familien (Anforderungen §4): Die Familien-Regel
 * (Quelle und `_`-Ordner ziehen gemeinsam um) bleibt in `familie_umziehen`
 * eine Ebene darueber und ruft diese Schicht auf.
 *
 * @module mcp/storage
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { BEGRUENDUNG, mitProtokoll } from '../protokoll'
import { LIBRARY_ID, jsonResult, mcpUserEmail, requireLibrary, requireProvider } from '../tool-shared'
import { storageFehler } from './fehler'
import { loeseAdresse, normalisiere } from './adressierung'
import { ordnerSicherstellen, trenne } from './pfad-helfer'
import { pruefeSchreibschutz } from './schreibschutz'

export function registerStorageVerschiebenTool(server: McpServer): void {
  server.registerTool(
    'verschieben',
    {
      title: 'Verschieben oder umbenennen (SCHREIBT)',
      description:
        'Verschiebt eine Datei oder einen Ordner; gleicher Elternordner + neuer Name = Umbenennen. ' +
        'Kennt KEINE Twin-Familien — Quelle und "_"-Ordner gemeinsam umzuziehen ist Aufgabe von ' +
        'familie_umziehen eine Ebene darueber. `ueberschreiben` ist per Vorgabe false. ' +
        'Nur nach Bestaetigung durch den Menschen.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        von: z.string().min(1).describe('Library-relativer Quellpfad'),
        nach: z.string().min(1).describe('Library-relativer Zielpfad inkl. neuem Namen'),
        ueberschreiben: z.boolean().optional().describe('Vorgabe false'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ libraryId, von, nach, ueberschreiben, begruendung }) => {
      try {
        return await mitProtokoll(
          { werkzeug: 'verschieben', libraryId, akteur: mcpUserEmail(), begruendung, pfad: von },
          async () => {
            const userEmail = mcpUserEmail()
            await requireLibrary(userEmail, libraryId)
            const provider = await requireProvider(userEmail, libraryId)

            // Welle ST5, Sicherheitsluecke (Cowork-Befund 28.08.2026): Bis
            // hierher pruefte `verschieben` den Schreibschutz NICHT. Damit
            // liess sich der Riegel in zwei Schritten umgehen — und mit
            // `ueberschreiben: true` sogar eine fremde _INDEX.md samt
            // Bearbeitungsstand ersetzen, ohne ifVersion, ohne Schutzstufen
            // und ohne dass ein Coverage-Befund entsteht. Geprueft wird
            // BEIDES: das Ziel (dorthin wuerde geschrieben) und die Quelle
            // (das Wegbenennen einer _INDEX.md war der Umweg von heute).
            pruefeSchreibschutz(nach, 'verschieben_ziel')
            pruefeSchreibschutz(von, 'verschieben_ziel')

            // Quelle darf Datei ODER Ordner sein.
            let quelle
            try {
              quelle = await loeseAdresse({ provider, pfad: von, erwartet: 'file' })
            } catch {
              quelle = await loeseAdresse({ provider, pfad: von, erwartet: 'folder' })
            }

            const { eltern, name } = trenne(nach)
            const zielOrdnerId = await ordnerSicherstellen(provider, eltern, false)

            const kollision = (await provider.listItemsById(zielOrdnerId))
              .find((k) => k.metadata.name === name)
            if (kollision && ueberschreiben !== true) {
              throw new Error(
                `Am Ziel "${normalisiere(nach)}" liegt bereits etwas (id ${kollision.id}) — ` +
                'nichts verschoben. Anderen Namen waehlen oder ueberschreiben: true setzen.',
              )
            }

            // Reihenfolge: erst umziehen, dann umbenennen. Andersherum
            // koennte der neue Name im ALTEN Ordner kollidieren.
            const zielEltern = eltern ? zielOrdnerId : 'root'
            const quellEltern = (await provider.getItemById(quelle.id)).parentId
            if (quellEltern !== zielEltern) await provider.moveItem(quelle.id, zielEltern)
            if (quelle.name !== name) await provider.renameItem(quelle.id, name)

            const danach = await provider.getItemById(quelle.id)
            return jsonResult({
              von: quelle.pfad, nach: normalisiere(nach),
              id: danach.id,
              ...(danach.id === quelle.id ? {} : { idGeaendert: { alt: quelle.id, neu: danach.id } }),
              hinweis: 'Twin-Familien werden hier NICHT mitgezogen — dafuer familie_umziehen.',
            })
          },
        )
      } catch (error) {
        return storageFehler(error)
      }
    },
  )
}
