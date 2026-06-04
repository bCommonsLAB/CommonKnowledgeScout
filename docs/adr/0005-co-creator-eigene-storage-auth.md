# ADR 0005 — Co-Creator: eigene Storage-Authentifizierung + Trennung Galerie/Erkunden vs. Archiv

- **Status**: Vorgeschlagen — **deponiert 2026-06-03**, noch nicht entschieden,
  Umsetzung ist ein eigener spaeterer Arbeitsschritt
- **Datum**: 2026-06-03
- **Entscheider**: Repo-Owner
- **Verwandt**: ADR-0004 (Storage-Verfuegbarkeit/Token-Handling),
  [`storage-abstraction.mdc`](../../.cursor/rules/storage-abstraction.mdc),
  `LibraryMember.localPathOverride` (per-Member-Storage-Pfad — bereits vorhanden,
  `src/types/library-members.ts`)

## Kontext / Beobachtung

Co-Creator leisten heute **zwei unterschiedliche Arten von Arbeit**, die auf
**verschiedene Stores** schreiben:

1. **Galerie / Erkunden** — kundenorientierte Ansicht; diverse Aufgaben (Sterne,
   Kommentare, Sammlungen/Kollektionen, Meta-Items …). Aenderungen gehen in
   **MongoDB-Collections** — **kein** direkter Storage-Provider-Zugriff noetig.
2. **Archiv** — braucht **direkten Zugriff auf den Storage-Provider**
   (Dateien/Ordner) und schreibt **dort** (OneDrive / Nextcloud / Filesystem).

**Heutiger Zustand:** Co-Creator greifen auf den Storage **mit den Zugangsdaten/
Tokens des Owners** zu — `getServerProvider(userEmail, libraryId)` loest den
Provider aus der **Owner**-Config auf. Die Authentifizierung des Owners wird
faktisch geteilt.

**Problem:** Geteilte Owner-Credentials sind **kein tragfaehiges
Sicherheitsmodell**. Ein Co-Creator mit Archiv-Zugriff soll sich **mit seiner
eigenen Authentifizierung** am Storage anmelden (eigenes OneDrive-/Nextcloud-
Konto), nicht mit der des Owners.

## Vorgeschlagene Richtung (noch nicht entschieden)

- **Zwei Co-Creator-Arbeitsbereiche unterscheiden:**
  - *Galerie/Erkunden* (MongoDB) — **kein** Storage-Login noetig.
  - *Archiv* (Storage) — erweitertes Recht **„Zugriff Archiv"**, das eine
    **eigene Storage-Authentifizierung** voraussetzt.
- **Per-Member-Storage-Auth:** Hat ein Co-Creator „Zugriff Archiv", hinterlegt er
  **eigene** Provider-Credentials/Token (pro Member, pro Library). Verallgemeinert
  das bestehende `localPathOverride` (heute nur Pfad fuer `local`) auf **Auth**
  fuer `onedrive`/`nextcloud`.
- **Invite-/Onboarding-Flow:** Bei Einladung **oder** Annahme wird ein Co-Creator
  mit „Zugriff Archiv" aufgefordert, seine Storage-Authentifizierung
  **einzugeben UND zu testen** (Verbindungstest, bevor der Zugriff aktiv wird).
  Ohne erfolgreichen Test → kein Archiv-Zugriff (**kein stiller Fallback** auf
  Owner-Credentials, vgl. `no-silent-fallbacks.mdc`).
- **Provider-Aufloesung server-seitig:** `getServerProvider` / `StorageFactory`
  muessen den Provider kuenftig **pro handelndem Member** aufloesen (Member-Auth),
  nicht pauschal aus der Owner-Config — sobald „Zugriff Archiv" + Member-Auth
  vorliegen.

## Offene Fragen

- Modellierung des Sub-Rechts: Feld am `LibraryMember`
  (`archiveAccess: boolean` + `storageAuth?`) vs. eigene Rolle?
  (Tendenz: Flag + per-Member-Auth, **keine** neue Rolle.)
- Sichere Ablage der Member-Tokens (OAuth-Refresh, Verschluesselung, Re-Auth bei
  Ablauf — vgl. ADR-0004 Token-Handling).
- Verhalten ohne Member-Auth: Archiv-Funktionen fuer diesen Co-Creator
  **gesperrt** (klare Meldung), Galerie/Erkunden bleiben nutzbar.
