import { atom } from 'jotai';

export interface LogEntry {
  id: string;  // Unique ID für React-Keys
  timestamp: string;
  area: 'nav' | 'state' | 'file' | 'ui' | 'settings' | 'storage' | 'api' | 'database' | 'auth';
  sequence: number;  // Sequenznummer für die Reihenfolge
  component: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  details?: Record<string, unknown>;
  source?: 'client' | 'server';  // Unterscheidung zwischen Client- und Server-Logs
}

interface DebugState {
  logs: LogEntry[];
  serverLogs: LogEntry[];  // Separate Server-Logs
  visibleComponents: Set<string>;  // Komponenten können beliebige Namen haben
  visibleAreas: Set<'nav' | 'state' | 'file' | 'ui' | 'settings' | 'storage' | 'api' | 'database' | 'auth'>;
  maxLogs: number;  // Maximum number of logs to keep
  showServerLogs: boolean;  // Toggle für Server-Logs
}

const initialDebugState: DebugState = {
  logs: [],
  serverLogs: [],
  visibleComponents: new Set(['FileTree', 'Breadcrumb', 'FileList', 'StorageFactory', 'LocalStorageProvider', 'OneDriveProvider', 'WebDAVProvider']),  // Standard-aktive Komponenten
  visibleAreas: new Set<'nav' | 'state' | 'file' | 'ui' | 'settings' | 'storage' | 'api' | 'database' | 'auth'>(['nav', 'state', 'file', 'storage']),  // Standard-aktive Bereiche
  maxLogs: 1000,  // Standardwert für maximale Log-Anzahl
  showServerLogs: true,  // Server-Logs standardmäßig anzeigen
};

export const debugStateAtom = atom<DebugState>(initialDebugState);

// Atom für das Hinzufügen neuer Logs
export const addLogAtom = atom(
  null,
  (get, set, newLog: Omit<LogEntry, 'id'>) => {
    const debugState = get(debugStateAtom);
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    set(debugStateAtom, {
      ...debugState,
      logs: [
        { ...newLog, id },
        ...debugState.logs.slice(0, debugState.maxLogs - 1)
      ]
    });
  }
);

// Atom für das Togglen der Komponenten-Sichtbarkeit
export const toggleComponentAtom = atom(
  null,
  (get, set, component: string) => {
    const debugState = get(debugStateAtom);
    const newVisibleComponents = new Set(debugState.visibleComponents);
    
    if (newVisibleComponents.has(component)) {
      newVisibleComponents.delete(component);
    } else {
      newVisibleComponents.add(component);
    }
    
    set(debugStateAtom, {
      ...debugState,
      visibleComponents: newVisibleComponents
    });
  }
);

// Atom für das Togglen der Bereichs-Sichtbarkeit
export const toggleAreaAtom = atom(
  null,
  (get, set, area: 'nav' | 'state' | 'file' | 'ui' | 'settings' | 'storage' | 'api' | 'database' | 'auth') => {
    const debugState = get(debugStateAtom);
    const newVisibleAreas = new Set(debugState.visibleAreas);
    
    if (newVisibleAreas.has(area)) {
      newVisibleAreas.delete(area);
    } else {
      newVisibleAreas.add(area);
    }
    
    set(debugStateAtom, {
      ...debugState,
      visibleAreas: newVisibleAreas
    });
  }
);

// Atom für das Löschen aller Logs
export const clearLogsAtom = atom(
  null,
  (get, set) => {
    const debugState = get(debugStateAtom);
    set(debugStateAtom, {
      ...debugState,
      logs: []
    });
  }
);

// Atom für das Hinzufügen von Server-Logs
export const addServerLogAtom = atom(
  null,
  (get, set, serverLog: Omit<LogEntry, 'id' | 'source'>) => {
    const debugState = get(debugStateAtom);
    const id = `server-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    set(debugStateAtom, {
      ...debugState,
      serverLogs: [
        { ...serverLog, id, source: 'server' },
        ...debugState.serverLogs.slice(0, debugState.maxLogs - 1)
      ]
    });
  }
);

// Atom für das Löschen von Server-Logs
export const clearServerLogsAtom = atom(
  null,
  (get, set) => {
    const debugState = get(debugStateAtom);
    set(debugStateAtom, {
      ...debugState,
      serverLogs: []
    });
  }
);

// Atom für das Togglen der Server-Logs-Anzeige
export const toggleServerLogsAtom = atom(
  null,
  (get, set) => {
    const debugState = get(debugStateAtom);
    set(debugStateAtom, {
      ...debugState,
      showServerLogs: !debugState.showServerLogs
    });
  }
); 