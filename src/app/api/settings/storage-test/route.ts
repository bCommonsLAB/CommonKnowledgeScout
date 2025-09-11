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

    // Falls Authentifizierung erforderlich, 401 zurückgeben mit Hinweis
    const authRequired = typeof validation.error === 'string' && validation.error.includes('Authentifizierung erforderlich')
    const hasIsAuthenticated = typeof (provider as unknown as { isAuthenticated?: () => boolean }).isAuthenticated === 'function'
    const isAuth = hasIsAuthenticated ? (provider as unknown as { isAuthenticated: () => boolean }).isAuthenticated() : true
    if (authRequired || !isAuth) {
      push('Authentifizierung', 'error', 'Nicht authentifiziert. Bitte in den Storage-Einstellungen bei OneDrive anmelden.')
      return NextResponse.json({ success: false, logs }, { status: 401 })
    }

    // Root auflisten
    push('Root-Verzeichnis', 'info', 'Liste Root auf...')
    const rootItems = await provider.listItemsById('root')
    push('Root-Verzeichnis', 'success', `Root gelistet (${rootItems.length})`)

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

    // Aufräumen
    push('Aufräumen', 'info', `Lösche Testordner...`)
    await provider.deleteItem(folder.id)
    push('Aufräumen', 'success', `Ordner gelöscht`)

    return NextResponse.json({ success: true, logs })
  } catch (err) {
    const anyErr = err as unknown as { code?: string; message?: string }
    const msg = anyErr?.message || (err instanceof Error ? err.message : String(err))
    const status = anyErr?.code === 'AUTH_REQUIRED' ? 401 : 500
    return NextResponse.json({ success: false, error: msg }, { status })
  }
}



