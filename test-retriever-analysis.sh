#!/bin/bash

# Test-Script für Retriever-Analyse
# Verwendung: ./test-retriever-analysis.sh <libraryId> [userEmail]

LIBRARY_ID="${1:-your-library-id}"
USER_EMAIL="${2:-your-email@example.com}"
BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "=== Retriever-Analyse Tests ==="
echo "Library ID: $LIBRARY_ID"
echo "User Email: $USER_EMAIL"
echo ""

# Test 1: Unklare Frage (sollte 'unclear' zurückgeben)
echo "Test 1: Unklare Frage (sollte 'needs_clarification' zurückgeben)"
echo "Frage: 'Was gibt es?'"
curl -s -X POST "$BASE_URL/api/chat/$LIBRARY_ID" \
  -H "Content-Type: application/json" \
  -H "X-User-Email: $USER_EMAIL" \
  -d '{"message":"Was gibt es?","answerLength":"mittel"}' | jq '.'
echo ""
echo ""

# Test 2: Spezifische Chunk-Frage (sollte 'chunk' empfehlen)
echo "Test 2: Spezifische Chunk-Frage (sollte 'chunk' Modus verwenden)"
echo "Frage: 'Wie funktioniert die Funktion calculateScore()?'"
curl -s -X POST "$BASE_URL/api/chat/$LIBRARY_ID" \
  -H "Content-Type: application/json" \
  -H "X-User-Email: $USER_EMAIL" \
  -d '{"message":"Wie funktioniert die Funktion calculateScore()?","answerLength":"mittel"}' | jq '.status, .answer[0:100]'
echo ""
echo ""

# Test 3: Breite Summary-Frage (sollte 'summary' empfehlen)
echo "Test 3: Breite Summary-Frage (sollte 'summary' Modus verwenden)"
echo "Frage: 'Was sind die Hauptthemen aller Dokumente?'"
curl -s -X POST "$BASE_URL/api/chat/$LIBRARY_ID" \
  -H "Content-Type: application/json" \
  -H "X-User-Email: $USER_EMAIL" \
  -d '{"message":"Was sind die Hauptthemen aller Dokumente?","answerLength":"mittel"}' | jq '.status, .answer[0:100]'
echo ""
echo ""

# Test 4: Expliziter Retriever-Parameter (sollte Analyse überschreiben)
echo "Test 4: Expliziter retriever=summary Parameter (sollte Analyse überschreiben)"
echo "Frage: 'Test' mit ?retriever=summary"
curl -s -X POST "$BASE_URL/api/chat/$LIBRARY_ID?retriever=summary" \
  -H "Content-Type: application/json" \
  -H "X-User-Email: $USER_EMAIL" \
  -d '{"message":"Test","answerLength":"mittel"}' | jq '.status, .queryId'
echo ""
echo ""

# Test 5: Auto-Retriever deaktivieren
echo "Test 5: Auto-Retriever deaktiviert (?autoRetriever=false)"
echo "Frage: 'Was gibt es?' sollte direkt verarbeitet werden"
curl -s -X POST "$BASE_URL/api/chat/$LIBRARY_ID?autoRetriever=false" \
  -H "Content-Type: application/json" \
  -H "X-User-Email: $USER_EMAIL" \
  -d '{"message":"Was gibt es?","answerLength":"mittel"}' | jq '.status'
echo ""
echo ""

echo "=== Tests abgeschlossen ==="













