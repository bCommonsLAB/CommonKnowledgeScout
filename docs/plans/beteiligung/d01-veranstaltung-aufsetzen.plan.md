---
name: d01-veranstaltung-aufsetzen
overview: "Detailkonzept D1: Eine Veranstaltung wird in Dateien geplant (Reihe, Textstellen, Treffen, Tische mit Agenda und Leitfragen, Rollen) und mit „Treffen freigeben“ als Snapshot in die Datenbank übernommen. Dateiformate, Ordnerregeln, Prüfen und Freigeben mit Abweichungsbericht, Snapshot-Modell, Schnittstellen zum Bestand, Fehlerfälle, Tests."
vorhaben: [26.05 SHF Nachhaltigkeit, 24.09 KnowledgeScout]
status: konzept
---

# D1 · Veranstaltung aufsetzen (Designzeit)

**Grundlage:** [D0 Objektmodell](../beteiligung-objektmodell-original-und-kopie.plan.md),
Klasse **P · Planung**; Entscheidungen E1 („Datei zuerst“), E2
(Datei-Edit ändert kein laufendes Treffen), E3 (stabile Kennungen).
Geprüft gegen `master` 579f2d7.

## 1. Zweck und Screens

Die Redaktion bereitet eine Reihe und ihre Treffen vor:
- Welche Textstellen des Grundsatzdokuments gibt es?
- Welche Tische mit welchem Handlungsfeld und welcher Gruppe gibt es?
- Welche Textstelle wird an welchem Tisch in welcher Reihenfolge, mit
  welcher Leitfrage und welchem Verfahren behandelt?
- Wer moderiert, wer begleitet?

Gepflegt wird **in Dateien**: von Hand, in Obsidian, oder durch Cowork über
die MCP-Brücke. Die App liest die Dateien beim **Prüfen** und übernimmt sie
beim **Freigeben** als Snapshot.

| Screen (später) | Heute ohne Oberfläche |
|---|---|
| R-S0.1 Treffen anlegen | `_treffen.md` anlegen (Vorlage, Abschnitt 3.4) |
| R-S0.2 Inhalte je Handlungsfeld | Textstellen-Dateien (Abschnitt 3.2), Zerlegung durch Cowork (Abschnitt 7) |
| R-S0.3 Verfahren je Thema | Feld `verfahren` je Textstelle bzw. Agendapunkt |
| R-S0.4 Moderation einladen, Tisch-QR drucken | Rollen-Tabelle in `_tisch.md`; Einladung und QR sind D2 |
| (neu) Treffen prüfen / freigeben | Route + MCP-Werkzeug (Abschnitt 6) |

## 2. Objekte

| Objekt | Klasse | Original | Kopie | Kennung |
|---|---|---|---|---|
| Reihe | P | `Veranstaltungen/{Reihe}/_reihe.md` | `series` | `reihe_id` |
| Handlungsfeld | P | Tabelle in `_reihe.md` | `series.fieldsOfAction[]` | `handlungsfeld_id` |
| Interessengruppe | P | Tabelle in `_reihe.md` | `series.interestGroups[]` | Kürzel |
| Textstelle | P | `Veranstaltungen/{Reihe}/Textstellen/*.md` | `text_passages` (Katalog) + eingefrorene Kopie je Treffen in `meeting_tables.topics[]` | `textstelle_id` |
| Treffen | P (+ V für `state`) | `…/{Datum} {Titel}/_treffen.md` | `meetings` | `treffen_id` |
| Tisch mit Plan | P (+ V für `run`, `windows`) | `…/{Treffen}/Tisch {n}/_tisch.md` | `meeting_tables` | `tisch_id` |
| Rolle am Tisch | P | Tabelle in `_tisch.md` | `meeting_tables.roles[]` (Einladung → D2) | E-Mail |

## 3. Dateiformate

### 3.1 Allgemeine Regeln

