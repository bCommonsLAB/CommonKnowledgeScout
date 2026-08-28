# Agent-Brief: Modularisierung — Welle M4c (`@ks/i18n`)

Stand: 2026-08-28. Analog [`AGENT-BRIEF-M4b.md`](AGENT-BRIEF-M4b.md).

## Kontext (lies das ZUERST, in dieser Reihenfolge)

1. **`CLAUDE.md`** — Routing-Index, Coding-Konventionen.
2. **`AGENTS.md`** §Aktueller Fahrplan.
3. **[`migrations-strategie.md`](../../architecture/migrations-strategie.md)** — G2, G4.
4. **[`modul-landkarte.md`](../../architecture/modul-landkarte.md)** §1 (`@ks/i18n`),
   §4 (Grenzregeln — **insbesondere die Client-Grenze-Regel aus M4b**), §6.
5. **[AGENT-BRIEF-M4b.md](AGENT-BRIEF-M4b.md)** — der Nachtrag zum Build-Fehler.

## Die Entscheidungen der Welle

### 1. Zwei Einstiegspunkte — der Kern dieser Welle

Die Messung zeigt einen Schnitt, der fast von selbst da liegt:

| Importpfad | Dateien | Charakter |
|---|---|---|
| `@/lib/i18n/hooks` | **105** | ausschließlich Client (`useTranslation`) |
| `@/lib/i18n` (index) | 19 | davon **13 serverseitig**: Middleware, 5 API-Routen, `layout.tsx`, `types/library.ts` |
| `@/atoms/i18n-atom` | 6 | Provider + ein App-Verwender |
| `@/lib/i18n/get-localized` | 10 | bleibt in der App (hängt an `@/types/doc-meta`) |

Daraus folgt zwingend die Struktur von `@ks/shell`:

- **`@ks/i18n`** — Wurzel-Barrel, **frei von React und Jotai**: `t`,
  `getLocale`, `getTranslations`, `Locale`, `SUPPORTED_LOCALES`,
  `DEFAULT_LOCALE`, Übersetzungs-JSONs. Das ist der Pfad, den Middleware
  (Edge) und API-Routen benutzen.
- **`@ks/i18n/react`** — Hooks, Locale-Atom und Provider, alle `"use client"`.

**Warum das keine Stilfrage ist**: `hooks.ts` importiert `jotai`, und `jotai/react`
ruft beim Laden `createContext` auf. Läge es im Wurzel-Barrel, zöge jede der 13
Server-Dateien es in den react-server-Layer — exakt der Build-Fehler aus M4b,
nur mit Jotai statt Radix. Die Lehre von damals ist hier die Bauanleitung.

### 2. Locale-Atom: Hook-Oberfläche, Atom bleibt intern

Damit ist die offene Frage der Landkarte §6 auch praktisch entschieden, nicht
nur der Richtung nach: `localeAtom` wandert nach
`packages/i18n/src/react/locale-atom.ts` und wird **nicht exportiert**. Nach
außen gibt es nur Hooks. Vier der sechs bisherigen Atom-Verwender sind die
Provider selbst und ziehen mit ins Paket; für den fünften (`hooks.ts`) gilt
dasselbe. Übrig bleibt genau **eine** App-Datei.

### 3. Die Provider gehören ins i18n-Paket, nicht in die Schale

Der M3-Brief vermerkte, `jotai-locale-provider` und `locale-gate` fielen „mit
`@ks/i18n` in die Schale". **Das war falsch gedacht.** Lägen sie in
`@ks/shell`, bräuchte die Schale Zugriff auf `localeAtom` — das Atom müsste
exportiert werden und die Entscheidung aus (2) wäre hinfällig. Sie gehören zum
i18n-Paket, das damit seine eigene Client-Grenze vollständig selbst zieht.
`@ks/shell` weiß von Locale nichts.

### 4. Ein zweiter Setter, weil es zwei verschiedene Vorgänge sind

`home-client.tsx` setzt das Atom heute direkt — bewusst **ohne** das, was
`useSetLocale()` zusätzlich tut (Cookie schreiben, Seite neu laden). Das ist
kein Versehen: „Nutzer wählt eine Sprache" und „bereits ermittelte Sprache in
den State spiegeln" sind zwei Vorgänge. Das Paket exportiert deshalb beide,
scharf benannt:

- `useSetLocale()` — Sprachwechsel durch den Nutzer: Atom + Cookie + Reload.
- `useApplyLocale()` — nur das Atom setzen. Für Code, der die Locale schon
  kennt.

Sie zu verwechseln, erzeugt eine Reload-Schleife — deshalb steht der
Unterschied im Doc-Kommentar beider Hooks.

### 5. Zwei tote Dateien, die die Extraktion blockieren

- `src/lib/i18n/server.ts` — drei Exporte (`getServerLocale`,
  `getServerTranslations`, `serverT`), **null Verwender**.
- `src/components/providers/locale-initializer.tsx` — **null Verwender**
  (der gleichnamige Initializer in `jotai-locale-provider.tsx` ist ein anderer).

Beide importieren, was ins Paket wandert, und wären nach der Verschiebung nicht
mehr übersetzbar. Sie werden gelöscht statt mitgeschleppt: Toten Code ins Paket
zu heben, würde ihn adeln; ihn in der App zu reparieren, würde Arbeit in Code
stecken, den niemand aufruft. `server.ts` ist zudem kein Verlust — die
serverseitige Locale-Ermittlung macht `layout.tsx` selbst über `getLocale()`.

## Definition of Done

- `pnpm test`, `pnpm lint`, `pnpm typecheck:packages` grün.
- **`pnpm build` grün** — nach M4b nicht verhandelbar, und diese Welle fasst
  genau die Server/Client-Grenze an.
- Kein `@/lib/i18n`- oder `@/atoms/i18n-atom`-Import mehr (außer
  `get-localized`, das bleibt).
- Lokal vor Merge: `bash scripts/welle-pre-merge-check.sh`.

## Stop-Bedingungen (zusätzlich zu AGENTS.md)

- `get-localized.ts` soll mitwandern ⇒ es hängt an `@/types/doc-meta`; das ist
  ein Datenmodell der App, kein i18n-Belang. Erst wenn `doc-meta` in
  `@ks/contracts` liegt.
- Der Locale-Ermittlungspfad (URL > Cookie > Browser) soll „nebenbei
  vereinheitlicht" werden ⇒ Verhaltensänderung, eigenes Vorhaben.
