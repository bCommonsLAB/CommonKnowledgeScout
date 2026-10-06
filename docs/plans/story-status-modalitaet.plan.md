---
name: story-status-modalitaet
overview: "Der Story-Modus der Library Klimamaßnahmen formuliert Antworten so, als wären alle Maßnahmen beschlossen oder in Umsetzung — auch wenn die Landesverwaltung sie als nicht umsetzbar bewertet hat. Ursache: der Status (`lv_bewertung`) erreicht das Sprachmodell nicht oder nur als rohes Token ohne Bedeutung. Lösung (Owner 06.10.2026, zweite Fassung): kein Code pro Dokumenttyp. Das Facetten-Schema der Library bekommt je Facette ein Bedeutungs-Wörterbuch (Wert → Label → Bedeutung) und ein Flag, ob das Feld in den Ingest-Kontext gehört; die Library bekommt einen Antwortregeln-Text mit Platzhaltern auf diese Facetten. Der Retriever reicht gefundene Texte mit ihrem Bedeutungskontext weiter, der Server prüft deterministisch nach. Geprüft über ein Golden-Set je Library: erst messen, dann Regeln + Nachprüfung, dann Ingest-Kontext."
vorhaben: [Klimamaßnahmen Südtirol]
status: konzept
todos:
  - id: m0-golden-set
    content: "Golden-Set anlegen: pro Status 2–3 Maßnahmen, je Maßnahme drei Fragetypen (direkt, Themenfrage mit gemischten Status, Frage mit falscher Unterstellung). Erwartung als Kriterien (Pflicht-Status, Pflicht-Modalität, Verbotsliste), nicht als Wortlaut. Das Set liegt BEI DER LIBRARY (neben Facetten und Antwortregeln in der Library-Konfiguration bzw. als Datei im Storage über den Provider), nicht im Repo; ins Repo kommen Zod-Schema, Läufer und ein synthetisches Beispiel. Format siehe §5."
    status: pending
  - id: m0-baseline
    content: "Baseline gegen den heutigen Stand fahren und Trefferquote festhalten (deterministische Checks + Richter-Rubrik). Ergebnis in den Plan eintragen, bevor ein Hebel gebaut wird."
    status: pending
  - id: m1-facetten-schema
    content: "Facetten-Schema (`chatConfigSchema.gallery.facets` in `src/lib/chat/config.ts`, `FacetDef` in `dynamic-facets.ts`, `LibraryChatConfig` in `@ks/contracts`) um zwei Felder erweitern: `ingestKontext: boolean` (Feld geht als Klartext in den Metadaten-Vorspann der Chunks und in den Dokument-Embedding-Text) und `werte: Array<{ wert, label, bedeutung?, verboten?: string[] }>` (Bedeutungs-Wörterbuch je Wert). Beides optional, kein Default-Raten; Zod validiert, dass `werte` nur bei Typ string/string[] steht. Facetten-Editor (`FacetDefsEditor.tsx`) um die beiden Eingaben erweitern. ERLEDIGT 06.10.: eine Zod-Quelle `src/lib/chat/facet-werte.ts` (Server + Formular), Spalte „Kontext" und Dialog `FacetWerteDialog.tsx` im Editor, Import/Export tragen die Felder, Test `tests/unit/chat/facet-werte.test.ts`."
    status: done
  - id: m2-antwortregeln
    content: "Neues Library-Feld `chat.antwortregeln` (Markdown, Freitext) mit Platzhaltern `{{facette:<metaKey>}}` (Label) und `{{legende:<metaKey>}}` (Tabelle Wert-Label → Bedeutung aus `werte`). Platzhalter werden beim Speichern gegen das Facetten-Schema validiert; unbekannter Platzhalter = Fehler, nie stilles Leerlassen (no-silent-fallbacks). Aufgelöster Text wird als Sektion „Regeln dieser Library" in die System-Message gesetzt (`prompt.ts buildSystemMessage`). Checkliste `library-config-field.md` abarbeiten (Typ, Service, Settings-UI, Maskierung entfällt: kein Secret). ERLEDIGT 06.10.: Helfer `src/lib/chat/antwortregeln.ts` (prüfen, auflösen, Legende), Querprüfung als superRefine in Server-Schema UND Formular, Sektion in `buildSystemMessage`/`buildTOCSystemMessage`, Orchestrator löst je Anfrage auf (wirft bei kaputter Config), Settings-Sektion `antwortregeln-section.tsx` im Story-Tab mit Live-Fehlerliste. Cache-Teil von m3 vorgezogen: aufgelöste Regeln gehen in Cache-Hash, Query-Log und Cache-Suche (`cache-key-utils`, `cache-hash-builder`, `queries-repo`, `query-logger`, Stream-Route). Test `tests/unit/chat/antwortregeln.test.ts`."
    status: done
  - id: m3-quellen-header
    content: "Quellen-Header im Prompt (`prompt.ts buildContext`): je Facettenwert mit Wörterbuch-Eintrag `Label: Wertlabel — Bedeutung` statt `metaKey: rohwert`; ohne Eintrag wie bisher Label: Wert. Wirkt typübergreifend: Dokumente ohne das Feld zeigen nichts. Cache-Schlüssel: `antwortregeln` ist seit m2 drin (aufgelöster Text, enthält die Legende aus `werte`); hier noch prüfen, ob ein Wörterbuch OHNE Legende im Regeltext den Header ändert und deshalb zusätzlich in den Hash muss."
    status: pending
  - id: m4-nachpruefung
    content: "Deterministische Nachprüfung im Orchestrator: für jede zitierte Quelle [n] die Facettenwerte mit Wörterbuch lesen, Fußnote mit Statusverteilung anhängen (Labels aus `werte`), `verboten`-Listen der getroffenen Werte gegen den Antworttext prüfen und Treffer im Query-Log vermerken. Keine stillschweigende Korrektur des Texts."
    status: pending
  - id: m5-ingest-kontext
    content: "Ingestion: `buildMetadataPrefix` (`metadata-formatter.ts`) und `buildDocumentTextForEmbedding` (`document-text-builder.ts`) bekommen die Facetten-Definitionen und schreiben jede Facette mit `ingestKontext: true` als `Label: Wertlabel` in Vorspann und Embedding-Text (`ingestion-service.ts` hat die Defs bereits für `extractFacetValues`). Template der Library: `summary` nennt den Status in einem Satz (Repo-Muster `klimamassnahme-detail1-de.md` nachziehen). Danach Re-Ingest der Library und Golden-Set erneut fahren."
    status: pending
  - id: m6-kontrolldurchlauf
    content: "Nur wenn m2–m5 die Baseline nicht ausreichend heben: zweiter, kleiner Modellaufruf, der die Antwort gegen die Bedeutungen der zitierten Dokumente prüft und beanstandete Sätze meldet. Kosten je Frage messen, Entscheidung Owner."
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
| System-Prompt | „You are a precise assistant. Answer exclusively based on the sources." Es gibt kein Feld pro Library für fachliche Formulierungsregeln. | `src/lib/chat/common/prompt.ts` (`buildSystemMessage`), `packages/contracts/src/library-chat.ts` |

