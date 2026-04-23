/**
 * @fileoverview Characterization Tests fuer phase-template.ts (Happy-Path).
 *
 * Plan-Schritt 3 (Sicherheitsnetz vor Refactor) der Pilot-Welle external-jobs.
 *
 * Sichert die wichtigsten Happy-Paths von:
 *  - `extractFixedFieldsFromTemplate` (Helper aus phase-template.ts)
 *  - `decideTemplateRun` (zentrale Decision-Funktion, die phase-template ueber
 *    `template-decision.ts` aufruft)
 *
 * Beide Funktionen sind die Kern-Entscheidungslogik der Template-Phase. Der
 * Verhaltens-Snapshot hier verhindert, dass Plan-Schritt 4 (Modul-Split)
 * Verhalten aus Versehen aendert.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { extractFixedFieldsFromTemplate } from '@/lib/external-jobs/phase-template'

// ---- Mocks fuer decideTemplateRun ----
//
// decideTemplateRun importiert: ExternalJobsRepository, gateTransformTemplate,
// getServerProvider (dynamisch), parseSecretaryMarkdownStrict (dynamisch).
// Wir mocken nur die Module, die wirklich aufgerufen werden — der Rest darf
// scheitern (try/catch in der Funktion sorgt fuer best-effort).

// Mongo-freie Repo-Mock: leere Promises
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

// getServerProvider wird dynamisch via "await import" geholt — Vitest erlaubt
// das Mocken statisch ueber den Modul-Pfad.
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
      // Wir verwenden bewusst nur die Felder, die decideTemplateRun liest.
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
      // Felder, die in decideTemplateRun nicht verwendet werden, koennen
      // beliebig leer sein.
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

describe('decideTemplateRun (happy-path)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fuehrt Template aus, wenn policy=auto, kein Gate, kein FM komplett (auto_no_gate)', async () => {
    const r = await decideTemplateRun(makeCtx())
    expect(r.shouldRun).toBe(true)
    expect(r.reason).toBe('auto_no_gate')
    expect(r.gateExists).toBe(false)
    expect(r.isCallback).toBe(false)
  })

  it('policy=force erzwingt Run unabhaengig von anderen Bedingungen (policy_force)', async () => {
    const r = await decideTemplateRun(
      makeCtx({
        policies: { metadata: 'force', ingest: 'auto' },
        isFrontmatterCompleteFromBody: true,
        templateGateExists: true,
      })
    )
    expect(r.shouldRun).toBe(true)
    expect(r.reason).toBe('policy_force')
  })
})

describe('extractFixedFieldsFromTemplate (happy-path)', () => {
  it('extrahiert einfache String-Felder', () => {
    const content = `---
sprache: de
docType: klimamassnahme
---

Body`
    expect(extractFixedFieldsFromTemplate(content)).toEqual({
      sprache: 'de',
      docType: 'klimamassnahme',
    })
  })

  it('parst Boolean-Werte korrekt', () => {
    const content = `---
isPublic: true
isDraft: false
---`
    expect(extractFixedFieldsFromTemplate(content)).toEqual({
      isPublic: true,
      isDraft: false,
    })
  })

  it('parst Number-Werte korrekt', () => {
    const content = `---
year: 2026
priority: 3
---`
    expect(extractFixedFieldsFromTemplate(content)).toEqual({
      year: 2026,
      priority: 3,
    })
  })

  it('parst JSON-Arrays korrekt', () => {
    const content = `---
tags: ["nachhaltigkeit","mobilitaet"]
---`
    expect(extractFixedFieldsFromTemplate(content)).toEqual({
      tags: ['nachhaltigkeit', 'mobilitaet'],
    })
  })

  it('uebernimmt String, der nicht als JSON parsbar ist, als plain String', () => {
    const content = `---
coverImagePrompt: Erstelle ein Hintergrundbild ohne Text
---`
    expect(extractFixedFieldsFromTemplate(content)).toEqual({
      coverImagePrompt: 'Erstelle ein Hintergrundbild ohne Text',
    })
  })

  it('parst null als JS-null', () => {
    const content = `---
optional: null
---`
    expect(extractFixedFieldsFromTemplate(content)).toEqual({ optional: null })
  })
})
