'use client'

/**
 * @fileoverview Eingabe-Dialog fuer Grund bzw. Zugbereiche (Register, Welle R3).
 *
 * @description
 * Ein Dialog fuer „Überspringen …", „So lassen, mit Grund …" und „In Teile
 * trennen …": ein Textfeld, eine Pruefung vor dem Absenden, und die
 * Begruendung des Servers bleibt im Dialog stehen, statt zu verschwinden.
 *
 * @module components/library/agent-view/sitzungen
 */

import { useEffect, useState } from 'react'
import {
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Textarea,
} from '@ks/ui'

export interface GrundDialogArt {
  titel: string
  beschreibung: string
  platzhalter: string
  knopf: string
  vorbelegt: string
  /** Fehlertext oder null = in Ordnung. */
  pruefen: (text: string) => string | null
  absenden: (text: string) => Promise<void>
}

export function SitzungGrundDialog({ art, onSchliessen }: { art: GrundDialogArt | null; onSchliessen: () => void }) {
  const [text, setText] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)

  useEffect(() => {
    setText(art?.vorbelegt ?? '')
    setFehler(null)
  }, [art])

  const absenden = async () => {
    if (art === null) return
    const problem = art.pruefen(text)
    if (problem !== null) { setFehler(problem); return }
    setLaeuft(true)
    try {
      await art.absenden(text.trim())
      onSchliessen()
    } catch (error) {
      setFehler(error instanceof Error ? error.message : String(error))
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <Dialog open={art !== null} onOpenChange={(offen) => { if (!offen) onSchliessen() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{art?.titel}</DialogTitle>
          <DialogDescription>{art?.beschreibung}</DialogDescription>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setFehler(null) }}
          placeholder={art?.platzhalter}
          rows={3}
          autoFocus
        />
        {fehler !== null && <p className="text-sm text-destructive" role="alert">{fehler}</p>}
        <DialogFooter>
          <Button variant="ghost" onClick={onSchliessen} disabled={laeuft}>Abbrechen</Button>
          <Button onClick={() => void absenden()} disabled={laeuft}>{art?.knopf}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
