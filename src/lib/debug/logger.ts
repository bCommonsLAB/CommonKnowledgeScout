import { LogEntry } from '@/atoms/debug-atom';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogArea = 'nav' | 'state' | 'file' | 'ui';

// Event-System für Logs
type LogCallback = (entry: Omit<LogEntry, 'id'>) => void;
const logCallbacks: Set<LogCallback> = new Set();

export function subscribeToLogs(callback: LogCallback): () => void {
  logCallbacks.add(callback);
  return () => {
    logCallbacks.delete(callback);
  };
}

class BaseLogger {
  private static sequences: Record<LogArea, number> = {
    nav: 0,
    state: 0,
    file: 0,
    ui: 0
  };

  private static formatMessage(
    area: LogArea,
    level: LogLevel,
    component: string,
    message: string,
    details?: Record<string, unknown>
  ): Omit<LogEntry, 'id'> {
    const timestamp = new Date().toISOString();
    const sequence = ++this.sequences[area];
    
    return {
      timestamp,
      area,
      sequence,
      component,
      level,
      message,
      details
    };
  }

  private static logToConsole(entry: Omit<LogEntry, 'id'>) {
    if (process.env.NODE_ENV === 'development') {
      const icon = entry.level === 'error' ? '🔴' : 
                  entry.level === 'warn' ? '⚠️' : 
                  entry.level === 'info' ? 'ℹ️' : '🔍';
      
      // Formatiere den Zeitstempel für die Konsolenausgabe
      const timeOnly = entry.timestamp.split('T')[1];
      
      console[entry.level](
        `[${timeOnly}][${entry.area.toUpperCase()}:${entry.sequence}][${entry.component}][${entry.level}] ${icon} ${entry.message}`,
        entry.details || ''
      );
    }
  }

  protected static createLog(
    area: LogArea,
    level: LogLevel,
    component: string,
    message: string,
    details?: Record<string, unknown>
  ): Omit<LogEntry, 'id'> {
    const entry = this.formatMessage(area, level, component, message, details);
    this.logToConsole(entry);

    // Benachrichtige alle Subscribers
    logCallbacks.forEach(callback => callback(entry));

    return entry;
  }

  static resetSequences() {
    Object.keys(this.sequences).forEach(key => {
      this.sequences[key as LogArea] = 0;
    });
  }
}

export class NavigationLogger extends BaseLogger {
  static debug(component: string, message: string, details?: Record<string, unknown>) {
    return this.createLog('nav', 'debug', component, message, details);
  }

  static info(component: string, message: string, details?: Record<string, unknown>) {
    return this.createLog('nav', 'info', component, message, details);
  }

  static warn(component: string, message: string, details?: Record<string, unknown>) {
    return this.createLog('nav', 'warn', component, message, details);
  }

  static error(component: string, message: string, error?: unknown) {
    return this.createLog('nav', 'error', component, message, error instanceof Error ? { error: error.message, stack: error.stack } : { error });
  }
}

export class StateLogger extends BaseLogger {
  static debug(component: string, message: string, details?: Record<string, unknown>) {
    return this.createLog('state', 'debug', component, message, details);
  }

  static info(component: string, message: string, details?: Record<string, unknown>) {
    return this.createLog('state', 'info', component, message, details);
  }

  static warn(component: string, message: string, details?: Record<string, unknown>) {
    return this.createLog('state', 'warn', component, message, details);
  }

  static error(component: string, message: string, error?: unknown) {
    return this.createLog('state', 'error', component, message, error instanceof Error ? { error: error.message, stack: error.stack } : { error });
  }
}

export class FileLogger extends BaseLogger {
  static debug(component: string, message: string, details?: Record<string, unknown>) {
    return this.createLog('file', 'debug', component, message, details);
  }

  static info(component: string, message: string, details?: Record<string, unknown>) {
    return this.createLog('file', 'info', component, message, details);
  }

  static warn(component: string, message: string, details?: Record<string, unknown>) {
    return this.createLog('file', 'warn', component, message, details);
  }

  static error(component: string, message: string, error?: unknown) {
    return this.createLog('file', 'error', component, message, error instanceof Error ? { error: error.message, stack: error.stack } : { error });
  }
}

export class UILogger extends BaseLogger {
  static debug(component: string, message: string, details?: Record<string, unknown>) {
    return this.createLog('ui', 'debug', component, message, details);
  }

  static info(component: string, message: string, details?: Record<string, unknown>) {
    return this.createLog('ui', 'info', component, message, details);
  }

  static warn(component: string, message: string, details?: Record<string, unknown>) {
    return this.createLog('ui', 'warn', component, message, details);
  }

  static error(component: string, message: string, error?: unknown) {
    return this.createLog('ui', 'error', component, message, error instanceof Error ? { error: error.message, stack: error.stack } : { error });
  }
} 