/**
 * @fileoverview Account-API: fertige Desktop-Erweiterung (.mcpb) herunterladen.
 *
 * @description
 * POST rotiert den MCP-Account-Key des eingeloggten Users und antwortet mit
 * dem fertigen Erweiterungs-Bundle (ZIP: manifest.json + server/proxy.js aus
 * `extensions/knowledgescout/`), in dem Server-URL und Key BEREITS eingesetzt
 * sind — installierbar ueber Claude-Einstellungen → Erweiterungen, ohne
 * Konfigurieren-Dialog. Rotation + Download sind EIN Schritt, weil der
 * Klartext-Key nur in diesem Moment existiert (Speicher: nur der Hash).
 * Ein frueher heruntergeladenes Bundle wird dadurch ungueltig.
 *
 * @module api/account
 */

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import JSZip from 'jszip'
import { FileLogger } from '@/lib/debug/logger'
import { rotateMcpAccountKey } from '@/lib/mcp/account-key-service'

const EXTENSION_DIR = path.join(process.cwd(), 'extensions', 'knowledgescout')

/** Basis-URL des Servers — Pflicht, damit das Bundle auf den richtigen Port zeigt. */
function requireServerUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? ''
  if (base === '') throw new Error('NEXT_PUBLIC_APP_URL nicht konfiguriert — Erweiterungs-URL unbekannt')
  return `${base.replace(/\/+$/, '')}/api/mcp/mcp`
}

/** Repo-Manifest mit eingesetzten Werten: mcp_config fest, user_config entfaellt. */
function bakeManifest(rawManifest: string, serverUrl: string, apiKey: string): string {
  const manifest = JSON.parse(rawManifest) as Record<string, unknown> & {
    server?: { mcp_config?: { args?: string[] } }
  }
  if (!manifest.server?.mcp_config?.args) {
    throw new Error('Erweiterungs-Manifest unerwartet — server.mcp_config.args fehlt')
  }
  manifest.server.mcp_config.args = ['${__dirname}/server/proxy.js', serverUrl, apiKey]
  delete manifest.user_config
  return JSON.stringify(manifest, null, 2)
}

export async function POST(): Promise<NextResponse> {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userEmail) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 })

    const serverUrl = requireServerUrl()
    const [rawManifest, proxySource] = await Promise.all([
      readFile(path.join(EXTENSION_DIR, 'manifest.json'), 'utf-8'),
      readFile(path.join(EXTENSION_DIR, 'server', 'proxy.js'), 'utf-8'),
    ])

    // Rotation erst NACH dem Einsammeln der Bundle-Teile — scheitert das
    // Lesen, bleibt der bestehende Key unangetastet.
    const apiKey = await rotateMcpAccountKey(userEmail)

    const zip = new JSZip()
    zip.file('manifest.json', bakeManifest(rawManifest, serverUrl, apiKey))
    zip.file('server/proxy.js', proxySource)
    const bundle = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })

    FileLogger.info('account-mcp-extension', 'Erweiterung erzeugt (Key rotiert)', { userEmail })
    return new NextResponse(new Uint8Array(bundle), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="knowledgescout.mcpb"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    FileLogger.error('account-mcp-extension', 'Download fehlgeschlagen', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Interner Fehler' },
      { status: 500 },
    )
  }
}
