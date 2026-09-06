'use client'

/**
 * @fileoverview Termin-Leiste der Aktuell-Sicht (Welle A7).
 *
 * @description
 * Der oberste Block des Einstiegs: was als Naechstes im Kalender steht, mit
 * dem ersten offenen Punkt des Vorhabens daneben. Beide Marken der
 * exportierten `AKTUELL.md` bleiben erhalten — den Wortlaut haelt
 * {@link AktuellTerminMarken}, damit Leiste und Tabelle nicht verschieden
 * reden.
 *
 * @module components/library/agent-view
 */

import { AlertTriangle, CalendarClock } from 'lucide-react'
import type { AktuellVorhaben } from '@/lib/agent-view/aktuell-sicht'
import { datumLesbar } from '@/lib/agent-view/sichten/types'
import { AktuellTerminMarken } from './aktuell-termin-marken'

export interface AktuellTermineProps {
  termine: readonly AktuellVorhaben[]
  onOeffnen: (folderId: string) => void
}

function TerminZeile({ vorhaben, onOeffnen }: { vorhaben: AktuellVorhaben; onOeffnen: (folderId: string) => void }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b py-1.5 last:border-b-0">
      <span className="w-40 shrink-0 text-sm font-semibold tabular-nums">
        {datumLesbar(vorhaben.naechsterTermin)}
      </span>
      <button
        type="button"
        onClick={() => onOeffnen(vorhaben.folderId)}
        className="text-left text-sm font-medium underline-offset-2 hover:underline"
      >
        {vorhaben.titel}
      </button>
      <AktuellTerminMarken vorhaben={vorhaben} />
      {vorhaben.offenePunkte.length > 0 && (
        <span className="w-full text-xs text-muted-foreground sm:w-auto sm:flex-1">
          {vorhaben.offenePunkte[0]}
        </span>
      )}
    </li>
  )
}

export function AktuellTermine({ termine, onOeffnen }: AktuellTermineProps) {
  if (termine.length === 0) {
    return (
      <section className="space-y-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <CalendarClock className="h-4 w-4" aria-hidden /> Die nächsten Termine
        </h2>
        <p className="text-sm text-muted-foreground">
          Kein aktives Vorhaben trägt einen <code>naechster_termin</code> — entweder steht wirklich
          nichts an, oder die Berichte sind an dieser Stelle nicht gepflegt.
        </p>
      </section>
    )
  }

  const unfixiert = termine.some((t) => !t.terminFixiert)
  const ueberfaellig = termine.some((t) => t.ueberfaellig)

  return (
    <section className="space-y-1">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <CalendarClock className="h-4 w-4" aria-hidden /> Die nächsten Termine
      </h2>
      <ul className="rounded-md border px-3 py-1">
        {termine.map((vorhaben) => (
          <TerminZeile key={vorhaben.folderId} vorhaben={vorhaben} onOeffnen={onOeffnen} />
        ))}
      </ul>
      {(unfixiert || ueberfaellig) && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          <span>
            {unfixiert && 'Termine ohne Fixierung sind noch nicht vereinbart — bis dahin ist alles unsicher, was daran hängt. '}
            {ueberfaellig && 'Überfällige Termine liegen vor heute; nachzuziehen ist der naechster_termin im BERICHT.md.'}
          </span>
        </p>
      )}
    </section>
  )
}
