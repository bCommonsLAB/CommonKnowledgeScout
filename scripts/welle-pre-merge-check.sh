#!/usr/bin/env bash
# scripts/welle-pre-merge-check.sh
#
# Lokales Pre-Merge-Check fuer Refactoring-Wellen.
#
# Faehrt die Verifikations-Schritte, die sonst der Cloud-Agent
# ausfuehren wuerde — lokal kostenlos, im Cloud-Agent ~3-5 USD pro Lauf.
#
# Aufruf:
#   bash scripts/welle-pre-merge-check.sh
#   bash scripts/welle-pre-merge-check.sh --skip-build       # nur test+lint
#   bash scripts/welle-pre-merge-check.sh --only=test        # nur test
#
# Exit-Code: 0 wenn alles gruen, sonst != 0.

set -euo pipefail

# --- Argumente parsen ---
SKIP_BUILD=0
ONLY=""
for arg in "$@"; do
  case "$arg" in
    --skip-build)
      SKIP_BUILD=1
      ;;
    --only=*)
      ONLY="${arg#--only=}"
      ;;
    -h|--help)
      grep -E '^# ' "$0" | sed -E 's/^# ?//'
      exit 0
      ;;
    *)
      echo "Unbekanntes Argument: $arg" >&2
      exit 2
      ;;
  esac
done

# --- Helper ---
banner() {
  printf "\n\033[1;36m===> %s\033[0m\n" "$*"
}
green() {
  printf "\033[1;32m%s\033[0m\n" "$*"
}
red() {
  printf "\033[1;31m%s\033[0m\n" "$*"
}

START_TIME=$(date +%s)

# --- 1. pnpm test ---
if [[ -z "$ONLY" || "$ONLY" == "test" ]]; then
  banner "pnpm test (Vitest unit tests)"
  # `pnpm test` ist in package.json bereits als `vitest run` definiert,
  # also kein extra `--run` noetig (sonst probably double-pass).
  if pnpm test; then
    green "OK pnpm test gruen"
  else
    red "FEHLER pnpm test rot — Welle NICHT mergen"
    exit 1
  fi
fi

# --- 2. pnpm lint ---
if [[ -z "$ONLY" || "$ONLY" == "lint" ]]; then
  banner "pnpm lint (next lint)"
  if pnpm lint; then
    green "OK pnpm lint gruen (vor-existierende Warnings ignoriert)"
  else
    red "FEHLER pnpm lint rot — Welle NICHT mergen"
    exit 1
  fi
fi

# --- 3. pnpm build ---
if [[ -z "$ONLY" || "$ONLY" == "build" ]]; then
  if [[ "$SKIP_BUILD" == "1" ]]; then
    banner "pnpm build (uebersprungen via --skip-build)"
  else
    banner "pnpm build (next build) — kann ca. 75s dauern"
    if pnpm build; then
      green "OK pnpm build gruen"
    else
      red "FEHLER pnpm build rot — Welle NICHT mergen"
      red "Tipp: Haeufigste Ursache nach Modul-Split: ungenutzte Imports."
      red "      Nachpruefen mit: rg 'is defined but never used' im Build-Output."
      exit 1
    fi
  fi
fi

# --- Final ---
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
banner "Welle-Pre-Merge-Check ABGESCHLOSSEN in ${DURATION}s"
green "Alle Checks gruen — Welle ist bereit fuer Merge"
echo ""
echo "Naechste Schritte:"
echo "  1. PR im Browser oeffnen und smoke-testen (siehe PR-Body)"
echo "  2. Bei OK: Merge"
echo "  3. Naechsten Cloud-Agent mit dem Hand-off-Block aus dem PR-Body starten"
echo ""
