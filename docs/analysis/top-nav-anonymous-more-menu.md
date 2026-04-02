## Problem

Im anonymen Explore-Modus wird rechts ein Zahnrad angezeigt.
Dieses Symbol vermittelt "Einstellungen", obwohl an dieser Stelle für anonyme Nutzer keine eigentlichen Einstellungen verfügbar sind.

Zusätzlich ist das Symbol technisch relevant, weil der gemeldete DOM-Fehler auf den `DropdownMenu`-Trigger in der Top-Navigation zeigt.
Das beweist noch nicht die Ursache, macht den Bereich aber verdächtig.

## Beobachtung im aktuellen Code

`src/components/top-nav.tsx` rendert das `DropdownMenu` immer.
Für Gäste enthält dieses Menü im Wesentlichen nur sekundäre Navigation wie `Docs`.

Damit gibt es zwei Probleme:

1. Das Zahnrad ist semantisch irreführend.
2. Der anonyme Modus rendert unnötig ein interaktives Radix-Menü.

## Varianten

### Variante 1: Zahnrad für Gäste ausblenden, Docs direkt in die öffentliche Navigation legen

Vorteile:
- Klarste Semantik
- Weniger Interaktionselemente im anonymen Header
- Kleinste sinnvolle UX-Verbesserung

Nachteile:
- Öffentliche Navigation wird um einen Punkt breiter

### Variante 2: Menü behalten, aber Zahnrad durch "Mehr" oder Ellipsis ersetzen

Vorteile:
- Weniger irreführend als ein Zahnrad
- Struktur bleibt fast unverändert

Nachteile:
- Das zusätzliche Dropdown bleibt für Gäste bestehen
- Der problematische Bereich bleibt technisch aktiv

### Variante 3: Alles unverändert lassen

Vorteile:
- Keine UI-Änderung

Nachteile:
- Irreführende Bedeutung bleibt bestehen
- Kein Beitrag zur Entschärfung des gemeldeten DOM-Problems

## Entscheidung

Variante 1 ist aktuell die beste Minimaländerung.
Sie verbessert die Bedeutung der Navigation und reduziert gleichzeitig unnötige Dropdown-Interaktion im anonymen Modus.

Der separate `SecretaryRequestError` ist davon unabhängig.
Er deutet auf ein Erreichbarkeitsproblem des Secretary Services unter `http://127.0.0.1:5001/api` hin.