1. **Frontmatter flach** (AGENTS.md):
   - `snake_case`-Schlüssel auf einer Ebene, keine Punkt-Schlüssel, keine
     verschachtelten Objekte.
   - Listen nur in der Flow-Form `[a, b]`. Sie werden mit `leseFlowListe`
     gelesen (`src/lib/mcp/storage/frontmatter-listen.ts:48`); Elemente
     dürfen weder `,` noch `[` `]` enthalten.
   - Grund: `parseFrontmatter` liefert `[a, b]` ohne JSON-Anführungszeichen
     als **String** zurück (`src/lib/secretary/response-parser.ts:50-93`).
     Block-Listen (`- a`) kommen als `""` zurück.
   - Ein Datum ist ein ISO-String (`2026-11-13`), eine Uhrzeit `HH:MM`.
   - **Keine Kommentare im Frontmatter.** Der Parser liest zeilenweise
     `key: value`. `modus: praesenz  # …` käme als Wert `praesenz  # …`
     zurück. Erlaubte Werte stehen deshalb in diesem Konzept, nicht in der
     Datei.
2. **Mehrzeilige Strukturen stehen im Body** als Markdown-Tabellen unter
   festen Überschriften (Handlungsfelder, Interessengruppen, Agenda,
   Rollen). Die Tischvereinbarung steht als nummerierte Liste da. So
   bleibt die Datei in Obsidian lesbar, und Cowork kann einzelne Zeilen mit
   `datei_patchen` → `tabelle_zeile_einfuegen` ergänzen.
3. **Kennungen:** `^[a-z0-9][a-z0-9-]{1,62}$`, eindeutig innerhalb der
   Library. Einmal vergeben, werden sie nie geändert. Umbenennen der Datei
   ist erlaubt, die Kennung bleibt (E3).
4. **Benennung im Storage:**
   - **Dateien** dürfen mit `_` beginnen (wie `_INDEX.md`), **Ordner nie**.
     Ein `_`-Ordner gilt als Twin-Ordner: Er wird versteckt, nicht
     gescannt, und die MCP-Brücke sperrt ihn
     (`packages/util/src/shadow-twin-folder-name.ts:16-18`,
     `schreibschutz.ts:57-75`, `tools-ordner.ts:22-29`).
   - Keine Planungsdatei `X.md` neben einer Datei `X.pdf`. Sie würde als
     Transkript-Artefakt der PDF gelesen
     (`resolve-sources.ts:52-61`, `artifact-naming.ts:156-163`).
   - Kein Sprachsuffix wie `.de.md`. Das Grundsatzdokument liegt deshalb in
     `Unterlagen/`, die Textstellen in `Textstellen/`.
5. **Unbekannte Felder** werden beim Prüfen als Hinweis gemeldet, nicht
   übernommen. **Fehlende Pflichtfelder** sind Fehler (keine stillen
   Standards, `no-silent-fallbacks`).

**Erlaubte Werte:**
- `abschnitt_art`: `vision | vortext | ziel | indikator`
- `verfahren`: `A | B`
- `modus`: `praesenz | online | zwischenraum`
- `kuratierung`: `notbremse | keine`
- `widerruf_bis`: `tisch_abschluss`
- `gehoert_zu`: optional; ein Indikator gehört zu einem Ziel, ein Ziel zum
  Vortext.
- `gueltige_fassung`: leer heißt Ausgangstext, sonst ein Wiki-Link auf ein
  Ergebnis (D10).
- `gruppe`: 1 ist die erste Gruppe eines Handlungsfelds, sie zeichnet die
  Vision.
- `baut_auf`: die `tisch_id` der Vorgruppe, leer bei Gruppe 1.

### 3.2 Textstelle — `Veranstaltungen/{Reihe}/Textstellen/{Kürzel} {Titel}.md`

```markdown
---
typ: textstelle
textstelle_id: hf1-ziel-03
reihe_id: shf-2026
handlungsfeld_id: hf1
abschnitt_art: ziel
kapitel: "3.2"
reihenfolge: 30
titel: Flächenverbrauch senken
gehoert_zu: hf1-vortext
verfahren: A
leitfrage: Was muss in diesem Ziel stehen, damit Sie es mittragen können?
gueltige_fassung: ""
---

(Der Wortlaut der Textstelle aus dem Grundsatzdokument, unverändert.)
```

