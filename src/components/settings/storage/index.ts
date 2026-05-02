/**
 * @fileoverview Re-Exports für das Storage-Settings-Modul.
 *
 * @description
 * Welle 3-IV-a: storage-form.tsx wurde nach
 * src/components/settings/storage/ verschoben.
 *
 * Die vollständige Zerlegung in Section-Komponenten
 * (local-storage-section, onedrive-section, nextcloud-section)
 * und use-storage-form.ts-Hook folgt in Welle 3-IV-b.
 *
 * Hinweis: library.type-Branches in storage-form sind gemäß
 * welle-3-iv-settings-contracts.mdc §4 explizit erlaubt.
 */

// storage-form.tsx liegt noch unter settings/ (Welle 3-IV-b verschiebt es hierher)
export { StorageForm } from "../storage-form";
