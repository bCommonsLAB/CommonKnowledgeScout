/**
 * @fileoverview Extraktion für Built-in Creation-Template file-transcript-de (Datei-Upload).
 * Diktat (audio-transcript-de) nutzt process-text / normale Wizard-Extraktion, keine Secretary-Datei-Pipeline hier.
 *
 * Wird im CreationWizard beim Verlassen von `collectSource` ausgeführt (Client-only: EventSource).
 * Kapselt Secretary-Jobs (PDF/Audio/Video) und synchrone Bild-OCR-Calls.
 */

import type { StorageProvider } from '@/lib/storage/types'

export interface BuiltinExtractProgress {
  progress?: number
  message?: string
}

interface JobUpdateWire {
  type: 'job_update'
  jobId: string
  status: string
  progress?: number
  message?: string
  result?: { savedItemId?: string }
}

/**
 * Wartet auf External-Job-Completion (SSE + Polling-Fallback wie im CreationWizard).
 */
export async function waitForSecretaryExternalJob(args: {
  jobId: string
  timeoutMs: number
  onProgress?: (evt: BuiltinExtractProgress) => void
}): Promise<JobUpdateWire> {
  const { jobId, timeoutMs, onProgress } = args
  return await new Promise<JobUpdateWire>((resolve, reject) => {
    let settled = false
    const es = new EventSource('/api/external/jobs/stream')
    let pollTimer: number | null = null
    const timeout = setTimeout(() => {
      if (settled) return
      settled = true
      try {
        es.close()
      } catch {
        /* ignore */
      }
      if (pollTimer !== null) {
        try {
          window.clearInterval(pollTimer)
        } catch {
          /* ignore */
        }
      }
      reject(new Error(`Timeout: Job ${jobId} wurde nicht rechtzeitig fertig.`))
    }, timeoutMs)

    function cleanup() {
      clearTimeout(timeout)
      try {
        es.close()
      } catch {
        /* ignore */
      }
      if (pollTimer !== null) {
        try {
          window.clearInterval(pollTimer)
        } catch {
          /* ignore */
        }
      }
    }

    pollTimer = window.setInterval(() => {
      if (settled) return
      void (async () => {
        try {
          const res = await fetch(`/api/external/jobs/${jobId}`, { method: 'GET' })
          const json = await res.json().catch(() => ({} as Record<string, unknown>))
          if (!res.ok) return
          const status = typeof json.status === 'string' ? json.status : ''
          if (status !== 'completed' && status !== 'failed') return

          const resultUnknown = json.result
          const result =
            resultUnknown && typeof resultUnknown === 'object' && !Array.isArray(resultUnknown)
              ? (resultUnknown as { savedItemId?: unknown })
              : undefined
          const savedItemId = typeof result?.savedItemId === 'string' ? result.savedItemId : undefined

          const synthetic: JobUpdateWire = {
            type: 'job_update',
            jobId,
            status,
            progress: status === 'completed' ? 100 : undefined,
            message: status === 'completed' ? 'completed (poll)' : 'failed (poll)',
            result: savedItemId ? { savedItemId } : undefined,
          }
          onProgress?.({ progress: synthetic.progress, message: synthetic.message })

          if (status === 'completed') {
            if (settled) return
            settled = true
            cleanup()
            resolve(synthetic)
          }
          if (status === 'failed') {
            if (settled) return
            settled = true
            cleanup()
            reject(new Error('Job fehlgeschlagen'))
          }
        } catch {
          // ignore polling errors
        }
      })()
    }, 1200)

    es.addEventListener('job_update', (e: MessageEvent) => {
      try {
        const evt = JSON.parse(e.data) as JobUpdateWire
        if (!evt || evt.type !== 'job_update' || evt.jobId !== jobId) return
        onProgress?.({ progress: evt.progress, message: evt.message })
        if (evt.status === 'completed') {
          if (settled) return
          settled = true
          cleanup()
          resolve(evt)
          return
        }
        if (evt.status === 'failed') {
          if (settled) return
          settled = true
          cleanup()
          reject(new Error(evt.message || 'Job fehlgeschlagen'))
        }
      } catch {
        // ignore parse errors
      }
    })
  })
}

function baseTitleFromFileName(name: string): string {
  const n = name.replace(/^\d+-/, '')
  return n.replace(/\.[^.]+$/, '').trim() || 'Dokument'
}

async function readTranscriptFromSavedItem(provider: StorageProvider, savedItemId: string): Promise<string> {
  const { blob } = await provider.getBinary(savedItemId)
  const text = await blob.text()
  const t = text.trim()
  if (!t) throw new Error('Extraktion lieferte leeren Text.')
  return t
}

