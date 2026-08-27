# Agent-Brief: Modularisierung — Welle M3 (`@ks/shell`, Erstschnitt)

Stand: 2026-08-27. Erstellt zu Beginn der Umsetzungs-Session, analog
[`AGENT-BRIEF-M2.md`](AGENT-BRIEF-M2.md) (Welle M2).

## Kontext (lies das ZUERST, in dieser Reihenfolge)

1. **`CLAUDE.md`** im Repo-Root — Routing-Index, Coding-Konventionen.
2. **`AGENTS.md`** §Aktueller Fahrplan — Modularisierung ist der laufende Strang.
3. **[`migrations-strategie.md`](../../architecture/migrations-strategie.md)** —
   die fünf Garantien. Wichtigste weiterhin: G2 (`git mv`, nie kopieren), G3
   (bedarfsgetrieben statt vollständig) und G4 (Verhaltensneutralität).
4. **[`modul-landkarte.md`](../../architecture/modul-landkarte.md)** §1
   (Paket-Zuschnitt `@ks/shell`), §2 (SiteConfig-Schema), §5 (Wellenplan),
   §6 (offene Fragen — M3 entscheidet drei davon, siehe unten).
5. **[AGENT-BRIEF-M2.md](AGENT-BRIEF-M2.md)** — Ausgangszustand: `@ks/contracts`
   und `@ks/api-client` existieren, `src/lib/storage/types.ts` ist Fassade.

## Ausgangs-Recherche (vor Umsetzung durchgeführt)

