/**
 * @fileoverview Auftrags-Generator (Welle 3, Projektauftrag F3).
 *
 * @description
 * Aus markierten Luecken entsteht EIN kopierfertiger Auftragstext fuer eine
 * Cowork-Session: Kontextkopf (Library, Pfade, Pflichtlektuere), eine
 * Aufgabenzeile je Luecke (Vorlagen-Registry), Abschlusskriterium („danach
 * verschwinden die Gaps im naechsten Scan") und der
 * Konsistenz-Rueckmeldungsblock — die Gegenkontrolle der doppelten
 * Buchhaltung wird Standard, nicht Sonderfall.
 *
 * Ausgabe in v1: Clipboard only — keine `auftraege/`-Dateien, keine
 * API-Kopplung (der Transport ist bewusst Copy-Paste; Welle 5/MCP ersetzt ihn).
 *
 * Reine Funktionen, kein I/O.
 *
 * @module agent-view
 */

import { renderAuftragZeile } from './auftrag-templates'
import { GAP_REGISTRY } from './gap-registry'
import { zyklusSchrittLabel } from './labels'
import type { CoverageGap } from './types'

export interface AuftragContext {
  /** Anzeigename der Library. */
  libraryLabel: string
  /**
   * Lokaler Wurzelpfad des Archivs (`config.agentView.localRootPath`).
   * Gesetzt → absolute Pfade; leer/null → archiv-relative Pfade.
   */
  localRootPath: string | null
  /** Zeitstempel des zugrunde liegenden Scans (Report `generatedAt`). */
  generatedAt: string
}

/**
 * Rendert einen archiv-relativen Pfad fuer den Auftragstext. Mit
 * `localRootPath` entsteht ein absoluter Pfad im Trennzeichen-Stil der
 * Wurzel (Backslash-Wurzel ⇒ Backslash-Pfad).
 */
export function renderAuftragPfad(relPath: string, localRootPath: string | null): string {
  const rel = relPath.trim() === '' ? '' : relPath
  if (!localRootPath || localRootPath.trim() === '') return rel === '' ? '(Archiv-Wurzel)' : rel
  const root = localRootPath.trim().replace(/[\\/]+$/, '')
  if (rel === '') return root
  const separator = root.includes('\\') ? '\\' : '/'
  return `${root}${separator}${rel.split('/').join(separator)}`
}

/** Deterministische Kennung eines Befunds im Abschlusskriterium. */
function gapKennung(gap: CoverageGap): string {
  return `${gap.type} @ ${gap.path || gap.targetName}`
}

/** Baut den vollstaendigen, kopierfertigen Auftragstext. */
export function buildAuftrag(gaps: readonly CoverageGap[], context: AuftragContext): string {
  if (gaps.length === 0) throw new Error('Auftrag ohne Luecken — erst Befunde auswaehlen.')

  const pfade = [...new Set(gaps.map((gap) => renderAuftragPfad(gap.path, context.localRootPath)))]
  const schritte = [...new Set(gaps.map((gap) => gap.zyklusSchritt))].sort((a, b) => a - b)

  const zeilen = gaps.map((gap, index) => {
    const pfad = renderAuftragPfad(gap.path, context.localRootPath)
    return `${index + 1}. [${GAP_REGISTRY[gap.type].label}] ${renderAuftragZeile(gap, pfad)}`
  })

  return [
    `# Cowork-Auftrag: ${context.libraryLabel}`,
    '',
    `Grundlage: Coverage-Scan vom ${context.generatedAt} (Agentensicht).`,
    `Zyklus-Schritte: ${schritte.map((schritt) => zyklusSchrittLabel(schritt)).join('; ')}.`,
    '',
    '## Pflichtlektuere (vor der Arbeit lesen)',
    '',
    '- `Konventionen.md` im Archiv (Ordnung, Namensregeln, Berichtspflicht)',
    '- Twin-Datei-Contract: Discovery `_X.pdf/`, fuehrendes Artefakt, Lese-',
    '  und Korrektur-Ordnung (Transformation fuehrt, Transkript belegt)',
    '',
    '## Betroffene Pfade',
    '',
    ...pfade.map((pfad) => `- ${pfad}`),
    '',
    '## Aufgaben',
    '',
    ...zeilen,
    '',
    '## Abschlusskriterium',
    '',
    'Danach verschwinden im naechsten Scan der Agentensicht diese Befunde:',
    ...gaps.map((gap) => `- ${gapKennung(gap)}`),
    '',
    '## Konsistenz-Rueckmeldung (Pflicht)',
    '',
    'Melde am Ende zurueck, wo deine Sicht der Dateien dieser Coverage',
    'widerspricht: Befunde, die du nicht nachvollziehen kannst; Luecken, die',
    'der Scan uebersehen hat; Staende, die anders erklaert sind, als die',
    'Dateien zeigen. Die Gegenkontrolle ist Teil des Auftrags, kein Extra.',
  ].join('\n')
}
