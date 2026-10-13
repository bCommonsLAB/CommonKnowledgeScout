# Library-Betrieb über die MCP-Brücke

Stand 08.10.2026, Werkzeugsatz **2.45.0** (2.42.0 Welle B, 2.43.0 Welle E, 2.44.0 Welle G aus dem Veranstaltungs-Plan, 2.45.0 Library-Anlage, siehe unten; das Drehbuch ist der Skill `veranstaltung-aufbereiten`). Gebaut nach
[`docs/plans/geplant/bruecke-library-betrieb.plan.md`](../plans/geplant/bruecke-library-betrieb.plan.md)
(Wellen A, C, D, F). Die Brücke war bis 2.37.0 eine Archiv-Brücke: sie
pflegte Twins, Berichte und Website-Seiten. Seit 2.41.0 kann sie eine Library
auch **betreiben**: Bestand sehen, Läufe bilanzieren, Index nachziehen,
Konfiguration setzen, Antworten messen. Jedes Werkzeug ruft dieselbe
Funktion wie das UI (ADR 0007), keine zweite Logik.

## Die Werkzeuge je Use Case

| Use Case | Werkzeug | Liest/Schreibt | Dieselbe Funktion wie |
|---|---|---|---|
| **4 Bestand prüfen** | `dokumente_auflisten` | liest | Galerie-Route (`api/chat/[libraryId]/docs`): Typ-Scope, Facettenfilter, Suche (`docs-suchfilter.ts`), Galerie-Sortierung |
| | `bestand_pruefen` | liest | Regeln in `bestand-pruefung.ts`: doppelte Kennung (`kennungsfeld`), Werte außerhalb des Facetten-Wörterbuchs, fehlende Pflichtfelder des Typs (Registry), Twin-/test-Ordner (Quellordner des Twins) |
| **5 Läufe bilanzieren** | `batch_bilanz` | liest | `ExternalJobsRepository`, Fehlerdetails aus dem Job-Trace (`job-fehler-details.ts`), Deutung (`fehler-deutung.ts`) |
| | `batch_neustart` | schreibt | Neustart-Knopf im Job-Monitor (`start-batch`): `requeueForRestart` + Worker-Tick |
| **3 Index nachziehen** | `index_aktualisieren` | schreibt | Pipeline-Route, nur Phase 3: `enqueue-ingest-job.ts`, Start-Route-Pfad `runIngestOnly`; Zaun `batch-zaun.ts` wie der Batch-Dialog |
| | `index_entfernen` | schreibt | `depubliziereQuelle` (Stapel) |
| | `dokument_felder_setzen` | schreibt | zusätzlich `patchChunkFelder`: Chunks tragen dieselben Felder wie das Meta-Dokument |
| **1 Konfigurieren** | `konfiguration_lesen` | liest | `config.chat` je Bereich; Veröffentlichung wie `veroeffentlichung_lesen` |
| | `konfiguration_setzen` | schreibt | `chat-config-validation.ts` — dasselbe Zod-Schema wie das Settings-Formular, inkl. Platzhalter-Querprüfung; nutzt auch die PATCH-Route |
| **2 Messen** | `frage_stellen` | schreibt Query-Log | Stream-Route: `bruecke-frage.ts` (Filter, Retriever-Entscheidung, Regeln, Nachprüfung, Cache-Hash) |
| | `golden_set_fahren` | schreibt (Job) | `golden-set/lauf.ts` — derselbe Kern wie `scripts/golden-set-run.ts`; Phase `phase-golden-set.ts` |
| | `frage_log_lesen` | liest | `getQueryLogById` |

## Regeln, die alle Werkzeuge einhalten

- **Schreibende Werkzeuge nur nach Bestätigung**, mit `begruendung` im
  Aktions-Protokoll (`protokoll.ts`).
- **Stapelgrenze 30** (sourceIds), Ordner-Stapel bis 200; **Fehler je Zeile**
  statt Abbruch.
- **Kein stiller Default**: `bestand_pruefen` nennt Regeln, die nicht laufen
  konnten (kein `kennungsfeld`, kein Wörterbuch, Pfad nicht auflösbar);
  `konfiguration_setzen` weist Infrastruktur-Schlüssel (Embeddings, Vektor-Store,
  Modelle) laut ab; `batch_bilanz` wirft bei unbekanntem Job-Status.
