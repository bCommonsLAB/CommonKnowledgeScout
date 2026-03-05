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
    const isDev = process.env.NODE_ENV === 'development';

    if (isDev) {
      // Development: Detaillierte Ausgabe mit Icons und Sequenznummern
      const icon = entry.level === 'error' ? '🔴' : 
                  entry.level === 'warn' ? '⚠️' : 
                  entry.level === 'info' ? 'ℹ️' : '🔍';
      const timeOnly = entry.timestamp.split('T')[1];
      console[entry.level](
        `[${timeOnly}][${entry.area.toUpperCase()}:${entry.sequence}][${entry.component}][${entry.level}] ${icon} ${entry.message}`,
        entry.details || ''
      );
    } else if (entry.level !== 'debug') {
      // Production: Kompakte Ausgabe für info/warn/error (debug unterdrückt).
      // In Electron wird console.log in main.log geschrieben – essentiell für Debugging.
      const fn = entry.level === 'error' ? console.error :
                 entry.level === 'warn' ? console.warn : console.log;
      fn(`[${entry.area}:${entry.component}] ${entry.message}`,
        entry.details ? JSON.stringify(entry.details) : '');
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

    // Verzögere die Callback-Ausführung, um React-Rendering-Konflikte zu vermeiden
    if (logCallbacks.size > 0) {
      // Verwende setTimeout mit 0ms Verzögerung, um die Ausführung nach dem aktuellen Render-Zyklus zu verschieben
      setTimeout(() => {
        logCallbacks.forEach(callback => {
          try {
            callback(entry);
          } catch (error) {
            console.warn('Fehler in Logger-Callback:', error);
          }
        });
      }, 0);
    }

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

/**
 * AuthLogger - Spezieller Logger für Authentifizierungs-Events
 * Verwendet 'state' area da Auth ein State-bezogenes Thema ist
 */
export class AuthLogger extends BaseLogger {
  static debug(component: string, message: string, details?: Record<string, unknown>) {
    return this.createLog('state', 'debug', component, `🔐 AUTH: ${message}`, details);
  }

  static info(component: string, message: string, details?: Record<string, unknown>) {
    return this.createLog('state', 'info', component, `🔐 AUTH: ${message}`, details);
  }

  static warn(component: string, message: string, details?: Record<string, unknown>) {
    return this.createLog('state', 'warn', component, `🔐 AUTH: ${message}`, details);
  }

  static error(component: string, message: string, error?: unknown) {
    const details: Record<string, unknown> = error instanceof Error ? { 
      error: error.message, 
      stack: error.stack,
      name: error.name
    } : (error && typeof error === 'object' && !Array.isArray(error) ? error as Record<string, unknown> : { error: error !== undefined ? String(error) : 'unknown error' });
    return this.createLog('state', 'error', component, `🔐 AUTH: ${message}`, details);
  }

  // Spezielle Methoden für verschiedene Auth-Events
  static clientAuth(component: string, result: { isSignedIn?: boolean; isLoaded?: boolean; userId?: string; email?: string }) {
    return this.info(component, 'Client-Side Auth State', {
      isSignedIn: result.isSignedIn,
      isLoaded: result.isLoaded,
      hasUserId: !!result.userId,
      hasEmail: !!result.email,
      userId: result.userId ? `${result.userId.substring(0, 8)}...` : undefined,
      email: result.email ? `${result.email.split('@')[0]}@...` : undefined
    });
  }

  static serverAuth(component: string, result: { userId?: string | null; user?: { emailAddresses?: Array<unknown> } | null; error?: unknown }) {
    return this.info(component, 'Server-Side Auth State', {
      hasUserId: !!result.userId,
      hasUser: !!result.user,
      hasError: !!result.error,
      userId: result.userId ? `${result.userId.substring(0, 8)}...` : null,
      emailCount: result.user?.emailAddresses?.length || 0,
      error: result.error instanceof Error ? result.error.message : result.error
    });
  }

  static apiCall(component: string, endpoint: string, status: 'start' | 'success' | 'error', details?: Record<string, unknown>) {
    const icon = status === 'start' ? '🚀' : status === 'success' ? '✅' : '❌';
    return this.info(component, `${icon} API Call ${endpoint} - ${status}`, details);
  }

  static cookieAnalysis(component: string, cookies: { [key: string]: string | undefined }) {
    const clerkCookies = Object.entries(cookies)
      .filter(([key]) => key.includes('clerk') || key.includes('session'))
      .reduce((acc, [key, value]) => {
        acc[key] = value ? `${value.substring(0, 20)}...` : undefined;
        return acc;
      }, {} as Record<string, string | undefined>);

    return this.debug(component, 'Clerk Cookies Analysis', {
      totalCookies: Object.keys(cookies).length,
      clerkCookiesCount: Object.keys(clerkCookies).length,
      clerkCookies
    });
  }
} 