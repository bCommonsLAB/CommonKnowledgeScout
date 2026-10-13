# Zugangsdaten verschluesselt ablegen (Encryption at rest)

> Gilt fuer die Speicher-Verbindungen am Konto (`storage_connections`, Plan
> `docs/plans/speicher-verbindungen-und-library-anlage.plan.md`, Teil A).
> Grundlage ist Commit `63a64bb9` (Juni 2026), dessen Cipher hier unveraendert
> uebernommen ist; der Library-Teil jenes Commits entfaellt, weil die
> Geheimnisse mit A2 die Library verlassen.

## Bausteine

- `src/lib/security/credential-cipher.ts`: AES-256-GCM, Schluessel aus
  `CREDENTIALS_ENCRYPTION_KEY` (32 Byte, Base64 oder Hex). Wert-Format
  `enc:v1:<base64(iv[12] | authTag[16] | ciphertext)>`, versioniert fuer
  spaetere Rotation. `encryptSecret` ist idempotent, `decryptSecret` prueft den
  Auth-Tag und laesst Klartext ohne Praefix mit Warnung durch (Migration A2).
- `src/lib/repositories/storage-connections-repo.ts`: der einzige Ort, der
  ver- und entschluesselt (`toStored`/`fromStored`). Aufrufer sehen Klartext,
  die Datenbank nie. Geheimnis-Felder: `nextcloud.appPassword`,
  `onedrive.clientSecret`, `onedrive.accessToken`, `onedrive.refreshToken`.
- `src/lib/storage-connections/connection-service.ts`: liefert dem Client nur
  `StorageConnectionSummary` („gesetzt/nicht gesetzt", Anmeldestatus); ein
  leeres Geheimnis beim Aendern heisst „beibehalten".

## Regeln

1. Fehlt der Schluessel, wirft der Cipher — kein stiller Rueckfall auf
   Klartext (`no-silent-fallbacks.md`).
2. Geheimnisse erscheinen nie in Logs, Antworten oder URLs; Fehlertexte nennen
   nur die Art des Fehlers.
3. Schluesselwechsel: neuer Schluessel ⇒ alte Tokens sind nicht mehr lesbar.
   Rotation braucht ein Umschluesselungs-Skript (lesen mit altem, schreiben mit
   neuem Schluessel); das ist noch nicht gebaut.

## Tests

`tests/unit/security/credential-cipher.test.ts` (Round-Trip, IV-Zufall,
Idempotenz, Tamper, fehlender/ungueltiger Schluessel) und
`tests/unit/repositories/storage-connections-repo.test.ts` (Geheimnisse
verschluesselt, Kennungen im Klartext, Lesen entschluesselt).
