import type { StorageProvider } from '@/lib/storage/types'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { resolveArtifact } from '@/lib/shadow-twin/artifact-resolver'
import { parseArtifactName } from '@/lib/shadow-twin/artifact-naming'

/**
 * Einheitliche Datenstruktur für ein gefundenes Testimonial
 */
export interface DiscoveredTestimonial {
  /** Ordner-ID des Testimonials */
  folderId: string
  /** Testimonial-ID (Ordner-Name) */
  testimonialId: string
  /** Sprecher-Name */
  speakerName: string | null
  /** Erstellungsdatum (ISO-String) */
  createdAt: string
  /** Text-Inhalt (Markdown-Body oder Text aus meta.json) */
  text: string | null
  /** Ob Audio vorhanden ist */
  hasAudio: boolean
  /** Audio-Dateiname (falls vorhanden) */
  audioFileName: string | null
  /** Audio-Datei-ID (falls vorhanden) */
  audioFileId: string | null
  /** Quelle: 'markdown' oder 'meta.json' */
  source: 'markdown' | 'meta.json'
  /** ID der gefundenen Markdown-Datei (falls source === 'markdown') */
  markdownFileId: string | null
}

/**
 * Findet alle Testimonials in einem Event-Ordner.
 * 
 * Einheitliche Logik für API und Wizard:
 * 1. Durchsucht alle Ordner im testimonials-Ordner
 * 2. Für jeden Ordner: Prüft zuerst Markdown-Dateien (auch in Unterordnern), dann meta.json
 * 3. Gibt einheitliche Datenstruktur zurück
 */
