import { NextResponse } from 'next/server';
import { LibraryService } from '@/lib/services/library-service';

export async function GET() {
  try {
    console.log('[VERIFY-REPAIR] Prüfe aktuellen Zustand nach Reparatur');
    
    const libraryService = LibraryService.getInstance();
    const userEmail = 'peter.aichner@crystal-design.com';
    
    // Direkt aus Datenbank laden (kein Cache)
    const libraries = await libraryService.getUserLibraries(userEmail);
    const nextcloudLib = libraries.find(lib => lib.id === 'e9e54ddc-6907-4ebb-8bf6-7f3f880c710a');
    const archivPeterLib = libraries.find(lib => lib.id === '_ArchivPeter');
    
    console.log('[VERIFY-REPAIR] AKTUELLER ZUSTAND:', {
      nextcloudPassword: nextcloudLib?.config?.password,
      nextcloudPrefix: nextcloudLib?.config?.password?.substring(0, 6) + '***',
      archivPeterPassword: archivPeterLib?.config?.password,
      archivPeterPrefix: archivPeterLib?.config?.password?.substring(0, 6) + '***',
      passwordsStillIdentical: nextcloudLib?.config?.password === archivPeterLib?.config?.password,
      timestamp: new Date().toISOString()
    });
    
    // Client Libraries auch prüfen
    const clientLibraries = libraryService.toClientLibraries(libraries);
    const clientNextcloudLib = clientLibraries.find(lib => lib.id === 'e9e54ddc-6907-4ebb-8bf6-7f3f880c710a');
    
    console.log('[VERIFY-REPAIR] CLIENT LIBRARIES:', {
      clientNextcloudPassword: clientNextcloudLib?.config?.password,
      clientNextcloudPrefix: clientNextcloudLib?.config?.password?.substring(0, 6) + '***'
    });
    
    return NextResponse.json({
      success: true,
      databaseState: {
        nextcloudPassword: nextcloudLib?.config?.password,
        nextcloudPrefix: nextcloudLib?.config?.password?.substring(0, 6) + '***',
        archivPeterPassword: archivPeterLib?.config?.password,
        archivPeterPrefix: archivPeterLib?.config?.password?.substring(0, 6) + '***',
        passwordsStillIdentical: nextcloudLib?.config?.password === archivPeterLib?.config?.password
      },
      clientState: {
        nextcloudPassword: clientNextcloudLib?.config?.password,
        nextcloudPrefix: clientNextcloudLib?.config?.password?.substring(0, 6) + '***'
      },
      expectedNextcloudPassword: 'Pf6fj-yATZ5-3Xbwk-ist3N-RZ4Mi',
      expectedPrefix: 'Pf6fj-***',
      repairWorked: nextcloudLib?.config?.password === 'Pf6fj-yATZ5-3Xbwk-ist3N-RZ4Mi'
    });
    
  } catch (error) {
    console.error('[VERIFY-REPAIR] Fehler:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unbekannter Fehler'
    }, { status: 500 });
  }
}