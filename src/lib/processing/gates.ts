import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import { FileSystemProvider } from '@/lib/storage/filesystem-provider';
import type { Library } from '@/types/library';

export interface GateContext {
  repo: ExternalJobsRepository;
  jobId: string;
  userEmail: string;
  library: Library | null | undefined;
  source: { itemId?: string; parentId?: string; name?: string } | undefined;
  options: { targetLanguage?: string } | undefined;
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
  // 1) Shadow‑Twin per Namensschema prüfen
  if (library?.type === 'local' && library.path && source?.parentId) {
    try {
      const provider = new FileSystemProvider(library.path);
      const siblings = await provider.listItemsById(source.parentId);
      const base = getBaseName(source.name);
      const lang = (options?.targetLanguage || 'de').toLowerCase();
      const expected = base ? `${base}.${lang}.md` : undefined;
      if (expected && siblings.some(it => it.type === 'file' && it.metadata?.name?.toLowerCase?.() === expected.toLowerCase())) {
        return { exists: true, reason: 'shadow_twin_exists', details: { matched: expected } };
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


