# Anforderungen: Storage-Abstraktion über MCP

Entwurfsgrundlage für einen MCP-Endpunkt, der die KnowledgeScout-Storage-Schicht
(OneDrive, Nextcloud, …) für Agenten zugänglich macht.

Geschrieben am 27.08.2026 aus einer Cowork-Sitzung am Vorhaben
`26.01 Klimamassnahmen Südtirol`. **Jede Anforderung hat einen Beleg aus dieser
Sitzung** — es ist keine Wunschliste, sondern die Summe dessen, was heute
gefehlt oder Geld gekostet hat.

---

## 0. Warum überhaupt

Heute lief der Dateizugriff über zwei getrennte Wege:

- **Microsoft Graph** (Cloud, funktioniert auch vom Handy) — konnte lesen,
  ganze Dateien überschreiben, löschen, suchen. Kein Patch, keine Sperre.
- **Die Datei-Bridge zum Desktop** — konnte alles, aber nur solange der Rechner
  läuft.

Beides kennt nur OneDrive. Nextcloud-Bibliotheken (`swaptolearn (nuvola)`,
`cast (cast.nextdive)`, `Tamera`, `Pluriversum`) waren von hier aus
unerreichbar, obwohl KnowledgeScout sie längst bedient. Eine Storage-Schicht
über MCP löst beides auf einmal: **ein Zugang, alle Provider, unabhängig davon,
ob ein Desktop läuft.**

**Voraussetzung, ohne die nichts davon trägt:** Der Endpunkt muss erreichbar
deployt sein, nicht auf `localhost:3000`. Sonst verschiebt sich das Problem nur.

---

## 1. Das Adressierungsproblem — vor allen Werkzeugen zu klären

Heute hat `stand_setzen` die `_INDEX.md` **ersetzt statt geändert**. Die Datei
bekam eine neue itemId, mein nächster Schreibversuch lief in ein `NOT_FOUND`,
und ich musste den Pfad neu auflösen. (Inzwischen behoben — aber die Lehre
bleibt.)

**Anforderungen:**

- **A1** Jede Antwort liefert **Pfad UND Id**. Nie nur eines.
- **A2** Jedes Werkzeug akzeptiert **beides** als Adresse (`pfad` oder `id`).
- **A3** Die Id ist **stabil über Schreibvorgänge**. Ändert sie sich
  provider-bedingt doch, meldet die Antwort das ausdrücklich
  (`idGeaendert: { alt, neu }`), statt den Aufrufer auflaufen zu lassen.
- **A4** Ein `pfad_aufloesen(pfad) → id` gibt es als eigenständige Operation —
  billig, ohne Inhalt zu lesen.

---

## 2. Werkzeuge

Aufgeteilt in drei Stufen. **Stufe 1 ist die Mindestmenge** — damit lässt sich
das nachbauen, was heute lief.

### Stufe 1 — ohne die geht nichts

#### `ordner_listen`

Verzeichnisinhalt mit Metadaten.

| Parameter | |
|---|---|
| `pfad` \| `id` | Adresse |
| `rekursiv` | `false` (Vorgabe) oder Tiefe als Zahl |
| `muster` | optionaler Glob (`*.md`, `_*/`) |
| `limit`, `cursor` | Blätterung, **Pflicht** |

Rückgabe je Eintrag: `name`, `pfad`, `id`, `typ` (datei/ordner), `groesse`,
`geaendertAm`, `version`.

*Beleg:* Ich habe heute viermal einen Ordner gelistet, nur um eine itemId zu
finden. Ohne Metadaten in der Liste braucht man pro Datei einen zweiten Aufruf.

#### `datei_lesen`

| Parameter | |
|---|---|
| `pfad` \| `id` | |
| `bereich` | optional: `frontmatter`, `abschnitt: "<Überschrift>"`, `zeilen: [von, bis]` |
| `maxBytes`, `offset` | **Pflicht-Absicherung**, Vorgabe z. B. 256 kB |

Rückgabe: `inhalt`, `pfad`, `id`, `version`, `geaendertAm`, `groesse`,
`gekuerzt: true/false`.

*Beleg:* Um im Bericht ein Frontmatter-Feld zu prüfen, musste ich heute 10 kB
lesen. `bereich: frontmatter` hätte 300 Bytes gebraucht.

#### `datei_schreiben`

Ganze Datei ersetzen.

