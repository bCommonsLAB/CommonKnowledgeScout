/**
 * @fileoverview Built-in „Diktat erfassen“ (audio-transcript-de): Entwurf ohne Secretary/process-text.
 *
 * Der Nutzertext wird 1:1 als Markdown-Body übernommen; Titel wird aus der ersten Zeile abgeleitet.
 */

import { buildCorpusText } from '@/lib/creation/corpus'
import type { WizardSource } from '@/lib/creation/corpus'

function toTimestamp(createdAt: Date | string): number {
  if (createdAt instanceof Date) return createdAt.getTime()
  const t = new Date(createdAt).getTime()
  return Number.isFinite(t) ? t : 0
}

/** Reiner Text aus Text-Quellen (ohne [Quelle: …]-Header), chronologisch. */
export function buildPlainDictationBody(sources: WizardSource[]): string {
  const textSources = sources
    .filter((s): s is WizardSource & { text: string } => s.kind === 'text' && typeof s.text === 'string' && s.text.trim().length > 0)
    .sort((a, b) => toTimestamp(a.createdAt) - toTimestamp(b.createdAt))
  if (textSources.length > 0) {
    return textSources.map((s) => s.text.trim()).join('\n\n')
  }
  return buildCorpusText(sources).trim()
}

/**
 * Standard-Basisname für Diktat-Dateien (ohne .md), z. B. diktat-2026-04-02-14-30-45.
 * Datum + Uhrzeit nur mit Stunde, Minute, Sekunde (keine Millisekunden). Lokalzeit.
 */
export function suggestDictationFileBaseName(now = new Date()): string {
  const y = now.getFullYear()
  const mo = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  return `diktat-${y}-${mo}-${d}-${hh}-${mm}-${ss}`
}

function titleFromBody(body: string): string {
  const first =
    body
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? ''
  const cleaned = first.replace(/^#+\s*/, '').slice(0, 120).trim()
  return cleaned || 'Diktat'
}

/**
 * Metadaten + Markdown für den Wizard, ohne LLM-Aufruf.
 */
export function buildDictationDraftFromSources(sources: WizardSource[]): {
  metadata: Record<string, unknown>
  markdown: string
} | null {
  const body = buildPlainDictationBody(sources).trim()
  if (!body) return null
  const title = titleFromBody(body)
  return {
    metadata: {
      title,
      summary: '',
      filename: suggestDictationFileBaseName(),
    },
    markdown: body,
  }
}
