# Dateilisten-Aktualisierungsverhalten
_Exported on 2/6/2026 at 17:08:05 GMT+1 from Cursor (2.4.27)_

---

**User**

Ich habe jetzt das Archiv gewechselt, die Library gewechselt und ich sehe in der Fileliste immer noch die alten Dateien von den vorherigen Library. Wann wird diese Fileliste neu initialisiert und neu geladen? Können wir das nochmal analysieren?

---

**Cursor**

Ich analysiere das Problem mit der Dateiliste, die beim Library-Wechsel nicht aktualisiert wird.

Die Analyse zeigt das Problem. Lass mich die kritischen Stellen direkt prüfen.

## Analyse: Cache-Invalidierung beim Library-Wechsel

Ich habe das Problem identifiziert. Hier ist die detaillierte Analyse:

### Das Problem: Race Condition beim Library-Wechsel

**Ablauf im `library-switcher.tsx` (Zeilen 63-69):**

```63:69:src/components/library/library-switcher.tsx
    // Sofortiger UI-Reset, um alte Liste zu vermeiden
    setFolderItems([])
    setLastLoadedFolder(null)
    setCurrentFolderId('root')

    // Aktualisiere das Atom
    setActiveLibraryId(value);
```

**Problem:** Der `folderCache` im `libraryAtom` wird hier **nicht** zurückgesetzt!

**In `library.tsx` (Zeilen 403-420):**

```403:420:src/components/library/library.tsx
  useEffect(() => {
    if (!activeLibraryId) return;
    
    // Nur zurücksetzen, wenn sich die Bibliothek wirklich geändert hat
    const libraryChanged = prevActiveLibraryIdRef.current !== undefined && 
                          prevActiveLibraryIdRef.current !== activeLibraryId;
    
    if (libraryChanged) {
    setLastLoadedFolder(null);
    setFolderItems([]);
    setLibraryState(state => ({ ...state, folderCache: {} }));
    // WICHTIG: Ordnerauswahl und Shadow-Twin zurücksetzen
    setSelectedFile(null);
    setSelectedShadowTwin(null);
    }
    
    prevActiveLibraryIdRef.current = activeLibraryId;
  }, [activeLibraryId, setLastLoadedFolder, setFolderItems, setLibraryState, setSelectedFile, setSelectedShadowTwin]);
```

### Race Condition Ablauf:

1. **User wechselt Library** → `library-switcher.tsx` wird ausgeführt
2. **Synchron gesetzt:** `folderItems=[]`, `lastLoadedFolder=null`, `currentFolderId='root'`, `activeLibraryId=newId`
3. **`folderCache` bleibt unverändert** (enthält noch Daten der alten Library!)
4. **React führt Re-Render aus** → `loadItems()` in `library.tsx` wird getriggert
5. **`loadItems()` prüft Cache** → Findet möglicherweise alte Daten und zeigt sie an
6. **`useEffect` in library.tsx** wird erst **danach** ausgeführt und setzt `folderCache: {}` zurück

### Lösung

Der `folderCache` muss **sofort und synchron** beim Library-Wechsel zurückgesetzt werden. Soll ich die Korrektur implementieren?

**Geplante Änderung in `library-switcher.tsx`:**

```typescript
import { libraryAtom } from "@/atoms/library-atom"

// In handleLibraryChange hinzufügen:
setLibraryState(state => ({ ...state, folderCache: {} }))
```

---

**User**

ok, können wir das implementieren?

---

**Cursor**

Ich implementiere die Korrektur.

Die Änderung wurde implementiert. Hier ist die finale Datei:

```7:8:src/components/library/library-switcher.tsx
import { activeLibraryAtom, activeLibraryIdAtom, currentFolderIdAtom, folderItemsAtom, lastLoadedFolderAtom, librariesAtom, libraryAtom } from "@/atoms/library-atom"
```

```29:30:src/components/library/library-switcher.tsx
  const [, setLastLoadedFolder] = useAtom(lastLoadedFolderAtom)
  const [, setLibraryState] = useAtom(libraryAtom)
```

```63:73:src/components/library/library-switcher.tsx
    // Sofortiger UI-Reset, um alte Liste zu vermeiden
    // WICHTIG: folderCache muss SYNCHRON vor dem Library-Wechsel geleert werden,
    // um Race Conditions zu vermeiden. Sonst kann loadItems() in library.tsx
    // noch den alten Cache der vorherigen Library verwenden.
    setLibraryState(state => ({ ...state, folderCache: {} }))
    setFolderItems([])
    setLastLoadedFolder(null)
    setCurrentFolderId('root')

    // Aktualisiere das Atom
    setActiveLibraryId(value);
```

## Was geändert wurde

Der `folderCache` wird jetzt **synchron und sofort** beim Library-Wechsel geleert, bevor die anderen State-Updates erfolgen. Dies verhindert die Race Condition, bei der `loadItems()` noch den alten Cache der vorherigen Library verwenden konnte.

## Testen

