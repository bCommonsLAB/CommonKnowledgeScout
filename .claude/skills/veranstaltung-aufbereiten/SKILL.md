---
name: veranstaltung-aufbereiten
description: Einen Ordner mit Audio, PDF, Video und Bildern einer Veranstaltung über die KnowledgeScout-MCP-Brücke bis zu publizierten Seiten begleiten — Bestand erfassen, erschließen (mit oder ohne Sprechererkennung), Einheiten als Sammeldateien bilden, Haltepunkt für die manuelle Transkriptprüfung, transformieren, Rahmen setzen, publizieren, nach Korrekturen nachziehen. Diesen Skill verwenden, sobald von einer Veranstaltung, Tagung, Schulung, einem Vortrag, Workshop oder Interview die Rede ist, dessen Aufnahmen und Unterlagen zu Seiten werden sollen, oder von Sammeldateien, Vortragsseiten, Sprechererkennung oder Nachziehen nach einer Korrektur.
---

# Veranstaltung aufbereiten

Stand 12.10.2026, Werkzeugsatz 2.48.1 (Welle I: Ingest als bewusster
Schritt; Welle J: Bilder rechnet die Pipeline; Welle K: die Brücke zeigt,
was der Leser sieht). Original im Archiv unter
`Organisation/Skills/veranstaltung-aufbereiten/SKILL.md`; in den
Claude-Einstellungen die Ableitung, im Repo die Kopie. Drehbuch nach dem Plan
`docs/plans/geplant/veranstaltungen-ueber-die-bruecke.plan.md` (Wellen B, E, G);
die Bestandspflege (Aufräumen, Bericht, Stand) bleibt beim Skill
`archiv-aufraeumen`. **Dieser Skill endet, wenn die Vortragsseiten in der
Galerie stehen und `dokument_lesen` je Seite Cover, Folien und Anhang
zeigt.** Die präsentierbare Webseite daraus (Startseite mit Plakat, eine
Sektion je Vortrag, Rückblick) baut der Skill `website-publishing`,
Abschnitt „Veranstaltungs-Webseite aus Vortragsseiten".

Ziel: Ein Ordner mit vier Audios, drei PDFs und einem Flyer wird zu drei
Vortragsseiten und einer Veranstaltungsseite — mit genau drei Rückfragen an
den Menschen und einem Haltepunkt, an dem er das Transkript prüft.

## Was beim Menschen bleibt (nicht verhandelbar)

1. **Die Library.** Nie raten, immer bestätigen lassen (siehe
   `archiv-aufraeumen`, Schritt null).
2. **Die Zuordnung der Einheiten** (Station 3): welches Audio zu welchen
   Folien und welcher Einladung gehört. Der Agent schlägt vor, der Mensch
   entscheidet. Falsche Zuordnungen auf veröffentlichten Seiten sind der
   teuerste Fehler dieses Flusses.
