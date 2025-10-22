import type { RequestContext } from '@/types/external-jobs'
import { buildProvider } from '@/lib/external-jobs/provider'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { parseFacetDefs } from '@/lib/chat/dynamic-facets'
import { LibraryService } from '@/lib/services/library-service'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'

export interface PreprocessResult {
  hasMarkdown: boolean
  hasFrontmatter: boolean
  frontmatterValid: boolean
  expectedFileName: string
  existingFileId?: string
  body?: string
  meta?: Record<string, unknown>
  needExtract: boolean
  needTemplate: boolean
  needChapters: boolean
  needSave: boolean
  needImages: boolean
  needIngest: boolean
  reasons: string[]
}

function isPrimitiveOrStringArray(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return true
  if (Array.isArray(value)) return value.every(v => typeof v === 'string')
  return false
}

export async function preprocess(ctx: RequestContext): Promise<PreprocessResult> {
  const repo = new ExternalJobsRepository()
  const { jobId, job } = ctx
  const userEmail = job.userEmail
  const libraryId = job.libraryId
  const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de'
  const baseName = (job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '')
  const expectedFileName = `${baseName}.${lang}.md`

  const provider = await buildProvider({ userEmail, libraryId, jobId, repo })
  const parentId = job.correlation?.source?.parentId || 'root'

  let hasMarkdown = false
  let existingFileId: string | undefined
  let body: string | undefined
  let fm: Record<string, unknown> | undefined

  try {
    const siblings = await provider.listItemsById(parentId)
    const twin = siblings.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name === expectedFileName) as { id: string } | undefined
    if (twin) {
      hasMarkdown = true
      existingFileId = twin.id
      const bin = await provider.getBinary(twin.id)
      const text = await bin.blob.text()
      const parsed = parseFrontmatter(text)
      fm = (parsed?.meta && typeof parsed.meta === 'object') ? parsed.meta as Record<string, unknown> : {}
      body = parsed?.body || ''
      try { await repo.traceAddEvent(jobId, { spanId: 'preprocess', name: 'preprocess_found_markdown', attributes: { expectedFileName, existingFileId } }) } catch {}
    }
  } catch {}

  const reasons: string[] = []
  let frontmatterValid = false
  const hasFrontmatter = !!fm && Object.keys(fm).length > 0

  if (hasFrontmatter) {
    const pagesRaw = (fm as { pages?: unknown }).pages as unknown
    const pages = typeof pagesRaw === 'number' ? pagesRaw : (typeof pagesRaw === 'string' ? Number(pagesRaw) : undefined)
    const chapters = Array.isArray((fm as { chapters?: unknown }).chapters) ? (fm as { chapters: unknown[] }).chapters : []
    const hasCore = typeof pages === 'number' && Number.isFinite(pages) && pages > 0 && chapters.length > 0

    // Typprüfung der Facetten grob: nur erlaubte primitive oder string[]
    let typeErrors = 0
    try {
      // Library aus Service laden (job enthält nur libraryId)
      const lib = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
      if (!lib) throw new Error('Library not found')
      const defs = parseFacetDefs(lib)
      for (const d of defs) {
        const v = (fm as Record<string, unknown>)[d.metaKey]
        if (v === undefined || v === null) continue
        if (!isPrimitiveOrStringArray(v)) typeErrors++
      }
    } catch {}

    frontmatterValid = hasCore && typeErrors === 0
    if (!hasCore) reasons.push('frontmatter_core_incomplete')
    if (typeErrors > 0) reasons.push('frontmatter_type_errors')
  }

  // Flags (Phasen/Policies werden später zusätzlich berücksichtigt)
  const needExtract = !hasMarkdown
  const needTemplate = !hasFrontmatter || !frontmatterValid
  const needChapters = needTemplate // Kapitelanalyse nur wenn Template läuft
  const needSave = needTemplate || needExtract
  const needImages = false // per phases.images steuerbar
  const needIngest = hasMarkdown ? frontmatterValid : true

  try { await repo.traceAddEvent(jobId, { spanId: 'preprocess', name: 'preprocess_frontmatter_valid', attributes: { hasFrontmatter, valid: frontmatterValid } }) } catch {}
  try { await repo.traceAddEvent(jobId, { spanId: 'preprocess', name: 'preprocess_plan', attributes: { needExtract, needTemplate, needChapters, needSave, needImages, needIngest, reasons } }) } catch {}

  return {
    hasMarkdown,
    hasFrontmatter,
    frontmatterValid,
    expectedFileName,
    existingFileId,
    body,
    meta: fm,
    needExtract,
    needTemplate,
    needChapters,
    needSave,
    needImages,
    needIngest,
    reasons,
  }
}



