import { ServerLogger } from '@/lib/debug/logger';

/**
 * Storage-spezifische Logger-Funktionen für verschiedene Storage-Komponenten
 * Diese Funktionen ersetzen die direkten console.log-Aufrufe und integrieren
 * sich in das globale Debugging-System.
 */

// StorageFactory Logger
export const StorageFactoryLogger = {
  info: (message: string, details?: Record<string, unknown>) => {
    ServerLogger.info('StorageFactory', message, details);
  },
  
  debug: (message: string, details?: Record<string, unknown>) => {
    ServerLogger.debug('StorageFactory', message, details);
  },
  
  warn: (message: string, details?: Record<string, unknown>) => {
    ServerLogger.warn('StorageFactory', message, details);
  },
  
  error: (message: string, error?: unknown) => {
    ServerLogger.error('StorageFactory', message, error);
  }
};

// LocalStorageProvider Logger
export const LocalStorageProviderLogger = {
  info: (message: string, details?: Record<string, unknown>) => {
    ServerLogger.info('LocalStorageProvider', message, details);
  },
  
  debug: (message: string, details?: Record<string, unknown>) => {
    ServerLogger.debug('LocalStorageProvider', message, details);
  },
  
  warn: (message: string, details?: Record<string, unknown>) => {
    ServerLogger.warn('LocalStorageProvider', message, details);
  },
  
  error: (message: string, error?: unknown) => {
    ServerLogger.error('LocalStorageProvider', message, error);
  }
};

// OneDriveProvider Logger
export const OneDriveProviderLogger = {
  info: (message: string, details?: Record<string, unknown>) => {
    ServerLogger.info('OneDriveProvider', message, details);
  },
  
  debug: (message: string, details?: Record<string, unknown>) => {
    ServerLogger.debug('OneDriveProvider', message, details);
  },
  
  warn: (message: string, details?: Record<string, unknown>) => {
    ServerLogger.warn('OneDriveProvider', message, details);
  },
  
  error: (message: string, error?: unknown) => {
    ServerLogger.error('OneDriveProvider', message, error);
  }
};

// WebDAVProvider Logger
export const WebDAVProviderLogger = {
  info: (message: string, details?: Record<string, unknown>) => {
    ServerLogger.info('WebDAVProvider', message, details);
  },
  
  debug: (message: string, details?: Record<string, unknown>) => {
    ServerLogger.debug('WebDAVProvider', message, details);
  },
  
  warn: (message: string, details?: Record<string, unknown>) => {
    ServerLogger.warn('WebDAVProvider', message, details);
  },
  
  error: (message: string, error?: unknown) => {
    ServerLogger.error('WebDAVProvider', message, error);
  }
};

// FileSystemProvider Logger
export const FileSystemProviderLogger = {
  info: (message: string, details?: Record<string, unknown>) => {
    ServerLogger.info('FileSystemProvider', message, details);
  },
  
  debug: (message: string, details?: Record<string, unknown>) => {
    ServerLogger.debug('FileSystemProvider', message, details);
  },
  
  warn: (message: string, details?: Record<string, unknown>) => {
    ServerLogger.warn('FileSystemProvider', message, details);
  },
  
  error: (message: string, error?: unknown) => {
    ServerLogger.error('FileSystemProvider', message, error);
  }
};

// FileSystemClient Logger
export const FileSystemClientLogger = {
  info: (message: string, details?: Record<string, unknown>) => {
    ServerLogger.info('FileSystemClient', message, details);
  },
  
  debug: (message: string, details?: Record<string, unknown>) => {
    ServerLogger.debug('FileSystemClient', message, details);
  },
  
  warn: (message: string, details?: Record<string, unknown>) => {
    ServerLogger.warn('FileSystemClient', message, details);
  },
  
  error: (message: string, error?: unknown) => {
    ServerLogger.error('FileSystemClient', message, error);
  }
};

// StorageContext Logger
export const StorageContextLogger = {
  info: (message: string, details?: Record<string, unknown>) => {
    ServerLogger.info('StorageContext', message, details);
  },
  
  debug: (message: string, details?: Record<string, unknown>) => {
    ServerLogger.debug('StorageContext', message, details);
  },
  
  warn: (message: string, details?: Record<string, unknown>) => {
    ServerLogger.warn('StorageContext', message, details);
  },
  
  error: (message: string, error?: unknown) => {
    ServerLogger.error('StorageContext', message, error);
  }
};

// useStorageProvider Hook Logger
export const UseStorageProviderLogger = {
  info: (message: string, details?: Record<string, unknown>) => {
    ServerLogger.info('useStorageProvider', message, details);
  },
  
  debug: (message: string, details?: Record<string, unknown>) => {
    ServerLogger.debug('useStorageProvider', message, details);
  },
  
  warn: (message: string, details?: Record<string, unknown>) => {
    ServerLogger.warn('useStorageProvider', message, details);
  },
  
  error: (message: string, error?: unknown) => {
    ServerLogger.error('useStorageProvider', message, error);
  }
}; 