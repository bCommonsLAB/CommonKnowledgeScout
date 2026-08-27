# ADR 0007 — Modularisierung: pnpm-Monorepo, Schale, Modul-Pakete

- **Status**: Vorgeschlagen
- **Datum**: 2026-08-25
- **Kontext**: Anforderung des Owners, einzelne Anwendungsbereiche
  (zuerst Explorer/Chat und Agentensicht) in andere Webseiten zu bringen,
  ohne Doppel-Programmierung und ohne dass schlanke Deployments unnötigen
  Code laden. Detail-Konzeption:
  [`docs/architecture/modul-landkarte.md`](../architecture/modul-landkarte.md)
  und [`docs/architecture/einsatz-szenarien.md`](../architecture/einsatz-szenarien.md)
- **Entscheider**: Repo-Owner

> **Korrekturen (2026-08-25, nach den Library-Steckbriefen):** Drei Punkte
> dieses ADR sind durch Folge-ADRs präzisiert bzw. überholt:
> (a) §3 band EINE Library pro Site — Klimamaßnahmen braucht mehrere
> gekoppelte Libraries, siehe [ADR 0009](0009-library-foederation.md);
> (b) §5 verschob Embed ans Ende — mit AECED als Pilot ist der
> React-Komponenten-Embed in Welle M5 vorgezogen, siehe
> [ADR 0008](0008-deployment-ziele.md);
> (c) „schlanke Site = eigenes Deployment (`apps/<site>`)" ist ersetzt durch
> „ein Deployment, viele Sites" (Laufzeit-SiteConfig pro Host), siehe
> [ADR 0008](0008-deployment-ziele.md) §1 und
> [`migrations-strategie.md`](../architecture/migrations-strategie.md).
> Die Schichten-, Paket- und API-Entscheidungen (§1, §2, §4, §6) gelten
> unverändert.

## Kontext

KnowledgeScout ist zu einer komplexen Anwendung mit vielen fachlichen Modulen
gewachsen (Explorer/Chat, Archiv, Agentensicht, Creation-Wizard, Templates,
Event-Monitor, Session-Manager, Settings — sichtbar in der TopNav,
`src/components/top-nav-config.ts`). Mehrere produktive Libraries verfolgen
sehr unterschiedliche Zwecke (Kampagnen-Website, Wissensarchiv mit Chat,
B2B-Produktkatalog, mobile Erfassung — siehe Einsatz-Szenarien). Daraus folgt
der Bedarf, **Teil-Anwendungen** auszuliefern: eine Website, die NUR den
Explorer einer Library zeigt; eine Erfassungs-Site NUR mit dem Wizard.

Heute ist das nicht möglich, ohne die gesamte Anwendung zu deployen:

- Die „Schale" (Provider-Kette, Auth, Library-Bootstrap, TopNav) lebt implizit
  in `src/app/layout.tsx` + `src/components/layouts/app-layout.tsx` und ist
  nicht als eigenständige, konfigurierbare Einheit gefasst.
- Feature-Code ist als ein einziges Paket gebaut; jedes Deployment enthält
  alle ~180 API-Routen und alle Feature-Komponenten.
- Es gibt bereits Vorarbeit in diese Richtung: TopNav als reine
  Config-Funktion (`buildTopNavConfig()`), Host→Library-Mapping
  (`src/lib/domain-library-map.ts`, `src/lib/root-landing.ts`), Per-Library-
  Feature-Flags (`agentViewEnabled`, `siteEnabled`), Schale/Loader-Contracts
  (`../contracts/welle-3-schale-loader-contracts.md`).

## Entscheidung

### 1. pnpm-Monorepo statt Multi-Repo

Die Modularisierung erfolgt **im bestehenden Repository** als pnpm-Workspace
(`pnpm-workspace.yaml`) mit `packages/` (Bibliotheken/Module) und `apps/`
(Deployments). KEIN Aufteilen in mehrere Repositories, solange die
Schnittstellen nicht stabil sind: Multi-Repo würde jede Contract-Änderung zu
mehreren PRs + Versions-Bumps machen. Einzelne Pakete können SPÄTER in eigene
Repos ausgegliedert und publiziert werden (GitHub-Packages-Publishing existiert
bereits via `build:package`), sobald ihre Oberfläche stabil ist.

### 2. Drei-Schichten-Schnitt

1. **Shared Libraries** — wiederkehrende Bausteine ohne Fachlogik-Hoheit:
   `@ks/contracts` (Types/DTOs/SiteConfig), `@ks/ui` (shadcn-Basis, Theme),
   `@ks/viewers` (Markdown-Viewer, PDF-Viewer, Audio/Image-Preview),
   `@ks/api-client` (typisierter Client + Query-Hooks), `@ks/i18n`.
2. **Schale** — `@ks/shell`: Provider-Kette (Theme, Jotai, QueryClient,
   Locale), Auth (Clerk, pro Site abschaltbar), Library-Bootstrap
   (Libraries laden, aktive Library aus SiteConfig/URL setzen),
   konfigurierbare TopNav (ein-/ausblendbar).
