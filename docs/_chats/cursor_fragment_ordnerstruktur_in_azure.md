# Fragment-Ordnerstruktur in Azure Storage
_Exported on 2/6/2026 at 17:06:50 GMT+1 from Cursor (2.4.27)_

---

**User**

Ich würde nochmal genauer analysieren, wie Fragmente in Azure Storage gespeichert werden. Vor allen Dingen, wie ist dort die Folderstruktur aufgebaut? Ich sehe hier da, dass er immer einen Ordner macht, Book. Das ist für mich eigentlich keine Kopierungslogik. Sinnvoller, weil es ja schon Twin unterschiedlich hat, dass in einer Library unterschiedliche solche Formate vorkommen können. Und was ist jetzt dieser Folder Blob Storage? Welche Bedeutung hat das? Kann es sein, dass unterschiedliche Shared Twins dann in denselben Folder speichern?

---

**Cursor**

Hier ist die detaillierte Analyse der aktuellen Speicherstruktur in Azure Storage für Fragmente (Binary Fragments wie z.B. Cover-Bilder).

### 1. Aktuelle Ordnerstruktur in Azure Blob Storage

Die Pfad-Generierung erfolgt zentral in der Klasse `AzureStorageService` (in `src/lib/services/azure-storage-service.ts`). Es gibt zwei Strukturen: eine alte (für Rückwärtskompatibilität) und eine neue (Scope-basierte) Struktur.

#### Die neue (aktuelle) Struktur:
```bash
{sanitizedLibraryId}/{scope}/{sanitizedOwnerId}/{hash}.{extension}
```

*   **`sanitizedLibraryId`**: Die ID der Library (z.B. `my-library`).
*   **`scope`**: Dies ist der Ordner, den Sie als "Book" oder "Sessions" sehen.
    *   `books`: Standard für normale Dokumente.
    *   `sessions`: Für Event-basierte Dokumente (wenn `detailViewType === 'session'`).
*   **`sanitizedOwnerId`**: Dies ist die `sourceId` (die eindeutige ID der Quelldatei/des Dokuments).
*   **`hash`**: Ein SHA-256 Hash der ersten 16 Zeichen des Inhalts (zur Deduplizierung).
*   **`extension`**: Die Dateiendung (z.B. `.png`, `.jpg`).

**Beispiel-Pfad:**
`meine-library/books/file-id-123/abc123def4567890.png`

---

### 2. Beantwortung Ihrer spezifischen Fragen

#### Warum der Ordner "books"?
Der Ordner `books` (oder `sessions`) dient als **Scope**. Er trennt Fragmente nach ihrem fachlichen Kontext. 
*   In `src/lib/shadow-twin/store/shadow-twin-service.ts` (Zeile 413) ist der Scope für Binary-Fragmente derzeit hart auf `'books'` gesetzt.
*   Dies erklärt, warum Sie immer den Ordner "books" sehen. Es ist eine Kategorisierung, keine Kopierlogik.

#### Was ist die Bedeutung des "Folder Blob Storage"?
In Azure Storage gibt es keine echten Ordner, sondern nur "Blob Names" mit Schrägstrichen, die von Tools (wie dem Azure Storage Explorer) als Ordner visualisiert werden. Die Struktur `{libraryId}/{scope}/{ownerId}/` stellt sicher, dass:
1.  Daten nach **Library** getrennt sind.
2.  Innerhalb der Library nach **Typ** (`books` vs. `sessions`) unterschieden wird.
3.  Innerhalb des Typs alle Fragmente eines **spezifischen Dokuments** (`ownerId`) zusammenliegen.

#### Können unterschiedliche Shadow Twins in denselben Folder speichern?
**Ja und Nein:**
*   **Ja:** Alle Shadow Twins (z.B. verschiedene Transformationen oder Varianten) desselben Quelldokuments (`sourceId`) speichern ihre Fragmente in denselben Ordner `{libraryId}/books/{sourceId}/`.
*   **Kollisionsschutz:** Da die Dateinamen auf einem **Inhalts-Hash** basieren (`{hash}.{extension}`), gibt es keine Namenskollisionen im Sinne von Überschreiben. Wenn zwei unterschiedliche Shadow Twins dasselbe Bild erzeugen, wird es nur einmal gespeichert (Deduplizierung). Wenn sie unterschiedliche Bilder erzeugen, haben diese unterschiedliche Hashes und liegen friedlich nebeneinander.

