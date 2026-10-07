"use client"

import { useEffect, useState } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Textarea,
} from '@ks/ui'
import { Plus, Trash2 } from 'lucide-react'
import type { FacetWert } from '@/lib/chat/facet-werte'
import { facetWerteSchema } from '@/lib/chat/facet-werte'

export interface FacetWerteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** metaKey der Facette, nur für die Überschrift */
  metaKey: string
  value: FacetWert[]
  onSave: (werte: FacetWert[]) => void
}

/** Verbotsliste als eine Zeile je Eintrag; leere Zeilen fallen weg. */
function verbotenAusText(text: string): string[] | undefined {
  const zeilen = text.split('\n').map((z) => z.trim()).filter((z) => z.length > 0)
  return zeilen.length > 0 ? zeilen : undefined
}

/**
 * Bedeutungs-Wörterbuch einer Facette bearbeiten (Plan story-status-modalitaet, m1).
 * Je Wert: roher Wert, Klartext-Label, Bedeutung (Retriever-Kontext) und
 * Verbotsliste. Gespeichert wird erst nach gültiger Zod-Prüfung; Fehler
 * werden angezeigt, nie stillschweigend bereinigt.
 */
export function FacetWerteDialog({ open, onOpenChange, metaKey, value, onSave }: FacetWerteDialogProps) {
  const [werte, setWerte] = useState<FacetWert[]>(value)
  const [fehler, setFehler] = useState<string | null>(null)

  // Beim Öffnen den gespeicherten Stand laden (Abbrechen verwirft Änderungen).
  useEffect(() => {
    if (open) {
      setWerte(value)
      setFehler(null)
    }
  }, [open, value])

  function update(index: number, patch: Partial<FacetWert>) {
    setWerte((prev) => prev.map((w, i) => (i === index ? { ...w, ...patch } : w)))
  }
  function add() {
    setWerte((prev) => [...prev, { wert: '', label: '' }])
  }
  function remove(index: number) {
    setWerte((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSave() {
    const bereinigt: FacetWert[] = werte.map((w) => ({
      wert: w.wert.trim(),
      label: w.label.trim(),
      ...(w.bedeutung && w.bedeutung.trim() ? { bedeutung: w.bedeutung.trim() } : {}),
      ...(w.verboten && w.verboten.length > 0 ? { verboten: w.verboten } : {}),
    }))
    const ergebnis = facetWerteSchema.safeParse(bereinigt)
    if (!ergebnis.success) {
      const erstes = ergebnis.error.issues[0]
      const zeile = typeof erstes?.path[0] === 'number' ? `Zeile ${erstes.path[0] + 1}: ` : ''
      setFehler(`${zeile}${erstes?.message ?? 'Ungültige Eingabe'}`)
      return
    }
    onSave(ergebnis.data)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bedeutungs-Wörterbuch: {metaKey}</DialogTitle>
          <DialogDescription>
            Je Wert ein Klartext-Label und eine Bedeutung. Die Bedeutung geht als Kontext
            an den Retriever, die Verbotsliste (eine Formulierung je Zeile) an die Nachprüfung.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {werte.length === 0 && (
            <p className="text-sm text-muted-foreground">Noch keine Werte. Fügen Sie den ersten Wert hinzu.</p>
          )}
          {werte.map((w, i) => (
            <div key={i} className="grid gap-2 rounded border p-3 md:grid-cols-[1fr_1fr_auto]">
              <Input
                placeholder="Wert (roh, z. B. nicht_umsetzbar)"
                value={w.wert}
                onChange={(e) => update(i, { wert: e.target.value })}
                className="font-mono text-xs"
              />
              <Input
                placeholder="Label (z. B. nicht umsetzbar)"
                value={w.label}
                onChange={(e) => update(i, { label: e.target.value })}
              />
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)} className="h-9 w-9 p-0" title="Wert entfernen">
                <Trash2 className="h-4 w-4" />
              </Button>
              <Textarea
                placeholder="Bedeutung (Kontext für den Retriever)"
                value={w.bedeutung ?? ''}
                onChange={(e) => update(i, { bedeutung: e.target.value })}
                rows={2}
                className="md:col-span-2"
              />
              <Textarea
                placeholder={'Verboten (eine Formulierung je Zeile)\nz. B. ist umgesetzt'}
                value={(w.verboten ?? []).join('\n')}
                onChange={(e) => update(i, { verboten: verbotenAusText(e.target.value) })}
                rows={2}
                className="md:col-span-3 font-mono text-xs"
              />
            </div>
          ))}
          <Button type="button" variant="secondary" onClick={add} className="gap-2">
            <Plus className="h-4 w-4" /> Wert hinzufügen
          </Button>
          {fehler && <p className="text-sm text-destructive">{fehler}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button type="button" onClick={handleSave}>Übernehmen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
