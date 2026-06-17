/**
 * @fileoverview Injektionen fuer die Promote-Aktion (ADR-0004, Befund B1/B2a/B2d).
 *
 * @description
 * Baut die storage-nahen Abhaengigkeiten, die `promoteSubmission` rein halten:
 * - `loadOriginal`: laedt Original-Binaries aus der Inbox (B1).
 * - `writeTranscriptArtifact`: legt das Transkript als Shadow-Twin der Ziel-Quelle
 *   ab — FS-Dot-Folder (`writeArtifact`) vs. Mongo (`ShadowTwinService`) je Config (B2a).
 * - `mirrorAssets`: spiegelt die Extract-Bilder aus der Inbox ueber den Ziel-
 *   `ShadowTwinService` ins Archiv (B2d V2, FS/Mongo an EINER Stelle).
 *
 * Ausgelagert aus `promote-actions.ts` (200-Zeilen-Grenze) — keine Auth/Status-
 * Logik hier, nur die reinen Schreib-/Lese-Adapter.
 *
 * @see docs/analysis/b2d-mikroentscheidungen.md
 * @module lib/submissions
 */

import type { StorageProvider } from '@/lib/storage/types';
import type { WizardSubmission } from '@/types/wizard-submission';
import type {
  LoadOriginalFn,
  MirrorAssetsFn,
  WriteTranscriptArtifactFn,
} from '@/lib/submissions/promotion';
import { getInboxProvider } from '@/lib/storage/inbox/inbox-provider-entry';
import { LibraryService } from '@/lib/services/library-service';
import { getShadowTwinConfig } from '@/lib/shadow-twin/shadow-twin-config';
import { writeArtifact } from '@/lib/shadow-twin/artifact-writer';
import { ShadowTwinService } from '@/lib/shadow-twin/store/shadow-twin-service';
import { mirrorInboxAssetsToTarget } from '@/lib/submissions/promotion-assets';

/** Gebuendelte Injektionen fuer `promoteSubmission`. */
export interface PromotionInjections {
  loadOriginal?: LoadOriginalFn;
  writeTranscriptArtifact: WriteTranscriptArtifactFn;
  mirrorAssets: MirrorAssetsFn;
}

/**
 * Baut die Injektionen fuer eine konkrete Submission. Der Inbox-Provider wird nur
 * erstellt, wenn Binaer-Quellen vorliegen (Text-/URL-Submissions haben keine);
 * `loadOriginal` bleibt dann `undefined` (kein Original zu kopieren).
 */
export async function buildPromotionInjections(args: {
  email: string;
  submission: WizardSubmission;
  provider: StorageProvider;
}): Promise<PromotionInjections> {
  const { email, submission, provider } = args;

  let inboxProvider: StorageProvider | undefined;
  if (submission.binaryRefs.length > 0) {
    inboxProvider = await getInboxProvider(email, submission.libraryId);
  }

  const loadOriginal: LoadOriginalFn | undefined = inboxProvider
    ? async (ref) => {
        if (!ref.itemId) {
          // Kein stiller Fallback: Legacy-Ref ohne Inbox-Item-ID -> laut scheitern.
          throw new Error(`Promotion: binaryRef ohne itemId (${ref.fileName}) - Original nicht ladbar`);
        }
        const { blob } = await inboxProvider!.getBinary(ref.itemId);
        return blob;
      }
    : undefined;

  // B2a: Transcript-only legt das Transkript als Shadow-Twin der Ziel-Quelle ab —
  // kanonisch ueber die bestehenden Primitive, KEINE Doppellogik. Die Store-Wahl
  // folgt `getShadowTwinConfig` (storage-agnostisch).
  const writeTranscriptArtifact: WriteTranscriptArtifactFn = async ({
    sourceId,
    sourceName,
    parentId,
    markdown,
    targetLanguage,
  }) => {
    const library = await LibraryService.getInstance().getLibraryById(submission.libraryId);
    if (!library) throw new Error(`Promotion: Library nicht gefunden: ${submission.libraryId}`);
    const cfg = getShadowTwinConfig(library);
    if (cfg.primaryStore === 'mongo') {
      const svc = await ShadowTwinService.create({ library, userEmail: email, sourceId, sourceName, parentId });
      const res = await svc.upsertMarkdown({ kind: 'transcript', targetLanguage, markdown });
      return { artifactId: res.id, artifactName: res.name };
    }
    const res = await writeArtifact(provider, {
      key: { sourceId, kind: 'transcript', targetLanguage },
      sourceName,
      parentId,
      content: markdown,
      createFolder: true,
    });
    return { artifactId: res.file.id, artifactName: res.file.metadata.name };
  };

  // B2d V2: Extract-Bilder aus dem Inbox-Shadow-Twin ueber den Ziel-
  // `ShadowTwinService` spiegeln (FS/Mongo an einer Stelle, idempotent).
  const mirrorAssets: MirrorAssetsFn = async ({ sourceRef, targetSourceId, parentId }) => {
    if (!sourceRef.itemId) {
      throw new Error(`Asset-Spiegelung: binaryRef ohne itemId (${sourceRef.fileName})`);
    }
    if (!inboxProvider) {
      throw new Error('Asset-Spiegelung: Inbox-Provider fehlt (keine Binaer-Quelle)');
    }
    const library = await LibraryService.getInstance().getLibraryById(submission.libraryId);
    if (!library) throw new Error(`Promotion: Library nicht gefunden: ${submission.libraryId}`);
    const targetService = await ShadowTwinService.create({
      library,
      userEmail: email,
      sourceId: targetSourceId,
      sourceName: sourceRef.fileName,
      parentId,
    });
    return mirrorInboxAssetsToTarget({
      inboxProvider,
      targetProvider: provider,
      targetService,
      sourceItemId: sourceRef.itemId,
      sourceName: sourceRef.fileName,
      targetParentId: parentId,
    });
  };

  return { loadOriginal, writeTranscriptArtifact, mirrorAssets };
}
