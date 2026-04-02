## Problem

Im Footer werden in der englischen UI aktuell sowohl `Imprint` als auch `Legal Notice` angezeigt.
Beide Links verweisen auf rechtlich nahe beieinanderliegende Inhalte und wirken in der Oberfläche doppelt.

Zusätzlich ist der primäre GitHub-CTA mit `Research & Test` unklar benannt.
Der Ziel-Link zeigt direkt auf das Repository.

## Varianten

### Variante 1: `Imprint` entfernen, `Legal Notice` behalten

Vorteile:
- Kleinste Änderung
- Passt zur bestehenden Transparenz-Verlinkung im Footer
- Reduziert Redundanz

Nachteile:
- `Impressum` ist nicht mehr als eigener Footer-Link sichtbar

### Variante 2: `Legal Notice` entfernen, `Imprint` behalten

Vorteile:
- Klassischer Begriff für den DACH-Kontext

Nachteile:
- Passt schlechter zur bestehenden englischen UI
- Widerspricht dem bereits genutzten Linkziel `rechtliche-hinweise`

### Variante 3: Beide behalten und nur Texte angleichen

Vorteile:
- Keine funktionale Reduktion

Nachteile:
- Das eigentliche UX-Problem bleibt bestehen

## Entscheidung

Variante 1 ist die klarste Minimaländerung.
`Legal Notice` bleibt bestehen, `Imprint` wird entfernt.
Der GitHub-CTA wird auf `View on GitHub` umbenannt, weil das Ziel damit präzise beschrieben ist.
