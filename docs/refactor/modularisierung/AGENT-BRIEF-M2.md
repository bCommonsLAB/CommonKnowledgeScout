# Agent-Brief: Modularisierung — Welle M2 (`@ks/contracts` + `@ks/api-client`)

Stand: 2026-08-27. Erstellt zu Beginn der Umsetzungs-Session, analog
[`AGENT-BRIEF.md`](AGENT-BRIEF.md) (Welle M1).

## Kontext (lies das ZUERST, in dieser Reihenfolge)

1. **`CLAUDE.md`** im Repo-Root — Routing-Index, Coding-Konventionen.
2. **`AGENTS.md`** §Aktueller Fahrplan — Modularisierung ist der laufende Strang.
3. **[`migrations-strategie.md`](../../architecture/migrations-strategie.md)** —
   die fünf Garantien. Wichtigste weiterhin: G2 (`git mv`, nie kopieren), G3
   (bedarfsgetrieben statt vollständig) und G4 (Verhaltensneutralität).
4. **[`modul-landkarte.md`](../../architecture/modul-landkarte.md)** §1
   (Paket-Zuschnitt `@ks/contracts`/`@ks/api-client`), §3 (API-Schnitt:
   Core-API vs. Modul-API), §4 (Import-Grenzregeln), §5 (Wellenplan).
5. **[AGENT-BRIEF.md](AGENT-BRIEF.md)** (M1) — Ausgangszustand: Workspace
   existiert, `@ks/viewers` ist das erste Paket, mit einer benannten Schuld
   (`markdown-helpers.ts` importierte `@/lib/storage/types`).

## Aufgabe M2

Zwei Pakete, ein Beweis-Ziel, eine aufgelöste Schuld aus M1.

### (a) `@ks/contracts` — Types/DTOs

Die Landkarte nennt als Ziel-Inhalt „Types, DTOs, SiteConfig-Schema,
Detail-View-Registry-Typen" aus `src/types/` + `src/lib/storage/types.ts`.
**Nicht wörtlich genommen**: `src/types/library.ts` (824 Zeilen) hängt an
`@/lib/chat/constants` (892 Zeilen) und `@/lib/i18n` — Vollmigration wäre ein
Vielfaches von M1s Zuschnitt und verstößt gegen G3 (bedarfsgetrieben) sowie
gegen die M1-Stop-Bedingung „Import-Anpassung zieht mehr als ~15 Dateien nach
sich". Stattdessen enthält `@ks/contracts` in M2:

- `storage-provider.ts` — **verschoben** (`git mv`) aus
  `src/lib/storage/types.ts`. Vollständig, selbstständig, keine
  Fremd-Abhängigkeiten — löst die M1-Schuld auf.
- `llm-model.ts`, `user-info.ts`, `library-identity.ts` — **neue**,
  bewusst minimale Core-API-DTOs (nicht aus bestehenden Dateien verschoben,
  weil es dort keine eigenständigen Typen für die Wire-Contracts gab — die
  Routen haben bisher implizit `any`/inline-Casts zurückgegeben). Jeder DTO
  ist so klein wie der aktuelle Client-Bedarf, nicht so groß wie das
  serverseitige Domainmodell (`LlmModel`, `Library`/`ClientLibrary`).

`src/lib/storage/types.ts` bleibt als dünne Re-Export-Fassade bestehen (G2)
— die ~20 bestehenden Importeure ändern sich nicht.

### (b) `@ks/api-client` — Fetch-Client + Query-Hooks

Core-API laut Landkarte §3: `libraries/*`, `user*`, `llm-models*`. M2 deckt:

- `http.ts` — generischer `apiFetch<T>`/`apiGet`/`apiPost` (wirft bei
  Nicht-OK-Response einen `Error` mit Server-Message — kein stiller
  Fallback).
- `llm-models.ts` — `fetchLlmModels(scope)` + `useLlmModels(scope, options)`
  (TanStack Query). **Vollständig verdrahtetes Beweis-Ziel** (siehe unten).
- `user.ts` — `fetchUserInfo()` + `useUserInfo()` gegen `GET /api/user-info`.
- `libraries.ts` — `fetchLibraries(email)` + `useLibraries(email)` gegen
  `GET /api/libraries?email=`, typisiert gegen den minimalen
  `LibraryIdentityDto` (siehe Kommentar dort für die Abgrenzung zu
  `ClientLibrary`).

**Bewusst nicht in M2**: POST/DELETE auf `libraries/*`, `user/accept-pending-invites`,
die volle Library-Config über den Client. Diese kommen, sobald ein konkretes
Modul (`@ks/shell` in M3, `@ks/module-explorer`/`-archive` in M4) sie
tatsächlich braucht (G3).

### Beweis-Ziel: `LlmModelSelector` auf den Client umgestellt

`src/components/ui/llm-model-selector.tsx` lud bisher selbst per
`fetch('/api/public/llm-models')` mit manuellem Loading-/Error-State. M2
stellt das auf `useLlmModels('public', { enabled })` um — Verhalten bewusst
identisch gehalten:

- `enabled: externalModels === undefined` verhindert den Request weiterhin,
  wenn der Aufrufer bereits Modelle übergibt (vorher: `useEffect`-Guard).
- Mapping auf `LlmModelOption` (Fallbacks `name || modelId`, `strengths ||
  undefined`) ist 1:1 übernommen.
- Beide echten Verwender (`secretary-advanced-form.tsx`,
  `chat/llm-model-section.tsx`) übergeben keine externen Modelle — durchlaufen
  also den neuen Client-Pfad unverändert sichtbar für den Nutzer.

