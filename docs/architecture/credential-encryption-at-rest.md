# Storage-Zugangsdaten: Encryption-at-rest

Storage-Zugangsdaten (Nextcloud-App-Passwort, OneDrive-/GDrive-Client-Secret und
-Tokens, Secretary-API-Key, Azure-Connection-String, Public-Publishing-OpenAI-Key)
werden in der MongoDB-`libraries`-Collection **verschluesselt** gespeichert
(AES-256-GCM, authentifizierte Verschluesselung). Klartext existiert nur noch im
Arbeitsspeicher zur Laufzeit, nie auf der Platte.

## Bausteine

| Datei | Aufgabe |
|-------|---------|
| `src/lib/security/credential-cipher.ts` | Low-Level AES-256-GCM (`encryptSecret`/`decryptSecret`/`isEncryptedSecret`). Schluessel aus `CREDENTIALS_ENCRYPTION_KEY`. |
| `src/lib/security/library-credentials.ts` | Liste der geheimen Config-Pfade (`LIBRARY_SECRET_FIELDS`) + `encrypt/decryptLibrarySecrets`. |
| `src/lib/security/masked-secret.ts` | `isMaskedSecret` (Client-Maskierungs-Sentinels). |
| `src/lib/services/library-service.ts` | Wendet Ver-/Entschluesselung am Persistenz-Rand an. |
| `scripts/migrate-encrypt-credentials.ts` | Einmal-Migration bestehender Klartext-Werte. |

## Wert-Format

```
enc:v1:<base64( iv[12] | authTag[16] | ciphertext )>
```

Versioniert (`v1`) fuer spaetere Schluessel-/Algorithmus-Rotation. Werte ohne
diesen Praefix gelten als Legacy-Klartext.

## Persistenz-Rand (ein Ort)

- **Schreiben:** `LibraryService.updateUserLibraries()` verschluesselt alle
  Secret-Felder (idempotent) vor dem MongoDB-Write. Das ist der einzige
  Schreib-Pfad fuer Library-Configs.
- **Lesen:** Alle `LibraryService`-Getter (`getUserLibraries`, `getLibraryById`,
  `getPublicLibraryById/BySlug`, `getLibraryByPublishingSlug`,
  `getAllPublicLibraries`) entschluesseln direkt nach dem Fetch. Alle anderen
  Konsumenten (API-Routen, External Jobs, Chat, Storage-Factory) erhalten ihre
  Library ausschliesslich ueber diese Getter und sehen damit Klartext.

## Contract: no-silent-fallbacks

- Fehlt `CREDENTIALS_ENCRYPTION_KEY`, wirft das Ver-/Entschluesseln einen
  **expliziten Fehler** — es wird NIE still auf Klartext zurueckgefallen.
- Legacy-Klartext (ohne `enc:v1:`-Praefix) wird beim Lesen mit einer **sichtbaren
  Warnung** (ohne den Wert) durchgereicht, damit die App vor der Migration
  funktionsfaehig bleibt. Beim naechsten Speichern wird der Wert verschluesselt.
- Es werden **keine Secret-Werte** geloggt.

## Client-Schutz (unabhaengig von der Verschluesselung)

`LibraryService.toClientLibraries()` maskiert alle Secrets (`'********'` bzw.
`maskApiKey`), bevor eine Library an den Client geht; `preserveMaskedSecrets()`
verhindert, dass eine zurueckgesendete Maske den Bestand ueberschreibt. Die
Verschluesselung schuetzt zusaetzlich gegen Lesezugriff auf die Datenbank selbst.

## Rollout / Migration

1. 32-Byte-Schluessel generieren: `openssl rand -base64 32`.
2. Als `CREDENTIALS_ENCRYPTION_KEY` setzen (Base64 oder Hex) und Prozess neu starten.
3. Bestandsdaten migrieren:
   ```
   CREDENTIALS_ENCRYPTION_KEY=... pnpm tsx scripts/migrate-encrypt-credentials.ts --dry-run
   CREDENTIALS_ENCRYPTION_KEY=... pnpm tsx scripts/migrate-encrypt-credentials.ts
   ```
4. Schluessel **stabil** aufbewahren — ohne ihn sind verschluesselte Secrets
   unlesbar. Bei Kompromittierung des Schluessels: Storage-Zugangsdaten rotieren.

## Neues Secret-Feld hinzufuegen

Bei einem neuen geheimen Config-Feld BEIDE Stellen ergaenzen:

1. `LIBRARY_SECRET_FIELDS` in `src/lib/security/library-credentials.ts`
2. die Deny-List in `src/lib/library/config-export.ts`
3. die Maskierung in `LibraryService.toClientLibraries()`
