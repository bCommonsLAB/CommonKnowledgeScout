import { atom } from 'jotai';

/**
 * Erweiterter Job-Status mit Progress-Informationen
 */
export interface JobStatusInfo {
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress?: number; // 0-100
  message?: string;
  jobId?: string;
  updatedAt?: string;
  /** Aktuelle Phase: extract, transform, ingest, etc. */
  phase?: string;
}

// Mapping: StorageItem.id -> letzter bekannter Job-Status (queued|running|completed|failed)
// Legacy: Nur Status-String
export const jobStatusByItemIdAtom = atom<Record<string, string>>({});

// Neu: Erweitertes Mapping mit Progress-Informationen
export const jobInfoByItemIdAtom = atom<Record<string, JobStatusInfo>>({});

// Write-only Atom zum Upsert eines Status (Legacy)
export const upsertJobStatusAtom = atom(
  null,
  (get, set, payload: { itemId: string; status: string }) => {
    if (!payload?.itemId || !payload?.status) return;
    const current = get(jobStatusByItemIdAtom);
    if (current[payload.itemId] === payload.status) return;
    set(jobStatusByItemIdAtom, { ...current, [payload.itemId]: payload.status });
  }
);

// Neu: Write-only Atom zum Upsert von erweiterten Job-Infos
export const upsertJobInfoAtom = atom(
  null,
  (get, set, payload: { 
    itemId: string; 
    status: JobStatusInfo['status'];
    progress?: number;
    message?: string;
    jobId?: string;
    updatedAt?: string;
    phase?: string;
  }) => {
    if (!payload?.itemId || !payload?.status) return;
    const current = get(jobInfoByItemIdAtom);
    const existing = current[payload.itemId];
    
    // Nur updaten wenn sich etwas geaendert hat
    if (existing?.status === payload.status && 
        existing?.progress === payload.progress &&
        existing?.message === payload.message &&
        existing?.phase === payload.phase) {
      return;
    }
    
    set(jobInfoByItemIdAtom, { 
      ...current, 
      [payload.itemId]: {
        status: payload.status,
        progress: payload.progress,
        message: payload.message,
        jobId: payload.jobId,
        updatedAt: payload.updatedAt,
        phase: payload.phase,
      }
    });
    
    // Legacy-Atom auch updaten
    set(jobStatusByItemIdAtom, { ...get(jobStatusByItemIdAtom), [payload.itemId]: payload.status });
  }
);

// Atom zum Entfernen eines Job-Status (z.B. wenn Job abgeschlossen)
export const clearJobInfoAtom = atom(
  null,
  (get, set, itemId: string) => {
    if (!itemId) return;
    const current = get(jobInfoByItemIdAtom);
    if (!current[itemId]) return;
    const next = { ...current };
    delete next[itemId];
    set(jobInfoByItemIdAtom, next);
    
    // Legacy auch bereinigen
    const legacy = get(jobStatusByItemIdAtom);
    if (legacy[itemId]) {
      const nextLegacy = { ...legacy };
      delete nextLegacy[itemId];
      set(jobStatusByItemIdAtom, nextLegacy);
    }
  }
);


