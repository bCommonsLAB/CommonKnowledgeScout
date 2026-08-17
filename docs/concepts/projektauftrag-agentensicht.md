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

## 3. Funktionsumfang

### F1 — Der Baum, wie der Agent ihn sieht

Baumansicht der Library aus Contract-Perspektive: pro Ordner der
`_INDEX.md`-Status, pro Vorhaben der `BERICHT.md`, pro Quelle die Twin-Familie
(Quelle + Inhalt ihres `_`-Ordners als **ein** Knoten). Nicht-Contract-Dateien
werden zusammengefasst („17 weitere Dateien"). Jeder Knoten zeigt die
Vertrauensampel aus den Kurations-Feldern (unverifiziert / maschinell bestätigt /
von Mensch geprüft, gültig nur bei `verified_at >= generated_at`) plus `twin_status`.

### F2 — Lückenmodell mit Herkunft

Eine Lücke ist ein prüfbarer Regelverstoß gegen den Contract. Startset — mit
der Maschine, die sie liefert:

| Gap-Typ | Regel | Prüft |
|---|---|---|
| `source_without_twin` | Quelle ohne `_`-Ordner mit Transkript | Engine-Scan (vorhanden) |
| `orphan_twin` | Twin ohne Quelle (Mongo ohne Storage-Fund oder verwaister `_`-Ordner) | Engine-Scan (vorhanden) |
| `conflict` | Spiegel und Mongo divergieren | Engine-Check (vorhanden) |
| `twin_stale` | Quelle jünger als ihr Twin | Freshness-Prüfung (vorhanden) |
| `core_fields_missing` | A0-Pflichtfelder fehlen | Library-Verifikation A1 (vorhanden) |
| `twin_core_missing` | Twin-Kern (Contract §3.1) fehlt | neu (Regel-Registry) |
| `twin_unverified` | `generated_by` ohne gültiges `verified_by` | neu |
| `self_verified` | `generated_by` == `verified_by` (Actor-Ebene) | neu |
| `report_missing` | Vorhabensordner ohne `BERICHT.md` | neu, konfigurierbar |
| `index_missing` | Strukturebene ohne `_INDEX.md` | neu, konfigurierbar |

Neue Regeln sind reine Funktionen `(node) => Gap | null` in einer erweiterbaren
Registry. Die Ordner-Konventionen (`JJ.MM`-Präfix, BERICHT-Pflicht) sind
**Archiv-Konvention, nicht Plattform-Wissen** — Muster und Aktivierung werden
pro Library konfiguriert, nicht hartkodiert.

**Gap-Budget:** Ordner mit `bearbeitungsstand: ungesichtet` im `_INDEX.md`
(Feld aus dem [Erschließungszyklus](erschliessungszyklus.md)) erzeugen einen
Sammel-Gap statt tausend Einzel-Gaps; Ausschluss-Globs (Welle 0) halten `temp/`
u. Ä. ganz draußen. Ordnerknoten aggregieren die Lückenzähler ihrer Teilbäume.

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
  läuft über kontrollierte Schreibwege (Richtung ADR-0004).

### F4 — Verifikation inline (setzt die Patch-Route voraus)

Am Twin-Knoten: Dropdown für `twin_status`, Verify-Aktion setzt
`verified_by: human:<user>` + `verified_at` — über die Kurations-Patch-Route aus
Contract §4 (Erhalt unbekannter Felder, Spiegel-Drift-Guard). Die Agentensicht
hat keinen eigenen Schreibpfad.

### F5 — Nicht-Ziele

`uid`/`source_hash` im Frontmatter, Index-Collection über Storage-Inhalte,
Write-Through, Move-/Familien-API, `readonly`-Marker, Umbau der Archiv-Ansicht,
Template-Namens-Invarianten (eigener ADR-Kandidat der Template-Verwaltung),
automatisches Ausführen von Aufträgen, Chat-Integration, Twin-Body-Editor
(dafür gibt es Obsidian und die Vorschau), Coverage-Verlauf über Zeit.

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
| 0 | Twin-Kern-Feldsatz (`TWIN_CORE_FIELDS`; Pipeline-Writer setzt `generated_*`) · Ausschluss-Globs als Library-Config-Feld (Checkliste `library-config-field.mdc`) | Fundament: Pipeline schreibt den Kern, Scans haben einen Zaun |
| 1 | Coverage-Service als Komposition + neue Gap-Regeln + Report-Cache + API (ohne UI) | Coverage als JSON; Unit-Test je neuem Gap-Typ |
| 2 | Baum-UI read-only (Ampeln, Zähler, Sammel-Gaps) neben „Archiv" | Sicht sichtbar |
| 3 | Auftrags-Generator (Vorlage je Gap-Typ, Clipboard) | Lücke → Auftrag in < 1 Min |
| 4 | Kurations-Patch-Route (Contract §4: Feld-Patch, Erhalt unbekannter Felder, Drift-Guard) + Inline-Verifikation | Kuration im Baum |

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

## 8. Offene Punkte zur Abnahme

- Name der Ansicht im UI: „Agentensicht" / „Abdeckung" / „Wissensschicht"?
- Auftrags-Vorlagen: im Repo versioniert oder in MongoDB (wie
  Transformations-Templates)?
- ADR-Kandidat: „Coverage wird berechnet; einzige Persistenz ist der
  wegwerfbare Report" (Verhältnis zu ADR-0004 kurz einordnen).
- Roadmap-Eintrag als A2-Ausbau (Edit an der Roadmap erst nach Abnahme).
