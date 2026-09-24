---
name: archiv-aufraeumen
description: Einen Vorhabensordner im Wissensarchiv über die KnowledgeScout-MCP-Brücke aufräumen — Abdeckung prüfen, Quellen erschließen, Transformationen nachziehen, Dateien und Ordner sauber benennen, Bericht fortschreiben, Stand setzen. Diesen Skill verwenden, sobald von Aufräumen, Abdeckung, Coverage, Befunden, Twins, Shadow Twins, KnowledgeScout, Erschließen, Transkribieren oder davon die Rede ist, einen Archivordner in Ordnung zu bringen oder die Arbeit von KnowledgeScout gegenzuprüfen.
---

# Archivordner aufräumen (version 2)

Wie die KnowledgeScout-Brücke bedient wird. **Was** dabei entstehen soll,
steht nicht hier, sondern im Archiv — siehe „Zuerst lesen".

## Kostenfragen
Will beim Archiv-Aufräumen keine Rückfragen, ob eine Aktion etwas kostet — Nachfragen kosten am meisten Zeit und Geld 
Ziel beim Archiv: so schnell wie möglich aufräumen; entscheiden statt fragen, wenn eine vernünftige Wahl erkennbar ist

## Schritt null: Welche Bibliothek?

**Nie raten, welche Library das Archiv ist — immer von Peter bestätigen
lassen.** `bibliotheken_auflisten` liefert über ein Dutzend Einträge, und die
Namen führen in die Irre: Der Vault `Archiv Peter` hängt an der Library, die
**„Onedrive Test"** heißt. Wer den Namen für ein Testsystem hält, irrt sich in
beide Richtungen — dort liegen die echten Verträge, und was dort geschrieben
wird, ist echt geschrieben.

Sich die Bibliothek durch Probieren zusammenzusuchen („in welcher gibt es einen
Ordner `Organisation`?") führt zu einer plausiblen, aber **unbestätigten**
Annahme — auf deren Grundlage dann kostenpflichtige Jobs starten. So geschehen
am 28.08.2026. Ein Satz genügt: „Ich sehe die Library X mit dem Vorhaben Y —
richtig?" Erst danach beginnt der Ablauf unten.

**Dann `archivpflege` prüfen (ab Werkzeugsatz 2.31.0).** `bibliotheken_auflisten`
nennt je Library `archivpflege: true/false`. Nur bei `true` führt die Library
die Archiv-Konventionen (`_INDEX.md`, `BERICHT.md`, `Organisation/`).

- `false` → **abbrechen** und sagen: „Die Library *X* führt keine
  Archiv-Konventionen; dieser Skill ist dort nicht anwendbar." Nicht trotzdem
  aufräumen, keine `_INDEX.md`/`BERICHT.md` anlegen, nicht auf eine andere
  Library ausweichen. Freigabe: Library-Einstellungen → Agentensicht
  aktivieren — das entscheidet Peter.
- Fehlt das Feld, läuft der Server noch mit einem Werkzeugsatz vor 2.31.0
  (`bruecke_info` zeigt die Version): Dort gibt es die Sperre noch nicht —
  nach Peters Bestätigung der Library wie bisher weiter.

Die Brücke setzt das serverseitig durch: `stand_setzen`, `themen_setzen`,
`erschliessung_block_schreiben` und `sichten_regenerieren` antworten bei
`archivpflege: false` mit „… gesperrt". Diesen Fehler nie umgehen (etwa per
`datei_schreiben` auf `_INDEX.md`) — er ist die Grenze, nicht ein Hindernis.
Generische Werkzeuge (Storage, Erschließen, Twins, Jobs) bleiben in jeder
Library nutzbar, gehören dann aber nicht zu diesem Skill.

## Zuerst lesen

Diese drei Dateien liegen in Peters Vault und sind die Wahrheit über
Struktur, Benennung und Berichtsform. Vor jeder Archivarbeit lesen:

| Datei | Wofür |
|---|---|
| `Organisation/Zielbild Wissensarchiv.md` | Warum das Archiv so aufgebaut ist. Vorhaben vs. Ereignis, Plattform vs. Anwendung, Original/Beleg/Ableitung |
| `Organisation/Aufraeumen/Konventionen.md` | **Das wichtigste.** Ordnernamen, Vorlagen für `_INDEX.md` und `BERICHT.md`, Frontmatter-Felder, Twin-Contract, Lese- und Korrektur-Ordnung, Vier-Schritte-Takt |
| `Organisation/Aufraeumen/HANDOVER.md` | Stand der Aufräumarbeit, offene Punkte, Eigenheiten der Mounts |

Gelesen werden sie mit `datei_lesen(libraryId, pfad)` — ein Aufruf je Datei,
unabhängig davon, ob ein Rechner verbunden ist (siehe 1a). Läuft die Session in
der Cloud ohne verbundenen Rechner, gibt es die `device_*`-Werkzeuge gar nicht;
das ist kein Ausfall und wartet sich nicht weg.

**Nichts davon in diesem Skill wiederholen** — bei Widerspruch gelten die
Dokumente im Archiv, und Abweichungen gehören dorthin gemeldet, nicht hierher
kopiert.

Aus `Konventionen.md` besonders beachten: der **Vier-Schritte-Takt**
(Strukturieren → Erschließen → Berichten → Abnehmen), die **Familien-Regel**
(Quelle und `_`-Ordner ziehen gemeinsam um) und die **Korrektur-Ordnung**
(Wortlautfehler ins Transkript, nie in den Transformations-Body).

**Die frühere Regel „alle Umbenennungen vor die Erschließung" gilt seit dem
29.08.2026 nicht mehr in dieser Schärfe** — siehe 2d. Die Grobstruktur kommt
weiter zuerst; der endgültige Name kommt aus dem Inhalt und darf danach
fallen.

**Was in einem Vorhabensordner liegt (Stand 27.08.2026):**

| Datei | Für wen | Ändert sich |
|---|---|---|
| `BERICHT.md` | Menschen | wenn ein Termin stattfand oder ein Ordner dazukommt |
| `_INDEX.md` | Werkzeuge | bei jedem Pipeline-Lauf — geschrieben von `stand_setzen` und `erschliessung_block_schreiben` |

**Eine dritte Datei gibt es nicht.** Ein Arbeitsprotokoll im Ordner ist
abgelöst: Was gelaufen ist und warum, steht seit Werkzeugsatz 2.6.0 im
Aktions-Protokoll von KnowledgeScout (`protokoll_lesen`). Vorhandene Dateien
dieser Art werden beim nächsten Anfassen aufgelöst, nicht fortgeschrieben.

## Grundregeln für die Brücke

**1. Nie Dateien direkt im Dateisystem anfassen.** Umbenennen, Verschieben und
Verwerfen laufen ausschließlich über `familie_umziehen`, `ordner_umbenennen`,
`ordner_erstellen` und `quelle_verwerfen`. Sonst zeigen die Mongo-Dokumente ins
Leere. Der `bearbeitungsstand` läuft über `stand_setzen` — nie über eine
Schreiboperation auf der Datei, sonst greifen die Schutzstufen nicht.

**1a. Seit Werkzeugsatz 2.9.0 gibt es dafür keinen Grund mehr.** KnowledgeScout
bringt die Speicherschicht selbst mit: `ordner_listen`, `pfad_aufloesen`,
`stat`, `datei_lesen`, `datei_anlegen`, `datei_schreiben`, `datei_patchen`,
`ordner_anlegen`, `verschieben`, `loeschen`, `speicher_info`. Damit ist
`device_*` für Archivarbeit **nicht mehr nötig** — weder zum Lesen noch zum
Schreiben. Nimm die KS-Werkzeuge, dann steht jede Aktion mit Begründung im
Protokoll.

Drei Regeln dazu, die Arbeit sparen:

- **`stat` statt lesen.** Für Zeitstempel-Vergleiche (`bericht_veraltet`,
  `verweis_veraltet`) reicht `stat`; eine Datei dafür zu lesen ist
  Verschwendung. `datei_lesen` mit `bereich: {art: "frontmatter"}` spart bei
  einem Feld-Check rund 97 % der Übertragung.
