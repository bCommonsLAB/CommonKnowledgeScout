/**
 * @fileoverview MCP-Werkzeug `bibliothek_anlegen` (Handover Library-Anlage 08.10.;
 * Plan speicher-verbindungen-und-library-anlage A3 und C3).
 *
 * @description
 * Legt eine Library wie der Anlege-Dialog plus Speicher-Schritt an. Der
 * Speicher wird ueber eine Speicher-Verbindung des Kontos genannt (Id oder
 * Bezeichnung aus `speicher_verbindungen_auflisten`) plus Verzeichnis darauf.
 * Seit C3 prueft es den Entwurf gegen den Entscheidungskatalog: fehlen
 * Pflicht- oder empfohlene Antworten, legt es NICHT an, sondern antwortet mit
 * `offeneEntscheidungen`; der Agent fragt den Menschen und ruft erneut mit
 * `entscheidungen` bzw. `ueberspringen`. Geheimnisse nie ueber die Bruecke.
 *
 * @module mcp
 */

import crypto from 'crypto'
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { DETAIL_VIEW_TYPES } from '@/lib/detail-view-types/registry'
import { getSelfBaseUrl } from '@/lib/env'
import { pruefeEinrichtung, wendeAntwortenAn } from '@/lib/library-setup/pruefung'
import { LibraryService } from '@/lib/services/library-service'
import { listStorageConnectionSummaries } from '@/lib/storage-connections/connection-service'
import { STORAGE_CONNECTIONS_PATH } from '@/lib/storage-connections/onedrive-callback'
import { NICHT_UEBERNOMMEN, SPEICHER_TYPEN, baueLibrary, uebernimmKonfiguration } from '@/lib/library-setup/entwurf'
import { bestimmeSpeicher } from './bibliothek-anlegen'
import { alsFragen } from './bibliothek-rueckfragen'
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
        'der Typ folgt aus ihr) und verzeichnis darauf; local: speicherTyp local + absolutes verzeichnis. ' +
        'RUECKFRAGEN: Fehlen Pflicht- oder empfohlene Entscheidungen, legt es NICHTS an und antwortet mit ' +
        'angelegt: false und offeneEntscheidungen (frage, optionen, vorgabe, antwortweg). Den Menschen fragen, dann ' +
        'erneut aufrufen mit entscheidungen { schluessel: wert } und/oder ueberspringen [schluessel] (nur empfohlene). ' +
        'vorlageVon (libraryId) beantwortet, was die Vorlage traegt: Chat (Facetten, Antwortregeln, Galerie, Sprache), ' +
        'Verarbeitung und Ingest-Schalter — keine Zugangsdaten, keine Veroeffentlichung; vorlagenKopieren: true kopiert ' +
        'deren Vorlagen. Gleichnamige Library wird abgewiesen. Nur nach Bestaetigung durch den Menschen.',
      inputSchema: {
        name: z.string().trim().min(3).max(120).describe('Anzeigename der Library'),
        inhaltstyp: z.enum(DETAIL_VIEW_TYPES).optional().describe('detailViewType; ohne vorlageVon Pflicht, sonst Vorgabe der Vorlage-Library'),
        speicherVerbindung: z.string().min(1).optional().describe('Id oder Bezeichnung einer Speicher-Verbindung des Kontos (speicher_verbindungen_auflisten)'),
        speicherTyp: z.enum(SPEICHER_TYPEN).optional().describe('nur ohne speicherVerbindung, praktisch nur local'),
        verzeichnis: z.string().optional().describe('Verbindung: Unterpfad darauf (z. B. "/Archiv - Kopie"); local: absoluter Serverpfad'),
        vorlageVon: z.string().min(1).optional().describe('libraryId einer eigenen Library, deren Konfiguration uebernommen wird'),
        vorlagenKopieren: z.boolean().optional().describe('mit vorlageVon: auch die Vorlagen (Templates) kopieren; Vorgabe false'),
        entscheidungen: z.record(z.unknown()).optional().describe(
          'Antworten auf offeneEntscheidungen mit antwortweg "entscheidungen.<schluessel>", z. B. ' +
          '{ "facetten": "standard", "graph": false, "antwortsprache": "de", "aufnahmeSprachen": ["de","it"], "bekannteNamen": ["…"], "antwortregeln": "…" }',
        ),
        ueberspringen: z.array(z.string().min(1)).max(20).optional().describe('empfohlene Entscheidungen, die bewusst offen bleiben (Vorgabe gilt)'),
        audioErwartet: z.boolean().optional().describe('kommen Aufnahmen (Audio/Video)? Weglassen = aus dem Inhaltstyp'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false },
    },
    async (eingabe) => {
      const { name, inhaltstyp, speicherVerbindung, speicherTyp, verzeichnis, vorlageVon, vorlagenKopieren, begruendung } = eingabe
      const libraryId = crypto.randomUUID()
      try {
        return await mitProtokoll({ werkzeug: 'bibliothek_anlegen', libraryId, akteur: mcpUserEmail(), begruendung, pfad: verzeichnis }, async () => {
          const userEmail = mcpUserEmail()
          const service = LibraryService.getInstance()
          const verbindungenUrl = `${getSelfBaseUrl()}${STORAGE_CONNECTIONS_PATH}`
          const { speicher, verbindung } = bestimmeSpeicher({ speicherTyp, speicherVerbindung, verzeichnis }, await listStorageConnectionSummaries(userEmail))
          if (vorlagenKopieren && !vorlageVon) throw new Error('vorlagenKopieren braucht vorlageVon')
          const eigene = await service.getUserLibraries(userEmail)
          const gleichnamig = eigene.find((l) => l.label.trim().toLowerCase() === name.trim().toLowerCase())
          if (gleichnamig) throw new Error(`Es gibt schon eine Library "${gleichnamig.label}" (${gleichnamig.id}) — anderen Namen waehlen`)

          let uebernahme
          let typ: string | undefined = inhaltstyp
          if (vorlageVon) {
            const vorlage = eigene.find((l) => l.id === vorlageVon)
            if (!vorlage) throw new Error(`vorlageVon ${vorlageVon} ist keine eigene Library`)
            uebernahme = uebernimmKonfiguration(vorlage, libraryId)
            typ = typ ?? vorlage.config?.chat?.gallery?.detailViewType
          }

          const entwurf = wendeAntwortenAn(
            baueLibrary({ id: libraryId, name, inhaltstyp: typ, speicher, uebernahme, storageConnectionId: verbindung?.id }),
            eingabe.entscheidungen ?? {},
          )
          const kontext = {
            andereLibrariesGleichenTyps: typ ? eigene.filter((l) => l.config?.chat?.gallery?.detailViewType === typ).length : 0,
            vorlageGewaehlt: Boolean(vorlageVon),
            audioErwartet: eingabe.audioErwartet,
            uebersprungen: eingabe.ueberspringen ?? [],
          }
          const pruefung = pruefeEinrichtung(entwurf, kontext)
          if (!pruefung.vollstaendig) {
            return jsonResult({
              angelegt: false,
              einrichtung: `${pruefung.erledigt} von ${pruefung.gesamt}`,
              offeneEntscheidungen: alsFragen(pruefung, verbindungenUrl),
              hinweis: 'Nichts angelegt. Frag den Menschen nach den offenen Entscheidungen und ruf bibliothek_anlegen erneut ' +
                'mit denselben Angaben plus entscheidungen / ueberspringen auf.',
            })
          }
          if (!(await service.updateLibrary(userEmail, entwurf))) throw new Error('Library konnte nicht gespeichert werden')

          const vorlagen = vorlageVon && vorlagenKopieren
            ? await uebernimmAusLibrary({ vonLibraryId: vorlageVon, zielLibraryId: libraryId, userEmail, ueberschreiben: false })
            : null
          return jsonResult({
            angelegt: true,
            libraryId,
            name: entwurf.label,
            inhaltstyp: typ,
            speicher: { typ: speicher.typ, verzeichnis: entwurf.path },
            speicherVerbindung: verbindung ? { id: verbindung.id, bezeichnung: verbindung.label } : null,
            einrichtung: `${pruefung.erledigt} von ${pruefung.gesamt}`,
            uebersprungen: pruefung.alle.filter((s) => s.status === 'uebersprungen').map((s) => s.schluessel),
            spaeterInDenSettings: pruefung.alle.filter((s) => s.gewicht === 'spaeter' && s.status === 'offen').map((s) => s.titel),
            ...(vorlageVon ? { vorlageVon, uebernommen: uebernahme?.uebernommen ?? [], nichtUebernommen: NICHT_UEBERNOMMEN } : {}),
            ...(vorlagen ? { vorlagen } : {}),
            naechsterSchritt: speicher.typ === 'local' ? 'ordner_listen' : 'speicher_pruefen, dann ordner_listen',
          })
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
