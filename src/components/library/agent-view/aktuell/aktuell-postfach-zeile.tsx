'use client'

/**
 * @fileoverview Verdichteter Postfach-Stand über der Tabelle (Welle A7b).
 *
 * @description
 * Ersetzt die 16 wortgleichen Zeilen an den Vorhaben durch EINE Angabe:
 * bis wann ausgewertet ist, wie viele Vorhaben je Woche, und — der
 * eigentliche Befund — wie viele gar kein `postfach_bis` führen. Im
 * Live-Bild vom 06.09.2026 fehlte das Feld ausgerechnet beim einzigen
 * überfälligen Vorhaben (AECED); durch das Fehlen einer Zeile war das
 * praktisch unsichtbar. Eine Lücke muss man zählen, nicht suchen.
 *
 * @module components/library/agent-view
 */

import { Mail } from 'lucide-react'
import type { PostfachUebersicht } from '@/lib/agent-view/aktuell-sicht'

export interface AktuellPostfachZeileProps {
  uebersicht: PostfachUebersicht
  /** Aktive Vorhaben insgesamt — ohne Bezug sagen die Zahlen wenig. */
  aktivGesamt: number
}

export function AktuellPostfachZeile({ uebersicht, aktivGesamt }: AktuellPostfachZeileProps) {
  const { staende, ohneAngabe, unlesbar } = uebersicht
  // Führt keine einzige aktive Karte das Feld, ist die Korrespondenz-Methode
  // für diese Bibliothek schlicht nicht in Gebrauch — dann auch kein Hinweis.
  if (staende.length === 0 && unlesbar === 0) return null

  const teile: string[] = staende.map(({ label, anzahl }) =>
    anzahl === 1 ? label : `${label} (${String(anzahl)}×)`,
  )

  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
      <Mail className="h-3 w-3 shrink-0" aria-hidden />
      <span className="font-medium text-foreground">Postfach ausgewertet bis:</span>
      <span>{teile.join(' · ')}</span>
      {unlesbar > 0 && (
        <span className="text-amber-600 dark:text-amber-500">
          · {unlesbar} unlesbar
        </span>
      )}
      {ohneAngabe > 0 && (
        <span title="Diese Vorhaben führen kein postfach_bis — für sie ist nicht feststellbar, ob E-Mails offen sind.">
          · {ohneAngabe} von {aktivGesamt} ohne Angabe
        </span>
      )}
    </p>
  )
}
