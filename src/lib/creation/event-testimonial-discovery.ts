import type { StorageProvider } from '@/lib/storage/types'
import type { WizardSource } from '@/lib/creation/corpus'
import { discoverTestimonials } from '@/lib/testimonials/testimonial-discovery'

/**
 * Find related testimonial sources for an event, based on filesystem layout:
 * <eventFolder>/testimonials/<testimonialId>/(transcript*.md OR testimonial*.md OR meta.json)
 *
 * Verwendet die gemeinsame discoverTestimonials-Funktion und konvertiert zu WizardSource[].
 */
export async function findRelatedEventTestimonialsFilesystem(args: {
  provider: StorageProvider
  eventFileId: string
  libraryId: string
}): Promise<WizardSource[]> {
  const discovered = await discoverTestimonials({
    provider: args.provider,
    eventFileId: args.eventFileId,
  })

  const sources: WizardSource[] = discovered.map((t) => {
    const label = t.testimonialId
    const summary = t.speakerName
      ? `${t.speakerName}: ${(t.text || '').slice(0, 100)}${(t.text || '').length > 100 ? '...' : ''}`
      : `${label}: ${t.text ? t.text.slice(0, 100) : 'Testimonial'}${t.text && t.text.length > 100 ? '...' : ''}`

    // Wichtig: Im Korpus müssen Sprechername + Datum enthalten sein.
    // buildCorpusText() nutzt bei Dateien primär `extractedText` (nicht `summary`).
    // Daher enrichen wir hier den Text, damit die Template-Transformation
    // die Testimonials korrekt "mit Namen" zusammenfassen kann.
    const speaker = typeof t.speakerName === 'string' && t.speakerName.trim().length > 0 ? t.speakerName.trim() : 'Anonym'
    const createdAt = typeof t.createdAt === 'string' && t.createdAt.trim().length > 0 ? t.createdAt.trim() : ''
    const body = (t.text || '').trim()
    const enrichedText = [
      `Sprecher: ${speaker}`,
      createdAt ? `Erstellt: ${createdAt}` : '',
      '',
      body,
    ].filter(Boolean).join('\n')

    // Verwende markdownFileId wenn vorhanden, sonst folderId
    const fileId = t.source === 'markdown' && t.markdownFileId 
      ? t.markdownFileId 
      : t.folderId

    // WICHTIG: Verwende testimonialId als ID-Basis, damit SelectRelatedTestimonialsStep
    // die testimonialId korrekt extrahieren kann
    // Format: "file-{testimonialId}" oder "text-{testimonialId}" statt "file-{fileId}"
    return {
      id: t.source === 'markdown' ? `file-${t.testimonialId}` : `text-${t.testimonialId}`,
      kind: t.source === 'markdown' ? 'file' : 'text',
      fileName: t.source === 'markdown' ? `${t.testimonialId}.md` : undefined,
      text: t.text || undefined,
      extractedText: enrichedText || undefined,
      summary,
      createdAt: new Date(t.createdAt),
      // Speichere zusätzliche Metadaten für späteren Zugriff
      _testimonialId: t.testimonialId,
      _folderId: t.folderId,
      _fileId: fileId,
    } as unknown as WizardSource & { _testimonialId: string; _folderId: string; _fileId: string }
  })

  return sources
}