`QueryProvider` umschließt den App-Baum bereits in `src/app/layout.tsx`
(beide Render-Zweige) — kein neuer Provider nötig.

### Design-Entscheidung aus M1 aufgelöst

`packages/viewers/src/markdown-helpers.ts` importiert `StorageProvider` jetzt
aus `@ks/contracts` statt aus `@/lib/storage/types` — die in M1 benannte
Schuld (Shared Library importiert in die App zurück) ist für den Storage-Typ
behoben. **Rest-Schuld**: `FileLogger` (`@/lib/debug/logger`) bleibt App-Import
— `@ks/util` existiert noch nicht und ist nicht Teil des M2-Zuschnitts
(„@ks/contracts + @ks/api-client", siehe Auftrag). Löst eine spätere Welle,
sobald `@ks/util` (oder Injection des Loggers) ansteht.

## Ablauf

1. `packages/contracts/` anlegen (`package.json` `@ks/contracts`,
   `tsconfig.json` nach Vorbild `packages/viewers/`).
2. `git mv src/lib/storage/types.ts packages/contracts/src/storage-provider.ts`,
   Fassade an der alten Stelle anlegen.
3. Neue DTOs (`llm-model.ts`, `user-info.ts`, `library-identity.ts`) +
   `index.ts`-Barrel.
4. `packages/api-client/` anlegen, `http.ts` + drei Endpunkt-Module +
   `index.ts`-Barrel. `@tanstack/react-query`/`react` als `peerDependencies`
   (keine zweite React-Instanz im Bundle).
5. `next.config.js` (`transpilePackages`), Root-`tsconfig.json` (`paths`),
   Root-`package.json` (`workspace:*`-Abhängigkeiten) ergänzen. `pnpm install`.
6. `LlmModelSelector` umstellen (Beweis-Ziel).
7. `markdown-helpers.ts`-Import auf `@ks/contracts` umstellen (M1-Schuld).
8. Tests für `@ks/api-client` (Fetch-Helper + Hook) ergänzen.

## Definition of Done

- `pnpm test` + `pnpm lint` grün (Referenz M1: 3247 Tests, 0 Lint-Errors —
  jede Abweichung ist deine).
- Voll-App startet, LLM-Modell-Dropdown in Settings verhält sich identisch
  (G4): lädt beim Öffnen, zeigt dieselben Modelle, gleiches Fallback-Mapping.
- `git log --follow` funktioniert für `storage-provider.ts` (echter Rename).
- Kein Feature existiert doppelt (G2) — `src/lib/storage/types.ts` ist reine
  Fassade, keine Parallel-Implementierung.
- Lokal vor Merge: `bash scripts/welle-pre-merge-check.sh`.

## Stop-Bedingungen (zusätzlich zu AGENTS.md)

- Vollmigration von `src/types/library.ts` (oder `chat/constants.ts`) wird
  angefordert ⇒ das ist M3/M4-Umfang (Shell-/Modul-Extraktion), nicht M2 —
  Owner fragen statt den Zuschnitt selbst auszuweiten.
- Der `LlmModelSelector`-Umbau ändert sichtbares Verhalten (andere Modelle,
  anderes Timing/Flackern) ⇒ abbrechen, Ursache klären, nicht "kleine
  Verbesserung nebenbei" machen (G4).

## Hand-off für M3

**Nächste Welle**: M3 — `@ks/shell` (Provider-Kette, Auth, Library-Bootstrap,
TopNav) + Host→SiteConfig-Resolver (Modul-Landkarte §5, §2).

**Offene Fragen aus der Landkarte, die M3 klären muss** (§6):
Jotai-Atome über Paketgrenzen, ob `storage-context`/`use-storage-provider` in
die Shell oder direkt in ein späteres `@ks/module-archive` gehört, und die
SiteConfig-Registry-Ablage (Datei vs. MongoDB — Startpunkt Datei).

**Modellempfehlung**: Sonnet mit hohem Thinking-Level — M3 schneidet die
App-Schale (Provider-Kette, Auth) heraus, das ist strukturell breiter als
M1/M2 und braucht sorgfältiges Nachverfolgen aller Importeure von
`app-layout.tsx`/`layouts/`.

**Agent-Typ**: neuer Agent (wie bisher).

**Start-Prompt für den nächsten Cloud-Agenten**:

```
Branch: claude/modularisierung-welle-m2-<suffix> ist gemergt (oder: neuer
Branch claude/modularisierung-welle-m3-<suffix> von master).

Pflichtlektuere:
1. CLAUDE.md (Routing-Index)
2. AGENTS.md §Aktueller Fahrplan
3. docs/architecture/modul-landkarte.md §2 (SiteConfig), §5 (Zeile M3)
4. docs/architecture/migrations-strategie.md — die fuenf Garantien
5. docs/refactor/modularisierung/AGENT-BRIEF-M2.md — Ausgangszustand

Schreibe zuerst ein AGENT-BRIEF-M3.md analog AGENT-BRIEF-M2.md, dann setze um:
@ks/shell (Provider-Kette: Theme, Jotai, QueryClient, Locale, Storage-Context;
Auth optional; Library-Bootstrap; konfigurierbare TopNav) + ein erster
Host→SiteConfig-Resolver, der die Voll-App als Default-Site der Registry
beschreibt. Beweis-Ziel: Voll-App laeuft unveraendert als Default-Site.

pnpm test + pnpm lint muessen gruen bleiben (Referenz: Stand nach M2, siehe
PR-Beschreibung).
```

**Kosten-Schätzung**: vergleichbar mit M1/M2 (mittlere Welle), eher am oberen
Ende wegen der Anzahl betroffener Importeure von Provider-Kette/TopNav.