Der **Body ist der Ausgangstext**. Hat die Redaktion eine Fassung
freigegeben (D10), setzt sie `gueltige_fassung` auf das Ergebnis-Dokument.
Die nächste Freigabe eines Treffens nimmt dann dessen Text. Die Datei der
Textstelle selbst wird nie überschrieben.

### 3.3 Reihe — `Veranstaltungen/{Reihe}/_reihe.md`

```markdown
---
typ: reihe
reihe_id: shf-2026
titel: Stakeholderforum Nachhaltigkeit 2026
zeitraum_von: 2026-11-13
zeitraum_bis: 2027-02-28
redaktion: [redaktion@beispiel.org]
sprachen: [de]
---

## Handlungsfelder

| handlungsfeld_id | Name | Kapitel |
|---|---|---|
| hf1 | Boden und Fläche | 3 |
| hf2 | Biodiversität | 4 |

## Interessengruppen

| Kürzel | Name |
|---|---|
| gem | Gemeinden |
| wirt | Wirtschaft |
| ngo | Zivilgesellschaft |
```

### 3.4 Treffen — `Veranstaltungen/{Reihe}/{Datum} {Titel}/_treffen.md`

```markdown
---
typ: treffen
treffen_id: shf-2026-t1
reihe_id: shf-2026
nummer: 1
datum: 2026-11-13
beginn: "14:00"
ende: "17:30"
modus: praesenz
ort: Messe, Saal 2
kuratierung: notbremse
widerruf_bis: tisch_abschluss
---

## Tischvereinbarung

1. Ihr Beitrag erscheint am Tisch.
2. Rohaufnahmen bleiben am Tisch.
3. Veröffentlicht wird auf Gruppenebene.
4. Der Tisch hat das letzte Wort.
```

Die Einstellungen `capture.*` und `konsens.*` aus den Konzepten stehen als
flache Felder hier. Aufgenommen werden nur die, die D3–D7 wirklich lesen
(`kuratierung`, `widerruf_bis`); weitere kommen mit dem Detailkonzept, das
sie braucht.

### 3.5 Tisch — `…/{Treffen}/Tisch {n}/_tisch.md`

```markdown
---
typ: tisch
tisch_id: shf-2026-t1-tisch2
treffen_id: shf-2026-t1
nummer: 2
handlungsfeld_id: hf2
gruppe: 1
baut_auf: ""
---

## Agenda

| Nr | Punkt | Art | Minuten | textstelle_id | Leitfrage | Verfahren |
|---|---|---|---|---|---|---|
| 1 | Ankommen, Tischvereinbarung | ankommen | 5 | | | |
| 2 | Vision zeichnen | vision | 20 | hf2-vision | | |
| 3 | Ziel 1 besprechen | besprechen | 20 | hf2-ziel-01 | | |
| 4 | Ernte Ziel 1 | ernte | 6 | hf2-ziel-01 | Was muss in diesem Ziel stehen, damit Sie es mittragen können? | |
| 5 | Vorschlag und Einwände | messung | 10 | hf2-ziel-01 | | A |
| 6 | Tisch-Abschluss | abschluss | 5 | | | |

## Rollen

| E-Mail | Rolle |
|---|---|
| moderation.tisch2@beispiel.org | moderation |
| fach@beispiel.org | fachbegleitung |
```

- `Art` ist eine feste Liste: `ankommen | vision | besprechen | ernte |
  messung | abschluss | pause`. Ein unbekannter Wert ist ein Fehler.
- Eine leere `Leitfrage` in der Agenda übernimmt die Leitfrage der
  Textstelle. Das ist eine dokumentierte Vererbung, kein stiller Standard:
  Der Prüfbericht zeigt die wirksame Leitfrage an.
