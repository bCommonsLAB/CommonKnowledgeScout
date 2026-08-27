# Agent-Brief: Modularisierung — Welle M3 (`@ks/shell` + Host→SiteConfig-Resolver)

Stand: 2026-08-27. Erstellt zu Beginn der Umsetzungs-Session, analog
[`AGENT-BRIEF-M2.md`](AGENT-BRIEF-M2.md) (Welle M2).

## Kontext (lies das ZUERST, in dieser Reihenfolge)

1. **`CLAUDE.md`** im Repo-Root — Routing-Index, Coding-Konventionen.
2. **`AGENTS.md`** §Aktueller Fahrplan — Modularisierung ist der laufende Strang.
3. **[`migrations-strategie.md`](../../architecture/migrations-strategie.md)** —
   die fünf Garantien. In M3 tragend: G2 (`git mv`, nie kopieren), G3
   (bedarfsgetrieben statt vollständig) und G4 (Verhaltensneutralität).
4. **[`modul-landkarte.md`](../../architecture/modul-landkarte.md)** §1
   (Paket-Zuschnitt `@ks/shell`), §2 (SiteConfig), §4 (Import-Grenzregeln),
   §5 (Wellenplan), §6 (offene Fragen — zwei davon entscheidet M3).
5. **[AGENT-BRIEF-M2.md](AGENT-BRIEF-M2.md)** — Ausgangszustand: drei Pakete
   (`@ks/viewers`, `@ks/contracts`, `@ks/api-client`), Paketgrenze seit M2b von
   `pnpm lint` UND `pnpm typecheck:packages` bewacht.

## Der Zuschnitt — und warum er kleiner ist als die Landkarten-Zeile

Die Landkarte nennt für `@ks/shell` als Ziel-Inhalt „Provider-Kette (Theme,
Jotai, QueryClient, Locale, Storage-Context), Auth (Clerk, abschaltbar),
Library-Bootstrap, konfigurierbare TopNav, Host→Library-Mapping". **Wörtlich
umsetzbar ist das in M3 nicht** — nicht aus Zeitgründen, sondern weil die
seit M2b scharfe Paketgrenze (`@ks/*` darf nicht in die App zurückgreifen) es
verbietet. Die Bestandsaufnahme:

| Kandidat | App-Abhängigkeiten | Verdikt M3 |
|---|---|---|
| `theme-provider.tsx` | keine (`next-themes`) | **verschoben** |
| `providers/query-provider.tsx` | keine (`@tanstack/react-query`) | **verschoben** |
| `top-nav-config.ts` (`buildTopNavConfig`) | keine (reine Funktion) | **verschoben** |
| `lib/domain-library-map.ts` | keine (nur `process.env`) | **verschoben** |
| `providers/jotai-locale-provider.tsx`, `locale-gate.tsx` | `@/atoms/i18n-atom`, `@/lib/i18n` | blockiert bis `@ks/i18n` |
| `atoms/library-atom.ts` (412 Z.) | `@/types/library` (824 Z.), `gallery-filters`, `diva-texture` | blockiert |
| `contexts/storage-context.tsx` (865 Z.) | Clerk, `StorageFactory`, `ClientLibrary`, `AuthLogger`, Dialog-Komponente | blockiert |
| `components/top-nav.tsx` (450 Z.) | ~15 App-Module: `@/components/ui/*`, `library-switcher`, `library-atom`, `@/lib/i18n/hooks`, `use-user-role`, `site-logo`, `create-library-wizard` | blockiert bis `@ks/ui` + `@ks/i18n` |
| `components/layouts/app-layout.tsx` | `top-nav-wrapper`, `job-monitor-panel`, `debug-footer`, `@/lib/utils`, Jotai-Atom | blockiert |

Die TopNav als Komponente zu verschieben hieße, `@ks/ui` und `@ks/i18n` in
derselben Welle mitzubauen — ein Vielfaches des M1/M2-Zuschnitts und ein klarer
Verstoß gegen die Diff-Limits aus `AGENTS.md`. Nach G3 (bedarfsgetrieben) wird
deshalb genau das extrahiert, was ohne neue Pakete grenzsauber geht, plus die
Neuleistung, die die Welle eigentlich ausmacht: der **Host→SiteConfig-Resolver**.

## Was M3 liefert

### (a) `@ks/shell` — zwei Oberflächen, bewusst getrennt

```
packages/shell/src/
  index.ts              → Wurzel-Barrel: REACT-FREI (site + nav)
  site/domain-library-map.ts   (git mv aus src/lib/)
  site/site-registry.ts        (NEU)
  nav/top-nav-config.ts        (git mv aus src/components/)
  providers/index.ts    → Subpfad `@ks/shell/providers`: Client-Komponenten
  providers/theme-provider.tsx (git mv)
  providers/query-provider.tsx (git mv)
```

Die Trennung ist keine Kosmetik: `src/middleware.ts` läuft in der
Edge-Runtime und importiert die Host-Auflösung. Läge die Provider-Kette im
selben Barrel, zöge jeder Middleware-Request React und `@tanstack/react-query`
in den Edge-Bundle. Deshalb `exports: { ".": …, "./providers": … }` in der
`package.json` und zwei `paths`-Einträge in der Root-`tsconfig.json`.