- Migration bestehender Co-Creator: bis Member-Auth hinterlegt + getestet ist,
  **kein** Archiv-Schreibzugriff.

## Bewusst NICHT in diesem Schritt

Nur **deponiert**. Umsetzung erfolgt als eigene Welle/PR, getrennt vom Wizard-/
Inbox-Strang (ADR-0003/0004) — keine Vermischung der Domaenen.

## Betroffene Stellen (Erst-Skizze, vor Umsetzung am Code pruefen)

- `src/lib/storage/server-provider.ts` (`getServerProvider`) + `StorageFactory`
  — Provider pro Member aufloesen.
- `src/types/library-members.ts` (`LibraryMember`) — Sub-Recht „Zugriff Archiv"
  + Member-Storage-Auth (Verallgemeinerung von `localPathOverride`).
- Invite-/Membership-Flow: `library-members-repo.ts`,
  `src/app/api/libraries/[id]/members/route.ts`, `members-list.tsx`,
  Invite-/Accept-Seiten (Storage-Auth eingeben + testen).
- `.cursor/rules/storage-abstraction.mdc` — Member-Kontext in der
  Storage-Aufloesung dokumentieren.

## Nachtrag 2026-06-03 — Storage-verwaltete Rechte + ID-/Sicht-Konsistenz (deponiert)

Wenn Owner und Co-Creator auf **denselben Verzeichnissen** arbeiten, jeder aber
mit **eigener Identitaet/Auth**, muss die Sicht **dauerhaft identisch** bleiben:
**File-/Ordner-IDs muessen ueber beide Identitaeten hinweg dieselben sein**. Das
System haengt an **stabilen IDs** (Shadow Twins, Vektor-Daten, Item-Properties an
einem stabilen `itemKey`/VCodex — siehe
[`mongodb-repository-pattern.md`](../architecture/mongodb-repository-pattern.md),
Abschnitt „Stabile Keys").

### Rechte-Modell (korrigiert): Rechte liegen im Storage, nicht in KnowledgeScout

- **Die Zugriffsrechte auf Verzeichnisse verwaltet der Storage-Provider** (z.B.
  Nextcloud-/OneDrive-Sharing), **nicht** KnowledgeScout/MongoDB. Lade ich jemanden
  als Co-Creator ein, muss das betreffende **Verzeichnis im Provider mit ihm
  geteilt** sein — KnowledgeScout vergibt keine Storage-Rechte, sondern **nutzt**
  die im Provider gesetzten.
- **Der Owner bestimmt das (geteilte) Root-Verzeichnis.** Der Co-Creator gibt
  **sein eigenes Root-Verzeichnis** an, weil die Pfad-/Verzeichnisstruktur aus
  seiner Sicht i.d.R. **abweicht** (geteilte Ordner liegen bei ihm unter einem
  anderen Pfad — analog dem heutigen `localPathOverride`).
- **Validierung beim Login/Connect:** Verbindet sich ein Member, prueft
  KnowledgeScout, dass er **nicht nur gueltige Provider-Credentials hat, sondern
  auch Zugriff auf genau dieses gemeinsame Root-Verzeichnis** — sonst kein
  Archiv-Zugriff (kein stiller Fallback).

### ID-/Datei-Konsistenz (offen — erst untersuchen)

- Kernfrage: Findet der Co-Creator im Storage **dieselben Dateien mit denselben
  IDs** wie der Owner? Bei **Filesystem/Netzlaufwerk** einfach verifizierbar — eine
  **Testdatei** ueber den gemeinsamen Pfad zeigt, ob beide dieselbe Datei sehen.
  Bei **OneDrive/Nextcloud ist offen**, ob geteilte Ressourcen konto-uebergreifend
  **identische IDs** liefern — das muessen wir **zuerst untersuchen**.
- Moegliche Massnahme (nach Untersuchung): **Paritaets-Check** (Testdatei/Probe
  beim Anmelden und/oder beim Oeffnen eines Verzeichnisses), der abweichende
  IDs/Rechte **sofort sichtbar** macht. Weichen Provider-IDs pro Konto ab →
  **stabiler Schluessel statt Provider-ID** (Pfad/VCodex) bzw. ID-Mapping in
  MongoDB.
