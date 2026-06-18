# Test-Befunde nach B2d (transcript-only): „Bilder: 0" + fremde Bilder

Status: UMGESETZT (V1 + Zähler-Fix). Branch: `claude/confident-maxwell-9sz7cq`.
Test: „Inhalte erfassen" → `blog-writer-pilot.pdf` → „Nur importieren und
transkribieren" → im Archiv (`Onedrive Test / inbox 2`) angezeigt.

## Umsetzung (Kurzfassung)

Empirischer Beleg (vom Nutzer): Die fremde Bild-URL dekodiert zu
`<korrupte Binärbytes>/img-0.jpeg`. Der Eltern-/Quellteil der fileId ist also
NICHT als sauberer `sourceId` rückgewinnbar → V1 reicht die `sourceId` explizit
durch (statt aus der fileId zu raten).

- Befund 2 (V1): Renderer-Kette gibt die Träger-`sourceId` an die Lese-Route:
  `pdf/audio/video/office-view` → `ArtifactMarkdownPanel(sourceId=item.id)` →
  `MarkdownPreview(sourceId)` → `resolveImageUrl/processObsidianContent`
  hängen `&sourceId=` an die `streaming-url`. Die Route löst bei gesetztem
  `sourceId` NUR über `getShadowTwinBinaryFragments(libraryId, sourceId)` +
  `matchBinaryFragmentByLookupName` auf — kein library-weites Raten mehr.
  Ohne `sourceId` bleibt der Legacy-Pfad (Rückwärtskompatibilität).
- Befund 1 (Zähler): `mirroredAssetNames` läuft jetzt durch
  `promote-actions` → `wizard-submit#promoteSubmission` → `creation-wizard`.
  Anzeige (nur transcript-only): „Bilder" = Inhaltsbilder (`img-N`),
  „Assets" = alle gespiegelten Medien (zusätzlich `page_NNN`/`preview_NNN`).

## Befund 1 — Summary zeigt „Bilder: 0" (obwohl Bilder gespiegelt wurden)

### Ursache (gesichert, aus Code)

Die Summary-Zahl kommt aus dem Client-State, NICHT aus dem realen Promotion-
Ergebnis:

```ts
// src/components/creation-wizard/creation-wizard.tsx (~2578)
const imagesCount = Object.keys(wizardState.imageUrls || {}).length
```

Im transcript-only-Flow lädt der Nutzer KEINE Cover-/Inhaltsbilder über den
Wizard hoch → `imageUrls` ist leer → `imagesCount = 0`.

Die per B2d real gespiegelten Assets stehen in `PromotionResult.mirroredAssetNames`,
werden aber NICHT zum Client durchgereicht:

- `src/app/api/submissions/[id]/promote/route.ts` gibt nur
  `savedItemId, fileName, targetFolderId, targetFolderName` zurück.
- `src/lib/creation/wizard-submit.ts#promoteSubmission` liest dieselben Felder.

→ Die Zahl ist also schlicht nicht verdrahtet. Reiner Anzeige-Bug, keine
Daten-Korruption.

### Offene Produktentscheidung (Zähl-Semantik)

`mirroredAssetNames` enthält ALLE gespiegelten Bild-Assets des Inbox-Twins:
- `img-0..2` (eingebettete Inhaltsbilder, im Log 3 Stück),
- `page_001..008` (Seitenrenderings),
- `preview_001..008` (Thumbnails).

Im Test waren das 3 + 8 + 8 = 19 Assets. Der Nutzer erwartet „3" (nur die
Inhaltsbilder `img-*`). Eine reine `mirroredAssetNames.length`-Anzeige würde
„19" zeigen — technisch korrekt, aber nicht das, was der Nutzer meint.

