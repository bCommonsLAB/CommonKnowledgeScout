'use client'

/**
 * Sprecher-Zeile ueber einem Satz — von Hand setzen, umbenennen, entfernen.
 * Zeigt den gesetzten Sprecher (Klick = bearbeiten) oder, wenn geoeffnet,
 * ein Namensfeld mit Vorschlaegen (bisherige Sprecher) und „Entfernen".
 * Enter speichert sofort, Esc schliesst; ein Fehler bleibt an der Zeile.
 */

import * as React from 'react'
import { Button, Input } from '@ks/ui'
import { Check, Loader2, Trash2, UserRound, X } from 'lucide-react'

interface Props {
  aktuell: string | null
  /** Bisher verwendete Sprecher, als Vorschlagsliste. */
  vorschlaege: readonly string[]
  offen: boolean
  onOffen: (offen: boolean) => void
  /** null = entfernen; liefert null bei Erfolg, sonst die Fehlermeldung. */
  onSetze: (name: string | null) => Promise<string | null>
  listId: string
}

export function SprecherZeile({ aktuell, vorschlaege, offen, onOffen, onSetze, listId }: Props) {
  const [name, setName] = React.useState(aktuell ?? '')
  const [laeuft, setLaeuft] = React.useState(false)
  const [fehler, setFehler] = React.useState<string | null>(null)

  React.useEffect(() => { if (offen) { setName(aktuell ?? ''); setFehler(null) } }, [offen, aktuell])

  const setze = async (wert: string | null) => {
    if (wert !== null && wert.trim() === '') { onOffen(false); return }
    setLaeuft(true)
    setFehler(null)
    const e = await onSetze(wert)
    setLaeuft(false)
    if (e) { setFehler(e); return }
    onOffen(false)
  }

  if (!offen) {
    if (!aktuell) return null
    return (
      <button type="button" onClick={() => onOffen(true)} title="Sprecher umbenennen oder entfernen"
        className="flex items-center gap-1.5 rounded pt-2 text-sm font-semibold hover:text-primary">
        <UserRound className="h-4 w-4" /> {aktuell}
      </button>
    )
  }

  return (
    <div className="space-y-1 pt-2">
      <div className="flex items-center gap-1">
        <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Input value={name} list={listId} autoFocus disabled={laeuft} placeholder="Name des Sprechers, z. B. Publikum" className="h-7 max-w-xs text-sm"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !laeuft) onOffen(false)
            if (e.key === 'Enter') { e.preventDefault(); void setze(name) }
          }} />
        <datalist id={listId}>{vorschlaege.map((v) => <option key={v} value={v} />)}</datalist>
        <Button size="sm" className="h-7 px-2 text-xs" onClick={() => void setze(name)} disabled={laeuft || name.trim() === '' || name.trim() === aktuell}>
          {laeuft ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        </Button>
        {aktuell && (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive" onClick={() => void setze(null)} disabled={laeuft} title="Sprecher an diesem Satz entfernen">
            <Trash2 className="h-3.5 w-3.5" /><span className="ml-1 hidden lg:inline">Entfernen</span>
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onOffen(false)} disabled={laeuft} aria-label="Abbrechen"><X className="h-3.5 w-3.5" /></Button>
      </div>
      {fehler && <p className="text-xs text-destructive">Nicht gespeichert: {fehler}</p>}
    </div>
  )
}
