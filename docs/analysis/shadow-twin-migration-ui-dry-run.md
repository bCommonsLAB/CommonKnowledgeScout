# UI‑Button: Shadow‑Twin Migration (Dry‑Run)

## Ausgangslage
Wir wollen den Dry‑Run der Migration aus dem Frontend testen. Das soll in der Library‑Config sichtbar sein, ohne die produktive Migration aus Versehen auszulösen. Der Dry‑Run ist ein Request‑Flag und gehört **nicht** in die Library‑Config.

## Ziele
- Dry‑Run mit minimalen Parametern starten (folderId, recursive, limit).
- Ergebnis/Report im UI sichtbar machen (Counts, Fehler).
- Optionaler echter Lauf bewusst getrennt (separate Aktion).

## Varianten
### Variante A: Button + Dialog in Library‑Form (empfohlen)
**Beschreibung:** In `LibraryForm` ein kleiner Block „Migration testen“, der einen Dialog mit `folderId`, `recursive`, `limit`, `cleanup` öffnet und den Dry‑Run ausführt.  
**Vorteile:** Schnell, keine neue Seite, klare Nähe zur Konfiguration.  
**Risiken:** UI‑Form wird größer; muss gut abgesichert werden (Default = dryRun).

### Variante B: Dedizierte Debug‑Seite
**Beschreibung:** Neue Seite unter `/library/:id/debug` mit Formular & Report.  
**Vorteile:** Sauber getrennt, skalierbar für weitere Debug‑Tools.  
**Risiken:** Mehr Routing/Access‑Logik, größerer Aufwand.

### Variante C: Dev‑Only Console Helper
**Beschreibung:** Nur in Dev ein kleiner Button, der vordefiniert `dryRun=true` triggert (ohne Dialog).  
**Vorteile:** Minimaler Code, schnell.  
**Risiken:** Keine Parametrisierung, wenig Feedback, schwer nachvollziehbar.

## Entscheidung
Wir wählen **Variante A**, weil sie schnell implementierbar ist, klare Parameter erlaubt und keine zusätzlichen Routen braucht.

## Offene Punkte
- `folderId` muss manuell kopiert werden (z. B. aus URL oder Storage‑UI).
- Report‑Darstellung: zuerst Roh‑JSON, später strukturierter.
