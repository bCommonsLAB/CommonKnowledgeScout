# Bruchstellen-Katalog: Archiv ↔ KnowledgeScout

Stand: 2026-08-17 · überarbeitete Fassung des Nachtrags
`bruchstellen-und-indexentscheid.md`. Die dortigen Empfehlungen
**Index-Collection mit Write-Through**, **`uid`-Pflichtfeld**, **`source_hash`**
und **Move-API** sind nach Prüfung gegen den Plattform-Stand zurückgezogen —
Begründung in §1/§2. Der Szenarien-Katalog bleibt als Risiko- und Testliste
erhalten, mit korrigierten Gegenmaßnahmen (§3).

---

## 1. Index-Entscheid: Report-Cache statt Index

Der berechtigte Kern des Performance-Einwands — rekursives Listing über
Cloud-Provider ist teuer — betrifft nur den Coverage-Scan. Er wird durch den
**Coverage-Report mit Zeitstempel** gelöst (Projektauftrag §2.2): explizit
erzeugt, einziger Leser ist die Agentensicht, jederzeit wegwerfbar
(Abnahmetest: löschen → nächster Scan rekonstruiert vollständig).

Verworfen ist die Index-Collection als Lese-Schicht „der Agentensicht *und des
Archivs*": Das wäre ein Umbau der bestehenden Archiv-Ansicht (sie lädt heute
pro Ordner auf Abruf und hat kein Listing-Problem) plus ein Write-Through über
ein halbes Dutzend Schreibstellen (Pipeline, Transform, Extract, Testimonials,
Write-Bundle, Wizard). Genau aus solchen Doppel-Schreibpflichten entsteht die
Drift, die der Einwand vermeiden wollte.

## 2. Identitäts-Entscheid: Provider-IDs statt `uid`/`source_hash`

- Twins hängen an der `sourceId` = Provider-Item-ID; OneDrive-IDs (Graph)
  überleben Umbenennen und Verschieben. Der Kurations-Zustand steht **in der
  Datei** und zieht mit um. Ein `uid`-Pflichtfeld hätte über die
  A1-Verifikation jede Library der Plattform auf „reparaturbedürftig" gestellt —
  und hilft bei Binärquellen (PDF/Audio, die eigentlichen Umzugskandidaten)
  gar nicht, weil sie kein Frontmatter tragen.
- `source_hash` wird erst bei pfadbasierten Provider-IDs relevant. Der richtige
  Hebel liegt dort im Provider selbst: **Der Nextcloud-Provider ist vor der
  Etappe-7-Migration auf Nextclouds stabile `fileid` umzustellen** (eigener
  Arbeitspunkt im Plattform-Backlog).
- Familien-Umzüge bleiben Konvention (Quelle + `_`-Ordner gemeinsam,
  Umzugsprotokoll). Eine KS-Move-API ist nicht nötig; falls je, ist es eine
  Engine-Operation, kein neues Subsystem.

## 3. Szenarien-Katalog

Orte: **K** = Twin-Datei-Contract · **P** = Projektauftrag Agentensicht ·
**V** = Konventionen.md (Archiv) · **E** = Sync-Engine/Plattform-Backlog.

| # | Szenario | Gegenmaßnahme (korrigiert) | Ort |
|---|---|---|---|
| B1 | **Der große Umzug.** 40 Dateien wechseln den Pfad. | OneDrive-IDs bleiben stabil, Twins folgen automatisch; Familien-Regel; Re-Scan aktualisiert den Report. | V, K §7 |
| B2 | **Halber Rename.** `X.pdf` → `X-final.pdf`, `_X.pdf/` bleibt stehen. | Konvention „nie Basename ohne Familie"; die Engine erkennt die Quelle weiter an der ID — Befund/Op „Familie umbenennen" als Backlog. | V, E |
| B3 | **OneDrive-Konfliktkopie.** | Neue Datei = neue ID = eigene unerschlossene Quelle (sichtbar, keine Kollision); Namensmuster „in Konflikt stehende Kopie" zusätzlich heuristisch flaggen. | P |
| B4 | **Gleichzeitiges Editieren** (Obsidian offen, KS patcht). | Patches atomar und klein; Spiegel-Drift-Guard vor Patch/Export (K §4.3); Restrisiko benannt und akzeptiert. | K |
| B5 | **Handkorrektur am Spiegel vs. nächster Export.** | Normalfall, kein Sonderfall: Import ist inhaltsbewusst und meldet Konflikte; Konvention „nach Handkorrektur: Prüfen"; Korrekturen in den `_`-Ordner (Sibling-Adoption-Lücke im Backlog). | K §4.5, V, E |
| B6 | **Template-Rename** macht Transformationen unauffindbar. | Reales Plattform-Randthema → eigener ADR-Kandidat der Template-Verwaltung; das Muster existiert (Namens-Migration der Engine); nicht Teil dieses Projekts. | E |
| B7 | **`twin_stale` + „verifiziert".** | Temporale Regel `verified_at >= generated_at` (K §3.2) + Freshness-Befund; Ampel-Downgrade in der Sicht. | K, P |
| B8 | **Scan-Rauschen** (`temp/` = 1.610 Dateien). | Ausschluss-Globs (Welle 0) + Sammel-Gap für `ungesichtet`-Ordner (Gap-Budget). | P |
| B9 | **Zirkularität:** Aufträge/Indizes erzeugen selbst Gaps. | `type: auftrag/index/template` von Inhalts-Gaps ausgenommen; eigener Lebenszyklus (offen/erledigt). | P |
| B10 | **Provider-Eigenheiten** (Umlaute, MAX_PATH, Encoding). | Pfade im Report NFC-normalisiert; Scan-Fehler je Teilbaum isolieren und sichtbar melden (kein stiller Teilerfolg); `path-too-long` ist bereits Engine-Befund. | P, E |
| B11 | **Der Cache wird heimlich zur Wahrheit.** | Entschärft: nur die Agentensicht liest den Report; der Report-Wegwerf-Test ist ein wiederkehrender Test, kein einmaliges Kriterium. | P |

## 4. Wohin die Konsequenzen eingearbeitet sind

- **Twin-Datei-Contract:** Wahrheitsmodell nach Dateiklasse, echtes Layout,
  Twin-Kern und Kurations-Felder, Schreibregeln inkl. Drift-Guard,
  Familien-Regel, Agenten-Twins nur auf Auftrag.
- **Projektauftrag Agentensicht:** Komposition statt drittem Prüfsystem,
  Report-Cache, Gap-Herkunftstabelle, Gap-Budget, Nicht-Ziele.
- **Cowork-Briefing:** Discovery-Regel, Verhaltensregeln, Konventionen-Änderungen.
- **Plattform-Backlog** (außerhalb dieses Projekts): Nextcloud-`fileid`,
  Sibling-Adoption, Op „Familie umbenennen", ADR Template-Rename.
