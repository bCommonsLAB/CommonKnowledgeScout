# Brückentest 2.44 — Use Cases einzeln prüfen und protokollieren

Stand 08.10.2026. Handover für einen Claude-Chat (Cowork) mit der
KnowledgeScout-MCP-Brücke. Geprüft werden die Werkzeuge der Wellen A bis H
aus [`bruecke-library-betrieb.plan.md`](../plans/geplant/bruecke-library-betrieb.plan.md)
und [`veranstaltungen-ueber-die-bruecke.plan.md`](../plans/geplant/veranstaltungen-ueber-die-bruecke.plan.md);
was sie tun, steht in [`mcp-library-betrieb.md`](mcp-library-betrieb.md).

**So wird dieses Dokument benutzt:** Der Owner kopiert es in einen neuen
Claude-Chat und sagt, welche Tests laufen sollen („T0 bis T5" oder „nur T12").
Der Agent fährt jeden Test einzeln, schreibt das Ergebnis sofort ins
Protokoll und fragt vor jedem schreibenden Test einmal nach. Das Protokoll
liegt danach im Archiv und wird in einer Claude-Code-Session über die Brücke
gelesen und ausgewertet.

---

## 1. Regeln für den testenden Agenten

1. **Zwei Libraries, beide bestätigen lassen.** Die *Test-Library*, gegen die
   getestet wird, und die *Archiv-Library*, in die das Protokoll geschrieben
   wird. Nie raten, beide Namen und Ids vom Owner bestätigen lassen
   (`bibliotheken_auflisten`).
2. **Ein Test, ein Eintrag.** Nach jedem Test sofort ins Protokoll schreiben,
   nicht am Ende gesammelt. Bricht der Chat ab, sind die bisherigen Ergebnisse
   gesichert.
3. **Nichts glätten.** Weicht eine Antwort von der Erwartung ab, wird sie
   wörtlich (gekürzt) ins Protokoll übernommen. „Hat funktioniert" ohne die
   geprüften Felder zählt nicht.
4. **Schreibende Tests nur nach Rückfrage**, je Test einmal: was geschrieben
   wird, wo, was es kostet. Lesende Tests ohne Rückfrage.
5. **Begründung mit Kennung.** Jede `begruendung` beginnt mit
   `Brückentest 2.44 T<n>:` — so findet die Auswertung die Aktionen im
   Aktions-Protokoll (`protokoll_lesen`).
