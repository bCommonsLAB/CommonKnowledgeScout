/**
 * Sprung auf eine Seite in der Detailansicht (D7).
 *
 * Markdown-Ansichten tragen Anker `[data-page-marker="n"]` (injectPageAnchors
 * in @ks/viewers und MarkdownPreview der App), der PDF-Viewer `[data-page="n"]`.
 * Der Inhalt laedt nach — darum mehrere Versuche; findet sich kein Anker
 * (Quelle ohne Seiten), bleibt die Ansicht am Anfang und meldet es einmal.
 */

import { useEffect, type RefObject } from 'react'

const VERSUCHE_MS = [0, 300, 800, 1500, 3000]

export function seitenAnker(wurzel: ParentNode, page: number): HTMLElement | null {
  return (
    wurzel.querySelector<HTMLElement>(`[data-page-marker="${page}"]`) ??
    wurzel.querySelector<HTMLElement>(`[data-page="${page}"]`)
  )
}

export function useSeitenSprung(
  page: number | undefined,
  wurzelRef: RefObject<HTMLElement | null>,
  bereit: boolean,
): void {
  useEffect(() => {
    if (page === undefined || !bereit) return
    const timer: ReturnType<typeof setTimeout>[] = []
    let erledigt = false
    const versuch = (letzter: boolean) => {
      if (erledigt) return
      const wurzel = wurzelRef.current
      const viewport = wurzel?.querySelector<HTMLElement>('[data-radix-scroll-area-viewport]') ?? wurzel
      if (!viewport) return
      const el = seitenAnker(viewport, page)
      if (el) {
        erledigt = true
        const top = el.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop - 8
        viewport.scrollTo({ top: Math.max(0, top), behavior: 'auto' })
      } else if (letzter) {
        console.warn('[DetailOverlay] Kein Seitenanker gefunden — Quelle ohne Seiten oder Inhalt nicht geladen', { page })
      }
    }
    VERSUCHE_MS.forEach((ms, i) => timer.push(setTimeout(() => versuch(i === VERSUCHE_MS.length - 1), ms)))
    return () => timer.forEach(clearTimeout)
  }, [page, bereit, wurzelRef])
}
