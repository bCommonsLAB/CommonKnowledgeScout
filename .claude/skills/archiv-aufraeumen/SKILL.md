---
name: archiv-aufraeumen
description: Einen Vorhabensordner im Wissensarchiv über die KnowledgeScout-MCP-Brücke aufräumen — Abdeckung prüfen, Quellen erschließen, Transformationen nachziehen, Dateien und Ordner sauber benennen, Bericht fortschreiben, Stand setzen. Diesen Skill verwenden, sobald von Aufräumen, Abdeckung, Coverage, Befunden, Twins, Shadow Twins, KnowledgeScout, Erschließen, Transkribieren oder davon die Rede ist, einen Archivordner in Ordnung zu bringen oder die Arbeit von KnowledgeScout gegenzuprüfen.
---

# Archivordner aufräumen

Wie die KnowledgeScout-Brücke bedient wird. **Was** dabei entstehen soll,
steht nicht hier, sondern im Archiv — siehe „Zuerst lesen".

## Zuerst lesen

Diese drei Dateien liegen in Peters Vault und sind die Wahrheit über
Struktur, Benennung und Berichtsform. Vor jeder Archivarbeit lesen:

| Datei | Wofür |
|---|---|
| `Organisation/Zielbild Wissensarchiv.md` | Warum das Archiv so aufgebaut ist. Vorhaben vs. Ereignis, Plattform vs. Anwendung, Original/Beleg/Ableitung |
| `Organisation/Aufraeumen/Konventionen.md` | **Das wichtigste.** Ordnernamen, Vorlagen für `_INDEX.md` und `BERICHT.md`, Frontmatter-Felder, Twin-Contract, Lese- und Korrektur-Ordnung, Vier-Schritte-Takt |
| `Organisation/Aufraeumen/HANDOVER.md` | Stand der Aufräumarbeit, offene Punkte, Eigenheiten der Mounts |

Sie werden über die Datei-Bridge gelesen (`device_stage_files`, dann `Read`).
**Nichts davon in diesem Skill wiederholen** — bei Widerspruch gelten die
Dokumente im Archiv, und Abweichungen gehören dorthin gemeldet, nicht hierher
kopiert.

Aus `Konventionen.md` besonders beachten: der **Vier-Schritte-Takt**
(Strukturieren → Erschließen → Berichten → Abnehmen), die **Familien-Regel**
(Quelle und `_`-Ordner ziehen gemeinsam um), die **Korrektur-Ordnung**
(Wortlautfehler ins Transkript, nie in den Transformations-Body) und dass
**alle Umbenennungen vor die Erschließung gehören**.

## Drei Grundregeln für die Brücke

**1. Nie Dateien direkt im Dateisystem anfassen.** Umbenennen, Verschieben und
Verwerfen laufen ausschließlich über `familie_umziehen`, `ordner_umbenennen`,
`ordner_erstellen` und `quelle_verwerfen`. Sonst zeigen die Mongo-Dokumente ins
Leere. Der `bearbeitungsstand` läuft über `stand_setzen` — nie über die
Datei-Bridge, sonst greifen die Schutzstufen nicht. Die Datei-Bridge
(`device_*`) ist zum **Lesen und Gegenprüfen** da — und zum Schreiben von
Berichten und Notizen, die keine KnowledgeScout-Quellen sind.

**2. Vor jedem Schreibvorgang fragen.** Besonders vor `quelle_erschliessen`
und `transformation_starten` — das sind kostenpflichtige Jobs. Bei größeren
Mengen einmal pro Gruppe fragen, nicht pro Datei; aber immer sagen, was und
wie viel.

**3. Zuerst lesen, dann rechnen.** `abdeckung_lesen` antwortet aus dem Cache in
Sekunden. `abdeckung_scannen` läuft live gegen den Storage und gehört ans Ende
eines Arbeitsschritts. Seine **Antwort ist so weit wie die Frage**: Mit
`folderId`/`pfad` beschreibt sie nur diesen Teilbaum (`antwortFuerTeilbaum`
nennt ihn) — der gespeicherte Voll-Report bleibt trotzdem vollständig, der
Teilbaum-Scan merged hinein.

**3b. Jobs anstoßen und weiterarbeiten — nicht warten.**
`transformation_starten` und `quelle_erschliessen` antworten **sofort** mit
`jobId`s; die Rechenarbeit (LLM, Einbettungen, Schreiben) läuft im Hintergrund,
bis zu sechs Jobs parallel. Nimm den **Stapel** (`sourceIds`), nicht sechs
Einzelaufrufe, und frag den Fortschritt danach mit `job_liste`/`job_status` ab.

