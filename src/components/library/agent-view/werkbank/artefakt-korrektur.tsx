'use client'

/**
 * @fileoverview Korrekturauftrag diktieren und anzeigen (K1/K2).
 *
 * @description
 * Der Gegenknopf zur Fehler-Markierung — und etwas anderes als sie: „stimmt
 * nicht" ist eine Diagnose, der Korrekturauftrag ist eine ANWEISUNG AN DEN
 * AGENTEN. Peter erzaehlt den Kontext, den eine isolierte Audiodatei nicht
 * hergibt („gesprochen hat Maria S., gehoert unter 26.02"), und Cowork
 * arbeitet ihn spaeter ab.
 *
 * Nicht zu verwechseln mit `customHint` (Pipeline-Sheet): der steuert den
 * INHALT einer Transformation, dieser die Arbeit an der DATEI. Siehe
 * `docs/concepts/korrekturauftrag-diktat.md` §5.
 *
 * Diktiert wird mit der Standard-Komponente `DictationTextarea` (Secretary) —
 * kein eigener Aufnahme-Code. Gesendet wird ueber denselben Kurations-Weg wie
 * Verifikation und Markierung (Spiegel-Drift-Guard); Urheber und Zeit stempelt
 * der Server.
 *
 * @module components/library/agent-view
 */

import { useState } from 'react'
import { Loader2, Mic } from 'lucide-react'
import { Button } from '@ks/ui'
import { DictationTextarea } from '@/components/shared/dictation-textarea'
import type { LeadingArtifactSummary } from '@/lib/agent-view/types'

/** Offener Auftrag unter dem Kopf: was mit dieser Datei geschehen soll. */
export function KorrekturHinweis({ artefakt, pending, onZuruecknehmen }: {
  artefakt: LeadingArtifactSummary
  pending: boolean
  onZuruecknehmen: () => Promise<void>
}) {
  const auftrag = artefakt.korrekturAuftrag
  if (auftrag == null || auftrag.trim() === '') return null

  const wer = artefakt.korrekturVon ?? 'unbekannt'
  const wann = artefakt.korrekturAt?.slice(0, 10) ?? '—'
  const erledigt = artefakt.korrekturErledigtAt

  return (
    <div className="rounded-md bg-sky-600/10 px-2 py-1.5 text-sm text-sky-800 dark:text-sky-300">
      <p>
        <span aria-hidden>✎ </span>
        <strong>{erledigt == null ? 'Auftrag an Cowork:' : 'Auftrag (erledigt):'}</strong> {auftrag}
        <span className="ml-1 text-xs opacity-80">({wer}, {wann})</span>
      </p>
      <p className="mt-0.5 flex items-center gap-2 text-xs">
        <span>
          {erledigt == null
            ? 'Cowork holt ihn beim naechsten Aufraeumlauf ab. Verifizieren loest ihn ebenfalls auf.'
            : `Cowork meldet erledigt am ${erledigt.slice(0, 10)} — bitte ansehen und verifizieren.`}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 shrink-0 px-1.5 text-xs"
          disabled={pending}
          title="Auftrag zuruecknehmen — fuer ein Fehl-Diktat."
          onClick={() => void onZuruecknehmen()}
        >
          Zuruecknehmen
        </Button>
      </p>
    </div>
  )
}

/**
 * Knopf „Korrektur diktieren" mit Pflicht-Text. Aufgeklappt steht die
 * Standard-Diktier-Textarea da; leer abschicken geht nicht — der Knopf bleibt
 * gesperrt, statt still zu scheitern.
 */
export function KorrekturKnopf({ artefakt, pending, onKorrigiere }: {
  artefakt: LeadingArtifactSummary | null | undefined
  pending: boolean
  onKorrigiere: (auftrag: string) => Promise<void>
}) {
  const [offen, setOffen] = useState(false)
  const [auftrag, setAuftrag] = useState('')

  if (artefakt == null) return null

  if (!offen) {
    const vorhanden = artefakt.korrekturAuftrag != null && artefakt.korrekturAuftrag.trim() !== ''
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-7 border-sky-300 text-sky-700 hover:bg-sky-500/10 dark:text-sky-400"
        disabled={pending}
        title={
          vorhanden
            ? 'Auftrag neu fassen — der alte wird ersetzt.'
            : 'Erzaehlen, was mit dieser Datei geschehen soll (Ort, Name, Einordnung). Cowork arbeitet es ab.'
        }
        onClick={() => {
          setAuftrag(artefakt.korrekturAuftrag ?? '')
          setOffen(true)
        }}
      >
        <Mic className="mr-1 h-3 w-3" aria-hidden />
        {vorhanden ? 'Auftrag neu fassen' : 'Korrektur diktieren'}
      </Button>
    )
  }

  const senden = async () => {
    await onKorrigiere(auftrag)
    setAuftrag('')
    setOffen(false)
  }

  return (
    <span className="flex w-full items-end gap-1 sm:w-96">
      <DictationTextarea
        label="Was soll mit dieser Datei geschehen?"
        variant="overlay"
        rows={2}
        maxAutoRows={6}
        className="flex-1"
        placeholder="Kontext erzaehlen: wer sprach, worum ging es, wohin gehoert es …"
        value={auftrag}
        onChange={setAuftrag}
        disabled={pending}
      />
      <Button size="sm" className="h-7" disabled={pending || auftrag.trim() === ''} onClick={() => void senden()}>
        {pending && <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden />}
        Beauftragen
      </Button>
      <Button variant="ghost" size="sm" className="h-7" disabled={pending} onClick={() => setOffen(false)}>
        Abbrechen
      </Button>
    </span>
  )
}
