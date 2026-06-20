# Lokales Prüf-Handbuch — A4 + Plan 2 (W-A…W-G)

> **Offene Punkte / Hand-off für die nächste Session:**
> [`handoff-offene-punkte-2026-06.md`](handoff-offene-punkte-2026-06.md)
> (Befunde A/B/C, Bugs 2a/2b, Merge-Schritte).
>
> Stand 2026-06-19. Ziel: **mit kleinstmöglichem Aufwand das meiste prüfen**.
> Reihenfolge = Nutzen/Aufwand. Branch:
> `claude/library-verification-status-a1-cgg7qv`. Sprache einfach gehalten.
>
> Lege die meisten Befunde gleich als Häkchen ab. Wo etwas **bewusst offen** ist,
> steht es dabei — das musst du NICHT prüfen.

## 0) Vorbereitung (einmalig, ~3 Min)

```bash
git fetch origin claude/library-verification-status-a1-cgg7qv
git checkout claude/library-verification-status-a1-cgg7qv
pnpm install --frozen-lockfile
```

## 1) Automatisierte Prüfung — deckt das MEISTE ab (~2 Min, fast keine Handarbeit)

Die Engines (Facetten-Scope, Kuratierung, Flow-Entität, Betriebsart, Format-
Klassifizierer, Validierung) sind voll unit-getestet. **Das ist der größte
Hebel** — wenn das grün ist, ist der Großteil der Logik bestätigt.

```bash
pnpm test      # erwartet: alle grün (~2300+ Tests)
pnpm lint      # erwartet: 0 Fehler
```

- [ ] `pnpm test` grün
- [ ] `pnpm lint` ohne Fehler

> Wenn beides grün ist, brauchst du unten **nur noch die SICHTBAREN** Dinge zu
> prüfen (UI/Verdrahtung) — die kann der Cloud-Agent nicht sehen.

## 2) App starten

```bash
pnpm dev       # http://localhost:3000
```

Mit Owner-Account anmelden, eine Bibliothek mit Inhalten öffnen.

---

## 3) PFLICHT-Sichtprüfungen (die echten neuen Features)

### A) „Inhalte erfassen" → Übersicht → Standard-Wizard  (W-D + W-F)  ⭐ wichtig

1. Gehe in **Erkunden/Galerie** einer Bibliothek (als Owner oder Contributor).
2. Klicke **„Inhalte erfassen"**.
   - **Erwartung:** Du landest auf der **Übersicht** (`/library/create`), NICHT
     direkt in einem Wizard.
3. In der Übersicht muss die Karte **„Inhalt erfassen" (Standardvorlage)**
   erscheinen.
4. Karte anklicken → Wizard läuft: **Willkommen → Quelle → Inhaltstyp wählen →
   prüfen/ergänzen → speichern**. Ergebnis landet im **Wartekorb**.
   - [ ] Button öffnet die Übersicht
   - [ ] Standard-Karte vorhanden
   - [ ] Wizard läuft durch, Beitrag im Wartekorb
   - [ ] „Zurück" im Wizard führt zur Galerie (kam ja von dort)

### B) Wizard-Kuratierung in den Einstellungen  (W-C)  ⭐ wichtig

1. **Einstellungen → Bibliothek → Erweitert (Advanced)** → Abschnitt
   **„Inhalte erfassen"**.
2. Ein paar Wizards **aktivieren**, Reihenfolge mit ▲▼ ändern, einen als
   **Default** markieren → **Speichern**.
3. Seite neu laden, Einstellungen erneut öffnen.
   - **Erwartung:** Auswahl/Reihenfolge/Default sind **erhalten** (nicht weg).
4. Zurück zu **„Inhalte erfassen" → Übersicht**.
   - **Erwartung:** Es erscheinen **genau die aktivierten** Wizards, in deiner
     Reihenfolge; der Default zuerst.
   - [ ] Editor speichert + lädt korrekt (kein Verlust)
   - [ ] Übersicht zeigt die kuratierte Liste

### C) Galerie: Inhaltstyp als Leitfilter  (A4a)  ⭐ wichtig

> Nur in einer **gemischten** Bibliothek sichtbar (≥ 2 `detailViewType`, z. B.
> Buch + Session). In Einzeltyp-Bibliotheken absichtlich NICHT sichtbar.

1. Öffne die **Galerie** einer gemischten Bibliothek.
2. Oben in der Filterspalte (Desktop) bzw. im mobilen Filter-Fenster erscheint
   **„Inhaltstyp"** mit Knöpfen *Alle / <Typ A> / <Typ B>*.
