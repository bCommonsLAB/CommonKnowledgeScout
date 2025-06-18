import { atom } from 'jotai';

export interface LogEntry {
  id: string;  // Unique ID für React-Keys
  timestamp: string;
  area: 'nav' | 'state' | 'file' | 'ui';
  sequence: number;  // Sequenznummer für die Reihenfolge
  component: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  details?: any;
}

interface DebugState {
  logs: LogEntry[];
  visibleComponents: Set<string>;  // Komponenten können beliebige Namen haben
  visibleAreas: Set<'nav' | 'state' | 'file' | 'ui'>;
  maxLogs: number;  // Maximum number of logs to keep
}

const initialDebugState: DebugState = {
  logs: [],
  visibleComponents: new Set(['FileTree', 'Breadcrumb', 'FileList']),  // Standard-aktive Komponenten
  visibleAreas: new Set<'nav' | 'state' | 'file' | 'ui'>(['nav', 'state', 'file']),  // Standard-aktive Bereiche
  maxLogs: 1000,  // Standardwert für maximale Log-Anzahl
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
  (get, set, area: 'nav' | 'state' | 'file' | 'ui') => {
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