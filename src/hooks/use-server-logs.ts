import { useEffect, useState } from 'react';
import { useAtom } from 'jotai';
import { addServerLogAtom, clearServerLogsAtom } from '@/atoms/debug-atom';

export interface ServerLogEntry {
  id: string;
  timestamp: string;
  area: 'storage' | 'api' | 'database' | 'auth';
  sequence: number;
  component: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  details?: Record<string, unknown>;
}

export function useServerLogs() {
  const [serverLogs, setServerLogs] = useState<ServerLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTimestamp, setLastFetchTimestamp] = useState<number>(0);
  const [, addServerLog] = useAtom(addServerLogAtom);
  const [, clearServerLogs] = useAtom(clearServerLogsAtom);

  // Server-Logs abrufen
  const fetchServerLogs = async (area?: string, component?: string, forceRefresh = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (area) params.append('area', area);
      if (component) params.append('component', component);
      
      // Nur neue Logs abrufen (seit dem letzten Fetch)
      if (!forceRefresh && lastFetchTimestamp > 0) {
        params.append('since', lastFetchTimestamp.toString());
      }

      const response = await fetch(`/api/debug/server-logs?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        // Nur neue Logs hinzufügen
        const newLogs = data.logs.filter((log: ServerLogEntry) => {
          const logTimestamp = new Date(log.timestamp).getTime();
          return logTimestamp > lastFetchTimestamp;
        });

        if (newLogs.length > 0) {
          setServerLogs(prev => [...prev, ...newLogs]);
          
          // Nur neue Logs in das Debug-System integrieren
          newLogs.forEach((log: ServerLogEntry) => {
            addServerLog({
              timestamp: log.timestamp,
              area: log.area,
              sequence: log.sequence,
              component: log.component,
              level: log.level,
              message: log.message,
              details: log.details
            });
          });
        }
        
        // Timestamp für nächsten Fetch aktualisieren
        setLastFetchTimestamp(Date.now());
      } else {
        throw new Error(data.error || 'Unbekannter Fehler');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unbekannter Fehler';
      setError(errorMessage);
      console.error('Fehler beim Abrufen der Server-Logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Server-Logs löschen
  const clearLogs = async () => {
    try {
      const response = await fetch('/api/debug/server-logs?clear=true');
      
      if (response.ok) {
        setServerLogs([]);
        clearServerLogs();
      }
    } catch (err) {
      console.error('Fehler beim Löschen der Server-Logs:', err);
    }
  };

  // Automatisches Abrufen nur beim Mount
  useEffect(() => {
    fetchServerLogs(undefined, undefined, true); // Erster Fetch: alle Logs
  }, []);

  return {
    serverLogs,
    isLoading,
    error,
    fetchServerLogs,
    clearLogs,
    refetch: () => fetchServerLogs()
  };
} 