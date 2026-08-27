# Migrationsstrategie — Bestehendes läuft weiter, nichts wird doppelt gebaut

Verbindliche Regeln für den Umbau nach ADR
[0007](../adr/0007-modularisierung-monorepo-schale-module.md)/[0008](../adr/0008-deployment-ziele.md).
Beantwortet die Owner-Fragen: *Funktionieren die bestehenden
KnowledgeScout-Anwendungen weiter? Wie vermeiden wir doppelten Code? Erst die
bestehende Anwendung modularisieren, dann die Spezialanwendungen?*

Antwort in einem Satz: **Ja — der Umbau geschieht in place in der laufenden
Anwendung (Phase A), verhaltensneutral und in kleinen Wellen; Spezial-Ziele
(Phase B) kommen erst danach und additiv, ohne neue Deploy-Infrastruktur.**

## Die fünf Garantien

### G1 — Erst modularisieren, dann spezialisieren; ein Deployment bleibt

Phase A (M1–M4) baut die Voll-App IN PLACE um. Es existiert durchgehend nur
EIN Deployment: die heutige App mit gleichen URLs, gleichen API-Pfaden,
gleichem Docker-/Electron-Build, gleicher DB, gleicher GitHub Action. Und das
bleibt per ADR 0008 auch NACH dem Umbau der Default: neue Sites sind
SiteConfig-Einträge auf derselben Instanz, keine neuen Deployments. Der
AECED-Pilot (M5) ist ein npm-Paket-Publish plus Headless-API auf der
bestehenden Instanz — kein zweiter Server. Kein Big-Bang, kein Parallel-Stack.

### G2 — Extraktion = `git mv`, nie Kopieren

Eine Welle VERSCHIEBT Code in ein Paket und passt Importe an. Kein Feature
existiert je in zwei Implementierungen. Wo Importpfade zu breit streuen, bleibt
am alten Pfad übergangsweise eine dünne Re-Export-Fassade (hält Wellen-Diffs
unter den Limits aus `AGENTS.md`); Fassaden werden von einer Folgewelle
entfernt (`knip` findet sie).

### G3 — Bedarfsgetrieben statt vollständig (Strangler-Prinzip)

Extrahiert wird nur, was ein konkretes Ziel braucht: Fundament + Explorer für
AECED und die Site-Muster; Agent-View für Peters Archiv. Settings, Jobs,
Templates, Creation bleiben unextrahiert in der Voll-App liegen, bis ein Ziel
sie anfordert — das ist kein Schuldenberg, sondern erspartes spekulatives
Refactoring. Die Voll-App ist im Zielbild schlicht „Schale + Pakete + noch
nicht extrahierte Module".

### G4 — Verhaltensneutralität ist Abnahmekriterium jeder A-Welle

Pro Welle: `pnpm test` + `pnpm lint` (Cloud-Agent) und
`bash scripts/welle-pre-merge-check.sh` (lokal vor Merge); die Voll-App
startet, Kernrouten antworten identisch. Verhaltensänderungen — etwa der
Umzug der Ingest-Routen aus `chat/*` ([`modul-landkarte.md` §3](modul-landkarte.md)) —
sind KEINE Migrationswellen, sondern eigene spätere Vorhaben mit
Route-Aliassen/Redirects.

### G5 — Rollback pro Welle = ein Revert

Jede Welle ist eine PR aus Move + Re-Export, keine verteilte Umschreibung.
Geht etwas schief, wird genau diese PR revertiert; die Voll-App ist danach
wieder im vorherigen, funktionierenden Zustand.

## Technische Voraussetzung (Welle M1)

`pnpm-workspace.yaml` einführen und `transpilePackages` in `next.config.js`
setzen (heute nicht vorhanden): Die Voll-App konsumiert Workspace-Pakete als
Source. Kein separater Paket-Build-Schritt im Deployment; Electron
(`electron-builder.yml`) und `build:package` bauen unverändert die App.

## Phasenplan

Wellen-Details und Paket-Zuschnitt: [`modul-landkarte.md` §5](modul-landkarte.md).

- **Phase A — bestehende Anwendung modularisieren (M1–M4)**: Workspace,
  `@ks/viewers`, `@ks/contracts` + `@ks/api-client`, `@ks/shell` + SiteConfig,
  `@ks/module-explorer` als montierbare Wurzelkomponente. Nur ein Deployment,
  jede Welle verhaltensneutral.
- **Übergangskriterium A→B**: Die Voll-App läuft nachweislich auf den
  extrahierten Paketen (G4-Checks grün über eine volle Welle hinweg, Explorer
  wird aus dem Paket gemountet).
- **Phase B — Spezial-Ziele additiv (M5+)**: AECED-Embed + Headless-API,
  Oldies for Future als erster SiteConfig-Eintrag der Multi-Site-Runtime,
  Agent-View/MCP + Electron/local-first, Föderation (ADR 0009) und
  Retrieval-Profile (ADR 0010). Jedes Ziel nutzt dieselben Pakete; nichts
  wird für ein Ziel neu geschrieben.

## Nicht-Ziele dieser Migration

- Kein Multi-Repo-Split (erst nach stabilen Contracts, siehe ADR 0007 §1).
- Keine API-Umbenennungen/-Umzüge während Phase A (G4).
- Kein Deployment pro Site (ADR 0008 §1).
- Kein vorauseilendes Extrahieren von Modulen ohne konkretes Ziel (G3).
