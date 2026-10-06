---
name: story-status-modalitaet
overview: "Der Story-Modus der Library Klimamaßnahmen formuliert Antworten so, als wären alle Maßnahmen beschlossen oder in Umsetzung — auch wenn die Landesverwaltung sie als nicht umsetzbar bewertet hat. Ursache: der Status (`lv_bewertung`) erreicht das Sprachmodell nicht oder nur als rohes Token ohne Bedeutung. Dieser Plan macht den Status zur Modalität der Antwort (was darf wie gesagt werden), generisch über die Registry des Detailansichtstyps, und prüft das über ein Golden-Set aus Use Cases je Status. Owner 06.10.2026: erst messen, dann Hebel in der Reihenfolge Prompt + Nachprüfung, dann Daten, Kontroll-Durchlauf nur bei Bedarf."
vorhaben: [Klimamaßnahmen Südtirol]
status: konzept
todos:
  - id: m0-golden-set
    content: "Golden-Set anlegen: pro Status 2–3 Maßnahmen, je Maßnahme drei Fragetypen (direkt, Themenfrage mit gemischten Status, Frage mit falscher Unterstellung). Erwartung als Kriterien (Pflicht-Status, Pflicht-Modalität, Verbotsliste), nicht als Wortlaut. Fixture-Format siehe §5."
    status: pending
  - id: m0-baseline
    content: "Baseline gegen den heutigen Stand fahren und Trefferquote festhalten (deterministische Checks + Richter-Rubrik). Ergebnis in den Plan eintragen, bevor ein Hebel gebaut wird."
    status: pending
  - id: m1-registry-vokabular
    content: "Registry (`packages/contracts/src/detail-view-type-registry.ts`): neben `belegKarte.status` ein `statusVokabular` je Detailansichtstyp — Klartext-Label, erlaubte Sprechweise, Verbotsliste je Statuswert. Für `climateAction` die sieben Werte von `lv_bewertung` belegen. Unit-Test: jeder Plaketten-Schlüssel hat ein Vokabular (kein stiller Default)."
    status: pending
  - id: m2-prompt
    content: "Prompt (`src/lib/chat/common/prompt.ts`): im Quellen-Header Klartext-Label statt Schlüssel; Legende + Modalitäts-Tabelle aus dem Vokabular in die System-Message; bei mehreren Dokumenten Gruppierung nach Status verlangen. Vokabular über den Retriever-Kontext (`retriever-context.ts`) aus dem Detailansichtstyp der Library auflösen; ohne Vokabular keine Status-Sektion (explizit, kein leerer Text)."
    status: pending
  - id: m3-nachpruefung
    content: "Deterministische Nachprüfung im Orchestrator: Status jeder zitierten Quelle [n] aus den Metadaten lesen, Fußnote „Stand laut Landesverwaltung: …" an die Antwort anhängen, Verbotsliste je Status gegen den Antworttext prüfen und Treffer im Query-Log vermerken. Keine stillschweigende Korrektur des Texts."
    status: pending
  - id: m4-daten
    content: "Ingestion: `lv_bewertung` (bzw. das Statusfeld des Vokabulars) in den Metadaten-Vorspann (`metadata-formatter.ts`) und in den Dokument-Embedding-Text (`document-text-builder.ts`); Template `klimamassnahme-detail1-de.md`: `summary` muss den Status in einem Satz nennen; Facette `lv_bewertung` in der Library-Config prüfen. Danach Re-Ingest der Library und Golden-Set erneut fahren."
    status: pending
  - id: m5-kontrolldurchlauf
    content: "Nur wenn m2+m3 (+m4) die Baseline nicht ausreichend heben: zweiter, kleiner Modellaufruf, der die Antwort gegen die Status-Liste der zitierten Dokumente prüft und beanstandete Sätze meldet. Kosten je Frage messen, Entscheidung Owner."
    status: pending
---

# Story-Modus: Status der Maßnahme als Modalität der Antwort

## 1. Anlass

Die Library „Klimamaßnahmen" (Steckbrief 5) enthält rund 600 Maßnahmen aus
Klimabürgerrat und Stakeholder-Forum. Zu jeder Maßnahme gibt es eine
Rückmeldung der Landesverwaltung mit einer Bewertung, die im Frontmatter als
`lv_bewertung` mit sieben Schlüsseln liegt:

