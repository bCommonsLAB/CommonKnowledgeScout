/**
 * @fileoverview MCP-Werkzeug `quelle_erschliessen` (Welle 5, Stufe 2; Welle B).
 *
 * @description
 * Inhalts-Motor im Anstossen-und-Nachsehen-Muster — die Jobs laufen laenger
 * als das ~60s-Client-Limit, deshalb kommt sofort eine jobId zurueck und
 * `job_status` schaut nach:
 *
 * - Audio/Video (Transkript, mit Template auch Transformation+Ingest) UND —
 *   seit A1 — PDF/Office ueber die Job-Form der Pipeline-Route (upload-frei,
 *   der Worker laedt das Binary selbst).
 * - Welle B (Owner 08.10.2026): Bei Audio sind ZWEI Wege unterscheidbar —
 *   mit Sprecher-Erkennung (Sprecher-Modell) oder ganz ohne, dann prueft der
 *   Mensch das Transkript im Reiter „Korrektur". Je Quelle sagt die Antwort,
 *   welcher Weg gilt und woher die Entscheidung kommt (`erschliessen-wege.ts`).
 *   Kontext und Begriffe (P3a) gehen wie im Pipeline-Sheet mit.
 * - `sourceIds` als Stapel (C3): eine Job-Zeile je Quelle, Fehler einzeln.
 * - `transformation_starten`: eigene Datei `tools-transformation.ts`;
 *   Job-Beobachtung: `tools-jobs.ts`.
 *
 * @module mcp
 */

import { z } from 'zod'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'
import { entscheideErzwingen } from './alt-format-erkennung'
import { getShadowTwinsBySourceIds } from '@/lib/repositories/shadow-twin-repo'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { documentMediaKindFromName, enqueueSourceDocumentJob } from '@/lib/external-jobs/enqueue-document-job'
import { enqueueSourceTranscribeJob } from '@/lib/external-jobs/enqueue-secretary-job'
import { getFileKind } from '@/lib/shadow-twin/file-kind'
import { audioOptionenAusEingabe, bestimmeAudioWeg, fasseWegeZusammen, type AudioWeg } from './erschliessen-wege'
import { JOB_HINWEIS, modellHinweis, runForSources, standardLlmModell, standardTemplate } from './tools-erschliessen-shared'
import { SOURCE_INPUTS, TRANSFORM_INPUTS } from './tools-transformation'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary, requireProvider } from './tool-shared'

