# Handover — Welle 4: Graph-Beziehungen + generisches SDG-Profil

> Übergabe-Dokument für die Offline-Fortsetzung. Self-contained: enthält Stand,
> Entscheidungen und eine Schritt-für-Schritt-Anleitung.
>
> Stand: Branch `claude/vibrant-mayer-wR4MG`, 8 Commits vor `master`, vollständig
> nach `origin` gepusht. Keine offene PR. Nichts Uncommittetes.

---

## 1. Was in dieser Session entschieden & gebaut wurde

### Thema 1 — Generisches SDG-Profil (UMGESETZT)
- 17 SDG-Unterstützungsgrade `sdg_1..sdg_17` (`0..1`) + EINE gemeinsame `sdg_begruendung`.
- Anzeige als „SDG-Rad" (SVG, 17 Speichen, offizielle SDG-Farben, von innen nach
  außen gefüllt) in der Detailansicht.
- **Generisch & flag-gesteuert**: Story-/Galerie-Flag `config.chat.gallery.showSdgProfile`
  (Settings: Story → Galerie → „SDG-Profil anzeigen"). Ist es aktiv und sind die Felder
  in `docMetaJson` vorhanden, erscheint das Rad in der Detailansicht JEDER Library
  (Einhängepunkt: `detail-overlay.tsx`).
- **Facetten: nur config-basiert** (kein Code). Felder sind als Metadaten ohnehin
  filterbar.
- **Klima-Template befüllt** als erste Daten-Instanz.

### Thema 2 — Skalierung der Beziehungen bei 10.000+ Maßnahmen (NUR EMPFEHLUNG)
- Dokumentiert in [`docs/architecture/massnahmen-beziehungen-skalierung.md`](../../architecture/massnahmen-beziehungen-skalierung.md).
- Kern: „Provides/Requires"-Profile (Max-Neef) → einmal klassifizieren (O(n)) statt
  paarweise vergleichen (O(n²)), Match per Matrix/Vektorsuche (O(n·k)).
- Kein Code — Kandidat für eine spätere Optimierungswelle (`relationsByProfile`).

## 2. Commits auf dem Branch (vor master)

| Commit | Inhalt |
| --- | --- |
| `b4786b8` | docs: Empfehlung skalierbare Beziehungen (10k+) |
| `de32023` | feat: generisches SDG-Profil mit Rad |
| `4694052` | feat(graph): Per-Zeile-Trigger für Beziehungen |
| `b00f066` | feat(graph): Quelle-A-Prompt (Perspektiven, Top-N) |
| `842e891` | feat(graph): Quelle A Rendering (Kanten, Recompute, Staleness) |
| `f1b56e6` | feat(graph): Quelle A Backend (Repo, Job, APIs) |
| (+ similarity-Commits aus vorheriger Arbeit) | Quelle C |

## 3. Wichtige Dateien (SDG-Feature)

- `src/types/library.ts` — Flag `config.chat.gallery.showSdgProfile`
- `src/components/settings/chat/gallery-config-section.tsx` + `hooks/use-chat-form.ts` — Settings-Switch unter Story → Galerie
- `src/components/library/gallery/detail-overlay.tsx` — generischer Einhängepunkt
- `src/components/library/gallery/sdg-wheel.tsx`, `sdg-profile.tsx` — Anzeige
- `src/lib/gallery/sdg-meta.ts` — 17 SDGs (Farben/Keys) + Extraktion aus docMetaJson
- `template-samples/klimamassnahme-detail1-de.md` — Template befüllt
- `src/lib/i18n/translations/{de,en,es,fr,it}.json` — SDG-Labels

---

## 4. SCHRITT-FÜR-SCHRITT: was du jetzt lokal tun musst

### Schritt 1 — Branch lokal holen
```bash
cd <dein-repo>
git fetch origin claude/vibrant-mayer-wR4MG
git checkout claude/vibrant-mayer-wR4MG
git pull origin claude/vibrant-mayer-wR4MG
```
> Es gibt nichts „einzuchecken" — alle Änderungen sind bereits committed & gepusht.
> Du *lädst* den Branch nur lokal herunter.

### Schritt 2 — Abhängigkeiten installieren
```bash
pnpm install --frozen-lockfile
```

### Schritt 3 — Pflicht-Check vor Merge
```bash
bash scripts/welle-pre-merge-check.sh
```
> Muss grün sein, bevor gemergt wird (AGENTS.md-Regel).

### Schritt 4 — Feature manuell verifizieren
1. App lokal starten (`pnpm dev`).
2. In einer Library die Settings öffnen → neues Flag **„SDG-Profil"** einschalten.
3. Eine Klimamaßnahme neu transformieren (damit `sdg_1..17` + `sdg_begruendung`
   in `docMetaJson` landen).
4. Detailansicht der Maßnahme öffnen → **SDG-Rad** muss erscheinen (Hover = Titel+Wert,
   darunter die Begründung). Flag aus → kein Rad.

### Schritt 5 — (optional) Facetten aktivieren, kein Code
In der Library-Config `config.chat.gallery.facets[]` ergänzen, z. B.:
```json
{ "metaKey": "sdg_7", "label": "SDG 7", "type": "number", "visible": true }
```
→ erscheint als Filter in der Galerie-Sidebar.

### Schritt 6 — Mergen
Es gibt **noch keine PR**. Zwei Wege:

**A) PR über GitHub (empfohlen, AGENTS.md: eine PR pro Welle)**
- PR von `claude/vibrant-mayer-wR4MG` → `master` öffnen.
- Pre-Merge-Check muss grün sein, CI abwarten, dann mergen.
- (Ich kann die PR auf Zuruf erstellen — ich öffne keine ungefragt.)

**B) Lokaler Merge (nur wenn ihr ohne PR arbeitet)**
```bash
git checkout master
git pull origin master
git merge --no-ff claude/vibrant-mayer-wR4MG
git push origin master
```

> Nach dem Merge ist die gesamte Welle 4 (Graph + SDG) in `master`.

---

## 5. Offen / spätere Wellen
- Numerische **Range-Slider-Facetten** (bewusst out of scope) — eigenes UI-Feature.
- **`relationsByProfile`** (O(n)-Beziehungen) — siehe Architektur-Doc, eigene Optimierungswelle.
- Re-Transformation bestehender Maßnahmen, um SDG-Werte zu erzeugen (Datenlauf, kein Code).
- Das alte `sdgs: string[]`-Badge-Feld blieb absichtlich unberührt.
