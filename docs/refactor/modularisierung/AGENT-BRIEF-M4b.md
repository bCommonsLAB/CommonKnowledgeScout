# Agent-Brief: Modularisierung — Welle M4b (`@ks/ui`)

Stand: 2026-08-27. Erstellt zu Beginn der Umsetzungs-Session, analog
[`AGENT-BRIEF-M4.md`](AGENT-BRIEF-M4.md).

## Kontext (lies das ZUERST, in dieser Reihenfolge)

1. **`CLAUDE.md`** — Routing-Index, Coding-Konventionen.
2. **`AGENTS.md`** §Aktueller Fahrplan.
3. **[`migrations-strategie.md`](../../architecture/migrations-strategie.md)** —
   die fünf Garantien; hier tragend: G2 (`git mv`) und G4 (Verhaltensneutralität).
4. **[`modul-landkarte.md`](../../architecture/modul-landkarte.md)** §1
   (`@ks/ui`-Zeile), §4 (Import-Grenzregeln).
5. **[AGENT-BRIEF-M4.md](AGENT-BRIEF-M4.md)** — Hand-off mit den Messwerten,
   die diese Welle vorbereitet haben.

## Warum diese Welle jetzt kam

`@ks/ui` war der Blocker, an dem M3 (TopNav, Layouts) und M4 (montierbare
Explorer-Wurzelkomponente) beide gestoppt sind. Solange die shadcn-Basis in
der App liegt, kann kein Paket eine Oberfläche haben.

## Die beiden Vorab-Entscheidungen

### 1. Importeure umstellen statt Fassaden — umgesetzt

Das M4-Hand-off nannte 39 Fassaden gegen 798 Import-Zeilen. Gewählt wurde das
Umstellen. Begründung: Die Fassaden-Schuld aus M1/M2 war jedes Mal teurer als
der einmalige Umbau, und `knip` findet eine Fassade erst, wenn sie schon steht.
Real waren es 793 Statements in 316 Dateien; sie wurden pro Datei zu EINEM
`@ks/ui`-Import gebündelt (deshalb stehen im Diff mehr gelöschte als
eingefügte Zeilen).

Der Umbau war sicher, weil alle 793 Statements **reine Named-Imports** waren
(nachgemessen: kein einziger Default- oder Namespace-Import, genau eines mit
`type`). Verifiziert durch `tsc` über die ganze App: ein vergessener Name wäre
dort mit `TS2305` aufgeschlagen.

### 2. Ein Barrel statt Subpfaden

Über die 190 Export-Namen der 40 Module gibt es **keine Kollision** — ein
einzelnes `@ks/ui` genügt. Subpfade (`@ks/ui/button`) hätten eine
`exports`-Map gebraucht, deren Webpack-Auflösung sich nur im Next-Build
nachweisen ließe; der ist im Cloud-Agent gesperrt. Das Barrel-Muster trägt in
diesem Repo dagegen schon in fünf Paketen.

**Der Preis dieser Entscheidung, an genau einer Stelle**: Vier Tests haben
bisher `@/components/ui/use-toast` als ganzes Modul ersetzt. Ein Voll-Mock von
`@ks/ui` würde der getesteten Komponente sämtliche Primitives entziehen, also
mocken sie jetzt partiell:

```ts
vi.mock('@ks/ui', async (orig) => ({
  ...(await orig<typeof import('@ks/ui')>()),
  useToast: () => ({ toast: vi.fn() }),
}))
```

Wer künftig ein einzelnes Primitive mocken will, braucht dasselbe Muster.

## Zwei Abgrenzungen

**`llm-model-selector.tsx` ist kein Primitive.** Es zieht Daten (nutzt
`@ks/api-client` seit M2) und wurde nach `src/components/shared/` verschoben.
Läge es in `@ks/ui`, importierte eine Shared Library eine andere — die
Grenzregel aus Landkarte §4 verbietet das nicht ausdrücklich, aber es wäre der
erste Fall und ein schlechter Präzedenzfall.

**`src/components/icons.tsx` bleibt liegen.** Die Landkarte nennt es für
`@ks/ui`, es hat aber **null Importeure** — toter Code. Ihn ins Paket zu
verschieben hieße, tote Zeilen zu adeln. Ein Löschkandidat für einen
`knip`-Durchgang, keine Extraktion.

