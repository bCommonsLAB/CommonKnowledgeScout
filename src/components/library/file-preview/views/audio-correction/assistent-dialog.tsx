'use client'

/**
 * Dialog „Vorschlaege holen" des Korrektur-Assistenten: Begleitdokumente
 * waehlen und den Auftrag an die KI lesen und aendern — damit klar ist, was
 * gefragt wird (Owner 10.10.2026). Das Antwortformat haengt der Server an.
 */

import * as React from 'react'
import { Button, Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Label, Textarea } from '@ks/ui'
import { Loader2, RotateCcw, Sparkles } from 'lucide-react'
import { STANDARD_AUFTRAG } from '@/lib/transkript-korrektur/assistent-auftrag'
import type { BegleitQuelle } from './use-audio-correction'

interface Props {
  offen: boolean
  onOffenChange: (offen: boolean) => void
  quellen: BegleitQuelle[]
  onQuellenChange: (quellen: BegleitQuelle[]) => void
  auftrag: string
  onAuftragChange: (text: string) => void
  laeuft: boolean
  fehler: string | null
  /** Startet den Lauf; true = erfolgreich (Dialog schliesst). */
  onHolen: (begleitSourceIds: string[]) => Promise<boolean>
  /** Wie viele Vorschlaege noch offen sind — ein neuer Lauf ersetzt sie. */
  offeneVorschlaege: number
}

export function AssistentDialog(p: Props) {
  const gewaehlt = p.quellen.filter((q) => q.gewaehlt)
  const holen = async () => {
    if (await p.onHolen(gewaehlt.map((q) => q.id))) p.onOffenChange(false)
  }
  return (
    <Dialog open={p.offen} onOpenChange={(o) => { if (!p.laeuft) p.onOffenChange(o) }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Vorschlaege holen</DialogTitle>
          <DialogDescription>
            Die KI liest das Transkript Satz fuer Satz und schlaegt Korrekturen und Sprecherwechsel vor. Sie erscheinen im Text,
            du uebernimmst sie mit einem Klick. Namen nur aus den gewaehlten Begleitdokumenten.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="text-sm font-medium">Begleitdokumente (Einladung, Programm, Folien)</div>
          {p.quellen.length === 0 ? (
            <p className="text-xs text-muted-foreground">Keine Begleitdokumente im Ordner — dann ohne Personennamen, nur &bdquo;Publikum&ldquo; und &bdquo;Moderation&ldquo;.</p>
          ) : (
            <ul className="max-h-40 space-y-1 overflow-auto">
              {p.quellen.map((q) => (
                <li key={q.id} className="flex items-center gap-2 text-sm">
                  <Checkbox id={`begleit-${q.id}`} checked={q.gewaehlt} disabled={!q.hatTranskript || p.laeuft}
                    onCheckedChange={(v) => p.onQuellenChange(p.quellen.map((x) => (x.id === q.id ? { ...x, gewaehlt: v === true } : x)))} />
                  <Label htmlFor={`begleit-${q.id}`} className={q.hatTranskript ? 'cursor-pointer' : 'text-muted-foreground'}>
                    {q.name}{!q.hatTranskript && <span className="ml-2 text-xs">(noch nicht transkribiert)</span>}
                  </Label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label htmlFor="assistent-auftrag" className="text-sm font-medium">Auftrag an die KI</Label>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={p.laeuft || p.auftrag === STANDARD_AUFTRAG}
              onClick={() => p.onAuftragChange(STANDARD_AUFTRAG)} title="Den urspruenglichen Auftrag wiederherstellen">
              <RotateCcw className="mr-1 h-3.5 w-3.5" /> Standard
            </Button>
          </div>
          <Textarea id="assistent-auftrag" rows={12} value={p.auftrag} disabled={p.laeuft} className="text-xs"
            onChange={(e) => p.onAuftragChange(e.target.value)} />
          <p className="text-[11px] text-muted-foreground">Dazu bekommt die KI die nummerierten Saetze und die gewaehlten Begleitdokumente. Aenderungen am Auftrag merkt sich der Browser fuer diese Library.</p>
        </div>

        {p.fehler && <p className="text-sm text-destructive">{p.fehler}</p>}

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {p.offeneVorschlaege > 0 ? `${p.offeneVorschlaege} offene Vorschlaege werden ersetzt.` : ''}
          </span>
          <Button onClick={() => void holen()} disabled={p.laeuft || p.auftrag.trim() === ''}>
            {p.laeuft ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {p.laeuft ? 'KI liest das Transkript …' : `Vorschlaege holen (${gewaehlt.length} Dokumente)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
