/**
 * @fileoverview MCP-Werkzeug `webseite_erschliessen` (Webseite als Quelle).
 *
 * @description
 * Ein Artikel im Netz mit eingebettetem Audio oder Video wird zur Sammeldatei
 * im Zielordner: Seite ohne Modell gelesen (Titel, Herkunft, Absaetze
 * woertlich), Medium ueber den Secretary (yt-dlp) aufgeloest und geladen,
 * Coverbild geladen, Transkription des Mediums gestartet (nur Transkript).
 * Danach wie bei jeder Sammeldatei: `job_status` abwarten, dann
 * `transformation_starten` mit der Artikel-Vorlage (z. B. artikel-de) und
 * bewusst `ingest`. Derselbe Weg wie `POST /api/library/[id]/web-source`.
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { MAX_HTML_ZEICHEN } from '@/lib/web-source/seite-lesen'
import { webseiteErschliessen } from '@/lib/web-source/webseite-erschliessen'
import { audioOptionenAusEingabe, bestimmeAudioWeg } from './erschliessen-wege'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'
import { ordnerSicherstellen } from './storage/pfad-helfer'
import { pruefeSchreibschutz } from './storage/schreibschutz'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary, requireProvider, resolveScope } from './tool-shared'
import { standardLlmModell } from './tools-erschliessen-shared'

export function registerWebseiteTool(server: McpServer): void {
  server.registerTool(
    'webseite_erschliessen',
    {
      title: 'Webseite als Quelle erschliessen (SCHREIBT)',
      description:
        'Legt aus einer Artikelseite eine Sammeldatei im Ordner an: Seite OHNE Sprachmodell gelesen ' +
        '(Titel, Quelle, Datum, Absaetze woertlich), eingebettetes Audio/Video per yt-dlp (Secretary) ' +
        'aufgeloest und als „<Basis> - Audio.mp3" daneben abgelegt, Coverbild der Seite als „<Basis> - Cover.jpg", ' +
        'Transkription des Mediums gestartet (nur Transkript, kein Ingest). Vorhandene Dateinamen werden ' +
        'nicht ueberschrieben. Danach: job_status abwarten, dann transformation_starten (Vorlage artikel-de) ' +
        'mit bewusstem ingest. Kein Medium oder kein Cover steht mit Grund in der Antwort. Uebersichts-, Termin- und Dokumentseiten ' +
        'OHNE Fliesstext: seitenModus "struktur" uebernimmt die Seite woertlich mit Listen, Tabellen und Links (Abschnitt „Seite") ' +
        'und listet verlinkte PDF, Dokumente und Medien unter „Verlinkte Dateien" — vorher mit seite_lesen ansehen. ' +
        'Weist die Website den Server ab (leere Antwort, Schutzseite, 403): die Seite im Browser oeffnen und ihr HTML als html ' +
        'uebergeben — dieselbe Sammeldatei, nur laedt der Server die Seite nicht selbst. ' +
        'Interne Adressen werden nicht abgerufen. SCHREIBT; nur nach Bestaetigung.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        url: z.string().url().describe('Adresse der Artikelseite (http/https)'),
        dateiname: z.string().min(1).max(200).describe('Dateiname der Sammeldatei, endet auf .md; Medium und Cover heissen „<Basis> - Audio.mp3" / „<Basis> - Cover.jpg"'),
        ordner: z.string().min(1).optional().describe('Ordnerpfad (library-relativ)'),
        ordnerId: z.string().min(1).optional().describe('ALTERNATIVE: Storage-Id des Ordners'),
        elternAnlegen: z.boolean().optional().describe('Nur mit ordner: fehlende Ordner des Pfades anlegen; Vorgabe false'),
        html: z.string().min(1).max(MAX_HTML_ZEICHEN).optional().describe('Fertiges HTML der Seite (document.documentElement.outerHTML aus dem Browser) — dann wird die Seite nicht geladen; url bleibt Herkunft und Basis der Links'),
        seitenModus: z.enum(['artikel', 'struktur']).optional().describe('artikel (Vorgabe) = Absaetze des Artikeltexts, Seite ohne Absaetze wird abgewiesen; struktur = Seite woertlich mit Listen, Tabellen und Links, fuer Seiten ohne Fliesstext'),
        zielsprache: z.string().min(2).max(5).optional().describe('Zielsprache der Transkription, Default de'),
        medienHolen: z.boolean().optional().describe('false = nur Seite lesen und Sammeldatei anlegen, kein Medium; Default true'),
        medienEinbetten: z.boolean().optional().describe('false = Medium nur als Quelle transkribieren, OHNE Player und Video-Embed im Eintrag (nur Vorschaubild und Link zum Original, z. B. aus rechtlichen Gruenden); Default true'),
        sprecherErkennung: z.boolean().optional().describe('Fuer die Tonspur (auch bei Videoseiten, das Medium kommt als Ton): true = Sprecher-Modell, false = ohne; weglassen = Library-Voreinstellung'),
        kontext: z.string().max(2000).optional().describe('Thema/Anlass als Freitext fuer die Transkription der Tonspur'),
        begriffe: z.array(z.string().min(1)).max(100).optional().describe('Namen und Fachwoerter fuer die Transkription der Tonspur'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false },
    },
    async ({ libraryId, url, dateiname, ordner, ordnerId, elternAnlegen, html, seitenModus, zielsprache, medienHolen, medienEinbetten, sprecherErkennung, kontext, begriffe, begruendung }) => {
      try {
        return await mitProtokoll({ werkzeug: 'webseite_erschliessen', libraryId, akteur: mcpUserEmail(), begruendung, pfad: ordner }, async () => {
          const userEmail = mcpUserEmail()
          const library = await requireLibrary(userEmail, libraryId)
          const provider = await requireProvider(userEmail, libraryId)
          if (elternAnlegen && !ordner) throw new Error('elternAnlegen braucht ordner (einen Pfad) — eine ordnerId gibt es nur fuer bestehende Ordner')
          if (elternAnlegen && ordnerId) throw new Error('Entweder ordner ODER ordnerId angeben — nicht beides')
          if (ordner) pruefeSchreibschutz(`${ordner}/${dateiname}`, 'anlegen')
          const folderId = elternAnlegen && ordner
            ? await ordnerSicherstellen(provider, ordner, true)
            : await resolveScope({ userEmail, libraryId, folderId: ordnerId, pfad: ordner })
          if (!folderId) throw new Error('ordner oder ordnerId ist erforderlich')
          const audioContext = audioOptionenAusEingabe({ sprecherErkennung, kontext, begriffe })
          const ergebnis = await webseiteErschliessen({
            libraryId, userEmail, provider, url, folderId, dateiname,
            targetLanguage: zielsprache ?? 'de', audioContext, llmModel: standardLlmModell(library),
            medienHolen: medienHolen ?? true,
            medienEinbetten: medienEinbetten ?? true,
            seitenModus: seitenModus ?? 'artikel',
            seitenHtml: html,
          })
          const weg = ergebnis.medium ? bestimmeAudioWeg(audioContext, library) : null
          return jsonResult({
            ...ergebnis,
            ...(weg ? { transkription: weg } : {}),
            naechsterSchritt: ergebnis.medium
              ? `job_status ${ergebnis.medium.jobId} abwarten (Transkript des Mediums), dann transformation_starten auf die Sammeldatei (Vorlage artikel-de), ingest bewusst setzen.`
              : 'Kein Medium — direkt transformation_starten auf die Sammeldatei (Vorlage artikel-de), ingest bewusst setzen.',
          })
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
