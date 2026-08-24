# Projektauftrag: Agentensicht v2 — Die Werkbank

Stand: 2026-08-22 · Entwurf zur Abnahme. Grundlage:
[`projektauftrag-agentensicht.md`](projektauftrag-agentensicht.md) (v1, Wellen
0a–5 umgesetzt), [`erschliessungszyklus.md`](erschliessungszyklus.md),
[`twin-datei-contract.md`](twin-datei-contract.md). Die F-Nummerierung und die
Leitprinzipien setzen v1 fort; alles dort Beschlossene gilt weiter.

**Ein Satz:** *v1 zeigt, was fehlt — v2 ist der Ort, an dem Peter es sich
vornimmt und abarbeitet.*

---

## 1. Kontext und Anlass

Die Agentensicht v1 beantwortet, was ein Agent im Archiv versteht und was ihm
fehlt: Baum mit Ampeln, Zyklus-Board, Todo-Listen mit Auftrags-Generator,
MCP-Brücke. Funktional ist das komplett — als Arbeitsoberfläche reicht es
nicht:

- **Nichts ist klickbar.** Ordnerzeilen klappen nur auf und zu, Board-Karten
  tun gar nichts, `BERICHT.md`-Icons sind Dekoration. Der Bericht — das
  zentrale Artefakt jedes Vorhabens — ist in der Sicht nirgends lesbar.
- **Keine Filter, keine Auswahl.** Bei der Pilot-Library mit einer Handvoll
  Vorhaben geht das; „Archiv Peter" hat ~1200 Ordner und 101+ Projektordner.
  Dort ist eine ungefilterte Vollansicht keine Übersicht, sondern Rauschen.
