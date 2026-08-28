# KnowledgeScout — Stand der Schnittstelle

Werkzeugsatz **2.9.0**, 31 Werkzeuge. Geprüft am 28.08.2026 aus einer
Cowork-Sitzung, gegen `Anforderungen: Storage-Abstraktion über MCP` (27.08.2026)
und gegen die Befunde der Sitzungen vom 20.–27.08.

**Alles hier ist belegt** — jede Zeile stammt aus einem tatsächlichen Aufruf
dieser Sitzung, nicht aus der Werkzeugbeschreibung. Wo nur die Beschreibung
vorliegt, steht es dabei.

---

## 1. Kurzfassung

Die Storage-Schicht ist da und sie trägt. Stufe 1 und Stufe 2 der
Anforderungsliste sind bis auf `suchen` gebaut, die Querschnittsanforderungen
Q1–Q3 und Q6 sind erfüllt, und der teuerste Punkt des 27.08. — ganze Dateien
neu schreiben, um eine Zahl zu ändern — ist erledigt.

Zwei Dinge stehen der Arbeit im Weg, beide an derselben Stelle:

1. **Eine `_INDEX.md` lässt sich über die Brücke nicht anlegen und nicht
   pflegen.** Ein neuer Ordner kann seinen Contract nicht bekommen. Blocker.
2. **`verschieben` prüft die Schreibsperre nicht.** Damit ist derselbe Riegel,
   der `datei_patchen` blockiert, in zwei Schritten zu umgehen — mit
   `ueberschreiben: true` auch über einen echten Bearbeitungsstand hinweg.

Punkt 2 ist heute zweimal benutzt worden, um Punkt 1 zu umgehen: Die
`_INDEX.md` in `Organisation/Skills/` ist so entstanden und so gepflegt worden.
Beide Vorgänge stehen mit Begründung im Aktions-Protokoll und sind als
Notbehelf gekennzeichnet.

---

## 2. Soll-Ist gegen die Anforderungsliste

### Adressierung (A1–A4)

| | Anforderung | Stand |
|---|---|---|
| A1 | Jede Antwort liefert Pfad **und** Id | **erfüllt** — auch `ordner_listen` je Eintrag, kein Zweitaufruf mehr nötig |
| A2 | Jedes Werkzeug akzeptiert `pfad` oder `id` | **erfüllt** |
| A3 | Id stabil über Schreibvorgänge | **erfüllt bei OneDrive** — heute über sieben aufeinanderfolgende Patches derselben Datei verifiziert, Id unverändert. Bei Nextcloud sind Ids base64-kodierte Pfade, ein Umzug ändert sie; das wird in `speicher_info` ausdrücklich gesagt. Ein `idGeaendert: {alt, neu}` in der Antwort gibt es nicht — bei Nextcloud wäre es der ehrlichere Weg. |
| A4 | `pfad_aufloesen` als eigene, billige Operation | **erfüllt** |

### Stufe 1 — die Mindestmenge

| Werkzeug | Stand | Beleg aus dieser Sitzung |
|---|---|---|
| `ordner_listen` | **erfüllt** | `limit` ist Pflicht, `weitereVorhanden`, `tiefe`, `muster`; Metadaten je Eintrag |
| `datei_lesen` | **erfüllt** | `bereich: frontmatter` lieferte 518 statt 10.672 Bytes; `bereich: zeilen` half beim Nachzählen |
| `datei_schreiben` | gebaut, heute nicht gebraucht | `datei_patchen` hat es jedes Mal ersetzt — das ist das Ergebnis |
| `datei_patchen` | **erfüllt, alle drei Modi** | `frontmatter_setzen` (+29 B, Body unangetastet), `abschnitt_ersetzen` („4 Zeilen ersetzt durch 11"), `ersetze` („50 Zeichen ersetzt durch 114"); Eindeutigkeitsschutz greift (Abbruch bei 2 Treffern) |
| `stat` | **erfüllt** | Zeitstempel-Vergleich ohne Lesen |
| `loeschen` | **erfüllt** | Papierkorb, 93 Tage, mit Hinweis wo wiederhergestellt wird |

### Stufe 2

| Werkzeug | Stand |
|---|---|
| `datei_anlegen` | **erfüllt** — `nichtUeberschreiben` bricht ab und nennt id/version |
| `ordner_anlegen` | **erfüllt** — `elternAnlegen` legt beide Ebenen an; vorhandener Ordner ist kein Fehler (`neuAngelegt: false`) |
| `verschieben` | erfüllt, **aber ohne Sperrprüfung** — siehe Abschnitt 4.2 |
| `aenderungen_seit` | erfüllt, mit zwei Schwächen — siehe 4.5 |
| `speicher_info` | **erfüllt und vorbildlich** — `null` heißt ausdrücklich „nicht sicher bekannt", die `hinweise` sind provider-spezifisch und richtig |
| `suchen` | **fehlt** |

