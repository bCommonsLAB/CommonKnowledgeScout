import { atom } from 'jotai';

// Mapping: StorageItem.id -> letzter bekannter Job-Status (queued|running|completed|failed)
export const jobStatusByItemIdAtom = atom<Record<string, string>>({});

// Write-only Atom zum Upsert eines Status
export const upsertJobStatusAtom = atom(
  null,
  (get, set, payload: { itemId: string; status: string }) => {
    if (!payload?.itemId || !payload?.status) return;
    const current = get(jobStatusByItemIdAtom);
    if (current[payload.itemId] === payload.status) return;
    set(jobStatusByItemIdAtom, { ...current, [payload.itemId]: payload.status });
  }
);


