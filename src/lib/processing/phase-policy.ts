/**
 * @fileoverview Phase Policy - Processing Phase Control Policies
 * 
 * @description
 * Central policy system for controlling processing phases (extract, metadata, ingest).
 * Defines phase directives (ignore, do, force) and provides utilities for policy
 * extraction from job parameters. Supports legacy flag conversion and gate-based
 * phase execution decisions.
 * 
 * @module processing
 * 
 * @exports
 * - PhaseDirective: Type for phase directives
 * - PhasePolicies: Interface for phase policies
 * - shouldRunWithGate: Determines if phase should run based on gate and directive
 * - shouldRunExtract: Determines if extraction should run
 * - legacyToPolicies: Converts legacy flags to policies
 * - getPolicies: Extracts policies from job parameters
 * 
 * @usedIn
 * - src/lib/external-jobs: External jobs use phase policies
 * - src/lib/processing/gates.ts: Gates use phase policies
 * - src/app/api/secretary: Secretary API routes use policies
 * 
 * @dependencies
 * - @/types/external-job: ExternalJob type definitions
 */

import type { ExternalJob } from '@/types/external-job';

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














