/**
 * @fileoverview POST /api/submissions/[id]/analyze — Stufe-B-Analyse starten (Welle III).
 *
 * @description
 * Startet die Analyse (PDF -> Transkript -> Transform) fuer eine `pending`-
 * Submission als Inbox-External-Job: `providerScope='inbox'` (Pipeline laeuft
 * ueber den Inbox-Provider, ADR-0004-Invariante) und `phases.ingest=false`
 * (Publikation = W5). Rechte: Erfasser der Submission ODER Reviewer
 * (co-creator/owner). Der Worker uebernimmt den queued Job; das Ergebnis
 * fliesst bei Completion in die Submission zurueck (submission-analysis.ts).
 *
 * @see docs/architecture/api-route-conventions.md
 * @see docs/wizards/contributor-pdf-upload-wizard.md (Stufe B)
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getPreferredUserEmail } from '@/lib/auth/user-email';
import { isCoCreatorOrOwner } from '@/lib/repositories/library-members-repo';
import { getSubmissionById } from '@/lib/repositories/wizard-submissions-repo';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import { getInboxProvider } from '@/lib/storage/inbox/inbox-provider-entry';
import {
  getDefaultTemplateNameForViewType,
  resolveBuiltinDefaultTemplateByName,
} from '@/lib/templates/default-templates';
import {
  buildSubmissionAnalysisJob,
  buildSubmissionAnalysisParameters,
  buildSubmissionAnalysisSteps,
  pickAnalyzableSource,
  type AnalyzableSource,
} from '@/lib/submissions/submission-analysis-job';
import { getJobEventBus } from '@/lib/events/job-event-bus';
import { ExternalJobsWorker } from '@/lib/external-jobs-worker';
import { FileLogger } from '@/lib/debug/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    const email = getPreferredUserEmail(await currentUser());
    if (!email) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 });

    // 5a: Optionaler Body `{ mode?: 'transcript' }`. Fehlt der Body, gilt die
    // volle Aufbereitung (Transform) — das ist der dokumentierte Default, kein
    // stiller Fallback. Ein unbekannter mode-Wert wird laut abgelehnt.
    let transcriptOnly = false;
    try {
      const body: unknown = await req.json();
      if (body && typeof body === 'object' && 'mode' in body) {
        const mode = (body as { mode?: unknown }).mode;
        if (mode === 'transcript') transcriptOnly = true;
        else if (mode !== undefined) {
          return NextResponse.json(
            { error: `Unbekannter mode: "${String(mode)}" (erlaubt: "transcript")` },
            { status: 400 },
          );
        }
      }
    } catch {
      // Kein/ungueltiger JSON-Body = Standard-Analyse (Transform). POST ohne Body erlaubt.
    }

    const submission = await getSubmissionById(id);
    if (!submission) {
      return NextResponse.json({ error: 'Submission nicht gefunden' }, { status: 404 });
    }

    // Rechte: Erfasser selbst (Stufe B gehoert zum Contributor-Wizard) oder Reviewer.
    const isCreator = submission.createdBy.toLowerCase() === email.toLowerCase();
    if (!isCreator && !(await isCoCreatorOrOwner(submission.libraryId, email))) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });
    }

    // Analyse nur im Wartekorb-Status (Stufe A erzeugt pending).
    if (submission.status !== 'pending') {
      return NextResponse.json(
        { error: `Analyse nur im Status "pending" moeglich (aktuell "${submission.status}")` },
        { status: 409 },
      );
    }

    let source: AnalyzableSource;
    try {
      source = pickAnalyzableSource(submission);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Keine analysierbare Quelle' },
        { status: 422 },
      );
    }
    const { ref, media } = source;

    // Pre-flight (an F11 angeglichen): Die Inbox-Analyse nutzt die im Code
    // persistierte Standard-Vorlage des detailViewType (z.B. 'standard-book').
    // Hier fruehzeitig pruefen, dass dazu ein Builtin existiert — sonst scheitert
    // der Transform-Schritt spaet + unsichtbar (no-silent-fallbacks). Kein
    // user-erstelltes Template noetig; nur ein bekannter detailViewType.
    const defaultTemplateName = getDefaultTemplateNameForViewType(submission.detailViewType);
    if (!resolveBuiltinDefaultTemplateByName(defaultTemplateName)) {
      return NextResponse.json(
        {
          error:
            `Kein Standard-Template fuer detailViewType "${submission.detailViewType}". ` +
            'Die Submission wurde mit einem unbekannten Typ erfasst.',
        },
        { status: 422 },
      );
    }

    // Quelle ueber den Inbox-Provider aufloesen (Existenz + parentId) —
    // Provider ist die einzige Pfad-Autoritaet, keine Pfad-Rekonstruktion.
    const provider = await getInboxProvider(email, submission.libraryId);
    const sourceItem = await provider.getItemById(ref.itemId as string);

    const repo = new ExternalJobsRepository();
    const jobId = crypto.randomUUID();
    const jobSecret = crypto.randomBytes(24).toString('base64url');
    const job = buildSubmissionAnalysisJob({
      submission,
      source,
      parentId: sourceItem.parentId,
      userEmail: email,
      jobId,
      jobSecretHash: repo.hashSecret(jobSecret),
    });

    await repo.create(job);
    await repo.initializeSteps(
      jobId,
      buildSubmissionAnalysisSteps(media.extractStepName),
      buildSubmissionAnalysisParameters(submission, media, { transcriptOnly }),
    );
    try {
      await repo.initializeTrace(jobId);
      await repo.traceAddEvent(jobId, {
        name: 'submission_analyze_submit',
        attributes: {
          submissionId: submission.id,
          libraryId: submission.libraryId,
          fileName: ref.fileName,
          template: submission.docType,
          providerScope: 'inbox',
        },
      });
    } catch {
      // Trace ist Diagnose, nicht Teil des Vertrags — Anlegen des Jobs zaehlt.
    }

    try {
      getJobEventBus().emitUpdate(email, {
        type: 'job_update',
        jobId,
        status: 'queued',
        progress: 0,
        message: 'queued',
        updatedAt: new Date().toISOString(),
        jobType: job.job_type,
        fileName: ref.fileName,
        sourceItemId: ref.itemId,
      });
    } catch {
      // SSE-Fehler nicht kritisch — Job ist angelegt, Worker uebernimmt.
    }

    FileLogger.info('api/submissions analyze', 'Inbox-Analyse-Job angelegt', {
      jobId,
      submissionId: submission.id,
      libraryId: submission.libraryId,
    });

    // Worker sofort anstossen (best-effort, in-process): Der queued Job soll nicht
    // erst beim naechsten Hintergrund-Poll starten — oder gar nicht, falls der
    // Worker in dieser Instanz noch nicht laeuft (Dev/HMR). Schon der Import oben
    // startet den Worker per Auto-Start; `tickNow` dispatcht zusaetzlich sofort.
    // Spiegelt den Tick der normalen Pipeline (api/pipeline/process). Fire-and-
    // forget: blockiert die 202-Antwort nicht; bei Fehler holt der Poll den Job.
    try {
      if (typeof ExternalJobsWorker.tickNow === 'function') {
        void ExternalJobsWorker.tickNow().catch((err) => {
          FileLogger.warn('api/submissions analyze', 'Worker-Tick nach Job-Anlage fehlgeschlagen', {
            jobId,
            err: err instanceof Error ? err.message : String(err),
          });
        });
      } else if (ExternalJobsWorker.getStatus().state !== 'running') {
        ExternalJobsWorker.start();
      }
    } catch (err) {
      FileLogger.warn('api/submissions analyze', 'Worker-Poke nach Job-Anlage fehlgeschlagen', {
        jobId,
        err: err instanceof Error ? err.message : String(err),
      });
    }

    return NextResponse.json({ status: 'accepted', jobId }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Interner Fehler';
    FileLogger.error('api/submissions analyze', 'Analyse-Start fehlgeschlagen', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
