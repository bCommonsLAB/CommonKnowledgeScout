/**
 * Vokabular des Story-Modus (D1).
 *
 * Nur Darstellungsformen — nichts davon kennt den Chat-Server. Was aus den
 * Chat-Routen kommt (`/chats`, `/queries`), wird in `use-story-sitzungen.ts`
 * auf diese Formen abgebildet.
 */

/**
 * Was die Mitte zeigt. Genau eine Auswahl ist aktiv; fehlt sie, gilt die
 * Themenuebersicht. Ab D2 lebt die Auswahl in der URL (`q=`), hier ist nur
 * die Form festgelegt.
 */
export type StoryAuswahl =
  | { art: 'uebersicht' }
  | { art: 'thema'; themaId: string }
  | {
      art: 'konversation'
      /** Kennung der gespeicherten Frage; fehlt, solange die Antwort laeuft. */
      queryId?: string
      /** Lokale Kennung der Frage-Nachricht, bis der Server eine queryId vergibt. */
      frageId?: string
      /** Thema, aus dem die Frage gewaehlt wurde — markiert die Gliederung. */
      themaId?: string
    }

export const STORY_UEBERSICHT: StoryAuswahl = { art: 'uebersicht' }

/** Eine gestellte Frage in der Chronik. */
export interface ChronikFrage {
  /** Kennung der gespeicherten Frage; lokale Fragen tragen stattdessen `frageId`. */
  queryId?: string
  frageId?: string
  text: string
  createdAt: string
  /** `true`, solange die Antwort noch nicht da ist (D2 zeigt „laeuft"). */
  offen: boolean
}

/** Eine Sitzung (= ein Chat) mit ihren Fragen. */
export interface ChronikSitzung {
  chatId: string
  titel: string
  createdAt: string
  /** `undefined`: noch nicht geladen (Sitzungen laden ihre Fragen beim Aufklappen). */
  fragen?: ChronikFrage[]
}

/** Die Fragen der aktiven Sitzung, wie die App sie live aus dem Verlauf kennt. */
export interface AktiveSitzung {
  chatId: string | null
  fragen: ChronikFrage[]
}

/** Kopf des gesamten Inhalts (Konfig: Label und Beschreibung aus publicPublishing). */
export interface StoryKopf {
  titel: string
  /** Fehlt das Feld in der Konfig, faellt der Block weg — kein Platzhalter. */
  beschreibung?: string
}