- **Zaun** (Owner 08.10.): Twin-Ordner `_…` und `test/` betritt ein Stapel nie —
  Batch-Dialog „Verzeichnis verarbeiten" und `index_aktualisieren` nutzen
  dieselbe Funktion, unabhängig von der Filesystem-Persistierung.
- **60-Sekunden-Grenze der Brücke**: alles mit mehr als einem Modellaufruf
  läuft als Job (`golden_set_fahren`); `frage_stellen` ist eine Frage und
  bleibt synchron.
- **Modell aus der App**, nicht aus dem Aufruf (Standard-Modell; Owner-Entscheid
  28.08.2026).

## Der Ablauf nach dem Live-Test 07./08.10.

1. `bestand_pruefen` mit `kennungsfeld` (z. B. `massnahme_nr`) → Doppelgänger
   und Twin-/test-Einträge → `index_entfernen` mit den sourceIds.
2. `konfiguration_lesen` (facetten, antwortregeln) → Wörterbuch ergänzen,
   Regeln setzen → `konfiguration_setzen`; die Platzhalter-Prüfung weist
   Tippfehler ab, bevor der Chat sie sieht.
3. `golden_set_fahren` mit `baseline: true` (Vorher-Wert), dann ohne
   (Nachher-Wert); Bericht neben der Set-Datei, Einzelfragen über
   `frage_log_lesen`.
4. Nach neuer Facette: `index_aktualisieren` (ordner + rekursiv), dann
   `batch_bilanz`; Fehlergruppen gezielt mit `batch_neustart` (jobIds).

## Was absichtlich fehlt

- Rechte und Scopes des Konto-Schlüssels (offene Kante aus ADR 0008): die
  neuen Werkzeuge schreiben mit den vollen Rechten des Besitzers.
- Automatische Bereinigung: `bestand_pruefen` meldet, der Mensch entscheidet.
- Veröffentlichung setzen über `konfiguration_setzen`: bleibt bei
  `veroeffentlichung_setzen` (eigene Validierung, eigene Außenwirkung).
- Ein Live-Nachweis gegen eine echte Library — der Code ist mit Unit-Tests
  belegt, der Lauf über die Brücke steht aus (siehe Plan, Stand 08.10.).

## Nachtrag Welle B (2.42.0): zwei Wege der Audio-Erschliessung

Owner 08.10.: Beim Analysieren von Audio soll unterscheidbar sein, ob mit
Sprechererkennung gearbeitet wird oder ganz ohne, und im zweiten Fall das
Transkript danach von Hand geprüft wird. `quelle_erschliessen` nimmt dafür
`sprecherErkennung` (true, false, weglassen = Library-Voreinstellung), `kontext`
und `begriffe` (P3a) und nennt je Audio-Quelle den Weg, seine Herkunft
(aufruf, library, standard) und den nächsten Schritt; `wege` zählt den Stapel.
Beide Wege enden im Reiter „Korrektur" der KS-Oberfläche: einmal Sprecher und
Namen bestätigen, einmal Hörfehler von Hand prüfen. `job_status` zeigt den
Audio-Kontext am Job. P6 (`folienAlsTabelle`, `anhangInSuche`) gilt in
`quelle_erschliessen` und `transformation_starten`; nur explizite Booleans
landen im Job (`transform-optionen.ts`), fehlende Werte entscheidet sichtbar
die Library-Voreinstellung.

## Nachtrag Welle E (2.43.0): Einheiten bilden, Abhängige finden

