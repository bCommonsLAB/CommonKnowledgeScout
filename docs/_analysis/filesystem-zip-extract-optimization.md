## Problem / Beobachtung
Beim aktuellen Flow werden ZIP-Archive (z.B. `mistral_ocr_images.zip`, `pages.zip`) im Backend mit `jszip` entpackt und **jede Datei einzeln** via `StorageProvider.uploadFile()` gespeichert.

Für „filesystem“-Libraries ist der Server-Provider in unserem Setup jedoch **nicht** der direkte `FileSystemProvider`, sondern der `LocalStorageProvider` aus `storage-factory.ts`, der **über HTTP** die Route `POST /api/storage/filesystem?action=upload` aufruft.

Das bedeutet:
- Pro Bild entsteht mindestens **ein HTTP Request** (oft ~100–300ms), plus JSON/Multipart Overhead.
- Bei vielen Bildern dominiert dieser Overhead die Gesamtlaufzeit.

## Ziel
Für „filesystem“-Libraries sollen ZIPs **serverseitig in einem Request** entpackt und in den Zielordner geschrieben werden.
Für OneDrive bleibt das bisherige Verhalten (Upload einzelner Dateien, idealerweise gebatcht/parallelisiert).

## Varianten (3 Optionen)
### Variante A – Neue Filesystem-API Aktion: `saveAndExtractZipInFolder` (empfohlen)
**Idee:** Neue POST-Action in `src/app/api/storage/filesystem/route.ts`, die `{ zipBase64 }` annimmt und die Inhalte direkt im Filesystem in den Zielordner schreibt. Rückgabe: Liste der erzeugten `StorageItem`s.

**Pro:**
- Größter Speedup bei filesystem, weil viele HTTP Uploads → 1 HTTP Call.
- Keine Änderung am globalen `StorageProvider` Interface nötig (Capability/Feature-Detection).
- Funktioniert sauber im bestehenden „dynamischen Provider“ Modell (serverseitig sowieso HTTP-Provider).

**Contra/Risiken:**
- Request-Body kann groß werden (Base64-Overhead ~33%). Für sehr große ZIPs muss ggf. später auf Streaming/MultiPart umgestellt werden.
- Security/Robustheit: Dateinamen müssen strikt sanitisiert werden (kein Path Traversal).

### Variante B – Direkter Server-Provider für filesystem (Bypass der API)
**Idee:** Im Server-Kontext bei filesystem-Libraries statt `LocalStorageProvider` direkt `FileSystemProvider` verwenden (kein HTTP über `/api/storage/filesystem`).

**Pro:**
- Spart alle HTTP Calls, nicht nur für ZIPs.
- Saubere Server/Client Trennung.

**Contra/Risiken:**
- Größerer Umbau im `StorageFactory`/Provider-Lifecycle.
- Erfordert sorgfältige Konsistenzregeln (IDs/Path-Resolution, Security-Prüfungen, Email-Handling).
- Höheres Risiko für Seiteneffekte, weil bisher vieles bewusst über die API-Route „zentralisiert“ ist.

### Variante C – ZIP als einzelnes File hochladen + serverseitiger „Unzip-Job“
**Idee:** ZIP wird einmal als Datei hochgeladen, dann serverseitig entpackt (ggf. async), anschließend ZIP wieder löschen.

**Pro:**
- Kein Base64-Overhead.
- Für sehr große ZIPs besser (Streaming Upload möglich).

**Contra/Risiken:**
- Zusätzliche Komplexität (Zwischendatei, Cleanup, Fehlerfälle).
- Mehr Schritte/Status-Handling, ggf. Race Conditions.

## Entscheidung
**Variante A** ist der beste „minimal-invasive“ Schritt: großer Performancegewinn für filesystem, keine Änderungen an OneDrive, und passt zum bestehenden Provider-Setup.

## Testplan (technisch)
- Unit-Test: Capability-Methode existiert und wird aufgerufen (Mock Provider).
- E2E/Smoke: Extract-Job mit filesystem-Library → deutlich weniger `/api/storage/filesystem?action=upload` Requests.
- Regression: OneDrive-Library → unverändertes Verhalten (kein Aufruf der neuen Action).


