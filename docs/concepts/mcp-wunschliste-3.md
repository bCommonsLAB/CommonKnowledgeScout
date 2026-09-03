# Wunschliste 3 — was zwei Cowork-Sitzungen an der Brücke gefunden haben

Stand 03.09.2026. **Fünfzehn der sechzehn Punkte sind umgesetzt** — was offen
blieb und warum, steht in §8. Die Welle lief über die Werkzeugsatz-Versionen
**2.18.0–2.25.0**; nach dem Zusammenlauf mit der Korrekturauftrag-Welle steht
die Brücke bei **2.26.0** (38 Werkzeuge).

Kurzfassung zum Übernehmen in die Cowork-Skills:
[`2026-09-03-cowork-werkzeugsatz-2-26.md`](../handover/2026-09-03-cowork-werkzeugsatz-2-26.md).

Dritte Runde nach den beiden Pilot-Wunschlisten (21./22.08., umgesetzt) und
den Storage-Anforderungen vom 27.08. ([`mcp-storage-anforderungen.md`](mcp-storage-anforderungen.md),
Stand dazu in [`mcp-storage-stand.md`](mcp-storage-stand.md)).

Zwei Quellen, die verschiedene Dinge sehen:

- **Sitzung A — Fortschreiben.** Drei Wochendurchgänge am Bericht
  `26.08 Archiv Aufräumen mit claude cowork - KS Mcp`. Der erste längere Lauf,
  bei dem die Brücke nicht zum Aufräumen, sondern zum **Fortschreiben** eines
  bestehenden Dokuments benutzt wurde. Die Befunde betreffen das Schreiben.
- **Sitzung B — Erschließen im Großen.** Rund 250 Jobs über mehrere
  Vorhabensordner, bibliotheksweit 1.440 Befunde gemessen. Die Befunde
  betreffen den Betrieb und das, was der Scan **nicht** sieht.

**Zwei Spalten, bewusst getrennt:** *Beleg* ist, was in der Sitzung passiert
ist — Zahlen aus dem Lauf. *Im Code* ist, was beim Nachsehen im Repository
tatsächlich dasteht. Wo beides auseinandergeht, steht es da.

---

## 0. Was trägt — und nicht angefasst werden soll

Drei Entscheidungen aus den früheren Runden haben sich unter Last bewährt:

- **`ifVersion` als Pflicht.** Rund 40 Schreibvorgänge über drei Sitzungen,
  kein einziger verschluckter Konflikt. Der Zwang, vorher zu lesen, ist kein
  Umweg, sondern der Grund, warum niemand fremde Arbeit überschrieben hat.
- **`begruendung` plus Aktions-Protokoll.** Dieser Durchgang ist ohne eigene
  Protokolldatei nachvollziehbar — das Protokoll trägt die Chronologie.
- **`bereich: frontmatter` beim Lesen.** Bei acht Berichten je Woche
  entscheidet es über die Machbarkeit, nicht über die Bequemlichkeit.

Das ist der Maßstab für alles Folgende: Ein neuer Modus, der `ifVersion`
umgeht oder ohne `begruendung` schreibt, wäre ein Rückschritt, kein Wunsch.

---

## 1. Die Liste in einem Blick