Owner 08.10.: Die Abhängigkeit Sammeldatei → Quellen steht im Twin-Dokument
(`compositeSources`), geschrieben vom Transformations-Job beim Auflösen der
`_source_files` (Loader, beide Pfade). Damit ist „welche Sammeldateien
enthalten diese Quelle?" eine indizierte Mongo-Abfrage statt ein Vollscan.
`sammeldatei_anlegen` geht den Weg des Knopfs „Sammel-Transkript"
(`buildCompositeReference`), prüft Existenz und Transkript jeder Quelle und
überschreibt nichts; `sammeldatei_pruefen` nutzt den Nur-Prüfen-Modus des
Resolvers; `abhaengige_dokumente` liefert je Sammeldatei Vorlage, Sprache und
den Befund überholt (Transformation älter als `revised_at` der Quelle,
dieselbe Regel wie der Badge im Reiter „Korrektur"). Beide Korrektur-Wege
(Reiter, Route, `transkript_korrigieren`) und die Arbeitsliste von
`korrekturen_lesen` nennen die abhängigen Sammeldateien. Sammeldateien, die
vor Welle E zuletzt transformiert wurden, tragen das Feld erst nach dem
nächsten Lauf; für den Prüffall einmal `transformation_starten` erzwingen.

## Nachtrag Wellen G und H (2.44.0): Artefakte lesen, Drehbuch

`artefakt_lesen` liefert Transkript oder Transformation einer Quelle aus
MongoDB ohne Spiegel, Body ohne Frontmatter, auf `maxZeichen` gekürzt, mit
Übersicht der vorhandenen Artefakte. Damit kann ein Agent die Zuordnung der
Einheiten aus den Transkriptanfängen vorschlagen. Der Skill
`veranstaltung-aufbereiten` (`.claude/skills/`) ist das Drehbuch über alle
Werkzeuge: sieben Stationen plus Nachziehen, drei Rückfragen an den Menschen
und der Haltepunkt in Station 4, an dem der Mensch das Transkript im Reiter
„Korrektur" prüft.

## Nachtrag 2.45.0: Library anlegen, Vorlagen und Quellen übernehmen

Ziel: den Flow „Veranstaltung erfassen" von null an über die Brücke fahren,
Geheimnisse bleiben in der Oberfläche.

| Werkzeug | Liest/Schreibt | Dieselbe Funktion wie |
|---|---|---|
| `bibliothek_anlegen` | schreibt | Anlege-Dialog + Speicher-Schritt (`LibraryService.updateLibrary`, Shadow-Twin v2/Mongo, `config.nextcloud` ohne Passwort); `vorlageVon` wie der Klon im Anlege-Dialog (eigener Vektor-Index), aber ohne Zugangsdaten, Secretary-Verbindung, Veröffentlichung, Binary-Storage, Agentensicht (`bibliothek-anlegen.ts`) |
| `speicher_pruefen` | liest | Knopf „Verbindung prüfen" ohne Testordner: `validateConfiguration` + Wurzel listen; nennt nur, ob ein Geheimnis hinterlegt ist |
| `vorlage_uebernehmen` | schreibt | Klon-Kopie der Vorlagen bzw. Import-Knopf; `saveTemplateToMongoDB`/`updateTemplateInMongoDB` hinter dem Konsistenz-Contract |
| `kopieren` | schreibt | Provider-Interface (lesen + hochladen); Twin-Ordner nie, `nurQuellen` mit dem Batch-Zaun |

Antwort auf die offene Frage aus dem Brückentest: **Vorlagen leben je
Library in MongoDB.** Eine Datei in `templates/` wirkt erst nach dem Import;
`vorlagen_auflisten` nennt deshalb je Vorlage den Stand der gleichnamigen
Datei (`neuerAlsMongo`) und Dateien ohne Vorlage (`nurAlsDatei`).

Geändert an bestehenden Werkzeugen: `index_aktualisieren` nimmt per Vorgabe
nur Publiziertes (`nurPublizierte`, Befund T9) und optional eine `vorlage`,
Zeilen tragen den Pfad; `dokumente_auflisten`/`bestand_pruefen` nehmen
`ordner`; `frage_stellen` nimmt die Perspektive der Stream-Adresse, und
Query-Log und Cache-Suche tragen dieselben Werte — vorher schrieb der Log
keine Perspektive, die Suche fragte mit ihr, und ein zweiter Aufruf traf nie.

Kein Fehler, sondern Regel: In einer gemischten Library zeigt die Galerie
ohne Typwahl nur die gemeinsamen Facetten („Typ als Leitfilter",
`facet-scope.ts`). Eine Facette, die nur `session` kennt (z. B. `event`),
erscheint in `dokumente_auflisten` erst mit `detailViewType: "session"`.
Ebenso ist `"undefined"` bei `character`, `accessPerspective` und
`socialContext` ein gültiger Wert („keine Vorgabe"), kein Lesefehler.

## Nachtrag Welle I (2.46.0): Ingest als bewusster Schritt, Text-Feed ehrlich

Owner 11.10.: Der Live-Prüffall der Veranstaltung zeigte, dass
`transformation_starten` IMMER mit ingestierte — die Seite stand in der
Galerie, bevor der Mensch die Transformation gesehen hatte. Seither ist
Ingest nie automatisch: `transformation_starten`, `quelle_erschliessen` (nur
mit Vorlage) und `sammeldatei_anlegen` (mit `transformieren`) nehmen
`ingest`; Weglassen heißt `false`, und die Antwort nennt Wert, Herkunft
(`aufruf` | `vorgabe`) und den nächsten Schritt (`ingest-entscheidung.ts`).
Die Transformation liegt am Twin, der Mensch prüft in der KS-Oberfläche,
`index_aktualisieren` mit den geprüften `sourceIds` (beim ersten Eintrag
`nurPublizierte: false`) bringt die Seite in die Galerie. Die Job-Bauer
(`enqueue-secretary-job`, `enqueue-markdown-job`, `enqueue-document-job`)
kennen keinen Default mehr; `ingest: true` ohne Vorlage ist ein Fehler.
`job_status` zeigt `ingest_rag` dann als übersprungen mit dem Grund
„abgeschaltet (ingest: false)" — der gewollte Zwischenstand, kein Befund.
Kein Sonderfall für `test/`: wer `ingest: true` sagt, hat es so gewollt; der
Zaun bleibt bei den Sammel-Werkzeugen.

Text-Feed (`text-feed.ts`, `text-feed-transport.ts`): Der Template-auf-Text-
Job (Transkript aus MongoDB) wird ab Anlage als `running` mit Schritten
angelegt, damit der Worker ihn während des Feeds nicht claimt. Der Feed läuft
über `node:http` mit einer Zeitgrenze von `EXTERNAL_TEMPLATE_TIMEOUT_MS` plus
zehn Minuten Ingest-Zugabe (das globale `fetch` brach still nach 300 s ab);
ihr Ablauf ist ein Trace-Ereignis `text_feed_timeout` mit Deutung, kein
Status. `failed` setzt der Feed nur noch, wenn die Callback-Route den Job nie
angefasst hat (`setFailedIfUntouched`: Status `running`, kein Schritt über
`pending` hinaus); sonst bleibt der Endstatus bei der Route und der
Feed-Fehler steht als `text_feed_fehler_nach_arbeit` im Trace. Die
Callback-Route selbst bleibt synchron. Der Zwischenzustand „Transformation
ja, Galerie-Eintrag nein" ist über `job_status` (Schritt `ingest_rag`) und
`dokumente_auflisten`/`bestand_pruefen` sichtbar; `abdeckung_lesen` kennt
nur die Archiv-Seite (Twins), nicht den Index.

## Nachtrag Welle I, zweiter Teil (2.46.1): Fehlertexte vollständig, Zaun abgeglichen

Owner 11.10.: Im Prüffall kamen Fehlermeldungen gekürzt an, die Vorschau der
Secretary-Antwort war vom `request`-Echo belegt, und `fehlerDeutung` kannte
nur die fehlende Tonspur. Seither schreibt `template-run.ts` die Meldung des
Secretary ungekürzt (begrenzt wird beim Lesen, 1500 Zeichen), die Vorschau in
`phase-template.ts` kommt ohne Echo (`antwortOhneEcho`), `job-fehler-details.ts`
liefert die jüngsten fünf Fehlerereignisse in zeitlicher Reihenfolge und
liest `error`-Objekte aus `updateStep`, Netzfehler tragen ihre Ursache
(`fetch failed (ECONNREFUSED …)`), und der Secretary-Adapter behält
`error.code`. `fehler-deutung.ts` kennt vier neue Arten: `secretary_abbruch`
(aborted, fetch failed, Zeitlimit: Secretary oder Anbieter, nicht die
Vorlage), `kein_llm_aufruf` (`TEMPLATE_TRANSFORMATION_ERROR` mit 0
LLM-Aufrufen: Secretary-Konfiguration oder Modell), `text_feed_failed` und
`abschluss_verweigert`. `job_status` deutet auch `job.error`, `batch_bilanz`
die ungekürzte Meldung samt Code. Zaun: `bestand_pruefen` nutzt
`istVomBatchAusgeschlossen` aus `batch-zaun.ts` (kennt `tests/`), und der
Ordnerweg (`index_aktualisieren`, `bestand_pruefen`) weist einen Startordner
ab, der selbst Twin- oder Testordner ist; Einzelwerkzeuge bekommen keinen Zaun.

## Nachtrag Welle K, erster Teil (2.48.0): die Brücke zeigt, was der Leser sieht

Owner 12.10.: Welle J brauchte drei Nachzüge, und jeder Befund kam aus dem
Live-Prüffall, weil kein Werkzeug das Meta-Dokument oder die Ereignisse des
Ingests zeigte (Plan §3c). Seither gilt: Eine Welle ist erst abnehmbar, wenn
ihr Prüfkriterium über die Brücke lesbar ist.

| Werkzeug | Liest/Schreibt | Dieselbe Funktion wie |
|---|---|---|
| `dokument_lesen` | liest | `getMetaByFileId` (das Meta-Dokument, das Galerie-Karte und Session-Detail lesen); Mapping in `lesersicht.ts`: Cover, Anhänge als Paare (`attachments_url`/`attachments_names`), `folien { anzahl, mitAdresse, ohneAdresse }`, Galeriebilder, `upsertedAt`, `galerieAdresse` (`/explore/<slug>?doc=<docSlug>`) oder `null` mit Grund |
| `dokumente_auflisten` (`lesersicht: true`) | liest | dieselbe Kurzform je Zeile: `cover`, `anhaenge`, `folienMitAdresse`, `folienAnzahl` |
| `job_status` (`ereignisse`, `befunde`) | liest | `job-ereignisse.ts`: feste Namensliste des Ingest-Spans (`slide_images_resolved/unresolved`, `cover_source`, `attachments_source`, `attachments_links_rewritten`, `extract_only_page_images_*`, `frontmatter_json_list_invalid`), Attribute statt ganzer Trace; `job-befunde.ts`: Klartext aus Schrittdetails und Ereignissen |
| `batch_bilanz` (`zeilen`, `mitBefund`) | liest | je Job `coverQuelle`, `folien { aufgeloest, unaufgeloest }`, `befunde` aus denselben Ereignissen |

Regeln: Der Job-Status bleibt `completed`; ein Befund ist ein Feld, keine
Statusart, und die leere Liste heißt „nichts zu melden". Formen, die nicht
passen (`slides` als JSON-Text im Meta-Dokument, unbekannte
`cover_source`-Herkunft), werden genannt, nicht als leer gezählt.
`frontmatter_json_list_invalid` schreibt der Ingest nur als Log-Phase; die
Ereignisliste nimmt Log-Phasen der Liste mit, wenn kein Trace-Ereignis
gleichen Namens steht (`quelle: log`). Ist-Zustand vor dem Bauen (Lehre aus
Welle J): `scripts/welle-k-ist-zustand-lesen.mjs` liest Index-Job und
Meta-Dokument einer Quelle aus der Prod-DB, nur lesend. Prüffall 12.10. am
Corbo-Index-Job vom 11.10. 22:18 (`2abe2a40…`, vor #376): `slide_images_resolved: 58`,
`cover_source: none` mit Grund, `attachments_source: 1`; das Meta-Dokument
trägt `coverImageUrl: ""`, 58 Folien mit Blob-Adresse, einen Anhang als Paar.
K4 bis K6 (App-Version in `bruecke_info`, Stempel `ingestedWith`/`generated_with`,
drei Zahlen in `twins_pruefen`) folgen im zweiten PR.

## Nachtrag Wunschliste 8, erster Teil (2.49.0): Libraries gehören zu Vorhaben

Owner 13.10.: Zwei Tage Arbeit in einer Library standen in keinem Bericht,
weil aus „Arbeit in Library X" kein Vorhaben ableitbar war (Plan
`docs/plans/dateien-ueber-library-grenzen.plan.md`, W8-4). Seither sagt ein
Vorhaben selbst, welche Libraries zu ihm gehören:

```yaml
libraries: [Dachverband für Soziales – Neuaufbau, 72a883a0-d0d9-45be-8c19-6685c0ad8b95]
```

| Befund | Wo | Bedeutung |
|---|---|---|
| `library_ohne_vorhaben` | Library-Ebene, Akteur Cowork, `info`; `targetId` = Library-Id | eine eigene Library des Users, die kein `BERICHT.md` unter `libraries:` nennt — Arbeit dort erfährt kein Vorhaben |
| `library_unbekannt` | Ordner-Ebene, Akteur Cowork, `info`; ein Sammelbefund je Bericht | ein Wert unter `libraries:`, der weder Id noch Name einer eigenen Library ist — genannt, nicht verschluckt |

Regeln (`libraries-regel.ts`, pur): Ids exakt, Namen getrimmt und ohne
Groß-/Kleinschreibung; die gescannte Archiv-Library zählt nicht als „ohne
Vorhaben"; nur eigene Libraries, keine geteilten. Beide Befunde entstehen nur
im Library-weiten Scan (im Teilbaum fehlen Berichte) und nur in Libraries
mit Archivpflege (`config.agentView.enabled`, derselbe Schalter wie
`stand_setzen`); die Library-Liste kommt als optionaler Port
`listeLibraries` in den Scan. `abdeckung_lesen` nennt je Vorhaben
`libraries` (roh; `null` = Report vor 2.49.0). Darauf bauen die
Skill-Änderungen im Archiv auf (`chat-abschliessen`: leeres `vorhaben:` wird
begründungspflichtig, Arbeit an einer Library ist Arbeit an dem Vorhaben,
das sie nennt).

## Nachtrag Wunschliste 8, zweiter Teil (2.49.1): Quellkennung am Twin

Owner 13.10.: Acht Dateien lagen in zwei Libraries, mit zwei Storage-Ids,
und nichts verband sie (Plan `docs/plans/dateien-ueber-library-grenzen.plan.md`,
W8-1). Seither trägt das Twin-Dokument eine Quellkennung: `sourceContentHash`
(SHA-256 über den Inhalt), `sourceSize`, `sourceHashedAt` (Contract
`shadow-twin-contracts.md` §9). Gerechnet wird sie in der Start-Route aus dem
Blob, der ohnehin zum Secretary geht, am Job gemerkt und beim Abschluss ans
Twin-Dokument geschrieben; das Job-Log nennt `quellkennung_gesetzt`,
`quellkennung_ohne_twin` oder `quellkennung_fehler`. `artefakt_lesen` zeigt
`quellkennung` (`null` = seit 2.49.1 nicht neu erschlossen). Kein
Migrationslauf; alte Bestände bekommen sie bei der nächsten Erschließung oder
über `quelle_suchen nachrechnen: true` (W8-2, folgt). Die Kennung ist
Wiedererkennung über Library-Grenzen, kein Schlüssel: Identität bleibt die
Provider-Id.

## Nachtrag Wunschliste 8, dritter Teil (2.50.0): Quelle über Library-Grenzen finden, Adressen

Owner 13.10.: `quelle_verschwunden` war eine Sackgasse; die acht Dateien des
Anlasses wurden von Hand in einer anderen Library gefunden (Plan
`docs/plans/dateien-ueber-library-grenzen.plan.md`, W8-2 und Abschnitt 6).

| Werkzeug / Feld | Liest/Schreibt | Was |
|---|---|---|
| `quelle_suchen` | liest; `nachrechnen` schreibt die Kennung | eine Quelle in allen eigenen Libraries: Eingabe `hash` \| `dateiname` (+ `groesse`) \| `vonLibraryId` + `sourceId`; Rangfolge `hash` › `name_groesse` › `name`; je Treffer `adresse` `@<slug>/<pfad>`, `imSpeicher`, `erschliessung`; `inhaltVerschieden` für gleichen Namen mit belegt anderem Inhalt |
| `quelle_verschwunden.moeglicherweiseIn` | Scan, nur MongoDB | bis fünf Orte (`libraryName`, `bibliothek` `@<slug>`, `sourceId`, `uebereinstimmung`); `[]` = gesucht, nichts gefunden; Feld fehlt = nicht gesucht |
| `bibliotheken_auflisten` | liest | `slug`, `slugHerkunft` (`gesetzt` \| `veroeffentlicht` \| `abgeleitet`), `slugKonflikt`, `frueherSlugs` |
| `adresse_setzen` | schreibt, nur Owner | Adress-Slug instanzweit eindeutig; der bisher wirksame Slug wandert nach `frueher` |
| Verweis-Audit | Scan | `[[@<slug>/<pfad>]]` wird nur gegen die bekannten Slugs geprüft (unbekannt oder unlesbar = `verweis_tot`); ohne Library-Liste ungeprüft |

Regeln: Die Suche läuft in MongoDB über `{ libraryId, sourceContentHash }`
und `{ libraryId, sourceName }`; Namen werden exakt verglichen. Pfade und
Größen holt erst `quelle_suchen` aus dem Speicher (höchstens 20 Treffer).
`nachrechnen` liest höchstens fünf Treffer bis 50 MB und die gesuchte Quelle,
wenn sie lesbar ist. **Grenze:** Eine verschwundene Quelle von vor 2.49.1
trägt weder Kennung noch Größe, und ihr Inhalt ist nicht mehr lesbar; für sie
bleibt es bei `name`, der Hinweis empfiehlt, die Transkripte beider Seiten mit
`artefakt_lesen` zu vergleichen. Ein abgeleiteter Slug ändert sich mit dem
Namen der Library; stabil wird er mit `adresse_setzen`. Das
Einstellungsformular kennt den Slug nicht; der Server führt `config` beim
Speichern mit dem Bestand zusammen, er bleibt also erhalten.

## Nachtrag 2.51.0 (13.10.2026): Webseite als Quelle

Ein Artikel im Netz mit eingebettetem Audio oder Video wird zur Sammeldatei,
nach demselben Muster wie die Vorträge einer Veranstaltung:

- `webseite_erschliessen` (Brücke) und `POST /api/library/[id]/web-source`
  (Oberfläche) rufen dieselbe Funktion (`src/lib/web-source/webseite-erschliessen.ts`).
- **Seite ohne Sprachmodell lesen** (`page-extract.ts`): Titel, Beschreibung,
  Datum, Autor, Bild aus Open Graph und JSON-LD; Absätze, Zwischenüberschriften
  und Zitate wörtlich aus dem `<article>`-Block (sonst `<main>`, sonst `<body>`),
  samt Vorspann im eigenen `<header>` des Artikels. Kurze Listenpunkte
  (Schlagwort-Listen) und doppelte Absätze fallen weg.
- **Medium über den Secretary**: `POST /api/media/resolve` löst die Seite per
  yt-dlp zur direkten Medienadresse auf (Rai News, YouTube, Vimeo, PeerTube …),
  lädt aber nichts; KnowledgeScout lädt die Datei und legt sie als
  `<Basis> - Audio.mp3` neben die Sammeldatei, das Bild als `<Basis> - Cover.jpg`.
  Kennt yt-dlp die Seite nicht, bleibt die von der Seite genannte Adresse,
  wenn sie direkt Audio/Video liefert. Kein Medium = Grund in der Antwort.
- **Nicht `<Basis>.mp3`**: Eine `<Basis>.md` neben `<Basis>.mp3` gilt im
  Twin-System als Transkript des Mediums (Geschwister-Regel im
  `artifact-resolver`), dann übergeht das Extract-Gate die Transkription.
- **Audio und Cover rechnet die Pipeline**: `_media_files` registriert jetzt
  auch Audio/Video als Fragment; der Ingest setzt `audio_url` aus dem
  Audio-Fragment am eigenen Twin (Trace `audio_source`) und das Cover aus
  einem Fragment `… - Cover.*`, `*.cover.*` oder `cover.*` (Trace
  `cover_source: own_fragment`), vor dem Folien-/Flyer-Weg.
- **Vorlage `artikel-de`** (Ereignis-Ansicht, Dokumentart artikel, Facetten wie
  `vortrag-session-de`): Artikel wörtlich, Zusammenfassung nur aus wörtlichen
  Sätzen, Zitate aus dem Interview-Transkript als `> **Name:** Zitat`.
- Ablauf: `webseite_erschliessen` → `job_status` (Transkript) →
  `transformation_starten` mit `artikel-de` und bewusstem `ingest`.
  Live belegt 13.10. am Rai-Beitrag: 7/7 Absätze wörtlich, Audio-Player und
  Cover in der Galerie.
