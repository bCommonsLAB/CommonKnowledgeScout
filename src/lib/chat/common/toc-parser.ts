import { z } from 'zod'
import type { StoryTopicsData } from '@/types/story-topics'

/**
 * Zod-Schema für StoryQuestion
 */
const storyQuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  intent: z.enum(['what', 'why', 'how', 'compare', 'recommend']).optional(),
  retriever: z.enum(['summary', 'chunk', 'auto']).optional(),
  facets: z.record(z.string(), z.array(z.string())).optional(),
})

/**
 * Zod-Schema für StoryTopic
 */
const storyTopicSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string().optional(),
  questions: z.array(storyQuestionSchema),
})

/**
 * Zod-Schema für StoryTopicsData
 */
const storyTopicsDataSchema = z.object({
  id: z.string(),
  title: z.string(),
  tagline: z.string(),
  intro: z.string(),
  topics: z.array(storyTopicSchema),
})

/**
 * Parst eine LLM-JSON-Antwort und extrahiert StoryTopicsData.
 * 
 * @param raw Raw-Response-String von OpenAI API
 * @returns Geparste StoryTopicsData oder null bei Fehler
 */
export function parseStoryTopicsData(raw: string): StoryTopicsData | null {
  try {
    // Parse OpenAI Response-Struktur
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      console.error('[TOC-Parser] Raw-Response ist kein valides JSON')
      return null
    }
    
    if (!parsed || typeof parsed !== 'object') {
      console.error('[TOC-Parser] Raw-Response ist kein Objekt')
      return null
    }

    // Extrahiere content aus choices[0].message.content (OpenAI-Format)
    const p = parsed as { choices?: Array<{ message?: { content?: unknown } }> }
    let content = p.choices?.[0]?.message?.content
    
    if (!content) {
      // Fallback: Vielleicht ist raw bereits der content-String direkt
      console.log('[TOC-Parser] Kein choices[0].message.content gefunden, versuche raw als content')
      content = raw
    }
    
    if (typeof content !== 'string') {
      console.error('[TOC-Parser] Content ist kein String:', typeof content)
      return null
    }
    
    // Entferne Markdown-Code-Block-Wrapper falls vorhanden
    let contentJsonStr = content.trim()
    if (contentJsonStr.startsWith('```json')) {
      contentJsonStr = contentJsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '')
    } else if (contentJsonStr.startsWith('```')) {
      contentJsonStr = contentJsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '')
    }

    // Versuche content als JSON zu parsen (strukturierte Antwort)
    let contentJson: unknown
    try {
      contentJson = JSON.parse(contentJsonStr)
    } catch (parseError) {
      console.error('[TOC-Parser] Content-JSON-Parse-Fehler:', parseError)
      console.error('[TOC-Parser] Content (erste 500 Zeichen):', contentJsonStr.substring(0, 500))
      return null
    }

    // Validiere gegen Zod-Schema
    const validated = storyTopicsDataSchema.parse(contentJson)
    
    console.log('[TOC-Parser] ✅ StoryTopicsData erfolgreich validiert:', {
      title: validated.title,
      topicsCount: validated.topics.length,
    })
    
    return validated as StoryTopicsData
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[TOC-Parser] Zod-Validierungsfehler:', error.errors)
      console.error('[TOC-Parser] Erste 3 Fehler:', error.errors.slice(0, 3))
    } else {
      console.error('[TOC-Parser] Parse-Fehler:', error)
    }
    return null
  }
}

/**
 * Validiert StoryTopicsData gegen das Schema.
 * 
 * @param data Zu validierende Daten
 * @returns true wenn valide, false sonst
 */
export function validateStoryTopicsData(data: unknown): data is StoryTopicsData {
  try {
    storyTopicsDataSchema.parse(data)
    return true
  } catch {
    return false
  }
}

