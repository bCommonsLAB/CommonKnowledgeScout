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

**Das Wichtigste daraus:** Diktieren, Text am Artefakt festhalten und ihn beim
nächsten Lauf wieder hervorholen — diese Mechanik ist gebaut und erprobt. Sie
zeigt, dass der schwierige Teil gelöst ist.

**Aber Vorsicht, das ist NICHT dasselbe Feld** (§5): `customHint` steuert den
Inhalt einer Transformation, nicht die Arbeit an der Datei. Was hier zählt, ist
das Muster, nicht das Feld.

## 4. Was fehlt

**L1 — Die Werkbank kennt nur eine Fehler-Notiz, kein Kontext-Feld.**
`MarkierKnopf` (`artefakt-markieren.tsx`) ist ein einzeiliges `<Input>`, ohne
Mikrofon, begrenzt auf 280 Zeichen (`MAX_NOTIZ_LAENGE`). Der Contract sagt
ausdrücklich „eine Zeile, kein Aufsatz". Ein erzählter Kontext sind 1000+ Zeichen.

**L2 — Es gibt kein Feld für einen Arbeitsauftrag an den Agenten.**
`flagged_note` ist eine Diagnose („stimmt nicht"), `customHint` ein Prompt-Zusatz
für das LLM. Was fehlt, ist die dritte Sache: *„lieber Agent, tu mit dieser Datei
Folgendes."* Dafür ist keines der beiden Felder gedacht, und keines darf dafür
umgewidmet werden (§5).

**L3 — Der Agent kann eine Neu-Transformation nicht steuern.**
`quelle_erschliessen` und `transformation_starten` (`tools-erschliessen.ts`)
nehmen kein Hinweis-Argument. Schließt der Agent aus einem Auftrag, dass eine
Transformation mit anderem Wissen laufen muss, hat er keinen Weg, das zu sagen.

**L4 — Kein Sammelblick „was ist zu korrigieren".**
`abdeckung_lesen` mit `akteur: 'mensch'` kommt nahe, liefert aber alle
Mensch-Befunde und setzt einen frischen Scan voraus. Korrekturwünsche stehen im
Frontmatter — sie sollten ohne Scan lesbar sein.

**L5 — Kein Rückweg für Cowork.**
Nach der Reparatur bleibt `twin_status: flagged` stehen (korrekt nach ADR 0006:
`mergedMeta` erhält bestehende Felder, der Mensch nimmt ab). Aber Cowork kann
nicht melden „erledigt, bitte ansehen". Peter müsste raten, welche Markierungen
schon bearbeitet sind.

**L6 — Keine Antwort auf die Reichweiten-Frage.**
Weder „zeig mir alle offenen Korrekturen der Library" noch „nur die dieses
Ordners" ist heute formulierbar. Ohne beides muss man entweder jedes Verzeichnis
einzeln prüfen oder sich beim Arbeiten an einem Ordner Fremdes einfangen. Siehe §7.

**L7 — Kein Anstoß, den Bericht nachzuziehen.**
Die Befunde dafür existieren (§8), aber nichts verknüpft sie mit der Korrektur —
der Skill sagt heute nicht, dass nach einem ordnerübergreifenden Umzug ZWEI
Vorhaben neu zu scannen sind.

## 5. Zwei Ebenen, die nicht vermischt werden dürfen

**Klarstellung (Peter, 30.08.2026):** `customHint` ist der Prompt-Zusatz **einer
Transformation** — er beeinflusst, was das LLM aus einem Text macht (Feld-Ebene:
„Händler ist Maximode"). Der Korrekturauftrag ist etwas anderes: eine Anweisung
an den **Agenten**, was er mit der *Datei* tun soll (Datei-Ebene: „gehört unter
26.02, gesprochen hat Maria S., Name ist falsch").

| | `customHint` (vorhanden) | `korrektur_auftrag` (neu) |
|---|---|---|
| Adressat | das LLM in der Transformation | Cowork über die MCP-Brücke |
| Wirkt auf | Inhalt eines Artefakts | Ort, Name, Einordnung, Bericht |
| Gesetzt in | Pipeline-Sheet der Datei-Vorschau | Werkbank, diktiert |
| Gelesen von | `phase-template.ts` | `korrekturen_lesen` |

Sie treffen sich an genau einer Stelle: Wenn der Agent aus dem Auftrag schließt,
dass eine Neu-Transformation nötig ist, **formuliert er selbst** einen passenden
`customHint` daraus. Der Agent ist der Übersetzer zwischen beiden Ebenen — der
Auftragstext wird NICHT roh in den Prompt gereicht. Er kann Sätze enthalten
(„liegt im falschen Ordner"), die im LLM-Prompt nur Schaden anrichten.

## 6. Der Vorschlag

**Ein eigenes Feld, ein eigener Befund, der auf Cowork zeigt.**

| | `flagged_note` (bleibt) | `korrektur_auftrag` (neu) |
|---|---|---|
| Inhalt | „stimmt nicht", 280 Zeichen | erzählter Kontext, diktiert |
| Befund | `twin_flagged` · **Mensch** | `korrektur_offen` · **Cowork** |
| Bedeutung | Peter muss entscheiden | Cowork weiß, was zu tun ist |

`twin_flagged` und ADR 0006 bleiben unangetastet: `twin_status` bleibt `flagged`,
die Abnahme bleibt Peters Klick.

### 6.1 Wo der Auftrag liegt

Zwei Orte, wie bei jedem Twin-Feld — MongoDB ist Wahrheit, das Dateisystem
Spiegel (Twin-Contract §4):

- **MongoDB, Top-Level am Twin-Dokument:** `korrektur: { auftrag, gestelltVon,
  gestelltAt, pfadBeiAuftrag, erledigtAt }`. Verschachtelt ist hier erlaubt und
  richtig (AGENTS.md: „Verschachtelte Datenmodelle entstehen erst downstream").
  Top-Level, damit die Übersicht (§7) es ohne Scan und ohne Wildcard-Index findet.
- **Frontmatter des Artefakts, flach gespiegelt:** `korrektur_auftrag`,
  `korrektur_gestellt_at`, `korrektur_erledigt_at` — snake_case, einzeilig, damit
  es in Obsidian sichtbar ist und einen Export überlebt.

`pfadBeiAuftrag` ist ein **Schnappschuss**, kein Wahrheitswert: Die Datei zieht ja
gerade deshalb um. Wahrheit bleibt die `sourceId`; der Pfad dient nur der
Gruppierung in der Übersicht und wird als „Stand bei Auftragserteilung"
ausgewiesen. (Nötig, weil `ShadowTwinDocument` nur `parentId` kennt, keinen Pfad —
sonst kostete jede Übersicht so viele Storage-Auflösungen wie es Treffer gibt.)

## 7. Reichweite: Übersicht ODER Ordner — dasselbe Werkzeug

Das ist die Frage, an der sich entscheidet, ob das Ding im Alltag trägt: Peter
will weder in jedes Verzeichnis einzeln schauen müssen, noch beim Aufräumen von
`25.11` plötzlich Korrekturen aus `26.02` mitgeschleppt bekommen.

**Lösung: ein Werkzeug, ein Scope-Parameter, zwei Verdichtungsgrade.**

```
korrekturen_lesen(libraryId)              → ÜBERSICHT  (aggregiert, library-weit)
korrekturen_lesen(libraryId, folderId)    → ARBEITSLISTE (Volltext, nur dieser Teilbaum)
```

**Ohne `folderId` — die Übersicht.** Je Vorhaben EINE Zeile: Pfad, Anzahl offener
Aufträge, ältester Zeitpunkt, ein gekürzter Auszug des ersten. Keine Volltexte.
Das ist der Blick, mit dem entschieden wird — *„14 Korrekturen in 5 Vorhaben,
7 davon in `26.02` — da fange ich an"*:

```
26.02 Commoning Methoden      7 offen   ältester 28.08.  „Sprecher ist Maria S., nicht …"
25.11 Bozen Workshop          4 offen   ältester 29.08.  „gehört eigentlich unter 26.02 …"
24.09 Genossenschaft          2 offen   ältester 30.08.  „Datum im Titel ist falsch …"
Organisation/Ablage           1 offen   ältester 30.08.  „das ist kein Protokoll, sondern …"
```

**Mit `folderId` — die Arbeitsliste.** Volltexte, `sourceId`, Pfad, Zeitpunkt —
und ausschließlich aus diesem Teilbaum. Beim Aufräumen von `25.11` sieht der
Agent nur die Aufträge aus `25.11`. Keine Streuung.

**Entscheidend: beides braucht keinen Scan.** Die Aufträge stehen in MongoDB, das
ist Wahrheit, nicht abgeleitet. Genau darum kann die Übersicht library-weit sein,
ohne dass 7337 Dateien angefasst werden — der Unterschied zum Report, an dem die
Werkbank bisher hing.

### 7.1 Die zwei Betriebsarten im Skill

Der Skill `archiv-aufraeumen` bekommt **einen** neuen Absatz, der beide Wege
benennt:

**(A) Beiläufig — beim Aufräumen eines Ordners.** `korrekturen_lesen(folderId)`
wird **Schritt 0**, vor allem anderen. Das passt exakt zur bestehenden Regel des
Skills: *„alle Umbenennungen gehören vor die Erschließung"* — ein Korrekturauftrag
löst typischerweise genau eine Umbenennung oder einen Umzug aus. Wer ihn erst nach
dem Erschließen liest, arbeitet zweimal.

**(B) Gezielt — die Korrektur-Runde.** `korrekturen_lesen()` ohne Ordner →
Übersicht → das Vorhaben mit den meisten offenen Aufträgen zuerst → dann für
dieses Vorhaben der normale Ablauf (A). Das ist der Modus für „Peter hat gestern
Abend zwanzig Sachen diktiert".

Beide enden gleich: `korrektur_melden` je erledigtem Auftrag, dann ein
Teilbaum-Scan.

### 7.2 Wenn ein Auftrag über die Ordnergrenze zeigt

Der häufigste Fall — *„gehört unter 26.02, nicht unter 25.11"* — wird **im
Quellordner gefunden** (dort liegt die Datei) und **berührt den Zielordner**, in
dem gar kein Auftrag steht. Das ist unvermeidlich und in Ordnung, solange der
Agent es weiß. Regel für den Skill:

> Zieht eine Korrektur eine Familie über eine Vorhabensgrenze, gehören **beide**
> Ordner in den anschließenden `abdeckung_scannen`-Aufruf — der Quellordner, weil
> sein Bericht jetzt ins Leere zeigt, der Zielordner, weil seiner die neue Quelle
> noch nicht kennt.

## 8. Den Bericht nachziehen — dafür gibt es schon eine Mechanik

Die Sorge „muss ich daran denken, den Bericht zu aktualisieren?" löst sich fast
von selbst: Das Verweis-Audit (doppelte Buchhaltung) fängt alle drei Fälle, und
alle drei sind bereits auf **Cowork** geroutet, Zyklus-Schritt 3:

| Was passiert ist | Befund | wo er auftaucht |
|---|---|---|
| Artefakt neu erzeugt / Datei umbenannt | `bericht_veraltet` (warning) | im Ordner selbst — Bericht älter als jüngste Änderung |
| Datei ist weggezogen | `verweis_tot` (error) | im **Quell**ordner — der Bericht verlinkt ins Leere |
| Datei ist zugezogen | `bericht_unvollstaendig` (info) | im **Ziel**ordner — erschlossene Quelle unerwähnt |

**Es braucht also keine neue Regel für den Bericht** — nur den Teilbaum-Scan nach
der Korrektur (§7.2). Danach steht der Bericht-Nachzug als ganz gewöhnlicher
Cowork-Befund in der Liste und wird im selben Lauf mit abgearbeitet. Genau dafür
ist die Zyklus-Reihenfolge gebaut: Korrektur ist Schritt 1–2, Bericht ist
Schritt 3.

Ein Punkt bleibt, den der Skill benennen muss: `bericht_veraltet` ist `warning`
und `bericht_unvollstaendig` sogar `info` — beide sperren die Abnahme nicht. Nach
einer Korrektur-Runde sollten sie trotzdem abgearbeitet werden, sonst erzählt der
Bericht weiter die alte, falsche Geschichte. Das ist der Satz, der in den Skill
gehört, nicht eine neue Severity.

## 9. Wellen-Schnitt

| Welle | Inhalt | Aufwand |
|---|---|---|
| **K1** | Feld + Schreibweg: `korrektur` am Twin-Dokument, flacher Frontmatter-Spiegel, Kurations-Route um `korrigiere: { auftrag }` erweitert, Unit-Tests | klein |
| **K2** | Werkbank: Diktierknopf „Korrektur diktieren" (vorhandene `DictationTextarea`), Anzeige des Auftrags, Zustand „repariert — bitte ansehen" | klein |
| **K3** | Befund `korrektur_offen` (Registry `actor: 'cowork'`, Regel, Auftragsvorlage, Zähler) | mittel |
| **K4** | Brücke: `korrekturen_lesen` (beide Verdichtungsgrade), `korrektur_melden` | mittel |
| **K5** | Skill `archiv-aufraeumen`: Schritt 0, Korrektur-Runde, Ordnergrenzen-Regel, Bericht-Nachzug-Satz | klein |

K1+K2 tragen schon allein: Der Kontext ist festgehalten und über `datei_lesen`
auffindbar. K4+K5 machen ihn ohne Suchen auffindbar — das ist der Sprung von
„geht" zu „trägt im Alltag".

## 10. Offene Entscheidungen

1. **Auftrag am Artefakt oder an der Familie?** Heute hängt `flagged_note` am
   einzelnen Artefakt (Transkript ODER Zusammenfassung). Der Korrekturauftrag
   meint fast immer die *Datei*, nicht ein Artefakt. Vorschlag: an der **Familie**
   (Top-Level am Twin-Dokument, siehe §6.1) — der Frontmatter-Spiegel geht ins
   führende Artefakt.
2. **Das Original-Diktat als Audiodatei ablegen?** Vorschlag: nein — wäre ein
   Artefakt ohne Twin und ohne Contract. Der transkribierte Text ist das
   Arbeitsmaterial.
3. **Darf Cowork nach der Reparatur verifizieren?** Nein. Contract §3.2 verbietet
   Selbst-Verifikation. `korrektur_erledigt_at` ist bewusst kein Häkchen.
4. **`customHint` auf `korrektur_hinweis` umbenennen?** Nach §5 besser NICHT — die
   Namensähnlichkeit würde die beiden Ebenen wieder verwischen. Wenn umbenennen,
   dann in Richtung `transformations_hinweis`, eigene kleine Welle nach K4.
