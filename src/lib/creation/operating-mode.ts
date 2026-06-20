/**
 * Wizard-Betriebsart (Plan 2 · W-E).
 *
 * Buendelt den frueher verstreuten `captureTranscriptOnly`-Flag (~20 inline
 * `if`/Ternaries in `creation-wizard.tsx`) zu EINER Betriebsart. Die Bedeutung
 * der Betriebsart — strukturelle Compute-Ableitungen UND die anzeigbaren
 * Wortlaute — lebt ab jetzt hier (eine Quelle der Wahrheit), nicht verstreut.
 *
 * Reines Modul (kein React, keine Seiteneffekte) → voll unit-testbar.
 *
 * `transcriptOnly` = „Nur importieren und transkribieren": KEINE Publikation/
 * Ingestion; das Ergebnis wird (fuer Owner) im Archiv gespeichert statt
 * veroeffentlicht. Wortlaut + Navigation richten sich danach.
 */

/** Genau zwei Betriebsarten — kein `enum` (Repo-Konvention), Union + Map. */
export type WizardOperatingMode = 'normal' | 'transcriptOnly'

/** Quelle der Betriebsart: der kanonische Wizard-State-Flag. */
export function resolveOperatingMode(state: { captureTranscriptOnly?: boolean }): WizardOperatingMode {
  return state.captureTranscriptOnly === true ? 'transcriptOnly' : 'normal'
}

/** Bequemer Praedikat-Helfer (vermeidet `=== 'transcriptOnly'` an vielen Stellen). */
export function isTranscriptOnly(mode: WizardOperatingMode): boolean {
  return mode === 'transcriptOnly'
}

/**
 * Effektiver `detailViewType` fuer den Compute-Schritt:
 * - `transcriptOnly` rendert bewusst als `session` (standard-session existiert,
 *   kein Pre-flight-Umbau).
 * - `normal` nutzt den gewaehlten Typ. Fehlt er, ist das ein expliziter Fehler
 *   (der Aufrufer gated vorher; kein stiller Default — no-silent-fallbacks.mdc).
 */
export function effectiveDetailViewTypeForMode(
  mode: WizardOperatingMode,
  selectedType: string | undefined,
): string {
  if (mode === 'transcriptOnly') return 'session'
  if (selectedType && selectedType.trim()) return selectedType
  throw new Error('effectiveDetailViewTypeForMode: kein Inhaltstyp gewaehlt (Betriebsart „normal").')
}

/** Compute-Zusatzfelder je Betriebsart (`transcriptOnly` setzt docType=transcript). */
export function transcriptComputeFields(
  mode: WizardOperatingMode,
): Array<{ key: string; rawValue: string }> {
  return mode === 'transcriptOnly' ? [{ key: 'docType', rawValue: 'transcript' }] : []
}

/** Alle betriebsart-abhaengigen Wortlaute des Publish-Schritts an EINER Stelle. */
export interface WizardPublishCopy {
  /** PublishStep-Titel (Default, falls der Schritt keinen eigenen Titel hat). */
  stepTitle: string
  /** PublishStep-Beschreibung (Default). */
  stepDescription: string
  /** „läuft…"-Label (nur transcriptOnly; sonst undefined = Standard). */
  runningLabel?: string
  /** „wird gestartet…"-Label (nur transcriptOnly). */
  startingLabel?: string
  /** Fortschritts-Text bei 50 % (Anlegen/Vorbereiten). */
  prepareMessage: string
  /** Fortschritts-Text bei 75 % (Speichern/Veroeffentlichen). */
  finalizeMessage: string
  /** Erfolgs-Text bei 100 % im Owner-Zweig. */
  ownerSuccessMessage: string
  /** Titel der Fehler-Toast. */
  errorToastTitle: string
}

const TRANSCRIPT_ONLY_COPY: WizardPublishCopy = {
  stepTitle: 'Im Archiv speichern',
  stepDescription: 'Die Datei wird importiert und das Transkript im Archiv gespeichert.',
  runningLabel: 'Speichern läuft…',
  startingLabel: 'Speichern wird gestartet…',
  prepareMessage: 'Vorbereiten…',
  finalizeMessage: 'Im Archiv speichern…',
  ownerSuccessMessage: 'Im Archiv gespeichert.',
  errorToastTitle: 'Speichern fehlgeschlagen',
}

const NORMAL_COPY: WizardPublishCopy = {
  stepTitle: 'Publizieren',
  stepDescription: 'Jetzt wird das Ergebnis final gespeichert und für die Suche indiziert.',
  runningLabel: undefined,
  startingLabel: undefined,
  prepareMessage: 'Im Wartekorb anlegen…',
  finalizeMessage: 'Veröffentlichen…',
  ownerSuccessMessage: 'Veröffentlicht.',
  errorToastTitle: 'Publizieren fehlgeschlagen',
}

/** Exhaustive Wortlaut-Map je Betriebsart (kein `default`-Loch). */
const PUBLISH_COPY: Record<WizardOperatingMode, WizardPublishCopy> = {
  transcriptOnly: TRANSCRIPT_ONLY_COPY,
  normal: NORMAL_COPY,
}

/** Liefert die betriebsart-abhaengigen Publish-Wortlaute. */
export function wizardPublishCopy(mode: WizardOperatingMode): WizardPublishCopy {
  return PUBLISH_COPY[mode]
}