- Dasselbe gilt für `Verfahren`.
- `Rolle` ist `moderation | fachbegleitung`. Die Redaktion steht in
  `_reihe.md`.

## 4. Treffen prüfen und freigeben

### 4.1 Zustände eines Treffens

```
(nur Datei) ──prüfen──► (Bericht, nichts geschrieben)
      │
      └──freigeben──► freigegeben ──starten──► laeuft ⇄ angehalten ──beenden──► beendet
                         ▲   │
                         └───┘ erneut freigeben (nur solange nicht gestartet)
```

- **Prüfen** schreibt nichts. Es liest die Dateien und liefert den
  **Prüfbericht**: Fehler, Warnungen, Hinweise und den Übernahmeplan.
  Muster: Modus `check` der Sync-Engine (`run-library-sync.ts:52`).
- **Freigeben** schreibt den Snapshot, und zwar nur, wenn der Prüfbericht
  **keine Fehler** hat und derselbe ist, den die Redaktion gesehen hat
  (`berichtHash` wird mitgeschickt; sonst 409). Das verhindert, dass eine
  zwischenzeitlich geänderte Datei ungeprüft übernommen wird.
- **Erneut freigeben** ersetzt den Snapshot vollständig (neue `version`).
  Das geht nur, solange das Treffen nicht `laeuft`, `angehalten` oder
  `beendet` ist (E2); sonst 409 mit klarer Meldung.
- **Abweichung nach der Freigabe:** Ein späterer Prüflauf vergleicht
  `version` und `contentHash` jeder Quelldatei mit dem Snapshot. Er meldet
  „Plan geändert seit Freigabe“ als Hinweis, er übernimmt nichts. Das
  Muster ist `stand_widerspruch` der Agentensicht.

### 4.2 Was gelesen wird

Die Freigabe eines Treffens liest diese Dateien:
- `_treffen.md` des Treffenordners;
- alle `Tisch */_tisch.md` darunter;
- `_reihe.md` der Reihe (ein Ordner höher);
- **nur die Textstellen, die eine Agenda nennt**, gefunden über
  `textstelle_id` im Ordner `Textstellen/`;
- bei gesetzter `gueltige_fassung` das dort verlinkte Ergebnis.

Rekursiv gelesen wird mit begrenzter Tiefe (Muster `listeOrdner`,
`src/lib/mcp/storage/listen.ts:103`, oder `scanArchive`,
`src/lib/agent-view/archive-scan.ts:49`).

### 4.3 Prüfregeln

| Regel | Stufe |
|---|---|
| Pflichtfelder je `typ` vorhanden, Typen stimmen (Zahl, Datum, Aufzählung) | Fehler |
| Kennungen gültig und in der Library eindeutig | Fehler |
| `reihe_id` von Treffen und Tisch passt zur `_reihe.md` darüber; `treffen_id` des Tisches passt | Fehler |
| Jede `textstelle_id` der Agenda existiert genau einmal in `Textstellen/` | Fehler |
| `handlungsfeld_id` steht in der Tabelle der Reihe; die Textstellen der Agenda gehören zu diesem Handlungsfeld | Fehler bzw. Warnung (Querbezug erlaubt, aber sichtbar) |
| Tischnummern im Treffen eindeutig; `gruppe` ≥ 1; `baut_auf` zeigt auf einen existierenden Tisch derselben Reihe mit `gruppe` − 1 | Fehler |
| Agenda-Art aus der festen Liste; eine Ernte oder Messung ohne `textstelle_id` | Fehler |
| Summe der Minuten gegen `beginn`/`ende` | Warnung |
| Ernte ohne wirksame Leitfrage | Fehler |
| E-Mail-Format in Rollen; jede Moderation höchstens an einem Tisch je Treffen (Owner 21.09.: eine Moderatorin je Tisch) | Fehler |
| Flow-Liste nicht lesbar (bleibt String) | Fehler mit Zeile |
| Unbekanntes Feld, unbekannte Tabellenspalte | Hinweis |
| Datei `X.md` neben `X.pdf` im Treffenordner | Fehler („würde als Transkript gelesen“) |

