/**
 * @fileoverview Hook der Verwaltungssicht „Fragen & Antworten": laden, suchen, filtern, verwerfen.
 *
 * @description
 * Liest GET /api/chat/[libraryId]/queries/admin (Seite, Suche, Filter) und
 * verwirft Antworten über POST .../queries/invalidate. Nach jedem Verwerfen
 * wird die Liste neu geladen — die Zeile bleibt (Chronik), nur ihr Stand
 * wechselt auf „verworfen". Fehler kommen als Text zurück, nie als stiller
 * Leerzustand.
 *
 * @module settings
 */

import { useCallback, useEffect, useState } from 'react'
import { useToast } from '@ks/ui'
import type { FragenLogSeite } from '@/lib/chat/verwaltung/fragen-log-sicht'

export interface FragenLogAntwort extends FragenLogSeite {
  gesamtTreffer: number
}

export interface FragenLogFilterUi {
  suche: string
  nurVeraltete: boolean
  nurTreffer: boolean
}

const PRO_SEITE = 25

async function fehlerText(res: Response, vorgabe: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown }
    return typeof body.error === 'string' ? body.error : vorgabe
  } catch {
    return vorgabe
  }
}

export function useFragenLog(libraryId: string) {
  const { toast } = useToast()
  const [daten, setDaten] = useState<FragenLogAntwort | null>(null)
  const [laden, setLaden] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)
  const [verbotene, setVerbotene] = useState(false)
  const [seite, setSeite] = useState(1)
  const [filter, setFilterState] = useState<FragenLogFilterUi>({ suche: '', nurVeraltete: false, nurTreffer: false })
  const [verwirft, setVerwirft] = useState<string | 'alle' | null>(null)

  const laedt = useCallback(async () => {
    setLaden(true)
    setFehler(null)
    try {
      const q = new URLSearchParams({ seite: String(seite), proSeite: String(PRO_SEITE) })
      if (filter.suche.trim()) q.set('suche', filter.suche.trim())
      if (filter.nurVeraltete) q.set('nurVeraltete', 'true')
      if (filter.nurTreffer) q.set('nurTreffer', 'true')
      const res = await fetch(`/api/chat/${libraryId}/queries/admin?${q.toString()}`)
      if (res.status === 403) {
        setVerbotene(true)
        return
      }
      if (!res.ok) throw new Error(await fehlerText(res, `Laden fehlgeschlagen (${res.status})`))
      setDaten((await res.json()) as FragenLogAntwort)
    } catch (e) {
      setFehler(e instanceof Error ? e.message : String(e))
    } finally {
      setLaden(false)
    }
  }, [libraryId, seite, filter])

  useEffect(() => {
    void laedt()
  }, [laedt])

  const setFilter = useCallback((patch: Partial<FragenLogFilterUi>) => {
    setSeite(1)
    setFilterState((f) => ({ ...f, ...patch }))
  }, [])

  const verwerfe = useCallback(
    async (auftrag: { queryIds: string[] } | { alle: true }) => {
      const kennung = 'alle' in auftrag ? 'alle' : auftrag.queryIds[0]
      setVerwirft(kennung)
      try {
        const res = await fetch(`/api/chat/${libraryId}/queries/invalidate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(auftrag),
        })
        if (!res.ok) throw new Error(await fehlerText(res, `Verwerfen fehlgeschlagen (${res.status})`))
        const ergebnis = (await res.json()) as { verworfen: number }
        toast({
          title: 'Antworten verworfen',
          description:
            ergebnis.verworfen === 1
              ? '1 Eintrag gilt nicht mehr als gespeicherte Antwort.'
              : `${ergebnis.verworfen} Einträge gelten nicht mehr als gespeicherte Antwort.`,
        })
        await laedt()
      } catch (e) {
        toast({ title: 'Verwerfen fehlgeschlagen', description: e instanceof Error ? e.message : String(e), variant: 'destructive' })
      } finally {
        setVerwirft(null)
      }
    },
    [libraryId, laedt, toast],
  )

  const seiten = daten ? Math.max(1, Math.ceil(daten.gesamt / daten.proSeite)) : 1

  return { daten, laden, fehler, verbotene, seite, seiten, setSeite, filter, setFilter, verwirft, verwerfe, neuLaden: laedt }
}
