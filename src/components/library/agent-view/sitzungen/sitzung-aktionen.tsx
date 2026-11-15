'use client'

/**
 * @fileoverview Knopfzeile einer Sitzung (Register, Welle R3).
 *
 * @description
 * Figma „Aktionen (eine Zeile, bricht nie um)": Überspringen (mit Grund),
 * Vorhaben vorschlagen, In Teile trennen (Zugbereiche), Beleg öffnen. Wird
 * es eng, bleibt nur das Symbol, der Text steht im Tooltip (Container-Query
 * auf die Breite des Details, nicht des Fensters). Den Stand setzt niemand —
 * er wird aus Beleg und Notiz gerechnet.
 *
 * @module components/library/agent-view/sitzungen
 */

import { Ban, ExternalLink, Folder, RotateCcw, Scissors, type LucideIcon } from 'lucide-react'
import { Button, Tooltip, TooltipContent, TooltipTrigger } from '@ks/ui'
import { archivDateiHref } from '@/lib/agent-view/sitzungen-register/reiter-texte'
import type { SitzungsSicht } from '@/lib/agent-view/sitzungen-register/types'

interface KnopfArgs {
  symbol: LucideIcon
  text: string
  hilfe: string
  onClick?: () => void
  href?: string
  aus?: boolean
}

function Knopf({ symbol: Symbol, text, hilfe, onClick, href, aus = false }: KnopfArgs) {
  const inhalt = (
    <>
      <Symbol className="h-[15px] w-[15px] shrink-0" aria-hidden />
      <span className="hidden @[660px]:inline">{text}</span>
    </>
  )
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {href !== undefined && !aus ? (
          <Button variant="outline" className="shrink-0 gap-2 px-3.5 text-[13px]" asChild>
            <a href={href} aria-label={text}>{inhalt}</a>
          </Button>
        ) : (
          <Button variant="outline" className="shrink-0 gap-2 px-3.5 text-[13px]" onClick={onClick} disabled={aus} aria-label={text}>
            {inhalt}
          </Button>
        )}
      </TooltipTrigger>
      <TooltipContent>{hilfe}</TooltipContent>
    </Tooltip>
  )
}

export function SitzungAktionen({
  zeile,
  libraryId,
  speichert,
  onUeberspringen,
  onNichtUeberspringen,
  onVorschlagen,
  onTrennen,
}: {
  zeile: SitzungsSicht
  libraryId: string
  speichert: boolean
  onUeberspringen: () => void
  onNichtUeberspringen: () => void
  onVorschlagen: () => void
  onTrennen: () => void
}) {
  const beleg = zeile.belege[0]
  const uebersprungen = zeile.entscheidung === 'ueberspringen'
  return (
    <div className="flex w-full shrink-0 flex-nowrap items-center gap-2 overflow-hidden">
      {uebersprungen ? (
        <Knopf symbol={RotateCcw} text="Nicht mehr überspringen" hilfe="Entscheidung zurück auf offen" onClick={onNichtUeberspringen} aus={speichert} />
      ) : (
        <Knopf symbol={Ban} text="Überspringen …" hilfe="Sitzung ohne Substanz: überspringen, mit Grund" onClick={onUeberspringen} aus={speichert} />
      )}
      <Knopf symbol={Folder} text="Vorhaben vorschlagen" hilfe="Vorschlag merken — verschiebt nichts" onClick={onVorschlagen} aus={speichert} />
      <Knopf
        symbol={Scissors}
        text={zeile.entscheidung === 'trennen' ? 'Teile ändern …' : 'In Teile trennen …'}
        hilfe="Züge auf mehrere Vorhaben aufteilen (Zugbereiche)"
        onClick={onTrennen}
        aus={speichert}
      />
      <Knopf
        symbol={ExternalLink}
        text="Beleg öffnen"
        hilfe={beleg !== undefined ? `${beleg.name} im Archiv öffnen` : 'Noch kein Beleg'}
        href={beleg !== undefined ? archivDateiHref(libraryId, beleg.parentId, beleg.sourceId) : undefined}
        aus={beleg === undefined}
      />
    </div>
  )
}
