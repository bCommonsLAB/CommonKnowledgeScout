/**
 * @fileoverview Reine Status-Maschine fuer Wizard-Submissions (ADR-0004).
 *
 * @description
 * Reine Funktionen ohne Seiteneffekte - die Zustandsuebergaenge der Inbox.
 * Das Repo (`wizard-submissions-repo.ts`) nutzt diese Funktionen und persistiert
 * nur das Ergebnis; die Uebergangslogik selbst ist hier isoliert und voll
 * testbar (keine MongoDB noetig).
 *
 * Lebenszyklus:
 *   draft -> pending -> ready -> publishing -> published
 *                         |
 *                 rejected <- (Reviewer lehnt ab)
 *
 * `publishing -> ready` ist der Fehler-Ruecksprung des Promotion-Jobs
 * (Token abgelaufen / Storage offline) - kein halb-geschriebener Zustand
 * (ADR-0004 §E3). `published` und `rejected` sind terminal.
 *
 * @see docs/adr/0004-capture-publish-entkopplung-inbox-modell.md
 * @module lib/submissions
 */

import type {
  SubmissionEvent,
  SubmissionStatus,
  SubmissionTransitionInput,
  WizardSubmission,
} from '@/types/wizard-submission';

/** Alle gueltigen Status (Single Source of Truth fuer Typ-Guards). */
export const SUBMISSION_STATUSES: readonly SubmissionStatus[] = [
  'draft',
  'pending',
  'ready',
  'publishing',
  'published',
  'rejected',
];

/** Status, in denen eine Submission NEU erstellt werden darf (Capture). */
export const INITIAL_STATUSES: ReadonlySet<SubmissionStatus> = new Set([
  'draft',
  'pending',
]);

/** Terminale Status - keine weiteren Uebergaenge. */
export const TERMINAL_STATUSES: ReadonlySet<SubmissionStatus> = new Set([
  'published',
  'rejected',
]);

/**
 * Erlaubter Uebergangs-Graph. Jeder Status listet seine gueltigen Folge-Status
 * EXPLIZIT (kein stiller Default - neue Status muessen hier ergaenzt werden,
 * siehe no-silent-fallbacks).
 */
export const STATUS_TRANSITIONS: Readonly<
  Record<SubmissionStatus, readonly SubmissionStatus[]>
> = {
  draft: ['pending', 'rejected'],
  pending: ['ready', 'rejected'],
  ready: ['publishing', 'rejected'],
  publishing: ['published', 'ready'],
  published: [],
  rejected: [],
};

/** Type-Guard: Ist der Wert ein gueltiger SubmissionStatus? */
export function isSubmissionStatus(value: unknown): value is SubmissionStatus {
  return (
    typeof value === 'string' &&
    (SUBMISSION_STATUSES as readonly string[]).includes(value)
  );
}

/** Darf in diesem Status eine Submission neu erstellt werden? */
export function isInitialStatus(status: SubmissionStatus): boolean {
  return INITIAL_STATUSES.has(status);
}

/** Ist der Status terminal (keine weiteren Uebergaenge)? */
export function isTerminalStatus(status: SubmissionStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

/** Ist der Uebergang `from -> to` erlaubt? */
export function canTransition(
  from: SubmissionStatus,
  to: SubmissionStatus,
): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}

/** Domaenen-Fehler bei unerlaubtem Status-Uebergang (Routes -> 409). */
export class InvalidSubmissionTransitionError extends Error {
  readonly from: SubmissionStatus;
  readonly to: SubmissionStatus;
  constructor(from: SubmissionStatus, to: SubmissionStatus) {
    super(`Ungueltiger Status-Uebergang: "${from}" -> "${to}"`);
    this.name = 'InvalidSubmissionTransitionError';
    this.from = from;
    this.to = to;
  }
}

/** Wirft `InvalidSubmissionTransitionError`, wenn `from -> to` nicht erlaubt ist. */
export function assertTransition(
  from: SubmissionStatus,
  to: SubmissionStatus,
): void {
  if (!canTransition(from, to)) {
    throw new InvalidSubmissionTransitionError(from, to);
  }
}

/** Baut den Audit-Event eines Status-Wechsels (reine Funktion). */
export function buildStatusChangeEvent(
  from: SubmissionStatus,
  input: SubmissionTransitionInput,
): SubmissionEvent {
  const event: SubmissionEvent = {
    type: 'status-changed',
    fromStatus: from,
    toStatus: input.to,
    actor: input.actor,
    at: input.at,
  };
  if (input.note !== undefined) event.note = input.note;
  return event;
}

/**
 * Wendet einen Status-Uebergang an und gibt eine NEUE Submission zurueck
 * (reine Funktion, keine Mutation der Eingabe):
 *
 * - validiert den Uebergang (wirft `InvalidSubmissionTransitionError`),
 * - haengt den Audit-Event an,
 * - erhoeht `version`, setzt `updatedAt = input.at`,
 * - setzt `review` bei Freigabe (`pending -> ready`) und Ablehnung
 *   (`-> rejected`). Der Job-Ruecksprung `publishing -> ready` ist KEINE
 *   Reviewer-Aktion und setzt `review` daher nicht.
 */
export function transitionSubmission(
  current: WizardSubmission,
  input: SubmissionTransitionInput,
): WizardSubmission {
  assertTransition(current.status, input.to);
  const event = buildStatusChangeEvent(current.status, input);
  const next: WizardSubmission = {
    ...current,
    status: input.to,
    events: [...current.events, event],
    version: current.version + 1,
    updatedAt: input.at,
  };

  const isApproval = current.status === 'pending' && input.to === 'ready';
  const isRejection = input.to === 'rejected';
  if (isApproval || isRejection) {
    next.review = {
      reviewedBy: input.actor,
      reviewedAt: input.at,
      ...(input.note !== undefined ? { note: input.note } : {}),
    };
  }
  return next;
}
