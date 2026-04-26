# Characterization Tests: Modul `shadow-twin`

Stand: 2026-04-27. Erstellt vom Cloud-Agent (Welle 2, Plan-Schritt 3).

Bezug:
- Contracts: [`02-contracts.md`](./02-contracts.md), [`shadow-twin-contracts.mdc`](../../../.cursor/rules/shadow-twin-contracts.mdc)
- Audit: [`00-audit.md`](./00-audit.md) — alle 13 Bestands-Tests + 2 Cross-Modul-Tests `keep`
- Welle-1-Vorbild: [`docs/refactor/storage/03-tests.md`](../storage/03-tests.md)

## Was wurde gemacht

2 neue Test-Files mit insgesamt **21 Tests** hinzugefuegt. Sie fixieren das
beobachtete Verhalten des in Schritt 4 extrahierten Helper-Moduls
(`file-kind.ts`) und einer bisher ungetesteten exportierten Pure-Funktion
(`buildMongoShadowTwinItem`).

| Test-File | Tests | Coverage-Ziel |
|---|---:|---|
| `tests/unit/shadow-twin/file-kind.test.ts` | 15 | `getFileKind`, `getMimeTypeFromFileName` (extrahiert in Schritt 4) |
| `tests/unit/shadow-twin/mongo-shadow-twin-item.test.ts` | 6 | `buildMongoShadowTwinItem` (virtuelle Mongo-StorageItems) |

## Test-Strategie

### Pure-Helper-Fokus (statt End-to-End-Service-Mocks)

Wie in Welle 1 gelernt: Char-Tests fuer pure Helper sind das beste
Sicherheitsnetz vor invasiven Code-Aenderungen. Statt die grossen Files
`analyze-shadow-twin.ts` (465 Z.) und `shadow-twin-migration-writer.ts`
(458 Z.) **vollstaendig** mit Mongo-/Azure-Mocks zu testen, haben wir:

1. **Schritt 4: pure Helper extrahiert** (`file-kind.ts`) — diese Helper
   sind state-less und 100% testbar.
2. **Tests gegen die exportierte Pure-Funktion** geschrieben
   (`buildMongoShadowTwinItem`).

Damit ist der **Vertrags-Kern** abgesichert. Die End-to-End-Funktionen
`analyzeShadowTwin` und `persistShadowTwinFilesToMongo` bleiben durch ihre
indirekten Aufrufer-Tests (`shadow-twin-service.test.ts`,
`shadow-twin-mongo-writer-rewrite.test.ts`) abgesichert.

### Vertragsbezug zu `shadow-twin-contracts.mdc`

| Test | Verifizierter Vertrag |
|---|---|
| `file-kind.test.ts` "priorisiert Markdown vor Image" | Helper-Vertrag: deterministische Reihenfolge der Branches |
| `mongo-shadow-twin-item.test.ts` "Vertrag §1: templateName ist Bestandteil der ID" | §1 ArtifactKey-Determinismus (verschiedene `templateName` → verschiedene IDs) |
| `mongo-shadow-twin-item.test.ts` "encodiert ID-Komponenten so, dass parseMongoShadowTwinId roundtrip-faehig ist" | §1 + §6 (Mongo-virtuelle IDs sind Vertragsbestandteil) |

## Was die Tests fixieren

### `getFileKind` (15 Tests via 8 Test-Cases)

- **Markdown** via Endung (`.md`, `.mdx`, `.txt`) und MIME-Type
  (`text/markdown`, `application/x-markdown`).
- **Image** via Endung (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`,
  `.bmp`, `.ico`) und MIME-Type (`image/*`).
- **Audio** via Endung (`.mp3`, `.m4a`, `.wav`, `.ogg`, `.opus`, `.flac`)
  und MIME-Type (`audio/*`).
- **Video** via Endung (`.mp4`, `.mov`, `.avi`, `.webm`, `.mkv`) und
  MIME-Type (`video/*`).
- **Default `binary`** fuer unbekannte Endungen.
- **Case-Insensitivity** bei Endung und MIME-Type.
- **Branch-Reihenfolge**: Markdown gewinnt vor Image bei Mehrdeutigkeit
  (`.md`-Datei mit `image/png`-MIME-Type → `markdown`).

### `getMimeTypeFromFileName` (6 Test-Cases)

- Liefert MIME-Types fuer alle bekannten Endungen (Bilder, Audio, Video,
  Markdown).
- Case-Insensitivity bei der Endung.
- Liefert `undefined` fuer unbekannte Endungen.
- Liefert `undefined` fuer Dateien ohne Endung oder mit Trailing-Dot.

### `buildMongoShadowTwinItem` (6 Tests)

- Liefert ein virtuelles `StorageItem` mit korrekt erkennbarer
  `mongo-shadow-twin:`-ID.
- Roundtrip: `buildMongoShadowTwinItem -> parseMongoShadowTwinId` ist
  konsistent (alle Felder einschliesslich `templateName`).
- `markdownLength` wird als `metadata.size` uebernommen, Default `0`.
- `updatedAt` als ISO-String wird zu `Date` parsed.
- Ohne `updatedAt` wird `new Date()` (jetzt) verwendet.
- Verschiedene `templateName` fuehren zu verschiedenen IDs (Vertrag §1).

## Was bewusst NICHT getestet wird (Welle 2)

- **`analyzeShadowTwin` E2E** — benoetigt Mongo-Repo-Mock + Provider-Mock +
  `findShadowTwinFolder`-Mock. Vorhandene Tests in
  `shadow-twin-service.test.ts` decken das indirekt ab. Folge-PR.
- **`persistShadowTwinFilesToMongo` E2E** — benoetigt Azure-Mock +
  Provider-Mock + Mongo-Repo-Mock. Folge-PR.
- **`artifact-client.ts` HTTP-Vertraege** — Welle 2 hat OneDrive-Provider-
  Vorbild aus Welle 1, aber `artifact-client` ist groesser. Folge-PR.

## Test-Lauf vor Welle-2-Code-Aenderungen (Schritt 4)

```
$ pnpm test
Test Files  105 passed (105)
     Tests  511 passed (511)
```

Vorher (nach Welle 1): 103 Files / 490 Tests. Delta: **+2 Files / +21 Tests**.

## Folge-Schritte

| Schritt | Was | Wo |
|---|---|---|
| 4 | Helper-Extract dokumentieren | `04-altlast-pass.md` |
| 7 | Test-Lauf mit gruenem Status in `06-acceptance.md` dokumentieren | `06-acceptance.md` |
| Spaeter | Tests fuer `analyze-shadow-twin.ts`, `shadow-twin-migration-writer.ts` (E2E) | Folge-PRs |
