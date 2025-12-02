# --- Build Stage ---
FROM node:20-alpine AS builder

WORKDIR /app

# Build-Args für Umgebungsvariablen definieren
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG CLERK_SECRET_KEY
ARG NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
ARG NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
ARG NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
ARG NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

# Umgebungsvariablen setzen (mit Dummy-Werten als Fallback für den Build)
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:-dummy_pk_test_placeholder}
ENV CLERK_SECRET_KEY=${CLERK_SECRET_KEY:-dummy_sk_test_placeholder}
ENV NEXT_PUBLIC_CLERK_SIGN_IN_URL=${NEXT_PUBLIC_CLERK_SIGN_IN_URL:-/sign-in}
ENV NEXT_PUBLIC_CLERK_SIGN_UP_URL=${NEXT_PUBLIC_CLERK_SIGN_UP_URL:-/sign-up}
ENV NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=${NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL:-/}
ENV NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=${NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL:-/}

# Build-Zeit Flag setzen
ENV NEXT_RUNTIME=build

# pnpm installieren
RUN corepack enable && corepack prepare pnpm@9.15.3 --activate

# Python und MkDocs für Dokumentations-Build installieren
# Verwende --break-system-packages, da wir in einem isolierten Docker-Container sind
RUN apk add --no-cache python3 py3-pip && \
    pip3 install --break-system-packages --no-cache-dir mkdocs-material mkdocs-print-site-plugin

# Nur die notwendigen Dateien kopieren
COPY package.json pnpm-lock.yaml ./
# COPY .npmrc ./  # entfernt, da nicht vorhanden
RUN pnpm install --frozen-lockfile

# Restlichen Code kopieren
COPY . .

# Dokumentation bauen (muss vor Next.js Build passieren, damit public/docs vorhanden ist)
RUN pnpm docs:build || echo "Warnung: Docs-Build fehlgeschlagen, fahre fort..."

# Verifiziere, dass die Markdown-Dateien vorhanden sind (vor Next.js Build)
RUN ls -la /app/public/docs/footer/ || echo "Warnung: Footer-Verzeichnis nicht gefunden"

# Next.js Build
RUN pnpm build

# Verifiziere erneut nach dem Build, dass die Dateien noch vorhanden sind
RUN ls -la /app/public/docs/footer/ || echo "Warnung: Footer-Verzeichnis nach Build nicht gefunden"

# --- Runtime Stage ---
FROM node:20-alpine AS runner

WORKDIR /app

# Runtime-Umgebungsvariablen
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG CLERK_SECRET_KEY
ARG NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
ARG NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
ARG NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
ARG NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

# Umgebungsvariablen setzen (zur Runtime die echten Werte verwenden)
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
ENV CLERK_SECRET_KEY=${CLERK_SECRET_KEY}
ENV NEXT_PUBLIC_CLERK_SIGN_IN_URL=${NEXT_PUBLIC_CLERK_SIGN_IN_URL}
ENV NEXT_PUBLIC_CLERK_SIGN_UP_URL=${NEXT_PUBLIC_CLERK_SIGN_UP_URL}
ENV NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=${NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL}
ENV NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=${NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL}

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_RUNTIME=runtime

# pnpm installieren
RUN corepack enable && corepack prepare pnpm@9.15.3 --activate

# Nur die notwendigen Dateien kopieren
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/.next ./.next
# Public-Ordner kopieren (inkl. Markdown-Dateien für Footer)
# Verwende --chown für korrekte Berechtigungen
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

# Verifiziere, dass die Markdown-Dateien vorhanden sind (nur für Debugging)
RUN ls -la /app/public/docs/footer/ || echo "Warnung: Footer-Verzeichnis nicht gefunden"

# Optional: falls du eine .env.production hast
# COPY .env.production .env

EXPOSE 3000

# Startbefehl
CMD ["pnpm", "start"] 