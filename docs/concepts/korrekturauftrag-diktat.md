# Korrekturauftrag: diktierter Kontext als Arbeitsauftrag an Cowork

> Status: **Vorschlag** · 30.08.2026 · Auslöser: zwei Tage Aufräumen mit Cowork,
> Werkbank blieb dabei ungenutzt

## 1. Ausgangslage

Beim Aufräumen wurden verteilte Dateien transkribiert, nach Inhalt verschoben und
umbenannt. Beim Durchgehen der Ordner zeigt sich: Manches ist falsch eingeordnet,
weil eine Audiodatei isoliert wenig Kontext trägt. Der Mensch kennt den Kontext —
er war beim Termin dabei. Er will ihn erzählen, nicht tippen, und danach soll
Cowork die Datei in EINEM Arbeitsgang neu interpretieren, neu einsortieren,
umbenennen und den Bericht nachziehen.

Gleichzeitig steht die Werkbank leer da, obwohl sie genau für diesen Durchgang
gebaut wurde. Das ist kein Zufall, sondern folgt aus ihrem Zuschnitt.

## 2. Der Logikfehler: warum die Werkbank nicht mitspielte

**(a) Der einzige Rückkanal zeigt auf den Menschen zurück, nicht auf die Maschine.**
Die Fehler-Markierung erzeugt den Befund `twin_flagged`, und der ist in
`src/lib/agent-view/gap-registry.ts:54` fest auf `actor: 'mensch'` geroutet. Der
zugehörige Auftragstext lautet wörtlich (`src/lib/agent-view/auftrag-templates.ts:61`):

> `Peter: Fehler-Markierung an <Pfad> auflösen — reparieren (lassen) und danach verifizieren.`

Ein Widerstand, der auf den Menschen zurückzeigt, ist für Cowork kein Auftrag.
Cowork hat keinen Grund, ihn abzuholen — und tut es auch nicht.

**(b) Der Auftrag wird per Zwischenablage geschoben, nicht abgeholt.**
Die Widerstandsliste sagt es selbst: „Im Menü `⋯` liegt derselbe Text als
kopierbarer Auftrag für Cowork." Der Mensch ist der Transportweg. Cowork startet
über `archiv-aufraeumen` mit `abdeckung_lesen` und fragt nie: *Was hat Peter
markiert?* Es gibt keinen Aufruf, der das beantworten würde.

**(c) Die Werkbank urteilt auf einem Report, die Aufräumarbeit verändert die
Wirklichkeit.** Der Report ist abgeleitet, nicht Wahrheit — jeder Umzug macht ihn
schief. Bei 7337 Dateien hätte die Werkbank nach jedem Schritt einen neuen Scan
gebraucht. Cowork arbeitete direkt am Storage; die Werkbank kam nie zum Zug.
Deshalb zeigt sie 1319 KnowledgeScout- und 101 Cowork-Befunde, aber im
Filter „Bereit" genau ein Vorhaben.

