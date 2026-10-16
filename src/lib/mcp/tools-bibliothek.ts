/**
 * @fileoverview MCP-Werkzeuge `speicher_pruefen`, `bibliothek_pruefen`, `vorlage_uebernehmen`
 * (Handover Library-Anlage und Veranstaltungs-Flow, 08.10.).
 *
 * @description
 * Der Flow „Veranstaltung erfassen" soll von null an ueber die Bruecke
 * laufen. Bis hierher musste der Owner die Library in der Oberflaeche
 * anlegen, den Speicher eintragen und die Konfiguration von Hand
 * angleichen. Jetzt: `bibliothek_anlegen` legt an (optional mit den
 * geheimnisfreien Bereichen einer Vorlage-Library und ihren Vorlagen),
 * Zugangsdaten liegen seit Teil A an den Speicher-Verbindungen des Kontos
 * (`tools-speicher-verbindungen.ts`), `speicher_pruefen` bestaetigt die
 * Verbindung ohne Werte zu zeigen. `bibliothek_anlegen` steht seit A3 in
 * `tools-bibliothek-anlegen.ts`.
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getSelfBaseUrl } from '@/lib/env'
import { getServerProvider } from '@/lib/storage/server-provider'
import { STORAGE_CONNECTIONS_PATH } from '@/lib/storage-connections/onedrive-callback'
import { einrichtungsSicht } from './bibliothek-rueckfragen'
import { beschreibeSpeicherVerbindung } from './speicher-verbindung-info'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'
import { registerBibliothekAnlegenTool } from './tools-bibliothek-anlegen'
import { registerSpeicherVerbindungenTools } from './tools-speicher-verbindungen'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary, requireOwner, requireProvider } from './tool-shared'
import { uebernimmAusDatei, uebernimmAusLibrary } from './vorlage-uebernahme'

export function registerBibliothekTools(server: McpServer): void {
  registerBibliothekAnlegenTool(server)

  server.registerTool(
    'speicher_pruefen',
    {
      title: 'Speicher-Verbindung pruefen (liest nur)',
      description:
        'Prueft die Speicher-Verbindung einer Library wie der Knopf „Verbindung pruefen", aber ohne ' +
        'Testordner anzulegen: Konfiguration gueltig? Wurzel lesbar (Anzahl Eintraege)? Nennt Typ, ' +
        'Verzeichnis und die Speicher-Verbindung (Id, Bezeichnung, letzter Test, bei Nextcloud URL und Benutzer, ob ein ' +
        'Geheimnis hinterlegt ist) — nie dessen Wert. Ohne Verbindung: speicher_verbindung_zuweisen. Liest nur.',
      inputSchema: { libraryId: LIBRARY_ID },
      annotations: { readOnlyHint: true },
    },
    async ({ libraryId }) => {
      try {
        const userEmail = mcpUserEmail()
        const library = await requireLibrary(userEmail, libraryId)
        const verbindung = await beschreibeSpeicherVerbindung(library)
        const kopf = { libraryId, typ: library.type, verzeichnis: library.path, ...(verbindung ? { speicherVerbindung: verbindung } : {}) }
        try {
          const provider = await getServerProvider(userEmail, libraryId)
          const validierung = await provider.validateConfiguration()
          if (!validierung.isValid) return jsonResult({ ...kopf, verbunden: false, fehler: validierung.error ?? 'Konfiguration ungueltig' })
          const wurzel = await provider.listItemsById('root')
          return jsonResult({ ...kopf, verbunden: true, wurzelEintraege: wurzel.length })
        } catch (error) {
          return jsonResult({ ...kopf, verbunden: false, fehler: error instanceof Error ? error.message : String(error) })
        }
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  registerSpeicherVerbindungenTools(server)

  server.registerTool(
    'bibliothek_pruefen',
    {
      title: 'Einrichtung einer Library pruefen (liest nur)',
      description:
        'Prueft eine bestehende Library gegen den Entscheidungskatalog der Library-Anlage (dieselbe Liste wie die ' +
        'Rueckfragen von bibliothek_anlegen): einrichtung „n von m" (Pflicht + empfohlen), offeneEntscheidungen mit ' +
        'frage, optionen, vorgabe und antwortweg, dazu je Entscheidung der Status (beantwortet | offen). Findet ' +
        'halb eingerichtete Libraries. Gesetzt wird ueber konfiguration_setzen, speicher_verbindung_zuweisen oder die Settings. Liest nur.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        audioErwartet: z.boolean().optional().describe('kommen Aufnahmen? Weglassen = aus Inhaltstyp und Transkriptions-Einstellungen'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ libraryId, audioErwartet }) => {
      try {
        const library = await requireLibrary(mcpUserEmail(), libraryId)
        const sicht = einrichtungsSicht(library, { audioErwartet }, `${getSelfBaseUrl()}${STORAGE_CONNECTIONS_PATH}`)
        return jsonResult({ libraryId, name: library.label, ...sicht })
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    'vorlage_uebernehmen',
    {
      title: 'Vorlagen in eine Library uebernehmen (SCHREIBT)',
      description:
        'Vorlagen leben je Library in MongoDB; eine Datei in templates/ wirkt erst nach dem Import. ' +
        'Zwei Quellen, genau eine angeben: vonLibraryId (+ optional namen; ohne namen alle) ODER datei ' +
        '(library-relativer Pfad einer .md im Storage der Ziel-Library). Vorhandene Vorlagen werden nur mit ' +
        'ueberschreiben: true ersetzt. Gleicher Konsistenz-Contract wie Formular und Import. Antwort nennt je ' +
        'Vorlage Quelle (library/datei), deren Stand und angelegt/aktualisiert. Nur nach Bestaetigung.',
      inputSchema: {
        libraryId: LIBRARY_ID.describe('Ziel-Library'),
        vonLibraryId: z.string().min(1).optional().describe('Quell-Library (eigene)'),
        namen: z.array(z.string().min(1)).max(30).optional().describe('mit vonLibraryId: nur diese Vorlagen'),
        datei: z.string().min(1).optional().describe('ALTERNATIVE: Pfad der Vorlagen-Datei, z. B. "templates/vortrag-session-de.md"'),
        ueberschreiben: z.boolean().optional().describe('vorhandene Vorlage ersetzen; Vorgabe false'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false },
    },
    async ({ libraryId, vonLibraryId, namen, datei, ueberschreiben, begruendung }) => {
      try {
        return await mitProtokoll({ werkzeug: 'vorlage_uebernehmen', libraryId, akteur: mcpUserEmail(), begruendung, pfad: datei }, async () => {
          if (Boolean(vonLibraryId) === Boolean(datei)) throw new Error('Genau eines angeben: vonLibraryId ODER datei')
          if (namen && !vonLibraryId) throw new Error('namen gilt nur mit vonLibraryId')
          const userEmail = mcpUserEmail()
          await requireOwner(userEmail, libraryId)
          if (vonLibraryId) {
            await requireOwner(userEmail, vonLibraryId)
            const zeilen = await uebernimmAusLibrary({ vonLibraryId, zielLibraryId: libraryId, userEmail, namen, ueberschreiben: ueberschreiben === true })
            return jsonResult({ ok: zeilen.every((z) => !('fehler' in z)), zeilen })
          }
          const provider = await requireProvider(userEmail, libraryId)
          const zeile = await uebernimmAusDatei({ provider, pfad: datei as string, zielLibraryId: libraryId, userEmail, ueberschreiben: ueberschreiben === true })
          return jsonResult({ ok: true, zeilen: [zeile] })
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
