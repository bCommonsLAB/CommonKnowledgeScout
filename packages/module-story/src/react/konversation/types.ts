/**
 * Vokabular der Konversation im Story-Modus (D6b).
 *
 * Nur Darstellungsformen — nichts davon kennt den Chat-Server. Was aus den
 * Chat-Routen kommt (`/queries`, `/stream`), wird in `verlauf.ts` und
 * `use-story-stream.ts` auf diese Formen abgebildet. Chat-Vokabular
 * (Zielsprache, Interessenprofil, Sprachstil, Zugangsperspektive) kommt aus
 * `@ks/contracts`; `src/lib/chat` bleibt Server-Stack.
 */

import type { AccessPerspective, Character, DocReference, GalleryFilters, SocialContext, TargetLanguage } from '@ks/contracts'

/** Wie lang die Antwort sein soll — dieselben Werte wie `AnswerLength` der App. */
export type AntwortLaenge = 'kurz' | 'mittel' | 'ausführlich' | 'unbegrenzt'
export const ANTWORT_LAENGEN: readonly AntwortLaenge[] = ['kurz', 'mittel', 'ausführlich', 'unbegrenzt'] as const
export const ANTWORT_LAENGE_STANDARD: AntwortLaenge = 'ausführlich'

/**
 * Aus welcher Sicht geantwortet wird. Das Paket haelt die Perspektive nicht
 * selbst — die App hat ihre Perspektiven-Seite, das Embed die Konfig der
 * Library; beide reichen sie herein. `llmModel` ist Pflicht: Der Server
 * antwortet ohne Modell nicht (kein stiller Default).
 */
export interface Perspektive {
  targetLanguage: TargetLanguage
  character: Character[]
  accessPerspective: AccessPerspective[]
  socialContext: SocialContext
  genderInclusive: boolean
  llmModel: string
}

/** Eine Nachricht des Verlaufs: Frage der Person oder Antwort des Servers. */
export interface Nachricht {
  id: string
  art: 'frage' | 'antwort'
  text: string
  createdAt: string
  /** Kennung der gespeicherten Frage; fehlt, solange die Antwort laeuft. */
  queryId?: string
  /** D5: Kurztitel vom Sprachmodell an der Frage; fehlt → Heuristik in der Chronik. */
  kurztitel?: string
  /** Belege der Antwort (D7: je Dokument, mit Textstellen). */
  belege?: DocReference[]
  anschlussfragen?: string[]
}

/** Frage und — sobald da — ihre Antwort. */
export interface FrageAntwort {
  /** `<queryId>-<frageId>`, solange keine queryId da ist nur die Frage-Kennung. */
  kennung: string
  frage: Nachricht
  antwort?: Nachricht
}

/** Was eine Anfrage an den Stream braucht — ausser der Frage selbst. */
export interface AnfrageRahmen {
  perspektive: Perspektive
  antwortLaenge: AntwortLaenge
  /** Facetten-Filter der Galerie; gehen als Query-Parameter mit. */
  filter?: GalleryFilters
  /** Aktive Sitzung; ohne Kennung legt der Server eine neue an. */
  chatId: string | null
}