### 4.4 Der Übernahmeplan

Er ist eine reine Funktion `baueFreigabePlan(snapshotAlt | null, gelesen)`
nach dem Muster `sync-plan/*`. Jede Operation hat ein `kind` aus
`anlegen | aendern | unveraendert | entfernen`, dazu das Objekt, die
Kennung und die geänderten Felder. „Entfernen“ heißt: Ein Tisch oder eine
Textstelle ist aus den Dateien verschwunden. Das ist erlaubt, solange das
Treffen nicht gestartet ist, und wird ausdrücklich gezeigt.

## 5. Der Snapshot in der Datenbank

Alle Dokumente tragen `libraryId` und `provenance`:

```ts
interface PlanProvenance {
  fileId: string            // Zwischenspeicher; kann nach Umzug veralten (E3)
  path: string              // library-relativ, zum Wiederfinden
  version?: string          // Provider-Version (eTag bzw. mtime+size), packages/contracts/src/storage-provider.ts:39-98
  contentHash: string       // SHA-256 über den normalisierten Dateiinhalt
  readAt: string
}
```

| Collection | Schlüssel (unique) | Inhalt |
|---|---|---|
| `series` | `(libraryId, seriesId)` | `title`, `from`, `to`, `editors[]` (E-Mails), `languages[]`, `fieldsOfAction[] {id, name, chapter}`, `interestGroups[] {code, name}`, `provenance` |
| `text_passages` | `(libraryId, passageId)` | `seriesId`, `fieldOfActionId`, `kind`, `chapter`, `order`, `title`, `belongsTo?`, `procedure`, `guidingQuestion`, `validVersionRef?`, `provenance` — Katalog, bei jeder Freigabe aufgefrischt |
| `meetings` | `(libraryId, meetingId)` | `seriesId`, `number`, `date`, `start`, `end`, `mode`, `place`, `agreement[]`, `settings {curation, withdrawUntil}`, `state` (V), `release {version, at, by, reportHash}`, `provenance` |
| `meeting_tables` | `(libraryId, tableId)`; Index `(meetingId, number)` | `meetingId`, `number`, `fieldOfActionId`, `group`, `buildsOn?`, `agenda[] {no, label, kind, minutes, passageId?, guidingQuestion?, procedure?}`, `topics[] {passageId, title, text, textHash, sourceRef}` (**eingefrorener Text** für dieses Treffen), `roles[] {email, role}`, `qrToken` (D2), `run`, `windows[]` (V, D4), `provenance` |

**Eingefrorener Text:** Die Teilnehmenden sehen während des Treffens den
Text, der bei der Freigabe galt. Ändert die Redaktion später die
Textstelle, bleibt das laufende Treffen unberührt (E2), und die Historie
bleibt nachvollziehbar (`textHash`).

**Atomar:** Die Freigabe schreibt alle Dokumente eines Treffens in **einer
MongoDB-Transaktion**, oder als neue `release.version` mit Umschalten am
Ende. Ein halber Snapshot darf nie entstehen. Scheitert das Lesen einer
Datei, wird nichts geschrieben.

## 6. Schnittstellen

### 6.1 Bestand, der genutzt wird