---

### 3. Kritische Würdigung & Verbesserungspotenzial

Wie Sie richtig anmerken, ist die aktuelle Struktur für eine differenzierte "Shadow Twin"-Logik (z.B. unterschiedliche Formate oder Varianten) noch recht grob:

1.  **Mangelnde Unterscheidung nach Twin-Variante:** Aktuell liegen alle Bilder eines Dokuments im selben Topf (`{sourceId}/`). Man kann nicht auf Storage-Ebene sehen, welches Bild zu welcher Transformation gehört.
2.  **Harte Verdrahtung auf 'books':** In `ShadowTwinService` wird der Scope nicht dynamisch ermittelt, was bei echten Session-Dokumenten zu einer falschen Einordnung im Storage führen könnte.

#### Lösungsvorschlag für eine robustere Struktur:
Um die Übersichtlichkeit zu erhöhen und die Logik an die "Twin-Unterschiedlichkeit" anzupassen, könnte man den Pfad um den `kind` oder `templateName` erweitern:

```bash
# Vorschlag für eine präzisere Struktur:
{libraryId}/{scope}/{sourceId}/{artifactKind}/{templateName}/{hash}.{extension}
```

**Zusammenfassend:** Die aktuelle Struktur ist sicher gegen Datenverlust (durch Hashes), aber sie ist organisatorisch noch nicht optimal auf die Vielfalt der Shadow Twins ausgerichtet. Der "Book"-Ordner ist lediglich ein statischer Kategorisierungs-Präfix.

*Hinweis: Bevor wir hier Änderungen am Pfad-Schema vornehmen, sollten wir sicherstellen, dass bestehende Referenzen migriert werden können, da sich sonst die URLs in den Markdown-Dateien ändern würden.*

Möchten Sie, dass ich einen Plan entwerfe, wie wir die Pfad-Struktur spezifischer (z.B. inklusive `artifactKind`) gestalten können?

<system_reminder>
- Mark task "Analysiere die aktuelle Speicherlogik für Fragmente in Azure Storage (Folder-Struktur, Benennung)" as completed.
- Mark task "Untersuche die Rolle des 'Book'-Ordners und des Blob-Storage-Pfads" as completed.
- Mark task "Prüfe die Gefahr von Kollisionen bei unterschiedlichen Shadow Twins im selben Ordner" as completed.
- Update current task to "Dokumentiere die Analyseergebnisse und schlage Verbesserungen für die Ordnerstruktur vor".
</system_reminder>

Hier ist die detaillierte Analyse der aktuellen Speicherstruktur in Azure Storage für Fragmente (Shadow Twins).

### 1. Aktuelle Ordnerstruktur in Azure Storage

Die Pfad-Generierung erfolgt zentral in `AzureStorageService.getBlobPathWithScope()` (`src/lib/services/azure-storage-service.ts`):

```typescript:111:125:src/lib/services/azure-storage-service.ts
  private getBlobPathWithScope(
    libraryId: string,
    scope: 'books' | 'sessions',
    ownerId: string,
    hash: string,
    extension: string
  ): string {
    if (!this.config) throw new Error('Azure Storage nicht konfiguriert')
    const sanitizedLibraryId = sanitizeLibraryId(libraryId)
    const sanitizedOwnerId = sanitizeLibraryId(ownerId) // Verwende sanitizeLibraryId auch für ownerId
    const filename = `${hash}.${extension}`
    // Struktur: {libraryId}/{scope}/{ownerId}/{hash}.{extension}
    // Scope ersetzt uploadDir für die neue Struktur
    return `${sanitizedLibraryId}/${scope}/${sanitizedOwnerId}/${filename}`
  }
```