6. **Aufräumen ist Teil des Tests.** Was ein Test ändert, stellt er am Ende
   zurück (steht je Test unter „Zurückstellen"). Gelingt das nicht, steht es
   im Protokoll.
7. **Keine Geheimnisse ins Protokoll.** Keine Schlüssel, keine Mailadressen
   außer der des Owners, keine Volltexte von Transkripten; Auszüge bis 300
   Zeichen.
8. **Kein Abbruch bei Fehlschlag.** Ein gescheiterter Test wird protokolliert,
   dann geht es mit dem nächsten weiter, sofern er nicht davon abhängt.

## 2. Das Protokoll

**Ablage:** in der Archiv-Library unter
`24.09 KnowledgeScout/Tests/<JJJJ-MM-TT> Brückentest 2.44.md`. Den Ordner
`Tests` mit `ordner_anlegen` anlegen, falls er fehlt. Gibt es die Datei schon
(zweiter Lauf am selben Tag), Suffix `-2`.

**Anlegen** (vor T0) mit `datei_anlegen` und diesem Kopf. Das Frontmatter ist
flach, `snake_case`, keine verschachtelten Objekte:

```markdown
---
title: Brückentest 2.44
datum: <JJJJ-MM-TT>
toolset_version: <aus bruecke_info>
test_library_id: <Id>
test_library_name: <Name>
archiv_library_id: <Id>
tester: claude-chat
tests_geplant: [T0, T1, …]
---

# Brückentest 2.44

## Zusammenfassung

| Test | Ergebnis | Kurz |
|---|---|---|
```

**Nach jedem Test** zwei Schreibvorgänge in EINEM `datei_patchen`-Aufruf
(`modi`, alles oder nichts, `ifVersion` aus der letzten Antwort):

1. `tabelle_zeile_einfuegen` unter `## Zusammenfassung`:
   `| T<n> | ok / abweichung / fehler / übersprungen | ein Satz |`
2. `abschnitt_einfuegen` hinter dem letzten Abschnitt, mit diesem Block:

````markdown
## T<n> <Titel>

- **Zeitpunkt:** <ISO-Zeit>
- **Ergebnis:** ok | abweichung | fehler | übersprungen
- **Geprüft:** <welche Erwartungen aus dem Handover, je Punkt ja/nein>
- **Abweichung:** <was anders war, wörtlich gekürzt; sonst „keine">
- **Zurückgestellt:** ja | nein | nicht nötig

```json
{
  "test": "T<n>",
  "werkzeuge": ["<werkzeug>", "..."],
  "aufrufe": [{ "werkzeug": "<name>", "parameter": { "...": "ohne begruendung, ohne Geheimnisse" } }],
  "antwort_auszug": { "<feld>": "<wert>" },
  "erwartungen": [{ "punkt": "<aus dem Handover>", "erfuellt": true }],
  "ids": { "jobIds": [], "queryIds": [], "sourceIds": [], "batchId": null },
  "dauer_sekunden": 0,
  "fehlertext": null
}
```
````

`antwort_auszug` enthält genau die Felder, die die Erwartungen prüfen, nicht
die ganze Antwort. Ids werden immer mitgeschrieben: an ihnen wertet die
Claude-Code-Session über `job_status`, `frage_log_lesen` und
`protokoll_lesen` nach.

**Zum Schluss** unter `## Zusammenfassung` einen Absatz: wie viele Tests ok,
welche mit Abweichung, was offen blieb, was zurückgestellt werden muss.

## 3. Vorbereitung

### T0 Version und Libraries

- **Werkzeuge:** `bruecke_info`, `bibliotheken_auflisten`
- **Erwartung:**
  - `toolsetVersion` ist `2.44.1`, `werkzeuge` hat 62 Einträge, darunter
    `dokumente_auflisten`, `index_aktualisieren`, `konfiguration_setzen`,
    `golden_set_fahren`, `sammeldatei_anlegen`, `artefakt_lesen`.
  - Fehlt eines in der eigenen Werkzeugsicht: Owner bittet, die Erweiterung
    aus- und einzuschalten; danach T0 wiederholen.
  - Owner bestätigt Test-Library und Archiv-Library.
- **Danach:** Protokoll anlegen (Abschnitt 2), T0 eintragen.

Für die folgenden Tests nennt der Owner einmal vorab, was es in der
Test-Library gibt. Fehlt etwas, wird der betroffene Test als „übersprungen"
mit Grund eingetragen:

| Bezeichnung | Was |
|---|---|
| `ORDNER_KLEIN` | Ordner mit 2–5 publizierten Dokumenten, darin wenn möglich ein `_`-Ordner oder `test/` |
| `KENNUNGSFELD` | Feld, das je Dokument eindeutig sein soll (z. B. eine Nummer); sonst leer |
| `DOK_TEST` | Ein publiziertes Dokument, das kurz geändert und wieder hergestellt werden darf |
| `AUDIO_A`, `AUDIO_B` | Zwei kurze Audios (unter 10 Minuten), noch nicht oder egal ob transkribiert |
| `VIDEO_X` | Ein Video (für den Negativtest, es wird nichts gestartet) |
| `VERANST_ORDNER` | Ordner mit Quellen, die schon Transkripte haben (für Sammeldateien) |
| `GOLDEN_SET` | Pfad einer Golden-Set-JSON in der Library; sonst leer |

## 4. Lesende Tests (keine Rückfrage)

### T1 Bestand als Feldzeilen — `dokumente_auflisten`

- **Aufrufe:**
  1. ohne Filter, `proSeite: 10`
  2. mit `facettenWerte` aus einem Wert, der in Aufruf 1 vorkommt
  3. mit `suche` auf einen Titelteil aus Aufruf 1
  4. `seite: 2`, `proSeite: 10`
- **Erwartung:**
  - `total` in Aufruf 1 entspricht der Zahl, die die Galerie der Library ohne
    Filter zeigt (Owner schaut im Browser nach).
  - Aufruf 2 und 3 liefern weniger oder gleich viele Treffer, jeder Treffer
    trägt den gefilterten Wert bzw. den Suchbegriff.
  - Aufruf 4 liefert andere `sourceId`s als Aufruf 1.
  - Jede Zeile hat `facettenWerte` für die Facetten der Library.
  - Eine unbekannte Facette im Filter ergibt einen Fehler mit der Liste der
    bekannten Facetten (Aufruf 5: `facettenWerte: { "gibt_es_nicht": ["x"] }`).

### T2 Bestand prüfen — `bestand_pruefen`

- **Aufrufe:** einmal mit `kennungsfeld: KENNUNGSFELD`, einmal ohne.
- **Erwartung:**
  - Ohne `kennungsfeld` steht in `uebersprungen` ein Satz zu
    `doppelte_kennung`.
  - `zaehler` hat genau die vier Regeln; jede Zahl passt zur Länge der
    zugehörigen `befunde`.
  - Hat keine Facette ein Wörterbuch, steht das in `uebersprungen`.
  - Liegt in `ORDNER_KLEIN` ein Eintrag aus `_`- oder `test/`-Ordner, steht er
    als `twin_oder_testordner` in den Befunden.
  - Stichprobe: ein Befund `pflichtfeld_fehlt` wird mit `dokumente_auflisten`
    gegengeprüft (Feld wirklich leer).

### T3 Läufe bilanzieren — `batch_bilanz`

- **Aufrufe:** ohne `batchId`/`batchName`, dann mit einem der genannten
  `batchNamen`.
- **Erwartung:**
  - Ohne Angabe: `batchNamen` als Liste, kein Fehler.
  - Mit Batch: `zaehler.total` ist die Summe der Einzelzähler.
  - Gibt es Fehlschläge: `fehlerNachUrsache` ist nach `anzahl` absteigend,
    jede Gruppe hat `ursache`, `jobIds`, `quellen`; eine `jobId` daraus mit
    `job_status` öffnen, die Meldung dort passt zur Gruppe.

### T4 Konfiguration lesen — `konfiguration_lesen`

- **Aufrufe:** ohne `bereich`, dann `bereich: "antwortregeln"`.
- **Erwartung:**
  - Ohne Bereich kommen `facetten`, `antwortregeln`, `chat`, `galerie`,
    `veroeffentlichung`.
  - `chat.nurLesbar` zeigt `embeddings` und `vectorStore`.
  - `veroeffentlichung` nennt `apiKeyGesetzt` als true/false, nie einen
    Schlüsselwert.
  - Die Facetten entsprechen dem, was der Facetten-Editor in den Settings zeigt.

### T5 Artefakte lesen — `artefakt_lesen`

- **Aufrufe:** für eine Quelle mit Transkript und Transformation:
  1. `art: "transkript"`, `maxZeichen: 300`
  2. `art: "transformation"` ohne `vorlage`
  3. `art: "transformation"`, `sprache: "fr"` (oder eine Sprache, die es nicht gibt)
- **Erwartung:**
  - Aufruf 1: `text` höchstens 300 Zeichen, `gekuerzt: true` wenn länger,
    `frontmatter` als Objekt, `vorhanden` listet die Artefakte.
  - Aufruf 2: `vorlage` ist benannt.
  - Aufruf 3: Fehler, der die vorhandenen Vorlagen/Sprachen nennt.

### T6 Eine Frage stellen — `frage_stellen`, `frage_log_lesen`

- **Kosten:** ein bis drei Modellaufrufe, Cent-Bereich. Schreibt nur
  Query-Logs; trotzdem kurz Bescheid geben.
- **Aufrufe:**
  1. eine typische Frage, `ohneCache: true`
  2. dieselbe Frage, `ohneCache: false`
  3. dieselbe Frage, `ohneCache: true`, `baseline: true`
  4. `frage_log_lesen` mit der `queryId` aus Aufruf 1, dann mit `mitPrompt: true`
- **Erwartung:**
  - Aufruf 1: `antwort`, `dokumente` mit Nummern und Facettenwerten,
    `zitiert`, `queryId`, `timing`.
  - Aufruf 2: `cacheTreffer: true` (dieselbe Antwort wie 1).
  - Aufruf 3: `baseline: true`; hat die Library Antwortregeln, unterscheidet
    sich die Antwort erkennbar.
  - Aufruf 4: `frage`, `antwort`, `cacheHash`, `belege` passen zu Aufruf 1;
    `prompt` nur mit `mitPrompt`.
  - Owner stellt dieselbe Frage im Story-Modus: Belege zeigen dieselben
    Dokumente wie Aufruf 1 (Reihenfolge darf abweichen).

## 5. Schreibende Tests (je Test eine Rückfrage)

### T7 Konfiguration setzen — `konfiguration_setzen`

- **Aufrufe:**
  1. **Negativ:** `antwortregeln: "Gliedere nach {{facette:gibt_es_nicht}}."`
  2. **Negativ:** `chat: { "embeddings": { "dimensions": 1 } }`
  3. **Positiv:** `chat: { "placeholder": "Brückentest – bitte ignorieren" }`
  4. `konfiguration_lesen` mit `bereich: "chat"`
- **Erwartung:**
  - Aufruf 1: Fehler „Chat-Konfiguration ungueltig" mit dem Pfad
    `antwortregeln` und dem Platzhalter. Nichts gespeichert (T4 zum Vergleich).
  - Aufruf 2: Fehler „nicht ueber die Bruecke setzbar: embeddings".
  - Aufruf 3: `geaendert: ["chat.placeholder"]`.
  - Aufruf 4 zeigt den neuen Platzhalter; der Owner sieht ihn im Chat-Feld der
    Library.
- **Zurückstellen:** Aufruf 3 mit dem alten Wert aus T4 wiederholen, danach
  `geaendert` prüfen.

### T8 Felder setzen bis in die Chunks — `dokument_felder_setzen`

- **Aufrufe:** an `DOK_TEST` ein Tag ergänzen
  (`listen: { "tags": ["brueckentest"] }`).
- **Erwartung:**
  - Zeile mit `metaDokument: "aktualisiert"` und `chunks` größer null.
  - `dokumente_auflisten` mit `facettenWerte: { "tags": ["brueckentest"] }`
    findet `DOK_TEST`.
  - Wenn `tags` als Facette im Chat wirkt: `frage_stellen` mit dem Filter im
    Story-Modus findet `DOK_TEST` (optional, Owner im Browser).
- **Zurückstellen:** `entfernen: { "tags": ["brueckentest"] }`, `chunks`
  wieder größer null.

### T9 Index nachziehen hinter dem Zaun — `index_aktualisieren`, `batch_bilanz`

- **Kosten:** kein Modellaufruf, nur Einbettungen der betroffenen Dokumente.
- **Aufrufe:**
  1. `ordner: ORDNER_KLEIN`, `rekursiv: true`
  2. nach ein bis zwei Minuten `batch_bilanz` mit der `batchId`
  3. `dokumente_auflisten` wie in T1, Aufruf 1
- **Erwartung:**
  - Aufruf 1: `batchId` gesetzt (bei mehr als einer Quelle), `zaun` genannt,
    `uebersprungeneOrdner` enthält die `_`/`test`-Ordner des Ordners.
  - Quellen ohne Transformation stehen als Zeile mit `fehler`, nicht als Job.
  - Aufruf 2: alle Jobs `completed`; sonst die Ursache aus
    `fehlerNachUrsache` ins Protokoll.
  - Aufruf 3: `total` unverändert gegenüber T1 (keine Doppelgänger entstanden).
- **Gegenprobe im UI** (Owner): Batch-Dialog „Verzeichnis verarbeiten" auf
  denselben Ordner öffnen, ohne zu starten. Die Statistik zeigt „Ordner
  ausgelassen" mit derselben Zahl wie `uebersprungeneOrdner`.

### T10 Eintrag entfernen und wiederherstellen — `index_entfernen`, `index_aktualisieren`

- **Aufrufe:**
  1. `index_entfernen` mit `sourceIds: [DOK_TEST]`
  2. `dokumente_auflisten` mit `suche` auf den Titel von `DOK_TEST`
  3. `index_aktualisieren` mit `sourceIds: [DOK_TEST]`, warten, `job_status`
  4. Aufruf 2 wiederholen
- **Erwartung:**
  - Aufruf 1: `entfernt: 1`. Aufruf 2: kein Treffer.
  - Aufruf 3: Job `completed`. Aufruf 4: `DOK_TEST` ist wieder da.
- **Zurückstellen:** ergibt sich aus Aufruf 3; scheitert er, `dokument_publizieren`
  (Markdown) bzw. `transformation_starten` für `DOK_TEST` und im Protokoll
  vermerken.

### T11 Neustart gezielt — `batch_neustart`

- **Vorbedingung:** eine Fehlergruppe aus T3 oder T9, deren Ursache behoben
  ist. Gibt es keine: „übersprungen, keine behobene Fehlergruppe".
- **Aufrufe:** `jobIds` aus der Gruppe, dann `batch_bilanz`.
- **Erwartung:**
  - `neuGestartet` gleich der Zahl der Jobs, laufende stehen in
    `uebersprungeneJobs` mit Grund.
  - Nach dem Lauf: Jobs `completed` oder eine neue, andere Ursache.

### T12 Zwei Wege bei Audio — `quelle_erschliessen`, `job_status`

- **Kosten:** Transkription beider Audios, Sprecher-Modell rund 0,006 USD je
  Minute, Standard rund 0,0045 USD je Minute. Vorher die Minuten nennen.
- **Aufrufe:**
  1. `AUDIO_A`: `template: "nur_transkript"`, `sprecherErkennung: true`
  2. `AUDIO_B`: `template: "nur_transkript"`, `sprecherErkennung: false`,
     `kontext: "<Thema der Aufnahme>"`, `begriffe: ["<zwei Namen oder Fachwörter>"]`
  3. `VIDEO_X`: `sprecherErkennung: true`
  4. `job_status` für die Jobs aus 1 und 2, bis `completed`
  5. `artefakt_lesen` (`art: "transkript"`, `maxZeichen: 600`) für beide
- **Erwartung:**
  - Aufruf 1: `jobs[0].transkription.weg` ist `mit_sprechererkennung`,
    `herkunft: "aufruf"`, `naechsterSchritt` nennt den Reiter „Korrektur".
  - Aufruf 2: `ohne_sprechererkennung`, `audioKontext` gibt Kontext und
    Begriffe zurück.
  - Aufruf 3: Zeile mit `fehler`, der „nur fuer Audio" sagt; kein Job.
  - Aufruf 4: `audioKontext` am Job zeigt jeweils den Weg.
  - Aufruf 5: Transkript A hat Sprecher-Labels (`frontmatter.speakers`),
    Transkript B nicht; in B sind die Begriffe richtig geschrieben.
  - Ohne `sprecherErkennung` (Aufruf 6, optional, drittes Audio): `herkunft`
    ist `library` oder `standard`, passend zur Library-Einstellung.

### T13 Sammeldatei anlegen, prüfen, Abhängige finden — Welle E

- **Kosten:** eine Transformation (Cent-Bereich).
- **Aufrufe:**
  1. **Negativ:** `sammeldatei_anlegen` mit einer Quelle ohne Transkript
  2. `sammeldatei_anlegen` in `VERANST_ORDNER`, `dateiname:
     "brueckentest-sammeldatei.md"`, zwei Quellen mit Transkript, `titel:
     "Brückentest"`, ohne `transformieren`
  3. **Negativ:** Aufruf 2 wiederholen (gleicher Name)
  4. `sammeldatei_pruefen` auf die neue Datei
  5. `transformation_starten` auf die Sammeldatei, warten bis `completed`
  6. `sammeldatei_pruefen` erneut
  7. `abhaengige_dokumente` für eine der beiden Quellen
- **Erwartung:**
  - Aufruf 1: Fehler „Quellen ohne Transkript: …", nichts geschrieben
    (`ordner_listen` zeigt keine neue Datei).
  - Aufruf 2: `sourceId`, `quellen` in Reihenfolge.
  - Aufruf 3: Fehler „gibt es in diesem Ordner schon".
  - Aufruf 4: `ok: true`, `fehlend` leer, `abhaengigkeitVermerkt: false`.
  - Aufruf 6: `abhaengigkeitVermerkt: true`, eine Transformation gelistet.
  - Aufruf 7: die neue Sammeldatei steht in `sammeldateien`,
    `ueberholt: false` (noch keine Korrektur).
- **Weiter in T14**, erst danach zurückstellen.

### T14 Haltepunkt Mensch: Korrektur und Nachziehen

- **Wer:** der Owner im Reiter „Korrektur" der KS-Oberfläche; der Agent prüft
  davor und danach.
- **Ablauf:**
  1. Agent nennt die Quelle aus T13, Aufruf 7, und bittet den Owner, dort ein
     Wort zu korrigieren und zu schreiben.
  2. Owner bestätigt; er notiert, ob der Reiter nach dem Schreiben die
     Sammeldatei als „enthalten und jetzt überholt" nennt.
  3. Agent: `abhaengige_dokumente` für dieselbe Quelle.
  4. Agent: `korrekturen_lesen` mit `pfad: VERANST_ORDNER` (nur wenn dort ein
     Korrekturauftrag offen ist; sonst übersprungen).
  5. Agent: `transformation_starten` auf die Sammeldatei, danach Aufruf 3
     wiederholen.
- **Erwartung:**
  - Schritt 2: der Reiter nennt die Sammeldatei.
  - Schritt 3: `korrigiertAm` gesetzt, die Sammeldatei `ueberholt: true`.
  - Schritt 4: der Auftrag trägt `sammeldateien` mit dem Namen.
  - Schritt 5: `jobs[0].erzwungen` ist `quelle_juenger` (kein „ist aktuell"),
    danach `ueberholt: false`.
- **Zurückstellen:** die Korrektur im Reiter zurücknehmen (ein Satz im
  Protokoll, wie), Sammeldatei mit `loeschen` entfernen und ihren Eintrag mit
  `index_entfernen`.

### T15 Golden-Set als Job — `golden_set_fahren`

- **Vorbedingung:** `GOLDEN_SET` vorhanden; sonst übersprungen.
- **Kosten:** ein Modellaufruf je Frage, mit Richter zwei. Mit `nur` auf
  zwei Fragen begrenzen.
- **Aufrufe:**
  1. `setPfad: GOLDEN_SET`, `titel: "Brückentest"`, `nur: [<zwei IDs>]`
  2. `job_status` alle 30 Sekunden bis `completed`
  3. `ordner_listen` auf den Ordner der Set-Datei
  4. `frage_log_lesen` für eine `queryId` aus `ergebnis.queryIds`
- **Erwartung:**
  - Aufruf 1: `jobId` sofort.
  - Aufruf 2: `meldung` zählt hoch („1/2 …", „2/2 …"), am Ende `ergebnis`
    mit `bericht`, `berichtDatei`, `queryIds`.
  - Aufruf 3: die Berichtsdatei liegt neben dem Set.
  - Aufruf 4: `filtersNormalized.goldenSet` trägt Titel und Frage-Id.
- **Zurückstellen:** Berichtsdatei bleibt liegen (sie ist das Ergebnis), im
  Protokoll ihren Pfad nennen.

### T16 Settings-Formular unverändert (Owner, UI)

- **Warum:** Die PATCH-Route prüft die Chat-Konfiguration seit 2.40.0 streng.
- **Ablauf:** Owner öffnet die Chat-Settings der Test-Library, ändert nichts,
  speichert.
- **Erwartung:** Speichern gelingt. Kommt ein Fehler mit
  „Chat-Konfiguration ungueltig", die Fehlerzeilen wörtlich ins Protokoll —
  dann trägt die gespeicherte Konfiguration einen Altfehler.

## 6. Drehbuch-Test (optional, eigener Chat)

### T17 Skill `veranstaltung-aufbereiten` auf einen Veranstaltungsordner

Eigener Chat, weil er lang ist. Der Agent lädt den Skill, fährt die Stationen
und protokolliert je Station einen Abschnitt `## T17.<Station>` im selben
Format. Zusätzlich je Station: Zahl der Rückfragen an den Owner und ob der
Haltepunkt in Station 4 eingehalten wurde. Soll: drei Rückfragen und ein
Haltepunkt.

## 7. Auswertung in Claude Code

Die Claude-Code-Session bekommt den Pfad des Protokolls und liest es über die
Brücke (`datei_lesen` in der Archiv-Library). Sie prüft je Test die
`erwartungen` gegen die Ids: `job_status` für Jobs, `frage_log_lesen` für
Fragen, `protokoll_lesen` (Begründungen mit `Brückentest 2.44`) für alle
schreibenden Aktionen. Abweichungen werden dort als Befund mit Datum unter
„Neu dazugekommen" des laufenden Vorhabens eingetragen und, wenn sie Code
betreffen, als nächste Welle geschnitten.
