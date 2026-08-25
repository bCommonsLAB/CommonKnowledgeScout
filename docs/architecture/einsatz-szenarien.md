# Einsatz-Muster — Konfigurationsszenarien aus den Library-Steckbriefen

Abgeleitet aus [`library-steckbriefe.md`](library-steckbriefe.md) (den
Beschreibungen des Owners — dort steht das WAS, hier das WIE als
Konfiguration). Architektur-Grundlagen: ADR
[0006](../adr/0006-modularisierung-monorepo-schale-module.md) (Pakete/SiteConfig),
[0007](../adr/0007-deployment-ziele.md) (eine Instanz, viele Sites; Hüllen),
[0008](../adr/0008-library-foederation.md) (Föderation),
[0009](../adr/0009-retrieval-profile.md) (Profile).

Jedes Muster: Zweck · tragende Libraries · Module · Hülle/Datenzugang · Auth ·
Konfigurationsskizze · was es vom Konzept fordert. SiteConfig-Schema:
[`modul-landkarte.md` §2](modul-landkarte.md).

## P1 — Öffentliche Projekt-/Kampagnen-Website

Eigene URL/Domain, Startseite aus Library-Inhalten, Galerie + Story, anonym.
**Libraries**: Oldies for Future (das erklärte Muster), Klimamaßnahmen
(Endkunden-Sicht), SwapToLearn (nuvola), Tamera.
**Module**: `explorer`. **Hülle**: Site auf der einen Instanz (Host-Mapping).
**Auth**: public (P1-Variante Klimamaßnahmen: Login schaltet ins
Experten-Profil, siehe P3).

```ts
site('oldiesforfuture.org', {
  modules: ['explorer'],
  libraries: { primary: { slug: 'oldiesforfuture' } },
  chrome: { topNav: 'library-menu', footer: 'site' },
  auth: { mode: 'public' },
})
```

**Fordert**: Host→SiteConfig-Resolver; Library-Menü statt App-Menü;
clientseitig nur Explorer-Chunks (`next/dynamic`).

## P2 — Eingebettete Inhalts-Komponente in einer Fremdseite

Galerie/Story laufen INNERHALB einer fremden Webseite — als React-Komponente
(npm) oder iframe; Daten kommen remote von der Zentral-Instanz.
**Libraries**: AECED (React-Komponente, Pilot M5), SFSCON, CAST, Naturmuseum
(Museums-Website), Tamera.
**Module**: `explorer` (Wurzelkomponente). **Hülle**: `embed` ×
Datenzugang `remote`. **Auth**: public lesend; Site-Token für geschützte
Inhalte (offen, M5/M7).

```tsx
<KnowledgeScoutExplorer
  baseUrl="https://knowledgescout.org"
  library="aeced" view="gallery" locale={locale}
/>
```

**Fordert**: montierbare Wurzelkomponenten (ADR 0007 §4); CORS + anonymer
Lese-Zugriff; Mehrsprachigkeit als Prop.

## P3 — Fach-/Forschungsarchiv mit Laien- UND Experten-Zugang

Ein Bestand, zwei Profile: vereinfachter Zugang für Endanwender, spezifischer
für Experten — unterschiedlich in UI und Retrieval (ADR 0009). Kollektive
Pflege durch Eingeladene.
**Libraries**: Umweltarchiv/Naturmuseum, Pluriversum, Klimamaßnahmen
(Experten-Seite mit eigenen Beiträgen).
**Module**: `explorer` (+ `archive` für Pfleger in der Zentral-App).
**Hülle**: Site auf der Instanz + `pwa`-Flag (Naturmuseum) + `electron` für
Vielnutzer. **Auth**: public lesend, `clerk` ⇒ Experten-Profil/Pflege.

```ts
site('archiv.naturmuseum.example', {
  modules: ['explorer'],
  libraries: { primary: { slug: 'umweltarchiv' } },
  chrome: { topNav: 'library-menu' },
  auth: { mode: 'clerk', optional: true },   // anonym = simple-Profil
  pwa: true,
})
// Profile (simple/expert, geo-prefilter) liegen in der LIBRARY-Config (ADR 0009)
```

**Fordert**: Profil-Mechanik + pluggbare Retrieval-Strategien; Ingestion-
Post-Prozesse (Geo-/Autoren-Normalisierung); PWA pro Site.

## P4 — Geschütztes Team-Archiv

Arbeitsverzeichnis eines festen Teams: schnell ablegen, damit interagieren;
kein öffentlicher Zugang. **Libraries**: Stakeholder Klimaarchiv.
**Module**: `explorer` + `archive` (Ablage!). **Hülle**: Site auf der Instanz
oder direkt die Voll-App. **Auth**: `clerk` Pflicht (Invites).

```ts
site('stakeholder.knowledgescout.org', {
  modules: ['explorer', 'archive'],
  libraries: { primary: { slug: 'stakeholder-klimaarchiv' } },
  auth: { mode: 'clerk' },
})
```

**Fordert**: Login-first-Schale (keine öffentliche Landing).

## P5 — Niederschwellige Feld-Erfassung (audio-first, mehrsprachig)

Menschen diktieren unterwegs/im Treffen Botschaften; Transkription auch in
Oromo/Amharisch; Ergebnis wird sichtbar und im Story Mode beauskunftbar —
in denselben Sprachen. **Libraries**: Tapping into Abundance, MCS Ethiopia,
SwapToLearn (beide), Peters Archiv (mobiles Diktat).
**Module**: `creation` (+ `explorer` fürs Ergebnis). **Hülle**: Site auf der
Instanz, mobil (ggf. `pwa`). **Auth**: Capture-Rolle oder offene Kampagne.

