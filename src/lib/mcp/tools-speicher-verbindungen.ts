/**
 * @fileoverview MCP-Werkzeuge fuer Speicher-Verbindungen des Kontos
 * (Plan speicher-verbindungen-und-library-anlage, A3).
 *
 * @description
 * Seit Teil A gehoeren Zugangsdaten der Person: eine Speicher-Verbindung
 * (Nextcloud, OneDrive) wird einmal am Konto gepflegt, die Library zeigt mit
 * `storageConnectionId` darauf. Die Bruecke kann Verbindungen auflisten,
 * testen und einer Library zuweisen — ANLEGEN nicht, denn dafuer braucht es
 * das Geheimnis (App-Passwort, Client-Secret, Microsoft-Anmeldung), und
 * Geheimnisse kommen nie ueber die Bruecke. Das bleibt die Konto-Seite.
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getSelfBaseUrl } from '@/lib/env'
import { LibraryService } from '@/lib/services/library-service'
import { listStorageConnectionSummaries, testStorageConnection } from '@/lib/storage-connections/connection-service'
import { STORAGE_CONNECTIONS_PATH } from '@/lib/storage-connections/onedrive-callback'
import type { Library } from '@/types/library'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'
import { pruefeZuweisung, verbindungsZeile, waehleVerbindung } from './speicher-verbindung-wahl'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireOwner } from './tool-shared'

const VERBINDUNG = z.string().min(1).describe('Id oder Bezeichnung der Speicher-Verbindung (speicher_verbindungen_auflisten)')

function kontoSeite(): string {
  return `${getSelfBaseUrl()}${STORAGE_CONNECTIONS_PATH}`
}

export function registerSpeicherVerbindungenTools(server: McpServer): void {
  server.registerTool(
    'speicher_verbindungen_auflisten',
    {
      title: 'Speicher-Verbindungen des Kontos (liest nur)',
      description:
        'Listet die Speicher-Verbindungen (Nextcloud, OneDrive) des eigenen Kontos: Id, Bezeichnung, Typ, letzter ' +
        'Test (am, ok, meldung), bei Nextcloud URL und Benutzer, ob ein Geheimnis hinterlegt bzw. OneDrive angemeldet ' +
        'ist — nie Werte — und welche eigenen Libraries darauf liegen. Anlegen geht nur in der Oberflaeche (Konto → ' +
        'Speicher-Verbindungen), weil dafuer ein Geheimnis noetig ist. Liest nur.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      try {
        const userEmail = mcpUserEmail()
        const [verbindungen, libraries] = await Promise.all([
          listStorageConnectionSummaries(userEmail),
          LibraryService.getInstance().getUserLibraries(userEmail),
        ])
        return jsonResult({
          anzahl: verbindungen.length,
          verbindungen: verbindungen.map((v) => verbindungsZeile(v, libraries)),
          anlegen: `In der Oberflaeche: ${kontoSeite()}`,
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    'speicher_verbindung_testen',
    {
      title: 'Speicher-Verbindung testen (speichert nur das Ergebnis)',
      description:
        'Testet eine Speicher-Verbindung des Kontos wie der Knopf „Testen" auf der Konto-Seite: Nextcloud meldet ' +
        'sich mit dem hinterlegten App-Passwort an, OneDrive prueft (und erneuert) den Zugang. Das Ergebnis (ok, ' +
        'meldung, am) wird an der Verbindung gespeichert; sonst aendert sich nichts. Fuer eine Library: speicher_pruefen.',
      inputSchema: { verbindung: VERBINDUNG },
      annotations: { readOnlyHint: false },
    },
    async ({ verbindung }) => {
      try {
        const userEmail = mcpUserEmail()
        const gewaehlt = waehleVerbindung(verbindung, await listStorageConnectionSummaries(userEmail))
        const ergebnis = await testStorageConnection(userEmail, gewaehlt.id)
        const test = ergebnis.lastTest
        if (!test) throw new Error(`Test der Verbindung "${gewaehlt.label}" hat kein Ergebnis gespeichert`)
        return jsonResult({
          id: ergebnis.id,
          bezeichnung: ergebnis.label,
          typ: ergebnis.type,
          ok: test.ok,
          meldung: test.message,
          am: test.at,
          ...(test.ok ? {} : { naechsterSchritt: `Zugang in der Oberflaeche pruefen: ${kontoSeite()}` }),
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    'speicher_verbindung_zuweisen',
    {
      title: 'Library an eine Speicher-Verbindung haengen (SCHREIBT)',
      description:
        'Haengt eine eigene nextcloud- oder onedrive-Library an eine Speicher-Verbindung gleichen Typs ' +
        '(storageConnectionId), optional mit neuem verzeichnis darauf — wie Settings → Archive · 1 Quelle. Typ ' +
        'muss passen; local-Libraries haben keine Verbindung. Nur der Owner. Antwort nennt vorher/nachher; ' +
        'danach speicher_pruefen. Nur nach Bestaetigung durch den Menschen.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        verbindung: VERBINDUNG,
        verzeichnis: z.string().optional().describe('neuer Unterpfad auf der Verbindung; weglassen = unveraendert'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false },
    },
    async ({ libraryId, verbindung, verzeichnis, begruendung }) => {
      try {
        return await mitProtokoll({ werkzeug: 'speicher_verbindung_zuweisen', libraryId, akteur: mcpUserEmail(), begruendung, pfad: verzeichnis }, async () => {
          const userEmail = mcpUserEmail()
          await requireOwner(userEmail, libraryId)
          const service = LibraryService.getInstance()
          const [libraries, verbindungen] = await Promise.all([service.getUserLibraries(userEmail), listStorageConnectionSummaries(userEmail)])
          const library = libraries.find((l) => l.id === libraryId)
          if (!library) throw new Error(`Library ${libraryId} nicht gefunden`)
          const gewaehlt = waehleVerbindung(verbindung, verbindungen)
          pruefeZuweisung(library, gewaehlt)

          const vorher = verbindungen.find((v) => v.id === library.storageConnectionId)
          const neu: Library = {
            ...library,
            storageConnectionId: gewaehlt.id,
            ...(verzeichnis !== undefined ? { path: verzeichnis.trim() } : {}),
          }
          if (!(await service.updateLibrary(userEmail, neu))) throw new Error('Library konnte nicht gespeichert werden')
          return jsonResult({
            libraryId,
            name: library.label,
            vorher: {
              speicherVerbindung: vorher ? { id: vorher.id, bezeichnung: vorher.label } : library.storageConnectionId ? { id: library.storageConnectionId, bezeichnung: null } : null,
              verzeichnis: library.path,
            },
            nachher: { speicherVerbindung: { id: gewaehlt.id, bezeichnung: gewaehlt.label }, verzeichnis: neu.path },
            naechsterSchritt: 'speicher_pruefen',
          })
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
