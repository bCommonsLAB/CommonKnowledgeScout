/**
 * Welle N1 (Plan website-story-sektion): reine Helfer der Story-Sektion.
 *
 * Eine Story-Sektion traegt ihren Markdown als Blockfolge; der Block
 * `questions` teilt sie in das, was UEBER der Eingabe steht (Ueberschrift,
 * Absatz), die Beispielfragen und das, was UNTER der Eingabe steht
 * (Vertrauenszeile). Ohne `questions`-Block gibt es nur die Eingabe.
 */

import type { SectionContentBlock } from './parse-section-blocks'
import type { WebsiteSection } from './types'

export interface StoryBloecke {
  /** Bloecke vor `<!-- questions -->` — ueber der Eingabe. */
  vor: SectionContentBlock[]
  /** Die Beispielfragen; leer ohne Block. */
  fragen: string[]
  /** Bloecke nach dem Fragen-Block — unter der Eingabe. */
  nach: SectionContentBlock[]
}

export function storyBloecke(section: WebsiteSection): StoryBloecke {
  if (section.layout !== 'story') {
    throw new Error(`storyBloecke: Sektion hat layout=${section.layout}, erwartet story`)
  }
  const idx = section.blocks.findIndex((b) => b.type === 'questions')
  if (idx === -1) return { vor: section.blocks, fragen: [], nach: [] }
  const block = section.blocks[idx]
  return {
    vor: section.blocks.slice(0, idx),
    fragen: block.type === 'questions' ? block.items : [],
    nach: section.blocks.slice(idx + 1),
  }
}

/** Hat der Body eine Story-Sektion? Fuer Pruefung und Gastgeber (Live-Seite montiert dann den Chat). */
export function hatStorySektion(sections: WebsiteSection[]): boolean {
  return sections.some((s) => s.layout === 'story')
}

/**
 * Welle N1: der Block `questions` gehoert in eine Story-Sektion, und davon
 * gibt es hoechstens eine je Seite — zwei Instanzen teilten sich Sitzung und
 * Story-Zustand und ueberschrieben einander. Kein stiller Fallback.
 */
export function pruefeStorySektionen(sections: WebsiteSection[]): void {
  const storys = sections.filter((s) => s.layout === 'story')
  if (storys.length > 1) {
    throw new Error(`Hoechstens eine Sektion layout=story je Seite erlaubt (hier: ${storys.length})`)
  }
  for (const s of sections) {
    if (s.layout !== 'story' && s.blocks.some((b) => b.type === 'questions')) {
      throw new Error(`<!-- questions --> ist nur in einer Sektion layout=story erlaubt (hier: ${s.layout})`)
    }
  }
}
