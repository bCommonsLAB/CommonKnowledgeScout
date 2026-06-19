# Analyse: Performance der Shadow-Twin-Migration (Filesystem -> Mongo)

Stand: 2026-06-19

## 1. Symptom (Beobachtung des Users)

- Migration ("Aus Dateisystem laden") lief >30 Minuten und wurde abgebrochen.
- Im Log erscheinen ~22.000-mal `Bild bereits vorhanden, verwende vorhandene URL`.
- In Azure liegen aber scheinbar nur ~500 Bilder.
- Verdacht des Users: "Es werden immer dieselben Bilder gefunden."
- Wichtiger Hinweis des Users: OCR benennt die Seitenbilder in JEDEM PDF gleich
  (`page_001.jpeg`, `page_002.jpeg`, ...).

## 2. Befund (code-belegt)

### 2.1 Die ~500 Bilder in Azure sind KEIN Datenverlust

Azure-Pfad (`getBlobPathWithScope`, `azure-storage-service.ts`):

```
{libraryId}/{scope}/{ownerId}/{hash}.{ext}
```

- `ownerId` = ID der Quell-PDF (Base64 des Pfads, sanitized) -> **jede PDF hat ihren
  eigenen Unterordner**.
- Blob-Name = `{hash}.{ext}`, wobei `hash` = SHA-256 (erste 16 Zeichen) des
  **Bildinhalts** ist (`calculateImageHash`).

Folge fuer die Kollisions-Sorge des Users:
- Gleiche Dateinamen (`page_001.jpeg`) ueber verschiedene PDFs **kollidieren NICHT**,
  weil (a) der Ordner pro PDF getrennt ist und (b) der Blob-Name der Inhalts-Hash ist,
  nicht der Dateiname.
- Innerhalb einer PDF haben `page_001` und `page_002` unterschiedlichen Inhalt ->
  unterschiedlicher Hash -> kein Ueberschreiben.

Der Screenshot zeigt EINEN Ordner (`books/qxj0awns...` = `Articles/9783927266575_Interior.pdf`)
mit **542 Elementen** (Azure Explorer paginiert: "501 bis 542 von 542"). Das ist also
genau ein PDF mit 542 Seitenbildern — korrekt gespeichert. Andere PDFs wurden gar nicht
erreicht, weil der Lauf in diesem einen PDF haengen blieb.

### 2.2 "Immer dieselben Bilder" — JA, das stimmt (Ursache: Mehrfach-Verarbeitung)

Die `migrate`-Route ruft `persistShadowTwinFilesToMongo` **einmal pro Artefakt** auf
(`route.ts`, Schleife `for (const artifact of artifacts)`).

Jeder dieser Aufrufe macht im Writer (`shadow-twin-migration-writer.ts`) das KOMPLETTE
Programm erneut:
1. `collectAllFilesInFolder(provider, ...)` — listet den Twin-Ordner neu (am Route-Cache
   vorbei, eigener `listItemsById`).
2. Fuer JEDES Bild: `provider.getBinary(...)` — **laedt das Bild vollstaendig ueber
   WebDAV herunter**, nur um den Hash zu berechnen.
3. Fuer JEDES Bild: `getImageUrlByHashWithScope(...)` — **eine Azure-Existenz-Pruefung**
   (HTTP-Round-Trip), die bei Re-Runs fast immer "Bild bereits vorhanden" liefert.

Wenn eine PDF K Artefakte hat (Transcript + mehrere Transformationen / Sprachen), werden
ihre N Seitenbilder **K-mal** heruntergeladen und K-mal gegen Azure geprueft.
Bei K=40, N=542 ergibt das ~21.700 Dedup-Treffer — genau die ~22.000 im Log. Der Lauf
verbringt also fast die gesamte Zeit damit, dieselben Bilder einer einzigen PDF
wiederholt ueber WebDAV zu laden.

### 2.3 Kostentreiber (zusammengefasst)