3. Einen Typ wählen.
   - **Erwartung:** Die übrigen Filter **passen sich an** (typ-eigene erscheinen,
     fremde verschwinden); die Liste zeigt **nur** Dokumente dieses Typs.
4. **„Alle"** wählen.
   - **Erwartung:** nur **gemeinsame** Filter; alle Dokumente.
   - [ ] Leitfilter erscheint (nur gemischt)
   - [ ] Typ wählen → Filter passen sich an + Liste streng gefiltert
   - [ ] „Alle" → gemeinsame Filter + alle Dokumente
   - [ ] Mobil: Leitfilter ist auch im Filter-Fenster da

### D) Story-Verweise je Format  (A4c)

> Braucht eine Story (Buch-/Session-Detail) mit **gemischten Anhängen**
> (`attachments_url`: Bild, Audio, Video, PDF, Web-Link). Wenn du keine solche
> Test-Story hast, überspringen (oder eine anlegen).

1. Öffne eine Story mit gemischten Anhängen.
   - **Erwartung:** Bild → Vorschau, Audio/Video → Player, PDF/Datei → Knopf,
     Web → Link (statt früher nur „PDF vs. Link").
   - [ ] Anhänge je Format korrekt dargestellt (BookDetail)
   - [ ] Session-Detail-Anhänge ebenfalls (aufgelöste Anhänge je Format)

---

## 4) REGRESSION-Watch — darf sich NICHT verändert haben (schnell)

- [ ] **Einzeltyp-Bibliothek:** Galerie wie bisher, **kein** Inhaltstyp-Filter,
  Filterliste unverändert.
- [ ] **Übersicht „Inhalte erfassen" ohne Kuratierung:** zeigt wie bisher die
  vorhandenen Wizards — **plus** die neue Standard-Karte (das ist gewollt).
- [ ] **Bestehende Wizards** (z. B. Datei importieren/`file-transcript-de`)
  laufen weiter.
- [ ] **Vorlagen-Editor → Tab „Creation Flow"** funktioniert unverändert
  (Schritte bearbeiten, JSON-Import/Export). *(W-G hat hier nur interne
  Validierung herausgelöst — Verhalten gleich.)*
- [ ] **Diktat „Nur importieren und transkribieren":** Wortlaut beim Speichern
  sagt „Im Archiv speichern"/„Im Archiv gespeichert." (nicht „Veröffentlichen").
  *(W-E — reiner Aufräum-Refactor, Wortlaut 1:1 wie vorher.)*

## 5) E2E (optional, automatisiert) — A4

Für A4 liegen bereits Playwright-Specs im Repo (`e2e/`). Voraussetzung:
laufende App + Login-Session (siehe `e2e/00-auth.setup.ts`).

```bash
pnpm test:e2e        # bzw. gezielt die A4-Spec(s)
```

- [ ] A4-E2E grün (oder Befunde notieren)

---

## 6) Bewusst OFFEN (NICHT prüfen — kommt später / lokal)

- **W-A volle Wirkung:** Flow-Entität-Speicherung/Seed ist gebaut, aber der Seed
  wird noch nicht automatisch ausgelöst (Standard-Flow kommt aus dem Code). Kein
  sichtbarer Unterschied zu erwarten.
- **W-G volle Extraktion:** Der große `CreationFlowEditor` (~1345 Z.) ist noch im
  Vorlagen-Editor eingebettet; nur die Validierung wurde herausgelöst. Ein
  **eigenständiger** Wizard-Editor + eigene Route fehlen noch (lokaler
  Folgeschritt).
- **Mobiler A4c-Feinschliff** und tiefere Step-Engine-Integration von W-E sind
  als Folgeschritte vermerkt.

## 7) Befund melden

Wenn etwas abweicht: notiere **welcher Punkt (A–D / Regression)**, **was erwartet
vs. gesehen**, ggf. Konsolenfehler. Damit kann der nächste Schritt gezielt fixen.

### Schnell-Zusammenfassung (TL;DR)
1. `pnpm test` + `pnpm lint` (deckt die Logik).
2. „Inhalte erfassen" → Übersicht → Standard-Wizard läuft.
3. Einstellungen → „Inhalte erfassen" kuratieren → speichern → Übersicht prüfen.
4. Gemischte Galerie → Inhaltstyp-Leitfilter.
5. Regression-Watch (Einzeltyp/Vorlagen-Editor unverändert).