`im_klimaplan | in_fachplaenen | in_umsetzung | neu_umsetzbar | nicht_umsetzbar | vertieft_pruefen | unklar`

Die Detailseite und die Belegkarten zeigen diesen Status als Plakette. Der
Antworttext im Story-Modus ignoriert ihn: Auf die Frage „Was tut Südtirol
beim Schwerverkehr?" kommt „Es wird X gemacht, Y gemacht, Z gemacht", auch
wenn X abgelehnt ist und Y erst geprüft wird. Das ist ein Shift Richtung
Falschaussage, und für eine öffentliche Seite nicht tragbar.

Zweite Vorsicht (Owner 06.10.): Auch `in_umsetzung` ist keine
Erfolgsmeldung. Der Status sagt, dass die Landesverwaltung zu einem
Zeitpunkt angibt, die Maßnahme laufe. Wie weit, mit welchem Ergebnis, weiß
niemand aus den Daten. Die Antwort darf also nie „ist umgesetzt" sagen,
sondern nur „laut Landesverwaltung in Umsetzung".

## 2. Befund: wo der Status heute verloren geht

Geprüft am 06.10.2026 im Code, vier Lücken:

| Stelle | Was passiert | Datei |
|---|---|---|
| Chunk-Text | Der eingebettete Metadaten-Vorspann enthält Titel, Autoren, Jahr, Region, Dokumenttyp, Zusammenfassung, Tags, Themen. Keinen Status. Nur der Chunk, der zufällig die Body-Zeile `> **Bewertung:** …` enthält, trägt ihn. | `src/lib/ingestion/metadata-formatter.ts` |
| Zusammenfassung | Das Template beschreibt `summary` als „Zusammenfassung der Maßnahme (2–3 Sätze)". Die Summary liest sich wie eine beschlossene Sache. Der Summary-Retriever liefert genau diesen Text. | `template-samples/klimamassnahme-detail1-de.md`, `src/lib/chat/retrievers/summaries-mongo.ts` |
| Quellen-Header | Ist `lv_bewertung` als Facette konfiguriert, steht im Prompt-Kontext `lv_bewertung: nicht_umsetzbar`. Ein rohes Token ohne Legende, ohne Anweisung, es zu beachten. | `src/lib/chat/common/prompt.ts` (`buildContext`) |
| System-Prompt | „You are a precise assistant. Answer exclusively based on the sources." Es gibt kein Feld pro Library oder Detailansichtstyp für fachliche Formulierungsregeln. | `src/lib/chat/common/prompt.ts` (`buildSystemMessage`), `packages/contracts/src/library-chat.ts` |

Das Dokument-Embedding (`document-text-builder.ts`) hat dieselbe Lücke wie
der Chunk-Vorspann.

Was schon da ist und genutzt werden soll: Die Registry kennt für
`climateAction` die Zuordnung `lv_bewertung` → Plakette
(`belegKarte.status.plaketten`). Die Facetten-Mechanik transportiert
Metadaten bis in den Prompt-Kontext (`metadata-extractor.ts`). Der
Orchestrator weiß nach der Antwort, welche Dokumente [n] zitiert wurden
(`usedReferences`).

## 3. Prinzip: Status ist eine Modalität, kein Thema

Der Status legt fest, mit welchem Modalverb und welcher Zuschreibung über die
Maßnahme gesprochen werden darf. Das ist Wissen des Detailansichtstyps, nicht
der Library und nicht des Klima-Codes. Es gehört deshalb als Vokabular in die
Registry neben die Plaketten-Zuordnung:

