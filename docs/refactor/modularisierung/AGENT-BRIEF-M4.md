# Agent-Brief: Modularisierung — Welle M4 (SiteConfig-Gate + `@ks/module-explorer`)

Stand: 2026-08-27. Erstellt zu Beginn der Umsetzungs-Session, analog
[`AGENT-BRIEF-M3.md`](AGENT-BRIEF-M3.md).

## Kontext (lies das ZUERST, in dieser Reihenfolge)

1. **`CLAUDE.md`** — Routing-Index, Coding-Konventionen.
2. **`AGENTS.md`** §Aktueller Fahrplan.
3. **[`migrations-strategie.md`](../../architecture/migrations-strategie.md)** —
   die fünf Garantien; in M4 tragend: G3 (bedarfsgetrieben) und G4
   (Verhaltensneutralität).
4. **[`modul-landkarte.md`](../../architecture/modul-landkarte.md)** §1, §3
   (**API-Schnitt** — der eigentliche Gegenstand dieser Welle), §4, §5.
5. **[AGENT-BRIEF-M3.md](AGENT-BRIEF-M3.md)** — insbesondere die Tabelle
   „warum der Zuschnitt kleiner ist als die Landkarten-Zeile".

## Die Eingangsentscheidung der Welle

Das M3-Hand-off stellte M4 vor die Wahl: **zuerst `@ks/ui` + `@ks/i18n`**
(damit Explorer-UI überhaupt paketfähig wird) **oder zuerst der serverseitige
Teil** (Handler-Zuordnung + SiteConfig-Gate). Gemessen wurde beides, bevor
entschieden wurde:

| Option | Umfang (gemessen) | Verdikt |
|---|---|---|
| **A — `@ks/ui`** | 40 Dateien verschieben; **798 Import-Zeilen in 321 Dateien** umstellen (`grep -rc "@/components/ui/"`) | **eigene PR.** M3 hat vom Brutto-Diff-Budget der PR (5.000 Zeilen, `AGENTS.md`) bereits 685 Zeilen verbraucht; Option A allein liegt darüber. |
| **B — serverseitiger Teil** | Gate in `@ks/shell`, Namespace-Besitz in `@ks/module-explorer`, 22 Route-Dateien à ~3 Zeilen | **gewählt.** |
| **C — Explorer-Domänenlogik** (`src/lib/gallery/`, `src/lib/website/`) | 19 Dateien, aber 6 Fremd-Importe (`@/types/item`, `@/utils/*`, `@/lib/chat/dynamic-facets` …), die ihrerseits kaskadieren | zurückgestellt; kein sauberer Schnitt ohne Vorarbeit. |

Zwei weitere Gründe für B, die in der Tabelle nicht sichtbar sind:

- **B schließt die Schleife von M3.** Die Registry aus M3 liefert
  `SiteConfig.modules`, aber niemand liest das Feld. Ein deklarierter Vertrag
  ohne Konsument ist genau die Art Drift, die dieser Umbau vermeiden soll.
- **B kommt ohne neue Auflösungs-Mechanik aus.** Im Cloud-Agent ist
  `pnpm build` gesperrt (`AGENTS.md`, Kostenregel); Option A bräuchte entweder
  Subpfad-`exports` (Webpack-Auflösung erst im Build nachweisbar) oder 39
  Fassaden. B benutzt ausschließlich das Barrel-Muster, das in diesem Repo
  schon viermal trägt.

**Zunächst nicht geliefert**: die montierbare Wurzelkomponente aus der
Landkarten-Zeile M4. Sie brauchte `@ks/ui` + `@ks/i18n` — siehe Hand-off.
**Nachgeliefert am 2026-08-28**, nach M4b–M4e; der Nachtrag am Ende dieses
Briefs beschreibt sie.

## Was M4 liefert

### (a) `siteGate()` in `@ks/shell`

```ts
const gated = siteGate('explorer', request)
if (gated) return gated   // 404, wenn das Modul für diese Site inaktiv ist
```

Bewusst **kein** Higher-Order-Wrapper (`export const GET = withSiteGate(…)`),
obwohl die Landkarte §3 ihn so skizziert. Zwei Gründe:

1. Der Wrapper ist die Zielform für den Tag, an dem die Handler-Rümpfe IM
   Modul-Paket liegen. Heute liegen sie in der App (sie hängen an
   `@/lib/chat/loader`, `vector-repo`, Clerk) — ein Wrapper um einen
   App-Handler verlagert nichts, er verkleidet nur.
2. `export const GET = …` ändert die Signatur, die Next.js beim Build gegen
   seine generierten Route-Typen prüft. Das ist im Cloud-Agent nicht
   nachweisbar. Der Guard lässt die exportierte Funktion buchstäblich
   unverändert — Risiko null.

