'use client';

/**
 * file-preview/content-loader.tsx
 *
 * Lade-Helfer fuer Datei-Inhalte (Markdown/Text) mit Cache. Rendert nichts
 * (`return null`), ruft `onContentLoaded`-Callback auf, sobald der Inhalt
 * verfuegbar ist.
 *
 * Aus `file-preview.tsx` extrahiert (Welle 3-II-a). Vertrag stabil:
 * gleicher Props-Vertrag, gleiche Lade-Reihenfolge (Cache-Hit, Template-
 * Detection, Binary-Skip, Text-Load via Provider).
 */

import * as React from 'react'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'
import { FileLogger } from '@/lib/debug/logger'
import { extractFrontmatter } from '@/components/library/markdown-metadata'

interface ContentLoaderProps {
  item: StorageItem | null
  provider: StorageProvider | null
  fileType: string
  contentCache: React.MutableRefObject<Map<string, { content: string; hasMetadata: boolean }>>
  onContentLoaded: (content: string, hasMetadata: boolean) => void
}

export function ContentLoader({
  item,
  provider,
  fileType,
  contentCache,
  onContentLoaded,
}: ContentLoaderProps) {
  const loadingIdRef = React.useRef<string | null>(null)

  // Prueft, ob eine Datei ein Template ist (Variable-Platzhalter `{{...}}`).
  const isTemplateFile = React.useCallback((name?: string): boolean => {
    if (!name) return false
    return name.includes('{{') && name.includes('}}')
  }, [])

  const loadContent = React.useCallback(async () => {
    if (!item?.id || !provider) {
      FileLogger.debug('ContentLoader', 'loadContent abgebrochen', {
        hasItem: !!item?.id,
        hasProvider: !!provider,
      })
      return
    }

    // Pruefe, ob es sich um einen Ordner handelt (root ist ein Ordner).
    if (item.type === 'folder' || item.id === 'root') {
      FileLogger.debug('ContentLoader', 'Ueberspringe Content-Laden fuer Ordner', {
        itemId: item.id,
        itemName: item.metadata.name,
        itemType: item.type,
      })
      contentCache.current.set(item.id, { content: '', hasMetadata: false })
      onContentLoaded('', false)
      return
    }

    FileLogger.info('ContentLoader', 'Lade Content fuer Datei', {
      itemId: item.id,
      itemName: item.metadata.name,
      cacheSize: contentCache.current.size,
    })

    // Pruefen, ob Inhalt bereits im Cache.
    const cachedContent = contentCache.current.get(item.id)
    if (cachedContent) {
      FileLogger.info('ContentLoader', 'Content aus Cache geladen', {
        itemId: item.id,
        contentLength: cachedContent.content.length,
        hasMetadata: cachedContent.hasMetadata,
      })
      onContentLoaded(cachedContent.content, cachedContent.hasMetadata)
      return
    }

    // Pruefen, ob bereits ein Ladevorgang laeuft.
    if (loadingIdRef.current === item.id) {
      FileLogger.debug('ContentLoader', 'Ladevorgang laeuft bereits', { itemId: item.id })
      return
    }

    loadingIdRef.current = item.id

    try {
      // Wenn es eine Template-Datei ist, zeigen wir eine Warnung an.
      if (isTemplateFile(item.metadata.name)) {
        const content =
          '---\nstatus: template\n---\n\n> **Hinweis**: Diese Datei enthaelt nicht aufgeloeste Template-Variablen.\n> Bitte stellen Sie sicher, dass alle Variablen korrekt definiert sind.'
        contentCache.current.set(item.id, { content, hasMetadata: true })
        onContentLoaded(content, true)
        return
      }

      // Liste der Dateitypen, die als Binaerdateien behandelt werden sollen.
      const binaryFileTypes = ['audio', 'image', 'video', 'pdf', 'docx', 'pptx', 'xlsx']

      if (!binaryFileTypes.includes(fileType) && fileType !== 'unknown') {
        FileLogger.debug('ContentLoader', 'Lade Textinhalt von Provider', {
          itemId: item.id,
          fileType,
        })
        const content = await provider.getBinary(item.id).then(({ blob }) => blob.text())
        const hasMetadata = !!extractFrontmatter(content)

        FileLogger.info('ContentLoader', 'Content geladen und in Cache gespeichert', {
          itemId: item.id,
          contentLength: content.length,
          hasMetadata,
        })

        contentCache.current.set(item.id, { content, hasMetadata })
        onContentLoaded(content, hasMetadata)
      } else {
        FileLogger.debug('ContentLoader', 'Ueberspringe Content-Laden fuer Binary/Unknown-Datei', {
          itemId: item.id,
          fileType,
          isBinary: binaryFileTypes.includes(fileType),
          isUnknown: fileType === 'unknown',
        })
        contentCache.current.set(item.id, { content: '', hasMetadata: false })
        onContentLoaded('', false)
      }
    } catch (err) {
      FileLogger.error('ContentLoader', 'Failed to load file', err)
      // Bei Fehler zeigen wir eine Fehlermeldung im Markdown-Format an.
      const errorContent =
        '---\nstatus: error\n---\n\n> **Fehler**: Die Datei konnte nicht geladen werden.\n> Bitte ueberpruefen Sie die Konsole fuer weitere Details.'
      contentCache.current.set(item.id, { content: errorContent, hasMetadata: true })
      onContentLoaded(errorContent, true)
    } finally {
      loadingIdRef.current = null
    }
  }, [item?.id, item?.type, item?.metadata?.name, provider, fileType, onContentLoaded, isTemplateFile, contentCache])

  // Cleanup bei Unmount.
  React.useEffect(() => {
    return () => {
      loadingIdRef.current = null
    }
  }, [])

  // Nur laden, wenn sich die ID aendert.
  React.useEffect(() => {
    if (item?.id) {
      loadContent()
    }
  }, [item?.id, loadContent])

  return null
}
