# Erfassungs-Flow: drei Bauweisen im Vergleich

**Stand:** 2026-09-11, geprüft gegen `master` 6114f46 (v1.2.247).
**Frage des Owners (11.09.):** Alle 43 Screens der Screen-Landkarte sind
mobile-first. Ist die Erfassung besser innerhalb von KnowledgeScout gebaut,
oder als eigenständige App, bei der KnowledgeScout nur der Endpoint ist, oder
als eigenständige App, die React-Komponenten aus den KnowledgeScout-Paketen
bezieht? Die Station-für-Station-Belege stehen in
[`erfassungs-flow-wiederverwendung.md`](erfassungs-flow-wiederverwendung.md).

## 1. Die drei Bauweisen

| | **A · In KnowledgeScout** | **B · Eigenständige App, KnowledgeScout als Endpoint** | **C · Eigenständige App mit React-Paketen** |
|---|---|---|---|
| Was läuft wo | Erfassung als Modul-Paket `@ks/capture`, montiert in der bestehenden Next-App unter einer mobilen Route; ein Deployment | Zweite App (Web/PWA oder Capacitor/Expo) mit eigenem Stack und eigener Oberfläche; spricht nur HTTP mit KnowledgeScout | Zweite App auf React; importiert `@ks/ui`, `@ks/i18n`, `@ks/api-client`, `@ks/contracts` und ein neues `@ks/capture`; spricht dieselbe HTTP-API wie B |
| Auth-Pfad | Clerk-Session-Cookie, gleiche Origin; kontolos über Write-Key | Token im Header (Write-Key generalisiert oder Konto-Schlüssel) plus CORS auf allen Schreibrouten; oder Same-Origin per Reverse-Proxy | wie B |
| Verhältnis zu ADR 0008 | konform: „ein Deployment, viele Sites; `pwa` ist ein Flag auf `next-app`" (`docs/adr/0008-deployment-ziele.md:62-71`) | eigenes Compilat ohne andere Laufzeit — widerspricht ADR 0008 (`:47-60`), es sei denn, die App wird nativ (Capacitor) oder offline-first | wie B; die Paket-Wiederverwendung ist genau der von ADR 0008 vorgesehene Weg für den Fall „andere Laufzeit" |

Einsatz-Szenario P5 „mobile Feld-Erfassung" ist in
`docs/architecture/einsatz-szenarien.md:101-107` bereits als **Site auf der
Instanz, mobil, ggf. `pwa`** beschrieben — das ist Bauweise A.

## 2. Was der Code heute für jede Bauweise hergibt

### 2.1 Die Pakete sind für B und C brauchbar

Kein Paket unter `packages/` hängt an Clerk oder MongoDB (grep über
`packages/**`: null Treffer). Die einzige Next-Kopplung ist eine Datei:
`packages/i18n/src/react/locale-provider.tsx:13` (`useSearchParams`). `@ks/embed`
zeigt den Weg, sie loszuwerden: `next` extern (`packages/embed/tsup.config.ts:54`),
Bündel-Prüfung gegen `@ks/`- und `next/`-Reste (`scripts/pruefe-buendel.mjs:15-16`).

| Paket | Next-frei | in Standalone-App importierbar |
|---|---|---|
| `@ks/util`, `@ks/contracts`, `@ks/api-client`, `@ks/ui`, `@ks/viewers` | ja | ja |
| `@ks/i18n` (Root) | ja | ja; `/react` nur `useTranslation`/`useApplyLocale`/`LocaleGate` (`react/hooks.ts:10-13`) |
| `@ks/module-explorer/react` | ja | ja, spricht ausschließlich über `InstanceApi` (Unit-Test verbietet fremdes `fetch`, `packages/api-client/src/instance-api.ts:11-13`) |
| `@ks/embed` | ja | ja, aber nur Galerie und nur öffentliche Libraries |

`createInstanceApi({ baseUrl })` (`instance-api.ts:35-52`) ist der gebaute
Mechanismus für einen fremden Origin. Ein `@ks/capture`, das nur darüber
spricht, wäre in A, B und C dasselbe Paket.

