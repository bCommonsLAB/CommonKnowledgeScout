'use client'

/**
 * @fileoverview Sammelaktionen des Vorhaben-Kopfs (Welle A4, Entscheidung 3).
 *
 * @description
 * Getrennt nach Art — je ein Knopf fuer alle offenen Transkripte und alle
 * offenen Zusammenfassungen, jeder mit einer Rueckfrage, die die Zahl
 * nennt. Die Rueckfrage ist kein Formalismus: Hier bestaetigt der Mensch,
 * dass er die Gruppe wirklich gesehen hat. Das Ergebnis (erledigt/Fehler je
 * Datei) steht danach benannt unter dem Kopf — nie still.
 *
 * @module components/library/agent-view
 */

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import type { SammelErgebnis, UseArtefaktKurationResult } from '@/hooks/agent-view/use-artefakt-kuration'
import { sammelZiele, type PruefbareArt } from '@/lib/agent-view/werkbank-abnahme'
import type { TwinFamilySummary } from '@/lib/agent-view/types'

const ART_LABEL: Record<PruefbareArt, [einzahl: string, mehrzahl: string]> = {
  transkript: ['Transkript', 'Transkripte'],
  zusammenfassung: ['Zusammenfassung', 'Zusammenfassungen'],
}

export function WerkbankSammelaktionen({ familien, kuration }: {
  /** Effektive Familien des Teilbaums (Report + Overrides). */
  familien: readonly TwinFamilySummary[]
  kuration: UseArtefaktKurationResult
}) {
  const [rueckfrage, setRueckfrage] = useState<PruefbareArt | null>(null)
  const [ergebnis, setErgebnis] = useState<SammelErgebnis | null>(null)

  const knoepfe = (['transkript', 'zusammenfassung'] as const)
    .map((art) => ({ art, ziele: sammelZiele(familien, art) }))
    .filter(({ ziele }) => ziele.length > 0)

  const bestaetigt = async (art: PruefbareArt) => {
    setRueckfrage(null)
    setErgebnis(await kuration.sammelVerifiziere(sammelZiele(familien, art)))
  }

  const offen = rueckfrage === null ? null : { art: rueckfrage, anzahl: sammelZiele(familien, rueckfrage).length }

  return (
    <>
      {knoepfe.map(({ art, ziele }) => (
        <Button
          key={art}
          size="sm"
          variant="outline"
          className="h-6 text-xs"
          disabled={kuration.sammelLaeuft}
          onClick={() => setRueckfrage(art)}
        >
          {kuration.sammelLaeuft && <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden />}
          {ziele.length} {ART_LABEL[art][ziele.length === 1 ? 0 : 1]} pruefen …
        </Button>
      ))}
      {ergebnis && (
        <span className={`text-[11px] ${ergebnis.fehler.length > 0 ? 'text-red-600' : 'text-muted-foreground'}`} role="status">
          {ergebnis.erledigt} von {ergebnis.gesamt} verifiziert
          {ergebnis.fehler.length > 0 && ` — Fehler: ${ergebnis.fehler.join(' · ')}`}
        </span>
      )}
      <AlertDialog open={offen !== null} onOpenChange={(auf) => !auf && setRueckfrage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {offen === null ? '' : `${offen.anzahl} ${ART_LABEL[offen.art][offen.anzahl === 1 ? 0 : 1]} als geprueft bestaetigen?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Verifikation ist eine bewusste menschliche Aussage: Du bestaetigst, dass du diese Gruppe
              wirklich gesehen hast. Jede Datei bekommt verified_by/verified_at ueber die Kurations-Route.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => offen !== null && void bestaetigt(offen.art)}>
              Ja, {offen?.anzahl ?? 0} verifizieren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
