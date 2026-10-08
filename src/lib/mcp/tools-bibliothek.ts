/**
 * @fileoverview MCP-Werkzeuge `bibliothek_anlegen`, `speicher_pruefen`, `vorlage_uebernehmen`
 * (Handover Library-Anlage und Veranstaltungs-Flow, 08.10.).
 *
 * @description
 * Der Flow „Veranstaltung erfassen" soll von null an ueber die Bruecke
 * laufen. Bis hierher musste der Owner die Library in der Oberflaeche
 * anlegen, den Speicher eintragen und die Konfiguration von Hand
 * angleichen. Jetzt: `bibliothek_anlegen` legt an (optional mit den
 * geheimnisfreien Bereichen einer Vorlage-Library und ihren Vorlagen),
 * der Owner traegt NUR das Geheimnis in Settings → Archive ein,
 * `speicher_pruefen` bestaetigt die Verbindung ohne Werte zu zeigen.
 *
 * @module mcp
 */

import crypto from 'crypto'
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { DETAIL_VIEW_TYPES } from '@/lib/detail-view-types/registry'
import { getSelfBaseUrl } from '@/lib/env'
import { LibraryService } from '@/lib/services/library-service'
import { getServerProvider } from '@/lib/storage/server-provider'
import { NICHT_UEBERNOMMEN, SPEICHER_TYPEN, baueLibrary, geheimnisFehlt, pruefeSpeicher, uebernimmKonfiguration } from './bibliothek-anlegen'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary, requireProvider } from './tool-shared'
import { uebernimmAusDatei, uebernimmAusLibrary } from './vorlage-uebernahme'

const ARCHIV_SETTINGS = '/settings/archive'

async function requireOwner(userEmail: string, libraryId: string): Promise<void> {
  if (!(await LibraryService.getInstance().isOwner(userEmail, libraryId))) {
    throw new Error(`Nur der Owner der Library ${libraryId} darf das`)
  }
}

export function registerBibliothekTools(server: McpServer): void {
  server.registerTool(
    'bibliothek_anlegen',
    {
      title: 'Neue Library anlegen (SCHREIBT)',
      description:
        'Legt eine Library an wie Settings → „Neue Bibliothek erstellen" plus Speicher-Schritt: name, ' +
        'inhaltstyp (detailViewType), speicherTyp (nextcloud | local | onedrive) mit den NICHT geheimen ' +
        'Angaben verzeichnis, webdavUrl, benutzer. Geheimnisse (App-Passwort, OAuth) nie ueber die Bruecke: ' +
        'die Antwort nennt geheimnisFehlt und den Weg in die Oberflaeche; bis dahin verbindung "ausstehend", ' +
        'danach speicher_pruefen. Optional vorlageVon (libraryId): uebernimmt Chat (Facetten, Antwortregeln, ' +
        'Galerie, Sprache), Verarbeitung (Standard-Vorlage, Zielsprache) und Ingest-Schalter — keine ' +
        'Zugangsdaten, keine Veroeffentlichung; vorlagenKopieren: true kopiert zusaetzlich deren Vorlagen. ' +
        'Gleichnamige Library wird abgewiesen. Nur nach Bestaetigung durch den Menschen.',
      inputSchema: {
        name: z.string().trim().min(3).max(120).describe('Anzeigename der Library'),
        inhaltstyp: z.enum(DETAIL_VIEW_TYPES).optional().describe('detailViewType; Pflicht ohne vorlageVon, sonst Vorgabe der Vorlage-Library'),
        speicherTyp: z.enum(SPEICHER_TYPEN),
        verzeichnis: z.string().optional().describe('nextcloud: Unterpfad im WebDAV-Root (z. B. "/Archiv - Kopie"); local: absoluter Serverpfad'),
        webdavUrl: z.string().optional().describe('nur nextcloud: https://…/remote.php/dav/files/<benutzer>'),
        benutzer: z.string().optional().describe('nur nextcloud: Benutzername'),
        vorlageVon: z.string().min(1).optional().describe('libraryId einer eigenen Library, deren Konfiguration uebernommen wird'),
        vorlagenKopieren: z.boolean().optional().describe('mit vorlageVon: auch die Vorlagen (Templates) kopieren; Vorgabe false'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false },
    },
    async ({ name, inhaltstyp, speicherTyp, verzeichnis, webdavUrl, benutzer, vorlageVon, vorlagenKopieren, begruendung }) => {
      const libraryId = crypto.randomUUID()
      try {
        return await mitProtokoll({ werkzeug: 'bibliothek_anlegen', libraryId, akteur: mcpUserEmail(), begruendung, pfad: verzeichnis }, async () => {
          const userEmail = mcpUserEmail()
          const service = LibraryService.getInstance()
          const speicher = { typ: speicherTyp, verzeichnis, webdavUrl, benutzer }
          pruefeSpeicher(speicher)
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

          const library = baueLibrary({ id: libraryId, name, inhaltstyp: typ, speicher, uebernahme })
          if (!(await service.updateLibrary(userEmail, library))) throw new Error('Library konnte nicht gespeichert werden')

          const vorlagen = vorlageVon && vorlagenKopieren
            ? await uebernimmAusLibrary({ vonLibraryId: vorlageVon, zielLibraryId: libraryId, userEmail, ueberschreiben: false })
            : null
          const fehlt = geheimnisFehlt(speicher)
          return jsonResult({
            libraryId,
            name: library.label,
            inhaltstyp: typ,
            speicher: { typ: speicherTyp, verzeichnis: library.path, webdavUrl: webdavUrl ?? null, benutzer: benutzer ?? null },
            ...(vorlageVon ? { vorlageVon, uebernommen: uebernahme?.uebernommen ?? [], nichtUebernommen: NICHT_UEBERNOMMEN } : {}),
            ...(vorlagen ? { vorlagen } : {}),
            geheimnisFehlt: fehlt,
            verbindung: fehlt ? 'ausstehend' : 'ungeprueft',
            naechsterSchritt: fehlt
              ? `Owner: Library "${library.label}" in der Bibliotheksauswahl waehlen, ${getSelfBaseUrl()}${ARCHIV_SETTINGS} → 1 · Quelle: ` +
                (speicherTyp === 'nextcloud' ? 'App-Passwort eintragen, speichern' : 'bei OneDrive anmelden') + ' — danach speicher_pruefen'
              : 'speicher_pruefen, dann ordner_listen',
          })
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    'speicher_pruefen',
    {
      title: 'Speicher-Verbindung pruefen (liest nur)',
      description:
        'Prueft die Speicher-Verbindung einer Library wie der Knopf „Verbindung pruefen", aber ohne ' +
        'Testordner anzulegen: Konfiguration gueltig? Wurzel lesbar (Anzahl Eintraege)? Nennt Typ, ' +
        'Verzeichnis und ob ein Geheimnis hinterlegt ist — nie dessen Wert. Liest nur.',
      inputSchema: { libraryId: LIBRARY_ID },
      annotations: { readOnlyHint: true },
    },
    async ({ libraryId }) => {
      try {
        const userEmail = mcpUserEmail()
        const library = await requireLibrary(userEmail, libraryId)
        const kopf = {
          libraryId, typ: library.type, verzeichnis: library.path,
          ...(library.type === 'nextcloud' ? {
            webdavUrl: library.config?.nextcloud?.webdavUrl ?? null,
            benutzer: library.config?.nextcloud?.username ?? null,
            geheimnisHinterlegt: Boolean(library.config?.nextcloud?.appPassword),
          } : {}),
        }
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