| Nr | Wunsch | Beleg aus der Sitzung | Im Code heute | Aufwand |
|---|---|---|---|---|
| W1 | `abschnitt_einfuegen` (`vor`/`nach` einer Überschrift) | Jeder Wochenabschnitt läuft als `ersetze` auf `"## Verweise"` — die Überschrift wird mitgeschickt, nur um sie zu erhalten | **umgesetzt (2.21.0)** — `abschnitt_einfuegen` mit `vor`/`nach` | klein |
| W2 | `tabelle_zeile_einfuegen` | Eine Chronologie-Zeile kostet das Neuschreiben der ganzen Tabelle | **umgesetzt (2.21.0)** — mit Eindeutigkeitsschutz | klein |
| W3 | `frontmatter_setzen` mit Listen + `ergaenzen` | `korrespondenz:` ist das Feld, das diese Auswertung wöchentlich pflegt | **umgesetzt (2.22.0)** — `frontmatter_ergaenzen`, Flow-Form | mittel |
| W4 | Mehrere Änderungen in **einem** Aufruf | Ein Bericht braucht drei Aufrufe für eine logische Änderung — über zwanzig je Woche | **umgesetzt (2.21.0)** — `modi: [...]`, alles oder nichts | mittel |
| W5 | `ordner_listen`: `maxBytes`/`offset` + `zusammenfassung` | `tiefe: 2` auf Klimagesetz = 78.634 Zeichen; der Ordner ist bis heute ungeprüft | **umgesetzt (2.19.0)** — `maxBytes` + `zusammenfassung` | klein |
| W6 | Binärdateien lesen/schreiben | Zwölf Anhänge liegen nach drei Wochen weiter im Postfach | **Stufe 1 umgesetzt (2.25.0)**; Upload-URL offen | groß |
| W7 | `job_abbrechen` | Eine Job-Leiche steht seit dem 29.08. auf `running`; `jobs_aufraeumen` räumt sie nicht ab | **umgesetzt (2.23.0)** — `job_abbrechen` | klein |
| W8 | Crash-Recovery statt 30-Minuten-Reaper | Server-Neustart 12:45 — alle sechs Slots verstummten binnen einer Minute; zweimal 30 Minuten Stillstand an einem Tag | **umgesetzt (2.23.0)** — Verdacht in `job_liste` | mittel |
| W9 | Alt-Format-Familien selbst erkennen | 60 von 250 Jobs brauchten `erzwingen: true`; in `23.12` **alle 16** Quellen | **umgesetzt (2.20.0)** — Erkennung serverseitig | mittel |
| W10 | `date` aus dem Pfad ableiten | ~360 von 1.440 Befunden bibliotheksweit; in `24.09` 54 von 66 | **umgesetzt** — Ableitung + `date_quelle: pfad` | mittel |
| W11 | Befund `quelle_ohne_ton` | Sieben Bildschirmaufnahmen scheiterten reproduzierbar; bei zweien **halluzinierte** eine frühere Transkription | **teilweise (2.24.0)** — Deutung ja, Vorprüfung gehört in den Secretary | mittel |
| W12 | Befund `quelle_verschwunden` | 15 Fälle: MongoDB kennt Quelle und Transkript, der Storage sagt „nicht gefunden" | **umgesetzt** — `quelle_verschwunden`, beide Scopes | mittel |
| W13 | `bericht_pruefen` gegen `Konventionen.md` | Es gibt die Konventionen, aber nichts, was einen Bericht dagegen prüft | **offen, bewusst** — siehe §8 | groß |
| W14 | Schattenordner: elf leere `date`-Felder nachtragbar machen | Bei „Better Writer" nicht nachzutragen | **keine Codeänderung** — Entscheidung, siehe §7 | — |
| W15 | Reihenfolge-Regel in die Werkzeugbeschreibung (G11) | `23.07` nach dem Erschließen umbenannt: 23 Familien `twin_stale`. `25.07` vorher: 28 Umbenennungen, **null** | **umgesetzt (2.18.0)** — stand nur im Skill | trivial |
| W16 | Dreiklang import→repair→export in `quelle_erschliessen` | `twins_synchronisieren` adoptierte ~90 Quellen, die der Scan sonst als unerschlossen gemeldet hätte | **umgesetzt (2.18.0)** — dito | trivial |

---

## 2. Schreiben — vier Lücken an derselben Stelle

