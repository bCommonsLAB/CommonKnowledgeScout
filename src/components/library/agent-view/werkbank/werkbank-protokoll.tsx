'use client'

/**
 * @fileoverview Aktions-Protokoll eines Vorhabens — das WARUM, lesbar.
 *
 * @description
 * Agenten begruenden seit Werkzeugsatz 2.6.0 jede schreibende Aktion; die
 * Begruendung liegt in der Datenbank statt in einer handgepflegten
 * `ORDNUNGSZUSTAND.md` im Archiv. Dieser Reiter macht sie sichtbar — sonst
 * waere das Gedaechtnis nur ueber die Bruecke abrufbar (Rueckfrage
 * 27.08.2026).
 *
 * Fehlversuche stehen ausdruecklich mit drin: Wer spaeter fragt, warum
 * dreimal dasselbe versucht wurde, findet es hier.
 *
 * @module components/library/agent-view
 */

import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import type { AktionsProtokollEintrag } from '@/lib/repositories/aktions-protokoll-repo'
import { SpeicherFehler } from './speicher-fehler'

async function ladeProtokoll(libraryId: string, folderId: string): Promise<AktionsProtokollEintrag[]> {
  const url = `/api/library/${encodeURIComponent(libraryId)}/agent-view/protokoll?folderId=${encodeURIComponent(folderId)}`
  const response = await fetch(url)
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `HTTP ${response.status}`)
  }
  const body = (await response.json()) as { eintraege?: AktionsProtokollEintrag[] }
  if (!Array.isArray(body.eintraege)) throw new Error('Antwort ohne eintraege')
  return body.eintraege
}

function Zeitpunkt({ iso }: { iso: string }) {
  const datum = new Date(iso)
  const lesbar = Number.isNaN(datum.getTime()) ? iso : datum.toLocaleString('de-DE')
  return <span className="tabular-nums text-muted-foreground" title={iso}>{lesbar}</span>
}

function Eintrag({ eintrag }: { eintrag: AktionsProtokollEintrag }) {
  const fehlgeschlagen = eintrag.status === 'fehler'
  return (
    <li className={`rounded-md border p-2 ${fehlgeschlagen ? 'border-red-300/60 bg-red-500/5' : ''}`}>
      <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
        <code className="font-medium text-foreground">{eintrag.werkzeug}</code>
        <Zeitpunkt iso={eintrag.createdAt} />
        <span className="text-muted-foreground">{eintrag.akteur}</span>
        {fehlgeschlagen && <span className="font-medium text-red-600">fehlgeschlagen</span>}
      </div>
      <p className="mt-1 text-sm">{eintrag.begruendung}</p>
      {fehlgeschlagen && eintrag.fehler && (
        <p className="mt-1 text-xs text-red-700 dark:text-red-400">{eintrag.fehler}</p>
      )}
    </li>
  )
}

export function WerkbankProtokoll({ libraryId, folderId }: { libraryId: string; folderId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['agent-view-protokoll', libraryId, folderId],
    queryFn: () => ladeProtokoll(libraryId, folderId),
  })

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Lade Protokoll...
      </p>
    )
  }
  if (error) return <SpeicherFehler titel="Protokoll nicht ladbar" error={error} />

  if (!data || data.length === 0) {
    return (
      <div className="space-y-1 text-sm text-muted-foreground">
        <p>Für dieses Vorhaben ist noch nichts protokolliert.</p>
        <p className="text-xs">
          Das Protokoll entsteht, sobald ein Agent über die Brücke schreibt — jede Aktion trägt dort
          eine Begründung. Deine eigenen Klicks in der Werkbank stehen bewusst nicht darin.
        </p>
      </div>
    )
  }

  return (
    <ul className="space-y-2">
      {data.map((eintrag, idx) => (
        <Eintrag key={`${eintrag.createdAt}-${idx}`} eintrag={eintrag} />
      ))}
    </ul>
  )
}