3. **Modul-Pakete** — `@ks/module-*` (explorer, archive, agent-view,
   creation, templates, jobs, settings): je Modul UI + Hooks + **exportierte
   API-Route-Handler**. Module importieren NUR Shared Libraries und die
   Shell-Oberfläche, niemals andere Module.

### 3. Konfigurationsmodell: eine SiteConfig pro Deployment/URL

Jedes Deployment (die Voll-App eingeschlossen) wird durch GENAU EINE typisierte
Site-Konfiguration beschrieben: aktive Module, Library-Bindung (Slug/ID),
Menü sichtbar ja/nein, Auth-Modus (öffentlich/Clerk), API-Modus (lokal/remote).
Eine schlanke Site ist damit „Schale + SiteConfig + n Module" — das Menü kann
entfallen, weil die Site bereits vorkonfiguriert auf ihrer Library startet.
Schema-Skizze und Beispiele: Modul-Landkarte §SiteConfig.

### 4. API-Schnitt: Core-API + Modul-APIs, Handler aus dem Modul-Paket

- **Core-API** (Sammel-Endpoints, von allen Modulen genutzt): Identität/User,
  Library-Liste + Library-Config, Zugriffsprüfung, LLM-Modelle — heutiges
  `api/libraries/*`, `api/user*`, `api/llm-models*`.
- **Modul-APIs** behalten ihren Namespace (`api/chat/[libraryId]/*` →
  Explorer, `api/library/[libraryId]/agent-view/*` → Agentensicht, …).
- **Mechanik**: Module exportieren Route-Handler-Fabriken (z. B.
  `createExplorerApiHandlers(deps)`); Apps re-exportieren sie in dünnen
  `route.ts`-Dateien. Eine schlanke Site mountet NUR Core + die Handler ihrer
  Module — kein toter API-Code im Deployment.
- **Remote-Modus**: Alternativ rendert eine Site nur UI und spricht die
  zentrale KnowledgeScout-Instanz über `@ks/api-client` (BaseURL aus der
  SiteConfig, CORS + Token). Das ist zugleich das Fundament der
  Embed-Ausbaustufe.

### 5. Embed in fremde Seiten: spätere Ausbaustufe auf demselben Fundament

Gestufter Weg (Owner-Entscheidung): ZUERST schlanke eigene Deployments,
DANACH Einbettung in fremde Webseiten (iframe/Web Component) als Paket
`@ks/embed` auf Basis von Modul-Paketen + Remote-API-Modus + Token-Auth.
Dieses ADR legt dafür nur die Richtung fest, kein Detail-Design.

### 6. Grenz-Durchsetzung

Paketgrenzen werden technisch erzwungen: ESLint-Import-Regeln (Module dürfen
nur `@ks/contracts|ui|viewers|api-client|i18n` und die Shell-Oberfläche
importieren, nie andere Module; Shared Libraries importieren keine Module),
`knip` bleibt für tote Exporte zuständig.

## Konsequenzen

- **Positiv**: Teil-Deployments ohne Doppel-Programmierung; Bundles enthalten
  nur gebrauchte Module; Contracts werden explizit statt implizit; spätere
  Repo-Ausgliederung und Embed bleiben möglich, ohne heute deren Kosten zu
  zahlen; die Voll-App bleibt unverändert nutzbar (sie ist nur die „größte
  SiteConfig").
- **Negativ/Aufwand**: Workspace-Umbau von Build/CI/Electron; Jotai-Atome und
  `storage-context` müssen eine paketfähige Oberfläche bekommen; API-Handler
  müssen fabrikfähig werden (Dependency-Injection statt Direktimporte);
  Migration nur schrittweise (Wellen) möglich.
- **Einordnung** (Stand 2026-08-27): Die Modularisierung ist der **laufende
  Strang**. Der Werkbank-Strang (Agentensicht, Wellen W1–W8 und A1–A6) ist
  abgeschlossen; die Juni-Roadmap
  ([`roadmap-formatunabhaengige-library-und-onboarding.md`](../roadmap-formatunabhaengige-library-und-onboarding.md),
  Plan 1/Plan 2) ruht und wird später wieder aufgenommen. Migrationspfad:
  Modul-Landkarte §5 und [`migrations-strategie.md`](../architecture/migrations-strategie.md).
  Die Modularisierung baut auf
  ADR 0004 (Inbox-Modell: Erfassung ohne Ziel-Storage-Kopplung — Voraussetzung
  für eine isolierte Erfassungs-Site) und ADR 0005 (Co-Creator-Storage-Auth)
  auf und widerspricht ihnen nicht.

## Alternativen (verworfen)

- **Multi-Repo sofort**: sauberste Trennung, aber Versions-/PR-Overhead bei
  noch instabilen Contracts; als späterer Schritt weiter möglich.
- **Module Federation / Micro-Frontends zur Laufzeit**: löst Laufzeit-
  Komposition, die niemand angefragt hat; hohe Komplexität in Next.js;
  Build-Zeit-Komposition über Pakete reicht für „schlanke Sites" aus.
- **Nur Feature-Flags in der Voll-App**: blendet Menüpunkte aus, ändert aber
  nichts an Bundle-Größe und API-Fläche des Deployments.
