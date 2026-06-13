# ADR 0004 — Capture-Publish-Entkopplung: Inbox-/Submission-Modell für den Wizard

- **Status**: Vorgeschlagen (Kern-Entscheidungen vom Owner bestätigt 2026-05-31)
- **Datum**: 2026-05-31
- **Kontext**: Neuordnung Creation-Wizard (Welle 3-VI), siehe
  `docs/refactor/welle-3-vi-creation-wizard/00-refactor-plan.md` und
  `docs/analysis/wizard-template-schwachstellen-architektur-und-ux.md`
- **Entscheider**: Repo-Owner

## Kontext

Der Creation-Wizard soll **einfachen Anwendern** (Nicht-Owner, Nicht-Experten)
das Erfassen von Stories/Daten ermöglichen. Zwei strukturelle Probleme des
bestehenden Modells machen ihn instabil:

### Problem 1 — Rechte
Anwender, die einen Wizard bedienen, sind in der Regel **nicht** Owner der
Library. Das bestehende Rollenmodell (`src/types/library.ts:644`,
`owner | co-creator | moderator | reader`) kennt **keine Rolle „darf erfassen,
aber nicht publizieren"**. Ein Erfasser ohne Publish-Recht hat heute keinen
sauberen Pfad.

### Problem 2 — Storage ist nicht 100 % verfügbar
Alles ist Storage (Provider-Abstraktion). Manche Provider brauchen
Authentifizierung mit ablaufenden Tokens (OneDrive/SharePoint OAuth,
`src/lib/storage/onedrive/oauth-server.ts`). Der `StorageProvider` hat **kein**
`isAvailable()/health()` (`src/lib/storage/types.ts:100`). Der Wizard schreibt
heute **direkt** in den Ziel-Provider (`provider.uploadFile()`), und das
bestehende Staging (`.wizard-sources` in `wizard-artifact-promotion.ts`) liegt
**im Ziel-Provider** und nutzt `moveItem` auf demselben Provider — erbt also
dessen Verfügbarkeits-/Token-Problem. Ergebnis: Der Wizard stürzt ab, wenn der
Ziel-Storage offline ist oder der Token abgelaufen ist.

### Erfahrung aus dem Bestand
Die Instabilität kam **nicht nur** aus Logik-Wildwuchs, sondern **vor allem**
aus dem nicht sicher verfügbaren Storage. Anforderung: **Wenn wir einen Wizard
anbieten, muss er immer funktionieren.**

