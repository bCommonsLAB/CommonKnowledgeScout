/**
 * @fileoverview API-Route: Per-Material-Klassifikations-Korrektur (Stufe 4).
 *
 * @description
 * PATCH /api/diva-texture/material-classification
 * Body: { libraryId, fileId, patch }
 *
 * Schreibt eine vom Klassifizierer in der Galerie vorgenommene Korrektur
 * (`material_class`, `material_type`, Konfidenzen, `classification_locked`,
 * `classification_rejected`, `needs_human_review`) direkt in das
 * Shadow-Twin-Artefakt + das `docMetaJson` im vector-repo zurueck — KEIN
 * LLM-Call.
 *
 * Architekturregel (Lea-Regel #10): die Galerie ist eine reine
 * Verifikations-/Korrektur-UI; jeder LLM-Aufruf laeuft ausschliesslich
 * ueber `/api/external/jobs/*`. Diese Route patcht nur Frontmatter-Werte.
 *
 * Verhalten:
 *  - Bei Aenderung von `material_class` ODER `material_type` setzt der
 *    Server automatisch `needs_visual_refresh=true` als Marker fuer den
 *    Korrektur-Lauf in Stufe 5 (siehe `applyMaterialPatch`).
 *  - Aenderungen, die identisch zum bisherigen Wert sind, sind idempotent
 *    und triggern KEINEN Refresh.
 *  - `classification_locked` / `classification_rejected` sind reine
 *    UI-Flags und beeinflussen `needs_visual_refresh` nicht.
 *
 * Clerk-Auth + Library-Access-Check (LibraryService).
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import {
  getMetaByFileId,
  getVectorCollectionName,
  setDocPass1Classification,
} from '@/lib/repositories/vector-repo'
import {
  getShadowTwinsBySourceIds,
  updateShadowTwinArtifactMarkdown,
} from '@/lib/repositories/shadow-twin-repo'
import { patchFrontmatter } from '@/lib/markdown/frontmatter-patch'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { applyMaterialPatch, type MaterialPatch } from '@/lib/diva-texture/group-classify'
import { FileLogger } from '@/lib/debug/logger'

interface MaterialClassificationBody {
  libraryId?: string
  fileId?: string
  templateName?: string
  targetLanguage?: string
  patch?: MaterialPatch
}

/** Liest `material_class`/`material_type` aus dem aktuellen Meta-Doc. */
function readCurrentState(meta: Record<string, unknown> | undefined): {
  material_class: string
  material_type: string
} {
  const m = (meta?.docMetaJson as Record<string, unknown>) ?? {}
  return {
    material_class: typeof m.material_class === 'string' ? m.material_class : '',
    material_type: typeof m.material_type === 'string' ? m.material_type : '',
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userEmail) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 })

    const body = (await request.json()) as MaterialClassificationBody
    const libraryId = typeof body.libraryId === 'string' ? body.libraryId.trim() : ''
    const fileId = typeof body.fileId === 'string' ? body.fileId.trim() : ''
    if (!libraryId) return NextResponse.json({ error: 'libraryId ist erforderlich' }, { status: 400 })
    if (!fileId) return NextResponse.json({ error: 'fileId ist erforderlich' }, { status: 400 })
    if (!body.patch || typeof body.patch !== 'object' || Array.isArray(body.patch)) {
      return NextResponse.json({ error: 'patch (Objekt) ist erforderlich' }, { status: 400 })
    }

    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) {
      return NextResponse.json({ error: 'Library nicht gefunden oder kein Zugriff' }, { status: 404 })
    }
    const libraryKey = getVectorCollectionName(library)
    const targetLanguage =
      typeof body.targetLanguage === 'string' && body.targetLanguage.trim().length > 0
        ? body.targetLanguage.trim()
        : 'de'
    const templateName =
      typeof body.templateName === 'string' && body.templateName.trim().length > 0
        ? body.templateName.trim()
        : 'Diva-Texture-Analysis'

    // Aktuellen Stand laden (fuer Vergleich material_class/_type)
    const metaDoc = await getMetaByFileId(libraryKey, fileId)
    const current = readCurrentState(metaDoc ?? undefined)

    const { updates, triggersVisualRefresh } = applyMaterialPatch(current, body.patch)
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ fileId, applied: false, triggersVisualRefresh: false })
    }

    // Shadow-Twin-Artefakt finden + Markdown patchen
    const shadowTwinMap = await getShadowTwinsBySourceIds({ libraryId, sourceIds: [fileId] })
    const twin = shadowTwinMap.get(fileId)
    if (!twin) {
      return NextResponse.json(
        { error: 'Shadow-Twin fuer dieses Material nicht gefunden' },
        { status: 404 },
      )
    }
    const artifact = twin.artifacts?.transformation?.[templateName]?.[targetLanguage] ?? null
    if (!artifact || typeof artifact.markdown !== 'string' || artifact.markdown.trim() === '') {
      return NextResponse.json(
        {
          error:
            `Material hat noch kein Pass-1-Artefakt fuer Template "${templateName}" — ` +
            `bitte zuerst Pass 1 im Archiv ausfuehren.`,
        },
        { status: 409 },
      )
    }
    const patchedMarkdown = patchFrontmatter(artifact.markdown, updates)
    await updateShadowTwinArtifactMarkdown({
      libraryId,
      sourceId: twin.sourceId,
      artifactKey: {
        sourceId: twin.sourceId,
        kind: 'transformation',
        targetLanguage,
        templateName,
      },
      markdown: patchedMarkdown,
    })

    // docMetaJson im vector-repo entsprechend updaten (Snapshot fuer Galerie)
    const { meta: patchedMeta } = parseFrontmatter(patchedMarkdown)
    await setDocPass1Classification(libraryKey, fileId, {
      material_class: typeof patchedMeta.material_class === 'string' ? patchedMeta.material_class : '',
      material_type: typeof patchedMeta.material_type === 'string' ? patchedMeta.material_type : '',
      confidence_class:
        typeof patchedMeta.confidence_class === 'number' ? patchedMeta.confidence_class : 0,
      confidence_type:
        typeof patchedMeta.confidence_type === 'number' ? patchedMeta.confidence_type : '',
      needs_human_review: patchedMeta.needs_human_review === true,
      last_pass: 1,
      pass1_status: patchedMeta.pass1_status === 'needs_review' ? 'needs_review' : 'done',
      needs_visual_refresh: triggersVisualRefresh ? true : undefined,
    })
    // classification_locked/_rejected werden im docMetaJson per Re-Ingest
    // konsistent gehalten. Hier patchen wir sie zusaetzlich direkt, damit die
    // Galerie sie sofort sieht (ohne Ingest-Round-Trip).
    if (typeof body.patch.classification_locked === 'boolean' ||
        typeof body.patch.classification_rejected === 'boolean') {
      await setDocFlags(libraryKey, fileId, {
        classification_locked: body.patch.classification_locked,
        classification_rejected: body.patch.classification_rejected,
      })
    }

    FileLogger.info('diva-texture/material-classification', 'Material-Korrektur uebernommen', {
      fileId,
      libraryLabel: library.label,
      triggersVisualRefresh,
      updatedKeys: Object.keys(updates),
    })

    return NextResponse.json({
      fileId,
      applied: true,
      triggersVisualRefresh,
      updates,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Interner Fehler'
    FileLogger.error('diva-texture/material-classification', 'PATCH fehlgeschlagen', {
      error: message,
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * Setzt die reinen Flag-Felder (`classification_locked`,
 * `classification_rejected`) im vector-repo. Bewusst kein eigener Repo-Helper,
 * weil die Aenderungen klein sind und nur die Galerie-Snapshot-Konsistenz
 * sichern (das Artefakt-Markdown ist bereits gepatcht).
 */
async function setDocFlags(
  libraryKey: string,
  fileId: string,
  flags: { classification_locked?: boolean; classification_rejected?: boolean },
): Promise<void> {
  const { getCollectionOnly } = await import('@/lib/repositories/vector-repo')
  const col = await getCollectionOnly(libraryKey)
  const set: Record<string, unknown> = {}
  if (typeof flags.classification_locked === 'boolean') {
    set['docMetaJson.classification_locked'] = flags.classification_locked
  }
  if (typeof flags.classification_rejected === 'boolean') {
    set['docMetaJson.classification_rejected'] = flags.classification_rejected
  }
  if (Object.keys(set).length === 0) return
  // _id ist im library-collection-Schema ein String (`<fileId>-meta`).
  // Der MongoDB-Default-Typ ist ObjectId — `unknown`-Cast ist hier bewusst,
  // analog zu setDocPass1Classification/setDocPublication in vector-repo.ts.
  await col.updateOne(
    { _id: `${fileId}-meta`, kind: 'meta' } as unknown as Parameters<typeof col.updateOne>[0],
    { $set: set },
  )
}
