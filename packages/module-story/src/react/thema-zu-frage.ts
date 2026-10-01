/**
 * Ordnet eine gestellte Frage einem Thema der Gliederung zu — ueber den
 * exakten Fragetext (die Themen-Fragen werden per Klick unveraendert
 * uebernommen). Selbst getippte Fragen haben kein Thema: `null`, ohne Raten.
 */

import type { StoryTopicsData } from '@ks/contracts'

function normalisiert(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function themaZuFrage(gliederung: StoryTopicsData | null, frage: string): string | null {
  if (!gliederung) return null
  const gesucht = normalisiert(frage)
  if (gesucht === '') return null
  for (const thema of gliederung.topics) {
    if (thema.questions.some((q) => normalisiert(q.text) === gesucht)) return thema.id
  }
  return null
}
