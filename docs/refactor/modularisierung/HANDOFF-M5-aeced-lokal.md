# Hand-off M5 — AECED-Embed lokal testen und die Library einrichten

> Stand 2026-09-11. Für eine lokale Sitzung, in der **CommonKnowledgeScout**
> und **commoning-methods** zusammen offen sind. Vorhaben 1 in
> [`docs/STAND.md`](../../STAND.md); Brief [`AGENT-BRIEF-M5.md`](AGENT-BRIEF-M5.md).
> Termin: **Dienstag, 15.09.2026, Arbeitstreffen mit AECED.**

## 1. Was fertig ist

Alle fünf Schritte von M5 liegen auf `master` und sind deployt (Version
1.2.246, `ci-main` grün zu #274; das Image enthält #272 bis #274, der rote
Lauf zu #273 war nur ein Registry-Fehler beim Hochladen).

| PR | Inhalt |
|---|---|
| #266 | Basis-URL: alle Requests des Pakets über `InstanceApi` |
| #268 | Adressierung im Speicher, `EmbedGalleryProviders` |
| #269 | Buch-Renderer im Paket |
| #271 | CORS auf den Lese-Routen der Instanz — **live auf knowledgescout.org** |
| #272 | Hülle `packages/embed`, `<KnowledgeScoutExplorer>` |
| #273 | Docker-Build: Bau-Konfigurationen der Pakete raus aus der App-Typprüfung |
| #274 | Nachweis in commoning-methods: React 19, Turbopack, Server-Rendern, Detailansicht im Rahmen, kein Story-Knopf |

Nachgewiesen am 10.09.: Die Galerie der Library `commoning` läuft eingebettet
in commoning-methods (Next 16.2, React 19.2, Tailwind 4, Turbopack) gegen
knowledgescout.org — alle Anfragen an die Instanz, Cover aus dem Blob, Stile
im Rahmen `.ks-embed`, Detailansicht im Rahmen, keine Server- und keine
Browserfehler.

## 2. Was in dieser Sitzung zu tun ist

1. **Library `aeced` in KnowledgeScout anlegen, füllen, veröffentlichen** —
   auf knowledgescout.org gibt es sie nicht (404, geprüft 10.09.). Ohne sie
   meldet das Embed bei AECED „unbekannte Library“.
2. **Galerie-Texte setzen**: Der Standardtext (`texts.book.description` in
   `@ks/i18n`) wirbt für den Story Mode, den es im Embed nicht gibt.
3. **In commoning-methods gegen `aeced` testen** (Prüfliste in §6).
4. **Datei-Paket erzeugen und für AECED bereitlegen** (§7).

Kein Code-Schritt ist offen. Was beim Testen auffällt, geht als eigene PR
mit Pre-Merge-Check und Eintrag in `STAND.md` unter „Neu dazugekommen“.

## 3. Sitzung aufsetzen

**CommonKnowledgeScout**, Haupt-Checkout `C:\Users\peter.aichner\projects\CommonKnowledgeScout`
(auf `master`, am 11.09. 36 Commits hinter `origin/master`):

```bash
git pull && pnpm install
```

`.env` liegt dort. `MONGODB_DATABASE_NAME` ist die Dev-DB,
`MONGODB_DATABASE_NAME_PROD` die Prod-DB `common-knowledge-scout-prod`.
Dev-Server: Vorschau `next-dev` (Port 3000). Wer 3001 nimmt, muss
`NEXT_PUBLIC_APP_URL` mit umstellen (sonst ECONNREFUSED im Worker).

**commoning-methods**, Worktree
`C:\Users\peter.aichner\projects\commoning-methods\.claude\worktrees\ks-embed-nachweis`,
Branch `ks-embed-nachweis` (Basis `main` 0fd8182, lokal, nicht gepusht).
`.env` ist kopiert, `npm ci` gelaufen. **Noch nicht committet:**

- `package.json` + `package-lock.json`: `"@ks/embed": "file:vendor/ks-embed-0.1.0.tgz"`
- `src/app/ks-embed-nachweis/page.tsx`: die Nachweis-Seite
- `vendor/ks-embed-0.1.0.tgz` (654 KB) — **nicht in `.gitignore`**; wer
  `git add .` macht, committet das Paket mit. Entscheiden: ignorieren oder
  bewusst mitnehmen.

Erster Schritt dort: WIP-Commit auf dem Branch, damit nichts verloren geht.
Offen ist, ob die Seite auf `main` von commoning-methods soll (dann PR im
Projekt) oder nur der Nachweis bleibt.

**Dev-Server von commoning-methods** (Port 3002): Eintrag in
`.claude/launch.json` des Projekts, das die Sitzung als Hauptordner hat. Der
Pfad ist maschinenspezifisch — **nicht committen** (die Datei ist versioniert):

```json
{
  "name": "commoning-ks-embed-nachweis",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["--prefix", "C:/Users/peter.aichner/projects/commoning-methods/.claude/worktrees/ks-embed-nachweis", "run", "dev", "--", "-p", "3002"],
  "port": 3002,
  "autoPort": false
}
```

Seite: `http://localhost:3002/ks-embed-nachweis`. Turbopack warnt wegen zwei
Lock-Dateien (Haupt-Checkout und Worktree) — harmlos; `turbopack.root` in
`next.config.ts` stellt es ab.

## 4. Zwei Wege zum Testen

| Weg | `baseUrl` | Library | Wofür |
|---|---|---|---|
| A · gegen Prod | `https://knowledgescout.org` | `commoning` (läuft), später `aeced` | der Zustand, den AECED bekommt |
| B · gegen die lokale Instanz | `http://localhost:3000` | Library in der Dev-DB | Einrichtung und Inhalte proben, bevor sie auf Prod gehen |

Weg B geht ohne Umbau: `createInstanceApi` erlaubt `http://`, und die
CORS-Middleware (`src/lib/embed/embed-cors.ts`) gilt lokal genauso (10.09. auf
Port 3001 mit fremdem `Origin` geprüft). Voraussetzung: die Library ist in der
Dev-DB öffentlich (§5) und hat Dokumente vom Typ `book`.

## 5. Library `aeced` in KnowledgeScout einrichten

**Wo**: Einstellungen → Veröffentlichung (`/settings/public`,
`src/components/settings/public/public-form.tsx`). Das Formular schreibt per
`PUT /api/libraries/[id]/public` nach `config.publicPublishing`
(`src/types/library.ts`). Auf Prod im Browser als Owner auf knowledgescout.org;
für Weg B lokal gegen die Dev-DB.

| Feld | Wert für AECED | Warum |
|---|---|---|
| `slugName` | `aeced` | so steht es im Brief und im Prop `library` |
| `publicName`, `description`, `icon` | frei | Teaser und Listen |
| `isPublic` | **true** | sonst 404 auf `/api/public/libraries/aeced` |
| `requiresAuth` | **false** | sonst lehnt das Embed die Library ab („nicht öffentlich“) |
| `showOnHomepage` | frei | nur die Liste auf knowledgescout.org |
| `backgroundImageUrl`, `logoUrl` | nur anonym ladbare URLs (Blob-Konvention) | Storage-Links sind auth-gegated |
| `gallery.headline`, `.subtitle`, `.description`, `.filterDescription` | eigene Texte, **ohne Story-Mode-Hinweis** | leer = Standardtext, und der wirbt für den Story Mode |
| `gallery.menuLabel` | frei | nur TopNav der Voll-App |

Regeln aus dem Skill `website-publishing`: kein Library-Inhalt ins Repo
(Texte, IDs, URLs gehören in MongoDB/Blob), Textentwürfe erst absegnen lassen,
MongoDB nur lesend, Schreiben über das Formular.

**Inhalte**: AECED-Inhalte sind `book` mit eigenen Frontmatter-Feldern (Owner
09.09., kein neuer `detailViewType`). Das Embed rendert `book`, `testimonial`
und `blog` mit der Buch-Ansicht; andere Typen zeigen „noch nicht verfügbar“.
Cover kommen aus dem Blob-Speicher (Audit 03, Befund 7).

**Prüfung, ob die Instanz bereit ist** (von überall, ohne Anmeldung):

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://knowledgescout.org/api/public/libraries/aeced
```

Erwartet `200`; im Body `requiresAuth: false`. Preflight:

```bash
curl -s -o /dev/null -D - -X OPTIONS -H "Origin: https://aeced.example" -H "Access-Control-Request-Method: GET" https://knowledgescout.org/api/public/libraries/aeced | grep -i "^HTTP/\|^access-control"
```

Erwartet `204` mit `Access-Control-Allow-Origin: *`.

## 6. Testen in commoning-methods

Paket aus dem aktuellen `master` neu bauen und einbauen (npm installiert eine
`file:`-Abhängigkeit gleicher Version nicht neu — vorher löschen):

```bash
pnpm --filter @ks/embed run pack:datei
```

```bash
cp packages/embed/ks-embed-0.1.0.tgz ../commoning-methods/.claude/worktrees/ks-embed-nachweis/vendor/ && cd ../commoning-methods/.claude/worktrees/ks-embed-nachweis && rm -rf node_modules/@ks/embed && npm install --no-audit --no-fund ./vendor/ks-embed-0.1.0.tgz
```

Dann in `src/app/ks-embed-nachweis/page.tsx` die Props umstellen
(`library="aeced"`, für Weg B `baseUrl="http://localhost:3000"`), Dev-Server
neu starten (Turbopack hält das alte Paket sonst im Cache).

Prüfliste — mit den Browser-Werkzeugen, nicht per Augenschein:

- Seite `200`, keine Fehler in Server-Log und Browser-Konsole
  (Hydrierungsfehler, „dynamic usage of require“, `Module not found`).
- Alle Anfragen gehen an die Instanz: `public/libraries/<slug>`,
  `chat/<id>/docs`, `chat/<id>/facets`, `doc-meta`, `doc-relations`, jede
  mit `Accept-Language` = `locale`.
- Cover laden (`img` mit `naturalWidth > 0`), Kartenzahl passt zur Library.
- Detailansicht öffnet **im Rahmen** (`.ks-embed` hat `contain: layout`;
  Panel-Rechteck innerhalb des Rahmens), Buch-Ansicht mit Kapiteln und PDF.
- **Kein** „In Story Mode ansehen“ — weder in der Galerie noch in der
  Detailansicht.
- `locale` wechseln (`de`, `en`, `it`): Oberfläche und Inhalte folgen.
- **Noch nie geprüft: Dark Mode der fremden Seite.** Das Embed-CSS erwartet
  `.dark .ks-embed`; commoning-methods schaltet per `prefers-color-scheme`
  (und `@custom-variant dark (&:is(.dark *))`). Mit `resize_window`
  `colorScheme: dark` prüfen — ohne `.dark`-Klasse am Vorfahren bleibt das
  Embed hell. Befund eintragen, ggf. Prop oder `prefers-color-scheme`-Zweig
  im `build-css.mjs`.
- **Noch nie geprüft: Mobil** (`resize_window` `mobile`): Filterleiste,
  Detailansicht als Vollbild im Rahmen.

## 7. Übergabe an AECED

- Das Paket: `packages/embed/ks-embed-0.1.0.tgz` (654 KB), Bau siehe §6.
- Einbau: [`packages/embed/README.md`](../../../packages/embed/README.md) —
  `npm install ./ks-embed-0.1.0.tgz`, einmal `import '@ks/embed/styles.css'`,
  dann `<KnowledgeScoutExplorer baseUrl="https://knowledgescout.org" library="aeced" view="gallery" locale="de" height="80vh" />`.
- Voraussetzungen bei AECED: React 18 oder 19, Next App Router (Client-
  Komponente, `"use client"` steht im Bündel), Webpack oder Turbopack.
- Nicht im Paket: Story, Chat, andere Ansichten als `gallery`, Anmeldung,
  andere Detailtypen als Buch. Bündelgröße 1,7 MB gemeinsames Stück
  (highlight.js mit allen Sprachen) — für den 15.09. tragbar, später kürzen.

## 8. Modularisierung — was steht, was offen ist (Kurzfassung)

Quelle bleibt `docs/STAND.md` (Vorrat, Erledigt) und
[`modul-landkarte.md` §5](../../architecture/modul-landkarte.md).

**Steht** (Phase A, M1–M4i, und M5): Workspace mit neun Paketen —
`@ks/util`, `@ks/contracts`, `@ks/api-client`, `@ks/i18n`, `@ks/ui`,
`@ks/viewers`, `@ks/shell` (Provider-Kette, Host→SiteConfig), `@ks/module-explorer`
(Zugangs-Gate, API-Namensraum, `ExplorerRoot`, die Galerie mit 110 Dateien),
`@ks/embed`. `/explore/[slug]` ist nur noch Montagepunkt. Die Galerie kennt
weder Next-Router noch Clerk; Betrachter, Bilder, Adressierung und Instanz
werden hereingereicht. Der AECED-Pilot (M5) ist gebaut und nachgewiesen.

**Offen im Vorhaben M5** (kein Code): Library `aeced` und Texte (§5),
Übergabe (§7), Dark Mode und Mobil im Embed (§6).

**Bewusst nicht im Embed**: Story und Chat (kommen in der App als Slots
herein, bleiben dort), Headless-API P8 (erst wenn AECED sie verlangt; nutzt
den MCP-Konto-Schlüssel, ADR 0008 — offene Kante: Schlüssel ohne Scopes).

**Geplant, im Vorrat** (Phase B): M6 „Oldies for Future“ als erster
SiteConfig-Eintrag der Multi-Site-Runtime (schlanker Client; dort auch die
Frage „Pakete pro `detailViewType`“ per Bundle-Messung neu prüfen); M7
`@ks/module-agent-view` mit MCP-Export und Electron-Hülle (local-first); M8
Föderation (ADR 0009) und Retrieval-Profile (ADR 0010); die `apps/`-Ebene.
Story-UI, Chat-UI und Website liegen weiter in der App (`src/`: 1.325
Dateien gegen 150 in `packages/`) und ziehen erst mit einem konkreten Ziel
(G3, Strangler-Prinzip).

## 9. Regeln, die hier gelten

- Eine PR je Schritt; vor jedem Merge `bash scripts/welle-pre-merge-check.sh`
  und **`EXIT=` in der letzten Log-Zeile** prüfen, nicht die Task-Meldung.
  Sieben „Export-Vertrag“-Testdateien reißen unter Vollast das 15-s-Limit —
  dann den ganzen Check wiederholen.
- Der Docker-Build installiert nur die Root-Abhängigkeiten; Wächter
  `tests/unit/packages/docker-abhaengigkeiten.test.ts`. Nach jedem Merge den
  `ci-main`-Lauf auf `master` ansehen (`gh run list --branch master`).
- Merges auf `master` macht der Owner in der Oberfläche (Regelsatz, Bypass).
- Kein Library-Inhalt ins Repo; MongoDB nur lesend.
- Kein nacktes `git stash`; WIP-Commit oder getaggter Stash mit `apply`.
- Neue Befunde mit Datum in `docs/STAND.md` unter „Neu dazugekommen“.

## 10. Start-Prompt für die Sitzung

> Weiter mit Vorhaben 1 (AECED), M5 nach dem Nachweis. Lies
> `docs/refactor/modularisierung/HANDOFF-M5-aeced-lokal.md` und
> `docs/STAND.md`. Beide Projekte sind offen: CommonKnowledgeScout
> (Haupt-Checkout, erst `git pull && pnpm install`) und commoning-methods
> (Worktree `ks-embed-nachweis`, dort zuerst die unversionierten Änderungen
> als WIP committen). Ziel: die Library `aeced` in KnowledgeScout einrichten
> (Hand-off §5, Texte vor dem Speichern zeigen), dann das Embed in
> commoning-methods gegen `aeced` mit der Prüfliste in §6 prüfen — auch Dark
> Mode und Mobil, die fehlen noch — und das Datei-Paket für AECED bereitlegen
> (§7). Befunde mit Datum in `docs/STAND.md`; Code-Änderungen als eigene PR
> mit `bash scripts/welle-pre-merge-check.sh` und `EXIT=` in der letzten
> Log-Zeile.
