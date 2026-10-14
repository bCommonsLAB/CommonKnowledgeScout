/**
 * @fileoverview MCP-Werkzeug `bibliothek_anlegen` (Handover Library-Anlage 08.10.,
 * seit A3 des Plans speicher-verbindungen-und-library-anlage auf Verbindungen).
 *
 * @description
 * Legt eine Library wie der Anlege-Dialog plus Speicher-Schritt an. Der
 * Speicher wird ueber eine Speicher-Verbindung des Kontos genannt (Id oder
 * Bezeichnung aus `speicher_verbindungen_auflisten`) plus Verzeichnis darauf;
 * ohne Verbindung bleibt eine nextcloud-/onedrive-Library „ausstehend", bis
 * `speicher_verbindung_zuweisen` sie anhaengt. Geheimnisse nie ueber die Bruecke.
 *
 * @module mcp
 */

import crypto from 'crypto'
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { DETAIL_VIEW_TYPES } from '@/lib/detail-view-types/registry'
import { getSelfBaseUrl } from '@/lib/env'
import { LibraryService } from '@/lib/services/library-service'
import { listStorageConnectionSummaries } from '@/lib/storage-connections/connection-service'
import { STORAGE_CONNECTIONS_PATH } from '@/lib/storage-connections/onedrive-callback'
import { NICHT_UEBERNOMMEN, SPEICHER_TYPEN, baueLibrary, bestimmeSpeicher, brauchtVerbindung, uebernimmKonfiguration } from './bibliothek-anlegen'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'
import { errorResult, jsonResult, mcpUserEmail } from './tool-shared'
import { uebernimmAusLibrary } from './vorlage-uebernahme'

export function registerBibliothekAnlegenTool(server: McpServer): void {
  server.registerTool(
    'bibliothek_anlegen',
    {
      title: 'Neue Library anlegen (SCHREIBT)',
      description:
        'Legt eine Library an wie Settings → „Neue Bibliothek erstellen" plus Speicher-Schritt: name, ' +
        'inhaltstyp (detailViewType), speicherVerbindung (Id oder Bezeichnung aus speicher_verbindungen_auflisten; ' +
        'der Typ folgt aus ihr) und verzeichnis darauf. Ohne Verbindung: speicherTyp angeben — local mit absolutem ' +
        'verzeichnis; nextcloud/onedrive bleiben "ausstehend", bis speicher_verbindung_zuweisen sie anhaengt. ' +
        'Geheimnisse nie ueber die Bruecke. Optional vorlageVon (libraryId): uebernimmt Chat (Facetten, Antwortregeln, ' +
        'Galerie, Sprache), Verarbeitung (Standard-Vorlage, Zielsprache) und Ingest-Schalter — keine ' +
        'Zugangsdaten, keine Veroeffentlichung; vorlagenKopieren: true kopiert zusaetzlich deren Vorlagen. ' +
        'Gleichnamige Library wird abgewiesen. Nur nach Bestaetigung durch den Menschen.',
      inputSchema: {
        name: z.string().trim().min(3).max(120).describe('Anzeigename der Library'),
        inhaltstyp: z.enum(DETAIL_VIEW_TYPES).optional().describe('detailViewType; Pflicht ohne vorlageVon, sonst Vorgabe der Vorlage-Library'),
        speicherVerbindung: z.string().min(1).optional().describe('Id oder Bezeichnung einer Speicher-Verbindung des Kontos (speicher_verbindungen_auflisten)'),
        speicherTyp: z.enum(SPEICHER_TYPEN).optional().describe('nur ohne speicherVerbindung: local, oder nextcloud/onedrive als "ausstehend"'),
        verzeichnis: z.string().optional().describe('Verbindung: Unterpfad darauf (z. B. "/Archiv - Kopie"); local: absoluter Serverpfad'),
        vorlageVon: z.string().min(1).optional().describe('libraryId einer eigenen Library, deren Konfiguration uebernommen wird'),
        vorlagenKopieren: z.boolean().optional().describe('mit vorlageVon: auch die Vorlagen (Templates) kopieren; Vorgabe false'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false },
    },
    async ({ name, inhaltstyp, speicherVerbindung, speicherTyp, verzeichnis, vorlageVon, vorlagenKopieren, begruendung }) => {
      const libraryId = crypto.randomUUID()
      try {
        return await mitProtokoll({ werkzeug: 'bibliothek_anlegen', libraryId, akteur: mcpUserEmail(), begruendung, pfad: verzeichnis }, async () => {
          const userEmail = mcpUserEmail()
          const service = LibraryService.getInstance()
          const { speicher, verbindung } = bestimmeSpeicher(
            { speicherTyp, speicherVerbindung, verzeichnis },
            await listStorageConnectionSummaries(userEmail),
          )
          if (vorlagenKopieren && !vorlageVon) throw new Error('vorlagenKopieren braucht vorlageVon')
          const eigene = await service.getUserLibraries(userEmail)
          const gleichnamig = eigene.find((l) => l.label.trim().toLowerCase() === name.trim().toLowerCase())
          if (gleichnamig) throw new Error(`Es gibt schon eine Library "${gleichnamig.label}" (${gleichnamig.id}) — anderen Namen waehlen`)

          let uebernahme
          let typ = inhaltstyp
          if (vorlageVon) {
            const vorlage = eigene.find((l) => l.id === vorlageVon)
            if (!vorlage) throw new Error(`vorlageVon ${vorlageVon} ist keine eigene Library`)
            uebernahme = uebernimmKonfiguration(vorlage, libraryId)
            typ = typ ?? vorlage.config?.chat?.gallery?.detailViewType
          }
          if (!typ) throw new Error('inhaltstyp ist Pflicht (die Vorlage-Library traegt keinen detailViewType)')

          const library = baueLibrary({ id: libraryId, name, inhaltstyp: typ, speicher, uebernahme, storageConnectionId: verbindung?.id })
          if (!(await service.updateLibrary(userEmail, library))) throw new Error('Library konnte nicht gespeichert werden')

          const vorlagen = vorlageVon && vorlagenKopieren
            ? await uebernimmAusLibrary({ vonLibraryId: vorlageVon, zielLibraryId: libraryId, userEmail, ueberschreiben: false })
            : null
          const ausstehend = brauchtVerbindung(speicher.typ) && !verbindung
          return jsonResult({
            libraryId,
            name: library.label,
            inhaltstyp: typ,
            speicher: { typ: speicher.typ, verzeichnis: library.path },
            speicherVerbindung: verbindung ? { id: verbindung.id, bezeichnung: verbindung.label } : null,
            ...(vorlageVon ? { vorlageVon, uebernommen: uebernahme?.uebernommen ?? [], nichtUebernommen: NICHT_UEBERNOMMEN } : {}),
            ...(vorlagen ? { vorlagen } : {}),
            verbindung: ausstehend ? 'ausstehend' : 'ungeprueft',
            naechsterSchritt: ausstehend
              ? `Owner: unter ${getSelfBaseUrl()}${STORAGE_CONNECTIONS_PATH} eine ${speicher.typ === 'nextcloud' ? 'Nextcloud' : 'OneDrive'}-Verbindung ` +
                `anlegen und testen${speicher.typ === 'onedrive' ? ' (bei Microsoft anmelden)' : ''}; dann ` +
                `speicher_verbindung_zuweisen (libraryId ${libraryId}), danach speicher_pruefen`
              : 'speicher_pruefen, dann ordner_listen',
          })
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