### Stufe 3 — vollständig offen

`dateien_lesen` (Stapel) · `binaer_lesen` · `kopieren` · `wiederherstellen` ·
`sperren`/`entsperren`. Nichts davon gebaut, nichts davon heute vermisst außer
`wiederherstellen` (siehe Prüfstein 5).

---

## 3. Querschnitt Q1–Q7

| | Stand |
|---|---|
| **Q1** optimistische Sperre | **erfüllt und geprüft.** Absichtlich mit überholter Version geschrieben → `konflikt` mit `aktuelleVersion` **und** vollem `aktuellerInhalt`. Mergen und erneut schreiben ging ohne zweiten Lesevorgang. Genau die Ersparnis, um die es ging. |
| **Q2** begrenzte Antwortgrößen | **erfüllt.** `maxBytes`/`offset`/`gekuerzt` beim Lesen, `limit`/`cursor`/`weitereVorhanden` bei Listen, `maxOrdnerListingsProAufruf: 200` als Zeitlimitschutz. |
| **Q3** Endpunkt liest/schreibt selbst | **erfüllt.** Keine Download-URLs in irgendeiner Antwort. |
| **Q4** Zeitstempel sauber und getrennt | **teilweise.** `trenntInhaltVonMetadaten: true` bei OneDrive ist die Grundlage, um `bericht_veraltet` richtig zu formulieren — ob die Regel das nutzt, ist von hier nicht sichtbar. **Widerspruch:** `speicher_info` meldet `zeitstempelGenauigkeit: "millisekunde"`, aber jeder Zeitstempel aus `stat` und `ordner_listen` endete auf `.000Z` — sekundengenau. Millisekunden kamen nur bei Artefakten aus der eigenen Pipeline. Die Selbstauskunft verspricht hier mehr, als sie liefert. |
| **Q5** einheitliche Fehlerbilder | **teilweise.** `konflikt`, `nicht_unterstuetzt` sind sauber und tragen `wiederholbar`. Aber zwei vorhergesehene Fälle kommen als `code: "unbekannt"`: „Datei existiert bereits" und „`altText` kommt 2-mal vor". Beide haben eine gute deutsche Meldung — die ein Agent parsen müsste, um sie von einem echten Ausfall zu unterscheiden. Fehlend: `existiert_bereits`, `nicht_eindeutig`. |
| **Q6** `begruendung` und Protokoll | **erfüllt, mit beiden Zusatzpunkten.** `kanal: "bruecke"` ist da und trennt Agent von Mensch am Knopf. Fehlversuche nach der Eingabeprüfung stehen mit `status: "fehler"`, `pfad` und Fehlertext drin — die beiden Schutzproben von heute sind vollständig nachlesbar. Nur Schema-Fehlversuche fehlen weiterhin, was in der Antwort selbst gesagt wird. |
| **Q7** Zeitlimit / Job-Modus | **offen.** Kein `jobId`-Modus für lange Storage-Operationen. `twins_pruefen` warnt in der eigenen Beschreibung vor den 60 Sekunden — ehrlich, aber keine Lösung. |

---

## 4. Offen — nach Dringlichkeit

### 4.1 Blocker: `_INDEX.md` ist nicht anlegbar und nicht pflegbar

`datei_anlegen` und `datei_patchen` weisen sie ab (`nicht_unterstuetzt`, Muster
`**/_INDEX.md`). `stand_setzen` sagt in der eigenen Beschreibung „kein
`_INDEX.md` (wird nie angelegt)". `ordner_erstellen` legt nur den Ordner an.
Ergebnis: **ein neuer Ordner kann seinen Contract über die Brücke nie
bekommen**, und ein vorhandener kann in Prosa nie korrigiert werden — nur in
den zwei Feldern, die `stand_setzen` und `themen_setzen` anfassen.

Die Sperre selbst ist richtig. Ihr Zweck ist, dass niemand am
`bearbeitungsstand` und seinen vier Schutzstufen vorbeischreibt. Nur ist sie
heute breiter als ihr Zweck: Sie sperrt auch den Fließtext und das Anlegen.

Drei denkbare Wege:

