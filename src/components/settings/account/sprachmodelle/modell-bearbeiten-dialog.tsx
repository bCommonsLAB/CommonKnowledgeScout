"use client"

/**
 * Dialog „Modell bearbeiten": Anzeigename und Stärken-Text, so wie sie in
 * den Auswahlfeldern (Story-Modus, Library-Einstellungen) erscheinen.
 */

import { useEffect, useState } from "react"
import {
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Textarea,
} from "@ks/ui"
import type { SprachmodellAenderung, SprachmodellZeile } from "@/types/sprachmodell"

interface ModellBearbeitenDialogProps {
  modell: SprachmodellZeile | null
  onSchliessen: () => void
  /** true = gespeichert (Dialog schliesst), false = Fehler (bleibt offen). */
  onSpeichern: (modelId: string, aenderung: SprachmodellAenderung) => Promise<boolean>
}

export function ModellBearbeitenDialog({ modell, onSchliessen, onSpeichern }: ModellBearbeitenDialogProps) {
  const [name, setName] = useState("")
  const [staerken, setStaerken] = useState("")
  const [speichert, setSpeichert] = useState(false)

  useEffect(() => {
    setName(modell?.name ?? "")
    setStaerken(modell?.strengths ?? "")
  }, [modell])

  const speichern = async () => {
    if (!modell) return
    setSpeichert(true)
    const ok = await onSpeichern(modell.modelId, { name, strengths: staerken })
    setSpeichert(false)
    if (ok) onSchliessen()
  }

  return (
    <Dialog open={modell !== null} onOpenChange={(offen) => { if (!offen) onSchliessen() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modell bearbeiten</DialogTitle>
          <DialogDescription className="font-mono">{modell?.modelId}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="modell-name">Name in der Auswahl</Label>
          <Input id="modell-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="modell-staerken">Stärken (kurzer Hinweis für die Auswahl)</Label>
          <Textarea id="modell-staerken" value={staerken} maxLength={300} rows={3} onChange={(e) => setStaerken(e.target.value)} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onSchliessen}>Abbrechen</Button>
          <Button type="button" disabled={speichert || name.trim().length === 0} onClick={() => void speichern()}>
            {speichert ? "Speichert…" : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
