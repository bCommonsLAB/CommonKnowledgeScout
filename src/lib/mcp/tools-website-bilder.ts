/**
 * @fileoverview MCP-Werkzeuge: `bild_veroeffentlichen`, `bilder_auflisten` (B3).
 *
 * @description
 * Schliesst Station 4 des Website-Wegs: Bilder aus dem auth-gegateten
 * Library-Storage (Vorgabe `web/images/`) in den oeffentlichen Blob legen
 * und die anonyme URL zurueckgeben — ohne lokales Skript. Nicht-Bilder
 * werden laut uebersprungen; ein vorhandener Blob wird nur mit
 * `ueberschreiben: true` ersetzt.
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'
import {
  bildContentType, listeWebsiteBilder, veroeffentlicheWebsiteBild, websiteBildZiel,
} from '@/lib/services/website-image-blob'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary, requireProvider } from './tool-shared'
import { resolveFolderIdByPath, resolveItemByPath } from './resolve-folder'

const ORDNER_VORGABE = 'web/images'
/** Grenze wie datei_binaer_anlegen (Stufe 1). */
const MAX_BYTES = 6 * 1024 * 1024

interface Zeile {
  dateiname: string
  url?: string
  bytes?: number
  vorhanden?: boolean
  uebersprungen?: string
  fehler?: string
}

async function quellen(provider: StorageProvider, quellPfad?: string, ordnerPfad?: string): Promise<StorageItem[]> {
  if (quellPfad && ordnerPfad) throw new Error('Entweder quellPfad ODER ordnerPfad — nicht beides')
  if (quellPfad) {
    const item = await resolveItemByPath(provider, quellPfad, 'file')
    return [await provider.getItemById(item.id)]
  }
  const ordnerId = await resolveFolderIdByPath(provider, ordnerPfad ?? ORDNER_VORGABE)
  return (await provider.listItemsById(ordnerId)).filter((i) => i.type === 'file')
}

export function registerWebsiteBilderTools(server: McpServer): void {
  server.registerTool(
    'bild_veroeffentlichen',
    {
      title: 'Website-Bilder in den oeffentlichen Blob legen (SCHREIBT)',
      description:
        'Kopiert Bilder aus dem Library-Storage in den anonym lesbaren Blob ' +
        '(<libraryId>/website/images/<dateiname>) und gibt die URLs zurueck, die in hero_image und ' +
        'Sektions-Bildern stehen muessen. Ohne Angabe alle Bilddateien aus `web/images/`; `quellPfad` ' +
        'fuer eine Datei, `ordnerPfad` fuer einen anderen Ordner. Nicht-Bilder (HTML, PDF) werden ' +
        'laut uebersprungen, Dateien ueber 6 MB abgewiesen. Ein vorhandener Blob bleibt, bis ' +
        '`ueberschreiben: true` gesetzt ist. Nur nach Bestaetigung durch den Menschen.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        quellPfad: z.string().min(1).optional().describe('Eine Bilddatei, library-relativ'),
        ordnerPfad: z.string().min(1).optional().describe(`Ordner mit Bildern (Vorgabe ${ORDNER_VORGABE})`),
        ueberschreiben: z.boolean().optional().describe('true = vorhandene Blobs ersetzen (Vorgabe false)'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false },
    },
    async ({ libraryId, quellPfad, ordnerPfad, ueberschreiben, begruendung }) => {
      try {
        return await mitProtokoll(
          { werkzeug: 'bild_veroeffentlichen', libraryId, akteur: mcpUserEmail(), begruendung, pfad: quellPfad ?? ordnerPfad ?? ORDNER_VORGABE },
          async () => {
            const userEmail = mcpUserEmail()
            await requireLibrary(userEmail, libraryId)
            const provider = await requireProvider(userEmail, libraryId)
            const ziel = websiteBildZiel(libraryId)
            const items = await quellen(provider, quellPfad, ordnerPfad)
            if (items.length === 0) throw new Error(`Keine Dateien in "${quellPfad ?? ordnerPfad ?? ORDNER_VORGABE}"`)

            const zeilen: Zeile[] = []
            for (const item of items) {
              const dateiname = item.metadata.name
              try {
                if (!bildContentType(dateiname)) {
                  zeilen.push({ dateiname, uebersprungen: 'kein bekanntes Bildformat' })
                  continue
                }
                if (item.metadata.size > MAX_BYTES) {
                  zeilen.push({ dateiname, uebersprungen: `${item.metadata.size} Bytes — Grenze ${MAX_BYTES}` })
                  continue
                }
                const { blob } = await provider.getBinary(item.id)
                const buffer = Buffer.from(await blob.arrayBuffer())
                zeilen.push(await veroeffentlicheWebsiteBild({ ziel, dateiname, buffer, ueberschreiben: ueberschreiben === true }))
              } catch (error) {
                zeilen.push({ dateiname, fehler: error instanceof Error ? error.message : String(error) })
              }
            }
            return jsonResult({
              zeilen,
              veroeffentlicht: zeilen.filter((z) => z.url && z.vorhanden === false).length,
              vorhanden: zeilen.filter((z) => z.vorhanden === true).length,
              uebersprungen: zeilen.filter((z) => z.uebersprungen).length,
              gescheitert: zeilen.filter((z) => z.fehler).length,
              hinweis: 'Die URLs in hero_image bzw. ![alt](url) der Seiten eintragen und mit dokument_publizieren neu publizieren.',
            })
          },
        )
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    'bilder_auflisten',
    {
      title: 'Website-Bilder im Blob auflisten (liest nur)',
      description:
        'Listet die im oeffentlichen Blob liegenden Website-Bilder der Library mit URL und Groesse — ' +
        'die Kandidaten fuer hero_image und Sektions-Bilder. Liest nur.',
      inputSchema: { libraryId: LIBRARY_ID },
      annotations: { readOnlyHint: true },
    },
    async ({ libraryId }) => {
      try {
        await requireLibrary(mcpUserEmail(), libraryId)
        const bilder = await listeWebsiteBilder(websiteBildZiel(libraryId))
        return jsonResult({ anzahl: bilder.length, bilder })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
