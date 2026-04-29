# Contracts: Welle 3-II — Archiv-Detail

Stand: 2026-04-29. Zugehoerige Cursor-Rule:
[`.cursor/rules/welle-3-archiv-detail-contracts.mdc`](../../../.cursor/rules/welle-3-archiv-detail-contracts.mdc).

Diese Datei ist die **menschenlesbare Begleit-Doku** zur Contract-Rule.
Sie erklaert, **warum** die §-Klauseln so formuliert sind und **welche
Bestands-Findings** sie adressieren.

## Bezug zu vorhandenen Architektur-Rules

| Globale Rule | Was sie sagt | Wie diese Welle dazu beitraegt |
|---|---|---|
| [`storage-abstraction.mdc`](../../../.cursor/rules/storage-abstraction.mdc) | UI darf Storage-Backend nicht kennen | §3, §7 — der 1 Verstoss in `freshness-comparison-panel.tsx` wird in dieser PR gefixt |
| [`no-silent-fallbacks.mdc`](../../../.cursor/rules/no-silent-fallbacks.mdc) | `catch {}` und `?? default` ohne Begruendung verboten | §2 — alle 7 leeren Catches in dieser PR gefixt |
| [`media-lifecycle.mdc`](../../../.cursor/rules/media-lifecycle.mdc) | Frontmatter enthaelt nur Dateinamen | §1 verbietet Frontmatter-Schreib-Logik in Detail-View-Komponenten |
| [`detail-view-type-checklist.mdc`](../../../.cursor/rules/detail-view-type-checklist.mdc) | DetailViewType-Architektur | §5 fixiert das fuer Welle 3-II konkret |
| [`shadow-twin-architecture.mdc`](../../../.cursor/rules/shadow-twin-architecture.mdc) | UI fragt nur abstrakte Faehigkeiten ab | §3, §7 |
| [`welle-3-schale-loader-contracts.mdc`](../../../.cursor/rules/welle-3-schale-loader-contracts.mdc) | Schale-Vertrag (Welle 3-I) | bleibt unangetastet, Welle 3-II baut darauf auf |

## §1 Determinismus — Detail-Komponenten sind Renderer

**Warum?** Die Detail-View ist die zweitwichtigste UX-Schicht nach der Schale.
Wenn dort Business-Logik liegt (Frontmatter-Schreiben, DB-Queries), breitet
sich Drift in jede Sub-Welle aus.

**Bestands-Befund (Inventur)**:

- `file-preview.tsx` (3.701z) ist Container-mit-Tab-Logik plus Props-Mapping.
  Enthaelt aber Pipeline-Trigger-Aufrufe (alle ueber API), keine direkte
  DB-Logik — konform.
- `markdown-preview.tsx` (2.054z) ist Markdown-Renderer + Search-Logik.
  Schreibt keine Frontmatter, lediglich fragt sie ab — konform.
- `markdown-metadata.tsx` (437z) ist der einzige Edit-Modus, schreibt aber
  via API, nicht direkt — konform.
- `cover-image-generator-dialog.tsx` (458z) loest Cover-Generierung via
  API aus — konform.

**Aktion in dieser PR**: keine.

## §2 Fehler-Semantik

**Warum?** 7 leere Catches existieren in dieser Welle (Inventur F2):

| Datei:Zeile | Was wird gefangen? | Aktion in Schritt 4a |
|---|---|---|
| `file-preview.tsx:3652` | (siehe Code-Inspektion in 4a) | Logging mit Begruendung |
| `markdown-preview.tsx:859` | (3 Catches im Search-/TOC-Hook) | Logging mit Begruendung |
| `markdown-preview.tsx:863` | – | Logging |
| `markdown-preview.tsx:931` | – | Logging |
| `audio-transform.tsx:136` | (Player-Cleanup oder Resource-Release) | Logging |
| `video-transform.tsx:136` | – | Logging |
| `pdf-transform.tsx:164` | – | Logging |

**Aktion**: Alle 7 in dieser PR (Schritt 4a) gefixt.

## §3 Erlaubte / verbotene Abhaengigkeiten

**Warum?** Direkte Provider-Imports waeren tickende Bomben — wenn ein neuer
Storage-Provider kommt, muesste man jede Detail-Komponente ueberarbeiten.

**Verifikation jetzt** (vor Refactor):

```bash
rg "from '@/lib/storage/(filesystem|nextcloud|onedrive)" \
  src/components/library/file-preview.tsx \
  src/components/library/markdown-preview.tsx \
  src/components/library/job-report-tab.tsx \
  src/components/library/media-tab.tsx \
  src/components/library/*-detail.tsx \
  src/components/library/audio-*.tsx \
  src/components/library/video-*.tsx \
  src/components/library/image-*.tsx \
  src/components/library/pdf-*.tsx \
  src/components/library/markdown-*.tsx \
  src/components/library/flow/ \
  src/components/library/shared/
```

Ergebnis (manuell verifiziert): leer. Welle 3-II ist konform —
`useStorage()`-Context und HTTP-APIs sind die einzigen Storage-Touchpoints.

## §4 Skip- / Default-Semantik

**Warum?** Wenn ein Detail-View ohne Daten gerendert wird, soll der Anwender
sehen, was fehlt — nicht ein leerer Bildschirm.

