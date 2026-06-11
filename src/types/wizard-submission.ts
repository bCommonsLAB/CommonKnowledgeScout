/**
 * @fileoverview Wizard-Submission Typen (Inbox-/Abnahme-Modell, ADR-0004)
 *
 * @description
 * Eine Submission ist das Inbox-Dokument der Capture->Publish-Entkopplung:
 * Der Wizard/die Analyse schreibt das Ergebnis NIE direkt in den Ziel-Provider,
 * sondern in eine durable Inbox (MongoDB-Dokument + Azure-Blob-Referenzen fuer
 * Binaerdaten). Erst ein rechte-gateter Promotion-Job (W5) veroeffentlicht.
 *
 * Invariante (ADR-0004): KEINE Binaerdaten in MongoDB - nur `binaryRefs` mit
 * Hash/URL auf den Azure-Blob-Inbox-Bereich.
 *
 * @see docs/adr/0004-capture-publish-entkopplung-inbox-modell.md
 * @see docs/wizards/abnahme-inbox-plan.md (Baustein W1)
 * @module types
 */

/**
 * Lebenszyklus einer Submission (ADR-0004):
 *   draft -> pending -> ready -> publishing -> published
 *                         |
 *                 rejected <- (Reviewer lehnt ab)
 */
export type SubmissionStatus =
  | 'draft'
  | 'pending'
  | 'ready'
  | 'publishing'
  | 'published'
  | 'rejected';

/**
 * Rolle des Erfassers zum Zeitpunkt der Erfassung. `contributor` wird mit der
 * Rollen-Welle (W3) im Library-Modell ergaenzt; hier bereits vorgesehen, da die
 * Submission die Rolle des Erfassers festhaelt (Audit + Co-Autor-Pfad).
 * Der kontolose Write-Key/QR-Pfad ist eine spaetere Scheibe (dann ohne Rolle).
 */
export type SubmissionCreatorRole = 'contributor' | 'co-creator' | 'owner';

/**
 * Referenz auf eine Binaerquelle im Azure-Blob-Inbox-Bereich (content-addressed).
 * KEINE Binaerdaten in MongoDB - nur diese Referenz.
 */
export interface SubmissionBinaryRef {
  /** Content-Hash (SHA-256, gekuerzt) - Dedup-Schluessel im Inbox-Bereich */
  hash: string;
  /** Oeffentliche Azure-Blob-URL */
  url: string;
  /** Original-Dateiname (fuer Anzeige + Promotion ins Ziel) */
  fileName: string;
  /** MIME-Type der Binaerquelle */
  contentType: string;
  /** Groesse in Bytes, falls bekannt */
  size?: number;
  /**
   * StorageItem-ID der Quelle im Inbox-Provider (Welle III). Damit kann die
   * Analyse-Pipeline die Datei ueber das Provider-Interface laden, ohne Pfade
   * zu rekonstruieren. Optional: Refs aus Stufe A vor Welle III haben keine.
   */
  itemId?: string;
}

/** Ziel der spaeteren Publikation (Provider-Ordner/Slug). */
export interface SubmissionTarget {
  folderId?: string;
  slug?: string;
}

/** Redaktionelle Abnahme-Metadaten (gesetzt bei Freigabe/Ablehnung). */
export interface SubmissionReview {
  /** Reviewer (normalisierte E-Mail) */
  reviewedBy?: string;
  /** ISO-Zeitstempel der Abnahme/Ablehnung */
  reviewedAt?: string;
  /** Notiz (z.B. Ablehnungsgrund) */
  note?: string;
}

/** Audit-Event-Typen (Erstellung + Status-Wechsel). */
export type SubmissionEventType = 'created' | 'status-changed';

/** Ein Audit-Trail-Eintrag: wer, wann, welcher Uebergang, warum. */
export interface SubmissionEvent {
  type: SubmissionEventType;
  /** Status vor dem Uebergang (nur bei status-changed) */
  fromStatus?: SubmissionStatus;
  /** Status nach dem Uebergang bzw. Initial-Status bei `created` */
  toStatus: SubmissionStatus;
  /** Akteur (normalisierte E-Mail oder System-/Job-Kennung) */
  actor: string;
  /** ISO-Zeitstempel */
  at: string;
  /** Optionale Notiz */
  note?: string;
}

/**
 * Domaenen-/Public-Form einer Submission (Repo-Rueckgabe, API/UI).
 * Persistenz nutzt intern Mongo-`_id`; hier als String-`id`.
 */
export interface WizardSubmission {
  /** Mongo-`_id` als String */
  id: string;
  /** Ziel-Library */
  libraryId: string;
  status: SubmissionStatus;
  /** Erfasser (normalisierte E-Mail; bei Write-Key: Kennung) */
  createdBy: string;
  createdByRole: SubmissionCreatorRole;
  /** Optionaler Write-Key (kontoloser Pfad, spaetere Scheibe) */
  writeKey?: string;
  /** Gewaehlter Wizard (Flow) */
  wizardId: string;
  /** Schema-/Ergebnis-Typ (fuer Pflichtfelder + Extractor) */
  docType: string;
  /** Renderer-Typ (VIEW_TYPE_REGISTRY, ADR-0003) */
  detailViewType: string;
  /** Erfasste/analysierte Schema-Felder (flach) */
  metadata: Record<string, unknown>;
  /** Erfasster/analysierter Markdown-Koerper */
  markdownBody: string;
  /** Azure-Blob-Inbox-Referenzen (keine Binaerdaten in Mongo) */
  binaryRefs: SubmissionBinaryRef[];
  /** Analyse-Confidence je Feld (0..1) - Hervorhebung unsicherer Felder */
  confidence: Record<string, number>;
  target: SubmissionTarget;
  review: SubmissionReview;
  /** Audit-Trail (Erstellung + Status-Wechsel) */
  events: SubmissionEvent[];
  /** ISO-Zeitstempel */
  createdAt: string;
  /** ISO-Zeitstempel */
  updatedAt: string;
  /** Aenderungszaehler (Start 1, +1 je Aenderung) */
  version: number;
}

/** Eingabe fuer `createSubmission`. */
export interface CreateSubmissionInput {
  libraryId: string;
  createdBy: string;
  createdByRole: SubmissionCreatorRole;
  wizardId: string;
  docType: string;
  detailViewType: string;
  /** Initial-Status - nur `draft` oder `pending` erlaubt (Capture). */
  status: SubmissionStatus;
  writeKey?: string;
  metadata?: Record<string, unknown>;
  markdownBody?: string;
  binaryRefs?: SubmissionBinaryRef[];
  confidence?: Record<string, number>;
  target?: SubmissionTarget;
}

/** Eingabe fuer `updateSubmissionMetadata` (redaktionelle Korrektur). */
export interface UpdateSubmissionMetadataInput {
  metadata?: Record<string, unknown>;
  markdownBody?: string;
  confidence?: Record<string, number>;
  target?: SubmissionTarget;
}

/** Eingabe fuer einen Status-Uebergang (`changeSubmissionStatus`). */
export interface SubmissionTransitionInput {
  /** Ziel-Status */
  to: SubmissionStatus;
  /** Akteur (E-Mail oder Job-Kennung) */
  actor: string;
  /** ISO-Zeitstempel des Uebergangs */
  at: string;
  /** Optionale Notiz (z.B. Ablehnungsgrund) */
  note?: string;
}
