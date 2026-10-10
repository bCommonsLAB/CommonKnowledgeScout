/**
 * @fileoverview Auftrag an die KI fuer den Korrektur-Assistenten — sichtbar und editierbar.
 *
 * @description
 * Der Anwender sieht im Dialog „Vorschlaege holen", was gefragt wird, und kann
 * es aendern (Owner 10.10.2026). Editierbar ist nur der fachliche Teil
 * (`STANDARD_AUFTRAG`); das Antwortformat haengt der Server fest an, damit die
 * Antwort pruefbar bleibt. Client-tauglich (kein I/O).
 *
 * @module transkript-korrektur
 */

export const STANDARD_AUFTRAG = `Du hilfst, das Transkript einer Veranstaltung so wiederherzustellen, wie es tatsaechlich gesagt wurde. Das Transkript ist in nummerierte Saetze geteilt.

1. Korrekturen: Finde Hoerfehler — vor allem falsch geschriebene Namen von Personen, Orten und Organisationen, Zahlen und Fachbegriffe. Nutze dafuer die Begleitdokumente. Schlage nur vor, was du dort oder aus dem Zusammenhang sicher belegen kannst. Ersetze nie einen Namen durch einen anderen, der nicht woertlich in den Begleitdokumenten oder in der Liste bekannter Namen steht — lieber kein Vorschlag als ein erfundener. Aendere keinen Stil und keine Grammatik der gesprochenen Sprache, uebersetze nichts, glaette nichts.

2. Sprecher: Markiere, wo ein neuer Redebeitrag beginnt — am ersten Satz des Beitrags. Namen nur von Personen, die in den Begleitdokumenten als Vortragende oder Moderation genannt sind; erkenne sie an Ankuendigungen („Frau X, bitte"), Selbstvorstellungen oder am Inhalt. Fragen und Beitraege aus dem Publikum heissen „Publikum" (keine Namen). Die Moderation heisst mit Namen, wenn er in den Begleitdokumenten steht, sonst „Moderation". Nur echte Redebeitraege, keine Zwischenrufe oder kurzen Bestaetigungen.`

/** Fester Teil: Antwortformat. Wird nicht im Dialog gezeigt, damit die Pruefung greift. */
export const ANTWORT_FORMAT = `Antworte ausschliesslich mit JSON in genau dieser Form:
{
  "korrekturen": [ { "satz": <Nummer des Satzes>, "alt": "<falscher Textteil, woertlich aus dem Satz kopiert>", "neu": "<korrigierter Textteil>", "grund": "<kurz: woher du es weisst>" } ],
  "sprecher": [ { "ab_satz": <Nummer des ersten Satzes des Beitrags>, "name": "<Name oder Publikum oder Moderation>", "rolle": "<z. B. Referentin, Moderation, Publikum>", "grund": "<kurz: woran erkannt>" } ]
}
„alt" muss zeichengenau im genannten Satz vorkommen. Leere Listen sind erlaubt.`

export interface AssistentSatz {
  index: number
  text: string
}

export interface AssistentBegleittext {
  name: string
  text: string
}

/** Nachricht an das Modell: Auftrag, Format, Begleitdokumente, bekannte Namen, nummerierte Saetze. */
export function baueAssistentNachricht(args: {
  auftrag: string
  saetze: readonly AssistentSatz[]
  begleittexte: readonly AssistentBegleittext[]
  /** Bekannte Namen der Library (`extractionKnownNames`) — gelten wie ein Begleitdokument. */
  bekannteNamen?: readonly string[]
}): string {
  const begleit = args.begleittexte.length > 0
    ? args.begleittexte.map((b) => `### ${b.name}\n${b.text}`).join('\n\n')
    : '(keine Begleitdokumente — dann keine Personennamen vorschlagen, nur „Publikum" oder „Moderation")'
  const bekannte = args.bekannteNamen ?? []
  const namen = bekannte.length > 0 ? `\n\n## Bekannte Namen der Library\n${bekannte.join(', ')}` : ''
  const saetze = args.saetze.map((s) => `[${s.index}] ${s.text}`).join('\n')
  return `${args.auftrag.trim()}\n\n${ANTWORT_FORMAT}\n\n## Begleitdokumente\n${begleit}${namen}\n\n## Transkript (nummerierte Saetze)\n${saetze}`
}
