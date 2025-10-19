export type FacetKey = 'authors' | 'year' | 'region' | 'docType' | 'source' | 'tags' | 'topics' | 'language' | 'commercialStatus'

export interface FacetMappingConfig {
  keys: FacetKey[]
}

function toStringArray(input: unknown, limit = 50, maxLen = 128): string[] {
  if (!Array.isArray(input)) return []
  return input
    .map((v) => (typeof v === 'string' ? v : String(v)))
    .filter((v) => v.length > 0)
    .slice(0, limit)
    .map((v) => (v.length > maxLen ? v.slice(0, maxLen) : v))
}

export function extractTopLevelFacetsFromMeta(
  meta: Record<string, unknown> | undefined,
  keys: FacetKey[]
): Record<string, unknown> {
  if (!meta || typeof meta !== 'object') return {}
  const out: Record<string, unknown> = {}

  for (const key of keys) {
    switch (key) {
      case 'authors': {
        const val = toStringArray((meta as { authors?: unknown }).authors)
        if (val.length > 0) out.authors = val
        break
      }
      case 'tags': {
        const val = toStringArray((meta as { tags?: unknown }).tags)
        if (val.length > 0) out.tags = val
        break
      }
      case 'topics': {
        const val = toStringArray((meta as { topics?: unknown }).topics)
        if (val.length > 0) out.topics = val
        break
      }
      case 'language': {
        const v = (meta as { language?: unknown }).language
        if (typeof v === 'string' && v) out.language = v
        break
      }
      case 'region': {
        const v = (meta as { region?: unknown }).region
        if (typeof v === 'string' && v) out.region = v
        break
      }
      case 'docType': {
        const v = (meta as { docType?: unknown }).docType
        if (typeof v === 'string' && v) out.docType = v
        break
      }
      case 'source': {
        const v = (meta as { source?: unknown }).source
        if (typeof v === 'string' && v) out.source = v
        break
      }
      case 'commercialStatus': {
        const v = (meta as { commercialStatus?: unknown }).commercialStatus
        if (typeof v === 'string' && v) out.commercialStatus = v
        break
      }
      case 'year': {
        const v = (meta as { year?: unknown }).year
        if (typeof v === 'number' || typeof v === 'string') out.year = v
        break
      }
      default:
        break
    }
  }
  return out
}

export function composeDocSummaryText(meta: Record<string, unknown> | undefined): string | null {
  if (!meta || typeof meta !== 'object') return null
  const title = typeof (meta as { title?: unknown }).title === 'string' ? (meta as { title: string }).title : undefined
  const shortTitle = typeof (meta as { shortTitle?: unknown }).shortTitle === 'string' ? (meta as { shortTitle: string }).shortTitle : undefined
  const summary = typeof (meta as { summary?: unknown }).summary === 'string' ? (meta as { summary: string }).summary : undefined
  const authors = toStringArray((meta as { authors?: unknown }).authors).slice(0, 10)
  const tags = toStringArray((meta as { tags?: unknown }).tags).slice(0, 10)

  const parts: string[] = []
  if (title) parts.push(`Titel: ${title}`)
  if (shortTitle) parts.push(`Kurz: ${shortTitle}`)
  if (authors.length > 0) parts.push(`Autoren: ${authors.join(', ')}`)
  if (summary) parts.push(`Zusammenfassung: ${summary}`)
  if (tags.length > 0) parts.push(`Tags: ${tags.join(', ')}`)
  const text = parts.join('\n')
  return text.length > 0 ? text : null
}


