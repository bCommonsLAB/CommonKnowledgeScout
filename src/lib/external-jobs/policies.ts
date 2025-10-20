import type { PhasePolicies, RequestContext } from '@/types/external-jobs'
import { getPolicies } from '@/lib/processing/phase-policy'

export function readPhasesAndPolicies(ctx: RequestContext): PhasePolicies {
  const parameters = ctx.job.parameters || {}
  const p = getPolicies({ parameters })
  return { metadata: p.metadata, ingest: p.ingest }
}