## Korrektur am M4-Hand-off: `cn` ist eine Auslösung, keine Verschiebung

Das M4-Hand-off schrieb, der `cn`-Schnitt halte `git log --follow` intakt.
**Das stimmt nicht, und zwar prinzipiell**: `src/lib/utils.ts` überlebt (die
Audio-/Video-Fehlertexte sind Fachlogik und bleiben in der App). Git erkennt
eine Umbenennung nur, wenn die Quelldatei GELÖSCHT wird — hier wird sie
verändert. `packages/ui/src/cn.ts` ist damit aus Git-Sicht eine neue Datei.

Nachgeprüft: die 40 shadcn-Dateien tragen ihre Historie (`git log --follow`
liefert Vorgänger-Commits), `cn.ts` nicht.

Das ist vertretbar und wurde deshalb nicht erzwungen: `cn` sind vier Zeilen,
ihre Herkunft steht als Kommentar in beiden Dateien, und `src/lib/utils.ts`
behält seine vollständige Historie. Die Alternative — ein Zwischen-Commit mit
kaputtem Baum, nur damit Git eine Umbenennung sieht — wäre für eine
Vier-Zeilen-Funktion unverhältnismäßig.

**Regel für künftige Wellen**: Wird nur ein TEIL einer Datei extrahiert, ist
`git mv` keine Option und `--follow` geht für das neue Stück verloren. Das ist
zu benennen, nicht zu behaupten.

## Nachtrag: der Build-Fehler auf master und was daraus folgte

M4b ging mit grünen Cloud-Gates (Tests, Lint, `typecheck:packages`) in den
Merge und **brach den Build auf master**:

```
Failed to collect configuration for /event-monitor/batches/[batchId]
cause: TypeError: (0 , o.createContext) is not a function
```

**Ursache**: 33 der 40 Dateien in `@ks/ui` hatten kein `"use client"` — schon
vorher nicht, als sie noch unter `src/components/ui/` lagen. Dort fiel es nie
auf, weil jeder Importeur selbst eine Client-Komponente war und die Grenze
damit weiter oben lag. Das Barrel hat das gekippt: `src/lib/utils.ts` reichte
`cn` durch `@ks/ui` durch und wird von vielen **Server**-Modulen importiert —
damit landete der gesamte Barrel-Graph im react-server-Layer, wo `chart.tsx`
und `form.tsx` beim Laden `createContext` aufrufen.

Die Extraktion hat den Fehler nicht erzeugt, sondern eine latente Lücke
sichtbar gemacht. **Die Regel daraus** (jetzt in Landkarte §4): Ein Paket darf
sich nicht darauf verlassen, dass seine Aufrufer die Client-Grenze für es
ziehen. Jedes Primitive deklariert sie selbst.

**Zwei Nachbesserungen**, beide bereits umgesetzt:

1. **`@ks/util`** — `cn` liegt jetzt dort statt in `@ks/ui`. Korrekte
   Client-Grenzen haben den Build repariert, aber die Ursache blieb: Eine
   reine Funktion, die serverseitig gebraucht wird, darf nicht an einem Paket
   voller Client-Komponenten hängen. `@ks/ui` hängt jetzt an `@ks/util`; das
   UI-Barrel exportiert `cn` nicht mehr (ein Zuhause, nicht zwei).
2. **`scripts/welle-pre-merge-check.sh`** kannte `pnpm typecheck:packages`
   nicht (das Skript ist älter als der Wächter aus M2b). Ist ergänzt, läuft als
   Schritt 2 vor Lint und Build, und der Build-Fehlerhinweis nennt jetzt den
   `use client`-Fall als erste Vermutung.

**Was prozessual schiefging**: `check-build` (PR-Workflow) und `ci-main`
(Push auf master) prüfen nicht dasselbe — der PR-Check fährt den
Docker-Build nicht. Der lokale `pnpm build` war als verbleibende Lücke
benannt, wurde aber als Nachlauf behandelt statt als Merge-Voraussetzung.
Für A-Wellen gilt: **Ohne grünen Build kein Merge**, und der Build gehört vor
den Merge-Button, nicht dahinter.

## Definition of Done — erreicht