- **Kein Arbeitsvorrat.** Peters tatsächliche Arbeitsweise: sich **einige
  Projekte vornehmen**, diese abarbeiten, dabei sehen, was erledigt ist und
  was nicht — in zwei getrennten Kontexten („woran arbeite ich gerade" und
  „welche Vergangenheit räume ich gerade auf"). Die Sicht kennt dieses
  Vornehmen nicht.
- **Abnahme ist umständlich.** Ist ein Vorhaben aufgeräumt (keine maschinellen
  Befunde mehr), muss der erklärte Stand heute außerhalb der Sicht gesetzt
  werden — obwohl die Sicht genau weiß, dass es „bereit zur Abnahme" ist.

v2 baut deshalb den Baum-Tab zur **Werkbank** um: links eine filterbare
Vorhaben-Liste, rechts das Detail mit gerendertem Bericht, Befunden und
Aktionen — inklusive Arbeitslisten (Arbeitsvorrat) und geschützter
Ein-Klick-Abnahme. Zyklus-Board und Todos & Auftrag bleiben bestehen und
verlinken in die Werkbank.

## 2. Leitprinzipien

Die sechs v1-Prinzipien gelten unverändert (Komposition statt Neubau;
berechnet, nie Wahrheit; der Contract ist die Spezifikation;
storage-agnostisch; anzeigen und beauftragen; doppelte Buchhaltung). v2
ergänzt zwei:

7. **Drei Bücher.** Der Bestand kennt jetzt drei getrennte Wissensarten:
   das **erklärte** Buch (Frontmatter: `bearbeitungsstand` im `_INDEX.md`,
   `status`/`themen` im `BERICHT.md`), das **berechnete** Buch (der
   wegwerfbare Coverage-Report) — und neu das **persönliche** Buch: die
   Arbeitsliste. „Was ich mir vorgenommen habe" ist weder Archiv-Wahrheit
   noch ableitbar; es ist Planungszustand eines Users und lebt deshalb in
   MongoDB pro User+Library, nie im Frontmatter. Arbeitslisten sind vom
   Report-Wegwerf-Test unabhängig: Report löschen darf keine Liste löschen,
   Liste löschen fasst weder Report noch Archiv an (Kreuztest,
   Akzeptanzkriterium 2).
8. **Jeder Schreibweg ist eine explizite, benannte, geschützte Route.** v1
   formulierte „einzige Schreiboperation ist der Kurations-Patch"; faktisch
   ist der Sichten-Export (`AKTUELL.md`/`PROJEKTE.md` nach `Organisation/`)
   längst ein zweiter kontrollierter Schreibweg. v2 präzisiert das Prinzip
   statt es zu brechen: Schreibwege sind abzählbar, tragen je einen
   409-Fehlerkatalog und schreiben bei Fehlern nichts. Bestand: Kuration
   (Contract §4) · Sichten-Export · neu: **Stand** (F8).

## 3. Begriffe

- **Werkbank** — der neue Master-Detail-Tab (ersetzt „Baum" als Default).
- **Vorhaben** — Arbeitseinheit des Zyklus (`isVorhaben`: Selbstdeklaration
  oder Ordnermuster); im Report die `VorhabenCard`.
- **Arbeitsliste** — benannte, von Hand kuratierte Menge von Vorhaben eines
  Users („Aktuelle Projekte", „Aufräumen 2019", …). Buch 3.
- **Zu tun** — Vorhaben mit `ampel ≠ grün` oder `widerspruch` (Grün-Definition
  aus v1, Akzeptanzkriterium 7).
- **Ampel** (präzisiert 24.08.2026, Befund aus Peters Live-Test: die alte
  Severity-Regel machte im Voll-Archiv alle 148 Vorhaben rot und unterschied
  nichts) — AKTEUR-basiert, dieselbe Geschichte wie „bereit zur Abnahme":
  **rot** = maschinelle Befunde (Cowork/KnowledgeScout) offen, unabhängig von
  der Severity; **gelb** = nur noch Mensch-Befunde offen (= das geteilte
  Prädikat); **grün** = kein Befund im Teilbaum. Der F8-Abnahme-Precheck (W7)
  urteilt weiterhin strenger über Severity `error`/`warning`.
- **Bereit zur Abnahme** — keine maschinellen Befunde (Akteur ≠ Mensch) offen,
  mindestens ein Mensch-Befund wartet. Ein geteiltes Prädikat für UI und MCP
  (heute doppelt: `coverage-progress.tsx` und `mcp/coverage-view.ts`).
- **Außerhalb von Vorhaben** — Befunde an Strukturebenen/Wurzel, die zu keiner
  `VorhabenCard` gehören; als Pseudo-Zeile sichtbar, nie still verschluckt.

## 4. Funktionsumfang

### F6 — Werkbank: Master-Detail statt Baum

`ResizablePanelGroup` (Muster `library.tsx`, Pane-Größen in `uiPanePrefsAtom`):
links (~30 %, min. 20 %) Filterleiste + Vorhaben-Liste, rechts (~70 %) das
Detail des ausgewählten Vorhabens. Mobil gestapelt: Auswahl wechselt in die
Detail-Ansicht, Zurück-Geste führt zur Liste.

**Liste statt Ordnerbaum.** Die primäre Fläche ist die flache
`VorhabenCard[]`-Liste, gruppiert nach Bereich (erstes Pfadsegment,
einklappbare Gruppenkopfzeilen) — denn der Zyklus läuft pro Vorhaben („ein
Ordner, ein Durchlauf"), und von ~1200 Ordnern sind die meisten Ereignis- oder
Strukturordner, also Navigationsrauschen. Ein Umschalter `Vorhaben | Baum`
behält den bestehenden `CoverageTree` als Zweitmodus (F1 bleibt erfüllt),
dessen Zeilen jetzt ebenfalls ein Vorhaben ins Detail wählen; Default-Tiefe
im Baum: 2 aufgeklappt statt heute alles. Die Gruppierung der Liste ist
ihrerseits umschaltbar: „Gruppieren nach: Bereich | Thema" (F12, Welle W5).

**Listenzeile** (zweizeilig): Ampel · Name (Bericht-Titel als Zweitzeile bzw.
Tooltip) · Widerspruch-Symbol · Pin (Arbeitslisten-Mitgliedschaft). Darunter
gedämpft: Stand-Badge („—" bei null) · Befundzähler je Akteur („M 2 · C 1 ·
K 4") · Bericht-Indikator · „bereit"-Badge.

**Filter, Suche, Sortierung** (alles URL-Zustand via `nuqs`, teilbar):

- Segmented-Umschalter **`Alle | Zu tun | Bereit | Liste ▾`** („Liste" öffnet
  die Arbeitslisten des Users). Default beim Laden: **Zu tun** — die Werkbank
  öffnet auf der Arbeit, nicht auf dem Inventar.
- Chips **Akteur** (Mensch/Cowork/KnowledgeScout) und **Zyklus-Schritt** (1–4)
  — exakt die Filter-Semantik der MCP-Kompaktsicht, als geteilte Funktionen
  aus `mcp/coverage-view.ts` extrahiert, damit UI und MCP nicht driften.
- Suche über Name + Pfad + Bericht-Titel (debounced, clientseitig).
- Sortierung: Pfad (Default, deterministisch) · Stand · offene Befunde.
- **Ein leerer Filter nennt immer den Grund** (`describeEmptyFilter`-Muster):
  „Arbeitsliste ist leer", „Suche ohne Treffer in 101 Vorhaben", „Report ist
  ein Teilbaum-Report (Scope: …)" — nie eine stumme leere Fläche.

**Verlinkung:** Zyklus-Board-Karten und Todo-Zeilen werden klickbar und
navigieren auf `?tab=werkbank&vorhaben=<folderId>`; Board und Todos bleiben
sonst unverändert. Der Tab-Zustand wandert von unkontrolliertem
`defaultValue` in die URL (`?tab=`).

### F7 — Arbeitslisten (der Arbeitsvorrat)

Ein User hat 0..n benannte Listen je Library. Mitgliedschaft: Pin an der
Listenzeile, „Zu Liste hinzufügen" im Detail-Kopf (inkl. Liste-neu-anlegen).
Schlüssel ist die **folderId** (Provider-IDs sind auf OneDrive move-stabil —
Umbenennen und Verschieben brechen die Bindung nicht); der `pathSnapshot` wird
nur gespeichert, um tote Einträge anzuzeigen.

- **Fortschrittskopf** bei aktiver Liste: „n von m abgenommen · k bereit zur
  Abnahme · offene Befunde M/C/K" plus segmentierter Fortschrittsbalken
  (abgenommen ohne Widerspruch → fertig; bereit → zweite Farbe; Rest offen).
  Rein clientseitig aus dem Report berechnet — keine Server-Aggregation.
- **Tote Einträge sichtbar:** Listenmitglieder, die der letzte Scan nicht
  enthält (gelöschter/aufgelöster Ordner, Teilbaum-Report), erscheinen als
  „nicht im letzten Scan"-Zeile mit gemerktem Pfad und sind dort entfernbar —
  angezeigt, nicht still verworfen.
- **Seeding (optional):** Beim Anlegen einer Liste „Vorhaben mit
  `status: aktiv` übernehmen" — eine einmalige Kopie aus dem erklärten Buch
  (Feld existiert im `BERICHT.md`-Frontmatter, F9 trägt es in die
  `VorhabenCard`). Die Mitgliedschaft bleibt danach manuell; die Liste wird
  bewusst NICHT mit dem Status synchron gehalten (Buch 3 ≠ Buch 1).
- Listen sind in v2 **privat je User** (userEmail-scoped); Teilen/Übergeben
  ist ein offener Punkt.

### F8 — Stand setzen und Abnehmen (neuer Schreibweg „Stand")

Im Detail-Kopf: primärer Button **„Abnehmen"** (nur aktiv, wenn bereit zur
Abnahme; deaktiviert nennt der Tooltip die Blocker, z. B. „2
KnowledgeScout-Befunde offen") sowie ein Stand-Menü mit **„Stand bestätigen"**
(gleicher Stand, `bearbeitungsstand_seit` neu — löst `stand_widerspruch` nach
menschlicher Prüfung auf) und **„Zurückstufen auf …"**; auch ein höherer
Nicht-Abnahme-Stand (z. B. `berichtet`) ist setzbar — alles menschliche
Selbstdeklaration.

Route `POST /api/library/{id}/agent-view/stand`, Body
`{ folderId, stand, erwarteterStand, reportGeneratedAt, bestaetigen? }`.
Aufbau wie die Kurations-Route: reines Entscheidungsmodul (`stand-plan.ts`,
typisierte Fehler) + dünne Route. Geschrieben wird ausschließlich über den
gemeinsamen Frontmatter-Patch (`frontmatter-patch.ts`, Single-Serializer,
flaches snake_case): nur `bearbeitungsstand` + `bearbeitungsstand_seit`
(Server-Datum), Body und unbekannte Felder bleiben unangetastet. Die neue
fileId des `_INDEX.md` ist unerheblich — überall ist die folderId der
Schlüssel.

**Schutzstufen** (benannte 409-Antworten; bei Fehler wird nichts geschrieben):

1. `kein_index` — der Ordner hat kein `_INDEX.md`. Die Route legt **nie**
   eines an (Index-Autorenschaft ist Cowork-Inhaltsarbeit — „anzeigen und
   beauftragen"); die UI bietet stattdessen den Auftrag an.
2. `stand_geaendert` — der aktuell in Storage erklärte Stand ≠
   `erwarteterStand` (jemand war schneller; das Spiegel-Drift-Prinzip der
   Kurations-Route, angewandt aufs `_INDEX.md`).
3. `report_veraltet` — `reportGeneratedAt` ≠ `generatedAt` des gespeicherten
   Reports (der Client urteilt auf veralteter Sicht; erst neu laden).
4. Nur bei `stand: 'abgenommen'`: die Route rechnet einen **frischen,
   ungespeicherten Teilbaum-Scan** des Vorhabens und antwortet
   `nicht_bereit` mit der Befundliste, wenn JETZT maschinelle Befunde
   (Akteur ≠ Mensch, Severity error/warning) offen sind. „Keine Befunde
   offen" ist damit eine Aussage über die Gegenwart, nicht über den letzten
   Scan. Zurückstufen und `bestaetigen` überspringen Stufe 4 (reine
   Selbstauskunft), behalten aber 1–3.

Nach Erfolg überlagert die UI den neuen Stand lokal bis zum nächsten Scan
(Muster `use-twin-curation.ts`) und sagt das dazu („erklärter Stand geändert —
Report zeigt noch den alten Scan").

**Philosophie:** Der Klick ist eine menschliche Selbstauskunft ins Soll-Buch.
Die Maschine setzt `abgenommen` nie selbst — sie weigert sich nur, eine
Selbstauskunft zu beurkunden, die ihr frisches Ist-Buch bereits widerlegt.
Das ist doppelte Buchhaltung zur Schreibzeit: die Umkehrung von „nie still
korrigieren" heißt „nie blind beurkunden".

### F9 — Der Bericht im Detail

**Report-Erweiterung** (Scan liest die Contract-Bodies heute schon und
verwirft sie; es kommen nur Kleinst-Skalare in die `VorhabenCard`): `ampel`
(vom Baumknoten übernommen), `berichtTitel` (H1 via vorhandenem
`titelLesen`), `berichtFileId`, `berichtModifiedAt`, `berichtStatus`
(Frontmatter `status`), `themen` (Frontmatter-Liste, für F12/W5). Alte Reports ohne die Felder → sichtbarer Hinweis
„für Titel/Status neu scannen" (Muster „Scan vor Welle 4"). Der volle Body
bleibt draußen — 512 KB × 100+ Vorhaben sprengte das eine Mongo-Dokument.

**Neue Lese-Route** `GET /api/library/{id}/agent-view/bericht?folderId=…`:
der Server sucht `BERICHT.md` im Ordner und liefert
`{ bericht: { fileId, name, modifiedAt, sizeBytes, body, kopf } | null,
grund?: 'kein_bericht' | 'zu_gross' }` — `kopf` (Titel, erster Absatz,
offene Punkte) serverseitig via `bericht-lesen.ts`, der Client parst kein
Markdown-Gerüst. Semantik: unbekannter Ordner → 404-Fehler; Ordner ohne
Bericht → **200 mit `grund: 'kein_bericht'`** (legitimer Domänenzustand, den
die UI als Cowork-Befund rendert, kein Fehler); Body über 512 KB → 200 mit
Metadaten, `body: null`, `grund: 'zu_gross'` („im Archiv öffnen" statt
abgeschnittener Vorschau). Die UI bleibt API-only — Provider-Wissen wohnt in
der Route (Akzeptanzkriterium 5 aus v1 hält).

**Detail-Panel** (von oben nach unten):

1. Kopf: Name + Pfad-Breadcrumb · Stand-Badge + `seit` · Ampel ·
   Widerspruchs-Banner („abgenommen, aber nicht mehr aktuell"). Aktionen:
   „Im Archiv öffnen" (`/library?folderId=…`), „Zu Liste hinzufügen",
   Stand-Menü (F8); ab F10 zusätzlich „Teilbaum neu scannen".
2. „Bereit zur Abnahme"-Leiste (grün, nur wenn Prädikat wahr): „Keine
   maschinellen Befunde offen — n Punkte warten auf dich" — reiner Status,
   ohne eigenen Button. Abnehmen wohnt allein im Detail-Kopf (ein CTA;
   Feedback vom 23.08.2026: kein doppelter Call-to-Action).
3. **BERICHT.md gerendert** (`MarkdownPreview` compact, lazy via
   TanStack Query): Kopfzeile „BERICHT.md · geändert … · im Archiv öffnen
   (`?openFileId=<berichtFileId>`)", „veraltet"-Badge bei
   `bericht_veraltet`-Befund. Leerzustände s. o.
4. **Befunde des Teilbaums**, gruppiert nach Akteur (drei einklappbare
   Gruppen mit Zählern), darin nach Zyklus-Schritt; je Cowork-Gruppe
   **„Auftrag kopieren (dieses Vorhaben)"** — der bestehende
   `auftrag-generator`, gefüttert mit genau den Befunden dieses Ordners.
   Kappungshinweis, wenn `totalGaps` größer ist als die gelisteten Befunde
   (Gap-Budget 5000).
5. **Twin-Familien** des Teilbaums (bestehende `twin-family-row` inkl.
   `twin_status`-Dropdown und Verifizieren — der Kurations-Schreibweg bleibt,
   wo er ist).
6. Fußzeile: Quellen-/Dateizähler, Scan-Zeitpunkt, kopierbare folderId (für
   MCP-/Teilbaum-Werkzeuge).

Leerzustände des Panels: nichts gewählt → „Vorhaben links wählen" + die
Library-Totalen; gewählter Ordner nicht im Report → „nicht im letzten Scan"
mit Scan-CTA.

### F10 — Teilbaum-Scan mit Merge

Heute ersetzt ein gespeicherter Teilbaum-Scan den Voll-Report (ein Dokument
je Library, `scope` inklusive) — ein „Teilbaum neu scannen"-Button im Detail
würde die Werkbank-Liste zerstören. Deshalb gestuft:

- Der **Abnahme-Precheck** (F8, Stufe 4) rechnet einen Teilbaum-Scan und
  speichert ihn **nie** (`scanLibraryCoverage` trennt Rechnung und
  Persistenz bereits) — funktioniert ab F8, ohne Merge.
- Die **Merge-Welle** ersetzt beim Teilbaum-Scan nur die Knoten, Befunde und
  Familien des Teilbaums im gespeicherten Report und rechnet Totale und
  Vorhaben-Karten neu. Testkriterium: Voll-Scan und Merge-Ergebnis sind
  ununterscheidbar (Wegwerf-Prinzip bleibt beweisbar). Erst mit dieser Welle
  erscheint der Button im Detail; bis dahin gibt es nur das globale
  „Neu scannen" plus ein Scope-Banner, wenn der gespeicherte Report ein
  Teilbaum-Report ist.
- **Geliefert mit W8** (24.08.2026): `report-merge.ts` (+ Guards/Umbau),
  Invarianz per Deep-Equal-Test bewiesen (`report-merge.test.ts`) — auch die
  teilbaum-uebergreifenden Regeln `stand_widerspruch`/`bericht_veraltet` an
  Scope-VORFAHREN, moeglich durch neue Knoten-Skalare (eigene juengste
  Aenderung, Bericht-Frische; Reports vor W8 brauchen einmal einen
  Voll-Scan). Nicht mergebare Lagen sind benannte Fallbacks (u. a.
  ungesichteter Vorfahr, gekappte Listen) — dann ersetzt der Teil-Report wie
  zuvor, die UI sagt warum. Bekannte, dokumentierte Grenzen des
  Teilbaum-Scans selbst: das Verweis-Audit loest ueber die Scope-Grenze in
  beide Richtungen erst der naechste Voll-Scan sauber auf.

### F11 — Nicht-Ziele v2

Kein Coverage-Verlauf über Zeit, keine LLM-Prüfung, kein Umbau der
Archiv-Ansicht, kein Watcher und kein Progress-Streaming (SSE), kein
virtualisierter Baum (der Baum-Modus skaliert über Einklappen), keine
geteilten Arbeitslisten, kein Themen-Editor in der Sicht (Pflege nur im
Frontmatter — die Themen-**Gruppierung** selbst ist seit 23.08. Scope, F12), kein
Ordner-Umzug/-Merge (nur Ausblick §12), keine i18n-Umstellung (die Sicht
bleibt durchgängig deutsch wie v1).

## 5. Datenhaushalt: welche Daten wohnen wo

| Datum | Ort | Buch | Schreibweg |
|---|---|---|---|
| `bearbeitungsstand`, `_seit` | `_INDEX.md`-Frontmatter | erklärt | **neu:** Stand-Route (F8) · Cowork · Hand |
| `status`, `themen`, Termine | `BERICHT.md`-Frontmatter | erklärt | Cowork · Hand (KS liest nur) |
| Baum, Befunde, Karten, Familien, Ampeln, Bericht-Titel/FileId/Status | Coverage-Report (1 Mongo-Doc/Library) | berechnet | Scan (wegwerfbar) |
| Bericht-Body | Storage, on demand | — | Lese-Route (F9), nie persistiert |
| Arbeitslisten | `agent_view_worklists__<libraryId>` (Mongo, je User) | persönlich | Worklist-Routen (F7) |
| `twin_status`, Verifikation | Twin-Frontmatter/Mongo | erklärt | Kurations-Route (v1 F4) |

Arbeitslisten-Dokument: `{ libraryId, userEmail, listId, name, position,
folders: [{ folderId, pathSnapshot, name, addedAt }] }`, Unique-Indizes
`(userEmail, listId)` und `(userEmail, name)`; Repository nach
[`mongodb-repository-pattern.md`](../architecture/mongodb-repository-pattern.md).
Routen: `GET/POST …/agent-view/worklists`,
`PATCH/DELETE …/agent-view/worklists/{listId}` (PATCH: `name`, `add`,
`remove`). Benannte Fehler: 409 `name_vergeben`, 404 unbekannte Liste;
doppeltes Hinzufügen ist idempotent und sagt das (`unchanged: true`).

## 6. Skalierung (~1200 Ordner, 101+ Vorhaben)

1. **Liste vor Baum:** Die Arbeitsfläche sind 100–300 Vorhaben-Zeilen, nicht
   1200 Baumknoten.
2. **Filter zuerst:** Default „Zu tun"; „Alle" ist ein Klick entfernt, nicht
   der Startzustand. Filter in der URL, damit die Arbeitssituation beim
   Wiederkommen steht.
3. **Virtualisierung von Anfang an:** `@tanstack/react-virtual` (installiert,
   bislang ungenutzt) für die linke Liste; Gruppenköpfe sind gewöhnliche
   Zeilen. Das Detail wird nie virtualisiert; der Baum-Modus skaliert über
   Einklappen (Default-Tiefe 2).
4. **Scan-Dauer:** gemessen ~80 s seriell für 369 Ordner → ~4–5 min für 1200,
   innerhalb `maxDuration 600`, aber zäh. Abhilfe: der vorhandene
   `concurrency`-Parameter des Archiv-Scans (der Sichten-Lauf nutzt 10,
   Messung dokumentiert; der Provider drosselt selbst via Retry-After) wird
   auch im Coverage-Scan gesetzt → Voll-Scan im Minutenbereich. Kein
   Progress-Streaming (benannte Grenze: Spinner + Sekundenzähler im Client);
   der Teilbaum-Merge (F10) macht Voll-Scans selten.
5. **Gap-Budget:** `MAX_STORED_GAPS` 5000 kann im Voll-Archiv kappen. Die
   Zähler je Knoten (`gapsByType`/`gapsByActor`) bleiben vollständig (vor
   der Kappung gerechnet) — Listen-Badges und Fortschrittsköpfe stimmen
   immer; nur Detail-Listen können unvollständig sein und sagen das je
   Ordner. `teilbaum_ungesichtet` dämpft unberührte Bereiche weiterhin.
6. **Ganzer Report im Client** bleibt akzeptabel (Baum + Vorhaben + 5000
   Befunde ≈ einstellige MB); die Liste arbeitet auf den kleinen
   `VorhabenCard`s. Bricht das je, ist die budgetierte MCP-Kompaktsicht das
   fertige serverseitige Vorbild (Ausblick, nicht gebaut).

## 7. Technische Leitplanken

- Neue reine Logik weiter unter `src/lib/agent-view/` (keine Imports aus
  `components/hooks/contexts`); Dateien ≤ 200 Zeilen; TypeScript strict;
  Code englisch, Doku deutsch; keine stillen Fallbacks.
- **Geteilte Prädikate:** `bereit zur Abnahme` und die Filter-Semantik
  (`akteur`, `zyklusSchritt`, Leer-Begründung) wandern in gemeinsame
  Funktionen unter `src/lib/agent-view/`; MCP-Kompaktsicht und UI
  konsumieren dieselben (kein Drift).
- **Server-State neuer Features via TanStack Query** (Projektregel), URL-State
  via `nuqs` (Adapter liegt in `layout.tsx`), Jotai nur für UI-Präferenzen
  (Pane-Größen). Der bestehende `use-coverage-report`-Hook darf
  gelegenheitshalber migrieren, ist aber kein Muss dieser Wellen.
- Frontmatter ausschließlich über den gemeinsamen Parser/Patcher
  (`@/lib/markdown/**`); kein UI-Code kennt Provider oder `primaryStore`.
- API-Konventionen nach
  [`api-route-conventions.md`](../architecture/api-route-conventions.md);
  Auth via Clerk + User-Email; Stand-Route und Worklist-Routen mit
  vollständigem 409-/404-Katalog wie in F7/F8 benannt.

## 8. Wellen-Plan

| Welle | Inhalt | Ergebnis/Test |
|---|---|---|
| W1 | `VorhabenCard`-Erweiterung (`ampel`, `berichtTitel`, `berichtFileId`, `berichtModifiedAt`, `berichtStatus`, `themen`) + geteiltes Prädikat „bereit zur Abnahme" (MCP + `coverage-progress` umgestellt) | Unit-Tests Karte + Prädikat; alte Reports zeigen Hinweis statt Lücke |
| W2 | Bericht-Lese-Route (F9) inkl. serverseitigem `kopf` | Routen-Test: 404 · `kein_bericht` · `zu_gross` |
| W3 | Werkbank-Gerüst: Tab + nuqs-URL-Zustand + Resizable + virtualisierte Vorhaben-Liste (Alle/Zu tun/Bereit, Chips, Suche, Sortierung, Leer-Begründungen) + Auswahl | UI-Smoke + Leerzustand-Tests |
| W4 | Detail-Panel: Kopf, Bericht-Render, Befunde je Akteur + Auftrag je Vorhaben, Familien, Deep-Links; Board-Karten + Todo-Zeilen verlinken | Bestehende Board-/Todo-Tests bleiben grün |
| W5 | Themen-Gruppierung (F12, vorgezogen 23.08.): Gruppier-Umschalter „Bereich \| Thema", ein Vorhaben je Thema, benannte „Ohne Thema"-Gruppe, URL-State `?gruppierung=` | Unit Gruppierung (mehrfach/leer/unbekannt); Leergruppen-Benennung |
| W6 | Arbeitslisten: Repo + Routen + Pin/Filter + Fortschrittskopf + tote Einträge | Repo-/Routen-Tests; Kreuztest Liste↔Report |
| W7 | Stand-Route + `stand-plan` (409-Katalog inkl. ungespeichertem Precheck) + Abnehmen-UI + lokale Überlagerung | Unit `stand-plan`; alle 409-Fälle |
| W8 | Teilbaum-Scan-Merge + Detail-Button + Scan-`concurrency` | Merge-Test: Voll-Scan ≡ Merge |

Branch-, Diff- und PR-Regeln nach `AGENTS.md` (eine PR pro Welle, Hand-off-
Block). W1/W2 sind reine Backend-Wellen und parallel zu W3 unschädlich; W5
setzt W1 (`themen` in der Karte) und W3 (Liste) voraus, W7 setzt W1
(Prädikat) voraus, W8 ist bewusst letzte. Die Themen-Welle wurde am
23.08.2026 aus dem Ausblick vorgezogen (Peters Feedback: Orientierung in
hunderten Ordnern braucht die Denk-Ebene, nicht nur die Ordner-Ebene).

## 9. Akzeptanzkriterien

1. Werkbank-Liste bleibt flüssig mit einem 1200-Ordner-Report
   (virtualisiert; manuelle Prüfung am Voll-Archiv).
2. **Kreuztest der Bücher:** Report löschen → Arbeitslisten unversehrt, tote
   Einträge sichtbar; Liste löschen → Report und Archiv unangetastet.
3. `abgenommen` ist ohne frischen Precheck unmöglich: ein Vorhaben mit einem
   offenen maschinellen Befund antwortet `409 nicht_bereit` samt
   Befundliste, und es wurde nichts geschrieben.
4. Jeder leere Filter nennt seinen Grund (kein stummer Leerzustand).
5. Board-Karte → Detail ist als URL teilbar und übersteht Reload.
6. Kein UI-Code kennt `primaryStore` oder das Storage-Backend; der
   Bericht-Body kommt ausschließlich über die Lese-Route.
7. Bericht-Leerzustände nachgewiesen: `kein_bericht` rendert den
   Cowork-Befund + Auftrag, `zu_gross` verweist ins Archiv.
8. Merge-Report und Voll-Scan-Report sind ununterscheidbar (W8-Test).
9. Alte Reports (vor W1) funktionieren mit sichtbarem Hinweis, ohne Absturz
   und ohne stillen Fallback.
10. Themen-Gruppierung nachgewiesen: ein Vorhaben mit zwei Themen erscheint
    unter beiden; Vorhaben ohne `themen` landen in einer benannten
    „Ohne Thema"-Gruppe, nie unsichtbar.

## 10. Zusammenspiel mit der MCP-Brücke

Die Werkbank und die MCP-Werkzeuge arbeiten auf demselben Report und
denselben Prädikaten. Typischer Kreislauf: Peter nimmt sich Vorhaben in eine
Arbeitsliste → kopiert je Vorhaben den Auftrag (oder die Cowork-Session holt
ihn sich via MCP) → die Session arbeitet und meldet Konsistenz zurück → Peter
scannt (Teilbaum), sieht „bereit zur Abnahme", liest den Bericht im Detail
und nimmt ab. Die Abnahme selbst bleibt bewusst ein UI-Akt des Menschen —
es gibt kein MCP-Werkzeug `stand_setzen` (Erweiterung wäre ein eigener
Beschluss).

## 11. F12 — Themen als zweite Gruppierung (Welle W5, vorgezogen 23.08.2026)

Peters Denken ist nicht deckungsgleich mit der Ordnerstruktur: Themen wie
„Commoning" oder „Secretary Service" laufen quer durch mehrere Vorhaben.
Ursprünglich als Ausblick geführt, am 23.08.2026 nach Peters Feedback in
den v2-Scope gezogen („Orientierung in hunderten Verzeichnissen braucht
meine Denk-Ebene, nicht nur die Ordner-Ebene") — als Welle W5, direkt nach
dem Werkbank-Gerüst.

- **Datenquelle:** das Feld `themen` **existiert bereits** im
  `BERICHT.md`-Frontmatter (flach, Obsidian-kompatibel) und wird vom
  Sichten-Modul (`bericht-lesen.ts`) geparst und in `PROJEKTE.md` als
  Themenregister aggregiert. `BERICHT.md`-`themen` ist die führende Quelle
  je Vorhaben; `_INDEX.md`-`themen` zählt nur als Fallback für Vorhaben
  ohne Bericht. Der Scan übernimmt die Liste in die `VorhabenCard` (W1).
- **UI:** der Gruppier-Umschalter der Werkbank-Liste bekommt den zweiten
  Wert „Gruppieren nach: **Bereich | Thema**" (URL-State `?gruppierung=`).
  Ein Vorhaben erscheint unter **jedem** seiner Themen; Vorhaben ohne
  `themen` landen in einer benannten Gruppe „Ohne Thema" — sichtbar, nie
  still verschluckt. Fortschrittsköpfe und Filter wirken unverändert auf
  die gruppierten Zeilen.
- **Pflege:** die Zuordnung Verzeichnis→Thema geschieht ausschließlich im
  Frontmatter (Cowork beim Berichten oder von Hand in Obsidian) — bewusst
  **kein Themen-Editor** in der Sicht und keine zweite Datenbank: die
  Wahrheit bleibt im erklärten Buch, die Werkbank gruppiert nur danach.
- **Grenzen v2:** keine Themen-Hierarchie, kein Umbenennen/Zusammenlegen
  von Themen aus der Sicht (das wäre ein Schreibweg über viele Berichte —
  Cowork-Auftrag, kein UI-Feature).

## 12. Ausblick: Ordner-Umzug und Zusammenführung

Aufräumen endet für Peter in einer Verzeichnisstruktur, die seinem
Projektdenken entspricht — verstreute Ordner eines Projekts werden irgendwann
zusammengeführt, Teile in andere Ordner verschoben. Heute existiert dafür auf
Dateiebene `familie_umziehen` (`move-family.ts`: Quelle + Twin-Familie in
einem Zug, Import → Quelle → Mongo → Spiegel → Export, Contract §7) und
`ordner_umbenennen` (Storage-only, Provider-IDs stabil). Skizze für ein
spätes eigenes Feature, **nach** der Verarbeitung der bestehenden Struktur:

- **Ordner verschieben:** OneDrive-Move hält IDs stabil; nachzuziehen sind
  Mongo-`parentId`s und Spiegel-Pfade des Teilbaums — dieselbe feste
  Reihenfolge wie `moveFamily`, auf Teilbaum-Ebene.
- **Ordner zusammenführen:** Kinder (als Familien) in den Zielordner umziehen,
  die leere Hülle auflösen. Deren folderId stirbt → Arbeitslisten zeigen den
  Eintrag als „nicht im letzten Scan" (F7 trägt das bereits). Die
  Vereinigung zweier `_INDEX.md`/`BERICHT.md` ist **Cowork-Inhaltsarbeit**
  per Auftrag, nie ein maschineller Merge.
- Ausgangspunkt in der Oberfläche wäre das Werkbank-Detail (Aktion am
  Vorhaben); bis dahin bleibt Umzug ein MCP-/Datei-Thema.

## 13. Offene Punkte zur Abnahme

1. **Name:** Tab „Werkbank" — und der Menüpunkt? („Agentensicht" behalten
   oder die v1-§8-Namensfrage jetzt entscheiden.)
2. **Arbeitslisten:** leerer Start oder eine Default-Liste („Aktuelle
   Projekte")? Teilen/Übergeben später?
3. **Abnahme-Precheck-Kosten:** frischer Teilbaum-Scan je Abnahme (Sekunden;
   429-Risiko bei Serien-Abnahmen auf OneDrive) — akzeptiert, oder schwächere
   Variante (nur Report-Frische) bewusst wählen?
4. ~~Themen-Feldort~~ — entschieden 23.08.2026: Themen-Welle vorgezogen
   (jetzt W5/F12, §11); `BERICHT.md`-`themen` führend, `_INDEX.md` nur
   Fallback ohne Bericht.
5. **Scan-`concurrency`:** Wert (Vorschlag 6–10 wie Sichten-Lauf) und ob als
   Library-Config-Feld oder Konstante.
6. **Berechtigung Stand-Schreiben:** alle Library-Mitglieder oder
   Owner/Co-Creator (Präzedenz `source_user_states`)?
7. **Gap-Budget 5000** fürs Voll-Archiv belassen oder erhöhen?
8. **Übergangs-UX bis W8 (Merge):** genügt das Scope-Banner bei
   Teilbaum-Reports?
