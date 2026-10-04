/**
 * Reine Helfer zwischen Fragenliste, Verlauf und Chronik (D6b; aus
 * `verlauf-utils.ts` und `chronik-utils.ts` der App uebernommen, auf die
 * Formen des Pakets gebracht).
 *
 * `GET …/queries?chatId=` liefert je Frage alles, was eine Nachricht braucht;
 * Themenuebersicht und unbeantwortete Eintraege fallen weg, chronologisch.
 */

import type { DocReference } from '@ks/contracts'
import type { ChronikFrage, StoryAuswahl } from '../types'
import type { FrageAntwort, Nachricht } from './types'

/** Hoechstzahl, die die Liste liefert (Server-Grenze). */
export const VERLAUF_LIMIT = 100

/** Ein Eintrag der Fragenliste, wie `listRecentQueries` ihn projiziert — nur die Felder, die hier gelesen werden. */
export interface VerlaufEintrag {
  queryId: string
  question: string
  shortTitle?: string
  createdAt: string
  answer?: string
  queryType?: string
  references?: unknown[]
  suggestedQuestions?: unknown[]
  cacheParams?: { queryType?: string }
}

export function istBeleg(r: unknown): r is DocReference {
  return typeof r === 'object' && r !== null && 'number' in r && 'fileId' in r && 'description' in r
}

/** Nachrichten des Verlaufs aus der Liste — Frage und Antwort je Eintrag, chronologisch. */
export function verlaufZuNachrichten(items: VerlaufEintrag[]): Nachricht[] {
  const nachrichten: Nachricht[] = []
  for (const item of items) {
    if (typeof item.answer !== 'string') continue
    // cacheParams (neue Eintraege) vor Root-Feldern (alte Eintraege)
    if ((item.cacheParams?.queryType ?? item.queryType) === 'toc') continue
    const createdAt = String(item.createdAt)
    const kurztitel = typeof item.shortTitle === 'string' && item.shortTitle.trim() !== '' ? item.shortTitle : undefined
    nachrichten.push({ id: `${item.queryId}-question`, art: 'frage', text: item.question, createdAt, queryId: item.queryId, kurztitel })
    const belege = Array.isArray(item.references) ? item.references.filter(istBeleg) : []
    const anschlussfragen = Array.isArray(item.suggestedQuestions)
      ? item.suggestedQuestions.filter((q): q is string => typeof q === 'string')
      : []
    nachrichten.push({ id: `${item.queryId}-answer`, art: 'antwort', text: item.answer, createdAt, queryId: item.queryId, belege, anschlussfragen })
  }
  nachrichten.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  return nachrichten
}

/** Frage-Antwort-Paare; die Kennung lautet `<queryId>-<frageId>` wie im Verlauf der App. */
export function paare(nachrichten: Nachricht[]): FrageAntwort[] {
  const ergebnis: FrageAntwort[] = []
  for (let i = 0; i < nachrichten.length; i++) {
    const n = nachrichten[i]
    if (n.art !== 'frage') continue
    const naechste = nachrichten[i + 1]
    const antwort = naechste && naechste.art === 'antwort' ? naechste : undefined
    ergebnis.push({ kennung: n.queryId ? `${n.queryId}-${n.id}` : n.id, frage: n, antwort })
    if (antwort) i++
  }
  return ergebnis
}

/**
 * Fragen der aktiven Sitzung fuer die Chronik, mit Zustand „offen" (D2:
 * „laeuft"). Offen ist nur die letzte Frage ohne Antwort, solange der Stream
 * laeuft — eine abgebrochene Frage bleibt im Verlauf, darf aber nicht ewig
 * als „laeuft" stehen.
 */
export function fragenAusVerlauf(nachrichten: Nachricht[], laeuft: boolean): ChronikFrage[] {
  const p = paare(nachrichten)
  return p.map((paar, i) => ({
    queryId: paar.frage.queryId,
    frageId: paar.frage.id,
    text: paar.frage.text,
    kurztitel: paar.frage.kurztitel,
    createdAt: paar.frage.createdAt,
    offen: laeuft && i === p.length - 1 && paar.antwort === undefined,
  }))
}

/** Die Frage-Nachricht, die eine Konversations-Auswahl meint — oder `null`. */
export function frageZurAuswahl(nachrichten: Nachricht[], auswahl: StoryAuswahl): Nachricht | null {
  if (auswahl.art !== 'konversation') return null
  return (
    nachrichten.find(
      (m) =>
        m.art === 'frage' &&
        ((auswahl.frageId !== undefined && m.id === auswahl.frageId) ||
          (auswahl.queryId !== undefined && m.queryId === auswahl.queryId)),
    ) ?? null
  )
}

/**
 * Nur die Nachrichten der gewaehlten Konversation: die Frage und ihre Antwort.
 * Solange die Antwort laeuft, hat die Frage noch keine queryId — dann zaehlt
 * die lokale Kennung; sobald sie da ist, haengt die Antwort ueber die queryId.
 */
export function konversationAuswaehlen(nachrichten: Nachricht[], auswahl: StoryAuswahl): Nachricht[] {
  const frage = frageZurAuswahl(nachrichten, auswahl)
  if (!frage) return []
  return nachrichten.filter((m) => m === frage || (frage.queryId !== undefined && m.queryId === frage.queryId))
}
