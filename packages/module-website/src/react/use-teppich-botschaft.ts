'use client'

/**
 * Botschaft der Teppich-Animation (Plan `teppich-der-dokumente`, Owner 22.11.2026).
 *
 * Erklaert in Worten, was der Hintergrund zeigt: Dokumente werden durchsucht, passende gefunden,
 * gewichtet, die Antwort entsteht — und zum Schluss die Storyline, die Liste der Belege, auf die
 * sich die Antwort stuetzt. Die Stufe rueckt hoechstens um eins je `STUFE_MS` vor, bis sie den Stand
 * der Server-Meldungen (`botschaftsStufe`) erreicht; sonst blitzten Zwischenschritte nur auf.
 *
 * Owner 23.11.2026: ein Titel („Ihre Antwort wird berechnet") und darunter die Schritte als Liste,
 * die von oben nach unten waechst — die erledigten bleiben stehen, der laufende ist der letzte.
 */

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '@ks/i18n/react'
import type { ChatProcessingStep } from '@ks/contracts'
import { botschaftsStufe, type BotschaftsStufe, type TeppichPhase } from '..'

const STUFE_MS = 1400
const SCHLUESSEL = ['website.story.teppich.suche', 'website.story.teppich.gefunden', 'website.story.teppich.gewichtet', 'website.story.teppich.schreiben'] as const

export interface TeppichBotschaft {
  titel: string
  /** Die Schritte bis zum laufenden, in ihrer Reihenfolge; der letzte ist der laufende. */
  schritte: string[]
}

export function useTeppichBotschaft(
  phase: TeppichPhase, schritte: readonly ChatProcessingStep[], kandidaten: number, belege: number,
): TeppichBotschaft | undefined {
  const { t } = useTranslation()
  const [stufe, setStufe] = useState<BotschaftsStufe>(0)
  const ziel = botschaftsStufe(schritte)

  useEffect(() => {
    if (phase !== 'sucht') { setStufe(0); return }
    if (stufe >= ziel) return
    const id = setTimeout(() => setStufe((s) => (s < 3 ? ((s + 1) as BotschaftsStufe) : s)), STUFE_MS)
    return () => clearTimeout(id)
  }, [phase, stufe, ziel])

  // Die Zahl der gefundenen Dokumente bleibt in der Liste stehen, auch wenn die Meldungen der Suche
  // in der Storyline schon geleert sind (sonst stuende dort „0 Dokumente gefunden").
  const gefunden = useRef(0)
  if (phase !== 'sucht' && phase !== 'landet') { gefunden.current = 0; return undefined }
  gefunden.current = Math.max(gefunden.current, kandidaten)
  const bis = phase === 'landet' ? SCHLUESSEL.length - 1 : stufe
  const zeilen = SCHLUESSEL.slice(0, bis + 1).map((k) => t(k, { count: gefunden.current }))
  if (phase === 'landet') zeilen.push(t('website.story.teppich.storyline', { count: belege }))
  return { titel: t('website.story.teppich.titel'), schritte: zeilen }
}
