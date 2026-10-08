/**
 * @fileoverview Storage-Werkzeug: `kopieren` (Handover Library-Anlage, W3).
 *
 * @description
 * Kopiert eine Datei oder einen Ordner innerhalb einer Library, ueber das
 * Provider-Interface (lesen + hochladen; das Interface kennt kein natives
 * Kopieren). Gedacht fuer „Rohquellen in einen frischen Ordner" vor dem
 * Neuaufbau einer Library: `nurQuellen` laesst Twin-Ordner und erzeugte
 * Seiten weg (`kopier-plan.ts`), `ausschliessen` nimmt Einzelnes heraus,
 * `vorschau` zeigt den Plan ohne zu schreiben. Grosse Medien laufen gegen
 * die 60-Sekunden-Grenze der Bruecke — daher Obergrenzen und Teilkopien.
 *
 * @module mcp/storage
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { BEGRUENDUNG, mitProtokoll } from '../protokoll'
import { LIBRARY_ID, jsonResult, mcpUserEmail, requireLibrary, requireProvider } from '../tool-shared'
import { loeseAdresse, normalisiere } from './adressierung'
import { storageFehler } from './fehler'
import { waehleImOrdner, type Ausgelassen, type PlanEintrag } from './kopier-plan'
import { ordnerSicherstellen, trenne } from './pfad-helfer'
import { pruefeSchreibschutz } from './schreibschutz'

const MAX_DATEIEN = 300
const MAX_MB = 250

export function registerStorageKopierenTool(server: McpServer): void {
  server.registerTool(
    'kopieren',
    {
      title: 'Datei oder Ordner kopieren (SCHREIBT)',
      description:
        'Kopiert eine Datei oder einen Ordner (rekursiv) innerhalb der Library nach `nach` (Zielpfad inkl. Name; ' +
        'Elternordner muss existieren, das Ziel darf NICHT existieren). Twin-Ordner (_…) kommen nie mit; ' +
        'nurQuellen: true laesst zusaetzlich test/-Ordner und erzeugte Seiten einer Quelle (<Quelle>.<…>.md) weg; ausschliessen nimmt Namen oder ' +
        'relative Pfade heraus. vorschau: true zeigt nur den Plan. Twins werden NICHT kopiert — die Kopie ist ' +
        `Rohmaterial, das neu erschlossen wird. Grenzen: ${MAX_DATEIEN} Dateien, ${MAX_MB} MB (60-s-Grenze der ` +
        'Bruecke) — groessere Ordner in Teilen. Fehler je Datei, kein Abbruch. Nur nach Bestaetigung.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        von: z.string().min(1).describe('Library-relativer Quellpfad (Datei oder Ordner)'),
        nach: z.string().min(1).describe('Library-relativer Zielpfad inkl. Name'),
        nurQuellen: z.boolean().optional().describe('test-Ordner und erzeugte Seiten weglassen; Vorgabe false'),
        ausschliessen: z.array(z.string().min(1)).max(100).optional().describe('Namen oder Pfade relativ zu `von`'),
        vorschau: z.boolean().optional().describe('nur Plan zeigen, nichts schreiben'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false },
    },
    async ({ libraryId, von, nach, nurQuellen, ausschliessen, vorschau, begruendung }) => {
      try {
        return await mitProtokoll(
          { werkzeug: 'kopieren', libraryId, akteur: mcpUserEmail(), begruendung, pfad: von, ...(vorschau ? { modus: 'vorschau' as const } : {}) },
          async () => {
            const userEmail = mcpUserEmail()
            await requireLibrary(userEmail, libraryId)
            const provider = await requireProvider(userEmail, libraryId)
            pruefeSchreibschutz(nach, 'anlegen')

            let quelle
            try {
              quelle = await loeseAdresse({ provider, pfad: von, erwartet: 'file' })
            } catch {
              quelle = await loeseAdresse({ provider, pfad: von, erwartet: 'folder' })
            }
            const { eltern, name } = trenne(nach)
            const zielElternId = await ordnerSicherstellen(provider, eltern, false)
            const kollision = (await provider.listItemsById(zielElternId)).find((k) => k.metadata.name === name)
            if (kollision) throw new Error(`Am Ziel "${normalisiere(nach)}" liegt bereits etwas (id ${kollision.id}) — nichts kopiert`)

            // Plan: Ordner in Breitensuche, je Ebene dieselbe Auswahlregel.
            const dateien: Array<PlanEintrag & { id: string }> = []
            const ordner: string[] = []
            const ausgelassen: Ausgelassen[] = []
            if (quelle.typ === 'file') {
              const item = await provider.getItemById(quelle.id)
              dateien.push({ relativ: name, name, typ: 'file', groesse: item.metadata.size, id: quelle.id })
            } else {
              const offen: Array<{ id: string; relativ: string }> = [{ id: quelle.id, relativ: '' }]
              while (offen.length > 0) {
                const { id, relativ } = offen.shift() as { id: string; relativ: string }
                const kinder = await provider.listItemsById(id)
                const wahl = waehleImOrdner({
                  eltern: relativ, nurQuellen: nurQuellen === true, ausschliessen: ausschliessen ?? [],
                  eintraege: kinder.map((k) => ({ name: k.metadata.name, typ: k.type, groesse: k.metadata.size ?? 0 })),
                })
                ausgelassen.push(...wahl.ausgelassen)
                for (const eintrag of wahl.nehmen) {
                  const kind = kinder.find((k) => k.metadata.name === eintrag.name) as (typeof kinder)[number]
                  if (eintrag.typ === 'folder') {
                    ordner.push(eintrag.relativ)
                    offen.push({ id: kind.id, relativ: eintrag.relativ })
                  } else {
                    dateien.push({ ...eintrag, id: kind.id })
                  }
                }
              }
            }
            const megabyte = Math.round(dateien.reduce((summe, d) => summe + d.groesse, 0) / 1e5) / 10
            const plan = {
              von: quelle.pfad, nach: normalisiere(nach), ordner: ordner.length, dateien: dateien.length, megabyte,
              ausgelassen,
            }
            if (dateien.length > MAX_DATEIEN || megabyte > MAX_MB) {
              throw new Error(`Zu gross fuer einen Aufruf (${dateien.length} Dateien, ${megabyte} MB; Grenze ${MAX_DATEIEN} / ${MAX_MB} MB) — Unterordner einzeln kopieren`)
            }
            if (vorschau) return jsonResult({ vorschau: true, ...plan, dateiListe: dateien.map((d) => d.relativ) })

            // Ausfuehren: Zielordner, Unterordner in Planreihenfolge, dann Dateien.
            const ordnerIds = new Map<string, string>()
            if (quelle.typ === 'folder') {
              ordnerIds.set('', (await provider.createFolder(zielElternId, name)).id)
              for (const relativ of ordner) {
                const { eltern: e, name: n } = trenne(relativ)
                ordnerIds.set(relativ, (await provider.createFolder(ordnerIds.get(e) as string, n)).id)
              }
            }
            const zeilen: Array<{ datei: string; id?: string; fehler?: string }> = []
            for (const datei of dateien) {
              try {
                const zielOrdner = quelle.typ === 'file' ? zielElternId : (ordnerIds.get(trenne(datei.relativ).eltern) as string)
                const { blob, mimeType } = await provider.getBinary(datei.id)
                const angelegt = await provider.uploadFile(zielOrdner, new File([blob], datei.name, { type: mimeType }))
                zeilen.push({ datei: datei.relativ, id: angelegt.id })
              } catch (error) {
                zeilen.push({ datei: datei.relativ, fehler: error instanceof Error ? error.message : String(error) })
              }
            }
            return jsonResult({
              ...plan,
              kopiert: zeilen.filter((z) => z.id).length,
              gescheitert: zeilen.filter((z) => z.fehler).length,
              zeilen: zeilen.filter((z) => z.fehler),
              hinweis: 'Kopie ohne Twins — die Quellen neu erschliessen (quelle_erschliessen).',
            })
          },
        )
      } catch (error) {
        return storageFehler(error)
      }
    },
  )
}
