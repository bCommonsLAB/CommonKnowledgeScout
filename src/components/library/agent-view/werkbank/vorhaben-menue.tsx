'use client'

/**
 * @fileoverview Menue `⋯` des Vorhaben-Kopfs (Welle A4) — alles Seltene.
 *
 * @description
 * Mockup A4: Stand-Menue, Teilbaum neu scannen, zu einer Liste hinzufuegen,
 * im Archiv oeffnen, folderId kopieren — und „Befunde & Auftrag" als
 * Dialog: Die Befunde verschwinden mit A3 aus der Flaeche (sie sind
 * Kennzeichnung am Baum und Inhalt des Kopfes), der Vorhaben-Auftrag der
 * Cowork-Gruppe bleibt hier erreichbar statt still zu entfallen.
 * `abgenommen` ist im Stand-Menue bewusst NICHT waehlbar — die Abnahme geht
 * nur ueber den primaeren Knopf (Stufe-4-Precheck).
 *
 * @module components/library/agent-view
 */

import { useState } from 'react'
import { ClipboardCopy, ExternalLink } from 'lucide-react'
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, useToast } from '@ks/ui'
import type { UseStandResult } from '@/hooks/agent-view/use-stand'
import type { AuftragContext } from '@/lib/agent-view/auftrag-generator'
import { standRank } from '@/lib/agent-view/bearbeitungsstand'
import { standLabel } from '@/lib/agent-view/labels'
import { BEARBEITUNGSSTAND_VALUES, type Bearbeitungsstand, type CoverageGap, type VorhabenCard } from '@/lib/agent-view/types'
import { KopfMenue } from './abnahme-kopf'
import { TeilbaumScanKnopf, type TeilbaumScanProps } from './teilbaum-scan-knopf'
import { WerkbankBefunde } from './werkbank-befunde'
import { ZuListeKnopf } from './zu-liste-knopf'

function zielLabel(ziel: Bearbeitungsstand, aktuell: Bearbeitungsstand | null): string {
  const zurueck = aktuell !== null && standRank(ziel) < standRank(aktuell)
  return `${zurueck ? 'Zurueckstufen auf' : 'Setzen auf'}: ${standLabel(ziel)}`
}

export function VorhabenMenue({ karte, aktuellerStand, stand, generatedAt, libraryId, archivHref, teilbaumScan, befunde, auftragContext }: {
  karte: VorhabenCard
  /** Angezeigter Stand (Report + Stand-Override). */
  aktuellerStand: Bearbeitungsstand | null
  stand: UseStandResult
  generatedAt: string
  libraryId: string
  archivHref: string
  teilbaumScan?: TeilbaumScanProps
  befunde: readonly CoverageGap[]
  auftragContext: AuftragContext
}) {
  const { toast } = useToast()
  const [befundeAuf, setBefundeAuf] = useState(false)
  const pending = stand.pendingFolderId === karte.folderId

  const setze = (ziel: Bearbeitungsstand, bestaetigen: boolean) =>
    void stand.setzeStand({
      folderId: karte.folderId,
      stand: ziel,
      erwarteterStand: aktuellerStand,
      reportGeneratedAt: generatedAt,
      bestaetigen,
    })

  const copyFolderId = async () => {
    try {
      await navigator.clipboard.writeText(karte.folderId)
      toast({ title: 'folderId kopiert', description: 'Fuer MCP-/Teilbaum-Werkzeuge.' })
    } catch (error) {
      toast({ title: 'Kopieren fehlgeschlagen', description: error instanceof Error ? error.message : String(error), variant: 'destructive' })
    }
  }

  return (
    <>
      <KopfMenue label={`Menue zu ${karte.name}`}>
        <select
          aria-label="Stand-Menue"
          value=""
          disabled={pending}
          onChange={(event) => {
            const wert = event.target.value
            if (wert === '') return
            if (wert === 'bestaetigen' && aktuellerStand !== null) setze(aktuellerStand, true)
            else if (wert !== 'bestaetigen') setze(wert as Bearbeitungsstand, false)
          }}
          className="h-7 w-full rounded-md border bg-background px-1.5 text-xs text-muted-foreground"
        >
          <option value="">Stand-Menue …</option>
          {aktuellerStand !== null && (
            <option value="bestaetigen">Stand bestaetigen ({standLabel(aktuellerStand)})</option>
          )}
          {BEARBEITUNGSSTAND_VALUES.filter((wert) => wert !== 'abgenommen' && wert !== aktuellerStand).map((wert) => (
            <option key={wert} value={wert}>
              {zielLabel(wert, aktuellerStand)}
            </option>
          ))}
        </select>
        <ZuListeKnopf libraryId={libraryId} karte={karte} />
        {teilbaumScan && (
          <TeilbaumScanKnopf folderId={karte.folderId} onTeilbaumScan={teilbaumScan.onScan} isScanning={teilbaumScan.isScanning} />
        )}
        <Button variant="outline" size="sm" className="h-7 w-full justify-start text-xs" onClick={() => setBefundeAuf(true)}>
          Befunde &amp; Auftrag …
        </Button>
        <a href={archivHref} className="flex items-center gap-1 px-1 py-0.5 underline-offset-2 hover:underline">
          Im Archiv oeffnen <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
        <Button variant="ghost" size="sm" className="h-7 w-full justify-start text-xs" onClick={() => void copyFolderId()}>
          <ClipboardCopy className="mr-1 h-3 w-3" aria-hidden /> folderId kopieren
        </Button>
      </KopfMenue>

      <Dialog open={befundeAuf} onOpenChange={setBefundeAuf}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Befunde des Teilbaums</DialogTitle>
          </DialogHeader>
          <WerkbankBefunde befunde={befunde} totalGaps={karte.totalGaps} auftragContext={auftragContext} />
        </DialogContent>
      </Dialog>
    </>
  )
}
