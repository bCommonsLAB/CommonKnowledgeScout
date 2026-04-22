/**
 * @fileoverview POST /api/chat/[libraryId]/docs/publish-bulk
 *
 * @description
 * Bulk-Publish-/Unpublish-API fuer mehrere Dokumente gleichzeitig.
 * Wird vom Galerie-Tabellen-Toolbar-Button „Alle publizieren“ genutzt, um
 * Bestandsdokumente (ohne `publication.status`) und Entwuerfe in einem Rutsch
 * freizugeben und – falls konfiguriert – Uebersetzungen zu enqueuen.
 *
 * Verhalten pro fileId (identisch zur Single-Doc-Route `/publish`):
 *  - Setzt `docMetaJson.publication.{status,publishedAt,publishedBy}`.
 *  - Bei `status === 'published'` + `autoTranslateOnPublish !== false` werden
 *    External Jobs vom Typ `phase-translations` pro Ziel-Locale enqueued.
 *  - `force` wird an die Translation-Worker weitergereicht (Re-Translate auch
 *    wenn `translationStatus` bereits 'done' ist).
 *
 * Response-Summary:
 *  - `affected`: Anzahl Dokumente, die tatsaechlich gepatcht wurden.
 *  - `skipped`: Anzahl Dokumente, die nicht gefunden wurden.
 *  - `translationJobsEnqueued`: Gesamtzahl der erzeugten Translation-Jobs.
 *  - `errors`: Liste von `{ fileId, error }` fuer partielle Fehlschlaege.
 *
 * Die Route iteriert sequentiell und bricht NICHT bei einzelnen Fehlern ab –
 * so werden Teilfolgen abgeschlossen und der Client sieht im Toast, welche
 * Docs betroffen waren. Grenze: 500 Dokumente pro Request, damit die Laufzeit
 * beherrschbar bleibt.
 *
 * @module api/chat/docs/publish-bulk
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

interface BulkPublishRequestBody {
  fileIds?: unknown
  status?: unknown
  force?: unknown
}

// Hartes Limit: Schuetzt vor versehentlich gigantischen Requests und erzwingt
// dass sehr grosse Libraries mehrere Batches brauchen.
const MAX_BULK_SIZE = 500

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

    // 2) Library + Owner/Moderator-Check
    const ctx = await loadLibraryChatContext(userEmail, libraryId)
    if (!ctx) {
      return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })
    }
    const hasPermission = await isModeratorOrOwner(libraryId, userEmail)
    if (!hasPermission) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    // 3) Body-Validierung
    const body = (await request.json().catch(() => ({}))) as BulkPublishRequestBody
    const status =
      body.status === 'published' || body.status === 'draft' ? body.status : null
    const force = typeof body.force === 'boolean' ? body.force : false
    const fileIdsRaw = Array.isArray(body.fileIds) ? body.fileIds : []
    const fileIds = fileIdsRaw.filter(
      (v): v is string => typeof v === 'string' && v.length > 0,
    )

    if (!status) {
      return NextResponse.json(
        { error: 'status (published|draft) ist erforderlich' },
        { status: 400 },
      )
    }
    if (fileIds.length === 0) {
      return NextResponse.json(
        { error: 'fileIds (nicht-leeres Array) ist erforderlich' },
        { status: 400 },
      )
    }
    if (fileIds.length > MAX_BULK_SIZE) {
      return NextResponse.json(
        { error: `Zu viele Dokumente (max. ${MAX_BULK_SIZE} pro Request)` },
        { status: 400 },
      )
    }

    // 4) Library-Config fuer Translations einmal vorab laden (gilt fuer alle Docs).
    const libraryKey = getCollectionNameForLibrary(ctx.library)
    const transCfg = ctx.library.config?.translations
    const autoTranslate = transCfg?.autoTranslateOnPublish !== false
    const configuredTargets = (transCfg?.targetLocales || []).filter(
      (l): l is Locale => typeof l === 'string',
    )

    // 5) Pro fileId: Publication patchen und optional Jobs enqueuen.
    // Sequentiell, um die Mongo-Last / Job-Queue nicht zu ueberrollen und
    // konsistente Reihenfolge in den Logs zu haben.
    let affected = 0
    let skipped = 0
    let translationJobsEnqueued = 0
    const errors: Array<{ fileId: string; error: string }> = []

    for (const fileId of fileIds) {
      try {
        const meta = await getMetaByFileId(libraryKey, fileId)
        if (!meta) {
          skipped++
          continue
        }
        const docMetaJson = (meta as { docMetaJson?: Record<string, unknown> }).docMetaJson
        const sourceLocale =
          (docMetaJson?.language as string | undefined) ||
          (docMetaJson?.sourceLanguage as string | undefined) ||
          'de'
        const detailViewType = docMetaJson?.detailViewType as string | undefined

        // Sprechender Anzeige-Name fuer das Job-Monitor-Panel:
        // top-level title > docMetaJson.title > fileName.
        // Faellt alles weg, fallback auf den kryptischen fileId-Hash.
        const metaTopLevel = meta as { title?: string; fileName?: string }
        const sourceName =
          (typeof metaTopLevel.title === 'string' && metaTopLevel.title.trim()) ||
          (typeof docMetaJson?.title === 'string' && (docMetaJson.title as string).trim()) ||
          (typeof metaTopLevel.fileName === 'string' && metaTopLevel.fileName.trim()) ||
          undefined

        // Ziel-Locales pro Doc: Source-Locale rausfiltern (kein Sinn, Doc in seine
        // eigene Sprache zu uebersetzen).
        const targetLocales = configuredTargets.filter((l) => l !== sourceLocale)
        const initStatusLocales = status === 'published' && autoTranslate ? targetLocales : []

        const updated = await setDocPublication(libraryKey, fileId, {
          status,
          publishedBy: userEmail,
          targetLocales: initStatusLocales,
        })
        if (!updated) {
          errors.push({ fileId, error: 'Update fehlgeschlagen' })
          continue
        }
        affected++

        if (status === 'published' && autoTranslate && targetLocales.length > 0) {
          const enq = await enqueueTranslationJobsForLocales(
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
          translationJobsEnqueued += Object.keys(enq).length
        }
      } catch (perDocErr) {
        const msg = perDocErr instanceof Error ? perDocErr.message : 'Unbekannter Fehler'
        errors.push({ fileId, error: msg })
      }
    }

    return NextResponse.json({
      success: true,
      status,
      requested: fileIds.length,
      affected,
      skipped,
      translationJobsEnqueued,
      errors,
    })
  } catch (err) {
    console.error('[API] /docs/publish-bulk failed:', err)
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
