import { NextRequest, NextResponse } from 'next/server'
import { getAuth, currentUser } from '@clerk/nextjs/server'
import crypto from 'crypto'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { legacyToPolicies, type PhasePolicies } from '@/lib/processing/phase-policy'

interface BatchItemInput {
  fileId: string
  parentId: string
  name?: string
  mimeType?: string
}

interface BatchRequestBody {
  libraryId: string
  batchName?: string
  options?: {
    targetLanguage?: string
    sourceLanguage?: string
    useCache?: boolean
    template?: string
    policies?: PhasePolicies
  }
  items: BatchItemInput[]
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request)
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 })

    const body = (await request.json().catch(() => ({}))) as Partial<BatchRequestBody>
    const libraryId = typeof body.libraryId === 'string' ? body.libraryId : ''
    const items = Array.isArray(body.items) ? body.items : []
    if (!libraryId || items.length === 0) return NextResponse.json({ error: 'libraryId und items erforderlich' }, { status: 400 })

    const options = body.options || {}
    const batchId = crypto.randomUUID()
    const batchName = typeof body.batchName === 'string' ? body.batchName : undefined

    const repo = new ExternalJobsRepository()
    let okCount = 0
    let failCount = 0

    for (const it of items) {
      try {
        const jobId = crypto.randomUUID()
        const jobSecret = crypto.randomBytes(24).toString('base64url')
        const jobSecretHash = repo.hashSecret(jobSecret)
        const policiesEffective = options.policies || legacyToPolicies({ doExtractPDF: true })
        const template = typeof options.template === 'string' && options.template.trim() ? options.template.trim() : 'Besprechung'

        await repo.create({
          jobId,
          jobSecretHash,
          job_type: 'audio',
          operation: 'transcribe',
          worker: 'secretary',
          status: 'queued',
          libraryId,
          userEmail,
          correlation: {
            jobId,
            libraryId,
            source: { mediaType: 'audio', mimeType: it.mimeType || 'audio/*', name: it.name || 'audio', itemId: it.fileId, parentId: it.parentId },
            options: {
              targetLanguage: options.targetLanguage || 'de',
              sourceLanguage: options.sourceLanguage || 'auto',
              useCache: options.useCache ?? true,
            },
            batchId,
            batchName,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          parameters: {
            template,
            policies: policiesEffective,
            phases: {
              extract: policiesEffective.extract !== 'ignore',
              template: policiesEffective.metadata !== 'ignore',
              ingest: policiesEffective.ingest !== 'ignore',
              images: false,
            },
            batchId,
            batchName,
          },
        } as unknown as Parameters<ExternalJobsRepository['create']>[0])
        okCount++
      } catch {
        failCount++
      }
    }

    return NextResponse.json({ ok: true, batchId, batchName, okCount, failCount })
  } catch {
    return NextResponse.json({ error: 'Unerwarteter Fehler' }, { status: 500 })
  }
}


