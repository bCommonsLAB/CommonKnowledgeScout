/**
 * @fileoverview `teppich_berechnen` — feste Plaetze des Teppichs ueber die Bruecke anstossen
 * (Plan `teppich-der-dokumente`, T1) — und `nachbarn_berechnen`, die Aehnlichkeits-Nachbarn,
 * die der Teppich voraussetzt (Owner 23.11.2026: ohne Umweg ueber die Graph-Ansicht).
 *
 * @description
 * Derselbe Auftrag wie `POST /api/library/<id>/doc-teppich/recompute`: EIN External Job
 * `doc-teppich`, der Worker fuehrt `phase-doc-teppich` aus. Ergebnis und Zaehler stehen
 * danach in `job_status` (Schritt `phase-doc-teppich`, Details). Owner und Co-Creator.
 *
 * @module mcp
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { isCoCreatorOrOwner, isLibraryOwner } from '@/lib/repositories/library-members-repo'
import { enqueueDocTeppichJob } from '@/lib/external-jobs/enqueue-doc-teppich'
import { enqueueDocSimilarityJob } from '@/lib/external-jobs/enqueue-doc-similarity'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary } from './tool-shared'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'

/** Registriert `teppich_berechnen` und `nachbarn_berechnen` (siehe Datei-Kommentar). */
export function registerTeppichTool(server: McpServer): void {
  server.registerTool(
    'teppich_berechnen',
    {
      title: 'Teppich der Dokumente berechnen (SCHREIBT)',
      description:
        'Rechnet fuer jedes Dokument der Library einen festen Platz auf dem Teppich der Dokumente ' +
        '(Hintergrund der Fragen-Sektion der Website): waagrecht der Rang in der Zeit, senkrecht die ' +
        'Ordnung nach Aehnlichkeit, dazu ein Gewicht nach dem Umfang. Schreibt teppich_x, teppich_y, ' +
        'teppich_gewicht und teppich_stand in die Metadaten; Seiten der Website bleiben aussen vor. ' +
        'Setzt die Aehnlichkeits-Nachbarn voraus; fehlen sie bei allen Dokumenten, scheitert der Job ' +
        'mit Hinweis. Laeuft als Job (kein Sprachmodell, keine Vector-Suche); Ergebnis und Zaehler ' +
        '(ohneDatum, ohneNachbarn, ohneUmfang) danach mit job_status. Nach neuen oder entfernten ' +
        'Dokumenten erneut aufrufen; bestehende Plaetze bleiben dabei nah. Owner und Co-Creator. ' +
        'SCHREIBT; nur nach Bestaetigung.',
      inputSchema: { libraryId: LIBRARY_ID, begruendung: BEGRUENDUNG },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ libraryId, begruendung }) => {
      try {
        return await mitProtokoll(
          { werkzeug: 'teppich_berechnen', libraryId, akteur: mcpUserEmail(), begruendung },
          async () => {
            const userEmail = mcpUserEmail()
            await requireLibrary(userEmail, libraryId)
            if (!(await isCoCreatorOrOwner(libraryId, userEmail))) {
              throw new Error(`Nur Owner und Co-Creator der Library ${libraryId} duerfen den Teppich berechnen`)
            }
            const { jobId } = await enqueueDocTeppichJob({ libraryId, userEmail })
            const { ExternalJobsWorker } = await import('@/lib/external-jobs-worker')
            // Best effort wie die Route: Der Job bleibt queued, falls der Anstoss scheitert.
            const angestossen = await ExternalJobsWorker.tickNow().then(() => true, () => false)
            return jsonResult({
              libraryId,
              jobId,
              angestossen,
              hinweis: 'Ergebnis mit job_status abfragen (Schritt phase-doc-teppich, Details).',
            })
          },
        )
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    'nachbarn_berechnen',
    {
      title: 'Aehnlichkeits-Nachbarn berechnen (SCHREIBT)',
      description:
        'Rechnet fuer jedes Dokument der Library seine aehnlichsten Dokumente und speichert sie ' +
        '(similarity_neighbors in den Metadaten). Grundlage fuer teppich_berechnen und die ' +
        'Graph-Ansicht der Galerie; derselbe Auftrag wie dort „Nachbarn neu berechnen". Laeuft als ' +
        'Job mit einer Vector-Suche je Dokument, nacheinander (schont die Datenbank) — bei ' +
        'tausenden Dokumenten bis zu einer Stunde. Fortschritt und Ergebnis mit job_status; ' +
        'danach teppich_berechnen. Nur Owner. SCHREIBT; nur nach Bestaetigung.',
      inputSchema: { libraryId: LIBRARY_ID, begruendung: BEGRUENDUNG },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ libraryId, begruendung }) => {
      try {
        return await mitProtokoll(
          { werkzeug: 'nachbarn_berechnen', libraryId, akteur: mcpUserEmail(), begruendung },
          async () => {
            const userEmail = mcpUserEmail()
            await requireLibrary(userEmail, libraryId)
            if (!(await isLibraryOwner(libraryId, userEmail))) {
              throw new Error(`Nur der Owner der Library ${libraryId} darf die Nachbarn berechnen`)
            }
            const { jobId } = await enqueueDocSimilarityJob({ libraryId, userEmail })
            const { ExternalJobsWorker } = await import('@/lib/external-jobs-worker')
            // Best effort wie die Route: Der Job bleibt queued, falls der Anstoss scheitert.
            const angestossen = await ExternalJobsWorker.tickNow().then(() => true, () => false)
            return jsonResult({
              libraryId,
              jobId,
              angestossen,
              hinweis: 'Fortschritt mit job_status; wenn completed, teppich_berechnen aufrufen.',
            })
          },
        )
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
