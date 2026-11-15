'use client'

/**
 * @fileoverview Kopf des Sitzungs-Details: Ort, Titel, Kennzeichen, Stand als Schritte (Register, Welle R3).
 *
 * @description
 * Figma „Titel" und „Stand": Pfad des Vorhabens (Sprung in die Werkbank),
 * Titel, Kennzeichen (Zeitraum, Werkzeug, Repo, Branch, Link, PRs) und der
 * gerechnete Stand als Schritte Gemeldet → Beleg → Notiz → Im Bericht. Erledigt
 * = gruen mit Haken, der naechste offene Schritt orange, spaetere leer.
 *
 * @module components/library/agent-view/sitzungen
 */

import type { ReactNode } from 'react'
import { Check, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { QUELLE_NAMEN, zeitraumText } from '@/lib/agent-view/sitzungen-register/reiter-texte'
import type { SitzungsSicht } from '@/lib/agent-view/sitzungen-register/types'

function Kennzeichen({ children, mono = false, href }: { children: ReactNode; mono?: boolean; href?: string }) {
  const klasse = cn('inline-flex max-w-full items-center gap-1 truncate rounded-md bg-muted px-2 py-[3px] text-xs text-foreground/80', mono && 'font-mono')
  if (href === undefined) return <span className={klasse}>{children}</span>
  return (
    <a href={href} target="_blank" rel="noreferrer" className={cn(klasse, 'hover:underline')}>
      {children} <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
    </a>
  )
}

function OrtZeile({ zeile, onZurWerkbank }: { zeile: SitzungsSicht; onZurWerkbank: (folderId: string) => void }) {
  if (zeile.vorhabenPfad !== null) {
    const text = zeile.vorhabenPfad.split('/').join(' / ')
    if (zeile.vorhabenFolderId === null) return <span>{text}</span>
    const folderId = zeile.vorhabenFolderId
    return (
      <button type="button" onClick={() => onZurWerkbank(folderId)} className="truncate text-left hover:underline" title="Vorhaben in der Werkbank öffnen">
        {text}
      </button>
    )
  }
  if (zeile.vorhabenBestimmt) return <span>{(zeile.belegOrdnerPfad ?? 'Ordner unbekannt').split('/').join(' / ')} · kein Vorhaben</span>
  const vorschlag = zeile.vorhabenVorschlag !== null ? ` · Vorschlag: ${zeile.vorhabenVorschlag.ordner}` : ''
  return <span>Vorhaben noch nicht bestimmt{vorschlag}</span>
}

function prName(pr: string): string {
  const nr = pr.match(/(?:pull\/|#)(\d+)$/)
  return nr ? `PR #${nr[1]}` : pr
}

export function StandSchritte({ zeile }: { zeile: SitzungsSicht }) {
  const halb = !zeile.imBericht && zeile.berichtet.chronikAm !== null
  const schritte = [
    { name: 'Gemeldet', da: true, titel: 'Die Sitzung steht im Register' },
    { name: 'Beleg', da: zeile.belege.length > 0, titel: 'Gesprächsverlauf beim Vorhaben' },
    { name: 'Notiz', da: zeile.belege.some((b) => b.notiz), titel: 'Transformation chatverlauf-de' },
    { name: 'Im Bericht', da: zeile.imBericht, titel: halb ? 'Chronik ja, Block im BERICHT.md fehlt' : 'Chronik SITZUNGEN.md und Block im BERICHT.md' },
  ]
  const naechster = schritte.findIndex((s) => !s.da)
  return (
    <ol className="flex flex-wrap items-center gap-1.5" aria-label="Stand">
      {schritte.map((s, i) => (
        <li key={s.name} className="flex items-center gap-1.5">
          {i > 0 && <span className="h-px w-4 bg-border" aria-hidden />}
          <span
            title={s.titel}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[5px] text-xs font-medium',
              s.da && 'border-transparent bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400',
              !s.da && i === naechster && 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-500/50 dark:bg-orange-500/10 dark:text-orange-400',
              !s.da && i !== naechster && 'text-muted-foreground',
            )}
          >
            {s.da && <Check className="h-[13px] w-[13px]" aria-hidden />}
            {s.name}
          </span>
        </li>
      ))}
      {zeile.stand === 'uebersprungen' && (
        <li className="ml-1 rounded-full bg-muted px-2.5 py-[5px] text-xs font-medium text-muted-foreground">übersprungen</li>
      )}
    </ol>
  )
}

export function SitzungKopf({ zeile, onZurWerkbank }: { zeile: SitzungsSicht; onZurWerkbank: (folderId: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="truncate text-xs text-muted-foreground">
        <OrtZeile zeile={zeile} onZurWerkbank={onZurWerkbank} />
      </p>
      <h2 className="text-[19px] font-semibold leading-tight">{zeile.titel}</h2>
      <div className="flex flex-wrap items-center gap-1.5">
        <Kennzeichen>{zeitraumText(zeile.beginn, zeile.ende)}</Kennzeichen>
        <Kennzeichen>{QUELLE_NAMEN[zeile.quelle ?? 'unbekannt']}</Kennzeichen>
        {zeile.repo !== null && <Kennzeichen>{zeile.repo}</Kennzeichen>}
        {zeile.branch !== null && <Kennzeichen mono>{zeile.branch}</Kennzeichen>}
        {zeile.link !== null && <Kennzeichen href={zeile.link}>Sitzung</Kennzeichen>}
        {zeile.prs.map((pr) => (
          <Kennzeichen key={pr} href={pr.startsWith('https://') ? pr : undefined}>{prName(pr)}</Kennzeichen>
        ))}
      </div>
    </div>
  )
}
