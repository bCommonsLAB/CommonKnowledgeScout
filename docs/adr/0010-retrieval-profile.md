# ADR 0010 — Retrieval-Profile: eine Library, mehrere Zugänge

- **Status**: Vorgeschlagen
- **Datum**: 2026-08-25
- **Kontext**: Erweitert [ADR 0007](0007-modularisierung-monorepo-schale-module.md).
  Getrieben von den Steckbriefen Umweltarchiv/Naturmuseum (§3), Klimamaßnahmen
  (§5) und Tapping into Abundance / MCS Ethiopia (§7/§8) in
  [`library-steckbriefe.md`](../architecture/library-steckbriefe.md).
- **Entscheider**: Repo-Owner

## Kontext

Mehrere Libraries brauchen ZWEI (oder mehr) grundverschiedene Zugänge zu
DENSELBEN Inhalten:

- Naturmuseum: stark vereinfachter Endanwender-Zugang UND ein
  Experten-Zugang — unterschiedlich im UI **und** im Retrieval-Flow.
- Klimamaßnahmen: anonym = Endkunden-Sicht (Top-20, schöne Startseite);
  angemeldet = Experte mit eigenen Beiträgen.
- Judith-Hafner-Libraries: Erfassung und Beauskunftung in Oromo/Amharisch —
  Mehrsprachigkeit betrifft Transkription, Retrieval und Story Mode gemeinsam.
- Naturmuseum zusätzlich: Bei Fragen mit Orts-/Gebietsbegriffen sollen
  Dokumente über einen DATENBANK-/Graph-Filter vorgefiltert werden, nicht
  (nur) semantisch.

Heute ist der Chat-/RAG-Weg pro Library fest (`api/chat/[libraryId]/*`),
und es gibt genau eine Explorer-Oberfläche pro Library.

## Entscheidung

### 1. Profil = UI-Variante + Retrieval-Strategie + Sprachverhalten

Ein **Profil** bündelt drei Dinge und wird **pro Library** konfiguriert
(Teil der Library-Config, nicht der SiteConfig — dieselbe Library soll auf
jeder Site dieselben Profile anbieten können):

```ts
profiles: {
  simple:  { ui: 'guided',  retrieval: 'default',      languages: [...] }
  expert?: { ui: 'expert',  retrieval: 'geo-prefilter', languages: [...] }
}
```

Die **Profil-Auswahl** geschieht pro Site/Nutzer: anonym ⇒ `simple`,
angemeldet/berechtigt ⇒ `expert` (Klimamaßnahmen wörtlich: „wenn man sich
anmeldet, wird man zum Experten"); alternativ explizit per URL/Umschalter
(Naturmuseum bietet beide parallel an).

### 2. Retrieval-Strategien sind pluggbar

`@ks/module-explorer` bekommt eine Strategie-Registry statt eines
hartcodierten RAG-Wegs. Eine Strategie bestimmt die Pipeline einer Frage,
z. B.:

- `default`: semantische Suche (heutiger Weg).
- `geo-prefilter` (Naturmuseum): Orts-/Gebietsbegriffe der Frage gegen das
  normalisierte Ortsverzeichnis auflösen ⇒ Kandidaten-Dokumente per
  Datenbank-/Graph-Filter VORfiltern ⇒ erst dann semantisch ranken.

Anknüpfung im Bestand: `api/chat/[libraryId]/config` (liefert das Profil an
den Client), `api/chat/[libraryId]/stream` (wählt die Strategie serverseitig).

### 3. Ingestion-Erweiterungspunkte pro Library

Profile funktionieren nur, wenn die Ingestion die nötigen Strukturen erzeugt.
Die bestehende Pipeline (`src/lib/pipeline/`, Phasen-Modell) erhält pro
Library konfigurierbare POST-PROZESS-Phasen statt Sondercode, z. B.:

- Ortsnamen-Normalisierung gegen das Ortsnamenverzeichnis der Provinz
  (Graph-Datenbank) — Naturmuseum.
- Autoren- und Jahrgangs-Normalisierung — Umweltarchiv-Erfahrung.
- Beziehungs-/Ähnlichkeitsgraph — bereits vorhanden
  (`src/lib/graph/`, `doc-relations/recompute`).

Die Graph-Datenbank-Wahl (dediziert vs. MongoDB-Graph-Modellierung) bleibt
ein eigenes, isoliertes Vorhaben des Naturmuseum-Projekts — dieses ADR legt
nur den Erweiterungspunkt fest, nicht die Technologie.

### 4. Mehrsprachigkeit ist Teil des Profils

`languages` im Profil steuert durchgängig: Transkriptionssprache bei der
Erfassung (Oromo/Amharisch — Secretary/Audio-Flow), Antwortsprache im Story
Mode, UI-Sprache. Sprachen sind damit Library-Fachkonfiguration, nicht nur
ein UI-Locale (`@ks/i18n` liefert die Mechanik, das Profil die Vorgabe).

## Konsequenzen

- Positiv: „Einfach vs. Experte" wird konfigurierbar statt als zweite
  Codebasis gebaut; der Geo-Retrieval-Sonderweg des Naturmuseums bekommt
  einen sauberen Platz; die Judith-Libraries werden ohne Sonderzweig
  mehrsprachig.
- Negativ/Aufwand: Strategie-Registry und Profil-Schema müssen in
  `@ks/contracts` spezifiziert werden; die Explorer-UI braucht zwei
  Darstellungsstufen (`guided`/`expert`); Pipeline-Phasen brauchen ein
  Konfigurations-Schema (Checkliste
  [`library-config-field.mdc`](../contracts/library-config-field.md)
  gilt).
- Umsetzung frühestens Welle M8; das Naturmuseum-Geo-Projekt läuft als
  eigenes Vorhaben auf diesem Fundament (siehe
  [`migrations-strategie.md`](../architecture/migrations-strategie.md)).
