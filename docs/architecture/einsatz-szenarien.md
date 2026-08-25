# Einsatz-Szenarien — produktive Libraries als Konfigurationsfälle

Ergänzung zu [ADR 0006](../adr/0006-modularisierung-monorepo-schale-module.md)
und [`modul-landkarte.md`](modul-landkarte.md): Die realen Libraries der
Prod-Umgebung, je Fall isoliert beschrieben und mit einem konkreten
`SiteConfig`-Szenario versehen. Zweck: belegen, dass das Konfigurationsmodell
ALLE Fälle ohne Sonderlocken trägt — und Lücken benennen, wo nicht.

Personas/Rollen-Grundlagen: [`use-cases-and-personas.md`](use-cases-and-personas.md).
Die Library-Namen/Slugs sind aus dem Repo abgeleitet (Template-Samples,
Domain-Mapping); vor dem M5-Start gegen die Prod-Datenbank verifizieren.

## Szenario 1 — Oldies for Future (Kampagnen-/Vereins-Website)

**Zweck & Zielgruppe.** Öffentliche Kampagnen-Website unter eigener Domain
(`oldiesforfuture.org`, heute via `PUBLIC_DOMAIN_LIBRARY_MAP` +
`src/lib/root-landing.ts`): Website-Seiten aus Live-Dokumenten
(`detailViewType: website`, `menu_order`), Galerie „Unsere Aktionen"
(Aktionsberichte), Story-Modus, Testimonials, Kontakt. Besucher sind anonym;
wenige Vereins-Creator pflegen Inhalte in der Zentral-App.

**Module.** `shell` (TopNav zeigt das LIBRARY-Menü, nicht das KS-Menü — heute
`exploreContext` in `buildTopNavConfig()`) + `module-explorer`.
NICHT dabei: archive, agent-view, creation (perspektivisch doch: Aktions-
berichte mobil erfassen → Ausbau mit `module-creation`), templates, jobs,
settings.

**APIs.** Core (nur Lese-Teil: `public/libraries/[slug]`, Kontakt) +
Explorer-Lese-APIs (`chat/[slug]/docs|facets|doc-by-slug`, `public/testimonials`).
Kein Schreibpfad.

**Auth.** `public` — komplett anonym lesbar.

**SiteConfig-Szenario.**

```ts
const oldiesForFuture: SiteConfig = {
  modules: ['explorer'],
  library: { mode: 'fixed', slug: 'oldiesforfuture' },
  chrome: { topNav: true, footer: false },   // Library-Menü ja, KS-Chrome nein
  auth: { mode: 'public' },
  api: { mode: 'remote', baseUrl: 'https://knowledgescout.org' },
  domains: ['oldiesforfuture.org'],
}
```

**Aufgedeckte Anforderungen.** (a) TopNav muss „Library-Menü statt App-Menü"
als SiteConfig-Fall können (existiert als `exploreContext`, wird formalisiert);
(b) Remote-Modus braucht anonymen, CORS-fähigen Lese-Zugriff auf öffentliche
Libraries; (c) Domain-Mapping wandert perspektivisch aus der ENV-Variable in
die SiteConfig der jeweiligen Site.

## Szenario 2 — Commoning / Ecosocial / Umweltarchiv (Wissensarchiv + Chat)

**Zweck & Zielgruppe.** Recherche-Archive über PDF-/Dokumentbestände
(Commoning-Methoden, Ecosocial, Umweltarchiv, Tamera): Explorer mit Facetten,
Dokument-Detail mit Markdown/PDF-Viewer, Chat/RAG über den Bestand.
Nutzer: Forschende/Interessierte, je Library öffentlich ODER
zugangsbeschränkt. Pflege (Ingestion, Shadow Twins, Transformationen)
geschieht durch Creator in der Zentral-App — NICHT in der schlanken Site.

**Module.** `shell` + `module-explorer` (inkl. Chat). NICHT dabei: archive
(Ingestion bleibt zentral), creation, agent-view, jobs, templates, settings.

**APIs.** Core + Explorer inkl. Chat-Laufzeit (`chat/[libraryId]/stream`,
`queries`, `adhoc`, `config`) und `llm-models`. Die Ingestion-Routen des
`chat/*`-Namespace werden NICHT gemountet — genau der in der Landkarte (§3)
markierte Schnitt „Lese-Explorer vs. Ingestion".

**Auth.** Je Library: `public` oder `clerk` (Zugriff über bestehendes
`libraries/[id]/access-check`/Invite-Modell).

**SiteConfig-Szenario.**

```ts
const commoningArchiv: SiteConfig = {
  modules: ['explorer'],
  library: { mode: 'fixed', slug: 'commoning' },
  chrome: { topNav: true, footer: true },
  auth: { mode: 'clerk', optional: true },   // anonym lesen, eingeloggt mehr
  api: { mode: 'local' },                    // eigener Chat-/RAG-Backend-Teil
}
```

**Aufgedeckte Anforderungen.** (a) Chat braucht serverseitige Secrets
(LLM-Keys, Mongo-Vektorsuche) → solche Sites laufen `api: local` oder brauchen
im Remote-Modus einen Site-Token gegen die Zentral-Instanz; (b) der
Ingestion-Teil von `chat/*` muss vom Lese-/Chat-Teil trennbar sein
(Handler-Fabriken getrennt schneiden).

## Szenario 3 — Diva-Texturen & Kataloge (Produktkatalog B2B)

**Zweck & Zielgruppe.** Geschlossene B2B-Kataloge: Diva-Texturen/-Dokumente,
Gaderform (Betten/Holzarten), Refurbed-Geräte, PC-Steckbriefe. Facetten-Katalog
mit SPEZIAL-Detailansichten (`detailViewType: divaTexture | divaDocument |
refurbedDevice`, Registry in `src/lib/detail-view-types/registry.ts`),
Lieferanten-/Preisdaten. Nutzer: Fachhändler/Partner, eingeladen (Clerk/Invite),
kein anonymer Zugriff.

