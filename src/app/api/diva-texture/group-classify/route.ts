/**
 * @fileoverview API-Route: Stoffgruppen-Klassifikation (Stufe 4).
 *
 * @description
 * POST /api/diva-texture/group-classify
 * Body: { libraryId, groupName, templateName?, targetLanguage?, dryRun? }
 *
 * Fuehrt eine Stoffgruppen-Klassifikation durch:
 *   - Sucht alle Mitglieder mit `docMetaJson.group_name === groupName`.
 *   - Waehlt ein Repraesentativ (Praeferenz: Mitglieder mit
 *     `analysisSourceImage='supplier-preview'`, dann erstes nicht gelocktes/
 *     nicht verworfenes Mitglied).
 *   - Fuehrt EINEN LLM-Call via `runDivaTextureFirstPass` aus.
 *   - Schreibt `material_class/material_type/confidence_class/confidence_type/
 *     needs_human_review` plus Pipeline-Status auf alle nicht gelockten/
 *     nicht verworfenen Mitglieder (Override-Schutz: Edge-Case #6 + #17).
 *
 * Vereinfachung gegenueber dem Plan (User-Entscheid): KEINE eigene
 * Gruppen-Klassifikations-Persistenz, KEINE `groupClassificationId`.
 *
 * Clerk-Auth + Library-Access-Check (LibraryService).
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import { getServerProvider } from '@/lib/storage/server-provider'
import { getVectorCollectionName } from '@/lib/repositories/vector-repo'
import {
  listTemplatesFromMongoDB,
  loadTemplateFromMongoDB,
  serializeTemplateToMarkdown,
} from '@/lib/templates/template-service-mongodb'
import { getSecretaryConfig } from '@/lib/env'
import { resolveLibrarySecretaryConfig } from '@/lib/external-jobs/secretary-url'
import { callImageAnalyzerTemplate } from '@/lib/secretary/image-analyzer'
import { runGroupClassification } from '@/lib/diva-texture/group-classify-runner'
import { isDivaTextureTemplate, type FirstPassImage } from '@/lib/diva-texture/first-pass-runner'
import { FileLogger } from '@/lib/debug/logger'

interface GroupClassifyBody {
  libraryId?: string
  groupName?: string
  /** Template-Name (z.B. "Diva-Texture-Analysis"). Wenn leer, wird automatisch gesucht. */
  templateName?: string
  /** Zielsprache der Artefakte (Default "de"). */
  targetLanguage?: string
  /** Dry-Run liefert die Klassifikation ohne sie auf die Mitglieder anzuwenden. */
  dryRun?: boolean
}

async function loadDivaTextureTemplate(
  libraryId: string,
  userEmail: string,
  preferred?: string,
): Promise<{ name: string; content: string } | null> {
  // 1. Wenn der Aufrufer den Namen kennt: direkt laden.
  if (preferred && preferred.trim().length > 0) {
    const tpl = await loadTemplateFromMongoDB(preferred, libraryId, userEmail, false)
    if (tpl) {
      const content = serializeTemplateToMarkdown(tpl, false)
      if (isDivaTextureTemplate(content)) return { name: tpl.name, content }
    }
  }
  // 2. Sonst: alle Templates der Library durchsuchen und das erste
  //    DIVA-Texture-Template (detailViewType: divaTexture) nehmen.
  const all = await listTemplatesFromMongoDB(libraryId, userEmail, false)
  for (const tpl of all) {
    const content = serializeTemplateToMarkdown(tpl, false)
    if (isDivaTextureTemplate(content)) return { name: tpl.name, content }
  }
  return null
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userEmail) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 })

    const body = (await request.json()) as GroupClassifyBody
    const libraryId = typeof body.libraryId === 'string' ? body.libraryId.trim() : ''
    const groupName = typeof body.groupName === 'string' ? body.groupName.trim() : ''
    if (!libraryId) return NextResponse.json({ error: 'libraryId ist erforderlich' }, { status: 400 })
    if (!groupName) return NextResponse.json({ error: 'groupName ist erforderlich' }, { status: 400 })

    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) {
      return NextResponse.json({ error: 'Library nicht gefunden oder kein Zugriff' }, { status: 404 })
    }
    const libraryKey = getVectorCollectionName(library)

    const template = await loadDivaTextureTemplate(libraryId, userEmail, body.templateName)
    if (!template) {
      return NextResponse.json(
        { error: 'Kein DIVA-Texture-Template in dieser Library gefunden' },
        { status: 404 },
      )
    }

    // Secretary-Config (Library-Override oder ENV).
    const resolved = resolveLibrarySecretaryConfig(library)
    const secretaryEnv = getSecretaryConfig()
    const baseUrl = resolved.effective?.apiUrl || secretaryEnv.baseUrl
    const apiKey = resolved.effective?.apiKey || secretaryEnv.apiKey || ''

    const provider = await getServerProvider(userEmail, libraryId)

    // analyzeImage-Adapter: callImageAnalyzerTemplate mit unserem Template
    // — analog zur Standard-Pipeline (start/route.ts), aber on-demand.
    const analyzeImage = async (args: {
      image: FirstPassImage
      context: Record<string, unknown>
    }): Promise<string> => {
      const res = await callImageAnalyzerTemplate({
        baseUrl,
        apiKey,
        file: args.image.buffer,
        fileName: args.image.fileName,
        mimeType: args.image.mimeType,
        templateContent: template.content,
        targetLanguage: typeof body.targetLanguage === 'string' && body.targetLanguage.trim().length > 0
          ? body.targetLanguage.trim()
          : 'de',
        context: args.context,
        useCache: false,
        timeoutMs: 120_000,
      })
      const json = (await res.json()) as {
        status: string
        data?: { text: string }
        error?: unknown
      }
      if (json.status !== 'success' || !json.data?.text) {
        throw new Error(
          json.error ? JSON.stringify(json.error) : 'Image-Analyzer lieferte kein Ergebnis',
        )
      }
      return json.data.text
    }

    // Preview-Bild serverseitig laden — analog start/route.ts.
    const fetchPreviewImage = async (url: string): Promise<FirstPassImage> => {
      const resp = await fetch(url)
      if (!resp.ok) {
        throw new Error(`Liefersystem-Preview nicht erreichbar: HTTP ${resp.status}`)
      }
      const buf = Buffer.from(await resp.arrayBuffer())
      const mime = resp.headers.get('content-type') || 'image/jpeg'
      return { buffer: buf, fileName: 'supplier-preview.jpg', mimeType: mime }
    }

    const targetLanguage =
      typeof body.targetLanguage === 'string' && body.targetLanguage.trim().length > 0
        ? body.targetLanguage.trim()
        : 'de'

    const result = await runGroupClassification({
      library,
      libraryKey,
      libraryId,
      provider,
      userEmail,
      groupName,
      targetLanguage,
      templateName: template.name,
      analyzeImage,
      fetchPreviewImage,
      dryRun: body.dryRun === true,
    })

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Interner Fehler'
    FileLogger.error('diva-texture/group-classify', 'POST fehlgeschlagen', { error: message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
