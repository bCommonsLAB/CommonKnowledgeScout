/**
 * @fileoverview POST /api/chat/[libraryId]/docs/publish
 *
 * @description
 * Publish-/Unpublish-API fuer einzelne Dokumente (Doc-Translations Refactor).
 *
 * Verhalten:
 * - Setzt `docMetaJson.publication.{status,publishedAt,publishedBy}`.
 * - Wenn `status === 'published'` und die Library `config.translations`
 *   konfiguriert ist, wird pro `targetLocale` (ausser `sourceLocale`) ein
 *   External Job vom Typ `phase-translations` enqueued.
 * - `autoTranslateOnPublish: false` deaktiviert das Auto-Enqueueing
 *   (manueller Re-Translate-Button bleibt davon unberuehrt).
 *
 * Diese Route ersetzt KEINEN Re-Ingest. Die Uebersetzungs-Worker arbeiten
 * unabhaengig von der RAG-Pipeline und schreiben direkt in `docMetaJson`.
 *
 * @module api/chat/docs/publish
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import {
  getCollectionNameForLibrary,
  getMetaByFileId,
  setDocPublication,
} from '@/lib/repositories/vector-repo'
import { isModeratorOrOwner } from '@/lib/repositories/library-members-repo'
import { enqueueTranslationJobsForLocales } from '@/lib/external-jobs/enqueue-translations'
import type { Locale } from '@/lib/i18n'

/**
 * Request-Body:
 *  - `fileId` (string, required): Dokument-ID.
 *  - `status` ('published' | 'draft', required): Ziel-Status.
 *  - `force` (boolean, optional): Bei `published`, erzwinge Re-Translate
 *    aller Ziel-Locales (auch wenn translationStatus bereits 'done' ist).
 */
interface PublishRequestBody {
  fileId?: unknown
  status?: unknown
  force?: unknown
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> },
) {
  try {
    const { libraryId } = await params

    // 1) Authentifizierung
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress
    if (!userEmail) {
      return NextResponse.json({ error: 'Keine E-Mail-Adresse' }, { status: 401 })
    }

    // 2) Library-Kontext + Berechtigung
    const ctx = await loadLibraryChatContext(userEmail, libraryId)
    if (!ctx) {
      return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })
    }
    const hasPermission = await isModeratorOrOwner(libraryId, userEmail)
    if (!hasPermission) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    // 3) Body-Validierung
    const body = (await request.json().catch(() => ({}))) as PublishRequestBody
    const fileId = typeof body.fileId === 'string' && body.fileId.length > 0 ? body.fileId : null
    const status =
      body.status === 'published' || body.status === 'draft' ? body.status : null
    const force = typeof body.force === 'boolean' ? body.force : false

    if (!fileId || !status) {
      return NextResponse.json(
        { error: 'fileId und status (published|draft) sind erforderlich' },
        { status: 400 },
      )
    }

    // 4) Quellsprache aus Dokument lesen (bestimmt Default-Source-Locale).
    const libraryKey = getCollectionNameForLibrary(ctx.library)
    const meta = await getMetaByFileId(libraryKey, fileId)
    if (!meta) {
      return NextResponse.json({ error: 'Dokument nicht gefunden' }, { status: 404 })
    }
    const docMetaJson = (meta as { docMetaJson?: Record<string, unknown> }).docMetaJson
    const sourceLocale =
      (docMetaJson?.language as string | undefined) ||
      (docMetaJson?.sourceLanguage as string | undefined) ||
      'de'
    const detailViewType = docMetaJson?.detailViewType as string | undefined

    // Sprechender Anzeige-Name fuer das Job-Monitor-Panel.
    // Priorisiert top-level title > docMetaJson.title > fileName > undefined.
    // Wenn alles leer bleibt, faellt der Job zurueck auf den fileId-Hash.
    const metaTopLevel = meta as { title?: string; fileName?: string }
    const sourceName =
      (typeof metaTopLevel.title === 'string' && metaTopLevel.title.trim()) ||
      (typeof docMetaJson?.title === 'string' && (docMetaJson.title as string).trim()) ||
      (typeof metaTopLevel.fileName === 'string' && metaTopLevel.fileName.trim()) ||
      undefined

    // 5) Ziel-Locales aus Library-Config bestimmen (Doc-Translations).
    const transCfg = ctx.library.config?.translations
    const autoTranslate = transCfg?.autoTranslateOnPublish !== false
    const targetLocales = (transCfg?.targetLocales || []).filter(
      (l): l is Locale => typeof l === 'string' && l !== sourceLocale,
    )

    // 6) Patch in Mongo: publication.status + initiale translationStatus.<locale>.
    const initStatusLocales = status === 'published' && autoTranslate ? targetLocales : []
    const updated = await setDocPublication(libraryKey, fileId, {
      status,
      publishedBy: userEmail,
      targetLocales: initStatusLocales,
    })
    if (!updated) {
      return NextResponse.json({ error: 'Update fehlgeschlagen' }, { status: 500 })
    }

    // 7) Optional: External Jobs enqueuen.
    let enqueued: Record<string, string> = {}
    if (status === 'published' && autoTranslate && targetLocales.length > 0) {
      enqueued = await enqueueTranslationJobsForLocales(
        {
          libraryId,
          fileId,
          sourceLocale,
          detailViewType,
          userEmail,
          force,
          sourceName,
        },
        targetLocales,
      )
    }

    return NextResponse.json({
      success: true,
      fileId,
      status,
      sourceLocale,
      targetLocales,
      autoTranslate,
      enqueuedJobs: enqueued,
    })
  } catch (err) {
    console.error('[API] /docs/publish failed:', err)
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