*Bis zum 27.08.2026 war das anders:* Der Aufruf wartete ~36 s je Datei und riss
bei Stapeln das 60-Sekunden-Limit der Brücke. Wenn du ein solches Verhalten noch
siehst, läuft eine alte Fassung — melde es, statt auf Einzelaufrufe auszuweichen.

## Der Ablauf

### 1 — Lage feststellen

```
bruecke_info                    # Werkzeugsatz prüfen, wenn etwas fehlt
bibliotheken_auflisten
abdeckung_lesen(libraryId, akteur: "knowledgescout", zyklusSchritt: 1)
```

Der ungefilterte Report eines Vorhabens ist schnell über 100.000 Zeichen groß.
**Immer filtern.** `akteur` beantwortet „wessen Arbeit ist das?",
`zyklusSchritt` grenzt auf die Phase ein, `nurZaehler: true` liefert nur Zahlen.

Gibt es keinen Report, einen Teilbaum-Scan mit `pfad` anstoßen — nie die ganze
Library, die läuft ins 60-Sekunden-Limit.

### 2 — Befund zu Aktion

Jeder Befund trägt `actor`, `zyklusSchritt`, `severity`, `targetId` und
`folderId`. Die `targetId` geht direkt in das Werkzeug.

| Befund | Akteur · Schwere | Werkzeug |
|---|---|---|
| `source_without_twin` | KS · error | `quelle_erschliessen` |
| `transformation_missing` | KS · error | `transformation_starten` |
| `transformation_stale` | KS · **info** | `transformation_starten` — blockiert die Abnahme nicht. Verglichen wird seit 27.08.2026 der **Inhalts**-Zeitpunkt (`generated_at`), nicht der letzte Write: Peters Verifizieren am Transkript macht die Zusammenfassung NICHT mehr „ueberholt" |
| `twin_core_missing` | KS · warning | meist mit der Transformation erledigt |
| `legacy_twin_name` | KS · warning | `twins_synchronisieren`: erst `import`, dann `repair` (deckt auch `split-combined-artifact` ab — das ist eine Migrations-Operation, kein eigener Befund) |
| `orphan_twin` | KS · warning | Twin ohne Quelle — Ursache prüfen, meist `familie_umziehen` oder `repair` |
| `twin_stale` | KS · warning | Quelle jünger als ihr Twin → `transformation_starten` |
| `conflict` | KS · error | Spiegel und Datenbank divergieren → `twins_synchronisieren` |
| `core_fields_missing` | KS · error | Frontmatter der genannten Datei — Ursache prüfen, nicht blind füllen |
| `datei_ohne_endung` | Mensch · warning | Inhalt prüfen, dann `familie_umziehen` |
| `path_too_long` | Cowork · warning | Pfad kürzen (`ordner_umbenennen`) |
| `index_missing` | Cowork · warning | `_INDEX.md` nach Vorlage anlegen |
| `report_missing` | Cowork · warning | `BERICHT.md` nach Vorlage anlegen |
| `bericht_veraltet` | Cowork · warning | Bericht nachziehen (siehe Stolpersteine) |
> Auch hier zaehlt seit 27.08.2026 nur eine **Inhalts**-Aenderung: Ein Kurations-Stempel (Verifizieren, Markieren) altert den Bericht nicht mehr. Frueher liess jeder Pruef-Klick `bericht_veraltet` und damit `stand_widerspruch` neu aufpoppen — eine Schleife, die sich durch Arbeiten nicht schliessen liess.
| `verweis_veraltet` | Cowork · warning | verwiesenes Ziel ist jünger — Verweis prüfen, dann Bericht neu speichern |
| `verweis_tot` | Cowork · error | Verweis zeigt ins Leere — Ziel suchen oder Verweis entfernen |
| `bericht_unvollstaendig` | Cowork · **info** | Bericht lässt Quellen unerwähnt — ergänzen, blockiert nichts |
| `teilbaum_ungesichtet` | KS · **info** | Sammel-Befund unter ungesichtetem Ordner — erst strukturieren |
| `scan_error` | KS · error | Teilbaum nicht lesbar — Ursache melden, nie übergehen |
| `twin_flagged` | Mensch · error | Peter hat das Artefakt als **fehlerhaft markiert** — Notiz in `flagged_note` lesen, reparieren; die Abnahme bleibt gesperrt, bis Peter danach verifiziert |
| `twin_unverified` | *(Alt-Bestand)* | **ignorieren** — seit ADR 0006 abgeschafft. Steht noch in Reports vor dem 27.08.2026 und verschwindet beim nächsten Scan. Nicht auflisten, nicht beauftragen |
| `self_verified` | Mensch · error | **nichts tun** — Erzeuger und Prüfer sind derselbe |
| `stand_widerspruch` | **wandernd** · error | erklärter Stand ist widerlegt — Peter melden, nicht selbst zurückstufen. Der Akteur ist **absichtlich nicht fest**: Der Befund wird auf den Akteur des *frühesten* auslösenden Befunds geroutet (`routeStandWiderspruch`), zeigt also auf den, der zuerst handeln muss. Derselbe Befund kann darum mal `cowork`, mal `knowledgescout`, mal `mensch` sein |