| Status | Plakette | Erlaubte Sprechweise | Verboten |
|---|---|---|---|
| `in_umsetzung` | umsetzung | „Laut Landesverwaltung ist … in Umsetzung." Kein Urteil über Erfolg oder Umfang. | „ist umgesetzt", „wurde erreicht", „gibt es seit" |
| `im_klimaplan`, `in_fachplaenen` | umsetzung | „… ist im Klimaplan bzw. in Fachplänen vorgesehen." | „wird gemacht", „ist umgesetzt" |
| `neu_umsetzbar` | geplant | „… wird von der Landesverwaltung als machbar eingestuft, ist aber nicht beschlossen." | „wird umgesetzt", „ist geplant" (ohne Zusatz) |
| `vertieft_pruefen`, `unklar` | pruefung | „… wird noch geprüft / ist offen." | „wird gemacht", „ist vorgesehen" |
| `nicht_umsetzbar` | abgelehnt | „… wurde als nicht umsetzbar bewertet und wird nicht umgesetzt." | „wird gemacht", „ist geplant", „könnte" ohne Hinweis auf die Ablehnung |

Zwei Regeln gelten für alle Werte:

1. **Zuschreibung statt Behauptung.** Jede Statusaussage wird der
   Landesverwaltung zugeschrieben („laut Rückmeldung", „nach Einschätzung der
   Landesverwaltung"). Die Antwort spricht nie in eigener Autorität über den
   Stand.
2. **Gruppierung bei Mehrfach-Treffern.** Trifft eine Frage mehrere
   Maßnahmen mit verschiedenem Status, gliedert die Antwort nach Status
   (umgesetzt oder vorgesehen / machbar, nicht beschlossen / in Prüfung /
   abgelehnt), statt alles in einen Fluss zu packen.

Die Plaketten-Zuordnung in der Registry weicht heute noch von der
Kartenfarbe in `document-card/status-config.ts` ab (Kommentar in der Registry,
Kandidat D6). Das Vokabular hängt an den Schlüsseln, nicht an den Plaketten,
und ist von dieser Vereinheitlichung unabhängig.

## 4. Vier Hebel, von billig nach aufwändig

**Hebel A, Prompt (m1, m2).** Vokabular in die Registry; der Retriever-Kontext
löst es über den Detailansichtstyp der Library auf. Im Quellen-Header steht
`Bewertung Landesverwaltung: nicht umsetzbar` statt
`lv_bewertung: nicht_umsetzbar`. Die System-Message bekommt eine Sektion
„Status der Dokumente": Legende, Modalitäts-Tabelle, die beiden Regeln aus
§3. Ohne Vokabular (andere Detailansichtstypen) entfällt die Sektion
explizit. Wirkt sofort, ohne Re-Ingest.

**Hebel B, deterministische Nachprüfung (m3).** Der Server kennt für jede
zitierte Quelle den Status aus den Metadaten. Er hängt eine Fußnote an die
Antwort („Stand laut Landesverwaltung: 2 Maßnahmen in Umsetzung, 1 in
Prüfung, 1 als nicht umsetzbar bewertet") und prüft den Antworttext gegen die
Verbotsliste der zitierten Status. Treffer werden im Query-Log vermerkt, der
Text wird nicht stillschweigend umgeschrieben (no-silent-fallbacks). Das ist
der einzige Hebel, der nie halluziniert, und die Grundlage der Messung.

**Hebel C, Daten (m4).** Status in den Metadaten-Vorspann jedes Chunks und in
den Dokument-Embedding-Text; Template-Anweisung für `summary` um einen
Status-Satz ergänzen; Facette `lv_bewertung` in der Library-Config
sicherstellen. Braucht Re-Ingest der Library, deshalb erst, wenn die Library
ohnehin neu ingestiert wird oder wenn A+B in der Messung nicht reichen.

**Hebel D, Kontroll-Durchlauf (m5).** Zweiter, kleiner Modellaufruf, der die
Antwort gegen die Status-Liste prüft. Kostet je Frage; nur bauen, wenn die
Messung nach A+B+C noch Lücken zeigt.

Reihenfolge (Owner 06.10.): m0 Golden-Set und Baseline, dann A und B
zusammen, dann C, D nur bei Bedarf.

## 5. Systemisch prüfen: Golden-Set aus Use Cases

Die Prüfung ist Teil des Plans, nicht Nacharbeit. Ohne Baseline weiß niemand,
ob der Prompt allein reicht.

**Korpus.** Pro Status zwei bis drei echte Maßnahmen aus der Library. Dazu
bewusst Handlungsfelder, in denen Maßnahmen mit verschiedenem Status
nebeneinander liegen (z. B. Schwerverkehr, Heizen, Ernährung).

**Drei Fragetypen je Maßnahme:**

1. **Direkt:** „Wird X gemacht?" / „Was ist mit X?"
2. **Themenfrage mit gemischten Treffern:** „Was tut Südtirol beim
   Schwerverkehr?" Erwartung: Gruppierung nach Status.
3. **Falsche Unterstellung:** „Seit wann gibt es X?" bei einer abgelehnten
   oder erst geprüften Maßnahme. Der härteste Typ; er zeigt den Shift am
   deutlichsten.

**Erwartung als Kriterien, nicht als Wortlaut.** Vorschlag für das
Fixture-Format (JSON, ein Eintrag je Frage; echte Maßnahmen-Nummern werden
beim Anlegen eingesetzt):

```json
{
  "id": "schwerverkehr-themenfrage",
  "frage": "Was tut Südtirol beim Schwerverkehr?",
  "typ": "themenfrage",
  "erwarteteDokumente": [
    { "massnahme_nr": "…", "status": "in_umsetzung" },
    { "massnahme_nr": "…", "status": "nicht_umsetzbar" }
  ],
  "pflicht": {
    "statusGenannt": ["in_umsetzung", "nicht_umsetzbar"],
    "zuschreibung": true,
    "gruppierung": true
  },
  "verboten": ["wird umgesetzt", "ist umgesetzt", "gibt es seit"]
}
```

**Zwei Prüfebenen:**

- **Deterministisch** (Unit-/Integrationstest, ohne Modell bewertbar):
  zitierte Dokumente gegen `erwarteteDokumente`; Verbotsliste je Status gegen
  den Antworttext; Pflicht-Status als Label im Text vorhanden. Dieselbe Logik
  wie Hebel B, deshalb wird sie als wiederverwendbare Funktion gebaut.
- **Qualitativ** (Richter-Modell mit fester Rubrik): Modalität korrekt,
  Zuschreibung vorhanden, keine Erfolgsbehauptung, Gruppierung bei
  Mehrfach-Treffern. Rubrik mit vier Ja/Nein-Fragen, kein Freitext-Urteil.

**Ablauf.** Golden-Set einmal gegen den heutigen Stand fahren
(Baseline), Trefferquote je Fragetyp und je Status festhalten. Nach jedem
Hebel wiederholen. Die Läufe landen ohnehin im Query-Log und bleiben dort
nachvollziehbar. Läuft das Set gegen die echte Library, kostet es
Modell-Aufrufe; die Prompt-Ebene (Hebel A) lässt sich zusätzlich mit
Fixture-Chunks und einem Mock-Modell unit-testen (Legende im Prompt
vorhanden, Label statt Schlüssel im Header).

## 6. Was nicht in diesen Plan gehört

- Vereinheitlichung Plakette vs. Kartenfarbe (D6-Kandidat) — eigene Aufgabe.
- Ein freies „Zusatz-Prompt"-Feld pro Library. Bewusst nicht: Das Vokabular
  hängt am Detailansichtstyp und ist typisiert; ein Freitext-Feld würde die
  Prüfung unmöglich machen.
- Datum der Rückmeldung als eigenes Feld (die Bewertung gilt „zu einem
  Zeitpunkt"). Sinnvoll, aber Template-Änderung mit Re-Ingest; in den Vorrat.

## 7. Betroffene Dateien

- `packages/contracts/src/detail-view-type-registry.ts` — `statusVokabular`
- `src/lib/chat/retriever-context.ts` — Vokabular je Library auflösen
- `src/lib/chat/common/prompt.ts` — Header-Label, Status-Sektion, Gruppierung
- `src/lib/chat/orchestrator.ts` — Nachprüfung und Fußnote nach der Antwort
- `src/lib/ingestion/metadata-formatter.ts`,
  `src/lib/ingestion/document-text-builder.ts` — Status im Vorspann (Hebel C)
- `template-samples/klimamassnahme-detail1-de.md` — `summary` mit Status-Satz
- `tests/unit/chat/` — Vokabular-Vollständigkeit, Prompt-Sektion,
  deterministische Prüfung; Golden-Set-Fixtures daneben
