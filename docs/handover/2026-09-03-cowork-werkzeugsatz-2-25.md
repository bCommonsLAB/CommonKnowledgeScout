# Für Cowork: was sich mit Werkzeugsatz 2.25.0 ändert

Kurzfassung der umgesetzten [Wunschliste 3](../concepts/mcp-wunschliste-3.md)
— gedacht zum Übernehmen in `archiv-aufraeumen/SKILL.md` und die
Cowork-Skills.

**Zuerst:** Erweiterung in den Einstellungen aus- und wieder einschalten (die
Toolliste ist gecacht), dann `bruecke_info` — es muss **2.25.0** mit **36
Werkzeugen** melden. Sagt es weniger, greift keiner der Punkte unten.

---

## 1. Vier Gewohnheiten, die wegfallen

| Bisher | Ab 2.25.0 |
|---|---|
| Wochenabschnitt per `ersetze` auf `"## Verweise"`, Überschrift mitschicken, damit sie stehen bleibt | `datei_patchen` → `{art: "abschnitt_einfuegen", ueberschrift: "## Verweise", position: "vor", inhalt: "…"}` |
| Chronologie-Zeile = ganze Tabelle neu schreiben | `{art: "tabelle_zeile_einfuegen", ueberschrift: "## Chronologie", zeile: "\| 2026-09-02 \| … \|", position: "ende"}` |
| Drei Aufrufe für eine logische Änderung | Ein Aufruf mit `modi: [ …, …, … ]` |
| `korrespondenz:` per `ersetze` auf den Zeilenwortlaut rekonstruieren | `{art: "frontmatter_ergaenzen", listen: {korrespondenz: ["Clara Dorn"]}}` |

Zu den Einfüge-Modi:

- **`position: "nach"` heißt hinter dem GANZEN Abschnitt**, nicht hinter der
  Überschriftszeile. Wer einen Abschnitt einfügt, meint keinen
  Unterabschnitt.
- **`tabelle_zeile_einfuegen` rät nicht.** Mehrere Tabellen im Suchbereich →
  Fehler mit Anzahl und Fundstellen; dann mit `ueberschrift` eingrenzen.
  `position: "anfang"` setzt hinter Kopf *und* Trennzeile.
- **Der Stapel ist alles-oder-nichts.** Scheitert Schritt 3, wird auch
  Schritt 1 nicht geschrieben; der Fehler nennt die Nummer. Jeder Schritt
  sieht das Ergebnis des vorigen — die Reihenfolge zählt.
- **`frontmatter_ergaenzen` entdoppelt normalisiert** (Rand, Mehrfach-Leerzeichen,
  Anführungszeichen, Groß-/Kleinschreibung), auch innerhalb eines Aufrufs.
  Geschrieben wird die Schreibweise, die schon dasteht.

**Eine Einschränkung, die in den Skill gehört:** `frontmatter_ergaenzen`
schreibt nur die **Flow-Form** `feld: [a, b]`. Steht ein Feld in YAML-Blockform
(`feld:` und darunter `  - a`), wird es **nicht angefasst, sondern gemeldet** —
diese Form liest der Parser als *leeren* Wert zurück, die Einträge wären für
KnowledgeScout weg. Solche Felder erst umstellen, dann ergänzen.

---

## 2. Große Ordner sind jetzt prüfbar

`ordner_listen` hat zwei neue Angaben:

- **`zusammenfassung: true`** → statt der Namensliste je direktem Unterordner
  Anzahl, Gesamtgröße, jüngstes Datum. **Das ist der neue erste Griff** bei
  einem unbekannten Ordner: erst der Überblick, dann gezielt hineinlisten.
  Eine Zeile mit lauter Nullen heißt „nicht hineingeschaut", nicht „leer".
- **`maxBytes`** (Vorgabe 64 kB) begrenzt die **Größe** der Antwort; `limit`
  begrenzte nur ihre *Zahl*. Eine Kürzung steht in `gekuerzt`, weitergeblättert
  wird mit `naechsterCursor`.

Damit ist der Klimagesetz-Ordner (78.634 Zeichen bei `tiefe: 2`) endlich
zugänglich.

---

## 3. `erzwingen` nicht mehr raten

**`erzwingen` weglassen ist ab sofort der Normalfall.** Der Server erkennt die
Alt-Format-Konstellation (Transformation ohne Transkript) selbst und übergeht
das Gate von sich aus. Die Antwort weist es aus:

- je Quelle `erzwungen: "alt_format_erkannt" | "angefordert" | "abgelehnt" | "nicht_noetig"`
- dazu `erzwungenAutomatisch` als Zähler

`erzwingen: true` bleibt möglich (immer übergehen), `erzwingen: false` heißt
ausdrücklich *nie* — die menschliche Ansage gewinnt in beide Richtungen.

> Die Skill-Passage „Für solche Familien `quelle_erschliessen` mit
> `erzwingen: true` aufrufen … `erzwingen` ist die Ausnahme, nicht der
> Default" ist damit überholt und sollte umgeschrieben werden.

---

## 4. Jobs: ein neuer Griff und eine Warnung

**`job_abbrechen`** (neu) beendet **einen** eigenen Job dieser Bibliothek,
unabhängig von Lebenszeichen — für „diesen einen will ich nicht mehr" (falsche
Vorlage, Job aus einer alten Sitzung). Nicht verwechseln:

| | `jobs_aufraeumen` | `job_abbrechen` |
|---|---|---|
| Frage | „steht etwas still?" | „diesen einen will ich nicht mehr" |
| Menge | mehrere | genau einer |
| Schwelle | ja, Stillstand nötig | keine |

Abgebrochen heißt **gescheitert**, nicht erledigt — was gebraucht wird, neu
starten.