- `ordner_erstellen` legt die `_INDEX.md` aus der Vorlage mit an (deckt das
  Anlegen ab, nicht das Pflegen)
- `datei_anlegen` darf, wenn die Datei noch nicht existiert
- `datei_patchen` darf mit `abschnitt_ersetzen` und `ersetze`, aber nicht mit
  `frontmatter_setzen` — dann bleibt der Feldkern geschützt und der Fließtext
  pflegbar. **Das wäre die genaueste Lösung.**

### 4.2 Sicherheitslücke: `verschieben` prüft die Sperre nicht

`verschieben` mit Ziel `_INDEX.md` geht durch. Bewiesen: die Datei in
`Organisation/Skills/` ist zweimal so entstanden bzw. gepflegt worden.

Ernster als der Umweg ist die Kombination mit `ueberschreiben: true`: Damit
ließe sich die `_INDEX.md` eines echten Vorhabens samt Bearbeitungsstand
ersetzen — ohne `ifVersion`, ohne die vier Schutzstufen, ohne dass ein
Coverage-Befund entsteht. Der Riegel gehört auf den **Zielpfad** von
`verschieben` (und auf `ueberschreiben` insgesamt) erweitert.

Zu klären: Soll `verschieben` auch das **Wegbenennen** einer `_INDEX.md`
verhindern? Dagegen spricht, dass ein Ordner dann keinen Weg mehr hat, seinen
Contract loszuwerden. Dafür spricht, dass genau das der Umweg von heute war.

### 4.3 `suchen` fehlt

Das einzige Werkzeug aus Stufe 2, das nicht gebaut ist. Bemerkt wird es
spätestens beim Verweis-Audit: „Wo im Archiv wird auf diese Datei verwiesen?"
ist heute nur durch Lesen aller Berichte zu beantworten.

Mit dem Zusatz aus der Anforderungsliste: Die Antwort muss ihren `indexStand`
mitliefern, weil der SharePoint-Index am 27.08. nachweislich hinter dem
Dateistand zurückhing.

### 4.4 Fehlercodes für die vorhergesehenen Fälle

`existiert_bereits` und `nicht_eindeutig` statt `unbekannt`. Klein, aber es
entscheidet, ob ein Agent selbständig weiterarbeiten kann oder raten muss.

### 4.5 `aenderungen_seit` — zwei Schwächen

- **Doppelzählung:** 14 Einträge für sieben Dateien, weil jede Datei einmal je
  Artefakt erscheint (`transcript`, `standard-meeting.de`). Für den gedachten
  Tagesabschluss wäre eine Zeile je Datei mit Artefaktliste die brauchbare Form.
- **`delta: false`** bei beiden Providern: Es wird gescannt (4,5 s für 12
  Ordner), und Gelöschtes bzw. Umbenanntes bleibt unsichtbar. Beides wird in
  der Antwort ehrlich gesagt — aber es heißt, dass der Tagesabschluss einen
  gelöschten Ordner nicht bemerkt.

### 4.6 Binärdateien

`unterstuetzt.binaer: false` bei beiden Providern. `datei_anlegen` und
`datei_schreiben` nehmen UTF-8-Text. Damit ist die Frage vom 27.08. — beliebige
Dateien über die Schnittstelle ins Archiv legen — mit *nein* beantwortet.
Bilder, PDFs und Aufnahmen müssen weiter über OneDrive/Nextcloud direkt.

Hängt an Stufe 3 (`binaer_lesen`) und daran, dass MCP für Binärinhalte einen
Transportweg braucht.

---

## 5. Jenseits der Storage-Schicht — was insgesamt noch fehlt

Diese Punkte sind älter als 2.9.0 und stehen unabhängig davon offen.

### 5.1 Eine ungültige Verifikation erzeugt keinen Befund

**Der schwerwiegendste inhaltliche Punkt.** Im Vorhaben
`2026-09-30 Auftritt Vortragsreihe Brixen` stehen fünf Artefakte mit
Verifikationsstand `ungueltig` — sie warten auf Peter. Der Teilbaum meldet
trotzdem `befundAnzahl: 0` und `bereitZurAbnahme: true`.

Seit ADR 0006 gilt Maschinenarbeit als angenommen, und eine *fehlende*
Verifikation ist zu Recht kein Befund mehr. Aber eine *ungültig gewordene* ist
etwas anderes: Da hat ein Mensch einmal hingesehen, und dann hat sich die
Grundlage geändert. Das gehört in die Ampel — sonst meldet das Archiv „bereit",
während Arbeit für Peter offen liegt.

