'use client'

/**
 * @fileoverview Arbeitslisten-Steuerung der Werkbank (F7, Welle W6).
 *
 * @description
 * Sichtbar im Filter-Modus „Liste": Auswahl der eigenen Listen (privat je
 * User), Anlegen mit optionalem Seeding („Vorhaben mit `status: aktiv`
 * uebernehmen" — einmalige Kopie aus dem erklaerten Buch, danach bewusst
 * NICHT synchron) und Loeschen (zweistufig, ohne window.confirm). Fehler der
 * Routen (409 `name_vergeben` etc.) erscheinen als Klartext, nichts wird
 * still geschluckt.
 *
 * @module components/library/agent-view
 */

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { useWorklists, Worklist } from '@/hooks/agent-view/use-worklists'
import type { WorklistFolderEntry } from '@/lib/repositories/agent-view-worklists-repo'

export function WerkbankListenLeiste({
  lists,
  aktiveListeId,
  onWaehleListe,
  worklists,
  seedKandidaten,
}: {
  lists: readonly Worklist[]
  aktiveListeId: string | null
  onWaehleListe: (listId: string | null) => void
  worklists: ReturnType<typeof useWorklists>
  /** Karten mit `berichtStatus: aktiv` als Seeding-Kopie (F7). */
  seedKandidaten: () => Omit<WorklistFolderEntry, 'addedAt'>[]
}) {
  const [neuOffen, setNeuOffen] = useState(false)
  const [neuName, setNeuName] = useState('')
  const [mitSeed, setMitSeed] = useState(false)
  const [loeschenBestaetigen, setLoeschenBestaetigen] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  const anlegen = async () => {
    const name = neuName.trim()
    if (name === '') return
    setFehler(null)
    try {
      const ergebnis = await worklists.anlegen.mutateAsync({
        name,
        folders: mitSeed ? seedKandidaten() : [],
      })
      setNeuOffen(false)
      setNeuName('')
      setMitSeed(false)
      onWaehleListe(ergebnis.list.listId)
    } catch (error) {
      setFehler(error instanceof Error ? error.message : String(error))
    }
  }

  const loeschen = async () => {
    if (aktiveListeId === null) return
    setFehler(null)
    try {
      await worklists.loeschen.mutateAsync(aktiveListeId)
      setLoeschenBestaetigen(false)
      onWaehleListe(null)
    } catch (error) {
      setFehler(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <div className="space-y-1.5 border-b px-2 py-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          aria-label="Arbeitsliste waehlen"
          value={aktiveListeId ?? ''}
          onChange={(event) => onWaehleListe(event.target.value === '' ? null : event.target.value)}
          className="h-7 min-w-0 flex-1 rounded-md border bg-background px-1.5 text-xs"
        >
          <option value="">Liste waehlen …</option>
          {lists.map((liste) => (
            <option key={liste.listId} value={liste.listId}>
              {liste.name} ({liste.folders.length})
            </option>
          ))}
        </select>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setNeuOffen((offen) => !offen)}>
          <Plus className="mr-1 h-3 w-3" aria-hidden /> Neu
        </Button>
        {aktiveListeId !== null && !loeschenBestaetigen && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-1.5"
            aria-label="Aktive Liste loeschen"
            onClick={() => setLoeschenBestaetigen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </Button>
        )}
        {loeschenBestaetigen && (
          <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={() => void loeschen()}>
            Wirklich loeschen? (Report und Archiv bleiben unberuehrt)
          </Button>
        )}
      </div>

      {neuOffen && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Input
            value={neuName}
            onChange={(event) => setNeuName(event.target.value)}
            placeholder="Name der neuen Liste"
            aria-label="Name der neuen Liste"
            className="h-7 min-w-0 flex-1 text-xs"
          />
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            <input type="checkbox" checked={mitSeed} onChange={(event) => setMitSeed(event.target.checked)} />
            Vorhaben mit status: aktiv uebernehmen
          </label>
          <Button size="sm" className="h-7 text-xs" disabled={neuName.trim() === ''} onClick={() => void anlegen()}>
            Anlegen
          </Button>
        </div>
      )}

      {fehler !== null && <p className="text-xs text-red-500">{fehler}</p>}
    </div>
  )
}