Das Dokument-Embedding (`document-text-builder.ts`) hat dieselbe Lücke wie
der Chunk-Vorspann.

Was schon da ist und getragen wird: Facetten sind pro Library
konfigurierbar (`chat.gallery.facets`, Editor in den Settings), gelten
typübergreifend über alle Dokumente der Library, und ihre Werte landen
heute schon auf jedem Vektor-Dokument (`extractFacetValues`) und im
Quellen-Header des Prompts (`extractFacetMetadata`). Der Orchestrator weiß
nach der Antwort, welche Dokumente [n] zitiert wurden (`usedReferences`).
Es fehlt nur die **Bedeutung** der Werte und eine **Regel**, wie damit zu
formulieren ist.

## 3. Prinzip: Status ist eine Modalität, kein Thema

Der Status legt fest, mit welchem Modalverb und welcher Zuschreibung über die
Maßnahme gesprochen werden darf. Für Klimamaßnahmen sieht das so aus:

| Wert | Label | Bedeutung (geht als Kontext mit) | Verboten |
|---|---|---|---|
| `in_umsetzung` | in Umsetzung | Laut Landesverwaltung in Umsetzung. Kein Urteil über Erfolg oder Umfang. | „ist umgesetzt", „wurde erreicht", „gibt es seit" |
| `im_klimaplan` | im Klimaplan | Im Klimaplan vorgesehen, nicht als umgesetzt gemeldet. | „wird gemacht", „ist umgesetzt" |
| `in_fachplaenen` | in Fachplänen | In Fachplänen vorgesehen, nicht als umgesetzt gemeldet. | „wird gemacht", „ist umgesetzt" |
| `neu_umsetzbar` | machbar, nicht beschlossen | Von der Landesverwaltung als machbar eingestuft, aber nicht beschlossen. | „wird umgesetzt", „ist geplant" |
| `vertieft_pruefen` | in Prüfung | Wird noch geprüft, Ergebnis offen. | „wird gemacht", „ist vorgesehen" |
| `unklar` | offen | Bewertung unklar. | „wird gemacht" |
| `nicht_umsetzbar` | nicht umsetzbar | Als nicht umsetzbar bewertet; wird nicht umgesetzt. | „wird gemacht", „ist geplant", „könnte" ohne Hinweis auf die Ablehnung |

Zwei Regeln gelten darüber:

