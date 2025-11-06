import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import { StorageFactory } from '@/lib/storage/storage-factory'

// GET - Tokens aus der Library-Konfiguration abrufen (Server-intern)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const isInternal = req.headers.get('x-internal-request') === '1'
    const emailParam = req.nextUrl.searchParams.get('email') || undefined
    
    if (!isInternal) {
      const { userId } = await auth()
      if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }
    
    const user = isInternal ? null : await currentUser()
    const email = emailParam || user?.emailAddresses?.[0]?.emailAddress
    if (!email) return NextResponse.json({ error: 'E-Mail nicht gefunden' }, { status: 400 })

    const svc = LibraryService.getInstance()
    const libs = await svc.getUserLibraries(email)
    const lib = libs.find(l => l.id === id)
    if (!lib) return NextResponse.json({ error: 'Library nicht gefunden' }, { status: 404 })

    const cfg = lib.config as unknown as Record<string, unknown> | undefined
    const accessToken = cfg?.accessToken as string | undefined
    const refreshToken = cfg?.refreshToken as string | undefined
    const tokenExpiry = cfg?.tokenExpiry as number | string | undefined

    if (!accessToken || !refreshToken) {
      return NextResponse.json({ error: 'Keine Tokens gefunden' }, { status: 404 })
    }

    return NextResponse.json({
      accessToken,
      refreshToken,
      tokenExpiry: Number(tokenExpiry || 0)
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// PATCH - Persistiert Tokens in der Library (Server-intern oder via Clerk)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const isInternal = req.headers.get('x-internal-request') === '1'
    const emailParam = req.nextUrl.searchParams.get('email') || undefined
    if (!isInternal) {
      const { userId } = await auth()
      if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }
    const user = isInternal ? null : await currentUser()
    const email = emailParam || user?.emailAddresses?.[0]?.emailAddress
    if (!email) return NextResponse.json({ error: 'E-Mail nicht gefunden' }, { status: 400 })

    const { accessToken, refreshToken, tokenExpiry } = await req.json()
    if (!accessToken || !refreshToken || !tokenExpiry) {
      return NextResponse.json({ error: 'accessToken, refreshToken, tokenExpiry erforderlich' }, { status: 400 })
    }

    const svc = LibraryService.getInstance()
    const libs = await svc.getUserLibraries(email)
    const lib = libs.find(l => l.id === id)
    if (!lib) return NextResponse.json({ error: 'Library nicht gefunden' }, { status: 404 })

    // Tokens typisiert ohne any in die Konfiguration schreiben
    const cfg: Record<string, unknown> = { ...(lib.config || {}) }
    cfg['accessToken'] = accessToken
    cfg['refreshToken'] = refreshToken
    cfg['tokenExpiry'] = Number(tokenExpiry)
    lib.config = cfg as typeof lib.config

    const ok = await svc.updateLibrary(email, lib)
    if (!ok) return NextResponse.json({ error: 'Speichern fehlgeschlagen' }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// DELETE - Tokens in der DB entfernen und Provider-Cache leeren
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const isInternal = req.headers.get('x-internal-request') === '1'
    const emailParam = req.nextUrl.searchParams.get('email') || undefined
    if (!isInternal) {
      const { userId } = await auth()
      if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }
    const user = isInternal ? null : await currentUser()
    const email = emailParam || user?.emailAddresses?.[0]?.emailAddress
    if (!email) return NextResponse.json({ error: 'E-Mail nicht gefunden' }, { status: 400 })

    const svc = LibraryService.getInstance()
    const libs = await svc.getUserLibraries(email)
    const lib = libs.find(l => l.id === id)
    if (!lib) return NextResponse.json({ error: 'Library nicht gefunden' }, { status: 404 })

    if (lib.config) {
      const cfg = lib.config as unknown as Record<string, unknown>
      delete cfg['accessToken']
      delete cfg['refreshToken']
      delete cfg['tokenExpiry']
      lib.config = cfg as typeof lib.config
    }

    const ok = await svc.updateLibrary(email, lib)
    if (!ok) return NextResponse.json({ error: 'Speichern fehlgeschlagen' }, { status: 500 })

    try {
      const factory = StorageFactory.getInstance()
      await factory.clearProvider(id)
    } catch {}

    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST - Temporäre Tokens abrufen und aus DB entfernen (bestehende Logik beibehalten)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const user = await currentUser()
    if (!user?.emailAddresses?.length) return NextResponse.json({ error: 'Keine E-Mail-Adresse gefunden' }, { status: 400 })
    const userEmail = user.emailAddresses[0].emailAddress

    const { id } = await params
    const libraryService = LibraryService.getInstance()
    const library = await libraryService.getLibrary(userEmail, id)
    if (!library) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    const config = library.config as Record<string, unknown>
    const tempAccessToken = config?.tempAccessToken as string
    const tempRefreshToken = config?.tempRefreshToken as string
    const tempTokenExpiry = config?.tempTokenExpiry as string
    const tempTokensAvailable = config?.tempTokensAvailable as boolean

    if (!tempTokensAvailable || !tempAccessToken || !tempRefreshToken) {
      return NextResponse.json({ error: 'Keine temporären Tokens verfügbar', hasTokens: false }, { status: 404 })
    }

    const updatedConfig = { ...config }
    delete updatedConfig.tempAccessToken
    delete updatedConfig.tempRefreshToken
    delete updatedConfig.tempTokenExpiry
    delete updatedConfig.tempTokensAvailable

    const updatedLibrary = { ...library, config: updatedConfig }
    await libraryService.updateLibrary(userEmail, updatedLibrary)

    return NextResponse.json({ success: true, tokens: { accessToken: tempAccessToken, refreshToken: tempRefreshToken, tokenExpiry: tempTokenExpiry } })
  } catch {
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 })
  }
}