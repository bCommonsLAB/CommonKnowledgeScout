# Analyse: B2d — Bilder/Assets ins Ziel spiegeln (transcript-only)

Status: Entwurf — Entscheidung offen (Variante wählen)
Datum: 2026-06-17
Bezug: `wizard-promotion-shadow-twin-angleichung.md` (B2a erledigt), ADR-0004,
`docs/architecture/shadow-twin.md`

## 1. Problem

Beim Ausnahmefall „Nur importieren und transkribieren" (docType=transcript)
landen heute im Ziel-Archiv nur **Original-PDF** + **Transkript-Shadow-Twin**.
Die beim Extrahieren erzeugten **Seiten-/Embedded-Bilder + Thumbnails** fehlen.
Bei einem mehrseitigen PDF mit Bildern ist der Shadow-Twin im Ziel damit
unvollständig; referenziert das Transkript Bilder, laufen die Links ins Leere.

## 2. Wo liegen die Assets heute? (Befund aus Code)

Der Extract-Job (`runExtractOnly`) läuft im **Inbox-Scope**
(`providerScope='inbox'`, Quarantäne). Er erzeugt die Bilder bereits und legt
sie ab — abhängig von der Shadow-Twin-Config der **aufgelösten** Library:

- `resolveShadowTwinLibrary` liefert für Inbox-Scope `null`
  → `getShadowTwinConfig(null)` → `primaryStore='filesystem'`, `persistToFilesystem=true`.
- Folge: Transkript + Bilder werden über `writeArtifact` / `processAllImageSources`
  als **Dateien in einen Shadow-Twin-Dot-Folder im Inbox-Provider** geschrieben
  (Azure-Blob-Inbox). `result.savedItems` enthält deren Inbox-Item-IDs.

Die Submission selbst kennt diese Assets NICHT (`applyAnalysisResult` schreibt nur
`markdownBody` + `metadata`). Der **Job** kennt sie (`result.savedItems`,
`correlation.options.submissionId`).

## 3. Kernkonflikt: Ziel-Store entscheidet das „Wie"

Das Ziel-Archiv kann FS- oder Mongo-primary sein (Library-Config):

- **FS-primary** (z.B. lokale Library): Assets = **Dateien** im Ziel-Dot-Folder
  `.{pdf}/page_NNN.png`. Transkript-Bildlinks (relativ) lösen dort auf.
