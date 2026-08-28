# Agent-Brief: Modularisierung — Welle M4d (`ClientLibrary` → `@ks/contracts`)

Stand: 2026-08-28. Analog [`AGENT-BRIEF-M4c.md`](AGENT-BRIEF-M4c.md).

Namensbegründung: `M5` ist im Wellenplan der Landkarte §5 für den AECED-Pilot
(`@ks/embed`) reserviert. Diese Welle löst — wie M4b und M4c — einen Blocker
der Mutter-Welle M4 auf und bekommt daher nach
[`refactor-naming-konvention.md`](../../contracts/refactor-naming-konvention.md)
R2 den Mutter-Namen mit Suffix.

## Kontext (lies das ZUERST, in dieser Reihenfolge)

1. **`CLAUDE.md`** — Routing-Index, Coding-Konventionen.
2. **`AGENTS.md`** §Aktueller Fahrplan.
3. **[`migrations-strategie.md`](../../architecture/migrations-strategie.md)** — G2, G4.
4. **[`modul-landkarte.md`](../../architecture/modul-landkarte.md)** §1
   (`@ks/contracts`), §4 (Grenzregeln — **Client-Grenze aus M4b**), §6.
5. **[AGENT-BRIEF-M4b.md](AGENT-BRIEF-M4b.md)** — der Build-Fehler, dessen
   Muster sich hier wiederholt, diesmal mit React selbst statt Radix.

## Der Befund, der die Welle bestimmt

Die Annahme aus dem M4c-Hand-off war, `@/lib/chat/constants` sei der Engpass.
**Das ist falsch.** `src/types/library.ts` (823 Zeilen) importiert drei Dinge:

| Import | Schwere | Messung |
|---|---|---|
| `ReactNode` von `react` | **der Blocker** | 2 Felder: Z. 569 (`Library`), Z. 750 (`ClientLibrary`) |
| `Character`, `AccessPerspective`, `TargetLanguage`, `SocialContext` | leicht | 4 reine String-Unions, kein Laufzeitcode |
| `Locale` von `@ks/i18n` | erledigt | seit M4c im Paket |

`chat/constants.ts` hat 892 Zeilen und 36 `export const`-Blöcke (Prompts,
Defaults) — gebraucht werden davon aber nur vier Typ-Aliase in den Zeilen 103,
276, 426, 470. Kein Engpass.

Der `react`-Import ist der Grund, warum `ClientLibrary` nicht nach
`@ks/contracts` kann: Ein Contracts-Paket mit React-Abhängigkeit zöge jede
Server-Datei in den react-server-Layer — exakt der Build-Fehler aus M4b.

## Die Entscheidungen der Welle

### 1. `icon` ist der gesamte React-Anteil — und trägt heute zwei Dinge

- Der Server liefert **Strings**: `'Globe'`, `'Lightbulb'` (Lucide-Namen aus
  der DB, gesetzt in `library-service.ts:519`).
- Genau **eine** Client-Stelle legt JSX hinein:
  `create-library-dialog.tsx:289` (`icon: <Plus className="h-4 w-4" />`) beim
  optimistischen Einfügen einer neu angelegten Library in den lokalen State.

Entsprechend widersprüchlich sind die Verwender:
`library-grid.tsx:128` deklariert korrekt `icon?: string` und löst über
`LucideIcons[name]` auf — `library-switcher.tsx:148` rendert
`{currentLibrary?.icon}` roh. Stünde dort ein String, läse man wörtlich
„Globe"; es fällt nur nicht auf, weil das Feld dort meist leer ist.

### 2. Owner-Entscheidung: kein Symbol mehr in der TopNav

Der Header zeigt künftig **nur den Namen** der Library. Damit entfällt der
einzige Grund, an dieser Stelle überhaupt etwas zu zeichnen:

- `library-switcher.tsx:148` — `{currentLibrary?.icon}` ersatzlos entfernen.
- `create-library-dialog.tsx:289` — kein JSX mehr ins Feld legen.