Die Schwere zählt: Der Abnahme-Precheck blockiert nur bei `error` und
`warning`. `info`-Befunde sind Orientierung — sie müssen nicht weg, bevor
Peter abnehmen kann.

### 3 — Lange Jobs zuerst, dann parallel arbeiten

**Der größte Zeithebel.** Der Worker arbeitet seriell — die Warteschlange soll
nie leer stehen, und der Agent nie nur warten.

1. **Den längsten Job zuerst starten.** Eine 135-MB-Aufnahme braucht
   dreieinhalb Minuten, ein Textjob vierzig Sekunden.
2. **Danach alles Stapelbare hinterherwerfen** — `sourceIds` nimmt bis zu 30.
3. **Währenddessen serverfreie Arbeit erledigen:** Ordner listen, Mails
   auswerten, `_INDEX.md` prüfen, den Berichtsentwurf schreiben. Nicht schlafen.
4. **Dann `job_liste` abfragen** statt fester Wartezeiten. Ohne Filter zeigt
   sie `queued` und `running` — ist sie leer, ist alles durch. Mit
   `status: "failed"` prüfen, ob etwas gescheitert ist.

Bei einer neuen Job-Art **erst eine kleine Probe**, dann der Stapel. Ein PDF vor
sechzehn PDFs, die kleine Aufnahme vor der großen. Das hat im Pilot einen
Fehlschlag auf eine Datei begrenzt statt auf sechzehn.

### 4 — Gegenprüfen

Nach jedem Schritt mit `device_list_dir` nachsehen, ob entstanden ist, was
entstehen sollte, und an der richtigen Stelle. So kamen im Pilot ein
verschachtelter Twin-Ordner und der leere Rest eines gescheiterten Jobs ans
Licht.

### 5 — Themen zuordnen

Die Themen-Zuordnung ist Aufgabe des Aufräum-Agenten, nicht des Menschen im
Dropdown — beim Aufräumen liegt die Übersicht ohnehin hier (Entscheidung
25.08.2026). Ein Vorhaben kann mehrere Themen tragen.

- **Quelle:** `abdeckung_lesen` liefert den `themen`-Block — `vokabular`
  (kuratierte Liste aus den Library-Einstellungen) und `jeVorhaben`
  (vergebene Themen; `null` = Report vor A6, `[]` = noch ohne Thema). Nur
  Namen aus dem Vokabular vergeben; fehlt ein passendes, Peter vorschlagen
  statt erfinden.
- **Präfix sagt die Art der Arbeit:** `ACT-` Aktivismus · `DEV-` Entwicklung
  an einem Projekt · `KS-` Querschnitt KnowledgeScout · `LIB-` Inhaltsarbeit
  für eine Library · `SEC-` Querschnitt Secretary Service.
- **Die Ordnernamen geben das Thema nicht her** — sie sind Ereignisnamen.
  „26.04 Klimabotschafter Treffen" gehört zu `ACT-Klima`, ohne dass ein Wort
  darauf hinweist. Die Zuordnung verlangt den Blick in den Bericht
  (`BERICHT.md`/`_INDEX.md`), der in Schritt 4 ohnehin offen war.
- **Schreiben mit `themen_setzen`:** `themen` ersetzt die komplette Liste;
  `erwarteteThemen` ist Pflicht — exakt die Themen, die gerade am Vorhaben
  zu sehen sind, explizit `null`, wenn der Ordner keine deklariert. Weicht
  der Stand im Storage ab, wird nichts geschrieben (Riegel gegen
  konkurrierende Schreiber). Wie jeder Schreibvorgang: vorher fragen, bei
  mehreren Vorhaben einmal pro Gruppe.

