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

**Begriffskollision (teilentschärft 2026-06-11):** „WeSpace" bezeichnete im
Code auch die Gast-Rolle. Der sichtbare Gast-Hinweis nennt jetzt nur noch
„Gast" (Welle UX-2); interne Bezeichner (z.B. in `use-user-role`) sind noch
zu prüfen, wenn die Rolle das nächste Mal angefasst wird.

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
├── meSpace — Meine Bibliothek (F9: gegliedert wie die App-Navigation)
│   ├── Library           (Name, Status, Neu, Löschen)
│   ├── Archiv            (Erzählung „1 Speicherort → 2 Verarbeitung →
│   │                      3 Inhaltstyp": Storage-WIZARD, Template/Sprache/
│   │                      Cover, Inhaltstyp-ASSISTENT + Übersetzungen)
│   ├── Explore           (Galerie: Dichte, Gruppierung, Facetten, Graph)
│   ├── Story             (Eingabefeld-Texte, Ton/Stil, Antwortsprache)
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
| F9 | (Review 2026-06-11, Devil's Advocate aus Laiensicht) meSpace folgt der **App-Navigation** statt System-Domänen: Library, **Archiv** (= Speicherort + Verarbeitung + Inhaltstyp + Übersetzungen als EINE Erzählung mit Erklär-Intro), **Explore** (= Galerie/Facetten), **Story** (= Chat). Alte Routen leiten weiter. Begründung: Laien ordnen Einstellungen den Orten zu, die sie aus der App kennen — nicht den technischen Domänen |

### Entschiedene Fragen (User, 2026-06-11)

| # | Frage | Entscheidung |
|---|---|---|
| E1 | „Leser einladen" → weSpace oder usSpace? | **weSpace**: alle aktiv eingeladenen Personen; usSpace nur anonyme Öffentlichkeit + Anfragen Fremder |
| E2 | Galerie-Texte (Schema ohne UI) | **fertig bauen** in usSpace (Galerie liest die Werte bereits) |
| E4 | `transcription`, `templateDirectory`, `description` | **ersatzlos streichen**; `description` ggf. mit usSpace-Beschreibung zusammenlegen |
| E5 | `testimonial`/`blog` ViewTypes | **revidiert nach Code-Vertiefung**: NICHT als Library-Typ reaktivieren. Testimonials sind Ergänzung der Event-Detailansicht (`session`) — Fertigstellung als Produkt-TODO T1 (§8). `blog` bleibt Dokument-Typ im Schema |
| E6 | Experten-Zugang | Bereich **„Erweitert" pro Raum** (sichtbar, aber abgegrenzt — kein versteckter Modus) |
| E7 | Moderator-Zugang zu „Zugang & Anfragen" ohne Owner-Settings? | **ja** — rollen-sensitive Navigation statt Alles-oder-Nichts |

## 7. Umsetzungs-Wellen (Vorschlag)

| Welle | Inhalt | Risiko |
|---|---|---|
| 3-IV-UX-0 | Toter Code raus (A1–A5 + B1–B4 aus 04) — ERLEDIGT 2026-06-11 | keins |
| 3-IV-UX-1 | User-Review — ABGESCHLOSSEN 2026-06-11: F1–F8 festgelegt, E1–E7 entschieden | — |
| 3-IV-UX-2 | Neue Navigation (3 Räume), Raum-Übersicht mit Erklär-Karten, gruppierte Sidebar mit Erklärtexten, LibraryForm → `/settings/general` — ERLEDIGT 2026-06-11 (`ce08aed`) | klein |
| 3-IV-UX-3a | meSpace: Einsteiger/Erweitert-Trennung (F5/F8) — ERLEDIGT 2026-06-11 (`c3881b0`…`32dc786`): 7 Bereiche (Grundlagen, Speicherort, Inhaltstyp, Galerie, Chat, Verarbeitung, Erweitert); Muster „voller Hook, partielles Rendering" (kein Merge-Risiko). Abweichung: Cover-Prompt blieb bei Verarbeitung (Kontext-Kohäsion mit Cover-Toggle) | mittel |
| 3-IV-UX-3b | Speicherort-Wizard (F1, F3; löst D1/D2) — ERLEDIGT 2026-06-11 (`55bb150`): 4 Schritte, Verzeichnis-Picker (lokal: manuelle Eingabe als dokumentierte Abweichung), Pflicht-Test, Read-only-Summary | groß |
| 3-IV-UX-3c | Re-Auth-Flow app-weit (F2) — ERLEDIGT 2026-06-11 (`bcead07`): globaler StorageReauthDialog + onedrive-reauth-Lib; D7 teilgelöst (Token-Übernahme app-weit, Server-Check weiter offen) | mittel |
| 3-IV-UX-3d | Gefahren-UX-Paket (D3, D6) — ERLEDIGT 2026-06-11 (`5f0b2df`): ConfirmActionDialog ersetzt 4× window.confirm + Export-Bestätigung | klein |
| 3-IV-UX-3e | Inhaltstyp-Assistent (F6) — ERLEDIGT 2026-06-11: Typ-Karten, SDG nur bei Klima, DIVA-Hinweis, empfohlene Filter übernehmbar | mittel |
| 3-IV-UX-4 | weSpace: Einladungs-Vereinheitlichung + Personen-Übersicht | mittel |
| 3-IV-UX-5 | usSpace: Veröffentlichungs-Flow + Galerie-Texte (E2) | mittel |
| danach | Code-Refactor friert neue Struktur ein (ersetzt offene 3-IV-Splits) | — |

## 8. Festgehaltene Produkt-TODOs (außerhalb der Settings-UX)

| # | TODO | Stand |
|---|---|---|
| T1 | **Event + Testimonials fertigstellen** (User, 2026-06-11: „Event ist eine wichtige Detailansicht und Testimonials eine Ergänzung"). Testimonials in der Event-/Session-Detailansicht anzeigen; `TestimonialDetail` in Story-View/Galerie verdrahten — Code-TODOs in `story-view.tsx:133-147` („Für jetzt: Fallback auf SessionDetail/BookDetail") | Feature hat mal ansatzweise funktioniert. Bausteine vorhanden: `TestimonialDetail`-Komponente, `mapToTestimonialDetail`, `use-testimonials` + `/api/public/testimonials`, `dialograum-discovery`, `event-testimonial-discovery` |

Kontext zu T1: `testimonial`/`blog` bleiben aktive **Dokument-Typen**
(Creation-Wizard, Templates, Übersetzungs-Pipeline). Als **Library-weiter
Galerie-Typ** werden sie nicht angeboten — das Dropdown bleibt bei 6 Typen;
die Schema-Einträge bleiben für Abwärtskompatibilität und Dokument-Ebene.