Die **Startseite behält ihre Kachel-Symbole** (`library-grid.tsx`); die holt
sie ohnehin über den Namen und ist von dieser Welle nicht betroffen.

Danach ist `icon?: string` überall wahr und `src/types/library.ts` React-frei.
Das ist die eigentliche Freischaltung — sie ist isoliert testbar und sollte
der erste Commit sein.

### 3. Die vier Vokabular-Typen wandern samt Werteliste

Nach `@ks/contracts` (Vorschlag: `chat-vocabulary.ts`) gehen die vier
String-Unions — **und** `SOCIAL_CONTEXT_VALUES`, das direkt neben
`SocialContext` steht.

Die reine Lehre spräche dagegen (das Paket beschreibt, es rechnet nicht).
Owner-Entscheidung ist trotzdem **mitnehmen**, und zwar aus dem Grund, der
diese ganze Welle motiviert: Getrennt stünde dieselbe Aufzählung an zwei
Orten, und irgendwann ergänzt jemand ein Wort nur an einer Stelle. Eine
Aufzählung von acht Literalen ist kein Rechnen. Verwender der Werteliste sind
`chat-config-bar.tsx`, `chat-welcome-assistant.tsx` und
`model-config-section.tsx` — alle bauen daraus Auswahlmenüs.

`chat/constants.ts` re-exportiert die vier Typen, damit die bestehenden
Importeure unverändert bleiben. Die 36 Konstanten-Blöcke bleiben, wo sie sind.

### 4. `ClientLibrary` wird beim Umzug geteilt

`ClientLibrary` hat **78 Felder**, `Library` ist die Server-Variante daneben.
Ein Umzug am Stück würde die Fehlkonstruktion nur verschieben. Der Zuschnitt:

- **kurz** — für öffentliche, nicht angemeldete Ansichten. Referenz ist die
  bereits existierende Handkopie `PublicLibrary` in `library-grid.tsx:22`:
  `id`, `label`, `slugName`, `description`, `icon`, `backgroundImageUrl`,
  `requiresAuth`, `detailViewType` plus ein Ausschnitt der Chat-Config.
- **voll** — alles Übrige, inkl. `config.secretaryService` mit `apiUrl`,
  `apiKey`, `pdfExtractionMethod`. Die Secretary-Konfiguration **bleibt
  unverändert pro Library einstellbar**; die vier Formular-Dateien unter
  `src/components/settings/` werden nicht angefasst.

**Sicherheit ist hier NICHT das Argument.** `library-service.ts` maskiert
`['secretaryService', 'apiKey']` bereits vor der Auslieferung
(`maskApiKey`, Z. 442 ff.). Der kurze Steckbrief ist eine zweite Absicherung,
nicht die Rettung. Das Argument ist die Handkopie: Zwei Beschreibungen
derselben Sache laufen auseinander.

### 5. `LibraryIdentityDto` ablösen, nicht danebenstellen

`packages/contracts/src/library-identity.ts` (7 Felder) sagt im eigenen
Doc-Kommentar, dass es abgelöst wird, „sobald ein Modul die volle
Library-Config über den Client braucht — nicht vorher dupliziert". Diese
Welle ist dieser Zeitpunkt: Das DTO wird Teilmenge des kurzen Steckbriefs
oder verschwindet. Es darf **nicht** als dritte Variante bestehen bleiben.

## Reihenfolge (jeder Schritt eigener Commit)

1. `icon` entwirren (Entscheidung 1+2) — TopNav ohne Symbol, `icon?: string`.
   Danach ist `types/library.ts` React-frei. **Isoliert testbar.**
2. Vokabular-Typen + Werteliste nach `@ks/contracts`, Re-Export in
   `chat/constants.ts`.
3. Steckbrief teilen und umziehen; `PublicLibrary` in `library-grid.tsx`
   durch den kurzen Typ ersetzen; `LibraryIdentityDto` auflösen.

