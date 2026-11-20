"use client"

/**
 * Zustand und Aktionen der Konto-Seite „Sprachmodelle". Spricht nur mit
 * `/api/admin/llm-models/**`. Nach jeder Aenderung wird auch die Modell-Liste
 * der Auswahlfelder (Story-Modus, Library-Einstellungen) neu geladen.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useState } from "react"
import { toast } from "@ks/ui"
import type { KatalogEintrag, ModellProbe, SprachmodellAenderung, SprachmodellListe } from "@/types/sprachmodell"

const BASE = "/api/admin/llm-models"
const LISTE_KEY = ["sprachmodelle-admin"]

async function lesen<T>(antwort: Response): Promise<T> {
  if (!antwort.ok) {
    const body = (await antwort.json().catch((error: unknown) => {
      console.debug("[useSprachmodelle] Fehlerantwort ohne JSON:", error)
      return null
    })) as { error?: string } | null
    throw new Error(body?.error ?? `HTTP ${antwort.status}`)
  }
  return (await antwort.json()) as T
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

export async function sucheImKatalog(frage: string): Promise<KatalogEintrag[]> {
  const daten = await lesen<{ treffer: KatalogEintrag[] }>(await fetch(`${BASE}/katalog?q=${encodeURIComponent(frage)}`))
  return daten.treffer
}

export function useSprachmodelle() {
  const queryClient = useQueryClient()
  const liste = useQuery({ queryKey: LISTE_KEY, queryFn: async () => lesen<SprachmodellListe>(await fetch(BASE)), retry: false })
  const [beschaeftigt, setBeschaeftigt] = useState<string | null>(null)

  /** Fuehrt eine Aktion aus, uebernimmt die neue Liste und meldet Fehler laut. */
  const ausfuehren = useCallback(
    async <T,>(kennung: string, aktion: () => Promise<T>, neueListe: (ergebnis: T) => SprachmodellListe): Promise<T | null> => {
      setBeschaeftigt(kennung)
      try {
        const ergebnis = await aktion()
        queryClient.setQueryData(LISTE_KEY, neueListe(ergebnis))
        await queryClient.invalidateQueries({ queryKey: ["ks-api-client", "llm-models"] })
        return ergebnis
      } catch (error) {
        console.error("[useSprachmodelle] Aktion fehlgeschlagen:", kennung, error)
        toast({ title: "Nicht gespeichert", description: error instanceof Error ? error.message : String(error), variant: "destructive" })
        return null
      } finally {
        setBeschaeftigt(null)
      }
    },
    [queryClient],
  )

  const hinzufuegen = (modelId: string) =>
    ausfuehren(modelId, async () => lesen<SprachmodellListe>(await fetch(BASE, json("POST", { modelId }))), (l) => l)

  const aendern = (modelId: string, aenderung: SprachmodellAenderung) =>
    ausfuehren(modelId, async () => lesen<SprachmodellListe>(await fetch(BASE, json("PATCH", { modelId, ...aenderung }))), (l) => l)

  const ordnen = (modelIds: string[]) =>
    ausfuehren("reihenfolge", async () => lesen<SprachmodellListe>(await fetch(`${BASE}/reihenfolge`, json("PUT", { modelIds }))), (l) => l)

  const probe = async (modelId: string): Promise<ModellProbe | null> => {
    const ergebnis = await ausfuehren(
      modelId,
      async () => lesen<{ probe: ModellProbe; liste: SprachmodellListe }>(await fetch(`${BASE}/probe`, json("POST", { modelId }))),
      (e) => e.liste,
    )
    if (ergebnis && !ergebnis.probe.ok) {
      toast({ title: "Probe gescheitert", description: ergebnis.probe.fehler ?? "Ohne Meldung", variant: "destructive" })
    }
    return ergebnis?.probe ?? null
  }

  return {
    daten: liste.data ?? null,
    ladeFehler: liste.isError ? (liste.error instanceof Error ? liste.error.message : String(liste.error)) : null,
    beschaeftigt,
    hinzufuegen,
    aendern,
    ordnen,
    probe,
  }
}
