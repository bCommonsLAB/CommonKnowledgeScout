/**
 * @fileoverview Publikations-Aktion (Promote) als Route-Logik (ADR-0004 §E3, W5).
 *
 * @description
 * Publiziert eine abgenommene Submission (`ready`) in den Ziel-Provider und den
 * RAG-Index - der EINZIGE Schritt, der den Ziel-Provider beschreibt
 * (ADR-0004-Invariante). Nur Reviewer (`owner`/`co-creator`); `contributor`/
 * `moderator` duerfen nicht publizieren. Status-Maschine ready->publishing->
 * published; bei Token-/Speicher-Fehler Ruecksprung publishing->ready
 * (retry-bar, kein halb-geschriebener Zustand). Idempotent: bereits `published`
 * -> No-Op. Spiegelt das Auth-/Reviewer-Muster von `review-actions.ts`; der
 * reine Schreib-/Ingest-Schritt liegt in `promotion.ts`.
 *
 * @see docs/adr/0004-capture-publish-entkopplung-inbox-modell.md (§E3)
 * @module lib/submissions
 */

import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getPreferredUserEmail } from '@/lib/auth/user-email';
import { isCoCreatorOrOwner } from '@/lib/repositories/library-members-repo';
import {
  changeSubmissionStatus,
  getSubmissionById,
} from '@/lib/repositories/wizard-submissions-repo';
import { getServerProvider } from '@/lib/storage/server-provider';
import { getInboxProvider } from '@/lib/storage/inbox/inbox-provider-entry';
import { IngestionService } from '@/lib/chat/ingestion-service';
import {
  promoteSubmission,
  type LoadOriginalFn,
  type WriteTranscriptArtifactFn,
} from '@/lib/submissions/promotion';
import { LibraryService } from '@/lib/services/library-service';
import { getShadowTwinConfig } from '@/lib/shadow-twin/shadow-twin-config';
import { writeArtifact } from '@/lib/shadow-twin/artifact-writer';
import { ShadowTwinService } from '@/lib/shadow-twin/store/shadow-twin-service';
import { classifyPromotionError, type PromotionFailure } from '@/lib/submissions/promotion-errors';
import { FileLogger } from '@/lib/debug/logger';

/** HTTP-Status je Fehlerklasse: Konfig -> 422, transiente Fehler -> 503. */
function statusForFailure(failure: PromotionFailure): number {
  return failure.kind === 'config' ? 422 : 503;
}

/**
 * Setzt eine in `publishing` haengende Submission zurueck auf `ready`
 * (retry-bar, kein Hard-Fail). Loggt, falls auch der Ruecksprung scheitert -
 * der urspruengliche Publish-Fehler bleibt dann fuer die Antwort massgeblich.
 */
async function revertToReady(id: string, actor: string, note: string): Promise<void> {
  try {
    await changeSubmissionStatus(id, { to: 'ready', actor, at: new Date().toISOString(), note });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannt';
    FileLogger.error('api/submissions promote', `Ruecksprung auf ready fehlgeschlagen (${id})`, message);
  }
}

/**
 * Fuehrt die Publikation aus. Die RAG-Ingestion wird ueber einen schmalen
 * Adapter injiziert, damit `promoteSubmission` rein bleibt.
 */
