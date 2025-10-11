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
  gallery: z.object({
    facets: z.array(z.enum(['authors','year','region','docType','source','tags'])).default(['authors','year','region','docType','source','tags'])
  }).default({ facets: ['authors','year','region','docType','source','tags'] }),
})

export type NormalizedChatConfig = z.infer<typeof chatConfigSchema>

/**
 * Validiert und setzt Defaults für die Chat-Konfiguration.
 */
export function normalizeChatConfig(config: unknown): NormalizedChatConfig {
  return chatConfigSchema.parse(config ?? {})
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
  // Globale Override-Möglichkeit für schnelle Fehleranalyse/Dev
  const envOverride = (process.env.PINECONE_INDEX_OVERRIDE || '').trim()
  if (envOverride.length > 0) return envOverride

  const override = chatConfig?.vectorStore?.indexOverride
  const base = (() => {
    if (override && override.trim().length > 0) return slugifyIndexName(override)
    const byLabel = slugifyIndexName(library.label)
    if (byLabel) return byLabel
    const shortId = library.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)
    return slugifyIndexName(`lib-${shortId || 'default'}`)
  })()

  if (!userEmail) return base
  const emailSlug = slugifyIndexName(userEmail)
  return slugifyIndexName(`${emailSlug}-${base}`)
}


