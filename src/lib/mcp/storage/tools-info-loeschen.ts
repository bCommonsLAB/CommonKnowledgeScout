/**
 * @fileoverview Storage-Werkzeuge: `speicher_info`, `loeschen` (Welle ST4).
 *
 * @description
 * Die beiden gehoeren zusammen, und zwar nicht aus Bequemlichkeit: Ob
 * `loeschen` ueberhaupt angeboten werden darf, haengt an genau der Auskunft,
 * die `speicher_info` gibt.
 *
 * Die Archiv-Grundregel lautet „Geloescht wird nie". Als am 27.08.2026
 * `ORDNUNGSZUSTAND.md` entfernt wurde, war die Rueckmeldung „im Papierkorb,
 * 93 Tage wiederherstellbar" — genau die Zusicherung, die es braucht. Diese
 * Zusicherung gilt aber NICHT ueberall: der Filesystem-Provider loescht hart
 * (`fs.rm`/`fs.unlink`). Deshalb verweigert `loeschen` dort den Papierkorb-
 * Modus, statt eine Wiederherstellbarkeit zu behaupten, die es nicht gibt.
 *
 * @module mcp/storage
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { supportsCapabilities, supportsVersioning } from '@/lib/storage/types'
import { BEGRUENDUNG, mitProtokoll } from '../protokoll'
import { TOOLSET_VERSION } from '../tools-info'
import { LIBRARY_ID, jsonResult, mcpUserEmail, requireLibrary, requireProvider } from '../tool-shared'
import { storageFehler } from './fehler'
import { ADRESSE_ID, ADRESSE_PFAD, loeseAdresse } from './adressierung'
import { MAX_LISTINGS } from './listen'
import { geschuetzteMuster, pruefeSchreibschutz } from './schreibschutz'

export function registerStorageInfoLoeschenTools(server: McpServer): void {
  server.registerTool(
    'speicher_info',
    {
      title: 'Faehigkeiten und Grenzen dieses Speichers',
      description:
        'Selbstauskunft des Speichers hinter dieser Library: Provider, Gross-/Kleinschreibung, ' +
        'Pfad- und Groessenlimits, Papierkorb samt Aufbewahrung, Unicode-Normalisierung, ' +
        'Zeitstempel-Genauigkeit und was diese Schicht unterstuetzt. `null` heisst ausdruecklich ' +
        '„nicht sicher bekannt" — darauf NICHT bauen, sondern die Hinweise lesen. Vor Umlaut- ' +
        'oder Pfadlaengen-kritischen Aktionen zuerst hier nachsehen. Liest nur.',
      inputSchema: { libraryId: LIBRARY_ID },
      annotations: { readOnlyHint: true },
    },
    async ({ libraryId }) => {
      try {
        const userEmail = mcpUserEmail()
        await requireLibrary(userEmail, libraryId)
        const provider = await requireProvider(userEmail, libraryId)

        if (!supportsCapabilities(provider)) {
          throw new Error(
            `Storage-Provider "${provider.name}" gibt keine Selbstauskunft — ` +
            'ohne sie sind Grenzen und Papierkorb unbekannt, und es wird nichts geraten.',
          )
        }
        const faehigkeiten = provider.beschreibeFaehigkeiten()

        return jsonResult({
          ...faehigkeiten,
          // Was der Provider kann, sagt der Provider. Was DIESE SCHICHT
          // daraus macht, sagt die Schicht — sonst behauptete jeder Provider
          // Werkzeuge, die es gar nicht gibt.
          unterstuetzt: {
            patch: supportsVersioning(provider),
            ifVersion: supportsVersioning(provider),
            /** Kein Provider-Delta: `aenderungen_seit` scannt. */
            delta: false,
            /** Bereichsweises Binaerlesen ist noch nicht gebaut. */
            binaer: false,
          },
          grenzen: {
            maxOrdnerListingsProAufruf: MAX_LISTINGS,
            schreibgeschuetzteMuster: geschuetzteMuster(),
          },
          toolsetVersion: TOOLSET_VERSION,
        })
      } catch (error) {
        return storageFehler(error)
      }
    },
  )

  server.registerTool(
    'loeschen',
    {
      title: 'Datei oder Ordner loeschen (SCHREIBT)',
      description:
        'Loescht eine Datei oder einen Ordner. `inPapierkorb` ist per Vorgabe true — hat der ' +
        'Speicher KEINEN Papierkorb (siehe speicher_info), bricht der Aufruf ab, statt eine ' +
        'Wiederherstellbarkeit zu behaupten, die es nicht gibt. Hartes Loeschen nur mit ' +
        'ausdruecklichem endgueltig: true. Fuer Archiv-Quellen gilt „Geloescht wird nie": dort ' +
        'gehoert quelle_verwerfen hin, das nach "zu klaeren/" verschiebt. Nur nach ' +
        'Bestaetigung durch den Menschen.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        pfad: ADRESSE_PFAD,
        id: ADRESSE_ID,
        inPapierkorb: z.boolean().optional().describe('Vorgabe true'),
        endgueltig: z.boolean().optional()
          .describe('Muss true sein, um ohne Papierkorb zu loeschen. Nicht widerrufbar.'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ libraryId, pfad, id, inPapierkorb, endgueltig, begruendung }) => {
      try {
        return await mitProtokoll(
          { werkzeug: 'loeschen', libraryId, akteur: mcpUserEmail(), begruendung, pfad },
          async () => {
            const userEmail = mcpUserEmail()
            await requireLibrary(userEmail, libraryId)
            const provider = await requireProvider(userEmail, libraryId)

            let adresse
            try {
              adresse = await loeseAdresse({ provider, pfad, id, erwartet: 'file' })
            } catch {
              adresse = await loeseAdresse({ provider, pfad, id, erwartet: 'folder' })
            }
            pruefeSchreibschutz(adresse.pfad)

            if (!supportsCapabilities(provider)) {
              throw new Error(
                `Storage-Provider "${provider.name}" gibt keine Selbstauskunft — ` +
                'ob geloeschtes wiederherstellbar waere, ist damit unbekannt. Nichts geloescht.',
              )
            }
            const { papierkorbVorhanden, aufbewahrungTage } = provider.beschreibeFaehigkeiten()

            if (!papierkorbVorhanden && endgueltig !== true) {
              throw new Error(
                `Dieser Speicher hat KEINEN Papierkorb — "${adresse.pfad}" waere sofort und ` +
                'unwiederbringlich weg. Nichts geloescht. Wenn das wirklich gewollt ist: ' +
                'endgueltig: true setzen. Fuer Archiv-Quellen stattdessen quelle_verwerfen ' +
                'verwenden (verschiebt nach "zu klaeren/").',
              )
            }
            if (papierkorbVorhanden && inPapierkorb === false && endgueltig !== true) {
              throw new Error(
                'inPapierkorb: false verlangt zusaetzlich endgueltig: true — ' +
                'nichts geloescht.',
              )
            }

            await provider.deleteItem(adresse.id)
            return jsonResult({
              pfad: adresse.pfad, id: adresse.id, typ: adresse.typ === 'folder' ? 'ordner' : 'datei',
              imPapierkorb: papierkorbVorhanden && inPapierkorb !== false,
              wiederherstellbarTage: papierkorbVorhanden ? aufbewahrungTage : null,
              hinweis: papierkorbVorhanden
                ? 'Im Papierkorb des Speichers — ueber dessen Oberflaeche wiederherstellbar.'
                : 'Endgueltig geloescht. Nicht wiederherstellbar.',
            })
          },
        )
      } catch (error) {
        return storageFehler(error)
      }
    },
  )
}
