/**
 * @fileoverview Markdown Page Splitter
 *
 * @description
 * Splits transcript markdown into per-page chunks based on explicit page markers.
 * This enables deterministic per-page processing without re-running OCR.
 */

export interface MarkdownPageSlice {
  /** Page number extracted from marker (e.g. "--- Seite 12 ---") */
  pageNumber: number
  /** Markdown body content for this page, without the marker line */
  content: string
}

export interface SplitMarkdownByPagesResult {
  pages: MarkdownPageSlice[]
  markerCount: number
}

const PAGE_MARKER_REGEX = /^---\s*Seite\s*(\d+)\s*---\s*$/gm

/**
 * Removes YAML frontmatter from markdown to ensure markers are parsed from the body.
 * We keep this logic local to avoid coupling to any specific frontmatter parser.
 */
function stripFrontmatter(markdown: string): string {
  const fm = /^---\n([\s\S]*?)\n---\n?/
  return markdown.replace(fm, '')
}

/**
 * Splits markdown into per-page slices by looking for "--- Seite N ---" markers.
 * This function is intentionally strict: no markers means no pages.
 */
export function splitMarkdownByPageMarkers(markdown: string): SplitMarkdownByPagesResult {
  const body = stripFrontmatter(markdown)
  const matches: Array<{ index: number; length: number; pageNumber: number }> = []

  let match: RegExpExecArray | null
  while ((match = PAGE_MARKER_REGEX.exec(body))) {
    const pageNumber = Number(match[1])
    if (Number.isFinite(pageNumber) && pageNumber > 0 && typeof match.index === 'number') {
      matches.push({ index: match.index, length: match[0].length, pageNumber })
    }
  }

  if (matches.length === 0) {
    return { pages: [], markerCount: 0 }
  }

  const pages: MarkdownPageSlice[] = []
  for (let i = 0; i < matches.length; i += 1) {
    const current = matches[i]
    const next = matches[i + 1]
    const start = current.index + current.length
    const end = next ? next.index : body.length
    const content = body.slice(start, end).trim()
    pages.push({ pageNumber: current.pageNumber, content })
  }

  return { pages, markerCount: matches.length }
}

/**
 * Derives a filesystem-safe folder name from a file name.
 * We avoid importing other helpers to keep this module small and testable.
 */
export function toSafeFolderName(fileName: string): string {
  const normalized = fileName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

  return normalized || 'pages'
}
