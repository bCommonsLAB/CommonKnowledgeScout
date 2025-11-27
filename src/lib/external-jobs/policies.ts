/**
 * @fileoverview External Jobs Policies Reader - Phase Policy Extraction
 * 
 * @description
 * Extracts phase policies from job parameters. Reads metadata and ingestion policies
 * from job configuration and returns PhasePolicies object used for controlling
 * processing behavior.
 * 
 * @module external-jobs
 * 
 * @exports
 * - readPhasesAndPolicies: Extracts phase policies from request context
 * 
 * @usedIn
 * - src/app/api/external/jobs/[jobId]/route.ts: Job callback uses policies
 * 
 * @dependencies
 * - @/lib/processing/phase-policy: Policy extraction utilities
 * - @/types/external-jobs: PhasePolicies and RequestContext types
 */

import type { PhasePolicies, RequestContext } from '@/types/external-jobs'
import { getPolicies } from '@/lib/processing/phase-policy'

export function readPhasesAndPolicies(ctxOrParams: RequestContext | Record<string, unknown> | undefined): PhasePolicies {
  const parameters = (ctxOrParams && 'job' in ctxOrParams && (ctxOrParams as RequestContext).job?.parameters)
    ? (ctxOrParams as RequestContext).job.parameters || {}
    : (ctxOrParams && typeof ctxOrParams === 'object' && !('job' in ctxOrParams))
      ? ctxOrParams as Record<string, unknown>
      : {}
  const p = getPolicies({ parameters })
  return { metadata: p.metadata, ingest: p.ingest }
}