| Treiber | Ursache | Wirkung |
|---|---|---|
| Mehrfach-Verarbeitung | Bild-Upload liegt pro Artefakt statt pro Quelle | Faktor K (Artefakte/PDF) |
| WebDAV-Re-Download | Hash braucht die Bytes; kein Skip bei bereits migriert | N Downloads pro Durchlauf |
| Sequentielle Verarbeitung | `for`-Schleife ohne Parallelitaet | volle Latenz-Summe |

## 3. Loesungsvarianten

### Variante 1 — Bild-Verarbeitung pro Quelle statt pro Artefakt (minimal)

- Bilder des Twin-Ordners **einmal pro Quelle** verarbeiten (Hash, Upload/Dedup,
  `fileName -> url`-Map, `binaryFragments`).
- Danach je Artefakt nur noch das jeweilige Markdown laden, URLs rewriten, upserten.
- Aufwand: mittel (Refactor von `route.ts` + Writer-Signatur).
- Effekt: reduziert Bild-Arbeit um Faktor K. Beseitigt das "immer dieselben Bilder".
- Risiko: gering; Datenmodell bleibt gleich.

### Variante 2 — Mongo-bewusster Skip (idempotente Re-Runs)

- Vor dem Verarbeiten den bestehenden Mongo-Twin laden. Bilder, deren `name` bereits ein
  `url`+`hash`-Fragment hat, **ueberspringen** (kein WebDAV-Download, kein Azure-Check).
- Effekt: Re-Run nach Abbruch ist fuer bereits migrierte PDFs nahezu sofort fertig.
- Risiko: gering; Dateinamen sind innerhalb eines PDF-Ordners eindeutig.
- Kombinierbar mit Variante 1 (empfohlen).

### Variante 3 — Parallelitaet (+ optional lokaler Provider)

- Bilder mit begrenzter Nebenlaeufigkeit (z.B. 5-10 parallel via einfacher Pool-Helper)
  laden/hochladen. WebDAV-Latenz dominiert -> grosser Speedup.
- Optional/separat: Da der Nextcloud-Ordner lokal gespiegelt ist, waere ein
  `local`-Provider deutlich schneller als WebDAV. ABER: Backend-Wechsel ist
  Konfigurations-Thema und beruehrt die Storage-Abstraktion — nicht Teil dieses Fixes.
- Risiko: mittel (Fehlerbehandlung bei parallelen Calls, Azure-Rate-Limits).

## 4. Empfehlung

**Variante 1 + Variante 2 zusammen.** Damit:
- entfaellt die K-fache Mehrfach-Verarbeitung (V1),
- werden abgebrochene Laeufe beim Neustart guenstig fortgesetzt (V2),
- bleibt das Datenmodell und die Storage-Abstraktion unveraendert.

Variante 3 (Parallelitaet) als optionaler Folgeschritt, falls auch der Erstlauf
(Cold-Cache, alles muss einmal hoch) noch zu langsam ist.

## 5. Betroffene Dateien

- `src/app/api/library/[libraryId]/shadow-twins/migrate/route.ts`
  (Schleife: Bilder vor der Artefakt-Schleife einmal verarbeiten)
- `src/lib/shadow-twin/shadow-twin-migration-writer.ts`
  (Aufteilen in: `prepareSourceImages(...)` einmal pro Quelle + `upsertArtifactMarkdown(...)` pro Artefakt;
  Mongo-Skip in der Bild-Schleife)
- ggf. `src/lib/repositories/shadow-twin-repo.ts`
  (Lese-Helper fuer bestehende `binaryFragments` einer Quelle, fuer V2-Skip)

## 6. Offene Punkte / vor Umsetzung klaeren

- Wieviele Artefakte hat eine typische PDF wirklich (K)? Bestimmt den realen Gewinn von V1.
- Sind die Seitenbilder in Azure pro PDF wirklich identisch zwischen Artefakten?
  (Erwartung: ja — selber Twin-Ordner.)
