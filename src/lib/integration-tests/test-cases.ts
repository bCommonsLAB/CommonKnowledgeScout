/**
 * @fileoverview Integration Test Cases for PDF Transformation
 *
 * @description
 * Definiert alle Integrationstest-Fälle für die drei Phasen der PDF-Transformation.
 * Fokus liegt auf Mistral-OCR-Extract, Template-Reparaturläufen und Ingestion.
 * Diese Datei enthält nur statische Testfall-Definitionen, keine Business-Logik.
 *
 * @module integration-tests
 */

export interface PhaseFlags {
  extract: boolean;
  template: boolean;
  ingest: boolean;
}

export type PhasePoliciesValue = 'force' | 'skip' | 'auto' | 'ignore' | 'do';

export interface PhasePolicies {
  extract?: PhasePoliciesValue;
  metadata?: PhasePoliciesValue;
  ingest?: PhasePoliciesValue;
}

export type ShadowTwinInitialState =
  | 'clean' // kein Shadow-Twin-Verzeichnis, keine Markdown-Files
  | 'exists' // konsistentes Shadow-Twin-Verzeichnis mit fertigen Dateien
  | 'legacy_markdown_in_parent' // alte transformierte Markdown im PDF-Ordner plus Shadow-Twin-Verzeichnis
  | 'incomplete_frontmatter'; // Shadow-Twin mit unvollständigem Frontmatter

export interface MistralExtractOptions {
  /** true → useCache=false, Secretary soll wirklich neu rechnen */
  forceRecompute: boolean;
  /** true → includeOcrImages und/oder includePageImages aktivieren */
  includeImages?: boolean;
}

export interface ExpectedOutcome {
  /** Job sollte am Ende completed sein */
  shouldComplete: boolean;
  /** Extract-Phase soll neu laufen (kein Gate-Skip) */
  expectExtractRun?: boolean;
  /** Extract-Phase soll über Gate/Policies geskippt werden */
  expectExtractSkip?: boolean;
  /** Template-Phase soll laufen */
  expectTemplateRun?: boolean;
  /** Template-Phase soll Frontmatter reparieren */
  expectTemplateRepair?: boolean;
  /** Ingestion soll laufen */
  expectIngestionRun?: boolean;
  /** Nach dem Testlauf existiert ein Shadow-Twin-Verzeichnis */
  expectShadowTwinExists?: boolean;
  /** Legacy-Markdown im PDF-Ordner soll nach dem Lauf gelöscht sein */
  expectLegacyMarkdownRemovedFromParent?: boolean;
}

export interface IntegrationTestCase {
  /** Eindeutige ID, z.B. "TC-1.1" */
  id: string;
  /** Kurzer sprechender Name für die UI */
  label: string;
  /** Ausführliche Beschreibung für die UI */
  description: string;
  /** Grobe Kategorie (für Filter/Grouping in der UI) */
  category: 'phase1' | 'phase2' | 'phase3' | 'combined' | 'batch';
  /** Aktivierte Phasen in diesem Testfall */
  phases: PhaseFlags;
  /** Phase-Policies, die über Job-Parameter gesetzt werden sollen */
  policies?: PhasePolicies;
  /** Mistral-spezifische Optionen (nur relevant für Phase-1-Tests) */
  mistralOptions?: MistralExtractOptions;
  /** Gewünschter initialer Shadow-Twin-Zustand vor Teststart */
  shadowTwinState?: ShadowTwinInitialState;
  /** Erwartetes Verhalten / Prüfpunkte */
  expected: ExpectedOutcome;
}

/**
 * Alle Integrationstestfälle für die PDF-Transformation.
 * Diese Struktur wird sowohl vom Orchestrator als auch vom Frontend genutzt.
 */
