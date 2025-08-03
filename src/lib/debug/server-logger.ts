/**
 * Serverseitiger Logger für Server-Logs
 * Speichert Logs in einem globalen Array und macht sie über API verfügbar
 */

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

// Globaler Log-Speicher für Server-Logs
const serverLogs: ServerLogEntry[] = [];
let sequenceCounter = 0;

// Maximale Anzahl von Server-Logs (verhindert Memory-Leaks)
const MAX_SERVER_LOGS = 1000;

class ServerLogger {
  private static getNextSequence(): number {
    sequenceCounter++;
    return sequenceCounter;
  }

  private static createLog(
    area: ServerLogEntry['area'],
    level: ServerLogEntry['level'],
    component: string,
    message: string,
    details?: Record<string, unknown>
  ): ServerLogEntry {
    const log: ServerLogEntry = {
      id: `server-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      area,
      sequence: this.getNextSequence(),
      component,
      level,
      message,
      details
    };

    // Log hinzufügen
    serverLogs.push(log);

    // Alte Logs entfernen, wenn Maximum erreicht
    if (serverLogs.length > MAX_SERVER_LOGS) {
      serverLogs.splice(0, serverLogs.length - MAX_SERVER_LOGS);
    }

    // Auch in Console ausgeben (für Server-Debugging)
    const consoleMethod = console[level] || console.log;
    consoleMethod(`[SERVER:${area.toUpperCase()}:${sequenceCounter}][${component}][${level}] ${message}`, details || '');

    return log;
  }

  static debug(component: string, message: string, details?: Record<string, unknown>) {
    return this.createLog('storage', 'debug', component, message, details);
  }

  static info(component: string, message: string, details?: Record<string, unknown>) {
    return this.createLog('storage', 'info', component, message, details);
  }

  static warn(component: string, message: string, details?: Record<string, unknown>) {
    return this.createLog('storage', 'warn', component, message, details);
  }

  static error(component: string, message: string, error?: unknown) {
    return this.createLog('storage', 'error', component, message, 
      error instanceof Error ? { error: error.message, stack: error.stack } : { error }
    );
  }

  // Spezielle Logger für verschiedene Bereiche
  static api(component: string, message: string, details?: Record<string, unknown>) {
    return this.createLog('api', 'info', component, message, details);
  }

  static database(component: string, message: string, details?: Record<string, unknown>) {
    return this.createLog('database', 'info', component, message, details);
  }

  static auth(component: string, message: string, details?: Record<string, unknown>) {
    return this.createLog('auth', 'info', component, message, details);
  }

  // API-Methoden für Client-Zugriff
  static getLogs(): ServerLogEntry[] {
    return [...serverLogs]; // Kopie zurückgeben
  }

  static clearLogs(): void {
    serverLogs.length = 0;
    sequenceCounter = 0;
  }

  static getLogsByArea(area: ServerLogEntry['area']): ServerLogEntry[] {
    return serverLogs.filter(log => log.area === area);
  }

  static getLogsByComponent(component: string): ServerLogEntry[] {
    return serverLogs.filter(log => log.component === component);
  }
}

export { ServerLogger }; 