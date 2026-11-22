'use client'

/**
 * Botschaft der Teppich-Animation (Plan `teppich-der-dokumente`, Owner 22.11.2026).
 *
 * Erklaert in Worten, was der Hintergrund zeigt: Dokumente werden durchsucht, passende gefunden,
 * gewichtet, die Antwort entsteht — und zum Schluss die Storyline, die Liste der Belege, auf die
 * sich die Antwort stuetzt. Die Stufe rueckt hoechstens um eins je `STUFE_MS` vor, bis sie den Stand
 * der Server-Meldungen (`botschaftsStufe`) erreicht; sonst blitzten Zwischenschritte nur auf.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from '@ks/i18n/react'
import type { ChatProcessingStep } from '@ks/contracts'
import { botschaftsStufe, type BotschaftsStufe, type TeppichPhase } from '..'

const STUFE_MS = 1400
const SCHLUESSEL = ['website.story.teppich.suche', 'website.story.teppich.gefunden', 'website.story.teppich.gewichtet', 'website.story.teppich.schreiben'] as const

export function useTeppichBotschaft(
  phase: TeppichPhase, schritte: readonly ChatProcessingStep[], kandidaten: number, belege: number,
): string | undefined {
  const { t } = useTranslation()
  const [stufe, setStufe] = useState<BotschaftsStufe>(0)
  const ziel = botschaftsStufe(schritte)

  useEffect(() => {
    if (phase !== 'sucht') { setStufe(0); return }
    if (stufe >= ziel) return
    const id = setTimeout(() => setStufe((s) => (s < 3 ? ((s + 1) as BotschaftsStufe) : s)), STUFE_MS)
    return () => clearTimeout(id)
  }, [phase, stufe, ziel])

  if (phase === 'landet') return t('website.story.teppich.storyline', { count: belege })
  if (phase !== 'sucht') return undefined
  return t(SCHLUESSEL[stufe], { count: kandidaten })
}
