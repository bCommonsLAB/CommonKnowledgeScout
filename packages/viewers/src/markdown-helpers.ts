/**
 * markdown-preview/markdown-helpers.ts
 *
 * Pure Helper-Funktionen, die aus `markdown-preview.tsx` ausgegliedert
 * wurden (Welle 3-II-b, Schritt 2/8).
 *
 * Alle Funktionen sind reine Transformationen ohne Seiteneffekte —
 * keine React-Hooks, kein DOM-Zugriff, kein Logging.
 *
 * Enthaelt:
 * - `injectPageAnchors` — Marker fuer "— Seite N —" Zeilen
 * - `getYouTubeId` — Video-ID aus YouTube-URL extrahieren
 * - `resolveImageUrl` — Bild-Pfad zur Storage-API-URL aufloesen
 * - `encodeSpacesInRelativeMarkdownHrefs` — Leerzeichen in Datei-Pfaden kodieren
 * - `processObsidianContent` — Obsidian-spezifische Syntax in Standard-Markdown
 *
 * Hinweis: `processObsidianContent` benoetigt `resolveImageUrl` als
 * Closure — beide bleiben in dieser Datei beisammen.
 */

import type { StorageProvider } from '@/lib/storage/types'
import { FileLogger } from '@/lib/debug/logger'

/**
 * Fuegt unsichtbare Anker vor Zeilen wie "— Seite 12 —" ein, damit
 * Scroll-Sync moeglich ist. Der sichtbare Text bleibt erhalten; wir
 * ergaenzen nur ein Marker-DIV vorher.
 */
export function injectPageAnchors(content: string): string {
  const pageLine = /^(?:\s*[–—-])\s*Seite\s+(\d+)\s*(?:[–—-])\s*$/gmi
  return content.replace(pageLine, (_m, pageNum: string) => {
    const n = String(pageNum).trim()
    return `<div data-page-marker="${n}"></div>\n— Seite ${n} —`
  })
}

/**
 * Extrahiert die YouTube-Video-ID aus einer URL, falls moeglich.
 * Unterstuetzt youtube.com/watch?v=, youtu.be/, youtube.com/embed/.
 */
export function getYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s]+)/,
    /youtube\.com\/watch\?.*v=([^&\s]+)/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) return match[1]
  }
  return null
}

/**
 * Konvertiert einen relativen Bildpfad zu einer Storage-API-URL.
 *
 * @param imagePath Relativer Bildpfad (z.B. "img-0.jpeg")
 * @param currentFolderId ID des aktuellen Verzeichnisses (base64-encoded fileId)
 * @param libraryId Die Library-ID
 * @param sourceId Optional: fileId des Quelldokuments (Traeger). Wird als
 *                 `&sourceId=` an die streaming-url gehaengt, damit die Bild-
 *                 Aufloesung praezise auf dessen Shadow-Twin gescoped wird
 *                 (verhindert dokumentuebergreifende Namens-Kollisionen).
 * @param baseItem Optional: Die Basisdatei (z.B. PDF) fuer Shadow-Twin-Aufloesung
 * @param provider Optional: Storage Provider fuer Shadow-Twin-Aufloesung
 * @returns Storage-API-URL oder urspruenglicher Pfad bei Fehler
 */
