# Docker Deployment Guide

## Problem
Der Docker Build schlägt fehl, weil Clerk-Umgebungsvariablen zur Build-Zeit benötigt werden, aber nicht verfügbar sind.

## Lösungsansätze

### 1. Docker Build mit Build-Args (Empfohlen)

```bash
# Build mit Umgebungsvariablen
docker build \
  --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_your_key" \
  --build-arg CLERK_SECRET_KEY="sk_test_your_secret" \
  -t knowledge-scout .
```

### 2. Docker Compose (Einfachste Lösung)

1. Erstelle eine `.env` Datei im Root-Verzeichnis:
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key
CLERK_SECRET_KEY=sk_test_your_secret
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
STORAGE_ROOT=/app/storage
```

2. Starte mit Docker Compose:
```bash
docker-compose up --build
```

### 3. Umgebungsvariablen aus Datei laden

```bash
# .env Datei laden und Build starten
set -a && source .env && set +a
docker build \
  --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" \
  --build-arg CLERK_SECRET_KEY="$CLERK_SECRET_KEY" \
  -t knowledge-scout .
```

## Benötigte Umgebungsvariablen

### Clerk Authentication (Pflicht)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Öffentlicher Clerk-Schlüssel
- `CLERK_SECRET_KEY` - Geheimer Clerk-Schlüssel

### Clerk URLs (Optional, haben Standardwerte)
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL` (Standard: `/sign-in`)
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL` (Standard: `/sign-up`)
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` (Standard: `/`)
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` (Standard: `/`)

### Storage (Optional)
- `STORAGE_ROOT` - Pfad für lokalen Storage

## Clerk-Keys erhalten

1. Gehe zu [Clerk Dashboard](https://dashboard.clerk.com/last-active?path=api-keys)
2. Kopiere den "Publishable Key" (beginnt mit `pk_test_` oder `pk_live_`)
3. Kopiere den "Secret Key" (beginnt mit `sk_test_` oder `sk_live_`)

## Produktions-Deployment

Für Produktion verwende `pk_live_` und `sk_live_` Keys:

```bash
docker build \
  --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_your_production_key" \
  --build-arg CLERK_SECRET_KEY="sk_live_your_production_secret" \
  -t knowledge-scout:production .
```

## Troubleshooting

### Build schlägt mit "Missing publishableKey" fehl
- Stelle sicher, dass `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` als Build-Arg übergeben wird
- Überprüfe, dass der Key mit `pk_test_` oder `pk_live_` beginnt

### Build schlägt mit "public directory not found" fehl
- Dieses Problem wurde behoben: Das public-Verzeichnis wird automatisch erstellt
- Falls du statische Assets hast, erstelle ein `public/` Verzeichnis im Root

### Container startet nicht
- Überprüfe die Logs: `docker logs <container-id>`
- Stelle sicher, dass alle benötigten Umgebungsvariablen gesetzt sind

### Port bereits in Verwendung
```bash
# Anderen Port verwenden
docker run -p 3001:3000 knowledge-scout
```

### Docker Compose Version-Warnung
- Die `version`-Angabe in docker-compose.yml ist nicht mehr nötig
- Diese Warnung kann ignoriert werden oder die Zeile entfernt werden 