| Parameter | |
|---|---|
| `pfad` \| `id` | |
| `inhalt` | UTF-8 Text (binär siehe Stufe 3) |
| `ifVersion` | **Pflichtfeld, kein optionales** — siehe Abschnitt 3 |
| `anlegenWennFehlt` | Vorgabe `false` |
| `begruendung` | wie bei den Fachwerkzeugen ab 2.6.0 |

#### `datei_patchen` — **das wichtigste Werkzeug**

Teiländerung ohne Vollübertragung. Mindestens drei Modi:

- `ersetze: { altText, neuText }` — `altText` muss **genau einmal** vorkommen,
  sonst Fehler. (Wie `str_replace`; die Eindeutigkeit ist der Schutz.)
- `abschnitt_ersetzen: { ueberschrift, neuerInhalt }` — Markdown-Abschnitt bis
  zur nächsten gleichrangigen Überschrift.
- `frontmatter_setzen: { feld: wert, … }` — Body bleibt unangetastet.

Alle mit `ifVersion`.

*Beleg — der teuerste Punkt des Tages:* Ich habe `BERICHT.md` (10,7 kB) und
`_INDEX.md` (8,6 kB) **achtmal komplett neu geschrieben**, meist weil sich eine
einzige Zahl geändert hatte. Rund 80 kB Übertragung für vielleicht 400 Bytes
echte Änderung. Mit `datei_patchen` wäre das ein Bruchteil — und der Grund,
warum der Nutzer sich beschwert hat, es dauere ewig.

#### `stat`

Nur Metadaten: `geaendertAm`, `groesse`, `version`, `id`, `existiert`.

*Beleg:* Die Regeln `bericht_veraltet` und `verweis_veraltet` vergleichen
Zeitstempel. Dafür Dateien zu lesen ist Verschwendung.

#### `loeschen`

| Parameter | |
|---|---|
| `pfad` \| `id` | |
| `inPapierkorb` | Vorgabe **`true`** |
| `begruendung` | |

Hartes Löschen nur mit ausdrücklichem `endgueltig: true`, und das sollte der
Endpunkt für Archiv-Bibliotheken abschalten können.

*Beleg:* Archiv-Grundregel „Gelöscht wird nie". Als ich heute
`ORDNUNGSZUSTAND.md` entfernt habe, war die Rückmeldung „im Papierkorb, 93 Tage
wiederherstellbar" — genau die Zusicherung, die es braucht.

### Stufe 2 — für alles, was über Lesen und Schreiben hinausgeht

#### `datei_anlegen`
`pfad`, `inhalt`, `nichtUeberschreiben: true` (Vorgabe). Getrennt von
`datei_schreiben`, damit „neu" und „ändern" nicht verwechselt werden.

#### `ordner_anlegen`
`pfad`, `elternAnlegen: true/false`.

#### `verschieben`
`von`, `nach`, `ueberschreiben: false`. Deckt Umbenennen mit ab (gleicher
Elternordner, neuer Name).

**Wichtig:** Diese Schicht kennt **keine Twin-Familien**. Die Familien-Regel
(Quelle und `_`-Ordner ziehen gemeinsam um) bleibt in `familie_umziehen` eine
Ebene darüber und ruft `verschieben` zweimal auf.

#### `suchen`
`begriff`, `in` (Pfad-Präfix), `feld` (name/inhalt), `typ`, `geaendertNach`,
`limit`, `cursor`.

*Beleg:* Der SharePoint-Index hing heute hinter dem Dateistand zurück — eine
frisch geschriebene Datei war über die Suche nicht auffindbar. Die Antwort
sollte deshalb ihren **Indexstand** mitliefern (`indexStand: <Zeitpunkt>`),
damit der Aufrufer weiß, ob er der Suche trauen darf.

#### `aenderungen_seit`
`pfad`, `seit` oder `cursor` → geänderte Einträge mit `geaendertAm`.
Provider-Delta, wo es eines gibt; sonst Verzeichnis-Scan.

*Beleg:* Genau dieser Aufruf hat heute die Twin-Läufe vom 25./26.08 sichtbar
gemacht, die niemand angeordnet hatte. Ohne ihn wäre der Ordner falsch
berichtet worden.

#### `speicher_info`
Ohne dieses Werkzeug kann ein Agent nicht sicher arbeiten:

- `provider` (onedrive / nextcloud / …), `wurzel`
- `grossKleinSchreibungRelevant` (OneDrive nein, Nextcloud meist ja)
- `pfadLimit` in Zeichen — die Konventionen rechnen mit ≈ 347, weil `_`-Ordner
  den Dateinamen im Pfad verdoppeln
