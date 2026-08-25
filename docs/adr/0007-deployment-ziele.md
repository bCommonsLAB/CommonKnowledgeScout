# ADR 0007 — Deployment-Ziele: Eine Instanz, viele Sites; Compilate nur bei anderer Laufzeit

- **Status**: Vorgeschlagen
- **Datum**: 2026-08-25
- **Kontext**: Erweitert [ADR 0006](0006-modularisierung-monorepo-schale-module.md).
  Grundlage: [`library-steckbriefe.md`](../architecture/library-steckbriefe.md)
  (Deployment-Anforderungen der realen Libraries) und die ausdrückliche
  Owner-Anforderung, die Deployment-Infrastruktur NICHT zu verkomplizieren
  (heute: eine GitHub Action + eine Instanz bedient alle Libraries und Use Cases).
- **Entscheider**: Repo-Owner

## Kontext

Die Steckbriefe verlangen sehr unterschiedliche Auslieferungsformen: Einbettung
in fremde Webseiten (SFSCON, CAST, Naturmuseum, Tamera, AECED), eine
React-Komponente + externe API für eine Fremdanwendung (AECED), PWA fürs Handy
(Naturmuseum), Electron/local-first für private bzw. Massen-Daten (Peters
Archiv, Diva-Texturen), MCP für Agenten (Peters Archiv) — und weiterhin die
öffentliche Multi-Library-Plattform. Die naive Deutung „pro Site ein eigenes
Deployment" würde die heutige Ein-Instanz-Infrastruktur zerstören.

## Entscheidung

### 1. „Ein Deployment, viele Sites" ist der Default

Die Deployment-Infrastruktur bleibt wie heute: EINE Pipeline, EINE Instanz,
alle Libraries und Sites. Es gibt KEIN Deployment pro Site.

- **Multi-Site-Runtime statt Multi-Build**: Die Instanz löst die SiteConfig
  ZUR LAUFZEIT pro Host auf — Verallgemeinerung des existierenden Musters
  `PUBLIC_DOMAIN_LIBRARY_MAP` + `getRootLandingTargetForHost()`
  (`src/lib/root-landing.ts`, `src/lib/domain-library-map.ts`). SiteConfigs
  sind DATEN (Host→Config-Registry), keine Build-Artefakte.
- **Der „schlanke Loader" ist Next.js-Code-Splitting entlang der
  Modulgrenzen**: Route-basiertes Splitting existiert bereits; die Schale lädt
  Module zusätzlich über `next/dynamic` NUR, wenn die SiteConfig sie aktiviert.
  Der Browser eines Site-Besuchers lädt so nur die Chunks der aktiven Module —
  das ist das eigentliche „kein unnötiger Code"-Ziel.
- **Ehrliche Einschränkung**: Das SERVER-Bundle der einen Instanz enthält alle
  Module und alle (per SiteConfig gegateten) API-Routen. Das kostet Disk/RAM
  auf dem Server, nicht Bandbreite beim Besucher — für das heutige Setup
  unerheblich. „Wirklich nicht ausgeliefert" gäbe es nur per separatem Build;
  kein Steckbrief braucht das.

### 2. Eigene Compilate NUR, wo die Laufzeit es erzwingt

Nie zur Bundle-Optimierung, sondern nur bei anderer Laufzeit-Hülle:

- **`electron`** — Peters Archiv (privat, local-first), Diva-Werkbank
  (Massenverarbeitung), Naturmuseum-Experten. Existiert heute schon als
  eigener Build (`electron/`, `electron-builder.yml`).
- **`embed` als npm-React-Komponente** — AECED: Paket-Publish (Registry
  existiert), KEIN Server-Deployment; die Fremdanwendung baut die Komponente
  in IHRE Pipeline ein und spricht per `@ks/api-client` remote gegen die
  Zentral-Instanz. iframe-Embed als leichtgewichtige Alternative auf derselben
  Grundlage.
- **Self-Hosting einzelner Sites durch Dritte** — bleibt als MÖGLICHKEIT der
  Paketstruktur erhalten, ist aber keine Pflicht und kein Planungsziel.

### 3. Achsenmodell zur Beschreibung eines Ziels

Jedes Auslieferungsziel wird beschrieben als `Modul-Set × Hülle × Datenzugang`:

- **Hüllen**: `next-app` (die EINE Multi-Site-Instanz), `embed` (npm/iframe),
  `electron`, `headless` (nur API/MCP, keine UI); `pwa` ist ein Flag auf
  `next-app` (Manifest + Service Worker pro Site).
- **Datenzugang**: `local` (eigene API + DB in derselben Instanz), `remote`
  (`@ks/api-client` gegen die Zentral-Instanz — Normalfall für `embed`),
  `local-first` (Electron: Daten bleiben auf dem Gerät).

### 4. Folge-Invarianten für die Pakete

- Jedes `@ks/module-*` exportiert eine **montierbare React-Wurzelkomponente
  mit Props** und verlässt sich NICHT auf Next.js-Datei-Routing. Das ist die
  Voraussetzung für `next/dynamic`-Loading in der Multi-Site-Runtime, für den
  AECED-Embed UND für Electron. Gilt ab Welle M4.
- **MCP ist eine Modul-Oberfläche** wie die HTTP-API: `@ks/module-agent-view`
  exportiert seine MCP-Tools (heute `src/lib/mcp/tools-*.ts` +
  `src/app/api/mcp/[transport]/`); Sites aktivieren sie per SiteConfig.

## Konsequenzen

- Positiv: Deployment bleibt so einfach wie heute; neue Sites sind
  Konfigurations-Einträge; Embed/Electron nutzen dieselben Pakete ohne Fork.
- Negativ/Aufwand: Die Schale braucht einen Host→SiteConfig-Resolver und
  `next/dynamic`-Ladepunkte pro Modul; API-Routen brauchen ein SiteConfig-Gate
  (Modul inaktiv ⇒ 404); PWA-Manifest muss pro Site generiert werden.
- Belegt durch die Steckbriefe: AECED (embed + headless), Peters Archiv
  (electron + mcp + local-first), Naturmuseum (pwa auf der Instanz + electron
  + embed), Diva (electron), Oldies for Future / SwapToLearn / Tamera (Sites
  auf der einen Instanz).
