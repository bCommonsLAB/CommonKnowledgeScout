'use client'

/**
 * @fileoverview Themen-Zustand der Werkbank (Welle A6) — Memo-Hook.
 *
 * @description
 * Buendelt fuer das Panel: den Schreib-Hook der Themen-Route, die Karten
 * des Reports mit ueberlagerten frischen Themen (`ueberlagereThemen`) und
 * das Dropdown-Vokabular des Editors — die in den Library-Einstellungen
 * kuratierten Themen VEREINT mit den im Archiv bereits vergebenen (nichts
 * verschwindet still, nur weil es nicht im Vokabular steht).
 *
 * @module hooks/agent-view
 */

import { useMemo } from 'react'
import type { CoverageReport, VorhabenCard } from '@/lib/agent-view/types'
import { alleGepflegtenThemen, ueberlagereThemen } from '@/lib/agent-view/werkbank-gruppen'
import { useThemen, type UseThemenResult } from './use-themen'

export interface WerkbankThemen {
  hook: UseThemenResult
  /** Karten des Reports mit ueberlagerten frischen Themen. */
  karten: VorhabenCard[]
  /** Dropdown-Vorrat: Einstellungen ∪ vergebene Themen, alphabetisch. */
  vokabular: string[]
}

export function useWerkbankThemen(
  report: CoverageReport,
  konfigurierteThemen: readonly string[],
): WerkbankThemen {
  const hook = useThemen(report.libraryId)
  const karten = useMemo(
    () => ueberlagereThemen(report.vorhaben, hook.overrides),
    [report.vorhaben, hook.overrides],
  )
  const vokabular = useMemo(
    () =>
      [...new Set([...konfigurierteThemen, ...alleGepflegtenThemen(karten)])].sort((a, b) =>
        a.localeCompare(b),
      ),
    [konfigurierteThemen, karten],
  )
  return { hook, karten, vokabular }
}