- `maxDateigroesse` (heute im Spiel: eine 135-MB-Aufnahme, ein 7,15-GB-Video)
- `papierkorbVorhanden`, `aufbewahrungTage`
- `unterstuetzt`: `patch`, `ifVersion`, `delta`, `binaer`
- `unicodeNormalisierung` (NFC/NFD)
- `zeitstempelGenauigkeit`

*Beleg:* Umlaute in jedem zweiten Pfad („4. Ökosozialer Aktivismus",
„Klimamaßnahmen heute.docx"). OneDrive und Nextcloud normalisieren
unterschiedlich — ein Agent, der das nicht weiß, sucht Dateien, die da sind.

### Stufe 3 — später, aber jetzt mitdenken

- **`dateien_lesen` (Stapel)** — mehrere Pfade in einem Aufruf. Heute hätte ich
  `BERICHT.md` + `_INDEX.md` + `ORDNUNGSZUSTAND.md` gern zusammen geholt.
- **`binaer_lesen`** mit `range` — für Bilder und PDF-Seiten. Nicht die ganze
  Datei durch den Kanal ziehen.
- **`kopieren`**
- **`wiederherstellen`** aus dem Papierkorb (`id`, `nachPfad`)
- **`sperren` / `entsperren`** — nur wenn der Provider es kann; sonst reicht
  `ifVersion`.

---

## 3. Querschnittsanforderungen

Diese wiegen schwerer als jedes einzelne Werkzeug.

### Q1 — Optimistische Sperre, nicht optional

Jede schreibende Operation nimmt `ifVersion`. Stimmt die Version nicht, kommt
**ein Konfliktfehler mit dem aktuellen Inhalt und der aktuellen Version in der
Antwort** — damit der Aufrufer mergen und erneut schreiben kann, ohne noch
einmal zu lesen.

*Beleg:* In derselben Library lief heute um 12:07 ein fremder Audio-Job, und am
25./26.08 wurden Twins von unbekannter Seite neu geschrieben. Ich habe
denselben Ordner mehrfach überschrieben, **ohne jede Absicherung** — dass
nichts verloren ging, war Glück. Dazu kam ein `eTag mismatch` beim Jobstart,
der beim zweiten Versuch durchging: Der Provider erzwingt so etwas ohnehin, nur
unsauber.

### Q2 — Antwortgrößen sind begrenzt, immer

Kein Werkzeug darf unbegrenzt zurückgeben. Jede Leseoperation kennt `maxBytes`
und `offset` und meldet `gekuerzt`. Jede Liste kennt `limit` und `cursor` und
meldet `weitereVorhanden`.

*Beleg:* `abdeckung_scannen` liefert auch bei gesetztem `folderId` den
kompletten Report — rund **180.000 Zeichen**, viermal an einem Tag, für jeweils
sieben relevante Zeilen. Das ist der Fehler, den die Storage-Schicht nicht
wiederholen darf.

### Q3 — Der Endpunkt liest und schreibt selbst

Keine Antwort, die eine Download-URL zurückgibt, welche der Aufrufer dann holen
soll. Agenten dürfen URLs nicht eigenständig abrufen — eine solche Antwort ist
für sie wertlos.

### Q4 — Zeitstempel sauber und getrennt

`geaendertAm` in UTC mit Millisekunden. Und wenn der Provider es hergibt:
**Inhaltsänderung getrennt von Metadatenänderung.**

*Beleg:* Ein reiner Verifikationsklick hat heute `bericht_veraltet` ausgelöst
und mich zu einem 10-kB-Rewrite gezwungen, obwohl sich inhaltlich nichts
geändert hatte. Wer beides unterscheiden kann, kann solche Regeln richtig
formulieren.

### Q5 — Einheitliche Fehlerbilder über alle Provider

`nicht_gefunden` · `konflikt` (mit aktueller Version) · `zu_gross` ·
`pfad_zu_lang` · `kein_zugriff` · `nur_lesen` · `gesperrt` ·
`nicht_unterstuetzt` (Provider kann diese Operation nicht) · `zeitueberschreitung`

Der Aufrufer soll aus dem Fehler ablesen können, **ob ein zweiter Versuch Sinn
hat** — beim eTag-Konflikt ja, bei `pfad_zu_lang` nie.

### Q6 — `begruendung` auch hier

Konsistent mit Werkzeugsatz 2.6.0: Jede schreibende Storage-Operation trägt das
Pflichtfeld und landet im Aktions-Protokoll. Sonst entsteht ein zweiter,
unprotokollierter Schreibweg neben den Fachwerkzeugen — und das Protokoll
verliert genau die Vollständigkeit, für die es gebaut wurde.

Zwei Dinge, die dabei heute aufgefallen sind und gleich mitgelöst gehören:

- Der `akteur` im Protokoll ist die Person, auch wenn ein Agent über die Brücke
  gehandelt hat. Ein `kanal`-Feld (`werkbank` / `bruecke`) trennt das.
- Fehlversuche, die schon an der Schema-Prüfung scheitern, tauchen nicht auf.
  Bei der Storage-Schicht wären das genau die interessanten Fälle.

### Q7 — Zeitlimit

Jeder Aufruf hat ein hartes Limit (die Brücke: 60 s). Operationen, die länger
dauern können — großer rekursiver Scan, Kopie großer Dateien — brauchen einen
Job-Modus mit `jobId` statt zu blockieren.

*Beleg:* `transformation_starten` wartete ~36 s je Datei und riss bei Stapeln
das Limit. Bei einem rekursiven Listen über 1.100 Ordner passiert dasselbe.

---

## 4. Was NICHT in diese Schicht gehört

Die Abgrenzung entscheidet, ob die Abstraktion trägt:

| Gehört **nicht** hierher | Bleibt bei |
|---|---|
| Twin-Familien, `_`-Ordner-Logik | `familie_umziehen`, `twins_*` |
| `bearbeitungsstand`, Schutzstufen | `stand_setzen` |
| Befunde, Abdeckung, Ampel | `abdeckung_*` |
| Templates, Transformationen, Jobs | `transformation_starten` u. a. |
| Semantik des Frontmatters | Fachwerkzeuge — die Storage-Schicht kennt nur „Frontmatter ist der YAML-Block oben" |

Die Fachwerkzeuge **rufen** die Storage-Schicht auf. Sie bilden sie nicht nach,
und sie umgehen sie nicht.

---

## 5. Prüfsteine für den fertigen Endpunkt

Wenn das Folgende geht, ist die Schicht brauchbar:

1. Eine Zeile in `BERICHT.md` ändern, ohne die Datei zu übertragen.
2. Von zwei Sitzungen gleichzeitig dieselbe Datei schreiben — die zweite
   bekommt einen Konflikt, keine stille Überschreibung.
3. Denselben Ablauf gegen eine Nextcloud-Bibliothek fahren wie gegen OneDrive,
   ohne eine Zeile Sonderbehandlung.
4. Einen Ordner mit 1.100 Unterordnern listen, ohne ins Zeitlimit zu laufen und
   ohne 180.000 Zeichen zurückzugeben.
5. Eine Datei löschen und wiederherstellen.
6. Nach jedem Schreibvorgang die Datei über **dieselbe Id** wiederfinden.
7. Vom Handy aus arbeiten, während der Desktop aus ist.

---

## 6. Offene Fragen an den Entwurf

- **Ein Endpunkt oder zwei?** Storage neben den Fachwerkzeugen im selben
  MCP-Server, oder getrennt? Getrennt wäre sauberer, verdoppelt aber
  Authentifizierung und Deployment.
- **Wer darf schreiben?** Wenn die Storage-Schicht generisch schreiben kann,
  kann ein Agent an `stand_setzen` vorbei den `bearbeitungsstand` ändern. Ist
  das über einen Schreibschutz auf Pfadmustern (`_INDEX.md`) zu verhindern, oder
  über getrennte Rechte?
- **Bibliothek oder Pfad als Wurzel?** Heute adressiert alles über
  `libraryId`. Soll die Storage-Schicht dieselbe Klammer verwenden oder eine
  eigene Wurzel-Kennung?
- **Nextcloud-Identität:** OneDrive hat stabile itemIds, WebDAV hat Pfade und —
  je nach Server — `fileid` im PROPFIND. Trägt das für A3, oder ist bei
  Nextcloud der Pfad die einzige belastbare Adresse?
- **Konflikterkennung bei Nextcloud:** eTags über WebDAV sind vorhanden, aber
  nicht überall verlässlich. Reicht `If-Match`, oder braucht es einen eigenen
  Versionszähler in der Datenbank?
