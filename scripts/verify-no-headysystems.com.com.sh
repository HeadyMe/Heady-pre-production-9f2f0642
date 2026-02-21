#!/bin/bash
# 🌐 headysystems.com VERIFICATION SCRIPT
echo "🔍 Checking for remaining headysystems.com.com references..."
if grep -r "headysystems.com.com" src/ --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" 2>/dev/null; then
  echo "❌ headysystems.com STILL FOUND - MANUAL CLEANUP REQUIRED"
  exit 1
else
  echo "✅ ALL headysystems.com REFERENCES ELIMINATED"
fi

echo "🔍 Checking for headysystems.com references..."
if grep -r "headysystems.com" src/ --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" 2>/dev/null; then
  echo "❌ headysystems.com STILL FOUND - MANUAL CLEANUP REQUIRED"
  exit 1
else
  echo "✅ ALL headysystems.com REFERENCES ELIMINATED"
fi

echo "🎉 PRODUCTION DOMAIN MIGRATION COMPLETE"
