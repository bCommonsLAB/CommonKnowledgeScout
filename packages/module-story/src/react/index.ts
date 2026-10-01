/**
 * `@ks/module-story/react` — die montierbaren Bausteine des Story-Modus.
 *
 * BEWUSST ein eigener Einstiegspunkt neben dem React-freien Wurzel-Barrel
 * (wie `@ks/module-explorer/react`).
 *
 * Regeln (Plan `story-dreiteilung-fragenchronik`, Abschnitt Paketierung):
 * - jeder Request geht ueber die Instanz (`InstanceApi` aus `@ks/api-client`),
 *   kein nacktes `fetch` — Test `tests/unit/packages/module-story/instanz-fetch.test.ts`
 * - kein `next/*`, kein Clerk, kein `@/` — Test `paket-schnitt.test.ts`
 * - Chat-Vokabular nur ueber `@ks/contracts`; `src/lib/chat` bleibt Server-Stack
 * - was das Paket nicht kennen darf (Anmeldung, Detailansicht, Perspektive),
 *   kommt als Slot oder Prop
 */

export type { StoryAuswahl, ChronikFrage, ChronikSitzung, AktiveSitzung, StoryKopf } from './types'
export { STORY_UEBERSICHT } from './types'
export { storyAuswahlAtom, storyGliederungAtom, storyAktiveSitzungAtom } from './atoms'
export { kurztitel } from './kurztitel'
export { themaZuFrage } from './thema-zu-frage'
export { useStorySitzungen, type UseStorySitzungenParams, type UseStorySitzungenResult } from './use-story-sitzungen'
export { StoryChronik, type StoryChronikProps } from './story-chronik'
export { Gliederung, aktivesThema, type GliederungProps } from './gliederung'
export { StoryUebersicht, type StoryUebersichtProps } from './story-uebersicht'
export { StoryThema, type StoryThemaProps } from './story-thema'
export { Kennzahlen, zaehlerText, type Kennzahl, type KennzahlArt } from './kennzahlen'
export { VerarbeitungEinfach, verarbeitungInWorten, type VerarbeitungEinfachProps, type VerarbeitungZeile } from './verarbeitung-einfach'
export { auswahlZuKennung, auswahlAusKennung, istNachtrag } from './auswahl-kennung'
