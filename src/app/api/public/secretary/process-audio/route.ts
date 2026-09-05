/**
 * @fileoverview Public Secretary Audio Processing API Route - writeKey-geschützter Proxy
 *
 * @description
 * Public-Endpoint für Audio-Transkription via Secretary Service. Geschützt durch writeKey-Validierung.
 * Ermöglicht Diktieren auf öffentlichen Seiten (z.B. QR-Link für Testimonials) ohne Login.
 *
 * Security:
 * - Keine Clerk-Auth erforderlich (public).
 * - Stattdessen: libraryId + eventFileId + writeKey aus FormData.
 * - Owner wird via resolveOwnerForTestimonials aufgelöst.
 * - Event-Markdown wird geladen und testimonialWriteKey validiert.
 * - Dateigröße/Typ konservativ limitiert (wie in /api/public/testimonials).
 *
 * @module public
 *
 * @exports
 * - POST: Processes audio file via Secretary Service (writeKey-geschützt)
 *
 * @usedIn
 * - src/components/shared/dictation-textarea.tsx: Public-Flow nutzt diesen Endpoint
 *
 * @dependencies
 * - @/lib/public/public-library-owner: Owner-Auflösung für Public/Private Libraries
 * - @/lib/storage/server-provider: Storage Provider für Event-Zugriff
 * - @/lib/markdown/frontmatter: Frontmatter-Parsing für writeKey-Validierung
 * - @/lib/env: Secretary Service Config
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  TestimonialAccessError,
  assertTestimonialWriteAccess,
} from '@/lib/public/testimonial-write-access'
import { getSecretaryConfig } from '@/lib/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function nonEmptyString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * POST /api/public/secretary/process-audio
 *
 * FormData:
 * - libraryId: string (erforderlich)
 * - eventFileId: string (erforderlich)
 * - writeKey: string (erforderlich für private Libraries)
 * - file: File (audio/*, erforderlich)
 * - source_language?: string (optional, default: 'de')
 * - target_language?: string (optional, default: 'de')
 * - template?: string (optional, für Template-Transformation)
 *
 * Security:
 * - Owner wird via resolveOwnerForTestimonials aufgelöst (public library ODER private mit writeKey).
 * - Event-Markdown wird geladen und testimonialWriteKey validiert.
 * - Dateigröße limitiert (max 25MB, konservativ).
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()

    const libraryId = nonEmptyString(formData.get('libraryId'))
    const eventFileId = nonEmptyString(formData.get('eventFileId'))
    const writeKey = nonEmptyString(formData.get('writeKey'))
    const file = formData.get('file')

    if (!libraryId || !eventFileId) {
      return NextResponse.json({ error: 'libraryId und eventFileId sind erforderlich' }, { status: 400 })
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Audio-Datei fehlt (Feld "file")' }, { status: 400 })
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: 'Leere Datei' }, { status: 400 })
    }

    // Konservatives Limit (wie in /api/public/testimonials)
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: 'Audio-Datei zu groß (max 25MB)' }, { status: 413 })
    }

    // Zugriffspruefung (public library ODER private mit writeKey) — dieselbe Kette wie
    // beim Live-Ticket, siehe lib/public/testimonial-write-access.
    try {
      await assertTestimonialWriteAccess({ libraryId, eventFileId, writeKey })
    } catch (error) {
      if (error instanceof TestimonialAccessError) {
        return NextResponse.json({ error: error.message }, { status: error.status })
      }
      throw error
    }

    // Secretary Service Config
    const { baseUrl: secretaryServiceUrl, apiKey } = getSecretaryConfig()
    if (!secretaryServiceUrl) {
      return NextResponse.json(
        { error: 'SECRETARY_SERVICE_URL ist nicht konfiguriert' },
        { status: 500 }
      )
    }

    // FormData für Secretary Service vorbereiten
    const serviceFormData = new FormData()
    serviceFormData.append('file', file)

    // Sprachen (unterstütze sowohl camelCase als auch snake_case)
    const sourceLanguage =
      nonEmptyString(formData.get('source_language')) || nonEmptyString(formData.get('sourceLanguage')) || 'de'
    const targetLanguage =
      nonEmptyString(formData.get('target_language')) || nonEmptyString(formData.get('targetLanguage')) || 'de'

    serviceFormData.append('source_language', sourceLanguage)
    serviceFormData.append('target_language', targetLanguage)

    // Optional: Template (Secretary kann Audio→Text danach noch template-basiert transformieren)
    const template = nonEmptyString(formData.get('template'))
    if (template) {
      serviceFormData.append('template', template)
    }

    // Cache ausschalten (Public-Flow soll frische Ergebnisse liefern)
    serviceFormData.append('useCache', 'false')

    // Anfrage an den Secretary Service senden
    const response = await fetch(`${secretaryServiceUrl}/audio/process`, {
      method: 'POST',
      body: serviceFormData,
      headers: (() => {
        const h: Record<string, string> = { Accept: 'application/json' }
        if (apiKey) {
          h['Authorization'] = `Bearer ${apiKey}`
          h['X-Secretary-Api-Key'] = apiKey
        }
        return h
      })(),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Fehler beim Transformieren der Audio-Datei' },
        { status: response.status }
      )
    }

    // Gebe die vollständige Response zurück, nicht nur data.data
    return NextResponse.json(data)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