### (b) `SiteConfig` in `@ks/contracts`

Das Schema aus Landkarte §2, 1:1 übernommen — plus ein Feld `id`, das der
Entwurf nicht hatte: Ohne stabile Kennung ließe sich ein Registry-Eintrag in
Logs und Fehlermeldungen nicht benennen (`root-landing` meldet jetzt
„Site \"domain:oldiesforfuture.org\" ist auf Slug … gebunden"). Dazu der
Type-Guard `isSitePrimaryBySlug()`: Ohne ihn müsste jeder Aufrufer selbst
`'slug' in primary` prüfen — genau die Stelle, an der still auf einen Default
gefallen würde (`no-silent-fallbacks`).

**Nur `libraries.primary` wird in M3 ausgewertet.** Die übrigen Felder
(`modules`, `chrome`, `auth`, `api`, `pwa`) sind der deklarierte Vertrag für
M4 (Modul-Gate) und M6 (erste eigenständige Site). Sie jetzt schon zu
konsumieren wäre eine Verhaltensänderung — verboten nach G4.

### (c) Host→SiteConfig-Resolver

`buildSiteRegistry(domainMap)` macht aus jeder gemappten Domain eine Site mit
fest gebundener Primär-Library; jeder andere Host fällt auf
`DEFAULT_SITE_CONFIG` — die Voll-App, `primary: { mode: 'user-selected' }`.
`resolveSiteConfigForHost(host)` ist der Einstiegspunkt.

Zwei Entscheidungen, die dabei bewusst getroffen wurden:

- **Modul-Umfang host-gebundener Sites = Voll-App.** Heute liefert eine
  gemappte Domain dieselbe Anwendung aus; nur `/` zeigt die Landingpage ihrer
  Library. Ein schlankerer Modul-Satz wäre die Verhaltensänderung, die M6
  bringt — nicht M3.
- **`import` und `workbench` fehlen im Default-Modulsatz.** Das sind
  Modul-Kandidaten aus den Steckbriefen (Landkarte §1), im Code existieren sie
  nicht. Sie aufzuführen hieße, eine Fähigkeit zu behaupten, die es nicht gibt.

### Beweis-Ziel: `root-landing.ts` läuft über die Registry

`getRootLandingTargetForHost()` griff bisher direkt auf
`getDomainLibraryMap()[normalizeHost(host)]` zu. Jetzt löst es den Host gegen
die Registry auf und liest `libraries.primary`. Die Reihenfolge ist identisch
(1. host-gebundene Library, 2. globale `rootLibrarySlug`-Config), die
laute Fehlermeldung bei „gemappt, aber nicht öffentlich" bleibt. Ein Test
(`site-registry.test.ts`, letzter Fall) vergleicht Registry-Auflösung und
alte Map-Auflösung für vier Hosts auf Gleichheit.

Damit läuft die Voll-App nachweislich als Default-Site der Registry — das
Beweis-Ziel der Landkarten-Zeile M3.

## Die beiden offenen Fragen, die M3 entscheiden sollte

**Jotai-Atome über Paketgrenzen** (Landkarte §6): *Atome bleiben vorerst in der
App; die Schale exportiert keine Atome.* `library-atom.ts` hängt an
`ClientLibrary` (`src/types/library.ts`, 824 Zeilen, seinerseits an
`@/lib/chat/constants` und `@/lib/i18n`) — der Umzug ist nicht am Jotai-Muster
gescheitert, sondern am Typ-Rattenschwanz. Die Frage „Atom-Import vs. Hook"
lässt sich erst sinnvoll beantworten, wenn `ClientLibrary` in `@ks/contracts`
liegt. **Richtungsentscheidung trotzdem festhalten**: Wenn die Atome umziehen,
dann als Hook-Oberfläche (`useActiveLibrary()`), nicht als exportierte Atome —
ein exportiertes Atom bindet jeden Konsumenten an dieselbe Jotai-Instanz und
macht das Paket in einer Fremdanwendung (AECED, M5) unbrauchbar.

**`storage-context` / `use-storage-provider`** (Landkarte §6): *Bleibt in der
App und geht später direkt nach `@ks/module-archive`, nicht in die Schale.*
Der Kontext hängt an `StorageFactory`, Clerk-Hooks, `useUserRole` und einem
Reauth-Dialog — er ist keine Schalen-Infrastruktur, sondern die
Zugriffsschicht des Archivs. Ihn durch die Schale zu schleusen, würde jede
Site mit Storage-Code beladen, die gar kein Archiv aktiviert hat.

**Zusatz-Entscheidung**: `theme-provider.tsx` steht in der Landkarte unter
`@ks/ui`, liegt jetzt aber in `@ks/shell/providers`. Grund: `@ks/ui` existiert
nicht, und der Theme-Provider ist als Glied der Provider-Kette dort in
Gesellschaft. Sobald `@ks/ui` entsteht, ist der Umzug ein `git mv` von
Paket zu Paket.

