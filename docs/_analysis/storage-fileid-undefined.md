# Analyse: `fileId=undefined` nach Upload (Filesystem Storage)

## Beobachtung
- Nach einem erfolgreichen Upload (`action=upload`) wurde unmittelbar danach ein `list`-Request mit `fileId=undefined` ausgelöst.
- Das führte serverseitig zu `ENOENT`/`404`, weil `getPathFromId()` `fileId` als Base64 dekodiert und bei `"undefined"` einen kaputten Pfad erzeugt.

## Wahrscheinliche Ursache
- **Caller-Bug**: `refreshItems()` wurde ohne Parameter aufgerufen.
- `refreshItems(folderId: string)` erwartet aber immer eine gültige Folder-ID (`root` oder Base64-ID).
- Ohne Argument wird `undefined` in die URL serialisiert → `fileId=undefined`.

## Lösungsvarianten
### Variante A (bevorzugt): Bug am Ursprung fixen
- Im Caller immer `folderId ?? 'root'` übergeben.
- Vorteil: Kein „kaputter“ Request wird erzeugt.
- Nachteil: Caller muss gefunden und korrigiert werden (aber das ist die saubere Lösung).

### Variante B: Server defensiv härten (Safety Net)
- Query-Parameter normalisieren (`"undefined"|"null"|""` → `root`).
- `getPathFromId()` nur dekodieren, wenn `fileId` wie Base64 aussieht.
- Vorteil: robust gegen Client-Bugs, vermeidet 500/404.
- Nachteil: „Maskiert“ den Bug (daher nur als Ergänzung, nicht als Ersatz).

### Variante C: A + B + Telemetrie
- Zusätzlich Warn-Log/Metric bei `"undefined"`-Eingängen.
- Vorteil: Stabil + Ursache bleibt sichtbar.
- Nachteil: etwas mehr Aufwand/Noise.

## Entscheidung
- Wir setzen **Variante A** um (Caller fixen) und behalten **Variante B** als Sicherheitsnetz.

## Fix (Ist-Stand)
- Caller: `CreationWizard` ruft `refreshItems(parentId)` statt `refreshItems()` auf.
- Server: normalisiert `fileId` defensiv, um ähnliche Bugs nicht mehr als Hard-Failure wirken zu lassen.

## Test
1. `/library/create/<type>` → Speichern
2. Erwartung: Upload `200`, danach `list` ebenfalls `200`, kein `fileId=undefined` mehr in Requests.