### 5.2 `PERSONEN.md` als gerechnete Sicht

Anforderung vom 27.08. liegt vor, nicht implementiert: `sichten_regenerieren`
erzeugt neben `AKTUELL.md` und `PROJEKTE.md` eine dritte Sicht aus den
`korrespondenz:`-Feldern aller Berichte. Kein handgepflegtes Register, keine
Fuzzy-Zusammenführung, kein Dossier.

Voraussetzung dafür ist Fleißarbeit im Archiv: Die `korrespondenz:`-Felder sind
heute fast nirgends gefüllt. Für `26.01` sind sechs Namen bekannt.

### 5.3 `transformation_starten` — sofortige Rückgabe ist unbestätigt

Der Skill behauptet seit dem 27.08., der Aufruf antworte sofort mit `jobId`s.
Geprüft ist das nicht, weil dafür ein kostenpflichtiger Job laufen müsste.
Solange es unbestätigt ist, ist es eine Annahme im Regelwerk.

### 5.4 Nextcloud: Lesen bestätigt, Schreiben nicht

`speicher_info` und `ordner_listen` gegen `swaptolearn (nuvola)` laufen sauber,
inklusive korrekter Selbstauskunft (`zeitstempelGenauigkeit: "sekunde"`,
`trenntInhaltVonMetadaten: false`, Ids sind base64-Pfade). **Prüfstein 3 der
Anforderungsliste ist damit halb erfüllt** — derselbe Ablauf gegen Nextcloud
ohne Sonderbehandlung, aber nur lesend.

Offen und wichtig: Trägt `ifVersion` gegen WebDAV-eTags? Die Anforderungsliste
hat das als offene Frage gestellt; sie ist es weiterhin.

### 5.5 `protokoll_lesen` wächst ungefiltert

Heute 12 Einträge, das ist bequem. Filter gibt es nur über `folderId` und
`limit`. Auf Dauer fehlen: Zeitraum, Werkzeug, `status: "fehler"`. Letzteres
ist der interessanteste Filter — abgewehrte Schreibversuche sind das, was man
nachlesen will.

Kleinigkeit: Große Ergebnisse werden mitten im JSON-String abgeschnitten
(`"Ergebnis zu gross fuers Protokoll — gekuerzt"`), sind also nicht mehr
parsebar. Für einen Menschen lesbar genug, für eine Auswertung nicht.

### 5.6 Job-Modus (Q7)

Kein `jobId`-Weg für lange Storage-Operationen. Betrifft rekursives Listen über
große Bäume, `twins_pruefen` ohne Scope und `abdeckung_scannen` auf der Wurzel.

---

## 6. Die sieben Prüfsteine

| | Prüfstein | Stand |
|---|---|---|
| 1 | Eine Zeile ändern, ohne die Datei zu übertragen | **bestanden** — heute siebenmal |
| 2 | Zwei Schreiber, der zweite bekommt einen Konflikt | **bestanden** — mit aktuellem Inhalt in der Antwort |
| 3 | Derselbe Ablauf gegen Nextcloud | **halb** — Lesen ja, Schreiben ungeprüft |
| 4 | 1.100 Unterordner listen ohne Zeitlimit und ohne 180.000 Zeichen | **ungeprüft** — Blätterung und `maxOrdnerListingsProAufruf: 200` sind da, der Lauf fehlt |
| 5 | Löschen **und wiederherstellen** | **halb** — Löschen ja, `wiederherstellen` gibt es nicht (nur über die Oberfläche des Speichers) |
| 6 | Nach jedem Schreibvorgang über dieselbe Id wiederfinden | **bestanden bei OneDrive** — sieben Versionen, Id unverändert |
| 7 | Vom Handy arbeiten, während der Desktop aus ist | **offen** — heute lief die Brücke wieder über den Desktop; der Web-Zugang ist der eigentliche Prüfstein |

---

## 7. Reihenfolge, wenn zu priorisieren ist

1. **`_INDEX.md` pflegbar machen** (4.1) — ohne das steht Ordnerarbeit.
2. **Sperre auf `verschieben`** (4.2) — solange die Lücke offen ist, ist die
   Sperre eine Empfehlung, keine Sperre.
3. **Ungültige Verifikation als Befund** (5.1) — falsche Grün-Meldungen sind
   schlimmer als fehlende Werkzeuge.
4. **Fehlercodes** (4.4) — eine Stunde Arbeit, macht Agenten selbständiger.
5. **`suchen`** (4.3).
6. Der Rest nach Bedarf.