- **`ordner_listen` mit `zusammenfassung: true` ist der erste Griff** (ab
  Werkzeugsatz 2.19.0) bei einem unbekannten Ordner: je direktem Unterordner
  nur Anzahl, Gesamtgröße und jüngstes Datum statt der ganzen Namensliste.
  Erst der Überblick, dann gezielt hineinlisten. Eine Zeile mit lauter Nullen
  heißt „nicht hineingeschaut", nicht „leer" — Zahlen kommen erst mit
  `tiefe: 1`. Dazu begrenzt `maxBytes` (Vorgabe 64 kB) die **Größe** der
  Antwort, wo `limit` nur ihre Zahl begrenzte; eine Kürzung steht in
  `gekuerzt`, weiter geht es mit `naechsterCursor`. Damit ist auch der
  größte Vorhabensordner (78.634 Zeichen bei `tiefe: 2`) zugänglich.
- **`datei_patchen` statt `datei_schreiben`.** Sechs Modi: `ersetze` (der
  `altText` muss GENAU EINMAL vorkommen — die Eindeutigkeit ist der Schutz),
  `abschnitt_ersetzen` (Markdown-Abschnitt bis zur nächsten gleichrangigen
  Überschrift), `frontmatter_setzen` (nur die genannten Felder, Skalare; Body
  bleibt Byte für Byte stehen) und seit 2.21/2.22 zusätzlich
  `abschnitt_einfuegen` (Block vor oder nach einem Abschnitt — dafür nicht
  mehr `ersetze` auf die Überschrift missbrauchen), `tabelle_zeile_einfuegen`
  (eine Zeile, ohne die Tabelle neu zu schreiben) und `frontmatter_ergaenzen`
  (Listenfelder wie `korrespondenz:` ergänzen, ohne den Zeilenwortlaut zu
  rekonstruieren).
- **Ein Stapel statt drei Aufrufe.** `modi: [ …, …, … ]` wendet bis zu 20
  Teiländerungen in EINEM Aufruf an — alles oder nichts, jeder Schritt sieht
  das Ergebnis des vorigen, die Reihenfolge zählt. Scheitert Schritt 3, wird
  auch Schritt 1 nicht geschrieben; der Fehler nennt die Nummer.
- **Was die neuen Modi wissen müssen.** `position: "nach"` heißt hinter dem
  GANZEN Abschnitt, nicht hinter der Überschriftszeile — wer einen Abschnitt
  einfügt, meint keinen Unterabschnitt. `tabelle_zeile_einfuegen` rät nicht:
  mehrere Tabellen im Suchbereich → Fehler mit Anzahl und Fundstellen, dann
  mit `ueberschrift` eingrenzen; `position: "anfang"` setzt hinter Kopf *und*
  Trennzeile. `frontmatter_ergaenzen` entdoppelt normalisiert (Rand,
  Mehrfach-Leerzeichen, Anführungszeichen, Groß-/Kleinschreibung), auch
  innerhalb eines Aufrufs, und schreibt die Schreibweise, die schon dasteht.
- **`frontmatter_ergaenzen` kann nur die Flow-Form** `feld: [a, b]`. Steht ein
  Feld in YAML-Blockform (`feld:` und darunter `  - a`), wird es **nicht
  angefasst, sondern gemeldet** — diese Form liest der Parser als *leeren*
  Wert zurück, die Einträge wären für KnowledgeScout weg. Solche Felder erst
  umstellen, dann ergänzen.
- **Und kein Wert darf `[`, `]`, ein Komma oder einen Zeilenumbruch enthalten**
  — die Flow-Form kennt dafür kein Escaping, der Aufruf wird abgelehnt (geprüft
  am 03.09.2026 an `Vorname Nachname (fachliche Ausarbeitung, Land)`). Der Stapel
  schreibt dann korrekt gar nichts. Namenszusätze in `korrespondenz:` also ohne
  Komma formulieren; wer den Komma-Wert wirklich braucht, nimmt
  `datei_schreiben`.
- **`ifVersion` ist Pflicht, und der Konflikt ist kein Fehler.** Er liefert
  `aktuelleVersion` UND `aktuellerInhalt` mit — zusammenführen und mit der
  aktuellen Version erneut schreiben, ohne noch einmal zu lesen.

**`_INDEX.md` und `_`-Twin-Ordner gehören den Fachwerkzeugen** —
`stand_setzen`, `themen_setzen`, `erschliessung_block_schreiben` und die
Twin-Werkzeuge. Das ist die Regel; sie ist inhaltlich richtig, weil die
Schutzstufen (erwarteter Stand, Report-Alter, Rücklese-Prüfung) nur auf
diesem Weg greifen.

**Sie ist aber nicht technisch erzwungen — geprüft am 29.08.2026.**
`datei_patchen` schreibt anstandslos in eine bestehende `_INDEX.md`, sowohl
über `id` als auch über `pfad`; auch `verschieben` prüft nichts. Wer also
liest, an die Gliederungstabelle im Body komme kein Werkzeug: **das stimmt
nicht.**

Daraus folgt eine praktische und eine unpraktische Hälfte:

- **Den Body darfst du pflegen.** Die Gliederungstabelle nach einem Umzug
  nachzuziehen ist genau das, was sonst als Handarbeit liegenbleibt — mit
  `abschnitt_ersetzen` auf `## Gliederung` ist es ein Aufruf.
- **Das Frontmatter nicht.** `bearbeitungsstand`, `bearbeitungsstand_seit`,
  `themen` und den Erschließungsblock schreibst du weiter ausschließlich
  über die Fachwerkzeuge, auch wenn `datei_patchen` dich liesse. Dort sitzen
  die Riegel gegen konkurrierende Schreiber, und die umgeht man nicht, nur
  weil es geht.

