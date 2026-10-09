---
name: veranstaltung-aufbereiten
description: Einen Ordner mit Audio, PDF, Video und Bildern einer Veranstaltung über die KnowledgeScout-MCP-Brücke bis zu publizierten Seiten begleiten — Bestand erfassen, erschließen (mit oder ohne Sprechererkennung), Einheiten als Sammeldateien bilden, Haltepunkt für die manuelle Transkriptprüfung, transformieren, Rahmen setzen, publizieren, nach Korrekturen nachziehen. Diesen Skill verwenden, sobald von einer Veranstaltung, Tagung, Schulung, einem Vortrag, Workshop oder Interview die Rede ist, dessen Aufnahmen und Unterlagen zu Seiten werden sollen, oder von Sammeldateien, Vortragsseiten, Sprechererkennung oder Nachziehen nach einer Korrektur.
---

# Veranstaltung aufbereiten

Stand 08.10.2026, Werkzeugsatz 2.45.1. Original im Archiv unter
`Organisation/Skills/veranstaltung-aufbereiten/SKILL.md`; diese Datei ist die
Repo-Kopie und wird nach dem Original nachgezogen. Probe: 135 Zeilen.

Drehbuch nach dem Plan
`docs/plans/geplant/veranstaltungen-ueber-die-bruecke.plan.md` (Wellen B, E, G);
die Bestandspflege (Aufräumen, Bericht, Stand) bleibt beim Skill
`archiv-aufraeumen`, die Veröffentlichung von Website-Seiten bei
`website-publishing`.

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
4. **Die Freigabe der Veröffentlichung** (Station 7).

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

### 5 Transformieren (Maschine)

`transformation_starten` je Sammeldatei mit der Vorlage der Veranstaltung
(`template`), bei Folien `folienAlsTabelle`, bei Anhängen `anhangInSuche`
nach Absprache. Die Brücke prüft vorher, ob alle `_source_files` auflösbar
sind, und nennt fehlende Dateien. `sammeldatei_pruefen` bei Zweifel.
Danach `batch_bilanz`.

### 6 Rahmen setzen (Mensch entscheidet, Agent setzt)

- Veranstaltungsseite als Markdown anlegen (`datei_anlegen`) und mit
  `transformation_starten` oder `dokument_publizieren` (unverändert)
  publizieren, je nachdem, ob eine Vorlage den Text formen soll.
- Facetten und Reihenfolge: `dokument_felder_setzen` (flache Felder, Tags,
  `menu_order`), Themen mit `themen_setzen` in Libraries mit Archivpflege.
- Fehlt eine Facette: `konfiguration_lesen`/`konfiguration_setzen` (Bereich
  `facetten`), danach `index_aktualisieren` für vorhandene Einträge.

### 7 Publizieren und prüfen (Agent, Mensch sieht hin)

- **Rückfrage 3** vor der Veröffentlichung: Liste der Seiten mit Titel,
  Quellen, Sprechern.
- `dokument_publizieren`, `bilder_auflisten`/`bild_veroeffentlichen` für
  Bilder, `veroeffentlichung_setzen` nur nach `website-publishing`.
- Prüfpunkte, jeder einzeln benannt: `seite_pruefen` ohne Befund; keine
  Antwort steht bei der falschen Person (Sprecher-Labels gegen die
  Sprecherliste); kein Name ohne Beleg; `bestand_pruefen` ohne Doppelgänger.

### Q Nachziehen nach einer Korrektur (Maschine)

Korrigiert der Mensch später ein Transkript, nennt der Reiter „Korrektur"
(und `transkript_korrigieren`) die abhängigen Sammeldateien.
`abhaengige_dokumente` zeigt, welche davon überholt sind;
`transformation_starten` erneuert genau diese: der Server erzwingt mit
`erzwungen: "quelle_juenger"`, weil das Transkript einer Quelle jünger ist
(ab 2.45.1). `index_aktualisieren` ist danach nicht nötig, der Job
ingestiert selbst. Sammeldateien, die vor Werkzeugsatz 2.43.0 zuletzt
transformiert wurden, tragen die Abhängigkeit erst nach dem nächsten Lauf.

## Was dieser Skill nicht tut

- Keine Korrekturvorschläge und keine Namen aus eigener Deutung (Owner 08.10.).
- Keine Kostenschätzung als Werkzeug; die Zahlen oben genügen.
- Keine Veröffentlichung ohne Rückfrage 3, keine Library ohne Rückfrage 1.
