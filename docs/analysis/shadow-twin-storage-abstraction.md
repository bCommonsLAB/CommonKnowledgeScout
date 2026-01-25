## Ausgangsfrage

Warum behandeln so viele Code-Stellen Shadow‑Twins explizit als „MongoDB vs Filesystem“-Fallunterscheidung, statt eine zentrale Library/Klasse zu haben, die intern entscheidet, wie gelesen/geschrieben wird?

## Kritische Analyse (warum es aktuell “zersplittert” ist)

### 1) Historische Kopplung: “Provider-first”
Der bestehende Codepfad (Jobs, Preprocess, Resolver) ist stark auf den `StorageProvider` ausgerichtet:
- `resolveArtifact(provider, ...)` findet Artefakte über Filesystem/OneDrive/Drive – **nicht** über MongoDB.
- `analyzeShadowTwin()` und viele “existiert schon?”-Checks leiten sich aus Provider-Listen/Reads ab.

Sobald `primaryStore='mongo'` und `persistToFilesystem=false` gilt, sind diese Artefakte **absichtlich nicht mehr im Provider sichtbar**. Damit liefert der Provider-Pfad “nicht gefunden”, obwohl MongoDB den Shadow‑Twin hat. Das zwingt heute zu Spezialfällen (Mongo-first, provider-fallback).

### 2) Hybrid-Konfigurationen sind fachlich erlaubt
Eure Library-Config erlaubt Mischbetrieb:
- `primaryStore`: `'mongo' | 'filesystem'`
- `allowFilesystemFallback`: boolean
- `persistToFilesystem`: boolean

Das heißt: In manchen Situationen **muss** man mehrere Stores berücksichtigen. Wenn diese Logik nicht zentral gekapselt ist, taucht sie überall als “if/else” auf.

### 3) Unterschiedliche Entscheidungen brauchen unterschiedliche Artefakte
Nicht jede Phase fragt dasselbe:
- Extract: “Existiert Transcript (oder Transformation als Superset)?”
- Template/Ingest: “Existiert Transformation für `templateName` + Sprache und ist Frontmatter valide?”
- Completion/Contract: “Ist ein referenzierbarer `savedItemId` für den erwarteten Artefakt-Typ vorhanden?”

Wenn es keinen zentralen “ShadowTwinStore/Service” gibt, implementieren diese Stellen ihre eigene Interpretation – und dadurch entsteht Inkonsistenz.

## Zielbild (was du beschreibst)

Ein zentrales Objekt/Service, das von außen wie eine **einheitliche Shadow‑Twin API** wirkt:
- `getArtifact(...)`
- `upsertArtifact(...)`
- `exists(...)`
- `getBinaryFragments(...)`
- `resolveSavedItemIdForContract(...)`

Und intern (einmal) entscheidet:
- MongoDB vs Provider
- Fallbacks
- Konfiguration (`primaryStore`, `allowFilesystemFallback`, `persistToFilesystem`)

## Drei Lösungsvarianten

### Variante A — “Thin Facade” (funktional, minimal-invasiv)
Eine zentrale Datei `shadow-twin-service.ts` (oder ähnlich) mit Funktionen wie:
- `shadowTwinExists({ library, source, kind, lang, templateName })`
- `getShadowTwinMarkdown({ ... })`
- `upsertShadowTwinMarkdown({ ... })`

Intern:
- Wenn `primaryStore==='mongo'` → Mongo zuerst
- Wenn `allowFilesystemFallback` → Provider-Fallback

**Pro**
- Schnell umzusetzen, geringe Refactor-Kosten
- Reduziert Duplikation sofort

**Contra**
- Keine klare Objekt-/Interface-Struktur, Gefahr “God module”
- Auf Dauer schwer zu testen, wenn zu viel Logik hinein wandert

### Variante B — “Repository/Store Interface” (empfohlen, sauber testbar)
Definiere ein Interface:

- `ShadowTwinStore` mit Methoden:
  - `getArtifactMarkdown(key): Promise<{ id, name, markdown } | null>`
  - `existsArtifact(key): Promise<boolean>`
  - `upsertArtifact(key, markdown, binaryFragments?): Promise<{ id }>`
  - `getBinaryFragments(sourceId): Promise<...>`

Implementationen:
- `MongoShadowTwinStore`
- `ProviderShadowTwinStore` (filesystem/drive über `StorageProvider`)

Orchestrator:
- `ShadowTwinService` entscheidet nach Config und koordiniert Fallbacks:
  - `primaryStore` first
  - optionaler `fallbackStore`

**Pro**
- Single Source of Truth für Store-Wahl
- Sehr gut unit-testbar (Mock Store)
- Saubere Erweiterbarkeit (z.B. später Redis Cache, oder “hybrid store”)

**Contra**
- Refactor-Aufwand moderat (mehr Signaturen, Dependency Injection)

### Variante C — “Domain Object: ShadowTwin” (OO-Ansatz, “wie ein Objekt”)
Ein `ShadowTwin`-Objekt, das pro Source geladen wird, z.B.:
- `const st = await ShadowTwin.load({ userEmail, library, source })`
- `await st.getTranscript(lang)`
- `await st.getTransformation({ lang, templateName })`
- `await st.saveTransformation(...)`

Intern hält es:
- Store-Strategy
- Cache des geladenen Dokuments
- Hilfsfunktionen wie “Transformation impliziert Extract”

**Pro**
- Passt gut zu deinem mentalen Modell (“ShadowTwin als Objekt”)
- Weniger Parameter-Weiterreichen pro Call

**Contra**
- In Next.js/Server-Kontext muss man sehr sauber sein (keine Cross-Request-Mutation, kein global state)
- Gefahr von “zu viel Magie”, wenn Load/Cache/Side-effects nicht klar sind

## Empfehlung (technisch pragmatisch)

Ich würde **Variante B** wählen (Interface + Service):
- Minimal genug, um inkrementell zu refactoren
- Strukturiert genug, um das “if/else überall” dauerhaft zu eliminieren

Variante C kann später als dünner Wrapper um Variante B entstehen (z.B. `ShadowTwin` nutzt intern `ShadowTwinService`), wenn ihr wirklich das Objektmodell wollt.

## Inkrementeller Refactor-Plan (ohne Big Bang)

1) **Zentralen `ShadowTwinService` einführen**, aber zunächst nur für *Lesen/Existenz*:
   - `existsTranscriptOrTransformation(...)`
   - `getTransformationMarkdown(...)`

2) Kritische Hotspots migrieren:
   - Gates: `gateExtractPdf`, `gateTransformTemplate` (falls nötig)
   - Preprocessor: `findPdfMarkdown` (ersetzt direkte Mongo/Provider-Calls)
   - Completion: Contract-Auflösung (`savedItemId`) zentralisieren

3) Write-Pfade migrieren:
   - `persistShadowTwinToMongo`, `saveMarkdown` → über Service/Store

4) `analyzeShadowTwin()` so umbauen, dass es den Service nutzt (dann wird UI/Jobs konsistent).

## Warum wir es *jetzt* noch nicht komplett so gemacht haben

Der “Fix” war akut: ohne Mongo-aware Checks liefen Jobs unnötig neu oder fielen am Contract.
In so einer Situation ist eine punktuelle Anpassung risikoärmer als ein großflächiger Architektur-Umbau.

Das ändert nichts daran, dass die zentrale Kapselung mittelfristig der bessere Zustand ist.

