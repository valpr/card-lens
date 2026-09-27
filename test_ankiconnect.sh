#!/bin/bash
# AnkiConnect Android Validation Script
# Run in Termux after installing curl: pkg install curl
# Make sure AnkiConnect Android service is started first.

ANKI="http://localhost:8765"

echo "=== 1. Version Check ==="
curl -s "$ANKI" -d '{
  "action": "version",
  "version": 6
}'
echo -e "\n"

echo "=== 2. storeMediaFile ==="
# Tiny 1x1 red pixel PNG (68 bytes)
curl -s "$ANKI" -d '{
  "action": "storeMediaFile",
  "version": 6,
  "params": {
    "filename": "_ankiconnect_test.png",
    "data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
  }
}'
echo -e "\n"

echo "=== 3. findNotes ==="
# Change 'Default' to your deck name
curl -s "$ANKI" -d '{
  "action": "findNotes",
  "version": 6,
  "params": {
    "query": "added:1"
  }
}'
echo -e "\n"

echo "=== 4. updateNoteFields ==="
echo "Skipped — requires a real note ID from step 3."
echo "Once you have an ID, run:"
echo 'curl -s '"$ANKI"' -d '"'"'{"action":"updateNoteFields","version":6,"params":{"note":{"id":NOTE_ID_HERE,"fields":{"Picture":"<img src=\"_ankiconnect_test.png\">"}}}}'\'
echo ""

echo "=== Done ==="
echo "If steps 1-3 returned JSON with no errors, you're good."
