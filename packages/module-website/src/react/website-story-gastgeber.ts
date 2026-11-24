/**
 * Was die Fragen- und die Themen-Sektion vom Gastgeber brauchen (Plan
 * `startseite-als-embed`, WE3).
 *
 * Bis WE3 holten sich die Sektionen das selbst: Anmeldung aus Clerk, die
 * Perspektive aus dem Story-Kontext der App, Platzhalter und Zeichengrenze aus
 * der Library-Konfig, Dialog, Fuss der Antwort und Detailansicht aus App-
 * Komponenten. Jetzt reicht der Gastgeber es herein — in der App
 * `website-story-app.tsx`, im Startseiten-Embed (WE4) die anonymen Teile aus
 * `embed-story.tsx` und `embed-perspektive.tsx`.
 */

import type * as React from 'react'
import type { InstanceApi } from '@ks/api-client'
import type { DocCardMeta } from '@ks/contracts'
import type { Nachricht, Perspektive } from '@ks/module-story/react'

/** Eingabe der Fragen-Sektion aus der Chat-Konfig der Library. */
export interface WebsiteStoryEingabe {
  platzhalter?: string
  maxZeichen?: number
  maxZeichenHinweis?: string
  /** Die Konfig laedt noch: Die Sektion zeigt „laedt" und haelt Fragen aus der Themen-Sektion zurueck. */
  laedt: boolean
  /** Die Konfig ist nicht ladbar: Die Sektion zeigt den Fehler (Klartext). */
  fehler: string | null
}

export interface WebsiteStoryDetailSlot {
  doc: DocCardMeta
  /** Seite, an der die Ansicht aufgeht (Beleg mit Textstelle); ohne Angabe am Anfang. */
  page?: number
  onClose: () => void
}

export interface WebsiteStoryGastgeber {
  /** Instanz fuer Fragen, Themenuebersicht, Belege, Katalog-Zahl und populaere Fragen. */
  instanz: InstanceApi
  /** Angemeldet? Steuert die Sitzungs-Kopfzeilen der Abrufe (App: Clerk; Embed: nie). */
  angemeldet: boolean
  /** Perspektive der Fragen und der Themenuebersicht, mit Modell. */
  perspektive: Perspektive
  eingabe: WebsiteStoryEingabe
  /** Dialog „Antworten anpassen"; fehlt er, zeigt die Sektion den Knopf nicht. */
  perspektiveDialog?: (p: { offen: boolean; onOpenChange: (offen: boolean) => void }) => React.ReactNode
  /** Was unter dem KI-Hinweis im Fuss der Antwort steht (App: Konfig-Anzeige, Verbrauch, Verarbeitung). */
  antwortFuss?: (antwort: Nachricht) => React.ReactNode
  /** Bild neben der Antwort (App: das Logo). */
  antwortAvatar?: React.ReactNode
  /**
   * Detailansicht eines zitierten Dokuments ueber der Seite (Owner 10.11.2026).
   * Fehlt sie, fuehrt der Klick ueber die Navigation in die Galerie (Ziel `dokument`).
   */
  detail?: (p: WebsiteStoryDetailSlot) => React.ReactNode
  /**
   * Teppich der Dokumente hinter der Sektion (Plan `teppich-der-dokumente`, T2): `true`,
   * wenn die Library ihn eingeschaltet hat (`publicPublishing.carpetEnabled`) und der
   * Gastgeber ihn zulaesst. Fehlt das Feld, bleibt die Sektion, wie sie ist.
   */
  teppich?: boolean
  /**
   * Zurueck-Taste fuer Ueberlagerungen der Sektion (Telefon-Vollbild, Graph-Ansicht; Owner
   * 24.11.2026). Die Sektion ruft dies, sobald eine aufgeht: Der Gastgeber legt einen Schritt in
   * die Chronik und ruft `onZurueck`, wenn der Leser zurueckgeht. Die Rueckgabe meldet ab —
   * `schrittZurueck: true`, wenn der Leser selbst geschlossen hat (der Gastgeber nimmt seinen
   * Schritt zurueck), `false`, wenn die Sektion verschwindet. Fehlt das Feld (Embed: die Chronik
   * der fremden Seite bleibt unberuehrt), schliesst nur der Knopf.
   */
  zurueckTaste?: (onZurueck: () => void) => (schrittZurueck: boolean) => void
}
