## Problem / Beobachtung
Ein Shadow‑Twin enthält die Datei `Commoning vs. Kommerz.de.md` (siehe Ordner `.Commoning vs. Kommerz.pdf`).
Trotzdem wird sie in bestimmten Flows (Preprocess/Template‑Only) als „nicht gefunden“ behandelt.

## Ursache (Root Cause)
Die Suche nach dem Markdown verwendet an einer Stelle `generateShadowTwinName(baseName, lang, ...)`.

`baseName` wird aus dem PDF‑Namen ohne Extension gebildet, enthält aber weiterhin Punkte im Dateinamen
(z.B. `Commoning vs. Kommerz` enthält den Punkt aus `vs.`).

`generateShadowTwinName()` nutzt intern `path.parse(originalName)` und trennt am **letzten Punkt**.
Bei `originalName = "Commoning vs. Kommerz"` interpretiert Node das als:
- name: `"Commoning vs"`
- ext: `". Kommerz"`

Damit wird fälschlicherweise nach `Commoning vs.de.md` gesucht statt nach `Commoning vs. Kommerz.de.md`.

Warum trat es trotzdem manchmal „zufällig“ nicht auf?
Einige Pfade haben Fallback‑Logik, die alle Markdown‑Dateien im Shadow‑Twin‑Ordner durchsucht und per
Frontmatter klassifiziert. Das kann den Bug kaschieren, ist aber langsam und nicht überall aktiv.

## Ziel
Shadow‑Twin‑Markdown muss zuverlässig gefunden werden, auch wenn der Basisname Punkte enthält.

## Varianten (3 Optionen)
### Variante A (empfohlen): Suche baut Namen direkt aus baseName
In der Suchfunktion (`findShadowTwinMarkdown`) **nicht** `path.parse()` verwenden,
sondern:
- transformiert: `${baseName}.${lang}.md`
- transcript: `${baseName}.md`

**Pro:** Minimaler Fix, exakt an der Fehlerstelle, ohne Semantikänderung für andere Call Sites.  
**Contra:** Doppelte Logik (neben `generateShadowTwinName`).

### Variante B: `generateShadowTwinName` erweitert um „baseName‑Modus“
Neue Signatur/Option: `generateShadowTwinName({ baseName, ... })` oder Erkennung ohne `path.parse`.

**Pro:** Eine zentrale Funktion.  
**Contra:** Riskanter (breitere Auswirkung), mehr Refactoring.

### Variante C: Alle Call Sites übergeben immer den Original‑Dateinamen inkl. Extension
Also nie `baseName` übergeben, sondern immer `originalName` (`*.pdf`) und `generateShadowTwinName` nutzt `path.parse`.

**Pro:** Kein Duplikat.  
**Contra:** In vielen Call Sites liegt nur `baseName` vor; Umbau wäre größer.

## Entscheidung
Variante A: `findShadowTwinMarkdown` behandelt `baseName` als „already base name“ und baut die erwarteten
Dateinamen direkt. Zusätzlich Unit‑Test mit einem BaseName, der einen Punkt enthält.

## Testplan
- Unit: `findShadowTwinMarkdown(folderId, "Commoning vs. Kommerz", "de", ...)` findet `Commoning vs. Kommerz.de.md`.
- Smoke: Template‑Only Job für `Commoning vs. Kommerz.pdf` läuft ohne „Shadow‑Twin nicht gefunden“.


