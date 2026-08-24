'use client'

/**
 * @fileoverview URL-Zustand der Werkbank — gebuendelt (F6/F12/F7).
 *
 * @description
 * Alle Werkbank-Filter wohnen in der URL (`nuqs`, §F6: die Arbeitssituation
 * ist teilbar und uebersteht Reload, Akzeptanzkriterium 5): Auswahl,
 * Status-/Akteur-/Schritt-Filter, Suche (gedrosselt), Sortierung,
 * Gruppierung (W5) und aktive Arbeitsliste (W6). Aus dem Panel extrahiert
 * (W8, Zeilenbudget) — reine Buendelung, keine neue Semantik.
 *
 * @module hooks/agent-view
 */

import { parseAsNumberLiteral, parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs'
import type { WerkbankGruppierung } from '@/lib/agent-view/werkbank-gruppen'

const STATUS_WERTE = ['alle', 'zu_tun', 'bereit', 'liste'] as const
const SORT_WERTE = ['pfad', 'stand', 'befunde'] as const
const AKTEUR_WERTE = ['mensch', 'cowork', 'knowledgescout'] as const
const SCHRITT_WERTE = [1, 2, 3, 4] as const
const GRUPPIERUNG_WERTE: readonly WerkbankGruppierung[] = ['bereich', 'thema'] as const

export function useWerkbankUrlState() {
  const [vorhabenId, setVorhabenId] = useQueryState('vorhaben', parseAsString)
  const [statusFilter, setStatusFilter] = useQueryState(
    'filter',
    parseAsStringLiteral(STATUS_WERTE).withDefault('zu_tun'),
  )
  const [akteur, setAkteur] = useQueryState('akteur', parseAsStringLiteral(AKTEUR_WERTE))
  const [schritt, setSchritt] = useQueryState('schritt', parseAsNumberLiteral(SCHRITT_WERTE))
  const [suche, setSuche] = useQueryState(
    'q',
    parseAsString.withDefault('').withOptions({ throttleMs: 300 }),
  )
  const [sortierung, setSortierung] = useQueryState(
    'sort',
    parseAsStringLiteral(SORT_WERTE).withDefault('pfad'),
  )
  // F12 (W5): zweite Gruppierungs-Ebene „Thema" — teilbar wie alle Filter.
  const [gruppierung, setGruppierung] = useQueryState(
    'gruppierung',
    parseAsStringLiteral(GRUPPIERUNG_WERTE).withDefault('bereich'),
  )
  // W6 (F7): aktive Arbeitsliste im Filter-Modus „liste".
  const [listeId, setListeId] = useQueryState('liste', parseAsString)

  return {
    vorhabenId, setVorhabenId, statusFilter, setStatusFilter, akteur, setAkteur,
    schritt, setSchritt, suche, setSuche, sortierung, setSortierung,
    gruppierung, setGruppierung, listeId, setListeId,
  }
}
