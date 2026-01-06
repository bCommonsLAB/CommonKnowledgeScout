# Analyse: Spalte `upsertedAt` in `/library/gallery` (Tabellenansicht)

## Ausgangslage

In der Tabellenansicht der Gallery werden aktuell u.a. **Titel**, **Jahr** und **Track** angezeigt.  
Das Feld **`upsertedAt`** existiert bereits in der Datenpipeline:

- `DocCardMeta` enthält `upsertedAt?: string`
- die API `/api/chat/[libraryId]/docs` sortiert bereits nach `upsertedAt` (absteigend)

Damit ist die Anforderung primär ein **UI-Thema**: Spalte hinzufügen und Datum robust formatieren.

## Problem/Frage

Wie zeigen wir `upsertedAt` so an, dass:

- es für Nutzer verständlich ist (Label + Datum/Uhrzeit),
- ungültige/fehlende Werte sauber behandelt werden,
- keine Code-Duplikation in mehreren Tabellen-Komponenten entsteht,
- Tests das Verhalten absichern.

## Lösungsvarianten

### Variante A (minimal): UI-only Spalte + Formatierungs-Utility

- Spalte `upsertedAt` in den Tabellen-Komponenten ergänzen.
- Kleine Utility `formatUpsertedAt()` (reine Funktion) für Darstellung.
- i18n-Key `gallery.table.upsertedAt` in allen Sprachen ergänzen.
- Unit-Test für `formatUpsertedAt()` (robust gegen invalid/missing).

**Vorteile**
- Minimaler Eingriff, geringe Risiken.
- Kein Backend-/DB-Change.
- Konsistente Darstellung in mehreren Tabellen.

**Nachteile**
- Sortierung bleibt wie bisher (aktuell ohnehin `upsertedAt`-basiert, aber UI zeigt weiterhin Jahr-Gruppen).

### Variante B: UI + API explizit erweitern/validieren

- API Response strikt typisieren/validieren (z.B. Zod Schema), sicherstellen `upsertedAt` immer string ist.
- Optional: explizite Projection/Mapping in Repo.

**Vorteile**
- Stärkere Typ-/Schema-Garantie.

**Nachteile**
- Mehr Code/Surface Area, potenziell größere Änderung ohne direkten Mehrwert (Feld ist bereits vorhanden).

### Variante C: UI-Feature: Sortier-/Filteroption nach `upsertedAt`

- Toggle/Dropdown „Sortierung: Neueste zuerst“ / „Jahr“.
- Ergänzend: Spalte `upsertedAt`.

**Vorteile**
- Mehr Produktwert (kontrollierbare Sicht).

**Nachteile**
- Mehr UI/State, höherer Testaufwand; nicht „minimal notwendig“ für die konkrete Anfrage.

## Entscheidung

Wir implementieren **Variante A**:  
Sie erfüllt die Anforderung mit minimalen Änderungen, nutzt vorhandene Daten und ist gut testbar.