Ein Explore-Agent hat vor dieser Welle den gesamten Provider-/TopNav-/
Bootstrap-Bereich kartiert (Zeilenzahlen, Importeure, Kopplungen). Kernbefund:
**`library-atom.ts` hat 219 Importeure, `storage-context.tsx` 32** — beide
weit über dem M1-Stop-Kriterium „~15 Dateien". Das ändert den Zuschnitt
gegenüber der M2-Hand-off-Formulierung („Provider-Kette inkl. Storage-Context,
Library-Bootstrap, TopNav") — siehe „Nicht wörtlich genommen" unten.

## Aufgabe M3 (Erstschnitt)

Analog M1s „Beweis der Mechanik, nicht Vollständigkeit": `@ks/shell` startet
mit den Teilen der Provider-Kette, die **wirklich isoliert** sind (ein bis
zwei Importeure, keine oder triviale App-Rückimporte), plus dem
Host→SiteConfig-Resolver als komplett neuem Code.

### (a) `@ks/shell` — Provider-Kette (Teilmenge)

Per `git mv` verschoben:

| Datei | Zeilen | Importeure vorher |
|---|---|---|
| `src/components/theme-provider.tsx` | 8 | `layout.tsx` |
| `src/components/providers/query-provider.tsx` | 38 | `layout.tsx` |
| `src/components/providers/jotai-locale-provider.tsx` | 35 | `layout.tsx` |
| `src/components/providers/locale-provider.tsx` | 88 | `jotai-locale-provider.tsx` |
| `src/components/providers/locale-gate.tsx` | 63 | `layout.tsx` |
| `src/atoms/i18n-atom.ts` | 50 | `hooks.ts`, 4×Provider, `home-client.tsx` |
| `src/components/top-nav-config.ts` (`buildTopNavConfig`) | 152 | `top-nav.tsx`, `use-site-menu-items.ts`, Test |
| `src/lib/domain-library-map.ts` | 119 | `middleware.ts`, `root-landing.ts`, Test |

Zusätzlich gelöscht: `src/components/providers/locale-initializer.tsx` (101
Zeilen, **0 Importeure** — Recherche bestätigt: totes Duplikat der gleich-
namigen inneren Funktion in `jotai-locale-provider.tsx`). Kein Verschieben,
da tot; Löschung ist Aufräumen im Zuge der Extraktion, keine Verhaltensänderung.

**Benannte Schuld** (analog M1s `@/lib/storage/types`-Bridge): Die Locale-
Provider importieren weiterhin `@/lib/i18n` (Locale-Typ, `getLocale`) per
tsconfig-Pfad-Zuordnung aus der App — `@ks/i18n` (Landkarte §1, Schicht 1)
existiert noch nicht und ist nicht Teil des M3-Zuschnitts. Löst eine
spätere Welle, wenn `@ks/i18n` ansteht.

### (b) Host→SiteConfig-Resolver (neuer Code)

- `SiteConfig`-Interface in `@ks/contracts` (`site-config.ts`) — 1:1 das
  Schema aus `modul-landkarte.md` §2.
- `packages/shell/src/site-config/registry.ts`: `DEFAULT_SITE_CONFIG` —
  die Voll-App als Default-Site (`modules: [alle]`,
  `libraries.primary.mode: 'user-selected'`, `chrome.topNav: 'app-menu'`,
  `auth.mode: 'clerk', optional: true`).
- `packages/shell/src/site-config/resolve-site-config.ts`:
  `resolveSiteConfig(host)` — nutzt `getDomainLibraryMap()`/`normalizeHost()`
  (jetzt in `@ks/shell`) für den Host-Abgleich; liefert bei keinem Treffer
  `DEFAULT_SITE_CONFIG`. Edge-tauglich (keine DB-/Node-Abhängigkeiten), analog
  dem bestehenden `domain-library-map.ts`/`root-landing.ts`-Split.
- `middleware.ts` und `root-landing.ts` importieren `getDomainLibraryMap`/
  `normalizeHost`/`resolveForeignExploreRedirect`/`isLandingRedirectCandidate`
  jetzt aus `@ks/shell` statt aus `@/lib/domain-library-map` (Datei verschoben,
  keine Verhaltensänderung — reine Pfad-Anpassung, 2 Dateien betroffen).

**Beweis-Ziel**: `resolveSiteConfig()` beschreibt die Voll-App korrekt als
Default-Site der Registry (unit-getestet); die bestehende Domain-Redirect-
/Landingpage-Logik in Middleware und `root-landing.ts` funktioniert nach der
Pfad-Umstellung unverändert (bestehende Tests, jetzt gegen `@ks/shell`,
bleiben grün — G4).

### Drei offene Fragen aus `modul-landkarte.md` §6 — von M3 entschieden

1. **Jotai über Paketgrenzen**: Für M3 werden NUR Atome verschoben, deren
   Importeure sich an einer Hand abzählen lassen (`i18n-atom.ts`, 6
   Importeure — direkt umgestellt). `library-atom.ts` (219 Importeure)
   bleibt in der App. Grund: G3 — kein Ziel in M3 braucht die Verschiebung,
   und ein `git mv` mit Fassade würde zwar den Diff klein halten, aber die
   Fassade selbst wäre sofort wieder eine App→Shell-Rückabhängigkeit für
   `isBasecolorFileName` (DIVA-Filter, siehe Punkt 2 unten) — genau das
   Problem, das M1/M2 bei `markdown-helpers.ts` vermeiden wollten.
2. **`storage-context.tsx`/`use-storage-provider`**: bleibt in der App.
   Die Recherche bestätigt die in der Landkarte vermutete Schieflage:
   nahezu alle 32 Importeure sind Archiv-Komponenten, nicht Schale/Chrome.
   Entscheidung: verschieben, sobald `@ks/module-archive` ansteht (M4/M6),
   nicht vorher — sonst entsteht in `@ks/shell` sofort wieder Archiv-Fachlogik.
3. **SiteConfig-Registry-Ablage**: Datei (`packages/shell/src/site-config/
   registry.ts`), wie in der Landkarte als Startpunkt vorgeschlagen (auditier-
   bar, kein Migrationsaufwand). MongoDB-Ablage bleibt spätere Option.

## Nicht wörtlich genommen (Abweichung von der M2-Hand-off-Formulierung)

Die M2-Hand-off nannte „Provider-Kette, Auth, Library-Bootstrap,
konfigurierbare TopNav" als M3-Umfang. Nach der Recherche (s.o.) ist das für
einen Erstschnitt zu breit:

- **`AppLayout`/`HomeLayout`** (`src/components/layouts/**`): technisch nur
  1–2 Importeure, ABER beide importieren fünf weitere App-only-Pfade
  (`top-nav-wrapper`, `debug-footer-wrapper`, `job-monitor-panel`,
  `use-scroll-visibility`, `job-monitor-panel-open-atom`). Verschieben ohne
  diese fünf würde sofort wieder Rückimporte in die App erzeugen — mehr
  Schuld, als M3 auflösen soll. Bleibt in der App.
- **`TopNav`/`TopNavWrapper`** (Komponente, nicht `buildTopNavConfig`):
  `top-nav.tsx` rendert Clerk-Komponenten (`SignedIn`/`SignedOut`,
  `UserButton`) direkt im JSX — „Auth optional" verlangt hier einen echten
  Umbau (Abstraktion über Login-Status), nicht nur eine Env-Var-Prüfung wie
  `TopNavWrapper` sie heute schon hat. Das ist Design-Arbeit, kein Move —
  eigene Folge-Welle.
- **`StorageContextProvider`/Library-Bootstrap**: s. offene Frage 2 oben —
  bleibt in der App bis `@ks/module-archive`.
- **Auth (Clerk) generell**: `ClerkWrapper` ist eine Inline-Komponente in
  `layout.tsx` (kein eigenständiges File) und bleibt dort — echte
  „abschaltbare Auth" fürs SiteConfig-Schema ist mit der Clerk-in-JSX-
  Kopplung aus TopNav verzahnt (s.o.), daher eine Welle, keine Zeile.

Diese vier Punkte sind explizit **Hand-off für die nächste Welle** (siehe
unten), nicht vergessen oder übersehen.

## Ablauf

1. `packages/shell/` anlegen (`package.json` `@ks/shell`, `tsconfig.json`
   nach Vorbild `packages/api-client/`; `peerDependencies`: `react`, `jotai`,
   `@tanstack/react-query`, `next-themes`; `dependencies`: `@ks/contracts`).
2. Acht Dateien per `git mv` verschieben (Tabelle oben), `locale-initializer.tsx`
   löschen, `index.ts`-Barrel.
3. `SiteConfig` in `@ks/contracts` ergänzen; `registry.ts` +
   `resolve-site-config.ts` in `@ks/shell` neu schreiben.
4. Importeure umstellen (layout.tsx, hooks.ts, home-client.tsx, top-nav.tsx,
   use-site-menu-items.ts, middleware.ts, root-landing.ts) — sieben Dateien,
   reine Pfad-Änderung.
5. `next.config.js` (`transpilePackages`), Root-`tsconfig.json` (`paths`),
   Root-`package.json` (`workspace:*`) ergänzen; `pnpm install`.
6. Bestehende Tests (`domain-library-map.test.ts`, `top-nav-config.test.ts`)
   nach `tests/unit/packages/shell/` verschieben (Vorbild:
   `tests/unit/packages/api-client/http.test.ts`), Importpfade anpassen.
7. Neue Tests für `resolveSiteConfig()`.

## Definition of Done

- `pnpm test` + `pnpm lint` grün (Referenz M2: 3256 Tests, 0 Lint-Errors —
  jede Abweichung ist deine).
- Voll-App startet unverändert (G4): Locale-Initialisierung, TopNav-Inhalte,
  Domain-Redirects/Root-Landingpage verhalten sich identisch.
- `git log --follow` funktioniert für alle acht verschobenen Dateien.
- Kein Feature existiert doppelt (G2).
- Lokal vor Merge: `bash scripts/welle-pre-merge-check.sh`.

## Stop-Bedingungen (zusätzlich zu AGENTS.md)

- Der Umbau wird auf `AppLayout`/`TopNav`-Rendering/`StorageContextProvider`
  ausgeweitet, weil es „ja eigentlich dazugehört" ⇒ nicht tun, siehe „Nicht
  wörtlich genommen" — das sprengt den Zuschnitt und widerspricht G3.
- `resolveSiteConfig()` ändert das tatsächliche Routing-Verhalten (z.B.
  ersetzt `getRootLandingTargetForHost()` in `layout.tsx`) ⇒ abbrechen,
  das ist eine Verhaltensänderung (G4), keine Migrationswelle.

## Hand-off für die nächste Welle

**Nächste Welle**: M3-Folge (oder direkt M4, je nach Owner-Entscheidung) —
`AppLayout`/`TopNav`-Rendering mit „Auth optional"-Abstraktion (Clerk-JSX
entkoppeln), danach `@ks/module-explorer` (M4 laut Landkarte). Das offene
Design-Problem „Auth optional" sollte VOR M4 geklärt werden, da
`@ks/module-explorer` öffentliche Sites ohne Clerk bedienen soll.

**Offen für die Folge-Welle**:
- `AppLayout`/`HomeLayout` + die fünf App-only-Importe daraus in `@ks/shell`
  aufnehmen (oder deren Ziele selbst zuerst extrahieren: `job-monitor-panel`,
  `debug-footer-wrapper`, `use-scroll-visibility`).
- `TopNav`-Komponente: Auth-Status-Abstraktion statt direkter
  `SignedIn`/`SignedOut`/`UserButton`-Imports.
- `StorageContextProvider`/`library-atom.ts`: erst mit `@ks/module-archive`
  verschieben (s. offene Frage 2).

**Modellempfehlung**: Sonnet, hohes Thinking-Level (Clerk-Entkopplung in
TopNav ist die heikelste Einzeländerung im gesamten Modularisierungs-Plan).

**Agent-Typ**: neuer Agent.

**Kosten-Schätzung**: vergleichbar mit M3 (mittlere Welle), eher am oberen
Ende wegen der Clerk-Abstraktion in TopNav.
