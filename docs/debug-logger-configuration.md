# Debug Logger Konfiguration

## Übersicht

Das Debug-Logger-System ermöglicht strukturiertes Logging in der Knowledge Scout Anwendung. Alle Logs werden im Debug-Panel angezeigt und können optional in der Browser-Konsole ausgegeben werden.

## Logger-Klassen

### Client-seitige Logger

- **StorageLogger**: Für Storage-bezogene Komponenten
- **NavigationLogger**: Für Navigation und Routing
- **StateLogger**: Für State-Management
- **FileLogger**: Für Datei-Operationen
- **UILogger**: Für UI-Komponenten
- **SettingsLogger**: Für Einstellungen

### Server-seitige Logger

- **ServerLogger**: Für Server-seitige Logs (wird über API an Client gesendet)

## Verwendung

```typescript
import { StorageLogger } from '@/lib/debug/logger';

// Debug-Level (nur im Debug-Panel sichtbar)
StorageLogger.debug('ComponentName', 'Debug-Nachricht', { details: 'data' });

// Info-Level (wichtig für Verständnis)
StorageLogger.info('ComponentName', 'Info-Nachricht', { details: 'data' });

// Warn-Level (potentielle Probleme)
StorageLogger.warn('ComponentName', 'Warnung', { details: 'data' });

// Error-Level (Fehler)
StorageLogger.error('ComponentName', 'Fehler-Nachricht', error);
```

## Konfiguration

### Console-Logs aktivieren

Standardmäßig werden Console-Logs deaktiviert. Um sie zu aktivieren:

```bash
# In .env.local
NEXT_PUBLIC_ENABLE_CONSOLE_LOGS=true
```

### Debug-Panel

Das Debug-Panel zeigt alle Logs an und bietet:

- **Filterung** nach Komponenten und Bereichen
- **Server-Logs** Integration
- **Duplikaterkennung**
- **Manueller Refresh** für Server-Logs

## Best Practices

1. **Komponenten-Namen**: Verwende beschreibende Komponenten-Namen
2. **Nachrichten**: Schreibe klare, verständliche Nachrichten
3. **Details**: Füge relevante Daten als Details hinzu
4. **Level**: Wähle das passende Log-Level
5. **Performance**: Vermeide zu viele Debug-Logs in Produktion

## Debug-Panel Features

- **Real-time Updates**: Client-Logs werden automatisch angezeigt
- **Server-Logs**: Manueller Refresh über "Refresh Server" Button
- **Filterung**: Nach Komponenten und Bereichen
- **Duplikaterkennung**: Zeigt wiederholte Logs als Duplikate an
- **Export**: Kopieren von Log-Daten

## Troubleshooting

### Console-Logs erscheinen nicht
- Prüfe `NEXT_PUBLIC_ENABLE_CONSOLE_LOGS=true` in .env.local
- Nur in Development-Modus verfügbar

### Server-Logs werden nicht angezeigt
- Klicke "Refresh Server" im Debug-Panel
- Prüfe Server-Logs über "Library" Button

### Performance-Probleme
- Reduziere Debug-Logs in Produktion
- Verwende `debug` Level nur für Entwicklung 