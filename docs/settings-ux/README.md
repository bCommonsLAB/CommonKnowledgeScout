# Settings-UX-Redesign — Konzept (meSpace / weSpace / usSpace)

Stand: 2026-06-11. Quelle: vollständige Code-Inventur aller Settings-Komponenten
(`src/components/settings/**`, `src/app/settings/**`) — Details in den
Inventur-Dateien dieses Verzeichnisses.

## 1. Auftrag und Vorgehen

Die heutigen Einstellungen sind historisch gewachsen und technisch geschnitten
(Storage, Transformation, Story = Backend-Domänen). Sie werden user-getrieben
neu gedacht: für **einfache Anwender ohne technisches Verständnis** und für
**Experten**. Veraltete Logik wird entfernt.

**Strategie-Entscheidung (analog Creation-Wizard, Plan Sektion 5 / Welle 3-VI):
UX-First, NICHT Refactor-First.** Erst die neue Struktur bauen, dann
refaktorisieren — der Refactor friert die saubere Struktur ein. Konsequenz:
Die offenen Future-Work-Splits aus Welle 3-IV (`public-form`,
`secretary-service-form`, `FacetDefsEditor`, `search-index-dialog`,
Shim-Ablösung) werden NICHT vorab umgesetzt; der UX-Umbau ersetzt sie.

Wellen-Naming nach [`refactor-naming-konvention.mdc`](../../.cursor/rules/refactor-naming-konvention.mdc):
**Welle 3-IV-UX** (Future-Work aus Mutter-Welle 3-IV).

## 2. Leitstruktur: die drei Räume

| Raum | Leitfrage des Users | Heutige Quellen |
|---|---|---|
| **meSpace** | „Wie baue ich meine eigene Library?" | Allgemeine Einstellungen, Storage, Transformation, Story (Chat/Galerie/Graph) |
| **weSpace** | „Wie teile ich sie mit vertrauten Personen?" | Mitglieder, Teile der Zugriffsanfragen (Einladungen) |
| **usSpace** | „Wie veröffentliche ich sie?" | Veröffentlichen, Startseite, Zugriffsanfragen (Gateway) |

Zweite Achse, orthogonal zu den Räumen: **Einsteiger vs. Experte**
(Progressive Disclosure). Jeder Raum zeigt zuerst nur Kern-Einstellungen;
Experten-Werkzeuge liegen in einem klar abgegrenzten Bereich „Erweitert".

**Leitnutzer (User-Review 2026-06-11):** Ein Laie will nur seine eigene
Library aufbauen, in der Regel aus PDF-Dokumenten oder Interviews. Alles
Technische (Index, Embeddings, LLM-Modelle, Cache, Azure) läuft mit
Standardwerten und ohne sichtbare Konfiguration.