| Zweck | Bestand |
|---|---|
| Provider auf dem Server, auch für Co-Creator | `getServerProvider(userEmail, libraryId)` mit Fallback `isCoCreatorOrOwner` (`src/lib/storage/server-provider.ts:57-78`). **Nicht** `runLibrarySync`: Das geht über `getLibrary(userEmail)` und damit nur für Owner (`run-library-sync.ts:66`) |
| Pfad → Ordner/Datei | `resolveItemByPath`, `resolveFolderIdByPath` (`src/lib/mcp/resolve-folder.ts:77`, `:126`) |
| Ordner rekursiv lesen | `listeOrdner` (`listen.ts:103`) bzw. `scanArchive` (`archive-scan.ts:49`); Änderungserkennung wie `berechneFingerabdruck` (`check-stand.ts:81-97`) |
| Frontmatter lesen | `parseFrontmatter` (`src/lib/markdown/frontmatter.ts:12`), `leseFlowListe` |
| Abschnitt finden | `findeAbschnitt` (`src/lib/mcp/storage/bereich.ts:89`) |
| Rechte | `isCoCreatorOrOwner` (`library-members-repo.ts:490`), Redaktion zusätzlich über `series.editors[]` (D11) |
| Protokoll | `protokolliereAktion` (`src/lib/repositories/aktions-protokoll-repo.ts:92`): jede Freigabe mit Begründung. **Anpassung nötig:** Der Eintragstyp lässt heute nur `kanal: 'bruecke'` zu (`:50`); dazu kommt `kanal: 'app'` (D11) |
| Pflege durch Cowork | MCP `datei_anlegen`, `datei_patchen` (`tabelle_zeile_einfuegen`, `frontmatter_setzen`), `pfad_aufloesen` |

### 6.2 Neu

| Baustein | Ort | Signatur |
|---|---|---|
| Tabellen-Parser | `src/lib/markdown/markdown-table.ts` (neu, geteilt; die Helfer in `patch-einfuegen.ts:75-84` sind nicht exportiert) | `leseTabelle(body: string, ueberschrift: string): { spalten: string[]; zeilen: Record<string, string>[] } \| null` |
| Planungsdatei-Parser (rein) | `src/lib/deliberation/plan/parse-plan-file.ts` | `parsePlanFile(name: string, markdown: string): PlanFileResult` (typisiert je `typ`, mit Fehler- und Hinweisliste und Zeilenangaben) |
| Treffenordner lesen | `src/lib/deliberation/plan/read-meeting-folder.ts` | `readMeetingFolder(provider, meetingFolderId): Promise<GelesenerPlan>` |
| Prüfen (rein) | `src/lib/deliberation/plan/validate-plan.ts` | `validatePlan(gelesen): PruefBericht` |
| Übernahmeplan (rein) | `src/lib/deliberation/plan/build-release-plan.ts` | `buildReleasePlan(alt: MeetingSnapshot \| null, gelesen): FreigabePlan` |
| Freigeben | `src/lib/deliberation/plan/apply-release.ts` | `applyRelease(libraryId, plan, by): Promise<MeetingSnapshot>` |
| Routen | `src/app/api/deliberation/[libraryId]/meetings/check/route.ts` | `POST {meetingFolderPath \| meetingFolderId}` → `PruefBericht` + `berichtHash` |
| | `…/meetings/release/route.ts` | `POST {meetingFolderId, berichtHash, begruendung}` → Snapshot oder 409 |
| | `…/meetings/[meetingId]/route.ts` | `GET` → Snapshot mit Zustand |
| MCP (für Cowork) | `src/lib/mcp/tools-beteiligung.ts` | `treffen_pruefen`, `treffen_freigeben` (Begründung Pflicht, wie die übrigen schreibenden Werkzeuge) |

Alles unter `src/lib/deliberation/**` wandert später nach
`@ks/module-deliberation`. Die Routen folgen `api-route-conventions.md`:
Params awaiten, Auth zuerst, keine stillen Fallbacks.

## 7. Grundsatzdokument → Textstellen

Es gibt keinen Bestand, der ein Dokument in viele Dateien nach Kapiteln
zerlegt. `split-pages` trennt nach Seitenmarkern
(`src/app/api/library/[libraryId]/markdown/split-pages/route.ts`) und passt
nicht. Für D1 gilt deshalb **„Datei zuerst“ auch hier**:

1. Das Grundsatzdokument liegt als PDF in `Veranstaltungen/{Reihe}/Unterlagen/`
   und wird wie jede Quelle transkribiert (Bestand).
