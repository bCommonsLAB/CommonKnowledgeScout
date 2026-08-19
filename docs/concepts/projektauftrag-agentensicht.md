# Projektauftrag: Agentensicht — Abdeckung, Verifikation und Auftragserzeugung

Stand: 2026-08-17 · Entwurf zur Abnahme · überarbeitete Fassung nach dem
Architektur-Review vom 2026-08-17. Grundlage:
[`twin-datei-contract.md`](twin-datei-contract.md).
Einordnung: **Ausbau von Welle A2** in Plan 1 der Roadmap
(`docs/roadmap-formatunabhaengige-library-und-onboarding.md`) — bei Abnahme dort
verlinken, damit keine Session doppelt baut (AGENTS.md: „EINE Quelle").

---

## 1. Kontext

KnowledgeScout verwaltet Artefakte deterministisch über den `ArtifactKey`. Was
fehlt, ist die Sicht, die ein Agent einnimmt, wenn er das Filesystem betritt:
ein Baum aus Ordnern, `_INDEX.md`, `BERICHT.md` und `_`-Twin-Ordnern neben den
Quellen. Diese Sicht existiert heute nur im Kopf des Agenten — Peter kann weder
prüfen, was ein Agent vorfindet, noch systematisch sehen, wo die Wissensschicht
Lücken hat, noch gezielt Aufträge erzeugen, sie zu füllen.

**Ein Satz:** *Archiv zeigt die Dateien; die Agentensicht zeigt, was ein Agent
davon versteht — und was ihm fehlt.*

## 2. Leitprinzipien

1. **Komposition statt Neubau.** Die Plattform hat bereits zwei Prüfmaschinen:
   den Sync-Engine-Check (Twin-Abdeckung, Konflikte, Alt-Namen) und die
   Library-Verifikation A1 (Pflichtfelder je Dokument). Die Agentensicht
   orchestriert beide und ergänzt nur, was keine kann: Archiv-Konventionsregeln,
   Aggregation zum Baum, Auftragserzeugung. Sie ist **kein drittes Prüfsystem**
   und scannt die Provider nicht ein weiteres Mal selbst.
2. **Berechnet, nie Wahrheit.** Einziges Persistenzartefakt ist ein
   **Coverage-Report mit Zeitstempel** (jüngster Scan, als abgeleitet und
   wegwerfbar gekennzeichnet). Abnahmetest: Report löschen → der nächste Scan
   stellt ihn vollständig wieder her. Kein Index über Storage-Inhalte, kein
   Write-Through, kein Umbau der bestehenden Archiv-Ansicht.
3. **Der Contract ist die Spezifikation.** Der Baum zeigt exakt, was der
   Twin-Datei-Contract definiert: Discovery `_X.pdf/`, Twin-Kern,
   Kurations-Felder, temporale Verifikationsregel.
4. **Storage-agnostisch** (`storage-abstraction.mdc`): Der Scan läuft im
   Service-Layer über Engine/`StorageProvider`; die UI konsumiert eine
   Coverage-API und kennt nie Provider oder `primaryStore`.
5. **Anzeigen und beauftragen, nie selbst füllen.** Einzige Schreiboperation
   ist der Kurations-Patch (Welle 4) über die Route aus Contract §4.
6. **Doppelte Buchhaltung (Agenten-Werk gegen Bestand).** Der Bestand führt
   zwei unabhängige Bücher. Das eine schreiben die Akteure: Berichte und
   Indizes **mit ihren Verweisen** auf Dateien und Twins, dazu der erklärte
   `bearbeitungsstand`. Das andere errechnet KnowledgeScout: das tatsächliche
   Inventar aus dem Scan über Mongo + Storage. Die Sicht auditiert Buch 1
   gegen Buch 2 — **Verweis für Verweis** (F2, Verweis-Audit) und Stand für
   Stand. „Grün" ist ein Vorhaben erst, wenn beide übereinstimmen; jede
   Abweichung ist ein Befund mit zuständigem Akteur. Erklärte Stände und
   Berichte werden **nie still korrigiert** — die Sicht zeigt den Widerspruch
   und erzeugt das Todo. Und die Gegenrichtung gehört dazu: Jede
   Cowork-Session auditiert ihrerseits die Coverage (F3, Konsistenz-Rückmeldung).

## 3. Funktionsumfang

### F1 — Der Baum, wie der Agent ihn sieht

Baumansicht der Library aus Contract-Perspektive: pro Ordner der
`_INDEX.md`-Status, pro Vorhaben der `BERICHT.md`, pro Quelle die Twin-Familie
(Quelle + Inhalt ihres `_`-Ordners als **ein** Knoten). Nicht-Contract-Dateien
werden zusammengefasst („17 weitere Dateien"). Jeder Knoten zeigt die
Vertrauensampel aus den Kurations-Feldern (unverifiziert / maschinell bestätigt /
von Mensch geprüft, gültig nur bei `verified_at >= generated_at`) plus `twin_status`.
Die Ampel einer Twin-Familie hängt am **führenden Artefakt** (Standard-Transformation,
sonst Transkript — Contract §2b); ein unverifiziertes Transkript neben geprüfter
Transformation ist kein Befund.

### F1b — Zyklus-Board: Soll/Ist je Vorhaben

Zweite Darstellung neben dem Baum: alle Vorhaben nach `bearbeitungsstand`
(fünf Spalten von `ungesichtet` bis `abgenommen`). Jede Karte zeigt den
erklärten Stand, den berechneten Befund und die offenen Todos nach Akteur.
Fällt ein Vorhaben hinter seinen erklärten Stand zurück (`stand_widerspruch`,
F2), wechselt die Karte sichtbar in den Widerspruchszustand — „abgenommen,
aber nicht mehr aktuell" — ohne dass eine Datei angefasst wird. Das Board
beantwortet auf einen Blick: Was ist zu tun, wer ist dran, was ist wirklich grün.

### F2 — Lückenmodell mit Herkunft

Eine Lücke ist ein prüfbarer Regelverstoß gegen den Contract. Startset — mit
der Maschine, die sie liefert. **Umgesetzt in Welle 1** als Registry
(`src/lib/agent-view/gap-registry.ts`); dort tragen zusätzlich die
Engine-Namensbefunde (`legacy_twin_name`, `path_too_long`), der Sammel-Gap
`teilbaum_ungesichtet` und `scan_error` ihre Akteur-/Schritt-Zuordnung.
`core_fields_missing` (Library-Verifikation A1) ist seit dem Nachzug zur
Wellen-1/2-PR angeschlossen (`field-gaps.ts`): übersetzt wird ausschließlich
`missing-base-field`; alle weiteren A1-Codes behalten ihre eigene Route und UI.
Die Konventionen (Vorhaben-Muster, `_INDEX.md`-Pflichttiefe, Bericht-Frische,
lokaler Wurzelpfad) sind in den Library-Einstellungen (Erweitert →
Agentensicht) pflegbar.

| Gap-Typ | Regel | Prüft |
|---|---|---|
| `source_without_twin` | Quelle ohne `_`-Ordner mit Transkript | Engine-Scan (vorhanden) |
| `orphan_twin` | Twin ohne Quelle (Mongo ohne Storage-Fund oder verwaister `_`-Ordner) | Engine-Scan (vorhanden) |
| `conflict` | Spiegel und Mongo divergieren | Engine-Check (vorhanden) |
| `twin_stale` | Quelle jünger als ihr Twin | Freshness-Prüfung (vorhanden) |
| `transformation_missing` | Quelle mit Transkript, aber ohne Transformation nach dem zum Typ passenden Standard-Template (Typ-Registry, Welle 0f; bis dahin das Einzel-Template) | neu |
| `transformation_stale` | Transkript jünger als die Transformation (z. B. nach Wortlaut-Korrektur) | neu, informativ |
| `core_fields_missing` | A0-Pflichtfelder fehlen | Library-Verifikation A1 (vorhanden) |
| `twin_core_missing` | Twin-Kern (Contract §3.1) fehlt | neu (Regel-Registry) |
| `twin_unverified` | führendes Artefakt mit `generated_by` ohne gültiges `verified_by` | neu |
| `self_verified` | `generated_by` == `verified_by` (Actor-Ebene) | neu |
| `report_missing` | Vorhabensordner ohne `BERICHT.md` | neu, konfigurierbar |
| `index_missing` | Strukturebene ohne `_INDEX.md` | neu, konfigurierbar |
| `bericht_veraltet` | `BERICHT.md` älter als die jüngste Twin-/Datei-Änderung seines Vorhabens | neu, konfigurierbar |
| `stand_widerspruch` | erklärter `bearbeitungsstand` durch Befunde widerlegt (z. B. `abgenommen`, aber Änderungen seit `bearbeitungsstand_seit` oder offene Gaps im Teilbaum) | neu |
| `verweis_tot` | Bericht/Index verweist auf eine Datei oder einen Twin, die es nicht (mehr) gibt | neu — Verweis-Audit |
| `verweis_veraltet` | ein verwiesener Twin wurde nach dem Stand des Berichts neu erzeugt oder geändert | neu — Verweis-Audit |
| `bericht_unvollstaendig` | erschlossene Quellen/Ereignisordner des Vorhabens, die der Bericht nicht erwähnt | neu — Verweis-Audit, informativ |

**Verweis-Audit — der Kern der doppelten Buchhaltung:** Die Bodies von
`BERICHT.md` und `_INDEX.md` werden auf Verweise geparst (Wikilinks `[[…]]`
und relative Markdown-Links; reine Funktion, ohne LLM). Jeder Verweis wird
gegen das gescannte Inventar aufgelöst — existiert das Ziel, ist es jünger als
der Bericht? Umgekehrt wird geprüft, was der Bericht unerwähnt lässt. Die
**semantische** Gegenkontrolle (sagt der Bericht, was das Transkript sagt?)
ist bewusst nicht KS-Sache in v1 — sie leistet die jeweils nächste
Cowork-Session über den Konsistenz-Rückmeldungsblock (F3).

Neue Regeln sind reine Funktionen `(node) => Gap | null` in einer erweiterbaren
Registry. Die Ordner-Konventionen (`JJ.MM`-Präfix, BERICHT-Pflicht) sind
**Archiv-Konvention, nicht Plattform-Wissen** — Muster und Aktivierung werden
pro Library konfiguriert, nicht hartkodiert.

**Gap-Budget:** Ordner mit `bearbeitungsstand: ungesichtet` im `_INDEX.md`
(Feld aus dem [Erschließungszyklus](erschliessungszyklus.md)) erzeugen einen
Sammel-Gap statt tausend Einzel-Gaps; Ausschluss-Globs (Welle 0) halten `temp/`
u. Ä. ganz draußen. Ordnerknoten aggregieren die Lückenzähler ihrer Teilbäume.

**Todo-Routing:** Jeder Gap-Typ trägt zuständigen Akteur und Zyklus-Schritt
(Erschließungszyklus §1). Daraus entstehen drei Todo-Listen: **Mensch**
(z. B. `twin_unverified` → Schritt 4), **Cowork** (`report_missing`,
`bericht_veraltet`, `verweis_tot`, `verweis_veraltet`,
`bericht_unvollstaendig`, `index_missing` → Schritt 1/3, über den
Auftrags-Generator), **KnowledgeScout** (`source_without_twin`,
`transformation_missing`, `transformation_stale`, `conflict`, `twin_stale` →
Schritt 2/4, verlinkt auf die vorhandenen Buttons).
`stand_widerspruch` routet auf den Schritt, hinter den das Vorhaben
zurückgefallen ist; aufgelöst wird er nur explizit — bestätigen (Stand neu
datieren) oder zurückstufen, beides am `_INDEX.md`. Mtime-basierte
Rückfall-Verdachte sind ein Prüfauftrag, kein Urteil (Sync-Werkzeuge können
Zeitstempel anfassen).

### F3 — Auftrags-Generator (der eigentliche Zweck)

Peter markiert Lücken und erhält einen kopierfertigen Auftragstext für eine
Cowork-Session:

- Kontextkopf: Library, betroffene Pfade, Pflichtlektüre (`Konventionen.md`,
  Twin-Datei-Contract).
- Pfad-Darstellung: archiv-relative Pfade; optional rendert ein
  Library-Config-Feld „lokaler Wurzelpfad" absolute Pfade (KS kennt nur
  Provider-Pfade, nicht Peters lokalen OneDrive-Mount).
- Pro Lücke eine Aufgabenzeile aus einer Vorlage je Gap-Typ; Abschlusskriterium:
  „Danach verschwinden die Gaps X, Y im nächsten Scan."
- Ausgabe in v1: **Clipboard only** — keine `auftraege/`-Dateien, keine
  API-Kopplung. Der Transport ist bewusst Copy-Paste; eine spätere Dateiablage
  läuft über kontrollierte Schreibwege (Richtung ADR-0004). **Welle 5 (MCP)
  ersetzt den Copy-Paste-Transport**: Der Agent holt sich Auftrag und
  Werkzeuge dann selbst; der Generator bleibt als menschenlesbare Fassung.
- Jeder Auftrag endet mit einem **Konsistenz-Rückmeldungsblock**: „Melde
  zurück, wo deine Sicht der Dateien dieser Coverage widerspricht." So prüft
  jede Cowork-Session die Sicht gegen, wie die Sicht die Dateien prüft — die
  Gegenkontrolle aus dem Briefing (§3e) wird Standard, nicht Sonderfall.

### F4 — Verifikation inline (setzt die Patch-Route voraus)

Am Twin-Knoten: Dropdown für `twin_status`, Verify-Aktion setzt
`verified_by: human:<user>` + `verified_at` — über die Kurations-Patch-Route aus
Contract §4 (Erhalt unbekannter Felder, Spiegel-Drift-Guard). Die Agentensicht
hat keinen eigenen Schreibpfad. **Umgesetzt in Welle 4:** Route
`POST /api/library/{id}/shadow-twins/curation` (Domäne Shadow-Twin, nicht
Agent-View — die Sicht ruft sie nur); der Report trägt dafür je Quelle eine
`TwinFamilySummary` (führendes Artefakt + Kurationszustand), frisch kuratierte
Zustände überlagern den Report lokal bis zum nächsten expliziten Scan.
Verify-Identität ist `human:<user-email>`; Selbst-Verifikation und
Spiegel-Drift beantwortet die Route mit 409 statt zu schreiben.

### F5 — Nicht-Ziele

`uid`/`source_hash` im Frontmatter, Index-Collection über Storage-Inhalte,
Write-Through, Move-/Familien-API, `readonly`-Marker, Umbau der Archiv-Ansicht,
Template-Namens-Invarianten (eigener ADR-Kandidat der Template-Verwaltung),
automatisches Ausführen von Aufträgen, Chat-Integration, Twin-Body-Editor
(dafür gibt es Obsidian und die Vorschau), Coverage-Verlauf über Zeit, sowie
LLM-gestützte semantische Bericht-Prüfung (die inhaltliche Gegenkontrolle
leistet die jeweils nächste Cowork-Session über den Rückmeldungsblock).

## 4. Technische Leitplanken

- Neues Modul `src/lib/agent-view/` als **dünne Kompositionsschicht**: nutzt den
  Engine-Plan (`mode: 'check'`), die Freshness-Prüfung und die
  Library-Verifikation; eigene Logik nur für Regel-Registry, Baum-Aggregation,
  Auftragstexte. Keine Imports aus `components/hooks/contexts`; typisierte
  Fehler; keine stillen Fallbacks; Scan-Fehler je Teilbaum isolieren und im
  Report ausweisen.
- **Report-Cache:** der jüngste `CoverageReport` je Library in Mongo (ein
  Dokument, `generatedAt`, dokumentiert als abgeleitet/wegwerfbar). Scan ist
  ein expliziter Vorgang (Button „Neu scannen"), kein Watcher.
- Frontmatter-Lesen über den bestehenden Parser (`@/lib/markdown/**`); Twin-Kern
  aus dem Contract-Modul — keine zweite Felddefinition.
- API: `GET /api/library/{id}/agent-view/coverage` (Report),
  `POST /api/library/{id}/agent-view/scan`. Konventionen nach
  `api-route-conventions.md`. Dateien ≤ 200 Zeilen, TypeScript strict,
  Code englisch, Doku deutsch.

## 5. Wellen-Plan (zugleich der Prototyp-Plan)

| Welle | Inhalt | Ergebnis |
|---|---|---|
| 0a ✓ | Twin-Kern-Feldsatz + Writer-Stempel am Pipeline-Engpass (PR #162) | umgesetzt, im Pilot bewiesen |
| 0b | Ausschluss-Globs als Library-Config-Feld (Checkliste `library-config-field.mdc`) | Scans haben einen Zaun |
| 0c ✓ / 0d ✓ | Sidecar-Adoption (PR #163) · Handkorrektur-Vorrang + Kombi-Fehlerkennung (PR #164) | umgesetzt, im Pilot bewiesen |
| 0e | `familie_umziehen` als Funktion: Import → Quelle verschieben/umbenennen → DB-Namen nachziehen → alten Spiegel löschen → Export (Engine-Op + API) | Umzüge nach der Erschließung sind ein Handgriff (Zyklus v2 §3) |
| 0f | Typ-Template-Registry: Library-Config-Map `doc_type → Template` (Fallback: bisheriges Einzel-Template), Typ-Erkennungsschritt nach dem Transkript, Standard-Typ-Templates (konzept, email-diktat, besprechung, notiz) | richtige Vorlage je Inhaltstyp (Zyklus v2 §2) |
| 1 ✓ | Coverage-Service als Komposition + neue Gap-Regeln (vollständige Tabelle in F2 — inkl. Soll/Ist, Verweis-Audit, Familien-Regeln) + Report-Cache + API (ohne UI) | umgesetzt: `src/lib/agent-view/`, `GET/POST /api/library/{id}/agent-view/*`, Unit-Test je neuem Gap-Typ |
| 2 ✓ | Baum-UI read-only (Ampeln, Zähler, Sammel-Gaps) + Zyklus-Board (F1b) neben „Archiv" | umgesetzt: `/library/agent-view` (Menüpunkt „Agentensicht") |
| 3 ✓ | Auftrags-Generator (Vorlage je Gap-Typ, Clipboard) + Todo-Listen nach Akteur | umgesetzt: Tab „Todos & Auftrag" (`todo-lists.ts`, `auftrag-generator.ts`) |
| 4 ✓ | Kurations-Patch-Route (Contract §4: Feld-Patch, Erhalt unbekannter Felder, Drift-Guard) + Inline-Verifikation | umgesetzt: `POST /api/library/{id}/shadow-twins/curation` (`curation-plan.ts`/`curation-patch.ts`), Twin-Knoten mit `twin_status`-Dropdown + Verify im Baum; Nachzug W1: `GET .../agent-view/coverage` |
| 5 | **MCP-Brücke**: KnowledgeScout als MCP-Server — Werkzeuge `erschliessen` (Jobs + Status), `pruefen`/`reparieren`/`import`/`export`, `familie_umziehen`, `abdeckung_lesen`; dünne Schicht über den bestehenden Services, Auth per API-Key | „Räum diesen Ordner auf" als EIN Cowork-Auftrag statt Copy-Paste (Zyklus v2 §7) |

Branch-, Diff- und PR-Regeln nach `AGENTS.md` (eine PR pro Welle,
Hand-off-Block). Welle 3 kommt vor 4, weil der Generator keinen Schreibweg
braucht und den Pilot früher ermöglicht.

## 6. Pilot: ein Thema, sechs Augen

Voraussetzung: Das Archiv (oder der Pilot-Teilbaum) ist als Library in KS
angebunden (OneDrive; das bekannte Auth-Thema im Blick behalten).

Kandidat: `6. bCommonsLab prototyping/25.01 Common Secretary` — dort liegen vier
Aufnahmen ohne Transkript, und der eigene `_INDEX.md` nennt ihre Erschließung
„den besten Selbsttest". (Alternative: ein PDF-lastiges Vorhaben.)

Ablauf, Rollen aus Contract §5:

1. Peter scannt in der Agentensicht → Gaps `source_without_twin`.
2. Auftrag an KS: Pipeline erschließt die vier Aufnahmen; Spiegel-Ordner entstehen.
3. Auftrag an Cowork (aus dem Generator): `BERICHT.md` auf Twin-Basis
   schreiben/ergänzen; eine erkennbare Transkript-Schwäche direkt im
   `_`-Ordner korrigieren.
4. Peter: „Prüfen" in KS → Import übernimmt die Korrektur oder meldet Konflikt.
5. Peter verifiziert das korrigierte Transkript (Obsidian-Frontmatter, ab
   Welle 4 in der Sicht).
6. Re-Scan: Die adressierten Gaps sind verschwunden; die Verifikation ist in
   Obsidian und in der Sicht identisch sichtbar.

Damit ist „gemeinsames Wirken an einem Thema" einmal vollständig durchgespielt:
Pipeline erzeugt, Agent konsumiert und korrigiert, Mensch prüft — drei Rollen,
sechs Augen, ein Bestand.

## 7. Akzeptanzkriterien

1. Der Baum zeigt dieselbe Struktur, die eine Cowork-Session per
   Discovery-Regel findet (stichprobenhaft gegengeprüft).
2. Jeder **neue** Gap-Typ hat einen Unit-Test mit Positiv- und Negativ-Fall;
   wiederverwendete Prüfungen werden nicht dupliziert (Review-Kriterium).
3. Der Pilot (§6) ist einmal vollständig durchlaufen.
4. Verifikation ist wechselseitig sichtbar (Sicht ↔ Obsidian).
5. Kein UI-Code kennt `primaryStore` oder das Storage-Backend.
6. Report-Wegwerf-Test: Report löschen → der nächste Scan rekonstruiert ihn
   vollständig.
7. Grün-Definition nachgewiesen: Ein Vorhaben zeigt erst dann durchgehend
   Grün, wenn der erklärte Stand `abgenommen` ist UND der Scan keinen offenen
   Befund im Teilbaum liefert.
8. Rückfall-Test: Eine Datei unter einem abgenommenen Vorhaben wird geändert →
   der nächste Scan zeigt `stand_widerspruch` mit Todo für den richtigen
   Akteur, ohne dass die Sicht eine Datei anfasst.
9. Verweis-Audit nachgewiesen: Ein Bericht mit einem toten und einem
   veralteten Verweis erzeugt genau die Befunde `verweis_tot` und
   `verweis_veraltet`; nach Korrektur des Berichts sind beide im Re-Scan
   verschwunden.

## 8. Offene Punkte zur Abnahme

- Name der Ansicht im UI: „Agentensicht" / „Abdeckung" / „Wissensschicht"?
- Auftrags-Vorlagen: im Repo versioniert oder in MongoDB (wie
  Transformations-Templates)?
- ADR-Kandidat: „Coverage wird berechnet; einzige Persistenz ist der
  wegwerfbare Report" (Verhältnis zu ADR-0004 kurz einordnen).
- Roadmap-Eintrag als A2-Ausbau (Edit an der Roadmap erst nach Abnahme).
