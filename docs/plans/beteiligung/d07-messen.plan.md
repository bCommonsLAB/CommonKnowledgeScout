---
name: d07-messen
overview: "Detailkonzept D7: Die Messung als eigenes Objekt (Konzept 13.09.). Einwandverfahren A mit vier Stufen, Passivlösung immer im Modell, Messfenster über die Tisch-Laufzeit, Stellungnahmen je Person, Option und Runde, Auswertung nach Interessengruppen mit Mindestgröße, Abbruchhinweis nach Runde 2, Anhalten. Offen für B/C ohne Umbau."
vorhaben: [26.05 SHF Nachhaltigkeit, 24.09 KnowledgeScout]
status: konzept
---

# D7 · Messen

**Grundlage:** Konzept „Verfahrensvarianten A B C und die Eskalation“
(Archiv, 13.09., Abschnitte 4 und 5), `GRUNDSAETZE.md` (Widerstand
entscheidet, Passivlösung, keine Stimme geht verloren),
[D4](d04-tisch-laufzeit.plan.md) (Messfenster),
[D6](d06-verdichten.plan.md) (Vorschlag aus der Synthese). Klasse **V**.
Geprüft gegen `master` 579f2d7.

## 1. Zweck und Screens

| Screen | Was passiert |
|---|---|
| T-S6.1 A · Einwandverfahren | Vorschlag lesen; vier Stufen; Begründung Pflicht bei „schwerwiegender Einwand“; Restzeit |
| E-S6.1 Wie geht es Ihnen damit? | vier große Felder, gleiche Stufen, ohne Begründungspflicht (Owner-Vorgabe Schnell) |
| M-S6.3 Messung läuft | Uhr, „6 von 8“, wer offen ist; keine Werte |
| M-S6.4 Auswertung | vier Stufen als Balken, Verteilung nach Interessengruppe; ab Runde 2 das Delta |
| M-S10.2 Beamer | Auswertung auf Gruppenebene |

## 2. Modell

**`measurements`**, Schlüssel `(libraryId, measurementId)`, Index
`(tableId, passageId)`:

```ts
interface Measurement {
  libraryId: string; measurementId: string
  meetingId: string; tableId: string; passageId: string
  variant: 'A' | 'B' | 'C'            // heute nur A beauftragt
  scale: 'levels4' | 'resistance0to10' | 'followup3'   // followup3 für Folgegruppen (D10)
  reasonRequiredFrom: 'never' | 'concern' | 'serious' | 'always'   // A: 'serious'
  options: Array<{
    optionId: string
    text: string
    origin: 'synthesis' | 'moderation' | 'passive' | 'previous_group'
    synthesisRef?: { tableId: string; passageId: string; seq: number }
    position: number
    hidden: boolean                    // Passivlösung in A: true
    lockedFromRound?: number           // C: nach Runde 1 gesperrt
  }>
  rounds: Array<{ round: number; windowId: string; openedAt: string; closedAt: string | null }>
  state: 'vorbereitet' | 'offen' | 'angehalten' | 'ausgewertet' | 'abgeschlossen'
  outcome?: 'konsent' | 'einwand_offen' | 'abgebrochen' | 'eskaliert'
  escalatedFrom?: string               // B/C später
  createdAt: string; createdBy: string; updatedAt: string; revision: number
}
```

**`assessments`**, eindeutig `(measurementId, optionId, participantId, round)`:

```ts
interface Assessment {
  libraryId: string; measurementId: string; optionId: string; round: number
  participantId: string                // E-Mail oder 'proxy:<uuid>' (D2)
  interestGroup: string                // aus der Teilnahme, eingefroren
  value: 'kein_einwand' | 'bedenken' | 'schwerwiegend' | 'fehlt_etwas'   // levels4
         | number                                                          // resistance0to10 (B/C)
         | 'passt' | 'passt_nicht' | 'ergaenzen'                          // followup3 (D10)
  reason?: string
  capturedBy?: string                  // Vertretung
  createdAt: string; updatedAt: string
}
```

- **A ist B mit einer Option.** Eine A-Messung hat zwei Optionen: den
  Vorschlag (`origin: synthesis`, aus `syntheses.pointer.draft` bzw. der
  gewählten Fassung) und die **Passivlösung** (`origin: passive`,
  `hidden: true`). Die Passivlösung wird nie angezeigt und bekommt in A
  keine Stellungnahme. Sie steht im Modell, damit eine spätere
  Eskalation nach B nichts umbauen muss (Konzept 13.09., 3.5).