```ts
site('stimmen.tappingintoabundance.example', {
  modules: ['creation', 'explorer'],
  libraries: { primary: { slug: 'tapping-into-abundance' } },
  chrome: { topNav: 'none' },                 // nur der Erfassungs-Flow
  auth: { mode: 'clerk', optional: true },
})
// languages: ['om','am','en','de'] im Library-Profil (ADR 0009 §4)
```

**Fordert**: Erfassungs-Site ohne Archiv-/Explorer-Zwang (ADR 0004-Inbox);
Vollbild-Wizard ohne Menü; Transkriptionssprachen aus dem Profil.

## P6 — Privates lokales Archiv mit Agenten-Zugang

Sehr private Daten; Verarbeitung lokal; Agenten (Cowork) arbeiten über MCP
mit dem Archiv. **Libraries**: Peters Archiv.
**Module**: `archive` + `agent-view`. **Hülle**: `electron` ×
`local-first`; MCP-Oberfläche aktiv. **Auth**: lokaler Besitzer.

**Fordert**: Electron lädt Module als Wurzelkomponenten; MCP-Tools als
Modul-Export (heute `src/lib/mcp/`); klare Grenze, was das Gerät nie verlässt.

## P7 — Lokale Massenverarbeitungs-Werkbank

Scraping + JSON-Annotation + Bild-LLM-Klassifikation großer Bestände;
Übersicht, Suche, Ähnlichkeit. **Libraries**: Diva-Texturen.
**Module**: `workbench` (neuer Modul-Kandidat, Landkarte §1) + `archive`.
**Hülle**: `electron` × `local-first`. **Auth**: lokaler Anwender.

**Fordert**: fließender Massen-Workflow (Queue-UI); Ähnlichkeitsdarstellung
(nutzt `src/lib/graph/`-Bausteine); Bild-LLM-Aufrufe aus der Werkbank.

## P8 — Headless-API für eine Fremdanwendung

Eine externe Anwendung fragt Library-Inhalte strukturiert ab — keine
KnowledgeScout-UI beteiligt. **Libraries**: AECED.
**Module**: keine UI; Explorer-Lese-Handler + Token. **Hülle**: `headless`
auf der bestehenden Instanz. **Auth**: API-Token pro Konsument
(vorhandener Baustein: `api/libraries/[id]/tokens`).

**Fordert**: stabiler, versionierter Lese-Vertrag in `@ks/contracts`
(Dokumente + Frontmatter-Metadaten + Facetten); Token-Scopes read-only.

## P9 — Konferenz-/Event-Aufbereitung aus Multi-Quellen

Eine Session entsteht (semi-)automatisch aus Video (YouTube u. a.) +
PowerPoint + Webseite; vor Ort schnell aufgebaut; Ergebnis als Galerie/Story
eingebettet (P2). **Libraries**: SFSCON (inkl. Ablösung der alten
Sessionverwaltung), CAST.
**Module**: `import` (neuer Modul-Kandidat) + `explorer`.
**Hülle**: Erfassung in der Voll-App/vor Ort; Ausspielung als P2-Embed.
**Auth**: Creator erfassen, Öffentlichkeit liest.

**Fordert**: Import-Flow Video+Slides+Web ⇒ Session-Dokumente (Secretary-
Bausteine `secretary/process-video|pdf` wiederverwenden); „schnell vor Ort"
als Messlatte.

## Abdeckungs-Matrix

| Muster | Module | Hülle | Datenzugang | Auth | Libraries |
|---|---|---|---|---|---|
| P1 Kampagnen-Website | explorer | Site auf Instanz | local | public | Oldies, Klima (Endkunden), SwapToLearn, Tamera |
| P2 Embed-Komponente | explorer | embed (npm/iframe) | remote | public/Token | AECED, SFSCON, CAST, Naturmuseum, Tamera |
| P3 Laie+Experte-Archiv | explorer (+archive) | Site (+pwa, +electron) | local | public→clerk | Umweltarchiv, Pluriversum, Klima (Experten) |
| P4 Team-Archiv | explorer+archive | Site/Voll-App | local | clerk | Stakeholder Klimaarchiv |
| P5 Feld-Erfassung | creation (+explorer) | Site, mobil | local | capture/offen | Judith-Libraries, SwapToLearn, Peters Archiv |
| P6 Privates Agenten-Archiv | archive+agent-view | electron+mcp | local-first | Besitzer | Peters Archiv |
| P7 Werkbank | workbench+archive | electron | local-first | Anwender | Diva-Texturen |
| P8 Headless-API | — (Lese-Handler) | headless | Token | Token | AECED |
| P9 Multi-Quellen-Import | import+explorer | Voll-App → P2 | local | Creator | SFSCON, CAST |

Jede beschriebene Library trägt mindestens ein Muster; Klimamaßnahmen
kombiniert P1+P3 plus Föderation (ADR 0008); AECED kombiniert P2+P8.

## Verbleibende Konzept-Lücken (vor der jeweiligen Welle zu schließen)

1. **Site-/Embed-Token** für Remote-Zugriff auf nicht-öffentliche Inhalte
   (P2/P8) — Minimalfall „anonym + öffentliche Library" reicht für M5-Start.
2. **Detail-View-Registry als Site-Plugin** (P1/P3: Klimamaßnahmen-Widgets
   wie CO2-Rechner; Spezialansichten) — Schnittstelle ab M2 in `@ks/contracts`.
3. **Trennung Lese-/Ingestion-Teil im `chat/*`-Namespace** — beim
   Handler-Schnitt in M4 (siehe Landkarte §3), Umzug später mit Aliassen.
4. **Modul-Kandidaten `import` (P9) und `workbench` (P7)** — Zuschnitt erst
   bei Projektstart SFSCON/CAST bzw. Diva konkretisieren.