2. **Cowork** zerlegt das Transkript über die Brücke. Eine Vorlage im Archiv
   beschreibt die Regeln: je Vision, Vortext, Ziel und Indikator eine
   Datei nach 3.2, Wortlaut unverändert, Kennungen nach Schema. Die
   Dateien werden mit `datei_anlegen` geschrieben.
3. Die Redaktion liest die Textstellen gegen und korrigiert sie in der
   Datei.
4. `treffen_pruefen` zeigt, welche Textstellen die Agenden nutzen und
   welche fehlen.

Ein App-eigener Zerlegungs-Assistent ist Teil der späteren
Redaktions-Oberfläche (R-S0.2) und kein Teil des Fundaments.

## 8. Fehlerfälle (ohne stillen Fallback)

| Fall | Verhalten |
|---|---|
| Storage nicht erreichbar oder Anmeldung abgelaufen | Prüfen bzw. Freigeben scheitert mit Meldung; nichts wird geschrieben |
| Datei zwischen Prüfen und Freigeben geändert | 409 „Bericht veraltet, erneut prüfen“ (`berichtHash`) |
| Treffen läuft bereits | 409 „Treffen läuft, Plan eingefroren“ (E2) |
| Textstelle doppelt (gleiche Kennung in zwei Dateien) | Fehler mit beiden Pfaden |
| `gueltige_fassung` zeigt ins Leere | Fehler |
| Aufrufer ist weder Owner/Co-Creator noch Redaktion der Reihe | 403 |

## 9. Tests (ohne Mongo, ohne Netz)

- `leseTabelle`: Tabellen mit leeren Zellen, fehlender Trennzeile,
  zusätzlichen Spalten; Abschnitt fehlt.
- `parsePlanFile` je `typ`: gültig, fehlendes Pflichtfeld, falsche
  Aufzählung, Flow-Liste als String, unbekanntes Feld (Hinweis).
- `validatePlan`:
  - jede Regel aus 4.3 einzeln;
  - wirksame Leitfrage und wirksames Verfahren (Vererbung von der
    Textstelle);
  - `baut_auf` über Gruppen hinweg;
  - Namenskonflikt `X.md` neben `X.pdf`.
- `buildReleasePlan`: erstes Freigeben, unverändert, geändertes Feld,
  entfernter Tisch; eingefrorener Text mit `textHash`.
- Route: 403, 409 bei laufendem Treffen, 409 bei veraltetem `berichtHash`
  (Repos gemockt).

## 10. Offene Fragen

1. **Sechs Tische, neun Kapitel:** Die Zuordnung Handlungsfeld → Tisch
   liefert die Redaktion. Das Modell erlaubt beides (ein Tisch mit einem
   Handlungsfeld, mehrere Treffen je Handlungsfeld).
2. **Mehrsprachigkeit DE/IT:** `sprachen` steht in der Reihe. Ob
   Textstellen eine zweite Sprache tragen (`titel_it`, Body-Abschnitt), ist
   offen.
3. **Online und Zwischenraum:** Der Modus ist ein Feld. Was er an der
   Laufzeit ändert, klärt D4.
4. **Vorlagen für neue Dateien:** Legt Cowork `_treffen.md` und `_tisch.md`
   aus einer Vorlage im Archiv an, oder hat die App einen Knopf „Gerüst
   anlegen“? Vorschlag: zuerst die Vorlage im Archiv.

## 11. Aufwand und Einordnung

| Teil | PT |
|---|---|
| Tabellen-Parser, Planungsdatei-Parser, Prüfregeln (rein, mit Tests) | 1,5–2 |
| Ordner lesen, Übernahmeplan, Freigabe mit Transaktion, Repos `series`, `text_passages`, `meetings`, `meeting_tables` | 1,5–2 |
| Routen, MCP-Werkzeuge, Protokoll | 1 |
| **Summe D1** | **4–5** |

Das ersetzt in der Bau-Reihenfolge den Seed-Teil von G2. Das
Seed-Skript entfällt: Das Probe-Treffen ist ein Ordner mit Dateien.