Ergänzend memoisiert `getSiteRegistry()` jetzt die aus `PUBLIC_DOMAIN_LIBRARY_MAP`
geparste Registry (Cache-Schlüssel ist der ENV-Rohwert). Ohne das würde jeder
der 22 neuen Aufrufer pro Request denselben JSON-String neu parsen.

### (b) `@ks/module-explorer` — Besitz des API-Namensraums

Das Paket hält, was die Landkarte §3 dem Modul zuschreibt: **welche
Route-Namensräume zum Explorer gehören** — und welche ausdrücklich nicht,
mit Begründung. Die Ausnahmeliste ist keine Notiz, sondern Code
(`EXPLORER_API_EXCLUSIONS`), und sie ist testgetrieben (siehe unten).

Abgegrenzt wurden, entlang der „Bekannten Unschärfen" aus Landkarte §3:

- `ingest*`, `index*`, `upsert-*` — Verarbeitung, gehört zu Archiv/Jobs.
- `docs/publish*`, `docs/delete` — Kuratierung, Zuordnung noch offen.
- `public/llm-models` — Core-API (§3 nennt sie dort ausdrücklich).
- `public/secretary/*` — geteilter Dienst, Zuordnung offen (§3).

### Beweis-Ziel: eine Route kann dem Gate nicht mehr entkommen

`tests/unit/packages/module-explorer/api-gate-coverage.test.ts` läuft den
echten Route-Baum unter `src/app/api/` ab und prüft **beide Richtungen**:
Jede Route in einem Explorer-Namensraum ruft `explorerGate` auf — und jede
ausgenommene Route ruft es nicht. Eine neue Route unter
`chat/[libraryId]/…` lässt den Test rot werden, bis sie entweder gegatet oder
mit Begründung ausgenommen ist. Damit ist der API-Schnitt aus Landkarte §3
kein Dokument mehr, sondern eine Zusicherung.

**Verhaltensneutralität (G4)**: Auf jeder heute existierenden Site ist
`explorer` aktiv — Default-Site und host-gebundene Sites bekommen beide
`FULL_APP_MODULES` (bewusste M3-Entscheidung, die hier aufgeht). Das Gate
lässt also jeden Request durch; es ist die Vorrichtung, die M6 braucht, um
eine schlanke Site zu schneiden.

### Ein Befund, der den Zuschnitt verändert hat

Drei Routen im Explorer-Namensraum werden heute **zwischengespeichert**:
`public/libraries/[slug]` per ISR (`revalidate = 60`), `markdown/[...path]`
statisch (das GET liest das Request-Objekt nicht an). Das Gate liest den Host —
dieser Zugriff würde beide Routen dynamisch machen. Das ist eine
Verhaltensänderung und damit nach G4 verboten; beide sind begründet
ausgenommen (`public/libraries` mit `revalidate = 0` ist bereits dynamisch und
wird gegatet).

Dahinter steht eine Grundsatzfrage, die vor M4 nirgends stand und jetzt in
Landkarte §3 und im Paket dokumentiert ist: **Ein host-abhängiges Gate und
eine host-unabhängige Zwischenspeicherung schließen einander aus.** Wer in M6
eine Site mit reduziertem Modul-Satz schneidet, braucht für solche Routen
entweder einen host-abhängigen Cache-Schlüssel (Muster:
`getRootLandingTargetForHost` nimmt den Host in den Cache-Schlüssel) oder den
Verzicht auf die Zwischenspeicherung. Das ist keine Randnotiz — es betrifft
genau die öffentlichen Lese-Routen, deren Cache die Site-Performance trägt.

## Definition of Done — erreicht

- `pnpm test`: **3329 grün, 3 rot** — nur `tests/unit/mcp/tools-stand.test.ts`
  (Timeout, auch auf `master` rot). +52 Tests gegenüber dem Stand nach M3.
- `pnpm lint`: 0 Errors.
- `pnpm typecheck:packages`: grün, inkl. `packages/module-explorer`.
- `npx tsc --noEmit -p tsconfig.json`: **0 Fehler in `src/` und `packages/`**
  (die 129 Fehler in `tests/` sind vorbestehend und von dieser Welle unberührt).
- Kein Paket greift in die App zurück (`@ks/module-explorer` kennt nur
  `@ks/shell` und `@ks/contracts`).
- Der Abdeckungs-Test wurde gegengeprüft: Gate aus einer Route entfernt ⇒
  Test rot, Gate zurück ⇒ grün. Er ist also wirklich tragend, nicht nur grün.
- Lokal vor Merge: `bash scripts/welle-pre-merge-check.sh`.

## Stop-Bedingungen (zusätzlich zu AGENTS.md)

