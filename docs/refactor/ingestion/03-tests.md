# Char-Tests: Modul `ingestion`

Stand: 2026-04-27. Erstellt vom IDE-Agent (Welle 3, Plan-Schritt 3).

Bezug:
- Audit: [`00-audit.md`](./00-audit.md)
- Contracts-Rule: [`.cursor/rules/ingestion-contracts.mdc`](../../../.cursor/rules/ingestion-contracts.mdc)
- Contracts-Doku: [`02-contracts.md`](./02-contracts.md)
- Welle-2-Vorbild: [`docs/refactor/shadow-twin/03-tests.md`](../shadow-twin/03-tests.md)

## Was wurde gemacht

Ein neuer Test-Ordner `tests/unit/ingestion/` mit **6 Test-Files** und
zusammen **67 Tests** wurde angelegt. Vor Welle 3 hatte das Modul **null
direkte Tests** — die Coverage-Luecke aus dem Audit ist damit geschlossen.

| Test-File | Tests | Getesteter Code | Test-Typ |
|---|---:|---|---|
| `tests/unit/ingestion/page-split.test.ts` | 9 | `splitByPages` aus `src/lib/ingestion/page-split.ts` | pure |
| `tests/unit/ingestion/metadata-formatter.test.ts` | 13 | `buildMetadataPrefix` aus `metadata-formatter.ts` | pure |
| `tests/unit/ingestion/document-text-builder.test.ts` | 13 | `buildDocumentTextForEmbedding` aus `document-text-builder.ts` | pure |
| `tests/unit/ingestion/meta-document-builder.test.ts` | 13 | `buildMetaDocument` aus `meta-document-builder.ts` | pure + FakeTimers |
| `tests/unit/ingestion/vector-builder.test.ts` | 12 | `extractFacetValues`, `buildVectorDocuments` aus `vector-builder.ts` | pure + FakeTimers |
| `tests/unit/ingestion/image-processor.test.ts` | 7 | `ImageProcessor.clearImageCache`, `processMarkdownImages`, `processCoverImage`, `processSlideImages` (Azure-unkonfiguriert-Pfad) | klassen-statisch + Vitest-Mocks |

`pnpm test`-Lauf vor Welle 3: nicht messbar fuer ingestion (keine Tests).
Nach Welle 3: **6 Files / 67 Tests / alle gruen**, Gesamt-Suite **111 Files / 578 Tests / alle gruen**.

## Was die Tests abdecken (Vertrags-Mapping)

### §1 Determinismus (Pure Helper)

Pflicht: gleiche Eingabe → gleiches Ergebnis.

- `splitByPages`: `idempotent`-Test in `page-split.test.ts` (mehrfacher
  Aufruf identisch).
- `buildMetadataPrefix`: `Determinismus`-Suite in `metadata-formatter.test.ts`.
- `buildDocumentTextForEmbedding`: `Determinismus`-Suite in
  `document-text-builder.test.ts`.
- `buildMetaDocument` und `buildVectorDocuments`: `upsertedAt` ist
  explizit nicht-deterministisch → mit `vi.useFakeTimers()` stabilisiert
  (FakeTimers-Suite in `meta-document-builder.test.ts` und
  `vector-builder.test.ts`).

### §2 Fehler-Semantik (Result-Objekt-Pattern)

Pflicht: Bei "Bild nicht verarbeitbar" wird KEIN Wurf ausgeloest, sondern
ein Result-Objekt zurueckgegeben.

- `processMarkdownImages` ohne Azure-Config → `{ markdown: input,
  imageErrors: [], imageMapping: [] }` (Test in `image-processor.test.ts`).
- `processCoverImage` ohne Azure-Config → `null` (kein Wurf).
- `processSlideImages` ohne Azure-Config → `{ slides: input, errors: [] }`.

### §4 Skip-/Default-Semantik

Pflicht: leere Eingaben fuehren zu leeren/gueltigen Ausgaben, nicht zu
Fehlern.

- `splitByPages('')` → `[]`.
- `buildMetadataPrefix({})` → `''`.
- `buildDocumentTextForEmbedding({}, emptyMongoDoc)` → `''`.
- `extractFacetValues(...)` mit leerem `facetDefs` → `{}`.

### §5 Cache-Vertrag

Pflicht: Tests, die `ImageProcessor` aufrufen, rufen
`clearImageCache()` in `beforeEach` auf.

- Erfuellt: `image-processor.test.ts` hat `beforeEach(() =>
  ImageProcessor.clearImageCache())` in jeder Suite.
- Plus expliziter Test, dass `clearImageCache()` ohne Wurf laeuft (auch
  bei leerem Cache und idempotent).

## Mock-Strategie fuer `image-processor.test.ts`

Da `ImageProcessor` nicht-pure Aufrufe an Azure und MongoDB macht, wurden
folgende Module gemockt:

```ts
vi.mock('@/lib/config/azure-storage', () => ({
  resolveAzureStorageConfig: vi.fn(() => null),  // = unkonfiguriert
}))

vi.mock('@/lib/services/azure-storage-service', () => ({
  AzureStorageService: vi.fn().mockImplementation(() => ({
    isConfigured: () => false,
    containerExists: vi.fn(),
  })),
  calculateImageHash: vi.fn(() => 'fakehash'),
}))

vi.mock('@/lib/repositories/shadow-twin-repo', () => ({
  getShadowTwinBinaryFragments: vi.fn(async () => null),
}))
```

**Begruendung**: der "unkonfigurierte Azure"-Pfad ist der einfachste
Eingangs-Pfad und deckt das **wichtigste Vertrags-Verhalten** ab (kein
Wurf, sondern Result-Objekt mit Defaults). Tiefere Tests fuer den
Upload-Pfad (Hash-Caching, Container-Anlage, parallele Batches) sind
**bewusst nicht in Welle 3** — sie wuerden ein Integration-Test-Setup
mit Azurite oder vollstaendigen Service-Mocks brauchen, das den Rahmen
sprengt. Folge-PR-Kandidat.

## Zahl-Vergleich: Methodik-DoD vs. Modul-DoD

Aus dem AGENT-BRIEF (Welle 3):

| Kriterium | Erwartung | Erreicht |
|---|---|---|
| Test-Files neu | mind. 6 | 6 |
| Tests neu | 15-25 | **67** (Uebererfuellung; viele kleine Pure-Tests) |
| `tests/unit/ingestion/` existiert | nein → ja | **ja** |
| `pnpm test` gruen | Pflicht | **ja** (578/578) |

## Was die Tests bewusst NICHT abdecken

- `ImageProcessor` mit konfiguriertem Azure: Mocks fuer
  `containerExists`, Upload-Logik, Cache-Hit-Pfad. Sehr aufwaendig,
  Folge-PR.
- Inter-Modul-Tests (z.B. `ingestion-service` → `ingestion/`-Helper):
  ausserhalb des Modul-Scopes.
- `splitByPages` vs. `splitMarkdownByPageMarkers` Konsolidierung: nur
  Watchpoint im Audit, keine Konsolidierung in Welle 3.

## Folge-Schritte

| Schritt | Was | Wo |
|---|---|---|
| 4 | Helper-Extract aus `image-processor.ts` (Pure-Funktionen wie `getImageCacheKey`, `normalizeImagePath`, `formatImageError`) | `src/lib/ingestion/image-processor/*` oder Helper-Datei |
| 4 | Char-Tests fuer den extrahierten Helper hinzufuegen | `tests/unit/ingestion/` |
| 7 | Tests in `06-acceptance.md` als "Modul-DoD: Tests gruen, +67 Tests" festhalten | `06-acceptance.md` |
