/**
 * @fileoverview Bausteine der Library-Konfiguration
 *
 * @description
 * Speichertyp, Uebersetzungs-Konfiguration und die Kuratierung der
 * Erfassungs-Wizards. Sie gehoeren zum Steckbrief einer Library und werden
 * sowohl von `ClientLibrary` (voll) als auch von der serverseitigen
 * `StorageConfig` in der App verwendet.
 *
 * @module contracts/library-config
 */

import type { Locale } from '@ks/i18n'

/**
 * Supported storage provider types.
 * Each type represents a different storage backend implementation.
 */
export type StorageProviderType = 'local' | 'onedrive' | 'gdrive' | 'nextcloud' | 'inbox';
// 'inbox' ist ein INTERNER, nur serverseitig konstruierter Provider (ADR-0004 II):
// duenner, content-adressierter Blob-Bereich fuer die Quarantaene. Er ist KEIN vom
// User waehlbarer Library-Typ — bewusst NICHT in den Settings-Formularen gelistet.

/**
 * Konfiguration fuer Dokumenten-Uebersetzungen pro Library.
 *
 * - `targetLocales`: Liste der Sprachen, in die publizierte Dokumente uebersetzt werden sollen
 *   (Subset von `SUPPORTED_LOCALES`).
 * - `fallbackLocale`: Sprache, die im UI verwendet wird, wenn der Benutzer eine Locale waehlt,
 *   die nicht in `targetLocales` enthalten ist (z.B. weil noch keine Uebersetzung existiert).
 * - `autoTranslateOnPublish`: Wenn `true`, startet das Publish eines Dokuments automatisch
 *   parallele Uebersetzungsjobs fuer alle `targetLocales`.
 */
export interface TranslationsConfig {
  /** Zielsprachen fuer die Backend-Uebersetzungsjobs (Default: leer = keine automatische Uebersetzung) */
  targetLocales?: Locale[];
  /** Fallback-Locale, wenn die UI-Locale nicht in `targetLocales` ist (Default: 'en') */
  fallbackLocale?: Locale;
  /** Beim Publish automatisch alle Locales generieren (Default: true, sobald `targetLocales` gesetzt) */
  autoTranslateOnPublish?: boolean;
}

/**
 * Ein kuratierter Wizard-Eintrag (Plan 2 · W-B/W-C, Δ2): Flow + optional festes
 * Schema. Steht hier (Types-Heimat); die Auswahl-Engine importiert von hier.
 */
export interface CaptureWizardRef {
  /** Referenz auf den Flow (Flow-Entitaet bzw. Creation-Typ-`id`/`templateId`). */
  flowId: string;
  /** Optional fest gebundenes Schema (sonst Laufzeit-Wahl via selectSchemaType). */
  schemaRef?: string;
  /** Optionaler Anzeigename (ueberschreibt den abgeleiteten). */
  label?: string;
  /** Optionales Icon (ueberschreibt das abgeleitete). */
  icon?: string;
  /** Nur aktivierte Eintraege erscheinen. */
  enabled: boolean;
}

/** Per-Library-Kuratierung der „Inhalte erfassen"-Wizards (W-C, Δ2). */
export interface CaptureWizardsConfig {
  wizards: CaptureWizardRef[];
  /** `flowId`, der zuerst/als Default erscheint (falls aufloesbar). */
  defaultFlowId?: string;
}
