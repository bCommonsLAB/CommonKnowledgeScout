/**
 * Wizard-Flow-Entitaet (Plan 2 · W-A / Δ1 — „Weg B").
 *
 * Δ1 loest den Wizard-**Flow** aus dem Schema-Template heraus: statt „1 Flow pro
 * Template (kopiert)" gibt es **wenige geteilte Flows**, die ein Schema
 * referenzieren. „Weg B" (Owner-Entscheidung 2026-06-18): die Flow-Entitaet lebt
 * im bestehenden Template-Repo, unterschieden ueber `TemplateDocument.kind`.
 *
 * Dieses Modul ist rein (kein Storage, kein React) und liefert:
 * - die Kind-Aufloesung (explizit, kein stiller Default),
 * - den **einen generischen Standard-Flow**,
 * - die Flow-Aufloesungs-Naht (`resolveWizardFlow`), an der spaeter eine
 *   referenzierte Flow-Entitaet den gebuendelten `creation`-Block ersetzt.
 */

import type { TemplateCreationConfig, TemplateDocKind } from '@/lib/templates/template-types'

/**
 * Eine herausgeloeste Wizard-Flow-Konfiguration — derselbe Shape wie der frueher
 * im Schema-Template gebuendelte `creation`-Block, jetzt als eigene Entitaet.
 */
export type WizardFlowConfig = TemplateCreationConfig

/**
 * Liefert die Art eines Template-Dokuments. Fehlt `kind`, ist es ein
 * Bestands-`schema` (einziger Typ vor Δ1) — bewusste, dokumentierte
 * Migrations-Interpretation, KEIN stiller Fehler-Default (no-silent-fallbacks).
 */
export function resolveTemplateDocKind(doc: { kind?: TemplateDocKind }): TemplateDocKind {
  return doc.kind ?? 'schema'
}

/** Ist `doc` eine herausgeloeste Wizard-Flow-Entitaet? */
export function isWizardFlowDoc(doc: { kind?: TemplateDocKind }): boolean {
  return resolveTemplateDocKind(doc) === 'wizard'
}

/** Ist `doc` ein Schema-Template (inkl. Bestand ohne `kind`)? */
export function isSchemaDoc(doc: { kind?: TemplateDocKind }): boolean {
  return resolveTemplateDocKind(doc) === 'schema'
}

/**
 * Teilt Template-Dokumente in Schemas und Flow-Entitaeten (W-A-3). Schema-Listen
 * (Editor, Inhaltstyp-Ableitung) duerfen Flow-Entitaeten NICHT enthalten;
 * Flow-Listen (kuenftiger Wizard-Editor) nur diese.
 */
export function partitionTemplateDocsByKind<T extends { kind?: TemplateDocKind }>(
  docs: readonly T[],
): { schemas: T[]; flows: T[] } {
  const schemas: T[] = []
  const flows: T[] = []
  for (const doc of docs) {
    if (isWizardFlowDoc(doc)) flows.push(doc)
    else schemas.push(doc)
  }
  return { schemas, flows }
}

/** Stabile ID/Name des generischen Standard-Flows (Seed-Anker fuer W-D). */
export const STANDARD_CAPTURE_FLOW_ID = 'standard-capture'

/**
 * Der EINE generische Standard-Flow (Δ1): Welcome → Quelle sammeln →
 * Inhaltstyp waehlen → pruefen/ergaenzen → speichern. Bewusst **schema-frei**:
 * der `editDraft`-Schritt nennt keine Feldnamen (die kommen zur Laufzeit aus dem
 * gebundenen Schema — O1/U3), der Typ wird via `selectSchemaType` gewaehlt.
 */
export const STANDARD_CAPTURE_FLOW: WizardFlowConfig = {
  supportedSources: [
    {
      id: 'file',
      type: 'file',
      label: 'Datei hochladen',
      helpText:
        'PDF, Audio, Bild oder Video. Inhalt wird extrahiert bzw. transkribiert; das Ergebnis ist vor dem Speichern editierbar.',
    },
  ],
  welcome: {
    markdown: [
      '## Willkommen',
      '',
      'Erfasse einen Beitrag: Quelle waehlen, Inhaltstyp bestimmen, Ergebnis pruefen — der',
      'Beitrag landet im **Wartekorb** (als Owner sofort veroeffentlicht).',
    ].join('\n'),
  },
  output: {
    fileName: {
      metadataFieldKey: 'title',
      autoFillMetadataField: true,
      extension: 'md',
      fallbackPrefix: 'capture',
    },
    createInOwnFolder: true,
    wizardOnlyMetadataKeys: ['filename'],
  },
  flow: {
    steps: [
      { id: 'Welcome', preset: 'welcome', title: 'Willkommen' },
      { id: 'Collect', preset: 'collectSource', title: 'Quelle waehlen' },
      { id: 'SelectType', preset: 'selectSchemaType', title: 'Inhaltstyp waehlen' },
      { id: 'Edit', preset: 'editDraft', title: 'Pruefen und ergaenzen' },
      { id: 'Publish', preset: 'publish', title: 'Speichern', ingestOnFinish: false },
    ],
  },
  ui: {
    displayName: 'Inhalt erfassen',
    description: 'Quelle hochladen, Inhaltstyp waehlen und als Beitrag in den Wartekorb legen',
    icon: 'Upload',
  },
}

/**
 * Loest den effektiven Wizard-Flow auf — die einzige Naht, an der spaeter die
 * Speicherung andockt. Reihenfolge (explizit, kein stiller Voll-Dump):
 * 1. `flowConfig` (referenzierte Flow-Entitaet) — Vorrang,
 * 2. sonst der im Schema gebuendelte `creation`-Block (Bestand vor Δ1),
 * 3. sonst der generische Standard-Flow (dokumentierter Default).
 */
export function resolveWizardFlow(args: {
  flowConfig?: WizardFlowConfig | null
  schemaCreation?: TemplateCreationConfig | null
}): WizardFlowConfig {
  if (args.flowConfig) return args.flowConfig
  if (args.schemaCreation) return args.schemaCreation
  return STANDARD_CAPTURE_FLOW
}
