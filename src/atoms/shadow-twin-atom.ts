/**
 * @fileoverview Shadow-Twin State Atom - Zentrale Shadow-Twin-Analyse
 * 
 * @description
 * Jotai-Atom für die zentrale Verwaltung von Shadow-Twin-Informationen.
 * Speichert Shadow-Twin-Analysen für alle Dateien im aktuellen Ordner.
 * 
 * @module shadow-twin
 * 
 * @exports
 * - shadowTwinStateAtom: Atom mit Map von fileId -> ShadowTwinState
 * - ShadowTwinState: Interface für Shadow-Twin-Informationen
 * 
 * @usedIn
 * - src/components/library/file-list.tsx: Verwendet Atom für FileGroup-Erstellung
 * - src/components/library/file-preview.tsx: Verwendet Atom für Markdown-Anzeige
 * - src/components/debug/debug-footer.tsx: Zeigt Atom-Inhalt im Debug-Panel
 */

import { atom } from 'jotai';
import { ShadowTwinState } from '@/lib/shadow-twin/shared';
import { StorageItem } from '@/lib/storage/types';

/**
 * Shadow-Twin-State für Frontend (mit vollständigen StorageItem-Objekten)
 * Wird aus dem gemeinsamen ShadowTwinState-Typ abgeleitet, aber mit vollständigen StorageItem-Objekten
 */
export type FrontendShadowTwinState = ShadowTwinState & {
  baseItem: StorageItem;
  transformed?: StorageItem;
  transcriptFiles?: StorageItem[];
  mediaFiles?: StorageItem[];
};

/**
 * Atom für Shadow-Twin-States aller Dateien im aktuellen Ordner
 * Key: fileId (string), Value: FrontendShadowTwinState (mit vollständigen StorageItem-Objekten)
 * 
 * HINWEIS: Dieser State wird primär für die UI-Anzeige verwendet.
 * Die primäre Quelle für Shadow-Twin-Informationen ist das Job-Dokument (MongoDB),
 * das beim Job-Start berechnet wird. Dieser Atom-State kann optional aus Jobs
 * aktualisiert werden oder als Fallback eine lokale Analyse durchführen.
 */
export const shadowTwinStateAtom = atom<Map<string, FrontendShadowTwinState>>(new Map());
shadowTwinStateAtom.debugLabel = 'shadowTwinStateAtom';

