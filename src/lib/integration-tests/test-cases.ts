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
  /** MongoDB Vector Search: Meta-Dokument soll existieren */
  expectMetaDocument?: boolean;
  /** MongoDB Vector Search: Chunk-Vektoren sollen existieren */
  expectChunkVectors?: boolean;
  /** MongoDB Vector Search: Chapter-Summaries sollen existieren */
  expectChapterSummaries?: boolean;
  /** MongoDB Vector Search: Vector Search Index soll existieren */
  expectVectorSearchIndex?: boolean;
  /** MongoDB Vector Search: Vector Search Query soll funktionieren */
  expectVectorSearchQuery?: boolean;
  /** MongoDB Vector Search: Facetten-Metadaten sollen in Chunks vorhanden sein */
  expectFacetMetadataInChunks?: boolean;
  /** Nach dem Testlauf existiert ein Shadow-Twin-Verzeichnis */
  expectShadowTwinExists?: boolean;

  /**
   * Transcript-Qualitätschecks (typisch: Audio Extract-only).
   *
   * Motivation:
   * In der Praxis kann ein Job "completed" sein, obwohl im Shadow‑Twin ein leeres Transcript gespeichert wurde.
   * Das ist für den Nutzer meistens nicht akzeptabel und soll in Integrationstests auffallen.
   */
  expectTranscriptNonEmpty?: boolean;
  /** Mindestanzahl an Zeichen im Transcript (trimmed). */
  minTranscriptChars?: number;
  /**
   * Optionaler, strengerer Check: Transcript enthält nicht nur Frontmatter.
   * Wenn true, erwarten wir nach dem Frontmatter einen nicht-leeren Body.
   */
  expectTranscriptHasBody?: boolean;
  /** @deprecated Verwende expectMetaDocument statt expectMongoUpsert */
  expectMongoUpsert?: boolean;
}

export interface IntegrationTestCase {
  /** Eindeutige ID, z.B. "pdf_mistral_report.happy_path" (UseCaseId.ScenarioId) */
  id: string;
  /**
   * Ziel-Dateityp für den Test.
   * Wird genutzt, um die Test-Targets im Ordner zu filtern und die UI zu vereinfachen.
   */
  target: 'pdf' | 'audio';
  /** UseCase-ID aus docs/architecture/use-cases-and-personas.md, z.B. "pdf_mistral_report" */
  useCaseId: string;
  /** Szenario-ID innerhalb des UseCases, z.B. "happy_path", "gate_skip", "force_recompute" */
  scenarioId: string;
  /** Kurzer sprechender Name für die UI */
  label: string;
  /** Ausführliche Beschreibung für die UI */
  description: string;
  /** Grobe Kategorie (für Filter/Grouping in der UI) */
  category: 'phase1' | 'phase2' | 'phase3' | 'combined' | 'batch' | 'usecase';
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
  /**
   * Optionaler Workflow-Typ.
   * - 'single_job' (default): ein External Job (extract/template/ingest per Flags)
   * - 'pdf_hitl_publish': 2 Jobs + expliziter Publish-Schritt (Shadow‑Twin overwrite + Ingestion)
   */
  workflow?: 'single_job' | 'pdf_hitl_publish';
}

/**
 * Alle Integrationstestfälle, gruppiert nach UseCaseId.
 * Diese Struktur wird sowohl vom Orchestrator als auch vom Frontend genutzt.
 * 
 * Hard Reset: Die alten TC-* wurden durch eine kleinere, UseCase-basierte Suite ersetzt.
 * Jeder UseCase hat 3-5 Szenarien, die die wichtigsten Semantik-Fälle abdecken.
 */