- **„Mir fehlt etwas“** ist keine Widerstandsstufe, sondern ein Hinweis
  auf eine Lücke. Er wird gezählt, aber nicht als Einwand gewertet (4).
- Die **Interessengruppe wird an der Stellungnahme eingefroren**. Eine
  spätere Profiländerung verschiebt keine alte Auswertung.
- Werte, Stufen und Begründungen gehen **nie** ins Frontmatter (D0).

## 3. Ablauf

1. **Anlegen** (M-S3.2, Agendapunkt der Art `messung`):
   `POST …/tables/[tableId]/measurements {passageId, synthesisSeq}`. Der
   Vorschlagstext wird als Option **kopiert**, nicht verlinkt: Eine neue
   Fassung ändert eine laufende Messung nicht. Die Herkunft steht in
   `synthesisRef`.
2. **Öffnen:** Das geschieht über die Tisch-Laufzeit (`open_window {kind:
   'messung'}`, D4). Die Runde bekommt die `windowId`, der Zustand wird
   `offen`.
3. **Stellung nehmen:** `PUT …/measurements/[id]/assessments/me
   {optionId, value, reason?}`. Bis zum Schließen darf man die eigene
   Stellungnahme ändern, es bleibt eine je Runde. Bei `schwerwiegend`
   ohne Begründung kommt 422 (ausführlich). Schnell hat keine
   Begründungspflicht; die Moderation kann nachfragen.
4. **Während der Messung (Stille Runde):** Die Moderation sieht nur, wer
   abgegeben hat (D4, 3).
5. **Schließen:** `close_window` (D4) setzt den Zustand auf
   `ausgewertet`, und die Auswertung wird sichtbar.
6. **Nächste Runde:** Der Vorschlag wurde überarbeitet (neue Fassung,
   D6). Die Moderation fügt die neue Fassung als Option der nächsten
   Runde hinzu und öffnet ein neues Fenster. In A ersetzt die neue Fassung
   die alte als angezeigte Option; die alte bleibt im Modell (nichts
   verschwindet).
7. **Abschließen:** Die Moderation setzt `abgeschlossen` mit `outcome`.
8. **Anhalten:** Das Anhalten des Tisches (D4) hält auch das Messfenster
   an; die Werte bleiben.

## 4. Auswertung (reine Funktion)

`evaluate(measurement, assessments, { minGroupSize: 3 }): Evaluation`
liefert je sichtbarer Option und Runde:

| Kennzahl | Bedeutung |
|---|---|
| `counts` | Anzahl je Stufe; „fehlt etwas“ getrennt |
| `participation` | abgegeben von angekommen (aus `table_participations`, D2) |
| `byGroup` | Verteilung je Interessengruppe; **Gruppen unter `minGroupSize` werden zu „übrige“ zusammengefasst**, damit niemand erkennbar wird (Konzept 13.09., 3.4) |
| `reasons` | Begründungen der schwerwiegenden Einwände, **ohne Namen**, mit Gruppe |
| `delta` (ab Runde 2) | Verschiebung je Stufe gegenüber der Vorrunde, nur über Personen, die in beiden Runden abgegeben haben |
| `abbruchHinweis` | Runde ≥ 2 **und** kein neuer schwerwiegender Einwand **und** gleicher Vorschlagstext wie in der Vorrunde → „Keine Änderung nach Runde 2 — abschließen?“ (Owner 21.09.). Nur ein Hinweis; die Moderation entscheidet |
| `outcomeVorschlag` | kein schwerwiegender Einwand → `konsent`; sonst `einwand_offen` |

- Ausgewertet wird in der App mit einem Aggregations-Muster wie
  `vector-repo-sums.ts:60-76` (`$group`/`$sum`) oder mit einer reinen
  Funktion über die geladenen Stellungnahmen. Bei höchstens einigen
  Dutzend Stimmen je Tisch reicht die reine Funktion.
- **Schnell und ausführlich** schreiben dieselben Werte (`levels4`).
  Beide landen in derselben Auswertung.

## 5. Offen für B und C

B und C sind nicht beauftragt (O3). Sie sind möglich, ohne das Modell zu
ändern:
- `variant: 'B'`, `scale: 'resistance0to10'`;
- mehrere Optionen, die Passivlösung sichtbar;
- `escalatedFrom` zeigt auf die A-Messung;
- für C zwei Runden mit `lockedFromRound`.