**Kern in einem Satz:** Die Werkbank ist ein *Abnahme*-Instrument („was blockiert
die Freigabe"), gebraucht wird aber ein *Korrektur*-Instrument („was soll anders
werden, und wer macht es"). Beides fällt nur zusammen, wenn ein Widerstand einen
ausführbaren Auftrag tragen kann.

## 3. Was schon da ist — mehr als erwartet

| Baustein | Ort | Zustand |
|---|---|---|
| Diktat mit Transkription | `src/components/shared/use-dictation-transcription.ts`, `dictation-textarea.tsx` | fertig, läuft über Secretary, mobil nutzbar |
| **Kontext-Kanal in die Neu-Interpretation** | `customHint` | **vollständig verdrahtet** (siehe unten) |
| Diktierfeld für genau diesen Hinweis | `src/components/library/flow/pipeline-sheet.tsx:614` | fertig — „Korrekturhinweise (optional)" mit Mikrofon |
| Persistenz im Twin | `src/lib/external-jobs/phase-template.ts:1422` | `mergedMeta.customHint` landet im Frontmatter des Artefakts |
| Wiederverwendung beim Re-Run | `phase-template.ts:753-806` | fehlt ein Hint im Aufruf, wird er aus dem Frontmatter geladen |
| Wirkung auf das LLM | `src/lib/external-jobs/append-custom-hint.ts` | „VERBINDLICHER KORREKTURHINWEIS (höchste Priorität – überschreibt Extraktion aus Pfad/Dokument)" |
| Fehler-Markierung mit Urheber/Zeit/Notiz | `twin_status: flagged` + `flagged_by/at/note` | fertig, geschützter Schreibweg mit Drift-Guard |
| Befund + Notiz für Agenten sichtbar | `compactGap` gibt `gap.detail` aus | die Notiz ist über `abdeckung_lesen` **lesbar** |
| Werkbank auf kleinem Schirm | `werkbank-layout.tsx:39,57` | Listen-/Detail-Umschaltung vorhanden |

**Das Wichtigste daraus:** Der Weg „diktierter Kontext → LLM interpretiert neu →
Kontext bleibt am Artefakt gespeichert" existiert bereits. Er hängt nur am
falschen Ort — in der Datei-Vorschau des Archivs, hinter dem Pipeline-Sheet,
nicht in der Werkbank und nicht über die Brücke.

## 4. Was fehlt

**L1 — Die Werkbank kennt nur eine Fehler-Notiz, kein Kontext-Feld.**
`MarkierKnopf` (`artefakt-markieren.tsx`) ist ein einzeiliges `<Input>`, ohne
Mikrofon, begrenzt auf 280 Zeichen (`MAX_NOTIZ_LAENGE`). Der Contract sagt
ausdrücklich „eine Zeile, kein Aufsatz". Ein erzählter Kontext sind 1000+ Zeichen.

**L2 — Diagnose und Anweisung sind zwei getrennte Welten.**
`flagged_note` sagt *was nicht stimmt*, `customHint` sagt *wie es zu machen ist*.
Die Werkbank schreibt nur das erste, das Pipeline-Sheet nur das zweite. Kein Weg
verbindet sie.

**L3 — Kein MCP-Werkzeug reicht den Kontext durch.**
`quelle_erschliessen` und `transformation_starten` (`tools-erschliessen.ts`)
kennen kein `customHint`-Argument. Cowork kann den Kontext also lesen, aber keine
Neu-Transformation damit fahren — es müsste ihn vorher ins Frontmatter schreiben
und auf den undokumentierten Fallback hoffen.

**L4 — Kein Sammelblick „was ist zu korrigieren".**
`abdeckung_lesen` mit `akteur: 'mensch'` kommt nahe, liefert aber alle
Mensch-Befunde und setzt einen frischen Scan voraus. Korrekturwünsche stehen im
Frontmatter — sie sollten ohne Scan lesbar sein.

**L5 — Kein Rückweg für Cowork.**
Nach der Reparatur bleibt `twin_status: flagged` stehen (korrekt nach ADR 0006:
`mergedMeta` erhält bestehende Felder, der Mensch nimmt ab). Aber Cowork kann
nicht melden „erledigt, bitte ansehen". Peter müsste raten, welche Markierungen
schon bearbeitet sind.

**L6 — Der Kontext wirkt nur auf die Transformation, nicht auf Ort und Namen.**
`customHint` landet im LLM-Prompt. Für `familie_umziehen` und `ordner_umbenennen`
ist er unsichtbar — der Agent muss ihn selbst lesen und deuten.

**L7 (klein) — `customHint` verstößt gegen die Frontmatter-Konvention.**
camelCase, obwohl AGENTS.md flach + `snake_case` verlangt.

## 5. Vorschlag

**Der Korrekturauftrag wird ein eigenes Feld — und ein eigener Befund, der auf
Cowork zeigt.**

Der Unterschied, an dem alles hängt: ob ein ausführbarer Auftrag dranhängt.

| | ohne Auftrag | mit Auftrag |
|---|---|---|
| Feld | `flagged_note` (280 Z., „stimmt nicht") | `korrektur_auftrag` (lang, diktiert) |
| Befund | `twin_flagged` · **Mensch** | `korrektur_offen` · **Cowork** |
| Bedeutung | Peter muss entscheiden, was zu tun ist | Cowork weiß, was zu tun ist |

`twin_flagged` bleibt unverändert — Modell B aus ADR 0006 wird nicht angefasst.

### 5.1 Felder (flach, snake_case, Obsidian-kompatibel)

```yaml
twin_status: flagged
flagged_by: human:peter.aichner@crystal-design.com
flagged_at: 2026-08-30T09:12:00.000Z
flagged_note: Ort und Datum stimmen nicht          # bleibt kurz, unverändert
# NEU: der diktierte Kontext, auf eine Zeile normalisiert
korrektur_auftrag: "Das Audio entstand am Rand des Workshops in Bozen, gesprochen hat Maria S. über das Genossenschaftsmodell — nicht über Commoning allgemein. Gehört unter 26.02, nicht unter 25.11."
korrektur_gestellt_at: 2026-08-30T09:12:00.000Z    # NEU
korrektur_erledigt_at: 2026-08-30T11:40:00.000Z    # NEU: Cowork stempelt
```

Ein Feld, ein Wert, eine Ebene. `korrektur_auftrag` wird wie `flagged_note` auf
eine Zeile normalisiert — das hält das Frontmatter flach und Obsidian-freundlich,
so wie `customHint` heute schon geschrieben wird. Kein 280er-Limit; Vorschlag
2000 Zeichen. (Der Serializer könnte mehrzeilig — er escaped Umbrüche per
`JSON.stringify` —, aber eine lange Zeile bleibt das robustere Format.)

### 5.2 Der Weg, Schritt für Schritt

1. **Aufnehmen (Werkbank, Smartphone).** Neben „stimmt nicht" ein zweiter Knopf
   „Korrektur diktieren". Dahinter die vorhandene `DictationTextarea` — dieselbe
   Komponente wie im Pipeline-Sheet, kein neuer Aufnahme-Code. Der Text ist
   vor dem Senden korrigierbar.
2. **Schreiben.** Über die bestehende Kurations-Route (`shadow-twins/curation`),
   erweitert um `korrigiere: { auftrag }`. Damit gelten Drift-Guard, Feld-Patch
   und Spiegel-Logik unverändert; Urheber und Zeit stempelt der Server.
3. **Sichtbar werden.** Neuer Gap-Typ `korrektur_offen`, `actor: 'cowork'`,
   Zyklus-Schritt 2, severity `error` — mit dem Auftragstext: *„Cowork: Quelle X
   nach Peters Korrekturauftrag neu interpretieren: `<Auftrag>`. Danach
   einsortieren/umbenennen, Bericht nachziehen, `korrektur_melden` aufrufen."*
   Damit steht der Auftrag in derselben Liste wie jede andere Cowork-Aufgabe.
4. **Abholen (neu, ohne Scan).** `korrekturen_lesen(libraryId, ordner?)` liest
   die offenen Aufträge direkt aus MongoDB — Pfad, `sourceId`, Auftragstext,
   Zeitpunkt. Kein `abdeckung_scannen` nötig; das Frontmatter ist Wahrheit.
5. **Ausführen.** `quelle_erschliessen` und `transformation_starten` bekommen
   einen Parameter `korrekturhinweis`, der auf den bestehenden `customHint`-Kanal
   gelegt wird. Ab da wirkt die fertige Mechanik: Preamble, höchste Priorität,
   Persistenz im Frontmatter. Einsortieren und Umbenennen macht Cowork wie bisher
   mit `familie_umziehen` — den Auftragstext hat es dabei im Kontext (L6 löst
   sich dadurch, ohne neue Mechanik).
6. **Zurückmelden.** `korrektur_melden(sourceId, artefakt, was_getan)` stempelt
   `korrektur_erledigt_at` und die Begründung ins Protokoll. `twin_status`
   bleibt `flagged` — die Abnahme gehört weiter Peter (ADR 0006 unangetastet).
   In der Werkbank wechselt die Zeile von „wartet auf Cowork" zu **„repariert —
   bitte ansehen"**. Peters Verifizieren löst dann beides auf.

### 5.3 Was das für den Alltag heißt

Peter geht am Handy die Werkbank durch, hört rein, drückt bei einem Fehlgriff auf
Mikrofon und erzählt den Kontext. Nach zwanzig Artefakten sagt er in Cowork einen
Satz — oder Cowork fragt beim nächsten Lauf von sich aus `korrekturen_lesen` ab —
und alle Korrekturen laufen in einem Arbeitsgang durch. Danach steht in der
Werkbank, was repariert wurde und auf seinen Blick wartet.

## 6. Wellen-Schnitt

| Welle | Inhalt | Aufwand |
|---|---|---|
| **K1** | Feld + Schreibweg: `korrektur_auftrag` in `TWIN_CURATION_FIELDS`, `buildCurationPatches`, Kurations-Route, Unit-Tests | klein |
| **K2** | Werkbank: Diktierknopf + Anzeige des Auftrags, Zustand „repariert — bitte ansehen" | klein |
| **K3** | Befund: Gap-Typ `korrektur_offen` (Registry, Regel, Auftragsvorlage, Zähler) | mittel |
| **K4** | Brücke: `korrekturen_lesen`, `korrektur_melden`, `korrekturhinweis` an den beiden Erschließungs-Werkzeugen | mittel |
| **K5** | Skill `archiv-aufraeumen`: `korrekturen_lesen` als erster Schritt jedes Laufs; Tabelle um `korrektur_offen` ergänzen | klein |

K1+K2 allein ergeben schon Nutzen (Kontext wird festgehalten, Cowork kann ihn per
`datei_lesen` finden). Erst K3+K4 machen den Kreis zu.

## 7. Offene Entscheidungen

1. **Getrennte Felder oder ein Feld?** Vorschlag: getrennt — `flagged_note` bleibt
   die kurze Diagnose, `korrektur_auftrag` ist die lange Anweisung. Die
   Alternative (ein Feld, Limit hoch) spart eine Zeile Contract, verliert aber
   die Unterscheidung, an der das Routing hängt.
2. **Auch das Original-Audio als Beleg ablegen?** Der Diktat-Hook liefert den Blob
   (`onAudioBlob`). Man könnte ihn in den `_`-Ordner legen. Vorschlag: **nein,
   vorerst nicht** — der transkribierte Text ist das, womit gearbeitet wird; das
   Audio wäre ein Artefakt ohne Twin und ohne Contract.
3. **Darf Cowork nach der Reparatur verifizieren?** Nein. Contract §3.2 verbietet
   Selbst-Verifikation, ADR 0006 macht die Abnahme zur menschlichen
   Selbstauskunft. `korrektur_erledigt_at` ist bewusst kein Häkchen.
4. **`customHint` auf `korrektur_hinweis` umbenennen (L7)?** Sauberer, aber es
   berührt bestehende Artefakte und drei Pipeline-Pfade. Vorschlag: eigene, kleine
   Welle nach K4, mit Lesen beider Schreibweisen.
