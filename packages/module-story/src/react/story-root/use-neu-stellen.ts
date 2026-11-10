/**
 * Nach „Mit dieser Perspektive starten" die zuletzt gezeigte Frage mit den
 * neuen Einstellungen neu stellen (10.11.2026). Vorher musste die Person die
 * Frage ueber „Erneut fragen" ins Eingabefeld zurueckholen und absenden.
 *
 * Ausloeser ist ausdruecklich der Zaehler des Dialogs
 * (`storyPerspektiveGespeichertAtom`), NICHT jede Aenderung der Perspektive:
 * Beim Laden einer Seite wechselt sie auch ohne Zutun der Person (Profil,
 * localStorage), und jede Frage kostet einen Modellaufruf.
 *
 * Gesendet wird nur, wenn sich der Stand (Filter + Perspektive) seit dem
 * Speichern wirklich geaendert hat und eine Frage gezeigt wird. Laeuft gerade
 * eine Antwort, wartet die neue Frage, bis sie da ist.
 */

import { useEffect, useRef } from 'react'
import { useAtomValue } from 'jotai'
import { storyPerspektiveGespeichertAtom } from '../atoms'

export interface UseNeuStellenParams {
  /** Schluessel aus Filter und Perspektive (`useStoryKonversation().stand`). */
  stand: string
  laeuft: boolean
  /** Text der zuletzt gezeigten Frage; `null`, wenn keine gezeigt wird. */
  frage: string | null
  frageSenden: (text: string) => Promise<void>
}

/** Reine Entscheidung, getrennt vom Hook pruefbar. */
export function neuStellenEntscheiden(a: {
  zaehler: number
  gemerkt: { zaehler: number; stand: string }
  stand: string
  laeuft: boolean
  frage: string | null
}): { merken: { zaehler: number; stand: string } | null; senden: string | null } {
  // Kein Speichern seit dem letzten Blick: nur den Stand nachfuehren.
  if (a.zaehler === a.gemerkt.zaehler) return { merken: { zaehler: a.zaehler, stand: a.stand }, senden: null }
  // Gespeichert, aber eine Antwort laeuft noch: nichts merken, spaeter erneut pruefen.
  if (a.laeuft) return { merken: null, senden: null }
  const geaendert = a.stand !== a.gemerkt.stand
  return { merken: { zaehler: a.zaehler, stand: a.stand }, senden: geaendert ? a.frage : null }
}

export function useNeuStellen(p: UseNeuStellenParams): void {
  const zaehler = useAtomValue(storyPerspektiveGespeichertAtom)
  const gemerkt = useRef({ zaehler, stand: p.stand })
  const { stand, laeuft, frage, frageSenden } = p
  useEffect(() => {
    const e = neuStellenEntscheiden({ zaehler, gemerkt: gemerkt.current, stand, laeuft, frage })
    if (e.merken) gemerkt.current = e.merken
    if (e.senden) void frageSenden(e.senden)
  }, [zaehler, stand, laeuft, frage, frageSenden])
}