### 2.2 Die API ist heute nur für A brauchbar

174 von 225 Route-Dateien importieren `@clerk/nextjs/server`; es gibt keine
Abstraktion darüber. Für die Erfassung relevant:

| Fähigkeit | Route | Auth heute | CORS heute |
|---|---|---|---|
| Beitrag anlegen / ändern | `POST`/`PATCH /api/submissions` | Clerk + Rolle (`route.ts:21`, `:111`) | nein |
| Audio-Job | `POST /api/secretary/process-audio(/job)` | Clerk | nein |
| Audio-Job anonym | `POST /api/public/secretary/process-audio` | `testimonialWriteKey` + `eventFileId` (`route.ts:90`) | nein |
| Live-Ticket | `POST /api/secretary/realtime-session` | Clerk (`route.ts:55`) | nein |
| Live-Ticket anonym | `POST /api/public/secretary/realtime-session` | Write-Key-Kette + Limit je Event (`route.ts:64-86`) | nein |
| Job-Fortschritt (SSE) | `GET /api/external/jobs/stream` | Clerk-Cookie, Identität = E-Mail (`route.ts:9-14`); aus der Public-Ausnahme ausgenommen (`middleware.ts:199-200`) | nein |
| Meine Beiträge | `GET /api/submissions?mine=true` | Clerk | nein |
| Stimme abgeben | `POST /api/library/[id]/source-user-states` | Clerk (`route.ts:53`) | nein |
| Themen lesen | `GET /api/chat/[id]/docs`, `/facets`, `/doc-meta` | anonym erlaubt | **ja** (`src/lib/embed/embed-cors.ts:35-38`) |
| Library per Slug | `GET /api/public/libraries/[slug]` | öffentlich | **ja** |
| Headless | `/api/mcp/[transport]` | Bearer Konto-Schlüssel, **ohne Scopes**, volle Personenrechte (ADR 0008 `:189-196`) | nein |

CORS ist auf genau vier Lesemuster begrenzt (`embed-cors.ts:28-49`), ein
Unit-Test hält Schreibrouten heraus (`:17-18`). `Allow-Credentials` ist bewusst
aus (`:10-13`), Cookies über Origins hinweg sind also keine Option.

**Folge:** B und C brauchen vor dem ersten Screen eine **Headless-Schreib-API**:
acht bis zehn Routen mit Token-Auth, CORS für Schreibrouten, ein tokenfähiger
Job-Stream, und ein Schlüsselmodell mit Bereichen (der Konto-Schlüssel hat keine).
Das ist derselbe Umbau für B und C, und er ist in A nicht nötig.

### 2.3 Mobil ist in allen drei Bauweisen Neuland

In der Next-App gibt es kein Manifest, keinen Service Worker, kein
`next-pwa` (`public/` enthält nur `docs, images, media, sdg-icons`), keinen
`viewport`-Export in `src/app/layout.tsx:53-56`, kein `safe-area` in `src/`
oder `packages/`, drei Treffer für Touch-Zielgrößen im ganzen Bestand. Die
Schale hängt an ClerkProvider, StorageContext, Jotai, AppLayout, Nuqs
(`layout.tsx:37-51`, 186 Z.). `electron/` umhüllt die gebaute Next-App, nicht
die Pakete (`electron/main.js:5`, `:304`, `:369`).

Für A heißt das: `pwa`-Flag ist bisher nur ein Wort in ADR 0008. Manifest,
Service Worker, Viewport, Safe-Area, Touch-Größen und eine schlanke Schale
für die Erfassungsroute (ohne Dateibaum, ohne Settings-Chrome) sind zu bauen.
Das sind rund **3 bis 5 PT**, die in B und C nicht wegfallen, sondern in der
zweiten App anfallen.

## 3. Der Vergleich

PT grob, ohne Puffer. „Plattform" = Summe aus der Wiederverwendungs-Analyse
(45–65 PT), „Pflicht SHF" = 31–48 PT.