### 6 — Neu scannen, berichten, Stand setzen

`abdeckung_scannen` mit `pfad` oder `folderId`.

Ein Teilbaum-Scan **merged** seit Werkzeugsatz 2.3.0 in den gespeicherten
Voll-Report — die Gesamtsicht in der Werkbank bleibt vollständig. Die Antwort
sagt es: `inVollReportGemergt: true`. Steht dort `false`, nennt `mergeHinweis`
den Grund (Report von vor W8, gekappte Befundliste, ungesichteter Vorfahr,
geänderte Konventionen) — **dann** ersetzt der Teil-Report die Gesamtsicht,
und Peter braucht einmal einen vollen Scan über die Oberfläche.

`deltaSeitLetztemScan` liefert `erledigt` und `neu` — die ehrliche
Fortschrittsanzeige. Sie erscheint **nur beim zweiten Scan desselben Scopes**.
Nach einem Scan mit anderem Scope steht dort `null` mit „Anderer Scan-Scope als
zuvor"; das ist kein Fehler, nur kein Vergleich.

Dann `BERICHT.md` und `_INDEX.md` nach den Vorlagen aus `Konventionen.md`
fortschreiben. **Den Erschließungsstand in die `_INDEX.md`**, nicht in den
Bericht — dort steht `bearbeitungsstand` im Frontmatter, und der Bericht
verweist nur darauf.

**Schreibreihenfolge beachten (Befund 27.08.2026).** `stand_setzen` schreibt in
die `_INDEX.md` — und macht damit **jeden Verweis darauf veraltet**. Wer den
Bericht vor dem Stand schreibt, erzeugt `verweis_veraltet` neu und schließt den
Befund nie. Richtige Reihenfolge: **erst `stand_setzen` bzw. die `_INDEX.md`,
der `BERICHT.md` zuletzt.**

**Den Stand setzt `stand_setzen`**, nicht die Datei-Bridge. Das Werkzeug geht
denselben geschützten Weg wie die Oberfläche: kein `_INDEX.md` vorhanden (wird
nie angelegt), Stand im Storage weicht vom erwarteten ab, Report veraltet — in
jedem dieser Fälle wird **nichts** geschrieben und der Grund benannt. `stand`,
`folderId` und `erwarteterStand` sind Pflicht; `erwarteterStand: null` heißt
„der Ordner deklariert bisher keinen". Geschrieben werden ausschließlich
`bearbeitungsstand` und `bearbeitungsstand_seit`, Body und fremde Felder
bleiben unangetastet. Nach dem Setzen zeigt der gespeicherte Report noch den
alten Stand — ein erneuter `abdeckung_scannen` auf denselben Teilbaum zieht
ihn nach.

**`abgenommen` ist über die Brücke nicht setzbar.** Die Abnahme ist Peters
Klick in der Werkbank, hinter dem ein frischer Prüfscan hängt. Das gilt auch,
wenn ein Ordner fertig aussieht.

Zum Schluss auf Peters Rechner `Organisation/Tools/aktuell.py` und
`projekte.py` laufen lassen — sonst zeigen `AKTUELL.md` und `PROJEKTE.md`
weiter den alten Stand. Läuft das nicht über die Bridge, Peter darauf hinweisen.

## Wie über Fortschritt berichtet wird

**Die Gesamtzahl der Befunde misst keinen Fortschritt.** Befunde verschwinden
nicht, sie wandern: vom Menschen zur Pipeline, von der Pipeline zur
Verifikation. Im Pilot stand die Zahl dreimal still, während der Ordner drei
Zyklusschritte vorankam.

Immer nach **Akteur** berichten:

```
38 Befunde:  2 Mensch · 35 Maschine · 1 Cowork     (Start)
30 Befunde: 28 Mensch ·  1 Maschine · 1 Cowork     (Ende)
```

Der Zielzustand eines Agentenlaufs ist **„bereit zur Abnahme"** — seit
ADR 0006 heißt das: **kein Widerstand offen** (weder maschinelle Befunde noch
Fehler-Markierungen) und noch nicht abgenommen. Ein Ordner ganz ohne offene
Befunde IST damit bereit; die frühere Zusatzbedingung „mindestens einer wartet
auf Peter" ist weggefallen. Grün kann weiterhin nur Peter machen.

**Fehlende Verifikation ist kein Befund mehr.** Maschinenarbeit gilt als
angenommen; Peter markiert nur noch, was falsch ist. Zwei Folgen für dich:

