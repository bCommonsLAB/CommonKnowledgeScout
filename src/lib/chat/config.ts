/**
 * @fileoverview Chat Configuration - Configuration Normalization and Validation
 * 
 * @description
 * Provides Zod schemas and normalization functions for chat configuration.
 * Validates and normalizes library chat configuration with defaults. Handles
 * vector index name derivation and configuration merging.
 * 
 * @module chat
 * 
 * @exports
 * - chatConfigSchema: Zod schema for chat configuration
 * - NormalizedChatConfig: Normalized chat configuration type
 * - normalizeChatConfig: Function to normalize chat configuration
 * - getVectorIndexForLibrary: Function to get vector index name for library
 * 
 * @usedIn
 * - src/lib/chat/loader.ts: Loader uses config normalization
 * - src/lib/chat/orchestrator.ts: Orchestrator uses normalized config
 * - src/app/api/chat: API routes use config validation
 * 
 * @dependencies
 * - zod: Schema validation library
 * - @/types/library: LibraryChatConfig type
 * - @/lib/chat/constants: Chat constants for defaults
 */

import * as z from 'zod'
import { LibraryChatConfig } from '@/types/library'
import {
  TARGET_LANGUAGE_ZOD_ENUM,
  TARGET_LANGUAGE_DEFAULT,
  CHARACTER_ARRAY_ZOD_SCHEMA,
  CHARACTER_DEFAULT,
  ACCESS_PERSPECTIVE_ARRAY_ZOD_SCHEMA,
  ACCESS_PERSPECTIVE_DEFAULT,
  SOCIAL_CONTEXT_ZOD_ENUM,
  SOCIAL_CONTEXT_DEFAULT,
  GENDER_INCLUSIVE_DEFAULT,
  normalizeCharacterToArray,
  normalizeAccessPerspectiveToArray,
} from './constants'

/**
 * Zod-Schema für Chat-Konfiguration mit Defaults.
 * Achtung: Keine Secrets hier speichern.
 */
export const chatConfigSchema = z.object({
  placeholder: z.string().default('Schreibe deine Frage...'),
  maxChars: z.number().int().positive().max(4000).default(500),
  maxCharsWarningMessage: z.string().default('Deine Frage ist zu lang, bitte kürze sie.'),
  footerText: z.string().default(''),
  companyLink: z.string().url().optional(),
  vectorStore: z.object({
    indexOverride: z.string().min(1).optional(),
  }).default({}),
  // Zielsprache für Chat-Antworten
  targetLanguage: TARGET_LANGUAGE_ZOD_ENUM.default(TARGET_LANGUAGE_DEFAULT),
  // Charakter/Profil für die Antwort-Perspektive (Array mit max. 3 Werten)
  // Unterstützt sowohl Single-Value (wird zu Array konvertiert) als auch Array
  character: CHARACTER_ARRAY_ZOD_SCHEMA.default(CHARACTER_DEFAULT),
  // Zugangsperspektive (Array mit max. 3 Werten)
  // Unterstützt sowohl Single-Value (wird zu Array konvertiert) als auch Array
  accessPerspective: ACCESS_PERSPECTIVE_ARRAY_ZOD_SCHEMA.default(ACCESS_PERSPECTIVE_DEFAULT),
  // Sozialer Kontext/Sprachebene
  socialContext: SOCIAL_CONTEXT_ZOD_ENUM.default(SOCIAL_CONTEXT_DEFAULT),
  // Gendergerechte Formulierung
  genderInclusive: z.boolean().default(GENDER_INCLUSIVE_DEFAULT),
  userPreferences: z.object({
    targetLanguage: TARGET_LANGUAGE_ZOD_ENUM.optional(),
    // userPreferences.character kann auch Single-Value oder Array sein
    character: CHARACTER_ARRAY_ZOD_SCHEMA.optional(),
    // userPreferences.accessPerspective kann auch Single-Value oder Array sein
    accessPerspective: ACCESS_PERSPECTIVE_ARRAY_ZOD_SCHEMA.optional(),
    socialContext: SOCIAL_CONTEXT_ZOD_ENUM.optional(),
    genderInclusive: z.boolean().optional(),
  }).optional(),
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
  // Tolerantes Normalisieren: Strings (JSON) akzeptieren
  let cfg: unknown = config
  if (typeof cfg === 'string') {
    try { cfg = JSON.parse(cfg) as unknown } catch { cfg = {} }
  }
  
  // Migration: gallery.facets als Array<string> → Array<{metaKey,...}>
  if (cfg && typeof cfg === 'object') {
    const c = cfg as { 
      gallery?: { facets?: unknown }
      character?: unknown
      userPreferences?: { character?: unknown }
    }
    
    // Gallery facets migration
    const raw = c?.gallery?.facets
    if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] !== 'object') {
      const mapped = (raw as unknown[]).map(v => {
        const k = typeof v === 'string' ? v : String(v)
        if (!k) return null
        return { metaKey: k, label: k, type: 'string', multi: true, visible: true }
      }).filter(Boolean) as Array<unknown>
      if (c.gallery) c.gallery.facets = mapped
    }
    
    // Character normalisieren: Single-Value zu Array konvertieren
    if (c.character !== undefined) {
      c.character = normalizeCharacterToArray(c.character)
    }
    
    // AccessPerspective normalisieren: Single-Value zu Array konvertieren
    if ((c as { accessPerspective?: unknown }).accessPerspective !== undefined) {
      (c as { accessPerspective: unknown }).accessPerspective = normalizeAccessPerspectiveToArray((c as { accessPerspective: unknown }).accessPerspective)
    }
    
    // userPreferences.character normalisieren
    if (c.userPreferences?.character !== undefined) {
      c.userPreferences.character = normalizeCharacterToArray(c.userPreferences.character)
    }
    
    // userPreferences.accessPerspective normalisieren
    if ((c.userPreferences as { accessPerspective?: unknown } | undefined)?.accessPerspective !== undefined) {
      (c.userPreferences as { accessPerspective: unknown }).accessPerspective = normalizeAccessPerspectiveToArray((c.userPreferences as { accessPerspective: unknown }).accessPerspective)
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
  // Globale Override-Möglichkeit für schnelle Fehleranalyse/Dev
  const envOverride = (process.env.PINECONE_INDEX_OVERRIDE || '').trim()
  if (envOverride.length > 0) {
    console.log('[getVectorIndexForLibrary] ⚠️ ENV Override aktiv:', envOverride)
    return envOverride
  }

  const override = chatConfig?.vectorStore?.indexOverride
  
  // Wenn indexOverride gesetzt ist, verwende diesen direkt (kann bereits vollständigen Index-Namen enthalten)
  if (override && override.trim().length > 0) {
    return slugifyIndexName(override)
  }
  
  // Sonst: Basis aus Label berechnen
  const base = (() => {
    const byLabel = slugifyIndexName(library.label)
    if (byLabel) return byLabel
    const shortId = library.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)
    return slugifyIndexName(`lib-${shortId || 'default'}`)
  })()

  // Wenn keine Email vorhanden ist, verwende nur die Basis
  if (!userEmail) {
    return base
  }
  
  // Mit Email: Präfix hinzufügen
  const emailSlug = slugifyIndexName(userEmail)
  return slugifyIndexName(`${emailSlug}-${base}`)
}


