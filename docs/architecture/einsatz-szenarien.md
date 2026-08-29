# Einsatz-Muster — Konfigurationsszenarien aus den Library-Steckbriefen

Abgeleitet aus [`library-steckbriefe.md`](library-steckbriefe.md) (den
Beschreibungen des Owners — dort steht das WAS, hier das WIE als
Konfiguration). Architektur-Grundlagen: ADR
[0007](../adr/0007-modularisierung-monorepo-schale-module.md) (Pakete/SiteConfig),
[0008](../adr/0008-deployment-ziele.md) (eine Instanz, viele Sites; Hüllen),
[0009](../adr/0009-library-foederation.md) (Föderation),
[0010](../adr/0010-retrieval-profile.md) (Profile).

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
Datenzugang `remote`. **Auth**: ausschließlich öffentlich lesend — **kein**
Site-Token, keine Besucher-Anmeldung (Owner-Entscheidung 2026-08-29, Nachtrag
in [ADR 0008](../adr/0008-deployment-ziele.md)). Geschützte Inhalte gibt es im
Embed nicht; dafür wird KnowledgeScout als eigenständige Anwendung genutzt.

```tsx
<KnowledgeScoutExplorer
  baseUrl="https://knowledgescout.org"
  library="aeced" view="gallery" locale={locale}
/>
```

**Fordert**: montierbare Wurzelkomponenten (ADR 0008 §4); CORS + anonymer
Lese-Zugriff; Mehrsprachigkeit als Prop.

## P3 — Fach-/Forschungsarchiv mit Laien- UND Experten-Zugang

Ein Bestand, zwei Profile: vereinfachter Zugang für Endanwender, spezifischer
für Experten — unterschiedlich in UI und Retrieval (ADR 0010). Kollektive
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
// Profile (simple/expert, geo-prefilter) liegen in der LIBRARY-Config (ADR 0010)
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
// languages: ['om','am','en','de'] im Library-Profil (ADR 0010 §4)
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
**Module**: keine UI; Explorer-Lese-Handler + Schlüssel. **Hülle**: `headless`
auf der bestehenden Instanz. **Auth**: **derselbe MCP-Konto-Schlüssel**, kein
zweiter Mechanismus (Owner-Entscheidung 2026-08-29, Nachtrag in
[ADR 0008](../adr/0008-deployment-ziele.md)).

> **Korrektur 2026-08-29**: Hier stand `api/libraries/[id]/tokens` als
> „vorhandener Baustein". Das ist falsch — diese Route liefert die
> OAuth-Zugangsdaten des Speicher-Anbieters (OneDrive), keine
> Konsumenten-Schlüssel. Der tatsächliche Baustein ist
> `src/lib/mcp/account-key-service.ts` mit `api/account/mcp-key`.

**Fordert**: stabiler, versionierter Lese-Vertrag in `@ks/contracts`
(Dokumente + Frontmatter-Metadaten + Facetten).

**Offene Kante**: Der Schlüssel löst zu einer Person auf und gilt mit deren
vollen Rechten — er kennt heute keine Bereiche und keine Beschränkung auf eine
Bibliothek. Wer einen Schlüssel hat, erreicht damit auch die schreibenden
MCP-Werkzeuge. Bis das anders ist, gilt: Einen Schlüssel bekommt nur, wem man
auch Schreibzugriff anvertraut. Ein technisches Konto pro Konsument mit reinen
Leserechten löst das ohne neuen Code.

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
| P2 Embed-Komponente | explorer | embed (npm/iframe) | remote | **nur public** | AECED, SFSCON, CAST, Naturmuseum, Tamera |
| P3 Laie+Experte-Archiv | explorer (+archive) | Site (+pwa, +electron) | local | public→clerk | Umweltarchiv, Pluriversum, Klima (Experten) |
| P4 Team-Archiv | explorer+archive | Site/Voll-App | local | clerk | Stakeholder Klimaarchiv |
| P5 Feld-Erfassung | creation (+explorer) | Site, mobil | local | capture/offen | Judith-Libraries, SwapToLearn, Peters Archiv |
| P6 Privates Agenten-Archiv | archive+agent-view | electron+mcp | local-first | Besitzer | Peters Archiv |
| P7 Werkbank | workbench+archive | electron | local-first | Anwender | Diva-Texturen |
| P8 Headless-API | — (Lese-Handler) | headless | Schluessel | **MCP-Konto-Schluessel** | AECED |
| P9 Multi-Quellen-Import | import+explorer | Voll-App → P2 | local | Creator | SFSCON, CAST |

Jede beschriebene Library trägt mindestens ein Muster; Klimamaßnahmen
kombiniert P1+P3 plus Föderation (ADR 0009); AECED kombiniert P2+P8.

## Verbleibende Konzept-Lücken (vor der jeweiligen Welle zu schließen)

1. ~~**Site-/Embed-Token** für Remote-Zugriff auf nicht-öffentliche Inhalte
   (P2/P8)~~ — **für P2 geschlossen** (Owner, 2026-08-29): Das Embed liefert
   ausschließlich öffentliche Inhalte, ein Site-Token entfällt ersatzlos.
   Geschütztes gibt es nur in der eigenständigen Anwendung mit Anmeldung.
   Siehe Nachtrag in [ADR 0008](../adr/0008-deployment-ziele.md).
   **Für P8 ebenfalls geschlossen** (Owner, 2026-08-29): Die Headless-API nutzt
   denselben MCP-Konto-Schlüssel, kein zweiter Mechanismus. Was offen bleibt,
   ist nicht der Schlüssel, sondern seine Reichweite — er gilt heute mit den
   vollen Rechten seines Besitzers. Siehe die „offene Kante" bei P8.
2. **Detail-View-Registry als Site-Plugin** (P1/P3: Klimamaßnahmen-Widgets
   wie CO2-Rechner; Spezialansichten) — Schnittstelle ab M2 in `@ks/contracts`.
3. **Trennung Lese-/Ingestion-Teil im `chat/*`-Namespace** — beim
   Handler-Schnitt in M4 (siehe Landkarte §3), Umzug später mit Aliassen.
4. **Modul-Kandidaten `import` (P9) und `workbench` (P7)** — Zuschnitt erst
   bei Projektstart SFSCON/CAST bzw. Diva konkretisieren.