## Definition of Done

- `pnpm test`: 3277 grün, 3 rot — **nur** `tests/unit/mcp/tools-stand.test.ts`
  (Timeout, auch auf `master` rot; nicht Gegenstand dieser Welle).
- `pnpm lint`: 0 Errors (Warnungen wie bisher: `no-empty` in External Jobs).
- `pnpm typecheck:packages`: grün, inkl. neuem `packages/shell/tsconfig.json`.
  Das ist der harte Nachweis, dass `@ks/shell` nicht in die App zurückgreift.
- `git log --follow` funktioniert für alle vier verschobenen Dateien.
- Kein Feature doppelt (G2): keine Fassaden nötig — alle fünf Importeure
  (`layout.tsx`, `top-nav.tsx`, `use-site-menu-items.ts`, `middleware.ts`,
  `root-landing.ts`) wurden direkt umgestellt.
- Lokal vor Merge: `bash scripts/welle-pre-merge-check.sh`.

## Stop-Bedingungen (zusätzlich zu AGENTS.md)

- Der Auftrag verlangt `top-nav.tsx`/`app-layout.tsx` als Komponenten im
  Paket ⇒ das setzt `@ks/ui` + `@ks/i18n` voraus, ist also eine eigene Welle.
  Owner fragen, nicht den Zuschnitt ausweiten.
- Ein SiteConfig-Feld außer `libraries.primary` wird verdrahtet ⇒
  Verhaltensänderung, gehört nach M4/M6.

## Hand-off für M4

**Nächste Welle**: M4 — `@ks/module-explorer` als montierbare
Wurzelkomponente inkl. Handler-Export + SiteConfig-Gate (Landkarte §5, §3).

**Was M4 vorfindet**: vier Pakete; `SiteConfig` samt Registry existiert und
liefert `modules` — das Gate (`withSiteGate('explorer', …)`) kann darauf
aufsetzen, ohne die Registry neu zu erfinden.

**Was M4 zuerst prüfen muss**: Der Explorer hängt an denselben Bausteinen, an
denen M3 gescheitert ist (`@/components/ui/*`, `@/lib/i18n`, `library-atom`).
Realistisch braucht M4 **zuerst `@ks/ui` und `@ks/i18n`** — oder es beginnt
mit dem serverseitigen Teil (Route-Handler-Fabrik + Gate), der diese
Abhängigkeiten nicht hat. Das ist die erste Entscheidung der Welle, und sie
gehört in ein `AGENT-BRIEF-M4.md`, bevor Code entsteht.

**Modellempfehlung**: Opus mit hohem Thinking-Level. M4 ist die erste Welle,
die einen echten Modul-Schnitt macht (UI + Hooks + API-Handler in einem Paket)
und dabei den API-Gate-Mechanismus einführt — strukturell schwieriger als M1–M3.

**Agent-Typ**: neuer Agent.

**Start-Prompt für den nächsten Cloud-Agenten**:

```
Branch von master (nach dem M3-Merge): claude/modularisierung-welle-m4

Pflichtlektuere in dieser Reihenfolge:
1. CLAUDE.md (Routing-Index + Coding-Konventionen)
2. AGENTS.md §Aktueller Fahrplan
3. docs/architecture/migrations-strategie.md — die fuenf Garantien
4. docs/architecture/modul-landkarte.md §1, §3 (API-Schnitt!), §4, §5
5. docs/refactor/modularisierung/AGENT-BRIEF-M3.md — insbesondere die
   Tabelle „warum der Zuschnitt kleiner ist als die Landkarten-Zeile"

Entscheide ZUERST und halte es in AGENT-BRIEF-M4.md fest: Beginnt M4 mit
@ks/ui + @ks/i18n (damit Explorer-UI ueberhaupt paketfaehig wird) oder mit
dem serverseitigen Teil (Route-Handler-Fabrik + withSiteGate auf Basis der
SiteConfig-Registry aus M3)? Setze dann NUR den gewaehlten Teil um.

Zwingend:
- git mv statt kopieren (G2); git log --follow muss weiter funktionieren
- Verhaltensneutral (G4): pnpm test + pnpm lint gruen, Voll-App unveraendert
- pnpm typecheck:packages muss gruen sein — Pakete duerfen NICHT in die App
  zurueckgreifen. Braucht ein Paket etwas aus der App: Injection
  (Muster: packages/viewers/src/logger.ts), nicht Import.
- Vor dem ersten Commit: pnpm install
- Diff-Limits aus AGENTS.md; Hand-off-Block fuer M5 am Ende

Vorbestehend rot (nicht deine Schuld, nicht reparieren):
tests/unit/mcp/tools-stand.test.ts — 3 Tests, auch auf master rot.

Wenn der Schnitt mehr als ~20 Dateien zieht: abbrechen und melden.
```

**Kosten-Schätzung**: höher als M1–M3. M4 berührt entweder zwei neue
Shared-Library-Pakete oder den API-Schnitt — beides mit mehr Importeuren als
die bisherigen Wellen.