export function resolveImageUrl(
  imagePath: string,
  currentFolderId: string,
  libraryId: string | undefined,
  sourceId?: string,
  baseItem?: { id: string } | null,
  provider?: StorageProvider | null,
): string {
  if (!imagePath || !libraryId) return imagePath

  // Pruefe ob es bereits eine absolute URL ist (HTTP/HTTPS oder bereits
  // aufgeloeste Storage-API-URL). Beruecksichtige auch HTML-encoded URLs
  // (&amp; statt &).
  const decodedPath = imagePath.replace(/&amp;/g, '&')
  if (
    decodedPath.startsWith('http://') ||
    decodedPath.startsWith('https://') ||
    decodedPath.startsWith('/api/storage/')
  ) {
    return imagePath
  }

  const normalizedPath = imagePath.replace(/^\/+|\/+$/g, '')

  if (normalizedPath.includes('..')) {
    console.warn('[markdown-helpers] Path traversal detected, ignoring:', normalizedPath)
    return imagePath
  }

  // Verwende zentrale Shadow-Twin-Bild-Aufloesung, wenn baseItem und
  // provider verfuegbar sind. Diese wird asynchron aufgeloest, daher
  // geben wir hier einen Platzhalter zurueck (wird in useEffect ersetzt).
  if (baseItem && provider) {
    return imagePath
  }

  let fullPath: string
  if (currentFolderId === 'root') {
    fullPath = normalizedPath
  } else {
    try {
      const binaryString = atob(currentFolderId)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      const decodedFolderPath = new TextDecoder().decode(bytes)
      fullPath = `${decodedFolderPath}/${normalizedPath}`
    } catch (error) {
      console.warn(
        '[markdown-helpers] Fehler beim Dekodieren von currentFolderId:',
        error,
      )
      fullPath = `${currentFolderId}/${normalizedPath}`
    }
  }

  if (currentFolderId === 'root') {
    FileLogger.debug('markdown-helpers', 'Bild-URL-Aufloesung mit root', {
      imagePath,
      currentFolderId,
      normalizedPath,
      fullPath,
      libraryId,
    })
  }

  try {
    const utf8Bytes = new TextEncoder().encode(fullPath)
    let binary = ''
    for (let i = 0; i < utf8Bytes.length; i++) {
      binary += String.fromCharCode(utf8Bytes[i])
    }
    const fileId = btoa(binary)

    // sourceId (Traeger-fileId) anhaengen, damit die Route die Bild-Aufloesung
    // praezise auf den richtigen Shadow-Twin scoped (kein library-weites Raten).
    const sourceIdParam = sourceId ? `&sourceId=${encodeURIComponent(sourceId)}` : ''
    const resolvedUrl = `/api/storage/streaming-url?libraryId=${encodeURIComponent(libraryId)}&fileId=${encodeURIComponent(fileId)}${sourceIdParam}`

    if (currentFolderId !== 'root') {
      FileLogger.debug('markdown-helpers', 'Bild-URL erfolgreich aufgeloest', {
        imagePath,
        currentFolderId,
        fullPath,
        fileId,
        resolvedUrl,
      })
    }

    return resolvedUrl
  } catch (error) {
    console.error('[markdown-helpers] Fehler beim Konvertieren des Bildpfads:', error)
    return imagePath
  }
}

/**
 * Leerzeichen in relativen Zielpfaden fuer Markdown-Links kodieren.
 * Remarkable/CommonMark bricht sonst bei Dateinamen wie "Aktion Wasser.md"
 * ab (Link wirkt wie Fliesstext).
 */
export function encodeSpacesInRelativeMarkdownHrefs(text: string): string {
  return text.replace(/\[([^\]]*)\]\(([^)]+)\)/g, (full, label: string, hrefRaw: string) => {
    const href = hrefRaw.trim()
    if (!href || /^(https?:|mailto:|#|\/api\/)/i.test(href)) return full
    if (!/\s/.test(href)) return full
    const enc = href.replace(/ /g, '%20')
    return `[${label}](${enc})`
  })
}

/**
 * Konvertiert Obsidian-Pfade und bereitet Markdown-Inhalt vor.
 *
 * Aenderungen vs Original:
 * - YouTube-Embed: hat `getYouTubeId` als Closure ueber Modul-Import
 * - Bild-URL-Aufloesung: hat `resolveImageUrl` als Closure ueber Modul-Import
 *
 * @param content Roher Markdown-Inhalt
 * @param currentFolderId Base64-encoded fileId des aktuellen Ordners
 * @param provider Storage-Provider (nur fuer Existenz-Pruefung — keine
 *                 Calls hier)
 * @param libraryId Library-ID fuer URL-Konstruktion
 * @param sourceId Optional: fileId des Quelldokuments (Traeger) fuer die
 *                 sourceId-praezise Bild-Aufloesung (siehe `resolveImageUrl`).
 * @returns Vorverarbeiteter Markdown-Inhalt
 */
