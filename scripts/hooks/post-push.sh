#!/bin/bash
# Heady post-push hook — auto-sync to Notion after push
# Install: ln -sf ../../scripts/hooks/post-push.sh .git/hooks/post-push

NOTION_TOKEN=$(grep NOTION_TOKEN .env 2>/dev/null | cut -d '=' -f2)

if [ -n "$NOTION_TOKEN" ]; then
  echo "🧠 Syncing to Notion Knowledge Vault..."
  NOTION_TOKEN="$NOTION_TOKEN" node src/services/heady-notion.js 2>&1 | tail -3
  echo "✅ Notion sync complete"
else
  echo "⚠ NOTION_TOKEN not found in .env — skipping Notion sync"
fi