**1b. Jede schreibende Aktion braucht eine `begruendung`.** Pflichtfeld ab
Werkzeugsatz 2.6.0 — ein Satz, WARUM die Aktion nötig ist („Transkript nach
Hörfehler-Korrektur neu transformiert"). KnowledgeScout schreibt sie in sein
Aktions-Protokoll, samt Fehlversuchen. `protokoll_lesen` gibt sie je Vorhaben
zurück.

**Damit entfällt die Protokoll-Datei im Archiv.** Lege kein
`ORDNUNGSZUSTAND.md` mehr an und pflege kein bestehendes fort: Job-Historie
und Befunde führt KnowledgeScout ohnehin, das WARUM steht jetzt daneben. Im
Ordner bleiben `BERICHT.md` (für Menschen) und `_INDEX.md` (für die
Werkzeuge). Was in einem vorhandenen `ORDNUNGSZUSTAND.md` an Begründungen
steht, gehört beim nächsten Anfassen in die `begruendung` der jeweiligen
Aktion — nicht in eine neue Zeile der Datei.

**1c. Umziehen geht im Stapel (ab Werkzeugsatz 2.15.0).** `familie_umziehen`
nimmt neben `sourceId` auch **`sourceIds`** — bis zu 30 Quellen in **einen**
Zielordner, je Quelle mit ihrer Twin-Familie. Ein Fehlschlag bricht den Stapel
nicht ab; jede Zeile der Antwort trägt ihr eigenes Ergebnis. Dasselbe Muster
wie bei den Jobs.

Daraus folgt die Reihenfolge beim Zerlegen eines Sammelordners: **erst die
Ereignisordner anlegen, dann je Zielordner EIN Aufruf** mit allen Dateien, die
dorthin gehören. Nicht ein Aufruf je Datei — am 29.08.2026 waren das für
`besprechungen/` 26 Aufrufe statt neun.

**Umbenennen bleibt Einzeloperation.** `neuerName` gilt für genau eine Datei —
ein gemeinsamer neuer Name ergibt für mehrere Quellen keinen Sinn. Der Stapel
ist fürs Verschieben da, nicht fürs Benennen.

**1d. `completed` heißt nicht „hat geschrieben" (ab Werkzeugsatz 2.16.0).**
Ein Job kann alle Schritte als erledigt melden und trotzdem nichts getan
haben — weil das **Extract-Gate** ihn übersprungen hat. Das Gate arbeitet mit
der Annahme *Transformation impliziert Transkript*; in der Pipeline stimmt sie
immer, weil eine Transformation dort AUS einem Transkript entsteht. Migrierte
Alt-Format-Familien verletzen sie: Zusammenfassung da, Transkript nie
dagewesen. Das Gate liest die Zusammenfassung als Beweis und überspringt die
Transkription — der Job ist danach ehrlich `completed`, mit Verweis auf das
Artefakt, das schon vorher da war.

Zwei Dinge folgen daraus:

- **`job_status` sagt jetzt, was NICHT getan wurde.** Übersprungene Schritte
  tragen `uebersprungen: true` und `grund` (z. B. `shadow_twin_exists`); hat
  ein completed-Job alle Schritte übersprungen, steht `nichtsGeschrieben` im
  Klartext in der Antwort. **Nach einem Stapel auf einer schon erschlossenen
  Familie also nicht die Zahl der `completed` zählen, sondern `job_status`
  fragen** — und danach mit `ordner_listen` nachsehen, ob die Datei wirklich
  im `_`-Ordner liegt. Verräterzeichen bleibt eine Laufzeit unter zehn
  Sekunden.
- **`erzwingen` weglassen ist ab Werkzeugsatz 2.20.0 der Normalfall.** Der
  Server erkennt die Alt-Format-Konstellation (Transformation ohne Transkript)
  selbst und übergeht das Gate von sich aus. Die Antwort weist es je Quelle
  aus — `erzwungen: "alt_format_erkannt" | "angefordert" | "abgelehnt" |
  "nicht_noetig"`, dazu `erzwungenAutomatisch` als Zähler. `erzwingen: true`
  heißt weiterhin „immer übergehen", `erzwingen: false` ausdrücklich „nie" —
  die menschliche Ansage gewinnt in beide Richtungen. Bei einer Familie, der
  nur das Transkript fehlt, gehört `template: "nur_transkript"` dazu; ein
  Template-Lauf wäre doppelt bezahlt, die Transformation gibt es ja schon.

**Und der Umkehrschluss gilt nicht:** `legacy_twin_name` ist ein
**Namens**-Befund, kein Beleg für ein fehlendes Transkript. Was einer Familie
fehlt, steht je Familie im Abdeckungs-Report — das wird gelesen, nicht aus
einer Befundzahl hochgerechnet. Am 29.08.2026 ist genau dieser Fehlschluss
passiert (aus 236 Namensbefunden wurden 236 vermeintlich kaputte Familien);
belegt waren zwölf.

**2. Nicht nach Kosten fragen — entscheiden und berichten.** Ausdrückliche
Ansage von Peter am 29.08.2026: „Ich weiß nicht, warum wir dauernd fragen, ob
etwas was kostet. Das geht mir auf die Nerven. Ich möchte mein Archiv
aufräumen, so schnell wie möglich. Diese Nachfragen kosten am meisten Zeit und
Geld."

Daraus folgt für `quelle_erschliessen` und `transformation_starten`: **starten,
nicht anfragen.** Auch bei Format-Zwillingen, auch bei großen Aufnahmen. Was
gelaufen ist, steht hinterher im Ergebnis — was und wie viel, in einem Satz.
Die frühere Regel „vor jedem Schreibvorgang fragen" ist damit aufgehoben.

Was trotzdem gefragt wird, ist die kurze Liste der **unumkehrbaren oder
inhaltlich strittigen** Entscheidungen unter „Was Peter entscheidet" — dort
geht es nie um Geld, sondern um Bedeutung. Und im Zweifel gilt: eine
vernünftige Wahl treffen, sie im Ergebnis benennen, weiterarbeiten. Eine
Rückfrage, die sich aus dem Archiv selbst beantworten lässt, ist keine
Rückfrage, sondern ein ungelesenes Dokument.

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

## Archiv oder Asana — die Trennlinie ist die Zeit

- **Archiv = Vergangenheit und Kontext.** Was war, mit wem, warum, wo der Beleg
  liegt. Ist in zwei Jahren noch richtig.
- **Asana = Zukunft und Zuteilung.** Was zu tun ist, bis wann. Ist in zwei
  Wochen falsch.

Der Test: „Die Ampel-Logik wirkt invertiert" ist ein **Befund** — datiert, mit
Quelle, bleibt im Bericht. „Ampel-Logik mit Roland gegenprüfen" ist eine
**Aufgabe** — die gehört nach Asana, nicht ins Archiv.

Ein Punkt darf an beiden Orten vorkommen, aber nur als Verweis, nie als Kopie.
Zahlen (Quellenzahl, offene Verifikationen) stehen ausschließlich im
Maschinenblock der `_INDEX.md` und in der Agentensicht — nie zusätzlich im
Bericht, sonst pflegst du sie an drei Stellen.

Die Form (Frontmatter-Feld für die Projekt-URL, Aufbau des Berichts) steht in
`Konventionen.md` — hier steht nur, WOHIN etwas gehört.

## Der Ablauf

### 1 — Lage feststellen

```
bruecke_info                                  # 2.26.0, 38 Werkzeuge?
bibliotheken_auflisten
korrekturen_lesen(libraryId)                  # Übersicht: wo liegen Aufträge?
korrekturen_lesen(libraryId, pfad)            # Arbeitsliste dieses Teilbaums
ordner_listen(libraryId, pfad, zusammenfassung: true, tiefe: 1)
abdeckung_lesen(libraryId, akteur: "knowledgescout", zyklusSchritt: 1)
```

**Die Korrekturaufträge kommen zuerst** (Werkzeugsatz 2.26.0). Was Peter an
einzelnen Dateien korrigiert haben will, diktiert er in der Werkbank; es steht
im Frontmatter des Twins und in MongoDB, braucht also keinen Scan.
`korrekturen_lesen` hat zwei Betriebsarten: **ohne** `ordner`/`pfad` eine
verdichtete Übersicht je Ordner (Anzahl, ältester Auftrag, Auszug) — damit
entscheidest du, wo du anfängst; **mit** `ordner`/`pfad` die Arbeitsliste des
Teilbaums im Volltext, mit `sourceId` und Artefakt-Referenz. Beim Aufräumen
eines Ordners ist die zweite Form der **erste** Schritt: Ein Auftrag löst meist
Umbenennen oder Verschieben aus, und die gehören vor die Erschließung.

**Vollzug meldet `korrektur_melden` — erst NACH getaner Arbeit.** Es setzt
`korrektur_erledigt_at` über denselben geschützten Kurations-Weg wie die
Werkbank. Der Auftragstext **bleibt stehen**; er ist der Beleg, an dem Peter
prüft. Der Befund `korrektur_offen` erlischt, die Werkbank zeigt „repariert,
bitte ansehen" — aufgelöst ist die Sache erst durch Peters Verifizieren
(ADR 0006, die Abnahme bleibt menschlich). Die Artefakt-Referenz exakt aus
`korrekturen_lesen` übernehmen: `kind`, bei `transformation` zusätzlich
`templateName` und `zielsprache`, beim Transkript beide verboten. Ohne offenen
Auftrag wird die Meldung abgelehnt, nicht still angenommen.

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
| `twin_core_missing` | KS · warning | meist mit der Transformation erledigt. **Ausnahme seit 2.30.0:** an einer Notiz oder Verlaufsdatei (`type: notiz` / `verlauf`) ist der Akteur **Cowork** — `generated_by` und `generated_at` per `frontmatter_setzen` nachtragen |
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
| `verweis_veraltet` | Cowork · warning | verwiesenes Ziel ist jünger — Verweis prüfen, dann Bericht neu speichern |
| `verweis_tot` | Cowork · error | Verweis zeigt ins Leere — Ziel suchen oder Verweis entfernen |
| `bericht_unvollstaendig` | Cowork · **info** | Bericht lässt Quellen unerwähnt — seit 2.30.0 zählt auch die Nennung in einer Notiz oder Verlaufsdatei, auf die der Bericht verlinkt (eine Ebene tief; das Detail sagt „über Verweise erwähnt: X (in Notiz.md)"). Die fehlende Quelle deshalb **in der passenden Notiz** nennen, NICHT als Dateiliste in den Bericht schieben |
| `bericht_zu_lang` | Cowork · warning | `BERICHT.md` größer als die Schwelle seiner `rolle` — **verdichten nach Schritt 6**: Gliederung lesen, Verlauf in Notizen (`type: notiz`, Ereignisordner) und Verlaufsdateien (`type: verlauf`, Vorhabenswurzel) auslagern, im Bericht eine Zeile mit echtem Link lassen. Nichts weglassen: Jede Aussage steht danach im Bericht oder höchstens einen Link entfernt |
| `status_zu_lang` | Cowork · **info** | `## Status` hat mehr Zeilen als erlaubt (Codeblöcke zählen nicht) — Status neu schreiben: nur was JETZT gilt; die Geschichte dahin gehört in die Chronologie bzw. eine verlinkte Notiz |
| `bericht_ueberholt` | Cowork · **info** | offene `- [ ]` mit vergangenem Datum oder `naechster_termin` in der Vergangenheit; das Detail nennt jede Zeile wörtlich — abhaken/entfernen, Verschobenes neu datieren, `naechster_termin` auf den nächsten echten Termin setzen oder entfernen |
| `verlauf_fehlt` | Cowork · **info** | `postfach_bis` gesetzt, aber der Bericht verlinkt auf keine Datei mit `type: verlauf` — `Korrespondenz.md` in der Vorhabenswurzel anlegen (Frontmatter `type: verlauf`, `generated_by`, `generated_at`), KW-Abschnitte aus dem Bericht dorthin verschieben, im Bericht `[[Korrespondenz]]` verlinken |
| `entwicklung_unberichtet` | Cowork · **info** | ein Eintrag in `Entwicklung.md` (Skill `repo-bericht`, Claude Code) nennt dieses Vorhaben, der Bericht ist älter und verweist nicht darauf — je Eintrag **eine** Chronologiezeile mit Link auf das Sprungziel (`[[Entwicklung#<anker>]]`), erledigte offene Fragen abräumen; Inhalt NICHT kopieren. Erscheint nur, wenn der Plattformbericht auf `[[Entwicklung]]` verlinkt, und im Teilbaum-Scan nur, wenn `Entwicklung.md` im Teilbaum liegt |
| `teilbaum_ungesichtet` | KS · **info** | Sammel-Befund unter ungesichtetem Ordner — erst strukturieren |
| `scan_error` | KS · error | Teilbaum nicht lesbar — Ursache melden, nie übergehen |
| `twin_flagged` | Mensch · error | Peter hat das Artefakt als **fehlerhaft markiert** — Notiz in `flagged_note` lesen, reparieren; die Abnahme bleibt gesperrt, bis Peter danach verifiziert |
| `twin_unverified` | *(Alt-Bestand)* | **ignorieren** — seit ADR 0006 abgeschafft. Steht noch in Reports vor dem 27.08.2026 und verschwindet beim nächsten Scan. Nicht auflisten, nicht beauftragen |
| `self_verified` | Mensch · error | **nichts tun** — Erzeuger und Prüfer sind derselbe |
| `stand_widerspruch` | **wandernd** · error | erklärter Stand ist widerlegt — Peter melden, nicht selbst zurückstufen. Der Akteur ist **absichtlich nicht fest**: Der Befund wird auf den Akteur des *frühesten* auslösenden Befunds geroutet (`routeStandWiderspruch`), zeigt also auf den, der zuerst handeln muss. Derselbe Befund kann darum mal `cowork`, mal `knowledgescout`, mal `mensch` sein |
| `quelle_verschwunden` | Mensch · error | Datenbank kennt die Quelle, im Speicher liegt sie nicht mehr, und ihr Ordner *wurde* gelesen — **kein Job behebt das.** Nicht erneut erschließen, sondern die Datei zurückholen oder die Familie mit `quelle_verwerfen` auflösen. Gilt seit 2.26.0 auch bei Teilbaum-Scans; genau dort fehlte er (15 Fälle als „behebbar" gemeldet, zwölf Jobs gekostet) |

> Bei `bericht_veraltet` zählt seit 27.08.2026 nur eine **Inhalts**-Änderung:
> Ein Kurations-Stempel (Verifizieren, Markieren) altert den Bericht nicht
> mehr. Früher liess jeder Prüf-Klick `bericht_veraltet` und damit
> `stand_widerspruch` neu aufpoppen — eine Schleife, die sich durch Arbeiten
> nicht schliessen liess. (Diese Zeile stand bis 03.09.2026 mitten in der
> Tabelle und zerriss sie in zwei — `tabelle_zeile_einfuegen` scheiterte
> daran mit „2 Tabellen im Abschnitt".)

Die Schwere zählt: Der Abnahme-Precheck blockiert nur bei `error` und
`warning`. `info`-Befunde sind Orientierung — sie müssen nicht weg, bevor
Peter abnehmen kann.

### 2b — Format-Zwillinge zusammenfassen, bevor der Stapel startet

Der Scan zählt **Dateien**, nicht Dokumente. Ein Vertragsordner hat schnell
fünfzehn Quellen und acht Dokumente: dasselbe Angebot als `.docx`, als `.pdf`
und noch einmal als `_signed.pdf`. Wer den Stapel blind startet, zahlt
denselben Inhalt bis zu dreimal.

**Also vor dem Start gruppieren** — nach Basisnamen, quer über die Endungen,
und `_signed`/`(1)`/`(2)`-Varianten dazu. Dann Peter die Rechnung vorlegen: so
viele Dateien, so viele Dokumente, und die Folge beider Wege ehrlich dazu. Denn
hier gibt es keine gute Antwort, nur eine Wahl:

- **Alle erschließen** — der Ordner wird sauber und abnahmebereit, kostet aber
  doppelt und dreifach.
- **Nur die führende Fassung** (die signierte, sonst das PDF) — die übrigen
  bleiben als `source_without_twin` mit Schwere `error` stehen und **sperren
  damit die Abnahme**. Zielbild §7 nennt Mehrfach-Exporte zwar „Ableitung",
  aber es gibt **kein Werkzeug, das eine Quelle als Beleg oder Ableitung
  markiert** — der Scan zählt sie trotzdem. Das gehört auf die Wunschliste.

**Entscheiden, nicht fragen** (seit 29.08.2026): Im Zweifel alle erschließen,
die Rechnung — so viele Dateien, so viele Dokumente — kommt ins Ergebnis. Nur
wenn ein Ordner erkennbar aus Dutzenden Exporten derselben Fassung besteht,
lohnt der Blick, welche Fassungen wirklich eigenständig sind.

### 2c — Die Vorlage aus dem Inhalt ableiten, nicht aus dem Dateinamen

**Der Fehlschlag vom 28.08.2026:** fünfzehn Vertrags- und Vergabedokumente mit
dem Standard-Template `standard-meeting` gestartet — vierzehnmal
`transform_template` gescheitert, `ingest_rag` lief nie, nichts landete im
Index. Verträge sind keine Besprechungen; das Template fand die Felder nicht,
die es erwartet.

Der Dateiname sagt nicht, was ein Dokument ist. `Anlage A1 de.pdf`,
`Copia con segnatura Prot.N.….pdf`, `OffEcon_…_1_….pdf` — daraus
lässt sich keine Vorlage ableiten, und Raten ist teuer. Deshalb in zwei
Schritten:

1. **Erst nur transkribieren:** `quelle_erschliessen(template: "nur_transkript")`.
   Das kann an keinem Template scheitern und ist der billige Teil.
2. **Dann das Transkript lesen** — die ersten sechzig Zeilen genügen fast
   immer, `datei_lesen` mit `bereich: {art: "zeilen", von: 1, bis: 60}` — und
   daraus die passende Vorlage bestimmen. Danach
   `transformation_starten(template: …)`.

Bei einem Stapel gilt die Probenregel doppelt: **eine** Datei durch beide
Schritte, und erst wenn die Transformation steht, die übrigen hinterher.

Welche Vorlagen es gibt, sagt `vorlagen_auflisten` (ab Werkzeugsatz 2.12.0).
Fehlt das Werkzeug, läuft eine ältere Fassung — dann die Vorlage nach bestem
Wissen wählen, statt zu fragen.

**Korrektur vom 29.08.2026 — wichtiger als alles darüber.** Die Diagnose
„`standard-meeting` passt nicht für Vertragsdokumente" war **falsch**. Im
Ordner eines Projekts liefen damit 27 Angebote, Broschueren, Handbücher und
technische Spezifikationen sauber durch — `docType: other`,
`meetingType: other`, brauchbare Felder bis hin zur Angebotssumme. Der
Fehlschlag vom 28.08. war derselbe sporadische Transformer-Ausfall, der auch
am 29.08. vier von 32 Jobs traf und bei **unveränderter Wiederholung dreimal
durchlief**.

Daraus zwei Regeln:

1. **Bei einem Fehlschlag zuerst einmal wiederholen**, bevor die Vorlage
   verdächtigt wird. Das Erkennungszeichen des sporadischen Ausfalls:
   `Transformer lieferte kein gültiges structured_data`, HTTP 200,
   `requests_count: 0` — die LLM-Anfrage kam gar nicht zustande. Ein echter
   Vorlagen- oder Inhaltsfehler sieht anders aus, z. B.
   `textSource ist leer oder zu kurz (0 Zeichen)`.
2. **Den Zwei-Schritte-Weg nur nehmen, wenn wirklich keine Vorlage passt.**
   Am 29.08. wurden 27 Dokumente erst als `nur_transkript` extrahiert und
   danach einzeln transformiert — das war ein kompletter zweiter Durchlauf,
   den ein direkter Start mit `standard-meeting` gespart hätte. `nur_transkript`
   ist die ehrliche Antwort bei echter Unklarheit, nicht die vorsichtige
   Standardwahl.

Eigene Vorlagen für Verträge (Auftraggeber, Summe, Laufzeit, Zahlungsziel)
wären trotzdem besser — das steht als G5 auf der Wunschliste.

### 2d — Namen kommen aus dem Inhalt, nicht aus dem Dateinamen

**Ein Name, den man nicht belegen kann, ist geraten.** Dateinamen und
Zeitstempel sind Indizien, keine Belege: Der Zeitstempel einer Aufnahme ist
der Moment des Speicherns, nicht der des Termins, und in Dateinamen stecken
Tippfehler, die sich über Jahre halten. Am 29.08.2026 trug eine
Aufnahme `240331` im Namen — der Termin war der **31.03.2025**.

Die Belegkette, in dieser Reihenfolge:

1. **Protokoll oder Transkript neben der Quelle.** Viele Aufnahmen haben eine
   `.md` daneben, oft mit Frontmatter `Datum:`/`Wann:` und Teilnehmenden. Das
   ist der billigste Beleg — `datei_lesen` mit `bereich: {art: "zeilen"}`.
2. **Das erschlossene Transkript.** Fehlt ein Protokoll, ist
   `quelle_erschliessen(template: "nur_transkript")` der Weg: Ein Diktat sagt
   im ersten Satz, worum es ging („Jetzt waren wir da bei dem Verband,
   Präsentation des Prototyps").
3. **Der Außenblick.** Kalender und Postfach entscheiden, was im Ordner nicht
   steht. Der 240331-Fall wurde vom Kalendereintrag gelöst: „Vorstellung
   Prototyp", 31.03.2025, 16:00, beim Partnerverband.

**Daraus folgt eine Korrektur am Vier-Schritte-Takt.** Die Konventionen sagen
„Alle Umbenennungen passieren in Schritt 1 — vor der Erschließung". Die Sorge
dahinter ist berechtigt, zielt aber auf das Dateisystem: Wer an der Brücke
vorbei umbenennt, zerreißt die Familie. Über `familie_umziehen` passiert das
nicht — das Werkzeug ist genau dafür gebaut und zieht Quelle, Twins und die
Mongo-Dokumente gemeinsam um, migriert dabei sogar Alt-Format-Twins in den
`_`-Schattenordner. Belegt am 29.08.2026: Umbenennung einer erschlossenen
Quelle mit `imported`, `mongoUpdated`, `oldTwinFolderDeleted`, `exported`.

Also gilt: **Grobstruktur zuerst** — Vorhabensordner, Ereignisordner,
Sammelordner auflösen, offensichtlich überlange Namen kürzen. **Die genaue
Benennung darf hinter die Erschließung**, wenn erst das Transkript sagt, was
in der Datei steckt. Zweimal anfassen ist billiger als ein falscher Name, der
stehen bleibt.

Was dabei auffällt, gehört gemeldet: `quelle_erschliessen` meldet
`completed` mit drei grünen Schritten auch dann, wenn es nichts getan hat,
weil neben der Quelle schon ein Alt-Format-Twin liegt und die Familie als
erschlossen gilt. Zwei Sekunden Laufzeit und ein leerer `_`-Ordner sind das
Verräterzeichen.

**Der Preis dieser Reihenfolge ist bezifferbar** (29.08.2026, SHF
Nachhaltigkeit): Wer eine bereits erschlossene Quelle umbenennt, bekommt
`twin_stale` — die Quelldatei ist danach jünger als ihre Artefakte, und der
Scan verlangt einen Pipeline-Neulauf. Drei umbenannte Angebotsdateien kosteten
drei zusätzliche Jobs.

Daraus die Faustregel: **Was sich schon aus Dateiname, Ordner oder
Nachbardatei sicher benennen lässt, wird VOR der Erschließung benannt** — vor
allem, wenn ohnehin gekürzt werden muss. Erst wenn der Name wirklich nur aus
dem Inhalt kommen kann, lohnt der zweite Griff.

**Seit 2.26.0 verschiebt sich das Gewicht wieder auf „vorher".** Die Regel
steht jetzt an `familie_umziehen` selbst und wirkt damit für alle Clients:
erst umbenennen, *dann* erschließen. Die Gegenprobe ist beziffert — nachher
umbenannt ergab 23 Familien `twin_stale`, vorher umbenannt 28 Umzüge und null.
Der Weg über den Inhalt bleibt richtig, wo der Name wirklich nur aus dem
Transkript kommen kann; er ist die Ausnahme, nicht der Regelfall.

**`date_quelle: pfad` im Frontmatter ist ein Indiz, kein Beleg.** Fällt `date`
aus, leitet die Pipeline es aus dem Ordnernamen ab
(`2025-07-16 Besprechung mit Projektpartner`) und weist die Herkunft mit dieser Marke
aus. Ein so entstandenes Datum ist *abgeleitet*, nicht geprüft — es zählt wie
ein Dateiname, nicht wie ein Protokoll. Vorhabensnummern wie `24.09` oder
`26.01` werden bewusst **nicht** als Datum gelesen.

**Und die Pfadgrenze vorher rechnen.** Windows kappt bei 260 Zeichen, und die
Twin-Familie hängt zweimal daran: `_<Dateiname>/<Dateiname>.<template>.de.md`.
Ein 63 Zeichen langer Dateiname unter einem 50 Zeichen langen Vorhabenspfad
lässt **keinen Ereignisordner mehr zu** — am 29.08.2026 bei den
SHF-Angeboten aufgetreten. Dann erst kürzen, dann den Ordner anlegen, dann
umziehen.

### 3 — Lange Jobs zuerst, dann parallel arbeiten

**Der größte Zeithebel.** Der Worker arbeitet seriell — die Warteschlange soll
nie leer stehen, und der Agent nie nur warten.

0. **Vor der ersten Erschließung `twins_synchronisieren`** (import → repair →
   export). Es adoptiert Quellen, deren Auswertung schon existiert, aber noch
   nicht verbucht ist — in einem gemessenen Lauf rund 90 Stück, die sonst ein
   zweites Mal transkribiert worden wären. Steht seit 2.26.0 auch in der
   Werkzeugbeschreibung selbst, gilt also für alle Clients.
1. **Den längsten Job zuerst starten.** Eine 135-MB-Aufnahme braucht
   dreieinhalb Minuten, ein Textjob vierzig Sekunden.
2. **Danach alles Stapelbare hinterherwerfen** — `sourceIds` nimmt bis zu 30.
3. **Währenddessen serverfreie Arbeit erledigen:** Ordner listen, Mails
   auswerten, `_INDEX.md` prüfen, den Berichtsentwurf schreiben. Nicht schlafen.
4. **Dann `job_liste` abfragen** statt fester Wartezeiten. Ohne Filter zeigt
   sie `queued` und `running` — und ab Werkzeugsatz 2.15.0 zusätzlich
   **`gescheitertKuerzlich`**: Zahl und `jobIds` der Fehlschläge der letzten
   Stunde, direkt verwendbar für `job_status` mit seinen `fehlerDetails`.

**Eine leere Liste heißt „durch", nicht „gelungen".** `status: "failed"` ist
kein Nachtrag, sondern Pflicht nach jedem Lauf — am 28.08.2026 meldete die
offene Liste Ruhe, während vierzehn von fünfzehn Jobs gescheitert waren.

Genau dieser Fall ist seit 2.15.0 entschärft: Die ungefilterte Liste nennt die
Fehlschläge der letzten Stunde von sich aus. **Steht dort eine Zahl größer
null, ist der Lauf nicht durch** — dann `job_status` je genannter `jobId`
fragen, bevor irgendetwas als erledigt gemeldet wird. Meldet die Antwort das
Feld gar nicht, läuft eine Fassung vor 2.15.0; dann gilt weiter der
Nachtrag-Aufruf mit `status: "failed"`. Nur Fehlschläge mit lesbarem
Zeitstempel zählen mit — die Zahl ist eine Untergrenze, kein Beweis für
Stille.

**Und ein `running` ist nicht immer ein laufender Job.** Schlägt ein früher
Schritt fehl, kann der Job auf `running` stehenbleiben, ohne sich je wieder zu
rühren. Der Verräter ist `aktualisiert`: Liegt der Zeitstempel weit hinter dem
der anderen Jobs desselben Stapels, hängt er — dann `job_status` fragen und
sich die `schritte` ansehen, statt weiter zu warten.

**Wegräumen geht seit Werkzeugsatz 2.23.0 selbst.** Zwei Griffe, die nicht zu
verwechseln sind: `jobs_aufraeumen` beantwortet „steht etwas still?" — mehrere
Jobs, Stillstand nötig. `job_abbrechen` beantwortet „diesen einen will ich
nicht mehr" — genau einer, ohne Schwelle, unabhängig von Lebenszeichen (falsche
Vorlage, Job aus einer alten Sitzung). Abgebrochen heißt **gescheitert**, nicht
erledigt; was gebraucht wird, neu starten.

**Und `job_liste` widerspricht jetzt dem „nichts zu tun außer warten".** Sind
alle laufenden Jobs innerhalb von zwei Minuten verstummt und schweigen seit
mindestens fünf, steht ein **`neustartVerdacht`** im `pool`-Block, und sein
Hinweis kommt *vor* dem Regelhinweis. Das ist das Muster eines
Prozess-Neustarts: dann nicht warten, sondern `jobs_aufraeumen` mit kurzer
`mindestStillstandMinuten`. Der Verdacht kommt aus dem Zeitmuster, ist kein
Beweis — und steht so auch in der Antwort.

Bei einem Fehlschlag liefert `job_status` ab Werkzeugsatz 2.12.0
**`fehlerDetails`** ungefragt mit — Schritt, Fehlercode, die eigentliche
Meldung des Dienstes, HTTP-Status und ein Auszug der Antwort. Kommt nur
`fehler: "Template-Transformation fehlgeschlagen"` ohne Details, läuft eine
ältere Fassung: Dann steht die Ursache im Job-Trace, an den die Brücke nicht
herankommt — melden, statt zu raten.

**Seit 2.24.0 kommt bei bekannten Lagen zusätzlich `fehlerDeutung`** — Klartext
plus `wiederholenSinnvoll`. Erster Fall: `quelle_ohne_ton`.
**`wiederholenSinnvoll: false` heißt: nicht neu starten** — die Wiederholung
kostet und ändert nichts. Und bei `quelle_ohne_ton` gilt zusätzlich: Hat diese
Quelle bereits ein Transkript, ist es **verdächtig**. Eine Transkription ohne
Tonquelle liefert erfundenen Text, der für jeden Scan gültig aussieht — vor
dem Weiterverwenden ansehen.

Bei einer neuen Job-Art **erst eine kleine Probe**, dann der Stapel. Ein PDF vor
sechzehn PDFs, die kleine Aufnahme vor der großen. Das hat im Pilot einen
Fehlschlag auf eine Datei begrenzt statt auf sechzehn.

### 4 — Gegenprüfen

Nach jedem Schritt mit `ordner_listen` nachsehen, ob entstanden ist, was
entstehen sollte, und an der richtigen Stelle. So kamen im Pilot ein
verschachtelter Twin-Ordner und der leere Rest eines gescheiterten Jobs ans
Licht.

**Auf die Familienliste schauen, nicht nur auf die Befundzahl.** Steht bei einer
Familie `leading.kind: "transcript"` statt `"transformation"`, ist die Quelle
nur teil-erschlossen — auch wenn der Job als gestartet gemeldet wurde.

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

### 5b — Der Außenblick: was der Ordner nicht weiß

Der Ordner enthält, was abgelegt wurde. **Warum** es abgelegt wurde, steht oft
woanders. Vor dem Berichten deshalb drei Quellen außerhalb des Ordners prüfen —
im Pilot vom 20.08. hat genau das den Ansprechpartner-Wechsel beim Land und
zwei am selben Tag verwechselte Treffen zutage gefördert.

| Quelle | Wonach suchen | Was damit geschieht |
|---|---|---|
| **Postfach** | Korrespondenz mit den Beteiligten im Zeitraum des Vorhabens | in die Korrespondenz-Tabelle des Berichts; als Datei nur ablegen, wenn ein Beschluss oder ein Dokument dranhängt |
| **Kalender** | Termine, Teilnehmerlisten, Absagen | Gegenprobe zu Datum und Beteiligten in Chronologie und Transformationen |
| **Repo** | `git log`, wenn `repo:` im Frontmatter steht | Entwicklungsphasen — Vorgehen im Skill `repo-bericht` |

**Der Außenblick ist eine Gegenprobe, keine Quelle zweiter Ordnung.** Wo er
einer Transformation widerspricht, gewinnt der Beleg: eine Mail mit Datum
schlägt ein Datum, das aus einem Ordnernamen geraten wurde. Ohne zweite Quelle
wird nicht korrigiert, sondern der Widerspruch benannt.

**Was dabei anfällt, gehört ins Frontmatter:** Die Gegenstellen, die im Postfach
auftauchen, kommen als `korrespondenz:` in den `BERICHT.md` — das ist die
Grundlage der Personen-Übersicht und später der Weg, Beteiligte über
Fortschritte zu informieren.

**Grenze:** Aus Mails werden Beschlüsse, Termine und Namen übernommen — keine
Inhalte, keine Zitate aus privater Korrespondenz, keine Zugangsdaten. Im Zweifel
protokollieren statt kopieren.

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

Dann `_INDEX.md` nach Vorlage nachziehen und den **`BERICHT.md` als Zustand neu
schreiben — nicht anhängen** (Konventionen, Abschnitt „Länge"):

1. **Erst messen.** `stat` auf den Bericht (Größe) bzw. `berichte.jeVorhaben` in
   `abdeckung_lesen`; die Schwellen stehen in `conventions`.
2. **Gliederung statt Volltext.** `datei_lesen` mit
   `bereich: {art: "gliederung"}` — Überschriften mit Zeilenbereich, Bytes und
   offenen Punkten. Einträge mit `keineEchteUeberschrift` sind Zeilen in
   Codeblöcken, keine Abschnitte. Dann nur die Abschnitte lesen, die geändert
   werden (`bereich: abschnitt`).
3. **Status neu schreiben** (`abschnitt_ersetzen`): was jetzt gilt, höchstens
   die erlaubten Zeilen. Ältere Fassungen und Zwischenstände gehören nicht hinein.
4. **Erledigtes abräumen**, Neues als **eine Chronologiezeile mit Link**. Das
   Detail kommt in eine Notiz im Ereignisordner (`type: notiz`) oder in eine
   Verlaufsdatei der Vorhabenswurzel (`type: verlauf`, z. B.
   `Korrespondenz.md`) — beide mit `generated_by` und `generated_at`, beide
   vom Bericht aus **verlinkt**, sonst sieht der Scan sie nicht.
5. **Auf die Antwort achten.** Die Schreibwerkzeuge melden bei `BERICHT.md`
   `groesseNachher`, `schwelle`, `schwelleUeberschritten`; bei
   `abschnitt_einfuegen` mit neuer `##`-Überschrift kommt die Rückfrage, ob das
   in eine Ereignisnotiz gehört. Ein Hinweis, keine Sperre — aber am Ende des
   Laufs soll der Bericht unter der Schwelle liegen.

**Den Erschließungsstand in die `_INDEX.md`**, nicht in den Bericht — dort
steht `bearbeitungsstand` im Frontmatter, und der Bericht verweist nur darauf.
`repo_stand_am` und `repo_stand_commit` setzt der Skill `repo-bericht` in
Claude Code, nicht dieser Lauf.

**Schreibreihenfolge beachten (Befund 27.08.2026).** `stand_setzen` schreibt in
die `_INDEX.md` — und macht damit **jeden Verweis darauf veraltet**. Wer den
Bericht vor dem Stand schreibt, erzeugt `verweis_veraltet` neu und schließt den
Befund nie. Richtige Reihenfolge: **erst `stand_setzen` bzw. die `_INDEX.md`,
der `BERICHT.md` zuletzt.**

**`bearbeitungsstandSeit` in der Antwort ist ein Tagesende.** Steht in der
Datei `2026-08-27`, antwortet das Werkzeug `2026-08-27T23:59:59.999Z` — reine
Datumsangaben werden großzügig als Tagesende gelesen, damit eine Änderung AM
Stichtag den Stand nicht sofort widerlegt. Das ist kein Zeitstempel in der
Zukunft und kein Fehler.

**Die `_INDEX.md` behält ihre itemId** (seit 27.08.2026). Früher löschte
`stand_setzen` die Datei und legte sie neu an — gespeicherte fileIds liefen
danach in `NOT_FOUND`. Wenn das bei dir noch passiert, läuft eine alte Fassung.

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

Zum Schluss `sichten_regenerieren` aufrufen — es erzeugt `AKTUELL.md` und
`PROJEKTE.md` aus allen `BERICHT.md` und löst die früheren Skripte
`aktuell.py` / `projekte.py` ab. Dauert 20–40 s, schreibt zwei Dateien nach
`Organisation/`, nur nach Bestätigung.

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

**Null Befunde heißt nicht fertig.** Eine Verifikation, die durch eine
Re-Transformation ungültig geworden ist, erzeugt **keinen Befund** (ADR 0006:
sie fällt auf „angenommen" zurück, nicht auf „Mangel"). Der Teilbaum meldet
dann `befundAnzahl: 0` und `bereitZurAbnahme: true`, während Artefakte auf
einen Blick des Menschen warten. Deshalb nach jedem Scan die Familienliste auf
`verification: "ungueltig"` prüfen und diese Zahl **getrennt** berichten — als
Angebot, nicht als Schuld.

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

Nach einer Re-Transformation gilt der Vorbehalt doppelt: Die neue
Zusammenfassung stammt aus dem Transkript in seinem **aktuellen** Stand. Ist
das Transkript nicht gegengelesen, ist es die Zusammenfassung erst recht
nicht — auch wenn dieselbe Familie vorher schon einmal verifiziert war.

## Bekannte Stolpersteine

**60-Sekunden-Limit der Brücke.** Gilt für jeden Aufruf. Scans und Prüfungen
immer auf Teilbäume begrenzen. Auch ein Stapel-Start kann hineinlaufen, obwohl
die Jobs korrekt starten — dann rettet `job_liste` die verlorenen Ids.

**`eTag mismatch` beim Jobstart.** „The resource has changed since the caller
last read it" — einmal unverändert wiederholen, dann geht es meist durch.

**Eine Re-Transformation macht die Verifikation ungültig.** `verified_at` liegt
danach vor `generated_at`, das Artefakt fällt auf `verification: "ungueltig"`
zurück. **Vor der Freigabe ansagen, wie viele Verifikationen dadurch
zurückfallen** — sonst kostet ein `info`-Befund den Menschen Arbeit, die er
gerade erst erledigt hat.

**Toolliste veraltet.** `bruecke_info` nennt Version und Soll-Liste. Weicht die
eigene Sicht ab, hilft kein Refresh — Peter bitten, die Erweiterung in den
Einstellungen aus- und wieder einzuschalten. Fehlt `stand_setzen`, ist die
Liste älter als Werkzeugsatz 2.3.0; fehlt `themen_setzen`, älter als 2.4.0.
Gibt `abdeckung_scannen` bei einem Teilbaum-Scan kein `antwortFuerTeilbaum`
zurück (sondern die ganze Library), ist die Fassung älter als 2.5.0.
Verlangen die Schreib-Werkzeuge keine `begruendung` bzw. fehlt
`protokoll_lesen`, ist sie älter als 2.6.0. Fehlen `datei_lesen`/`datei_patchen`
und die übrige Speicherschicht, ist sie älter als 2.9.0. Fehlt
`vorlagen_auflisten` oder liefert `job_status` bei einem Fehlschlag keine
`fehlerDetails`, ist sie älter als 2.12.0. Weiter (Stand 03.09.2026):

- Fehlen `korrekturen_lesen`/`korrektur_melden` → älter als **2.26.0**
- Fehlen `datei_binaer_lesen`/`datei_binaer_anlegen` → älter als **2.25.0**
- Liefert `job_status` bei einem Fehlschlag keine `fehlerDeutung` → älter als **2.24.0**
- Fehlt `job_abbrechen` oder trägt `job_liste` keinen `neustartVerdacht` → älter als **2.23.0**
- Kennt `datei_patchen` kein `frontmatter_ergaenzen` → älter als **2.22.0**
- Kennt `datei_patchen` kein `abschnitt_einfuegen`/`tabelle_zeile_einfuegen`/`modi` → älter als **2.21.0**
- Meldet `quelle_erschliessen` kein `erzwungenAutomatisch` → älter als **2.20.0**
- Nimmt `ordner_listen` kein `zusammenfassung`/`maxBytes` → älter als **2.19.0**

**2.26.0 meldet 38 Werkzeuge.** Sagt `bruecke_info` weniger, greift keine der
Regeln, die sich auf die neuen Stücke berufen — dann zuerst die Erweiterung
aus- und wieder einschalten, die Toolliste ist gecacht.

Zweiter Test, wenn die Soll-Liste selbst verdächtig ist: Ein schreibendes
Werkzeug **ohne** `begruendung` aufrufen. Kommt
`Input validation error … path: ["begruendung"]`, läuft serverseitig
mindestens 2.6.0 — auch wenn die Werkzeugbeschreibung das Feld nicht zeigt.
Dann `begruendung` trotzdem mitgeben; die Brücke reicht sie durch.

**Stand 29.08.2026 abends — möglicherweise eine zweite gepflegte Fassung.**
Ein Handover des Plattformteams nennt eine **Repo-Fassung** unter
`.claude/skills/…/SKILL.md`, in die ein Abschnitt „1b-iv — completed heißt
nicht ‚hat geschrieben'" eingetragen worden sei. **Diese Datei ist von einer
Cowork-Session aus nicht einsehbar** — ob es sie gibt, weiß nur, wer auf dem
Rechner nachsieht; Peter kannte sie nicht.

Inhaltlich ist der Punkt hier erledigt: Er steht seit demselben Tag als
**Abschnitt 1d** in dieser Archivfassung, aus dem Handover übernommen. Die
Archivfassung sollte damit nichts vermissen. Falls die Repo-Fassung existiert
und weiter gepflegt wird, gehört trotzdem festgelegt, welche der beiden
führt — zwei gepflegte Originale enden immer gleich.

**Das Original dieses Skills liegt im Archiv**, unter
`Organisation/Skills/archiv-aufraeumen/SKILL.md`. Was in den
Claude-Einstellungen läuft, ist die Ableitung davon. Geändert wird immer zuerst
die Datei im Archiv — am besten mit `datei_patchen`, abschnittsweise —, danach
importiert Peter sie neu. Eine Änderung nur an der importierten Fassung ist beim
nächsten Import verloren, und niemand kann nachlesen, warum sie drinstand.

**Dieser Absatz ist die Falle, die er beschreibt.** Er steht im Original — und
wer mit einer älteren importierten Fassung arbeitet, liest ihn nicht und weiß
deshalb nicht, dass es ein Original gibt. Am 28.08.2026 ist genau das passiert:
Eine Session hat den Skill aus der importierten 397-Zeilen-Fassung
fortgeschrieben und vier Abschnitte verloren, die nur im Archiv standen.
Deshalb gilt: **Wer diesen Skill ändern soll, sieht zuerst unter
`Organisation/Skills/` nach** — mit `ordner_listen`, das kostet einen Aufruf —
und arbeitet auf der Datei, die dort liegt, nicht auf der eigenen. Der Verweis
steht zusätzlich in `HANDOVER.md`, die ohnehin am Anfang jeder Sitzung gelesen
wird; fehlt er dort, gehört er nachgetragen.

Die Probe ist inhaltlich, nicht die Zeilenzahl: Diese Fassung (03.09.2026)
kennt Werkzeugsatz **2.26.0**, die **sechs** Modi von `datei_patchen` und
`erzwingen` als Normalfall-weglassen. Wer in seiner Fassung nur drei Modi
findet, `erzwingen: true` noch als „den Weg" liest oder die 597-Zeilen-Probe
vom 28.08.2026 zitiert, arbeitet mit einer überholten — dann nicht darauf
aufbauen, sondern das Original holen.

**Die Sperre der `_INDEX.md` hat eine Nebenwirkung, die niemand reparieren
kann.** Die Fachwerkzeuge fassen nur ihre eigenen Teile an: `stand_setzen` und
`themen_setzen` das Frontmatter, `erschliessung_block_schreiben` den Block
zwischen den Markern. An die Gliederungstabelle im Body kommt **keins von
ihnen** — wohl aber `datei_patchen` (siehe oben, geprüft am 29.08.2026).

Also: Nach Umzügen und Umbenennungen die Tabelle **selbst nachziehen**, mit
`abschnitt_ersetzen` auf `## Gliederung`, und im selben Zug die „Offenen
Punkte" des Index. Sie stillschweigend veralten zu lassen war nie richtig —
und seit dem 29.08.2026 gibt es auch keine Ausrede mehr dafür.

**`bericht_unvollstaendig` sucht exakte Dateinamen, keine Prosa.** Ein Absatz,
der die Unterlagen beschreibt, schließt den Befund nicht — der Prüfer
vergleicht Zeichenketten. Ihn zu schließen heißt, eine Dateiliste in den
Bericht zu schreiben, und das steht quer zur Regel „Zahlen und Listen nicht an
drei Stellen pflegen". Der Befund ist `info` und blockiert nichts: **bewusst
offen lassen ist eine zulässige Antwort** — dann aber im Ergebnis sagen, dass
er offen bleibt und warum.

**Das Aktions-Protokoll ist lückenhaft gefiltert.** `protokoll_lesen` mit
`folderId` zeigte am 28.08.2026 nur `themen_setzen` — vier `familie_umziehen`
und ein `quelle_erschliessen` im selben Ordner fehlten, vermutlich weil diese
Einträge keine `folderId` tragen. Wenn das Protokoll die Protokoll-Datei im
Archiv ersetzen soll, ist das eine Lücke: im Zweifel ohne `folderId` lesen und
selbst filtern.

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

**`device_bash` kann ausfallen** (lokale VM startet nicht) — oder es gibt gar
kein Gerät, weil die Session in der Cloud läuft. Beides ist für die Archivarbeit
seit 2.9.0 folgenlos: Lesen, Schreiben, Verschieben und Anlegen gehen
vollständig über KnowledgeScout (Regel 1a). Unerreichbar bleiben nur Peters
lokale Werkzeuge — `git log` in den Repos vor allem; `aktuell.py`/`projekte.py`
sind durch `sichten_regenerieren` ersetzt. Fehlt `git log`, wird die
Feature-Chronologie nicht geraten, sondern als offener Punkt benannt.

## Anhänge und Binärdateien

Seit Werkzeugsatz 2.25.0 schreibt die Brücke nicht mehr nur Text.

- **`datei_binaer_anlegen`** — `pfad`, `inhaltBase64` (ohne `data:`-Präfix),
  optional `mimeType`. Der Weg, ein PDF ins Archiv zu legen, ohne es
  abzuschreiben. Wie `datei_anlegen` getrennt von „ändern":
  `nichtUeberschreiben` ist per Vorgabe true, `elternAnlegen` legt fehlende
  Ordner an.
- **`datei_binaer_lesen`** — gibt base64 zurück, **ohne Blätterung**: ein
  halbes PDF ist kein PDF. Sparsam verwenden — base64 bläht um ein Drittel und
  läuft durch den Kontext.
- **Grenze 6 MB.** Darüber kommt `zu_gross` mit Zahlen. Eine Upload-URL für
  große Dateien ist bewusst nicht gebaut — die gehören über die Werkbank oder
  direkt in den Speicher.

**Was damit noch nicht gelöst ist:** Der Microsoft-365-Connector liefert von
einem Mailanhang die **Textextraktion**, nicht die Bytes. Ein Anhang kommt also
nur dann als Datei ins Archiv, wenn seine Bytes auf einem anderen Weg
erreichbar sind. Wo nicht, gilt weiter: Wortlaut übernehmen, Herkunft nennen,
und die Datei in der Liste der offenen Anhänge in
`Organisation/Postfach/DURCHGAENGE.md` stehen lassen.

## Was ausdrücklich NICHT geht

Damit niemand danach sucht oder es sich zusammenbaut (Stand 2.26.0):

- **`bericht_pruefen` gegen `Konventionen.md`** gibt es nicht und ist bewusst
  nicht gebaut: Welche Sätze dieser Datei maschinell prüfbar sind, ist vom
  Code aus nicht zu sehen. Wenn die Regeln benannt werden — je Regel: was ist
  entscheidbar, welcher Befund entsteht bei Bruch —, ist die Umsetzung klein.
  Das ist die nächste Wunschlisten-Zeile, nicht ein Mangel im Werkzeug.
- **Keine `ffprobe`-Vorprüfung vor der Transkription.** Sie gehört in den
  Secretary Service, nicht in KnowledgeScout. Bis dahin gibt es nur die
  Deutung *nachher* (`fehlerDeutung`, `quelle_ohne_ton`).
- **Felder in `_`-Twin-Ordnern von Hand nachtragen** bleibt gesperrt — auch
  die elf leeren `date` in einem Vorhaben. Der Weg führt über
  `transformation_starten` mit korrigiertem Template und ist oft schon durch
  die Pfad-Ableitung (`date_quelle: pfad`) erledigt.

## Was Peter entscheidet

Die Liste ist bewusst kurz. Alles, was nicht darauf steht, entscheidet die
Session selbst — siehe Grundregel 2.

- **Welche Library das Archiv ist** — vor dem ersten Schreibvorgang bestätigen
- Ob eine Datei verworfen wird — `quelle_verwerfen` verschiebt nach
  `zu klären/`, gelöscht wird nie
- Umzüge und Umbenennungen, bei denen die **Zuordnung** strittig ist — also
  wohin etwas inhaltlich gehört, nicht ob der Umzug etwas kostet
- Ob eine Mail als Datei im Terminordner landet oder nur im Bericht
  protokolliert wird
- Die Verifikation der führenden Artefakte, immer
- Die Abnahme eines Vorhabens, immer

**Ausdrücklich NICHT mehr auf dieser Liste:**

- *Kostenpflichtige Jobs.* Werden gestartet, nicht angefragt.
- *Format-Zwillinge.* Im Zweifel **alle** erschließen — nur die führende
  Fassung zu nehmen lässt die übrigen als `source_without_twin` mit Schwere
  `error` stehen und sperrt die Abnahme, und genau das kostet Peter später
  eine zweite Runde. Die Zahlen gehören ins Ergebnis, nicht in eine Frage.
- *Die Vorlage.* `vorlagen_auflisten` sagt, was es gibt; passt nichts, ist
  `nur_transkript` die Antwort — nicht die Rückfrage. Am 29.08.2026 gab es
  für Angebote und Vertragsunterlagen schlicht keine Vorlage; 27 Dokumente
  liefen darum bewusst als reine Extraktion.

Bei Unklarheit im **Inhalt** fragen. Bei Unklarheit im **Verfahren** die
Grundlagen im Archiv lesen und entscheiden.