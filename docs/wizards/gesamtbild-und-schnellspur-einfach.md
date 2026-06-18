# Gesamtbild, Standort & Schnellspur — einfach erklärt

Status: Übersicht (einfache Sprache, kein Code). Datum: 2026-06-18.
Bezug: `docs/roadmap-formatunabhaengige-library-und-onboarding.md`,
`docs/wizards/plan-praezisierung-inhalte-erfassen-kuratierte-wizards.md`,
`docs/wizards/umbauplan-generischer-erfassungs-wizard.md`,
`docs/adr/0003-...`, `docs/adr/0004-...`.

## Das Zielbild (einfach)

**Eine Maschine, mehrere Türen.** EIN Erfassungs-Assistent führt: erklären →
Inhalt geben → verarbeiten → prüfen → ablegen. Er funktioniert für **alle
Inhaltstypen** und schreibt **immer erst in den Wartekorb**. Owner/Co-Creator
geben sofort frei; Contributoren legen ab und warten auf Freigabe.

Drei saubere Bausteine statt heutiger Doppelungen:
- **Inhaltstyp** (was es ist + Aussehen + KI-Anweisung) — einmal definiert, geteilt.
- **Wizard-Ablauf** (die Schritte) — generisch, nicht pro Vorlage kopiert.
- **Pro Library einstellbar**, welche Wizards hinter „Inhalte erfassen" liegen.

## Wo wir heute stehen

- ✅ **Fundament** steht (Basisfelder, Wartekorb/Inbox, Abnahme, off-target-Pipeline,
  Einstieg-Button).
- ✅ **B2d** (Bilder beim Transkript-Import) fertig gebaut.
- 🟡 **Plan 1** (Library formatunabhängig: Prüf-Status, Experten-Ansicht, gemischte
  Galerie) — offen.
- 🟡 **Plan 2a** (Vorlagen entflechten, Doppelungen weg) — kleiner Baustein da,
  Hauptteil offen.
- 🟡 **Plan 2b** (der eine Assistent) — viele Teile da, aber der generische
  Wizard-Kern fehlt; heute noch ~15 Sonderfälle im Code.
- 📝 **Präzisierung** (kuratierte Wizards + Explorer-Einstieg für Contributoren +
  alle Entscheidungen) — dokumentiert & entschieden, noch nicht gebaut.

## Nächste Schritte (offizielle Reihenfolge)

1. **Plan 1 fertig** (sichtbar & billig zuerst: Experten-Ansicht + gemischte
   Galerie, dann Prüf-Status).
2. **Plan 2a**: Ablauf vom Inhaltstyp trennen → EIN Standard-Ablauf statt Kopien.
3. **Plan 2b**: den einen Assistenten bauen (U0 Sicherheitsnetz → Schritt-Engine
   → … → Promote), dann Kuratierung + Explorer-Contributor-Einstieg (W-A…W-F).

## Schnellspur — was wir weglassen könnten

Viel Komplexität, für den Kern nicht nötig → weglassen oder später:

- **Verzeichnis-/Ordner-Upload** (mehrere Quellen auf einmal, Ordner-Auswahl,
  Multi-Quellen-Korpus): weglassen/später. Erstmal **eine Datei / ein Text /
  eine URL**.
- **Zwei Verarbeitungs-Wege**: nur EINEN behalten (Pipeline off-target), den
  synchronen Textweg nicht doppelt pflegen.
- **Editoren — differenziert:** Den **Wizard-Editor** (Schritt-Texte bearbeiten)
  NICHT wegwerfen — die Fähigkeit gibt es heute schon (`CreationFlowEditor`); er
  wird mit der Flow-Trennung nur **entkoppelt** (eigener Editor). Was wirklich
  **später** kann: ein komfortabler **Schema-Editor** und fancy Authoring-UI.
- **Community-Sharing**: schon auf „später" entschieden.
- **Alle 8 Inhaltstypen perfekt**: erst die paar real genutzten.
- **Politur der gemischten Galerie (A4)**: auf das Nötigste.

## Der Kern, der bleibt (= das Zielbild)

> EIN Assistent · eine Datei/ein Text/eine URL rein · Wartekorb · Freigabe durch
> Owner/Co-Creator · pro Library kuratierbar · Contributor-Einstieg auch im
> Explorer (immer Wartekorb) · keine anonyme Erfassung.

## Wichtiger Hinweis zur Reihenfolge

Alles oben ist **Plan/Doku**. Umsetzung gehört laut Fahrplan **nach Plan 1** —
nicht jetzt parallel zur Entflechtung starten.
</content>
