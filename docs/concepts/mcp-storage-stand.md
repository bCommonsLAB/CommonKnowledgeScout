# KnowledgeScout-Schnittstelle: was trägt, was fehlt

Stand 29.08.2026, Werkzeugsatz **2.16.0** (2.15.0: Stapel-Umzug + ehrliche
Job-Liste; 2.16.0: `erzwingen`, sichtbare Skips in `job_status`,
Gate-Fallback-Fix — Details in Plan §4h und
[`handover-cowork-2026-08-29.md`](handover-cowork-2026-08-29.md)).

Grundlage sind zwei Quellen, die sich gegenseitig prüfen:

- **Der Live-Test** aus einer Cowork-Sitzung am 28.08.:
  [`mcp-storage-testbericht-2026-08-28.md`](mcp-storage-testbericht-2026-08-28.md).
  Jede Zeile dort stammt aus einem tatsächlichen Aufruf gegen das Deployment,
  nicht aus einer Werkzeugbeschreibung.
- **Der Code**, gegen den die Befunde nachgeprüft wurden.

Anforderungsquelle bleibt
[`mcp-storage-anforderungen.md`](mcp-storage-anforderungen.md) (27.08.),
Umsetzungsplan `docs/plans/mcp-storage-abstraktion_4b7e1c93.plan.md`.

---

## 1. Kurzfassung

**Die Storage-Schicht trägt.** Der teuerste Punkt vom 27.08. — ganze Dateien
neu schreiben, um eine Zahl zu ändern — ist erledigt und im Live-Test siebenmal
belegt. Stufe 1 und Stufe 2 stehen bis auf `suchen`; Q1–Q3 und Q6 sind erfüllt.

Der Live-Test fand **zwei Dinge, die der Arbeit im Weg standen.** Beide sind
mit Werkzeugsatz 2.10.0 behoben:

1. Eine `_INDEX.md` ließ sich über die Brücke **weder anlegen noch pflegen**.
   Ein neuer Ordner konnte seinen Contract nie bekommen — Ordnerarbeit stand.
2. **`verschieben` prüfte den Schreibschutz nicht.** Damit war derselbe
   Riegel, der `datei_patchen` blockiert, in zwei Schritten zu umgehen. Mit
   `ueberschreiben: true` ließ sich die `_INDEX.md` eines echten Vorhabens
   samt Bearbeitungsstand ersetzen — ohne `ifVersion`, ohne die vier
   Schutzstufen, ohne Coverage-Befund. Die Lücke wurde in der Sitzung zweimal
   benutzt, um Punkt 1 zu umgehen.

Der zweite Punkt war die einzige sicherheitsrelevante Lücke der Schicht.

---

## 2. Was 2.10.0 gegenüber dem Testbericht ändert