export async function discoverTestimonials(args: {
  provider: StorageProvider
  eventFileId: string
}): Promise<DiscoveredTestimonial[]> {
  const { provider, eventFileId } = args

  const eventItem = await provider.getItemById(eventFileId)
  if (!eventItem || eventItem.type !== 'file') {
    console.warn('[testimonial-discovery] Event-Datei nicht gefunden oder kein File:', { eventFileId, itemType: eventItem?.type })
    return []
  }
  const eventFolderId = eventItem.parentId || 'root'

  const baseItems = await provider.listItemsById(eventFolderId)
  const testimonialsFolder = baseItems.find((it) => it.type === 'folder' && it.metadata?.name === 'testimonials')
  if (!testimonialsFolder?.id) {
    console.warn('[testimonial-discovery] testimonials-Ordner nicht gefunden:', { eventFolderId, baseItems: baseItems.map(it => ({ type: it.type, name: it.metadata?.name })) })
    return []
  }

  const testimonialFolders = (await provider.listItemsById(testimonialsFolder.id)).filter((it) => it.type === 'folder')

  const results: DiscoveredTestimonial[] = []
  
  for (const folder of testimonialFolders) {
    const folderId = folder.id
    const testimonialId = folder.metadata?.name || folderId
    const items = await provider.listItemsById(folderId)

    // Suche Source-Datei (Audio oder Text)
    const audio = items.find((f) => f.type === 'file' && /\.(mp3|m4a|wav|ogg|opus|flac|webm)$/i.test(String(f.metadata?.name || '')))
    const source = audio || items.find((f) => f.type === 'file' && /^source\.txt$/i.test(String(f.metadata?.name || '')))
    const audioFileId = audio?.id || null
    const audioFileName = audio?.metadata?.name || null
    const sourceFileId = source?.id || null
    const sourceFileName = source?.metadata?.name || null

    let processed = false

    // 1. Versuche Transformation-Artefakt zu finden (bevorzugt)
    if (sourceFileId && sourceFileName) {
      try {
        const targetLanguage = 'de' // TODO: könnte aus Event-Frontmatter kommen
        const templateName = 'event-testimonial-creation-de' // TODO: könnte aus Event-Frontmatter kommen
        
        const resolved = await resolveArtifact(provider, {
          sourceItemId: sourceFileId,
          sourceName: sourceFileName,
          parentId: folderId,
          targetLanguage,
          templateName,
          preferredKind: 'transformation',
        })

        if (resolved) {
          // Transformation-Artefakt gefunden - verwende dieses
          try {
            const { blob } = await provider.getBinary(resolved.fileId)
            const markdownText = (await blob.text()).trim()
            
            if (markdownText) {
              const { meta: frontmatterMeta, body } = parseFrontmatter(markdownText)
              const speakerName = typeof frontmatterMeta.speakerName === 'string' 
                ? frontmatterMeta.speakerName.trim() 
                : null
              
              let createdAt: string
              if (typeof frontmatterMeta.createdAt === 'string') {
                createdAt = frontmatterMeta.createdAt
              } else {
                const dateMatch = testimonialId.match(/(\d{4}-\d{2}-\d{2})/)
                if (dateMatch) {
                  createdAt = `${dateMatch[1]}T12:00:00.000Z`
                } else {
                  createdAt = new Date().toISOString()
                }
              }

              const text = body.trim() || null

              results.push({
                folderId,
                testimonialId,
                speakerName,
                createdAt,
                text,
                hasAudio: !!audio,
                audioFileName,
                audioFileId,
                source: 'markdown', // Transformation-Artefakt ist Markdown
                markdownFileId: resolved.fileId,
              })
              processed = true
            }
          } catch (error) {
            console.warn(`[testimonial-discovery] Fehler beim Lesen von Transformation-Artefakt ${resolved.fileId}:`, error)
          }
        }
      } catch (error) {
        console.warn(`[testimonial-discovery] Fehler beim Auflösen von Transformation-Artefakt:`, error)
      }
    }

    // 2. Fallback: Suche nach Markdown-Dateien (für alte Wizard-Testimonials ohne resolveArtifact)
    if (!processed) {
      let md = items.find((it) => it.type === 'file' && /\.md$/i.test(String(it.metadata?.name || '')))
      
      if (!md) {
        // Suche in Unterordnern
        const subFolders = items.filter((it) => it.type === 'folder')
        for (const subFolder of subFolders) {
          try {
            const subItems = await provider.listItemsById(subFolder.id)
            const subMd = subItems.find((it) => it.type === 'file' && /\.md$/i.test(String(it.metadata?.name || '')))
            if (subMd) {
              md = subMd
              break
            }
          } catch {
            // Ignore errors beim Durchsuchen von Unterordnern
          }
        }
      }

      // Verarbeite Markdown-Datei, falls vorhanden
      if (md?.id) {
        try {
          const { blob } = await provider.getBinary(md.id)
          const markdownText = (await blob.text()).trim()
          
          if (markdownText) {
            const { meta: frontmatterMeta, body } = parseFrontmatter(markdownText)
            const speakerName = typeof frontmatterMeta.speakerName === 'string' 
              ? frontmatterMeta.speakerName.trim() 
              : null
            
            // createdAt: aus Frontmatter oder aus Ordner-Namen
            let createdAt: string
            if (typeof frontmatterMeta.createdAt === 'string') {
              createdAt = frontmatterMeta.createdAt
            } else {
              // Versuche Datum aus Ordner-Namen zu extrahieren (z.B. "testimonial-2026-01-14")
              const dateMatch = testimonialId.match(/(\d{4}-\d{2}-\d{2})/)
              if (dateMatch) {
                createdAt = `${dateMatch[1]}T12:00:00.000Z`
              } else {
                createdAt = new Date().toISOString()
              }
            }

            const text = body.trim() || null

            results.push({
              folderId,
              testimonialId,
              speakerName,
              createdAt,
              text,
              hasAudio: !!audio,
              audioFileName,
              audioFileId,
              source: 'markdown',
              markdownFileId: md.id,
            })
            processed = true
          }
        } catch (error) {
          console.warn(`[testimonial-discovery] Fehler beim Verarbeiten von Markdown-Datei ${md.id}:`, error)
        }
      }
    }

    // 3. Fallback: Wenn keine Markdown verarbeitet wurde, prüfe meta.json (für alte anonyme Testimonials)
    if (!processed) {
      const metaFile = items.find((it) => it.type === 'file' && String(it.metadata?.name || '').toLowerCase() === 'meta.json')
      if (metaFile?.id) {
        try {
          const { blob } = await provider.getBinary(metaFile.id)
          const txt = await blob.text()
          const meta = JSON.parse(txt) as unknown
          
          const metaText = meta && typeof meta === 'object' && 'text' in (meta as Record<string, unknown>)
            ? (meta as Record<string, unknown>).text
            : null
          
          const speakerName = meta && typeof meta === 'object' && 'speakerName' in (meta as Record<string, unknown>)
            ? (typeof (meta as Record<string, unknown>).speakerName === 'string' 
                ? (meta as Record<string, unknown>).speakerName.trim() 
                : null)
            : null
          
          const createdAtRaw = meta && typeof meta === 'object' && 'createdAt' in (meta as Record<string, unknown>)
            ? (meta as Record<string, unknown>).createdAt
            : null
          
          const createdAt = typeof createdAtRaw === 'string'
            ? createdAtRaw
            : (createdAtRaw instanceof Date
                ? createdAtRaw.toISOString()
                : new Date().toISOString())

          const text = metaText && typeof metaText === 'string' ? metaText.trim() : null

          results.push({
            folderId,
            testimonialId,
            speakerName,
            createdAt,
            text,
            hasAudio: !!audio,
            audioFileName,
            audioFileId,
            source: 'meta.json',
            markdownFileId: null,
          })
        } catch (error) {
          console.warn(`[testimonial-discovery] Fehler beim Verarbeiten von meta.json ${metaFile.id}:`, error)
        }
      }
    }
  }

  return results
}
