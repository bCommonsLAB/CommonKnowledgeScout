/**
 * @fileoverview Re-Exports für das Library-Settings-Modul.
 *
 * @description
 * Welle 3-IV-a Modul-Split: library-form.tsx (2.222z) wurde aufgeteilt in:
 * - library-form.tsx (~400z) — Haupt-Render-Komponente
 * - shadow-twin-config-section.tsx — Shadow-Twin-Flags + Strategie
 * - migration-wizard-section.tsx — "Aus Dateisystem laden"-Dialog
 * - language-cleanup-section.tsx — "Artefakte nach Sprache bereinigen"
 * - import-export-section.tsx — Export/Import für Library-Konfiguration
 * - hooks/use-library-form.ts — Form-State + alle CRUD-Handler
 * - hooks/use-shadow-twin-migration.ts — Migration/Sync-Callbacks
 * - hooks/use-shadow-twin-analysis.ts — Lade-Hooks
 */

export { LibraryForm } from "./library-form";
export { LibraryAdvancedForm } from "./library-advanced-form";
