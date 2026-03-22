/**
 * @fileoverview Schließt Chunk-Upload ab und leitet an Secretary /video/process weiter
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
import * as fs from 'fs/promises'
import { getSecretaryConfig } from '@/lib/env'
import {
  getUploadSession,
  assertSessionUser,
  removeUploadSession,
} from '@/lib/stream-ingest/upload-session-store'

export async function POST(request: NextRequest) {
  const { userId } = getAuth(request)
  if (!userId) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  const uploadId = typeof b.uploadId === 'string' ? b.uploadId.trim() : ''
  if (!uploadId) {
    return NextResponse.json({ error: 'uploadId fehlt' }, { status: 400 })
  }

  const targetLanguage =
    typeof b.targetLanguage === 'string' && b.targetLanguage.trim()
      ? b.targetLanguage.trim()
      : 'de'
  const sourceLanguage =
    typeof b.sourceLanguage === 'string' && b.sourceLanguage.trim()
      ? b.sourceLanguage.trim()
      : 'auto'
  const template = typeof b.template === 'string' ? b.template : undefined
  const useCache =
    typeof b.useCache === 'string' ? b.useCache : 'true'
  const forceRefresh =
    typeof b.force_refresh === 'string' ? b.force_refresh : 'false'

  const session = getUploadSession(uploadId)
  if (!session) {
    return NextResponse.json({ error: 'Unbekannte oder abgelaufene uploadId' }, { status: 404 })
  }

  try {
    assertSessionUser(session, userId)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 403 })
  }

  if (session.bytesWritten !== session.contentLength) {
    return NextResponse.json(
      {
        error: `Unvollständiger Upload: ${session.bytesWritten} von ${session.contentLength} Bytes`,
      },
      { status: 400 }
    )
  }

  const { baseUrl: secretaryServiceUrl } = getSecretaryConfig()
  if (!secretaryServiceUrl) {
    return NextResponse.json(
      { error: 'SECRETARY_SERVICE_URL ist nicht konfiguriert' },
      { status: 500 }
    )
  }

  const normalizedUrl = `${secretaryServiceUrl}/video/process`

  let fileBuffer: Buffer
  try {
    fileBuffer = await fs.readFile(session.tempPath)
  } catch (err) {
    console.error('[stream-ingest/complete] readFile:', err)
    return NextResponse.json({ error: 'Temporäre Datei konnte nicht gelesen werden' }, { status: 500 })
  }

  if (fileBuffer.length !== session.contentLength) {
    removeUploadSession(uploadId)
    return NextResponse.json(
      { error: 'Integritätsfehler: Dateigröße auf Platte stimmt nicht' },
      { status: 500 }
    )
  }

  const serviceFormData = new FormData()
  serviceFormData.append(
    'file',
    new Blob([fileBuffer], { type: 'application/octet-stream' }),
    session.fileName
  )
  serviceFormData.append('target_language', targetLanguage)
  serviceFormData.append('source_language', sourceLanguage)
  serviceFormData.append('useCache', useCache)
  serviceFormData.append('force_refresh', forceRefresh)
  if (template) {
    serviceFormData.append('template', template)
  }

  const { apiKey } = getSecretaryConfig()
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
    headers['X-Secretary-Api-Key'] = apiKey
  }

  let response: Response
  try {
    response = await fetch(normalizedUrl, {
      method: 'POST',
      body: serviceFormData,
      headers,
    })
  } catch (err) {
    console.error('[stream-ingest/complete] fetch secretary:', err)
    removeUploadSession(uploadId)
    return NextResponse.json(
      { error: 'Fehler bei der Verbindung zum Secretary Service' },
      { status: 502 }
    )
  }

  const data = await response.json().catch(() => ({}))
  removeUploadSession(uploadId)

  if (!response.ok) {
    return NextResponse.json(
      {
        error:
          (data as { error?: string }).error ||
          'Fehler beim Transformieren der Video-Datei',
        details: data,
      },
      { status: response.status }
    )
  }

  return NextResponse.json(data)
}
