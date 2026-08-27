# Claude Code – Projektkontext CommonKnowledgeScout

Einstiegs-Memory für Claude Code. Was ein Agent bei JEDEM Task wissen muss,
hängt an dieser Datei — direkt oder über die `@`-Importe unten. Das Projekt
wird ausschließlich mit Claude Code entwickelt; frühere Cursor-Konventionen
sind hierher bzw. nach `docs/contracts/` überführt.

## Universelle Agent-Regeln

@AGENTS.md

## Architektur-Contracts (gelten immer)

@docs/contracts/no-silent-fallbacks.md
@docs/contracts/storage-abstraction.md

## Routing-Index: welcher Pfad, welche Regel

**Verbindlich.** Wer eine Datei aus der linken Spalte ändert, liest vorher die
zugehörigen Contracts unter [docs/contracts/](docs/contracts/) — der genannte
Skill fasst sie zusammen. Die ADR-Spalte nennt Entscheidungen, die für diesen
Bereich bereits getroffen sind (`docs/adr/`); Status **Aktiv** heißt bindend,
**Vorgeschlagen** heißt Richtung, aber noch nicht in Kraft.

| Pfad-Muster | Contracts (`docs/contracts/`) | Skill | ADR |
|---|---|---|---|
| `src/lib/external-jobs/**`, `src/app/api/external/jobs/**`, `src/app/api/pipeline/**`, `src/lib/transform/**`, `src/lib/markdown/**` | contracts-story-pipeline, external-jobs-integration-tests, ingest-mongo-only, no-error-as-artifact, frontmatter-single-serializer | `contracts-pipeline` | 0001 |
| `src/lib/storage/**`, `src/app/api/storage/**` | storage-abstraction, storage-contracts | `contracts-storage-twin` | 0005 |
| `src/lib/mcp/storage/**` | storage-abstraction, storage-contracts (§9) | `contracts-storage-twin` | — |
| `src/lib/shadow-twin/**`, `src/hooks/use-shadow-twin*` | shadow-twin-architecture, shadow-twin-contracts | `contracts-storage-twin` | — |
| `src/lib/ingestion/**` | ingestion-contracts | `contracts-ingestion-chat` | — |
| `src/lib/chat/**`, `src/app/api/chat/**` | chat-contracts, contracts-story-pipeline | `contracts-ingestion-chat` | 0010 |
| `src/lib/pipeline/**` | contracts-story-pipeline | `contracts-pipeline` | 0010 |
| `src/lib/templates/**`, `template-samples/**`, `src/components/templates/**` | templates-contracts, template-structure, media-lifecycle | `contracts-templates-media` | 0003 |
| `src/lib/secretary/**`, `src/app/api/secretary/**` | secretary-contracts, media-lifecycle | `contracts-templates-media` | — |
| `src/components/creation-wizard/**`, `src/components/submissions/**`, `src/lib/submissions/**`, `src/app/api/submissions/**` | ingest-mongo-only, media-lifecycle | `contracts-templates-media` | 0003, 0004 |
| `src/components/library/**` | welle-3-schale-loader-contracts, welle-3-archiv-detail-contracts, welle-3-iii-galerie-chat-contracts, shadow-twin-architecture | `contracts-ui` | 0002 |
| `src/components/settings/**` | welle-3-iv-settings-contracts | `contracts-ui` | — |
| `src/app/page.tsx`, `src/app/layout.tsx`, `src/lib/root-landing.ts` | website-landingpage | `contracts-ui` | 0008 |
| `src/types/library.ts`, `src/lib/services/library-service.ts`, `src/components/settings/library/**` | library-config-field | `checklisten-erweiterung` | — |
| `**/detail-view*.tsx`, `**/registry.ts`, `**/doc-meta-mappers.ts`, `**/validation.ts` | detail-view-type-checklist | `checklisten-erweiterung` | 0010 |
| `src/lib/events/**`, `src/app/api/event-job/**`, `src/components/event-monitor/**` | — | — | **0001 (Aktiv)** |
| `src/lib/gallery/**`, `src/app/api/library/*/favorites/**` | welle-3-iii-galerie-chat-contracts | `contracts-ui` | **0002 (Aktiv)** |
| `src/lib/library-access/**`, `src/app/api/libraries/*/members/**`, `.../invites/**` | — | — | 0005 |
| `src/lib/graph/**`, `src/app/api/library/*/doc-relations/**` | — | — | 0009 |
| `pnpm-workspace.yaml`, `packages/**`, `apps/**`, `next.config.js` | — | — | 0007, 0008 |
| `docs/refactor/**`, `docs/plans/**`, `scripts/welle-pre-merge-check.sh` | refactor-batch-strategy, refactor-naming-konvention, cloud-agent-cost-strategy | — | — |

Steht ein Bereich nicht in der Tabelle, gelten weiterhin die beiden immer
aktiven Contracts oben (`no-silent-fallbacks`, `storage-abstraction`) sowie die
Repo-Konventionen in `AGENTS.md`.