3. **Die Prüfung des Transkripts** (Station 4): Hörfehler und Sprechernamen
   prüft der Mensch im Reiter „Korrektur" der KS-Oberfläche. Der Skill hält
   an und nennt die Quellen, die dran sind. Namen nur, wenn belegt (Einladung,
   Sprecherliste); alles andere bleibt Rolle („Frage aus dem Publikum").
4. **Die Prüfung der Transformation** (Station 6): Markdown und
   Frontmatter jeder Seite in der KS-Oberfläche, bevor sie in die Galerie
   kommt. Transformieren legt nur am Twin ab (`ingest` bleibt weg = `false`);
   erst die Freigabe in Station 7 bringt die Seite mit `index_aktualisieren`
   in Galerie und Suche. Owner 11.10.: Ein Galerie-Eintrag vor dieser
   Prüfung ist eine Übergehung von Keep the Human in the Loop.
5. **Die Freigabe der Veröffentlichung** (Station 7).

## Kosten, bevor etwas startet

Erschließen, Transformieren und Publizieren kosten Geld. Vor dem Start die
Zahlen nennen: Sprecher-Modell rund 0,006 USD je Audiominute, Standard rund
0,0045 USD je Minute; der Textschritt liegt im Cent-Bereich. Audio-Stücke
über 10 Minuten können am Watchdog scheitern, solange der Heartbeat je Stück
im Secretary nicht belegt ist; das meldet `job_status` als Fehlschlag, nicht
der Skill vorab.

## Die Stationen

### 0 Neue Library aufsetzen (nur wenn es noch keine gibt; seit 2.45.0)

- **Rückfrage 1** mit Name, Inhaltstyp, Speicherort und ob eine bestehende
  Library als Vorlage dient. Erst dann `bibliothek_anlegen` (mit
  `vorlageVon` und `vorlagenKopieren: true`, wenn eine Vorlage-Library
  genannt ist). Rohquellen in einen frischen Ordner: `kopieren` mit
  `nurQuellen: true` und zuerst `vorschau: true` zeigen.
- **Haltepunkt Geheimnis**: Die Antwort nennt `geheimnisFehlt`. Der Mensch
  trägt App-Passwort oder OneDrive-Anmeldung in Settings → Archive ein; der
  Agent fragt nie danach. Danach `speicher_pruefen` (muss `verbunden: true`
  liefern), `vorlagen_auflisten` (eine Datei mit `neuerAlsMongo: true` wirkt
  noch nicht → `vorlage_uebernehmen` mit `datei`), `konfiguration_lesen`
  beider Libraries vergleichen.

### 1 Bestand erfassen (Maschine)

- `ordner_listen` mit `zusammenfassung: true`, dann `tiefe: 1` auf den Ordner.
- `abdeckung_scannen` auf den Teilbaum, `abdeckung_lesen`: welche Quellen haben
  Transkript, Transformation, Galerie-Eintrag; was fehlt.
- Ergebnis dem Menschen als Tabelle: Datei, Typ, Dauer/Seiten soweit bekannt,
  Stand.

### 2 Erschließen (Maschine, zwei Wege bei Audio)

`quelle_erschliessen` mit `template: "nur_transkript"` je Quelle oder als
Stapel (`sourceIds`, bis 30). Bei **Audio** gibt es zwei Wege, und die Antwort
nennt je Quelle, welcher gilt (`jobs[].transkription`, `wege`):

| Weg | Aufruf | Danach |
|---|---|---|
| mit Sprechererkennung | `sprecherErkennung: true` | Sprecher-Labels im Transkript; Kontext und Begriffe verwirft der Anbieter. Station 4: Sprecher-Zuordnung und Namen bestätigen |
| ohne Sprechererkennung | `sprecherErkennung: false`, `kontext`, `begriffe` | Standard-Transkription mit Thema und Fachwörtern. Station 4: Hörfehler von Hand prüfen |

Weglassen heißt Library-Voreinstellung; die Antwort sagt `herkunft: library`
oder `standard`. Welcher Weg gilt, entscheidet der Mensch einmal pro
Veranstaltung, nicht der Agent. PDFs und Bilder laufen ohne diese Wahl.
Fortschritt mit `job_status`, Stapel mit `batch_bilanz`; Fehlergruppen
gezielt mit `batch_neustart` (nur nach behobener Ursache).

**Seitenbilder der Folien-PDFs sichern, bevor transformiert wird.** Cover
und Folienbilder der Vortragsseiten rechnet der Ingest später aus den
Seitenbildern, die am Twin der Folien-PDF als Fragmente mit Seitennummer
liegen. Fehlen sie, fehlt alles weiter hinten, und der Fehler fällt erst in
Station 7 auf (Lehre aus Welle J, 11.10.). Deshalb direkt nach der
Extraktion je PDF: `job_status` muss das Ereignis
`extract_only_page_images_registered` mit `registriert > 0` nennen; bei
`_skipped` oder `_error` steht der Grund in `befunde`. PDFs, die vor dem
12.10.2026 im Filesystem-Modus erschlossen wurden, tragen die Fragmente
nicht: `twins_pruefen` für den Ordner muss je PDF `register-image-fragments`
planen, dann `twins_synchronisieren` mit `preset: repair`. Plant
`twins_pruefen` nichts und der Twin-Ordner im Storage ist leer, die PDF mit
`quelle_erschliessen` und `erzwingen` neu extrahieren. Erst wenn das steht,
weiter zu Station 3.

### 3 Einheiten bilden (Mensch entscheidet, Agent schlägt vor)

- Vorschlag aus den Transkriptanfängen: `artefakt_lesen` mit
  `art: "transkript"` und kleinem `maxZeichen` je Audio, dazu die PDF-Titel.
  Vorschlag als Tabelle: Einheit, Audio, Folien, Einladung, Medien.
- **Rückfrage 2.** Erst nach Bestätigung: je Einheit `sammeldatei_anlegen`
  (`quellenIds` in Reihenfolge, `titel`, `medien` für Flyer-Bilder, optional
  `includeSelf`). Das Werkzeug prüft Existenz und Transkript jeder Quelle und
  überschreibt keinen Namen. Noch nicht transformieren.

### 4 Haltepunkt: der Mensch prüft (Mensch)

Der Skill hält hier an und schreibt dem Menschen die Liste der Quellen, die
geprüft werden müssen (jedes Audio, Reiter „Korrektur" in der
KS-Oberfläche), mit dem Weg aus Station 2 und dem, was dort zu tun ist.
Keine Brücken-Werkzeuge für Vorschläge, keine Namen aus eigener Deutung.
Weiter erst, wenn der Mensch „geprüft" sagt. Dann `abhaengige_dokumente` je
korrigierter Quelle: die Sammeldateien aus Station 3 stehen dort, noch ohne
Transformation; das ist erwartet.

### 5 Transformieren (Maschine, ohne Galerie-Eintrag)

`transformation_starten` je Sammeldatei mit der Vorlage der Veranstaltung
(`template`), bei Folien `folienAlsTabelle`, bei Anhängen `anhangInSuche`
nach Absprache — **ohne `ingest`**. Weglassen heißt `false`, und die
Antwort sagt es: `ingest: { ingest: false, herkunft: "vorgabe",
naechsterSchritt }`. Die Transformation liegt danach am Twin, in der Galerie
steht noch nichts. Nie `ingest: true` an dieser Station; das wäre die
Veröffentlichung ohne Prüfung. Die Brücke prüft vorher, ob alle
`_source_files` auflösbar sind, und nennt fehlende Dateien;
`sammeldatei_pruefen` bei Zweifel. Danach `batch_bilanz`. `job_status` zeigt
`ingest_rag` als übersprungen mit Grund „abgeschaltet (ingest: false)"; das
ist der gewollte Zwischenstand, kein Fehler.

### 6 Prüfen in der KS-Oberfläche (Mensch; Haltepunkt)

Der Skill hält an und schreibt dem Menschen je Seite Pfad, Vorlage und
`sourceId`. Der Mensch liest in der KS-Oberfläche Markdown und Frontmatter
der Transformation: Titel, Sprecher, Facettenwerte, Reihenfolge, nichts
Erfundenes. Der Agent darf `artefakt_lesen` mit `art: "transformation"`
nutzen, um Fragen zu beantworten, ändert die Transformation aber nicht; eine
schlechte Transformation wird mit geänderter Vorlage oder korrigiertem
Transkript neu erzeugt (`transformation_starten`, wieder ohne `ingest`).

Während des Haltepunkts den Rahmen setzen (Mensch entscheidet, Agent setzt):

- Veranstaltungsseite als Markdown anlegen (`datei_anlegen`); soll eine
  Vorlage den Text formen, `transformation_starten` ohne `ingest`, sonst
  bleibt sie unverändert für `dokument_publizieren` in Station 7.
- Facetten und Reihenfolge: `dokument_felder_setzen` (flache Felder, Tags,
  `menu_order`), Themen mit `themen_setzen` in Libraries mit Archivpflege.
- Fehlt eine Facette: `konfiguration_lesen`/`konfiguration_setzen` (Bereich
  `facetten`), danach `index_aktualisieren` für schon vorhandene Einträge.

Weiter erst, wenn der Mensch je Seite „freigegeben" sagt.

### 7 Freigabe: Index nachziehen, publizieren, prüfen (Agent, Mensch sieht hin)

- **Rückfrage 3** ist die Freigabe aus Station 6: Liste der Seiten mit
  Titel, Quellen, Sprechern und `sourceIds`. Nur freigegebene Seiten.
- `index_aktualisieren` mit genau diesen `sourceIds` und
  `nurPublizierte: false` (die Seiten haben noch keinen Eintrag); erst damit
  stehen sie in Galerie und Suche. Nicht den Ordnerweg nehmen; der nimmt
  alles mit, was der Zaun durchlässt.
- `dokument_publizieren` für unverändert zu übernehmende Seiten,
  `bilder_auflisten`/`bild_veroeffentlichen` für Bilder,
  `veroeffentlichung_setzen` nur nach `website-publishing`.
- Prüfpunkte, jeder einzeln benannt: `seite_pruefen` ohne Befund; keine
  Antwort steht bei der falschen Person (Sprecher-Labels gegen die
  Sprecherliste); kein Name ohne Beleg; `bestand_pruefen` ohne Doppelgänger
  und ohne Einträge aus Testkopien.
- Prüfpunkte Lesersicht (seit 2.48.0, Welle K) — über die Brücke, nicht
  über die Galerie: `batch_bilanz` des Index-Batches muss `mitBefund: 0`
  zeigen; je Job sagt `befunde` sonst in Klartext, was fehlt („Folien: N von
  M ohne Adresse", „Cover: keine Quelle (Grund)", „Anhänge: keine
  PDF-Quelle"), `ereignisse` nennt die Herkunft (`cover_source` mit `source`
  und `page`, `slide_images_resolved`, `attachments_source`). Danach
  `dokument_lesen` je Seite: `coverImageUrl` gesetzt, `folien.ohneAdresse`
  leer, `anhaenge` mit Blob-Adressen, `galerieAdresse` vorhanden (sonst steht
  der Grund daneben). Erst wenn beides stimmt, ist die Seite fertig; der
  Mensch sieht die Galerie zur Bestätigung an, nicht zur Suche nach Fehlern.
- Fehlt trotzdem etwas: Cover und Folien hängen an den Seitenbildern der
  Folien-PDF (Station 2, Absatz „Seitenbilder sichern"); Anhänge und
  Folien fehlen auch, wenn die Sammeldatei vor 2.43.0 zuletzt transformiert
  wurde (`abhaengige_dokumente` meldet „Abhängigkeit nicht vermerkt",
  Abhilfe: `transformation_starten` mit `erzwingen`, wieder ohne `ingest`,
  dann Station 6 und 7). Nach der Abhilfe `index_aktualisieren` für die
  betroffenen Seiten wiederholen und die Prüfpunkte am NEUEN Job lesen.
- Nach einem Merge am Server (neue App-Version, `bruecke_info` nennt eine
  höhere Werkzeugsatz-Version): zuerst die Erweiterung in der Desktop-App
  aus- und einschalten, dann einen frischen Index-Lauf starten und erst
  dessen `befunde` deuten. Ein Job von gestern zeigt den Stand von gestern
  (Befund 12.10.: ein bereits behobener Fehler wurde aus einem alten Job als
  neu gemeldet).

### Q Nachziehen nach einer Korrektur (Maschine)

Korrigiert der Mensch später ein Transkript, nennt der Reiter „Korrektur"
(und `transkript_korrigieren`) die abhängigen Sammeldateien.
`abhaengige_dokumente` zeigt, welche davon überholt sind;
`transformation_starten` erneuert genau diese (der Server erzwingt, weil das
Transkript jünger ist) — ohne `ingest`, also wieder Haltepunkt Station 6,
dann `index_aktualisieren` mit den `sourceIds` (die Einträge bestehen, die
Vorgabe `nurPublizierte` passt). Seit 2.46.0 ingestiert der Job nicht mehr
selbst. Sammeldateien, die vor Werkzeugsatz 2.43.0 zuletzt transformiert
wurden, tragen die Abhängigkeit erst nach dem nächsten Lauf.

## Fehlerbilder, die keine sind (und die, die es sind)

- **Ingest-Haken im Pipeline-Sheet ist aus**: Vorgabe der KS-Oberfläche,
  derselbe Stand wie `ingest` weglassen in der Brücke. Nicht einschalten,
  um „zu reparieren"; der Eintrag kommt in Station 7.
- **`job_status`: `ingest_rag` übersprungen, Grund „abgeschaltet (ingest:
  false)"**: gewollt, siehe Station 5.
- **`aborted` oder „fetch failed" nach rund zwei Minuten**: Zeitlimit beim
  Secretary oder seinem Anbieter, nicht die Vorlage. Einmal neu starten;
  bleibt es, ist der Secretary dran (Stück zu lang, Modell nicht erreichbar).
- **`failed`, obwohl Transformation und Ingest fertig waren**: bis 2.45.0
  der Text-Feed der Brücke. Seit 2.46.0 bleibt der Status bei der Route; der
  Feed-Fehler steht nur noch als Trace-Ereignis (`text_feed_timeout`,
  `text_feed_fehler_nach_arbeit`) im Job. Tritt es trotzdem auf, ist es ein
  Befund für den Owner.
- **Testkopie unter `test/` in der Galerie**: nur möglich mit
  `ingest: true` oder über Station 7. Kein Zaun in den Einzelwerkzeugen
  (Owner 11.10.); `index_entfernen` nimmt den Eintrag zurück.
- **`befunde: ["Cover: keine Quelle …"]` an einem Job, der vor dem letzten
  Merge lief**: kein neuer Fehler, sondern der alte Stand. Frischen Lauf
  starten (Station 7, letzter Punkt), dann neu lesen.
- **`job_status` ohne `befunde`/`ereignisse`, `dokument_lesen` fehlt in der
  Werkzeugliste**: die Desktop-App hält eine alte Toolliste. `bruecke_info`
  nennt die Server-Version; Erweiterung aus- und einschalten.

## Was dieser Skill nicht tut

- Keine Korrekturvorschläge und keine Namen aus eigener Deutung (Owner 08.10.).
- Keine Kostenschätzung als Werkzeug; die Zahlen oben genügen.
- Keine Veröffentlichung ohne Rückfrage 3, keine Library ohne Rückfrage 1.
- Keine Webseite: Startseite, Sektionen je Vortrag und Design-Profil sind
  Sache von `website-publishing` (Abschnitt „Veranstaltungs-Webseite aus
  Vortragsseiten"); dieser Skill liefert nur die Vortragsseiten, auf die
  jene Webseite verweist.