async function runPdfExtractOnly(args: {
  provider: StorageProvider
  libraryId: string
  baseFileId: string
  onProgress?: (p: BuiltinExtractProgress) => void
}): Promise<string> {
  const { provider, libraryId, baseFileId, onProgress } = args
  const baseItem = await provider.getItemById(baseFileId)
  const wizardFolderId = baseItem.parentId || 'root'
  const fileName = baseItem.metadata?.name || 'document.pdf'
  const mimeType = baseItem.metadata?.mimeType || 'application/pdf'

  const form = new FormData()
  form.append('originalItemId', baseFileId)
  form.append('parentId', wizardFolderId)
  form.append('fileName', fileName)
  form.append('mimeType', mimeType)
  form.append('targetLanguage', 'de')
  form.append('extractionMethod', 'mistral_ocr')
  form.append('includeOcrImages', 'true')
  form.append('includePageImages', 'true')
  form.append('useCache', 'false')
  form.append('policies', JSON.stringify({ extract: 'do', metadata: 'ignore', ingest: 'ignore' }))

  const res = await fetch('/api/secretary/process-pdf', {
    method: 'POST',
    headers: { 'X-Library-Id': libraryId },
    body: form,
  })
  const json = await res.json().catch(() => ({} as Record<string, unknown>))
  if (!res.ok) {
    const msg = typeof json.error === 'string' ? json.error : `HTTP ${res.status}`
    throw new Error(msg)
  }
  const extractJobId =
    typeof (json as { job?: { id?: unknown } }).job?.id === 'string'
      ? (json as { job: { id: string } }).job.id
      : ''
  if (!extractJobId) throw new Error('Job-ID fehlt in Response (PDF).')

  const completion = await waitForSecretaryExternalJob({
    jobId: extractJobId,
    timeoutMs: 8 * 60_000,
    onProgress: (ev) => onProgress?.(ev),
  })
  const transcriptFileId = completion.result?.savedItemId
  if (!transcriptFileId) throw new Error('PDF-Extract abgeschlossen, aber kein Transcript (savedItemId fehlt).')
  return readTranscriptFromSavedItem(provider, transcriptFileId)
}

async function runAudioJob(args: {
  provider: StorageProvider
  libraryId: string
  baseFileId: string
  onProgress?: (p: BuiltinExtractProgress) => void
}): Promise<string> {
  const { provider, libraryId, baseFileId, onProgress } = args
  const item = await provider.getItemById(baseFileId)
  const parentId = item.parentId || 'root'
  const fileName = item.metadata?.name || 'audio'
  const mimeType = item.metadata?.mimeType || 'audio/*'

  const enqueueRes = await fetch('/api/secretary/process-audio/job', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Library-Id': libraryId,
    },
    body: JSON.stringify({
      originalItemId: baseFileId,
      parentId,
      fileName,
      mimeType,
      targetLanguage: 'de',
      useCache: true,
      policies: {
        extract: 'do',
        metadata: 'ignore',
        ingest: 'ignore',
      },
    }),
  })
  const enqueueJson = await enqueueRes.json().catch(() => ({} as Record<string, unknown>))
  if (!enqueueRes.ok) {
    const msg =
      typeof enqueueJson.error === 'string' ? enqueueJson.error : `HTTP ${enqueueRes.status}`
    throw new Error(msg)
  }
  const jobId =
    typeof (enqueueJson as { job?: { id?: unknown } }).job?.id === 'string'
      ? (enqueueJson as { job: { id: string } }).job.id
      : ''
  if (!jobId) throw new Error('Job-ID fehlt (Audio).')

  const completion = await waitForSecretaryExternalJob({
    jobId,
    timeoutMs: 15 * 60_000,
    onProgress,
  })
  const transcriptId = completion.result?.savedItemId
  if (!transcriptId) throw new Error('Audio-Job ohne Transcript-Datei (savedItemId).')
  return readTranscriptFromSavedItem(provider, transcriptId)
}

