/**
 * Auftrag der Themen-Sektion an die Story-Sektion der Website (18.11.2026):
 * eine gewaehlte Frage, die oben im Frage-Kasten gestellt werden soll. Die
 * Story-Sektion liest ihn und setzt ihn sofort auf `null` zurueck — ein
 * spaeteres Neumontieren stellt die Frage nicht ein zweites Mal.
 * Ablauf: `packages/module-website/src/story-frage-auftrag.ts`.
 */

import { atom } from 'jotai'
import type { StoryFrageAuftrag } from '..'

export const websiteStoryFrageAtom = atom<StoryFrageAuftrag | null>(null)