Schritt 1+2 passen zusammen in eine PR und machen Schritt 3 zu reinem
Verschieben. 22 Dateien importieren `ClientLibrary` — die Liste steht in der
Welle selbst per `grep -rl "ClientLibrary" src/ packages/`.

## Definition of Done — Stand nach der Welle

- [x] `src/types/library.ts` importiert nichts aus `react` mehr
- [x] TopNav zeigt nur den Library-Namen; Startseiten-Kacheln unverändert
- [x] `@ks/contracts` enthält Vokabular-Typen + kurzen/vollen Steckbrief
- [x] `PublicLibrary` in `library-grid.tsx` ist ersetzt, nicht dupliziert
- [x] `LibraryIdentityDto` ist entfernt — keine dritte Variante
- [x] Secretary bleibt pro Library konfigurierbar (Formulare unangetastet —
      `git diff` gegen `src/components/settings/` ist leer)
- [x] `pnpm test` (3409 grün), `pnpm lint` (0 Errors),
      `pnpm typecheck:packages` grün, `tsc -p tsconfig.json` 0 Fehler in
      `src/` und `packages/` (die 131 Altfehler unter `tests/` sind
      unverändert — vorher wie nachher dieselbe Liste)
- [ ] `bash scripts/welle-pre-merge-check.sh` lokal grün **vor** dem Merge
      — **offen, gehört dem Owner** (der Cloud-Agent faehrt keinen Build)
- [x] Voll-App unverändert (Verhaltensneutralität, Migrationsstrategie G4)

### Was den Build betrifft

Der M4b-Fehlermodus (React im react-server-Layer) ist hier strukturell
ausgeschlossen, nicht nur unauffällig: **jeder** Import in
`packages/contracts/src/` ist ein `import type` und damit zur Laufzeit
erased — auch der neue auf `@ks/i18n`. Im ganzen Paket kommt weder `react`
noch Jotai noch Radix vor; die Laufzeit-Exporte sind reine Funktionen und
Arrays. Das ersetzt den lokalen `pnpm build` nicht, engt aber ein, wonach
zu suchen wäre, falls er doch rot wird.

## Abweichungen vom Brief (bewusst, nicht übersehen)

1. **Die Werteliste wird re-exportiert statt ihre Verwender umzuhängen.**
   Der Brief nennt `chat-config-bar.tsx`, `chat-welcome-assistant.tsx` und
   `model-config-section.tsx` als Verwender — es sind **vier**,
   `src/hooks/use-story-context.ts` kommt dazu. Alle vier holen
   `SOCIAL_CONTEXT_VALUES` im selben Import wie `SOCIAL_CONTEXT_DEFAULT` und
   `SOCIAL_CONTEXT_LABELS`, die in `constants.ts` bleiben. Sie umzuhängen
   risse Geschwister auseinander; der Re-Export ist die G2-Fassade, und es
   gibt weiterhin genau eine Definition.
2. **`library-switcher.tsx` verliert drei `icon`-Ausgaben, nicht eine.**
   Der Brief nennt Z. 148 (den Trigger). Die Auswahlliste rendert dasselbe
   Feld noch zweimal (Z. 161, 180) — mit `icon?: string` stünde dort wörtlich
   „Globe". „Kein Symbol in der TopNav" heißt hier: alle drei.
3. **Der kurze Steckbrief trägt `logoUrl`.** Die Handkopie hatte es nicht,
   `GET /api/public/libraries` sendet es. Genau die Drift, wegen der der Typ
   umzieht.
4. **`ClientLibrary` zieht mit seinen Bausteinen um**, nicht allein:
   `StorageProviderType`, `TranslationsConfig`, `CaptureWizards*`,
   `GalleryGraphConfig`, `LibraryChatConfig`. Ohne sie wäre der Typ im Paket
   nicht übersetzbar. `Library`, `StorageConfig`, `FavoriteEntry`,
   `FileListItem` und `FilePreview` bleiben in der App (G3) — sie beschreiben,
   was nur der Server kennt.