/** Registriert `quelle_erschliessen` (siehe Datei-Kommentar). */
export function registerErschliessenTools(server: McpServer): void {
  server.registerTool(
    'quelle_erschliessen',
    {
      title: 'Quelle erschliessen (SCHREIBT, langlaufend)',
      description:
        'Startet die Pipeline fuer Quellen ohne Twin (Befund source_without_twin): Audio/Video ' +
        'wird transkribiert, PDF/DOCX/XLSX/PPTX extrahiert (A1); mit template (Default: ' +
        'Standard-Template der Library) entstehen auch Transformation + Galerie-Eintrag. ' +
        'AUDIO kennt zwei Wege: sprecherErkennung: true = Sprecher-Modell (Labels, Kontext und Begriffe ' +
        'verwirft der Anbieter), false = Standard-Transkription mit Kontext und Begriffen, danach prueft ' +
        'der Mensch das Transkript im Reiter „Korrektur"; weglassen = Library-Voreinstellung. Die Antwort ' +
        'nennt je Quelle den Weg, seine Herkunft und den naechsten Schritt (jobs[].transkription, wege). ' +
        'Antwortet SOFORT mit jobId(s) — Status mit job_status/job_liste. Stapel via sourceIds. ' +
        'VORHER twins_synchronisieren (import→repair→export) laufen lassen: Es adoptiert Quellen, ' +
        'deren Auswertung schon existiert, aber noch nicht verbucht ist — in einem gemessenen Lauf ' +
        'rund 90 Stueck, die der Scan sonst als unerschlossen meldet und die hier ein zweites Mal ' +
        'transkribiert wuerden. Ebenso VORHER umbenennen (familie_umziehen), nicht nachher. ' +
        'SCHREIBT; nur nach Bestaetigung.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        ...SOURCE_INPUTS,
        template: z.string().min(1).optional().describe('Transformations-Template; weglassen = Standard-Template der Library; "nur_transkript" = bewusst ohne Transformation'),
        zielsprache: z.string().min(2).max(5).optional().describe('Zielsprache (Default de)'),
        erzwingen: z.boolean().optional().describe(
          'WEGLASSEN ist der Normalfall: Der Server erkennt die Alt-Format-Konstellation ' +
          '(Transformation OHNE Transkript) selbst und uebergeht das Extract-Gate dann von sich ' +
          'aus — die Antwort weist das je Quelle als erzwungen="alt_format_erkannt" aus. ' +
          'true = immer uebergehen, false = nie (auch nicht bei erkanntem Alt-Format). ' +
          'Hintergrund: Ohne Uebergehen liest das Gate die vorhandene Transformation als Beweis ' +
          'fuers Transkript, der Job wird completed und schreibt nichts.'),
        sprecherErkennung: z.boolean().optional().describe(
          'NUR AUDIO. true = Sprecher-Modell (Weg mit_sprechererkennung), false = ohne (Weg ohne_sprechererkennung, ' +
          'danach manuell pruefen). Weglassen = Library-Voreinstellung transcriptionSpeakerMode, sichtbar als herkunft.'),
        kontext: z.string().max(2000).optional().describe('NUR AUDIO (P3a): Thema/Anlass als Freitext fuer die Transkription'),
        begriffe: z.array(z.string().min(1)).max(100).optional().describe('NUR AUDIO (P3a): Namen und Fachwoerter fuer diese Dateien; die Library-Namen ergaenzt der Server'),
        ...TRANSFORM_INPUTS,
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ libraryId, sourceId, quellPfad, sourceIds, template, zielsprache, erzwingen, sprecherErkennung, kontext, begriffe, folienAlsTabelle, anhangInSuche, begruendung }) => {
      try {
        return await mitProtokoll({ werkzeug: 'quelle_erschliessen', libraryId, akteur: mcpUserEmail(), begruendung, sourceId }, async () => {
          const userEmail = mcpUserEmail()
          const library = await requireLibrary(userEmail, libraryId)
          const provider = await requireProvider(userEmail, libraryId)
          const effectiveTemplate = template === 'nur_transkript' ? undefined : template ?? standardTemplate(library)
          // Das Modell kommt AUSSCHLIESSLICH aus der Library-Konfiguration
          // (Owner-Entscheid 28.08.2026): Der Client waehlt die VORLAGE, das
          // Modell gehoert dem Betreiber der Library, nicht dem Agenten.
          const effectiveModell = standardLlmModell(library)
          // Welle B: Audio-Kontext typgeprueft wie in der Pipeline-Route; P6 nur explizite Booleans.
          const audioContext = audioOptionenAusEingabe({ sprecherErkennung, kontext, begriffe })
          const optionen = { slidesAsTable: folienAlsTabelle, appendixInSearch: anhangInSuche }
          const wege: Array<AudioWeg | undefined> = []
          const batch = await runForSources({
            provider, sourceId, quellPfad, sourceIds,
            start: async (source) => {
              const kind = getFileKind(source.name)
              // W9: Die Alt-Format-Konstellation ist maschinell eindeutig —
              // sie hier zu pruefen kostet eine indizierte Abfrage und
              // erspart dem Agenten eine Entscheidung, die er nur raten kann.
              const twins = await getShadowTwinsBySourceIds({ libraryId, sourceIds: [source.itemId] })
              const entscheidung = entscheideErzwingen({ angefordert: erzwingen, doc: twins.get(source.itemId) ?? null })
              if (kind === 'audio' || kind === 'video') {
                const weg = kind === 'audio' ? bestimmeAudioWeg(audioContext, library) : undefined
                const { jobId } = await enqueueSourceTranscribeJob({
                  libraryId, userEmail, source, mediaType: kind,
                  template: effectiveTemplate, llmModel: effectiveModell, targetLanguage: zielsprache,
                  erzwingen: entscheidung.erzwingen, audioContext: kind === 'audio' ? audioContext : undefined, optionen,
                })
                wege.push(weg)
                return { jobId, erzwungen: entscheidung.grund, ...(weg ? { transkription: weg } : {}) }
              }
              const documentKind = documentMediaKindFromName(source.name)
              if (documentKind) {
                const { jobId } = await enqueueSourceDocumentJob({
                  libraryId, userEmail, source, mediaKind: documentKind,
                  template: effectiveTemplate, llmModel: effectiveModell, targetLanguage: zielsprache,
                  erzwingen: entscheidung.erzwingen, optionen,
                })
                return { jobId, erzwungen: entscheidung.grund }
              }
              throw new Error(
                `"${source.name}" ist ${kind} — quelle_erschliessen kann Audio/Video/PDF/DOCX/XLSX/PPTX; ` +
                  'Markdown und Sammeldateien sind schon Text: direkt transformation_starten (braucht kein Transkript)',
              )
            },
          })
          const wegeSumme = fasseWegeZusammen(wege)
          return jsonResult({
            ok: batch.gescheitert === 0,
            gestartet: batch.gestartet,
            gescheitert: batch.gescheitert,
            jobs: batch.zeilen,
            template: effectiveTemplate ?? null,
            // Die Sammelangabe sagt nur, was ANGEFORDERT war; was tatsaechlich
            // galt, steht je Quelle in `jobs[].erzwungen`.
            erzwingenAngefordert: erzwingen ?? null,
            erzwungenAutomatisch: batch.zeilen.filter((z) => z.erzwungen === 'alt_format_erkannt').length,
            // Welle B: die zwei Wege der Audio-Erschliessung, gezaehlt ueber den Stapel.
            ...(wegeSumme ? { wege: wegeSumme } : {}),
            audioKontext: { kontext: kontext ?? null, begriffe: begriffe ?? [], hinweis: Object.keys(audioContext).length > 0 && wege.every((w) => w === undefined) ? 'Kontext/Begriffe/Sprecher-Erkennung gelten nur fuer Audio-Quellen — hier war keine dabei' : null },
            llmModell: effectiveModell ?? null,
            modellHerkunft: modellHinweis(effectiveModell),
            hinweis: JOB_HINWEIS,
          })
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
