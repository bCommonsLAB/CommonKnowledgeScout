import { NextResponse } from 'next/server';
import { ServerLogger } from '@/lib/debug/server-logger';

export async function GET() {
  try {
    // Test-Logs generieren
    ServerLogger.info('TestService', 'Test Server-Log generiert', { 
      timestamp: new Date().toISOString(),
      testData: { key: 'value', number: 42 }
    });

    ServerLogger.debug('TestService', 'Debug Test-Log', { 
      debugInfo: 'Dies ist ein Debug-Log vom Server'
    });

    ServerLogger.warn('TestService', 'Warnung Test-Log', { 
      warning: 'Dies ist eine Warnung vom Server'
    });

    ServerLogger.error('TestService', 'Fehler Test-Log', new Error('Test-Fehler vom Server'));

    // Spezielle Bereichs-Logs
    ServerLogger.api('TestService', 'API Test-Log', { endpoint: '/api/debug/test-server-logs' });
    ServerLogger.database('TestService', 'Database Test-Log', { operation: 'SELECT' });
    ServerLogger.auth('TestService', 'Auth Test-Log', { user: 'test@example.com' });

    return NextResponse.json({
      success: true,
      message: 'Test Server-Logs generiert',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Fehler beim Generieren der Test-Logs:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Fehler beim Generieren der Test-Logs',
        details: error instanceof Error ? error.message : 'Unbekannter Fehler'
      },
      { status: 500 }
    );
  }
} 