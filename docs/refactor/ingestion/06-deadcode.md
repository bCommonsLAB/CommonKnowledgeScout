# Dead-Code-Pass: Modul `ingestion`

Stand: 2026-04-27. Erstellt vom IDE-Agent (Welle 3, Plan-Schritt 6).

Bezug:
- Altlast: [`04-altlast-pass.md`](./04-altlast-pass.md)
- Welle-2-Vorbild: [`docs/refactor/shadow-twin/06-deadcode.md`](../shadow-twin/06-deadcode.md)

## Methode

`pnpm knip` (siehe `knip.json`) gegen den ganzen Workspace, dann
Befunde gefiltert auf `src/lib/ingestion/**` und `tests/unit/ingestion/**`.

Knip-Lauf: 34 Sek., Exit 1 (= Funde gefunden, normales Verhalten).
Output: ~610 Zeilen, davon ingestion-spezifisch:

| Kategorie | Eintrag | Datei | Bewertung |
|---|---|---|---|
| Unused interface | `ImageProcessingError` | `src/lib/ingestion/image-processor.ts:15` | **False Positive** — Teil des Result-Object-Contracts, ergibt sich strukturell aus den anderen Result-Interfaces |
| Unused interface | `MarkdownImageProcessingResult` | `src/lib/ingestion/image-processor.ts:22` | **False Positive** — Return-Type von `processMarkdownImages`. Vertraglich Teil der Public-API der Klasse |
| Unused interface | `SlideImageProcessingResult` | `src/lib/ingestion/image-processor.ts:29` | **False Positive** — Return-Type von `processSlideImages`. Vertraglich Teil der Public-API |
| Unused interface | `VectorDocument` | `src/lib/ingestion/vector-builder.ts:5` | **Drift-Watchpoint** — gleichnamiges, **anderes** Interface auch in `src/lib/repositories/vector-repo.ts:70`. Konsolidierung in Folge-PR |

## Warum die Result-Interfaces stehen bleiben

Die drei Result-Interfaces (`ImageProcessingError`,
`MarkdownImageProcessingResult`, `SlideImageProcessingResult`) sind
**vertragsrelevant**:

- Sie kodifizieren das **Result-Object-Pattern** (siehe
  [`.cursor/rules/ingestion-contracts.mdc`](../../../.cursor/rules/ingestion-contracts.mdc) §2).
- Sie sind Return-Typen oeffentlich exportierter Klassen-Methoden.
- Aufrufer **koennen** sie als Type-Annotation verwenden — auch wenn
  TypeScript Inference das aktuell nicht erfordert. Das Entfernen
  wuerde Konsumenten (z.B. spaetere Tests, neue Aufrufer) zwingen, den
  Typ neu abzuleiten.
- Die `pnpm knip`-Heuristik sieht nur Importe; sie sieht nicht, dass
  `MarkdownImageProcessingResult` strukturell `ImageProcessingError[]`
  enthaelt und die Loeschung von einem das andere brechen wuerde.

**Entscheidung**: Behalten. Kein Loeschvorschlag.

## Drift-Watchpoint: Doppelter `VectorDocument`-Typ

Zwei unabhaengige Interfaces gleichen Namens:

```text
src/lib/ingestion/vector-builder.ts:5  →  export interface VectorDocument { ... }
src/lib/repositories/vector-repo.ts:70 →  export interface VectorDocument { ... }
```

Aufrufer-Verteilung (per `Grep`):

| Datei | Importiert aus |
|---|---|
| `src/lib/repositories/doc-meta-formatter.ts` | `repositories/vector-repo` |
| `src/lib/chat/ingestion-service.ts` | nutzt `buildVectorDocuments` aus `ingestion/vector-builder` (impliziter Typ) |
| `src/app/api/chat/[libraryId]/docs/by-fileids/route.ts` | nur Code-Kommentar |

Das ist ein klares **Duplikat-Drift-Symptom**, aber:

1. Beide Interfaces sind aktuell strukturell aequivalent.
2. Eine Konsolidierung haette Cross-Module-Impact (`ingestion` ↔
   `repositories`).
3. Welle 3 hat einen klaren Scope (`ingestion` + Helper-Extract).

**Entscheidung**: in Welle 3 NICHT konsolidieren. Stattdessen:

- Watchpoint in [`04-altlast-pass.md`](./04-altlast-pass.md) erwaehnen
  (war noch nicht drin, jetzt nachtragen — siehe unten).
- Folge-PR vorschlagen: "ingestion+repositories: VectorDocument
  konsolidieren" (separater Branch, eigene Char-Tests).

## Befunde **ausserhalb** des Welle-3-Scopes

Diese erscheinen in `pnpm knip`, gehoeren aber nicht zu `ingestion`:

| Eintrag | Datei | Gehoert zu Modul |
|---|---|---|
| `resolveMediaFieldFromFragments` | `src/lib/chat/ingestion-service.ts:1416` | `chat` (Welle 4-Kandidat) |
| `slugifyIndexName` | `src/lib/chat/config.ts:221` | `chat` |
| `getDocumentCount` | `src/lib/db/queries-repo.ts:62` | `db` |
| 5x `IngestionXxxDetail`-Komponenten | `src/components/library/...` | UI / `creation` |

Werden in einer spaeteren Welle aufgegriffen.

## Aktionen in Welle 3

| Aktion | Status |
|---|---|
| Knip-Lauf durchgefuehrt | ✓ |
| Ingestion-spezifische Befunde gefiltert | ✓ |
| 4 Befunde bewertet (3 False Positives, 1 Drift-Watchpoint) | ✓ |
| Code-Loeschung | **0** (keine Aktion noetig) |
| Doku angepasst (`04-altlast-pass.md` Watchpoint nachtragen) | ✓ siehe folgender Commit |

## Folge-PRs

| Titel | Was | Wo |
|---|---|---|
| `ingestion+repositories: VectorDocument konsolidieren` | Beide `VectorDocument`-Interfaces in eine zentrale Definition (vermutlich `repositories/vector-repo.ts`) zusammenfuehren, `ingestion/vector-builder.ts` re-exportiert nur | Cross-Module |
| `ingestion: Result-Interfaces in eigenes types.ts` | Optional, Hygiene: `ImageProcessingError`, `MarkdownImageProcessingResult`, `SlideImageProcessingResult` in `src/lib/ingestion/image-processor-types.ts` ausziehen, image-processor.ts importiert | rein `ingestion` |
