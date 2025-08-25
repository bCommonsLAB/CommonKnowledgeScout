## Analyse: Persistenz der Library-Auswahl beim Reload

### Befund
- Die aktive Library wird beim App-Start über den `StorageContext` initialisiert, der aus `localStorage.activeLibraryId` liest, sofern vorhanden und gültig.
- In `src/components/library/library-switcher.tsx` wurde die Auswahl zwar in den globalen State (`activeLibraryIdAtom`) geschrieben, aber nicht zuverlässig in `localStorage` persistiert.
- Ergebnis: Nach Reload fehlt der persistierte Wert → Fallback auf erste unterstützte Library in `StorageContext`.

### Relevante Stellen
- Initialisierung und Fallback-Logik: `src/contexts/storage-context.tsx` (liest `localStorage.activeLibraryId`, prüft Gültigkeit, setzt ggf. erste Library).
- Auswahl-UI: `src/components/library/library-switcher.tsx` (`handleLibraryChange`, setzt `activeLibraryIdAtom`).
- URL-Handler (optional): `src/app/library/page.tsx` (`LibraryUrlHandler`, schreibt `activeLibraryId` in URL→State und `localStorage`).

### Ursache
- Persistenz-Lücke: `LibrarySwitcher` speicherte die Auswahl nicht konsistent in `localStorage`.

### Entscheidung (Variante A)
- Persistenz direkt beim Wechsel: `localStorage.setItem('activeLibraryId', value)` in `handleLibraryChange` ergänzt (try/catch-guarded). Minimale Änderung, keine API/Migrations nötig.

### Alternativen
1) URL-basierte Persistenz (nuqs)
   - Pro: Deep-Linking, teilbar. 
   - Contra: Ohne Parameter beim Reload verliert man den Kontext.
2) Serverseitige Persistenz (User-Profil/DB)
   - Pro: Geräteübergreifend, robust.
   - Contra: Backend/Schema-Änderungen, Latenz.
3) Cookie-basierte Persistenz
   - Pro: SSR-freundlich, einfach.
   - Contra: Geringe Kapazität, Ablaufregeln.

### Tests
1) Library in UI wechseln, Seite neu laden → Auswahl bleibt identisch.
2) `localStorage.activeLibraryId` manuell entfernen → Fallback auf erste unterstützte Library.
3) Ungültige ID in `localStorage` schreiben → wird bereinigt, Fallback greift.

### Risiken/Follow-ups
- Multi-Tab-Kohärenz: Optional `storage`-Event behandeln.
- Geräteübergreifend: Perspektivisch Persistenz im User-Profil erwägen.


