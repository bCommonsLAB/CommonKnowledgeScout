/**
 * @fileoverview Characterization Tests fuer phase-template.ts (Skip-Paths).
 *
 * Plan-Schritt 3 (Sicherheitsnetz vor Refactor) der Pilot-Welle external-jobs.
 *
 * Die Skip-Logik ist die haeufigste Quelle subtiler Bugs in der Template-Phase
 * (siehe Audit + bestehende Cursor-Rule: Skip-Semantik ist mehrfach erwaehnt
 * und §3 der external-jobs-integration-tests.mdc-Rule). Wir sichern die
 * wichtigsten Skip-Branches in `decideTemplateRun` ab.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'

// Gleiche Mock-Strategie wie im happy-path-Test.
vi.mock('@/lib/external-jobs-repository', () => ({
  ExternalJobsRepository: class {
    async appendLog() { return undefined }
    async traceAddEvent() { return undefined }
  },
}))

vi.mock('@/lib/external-jobs-log-buffer', () => ({
  bufferLog: vi.fn(),
}))

vi.mock('@/lib/processing/gates', () => ({
  gateTransformTemplate: vi.fn(async () => ({ exists: false, reason: 'no_artifact' })),
}))

vi.mock('@/lib/shadow-twin/artifact-naming', () => ({
  buildArtifactName: () => 'unique.transcript.de.md',
}))

vi.mock('@/lib/storage/server-provider', () => ({
  getServerProvider: async () => ({
    getPathById: async () => '/parent',
    listItemsById: async () => [],
    getBinary: async () => ({ blob: { text: async () => '' } }),
  }),
}))

import { decideTemplateRun } from '@/lib/external-jobs/template-decision'
import type { TemplateDecisionArgs } from '@/types/external-jobs'

function makeCtx(overrides?: Partial<TemplateDecisionArgs>): TemplateDecisionArgs {
  return {
    ctx: {
      jobId: 'job-1',
      job: {
        userEmail: 'a@b.com',
        libraryId: 'lib-1',
        correlation: {
          source: { itemId: 'src-1', name: 'x.pdf', parentId: 'p-1' },
          options: { targetLanguage: 'de' },
        },
      },
      body: { phase: null },
      request: {} as never,
      callbackToken: undefined,
      internalBypass: true,
    } as TemplateDecisionArgs['ctx'],
    policies: { metadata: 'auto', ingest: 'auto' },
    isFrontmatterCompleteFromBody: false,
    templateGateExists: false,
    autoSkip: false,
    isTemplateCompletedCallback: false,
    ...overrides,
  }
}

describe('decideTemplateRun (skip-paths)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('policy=skip → kein Run, reason=policy_skip', async () => {
    const r = await decideTemplateRun(
      makeCtx({ policies: { metadata: 'skip', ingest: 'auto' } })
    )
    expect(r.shouldRun).toBe(false)
    expect(r.reason).toBe('policy_skip')
  })

  it('policy=ignore → kein Run, reason=policy_ignore', async () => {
    const r = await decideTemplateRun(
      makeCtx({ policies: { metadata: 'ignore', ingest: 'auto' } })
    )
    expect(r.shouldRun).toBe(false)
    expect(r.reason).toBe('policy_ignore')
  })

  it('policy=auto + Frontmatter komplett → Skip mit reason=frontmatter_complete_body', async () => {
    const r = await decideTemplateRun(
      makeCtx({ isFrontmatterCompleteFromBody: true })
    )
    expect(r.shouldRun).toBe(false)
    expect(r.reason).toBe('frontmatter_complete_body')
  })

  it('policy=auto + templateGateExists=true (Vorab-Hinweis) → Skip', async () => {
    const r = await decideTemplateRun(
      makeCtx({ templateGateExists: true })
    )
    expect(r.shouldRun).toBe(false)
    // gateReason wird auf 'frontmatter_complete_body' gesetzt, weil das die
    // Default-Reason fuer templateGateExists=true im Code ist (Zeile 65).
    expect(r.reason).toBe('frontmatter_complete_body')
    expect(r.gateExists).toBe(true)
  })

  it('Callback + Frontmatter komplett → Skip mit reason=template_completed_fm_ok', async () => {
    const r = await decideTemplateRun(
      makeCtx({
        isTemplateCompletedCallback: true,
        isFrontmatterCompleteFromBody: true,
      })
    )
    expect(r.shouldRun).toBe(false)
    expect(r.reason).toBe('template_completed_fm_ok')
    expect(r.isCallback).toBe(true)
  })

  it('Callback + kein FM komplett + kein Repair noetig → Skip mit reason=template_completed_no_repair', async () => {
    const r = await decideTemplateRun(
      makeCtx({
        isTemplateCompletedCallback: true,
        isFrontmatterCompleteFromBody: false,
      })
    )
    expect(r.shouldRun).toBe(false)
    expect(r.reason).toBe('template_completed_no_repair')
    expect(r.needsRepair).toBe(false)
  })
})
