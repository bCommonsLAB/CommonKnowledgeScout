import type { StorageProvider } from '@/lib/storage/types'
import type { WizardSource } from '@/lib/creation/corpus'

/**
 * Find related testimonial sources for an event, based on filesystem layout:
 * <eventFolder>/testimonials/<testimonialId>/(transcript*.md OR testimonial*.md OR meta.json)
 *
 * We prefer transcript/testimonial markdown files as sources.
 */
export async function findRelatedEventTestimonialsFilesystem(args: {
  provider: StorageProvider
  eventFileId: string
  libraryId: string
}): Promise<WizardSource[]> {
  const { provider, eventFileId } = args

  const eventItem = await provider.getItemById(eventFileId)
  if (!eventItem || eventItem.type !== 'file') return []
  const eventFolderId = eventItem.parentId || 'root'

  const baseItems = await provider.listItemsById(eventFolderId)
  const testimonialsFolder = baseItems.find((it) => it.type === 'folder' && it.metadata?.name === 'testimonials')
  if (!testimonialsFolder?.id) return []

  const testimonialFolders = (await provider.listItemsById(testimonialsFolder.id)).filter((it) => it.type === 'folder')

  const sources: WizardSource[] = []
  for (const folder of testimonialFolders) {
    const folderId = folder.id
    const label = folder.metadata?.name || folderId
    const items = await provider.listItemsById(folderId)

    // Prefer markdown transcript/testimonial files if present
    const md = items.find((it) => it.type === 'file' && /\.md$/i.test(String(it.metadata?.name || '')))
    if (md?.id) {
      try {
        const { blob } = await provider.getBinary(md.id)
        const text = (await blob.text()).trim()
        if (!text) continue
        sources.push({
          id: `file-${md.id}`,
          kind: 'file',
          fileName: String(md.metadata?.name || label),
          extractedText: text,
          summary: `${label}: ${String(md.metadata?.name || 'testimonial')}`,
          createdAt: new Date(),
        })
        continue
      } catch {
        // ignore and try meta.json
      }
    }

    const metaFile = items.find((it) => it.type === 'file' && String(it.metadata?.name || '').toLowerCase() === 'meta.json')
    if (metaFile?.id) {
      try {
        const { blob } = await provider.getBinary(metaFile.id)
        const txt = await blob.text()
        const meta = JSON.parse(txt) as unknown
        const speakerName =
          meta && typeof meta === 'object' && 'speakerName' in (meta as Record<string, unknown>)
            ? (meta as Record<string, unknown>).speakerName
            : null
        const line = typeof speakerName === 'string' && speakerName.trim()
          ? `${speakerName.trim()} hat ein Testimonial abgegeben.`
          : `${label} hat ein Testimonial abgegeben.`
        sources.push({
          id: `text-${folderId}`,
          kind: 'text',
          text: line,
          summary: line,
          createdAt: new Date(),
        })
      } catch {
        // ignore
      }
    }
  }

  return sources
}

