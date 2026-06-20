/**
 * Standard-Flow-Seed (Plan 2 · W-A-2 — „Weg B").
 *
 * Legt den generischen Standard-Wizard-Flow als gespeicherte Flow-Entitaet
 * (`kind:'wizard'`) im Template-Repo einer Library an. Idempotent: existiert er
 * schon, passiert nichts.
 *
 * Die Kern-Logik nimmt einen schmalen Repo-Port (Dependency Injection) und ist
 * damit OHNE MongoDB unit-testbar. Die DB-gebundene Bequemfunktion
 * `seedStandardCaptureFlowForLibrary` adaptiert das echte `TemplateRepository`
 * (lazy importiert, damit reine Tests keinen Mongo-Graph laden).
 *
 * Bewusst NICHT automatisch aufgerufen: dieser Schritt liefert nur die
 * Faehigkeit. Das Verdrahten (Wizard loest den Flow aus der Entitaet auf) folgt
 * in W-A-3.
 */

import type { TemplateDocument } from '@/lib/templates/template-types'
import { STANDARD_CAPTURE_FLOW, STANDARD_CAPTURE_FLOW_ID } from './wizard-flow-entity'

/** Create-Eingabe fuer das Template-Repo (ohne abgeleitete Felder). */
export type NewTemplateDocument = Omit<TemplateDocument, '_id' | 'createdAt' | 'updatedAt' | 'version'>

/**
 * Baut das Flow-Entitaets-Dokument fuer den Standard-Capture-Flow.
 * Rein: traegt NUR den Flow (`creation`), leeres Schema/Systemprompt/Body.
 */
export function buildStandardCaptureFlowDoc(libraryId: string, userEmail: string): NewTemplateDocument {
  return {
    name: STANDARD_CAPTURE_FLOW_ID,
    libraryId,
    user: userEmail,
    kind: 'wizard',
    metadata: { fields: [], rawFrontmatter: '' },
    systemprompt: '',
    markdownBody: '',
    creation: STANDARD_CAPTURE_FLOW,
  }
}

/** Schmaler Repo-Port fuer den Seed (erfuellt vom `TemplateRepository`). */
export interface FlowSeedRepoPort {
  exists(name: string, libraryId: string): Promise<boolean>
  create(doc: NewTemplateDocument): Promise<unknown>
}

/** Ergebnis eines Seed-Laufs (explizit, kein stiller No-Op). */
export type FlowSeedResult = 'created' | 'exists'

/**
 * Legt den Standard-Flow idempotent an. Existiert er bereits (gleicher Name in
 * der Library), bleibt alles unveraendert.
 */
export async function seedStandardCaptureFlow(
  repo: FlowSeedRepoPort,
  args: { libraryId: string; userEmail: string },
): Promise<FlowSeedResult> {
  if (await repo.exists(STANDARD_CAPTURE_FLOW_ID, args.libraryId)) return 'exists'
  await repo.create(buildStandardCaptureFlowDoc(args.libraryId, args.userEmail))
  return 'created'
}

/**
 * Bequemfunktion: seedet ueber das echte `TemplateRepository` (DB-gebunden).
 * Lazy-Import haelt den reinen Test-Modulgraph frei von MongoDB.
 */
export async function seedStandardCaptureFlowForLibrary(
  libraryId: string,
  userEmail: string,
): Promise<FlowSeedResult> {
  const { TemplateRepository } = await import('@/lib/repositories/template-repo')
  const port: FlowSeedRepoPort = {
    exists: (name, lib) => TemplateRepository.exists(name, lib),
    create: (doc) => TemplateRepository.create(doc),
  }
  return seedStandardCaptureFlow(port, { libraryId, userEmail })
}