Die Auswertung bekommt dann Mittelwert und Streuung je Option. Die
Seeds aus dem Konzept 13.09. (§5) gelten dann als Einstellungen am
Treffen (D1).

## 6. Schnittstellen

### 6.1 Bestand

| Zweck | Bestand |
|---|---|
| Stimme je Person und Objekt, Muster für das Repo | `source-user-states-repo.ts` (eindeutiger Index `:48-51`, Upsert mit `$setOnInsert` `:174-182`, normalisierte E-Mail `:151`) — Achtung: dort globale Collection und Index-Anlage bei jedem Aufruf; die neue folgt `mongodb-repository-pattern.md` |
| Aggregation | `vector-repo-sums.ts:60-76` |
| Fenster, Stille Runde, Revision | D4 |
| Vorschlag | `syntheses` (D6) |
| Teilnahme und Gruppe | `table_participations` (D2) |

### 6.2 Neu

| Baustein | Signatur |
|---|---|
| Typen und Zustandsfunktionen | `Measurement`, `Assessment`; `assertMeasurementTransition`; `addRound(measurement, option?)` |
| Auswertung (rein) | `evaluate(measurement, assessments, opts): Evaluation` |
| Repos | `measurements-repo.ts`, `assessments-repo.ts` (`upsertAssessment` mit eindeutigem Index, `listByMeasurement`) |
| Routen | `POST /api/deliberation/[libraryId]/tables/[tableId]/measurements` · `GET …/measurements/[id]` (Zustand; Werte erst nach Schließen) · `PUT …/measurements/[id]/assessments/me` · `PUT …/measurements/[id]/assessments/[participantId]` (Vertretung) · `GET …/measurements/[id]/evaluation` · `POST …/measurements/[id]/actions {close_measurement, add_round}` |

## 7. Fehlerfälle

| Fall | Verhalten |
|---|---|
| Stellungnahme bei geschlossenem Fenster | 409 |
| Stellungnahme zur verborgenen Passivlösung | 422 |
| `schwerwiegend` ohne Begründung (ausführlich) | 422 mit Feldhinweis |
| Auswertung angefragt, während das Fenster offen ist | 403 (Stille Runde) |
| Gruppe der Teilnahme fehlt | Stellungnahme abgelehnt (D2 macht die Gruppe zur Pflicht) |

## 8. Tests

- `evaluate`:
  - Verteilung;
  - „fehlt etwas“ getrennt gezählt;
  - Zusammenfassung kleiner Gruppen;
  - Delta nur über Personen, die in beiden Runden abgegeben haben;
  - Abbruchhinweis nur, wenn alle drei Bedingungen gelten.
- Passivlösung: immer vorhanden, in A verborgen, keine Stellungnahme
  möglich.
- Eindeutigkeit je (Messung, Option, Person, Runde); eine Änderung vor
  dem Schließen ersetzt die Stellungnahme.
- Stille Runde: kein Wert vor dem Schließen, für keine Rolle.

## 9. Offene Fragen

1. Welches A gilt am 13.11. (Wellen-Plan 4.3)? A2 (Ernte mit Verdichtung)
   nutzt eine Option aus D6. A1 (vorliegender Text mit 3–5
   Formulierungen) nutzt mehrere Optionen mit `origin: moderation`. Das
   Modell trägt beides; A1 braucht zusätzlich die Eingabe der Optionen
   durch die Moderation.
2. Die Mindestgruppengröße (Vorschlag 3).
3. **Fortbestehender Einwand nach Runde 2 (Owner 24.09., O17):** Das
   Verfahren regelt nur den Abschluss ohne neuen Einwand. Was gilt, wenn
   nach Runde 2 ein schwerwiegender Einwand bleibt oder neu kommt, ist
   ungeregelt. Vorschlag: Die Moderation wählt ausdrücklich eine von drei
   Fortsetzungen, jede protokolliert: (a) Fassung überarbeiten und Runde 3
   öffnen; (b) vertagen, der Punkt geht mit Stand in D10; (c) Dissens
   festhalten: Ergebnis mit `ergebnis_art: dissens`, der Einwand geht mit
   Wortlaut und Begründung als Beleg hinein (Prüfbericht A5). Ohne Wahl
   kein Tisch-Abschluss zu dieser Textstelle.

## 10. Aufwand

| Teil | PT |
|---|---|
| Typen, Zustände, Repos | 1 |
| Auswertung mit Tests | 1 |
| Routen mit Stiller Runde und Vertretung | 1 |
| **Summe D7 (ohne Oberflächen)** | **3** |
