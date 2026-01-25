# Shadow‑Twin Settings UI (Library‑Config)

## Ziel
Im Frontend sollen die neuen Shadow‑Twin‑Flags (`primaryStore`, `persistToFilesystem`, `cleanupFilesystemOnMigrate`, `allowFilesystemFallback`) direkt in der Library‑Config gesetzt werden koennen. Das erspart manuelle DB‑Edits und macht Tests reproduzierbar.

## Varianten
### Variante A: Einstellungen in `LibraryForm` (empfohlen)
**Beschreibung:** Neue Sektion im bestehenden Formular unterhalb des Shadow‑Twin‑Modus.  
**Vorteile:** Schnell implementiert, keine neue Route, konsistent zum restlichen Settings‑Flow.  
**Risiken:** Formular wird groesser, mehr State im Component.

### Variante B: Separate „Advanced Shadow‑Twin Settings“ Seite
**Beschreibung:** Neue Route (z. B. `/settings/shadow-twin`) nur fuer erweiterte Flags.  
**Vorteile:** Klar getrennt, weniger UI‑Rauschen im Standard‑Formular.  
**Risiken:** Mehr Routing/Permissions, hoehere Implementierungskosten.

### Variante C: Dev‑Only Toggle via Environment
**Beschreibung:** Flags nur via ENV/Config setzen, UI zeigt Read‑Only Werte.  
**Vorteile:** Wenig UI‑Aenderung, geringer Wartungsaufwand.  
**Risiken:** Unpraktisch fuer Tests, weniger transparent.

## Entscheidung
Variante A. Sie ist die schnellste und staerkt den Test‑Workflow direkt in der Library‑Config.

## Scope (Minimal)
- Dropdown fuer `primaryStore`.
- Switches fuer `persistToFilesystem`, `cleanupFilesystemOnMigrate`, `allowFilesystemFallback`.
- Persistierung in `Library.config.shadowTwin`.
