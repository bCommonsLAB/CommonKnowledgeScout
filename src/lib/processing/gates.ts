/**
 * @fileoverview Processing Gates - Phase Gate Checking Utilities
 * 
 * @description
 * Utilities for checking processing gates before executing transformation phases.
 * Determines if extraction, template transformation, or RAG ingestion should be skipped
 * based on existing artifacts (shadow twins, frontmatter, ingestion status). Prevents
 * redundant processing and supports policy-based phase control.
 * 
 * @module processing
 * 
 * @exports
 * - gateExtractPdf: Checks if PDF extraction should be skipped
 * - gateTransformTemplate: Checks if template transformation should be skipped
 * - gateIngestRag: Checks if RAG ingestion should be skipped
 * - GateContext: Context interface for gate checking
 * - GateResult: Result interface for gate checks
 * 
 * @usedIn
 * - src/lib/external-jobs/template-decision.ts: Template decision uses gates
 * - src/lib/external-jobs: External jobs use gates
 * 
 * @dependencies
 * - @/lib/external-jobs-repository: Job repository for artifact checking
 * - @/lib/storage/server-provider: Storage provider for file checking
 * - @/types/library: Library type definitions
 */

import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import { getServerProvider } from '@/lib/storage/server-provider';
import type { StorageProvider } from '@/lib/storage/types';
import type { Library } from '@/types/library';
import { resolveArtifact } from '@/lib/shadow-twin/artifact-resolver';

export interface GateContext {
  repo: ExternalJobsRepository;
  jobId: string;
  userEmail: string;
  library: Library | null | undefined;
  source: { itemId?: string; parentId?: string; name?: string } | undefined;
  options: { targetLanguage?: string } | undefined;
  /**
   * Optional: Re-use an already created storage provider (request-local),
   * to avoid redundant provider creation and repeated list/get calls.
   *
   * WICHTIG: Der Provider muss zur angegebenen Library gehören.
   */
  provider?: StorageProvider;
}

export interface GateResult {
  exists: boolean;
  reason?: 'shadow_twin_exists' | 'frontmatter_complete' | 'ingest_exists' | 'previous_job_saved' | 'unknown';
  details?: Record<string, unknown>;
}

function getBaseName(name: string | undefined): string | undefined {
  if (!name) return undefined;
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.substring(0, idx) : name;
}

export async function gateExtractPdf(ctx: GateContext): Promise<GateResult> {
  const { repo, userEmail, library, source, options } = ctx;
  
  // 1) Shadow‑Twin per Namensschema prüfen (erweiterte Suche: Verzeichnis oder Datei)
  if (library && source?.parentId && source?.name && source?.itemId) {
    try {
      // Re-use provider if provided by caller (reduces redundant storage calls)
      const provider = ctx.provider ?? await getServerProvider(userEmail, library.id);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const base = getBaseName(source.name);
      const lang = (options?.targetLanguage || 'de').toLowerCase();
      
      // v2-only: Prüfe zuerst Transcript (häufigster Fall)
      const resolvedTranscript = await resolveArtifact(provider, {
        sourceItemId: source.itemId,
        sourceName: source.name,
        parentId: source.parentId,
        targetLanguage: lang,
        preferredKind: 'transcript',
      });

      if (resolvedTranscript) {
        return {
          exists: true,
          reason: 'shadow_twin_exists',
          details: {
            type: resolvedTranscript.location === 'dotFolder' ? 'folder' : 'file',
            fileId: resolvedTranscript.fileId,
            fileName: resolvedTranscript.fileName,
            location: resolvedTranscript.location,
            shadowTwinFolderId: resolvedTranscript.shadowTwinFolderId,
          },
        };
      }

      // Prüfe Transformation (falls kein Transcript gefunden)
      const resolvedTransformation = await resolveArtifact(provider, {
        sourceItemId: source.itemId,
        sourceName: source.name,
        parentId: source.parentId,
        targetLanguage: lang,
        preferredKind: 'transformation',
      });

      if (resolvedTransformation) {
        return {
          exists: true,
          reason: 'shadow_twin_exists',
          details: {
            type: resolvedTransformation.location === 'dotFolder' ? 'folder' : 'file',
            fileId: resolvedTransformation.fileId,
            fileName: resolvedTransformation.fileName,
            location: resolvedTransformation.location,
            shadowTwinFolderId: resolvedTransformation.shadowTwinFolderId,
          },
        };
      }
    } catch {
      // ignore
    }
  }
  
  // 2) Fallback: letzter Job, der bereits einen Shadow‑Twin gespeichert hat
  if (source?.itemId && library?.id) {
    try {
      const latest = await repo.findLatestBySourceItem(userEmail, library.id, source.itemId);
      if (latest?.result?.savedItemId) {
        return { exists: true, reason: 'previous_job_saved', details: { savedItemId: latest.result.savedItemId } };
      }
    } catch {
      // ignore
    }
  }
  return { exists: false };
}

export async function gateTransformTemplate(ctx: GateContext): Promise<GateResult> {
  const { repo, jobId } = ctx;
  // Wenn cumulativeMeta bereits via template_transform final ist
  try {
    const job = await repo.get(jobId);
    const hasTemplateTransform = Array.isArray(job?.metaHistory)
      && job?.metaHistory?.some(e => e && typeof e === 'object' && (e as { source?: string }).source === 'template_transform');
    if (hasTemplateTransform) return { exists: true, reason: 'frontmatter_complete' };
  } catch {
    // ignore
  }
  return { exists: false };
}

export async function gateIngestRag(ctx: GateContext & { ingestionCheck?: (args: { userEmail: string; libraryId: string; fileId: string }) => Promise<boolean> }): Promise<GateResult> {
  const { library, source, ingestionCheck, userEmail } = ctx;
  const fileId = source?.itemId;
  if (!library?.id || !fileId) return { exists: false };
  try {
    if (ingestionCheck) {
      const exists = await ingestionCheck({ userEmail, libraryId: library.id, fileId });
      if (exists) return { exists: true, reason: 'ingest_exists' };
    }
  } catch {
    // ignore
  }
  return { exists: false };
}


