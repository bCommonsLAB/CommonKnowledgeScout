## Ziel

Die Trace-Timeline soll die **tatsächlichen Phasenzeiten** von `extract_pdf`, `transform_template` und `ingest_rag` abbilden. Insbesondere soll das Persistieren (MongoDB/Blob/Filesystem) **nicht** als eigenständige (Root‑)Phase `postprocessing` erscheinen, sondern zeitlich **der Phase zugeschrieben werden**, die den Persistenzschritt logisch verursacht. Zusätzlich soll verhindert werden, dass der `job`‑Span durch **transiente Fehler** (z. B. `ECONNRESET`) frühzeitig endet und spätere erfolgreiche Callbacks die Timeline nicht mehr „heilen“ können.

## Beobachtungen (aus dem Trace-Sample)

- **Doppelte `postprocessing`-Root-Spans** (gleiches `spanId`, unterschiedliche Zeitfenster) erzeugen Mehrdeutigkeit und können sogar **mit Template überlappen**. Das ist instrumentationsseitig schwer zu interpretieren und macht Phasenzeiten unzuverlässig.
- `extract_pdf` wird als `completed` markiert **bevor** die Persistenz (Markdown/Assets) passiert. Damit wird Persistenzzeit aus der Extract-Phase herausgeschnitten und landet in einem „Neben-Span“.
- Wird ein Job einmal über `setStatus(..., 'failed')` markiert, beendet das Repository den `job`‑Span nur **einmalig** (`endedAt` wird nicht überschrieben). Ein nachfolgend erfolgreicher Callback kann den `job`‑Span daher **nicht mehr verlängern** → Timeline bleibt falsch.

## Lösungsvarianten

### Variante A – Strikt (harte Finalität)
Sobald ein Fehler auftritt, wird der Job als `failed` markiert und **alle späteren Callbacks werden ignoriert**.

- **Pro**: Timeline & Status sind konsistent (kein „failed aber läuft weiter“).
- **Contra**: Bei realen Retry-Szenarien (transiente Netzfehler, temporäre 400/invalid_payload-Mapping) kann ein eigentlich erfolgreicher Job dauerhaft fehlschlagen.

### Variante B – Robust (transiente Fehler sind nicht final)
Transiente Fehler (Netzwerk: `ECONNRESET`, `ETIMEDOUT`, etc.) werden als **Warnung/Trace-Event** erfasst, markieren den Job aber **nicht** als `failed`. Spätere erfolgreiche Callbacks können den Job normal abschließen.

- **Pro**: Verhindert „Job endet zu früh“ und verbessert die Diagnosefähigkeit.
- **Contra**: Erfordert eine pragmatische Heuristik zur Erkennung transienter Fehler; in Grenzfällen bleibt Interpretation nötig.

### Variante C – Strukturell (neues Statusmodell)
Ein zusätzlicher Zustand wie `recovering` / `running-with-errors` oder ein eigener Retry‑State wird eingeführt; Finalität wird erst nach definierter Retry-Policy gesetzt.

- **Pro**: Semantisch sauber.
- **Contra**: Größerer Umbau (API/UI/Tests), mehr Migrations- und Wartungsaufwand.

## Entscheidung (minimal-invasiv)

Wir implementieren **Variante B** plus Instrumentierungs‑Bereinigung:

- **Kein eigener `postprocessing`-Root‑Span** für Persistenz. Persistenz-Events werden im **korrekten Phase‑Span** geloggt.
- `extract_*` wird erst dann als `completed` markiert, wenn die lokale Persistenz (inkl. optionaler Bildverarbeitung) abgeschlossen ist.
- Transiente Fehler werden als `transient_error` geloggt, ohne den Job final auf `failed` zu setzen, damit spätere erfolgreiche Callbacks die Timeline korrekt beenden können.

