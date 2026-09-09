import { atom } from 'jotai'
import type { DocReference } from '@ks/contracts'

/**
 * Uebergabekanal fuer zitierte Dokumente: Der Chat schreibt, die Galerie liest.
 *
 * Die Form kommt seit der Welle „Galerie-Chat-Mittelschicht" aus
 * `@ks/contracts` — vorher stand hier `ChatResponse['references']`, womit
 * dieser Kanal einen Chat-Typ trug, obwohl beide Seiten ihn gleichermassen
 * brauchen (Audit `01-audit-galerie-chat.md`, Befund 1).
 *
 * `queryId` erlaubt es, die vollstaendigen Treffer aus dem Abfrage-Protokoll
 * nachzuladen.
 *
 * Offen: Das Atom ist noch ein gemeinsamer Import beider Seiten. Fuer ein
 * Galerie-Paket muesste es injiziert werden — nach dem Muster von
 * `library-change-bridge` (M4e). Siehe Schritt 4 im Audit.
 */
export const chatReferencesAtom = atom<{
  references: DocReference[]
  queryId?: string
}>({ references: [] })
