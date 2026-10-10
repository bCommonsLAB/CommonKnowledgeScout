'use client'

/**
 * Unter-Reiter „Korrektur" am Audio-Transkript: ein Assistent, der hilft, die
 * Wirklichkeit zu rekonstruieren (Owner 10.10.2026). Oben das Audio, darunter
 * der Text Satz fuer Satz — gelb = nachhoeren, Doppelklick = korrigieren —
 * und am Rand die Vorschlaege der KI wie im Aenderungsmodus von Word
 * (Korrektur „alt → neu", Sprecherwechsel). Alles, was uebernommen wird, ist
 * sofort gespeichert; es gibt keinen separaten Bestaetigen-Schritt.
 */

import * as React from 'react'
import { Alert, AlertDescription, Button } from '@ks/ui'
import { HelpCircle, Maximize2, Minimize2, Sparkles } from 'lucide-react'
import type { StorageProvider } from '@/lib/storage/types'
import { satzMitKorrektur } from '@/lib/transkript-korrektur/assistent-pruefung'
import { AssistentDialog } from './assistent-dialog'
import { AudioCorrectionLesen } from './audio-correction-lesen'
import type { SatzVorschlagAktionen } from './audio-correction-satz'
import { useAssistent } from './use-assistent'
import { useAudioCorrection } from './use-audio-correction'
import { useSatzSpeichern } from './use-satz-speichern'

interface Props {
  libraryId: string
  sourceId: string
  parentId: string
  provider: StorageProvider | null
  enabled: boolean
  /** Sprachen der Aufnahmen aus der Library (fuer die Sprachpruefung); leer = Pruefung aus. */
  erlaubteSprachen: string[]
  /** Nach jeder gespeicherten Aenderung (Revisionsstand im Reiter Transformation auffrischen). */
  onSatzGespeichert?: () => void
}

export function AudioCorrectionTab(props: Props) {
  const k = useAudioCorrection(props)
  const assistent = useAssistent(props.libraryId, props.sourceId)
  const [dialogOffen, setDialogOffen] = React.useState(false)
  const { speichereSatz, speichereSprecher } = useSatzSpeichern({
    libraryId: props.libraryId, sourceId: props.sourceId, zustand: k.zustand, setZustand: k.setZustand,
    onGespeichert: props.onSatzGespeichert,
  })
  const segments = k.zustand?.segmente?.segments ?? []

  const korrigiere = async (index: number, neu: string) => {
    const fehler = await speichereSatz(index, neu)
    if (!fehler) assistent.bereinigeSatz(index, neu.trim())
    return fehler
  }

  const aktionen: SatzVorschlagAktionen = {
    korrekturAnnehmen: async (v) => {
      const satz = segments[v.satz]
      if (!satz) return 'Satz nicht gefunden — Seite neu laden'
      if (!satz.text.includes(v.alt)) return 'Der Satz wurde inzwischen geaendert — Vorschlag passt nicht mehr'
      const neu = satzMitKorrektur(satz.text, v)
      const fehler = await speichereSatz(v.satz, neu)
      if (!fehler) { assistent.entferneKorrektur(v.id); assistent.bereinigeSatz(v.satz, neu) }
      return fehler
    },
    korrekturVerwerfen: (v) => assistent.entferneKorrektur(v.id),
    sprecherAnnehmen: async (v) => {
      const fehler = await speichereSprecher(v.abSatz, v.name)
      if (!fehler) assistent.entferneSprecher(v.id)
      return fehler
    },
    sprecherVerwerfen: (v) => assistent.entferneSprecher(v.id),
  }

  const offeneVorschlaege = assistent.offen.korrekturen.length + assistent.offen.sprecher.length

  // Vollbild (Owner 10.10.2026): die Seite stapelt viele Ebenen ueber der Satzliste;
  // zum Arbeiten nimmt die Korrektur den ganzen Bildschirm. Esc beendet.
  const [vollbild, setVollbild] = React.useState(false)
  React.useEffect(() => {
    if (!vollbild) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setVollbild(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [vollbild])

  const hilfe = 'Satz fuer Satz lesen und anhoeren — gelb heisst: nachhoeren. Doppelklick korrigiert, Vorschlaege der KI stehen am Rand. Alles wird sofort gespeichert.'
    + (k.zustand?.revisedAt ? ` Zuletzt geaendert ${new Date(k.zustand.revisedAt).toLocaleString('de-DE')} von ${k.zustand.revisedBy ?? '?'}.` : '')
  const kopfAktion = (
    <>
      <Button size="sm" className="h-7 px-2 text-xs" onClick={() => setDialogOffen(true)} disabled={segments.length === 0}
        title={segments.length === 0 ? 'Erst neu transkribieren — Vorschlaege brauchen die Saetze' : 'Korrekturen und Sprecherwechsel von der KI vorschlagen lassen'}>
        <Sparkles className="h-3.5 w-3.5" /><span className="ml-1 hidden lg:inline">Vorschlaege holen</span>
      </Button>
      <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setVollbild((v) => !v)} aria-label={vollbild ? 'Vollbild beenden' : 'Vollbild'}
        title={vollbild ? 'Vollbild beenden (Esc)' : 'Vollbild: die Korrektur nimmt den ganzen Bildschirm'}>
        {vollbild ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
      </Button>
      <span className="text-muted-foreground" title={hilfe}><HelpCircle className="h-4 w-4" aria-label="Hilfe zur Korrektur-Ansicht" /></span>
    </>
  )

  return (
    <div className={vollbild ? 'fixed inset-0 z-50 flex flex-col gap-2 bg-background p-3' : 'flex h-full min-h-0 flex-col gap-2'}>
      {vollbild && (
        <div className="flex shrink-0 items-center gap-2 text-sm">
          <span className="truncate font-medium">{k.zustand?.sourceName ?? ''}</span>
          <span className="text-xs text-muted-foreground">Korrektur · Esc beendet das Vollbild</span>
        </div>
      )}
      {k.ladeFehler && <Alert variant="destructive"><AlertDescription>{k.ladeFehler}</AlertDescription></Alert>}
      {assistent.offen.verworfen.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">
            {assistent.offen.verworfen.length} Vorschlaege der KI verworfen (nicht am Text belegbar)
            {assistent.offen.info ? ` · ${assistent.offen.info.modell} · ${Math.round(assistent.offen.info.dauerMs / 1000)} s` : ''}
          </summary>
          <ul className="mt-1 list-disc pl-5">{assistent.offen.verworfen.map((v, i) => <li key={i}>{v}</li>)}</ul>
        </details>
      )}
      {k.zustand && (
        <div className="min-h-0 flex-1">
          <AudioCorrectionLesen
            provider={props.provider}
            sourceId={props.sourceId}
            absaetze={k.zustand.absaetze}
            segmente={k.zustand.segmente}
            erlaubteSprachen={props.erlaubteSprachen}
            revisedAt={k.zustand.revisedAt}
            onKorrigiere={korrigiere}
            onSprecher={speichereSprecher}
            assistent={assistent}
            aktionen={aktionen}
            kopfAktion={kopfAktion}
          />
        </div>
      )}
      <AssistentDialog
        offen={dialogOffen}
        onOffenChange={setDialogOffen}
        quellen={k.quellen}
        onQuellenChange={k.setQuellen}
        auftrag={assistent.auftrag}
        onAuftragChange={assistent.setAuftrag}
        laeuft={assistent.laeuft}
        fehler={assistent.fehler}
        onHolen={assistent.hole}
        offeneVorschlaege={offeneVorschlaege}
      />
    </div>
  )
}
