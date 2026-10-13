import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getServerProvider } from '@/lib/storage/server-provider'
import { FileLogger } from '@/lib/debug/logger'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress
    if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const libraryId: string | undefined = body?.libraryId
    if (!libraryId) return NextResponse.json({ error: 'libraryId erforderlich' }, { status: 400 })

    const logs: Array<Record<string, unknown>> = []
    const push = (step: string, status: 'info'|'success'|'error', message: string, details?: unknown) => {
      const entry = { timestamp: new Date().toISOString(), step, status, message, details }
      logs.push(entry)
      FileLogger.info('storage-test', message, { step, status, libraryId })
    }

    // Provider initialisieren und validieren
    push('Validierung', 'info', 'Initialisiere Provider...')
    const provider = await getServerProvider(userEmail, libraryId)
    const validation = await provider.validateConfiguration()
    if (!validation.isValid) {
      push('Validierung', 'error', 'Konfiguration ungültig', validation)
      return NextResponse.json({ success: false, logs }, { status: 400 })
    }
    push('Validierung', 'success', 'Konfiguration gültig', validation)

    // Für OneDrive: Versuche Root-Items aufzulisten, um Tokens zu laden/refreshen
    // Dies ruft ensureAccessToken() auf, was die Tokens lädt und refresht falls nötig
    // Wenn dies fehlschlägt, bedeutet es, dass keine Authentifizierung vorhanden ist
    const hasIsAuthenticated = typeof (provider as unknown as { isAuthenticated?: () => boolean }).isAuthenticated === 'function'
    
    // Lade Library-Info für Logging
    const { LibraryService } = await import('@/lib/services/library-service')
    const libraryService = LibraryService.getInstance()
    const libraries = await libraryService.getUserLibraries(userEmail)
    const library = libraries.find(l => l.id === libraryId)
    
    console.log('[Storage-Test] Provider-Info:', {
      libraryId,
      userEmail,
      hasIsAuthenticated,
      providerType: (provider as unknown as { name?: string }).name || 'unknown',
      libraryConfigKeys: library?.config ? Object.keys(library.config as Record<string, unknown>) : [],
      libraryType: library?.type
    });
    
    // Für OneDrive: Versuche Root-Items aufzulisten, um Tokens zu laden
    // Dies stellt sicher, dass Tokens geladen und ggf. refreshed werden
    let rootItems: Awaited<ReturnType<typeof provider.listItemsById>>
    if (hasIsAuthenticated) {
      try {
        push('Authentifizierung', 'info', 'Lade Tokens und prüfe Authentifizierung...')
        console.log('[Storage-Test] Versuche Root-Items aufzulisten (OneDrive)...')
        
        // Prüfe Authentifizierungsstatus VOR dem Aufruf
        const isAuthBefore = (provider as unknown as { isAuthenticated: () => boolean }).isAuthenticated()
        console.log('[Storage-Test] Authentifizierungsstatus VOR listItemsById:', { isAuthBefore })
        
        // Versuche Root-Items aufzulisten - dies ruft ensureAccessToken() auf
        rootItems = await provider.listItemsById('root')
        
        // Prüfe Authentifizierungsstatus NACH dem Aufruf
        const isAuthAfter = (provider as unknown as { isAuthenticated: () => boolean }).isAuthenticated()
        console.log('[Storage-Test] Authentifizierungsstatus NACH listItemsById:', { isAuthAfter, rootItemsCount: rootItems.length })
        
        push('Authentifizierung', 'success', 'Tokens geladen und Authentifizierung erfolgreich')
        push('Root-Verzeichnis', 'success', `Root gelistet (${rootItems.length})`)
      } catch (tokenError) {
        // Token-Laden fehlgeschlagen - prüfe ob Authentifizierung erforderlich ist
        const errorMsg = tokenError instanceof Error ? tokenError.message : String(tokenError)
        const errorCode = (tokenError as unknown as { code?: string }).code
        const errorStack = tokenError instanceof Error ? tokenError.stack : undefined
        
        console.error('[Storage-Test] ❌ Fehler beim Token-Laden:', {
          errorMsg,
          errorCode,
          errorStack,
          errorType: tokenError?.constructor?.name,
          error: tokenError
        });
        
        if (errorCode === 'AUTH_REQUIRED' || errorMsg.includes('Nicht authentifiziert')) {
          // Seit Teil A liegen die Tokens an der Speicher-Verbindung; angemeldet
          // wird auf der Konto-Seite, nicht mehr ueber Tokens aus dem Client-Test.
          push('Authentifizierung', 'error', 'Nicht angemeldet. Bitte unter Mein Konto → Speicher-Verbindungen bei Microsoft anmelden.')
          return NextResponse.json({ success: false, logs }, { status: 401 })
        }
        push('Authentifizierung', 'error', `Token-Laden fehlgeschlagen: ${errorMsg}`)
        return NextResponse.json({ success: false, logs }, { status: 401 })
      }
    } else {
      // Für andere Provider: Einfach Root auflisten
      push('Root-Verzeichnis', 'info', 'Liste Root auf...')
      rootItems = await provider.listItemsById('root')
      push('Root-Verzeichnis', 'success', `Root gelistet (${rootItems.length})`)
    }

    // Testordner anlegen
    const testFolderName = `server-test-${Math.random().toString(36).slice(2, 8)}`
    push('Testverzeichnis', 'info', `Erstelle ${testFolderName}...`)
    const folder = await provider.createFolder('root', testFolderName)
    push('Testverzeichnis', 'success', `Ordner erstellt`, { id: folder.id })

    // Testdatei hochladen
    const fileName = `hello-${Math.random().toString(36).slice(2, 6)}.txt`
    const content = 'Serverseitiger Storage-Test.'
    const file = new File([new Blob([content], { type: 'text/plain' })], fileName, { type: 'text/plain' })
    push('Testdatei', 'info', `Lade ${fileName} hoch...`)
    const uploaded = await provider.uploadFile(folder.id, file)
    push('Testdatei', 'success', `Datei hochgeladen`, { id: uploaded.id })

    // Datei abrufen
    push('Datei abrufen', 'info', `Hole Metadaten...`)
    const meta = await provider.getItemById(uploaded.id)
    push('Datei abrufen', 'success', `Metadaten ok`, { name: meta.metadata.name, size: meta.metadata.size })

    // Binärdaten lesen
    push('Binärdaten', 'info', `Lese Inhalt...`)
    const bin = await provider.getBinary(uploaded.id)
    const text = await bin.blob.text()
    const ok = text === content
    push('Binärdaten', ok ? 'success' : 'error', ok ? 'Inhalt verifiziert' : 'Inhalt abweichend')

    // Pfad lesen
    const path = await provider.getPathById(uploaded.id)
    push('Dateipfad', 'success', `Pfad: ${path}`)

    // Pfad-Items (Breadcrumb)
    push('Pfad-Items', 'info', 'Rufe Breadcrumb-Pfad ab...')
    const pathItems = await provider.getPathItemsById(uploaded.id)
    push('Pfad-Items', 'success', `Breadcrumb: ${pathItems.map(p => p.metadata.name).join(' / ')} (${pathItems.length} Ebenen)`)

    // Umbenennen
    const renamedName = `renamed-${fileName}`
    push('Umbenennen', 'info', `Benenne "${fileName}" um in "${renamedName}"...`)
    const renamed = await provider.renameItem(uploaded.id, renamedName)
    push('Umbenennen', renamed.metadata.name === renamedName ? 'success' : 'error',
      renamed.metadata.name === renamedName ? `Umbenannt zu "${renamedName}"` : `Name stimmt nicht: "${renamed.metadata.name}"`)

    // Verschieben
    const moveTargetName = `move-target-${Math.random().toString(36).slice(2, 8)}`
    push('Verschieben', 'info', `Erstelle Zielordner und verschiebe Datei...`)
    const moveTarget = await provider.createFolder('root', moveTargetName)
    await provider.moveItem(renamed.id, moveTarget.id)
    const movedItems = await provider.listItemsById(moveTarget.id)
    const moveOk = movedItems.some(i => i.metadata.name === renamedName)
    push('Verschieben', moveOk ? 'success' : 'error',
      moveOk ? `Datei nach "${moveTargetName}" verschoben` : 'Datei nicht im Zielordner gefunden')

    // Streaming-URL
    const movedFile = movedItems.find(i => i.metadata.name === renamedName)
    if (movedFile) {
      push('Streaming-URL', 'info', 'Rufe Streaming-URL ab...')
      const streamUrl = await provider.getStreamingUrl(movedFile.id)
      push('Streaming-URL', streamUrl ? 'success' : 'error', streamUrl ? `URL erhalten` : 'Keine URL')

      push('Download-URL', 'info', 'Rufe Download-URL ab...')
      const dlUrl = await provider.getDownloadUrl(movedFile.id)
      push('Download-URL', dlUrl ? 'success' : 'error', dlUrl ? `URL erhalten` : 'Keine URL')
    }

    // Aufräumen – beide Testordner löschen
    push('Aufräumen', 'info', `Lösche Testordner...`)
    await provider.deleteItem(folder.id)
    await provider.deleteItem(moveTarget.id)
    push('Aufräumen', 'success', `Alle Testordner gelöscht`)

    return NextResponse.json({ success: true, logs })
  } catch (err) {
    const anyErr = err as unknown as { code?: string; message?: string }
    const msg = anyErr?.message || (err instanceof Error ? err.message : String(err))
    const status = anyErr?.code === 'AUTH_REQUIRED' ? 401 : 500
    return NextResponse.json({ success: false, error: msg }, { status })
  }
}