- Ein Handler-Rumpf soll ins Paket wandern ⇒ er hängt an App-Modulen; das
  geht erst, wenn diese extrahiert sind. Nicht per Injection erzwingen, nur
  um die Landkarten-Zeile abzuhaken.
- Eine ausgenommene Route soll „schnell mit" gegatet werden ⇒ das sind die
  offenen Zuordnungsfragen aus Landkarte §3. Owner fragen.

## Hand-off für M5

**Nächste Welle**: M4b — `@ks/ui` (shadcn-Basis + `cn`), danach `@ks/i18n`.
Erst dann ist die montierbare Explorer-Wurzelkomponente erreichbar.

**Was M4b vorfindet**: `src/components/ui/` ist gemessen selbstständig — der
einzige App-Import über alle 40 Dateien hinweg ist `cn` aus `@/lib/utils`
(plus ui-interne Importe). Es gibt **keine Export-Namens-Kollisionen** über
die 190 Export-Namen, ein einzelnes Barrel `@ks/ui` ist also möglich.

**Zwei Dinge, die M4b vorab entscheiden muss**:

1. **Fassaden oder Importeure umstellen?** 39 Fassaden an den alten Pfaden
   (Diff klein, Schuld bleibt, `knip` findet sie) gegen 798 Import-Zeilen in
   321 Dateien (Diff groß, keine Schuld). Empfehlung: Importeure umstellen,
   aufgeteilt auf mehrere Commits nach Verzeichnis — die Schuld aus M1/M2 war
   jedes Mal teurer als der einmalige Umbau. Bei Fassaden gilt `isolatedModules`:
   Typ-Re-Exporte brauchen `export type`.
2. **`cn` sauber schneiden.** `src/lib/utils.ts` mischt `cn` mit
   Audio-/Video-Fehlertexten (Fachlogik). `git mv` der Datei nach
   `packages/ui/src/cn.ts`, dort auf `cn` eindampfen, die übrigen Helfer als
   neues `src/lib/utils.ts` zurücklegen — das hält `git log --follow` intakt
   und lässt die 109 `@/lib/utils`-Importeure unberührt.

**`llm-model-selector.tsx` gehört NICHT nach `@ks/ui`** — es ist kein
Primitive, sondern ein datenziehendes Widget (nutzt `@ks/api-client` seit M2).
Es bleibt in der App, sonst importierte eine Shared Library eine andere.

**Modellempfehlung**: Sonnet mit hohem Thinking-Level. M4b ist mechanisch,
aber breit — die Sorgfalt liegt im vollständigen Umstellen, nicht im Entwurf.

**Agent-Typ**: neuer Agent.

**Start-Prompt für den nächsten Cloud-Agenten**:

```
Branch von master (nach dem M4-Merge): claude/modularisierung-welle-m4b

Pflichtlektuere in dieser Reihenfolge:
1. CLAUDE.md (Routing-Index + Coding-Konventionen)
2. AGENTS.md §Aktueller Fahrplan
3. docs/architecture/migrations-strategie.md — die fuenf Garantien
4. docs/architecture/modul-landkarte.md §1 (@ks/ui-Zeile), §4 (Grenzregeln)
5. docs/refactor/modularisierung/AGENT-BRIEF-M4.md — Hand-off am Ende
   (Messwerte, die beiden Vorab-Entscheidungen, cn-Schnitt)

Setze Welle M4b um: @ks/ui (shadcn-Basis aus src/components/ui/ + cn).
Entscheide zuerst Fassaden vs. Importeure-umstellen und halte es in
AGENT-BRIEF-M4b.md fest.

Zwingend:
- git mv statt kopieren (G2); git log --follow muss weiter funktionieren
- Verhaltensneutral (G4): pnpm test + pnpm lint gruen, Voll-App unveraendert
- pnpm typecheck:packages muss gruen sein
- llm-model-selector.tsx bleibt in der App (Begruendung im M4-Brief)
- Vor dem ersten Commit: pnpm install
- Diff-Limits aus AGENTS.md: max 1.000z/Commit — bei 798 Import-Zeilen
  ZWINGEND auf mehrere Commits nach Verzeichnis aufteilen
- Hand-off-Block fuer die naechste Welle am Ende

Vorbestehend rot (nicht deine Schuld, nicht reparieren):
tests/unit/mcp/tools-stand.test.ts — 3 Tests, auch auf master rot.
```

**Kosten-Schätzung**: mittel. Viel Datei-Berührung, wenig Denkarbeit — die
Messwerte oben nehmen die Analysephase vorweg.

## Nachtrag (2026-08-28): die Wurzelkomponente

