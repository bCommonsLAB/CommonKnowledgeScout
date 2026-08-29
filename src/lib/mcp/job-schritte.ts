/**
 * @fileoverview Job-Schritte fuer die Bruecke lesbar machen (Welle ST11).
 *
 * @description
 * Befund 29.08.2026 (Cowork, Ordner „24.09 KnowledgeScout"): Zehn Jobs
 * meldeten completed und schrieben nichts — das Extract-Gate hatte alle
 * Schritte uebersprungen (Alt-Familien mit Transformation OHNE Transkript,
 * die Gate-Annahme „Transformation impliziert Transkript" griff). In MongoDB
 * stand die Wahrheit (`steps[].details.skipped` + Grund), aber `job_status`
 * warf `details` beim Mappen weg — uebersprungen und gearbeitet sahen ueber
 * die Bruecke identisch aus. Dieses Modul reicht beides durch: je Schritt
 * `uebersprungen`/`grund`, und fuer den Komplett-Skip einen Klartext-Hinweis.
 *
 * @module mcp
 */

import type { ExternalJobStep } from '@/types/external-job'

export interface SchrittZeile {
  name: string
  status: ExternalJobStep['status']
  dauerMs?: number
  uebersprungen?: true
  grund?: string
}

/** True, wenn der Schritt laut seinen Details uebersprungen wurde. */
export function istUebersprungen(step: ExternalJobStep): boolean {
  return step.details?.skipped === true
}

/** Grund des Skips (z. B. `shadow_twin_exists`), wenn ausgewiesen. */
function skipGrund(step: ExternalJobStep): string | undefined {
  const grund = step.details?.reason
  return typeof grund === 'string' && grund.trim().length > 0 ? grund : undefined
}

/** Schritte fuer die Bruecken-Antwort — Skips bleiben sichtbar. */
export function beschreibeSchritte(steps: ExternalJobStep[] | undefined): SchrittZeile[] {
  return (steps ?? []).map((step) => ({
    name: step.name,
    status: step.status,
    ...(step.durationMs !== undefined ? { dauerMs: step.durationMs } : {}),
    ...(istUebersprungen(step)
      ? { uebersprungen: true as const, ...(skipGrund(step) ? { grund: skipGrund(step) } : {}) }
      : {}),
  }))
}

/**
 * Klartext fuer einen completed-Job, der NICHTS getan hat: alle Schritte
 * uebersprungen. Ohne diesen Satz liest ein Aufrufer „completed" als „hat
 * geschrieben" — genau die Fehldeutung aus dem Befund.
 */
export function uebersprungenHinweis(args: {
  status: string
  steps: ExternalJobStep[] | undefined
}): string | undefined {
  if (args.status !== 'completed') return undefined
  const steps = args.steps ?? []
  if (steps.length === 0) return undefined
  if (!steps.every(istUebersprungen)) return undefined
  return (
    'Dieser Job hat NICHTS geschrieben: alle Schritte wurden uebersprungen, weil vorhandene ' +
    'Artefakte die Arbeit ueberfluessig erscheinen liessen (Gate). Fehlt trotzdem ein Artefakt ' +
    '(z. B. Transkript bei vorhandener Transformation), den Job mit erzwingen=true neu starten ' +
    '(quelle_erschliessen).'
  )
}