export const integrationTestCases: IntegrationTestCase[] = [
  // PDF UseCase: pdf_mistral_report
  {
    id: 'pdf_mistral_report.happy_path',
    target: 'pdf',
    useCaseId: 'pdf_mistral_report',
    scenarioId: 'happy_path',
    label: 'PDF – Happy Path (Extract → Template → Ingest)',
    description:
      'Voller Pipeline-Lauf: Extract mit Mistral OCR, Template-Transformation, optional Ingest. ' +
      'Shadow-Twin wird neu erstellt. Am Ende existiert result.savedItemId (Transformation).',
    category: 'usecase',
    phases: { extract: true, template: true, ingest: false },
    policies: {
      extract: 'do',
      metadata: 'do',
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
      expectTemplateRun: true,
      expectShadowTwinExists: true,
    },
  },
  {
    id: 'pdf_mistral_report.gate_skip_extract',
    target: 'pdf',
    useCaseId: 'pdf_mistral_report',
    scenarioId: 'gate_skip_extract',
    label: 'PDF – Gate Skip Extract (Shadow-Twin existiert)',
    description:
      'Shadow-Twin-Verzeichnis mit fertigen Dateien existiert bereits. ' +
      'Extract läuft mit Auto-Policy; Gate/Policies sollen erkennen, dass Artefakte existieren, sodass Extract übersprungen wird. ' +
      'Template wird ebenfalls übersprungen, wenn chapters bereits vorhanden sind (chapters_already_exist). ' +
      'Am Ende existiert result.savedItemId (Transformation aus Shadow-Twin).',
    category: 'usecase',
    phases: { extract: true, template: true, ingest: false },
    policies: {
      extract: 'auto',
      metadata: 'do',
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
      expectTemplateRun: false, // Template wird übersprungen, wenn chapters bereits vorhanden sind
      expectShadowTwinExists: true,
    },
  },
  {
    id: 'pdf_mistral_report.force_recompute',
    target: 'pdf',
    useCaseId: 'pdf_mistral_report',
    scenarioId: 'force_recompute',
    label: 'PDF – Force Recompute (Shadow-Twin existiert, aber forciert)',
    description:
      'Shadow-Twin-Verzeichnis mit fertigen Dateien existiert bereits, Extract/Template werden aber über Policies forciert. ' +
      'Secretary-Service-Lauf wird erneut angestoßen, die Shadow-Twin-Dateien werden neu geschrieben. ' +
      'Am Ende existiert result.savedItemId (Transformation).',
    category: 'usecase',
    phases: { extract: true, template: true, ingest: false },
    policies: {
      extract: 'force',
      metadata: 'force',
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
      expectTemplateRun: true,
      expectShadowTwinExists: true,
    },
  },
  {
    id: 'pdf_mistral_report.repair_frontmatter',
    target: 'pdf',
    useCaseId: 'pdf_mistral_report',
    scenarioId: 'repair_frontmatter',
    label: 'PDF – Repair Frontmatter (unvollständiges Frontmatter)',
    description:
      'Es existiert bereits Frontmatter, das jedoch unvollständig ist (z.B. chapters vorhanden, aber pages fehlt). ' +
      'Wenn chapters vorhanden sind, wird Template übersprungen (chapters_already_exist), aber pages wird aus Markdown-Body rekonstruiert. ' +
      'Extract läuft im Auto-Mode (wird übersprungen, wenn Shadow-Twin existiert). ' +
      'Am Ende existiert result.savedItemId (Transformation).',
    category: 'usecase',
    phases: { extract: true, template: true, ingest: false },
    policies: {
      extract: 'auto',
      metadata: 'auto',
      ingest: 'ignore',
    },
    shadowTwinState: 'incomplete_frontmatter',
    expected: {
      shouldComplete: true,
      expectTemplateRun: false, // Template wird übersprungen, wenn chapters vorhanden sind (nur pages wird rekonstruiert)
      expectTemplateRepair: true, // Pages wird rekonstruiert, auch wenn Template übersprungen wird
      expectShadowTwinExists: true,
    },
  },
  {
    id: 'pdfanalyse.hitl_publish',
    target: 'pdf',
    useCaseId: 'pdfanalyse',
    scenarioId: 'hitl_publish',
    label: 'PDFAnalyse – HITL Publish (2 Jobs + Publish-Step)',
    description:
      'Simuliert den Wizard-Flow ohne UI: Job1 Extract-only → Job2 Template-only → Publish (Frontmatter überschreiben + Ingestion). ' +
      'Validiert den Contract: kein zusätzliches finales MD, savedItemId==transformFileId, Ingestion erfolgreich.',
    category: 'usecase',
    workflow: 'pdf_hitl_publish',
    // Diese Flags sind für den UI-Überblick; der Orchestrator steuert hier tatsächlich 2 Jobs.
    phases: { extract: true, template: true, ingest: true },
    // Für den Workflow werden die Policies pro Job gesetzt; hier nur als Dokumentation.
    policies: {
      extract: 'do',
      metadata: 'do',
      ingest: 'do',
    },
    mistralOptions: {
      forceRecompute: true,
      includeImages: true,
    },
    shadowTwinState: 'clean',
    expected: {
      shouldComplete: true,
      expectShadowTwinExists: true,
    },
  },
  // AUDIO UseCase: audio_transcription
  {
    id: 'audio_transcription.happy_path',
    target: 'audio',
    useCaseId: 'audio_transcription',
    scenarioId: 'happy_path',
    label: 'Audio – Happy Path (Extract-only: Transkription)',
    description:
      'Einfachster Audio-Flow: Extract läuft, Template/Ingest sind deaktiviert. ' +
      'Am Ende existiert result.savedItemId (Transcript).',
    category: 'usecase',
    phases: { extract: true, template: false, ingest: false },
    policies: {
      extract: 'do',
      metadata: 'ignore',
      ingest: 'ignore',
    },
    shadowTwinState: 'clean',
    expected: {
      shouldComplete: true,
      expectExtractRun: true,
      expectShadowTwinExists: true,
      // Der Transcript muss sinnvoll gefüllt sein (nicht leer).
      // Schwelle bewusst niedrig: wir wollen leere/fehlerhafte Writes finden, nicht "Qualität" bewerten.
      expectTranscriptNonEmpty: true,
      minTranscriptChars: 20,
    },
  },
  {
    id: 'audio_transcription.gate_skip_extract',
    target: 'audio',
    useCaseId: 'audio_transcription',
    scenarioId: 'gate_skip_extract',
    label: 'Audio – Gate Skip Extract (Transcript existiert)',
    description:
      'Transcript existiert bereits als Shadow‑Twin. Extract läuft im Auto-Mode; Gate/Policies sollen Extract überspringen. ' +
      'Am Ende existiert result.savedItemId (Transcript).',
    category: 'usecase',
    phases: { extract: true, template: false, ingest: false },
    policies: {
      extract: 'auto',
      metadata: 'ignore',
      ingest: 'ignore',
    },
    shadowTwinState: 'exists',
    expected: {
      shouldComplete: true,
      expectExtractRun: false,
      expectExtractSkip: true,
      expectShadowTwinExists: true,
      expectTranscriptNonEmpty: true,
      minTranscriptChars: 20,
    },
  },
  {
    id: 'audio_transcription.force_recompute',
    target: 'audio',
    useCaseId: 'audio_transcription',
    scenarioId: 'force_recompute',
    label: 'Audio – Force Recompute (Transcript existiert, aber forciert)',
    description:
      'Transcript existiert bereits, Extract wird aber via Policy forciert. ' +
      'Am Ende existiert result.savedItemId (Transcript).',
    category: 'usecase',
    phases: { extract: true, template: false, ingest: false },
    policies: {
      extract: 'force',
      metadata: 'ignore',
      ingest: 'ignore',
    },
    shadowTwinState: 'exists',
    expected: {
      shouldComplete: true,
      expectExtractRun: true,
      expectExtractSkip: false,
      expectShadowTwinExists: true,
      expectTranscriptNonEmpty: true,
      minTranscriptChars: 20,
    },
  },
]