**Bestands-Befund**:

- `detail-view-renderer.tsx` (192z) macht Fallback auf `book` bei unbekanntem
  Typ. Konform mit `detail-view-type-checklist.mdc`.
- `*-detail.tsx`-Familie zeigt `<Alert>` bei fehlenden Pflichtfeldern (siehe
  Architektur-Diagramm in der Checkliste).
- `media-tab.tsx`, `markdown-preview.tsx`, `job-report-tab.tsx` zeigen
  freundliche Empty-States.

**Aktion**: Char-Test `detail-view-renderer.test.tsx` in Schritt 3 fixiert
die Fallback-Logik.

## §5 DetailViewType-Erweiterung

**Warum?** Die Architektur in `detail-view-type-checklist.mdc` ist der
**einzige** dokumentierte Pfad, neue Detail-View-Typen hinzuzufuegen. Wenn
ein Modul-Split den Pfad bricht (z.B. `job-report-tab.tsx` umbenennt),
verschwindet Punkt 9 der Checkliste — naechster Entwickler weiss nicht
mehr, wo er den ViewType ergaenzen soll.

**Aktion in dieser PR**: keine direkte Aenderung. Aber Char-Test
`detail-view-renderer.test.tsx` fixiert den Switch-Vertrag, sodass
Sub-Wellen 3-II-c und 3-II-d sicher refactoren koennen.

## §6 Modul-Split-Vertrag

**Warum?** 4 Files mit zusammen ~9.200 Zeilen sind nicht reviewbar und
nicht testbar. Modul-Split ist die Voraussetzung fuer Char-Tests und
Folge-Wellen.

**Wer macht den Split?** Nicht diese PR — die Vorbereitung legt nur die
Vertraege fest. Sub-Wellen 3-II-a/b/c/d (separate Cloud-Lauefe) machen
die Splits.

**Vertrag**: siehe Rule §6a (Verzeichnisstruktur-Tabelle).

## §7 Storage-Branches verboten — Helper-Migration in dieser PR

**Bestands-Befund**: `freshness-comparison-panel.tsx:145`

```typescript
const hasStorageColumn =
  data.config.primaryStore === "filesystem" || data.config.persistToFilesystem
```

Das ist ein Diagnose-Panel, das die Storage-Spalte ein-/ausblendet. Die
Storage-Detail-Entscheidung muss aber in einem **Helper** kapseln.

**Wahl der Loesung in dieser PR**: Helper aus Welle 1
(`isFilesystemBacked`). Erforderliche Anpassung: `data.config` muss in
das Format gebracht werden, das `isFilesystemBacked` erwartet
(`{ type, config: { shadowTwin } }`).

Ich pruefe in Schritt 4a die Signatur des Helpers und passe ggf. den Aufruf
an. Falls die Signatur nicht passt, dokumentiere ich es als Folge-Welle
und fixe das Storage-Branch-Problem stattdessen via lokalem `_isFilesystemBacked`-
Helper, der dieselbe Logik wie `library-capability.ts` aufruft.

## §8 `'use client'`-Direktiven

**Warum?** Plan-Regel 8 verlangt minimalen Client-Bundle.

**Bestands-Befund**: 54/57 mit `'use client'`. Die 3 ohne sind:

- `markdown-metadata.tsx` (437z, 2 Hooks) — KEIN `'use client'`. Funktioniert,
  weil sie nur via `markdown-preview.tsx` gerendert wird, das selbst auch
  keine Direktive hat. Pre-Existing-Pattern, nicht in dieser Welle anfassen.
- `shared/shadow-twin-artifacts-table.tsx` (393z, 2 Hooks) — gleiches Pre-Existing.
- `shared/story-status.ts` (Pure Helper, kein React) — korrekt.

**Aktion in dieser Welle**: nichts. Pre-Existing-Issue dokumentiert in
`04-altlast-pass.md`, Folge-Welle.

## §9 Code-Review-Checkliste

Siehe Rule §9. Wird in Schritt 7 (Abnahme) als CI-Check eingefordert.

## Bezug zur Inventur (01-inventory.md)

| Inventur-Befund | Adressiert von | Aktion |
|---|---|---|
| 7 leere Catches | §2 | Diese PR (Schritt 4a) — alle |
| 1 Storage-Branch | §7 | Diese PR (Schritt 4a) — Helper-Migration |
| `file-preview.tsx` 3.701 Zeilen, 66 Hooks | §6 | Sub-Welle 3-II-a |
| `markdown-preview.tsx` 2.054 Zeilen, 41 Hooks | §6 | Sub-Welle 3-II-b |
| `job-report-tab.tsx` 2.284 Zeilen, 30 Hooks | §6 | Sub-Welle 3-II-c |
| `media-tab.tsx` 1.147 Zeilen, 13 Hooks | §6 | Sub-Welle 3-II-c |
| `session-detail.tsx` 1.042 Zeilen | §6 | Sub-Welle 3-II-d |
| `flow/pipeline-sheet.tsx` 671 Zeilen | §6 | Sub-Welle 3-II-d |
| `'use client'` Pre-Existing-Issue | §8 | Folge-Welle |
| 0 direkte Tests | §1, §6 | Diese PR (Schritt 3, 8 kleine Files) + Sub-Wellen |