**Module.** `shell` + `module-explorer` (mit registrierten Spezial-Renderern).
Für die Pflege-Rolle optional zusätzlich `module-archive` in einer eigenen
internen Site (oder Pflege bleibt in der Zentral-App). NICHT dabei: creation,
jobs, templates.

**APIs.** Core + Explorer + die Spezial-Routen des jeweiligen Katalogs
(`diva-texture/*` — in der Landkarte §3 als zuordnungsbedürftig markiert;
Ziel: als Site-/Modul-Erweiterung mountbar, nicht global).

**Auth.** `clerk` (Pflicht), Mitglieder über Invites
(`libraries/[id]/invites|members`).

**SiteConfig-Szenario.**

```ts
const divaKatalog: SiteConfig = {
  modules: ['explorer'],
  library: { mode: 'fixed', slug: 'diva-katalog' },
  chrome: { topNav: true, footer: false },
  auth: { mode: 'clerk' },                   // geschlossener Nutzerkreis
  api: { mode: 'local' },
}
```

**Aufgedeckte Anforderungen.** (a) Detail-View-Registry muss ERWEITERBAR pro
Site sein (Schnittstelle in `@ks/contracts`, Renderer als Site-Plugin) — sonst
lädt jede schlanke Site alle Spezialansichten; (b) katalogspezifische
API-Routen (`diva-texture/*`) brauchen denselben Fabrik-Mechanismus wie
Modul-APIs; (c) Auth-Modus `clerk` ohne öffentliche Landing muss von der
Schale getragen werden (Login-first).

## Szenario 4 — Dialogräume & Events (Erfassung + Secretary)

**Zweck & Zielgruppe.** Mobile/Feld-Erfassung: Dialogräume, Event-Berichte,
Testimonials, Meeting-Analysen (Templates `dialograum-creation-de`,
`event-creation-de`, `meeting_analyse-de` …). Nicht-technische Wizard-User
erfassen Audio/Foto/Text unterwegs; Submissions landen im Wartekorb/Inbox
(ADR 0004) und werden von Moderatoren geprüft und promotet. Ergebnis erscheint
im Explorer der Ziel-Library.

**Module.** `shell` + `module-creation` (Wizard, Upload, eigener Wartekorb-
Blick „meine Einreichungen"). Optional `module-explorer` fürs veröffentlichte
Ergebnis. NICHT dabei: archive (dank ADR 0004 kein Ziel-Storage-Zugriff nötig),
agent-view, jobs, templates, settings.

**APIs.** Core + Creation (`secretary/process-*`, `wizard-sessions/*`,
`submissions/*`, `stream-ingest/*`, `creation/upload-image`). Moderation/
Promotion (`submissions/[id]/approve|promote`) bleibt der Zentral-App
vorbehalten.

**Auth.** `clerk` mit Capture-Rolle (`libraries/[id]/me/capture`), oder
`public` für offene Erfassungsaktionen (z. B. Testimonial-Kampagne via
`public/secretary/process-audio`).

**SiteConfig-Szenario.**

```ts
const dialograumErfassung: SiteConfig = {
  modules: ['creation'],
  library: { mode: 'fixed', slug: 'dialograeume' },
  chrome: { topNav: false, footer: false },  // nur der Wizard, kein Menü
  auth: { mode: 'clerk', optional: true },   // Kampagnen ggf. anonym
  api: { mode: 'local' },                    // Uploads/Jobs serverseitig
}
```

**Aufgedeckte Anforderungen.** (a) Erfassungs-Site darf KEINEN Explorer-/
Archiv-Code laden — der wichtigste Beleg für den Modul-Schnitt; (b) Wizard
muss ohne sichtbares Menü als Vollbild-Flow laufen (`chrome.topNav: false`);
(c) Submission-Promotion braucht einen klaren Ort (Zentral-App), damit die
schlanke Site keinen Moderations-Code enthält.

## Abdeckungs-Matrix

| Szenario | Module | API-Namespaces (gemountet) | Auth | API-Modus | Menü |
|---|---|---|---|---|---|
| Oldies for Future | explorer | Core (Lese), `public/*`, `chat/*` (Lese) | public | remote | Library-Menü |
| Commoning/Ecosocial/Umweltarchiv | explorer | Core, `chat/*` (Lese+Chat), `llm-models` | clerk optional | local | Library-Menü |
| Diva/Gaderform/Refurbed/PC | explorer (+archive intern) | Core, `chat/*` (Lese), `diva-texture/*` | clerk | local | Library-Menü |
| Dialogräume/Events | creation (+explorer optional) | Core, `secretary/*`, `submissions/*`, `wizard-sessions/*` | clerk optional | local | keins |
| Voll-App knowledgescout.org | alle | alle | clerk optional | local | KS-Menü |

**Ergebnis.** Alle vier Fälle sind mit dem SiteConfig-Modell (Module ×
Library-Bindung × Chrome × Auth × API-Modus) beschreibbar. Verbleibende
Konzept-Lücken, die vor M5 zu schließen sind:

1. **Site-Token für Remote-Modus** (Szenario 1; für 2 im Remote-Fall) —
   Detail-Design in Welle M7, Minimalfall „anonym + public library" schon in M5.
2. **Detail-View-Registry als Site-Plugin** (Szenario 3) — Schnittstelle in
   `@ks/contracts` ab M2 mitdenken.
3. **Trennung Lese-/Ingestion-Teil im `chat/*`-Namespace** (Szenario 2) —
   beim Handler-Schnitt in M4 vollziehen.