- `pnpm test`: **3329 grün, 3 rot** — nur `tests/unit/mcp/tools-stand.test.ts`
  (auch auf `master` rot). Unverändert gegenüber dem Stand vor der Welle.
- `pnpm lint`: 0 Errors.
- `pnpm typecheck:packages`: grün, inkl. `packages/ui` — `@ks/ui` greift
  nachweislich nicht in die App zurück.
- `npx tsc --noEmit -p tsconfig.json`: 0 Fehler in `src/` und `packages/`.
- Keine Referenz auf `@/components/ui/` mehr im Repo.
- `pnpm build`: grün, 101 Seiten erzeugt (nach den Nachbesserungen oben —
  beim ersten Anlauf war genau das rot, siehe Nachtrag).

## Hand-off für die nächste Welle

**Nächste Welle**: M4c — `@ks/i18n` (`src/lib/i18n/` + Locale-Provider). Danach
ist die montierbare Explorer-Wurzelkomponente aus Landkarten-Zeile M4
erreichbar, und die in M3 blockierte TopNav ebenfalls.

**Messwerte als Vorarbeit** (Stand nach M4b):

- `src/lib/i18n/` sind 6 TS-Dateien plus 5 Übersetzungs-JSONs.
- **116 Dateien** importieren `@/lib/i18n` — Größenordnung wie `@ks/ui`, also
  wieder mehrere Commits nach Verzeichnis.
- Mit `@ks/i18n` fallen zugleich `jotai-locale-provider` und `locale-gate` in
  die Schale (in M3 als blockiert vermerkt) — dann hängt an `@ks/shell`
  auch der Locale-Teil der Provider-Kette.

**Zu prüfen, bevor Code entsteht**: `src/lib/i18n` hängt an `@/atoms/i18n-atom`
(Jotai). Die M3-Entscheidung lautet „keine Atome über Paketgrenzen, stattdessen
Hook-Oberfläche" — für `@ks/i18n` heißt das vermutlich, dass das Locale-Atom
mitwandert und das Paket `useTranslation()`/`useLocale()` exportiert, statt das
Atom selbst. Das ist die erste Entscheidung der Welle.

**Modellempfehlung**: Sonnet mit hohem Thinking-Level — mechanisch wie M4b,
aber mit einer echten Entwurfsfrage (Atom vs. Hook) am Anfang.

**Agent-Typ**: neuer Agent.

**Start-Prompt für den nächsten Cloud-Agenten**:

```
Branch von master (nach dem Merge): claude/modularisierung-welle-m4c

Pflichtlektuere in dieser Reihenfolge:
1. CLAUDE.md (Routing-Index + Coding-Konventionen)
2. AGENTS.md §Aktueller Fahrplan
3. docs/architecture/migrations-strategie.md — die fuenf Garantien
4. docs/architecture/modul-landkarte.md §1 (@ks/i18n-Zeile), §4, §6
5. docs/refactor/modularisierung/AGENT-BRIEF-M4b.md — Hand-off am Ende
   (Messwerte, die offene Atom-vs-Hook-Frage) und der Abschnitt zu `cn`

Setze Welle M4c um: @ks/i18n (src/lib/i18n/ + Locale-Provider/-Gate).
Entscheide zuerst Atom vs. Hook-Oberfläche und halte es in
AGENT-BRIEF-M4c.md fest.

Zwingend:
- git mv statt kopieren (G2). Wird nur ein TEIL einer Datei extrahiert,
  ist git mv unmoeglich — dann benennen, nicht behaupten (siehe cn-Abschnitt
  im M4b-Brief).
- Verhaltensneutral (G4): pnpm test + pnpm lint gruen, Voll-App unveraendert
- pnpm typecheck:packages muss gruen sein
- Vor dem ersten Commit: pnpm install
- Diff-Limits aus AGENTS.md: max 1.000z/Commit — bei 116 Importeuren
  auf mehrere Commits nach Verzeichnis aufteilen
- Hand-off-Block fuer die naechste Welle am Ende

Vorbestehend rot (nicht deine Schuld, nicht reparieren):
tests/unit/mcp/tools-stand.test.ts — 3 Tests, auch auf master rot.
```

**Kosten-Schätzung**: wie M4b (mittel).