1. **Zuschreibung statt Behauptung.** Jede Statusaussage wird der
   Landesverwaltung zugeschrieben („laut Rückmeldung"). Die Antwort spricht
   nie in eigener Autorität über den Stand.
2. **Gruppierung bei Mehrfach-Treffern.** Trifft eine Frage mehrere
   Maßnahmen mit verschiedenem Status, gliedert die Antwort nach Status.

Entscheidend ist, **wo** das steht: Die Tabelle ist das Bedeutungs-Wörterbuch
der Facette `lv_bewertung` in der Library-Konfiguration. Die zwei Regeln
sind der Antwortregeln-Text derselben Library. Nichts davon ist Code.

## 3a. Wo gepflegt wird: ein Ort, die Library-Konfiguration

Owner-Entscheidung 06.10.: **Kein Code pro Dokumenttyp.** Eine Library
mischt Typen (Maßnahme, Event, PDF, …), die in der Ansicht verschieden
wirken, im Retriever aber übergreifend funktionieren müssen. Deshalb hängt
alles am Facetten-Schema der Library und an einem Regeltext der Library,
beides dynamisch pflegbar in den Settings:

| Baustein | Wo | Was | Wirkt auf |
|---|---|---|---|
| `facets[].werte` | Facetten-Schema (`chat.gallery.facets`) | Wörterbuch je Wert: `wert`, `label`, `bedeutung`, optional `verboten[]` | Quellen-Header (Bedeutungskontext je Textstelle), Fußnote, Nachprüfung, Galerie-Labels |
| `facets[].ingestKontext` | Facetten-Schema | Flag: Feld geht als Klartext in Chunk-Vorspann und Dokument-Embedding | Ingestion (Re-Ingest nötig) |
| `chat.antwortregeln` | Library-Konfiguration, neues Feld | Markdown mit `{{facette:…}}` und `{{legende:…}}` | System-Message |
| Golden-Set | bei der Library (Konfiguration oder Datei im Storage) | Fragen, erwartete Werte, Kriterien | Messung |
| Template | Template-Ordner der Library | `summary` nennt den Status in einem Satz | Summary-Retriever (Re-Ingest nötig) |

Drei Folgerungen:

- **Typübergreifend ohne Sonderfall.** Der Quellen-Header einer Textstelle
  zeigt die Bedeutungen der Facettenwerte, die das Dokument hat. Ein Event
  ohne `lv_bewertung` zeigt dort nichts. Die Antwortregeln formulieren
  entsprechend „wo vorhanden".
- **Bedingung als Wörterbuch, nicht als Syntax.** „Wenn Status X, dann
  Bedeutung Y" sitzt am Wert der Facette. Der Regeltext braucht deshalb
  keine Wenn-dann-Syntax und keinen Parser; `{{legende:lv_bewertung}}` setzt
  die ganze Tabelle ein. Eine Bedingungssyntax bleibt im Vorrat, falls ein
  Fall sie wirklich braucht.
- **Platzhalter sind Vertrag.** Ein Platzhalter auf eine Facette, die es im
  Schema nicht gibt, wird beim Speichern abgelehnt. Kein stilles Leerlassen
  (no-silent-fallbacks).

Die Registry der Detailansichtstypen bleibt, was sie ist: UI-Wissen
(Plakette, Kennzeile, Default-Facetten). Sie darf das Wörterbuch für neue
Libraries **vorbelegen** (für `climateAction` aus der bestehenden
Plaketten-Zuordnung), die Library-Konfiguration ist die Wahrheit.

Ehrliche Kosten dieses Wegs: Freitext ist nicht typgeprüft, die Qualität
hängt an der Autorin der Regeln. Dagegen stehen die Platzhalter-Validierung,
die `verboten`-Listen und das Golden-Set pro Library. Zweitens muss der
Antwort-Cache Regeln und Wörterbuch im Schlüssel tragen (m3), sonst
überleben alte Antworten eine Regeländerung.

## 4. Hebel, von billig nach aufwändig

**Hebel A, Regeln und Kontext (m1, m2, m3).** Wörterbuch und Regeltext in
der Konfiguration; der Quellen-Header trägt je Textstelle `Bewertung
Landesverwaltung: nicht umsetzbar — als nicht umsetzbar bewertet; wird nicht
umgesetzt`; die System-Message bekommt die aufgelösten Antwortregeln. Wirkt
sofort, ohne Re-Ingest.

**Hebel B, deterministische Nachprüfung (m4).** Der Server kennt für jede
zitierte Quelle die Facettenwerte. Er hängt eine Fußnote an („Stand laut
Landesverwaltung: 2 in Umsetzung, 1 in Prüfung, 1 nicht umsetzbar") und
prüft den Text gegen die `verboten`-Listen der getroffenen Werte. Treffer
landen im Query-Log, der Text wird nicht umgeschrieben. Der einzige Hebel,
der nie halluziniert, und die Grundlage der Messung.

**Hebel C, Ingest-Kontext (m5).** Facetten mit `ingestKontext` in
Chunk-Vorspann und Dokument-Embedding; Template-Anweisung für `summary`.
Braucht Re-Ingest, deshalb erst, wenn A+B in der Messung nicht reichen oder
die Library ohnehin neu ingestiert wird.

**Hebel D, Kontroll-Durchlauf (m6).** Zweiter Modellaufruf gegen die
Bedeutungen der zitierten Dokumente. Nur bei Bedarf.

Reihenfolge: m0 Golden-Set und Baseline, dann A und B zusammen, dann C,
D nur bei Bedarf.

## 5. Systemisch prüfen: Golden-Set aus Use Cases

Die Prüfung ist Teil des Plans, nicht Nacharbeit. Ohne Baseline weiß niemand,
ob die Regeln allein reichen.

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

**Erwartung als Kriterien, nicht als Wortlaut.** Format (JSON, ein Eintrag
je Frage). Das Set mit echten Maßnahmen-Nummern liegt bei der Library (§3a);
im Repo steht nur ein synthetisches Beispiel. Die Verbotsliste muss nicht
wiederholt werden, sie kommt aus dem Wörterbuch der Facette:

```json
{
  "id": "schwerverkehr-themenfrage",
  "frage": "Was tut Südtirol beim Schwerverkehr?",
  "typ": "themenfrage",
  "erwarteteDokumente": [
    { "massnahme_nr": "…", "lv_bewertung": "in_umsetzung" },
    { "massnahme_nr": "…", "lv_bewertung": "nicht_umsetzbar" }
  ],
  "pflicht": {
    "werteGenannt": { "lv_bewertung": ["in_umsetzung", "nicht_umsetzbar"] },
    "zuschreibung": true,
    "gruppierung": true
  }
}
```

**Zwei Prüfebenen:**

- **Deterministisch** (ohne Modell bewertbar): zitierte Dokumente gegen
  `erwarteteDokumente`; `verboten`-Listen der getroffenen Werte gegen den
  Antworttext; Pflicht-Labels im Text vorhanden. Dieselbe Logik wie Hebel B,
  deshalb eine wiederverwendbare Funktion.
- **Qualitativ** (Richter-Modell mit fester Rubrik): Modalität korrekt,
  Zuschreibung vorhanden, keine Erfolgsbehauptung, Gruppierung bei
  Mehrfach-Treffern. Vier Ja/Nein-Fragen, kein Freitext-Urteil.

**Ablauf.** Golden-Set einmal gegen den heutigen Stand fahren (Baseline),
Trefferquote je Fragetyp und je Wert festhalten. Nach jedem Hebel
wiederholen. Die Läufe landen im Query-Log. Die Prompt-Ebene (Hebel A) lässt
sich zusätzlich mit Fixture-Chunks und Mock-Modell unit-testen (Legende in
der System-Message, Bedeutung im Header, abgelehnter Platzhalter).

## 6. Was nicht in diesen Plan gehört

- Vereinheitlichung Plakette vs. Kartenfarbe (D6-Kandidat) — eigene Aufgabe.
- Wenn-dann-Syntax im Regeltext — Vorrat, erst bei nachgewiesenem Bedarf
  (§3a).
- Datum der Rückmeldung als eigenes Feld (die Bewertung gilt „zu einem
  Zeitpunkt"). Sinnvoll, aber Template-Änderung mit Re-Ingest; Vorrat.

## 7. Betroffene Dateien

- `packages/contracts/src/library-chat.ts`, `src/lib/chat/config.ts`,
  `src/lib/chat/dynamic-facets.ts` — `werte`, `ingestKontext`,
  `antwortregeln`
- `src/components/settings/FacetDefsEditor.tsx`, Settings-Chat-Tab —
  Eingaben für Wörterbuch, Flag und Regeltext
- `src/lib/chat/common/prompt.ts` — Header mit Bedeutung, Regeln in der
  System-Message, Platzhalter-Auflösung
- `src/lib/chat/utils/cache-hash-builder.ts` — Regeln und Wörterbuch im
  Cache-Schlüssel
- `src/lib/chat/orchestrator.ts` — Nachprüfung und Fußnote nach der Antwort
- `src/lib/ingestion/metadata-formatter.ts`,
  `src/lib/ingestion/document-text-builder.ts`,
  `src/lib/chat/ingestion-service.ts` — Facetten mit `ingestKontext` im
  Vorspann (Hebel C)
- `template-samples/klimamassnahme-detail1-de.md` — `summary` mit Status-Satz
- `tests/unit/chat/` — Schema-Validierung, Platzhalter-Ablehnung,
  Header-Bedeutung, deterministische Prüfung, Zod-Schema des Golden-Set-
  Formats mit synthetischem Beispiel