Nachgereicht, nachdem M4b (`@ks/ui`), M4c (`@ks/i18n`), M4d (`ClientLibrary`
in `@ks/contracts`) und M4e (Library-Auswahl in `@ks/shell/react`) das
Fundament gelegt hatten. Damit ist die Landkarten-Zeile M4 eingelöst.

### Was die Wurzelkomponente überhaupt schwierig machte

`src/app/explore/[slug]/page.tsx` (448 Zeilen) war dreifach an die Anwendung
gebunden. ADR 0008 §4 verlangt genau das Gegenteil:

| Bindung | Warum sie die Montage verhinderte | Lösung |
|---|---|---|
| `useParams()` | Next.js-Datei-Routing; im Embed und in Electron gibt es das nicht | Slug ist eine Prop |
| Clerk (`useUser`, `SignInButton`) | AECED hat kein Clerk; die Landkarte verlangt „Auth, abschaltbar" | `ExplorerViewer { isLoaded, isSignedIn }` + Slot für die Anmelde-Aufforderung |
| `GalleryClient`, `LibraryVerificationWarning` | ein Paket darf nicht in die App zurückgreifen (Landkarte §4) | Slots |

Der Clerk-Schnitt ist der interessante: Das Modul fragt nicht mehr, **wer**
da ist, sondern nur, **ob** jemand da ist. Wer angemeldet ist, entscheidet
ohnehin der Server bei jedem Request selbst. Zwei Booleans genügen — und
damit hängt das Modul an keinem Auth-Anbieter mehr. Das ist dieselbe Frage,
an der die TopNav noch hängt (siehe AGENT-BRIEF-M4e, TopNav-Befund); hier
ließ sie sich lokal beantworten, weil der Explorer Clerk nur für eine
Ja/Nein-Auskunft und einen Button brauchte.

### Was im Paket liegt — und was nicht

**Im Paket** (`@ks/module-explorer/react`, 636 Zeilen): das Eintrittsprotokoll.
Laden über den Slug (öffentliche Route, mit Member-Sicht für angemeldete
Owner/Co-Autoren), Zugriffsprüfung samt Anfrage und Wartezustand, das
Schreiben in den Auswahl-Zustand der Schale, Kopfbereich und Zustände.

**Nicht im Paket**: die Galerie. `gallery-root.tsx` hat 1.319 Zeilen und 38
App-Importe, die auf rund 15.000 Zeilen kaskadieren (`src/lib/gallery/`,
`src/hooks/gallery/`, Detail-View-Registry, Story, Chat). Das ist eine eigene
Welle. Nach G3 wird extrahiert, was ein Ziel braucht — nicht, was eine Zeile
im Plan vollständig aussehen ließe.

### Warum nicht `@ks/api-client`

`apiGet` wirft bei jedem Nicht-OK-Response (bewusst, `no-silent-fallbacks.md`).
Das Eintrittsprotokoll **braucht** aber die Status-Codes: 404 heißt „nicht
öffentlich, versuch die Member-Route", 429 heißt „zu viele Anfragen" und
trägt eine eigene Meldung. Ein geworfener Fehler verschluckt genau diese
Unterscheidung. Das Modul benutzt deshalb eigenes `fetch`; die Fälle sind in
`explorer-access.test.ts` festgenagelt.

Für M5 (Embed gegen eine entfernte Instanz) fehlt damit noch eine Basis-URL.
Sie wurde hier bewusst NICHT eingebaut: heute wäre sie eine unbenutzte Prop
(G3), und `ApiClientConfig` liegt für den Tag bereit, an dem sie gebraucht
wird.

### Beweis-Ziel

`tests/unit/packages/module-explorer/explorer-root.test.tsx` montiert
`ExplorerRoot` **ohne Next-Router und ohne Clerk** — nur mit einem
Jotai-Store und `fetch`-Attrappen. Genau das braucht M5. 19 neue Tests
(Wurzel, Zugriffsprotokoll, Steckbrief-Übersetzung).

### Abweichung, die eine Erwähnung verdient

Der Lade-Effekt hängt jetzt an `isSignedIn` statt am Clerk-`user`-Objekt.
Dessen Identität wechselt auch bei einer bloßen Profil-Aktualisierung und
löste dann ein überflüssiges Neuladen der Library aus. Ein echter
Nutzerwechsel geht weiter durch (`isSignedIn` läuft true→false→true).

### Was als Nächstes auffällt

- **`/explore/[slug]/perspective`** (90 Zeilen) ist ein zweiter Explorer-
  Einstieg und noch eine Seite. Klein, aber dieselbe Bindung an `useParams`.
- **Die Galerie** ist der große Brocken und die nächste sinnvolle Welle, wenn
  der Explorer wirklich einbettbar werden soll.
- **`src/lib/chat/constants.ts`** (892 Zeilen) bleibt der größte
  Contracts-Kandidat.