**Begriffskollision (zu klären):** „WeSpace" bezeichnet im Code heute die
Gast-Rolle (`settings-client.tsx`: „Gast (WeSpace)"). Wenn weSpace/usSpace
Navigationsbegriffe werden, braucht die Gast-Rolle einen neuen Namen.

## 3. Personas und Rollen

| Persona | Rolle im Code | Sieht Settings? |
|---|---|---|
| Einsteiger-Owner (kein Technik-Wissen) | `owner` | ja — braucht geführte Kern-Pfade |
| Experten-Owner / Betreiber | `owner` | ja — braucht RAG/Index/Azure/Wartung |
| Co-Creator (arbeitet mit) | `co-creator` | nein (Banner in `layout.tsx`) |
| Moderator (verwaltet Zugang) | `moderator` | **Lücke:** soll Anfragen verwalten, hat aber heute keinen Settings-Zugang |
| Leser | `reader` (nur `accessRole`) | nein — heute nirgends als Person verwaltbar |
| Gast | „WeSpace" | nein |

## 4. Kern-Probleme des Ist-Zustands (Belege in 04-veraltet-defekte.md)

1. **Technischer Schnitt statt User-Ziele** — Tabs heißen Storage/Transformation/Story
2. **Experten-Felder ohne Schutz vor Einsteigern** — „Primary Store", Chunk-Overlap,
   rohe Enum-Werte (`mistral_ocr`) direkt im Hauptformular
3. **Scheinkontrollen** — Felder ohne jede Wirkung (transcription, templateDirectory,
   Google Drive komplett)
4. **Halbfertige Features** — Galerie-Texte (Schema ohne UI), totes Index-Status-Panel
5. **Gefährliche Aktionen ohne Schutz** — Storage-Typ-Wechsel, OneDrive-Abmelden,
   Dateisystem-Export ohne Bestätigung; 4× `window.confirm()` statt Dialog
6. **Doppelte Konzepte** — zwei Einladungs-Flows, targetLanguage doppelt geführt

## 5. Zielbild Navigation

```
Bibliothek verwalten
├── meSpace — Meine Bibliothek
│   ├── Grundlagen        (Name, Status, Neu, Löschen)
│   ├── Speicherort       (WIZARD: Provider → Anmelden → Verzeichnis wählen
│   │                      → Abschluss-Test; Design: 05-storage-wizard.md)
│   ├── Inhaltstyp        (ASSISTENT: Typ wählen → typabhängige Folgefragen,
│   │                      Detailansicht, SDG nur wo sinnvoll)
│   ├── Galerie           (wie man Stories findet: Dichte, Gruppierung,
│   │                      Standard-Filter; Facetten-Editor als Experten-Teil)
│   ├── Chat              (Eingabefeld-Texte, Ton/Stil, Antwortsprache)
│   ├── Verarbeitung      (Template → Zielsprache → Cover, redaktionell)
│   └── Erweitert         (LLM-Modelle, RAG, Index — automatisiert, Graph-
│                          Encoding, Azure/Thumbnails, Cache, DIVA, Auto-
│                          Klassifikation, Import/Export, Service-Verbindung)
├── weSpace — Gemeinsam arbeiten
│   └── Personen & Rollen (EIN Einladungs-Flow mit Rollenwahl
│                          reader/moderator/co-creator, Übersicht aller Personen)
└── usSpace — Veröffentlichen
    ├── Öffentlicher Auftritt (Name, Slug, Icon, Beschreibung, Homepage)
    ├── Startseite            (Draft testen, Publizieren/Depublizieren)
    └── Zugang & Anfragen     (Zugriffsschutz, eingehende Anfragen)
```

Inventur je Raum: [01-mespace.md](01-mespace.md), [02-wespace.md](02-wespace.md),
[03-usspace.md](03-usspace.md). Veraltete Logik: [04-veraltet-defekte.md](04-veraltet-defekte.md).
Speicherort-Wizard-Design: [05-storage-wizard.md](05-storage-wizard.md).

## 6. Entscheidungen

### Festlegungen (User-Review 2026-06-11)

| # | Festlegung |
|---|---|
| F1 | Speicherort wird **Wizard**: Provider wählen (Lokal/OneDrive/Nextcloud) → anmelden → Wurzelverzeichnis aus den vom Storage gelieferten Verzeichnissen wählen (kein Freitext) → Abschluss IMMER mit Verbindungstest. Design: [05-storage-wizard.md](05-storage-wizard.md) |
| F2 | Anmelde-Flow wird **extrahiert und app-weit wiederholbar**: läuft der Token ab (z.B. Archiv-Einstieg nach 2 Tagen Inaktivität), startet derselbe Anmelde-Flow erneut — ohne Settings-Besuch |
| F3 | Credentials (Tenant/Client/Secret, Nextcloud-App-Passwort) nach Einrichtung **read-only**; Änderung nur durch erneuten Wizard-Durchlauf |
| F4 | **Google Drive entfernen** (Attrappe ohne Backend) |
| F5 | Story-Tab aufteilen in eigene Bereiche: **Inhaltstyp & Detailansicht**, **Galerie** (wie man Stories findet, inkl. Facetten), **Chat** |
| F6 | Inhaltstyp als kleiner **Assistent**: Typ wählen → typabhängige Folgefragen (SDG-Profil nur für Klima-Inhalte u.ä.) |
| F7 | **Such-Index automatisieren** (Anlage/Rebuild ohne User-Aktion); Index-/Atlas-Dialoge nur noch Experten-Diagnose |
| F8 | Zusätzlich unter „Erweitert": LLM-Modell (Chat + Transformation), Embeddings/Chunking, Atlas-Index, Azure Blob/Thumbnails, Cache/Speicherstrategie, JSON-Import/Export, Service-Verbindungen, DIVA-Auswertung, Auto-Klassifikations-Schwelle |

### Offene Fragen

| # | Frage | Empfehlung |
|---|---|---|
| E1 | „Leser einladen" → weSpace oder usSpace? | weSpace: alle aktiv eingeladenen Personen; usSpace nur anonyme Öffentlichkeit + Anfragen Fremder |
| E2 | Galerie-Texte (Schema ohne UI): fertig bauen oder streichen? | fertig bauen in usSpace (Galerie liest die Werte bereits) |
| E4 | `transcription`, `templateDirectory`, `description`: ersatzlos streichen? | streichen; `description` ggf. mit usSpace-Beschreibung zusammenlegen |
| E5 | `testimonial`/`blog` ViewTypes: reaktivieren oder aus Schema entfernen? | aus Schema entfernen, Bestandsdaten migrieren |
| E6 | Experten-Zugang: Bereich „Erweitert" pro Raum oder globaler Experten-Toggle? | Bereich pro Raum (sichtbar, aber abgegrenzt — kein versteckter Modus) |
| E7 | Moderator-Zugang zu „Zugang & Anfragen" ohne Owner-Settings? | ja, rollen-sensitive Navigation statt Alles-oder-Nichts |

## 7. Umsetzungs-Wellen (Vorschlag)

| Welle | Inhalt | Risiko |
|---|---|---|
| 3-IV-UX-0 | Toter Code raus (Liste A in 04) — sofort möglich | keins |
| 3-IV-UX-1 | User-Review dieses Konzepts — F1–F8 festgelegt, offen E1/E2/E4–E7 | — |
| 3-IV-UX-2 | Neue Navigation (3 Räume + meSpace-Bereiche), bestehende Forms verschieben (keine Logik-Änderung) | klein |
| 3-IV-UX-3 | meSpace: Speicherort-Wizard + Re-Auth-Flow (F1–F3), Einsteiger/Erweitert-Trennung, Inhaltstyp-Assistent (F6), Gefahren-UX | mittel–groß |
| 3-IV-UX-4 | weSpace: Einladungs-Vereinheitlichung + Personen-Übersicht | mittel |
| 3-IV-UX-5 | usSpace: Veröffentlichungs-Flow + Galerie-Texte (E2) | mittel |
| danach | Code-Refactor friert neue Struktur ein (ersetzt offene 3-IV-Splits) | — |
