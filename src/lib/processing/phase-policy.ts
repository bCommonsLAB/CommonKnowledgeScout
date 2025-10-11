import type { ExternalJob } from '@/types/external-jobs';

// Zentrale, typisierte Steuerung je Phase
export type PhaseDirective = 'ignore' | 'do' | 'force';

export interface PhasePolicies {
  extract: PhaseDirective;
  metadata: PhaseDirective;
  ingest: PhaseDirective;
}

export function shouldRunWithGate(gateExists: boolean, directive: PhaseDirective): boolean {
  if (directive === 'ignore') return false;
  if (directive === 'force') return true;
  return !gateExists; // 'do' respektiert Gate
}

export function shouldRunExtract(shadowTwinExists: boolean, directive: PhaseDirective): boolean {
  return shouldRunWithGate(shadowTwinExists, directive);
}

// Kompatibilität: Bestehende Flags → Policies
export function legacyToPolicies(params: unknown): PhasePolicies {
  const p = (params || {}) as Record<string, unknown>;
  const doExtractPDF = Boolean(p['doExtractPDF']);
  const doExtractMetadata = Boolean(p['doExtractMetadata']);
  const doIngestRAG = Boolean(p['doIngestRAG']);
  const forceRecreate = Boolean(p['forceRecreate']);
  const forceTemplate = Boolean(p['forceTemplate']);
  const extract: PhaseDirective = forceRecreate ? 'force' : (doExtractPDF ? 'do' : 'ignore');
  const metadata: PhaseDirective = doExtractMetadata ? (forceTemplate ? 'force' : 'do') : 'ignore';
  const ingest: PhaseDirective = doIngestRAG ? 'do' : 'ignore';
  return { extract, metadata, ingest };
}

export function getPolicies(job: Pick<ExternalJob, 'parameters'>): PhasePolicies {
  const raw = (job.parameters || {}) as Record<string, unknown>;
  const p = raw['policies'] as PhasePolicies | undefined;
  if (p && p.extract && p.metadata && p.ingest) return p;
  return legacyToPolicies(raw);
}














