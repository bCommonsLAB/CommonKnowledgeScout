'use client'

/**
 * @fileoverview Benannte Hinweise auf Reports aus aelteren Scans (W1/A6).
 *
 * @description
 * Aus dem Panel extrahiert (Zeilenbudget): Karten aus Scans vor W1 tragen
 * keine Werkbank-Felder, Karten aus Scans vor A6 keine gepflegten Themen —
 * beides wird SICHTBAR benannt statt still falsch dargestellt
 * (`no-silent-fallbacks.mdc`).
 *
 * @module components/library/agent-view
 */

import type { VorhabenCard } from '@/lib/agent-view/types'
import { karteOhneWerkbankFelder } from '@/lib/agent-view/vorhaben-board'
import type { WerkbankGruppierung } from '@/lib/agent-view/werkbank-gruppen'

export function WerkbankAltReportHinweise({ karten, gruppierung }: {
  karten: readonly VorhabenCard[]
  gruppierung: WerkbankGruppierung
}) {
  return (
    <>
      {karten.some(karteOhneWerkbankFelder) && (
        <p className="text-xs text-muted-foreground">
          Dieser Report stammt aus einem Scan vor Werkbank-Welle W1 — Ampel, Bericht-Titel/-Status und Themen
          erscheinen nach &bdquo;Neu scannen&ldquo;; der Filter &bdquo;Zu tun&ldquo; ist bis dahin nicht auswertbar.
        </p>
      )}
      {gruppierung === 'thema' && karten.some((karte) => karte.gepflegteThemen === undefined) && (
        <p className="text-xs text-muted-foreground">
          Report aus einem Scan vor Welle A6 — die gepflegten Themen (<code>themen:</code> im _INDEX.md)
          erscheinen nach &bdquo;Neu scannen&ldquo;; bis dahin steht hier &bdquo;Ohne Thema&ldquo;.
        </p>
      )}
    </>
  )
}