export async function performPromotion(id: string): Promise<NextResponse> {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    const email = getPreferredUserEmail(await currentUser());
    if (!email) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 });

    const existing = await getSubmissionById(id);
    if (!existing) return NextResponse.json({ error: 'Submission nicht gefunden' }, { status: 404 });
    if (!(await isCoCreatorOrOwner(existing.libraryId, email))) {
      return NextResponse.json({ error: 'Keine Berechtigung zur Publikation' }, { status: 403 });
    }

    // Idempotenz: bereits publiziert -> No-Op (kein erneutes Schreiben).
    if (existing.status === 'published') {
      return NextResponse.json({ submission: existing, alreadyPublished: true });
    }

    // ready -> publishing. Die reine Status-Maschine wirft
    // `InvalidSubmissionTransitionError` (-> 409), wenn nicht `ready`
    // (z.B. draft/pending/publishing/rejected).
    const publishing = await changeSubmissionStatus(id, {
      to: 'publishing',
      actor: email,
      at: new Date().toISOString(),
    });

    try {
      const provider = await getServerProvider(email, publishing.libraryId);

      // Befund B: Original(e) aus der Inbox-Quarantaene zusaetzlich ins Ziel
      // kopieren. Nur wenn Binaer-Quellen vorliegen (Text-/URL-Submissions
      // haben keine) — sonst kein Inbox-Provider noetig.
      let loadOriginal: LoadOriginalFn | undefined;
      if (publishing.binaryRefs.length > 0) {
        const inboxProvider = await getInboxProvider(email, publishing.libraryId);
        loadOriginal = async (ref) => {
          if (!ref.itemId) {
            // Kein stiller Fallback: Legacy-Ref ohne Inbox-Item-ID -> laut scheitern.
            throw new Error(`Promotion: binaryRef ohne itemId (${ref.fileName}) - Original nicht ladbar`);
          }
          const { blob } = await inboxProvider.getBinary(ref.itemId);
          return blob;
        };
      }

      // Befund B2a: Transcript-only (docType='transcript') legt das Transkript als
      // Shadow-Twin der Ziel-Quelle ab — kanonisch ueber die bestehenden Primitive,
      // KEINE Doppellogik. Filesystem-Libraries schreiben in den Dot-Folder
      // (`writeArtifact`), Mongo-Libraries in den Mongo-Store (`ShadowTwinService`).
      // Die Store-Wahl folgt `getShadowTwinConfig` (storage-agnostisch).
      const writeTranscriptArtifact: WriteTranscriptArtifactFn = async ({
        sourceId,
        sourceName,
        parentId,
        markdown,
        targetLanguage,
      }) => {
        const library = await LibraryService.getInstance().getLibraryById(publishing.libraryId);
        if (!library) {
          throw new Error(`Promotion: Library nicht gefunden: ${publishing.libraryId}`);
        }
        const cfg = getShadowTwinConfig(library);
        if (cfg.primaryStore === 'mongo') {
          const svc = await ShadowTwinService.create({ library, userEmail: email, sourceId, sourceName, parentId });
          const res = await svc.upsertMarkdown({ kind: 'transcript', targetLanguage, markdown });
          return { artifactId: res.id, artifactName: res.name };
        }
        // Filesystem-Default: kanonisch in den Dot-Folder `.{source}/` schreiben.
        const res = await writeArtifact(provider, {
          key: { sourceId, kind: 'transcript', targetLanguage },
          sourceName,
          parentId,
          content: markdown,
          createFolder: true,
        });
        return { artifactId: res.file.id, artifactName: res.file.metadata.name };
      };

      const result = await promoteSubmission({
        submission: publishing,
        provider,
        upsertMarkdown: (userEmail, libraryId, fileId, fileName, markdown, meta) =>
          IngestionService.upsertMarkdown(userEmail, libraryId, fileId, fileName, markdown, meta),
        userEmail: email,
        loadOriginal,
        writeTranscriptArtifact,
      });
      const published = await changeSubmissionStatus(id, {
        to: 'published',
        actor: email,
        at: new Date().toISOString(),
        note: `Veroeffentlicht: ${result.savedItemId}`,
      });
      // Zielordner + Dateiname an den Client zurueck, damit die Wizard-Summary
      // den realen Speicherort zeigen kann (Quelle/Zielordner/generierte Datei).
      return NextResponse.json({
        submission: published,
        savedItemId: result.savedItemId,
        fileName: result.fileName,
        targetFolderId: result.targetFolderId,
        targetFolderName: result.targetFolderName,
      });
    } catch (error) {
      // Token/Speicher/Konfig: Ruecksprung auf `ready`, nie `failed` - retry-bar.
      const failure = classifyPromotionError(error);
      await revertToReady(id, email, `Publikation fehlgeschlagen (${failure.kind}): ${failure.message}`);
      FileLogger.error('api/submissions promote', `Publikation fehlgeschlagen (${id})`, failure.message);
      return NextResponse.json(
        {
          error: failure.message,
          kind: failure.kind,
          retryable: failure.retryable,
          needsReauth: failure.needsReauth,
        },
        { status: statusForFailure(failure) },
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Interner Fehler';
    const name = error instanceof Error ? error.name : '';
    // Unzulaessiger Uebergang (nicht `ready`) -> 409, verschwundene Submission -> 404, sonst 500.
    const status =
      name === 'InvalidSubmissionTransitionError' ? 409 : name === 'SubmissionNotFoundError' ? 404 : 500;
    FileLogger.error('api/submissions promote', 'Publikation fehlgeschlagen', message);
    return NextResponse.json({ error: message }, { status });
  }
}