Alle vier betreffen `datei_patchen`. Sie sind kein Zufall: Das Werkzeug wurde
für **Korrekturen** gebaut („eine Zahl ändert sich"), benutzt wird es zum
**Fortschreiben** („eine Woche kommt dazu"). Anhängen ist etwas anderes als
Ersetzen, und das Werkzeug kennt nur Ersetzen.

**W1/W2 — Einfügen relativ zu einer Marke.** Heute wird ein neuer
Wochenabschnitt als `ersetze` auf `"## Verweise"` geschrieben: Die
Überschrift wandert als `altText` hin und als Teil von `neuText` zurück, nur
damit sie stehen bleibt. Das funktioniert, ist aber ein Ritual — und es
verschiebt die Eindeutigkeitsprüfung auf einen Text, den niemand ändern
wollte. Ein `abschnitt_einfuegen` mit `vor`/`nach` hätte **dieselbe**
Schutzwirkung (die Überschrift muss genau einmal vorkommen), ohne den Umweg.
`tabelle_zeile_einfuegen` ist derselbe Gedanke eine Ebene tiefer: eine Zeile
an eine Markdown-Tabelle anfügen, ohne die Tabelle zu übertragen.

**W3 — `frontmatter_setzen` kann keine Listen.** Das Schema nimmt
`string | number | boolean`; der Kommentar sagt ausdrücklich „Keine
Listen/Objekte". Der Grund ist gut (die Zeilen-Chirurgie garantiert, dass der
Parser den Wert unverändert zurückliest). Nur ist `korrespondenz:` genau das
Feld, das diese Auswertung wöchentlich pflegt. Der Ausweg über `ersetze` auf
den exakten Zeilenwortlaut **prüft nichts auf Dubletten** — zwei Wochen mit
demselben Ansprechpartner erzeugen zwei Einträge, und niemand merkt es.
Gewünscht ist weniger als volle Listen-Unterstützung: ein `ergaenzen` mit
normalisiertem Vergleich, das einen vorhandenen Eintrag erkennt und dann
nichts tut.

> **Nachgemessen (03.09.), und es ändert den Zuschnitt:** Der Parser dieses
> Repositories kennt gar keine YAML-Listen. Die Blockform (`feld:` plus
> `  - a`) liest er als **leeren String** zurück — die Einträge wären für
> KnowledgeScout schlicht weg. Die Flow-Form (`feld: [a, b]`) liest er als
> Rohstring. Nur die Flow-Form kommt durch dieselbe Rückprobe wie die
> Skalar-Felder, deshalb schreibt `frontmatter_ergaenzen` ausschließlich sie.
> Ein Feld, das heute in Blockform dasteht, wird nicht angefasst, sondern
> gemeldet: es stillschweigend umzuschreiben wäre genau die Änderung an
> fremden Zeilen, gegen die es diese Chirurgie gibt.

**W4 — Stapel.** Drei Aufrufe für eine logische Änderung, über zwanzig je
Woche. Ein `modi: [...]`, das alle Teiländerungen einer Datei gemeinsam
anwendet und **gemeinsam** verwirft, wenn eine davon nicht eindeutig trifft —
das ist zugleich der bessere Schutz: Heute kann Änderung 1 sitzen und
Änderung 3 scheitern, und die Datei steht halb fortgeschrieben da.

---

## 3. Lesen — `ordner_listen` fällt bei großen Ordnern aus

`tiefe: 2` auf den Klimagesetz-Ordner ergab 78.634 Zeichen. Der Ordner ist
deswegen **bis heute ungeprüft** — nicht, weil etwas kaputt wäre, sondern
weil die Antwort nicht durch das Fenster passt.

Der Befund ist besonders ärgerlich, weil die Lösung nebenan schon liegt:
`datei_lesen` hat `maxBytes` (Vorgabe 256 kB), `offset`, `gekuerzt` und
`naechsterOffset`. `ordner_listen` hat `limit`/`cursor` — das begrenzt die
**Zahl** der Einträge, nicht die **Größe** der Antwort. Bei tiefen Läufen ist
die Größe die bindende Grenze.

Dazu ein `zusammenfassung: true`, das je Unterordner nur Anzahl, Gesamtgröße
und jüngstes Änderungsdatum liefert. Für die Frage „wo liegt überhaupt
Arbeit?" ist die Namensliste Ballast — und genau diese Frage steht am Anfang
jedes Durchgangs.

---

## 4. Binärdateien — die einzige echte Lücke

Zwölf Anhänge liegen nach drei Wochen weiter im Postfach, weil die Brücke sie
nicht ins Archiv bekommt. Die Storage-Schicht ist durchgehend Text: gelesen
wird mit `blob.text()`, geschrieben als `text/markdown`.

Die „Abschrift" ist kein Ersatz. Sie trägt für ein Protokoll — sie trägt
nicht für ein PDF-Layout und nicht für eine PEC-Vertragsunterlage, wo das
Dokument selbst der Beleg ist.

Vorgeschlagener Zuschnitt, in zwei Stufen:

1. **base64 für kleine Dateien** — mit hartem Größendeckel und dem
   vorhandenen `zu_gross`-Fehlerbild darüber. Deckt Anhänge aus dem Postfach
   ab, die typische Größe.
2. **Upload-URL-Verfahren für große** — der Aufruf gibt eine kurzlebige
   Zieladresse zurück, der Client lädt daran vorbei hoch. Das braucht die
   Storage-Schicht ohnehin, sobald jemand ein Video ablegen will; heute
   stünde jede solche Übertragung im 60-Sekunden-Limit.

---

## 5. Betrieb — die Jobs

**W7 — die Leiche.** Ein Job steht seit dem 29.08. auf `running`.
`jobs_aufraeumen` räumt ihn nicht ab: Das Werkzeug greift bewusst nur bei
eigenen Jobs **derselben** Library und nur ohne Lebenszeichen — drei Grenzen,
die genau richtig sind, solange ein *laufender* Job gemeint ist. Für einen
Job, den der Mensch **ausdrücklich** beenden will, fehlt der Griff. Das ist
kein zweiter Reaper, sondern eine andere Frage: nicht „steht das still?",
sondern „ich will das nicht mehr".

**W8 — Crash-Recovery.** Beim Server-Neustart um 12:45 verstummten alle sechs
Slots *innerhalb einer Minute*. `job_liste` sagte dazu „nichts zu tun außer
warten" — und das war **falsch**: Es gab nichts mehr, worauf zu warten war,
der Prozess war weg. Das Muster ist maschinell eindeutig und vom Normalfall
unterscheidbar: Ein arbeitender Job schweigt minutenlang, aber sechs Jobs
verstummen nicht gleichzeitig. Kosten des Ist-Zustands an diesem einen Tag:
zweimal 30 Minuten Stillstand.

**W9 — Alt-Format selbst erkennen.** Von 250 Jobs brauchten 60 `erzwingen:
true`, ein Viertel; in `23.12` traf es *alle 16* Quellen. Die Konstellation
ist maschinell eindeutig — eine Familie mit Transformation, aber ohne
Transkript. Der Parameter existiert und seine Beschreibung benennt genau
diesen Fall; der Agent muss trotzdem raten, wann er ihn setzt. Rät er falsch,
meldet der Job `completed` **und schreibt nichts** — die Meldung lügt. Das
ist der teuerste Punkt der Liste: Er kostet nicht Zeit, er kostet Vertrauen
in die Statusmeldung.

---

## 6. Befunde — was der Scan heute nicht sieht

**W10 — `date` aus dem Pfad.** Rund 360 von 1.440 Befunden bibliotheksweit
sind fehlende `date`-Felder; in `24.09` sind es 54 von 66. In fast allen
Fällen **steht das Datum im Ordnernamen**: `2025-07-16 Besprechung mit
Jonas`. Das Template bekommt den Pfad als `pathHints` und ignoriert ihn.
Fällt `date` aus, könnte der Server es aus dem Pfad setzen und die Herkunft
mit `date_quelle: pfad` ausweisen — nicht stillschweigend, sondern belegt.
Das ist kein Verstoß gegen „nichts erfinden": Ein Datum aus dem Ordnernamen
ist eine Ableitung mit Beleg, keine Erfindung.

**W11 — `quelle_ohne_ton`.** Sieben Bildschirmaufnahmen scheiterten
reproduzierbar an `ffmpeg -vn` — sie haben keine Tonspur. Ein `ffprobe`
vorher klärt das in zwei Sekunden; im Repository gibt es keinen einzigen
`ffprobe`-Aufruf. Der schwerwiegende Teil ist ein anderer: **Bei zweien hat
eine frühere Transkription stattdessen halluziniert** — chinesische
Phantomsätze, die für jeden Scan gültig aussehen. Das ist der einzige Punkt
dieser Liste, bei dem heute *falscher Inhalt* im Archiv steht, der von
richtigem nicht zu unterscheiden ist. Die Vorprüfung ist deshalb nicht nur
eine Ersparnis, sondern der Riegel davor.

> **Nachgesehen (03.09.):** `ffmpeg` und `ffprobe` kommen in diesem
> Repository nicht vor — die Extraktion macht der **Secretary Service**. Die
> Vorprüfung selbst ist dort zu bauen, nicht hier. Was hier ging und gebaut
> ist: `job_status` deutet den Fehlschlag jetzt (`fehlerDeutung`), sagt, dass
> ein zweiter Versuch dieselbe Wand trifft, und warnt vor einem bereits
> vorhandenen Transkript dieser Quelle. Das macht sieben rätselhafte
> Fehlschläge zu einem verstandenen — den Riegel ersetzt es nicht.

**W12 — `quelle_verschwunden`.** 15 Fälle: MongoDB kennt Quelle und
Transkript, der Storage sagt „Datei nicht gefunden". Der Sync findet sie
nicht (sie sind nicht im Storage), der Scan meldet sie als behebbar — die
Wahrheit kommt erst heraus, wenn zwölf Jobs gleichzeitig fehlschlagen. Dem
Verweis-Audit fehlt diese Richtung: Es prüft Verweise aus Dokumenten in den
Storage, nicht Einträge aus der Datenbank in den Storage.

**W13 — `bericht_pruefen`.** Es gibt `Konventionen.md` im Archiv, aber nichts,
was einen Bericht dagegen prüft. Der Befundtyp `bericht_veraltet` existiert
und wird in AKTUELL.md angezeigt — erzeugt wird er heute aus
Zeitstempel-Vergleichen, nicht aus den Regeln. Ein `bericht_pruefen` würde
genau die Befunde erzeugen, die die Sicht schon anzeigen will.

---

## 7. Zwei Punkte, die nicht als Wunsch durchgehen

**W14 — die gesperrten Schattenordner.** Elf leere `date`-Felder bei „Better
Writer" lassen sich über die Brücke nicht nachtragen: Alles unterhalb eines
`_`-Ordners ist vollständig schreibgesperrt. Das ist **Absicht** — Twin-
Artefakte werden erzeugt, nicht von Hand geschrieben, sonst divergieren
Spiegel und MongoDB. Der Wunsch ist trotzdem berechtigt, nur zielt er auf das
falsche Schloss: Der Weg führt über die Fachwerkzeuge
(`transformation_starten` mit korrigiertem Template, W10), nicht über eine
Ausnahme im Schreibschutz. Wenn hier etwas fehlt, dann ein Fachwerkzeug für
den Fall „ein Feld an einer bestehenden Auswertung nachtragen" — und das wäre
ein eigener Entwurf, keine Lockerung.

**W15/W16 — die zwei billigsten Punkte, mit 2.18.0 umgesetzt.** Beides war
Wissen, das nur im Skill stand und deshalb nur wirkte, wenn jemand den Skill
geladen hatte:

- **Reihenfolge (G11).** Beweis durch Gegenprobe: In `23.07` wurde am 30.08.
  *nach* dem Erschließen umbenannt — 23 Familien auf `twin_stale`. In `25.07`
  *vor* dem Erschließen: 28 Umbenennungen, **null `twin_stale`**. Das Problem
  ist die Reihenfolge, nicht der Bestand. Bis `familie_umziehen` das selbst
  löst, gehört die Regel an das Werkzeug.
- **Der Dreiklang.** `twins_synchronisieren` hat in einem Lauf rund 90 Quellen
  adoptiert, die der Scan sonst als unerschlossen gemeldet hätte — sie wären
  alle ein zweites Mal transkribiert worden. import→repair→export vor dem
  Erschließen gehört in die Beschreibung von `quelle_erschliessen`.

Werkzeugbeschreibungen sind der einzige Ort, den **jeder** Client sieht, auch
ohne Skill. Beide Absätze stehen jetzt dort — `familie_umziehen` nennt die
Reihenfolge samt Gegenprobe, `quelle_erschliessen` den Dreiklang und das
Umbenennen davor. Werkzeugsatz **2.18.0**; die Cowork-Erweiterung muss dafür
einmal aus- und eingeschaltet werden (der Client cached die Toolliste,
`bruecke_info` zeigt die Drift).

---

## 8. Was umgesetzt ist — und der eine Punkt, der offen bleibt

Fünfzehn der sechzehn Punkte sind gebaut (Werkzeugsatz **2.25.0**; mit der
parallelen Korrekturauftrag-Welle steht die Brücke bei 2.26.0). Die Reihenfolge folgte dem Nutzen je Aufwand; jeder Punkt hat
seinen eigenen Commit mit dem Beleg, aus dem er stammt.

| | Punkt | Wie umgesetzt |
|---|---|---|
| ✅ | W15/W16 | Reihenfolge- und Dreiklang-Regel stehen an `familie_umziehen` bzw. `quelle_erschliessen` |
| ✅ | W5 | `maxBytes` (Vorgabe 64 kB) + `zusammenfassung: true` an `ordner_listen` |
| ✅ | W9 | Alt-Format-Konstellation wird serverseitig erkannt; `erzwingen` ist dreiwertig, die Antwort weist den Grund je Quelle aus |
| ✅ | W1/W2/W4 | `abschnitt_einfuegen`, `tabelle_zeile_einfuegen`, Stapel `modi: [...]` (alles oder nichts) |
| ✅ | W3 | `frontmatter_ergaenzen` mit normalisiertem Dubletten-Vergleich, Flow-Form |
| ✅ | W7/W8 | `job_abbrechen`; Neustart-Verdacht widerspricht dem „nichts zu tun außer warten" |
| ✅ | W10 | `date` aus dem Pfad, belegt mit `date_quelle: pfad` |
| ⚠️ | W11 | `fehlerDeutung` in `job_status` — die `ffprobe`-Vorprüfung gehört in den Secretary Service |
| ✅ | W12 | `quelle_verschwunden`, in beiden Scopes, wo der Elternordner gelesen wurde |
| ⚠️ | W6 | Stufe 1 (base64) steht; Stufe 2 (Upload-URL) nicht |
| ❌ | W13 | `bericht_pruefen` — nicht gebaut, siehe unten |
| — | W14 | Braucht keinen Code, sondern eine Entscheidung (§7) |

### W13 bleibt offen, und zwar bewusst

Der Wunsch lautet: ein `bericht_pruefen`, das einen Bericht gegen
`Konventionen.md` prüft. Zwei Gründe, das jetzt **nicht** zu bauen:

1. **`Konventionen.md` liegt im Archiv, nicht im Repository.** Sie ist
   deutsche Prosa in der OneDrive-Bibliothek. Welche ihrer Sätze maschinell
   prüfbar sind, lässt sich von hier aus nicht sehen — und geraten würde ein
   Befundtyp entstehen, der über 101 Vorhabensordner hinweg falsch anschlägt.
   Ein Befund, der zu Unrecht rot ist, kostet mehr Vertrauen, als er Arbeit
   spart.
2. **Was strukturell prüfbar ist, gibt es schon.** `report_missing`,
   `bericht_veraltet`, `verweis_tot`, `bericht_unvollstaendig` und
   `stand_widerspruch` decken Existenz, Alter, Verweise und Widersprüche ab.
   Was `bericht_pruefen` darüber hinaus leisten soll, ist genau der Teil, der
   in der Prosa steht.

**Was es dafür braucht** — eine Liste der Regeln aus `Konventionen.md`, die
maschinell entscheidbar sind, jeweils mit dem Befundtyp, den ihr Bruch
erzeugen soll. Diese Liste kann nur aus dem Archiv kommen. Danach ist die
Umsetzung klein: Die Regel-Maschinerie (`archive-rules.ts`, `GAP_REGISTRY`)
steht und nimmt neue Typen typsicher auf.

### Zwei Ausbaustufen, die benannt bleiben

- **W6 Stufe 2** — Upload-URL für große Dateien. Bis dahin bekommt der
  Aufrufer bei über 6 MB ein `zu_gross` mit Zahlen, keine Übertragung, die im
  Zeitlimit stirbt.
- **W11 Vorprüfung** — `ffprobe` vor der Ton-Extraktion. Gehört in den
  Secretary Service; dieses Repository führt weder ffmpeg noch ffprobe aus.
  Bis dahin macht die Deutung den Fehlschlag wenigstens einmal verständlich
  statt siebenmal rätselhaft.

**W14** braucht keinen Code, sondern eine Entscheidung (§7).
