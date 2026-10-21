/**
 * @fileoverview MCP-Werkzeug `playlist_erschliessen` (Playlist als Quelle, Welle K3).
 *
 * @description
 * Eine Video-Playlist (YouTube, Vimeo, PeerTube — was yt-dlp kennt) in eine
 * Library bringen, nach dem Muster einer Veranstaltung: Modus `vorschau`
 * liest nur (Liste mit vorgeschlagenem Ordnernamen, der Mensch bestaetigt
 * Auswahl und Namen), Modus `anlegen` schreibt je Video einen Ordner mit
 * Sammeldatei, Tonspur und Cover und startet die Transkription — als Stapel
 * mit batchId, weil jeder Download Minuten dauert. Kein Ingest; weiter mit
 * den Stationen 4–7 aus `veranstaltung-aufbereiten`. Kern: `playlist-erschliessen.ts`.
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { MAX_PLAYLIST_STAPEL } from '@/lib/web-source/playlist-auswahl'
import { playlistAnlegen, playlistVorschau } from '@/lib/web-source/playlist-erschliessen'
import { audioOptionenAusEingabe, bestimmeAudioWeg } from './erschliessen-wege'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary, requireProvider, resolveScope } from './tool-shared'
import { standardLlmModell } from './tools-erschliessen-shared'

const MODI = ['vorschau', 'anlegen'] as const

export function registerPlaylistTool(server: McpServer): void {
  server.registerTool(
    'playlist_erschliessen',
    {
      title: 'Playlist als Quelle erschliessen (vorschau liest, anlegen SCHREIBT)',
      description:
        'Bringt eine Video-Playlist (YouTube, Vimeo, PeerTube) in die Library. modus vorschau (Vorgabe): loest die ' +
        'Playlist ueber den Secretary (yt-dlp) auf und nennt je Eintrag Position, Titel, Dauer, Adresse und den ' +
        'vorgeschlagenen Ordnernamen „NN Titel"; nicht abrufbare Eintraege stehen mit Grund in der Liste. mitDatum: true ' +
        'startet dazu einen Lesejob, der je Video das Upload-Datum holt und „JJJJ-MM-TT Titel" vorschlaegt (job_status). ' +
        'modus anlegen: legt je gewaehltem Video (auswahl, bis ' + MAX_PLAYLIST_STAPEL + ') unter ordner einen Ordner an und startet je Video ' +
        'einen Job, der dort Sammeldatei (Titel, Beschreibung woertlich, Datum, Kanal, Kapitel, video_url), ' +
        '„<Ordner> - Audio.m4a" und „<Ordner> - Cover.jpg" anlegt und die Transkription startet (kein Ingest). ' +
        'Antwort sofort mit batchId; Fortschritt mit batch_bilanz, Wiederholung mit batch_neustart. Vorhandene Ordner ' +
        'werden nicht ueberschrieben (Befund je Zeile), mehr als ' + MAX_PLAYLIST_STAPEL + ' ist eine Absage. Ordnernamen hier entscheiden — ' +
        'Umbenennen nach dem Erschliessen setzt Twin-Familien auf twin_stale. anlegen nur nach Bestaetigung.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        url: z.string().url().describe('Adresse der Playlist (http/https)'),
        modus: z.enum(MODI).optional().describe('vorschau (Vorgabe, liest nur) oder anlegen (schreibt)'),
        ordner: z.string().min(1).optional().describe('Wurzel-Ordnerpfad (library-relativ), unter dem je Video ein Ordner entsteht'),
        ordnerId: z.string().min(1).optional().describe('ALTERNATIVE: Storage-Id der Wurzel'),
        auswahl: z.array(z.union([z.number().int().positive(), z.string().min(1)])).max(500).optional()
          .describe(`nur bei anlegen: Positionen (Zahl) oder Video-Ids (Text), bis ${MAX_PLAYLIST_STAPEL} je Aufruf`),
        ordnernamen: z.record(z.string().min(1).max(120)).optional().describe('optional: Position (als Text) → Ordnername; sonst der Vorschlag aus der Vorschau'),
        mitDatum: z.boolean().optional().describe('nur bei vorschau: Lesejob fuer Ordnernamen mit Upload-Datum starten (braucht ordner/ordnerId)'),
        zielsprache: z.string().min(2).max(5).optional().describe('Zielsprache der Transkription, Default de'),
        medienEinbetten: z.boolean().optional().describe('false = Video nur transkribieren, OHNE Player und Embed im Eintrag; Default true (Einverstaendnis des Urhebers einholen)'),
        sprecherErkennung: z.boolean().optional().describe('true = Sprecher-Modell fuer die Tonspur (Dialoge), false = ohne; weglassen = Library-Voreinstellung'),
        kontext: z.string().max(2000).optional().describe('Thema/Anlass als Freitext fuer die Transkription, gilt fuer alle Videos'),
        begriffe: z.array(z.string().min(1)).max(100).optional().describe('Namen und Fachwoerter fuer die Transkription, gelten fuer alle Videos'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false },
    },
    async ({ libraryId, url, modus, ordner, ordnerId, auswahl, ordnernamen, mitDatum, zielsprache, medienEinbetten, sprecherErkennung, kontext, begriffe, begruendung }) => {
      const gewaehlt = modus ?? 'vorschau'
      try {
        return await mitProtokoll(
          { werkzeug: 'playlist_erschliessen', libraryId, akteur: mcpUserEmail(), begruendung, pfad: ordner, ...(gewaehlt === 'vorschau' ? { modus: 'vorschau' as const } : {}) },
          async () => {
            const userEmail = mcpUserEmail()
            const library = await requireLibrary(userEmail, libraryId)
            const wurzelId = await resolveScope({ userEmail, libraryId, folderId: ordnerId, pfad: ordner })
            if (gewaehlt === 'vorschau') {
              const vorschau = await playlistVorschau({ libraryId, userEmail, url, mitDatum: mitDatum === true, wurzelId })
              return jsonResult({
                modus: 'vorschau', ...vorschau,
                naechsterSchritt: vorschau.datumJob
                  ? `job_status ${vorschau.datumJob.jobId} abwarten (ergebnis.playlist.eintraege mit Datum), dann Auswahl und Ordnernamen mit dem Menschen bestaetigen und modus anlegen aufrufen.`
                  : 'Auswahl und Ordnernamen mit dem Menschen bestaetigen, dann modus anlegen mit auswahl (und ggf. ordnernamen) aufrufen.',
              })
            }
            if (!wurzelId) throw new Error('anlegen braucht ordner oder ordnerId (die Wurzel, unter der je Video ein Ordner entsteht)')
            if (!auswahl || auswahl.length === 0) throw new Error('anlegen braucht auswahl (Positionen oder Video-Ids aus der Vorschau)')
            const provider = await requireProvider(userEmail, libraryId)
            const audioContext = audioOptionenAusEingabe({ sprecherErkennung, kontext, begriffe })
            const ergebnis = await playlistAnlegen({
              libraryId, userEmail, provider, url, wurzelId, auswahl, ordnernamen,
              targetLanguage: zielsprache ?? 'de', audioContext, llmModel: standardLlmModell(library), medienEinbetten: medienEinbetten ?? true,
            })
            return jsonResult({
              modus: 'anlegen', ...ergebnis,
              transkription: bestimmeAudioWeg(audioContext, library),
              naechsterSchritt: `batch_bilanz mit batchId ${ergebnis.batchId} abwarten (je Video ein web-source-Job und ein Transkriptions-Job); ` +
                'danach Transkripte pruefen und mit transformation_starten je Sammeldatei weiter (Stationen 4–7 aus veranstaltung-aufbereiten).',
            })
          },
        )
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