export const integrationTestCases: IntegrationTestCase[] = [
  // Phase 1 – Mistral OCR fokussiert
  {
    id: 'TC-1.1',
    label: 'Mistral OCR – Neuaufbau erzwingen (Clean Shadow-Twin)',
    description:
      'Shadow-Twin-Verzeichnis und relevante Dateien werden vor dem Testlauf gelöscht. ' +
      'Extract wird mit Mistral OCR und deaktiviertem Cache neu ausgeführt. ' +
      'Am Ende existiert ein neues Shadow-Twin-Verzeichnis mit Transcript/Markdown und optionalen Bildern.',
    category: 'phase1',
    phases: { extract: true, template: false, ingest: false },
    policies: {
      extract: 'force',
      metadata: 'ignore',
      ingest: 'ignore',
    },
    mistralOptions: {
      forceRecompute: true,
      includeImages: true,
    },
    shadowTwinState: 'clean',
    expected: {
      shouldComplete: true,
      expectExtractRun: true,
      expectExtractSkip: false,
      expectShadowTwinExists: true,
    },
  },
  {
    id: 'TC-1.2',
    label: 'Mistral OCR – Auto/Gate (nur wenn Dateien nicht existieren)',
    description:
      'Shadow-Twin-Verzeichnis mit fertigen Dateien existiert bereits. ' +
      'Extract läuft mit Mistral OCR und aktiviertem Cache im Auto-Mode. ' +
      'Gate/Policies sollen erkennen, dass Artefakte existieren, sodass Extract übersprungen wird.',
    category: 'phase1',
    phases: { extract: true, template: false, ingest: false },
    policies: {
      extract: 'auto',
      metadata: 'ignore',
      ingest: 'ignore',
    },
    mistralOptions: {
      forceRecompute: false,
      includeImages: true,
    },
    shadowTwinState: 'exists',
    expected: {
      shouldComplete: true,
      expectExtractRun: false,
      expectExtractSkip: true,
      expectShadowTwinExists: true,
    },
  },
  {
    id: 'TC-1.3',
    label: 'Mistral OCR – Shadow-Twin existiert, Extract trotz Gate forcen',
    description:
      'Shadow-Twin-Verzeichnis mit fertigen Dateien existiert bereits, Extract wird aber über Policies forciert. ' +
      'Secretary-Service-Lauf wird erneut angestoßen, die Shadow-Twin-Dateien werden neu geschrieben.',
    category: 'phase1',
    phases: { extract: true, template: false, ingest: false },
    policies: {
      extract: 'force',
      metadata: 'ignore',
      ingest: 'ignore',
    },
    mistralOptions: {
      forceRecompute: true,
      includeImages: true,
    },
    shadowTwinState: 'exists',
    expected: {
      shouldComplete: true,
      expectExtractRun: true,
      expectExtractSkip: false,
      expectShadowTwinExists: true,
    },
  },

  // Phase 2 – Template inkl. Reparaturläufe / Shadow-Twin-Migration
  // Reihenfolge: 1) Erstes Frontmatter erstellen → 2) Gate-Skip testen → 3) Force testen → 4) Reparaturläufe
  {
    id: 'TC-2.1',
    label: 'Template-only – Erstes Frontmatter erstellen',
    description:
      'Nach TC-1.x existiert Markdown ohne Frontmatter. ' +
      'Template-Phase erstellt erstes vollständiges Frontmatter auf Basis des vorhandenen Transcript-Markdowns. ' +
      'Extract wird übersprungen, da bereits Markdown vorhanden ist.',
    category: 'phase2',
    phases: { extract: false, template: true, ingest: false },
    policies: {
      extract: 'ignore',
      metadata: 'force',
      ingest: 'ignore',
    },
    shadowTwinState: 'exists',
    expected: {
      shouldComplete: true,
      expectTemplateRun: true,
      expectTemplateRepair: false,
      expectShadowTwinExists: true,
    },
  },
  {
    id: 'TC-2.2',
    label: 'Template mit skip-Policy (Gate-basiert)',
    description:
      'Nach TC-2.1 existiert vollständiges Frontmatter. ' +
      'Template-Phase soll über Gate/Policies komplett übersprungen werden, da vollständiges Frontmatter vorhanden ist.',
    category: 'phase2',
    phases: { extract: false, template: true, ingest: false },
    policies: {
      extract: 'ignore',
      metadata: 'skip',
      ingest: 'ignore',
    },
    shadowTwinState: 'exists',
    expected: {
      shouldComplete: true,
      expectTemplateRun: false,
      expectTemplateRepair: false,
      expectShadowTwinExists: true,
    },
  },
  {
    id: 'TC-2.3',
    label: 'Template mit force-Policy',
    description:
      'Nach TC-2.2 existiert vollständiges Frontmatter. ' +
      'Template-Phase wird unabhängig von vorhandenen Frontmatter-Artefakten erneut ausgeführt (force-Policy). ' +
      'Dient zur Überprüfung, dass Policies die Gates korrekt übersteuern.',
    category: 'phase2',
    phases: { extract: false, template: true, ingest: false },
    policies: {
      extract: 'ignore',
      metadata: 'force',
      ingest: 'ignore',
    },
    shadowTwinState: 'exists',
    expected: {
      shouldComplete: true,
      expectTemplateRun: true,
      expectTemplateRepair: false,
      expectShadowTwinExists: true,
    },
  },
  {
    id: 'TC-2.4',
    label: 'Template-Reparatur – unvollständiges Frontmatter',
    description:
      'Es existiert bereits Frontmatter, das jedoch unvollständig ist (z.B. chapters vorhanden, aber pages fehlt). ' +
      'Wenn chapters vorhanden sind: Template-Phase wird übersprungen, nur pages wird aus Markdown-Body rekonstruiert. ' +
      'Wenn chapters fehlt: Template-Phase wird ausgeführt, um chapters zu erstellen. ' +
      'Extract läuft im Auto-Mode (wird übersprungen, wenn Shadow-Twin existiert).',
    category: 'phase2',
    phases: { extract: true, template: true, ingest: false },
    policies: {
      extract: 'auto',
      metadata: 'auto',
      ingest: 'ignore',
    },
    shadowTwinState: 'incomplete_frontmatter',
    expected: {
      shouldComplete: true,
      // Template kann übersprungen werden, wenn chapters vorhanden sind (nur pages wird rekonstruiert)
      // Oder ausgeführt werden, wenn chapters fehlt (chapters werden erstellt)
      expectTemplateRun: true, // Flexibel: kann skipped sein, wenn chapters vorhanden sind
      expectTemplateRepair: true,
      expectShadowTwinExists: true,
    },
  },
  {
    id: 'TC-2.5',
    label: 'Template-Reparatur – Markdown im PDF-Verzeichnis + Shadow-Twin-Verzeichnis existiert',
    description:
      'Ausgangslage: PDF liegt in Ordner F, im selben Ordner existiert eine alte transformierte Markdown-Datei, ' +
      'und zusätzlich existiert bereits ein Shadow-Twin-Verzeichnis. ' +
      'Reparaturlauf soll die alte Datei logisch übernehmen/kopieren und anschließend aus F löschen, ' +
      'sodass nur noch konsolidierte Dateien im Shadow-Twin-Verzeichnis verbleiben.',
    category: 'phase2',
    phases: { extract: false, template: true, ingest: false },
    policies: {
      extract: 'ignore',
      metadata: 'auto',
      ingest: 'ignore',
    },
    shadowTwinState: 'legacy_markdown_in_parent',
    expected: {
      shouldComplete: true,
      expectTemplateRun: true,
      expectTemplateRepair: true,
      expectShadowTwinExists: true,
      expectLegacyMarkdownRemovedFromParent: true,
    },
  },

  // Phase 3 – Ingestion (RAG)
  {
    id: 'TC-3.1',
    label: 'Ingest-only (Extract/Template übersprungen)',
    description:
      'Bereits transformiertes Markdown existiert, Extract und Template werden übersprungen. ' +
      'Ingestion-Phase soll vorhandenes Markdown in Pinecone/MongoDB ingestieren.',
    category: 'phase3',
    phases: { extract: false, template: false, ingest: true },
    policies: {
      extract: 'ignore',
      metadata: 'ignore',
      ingest: 'force',
    },
    expected: {
      shouldComplete: true,
      expectIngestionRun: true,
      expectShadowTwinExists: true,
    },
  },
  {
    id: 'TC-3.2',
    label: 'Ingest mit force-Policy',
    description:
      'Ingestion wird auch dann ausgeführt, wenn bereits Vektoren existieren. ' +
      'Dient zur Überprüfung der Ingest-Policies.',
    category: 'phase3',
    phases: { extract: true, template: true, ingest: true },
    policies: {
      extract: 'auto',
      metadata: 'auto',
      ingest: 'force',
    },
    expected: {
      shouldComplete: true,
      expectIngestionRun: true,
      expectShadowTwinExists: true,
    },
  },
  {
    id: 'TC-3.3',
    label: 'Ingest mit skip-Policy (Gate-basiert)',
    description:
      'Wenn bereits Vektoren existieren, soll Ingestion über Gate/Policies komplett übersprungen werden.',
    category: 'phase3',
    phases: { extract: true, template: true, ingest: false },
    policies: {
      extract: 'auto',
      metadata: 'auto',
      ingest: 'skip',
    },
    expected: {
      shouldComplete: true,
      expectIngestionRun: false,
      expectShadowTwinExists: true,
    },
  },

  // Kombinierte Phasen
  {
    id: 'TC-4.1',
    label: 'Alle Phasen (Extract → Template → Ingest)',
    description:
      'Voller Pipeline-Lauf von Mistral-OCR-Extract über Template-Transformation bis zur RAG-Ingestion.',
    category: 'combined',
    phases: { extract: true, template: true, ingest: true },
    policies: {
      extract: 'auto',
      metadata: 'auto',
      ingest: 'do',
    },
    mistralOptions: {
      forceRecompute: true,
      includeImages: true,
    },
    shadowTwinState: 'clean',
    expected: {
      shouldComplete: true,
      expectExtractRun: true,
      expectTemplateRun: true,
      expectIngestionRun: true,
      expectShadowTwinExists: true,
    },
  },
  {
    id: 'TC-4.2',
    label: 'Extract + Template (ohne Ingest)',
    description:
      'Pipeline endet nach Template-Phase; RAG-Ingestion ist deaktiviert. ' +
      'Dient zur separaten Überprüfung von Extract/Template ohne RAG-Seiteffekte.',
    category: 'combined',
    phases: { extract: true, template: true, ingest: false },
    policies: {
      extract: 'auto',
      metadata: 'auto',
      ingest: 'ignore',
    },
    expected: {
      shouldComplete: true,
      expectExtractRun: true,
      expectTemplateRun: true,
      expectIngestionRun: false,
      expectShadowTwinExists: true,
    },
  },
  {
    id: 'TC-4.3',
    label: 'Template + Ingest (ohne Extract)',
    description:
      'Transcript-Markdown liegt bereits vor, Extract wird übersprungen; nur Template und Ingestion laufen.',
    category: 'combined',
    phases: { extract: false, template: true, ingest: true },
    policies: {
      extract: 'ignore',
      metadata: 'auto',
      ingest: 'do',
    },
    shadowTwinState: 'exists',
    expected: {
      shouldComplete: true,
      expectExtractRun: false,
      expectTemplateRun: true,
      expectIngestionRun: true,
      expectShadowTwinExists: true,
    },
  },

  // Batch-Verarbeitung
  {
    id: 'TC-5.1',
    label: 'Batch mit mehreren PDFs',
    description:
      'Mehrere PDFs im selben Testverzeichnis werden in einem Lauf verarbeitet, um Concurrency und Job-Verwaltung zu testen.',
    category: 'batch',
    phases: { extract: true, template: true, ingest: true },
    policies: {
      extract: 'auto',
      metadata: 'auto',
      ingest: 'do',
    },
    expected: {
      shouldComplete: true,
      expectExtractRun: true,
      expectTemplateRun: true,
      expectIngestionRun: true,
      expectShadowTwinExists: true,
    },
  },
  {
    id: 'TC-5.2',
    label: 'Batch mit forcierten Phasen',
    description:
      'Batch-Lauf, bei dem Extract/Template/Ingestion über Policies forciert werden, unabhängig von vorhandenen Artefakten.',
    category: 'batch',
    phases: { extract: true, template: true, ingest: true },
    policies: {
      extract: 'force',
      metadata: 'force',
      ingest: 'force',
    },
    expected: {
      shouldComplete: true,
      expectExtractRun: true,
      expectTemplateRun: true,
      expectIngestionRun: true,
      expectShadowTwinExists: true,
    },
  },
  {
    id: 'TC-5.3',
    label: 'Batch mit Gate-basierten Skips',
    description:
      'Batch-Lauf, der Gate-Logik und Policies nutzt, um Extract/Template/Ingestion selektiv zu überspringen, falls bereits Artefakte vorhanden sind.',
    category: 'batch',
    phases: { extract: true, template: true, ingest: true },
    policies: {
      extract: 'auto',
      metadata: 'auto',
      ingest: 'auto',
    },
    expected: {
      shouldComplete: true,
      expectShadowTwinExists: true,
    },
  },
]



