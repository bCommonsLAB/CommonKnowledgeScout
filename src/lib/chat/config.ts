import * as z from 'zod'
import { LibraryChatConfig } from '@/types/library'

/**
 * Zod-Schema für Chat-Konfiguration mit Defaults.
 * Achtung: Keine Secrets hier speichern.
 */
export const chatConfigSchema = z.object({
  public: z.boolean().default(false),
  titleAvatarSrc: z.string().url().optional(),
  welcomeMessage: z.string().min(1).default('Hallo! Ich bin dein wissensbasierter Chatbot.'),
  errorMessage: z.string().default('Etwas ist schiefgegangen. Versuche es bitte nochmal.'),
  placeholder: z.string().default('Schreibe deine Frage...'),
  maxChars: z.number().int().positive().max(4000).default(500),
  maxCharsWarningMessage: z.string().default('Deine Frage ist zu lang, bitte kürze sie.'),
  footerText: z.string().default(''),
  companyLink: z.string().url().optional(),
  features: z.object({
    citations: z.boolean().default(true),
    streaming: z.boolean().default(true),
  }).default({ citations: true, streaming: true }),
  rateLimit: z.object({
    windowSec: z.number().int().positive().default(60),
    max: z.number().int().positive().default(30),
  }).default({ windowSec: 60, max: 30 }),
  vectorStore: z.object({
    indexOverride: z.string().min(1).optional(),
  }).default({}),
  // Zielsprache für Chat-Antworten
  targetLanguage: z.enum(['de', 'en', 'it', 'fr', 'es', 'ar']).default('de'),
  // Charakter/Profil für die Antwort-Perspektive
  character: z.enum([
    'developer',
    'technical',
    'open-source',
    'scientific',
    'eco-social',
    'social',
    'civic',
    'policy',
    'cultural',
    'business',
    'entrepreneurial',
    'legal',
    'educational',
    'creative',
  ]).default('business'),
  // Sozialer Kontext/Sprachebene
  socialContext: z.enum(['scientific', 'popular', 'youth', 'senior']).default('popular'),
  gallery: z.object({
    // Typ der Detailansicht: 'book' für klassische Dokumente, 'session' für Event-Sessions/Präsentationen
    detailViewType: z.enum(['book', 'session']).default('book'),
    facets: z.array(z.object({
      metaKey: z.string().min(1), // Top‑Level Feld in docMetaJson (gleichzeitig Query-Param-Name)
      label: z.string().min(1).optional(),
      type: z.enum(['string','number','boolean','string[]','date','integer-range']).default('string'),
      multi: z.boolean().default(true),
      visible: z.boolean().default(true),
      buckets: z.array(z.object({ label: z.string(), min: z.number().int(), max: z.number().int() })).optional(),
    })).default([
      { metaKey: 'authors', label: 'Authors', type: 'string[]', multi: true, visible: true },
      { metaKey: 'year', label: 'Year', type: 'number', multi: true, visible: true },
      { metaKey: 'region', label: 'Region', type: 'string', multi: true, visible: true },
      { metaKey: 'docType', label: 'DocType', type: 'string', multi: true, visible: true },
      { metaKey: 'source', label: 'Source', type: 'string', multi: true, visible: true },
      { metaKey: 'tags', label: 'Tags', type: 'string[]', multi: true, visible: true },
      { metaKey: 'topics', label: 'Topics', type: 'string[]', multi: true, visible: false },
      { metaKey: 'language', label: 'Language', type: 'string', multi: true, visible: false },
      { metaKey: 'commercialStatus', label: 'Commercial', type: 'string', multi: true, visible: false },
    ])
  }).default({
    detailViewType: 'book',
    facets: [
      { metaKey: 'authors', label: 'Authors', type: 'string[]', multi: true, visible: true },
      { metaKey: 'year', label: 'Year', type: 'number', multi: true, visible: true },
      { metaKey: 'region', label: 'Region', type: 'string', multi: true, visible: true },
      { metaKey: 'docType', label: 'DocType', type: 'string', multi: true, visible: true },
      { metaKey: 'source', label: 'Source', type: 'string', multi: true, visible: true },
      { metaKey: 'tags', label: 'Tags', type: 'string[]', multi: true, visible: true },
      { metaKey: 'topics', label: 'Topics', type: 'string[]', multi: true, visible: false },
      { metaKey: 'language', label: 'Language', type: 'string', multi: true, visible: false },
      { metaKey: 'commercialStatus', label: 'Commercial', type: 'string', multi: true, visible: false },
    ]
  }),
})