async function runVideoJob(args: {
  provider: StorageProvider
  libraryId: string
  baseFileId: string
  onProgress?: (p: BuiltinExtractProgress) => void
}): Promise<string> {
  const { provider, libraryId, baseFileId, onProgress } = args
  const item = await provider.getItemById(baseFileId)
  const parentId = item.parentId || 'root'
  const fileName = item.metadata?.name || 'video'
  const mimeType = item.metadata?.mimeType || 'video/*'

  const enqueueRes = await fetch('/api/secretary/process-video/job', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Library-Id': libraryId,
    },
    body: JSON.stringify({
      originalItemId: baseFileId,
      parentId,
      fileName,
      mimeType,
      targetLanguage: 'de',
      useCache: true,
      policies: {
        extract: 'do',
        metadata: 'ignore',
        ingest: 'ignore',
      },
    }),
  })
  const enqueueJson = await enqueueRes.json().catch(() => ({} as Record<string, unknown>))
  if (!enqueueRes.ok) {
    const msg =
      typeof enqueueJson.error === 'string' ? enqueueJson.error : `HTTP ${enqueueRes.status}`
    throw new Error(msg)
  }
  const jobId =
    typeof (enqueueJson as { job?: { id?: unknown } }).job?.id === 'string'
      ? (enqueueJson as { job: { id: string } }).job.id
      : ''
  if (!jobId) throw new Error('Job-ID fehlt (Video).')

  const completion = await waitForSecretaryExternalJob({
    jobId,
    timeoutMs: 30 * 60_000,
    onProgress,
  })
  const transcriptId = completion.result?.savedItemId
  if (!transcriptId) throw new Error('Video-Job ohne Transcript-Datei (savedItemId).')
  return readTranscriptFromSavedItem(provider, transcriptId)
}

async function runImageOcr(args: {
  provider: StorageProvider
  libraryId: string
  baseFileId: string
}): Promise<string> {
  const { provider, libraryId, baseFileId } = args
  const item = await provider.getItemById(baseFileId)
  const fileName = item.metadata?.name || 'image.png'
  const mimeType = item.metadata?.mimeType || 'image/png'
  const { blob } = await provider.getBinary(baseFileId)
  const file = new File([blob], fileName, { type: mimeType })

  const formData = new FormData()
  formData.append('file', file)
  formData.append('targetLanguage', 'de')
  formData.append('extraction_method', 'ocr')
  formData.append('useCache', 'true')

  const response = await fetch('/api/secretary/process-image', {
    method: 'POST',
    body: formData,
    headers: { 'X-Library-Id': libraryId },
  })
  const data = await response.json().catch(() => ({} as Record<string, unknown>))
  if (!response.ok) {
    const msg = typeof data.error === 'string' ? data.error : `HTTP ${response.status}`
    throw new Error(msg)
  }
  const extracted =
    data &&
    typeof data === 'object' &&
    'data' in data &&
    data.data &&
    typeof data.data === 'object' &&
    'extracted_text' in data.data
      ? String((data.data as { extracted_text?: unknown }).extracted_text ?? '')
      : ''
  if (!extracted.trim()) throw new Error('Bild-OCR lieferte keinen Text.')
  return extracted.trim()
}

function classifyFileTranscriptKind(mime: string, lowerName: string): 'pdf' | 'audio' | 'image' | 'video' | 'unknown' {
  if (mime === 'application/pdf' || lowerName.endsWith('.pdf')) return 'pdf'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('image/')) return 'image'
  return 'unknown'
}

/**
 * Führt die passende Secretary-Pipeline aus und liefert Markdown + initiale Metadaten für den Wizard.
 */
export async function runBuiltinTemplateExtract(options: {
  templateId: string
  provider: StorageProvider
  libraryId: string
  baseFileId: string
  onProgress?: (p: BuiltinExtractProgress) => void
}): Promise<{ markdown: string; metadata: Record<string, unknown> }> {
  const { templateId, provider, libraryId, baseFileId, onProgress } = options
  const item = await provider.getItemById(baseFileId)
  const fileName = item.metadata?.name || 'datei'
  const mime = item.metadata?.mimeType || 'application/octet-stream'
  const lowerName = fileName.toLowerCase()
  const titleBase = baseTitleFromFileName(fileName)

  if (templateId === 'file-transcript-de') {
    const kind = classifyFileTranscriptKind(mime, lowerName)
    if (kind === 'unknown') {
      throw new Error(
        'Dieser Dateityp wird noch nicht unterstützt. Bitte PDF, Audio, Bild oder Video verwenden.'
      )
    }
    let text = ''
    if (kind === 'pdf') {
      text = await runPdfExtractOnly({ provider, libraryId, baseFileId, onProgress })
    } else if (kind === 'audio') {
      text = await runAudioJob({ provider, libraryId, baseFileId, onProgress })
    } else if (kind === 'video') {
      text = await runVideoJob({ provider, libraryId, baseFileId, onProgress })
    } else {
      text = await runImageOcr({ provider, libraryId, baseFileId })
    }
    const markdown = `# ${titleBase}\n\n${text}`
    return {
      markdown,
      metadata: {
        title: titleBase,
        summary: '',
        filename: titleBase,
        sourceType: kind,
      },
    }
  }

  throw new Error(`Unbekanntes Built-in-Template: ${templateId}`)
}