**Pflege:** Neuer Contract oder neues ADR ⇒ Zeile hier ergänzen (und das ADR
zusätzlich in der ADR-Liste in `AGENTS.md` eintragen).

## Querschnitt-Konventionen (Docs)

Wiederkehrende Muster — lesen, statt Referenz-Code komplett zu reverse-engineeren:

- [mongodb-repository-pattern.md](docs/architecture/mongodb-repository-pattern.md) – Repos unter `src/lib/repositories/`
- [api-route-conventions.md](docs/architecture/api-route-conventions.md) – Handler unter `src/app/api/**`
- [file-preview-tab-architecture.md](docs/architecture/file-preview-tab-architecture.md) – Tabs der Datei-Vorschau

## Skills

Skills liegen unter [.claude/skills/](.claude/skills/) und werden anhand ihrer
`description` automatisch geladen, wenn ein Task dazu passt.

**Contract-Skills** — fassen die Regeln eines Bereichs zusammen und verweisen
auf `docs/contracts/` (Zuordnung siehe Routing-Index oben):
`contracts-pipeline`, `contracts-storage-twin`, `contracts-ingestion-chat`,
`contracts-templates-media`, `contracts-ui`, `checklisten-erweiterung`.

**Aufgaben-Skills** — führen eine konkrete Tätigkeit aus:
`archiv-aufraeumen`, `integration-test`, `shadow-twin-verify`,
`website-publishing`.

## Pläne

Aktive Pläne liegen unter [docs/plans/](docs/plans/), erledigte unter
[docs/plans/archiv/](docs/plans/archiv/). Der aktive Plan ist in `AGENTS.md`
benannt. Die `status:`-Marker in den Plan-Dateien sind nicht verlässlich
gepflegt — im Zweifel gegen den Code prüfen.

## Coding-Konventionen

**Benennungskonventionen**
- Verwende Kleinbuchstaben mit Bindestrichen für Verzeichnisse (z. B. `components/auth-wizard`).
- Bevorzuge benannte Exporte für Komponenten.

**TypeScript**
- Bevorzuge `interfaces` statt `types`.
- Vermeide `enums`; nutze stattdessen Maps.

**Schlüsselkonventionen**
- Nutze `nuqs` für die Zustandsverwaltung von URL-Suchparametern.
- Begrenze `use client`: bevorzuge Server-Komponenten und Next.js SSR; nutze es nur
  für Web-API-Zugriffe in kleinen Komponenten, nicht für Datenabruf oder
  Zustandsverwaltung.
- Verwende `pnpm` als Paketmanager.

**State-Management**
- Jotai für atomare Zustandsverwaltung.
- TanStack Query für Server-Zustände.
- React Hook Form + Zod für Formularverwaltung.

**Authentifizierung**
- Clerk für Authentifizierung; Next.js Middleware für Routen-Schutz.

### TypeScript-Linter-Regeln

#### 1. unknown/any in JSX
- Niemals `unknown` oder `any` direkt als JSX-Child verwenden.
- Immer vorher in einen String umwandeln:
  ```tsx
  <pre>{value !== undefined && value !== null ? String(value) : ''}</pre>
  ```
  oder
  ```tsx
  <pre>{typeof value === 'string' ? value : JSON.stringify(value)}</pre>
  ```

#### 2. Type Assertion/Type Guard
- Bei Zugriff auf Properties von `unknown` immer ein Interface und Type Assertion/Type Guard nutzen:
  ```ts
  interface MyType { foo: string }
  const val = obj as MyType;
  ```

#### 3. Fehlerobjekte im catch-Block
- Wenn das Fehlerobjekt nicht verwendet wird: `catch { ... }` statt `catch (error) { ... }`.

### Next.js 13+ App Router Regeln

#### Route Handler Parameter
In Next.js 13+ App Router müssen dynamische Route-Parameter IMMER awaited werden:

```typescript
// ❌ FALSCH
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id; // FEHLER!
}

// ✅ RICHTIG
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params; // Params müssen awaited werden!
}
```

#### API Route Pattern
Alle API Routes sollten diesem Pattern folgen:
1. Params als Promise typisieren: `{ params: Promise<{ paramName: string }> }`
2. Params awaiten: `const { paramName } = await params;`
3. Authentifizierung prüfen
4. Request-Body parsen (wenn nötig)
5. Business-Logik ausführen
6. Response zurückgeben

#### Sicherheitsregeln
1. NIEMALS sensible Daten (Tokens, Secrets) an den Client senden
2. Client Secrets immer maskieren: `clientSecret: secret ? '********' : undefined`
3. Token-Status statt Token-Werte zurückgeben

#### Projekt-spezifische Regeln
- LibraryService.getInstance() für Datenbankzugriffe verwenden
- Clerk für Authentifizierung (auth() und currentUser())
- MongoDB für Datenpersistierung
- Immer User-Email statt User-ID verwenden
