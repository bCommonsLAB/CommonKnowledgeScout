 # Markdown-Suche: Scroll springt zurueck

## Kontext
Beim Ausloesen der Schnellsuche in der Markdown-Preview scrollt die Ansicht kurz zur Fundstelle und springt dann wieder zur vorherigen Position zurueck. Das Verhalten tritt sowohl im normalen als auch im Vollbild-Modus auf. Das deutet auf ein nachtraegliches Re-Rendering oder ein Scroll-Reset im Container hin.

## Beobachtungen
- Die Suche markiert den Treffer per DOM-Manipulation (replaceChild + span highlight).
- Der Scroll erfolgt ueber `containerRef.scrollTo(...)`, waehrend der Treffer im `contentRef` gesucht wird.
- Ein Popover/Tooltip fuer die Suche aktualisiert State und kann Re-Renderings ausloesen.

## Moegliche Ursachen
1. **Re-Rendering des Scroll-Containers**: Ein State-Wechsel (Popover, Tab, Fullscreen) re-rendered den Container und setzt `scrollTop` zurueck.
2. **Race Conditions im DOM**: DOM-Manipulation (replaceChild) und Scroll passieren zu frueh oder in falscher Reihenfolge.
3. **Scroll-Konflikt**: Ein zweiter Effekt oder Handler (z. B. Tab-Reset) setzt den Scroll unmittelbar nach dem Suchen wieder zurueck.

## Varianten zur Loesung
### Variante A: Stateful Isolation + Scroll-Persistenz
- Suche komplett in eine isolierte Komponente auslagern.
- Scroll-Position im Container vor/ nach der Suche explizit speichern und wiederherstellen.
- Vorteil: minimalinvasiv, geringe Aenderungen.
- Risiko: kaschiert tieferliegende Ursache.

### Variante B: Render-Stabilisierung des Markdown-Inhalts
- Markdown-Content in eine stabile Subkomponente auslagern und per `React.memo` + `useRef` rendern, sodass DOM nicht neu gesetzt wird.
- Highlighting ueber CSS (z. B. `mark`-Overlay) statt `replaceChild`.
- Vorteil: verhindert Re-Render-induziertes Neuladen.
- Risiko: groesserer Umbau im Preview-Rendering.

### Variante C: Suche als reines DOM-Overlay
- Keine DOM-Manipulation am Inhalt.
- Treffer via Range API markieren und scrollen, aber kein persistentes Aendern der Nodes.
- Vorteil: kein DOM-Reset, geringes Risiko fuer Bild-Reloads.
- Risiko: komplexeres Handling fuer Edge-Cases (mehrere Treffer, Entfernen der Markierung).

## Entscheidung
Variante A wird umgesetzt: Scroll-Position wird beim Suchen explizit stabilisiert und nach kurzer Verzoegerung erneut gesetzt, um spaete Reflows/State-Updates zu ueberbruecken. Das ist die minimalinvasive Aenderung und dient als pragmatischer Fix. Falls das Problem danach weiter besteht, folgt Variante B oder C.