- Wird ein geprüftes Artefakt neu erzeugt, fällt seine Verifikation auf
  `ungueltig` zurück. Das ist **kein Mangel und kein Befund** — nicht als Lücke
  melden. Ein Hinweis im Bericht („diese sechs wurden neu erzeugt") ist
  trotzdem nützlich.
- Ein Ordner kann `befundAnzahl: 0` und `bereitZurAbnahme: true` melden, obwohl
  Artefakte auf `verification: "ungueltig"` stehen. Das ist der Zielzustand,
  kein Widerspruch.

Was gemeldet wird, ist beobachtet, nicht geschlossen: Verschwindet ein
Befundtyp, heißt das nicht, dass die Regel abgeschafft wurde. Zwei Regeln
können nebeneinander laufen und bei einem Ordner nur eine greifen.

## Inhaltliche Prüfung

Transformationen übernehmen Hörfehler aus Transkripten **ungeprüft in
strukturierte Felder**. Im Pilot: `authors: ["Peter Eichner"]` statt Aichner,
„Thomas Warter" statt Egger, „BOW" statt POW, „die Doktorin" statt Toggenburg.

In `authors`, `participants` und `tags` wirken solche Fehler stärker als im
Fließtext, weil danach gefiltert und verknüpft wird. Wo eine zweite Quelle
verfügbar ist — Postfach, Kalender, ein korrigiertes Protokoll — gegenprüfen
und Abweichungen melden. Ohne zweite Quelle nicht raten. Korrigiert wird nach
der Korrektur-Ordnung aus `Konventionen.md`: im **Transkript**, nie im
Transformations-Body.

## Bekannte Stolpersteine

**60-Sekunden-Limit der Brücke.** Gilt für jeden Aufruf. Scans und Prüfungen
immer auf Teilbäume begrenzen. Auch ein Stapel-Start kann hineinlaufen, obwohl
die Jobs korrekt starten — dann rettet `job_liste` die verlorenen Ids.

**Toolliste veraltet.** `bruecke_info` nennt Version und Soll-Liste. Weicht die
eigene Sicht ab, hilft kein Refresh — Peter bitten, die Erweiterung in den
Einstellungen aus- und wieder einzuschalten. Fehlt `stand_setzen`, ist die
Liste älter als Werkzeugsatz 2.3.0; fehlt `themen_setzen`, älter als 2.4.0.
Gibt `abdeckung_scannen` bei einem Teilbaum-Scan kein `antwortFuerTeilbaum`
zurück (sondern die ganze Library), ist die Fassung älter als 2.5.0.

**Zwei getrennte Bericht-Regeln.** `bericht_veraltet` prüft, ob der Bericht
älter ist als die jüngste Änderung im Vorhaben — er kommt nach jedem
Aufräumschritt wieder, am Ende einmal sauber schreiben und im Ergebnis
erwähnen. Davon unabhängig prüft das Verweis-Audit die **verwiesenen Ziele**:
`verweis_veraltet` heißt, ein verlinktes Dokument ist jünger als der Bericht;
`verweis_tot`, dass es das Ziel nicht mehr gibt. Beide Regeln laufen parallel —
verschwindet die eine, ist die andere nicht automatisch erledigt.

**OneDrive-Sync-Latenz.** Ein frisch angelegter Ordner ist für den Resolver bis
zu einer Minute unsichtbar. Bei „nicht gefunden" kurz warten und wiederholen.

**Erster Aufruf nach Serverstart** kann mit `connection timeout` scheitern.
Einmal wiederholen.

**`twins_synchronisieren export`** braucht einen existierenden `_`-Twin-Ordner.
Für neue Familien stattdessen einen Job laufen lassen, der ihn anlegt.

**`device_bash` kann ausfallen** (lokale VM startet nicht). Dann bleiben Lesen
über `device_list_dir`/`device_stage_files` und Schreiben über
`device_commit_files` — Verschieben und Löschen auf der Platte gehen nicht.
Über KnowledgeScout geht beides weiterhin.

## Was Peter entscheidet

- Jeden kostenpflichtigen Job
- Jede Umbenennung und jeden Umzug, bei denen die Zuordnung Auslegungssache ist
- Ob eine Datei verworfen wird — `quelle_verwerfen` verschiebt nach
  `zu klären/`, gelöscht wird nie
- Die Verifikation der führenden Artefakte, immer
- Die Abnahme eines Vorhabens, immer

Bei Unklarheit fragen statt raten.
