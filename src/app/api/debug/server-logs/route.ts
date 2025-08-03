import { NextRequest, NextResponse } from 'next/server';
import { ServerLogger, ServerLogEntry } from '@/lib/debug/server-logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const area = searchParams.get('area') as 'storage' | 'api' | 'database' | 'auth' | null;
    const component = searchParams.get('component');
    const clear = searchParams.get('clear') === 'true';
    const since = searchParams.get('since');

    let logs: ServerLogEntry[] = [];

    if (clear) {
      ServerLogger.clearLogs();
      logs = [];
    } else if (area) {
      logs = ServerLogger.getLogsByArea(area);
    } else if (component) {
      logs = ServerLogger.getLogsByComponent(component);
    } else {
      logs = ServerLogger.getLogs();
    }

    // Filtere Logs nach Timestamp wenn 'since' Parameter vorhanden
    if (since && !clear) {
      const sinceTimestamp = parseInt(since);
      logs = logs.filter(log => {
        const logTimestamp = new Date(log.timestamp).getTime();
        return logTimestamp > sinceTimestamp;
      });
    }

    return NextResponse.json({
      success: true,
      logs,
      count: logs.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Fehler beim Abrufen der Server-Logs:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Fehler beim Abrufen der Server-Logs',
        details: error instanceof Error ? error.message : 'Unbekannter Fehler'
      },
      { status: 500 }
    );
  }
} 