| Kriterium | A · in KnowledgeScout | B · Endpoint | C · React-Pakete |
|---|---|---|---|
| Headless-Schreib-API (Token, CORS, SSE, Scopes) | nur Write-Key für den kontolosen Pfad: 2–3 | **8–12** | **8–12** |
| Erfassungs-UI (S4/S5, 5 Screens Composer + Prüfen) | 12–18 als `@ks/capture` | 12–18 im fremden Stack, plus alles, was `@ks/ui`/`@ks/i18n` sonst liefern: **+4–6** | 12–18 als `@ks/capture`, identisch mit A |
| Übrige Screens (S0–S3, S6–S11, ~38) | erweitern bestehender Sichten (Inbox, Meine Beiträge, Galerie): 20–30 | **alle neu**, keine Wiederverwendung: 35–50 | Inbox/Meine Beiträge/Galerie liegen heute in `src/app`, nicht in Paketen — für C erst paketieren: 25–40 |
| Mobil-Grundlage (PWA, Schale, Touch) | 3–5 | 3–5 (freie Wahl, ggf. Capacitor: +5) | 3–5 |
| Zweites Deployment, Domain, CI, Monitoring | 0 | 3–5 + laufender Betrieb | 3–5 + laufender Betrieb |
| Paket-Veröffentlichung | 0 (Workspace) | 0 | `pnpm pack`-Pipeline wie `@ks/embed` existiert; für fünf Pakete statt einem: 2–3 |
| **Grobe Summe bis SHF-Freeze (Pflicht)** | **31–48** | **60–90** | **50–75** |
| Passt in 17 Arbeitstage | mit Schnitt (siehe Wiederverwendungs-Analyse, Abschnitt 5) | nein | nein |
| ADR 0007/0008 | konform | Nachtrag nötig | Nachtrag nötig (Fall „andere Laufzeit" muss belegt sein) |
| Anmeldeweg SPID/CIE, falls entschieden | Clerk muss SAML/OIDC gegen SPID tragen — nicht geprüft, Risiko | eigene Auth in der App möglich, aber KnowledgeScout muss die fremde Identität dann per Token-Tausch anerkennen: derselbe Umbau wie die Headless-API | wie B |
| Offline-first, lange Aufnahmen (Dialogformate) | PWA + IndexedDB; Service-Worker-Kontrolle im Next-Build eingeschränkt | volle Kontrolle; nativ per Capacitor möglich | wie B |
| Trennung SHF-Spezifik | `@shf/deliberation` als Workspace-Paket | lebt in der App | lebt in der App oder als Paket |
| Release-Takt | gekoppelt an `ci-main` (Docker-Build, 3–5 USD pro Lauf) | eigener Takt | eigener Takt |
| Risiko Doppelentwicklung | keins | hoch: Typen, Validierung, Labels doppelt | mittel: Komponenten geteilt, Sichten nicht |
| Wer trägt die 43 Screens später | ein Repo, ein Team | zwei Repos | zwei Repos, gemeinsamer Paket-Vertrag |

## 4. Bewertung

**Der entscheidende Kostenblock ist nicht die Oberfläche, sondern die
API-Grenze.** In A nutzt die Erfassung Cookie-Auth auf derselben Origin und die
bestehenden Routen. In B und C ist jede Schreibroute, die die Erfassung
braucht, erst tokenfähig zu machen — und der einzige Token-Mechanismus im Repo
(Konto-Schlüssel) hat keine Bereiche und trägt Schreibrechte auf das ganze
Archiv (ADR 0008 `:193-196`). Ein Erfassungs-Token ohne Scopes wäre nicht
tragbar; ein Scope-Modell ist ein eigenes Vorhaben.

**Die Pakete sprechen für C, die Sichten sprechen gegen C.** Alles, was in
`packages/` liegt, ist Next-, Clerk- und Mongo-frei und liefe in einer zweiten
App. Aber Inbox, „Meine Beiträge", Einladung einlösen und Settings liegen in
`src/app` und `src/components`, nicht in Paketen. C müsste sie erst
herauslösen — das ist Modularisierung M6/M7, die im Vorrat steht.

**B kauft Freiheit mit Doppelarbeit.** Ein fremder Stack (Flutter, SwiftUI,
Vue) hätte Typen, Validierung, Frontmatter-Konventionen und Labels ein zweites
Mal. `@ks/contracts` und `@ks/api-client` sind TypeScript; außerhalb von
TypeScript bleibt nur die Wire-Form.

**Wo B oder C trotzdem gewinnen** — drei Bedingungen, jede einzeln ausreichend:

1. Der Anmeldeweg wird SPID/CIE und Clerk kann es nicht tragen. Dann braucht
   die Erfassung ohnehin eine eigene Identitätsquelle und den Token-Tausch.
2. Die Dialogformate verlangen Offline-First mit stundenlangen Aufnahmen und
   einer Store-App. Dann ist Capacitor die „andere Laufzeit" aus ADR 0008.
3. Das Land Südtirol verlangt für das SHF eine getrennte Auslieferung
   (eigene Domain, eigener Betrieb, eigene Release-Freigabe).

Keine der drei ist heute entschieden. Bedingung 1 ist genau Entscheidung 1 aus
dem Konzept (Abschnitt 8) und gehört auf den 16.09.

## 5. Empfehlung

**A jetzt, C-fähig gebaut.** Konkret:

- Die Erfassung entsteht als Paket `@ks/capture` im Workspace und spricht
  **ausschließlich über `InstanceApi`**, mit demselben Unit-Test wie der
  Explorer (kein fremdes `fetch`). Montiert wird sie in der Next-App unter
  einer mobilen Route mit eigener, schlanker Schale. Damit ist der Weg zu C
  offen, ohne ihn zu bezahlen.
- Der kontolose Pfad (Write-Key mit Kontingent und persistentem Rate-Limit)
  wird als **erste tokenfähige Schreibroute** gebaut — nicht als Sonderfall
  für Testimonials, sondern als Muster, dem später ein Bereichs-Schlüssel
  folgen kann. Das ist der billigste Schritt Richtung B.
- Die SHF-Bauteile kommen als `@shf/deliberation` in denselben Workspace,
  nach der Regel der Landkarte: `@ks/capture` weiß nichts vom
  Stakeholderforum, `@shf/deliberation` bringt keine eigene Erfassung mit.
- `pwa` wird vom Wort zum Bauteil: Manifest, Service Worker, Viewport,
  Safe-Area, Touch-Größen — 3 bis 5 PT, in jeder Bauweise fällig.

**Umschaltpunkt:** Fällt am 16.09. eine der drei Bedingungen aus Abschnitt 4,
wird die Headless-Schreib-API (8–12 PT) vorgezogen und ADR 0008 um den Fall
ergänzt. Das Paket `@ks/capture` bleibt in beiden Fällen dasselbe.

## 6. Was noch zu prüfen ist, bevor die Empfehlung trägt

- **Clerk gegen SPID/CIE**: ob Clerk eine SAML-2.0-Verbindung mit dem
  SPID-Profil trägt, ist nicht geprüft. Vor dem 16.09. klären, sonst ist
  Entscheidung 1 nicht entscheidbar.
- **Service Worker im Next-Build**: welcher Weg (`next-pwa`, Serwist, eigener
  Worker) mit `transpilePackages` und dem Docker-Build von `ci-main` verträglich
  ist — ein halber Tag Versuch.
- **Rate-Limit persistent**: die drei Limiter sind prozesslokal; bei mehr als
  einer Instanz brauchen Write-Key-Kontingente einen gemeinsamen Speicher
  (MongoDB reicht, Muster: NatureScout `login-code-service.ts:179-192`).

## Verweise

- [`erfassungs-flow-wiederverwendung.md`](erfassungs-flow-wiederverwendung.md) — Belege je Station
- `docs/adr/0007-modularisierung-monorepo-schale-module.md`, `docs/adr/0008-deployment-ziele.md` (mit Nachträgen Embed und Headless)
- `docs/architecture/einsatz-szenarien.md` (P2 Embed, P5 mobile Feld-Erfassung, P8 Headless)
- `docs/architecture/modul-landkarte.md` (`:183-185` Remote-Modus, `:301-303` offene Token-Frage)
- `packages/embed/` als Vorbild für Paket-Schnitt und Bündel-Prüfung