- **Mongo-primary** (deine OneDrive-Test-Lib, Screenshot „Dot-Folder: nein"):
  Assets = **Mongo-Binary-Fragmente** am Transkript-Shadow-Twin (Azure-Blob +
  Streaming-URL), KEINE Dateien.

→ B2d muss dieselbe Dual-Logik bedienen wie der Extract-Job. **Hier droht die
Doppelprogrammierung**, vor der wir gewarnt haben. Die Varianten unterscheiden
sich genau darin, wie stark sie bestehende Bausteine wiederverwenden.

## 4. Varianten

### V1 — Promotion kopiert Inbox-Shadow-Twin-Dateien ins Ziel (datei-basiert)
- Inbox-Shadow-Twin-Ordner der PDF über `findShadowTwinFolder(parentId, name, inboxProvider)`
  finden, listen, alle Nicht-Transkript-Dateien laden und ins Ziel schreiben.
- FS-Ziel: per `writeArtifact`/Upload in den Ziel-Dot-Folder. Mongo-Ziel: müsste
  zusätzlich als Mongo-Fragmente abgelegt werden → **eigene Schreiblogik nötig**.
- Pro: konzepteinfach für FS-Ziele. Con: für Mongo-Ziele unvollständig oder
  Duplikat der Fragment-Logik; Bildlink-Auflösung (Sibling-Transkript vs.
  Dot-Folder-Bilder) muss separat bedacht werden. **Hohe Duplikationsgefahr.**

### V2 — Promotion nutzt `ShadowTwinService` des Ziels (service-basiert) [EMPFOHLEN]
- Promotion baut für die **Ziel-Quelle** (kopierte PDF) einen `ShadowTwinService`
  (wie B2a) und ruft dessen Fragment-/Markdown-APIs:
  - Transkript: `upsertMarkdown(kind='transcript')` (bereits B2a).
  - Bilder: je Asset `uploadBinaryFragment`/Fragment-API des Service.
- Quelle der Bytes: aus dem **Inbox-Shadow-Twin** des Quell-PDFs lesen
  (`findShadowTwinFolder` + `getBinary` über Inbox-Provider).
- Der Service entscheidet FS vs. Mongo anhand der **Ziel**-Config — die Dual-Logik
  bleibt damit an EINER Stelle (`ShadowTwinService`), keine neue Schreiblogik.
- Pro: nutzt das mandatierte Entry-Point, FS+Mongo korrekt, kein Duplikat.
  Con: Bytes-Transfer Inbox→Ziel nötig; Bild-Referenzen im Transkript müssen ggf.
  auf die neuen Fragment-URLs/Namen normalisiert werden (Service-Hilfen prüfen).

### V3 — Re-Key statt Kopie: Inbox-Shadow-Twin auf Ziel-PDF „umhängen"
- Statt zu kopieren, den kompletten Inbox-Shadow-Twin (Transkript + Fragmente,
  inkl. Mongo-Record) auf die Ziel-PDF-`fileId` re-keyen (Mongo-ID/Pfade umschreiben)
  und Azure-Blobs ggf. in den Ziel-Bereich verschieben.
- Pro: kein erneutes Hochladen, „verschiebt" den fertigen Shadow-Twin. Con:
  riskanteste Variante (ID-/Blob-Migration, Storage-spezifisch, Nextcloud/OneDrive
  unterschiedlich); berührt RAG-Keying. Großer Eingriff, schwer testbar.

## 5. Empfehlung

**V2** — `ShadowTwinService` des Ziels nutzen, Bytes aus dem Inbox-Shadow-Twin
einspeisen. Hält die FS/Mongo-Entscheidung an einer Stelle (keine Doppelung),
ist konsistent mit B2a und mit dem Archiv-Modell.

## 6. Offene Punkte / vor Umsetzung zu klären

1. **Bild-Referenzen im Transkript**: Wie referenziert der Extract die Bilder
   (relative Namen `page_NNN.png` vs. Streaming-URLs)? Müssen Links beim Spiegeln
   auf die Ziel-Fragment-URLs umgeschrieben werden, oder erledigt das der
   `ShadowTwinService`/Renderer bereits beim Lesen? (Erfordert Blick in
   `shadow-twin-service` Fragment-APIs + Renderer.)
2. **Asset-Enumeration**: V2 braucht die Asset-Liste. Quelle = Inbox-Shadow-Twin-
   Ordner (Dateien) ODER `job.result.savedItems`. Repo-Query „Job per submissionId"
   existiert noch nicht (`external-jobs-repository.ts` hat nur `listByUserEmail`/
   `listByUserWithFilters`). Entweder Query ergänzen oder Ordner-basiert lesen.
3. **Thumbnails/Varianten**: page-render vs. thumbnail vs. embedded — welche
   Varianten sollen ins Ziel? (Vermutlich alle, analog Extract.)
4. **Idempotenz**: erneutes Promote darf Fragmente nicht duplizieren (Service ist
   i.d.R. deterministisch/dedupliziert — verifizieren).

## 7. Betroffene Dateien (V2, voraussichtlich)

- `src/lib/submissions/promotion.ts` / `promotion-transcript.ts` — Asset-Schritt
  im transcript-Pfad (injizierte Funktion, storage-agnostisch).
- `src/lib/submissions/promote-actions.ts` — Injektion: Inbox-Assets lesen +
  `ShadowTwinService` (Ziel) schreiben.
- ggf. `src/lib/external-jobs-repository.ts` — Query „Job per submissionId"
  (falls job-basierte Enumeration gewählt).
- Tests: `tests/unit/submissions/promotion.test.ts` (+ ggf. Service-Mock).

## 8. Schnitt (V2)

- **B2d-1**: Asset-Enumeration im Inbox-Shadow-Twin (Ordner-basiert) + Tests.
- **B2d-2**: Spiegeln über `ShadowTwinService` (Ziel) inkl. FS/Mongo + Idempotenz.
- **B2d-3**: Bild-Referenz-Normalisierung im Transkript (falls nötig).