### Vorhandene Bausteine
- **Rollen**: 4-Tier-Modell (s.o.).
- **QR-Write-Key**: `testimonialWriteKey` („für QR Upload") erlaubt heute
  schon *kontolose* Beiträge — aber nur für Testimonials, nicht generalisiert.
- **Azure Blob**: `AzureStorageService` (`src/lib/services/azure-storage-service.ts`)
  speichert Bilder content-addressed (`libraryId/hash.ext`, mit Dedup); der
  Wizard nutzt das via `/api/creation/upload-image`.
- **Promotion-Keim**: `src/lib/creation/wizard-artifact-promotion.ts`.

## Entscheidung

**Erfassung und Publikation werden entkoppelt.** Eine einzige Mechanik — eine
durable **Inbox** aus internen, von uns kontrollierten Stores — löst Rechte
*und* Storage-Verfügbarkeit.

> **Invariante (Funktioniert-immer-Garantie)**: Der Wizard schreibt bei der
> Erfassung **niemals** in den Ziel-Provider. Seine einzige harte Abhängigkeit
> ist der interne Store. Jeder Provider-berührende Schritt ist in die
> **Promotion** verschoben.

```
ERFASSEN (immer)        INBOX (Submission)              PUBLIZIEREN (rechte-gated)
┌──────────┐  write    ┌────────────────────┐ promote  ┌──────────────────────────┐
│ Wizard   │─────────▶ │ MongoDB: Submission │────────▶ │ Ziel-Provider + RAG-Index │
│(Anwender)│ nie am Ziel│ Azure Blob: Binär   │ Job:     │ (evtl. offline/Token weg) │
└──────────┘           │ status/author/target│ idempot. └──────────────────────────┘
                       └────────────────────┘ retry/token-aware
```

### E1 — Staging-Ort: MongoDB + Azure Blob (off-target)
- **Submission-Dokument** in MongoDB (neue Collection, z.B. `wizard_submissions`):
  Status, Autor, `targetLibraryId`, Ziel-Ordner/Slug, gewählter Wizard +
  Schema, Markdown, Metadaten (Schema-Felder), Referenzen auf Binär-Blobs,
  Audit-Trail.
- **Binärquellen** (PDF, Audio, Bilder) in **Azure Blob** im Inbox-Bereich —
  content-addressed wie Bilder heute (`AzureStorageService`).
- **Constraint: KEINE Binärdateien in MongoDB.** MongoDB hält nur das
  Submission-Dokument + Blob-Referenzen (URL/Hash).
- Beide Stores sind **immer verfügbar** und unabhängig vom Ziel-Provider.

### E2 — Erfasser-Rechte: `contributor`-Rolle UND Write-Key/QR
- **Neue Rolle `contributor`** (zwischen `reader` und `co-creator`):
  eingeloggte Nutzer dürfen **erfassen + eigenen Preview sehen**, aber **nicht
  publizieren**. Erweiterung des Modells in `src/types/library.ts`.
- **Write-Key/QR generalisiert** (aus `testimonialWriteKey`): kontolose,
  externe Beiträge ohne Login, pro Ziel-Ressource ausgegeben.
- Beide Pfade erzeugen dieselbe **Submission** in der Inbox.

### E3 — Publikation = idempotenter, rechte-gateter Promotion-Job
- **Publish-Recht** = `owner` oder `co-creator`.
- Hat der Erfasser das Recht → er publiziert im selben Flow (**Co-Autor-Pfad**).
- Hat er es nicht → Submission bleibt `pending`; ein Berechtigter prüft die
  Inbox und publiziert.
- Die Promotion ist ein **idempotenter, wiederholbarer Job** (passt zur
  bestehenden Job-Infrastruktur; ADR-0001 beachten — eigene Domäne, keine
  Vermischung):
  - **Token abgelaufen** → Submission bleibt `ready`, Owner wird zum Re-Auth
    aufgefordert, danach Retry.
  - **Storage offline** → Backoff-Retry; nie ein halb-geschriebener Zustand.
  - **Erfolg** → Ziel-Provider geschrieben + RAG-Index aktualisiert + Status
    `published`.

### E4 — Preview unabhängig vom Publish-Status
Der Autor sieht **sofort** seinen Preview, gerendert **aus dem Staging**
(Renderer braucht nur Markdown + Metadaten, keinen Ziel-Storage). Gilt auch,
wenn die Submission noch in der Inbox liegt.

### Submission-Lebenszyklus
```
draft → pending → ready → publishing → published
                    │                      ▲
                    └── (kein Publish-Recht: wartet auf Reviewer)
            rejected ◀── (Reviewer lehnt ab)
```

## Bewertete Optionen (Staging-Ort)

| Option | Stabilität | Bewertung |
|---|---|---|
| **MongoDB + Azure Blob (off-target)** | hoch — vom Ziel unabhängig | ✅ **gewählt** |
| Interner Provider (off-target Filesystem/Azure) | hoch | nutzt Storage-Abstraktion, aber Binär-Handling weniger direkt |
| Ziel-Provider `.inbox` (wie heute `.wizard-sources`) | niedrig | ❌ erbt Verfügbarkeits-/Token-Problem, widerspricht Invariante |

## Konsequenzen

### Positiv
- **Wizard funktioniert immer** — Erfassung hat keine Provider-Abhängigkeit.
- **Rechte sauber** — Nicht-Owner/externe Erfasser haben einen klaren Pfad;
  Owner publizieren als Co-Autor sofort.
- **Kein Datenverlust** bei Storage-Ausfall/Token-Ablauf; Draft-Resume gratis.
- **Eine Mechanik** für zwei Probleme; behebt zugleich die in
  `wizard-speicherarchitektur-single-point-of-truth.md` beschriebene
  inkonsistente Direkt-Persistenz.

### Negativ / zu beachten
- **Neue Collection + Inbox-UI** im Archiv (Submissions prüfen/publizieren).
- **`contributor`-Rolle** zieht Anpassungen in Auth/Membership-Prüfungen nach
  (`library-service.ts`, Middleware).
- **Promotion-Job** muss Token-Refresh/Re-Auth-Aufforderung sauber abbilden
  (Owner-Benachrichtigung).
- **Interner Speicherbedarf** für Submissions/Blobs bis zur Promotion
  (Aufräum-Policy für `published`/`rejected` nötig).
- `wizard-artifact-promotion.ts` wird von „same-provider move" auf
  „interner Store → Ziel-Provider beim Publish" umgebaut.

## Verweise
- `docs/refactor/welle-3-vi-creation-wizard/00-refactor-plan.md`
- `docs/refactor/welle-3-vi-creation-wizard/phase-1-use-case-inventur.md`
- `docs/analysis/wizard-speicherarchitektur-single-point-of-truth.md`
- ADR-0001 (Job-Domänen getrennt halten)
- Künftiges ADR-0003 (Wizard/Schema-Trennung) — kombinierbar: die Submission
  referenziert Wizard + Schema getrennt.

## Nachtrag 2026-06-04 — Erfassungs-Einstieg nach Rechten (Zwei-Pfade-Modell)

**Kontext:** Beim lokalen Testen (Wartekorb gebaut) wurde klar, dass der
*Erfassungs-Einstieg* für Nutzer **ohne Archiv-Zugang** im Konzept fehlte. Die
ursprüngliche Konsequenz „Inbox-UI im Archiv" betraf nur die **Reviewer**-Seite
(Abnahme), nicht den Einstieg der Erfasser.

**Zwei Pfade nach Rechten (bestätigt vom Owner):**

| Wer | Pfad | Abnahme |
|---|---|---|
| **Archiv-Zugang** (owner / co-creator) | Upload → direkte/konventionelle Verarbeitung (Co-Autor-Pfad, E3) | nein — selbst berechtigt |
| **Kein** Archiv-Zugang (**contributor**) | **Wizard komplett in der Quarantäne** (= Inbox, nur MongoDB + Blob, off-target): Upload → Transkript → Transform → Story-Preview → Submit → **Wartekorb** | ja — Reviewer (co-creator/owner) |

**Einstiegspunkt (neue Entscheidung):** Der Erfassungs-Einstieg folgt der
bestehenden Trennung **Archiv = Storage** vs. **Galerie/Erkunden = MongoDB**
(vgl. ADR-0002/0005). Da die Quarantäne MongoDB-Welt ist, gehört der
contributor-Einstieg **in die Galerie/Erkunden-Ansicht**: ein rechte-gateter
Button **„Inhalte erfassen"** (sichtbar für contributor/co-creator/owner). Der
`+`-Einstieg im Archiv bleibt der Pfad für Archiv-Nutzer.

**Folge für W2 (Invariante schärfen):** Der Contributor-Wizard darf **keinen**
Provider berühren — PDF in den Blob-Inbox-Bereich, Transkript/Transform
**off-target**, Ergebnis als `pending`-Submission. (Heute schreibt der Wizard
direkt → für Archiv-lose Nutzer nicht tragfähig.)

**Offen / zu bestätigen:** Laufen Archiv-Nutzer durch *dieselbe* Mechanik (Inbox
+ sofortiges Auto-Publish = Co-Autor-Pfad) oder **umgehen** sie die Inbox ganz
(rein konventionell)? Betrifft nur den Archiv-Pfad, nicht den Contributor-Flow.

## Nachtrag 2026-06-04 (II) — Vereinte Architektur: dünner Blob-Inbox-Provider

**Entscheidung:** Die in dieser ADR zunächst verworfene Option „Interner Provider"
wird **gezielt für den Inbox-Bereich** wieder aufgenommen — als **dünner,
Blob-gestützter `StorageProvider`**, der NUR die Quarantäne bedient. So läuft die
**bestehende Pipeline (Upload/Wizard/Analyse/Asset) unverändert** über den Provider
(**kein Doppel-Code**), während Quarantäne-Grenze + Immer-verfügbar-Garantie
erhalten bleiben.

**Warum jetzt machbar (der Grund der Verwerfung 2026-05-31 entfällt hier):**
Inbox-Blobs sind **content-adressiert + unveränderlich bis zur Promotion** →
**kein move/rename** → der harte Flat-Store-Teil (Ordner-Hierarchie, stabile IDs,
Reparenting; Konflikt mit ADR-0005) wird **umgangen**. Der Provider braucht nur die
machbare Teilmenge (`uploadFile`, `getBinary`, `listItemsById`, `exists`,
`deleteItem`, virtuelle Ordner via Prefix). Blob hat **kein OAuth-Token-Problem**.

**Rollen-Trennung bleibt:** Wartekorb = **Governance** (Prüf-Gate, Spine dieser
ADR); Blob-Provider = **Transport** (wo die Bytes liegen). **W5** (Promotion Inbox
→ Owner-Provider + RAG) bleibt der einzige Schritt, der den Ziel-Provider schreibt.

**NICHT vollwertiger Library-Provider:** Der Blob-Provider wird NICHT als normaler
Library-Backend gebunden, durch den der Wizard bei der Erfassung schreibt — das
würde die Erfassung wieder an Storage-Verfügbarkeit koppeln und den Flat-Store-/
ID-Konflikt einführen. Er ist **auf die Inbox beschränkt**.

**Ein flacher Speicher für alles:** EIN Blob-Storage (des Owners) trägt die Inbox
**aller** Libraries + **aller** Contributoren, getrennt über Pfad-Prefix.
Vorschlag: `{libraryId}/inbox/{username}/{hash}.{ext}` (Aufteilung Username-Ordner
vs. reines Content-Addressing in Welle I finalisieren — Trade-off Dedup ↔ Übersicht).

**Owner-Sichten:**
- **Pro Library:** der bestehende **Wartekorb** (Dokumente EINER Library prüfen).
- **Archiv-Modus:** Owner sieht die Inbox einer Library als Speicher-Bereich —
  **nur lesen + löschen**, kein Verschieben/Umbenennen/Ändern (schützt die
  content-adressierte Verdrahtung).
- **Library-übergreifend:** eine **Briefansicht** über ALLE Libraries des Owners
  (Überblick über Contributor-Beiträge) — **ersetzt den Wartekorb nicht**.

**Wellen:** I dünner Inbox-Provider · II Stufe A (Upload über Provider) · III Stufe
B (Transcript/Transform im Wizard) · IV Owner-Sichten · V W5 Promote. Details:
`docs/wizards/abnahme-inbox-plan.md`.