Varianten:
- V1: „Bilder" = nur `img-*` (Inhaltsbilder) → entspricht der Nutzererwartung „3".
- V2: „Bilder" = alle gespiegelten Assets (19) → ehrlich, aber verwirrend.
- V3: zwei Zahlen („Bilder: 3 · Assets: 19").

Empfehlung: V1 (Inhaltsbilder), benannt als „Bilder". Klassifikation NICHT
still über Namenspräfix raten, sondern an EINER Stelle explizit dokumentieren
(`img-*` = Inhaltsbild) — sonst Verstoß gegen `no-silent-fallbacks`.

## Befund 2 — „fremde Bilder" im generierten Transkript

### Was B2d NICHT sein kann (aus Code abgeleitet)

`mirrorInboxAssetsToTarget` (promotion-assets.ts) lädt nur Binary-Fragmente ins
Ziel-Twin. Es verändert den Transkript-**Text** nicht. Der Transkript-Text kommt
aus `submission.markdownBody`.

Datenfluss des Textes:
1. Extract (Inbox): `persistShadowTwinToMongo` friert die Bildlinks im
   Inbox-Twin-Markdown ein (`freezeReplacedCount`) → eingebettete
   Inbox-Azure-URLs.
2. `applyAnalysisResult` liest GENAU dieses Artefakt (`savedItemId`) und schreibt
   dessen Body nach `submission.markdownBody`.
3. Promotion schreibt diesen Body 1:1 als Ziel-Transkript.

→ Die im Transkript sichtbaren Bilder stammen aus dem **Inbox-Freeze**, also aus
dem Extract-Schritt — NICHT aus B2d und NICHT aus der Promotion. B2d ist additiv.

### Diagnose-Ergebnis (vom Nutzer bestätigt)

- Das Bild ist NICHT im Original-PDF → echt fremd.
- Im Inbox-Twin sind keine Bilder sichtbar (nur Dateiname). Es wurde vorher eine
  ANDERE PDF in dieselbe `Onedrive Test`-Library verarbeitet.
- Nutzer-Befund: „OCR nennt die Bilder immer gleich" (`img-0.jpeg`, …).

### Gepinnte Ursache (mit Code-Beleg)

Es gibt ZWEI Auflösungspfade für Transkript-Bilder:

1. `ShadowTwinService.resolveBinaryFragmentUrl` → `getBinaryFragments()` →
   `mongoStore.getBinaryFragments(sourceId)` → `getShadowTwinBinaryFragments(libraryId, sourceId)`.
   KORREKT, weil pro `(libraryId, sourceId)` gescoped (Original-fileId).

2. Die Lese-Route `GET /api/storage/streaming-url` (vom MarkdownPreview genutzt,
   wenn der Transkript-Bildlink NICHT eingefroren ist):
   ```ts
   const lookupName = extractLookupNameFromFileId(fileId) // nur letztes Segment, z.B. img-0.jpeg
   const fragment = await findBinaryFragmentInLibraryByLookupName(libraryId, lookupName)
   ```
   `findBinaryFragmentInLibraryByLookupName` packt per `$unwind` ALLE
   `binaryFragments` ALLER Shadow-Twins der Library aus und nimmt den ERSTEN
   Namenstreffer („erster Treffer gewinnt"). → `sourceId`-AGNOSTISCH.

Bei generischen OCR-Namen (`img-0.jpeg`) gewinnt also das erste Dokument der
Library — das frühere PDF. Das ist die Quelle der fremden Bilder.

### Zwei zusammenwirkende Faktoren

F1 — Transkript bleibt UNGEFROREN: Inbox-Extract friert nicht ein
(`ProviderShadowTwinStore.getBinaryFragments` → null), und die Promotion
(`upsertMarkdown`) friert ebenfalls nicht ein. Also erreichen relative Namen
(`img-0.jpeg`) den Renderer.

F2 — Lese-Route löst library-weit nach Namen auf (`findBinaryFragmentInLibraryByLookupName`),
ohne `sourceId`. Generische Namen kollidieren dokumentübergreifend.

Wichtig: `extractLookupNameFromFileId` dekodiert die base64-fileId (ein PFAD) und
verwirft den Eltern-/Quellkontext — der zur präzisen Auflösung eigentlich
verfügbar wäre.

## Lösungsvarianten (Befund 2)

V1 — Lese-Route `sourceId`-präzise machen (empfohlen, app-weit):
In `streaming-url` aus der dekodierten fileId nicht nur den Dateinamen, sondern
auch das Eltern-/Quellsegment ziehen, daraus die `sourceId` bestimmen und
`getShadowTwinBinaryFragments(libraryId, sourceId)` + `matchBinaryFragmentByLookupName`
nutzen. Library-weite Suche nur noch als letzter Fallback (oder entfernen).
- Pro: behebt die echte Kollision an der Wurzel, hilft der GANZEN App, keine
  Markdown-Änderung.
- Con: erfordert Mapping Ordner-/Pfadsegment → `sourceId`; geteilte Route → mehr
  Testaufwand.
- Verifikation nötig: Was steht real in der dekodierten fileId (Ordnername vs.
  sourceId)?

V2 — Transkript beim Promote einfrieren (lokal):
Nach der Asset-Spiegelung das Ziel-Transkript gegen die Ziel-Twin-Fragmente
einfrieren (relative Namen → absolute, pro-Source Azure-URL). Dann lädt der
Browser direkt den korrekten Blob, die library-weite Route entfällt.
- Pro: pro-Source korrekt, lokal auf den transcript-only-Pfad begrenzt.
- Con: behebt die latente app-weite Lücke NICHT; Reihenfolge (erst spiegeln,
  dann einfrieren) muss umgestellt werden.

V3 — Eindeutige Bildnamen pro Quelle:
OCR-Bilder beim Extract/Spiegeln eindeutig benennen (Präfix mit sourceId/Hash).
- Pro: beseitigt die generische-Namen-Fragilität global.
- Con: größter Eingriff (Extract-Naming + Transkript-Referenzen + Migration),
  höchstes Risiko.

Empfehlung: V1 als korrekter Fix (app-weit), abgesichert durch den einen
Laufzeit-Messwert (Blob-URL des fremden Bildes → `sourceId`-Segment). Falls V1
wegen fehlendem Quellkontext in der fileId nicht sauber geht, V2 als
begrenzter Sofort-Fix für den Wizard-Flow.

## Fazit

- Befund 1: klarer Verdrahtungs-Bug (Zahl nicht durchgereicht). Anzeige.
- Befund 2: KEIN B2d-Regress (B2d ist additiv). Ursache ist die library-weite,
  `sourceId`-agnostische Lese-Route in Kombination mit ungefrorenen, generisch
  benannten Transkript-Bildern. Fix-Entscheidung: V1 (empfohlen) vs. V2.
