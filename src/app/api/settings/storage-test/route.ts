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
    const clientTokens = body?.tokens as { accessToken?: string; refreshToken?: string; tokenExpiry?: number } | undefined
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
          // Versuche, Tokens aus dem Request-Body zu holen (falls vom Client-Test übergeben)
          if (clientTokens?.accessToken && clientTokens?.refreshToken) {
            console.log('[Storage-Test] Versuche Tokens aus Client-Test zu verwenden...')
            push('Authentifizierung', 'info', 'Verwende Tokens vom Client-Test...')
            
            try {
              // Speichere Tokens in der DB
              const tokensApiUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/libraries/${libraryId}/tokens?email=${encodeURIComponent(userEmail)}`
              const saveResponse = await fetch(tokensApiUrl, {
                method: 'PATCH',
                headers: { 
                  'Content-Type': 'application/json',
                  'X-Internal-Request': '1'
                },
                body: JSON.stringify({
                  accessToken: clientTokens.accessToken,
                  refreshToken: clientTokens.refreshToken,
                  tokenExpiry: clientTokens.tokenExpiry || Math.floor(Date.now() / 1000) + 3600
                })
              })
              
              if (saveResponse.ok) {
                console.log('[Storage-Test] ✅ Tokens erfolgreich in DB gespeichert')
                push('Authentifizierung', 'success', 'Tokens vom Client-Test in DB gespeichert')
                
                // Versuche erneut, Root-Items aufzulisten
                rootItems = await provider.listItemsById('root')
                push('Root-Verzeichnis', 'success', `Root gelistet (${rootItems.length})`)
              } else {
                const saveError = await saveResponse.json().catch(() => ({ error: 'Unknown error' }))
                console.error('[Storage-Test] ❌ Fehler beim Speichern der Tokens:', saveError)
                push('Authentifizierung', 'error', 'Nicht authentifiziert. Bitte zuerst den Client-Test ausführen oder in den Storage-Einstellungen bei OneDrive anmelden.')
                return NextResponse.json({ success: false, logs }, { status: 401 })
              }
            } catch (saveError) {
              console.error('[Storage-Test] ❌ Exception beim Speichern der Tokens:', saveError)
              push('Authentifizierung', 'error', 'Nicht authentifiziert. Bitte zuerst den Client-Test ausführen oder in den Storage-Einstellungen bei OneDrive anmelden.')
              return NextResponse.json({ success: false, logs }, { status: 401 })
            }
          } else {
            push('Authentifizierung', 'error', 'Nicht authentifiziert. Bitte zuerst den Client-Test ausführen oder in den Storage-Einstellungen bei OneDrive anmelden.')
            return NextResponse.json({ success: false, logs }, { status: 401 })
          }
        } else {
          push('Authentifizierung', 'error', `Token-Laden fehlgeschlagen: ${errorMsg}`)
          return NextResponse.json({ success: false, logs }, { status: 401 })
        }
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



