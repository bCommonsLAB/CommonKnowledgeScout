/**
 * @fileoverview Vorlage fuer ein neu angelegtes `_INDEX.md` (Wunschliste 5, B3a).
 *
 * @description
 * `themen_setzen` schrieb bisher nur in ein VORHANDENES `_INDEX.md` — und in
 * `24.09 KnowledgeScout` gibt es genau eines bei 53 Ereignisordnern. Die
 * feinste Themenaufloesung war damit ein Wert je Vorhaben. Wer unterhalb des
 * Vorhabens Themen vergeben will, braucht dort zuerst einen Index; diese
 * Vorlage ist er (Aufbau nach `Organisation/Aufraeumen/Konventionen.md`).
 *
 * **Bewusst OHNE `bearbeitungsstand`.** Zwei Gruende, beide hart:
 *
 * 1. Der erklaerte Stand ist eine Behauptung und gehoert `stand_setzen` mit
 *    seinen vier Schutzstufen (ST5-Schreibschutz: der Feldkern der
 *    `_INDEX.md` ist Fachwerkzeug-Gebiet). `themen_setzen` weiss nicht, wie
 *    weit ein Ordner erschlossen ist — es duerfte hier nur raten.
 * 2. Ein geratenes `ungesichtet` waere schaedlich, nicht neutral: Das
 *    Gap-Budget fasst ALLE Befunde unterhalb eines `ungesichtet`-Ordners zu
 *    einem `teilbaum_ungesichtet` zusammen (`gap-budget.ts`). Ein
 *    Vorlagen-Wert wuerde also echte Befunde verstecken.
 *
 * Ohne das Feld bleibt der Stand „nicht erklaert" — die ehrliche Aussage.
 * Die offenen Punkte der Vorlage sagen beides ausdruecklich an.
 *
 * Reine Funktion, kein I/O.
 *
 * @module agent-view
 */

/**
 * Baut den Rumpf eines neuen `_INDEX.md`. `themen:` steht leer drin, damit
 * der normale Zeilen-Patch von `setzeThemen` sie setzt — EIN
 * Schreibweg, dieselbe Ruecklese-Pruefung, kein zweiter Serialisierer.
 */
export function baueIndexVorlage(ordnerName: string): string {
  const titel = ordnerName.trim() === '' ? 'Dieser Ordner' : ordnerName.trim()
  return [
    '---',
    'type: index',
    'themen: []',
    '---',
    '',
    `# ${titel} — was hier liegt`,
    '',
    '<!-- Ein Absatz: was fuer ein Bestand das ist und wofuer er da ist. -->',
    '',
    '<!-- Ein Absatz: was ausdruecklich NICHT hier liegt und wo es stattdessen liegt. -->',
    '',
    '## Offene Punkte',
    '',
    '- Beschreibung fehlt: Diese Datei wurde von `themen_setzen` angelegt, damit der',
    '  Ordner Themen tragen kann — die beiden Absaetze oben schreibt noch jemand.',
    '- `bearbeitungsstand` ist nicht erklaert. Er gehoert `stand_setzen`, sobald ein',
    '  Schritt des Vier-Schritte-Takts hier abgeschlossen ist.',
    '',
  ].join('\n')
}