1. App öffnen und eine Library mit Dateien anzeigen lassen
2. Zu einer anderen Library wechseln (z.B. "Klimaarchiv")
3. Überprüfen, ob die Dateiliste sofort die korrekten Dateien der neuen Library zeigt (in deinem Fall: `audio` und `pdf` Ordner)

Falls das Problem weiterhin besteht, bitte melden - dann müssen wir weitere State-Quellen untersuchen.

---

**User**

Ich sehe, das Problem entsteht auch, weil ich beim Erstellen einer neuen Library, wenn ich da auf neu klicke, dann werden, glaube ich, wird auch noch die alte Library gespeichert, die alte Library. Können wir nochmal den Weg der Erstellung einer neuen Bibliothek nachvollziehen und wie ist sichergestellt, dass wir nicht die alte Library überschreiben? Vielleicht sollte man eine neue Bibliothek erstellen, einen Dialog machen, einen Namen vergeben, und danach wird in diesem Dialog die Library gespeichert und starten wir explizit einen Library-Wechsel, um danach in den Konfigurationen weiterzugehen und keine Cache oder sonst irgendwelche Referenzen zum alten Library nur zu haben, oder wie schaut hier der Prozess aus? Können wir das analysieren?

---

**Cursor**

Ich analysiere den Erstellungsprozess einer neuen Bibliothek.

## Analyse: Erstellungsprozess einer neuen Bibliothek

### Aktueller Ablauf

**1. Klick auf "Neue Bibliothek erstellen" in `library-switcher.tsx` (Zeilen 37-45):**

```37:45:src/components/library/library-switcher.tsx
    if (value === "new-library") {
      // Setze den globalen Zustand, dass eine neue Bibliothek erstellt werden soll
      setCreateLibrary(true);
      
      // Navigiere zur Einstellungsseite
      router.push("/settings");
      return;
    }
```

**Problem:** Hier wird nur `createLibraryAtom = true` gesetzt und zur Settings-Seite navigiert. Es gibt keinen Cache-Reset, keine Library-Wechsel-Logik.

**2. In `library-form.tsx` - `handleCreateNew` (Zeilen 234-244):**

```234:244:src/components/settings/library-form.tsx
  const handleCreateNew = useCallback(() => {
    setIsNew(true);
    // Wichtig: activeLibraryId zurücksetzen, damit keine bestehende Bibliothek überschrieben wird
    setActiveLibraryId("");
    form.reset(defaultValues);
    // Defaults fuer neue Library (konservativ).
    setShadowTwinPrimaryStore('filesystem');
    setShadowTwinPersistToFilesystem(true);
    setShadowTwinCleanupFilesystemOnMigrate(false);
    setShadowTwinAllowFilesystemFallback(true);
  }, [form, defaultValues, setActiveLibraryId]);
```

**3. Race Condition in `library-form.tsx` (Zeilen 295-316):**

```295:316:src/components/settings/library-form.tsx
  useEffect(() => {
    if (activeLibrary && !isNew) {
      // ... Form wird mit aktiver Library befüllt
      form.reset({
        label: activeLibrary.label,
        path: activeLibrary.path,
        // ...
      });
    }
  }, [activeLibrary, isNew, form]);
```

**Problem:** Dieser useEffect kann **vor** `handleCreateNew` ausgeführt werden, da beide asynchron sind. Das Formular könnte so mit den alten Daten befüllt werden, bevor `isNew` auf `true` gesetzt wird.

### Identifizierte Probleme

| Problem | Beschreibung |
|---------|--------------|
| **Race Condition** | `activeLibrary` useEffect kann vor `handleCreateNew` feuern |
| **Kein Cache-Reset** | `folderCache`, `folderItems` etc. werden nicht geleert |
| **`activeLibraryId = ""`** | Setzt die ID auf leer, aber Library-Daten bleiben im Atom |
| **Abhängigkeit von `isNew` Flag** | Fragiler Zustand, der bei falscher Reihenfolge zu Überschreibungen führen könnte |

### Empfohlene Lösung: Expliziter Dialog

Dein Vorschlag ist sinnvoll. Ein Dialog-basierter Ansatz wäre robuster:

1. **Dialog öffnen** → Name eingeben
2. **"Erstellen" klicken** → Library sofort mit neuer UUID erstellen und speichern
3. **Nach erfolgreichem Speichern** → Expliziter Library-Wechsel zur neuen Library
4. **Weiterleitung** zu den Einstellungen

Soll ich diese Dialog-Lösung implementieren?

---

**User**

ja bitte und in dem Dialog eine checkbox "clone Library" anbieten, das eine kopie der aktuellen library erstellt.

---

**Cursor**

Ich implementiere einen Dialog für die Erstellung einer neuen Bibliothek mit Clone-Option.

Die Implementierung ist abgeschlossen. Hier ist eine Zusammenfassung:

## Neue Komponente: `CreateLibraryDialog`

**Datei:** `src/components/library/create-library-dialog.tsx`

### Features:
1. **Name-Eingabe** mit Validierung (min. 3 Zeichen)
2. **"Clone Library" Checkbox** - kopiert die Konfiguration der aktuellen Library
3. **Sauberer State-Reset** vor dem Library-Wechsel (verhindert Race Conditions)
4. **Navigation zu Settings** nach erfolgreicher Erstellung