export type NormalizedChatConfig = z.infer<typeof chatConfigSchema>

/**
 * Validiert und setzt Defaults für die Chat-Konfiguration.
 */
export function normalizeChatConfig(config: unknown): NormalizedChatConfig {
  // Tolerantes Normalisieren: Strings (JSON) akzeptieren und migrieren
  let cfg: unknown = config
  if (typeof cfg === 'string') {
    try { cfg = JSON.parse(cfg) as unknown } catch { cfg = {} }
  }
  // Migration: gallery.facets als Array<string> → Array<{metaKey,...}>
  if (cfg && typeof cfg === 'object') {
    const c = cfg as { gallery?: { facets?: unknown } }
    const raw = c?.gallery?.facets
    if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] !== 'object') {
      const mapped = (raw as unknown[]).map(v => {
        const k = typeof v === 'string' ? v : String(v)
        if (!k) return null
        return { metaKey: k, label: k, type: 'string', multi: true, visible: true }
      }).filter(Boolean) as Array<unknown>
      if (c.gallery) c.gallery.facets = mapped
    }
  }
  return chatConfigSchema.parse(cfg ?? {})
}

/**
 * Erzeugt einen vektor-index-kompatiblen Namen aus einem beliebigen String.
 * Regeln: kleingeschrieben, nur [a-z0-9-], keine doppelten Bindestriche, max 45 Zeichen, darf nicht mit Ziffer beginnen.
 */
export function slugifyIndexName(input: string): string {
  const lower = input.toLowerCase()
  // Ersetze Nicht-Alphanumerisches durch '-'
  const replaced = lower.normalize('NFKD').replace(/[^a-z0-9]+/g, '-')
  // Entferne führende/trailing '-'
  let trimmed = replaced.replace(/^-+|-+$/g, '')
  // Kein doppeltes '-'
  trimmed = trimmed.replace(/-+/g, '-')
  // Darf nicht leer sein
  if (!trimmed) trimmed = 'library'
  // Darf nicht mit Ziffer beginnen
  if (/^[0-9]/.test(trimmed)) trimmed = `lib-${trimmed}`
  // Max-Länge beschränken (z. B. Pinecone Limit ~45)
  if (trimmed.length > 45) trimmed = trimmed.slice(0, 45).replace(/-+$/g, '')
  return trimmed
}

/**
 * Liefert den zu verwendenden Vektor-Indexnamen.
 * Priorität: config.vectorStore.indexOverride → slug(label) → lib-<shortId>
 */
export function getVectorIndexForLibrary(
  library: { id: string; label: string },
  chatConfig?: LibraryChatConfig,
  userEmail?: string
): string {
  console.log('[getVectorIndexForLibrary] Input:', {
    libraryId: library.id,
    libraryLabel: library.label,
    hasConfig: !!chatConfig,
    userEmail: userEmail ? `${userEmail.split('@')[0]}@...` : 'none'
  })
  
  // Globale Override-Möglichkeit für schnelle Fehleranalyse/Dev
  const envOverride = (process.env.PINECONE_INDEX_OVERRIDE || '').trim()
  if (envOverride.length > 0) {
    console.log('[getVectorIndexForLibrary] ⚠️ ENV Override aktiv:', envOverride)
    return envOverride
  }

  const override = chatConfig?.vectorStore?.indexOverride
  console.log('[getVectorIndexForLibrary] Config Override:', override)
  
  const base = (() => {
    if (override && override.trim().length > 0) {
      const slugged = slugifyIndexName(override)
      console.log('[getVectorIndexForLibrary] Verwende indexOverride:', { override, slugged })
      return slugged
    }
    const byLabel = slugifyIndexName(library.label)
    console.log('[getVectorIndexForLibrary] Verwende Label:', { label: library.label, slugged: byLabel })
    if (byLabel) return byLabel
    const shortId = library.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)
    return slugifyIndexName(`lib-${shortId || 'default'}`)
  })()

  if (!userEmail) {
    console.log('[getVectorIndexForLibrary] ✅ Final (ohne Email):', base)
    return base
  }
  const emailSlug = slugifyIndexName(userEmail)
  const final = slugifyIndexName(`${emailSlug}-${base}`)
  console.log('[getVectorIndexForLibrary] ✅ Final (mit Email):', { emailSlug, base, final })
  return final
}


