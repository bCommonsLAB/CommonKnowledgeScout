'use client'

/**
 * @fileoverview Tabelle „Aktive Vorhaben" der Aktuell-Sicht (Welle A7).
 *
 * @description
 * Dieselben vier Spalten wie die exportierte `AKTUELL.md` (Vorhaben, Rolle,
 * Zuletzt, Nächster Termin) — plus eine fuenfte, die die Datei nicht haben
 * kann: wie viele Befunde an diesem Vorhaben auf den MENSCHEN warten. Genau
 * darin liegt der Gewinn gegenueber dem Markdown: die Zeile ist ein Einstieg
 * in die Werkbank, kein Text.
 *
 * @module components/library/agent-view
 */

import { FileText, Mail } from 'lucide-react'
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ks/ui'
import type { AktuellVorhaben } from '@/lib/agent-view/aktuell-sicht'
import { postfachStandLabel } from '@/lib/agent-view/postfach-frische'
import { datumLesbar } from '@/lib/agent-view/sichten/types'

export interface AktuellVorhabenTabelleProps {
  aktiv: readonly AktuellVorhaben[]
  libraryId: string
  /** A7b: Vorhaben, deren Postfach-Auswertung mahnt (geteiltes Praedikat). */
  rueckstaendig: ReadonlySet<string>
  onOeffnen: (folderId: string) => void
}

/**
 * A7b: Stand der E-Mail-Auswertung. Ohne Angabe im Bericht bleibt die Zeile
 * weg — nur wer das Feld fuehrt, wird daran gemessen.
 */
function PostfachZeile({ vorhaben, mahnt }: { vorhaben: AktuellVorhaben; mahnt: boolean }) {
  if (vorhaben.postfach.art === 'ohne_angabe') return null
  return (
    <span
      className={`mt-0.5 flex items-center gap-1 text-xs ${mahnt ? 'text-amber-600 dark:text-amber-500' : 'text-muted-foreground'}`}
    >
      <Mail className="h-3 w-3 shrink-0" aria-hidden />
      {postfachStandLabel(vorhaben.postfach)}
    </span>
  )
}

/** Deep-Link ins Archiv auf den Bericht (dasselbe Muster wie `WerkbankBericht`). */
function archivHref(libraryId: string, folderId: string, fileId: string): string {
  return `/library?activeLibraryId=${encodeURIComponent(libraryId)}&folderId=${encodeURIComponent(folderId)}&openFileId=${encodeURIComponent(fileId)}`
}

function TerminZelle({ vorhaben }: { vorhaben: AktuellVorhaben }) {
  if (vorhaben.naechsterTermin === null) return <span className="text-muted-foreground">—</span>
  return (
    <span className="flex flex-wrap items-center gap-1">
      <span className="tabular-nums">{datumLesbar(vorhaben.naechsterTermin)}</span>
      {!vorhaben.terminFixiert && (
        <Badge variant="outline" className="h-4 px-1 text-[10px]">
          offen
        </Badge>
      )}
      {vorhaben.ueberfaellig && (
        <Badge variant="destructive" className="h-4 px-1 text-[10px]">
          überfällig
        </Badge>
      )}
    </span>
  )
}

export function AktuellVorhabenTabelle({ aktiv, libraryId, rueckstaendig, onOeffnen }: AktuellVorhabenTabelleProps) {
  if (aktiv.length === 0) {
    return (
      <section className="space-y-1">
        <h2 className="text-sm font-semibold">Aktive Vorhaben</h2>
        <p className="text-sm text-muted-foreground">
          Kein Bericht trägt <code>status: aktiv</code>. Die Sicht ordnet nur ein, was der Bericht
          erklärt — sie rät nicht aus Datei-Daten, was gerade läuft.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-1">
      <h2 className="text-sm font-semibold">Aktive Vorhaben</h2>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vorhaben</TableHead>
              <TableHead className="w-28">Rolle</TableHead>
              <TableHead className="w-36">Zuletzt</TableHead>
              <TableHead className="w-48">Nächster Termin</TableHead>
              <TableHead className="w-32 text-right">Wartet auf dich</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {aktiv.map((vorhaben) => (
              <TableRow key={vorhaben.folderId}>
                <TableCell className="align-top">
                  <button
                    type="button"
                    onClick={() => onOeffnen(vorhaben.folderId)}
                    className="text-left font-medium underline-offset-2 hover:underline"
                  >
                    {vorhaben.titel}
                  </button>
                  <span className="block text-xs text-muted-foreground">{vorhaben.path}</span>
                  {vorhaben.berichtFileId !== null && (
                    <a
                      href={archivHref(libraryId, vorhaben.folderId, vorhaben.berichtFileId)}
                      className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
                    >
                      <FileText className="h-3 w-3" aria-hidden /> BERICHT.md
                    </a>
                  )}
                  <PostfachZeile vorhaben={vorhaben} mahnt={rueckstaendig.has(vorhaben.folderId)} />
                </TableCell>
                <TableCell className="align-top text-muted-foreground">{vorhaben.rolle ?? '—'}</TableCell>
                <TableCell className="align-top tabular-nums text-muted-foreground">
                  {vorhaben.letzteAktivitaet === null ? '—' : datumLesbar(vorhaben.letzteAktivitaet)}
                </TableCell>
                <TableCell className="align-top">
                  <TerminZelle vorhaben={vorhaben} />
                </TableCell>
                <TableCell className="align-top text-right">
                  {vorhaben.wartetAufDich === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <Badge variant="secondary" className="tabular-nums">
                      {vorhaben.wartetAufDich}
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