| Befund im Test | Behoben durch |
|---|---|
| `_INDEX.md` nicht anlegbar/pflegbar (4.1) | Der Schreibschutz kennt jetzt die **Aktion**, nicht nur den Pfad. Geschützt ist der *Feldkern*: Frontmatter, Voll-Ersatz, Löschen und Verschiebe-Ziel bleiben gesperrt; **Fließtext und Anlegen sind frei**. Damit ist Coworks „genaueste Lösung" umgesetzt. |
| `verschieben` ohne Sperrprüfung (4.2) | `verschieben` prüft jetzt **Ziel- und Quellpfad**. Auch das *Wegbenennen* einer `_INDEX.md` ist gesperrt — das war der tatsächlich benutzte Umweg. |
| `existiert_bereits` / `nicht_eindeutig` fehlen (4.4) | Beide Codes gibt es jetzt, mit `wiederholbar: false` — sie sind nicht durch bloßes Wiederholen zu beheben, sondern durch einen korrigierten Aufruf. |
| OneDrive verspricht `millisekunde`, liefert `.000Z` (Q4) | `zeitstempelGenauigkeit` steht auf **`null`** („nicht sicher bekannt"), mit Hinweis. Eine Selbstauskunft, die mehr verspricht als sie hält, ist schlimmer als keine — `bericht_veraltet` hätte sich darauf verlassen. |

### Eine Korrektur am Testbericht

Der Bericht sagt zu A3: *„Ein `idGeaendert: {alt, neu}` in der Antwort gibt es
nicht."* Das ist nicht richtig — es gibt es in allen drei Schreibwerkzeugen
(`datei_schreiben`, `datei_patchen`, `verschieben`). Das Feld erscheint nur
**dann**, wenn die Id tatsächlich gewechselt hat. Im Test lief alles gegen
OneDrive, wo sie über sieben Patches stabil blieb — deshalb war es nie zu
sehen. Die Beobachtung stimmt also, die Schlussfolgerung nicht.

---

## 3. Was jetzt funktioniert

**Belegt durch den Live-Test:**

- `datei_patchen` in allen drei Modi, inklusive Eindeutigkeitsschutz
  (Abbruch bei zwei Treffern). `datei_schreiben` wurde kein einziges Mal
  gebraucht — das ist das Ergebnis.
- `bereich: frontmatter` lieferte **518 statt 10.672 Bytes**.
- Q1 vollständig: absichtlich mit überholter Version geschrieben → Konflikt
  mit aktueller Version **und** vollem Inhalt; Mergen ohne zweiten Lesevorgang.
- Q6 mit beiden Zusatzpunkten: `kanal: "bruecke"` trennt Agent von Mensch,
  und Fehlversuche nach der Eingabeprüfung stehen mit im Protokoll.
- `speicher_info` — im Test als „vorbildlich" bewertet, weil `null`
  ausdrücklich „nicht sicher bekannt" heißt.
- **Nextcloud lesend**: `speicher_info` und `ordner_listen` gegen
  `swaptolearn (nuvola)` ohne eine Zeile Sonderbehandlung.

**Die sieben Prüfsteine:**

| # | Prüfstein | Stand |
|---|---|---|
| 1 | Zeile ändern ohne Vollübertragung | ✅ siebenmal belegt |
| 2 | Zweiter Schreiber bekommt Konflikt | ✅ mit aktuellem Inhalt |
| 3 | Nextcloud wie OneDrive | ⚠️ **halb** — lesend ja, schreibend ungeprüft |
| 4 | 1.100 Ordner listen | ⚠️ **ungeprüft** — Blätterung und Obergrenze sind da, der Lauf fehlt |
| 5 | Löschen und wiederherstellen | ⚠️ **halb** — löschen ✅, `wiederherstellen` fehlt |
| 6 | Über dieselbe Id wiederfinden | ✅ bei OneDrive, sieben Versionen |
| 7 | Vom Handy, ohne Desktop | ⛔ **offen** — der Web-Zugang ist der eigentliche Prüfstein |

---

## 4. Was noch offen ist

### In der Storage-Schicht

- **`suchen`** — das einzige fehlende Werkzeug aus Stufe 2. Bemerkt wird es
  beim Verweis-Audit: „Wo wird auf diese Datei verwiesen?" ist heute nur durch
  Lesen aller Berichte zu beantworten. Braucht `indexStand` in der Antwort,
  weil der SharePoint-Index nachweislich hinter dem Dateistand zurückhing.
- **Stufe 3 vollständig**: `dateien_lesen` (Stapel), `binaer_lesen`,
  `kopieren`, `wiederherstellen`, `sperren`/`entsperren`.
- **Binärdateien gehen nicht.** `datei_anlegen`/`datei_schreiben` nehmen
  UTF-8-Text. Beliebige Dateien über die Schnittstelle ins Archiv legen ist
  damit mit **nein** beantwortet; Bilder, PDFs und Aufnahmen brauchen weiter
  den direkten Weg über OneDrive/Nextcloud.
- **Q7, Job-Modus** — kein `jobId`-Weg für lange Operationen. Betrifft
  rekursives Listen über große Bäume, `twins_pruefen` ohne Scope,
  `abdeckung_scannen` auf der Wurzel.
- **Nextcloud schreibend ungeprüft.** Die offene Frage aus der
  Anforderungsliste steht weiter: Trägt `ifVersion` gegen WebDAV-eTags? Der
  Code normalisiert schwache und gequotete eTags, aber gemessen ist es nicht.

### Jenseits der Storage-Schicht — älter als 2.9.0

- **Eine ungültig gewordene Verifikation erzeugt keinen Befund.** Fünf
  Artefakte warten auf Peter, der Teilbaum meldet trotzdem `befundAnzahl: 0`
  und `bereitZurAbnahme: true`. Seit ADR 0006 ist eine *fehlende* Verifikation
  zu Recht kein Befund — eine *ungültig gewordene* ist etwas anderes: Da hat
  ein Mensch hingesehen, und dann hat sich die Grundlage geändert.
  **Falsche Grün-Meldungen sind schlimmer als fehlende Werkzeuge.**
- **`aenderungen_seit` zählt doppelt** — 14 Einträge für sieben Dateien, weil
  jede Datei einmal je Artefakt erscheint. Für den Tagesabschluss wäre eine
  Zeile je Datei mit Artefaktliste die brauchbare Form. Dazu `delta: false`
  bei beiden Providern: es wird gescannt, Gelöschtes bleibt unsichtbar.
- **`PERSONEN.md` als gerechnete Sicht** — Anforderung liegt vor, nicht
  gebaut. Voraussetzung ist Fleißarbeit im Archiv: die `korrespondenz:`-Felder
  sind fast nirgends gefüllt.
- **`protokoll_lesen` wächst ungefiltert.** Filter fehlen für Zeitraum,
  Werkzeug und `status: "fehler"` — Letzteres ist der interessanteste, weil
  abgewehrte Schreibversuche das sind, was man nachlesen will. Große
  Ergebnisse werden mitten im JSON abgeschnitten und sind dann nicht mehr
  parsebar.
- **`transformation_starten` antwortet angeblich sofort** — der Skill
  behauptet es seit dem 27.08., geprüft ist es nicht, weil dafür ein
  kostenpflichtiger Job laufen müsste. Solange unbestätigt, ist es eine
  Annahme im Regelwerk.
- **Live-Abzeichen für MCP-Aktivität** in der Oberfläche: gewünscht, vertagt.
  Datenquelle (`aktions_protokoll`) und Vorbild (`job-monitor-panel.tsx`) sind
  da; es fehlen Lesevorgänge im Protokoll, ein Live-Kanal und die Anzeige.
  Fasst als erstes Stück `src/components/**` an — also M3/M4-Gebiet.

---

## 4b. Befund aus dem Aufräum-Lauf 28.08. (Werkzeugsatz 2.11.0)

Der erste echte Aufräum-Versuch über die Brücke lief auf einen teuren
Fehlschlag: Fünfzehn Vertrags- und Vergabeunterlagen wurden mit dem
Library-Standard `standard-meeting` transformiert. **Vierzehn
Template-Schritte scheiterten**, `ingest_rag` lief dadurch nie — bezahlt
waren die Jobs trotzdem.

Zwei Ursachen, beide behoben:

- **Der Agent konnte die Vorlage nicht prüfen.** `transformation_starten`
  nimmt ein `template` und kennt sogar `nur_transkript` — aber kein Werkzeug
  sagte, *welche* Vorlagen es gibt. Die Wahl fiel auf den Standard, weil die
  Alternativen unsichtbar waren. Neu: **`vorlagen_auflisten`**, mit `docType`
  und Beschreibung je Vorlage.
- **Die Fehlermeldung diagnostizierte nicht.** Sie hängte ein blindes
  `substring(0, 500)` der Antwort an — die aber mit einem Echo *unserer
  eigenen Anfrage* samt Volltext beginnt. Die 500 Zeichen waren restlos vom
  Echo belegt; ob es `data` überhaupt gab, blieb offen. Jetzt wird die
  **Struktur** berichtet (Schlüssel, `data`, Typ von `structured_data`, eine
  etwaige Dienst-Meldung) statt eines Präfixes.

**Noch offen aus diesem Lauf:**

- **Format-Zwillinge zahlen doppelt.** Dasselbe Dokument als `.docx`, `.pdf`
  und `_signed.pdf` wird dreimal erschlossen. Nach Zielbild §7 sind das
  Ableitungen — aber es gibt keinen „Beleg"-Schalter, der sie aus der
  Abdeckung nimmt. Was nicht erschlossen wird, bleibt als `error` stehen und
  sperrt die Abnahme.
- **Ein Job blieb auf `running` hängen**, obwohl sein erster Schritt
  `failed` war. Status-Konsistenz der Job-Schritte, nicht geprüft.
- Ob der Fehlschlag wirklich am unpassenden Template lag, ist damit
  **immer noch nicht bewiesen** — die verbesserte Meldung liefert beim
  nächsten Lauf die Antwort.
- **Der Lauf ging gegen die Testbibliothek.** `libraryId: ID_OnedriveTest`
  = „Onedrive Test", Pfad
  `4. Ökosozialer Aktivismus/26.07 Naturmuseum Knowledgescout`. Die fünfzehn
  bezahlten Jobs liefen also auf Testdaten — und der Ordner war im
  produktiven Archiv nicht zu finden, weil er dort nicht liegt.

**Nachgezogen mit 2.12.0:** `job_status` liefert bei gescheiterten Jobs die
`fehlerDetails` aus dem Trace mit — Schritt, Code, Meldung des Dienstes,
HTTP-Status, Antwort-Auszug. Genau die Auskunft, für die zuvor jemand in die
Datenbank sehen musste. Und der Skill kennt jetzt den Zwei-Schritt-Takt:
erst `nur_transkript`, dann das Transkript LESEN, und daraus die Vorlage
ableiten — der Dateiname verrät die Dokumentart nicht.

## 4c. Die Transformation scheitert am Secretary, nicht an KnowledgeScout

Zweiter Anlauf am 28.08.2026, mit `vorlagen_auflisten` und zwei Proben. Beide
inhaltlichen Vorlagen (`standard-meeting`, `meeting_analyse-de`) scheitern
**identisch**. Damit ist die Template-Hypothese widerlegt.

Was die verbesserte Fehlermeldung zeigt:

```
Schluessel: [status, request, process, error, data, translation]
status="success"
data-Schluessel: [status, request, process, error, data, translation]
KEIN `data.structured_data`.
```

Drei Befunde daraus:

1. **Die Antwort trägt ein `error`-Feld** — und `template-run.ts` liest es
   nicht. Es prüft ausschließlich auf `data.structured_data`.
2. **Die `data`-Schlüssel sind identisch mit den Wurzel-Schlüsseln.** Die
   Antwort ist verschachtelt; die Form entspricht nicht dem, was die
   Pipeline erwartet.
3. **Der Fehlschlag kam nach 924 ms bzw. 360 ms.** Eine LLM-Transformation
   von 14.000 Zeichen dauert Sekunden. Der Dienst bricht ab, bevor er
   rechnet — es ist keine Frage des Inhalts.

**Das ist ein Vertragsbruch zwischen Secretary und KnowledgeScout**, nicht
ein Fehler in der Vorlage oder im Dokument. Entweder hat sich die
Antwortform von `/api/transformer/template` geändert, oder der Dienst lehnt
die Anfrage ab und sagt das im `error`-Feld, das niemand liest.

Nachgezogen: `beschreibeAntwort` gibt jetzt **die ganze Antwort außer dem
`request`-Echo** wörtlich mit (auf 1.200 Zeichen begrenzt). Die erste Fassung
gab nur Strings aus — ein `error: { code, message }` fiel durchs Raster,
obwohl die Ursache darin stand. Das Echo bleibt draußen: es ist unsere eigene
Eingabe und der einzige Teil, der nichts erklärt.

Damit ist der nächste Lauf beweisend. Bis dahin gilt: **Transformationen über
die Brücke sind nicht benutzbar**; `nur_transkript` funktioniert.

## 4d. Die Ursache: ein ungültiges LLM-Modell im Secretary

Die Secretary-Logs vom 28.08.2026 beenden die Suche:

```
'deepseek/deepseek-v4-flash-latest is not a valid model ID', code: 400
```

Der Dienst war auf eine Modell-Id konfiguriert, die es bei OpenRouter nicht
gibt. **Jeder** Aufruf starb nach 100–280 ms mit HTTP 400 — ohne ein einziges
Token. Weder Vorlage noch Dokument hatten damit zu tun.

Warum es aus der Werkbank trotzdem lief: Sie **gibt ein Modell mit**. Der
erfolgreiche Lauf um 15:49 benutzte `google/gemini-2.5-flash` — 12,3
Sekunden, 8.374 Tokens, sauberes Ergebnis.

**Der Anteil, der uns gehört:** Die MCP-Brücke gab gar kein Modell mit und
fiel damit still auf den Default eines fremden Dienstes zurück. Der
Code-Kommentar sagte es sogar („Secretary Service verwendet sonst Default") —
und genau das verbietet `no-silent-fallbacks`: Als der Default brach, konnte
KnowledgeScout weder davon wissen noch es benennen.

Behoben mit 2.13.0/2.14.0, in zwei Schritten mit einer Korrektur dazwischen:

Das Feld `secretaryService.llmModel` existierte die ganze Zeit — direkt neben
`template`, aus dem `standardTemplate()` längst liest. Die Werkbank benutzt
es (`file-preview.tsx`), die Brücke nicht. **2.13.0** ließ die Brücke es
lesen, gab dem Werkzeug aber zusätzlich einen `llmModel`-Parameter.

**2.14.0 entfernt diesen Parameter wieder** (Owner-Entscheid): Der Client
wählt die *Vorlage* — eine fachliche Entscheidung. Welches Modell sie
ausführt, ist Infrastruktur und gehört dem Betreiber der Library. Eine
Modellwahl je Aufruf hieße, dass zwei Läufe derselben Vorlage verschieden
ausfallen können, ohne dass das Archiv es einem ansieht. Die Brücke verhält
sich damit exakt wie der Knopf in der Werkbank — gleiche Vorlage, gleiches
Modell, gleiche Konfigurationsquelle.

Bewusst KEIN Wurf bei fehlender Konfiguration — Bibliotheken ohne eigenes
Modell laufen heute über den Secretary-Default, und den abzuschneiden wäre
eine Verhaltensänderung, die niemand bestellt hat. Stattdessen wird die
Abhängigkeit **sichtbar**: Jede Start-Antwort trägt `modellHerkunft`; fehlt
die Konfiguration, sagt sie ausdrücklich, dass nur der Betreiber das beheben
kann. Genau diese Unsichtbarkeit war das Problem.

**Die eigentliche Reparatur liegt beim Secretary**: Solange dessen Default
ungültig ist, scheitert jeder Aufruf, der kein Modell mitgibt — auch aus
anderen Clients.

**Erkennungsmerkmal für die Zukunft:** Ein Fehlschlag in unter einer Sekunde
ist nie ein LLM-Problem. Ein echter Lauf über 14.000 Zeichen braucht rund
zwölf Sekunden.

## 5. Reihenfolge für das, was bleibt

Die beiden Blocker sind weg. Was übrig ist, nach Nutzen sortiert:

1. **Ungültige Verifikation als Befund.** Kein Storage-Thema, aber der
   schwerwiegendste Punkt: Das Archiv meldet „bereit", während Arbeit offen
   liegt.
2. **Nextcloud schreibend prüfen.** Ein Patch gegen eine echte
   Nextcloud-Bibliothek beantwortet die letzte offene Frage der
   Anforderungsliste.
3. **`suchen`** — schließt Stufe 2 ab.
4. **`aenderungen_seit` entdoppeln** — macht den Tagesabschluss brauchbar.
5. **Prüfstein 4 tatsächlich fahren** — 1.100 Ordner listen. Die Vorkehrungen
   sind da, der Beweis fehlt.
6. Der Rest nach Bedarf.
