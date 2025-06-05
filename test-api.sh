#!/bin/bash

echo "=== API Test Script ==="
echo

# Test 1: Test-Route
echo "1. Testing /api/test-route..."
curl -X GET http://localhost:3000/api/test-route
echo
echo

# Test 2: Filesystem Ping
echo "2. Testing /api/storage/filesystem ping..."
curl -X GET "http://localhost:3000/api/storage/filesystem?test=ping"
echo
echo

# Test 3: Filesystem mit Parametern
echo "3. Testing /api/storage/filesystem with parameters..."
curl -X GET "http://localhost:3000/api/storage/filesystem?action=list&fileId=root&libraryId=27632423-7615-43cc-a36c-5cb0b656c060&email=peter.aichner%40crystal-design.com"
echo
echo

# Test 4: Mit Headers
echo "4. Testing with headers..."
curl -X GET "http://localhost:3000/api/storage/filesystem?action=list&fileId=root&libraryId=test&email=test@example.com" \
  -H "X-Test: true" \
  -v
echo

echo "=== Tests completed ===" 