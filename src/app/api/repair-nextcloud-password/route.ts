import { NextResponse } from 'next/server';
import { LibraryService } from '@/lib/services/library-service';

export async function POST() {
  try {
    console.log('[REPAIR-NEXTCLOUD] Starte Passwort-Reparatur für Nextcloud Library');
    
    const libraryService = LibraryService.getInstance();
    const userEmail = 'peter.aichner@crystal-design.com';
    
    // 1. Aktuelle Libraries laden
    const libraries = await libraryService.getUserLibraries(userEmail);
    console.log('[REPAIR-NEXTCLOUD] Aktuelle Libraries geladen:', libraries.length);
    
    // 2. Nextcloud Library finden
    const nextcloudLib = libraries.find(lib => lib.id === 'e9e54ddc-6907-4ebb-8bf6-7f3f880c710a');
    
    if (!nextcloudLib) {
      return NextResponse.json({ 
        error: 'Nextcloud Library nicht gefunden',
        availableIds: libraries.map(lib => lib.id)
      }, { status: 404 });
    }
    
    console.log('[REPAIR-NEXTCLOUD] Aktuelle Nextcloud Config:', {
      id: nextcloudLib.id,
      label: nextcloudLib.label,
      currentPassword: nextcloudLib.config?.password,
      currentPasswordPrefix: nextcloudLib.config?.password ? nextcloudLib.config.password.substring(0, 6) + '***' : 'fehlt'
    });
    
    // 3. Korrektes Passwort setzen
    const correctPassword = 'Pf6fj-yATZ5-3Xbwk-ist3N-RZ4Mi';
    
    // Update der Nextcloud Library
    const updatedNextcloudLib = {
      ...nextcloudLib,
      config: {
        ...nextcloudLib.config,
        password: correctPassword
      }
    };
    
    // 4. Library in der Liste ersetzen
    const updatedLibraries = libraries.map(lib => 
      lib.id === 'e9e54ddc-6907-4ebb-8bf6-7f3f880c710a' ? updatedNextcloudLib : lib
    );
    
    console.log('[REPAIR-NEXTCLOUD] Reparierte Nextcloud Config:', {
      id: updatedNextcloudLib.id,
      label: updatedNextcloudLib.label,
      newPassword: updatedNextcloudLib.config?.password,
      newPasswordPrefix: updatedNextcloudLib.config?.password ? updatedNextcloudLib.config.password.substring(0, 6) + '***' : 'fehlt'
    });
    
    // 5. Libraries in Datenbank speichern
    await libraryService.updateUserLibraries(userEmail, updatedLibraries);
    
    console.log('[REPAIR-NEXTCLOUD] Datenbank-Update erfolgreich!');
    
    // 6. Verifikation - Libraries nochmal laden
    const verificationLibraries = await libraryService.getUserLibraries(userEmail);
    const verifiedNextcloudLib = verificationLibraries.find(lib => lib.id === 'e9e54ddc-6907-4ebb-8bf6-7f3f880c710a');
    
    console.log('[REPAIR-NEXTCLOUD] Verifikation:', {
      nextcloudPasswordCorrect: verifiedNextcloudLib?.config?.password === correctPassword,
      actualPassword: verifiedNextcloudLib?.config?.password,
      expectedPassword: correctPassword
    });
    
    return NextResponse.json({
      success: true,
      message: 'Nextcloud Passwort erfolgreich repariert',
      verification: {
        passwordCorrect: verifiedNextcloudLib?.config?.password === correctPassword,
        oldPasswordPrefix: nextcloudLib.config?.password ? nextcloudLib.config.password.substring(0, 6) + '***' : 'fehlt',
        newPasswordPrefix: verifiedNextcloudLib?.config?.password ? verifiedNextcloudLib.config.password.substring(0, 6) + '***' : 'fehlt'
      }
    });
    
  } catch (error) {
    console.error('[REPAIR-NEXTCLOUD] Fehler bei der Reparatur:', error);
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}