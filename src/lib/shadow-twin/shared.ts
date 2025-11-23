/**
 * @fileoverview Shadow-Twin Shared Types and Logic
 * 
 * @description
 * Gemeinsame Typen und Interfaces für Shadow-Twin-States.
 * Werden sowohl im Backend (Job-Dokumente) als auch im Frontend (Jotai-Atoms) verwendet.
 * 
 * @module shadow-twin
 * 
 * @exports
 * - ShadowTwinState: Interface für Shadow-Twin-Informationen
 */

import { StorageItem } from '@/lib/storage/types';

/**
 * Shadow-Twin-State für eine einzelne Datei
 * 
 * Wird sowohl im Job-Dokument (MongoDB) als auch im Frontend-State (Jotai) verwendet.
 * Für MongoDB: baseItem wird als Referenz gespeichert (nur ID und Name),
 * für Frontend: vollständiges StorageItem-Objekt.
 */
/**
 * Verarbeitungsstatus des Shadow-Twins
 * - 'pending': Shadow-Twin wurde noch nicht erstellt (Job noch nicht gestartet)
 * - 'processing': Job läuft noch, Shadow-Twin wird erstellt
 * - 'ready': Shadow-Twin ist vollständig und kann gerendert werden (Job abgeschlossen)
 * - 'error': Fehler bei der Erstellung
 */
export type ShadowTwinProcessingStatus = 'pending' | 'processing' | 'ready' | 'error';

export interface ShadowTwinState {
  /** Die Basis-Datei (Original) - im Job-Dokument nur ID/Name, im Frontend vollständig */
  baseItem: StorageItem | { id: string; metadata: { name: string } };
  /** Finale Markdown-Datei (mit Metadaten/Frontmatter nach Template-Phase) */
  transformed?: StorageItem | { id: string; metadata: { name: string } };
  /** 
   * Audio/Video-Transkripte ODER initiales Markdown ohne Frontmatter (nach Extract-Phase).
   * Für PDFs: Optional das initiale Markdown ohne Frontmatter, falls es als separate Datei gespeichert wurde.
   * In der Regel ist dies jedoch die gleiche Datei wie `transformed`, nur zu einem früheren Zeitpunkt.
   */
  transcriptFiles?: Array<StorageItem | { id: string; metadata: { name: string } }>;
  /** ID des Shadow-Twin-Verzeichnisses (falls vorhanden) */
  shadowTwinFolderId?: string;
  /** Audio/Video-Dateien (falls vorhanden) */
  mediaFiles?: Array<StorageItem | { id: string; metadata: { name: string } }>;
  /** Zeitstempel der Analyse */
  analysisTimestamp: number;
  /** Fehlermeldung bei der Analyse (falls vorhanden) */
  analysisError?: string;
  /** 
   * Verarbeitungsstatus des Shadow-Twins
   * Wird basierend auf dem Job-Status gesetzt:
   * - 'pending': Job noch nicht gestartet oder Shadow-Twin noch nicht erkannt
   * - 'processing': Job läuft noch (status: 'running' oder 'queued')
   * - 'ready': Job abgeschlossen (status: 'completed') und Shadow-Twin vollständig
   * - 'error': Job fehlgeschlagen (status: 'failed') oder Analyse-Fehler
   */
  processingStatus?: ShadowTwinProcessingStatus;
}

/**
 * Konvertiert einen vollständigen ShadowTwinState zu einer MongoDB-kompatiblen Version
 * (nur IDs und Namen, keine vollständigen StorageItem-Objekte)
 */
export function toMongoShadowTwinState(state: ShadowTwinState): ShadowTwinState {
  return {
    baseItem: {
      id: state.baseItem.id,
      metadata: { name: state.baseItem.metadata.name }
    },
    transformed: state.transformed ? {
      id: state.transformed.id,
      metadata: { name: state.transformed.metadata.name }
    } : undefined,
    transcriptFiles: state.transcriptFiles?.map(item => ({
      id: item.id,
      metadata: { name: item.metadata.name }
    })),
    shadowTwinFolderId: state.shadowTwinFolderId,
    mediaFiles: state.mediaFiles?.map(item => ({
      id: item.id,
      metadata: { name: item.metadata.name }
    })),
    analysisTimestamp: state.analysisTimestamp,
    analysisError: state.analysisError,
    processingStatus: state.processingStatus
  };
}


