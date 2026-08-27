'use client'

/**
 * @fileoverview Themen-Editor des Vorhaben-Kopfs (Welle A6).
 *
 * @description
 * Popover in Zeile 2: die zugewiesenen Themen als entfernbare Chips, ein
 * Dropdown mit dem kuratierten Vokabular (Einstellungen ∪ bereits
 * vergebene — normalisieren statt frei tippen) und ein Feld fuer ein neues
 * Thema. „Speichern" schreibt die KOMPLETTE Liste ueber die Themen-Route
 * ins `_INDEX.md`. Bei Reports aus Scans vor A6 ist Speichern gesperrt und
 * der Grund benannt — sonst wuerden unbekannte Bestands-Themen stumm
 * ueberschrieben (`no-silent-fallbacks.mdc`).
 *
 * @module components/library/agent-view
 */

import { useState } from 'react'
import { Loader2, Tags, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { UseThemenResult } from '@/hooks/agent-view/use-themen'

export function ThemenEditor({ folderId, aktuelle, vokabular, themen }: {
  folderId: string
  /** Zugewiesene Themen (effektiv); undefined = Report aus einem Scan vor A6. */
  aktuelle: string[] | undefined
  vokabular: readonly string[]
  themen: UseThemenResult
}) {
  const [auf, setAuf] = useState(false)
  const [entwurf, setEntwurf] = useState<string[]>([])
  const [neu, setNeu] = useState('')
  const pending = themen.pendingFolderId === folderId
  const fehler = themen.fehlerByFolder.get(folderId)
  const sperrGrund =
    aktuelle === undefined
      ? 'Report aus einem Scan vor A6 — erst „Neu scannen", sonst wuerden bestehende Themen ueberschrieben.'
      : null

  const oeffnen = (offen: boolean) => {
    setAuf(offen)
    if (offen) {
      setEntwurf(aktuelle ?? [])
      setNeu('')
    }
  }

  const fuegeHinzu = (thema: string) => {
    const wert = thema.trim()
    if (wert === '' || entwurf.includes(wert)) return
    setEntwurf([...entwurf, wert])
    setNeu('')
  }

  const speichere = async () => {
    if (await themen.setzeThemen(folderId, entwurf)) setAuf(false)
  }

  const auswaehlbar = vokabular.filter((thema) => !entwurf.includes(thema))

  return (
    <Popover open={auf} onOpenChange={oeffnen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-6 text-xs">
          <Tags className="mr-1 h-3 w-3" aria-hidden />
          Themen ({aktuelle === undefined ? '?' : aktuelle.length})
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-2 p-3 text-xs">
        <p className="font-semibold">Gepflegte Themen (themen: im _INDEX.md)</p>

        {sperrGrund !== null && <p className="text-amber-700 dark:text-amber-400">{sperrGrund}</p>}

        <div className="flex flex-wrap gap-1">
          {entwurf.length === 0 && <span className="text-muted-foreground">Keine Themen zugewiesen.</span>}
          {entwurf.map((thema) => (
            <span key={thema} className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5">
              {thema}
              <button
                type="button"
                aria-label={`Thema ${thema} entfernen`}
                onClick={() => setEntwurf(entwurf.filter((eintrag) => eintrag !== thema))}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </span>
          ))}
        </div>

        <select
          aria-label="Thema aus dem Vokabular hinzufuegen"
          value=""
          disabled={pending || auswaehlbar.length === 0}
          onChange={(event) => fuegeHinzu(event.target.value)}
          className="h-7 w-full rounded-md border bg-background px-1.5 text-xs text-muted-foreground"
        >
          <option value="">
            {auswaehlbar.length === 0 ? 'Vokabular aufgebraucht — unten neu anlegen' : 'Thema hinzufuegen …'}
          </option>
          {auswaehlbar.map((thema) => (
            <option key={thema} value={thema}>{thema}</option>
          ))}
        </select>

        <div className="flex gap-1.5">
          <Input
            value={neu}
            onChange={(event) => setNeu(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                fuegeHinzu(neu)
              }
            }}
            placeholder="Neues Thema …"
            className="h-7 text-xs"
            aria-label="Neues Thema"
          />
          <Button variant="outline" size="sm" className="h-7 text-xs" disabled={neu.trim() === ''} onClick={() => fuegeHinzu(neu)}>
            Aufnehmen
          </Button>
        </div>
        <p className="text-muted-foreground">
          Das Vokabular pflegst du in den Library-Einstellungen (Agentensicht) — dort normalisierst du die Namen.
        </p>

        {fehler && <p className="text-red-600" role="alert">{fehler}</p>}

        <div className="flex justify-end gap-1.5 border-t pt-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAuf(false)}>
            Abbrechen
          </Button>
          <Button size="sm" className="h-7 text-xs" disabled={pending || sperrGrund !== null} onClick={() => void speichere()}>
            {pending && <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden />}
            Speichern
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
