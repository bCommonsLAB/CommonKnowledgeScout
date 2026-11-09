/**
 * @fileoverview Eine Zeile der Verwaltungssicht „Fragen & Antworten", aufklappbar.
 *
 * @description
 * Zeigt Frage, Datum, Sprache, Modell, Quellen, Facetten und den Stand
 * (aktuell / veraltet / verworfen). Aufgeklappt lädt sie den Eintrag auf
 * Abruf (GET queries/[queryId]) und zeigt Antwort und Quellen. „Antwort
 * verwerfen" fragt nach; gelöscht wird hier nichts.
 *
 * @module settings
 */

"use client"

import { useState } from 'react'
import { Badge, Button, TableCell, TableRow } from '@ks/ui'
import { ChevronDown, ChevronRight, Loader2, Ban } from 'lucide-react'
import { ConfirmActionDialog } from '@/components/shared/confirm-action-dialog'
import type { FragenLogZeile } from '@/lib/chat/verwaltung/fragen-log-sicht'
import type { DocReference } from '@ks/contracts'

interface EintragDetails {
  answer?: string
  references?: DocReference[]
  storyTopicsData?: unknown
}

interface Props {
  libraryId: string
  zeile: FragenLogZeile
  verwirft: boolean
  onVerwerfen: (queryId: string) => void
}

function Stand({ zeile }: { zeile: FragenLogZeile }) {
  if (zeile.cacheInvalidatedAt) {
    return <Badge variant="outline" title={`Verworfen am ${new Date(zeile.cacheInvalidatedAt).toLocaleString('de-DE')}`}>verworfen</Badge>
  }
  if (zeile.aktualitaet === 'aktuell') return <Badge variant="default">aktuell</Badge>
  if (zeile.aktualitaet === 'veraltet') {
    return <Badge variant="secondary" title="Antwortregeln, Facetten oder Dokumentzahl haben sich geändert — eine neue Frage trifft diese Antwort nicht mehr">veraltet</Badge>
  }
  return <Badge variant="outline" title="Eintrag ohne Cache-Parameter (älterer Stand)">unbekannt</Badge>
}

function facettenText(facetten: Record<string, unknown> | null): string {
  if (!facetten) return '–'
  return Object.entries(facetten)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.map(String).join(', ') : String(v)}`)
    .join(' · ')
}

export function FragenLogZeileView({ libraryId, zeile, verwirft, onVerwerfen }: Props) {
  const [offen, setOffen] = useState(false)
  const [details, setDetails] = useState<EintragDetails | null>(null)
  const [ladeFehler, setLadeFehler] = useState<string | null>(null)
  const [laedt, setLaedt] = useState(false)

  async function umschalten() {
    const jetztOffen = !offen
    setOffen(jetztOffen)
    if (!jetztOffen || details || laedt) return
    setLaedt(true)
    setLadeFehler(null)
    try {
      const res = await fetch(`/api/chat/${libraryId}/queries/${encodeURIComponent(zeile.queryId)}`)
      if (!res.ok) throw new Error(`Eintrag konnte nicht geladen werden (${res.status})`)
      setDetails((await res.json()) as EintragDetails)
    } catch (e) {
      setLadeFehler(e instanceof Error ? e.message : String(e))
    } finally {
      setLaedt(false)
    }
  }

  const verwerfbar = !zeile.cacheInvalidatedAt
  const Chevron = offen ? ChevronDown : ChevronRight

  return (
    <>
      <TableRow className="cursor-pointer" onClick={umschalten} data-testid={`fragen-log-zeile-${zeile.queryId}`}>
        <TableCell className="w-6 pr-0"><Chevron className="h-4 w-4 text-muted-foreground" aria-hidden="true" /></TableCell>
        <TableCell className="max-w-[28rem]">
          <div className="font-medium truncate" title={zeile.frage}>{zeile.kurztitel ?? zeile.frage}</div>
          {zeile.kurztitel && <div className="text-xs text-muted-foreground truncate" title={zeile.frage}>{zeile.frage}</div>}
          {zeile.queryType === 'toc' && <div className="text-xs text-muted-foreground">Themenübersicht</div>}
        </TableCell>
        <TableCell className="whitespace-nowrap text-sm">{new Date(zeile.erstellt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</TableCell>
        <TableCell className="text-sm">{zeile.sprache ?? '–'}</TableCell>
        <TableCell className="text-sm max-w-[10rem] truncate" title={zeile.modell ?? undefined}>{zeile.modell ?? '–'}</TableCell>
        <TableCell className="text-sm text-right">{zeile.anzahlQuellen}</TableCell>
        <TableCell className="text-sm text-right" title="Einträge mit derselben Antwort (Cache-Treffer eingeschlossen)">{zeile.anzahlEintraege}</TableCell>
        <TableCell><Stand zeile={zeile} /></TableCell>
        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
          {verwerfbar && (
            <ConfirmActionDialog
              trigger={
                <Button variant="ghost" size="sm" disabled={verwirft} title="Antwort verwerfen">
                  {verwirft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                  <span className="hidden lg:inline ml-2">Verwerfen</span>
                </Button>
              }
              title="Antwort verwerfen?"
              description={
                <>
                  Die gespeicherte Antwort auf „{zeile.frage}“ gilt danach nicht mehr als Treffer: Die nächste gleiche Frage
                  bekommt eine neue Antwort. Verlauf und Sitzungen der Besucher bleiben erhalten — gelöscht wird nichts.
                  {zeile.anzahlEintraege > 1 && <> Betrifft {zeile.anzahlEintraege} Einträge mit derselben Antwort.</>}
                </>
              }
              confirmLabel="Verwerfen"
              onConfirm={() => onVerwerfen(zeile.queryId)}
            />
          )}
        </TableCell>
      </TableRow>
      {offen && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell />
          <TableCell colSpan={8} className="space-y-3 text-sm">
            <div><span className="text-muted-foreground">Facetten:</span> {facettenText(zeile.facetten)}</div>
            {laedt && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Antwort wird geladen …</div>}
            {ladeFehler && <div className="text-destructive">{ladeFehler}</div>}
            {details && (
              <>
                <div>
                  <div className="text-muted-foreground mb-1">Antwort</div>
                  {details.answer ? (
                    <div className="whitespace-pre-wrap max-h-80 overflow-y-auto rounded border bg-background p-3">{details.answer}</div>
                  ) : details.storyTopicsData ? (
                    <div className="text-muted-foreground">Themenübersicht (strukturiert, kein Fließtext).</div>
                  ) : (
                    <div className="text-muted-foreground">Keine Antwort gespeichert.</div>
                  )}
                </div>
                {details.references && details.references.length > 0 && (
                  <div>
                    <div className="text-muted-foreground mb-1">Quellen</div>
                    <ol className="list-decimal pl-5 space-y-0.5">
                      {details.references.map((r) => (
                        <li key={`${r.number}-${r.fileId ?? r.fileName}`}>{r.title || r.fileName || r.fileId}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