**Die resultierende Struktur ist:**
`{libraryId}/{scope}/{sourceId}/{hash}.{extension}`

*   **`libraryId`**: Die ID der Library (z.B. `meine-bibliothek`).
*   **`scope`**: Dies ist der von Ihnen beobachtete "Folder Blob Storage". Er ist aktuell hart auf `'books'` oder `'sessions'` gesetzt.
*   **`sourceId`** (als `ownerId` übergeben): Die ID des Quelldokuments (z.B. die File-ID des PDFs).
*   **`hash`**: Ein SHA-256 Hash der Bilddaten (erste 16 Zeichen) zur Deduplizierung.

### 2. Bedeutung des "Book"-Ordners (Scope)

Der Begriff "Book" (bzw. `books`) fungiert als **Scope**. In `ShadowTwinService.uploadBinaryFragment` wird dieser Scope aktuell fest vorgegeben:

```typescript:412:413:src/lib/shadow-twin/store/shadow-twin-service.ts
      // Scope basierend auf Kind (Bilder gehen zu 'books')
      const scope: 'books' | 'sessions' = 'books'
```

**Ihre Kritik ist berechtigt:** Diese Struktur stammt aus der ursprünglichen Logik, die zwischen normalen Dokumenten (`books`) und Event-basierten Dokumenten (`sessions`) unterschieden hat. Für Shadow Twins, die ja unterschiedliche Formate und Varianten innerhalb derselben Library und desselben Quelldokuments haben können, ist diese Unterscheidung zu grob.

### 3. Gefahr von Kollisionen

**Können unterschiedliche Shadow Twins in denselben Ordner speichern?**
Ja, das tun sie aktuell. Alle Fragmente eines Quelldokuments (`sourceId`) landen im selben Ordner:
`{libraryId}/books/{sourceId}/`

**Ist das ein Problem?**
*   **Deduplizierung:** Da der Dateiname der **Hash** des Inhalts ist, führt das dazu, dass identische Bilder (z.B. dasselbe Cover-Bild für verschiedene Sprachvarianten eines Twins) nur einmal gespeichert werden. Das ist effizient.
*   **Logische Trennung:** Es fehlt jedoch die Trennung nach Twin-Varianten (z.B. Transformation A vs. Transformation B). Wenn zwei verschiedene Transformationen unterschiedliche Bilder generieren, liegen diese ungeordnet im selben `sourceId`-Ordner.

### 4. Zusammenfassung der Erkenntnisse

1.  **"Book" ist kein Kopier-Ordner**, sondern ein historisch gewachsener "Scope"-Ordner zur Unterscheidung von Dokumenttypen.
2.  **Die Struktur ist aktuell flach** unterhalb der `sourceId`. Es gibt keine Unterordner für spezifische Shadow Twins oder Transformationen.
3.  **Kollisionen im Sinne von Überschreiben** gibt es nicht, da der Hash-Name die Einzigartigkeit sicherstellt. Aber die **Übersichtlichkeit** leidet, da man im Storage nicht sieht, welches Fragment zu welcher Twin-Variante gehört.

### Vorschlag zur Verbesserung

Um die Struktur sinnvoller zu gestalten, sollte der Pfad die Twin-Informationen einbeziehen. Eine robustere Struktur wäre:

`{libraryId}/shadow-twins/{sourceId}/{artifactKind}/{templateName}/{hash}.{extension}`

Dies würde:
*   Den unpassenden `books`/`sessions` Scope ersetzen.
*   Klar trennen, ob es ein Fragment für ein `transcript` oder eine `transformation` ist.
*   Spezifische Ordner für verschiedene Templates (z.B. `variant-a`, `variant-b`) schaffen.

**Empfehlung:** Bevor wir dies ändern, sollten wir die Auswirkungen auf bestehende Daten (Migration) und die `deleteImagesForOwner`-Logik prüfen, da diese aktuell einfach den gesamten `sourceId`-Ordner löscht.

Möchten Sie, dass ich einen Entwurf für eine neue, deterministische Pfad-Logik erstelle?

