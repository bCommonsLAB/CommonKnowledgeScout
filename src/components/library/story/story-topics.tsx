'use client'

/**
 * Shim: Re-Exportiert StoryTopics und StoryTopicsProps
 * aus dem Submodul story-topics/.
 *
 * Konsumenten koennen weiterhin diesen Pfad importieren:
 *   import { StoryTopics } from '@/components/library/story/story-topics'
 *
 * Welle 3-III-c: Modul-Split — alle Implementierungsdetails liegen in:
 *   story-topics/index.tsx       (Composer)
 *   story-topics/topic-list.tsx  (Accordion-Liste aller Topics)
 *   story-topics/topic-card.tsx  (Einzelnes Topic mit Fragen-Buttons)
 */

export type { StoryTopicsProps } from './story-topics/index'
export { StoryTopics } from './story-topics/index'
