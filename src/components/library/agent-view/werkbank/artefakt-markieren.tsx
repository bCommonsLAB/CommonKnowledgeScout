'use client'

/**
 * @fileoverview Fehler markieren und Markierung anzeigen (ADR 0006, Modell B).
 *
 * @description
 * Der Gegenknopf zur Verifikation: Statt Zustimmung einzusammeln, benennt der
 * Mensch hier, was NICHT stimmt. Die Notiz ist Pflicht — sie sperrt die
 * Abnahme, und wer sie spaeter aufloest, muss den Grund kennen. Gesendet wird
 * ueber denselben Kurations-Weg wie die Verifikation (Spiegel-Drift-Guard);
 * der Server stempelt Urheber und Zeit.
 *
 * @module components/library/agent-view
 */

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button, Input } from '@ks/ui'
import type { LeadingArtifactSummary } from '@/lib/agent-view/types'

/** Rote Zeile unter dem Kopf: was jemand als falsch benannt hat. */
export function MarkierHinweis({ artefakt }: { artefakt: LeadingArtifactSummary }) {
  const wer = artefakt.flaggedBy ?? 'unbekannt'
  const wann = artefakt.flaggedAt?.slice(0, 10) ?? '—'
  return (
    <p className="rounded-md bg-red-600/10 px-2 py-1.5 text-sm text-red-700 dark:text-red-400">
      <span aria-hidden>⊘ </span>
      <strong>Stimmt nicht:</strong> {artefakt.flaggedNote ?? '(ohne Notiz — aus einem alten Bestand)'}
      <span className="ml-1 text-xs opacity-80">({wer}, {wann})</span>
      <br />
      <span className="text-xs">
        Die Abnahme des Vorhabens bleibt gesperrt. Reparieren (lassen) und danach verifizieren loest die Markierung auf.
      </span>
    </p>
  )
}

/**
 * Knopf „stimmt nicht" mit Pflicht-Notiz. Aufgeklappt steht ein Feld da;
 * leer abschicken geht nicht — der Knopf bleibt gesperrt statt still zu
 * scheitern.
 */
export function MarkierKnopf({ artefakt, pending, onMarkiere }: {
  artefakt: LeadingArtifactSummary | null | undefined
  pending: boolean
  onMarkiere: (notiz: string) => Promise<void>
}) {
  const [offen, setOffen] = useState(false)
  const [notiz, setNotiz] = useState('')

  if (artefakt == null) return null

  if (!offen) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-7 border-red-300 text-red-700 hover:bg-red-500/10 dark:text-red-400"
        disabled={pending}
        title="Diesen Teil als fehlerhaft markieren — das sperrt die Abnahme des Vorhabens, bis er geklaert ist."
        onClick={() => setOffen(true)}
      >
        stimmt nicht
      </Button>
    )
  }

  const senden = async () => {
    await onMarkiere(notiz)
    setNotiz('')
    setOffen(false)
  }

  return (
    <span className="flex items-center gap-1">
      <Input
        autoFocus
        aria-label="Was stimmt nicht?"
        placeholder="Was stimmt nicht? (Pflicht)"
        className="h-7 w-64 text-xs"
        value={notiz}
        disabled={pending}
        onChange={(event) => setNotiz(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && notiz.trim() !== '') void senden()
          if (event.key === 'Escape') setOffen(false)
        }}
      />
      <Button size="sm" className="h-7" disabled={pending || notiz.trim() === ''} onClick={() => void senden()}>
        {pending && <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden />}
        Markieren
      </Button>
      <Button variant="ghost" size="sm" className="h-7" disabled={pending} onClick={() => setOffen(false)}>
        Abbrechen
      </Button>
    </span>
  )
}
