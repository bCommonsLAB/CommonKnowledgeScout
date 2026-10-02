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
export { storyAuswahlAtom, storyGliederungAtom, storyAktiveSitzungAtom, storyUebersichtAktionAtom, type UebersichtAktion } from './atoms'
export { kurztitel, kurztitelFuer } from './kurztitel'
export { themaZuFrage } from './thema-zu-frage'
export { useStorySitzungen, type UseStorySitzungenParams, type UseStorySitzungenResult } from './use-story-sitzungen'
export { StoryChronik, type StoryChronikProps } from './story-chronik'
export { Gliederung, aktivesThema, type GliederungProps } from './gliederung'
export { StoryUebersicht, type StoryUebersichtProps } from './story-uebersicht'
export { StoryThema, type StoryThemaProps } from './story-thema'
export { Kennzahlen, zaehlerText, type Kennzahl, type KennzahlArt } from './kennzahlen'
export { VerarbeitungEinfach, verarbeitungInWorten, type VerarbeitungEinfachProps, type VerarbeitungZeile } from './verarbeitung-einfach'
export { auswahlZuKennung, auswahlAusKennung, istNachtrag } from './auswahl-kennung'

// D6b: die Konversation im Paket — Verlauf, Stream und reine Helfer.
export type { AntwortLaenge, Perspektive, Nachricht, FrageAntwort, AnfrageRahmen } from './konversation/types'
export { ANTWORT_LAENGEN, ANTWORT_LAENGE_STANDARD } from './konversation/types'
export { verlaufZuNachrichten, paare, fragenAusVerlauf, frageZurAuswahl, konversationAuswaehlen, VERLAUF_LIMIT, type VerlaufEintrag } from './konversation/verlauf'
export { useStoryVerlauf, verlaufMischen, type UseStoryVerlaufParams, type UseStoryVerlaufResult } from './konversation/use-story-verlauf'
export { useStoryStream, type UseStoryStreamParams, type UseStoryStreamResult } from './konversation/use-story-stream'
export { streamAdresse, streamKoerper, gespraechsverlauf, fehlerText } from './konversation/anfrage'
export { sseSchritte } from './konversation/sse'
export { AntwortText, type AntwortTextProps } from './konversation/antwort-text'
export { mitMarkenTiteln, belegeNachNummer } from './konversation/zitat-titel'
export { StoryKonversation, type StoryKonversationProps } from './konversation/story-konversation'
export { StoryEingabe, type StoryEingabeProps } from './konversation/story-eingabe'
export { useStorySitzungId, type UseStorySitzungIdResult } from './story-root/use-story-sitzung-id'
export { useStoryKonversation, type UseStoryKonversationParams } from './story-root/use-story-konversation'
export { StoryRoot, type StoryRootProps } from './story-root'
export { StoryKopfzeile, type StoryKopfzeileProps } from './story-kopfzeile'
