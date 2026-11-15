/**
 * @fileoverview MCP-Werkzeug `sitzungen_auflisten` (Plan sitzungen-register, R1). Liest nur.
 *
 * @description
 * Die Gegenkontrolle: jede Zeile des Sitzungs-Registers mit gerechnetem Stand
 * (`uebersprungen` > `berichtet` > `notiz` > `beleg` > `gemeldet`) und
 * Hinweisen, dazu Belege mit Notiz, die das Register noch nicht kennt
 * (`gespeichert: false` — gespeichert werden sie erst vom naechsten
 * schreibenden Sichten-Lauf, W3). Liest MongoDB; den Speicher nur fuer die
 * wenigen bekannten Belege ohne Notiz.
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { bilanz, filtereSitzungen, sortiereSitzungen } from '@/lib/agent-view/sitzungen-register/filter'
import { ladeRegisterSicht, type ItemLesen } from '@/lib/agent-view/sitzungen-register/ist-laden'
import { AUFFAELLIGKEITEN, SITZUNGS_QUELLEN, STAENDE } from '@/lib/agent-view/sitzungen-register/types'
import type { StorageProvider } from '@/lib/storage/types'
import { ARCHIVPFLEGE_HINWEIS, pruefeArchivpflege } from './archivpflege'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary, requireProvider } from './tool-shared'

const ISO_TAG = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'JJJJ-MM-TT')

export function registerSitzungenAuflistenTool(server: McpServer): void {
  server.registerTool(
    'sitzungen_auflisten',
    {
      title: 'Sitzungs-Register mit gerechnetem Stand',
      description:
        ARCHIVPFLEGE_HINWEIS +
        'Listet die Arbeitssitzungen mit Claude aus dem Sitzungs-Register, je Zeile mit gerechnetem Stand ' +
        '(uebersprungen > berichtet > notiz > beleg > gemeldet), Hinweisen (doppelt, beleg_fehlt, beleg_ohne_vorhaben, ' +
        'kennung_abweichend, …), Belegen und Vorhaben (aus dem Cache der Sichten-Laeufe; vorhabenBestimmt false = noch ' +
        'nicht geprueft). Belege mit Notiz ohne Register-Zeile erscheinen mit gespeichert: false. Filter: stand, ' +
        'quelle, vorhaben (Pfad samt Unterordnern oder folderId), von/bis (beginn; Zeilen ohne beginn fallen heraus), ' +
        'auffaellig (gemeldet_ohne_beleg braucht seitTagen). zusammenfassung: true liefert nur die Bilanz je Stand, ' +
        'Quelle und Auffaelligkeit. Juengste zuerst. Liest nur.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        stand: z.array(z.enum(STAENDE)).optional(),
        quelle: z.array(z.enum(SITZUNGS_QUELLEN)).optional(),
        vorhaben: z.string().trim().min(1).optional(),
        von: ISO_TAG.optional(),
        bis: ISO_TAG.optional(),
        auffaellig: z.enum(AUFFAELLIGKEITEN).optional(),
        seitTagen: z.number().int().min(0).optional().describe('Pflicht bei auffaellig gemeldet_ohne_beleg'),
        zusammenfassung: z.boolean().optional().describe('true = nur Bilanz, keine Zeilen'),
        seite: z.number().int().min(1).optional().describe('1-basiert, Vorgabe 1'),
        proSeite: z.number().int().min(1).max(200).optional().describe('Vorgabe 50'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ libraryId, zusammenfassung, seite, proSeite, ...filter }) => {
      try {
        const userEmail = mcpUserEmail()
        const library = await requireLibrary(userEmail, libraryId)
        pruefeArchivpflege(library, 'sitzungen_auflisten')
        if (filter.auffaellig === 'gemeldet_ohne_beleg' && filter.seitTagen === undefined) {
          throw new Error('auffaellig gemeldet_ohne_beleg braucht seitTagen')
        }
        // Der Speicher wird nur gebraucht, wenn das Register Belege ohne Notiz kennt.
        let provider: StorageProvider | null = null
        const itemLesen: ItemLesen = async (sourceId) => {
          const p = provider ?? (provider = await requireProvider(userEmail, libraryId))
          const item = await p.getItemById(sourceId)
          return { id: item.id, parentId: item.parentId, name: item.metadata.name }
        }
        const jetzt = new Date()
        const sicht = await ladeRegisterSicht({ libraryId: library.id, itemLesen, jetzt: jetzt.toISOString() })
        const gefiltert = sortiereSitzungen(filtereSitzungen(sicht.zeilen, filter, jetzt))
        if (zusammenfassung === true) {
          return jsonResult({ bilanz: bilanz(gefiltert), imSpeicherGeprueft: sicht.imSpeicherGeprueft })
        }
        const s = seite ?? 1
        const n = proSeite ?? 50
        return jsonResult({
          gesamt: gefiltert.length,
          seite: s,
          proSeite: n,
          imSpeicherGeprueft: sicht.imSpeicherGeprueft,
          nichtGespeichert: gefiltert.filter((z) => !z.gespeichert).length,
          zeilen: gefiltert.slice((s - 1) * n, s * n),
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