### Ablauf beim Erstellen:

```
User klickt "Neue Bibliothek erstellen"
        ↓
Dialog öffnet sich
        ↓
Name eingeben + optional "Clone Library" aktivieren
        ↓
"Erstellen" klicken
        ↓
1. Neue UUID generieren
2. Library-Daten erstellen (leer oder geklont)
3. API-Anfrage zum Speichern
4. SYNCHRON: folderCache, folderItems, lastLoadedFolder zurücksetzen
5. activeLibraryId auf neue Library setzen
6. Dialog schließen
7. Navigation zu /settings
```

## Änderungen in `library-switcher.tsx`

- Klick auf "Neue Bibliothek erstellen" öffnet jetzt den Dialog anstatt direkt zu `/settings` zu navigieren
- `createLibraryAtom` wird nicht mehr verwendet (kann später entfernt werden)

## Testen

1. Auf den Library-Switcher klicken
2. "Neue Bibliothek erstellen" auswählen
3. Dialog erscheint mit Name-Feld und Clone-Checkbox
4. Namen eingeben und "Erstellen" klicken
5. Prüfen, dass die neue Library aktiv ist und keine alten Dateien angezeigt werden

---

**User**

diesen Neue Bibliothek erstellen, braucht es dann nicht mehr?

---

**Cursor**

Du hast recht. Da wir jetzt den Dialog im Library-Switcher haben, gibt es zwei Möglichkeiten für den Button in den Settings:

1. **Entfernen** - Der Button wird nicht mehr gebraucht, da man über den Library-Switcher neue Bibliotheken erstellt
2. **Umstellen auf Dialog** - Der Button öffnet auch den neuen Dialog (für Konsistenz)

Welche Option bevorzugst du? Ich würde empfehlen, den Button zu behalten aber auch den Dialog zu nutzen - so hat der Benutzer zwei Wege zur gleichen Funktion, was intuitiver ist.

Soll ich:
- **A)** Den Button komplett entfernen
- **B)** Den Button beibehalten und den CreateLibraryDialog auch dort einbinden

---

**User**

B

---

**Cursor**

Ich passe die `library-form.tsx` an, um den `CreateLibraryDialog` zu verwenden.

Die Änderung ist abgeschlossen. Jetzt verwendet auch der Button in den Settings den `CreateLibraryDialog`.

## Zusammenfassung der Änderungen

**In `library-form.tsx`:**

1. Import für `CreateLibraryDialog` hinzugefügt
2. State `isCreateDialogOpen` hinzugefügt
3. Button "Neue Bibliothek erstellen" öffnet jetzt den Dialog anstatt `handleCreateNew` aufzurufen
4. `CreateLibraryDialog` am Ende der Komponente eingefügt

## Ergebnis

Beide Wege führen jetzt zum gleichen Dialog:
- **Library-Switcher** → "Neue Bibliothek erstellen" → Dialog öffnet
- **Settings-Seite** → Button "Neue Bibliothek erstellen" → Dialog öffnet

Der Dialog:
- Fragt nach dem Namen
- Bietet die Clone-Option
- Führt einen sauberen State-Reset durch
- Erstellt die Library mit neuer UUID
- Wechselt zur neuen Library

---

**User**

Wenn wir eine Library klonen, müssen wir auch diese Templates mitnehmen, da ja auf sie in der config referenziert wird. Sonst ist das Datenmodell nicht konsistent.

---

**Cursor**

Du hast recht. Ich analysiere zuerst, wie Templates gespeichert und referenziert werden.

Die Analyse zeigt: Templates werden in MongoDB gespeichert mit der ID `${libraryId}:${name}`. Beim Klonen müssen wir die Templates kopieren.

Ich erweitere den `CreateLibraryDialog`, um beim Klonen auch die Templates zu kopieren.

Die Änderung ist implementiert. Jetzt werden beim Klonen einer Library auch alle Templates kopiert.

## Zusammenfassung der Änderung

**Neuer Ablauf beim Klonen:**

1. Library-Konfiguration kopieren (wie vorher)
2. Library in MongoDB speichern
3. **NEU:** Alle Templates der Quell-Library laden (`GET /api/templates?libraryId=...`)
4. **NEU:** Jedes Template für die neue Library erstellen (`POST /api/templates`)
5. State zurücksetzen und zur neuen Library wechseln

**Fehlerbehandlung:**
- Template-Kopierfehler sind nicht kritisch - die Library wird trotzdem erstellt
- Einzelne Templates die nicht kopiert werden können werden übersprungen
- Logging für Debugging

**Info-Text aktualisiert:**
> "Es werden kopiert: Speichertyp, Transkriptionsstrategie, Shadow-Twin-Konfiguration und alle Templates. Der Speicherpfad muss danach angepasst werden."

## Testen

1. Library mit Templates erstellen/haben
2. "Neue Bibliothek erstellen" wählen
3. "Clone Library" aktivieren
4. Nach Erstellung prüfen, ob die Templates in der neuen Library vorhanden sind (Settings → Secretary Service → Templates)

