# Handover: Library-Landingpage als `detailViewType: website`

> Übergabe an eine lokale Session zum Testen. Stand: 2026-06-23.
> Branch: `claude/relaxed-mendel-fhwj8r` (alle Änderungen committet + gepusht).
> Konzept (Single Source): `docs/analysis/landingpage-vereinfachung-webseite-detailviewtype.md`

> **UPDATE 2026-07-17 — dieser Handover ist ueberholt.** Ueber Phase 0–2 hinaus
> umgesetzt und nach `master` gemergt (PR #131). Wesentliche Aenderungen ggue.
> dem Stand unten:
> - **`siteEnabled`** schaltet die Website-Landingpage direkt am Slug
>   (`/explore/<slug>`) als **Default-Ansicht** (Live-Docs, Menue nach
>   `menu_order`). Die Galerie bleibt ueber Menue/`?view=gallery` erreichbar.
> - **Legacy `web/`-Snapshot-Publishing komplett entfernt**: Routen
>   `publish-site`/`depublish-site`, `AzureStorageService`-Snapshot-Methoden und
>   die Felder `sitePublished`/`siteUrl`/`siteVersion`/`sitePublishedAt`. Es
>   bleibt allein `siteEnabled`. Der Pilot unter `/explore/pilot` ist Wegwerf-Code.
> - **Variante B (host-basiert):** Root `/` rendert pro Domain via ENV
>   `PUBLIC_DOMAIN_LIBRARY_MAP` **shell-frei** die Landingpage der gemappten
>   Library; `knowledgescout.org` bleibt unveraendert (siehe `.env.example`).
> - **Galerie-Filter:** `website`-Docs sind in der oeffentlichen Slug-Galerie
>   ausgeblendet (`excludeDetailViewType`, serverseitig -> konsistente Zaehlung).
> - **Bilder** oeffentlicher Landingpages laden ueber direkte, anonym lesbare
>   Azure-Blob-URLs (nicht die auth-gegatete `web/`-Route).
>
> Verbindlicher Contract: `.cursor/rules/website-landingpage.mdc`.
> Alles darunter ist der historische Handover-Stand (2026-06-23).

## 1. Worum geht es

Veröffentlichte Libraries sollen wie eine Webseite mit Landingpage wirken. Statt
des alten, zu komplizierten `web/`-HTML-Snapshots (3 Speichersysteme, kein
Editor) wird eine Webseite wie **jedes andere Dokument** behandelt: ein
Markdown-Dokument mit flachem Frontmatter (Hero) + sektioniertem Body, gerendert
über einen neuen `detailViewType: website`.

## 2. Branch holen (lokal)

```bash
git fetch origin claude/relaxed-mendel-fhwj8r
git checkout claude/relaxed-mendel-fhwj8r
pnpm install --frozen-lockfile
```

Lokale `.env` / `.env.local` wie üblich (Clerk + MongoDB; für den Import zusätzlich
ein laufender **Secretary-Service**, siehe `.env.example`).

## 3. Was ist fertig (committet)

| Commit | Inhalt |
| ------ | ------ |
| Konzept (mehrere docs-Commits) | Recherche, Entscheidungen E1–E8, Roadmap Phase 0–4, Mehrsprachigkeit |
| `98b2b64` | **Phase 0** – hardcodierter Pilot-Renderer unter `/explore/pilot` |
| `4b64b91` | **Phase 1** – `website` als vollwertiger detailViewType registriert (Checkliste komplett) |
| `ff446da` | **Phase 2** – Website-Import-Template (`website-de`) für den Creation-Wizard |

**Entscheidungen (im Konzept §2):** E1 leichte Sektions-Konvention (HTML-Marker),
E2 Library-Config-Startseite, E3 gallery/story-Texte behalten, E4 `web/`-Snapshot
ersetzen, E5 Side-Banner nach `prioritaets_index`, E6 Menü via `menu_order`,
E7 eine Library = ganze Site (Root), E8 Quick-Wins zuerst.

## 4. Wichtige Dateien

**Renderer / Datenmodell (Phase 0/1):**
- `src/lib/website/parse-website-sections.ts` – Sektions-Parser (`<!-- section layout=… bg=… -->`)
- `src/lib/website/types.ts`
- `src/components/library/website/website-landing-blocks.tsx`, `…/website-landing-view.tsx` (Pilot)
- `src/components/library/website-detail.tsx` – produktiver Detail-Renderer
- `src/components/library/ingestion-website-detail.tsx` – MongoDB-Loader
- `src/app/explore/pilot/page.tsx` – Pilot-Seite (hardcodiert)
- `src/lib/detail-view-types/registry.ts` – `website`-Eintrag + `translatable`
- `src/lib/mappers/doc-meta-mappers.ts` – `mapToWebsiteDetail`
- `src/lib/media/safe-video-iframe.ts` – PeerTube whitelisted

**Import (Phase 2):**
- `src/lib/templates/builtin-creation-templates.ts` – Builtin `website-de`
- `src/lib/creation/wizard-flow.ts` – `website` als Preview-Typ

## 5. Lokal testen

### A) Pilot (UX + Ladezeit, kein Backend)
`pnpm dev` → http://localhost:3000/explore/pilot (öffentlich, kein Login).
Hero, Sektionen (Bild links/rechts + Farb-Hintergründe), PeerTube-Video,
Side-Banner, Menü. Ladezeit per Chrome DevTools → Lighthouse messen.

### B) Detail/Galerie (Phase 1)
Ein `website`-Dokument entsteht erst durch Import (C) oder indem du eine `.md`
mit `detailViewType: website` + Hero-Frontmatter + Sektions-Markern in eine
Library legst und ingestest. Es erscheint dann in Galerie/Detail als Webseite.

### C) Import-Wizard (Phase 2)
„Inhalt erfassen" → Template **„Webseite importieren"** wählen → URL einfügen →
Entwurf prüfen → Vorschau → speichern (Inbox) → publizieren. Setzt einen
laufenden Secretary-Service voraus (wie die bestehenden URL-/Session-Importe).

## 6. Verifiziert vs. offen

**Verifiziert (im Cloud-Agent):** `tsc --noEmit` (0 Fehler in `src/`),
`next lint` (keine neuen Warnungen), Unit-Tests grün (Parser, safe-video,
Registry/Template-Konsistenz, Builtin-Template). Empfohlen lokal vor Merge:
`bash scripts/welle-pre-merge-check.sh`.

**Noch NICHT verifiziert (braucht Laufzeit):**
- Echte Secretary-Extraktionsqualität (saubere Sektions-Marker + Hero-Felder).
  Renderer ist robust: Body ohne Marker = eine Default-Sektion; `editDraft`
  erlaubt manuelles Nachbessern.
- Round-Trip-Test §8b: bleiben die Sektions-Marker nach Übersetzung erhalten?
- Bild-Auto-Übernahme nach Azure beim Import (passiert beim Ingest).
- Pilot-Bilder laden über die auth-gegatete `web/`-Route der Quell-Library
  (`eec9f788…`); ggf. `IMG`-Konstante in `src/app/explore/pilot/page.tsx` auf
  direkte Azure-URLs umstellen.

## 7. Nächste Phasen (offen)

- **Phase 3** – Side-Banner + dynamisches Menü an Live-Daten (öffentliche
  Docs-API: `?sort=rating`, `?detailViewType=website`); Library-Config-Startseite
  (E2); Root `/` = Landingpage (E7).
- **Phase 4** – Übersetzungs-Round-Trip-Test (§8b); Performance (Cache-Header,
  `next/image`, ISR, später RSC); `web/`-Snapshot-Abkündigung (E4).

## 8. Start-Prompt für die lokale Session (kopierbar)

```
Kontext: Branch claude/relaxed-mendel-fhwj8r. Lies
docs/handoff-landingpage-website.md und
docs/analysis/landingpage-vereinfachung-webseite-detailviewtype.md.
Phase 0–2 sind fertig (Pilot, detailViewType website, Import-Template).
Ich teste jetzt lokal Phase 1+2. Hilf mir beim Gegentesten und dann mit Phase 3
(Side-Banner + dynamisches Menü an Live-Daten, Root/Homepage).
```
