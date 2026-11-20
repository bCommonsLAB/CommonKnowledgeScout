"use client"

/**
 * Dialog „Modell hinzufügen": sucht im OpenRouter-Katalog und legt den
 * gewählten Eintrag an — abgeschaltet, bis eine Probe geklappt hat.
 */

import { useEffect, useState } from "react"
import { Plus } from "lucide-react"
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Input } from "@ks/ui"
import type { KatalogEintrag } from "@/types/sprachmodell"
import { formatKontext, formatPreis } from "./format"
import { sucheImKatalog } from "./use-sprachmodelle"

interface ModellHinzufuegenDialogProps {
  offen: boolean
  onOffenChange: (offen: boolean) => void
  /** true = angelegt (Dialog schliesst), false = Fehler (bleibt offen). */
  onHinzufuegen: (modelId: string) => Promise<boolean>
}

export function ModellHinzufuegenDialog({ offen, onOffenChange, onHinzufuegen }: ModellHinzufuegenDialogProps) {
  const [frage, setFrage] = useState("")
  const [treffer, setTreffer] = useState<KatalogEintrag[]>([])
  const [fehler, setFehler] = useState<string | null>(null)
  const [laedt, setLaedt] = useState(false)
  const [anlegen, setAnlegen] = useState<string | null>(null)

  useEffect(() => {
    if (!offen) { setFrage(""); setTreffer([]); setFehler(null) }
  }, [offen])

  // Suche mit kurzer Pause nach dem Tippen; aeltere Antworten werden verworfen.
  useEffect(() => {
    const text = frage.trim()
    if (text.length < 2) { setTreffer([]); setFehler(null); return }
    let gueltig = true
    const zeitgeber = setTimeout(() => {
      setLaedt(true)
      sucheImKatalog(text)
        .then((ergebnis) => { if (gueltig) { setTreffer(ergebnis); setFehler(null) } })
        .catch((error: unknown) => {
          console.error("[ModellHinzufuegenDialog] Katalog-Suche fehlgeschlagen:", error)
          if (gueltig) setFehler(error instanceof Error ? error.message : String(error))
        })
        .finally(() => { if (gueltig) setLaedt(false) })
    }, 300)
    return () => { gueltig = false; clearTimeout(zeitgeber) }
  }, [frage])

  const waehlen = async (modelId: string) => {
    setAnlegen(modelId)
    const ok = await onHinzufuegen(modelId)
    setAnlegen(null)
    if (ok) onOffenChange(false)
  }

  return (
    <Dialog open={offen} onOpenChange={onOffenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Modell hinzufügen</DialogTitle>
          <DialogDescription>
            Suche im OpenRouter-Katalog, über den der Secretary die Modelle anspricht. Ein neues Modell
            startet abgeschaltet; aktiv schalten lässt es sich nach einer erfolgreichen Probe.
          </DialogDescription>
        </DialogHeader>
        <Input autoFocus placeholder="z. B. deepseek flash" value={frage} onChange={(e) => setFrage(e.target.value)} />
        {fehler && <p className="text-sm text-destructive">Katalog nicht erreichbar: {fehler}</p>}
        {laedt && <p className="text-sm text-muted-foreground">Sucht…</p>}
        {!laedt && !fehler && frage.trim().length >= 2 && treffer.length === 0 && (
          <p className="text-sm text-muted-foreground">Kein Treffer, der noch nicht in der Liste steht.</p>
        )}
        <div className="max-h-96 overflow-y-auto divide-y">
          {treffer.map((t) => (
            <div key={t.modelId} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{t.name}</div>
                <div className="text-xs text-muted-foreground font-mono truncate">{t.modelId}</div>
                <div className="text-xs text-muted-foreground">
                  {formatPreis(t.preisEin, t.preisAus)} je 1 Mio. Token · Kontext {formatKontext(t.kontext)}
                </div>
              </div>
              <Button type="button" size="sm" className="shrink-0" disabled={anlegen !== null} onClick={() => void waehlen(t.modelId)} title="In die Liste aufnehmen">
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{anlegen === t.modelId ? "Legt an…" : "Hinzufügen"}</span>
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