export function processObsidianContent(
  content: string,
  currentFolderId: string = 'root',
  provider: StorageProvider | null = null,
  libraryId: string | undefined = undefined,
  sourceId?: string,
): string {
  if (!provider) return content

  // Obsidian: [[Ziel|Anzeigetext]] — vor allen anderen [[...]]-Ersetzungen
  // (sonst frisst das generische Muster den Pipe-Link).
  content = content.replace(/\[\[([^\[\]]+?)\|([^\[\]]+?)\]\]/g, (_m, target: string, linkLabel: string) => {
    const href = target.replace(/ /g, '%20')
    return `[${linkLabel}](${href})`
  })

  // Wichtig: ![[bild.jpg]] ZUERST — sonst ersetzt das naechste Muster nur
  // [[…]] innerhalb von ![[…]] und es bleibt ein stoerendes "!" als
  // Fliesstext (Obsidian zeigt das nicht).
  content = content.replace(/!\[\[(.*?\.(?:mp3|m4a|wav|ogg))\]\]/g, (_match, audioFile: string) => {
    return `<div class="my-4">
      <div class="text-xs text-muted-foreground">Audio: ${audioFile}</div>
    </div>`
  })

  content = content.replace(/!\[\[(.*?\.(?:jpg|jpeg|png|gif|webp))\]\]/gi, '![]($1)')

  // Obsidian: [[bild.png]] als eingebettetes Bild (nur ohne fuehrendes !)
  content = content.replace(/\[\[([^\[\]]+\.(?:jpe?g|png|gif|webp))\]\]/gi, '![]($1)')

  // Convert YouTube links
  content = content.replace(
    /\[(.*?)\]\((https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[^\s)]+)\)/g,
    (match, title, url) => {
      const videoId = getYouTubeId(url)
      if (!videoId) return match

      return `
<div class="youtube-embed my-8">
  <div class="relative w-full" style="padding-bottom: 56.25%;">
    <iframe
      src="https://www.youtube.com/embed/${videoId}"
      title="${title || 'YouTube video player'}"
      frameborder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen
      class="absolute top-0 left-0 w-full h-full rounded-lg shadow-lg"
    ></iframe>
  </div>
</div>`
    },
  )

  // Convert Obsidian YouTube callouts
  content = content.replace(
    />\s*\[!youtube\]\s*\n?\s*(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[^\s)]+)/g,
    (match, url) => {
      const videoId = getYouTubeId(url)
      if (!videoId) return match

      return `
<div class="youtube-embed my-8">
  <div class="relative w-full" style="padding-bottom: 56.25%;">
    <iframe
      src="https://www.youtube.com/embed/${videoId}"
      title="YouTube video player"
      frameborder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen
      class="absolute top-0 left-0 w-full h-full rounded-lg shadow-lg"
    ></iframe>
  </div>
</div>`
    },
  )

  // Resolve relative image paths to Storage API URLs.
  // Phase 4 (media-storage-determinismus): Bilder mit absoluten http(s)://-URLs
  // werden hier bewusst NICHT umgeschrieben (`(?!http)`-Lookahead). Das ist der
  // "Fast Path": absolute Azure-URLs aus dem Markdown gehen direkt an den Browser.
  if (currentFolderId && libraryId) {
    content = content.replace(
      /!\[(.*?)\]\((?!http)(.*?)\)/g,
      (match, alt, imagePath) => {
        const resolvedUrl = resolveImageUrl(imagePath, currentFolderId, libraryId, sourceId)
        return `![${alt}](${resolvedUrl})`
      },
    )

    content = content.replace(
      /<img-(\d+\.(?:jpeg|jpg|png|gif|webp))>/gi,
      (match, imagePath) => {
        const resolvedUrl = resolveImageUrl(imagePath, currentFolderId, libraryId, sourceId)
        return `![${imagePath}](${resolvedUrl})`
      },
    )

    content = content.replace(
      /<img\s+src=["'](?!http)([^"']+)["'][^>]*>/gi,
      (match, imagePath) => {
        const resolvedUrl = resolveImageUrl(imagePath, currentFolderId, libraryId, sourceId)
        return `<img src="${resolvedUrl}">`
      },
    )
  } else if (currentFolderId) {
    content = content.replace(
      /!\[(.*?)\]\((?!http)(.*?)\)/g,
      `![$1](${currentFolderId}/$2)`,
    )
  }

  // Convert Obsidian internal links to normal links (Ziel-URL Leerzeichen kodieren)
  content = content.replace(/\[\[(.*?)\]\]/g, (_m, inner: string) => {
    const href = inner.replace(/ /g, '%20')
    return `[${inner}](${href})`
  })

  // Alle verbleibenden relativen [text](url) mit Leerzeichen im url-Teil
  content = encodeSpacesInRelativeMarkdownHrefs(content)

  // Convert Obsidian callouts
  content = content.replace(
    /> \[(.*?)\](.*?)(\n|$)/g,
    '<div class="callout $1">$2</div>',
  )

  return content
}