5. **Vier Dateien statt einer** in `@ks/contracts`: `library-config.ts` (65),
   `library-chat.ts` (186), `library-client.ts` (197),
   `library-profile.ts` (60). Die 200-Zeilen-Regel aus `AGENTS.md`.
6. **Schritt 3 sind zwei Commits (3a/3b), nicht einer.** Am Stück hatte er
   1.067 Zeilen Diff und riss damit das harte 1.000-Zeilen-Limit aus
   [`refactor-batch-strategy.md`](../../contracts/refactor-batch-strategy.md).
   Der Schnitt liegt an der natürlichen Naht: 3a bringt die Bausteine ins
   Paket (ohne sie wäre `ClientLibrary` dort nicht übersetzbar), 3b teilt und
   verschiebt den Steckbrief selbst. Beide Zwischenstände sind übersetzbar
   und getestet.

## Hand-off für die nächste Welle

**Zurück zur Landkarten-Zeile M4**: die montierbare
Explorer-Wurzelkomponente. Das Fundament ist damit vollständig — `@ks/ui`
(M4b), `@ks/i18n` (M4c), Library-Steckbrief (M4d). Kein benannter Blocker
mehr offen.

**Erste Entscheidung der nächsten Welle** — unverändert die aus M4c, aber
jetzt ohne Vorbedingung: TopNav zuerst oder direkt die Explorer-Wurzel?

- **TopNav** (`src/components/top-nav.tsx`, 450 Z.) ist der kleinere Test.
  M4c listete als Hindernisse: `library-atom` (hing an `ClientLibrary` —
  **erledigt**), `use-user-role`, `use-site-menu-items`, `site-logo`,
  `create-library-wizard`, Clerk. Der Rest ist ungelöst; die Frage aus M4c
  bleibt: erst prüfen, ob eine Props-Oberfläche (die Schale reicht herein,
  was die TopNav braucht) den Schnitt ermöglicht, statt die Abhängigkeiten
  mitzunehmen. Clerk ist dabei der eigentliche Prüfstein — die Schale soll
  Auth abschaltbar tragen (Landkarte §1, Schicht 2).
- **`library-atom` in die Schale** ist jetzt neu möglich und wäre der
  kleinste ehrliche Schritt: Landkarte §6 nennt die Hook-Oberfläche als
  Muster (`@ks/i18n/react` hält sein Atom paketintern). Wer die TopNav will,
  braucht das Atom ohnehin.
- **Explorer-Wurzel** ist das eigentliche Ziel, aber breiter.

**Was diese Welle NICHT angefasst hat und als Nächstes auffallen wird**:
`src/lib/chat/constants.ts` ist mit 892 Zeilen unverändert der größte
Brocken unter den Contracts-Kandidaten, und `src/types/library.ts` hat mit
442 Zeilen die 200-Zeilen-Regel weiterhin gerissen. Beides ist bewusst
liegen geblieben (G3) — beides ist eine eigene Welle, keine Beifang-Arbeit.

**Modellempfehlung**: Opus mit hohem Thinking-Level, wenn die Wahl auf die
Explorer-Wurzel oder die TopNav fällt (Entwurfsarbeit, kein Verschieben).
Für `library-atom` allein reicht Sonnet.

**Zwingend für jede weitere A-Welle** (Lehre aus M4b): `pnpm build` gehört
vor den Merge, nicht danach. `check-build` fährt den Docker-Build nicht.

## Stop-Bedingungen (zusätzlich zu AGENTS.md)

- Ein Feld des kurzen Steckbriefs braucht doch etwas aus dem vollen →
  **nicht** heimlich verbreitern, sondern den Zuschnitt im PR zur Diskussion
  stellen.
- `icon` taucht an einer weiteren Stelle als JSX auf, die dieser Brief nicht
  nennt → melden statt umdeuten.
- Der Umzug erzwingt eine Änderung an `src/lib/chat/constants.ts` über den
  Re-Export hinaus → abbrechen, das wäre eine eigene Welle.
