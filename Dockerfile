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

# Nur die notwendigen Dateien kopieren
COPY package.json pnpm-lock.yaml ./
# COPY .npmrc ./  # entfernt, da nicht vorhanden
RUN pnpm install --frozen-lockfile

# Restlichen Code kopieren
COPY . .

# Next.js Build
RUN pnpm build

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
RUN corepack enable && corepack prepare pnpm@8.15.5 --activate

# Nur die notwendigen Dateien kopieren
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules

# Public-Verzeichnis erstellen (falls nicht vorhanden)
RUN mkdir -p ./public

# Optional: falls du eine .env.production hast
# COPY .env.production .env

EXPOSE 3000

# Startbefehl
CMD ["pnpm", "start"] 