**`job_liste` widerspricht jetzt dem „nichts zu tun außer warten".** Sind alle
laufenden Jobs innerhalb von zwei Minuten verstummt und schweigen seit
mindestens fünf, steht ein **`neustartVerdacht`** im `pool`-Block und sein
Hinweis *vor* dem Regelhinweis. Das ist das Muster eines Prozess-Neustarts:
Dann nicht warten, sondern `jobs_aufraeumen` mit kurzer
`mindestStillstandMinuten`. (Verdacht aus dem Zeitmuster, kein Beweis — steht
so in der Antwort.)

---

## 5. Anhänge kommen ins Archiv

Zwei neue Werkzeuge, Stufe 1 (base64, **Grenze 6 MB**):

- **`datei_binaer_anlegen`** — `pfad`, `inhaltBase64` (ohne `data:`-Präfix),
  optional `mimeType`. Der Weg, ein PDF aus dem Postfach abzulegen, ohne es
  abzuschreiben.
- **`datei_binaer_lesen`** — gibt base64 zurück. **Keine Blätterung**: ein
  halbes PDF ist kein PDF; zu groß → Absage mit Größenangabe. Sparsam
  verwenden, base64 bläht um ein Drittel und läuft durch den Kontext.

Über 6 MB kommt `zu_gross` mit Zahlen. Die Upload-URL für große Dateien
(Stufe 2) ist **nicht** gebaut — solche Dateien gehören über die Werkbank
oder direkt in den Speicher.

---

## 6. Drei neue Angaben, auf die zu achten ist

**`fehlerDeutung` in `job_status`** (bei Fehlschlägen). Erkennt die Brücke eine
bekannte Lage, kommt Klartext plus `wiederholenSinnvoll`. Erster Fall:
`quelle_ohne_ton`.

> **`wiederholenSinnvoll: false` heißt: nicht neu starten.** Und bei
> `quelle_ohne_ton` gilt zusätzlich: Hat diese Quelle bereits ein Transkript,
> ist es **verdächtig** — eine Transkription ohne Tonquelle liefert erfundenen
> Text, der für jeden Scan gültig aussieht. Vor dem Weiterverwenden ansehen.

**Neuer Befund `quelle_verschwunden`** (Fehler · Mensch). Die Datenbank kennt
die Quelle, im Speicher liegt sie nicht mehr, und ihr eigener Ordner *wurde*
gelesen. **Kein Job behebt das** — nicht erneut erschließen, sondern die Datei
zurückholen oder die Familie mit `quelle_verwerfen` auflösen. Der Befund gilt
jetzt auch bei Teilbaum-Scans; genau dort fehlte er (15 Fälle, die als
„behebbar" gemeldet wurden und zwölf Jobs kosteten).

**`date_quelle: pfad` im Frontmatter.** Fällt `date` aus, leitet die Pipeline
es aus dem Ordnernamen ab (`2025-07-16 Besprechung mit Jonas`) und weist die
Herkunft aus. Ein Feld mit dieser Marke ist *abgeleitet*, nicht geprüft.
Vorhabensnummern wie `24.09` oder `26.01` werden bewusst **nicht** als Datum
gelesen.

---

## 7. Zwei Regeln stehen jetzt am Werkzeug

Bisher standen sie nur im Skill und wirkten deshalb nur, wenn ihn jemand
geladen hatte. Jetzt lesen sie alle Clients mit — im Skill dürfen sie
trotzdem bleiben:

- **`familie_umziehen`**: erst umbenennen, *dann* erschließen. (Gegenprobe:
  nachher umbenannt = 23 Familien `twin_stale`; vorher = 28 Umzüge, null.)
- **`quelle_erschliessen`**: vorher `twins_synchronisieren`
  (import→repair→export). Es adoptierte in einem Lauf rund 90 Quellen, die
  sonst ein zweites Mal transkribiert worden wären.

---

## 8. Neue Zeilen für die Drift-Erkennung

Ergänzend zum Abschnitt „Toolliste veraltet" im Skill:

- Fehlen `datei_binaer_lesen`/`datei_binaer_anlegen` → älter als **2.25.0**
- Liefert `job_status` bei einem Fehlschlag keine `fehlerDeutung` → älter als **2.24.0**
- Fehlt `job_abbrechen` oder trägt `job_liste` keinen `neustartVerdacht` → älter als **2.23.0**
- Kennt `datei_patchen` kein `frontmatter_ergaenzen` → älter als **2.22.0**
- Kennt `datei_patchen` kein `abschnitt_einfuegen`/`tabelle_zeile_einfuegen`/`modi` → älter als **2.21.0**
- Meldet `quelle_erschliessen` kein `erzwungenAutomatisch` → älter als **2.20.0**
- Nimmt `ordner_listen` kein `zusammenfassung`/`maxBytes` → älter als **2.19.0**

---

## 9. Was ausdrücklich NICHT geht

- **`bericht_pruefen` gegen `Konventionen.md`** gibt es nicht und ist bewusst
  nicht gebaut: Welche Sätze dieser Datei maschinell prüfbar sind, ist vom
  Code aus nicht zu sehen. Wenn ihr die Regeln benennt (je Regel: was ist
  entscheidbar, welcher Befund entsteht bei Bruch), ist die Umsetzung klein.
- **`ffprobe`-Vorprüfung vor der Transkription** — gehört in den Secretary
  Service, nicht in KnowledgeScout. Bis dahin gibt es nur die Deutung
  *nachher* (§6).
- **Felder in `_`-Twin-Ordnern von Hand nachtragen** bleibt gesperrt (die elf
  leeren `date` bei „Better Writer"). Der Weg führt über
  `transformation_starten` mit korrigiertem Template — jetzt oft schon durch
  die Pfad-Ableitung (§6) erledigt.
