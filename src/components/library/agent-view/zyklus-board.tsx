'use client'

/**
 * @fileoverview Zyklus-Board (F1b): Soll/Ist je Vorhaben in fuenf Spalten.
 *
 * @description
 * Jede Karte zeigt den ERKLAERTEN Stand (Soll-Buch) neben dem BERECHNETEN
 * Befund (Ist-Buch). Faellt ein Vorhaben hinter seinen Stand zurueck, wechselt
 * die Karte sichtbar in den Widerspruchszustand — „abgenommen, aber nicht mehr
 * aktuell" —, ohne dass eine Datei angefasst wird. Seit W4 navigiert ein
 * Klick auf die Karte ins Werkbank-Detail (`?tab=werkbank&vorhaben=…`, §F6);
 * das Board selbst bleibt sonst unveraendert.
 *
 * @module components/library/agent-view
 */

import { AlertTriangle, FileText } from 'lucide-react'
import { parseAsString, useQueryState } from 'nuqs'
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@ks/ui'
import { actorSummary, BOARD_COLUMNS, gapCountLabel, standLabel } from '@/lib/agent-view/labels'
import { karteOhneWerkbankFelder } from '@/lib/agent-view/vorhaben-board'
import type { CoverageReport, VorhabenCard } from '@/lib/agent-view/types'

function VorhabenKarte({ card, onOpen }: { card: VorhabenCard; onOpen: (folderId: string) => void }) {
  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={`${card.name} im Werkbank-Detail oeffnen`}
      onClick={() => onOpen(card.folderId)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onOpen(card.folderId)
      }}
      className={`cursor-pointer hover:border-primary/50 ${card.widerspruch ? 'border-red-500/60' : ''}`}
    >
      <CardHeader className="p-3 pb-1">
        <CardTitle className="flex items-start gap-1.5 text-sm">
          {card.widerspruch && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden />}
          <span className="break-words">{card.name}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 p-3 pt-0 text-xs text-muted-foreground">
        <p className="break-words">{card.path || '(Wurzel)'}</p>
        {/* Werkbank W1 (F9): Bericht-Titel + erklaerter Status aus der Karte. */}
        {typeof card.berichtTitel === 'string' && card.berichtTitel !== '' && (
          <p className="break-words font-medium text-foreground">{card.berichtTitel}</p>
        )}
        {typeof card.berichtStatus === 'string' && <p>Status: {card.berichtStatus}</p>}
        {card.widerspruch && (
          <p className="font-medium text-red-500">
            {standLabel(card.bearbeitungsstand)}, aber nicht mehr aktuell
          </p>
        )}
        <p>{gapCountLabel(card.totalGaps)} · {actorSummary(card.gapsByActor)}</p>
        <p className="flex items-center gap-1">
          {card.hasBericht ? <FileText className="h-3 w-3" aria-hidden /> : null}
          {card.hasBericht ? 'BERICHT.md vorhanden' : 'ohne BERICHT.md'}
          {card.bearbeitungsstandSeit && <span> · seit {card.bearbeitungsstandSeit.slice(0, 10)}</span>}
        </p>
      </CardContent>
    </Card>
  )
}

export function ZyklusBoard({ report }: { report: CoverageReport }) {
  const [, setTab] = useQueryState('tab', parseAsString)
  const [, setVorhaben] = useQueryState('vorhaben', parseAsString)
  const openVorhaben = (folderId: string) => {
    void setTab('werkbank')
    void setVorhaben(folderId)
  }

  if (report.vorhaben.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Kein Vorhaben erkannt. Vorhaben sind Ordner mit `bearbeitungsstand` im `_INDEX.md` oder Ordner,
        die auf das konfigurierte Vorhaben-Muster der Library passen.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {/* Alte Reports tragen die W1-Felder nicht — benennen statt Luecke (Muster „Scan vor Welle 4"). */}
      {report.vorhaben.some(karteOhneWerkbankFelder) && (
        <p className="text-xs text-muted-foreground">
          Dieser Report stammt aus einem Scan vor Werkbank-Welle W1 — Bericht-Titel, -Status und
          Themen erscheinen nach &bdquo;Neu scannen&ldquo;.
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {BOARD_COLUMNS.map((stand) => {
          const cards = report.vorhaben.filter((card) => card.bearbeitungsstand === stand)
          return (
            <section key={stand ?? 'undeklariert'} className="space-y-2">
              <header className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">{standLabel(stand)}</h3>
                <Badge variant="secondary">{cards.length}</Badge>
              </header>
              {cards.map((card) => (
                <VorhabenKarte key={card.folderId} card={card} onOpen={openVorhaben} />
              ))}
            </section>
          )
        })}
      </div>
    </div>
  )
}
