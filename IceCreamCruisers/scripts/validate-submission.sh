#!/bin/bash

# Pre-submission validation script
# Checks for common issues before app store submission

echo "🔍 Running pre-submission validation checks..."
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

failed=0

# 1. Check for hardcoded credentials/secrets
echo "1️⃣  Checking for hardcoded secrets..."
if grep -r "password\|secret\|api_key\|apiKey\|API_KEY" app/ screens/ components/ --include="*.tsx" --include="*.ts" | grep -v "node_modules" | grep -v ".env" > /dev/null 2>&1; then
  echo -e "${YELLOW}⚠ Found potential hardcoded credentials in source code${NC}"
  echo "   Review these files before submission:"
  grep -r "password\|secret\|api_key\|apiKey\|API_KEY" app/ screens/ components/ --include="*.tsx" --include="*.ts" | grep -v "node_modules" | grep -v ".env" | cut -d: -f1 | sort -u
  echo ""
fi

# 2. Check for console.log statements (indicates debugging)
echo "2️⃣  Checking for debug console.log statements..."
if grep -r "console\.log\|console\.warn\|console\.error" app/ screens/ components/ --include="*.tsx" --include="*.ts" | grep -v "node_modules" > /dev/null 2>&1; then
  echo -e "${YELLOW}⚠ Found console statements (should be removed for production)${NC}"
  console_count=$(grep -r "console\.log\|console\.warn\|console\.error" app/ screens/ components/ --include="*.tsx" --include="*.ts" | grep -v "node_modules" | wc -l)
  echo "   Found $console_count console statements - consider removing for cleaner production logs"
  echo ""
fi

# 3. Check for TODO/FIXME comments
echo "3️⃣  Checking for unresolved TODO/FIXME comments..."
if grep -r "TODO\|FIXME" app/ screens/ components/ --include="*.tsx" --include="*.ts" | grep -v "node_modules" > /dev/null 2>&1; then
  echo -e "${YELLOW}⚠ Found unresolved TODO/FIXME comments${NC}"
  grep -r "TODO\|FIXME" app/ screens/ components/ --include="*.tsx" --include="*.ts" | grep -v "node_modules"
  echo ""
fi

# 4. Check API endpoints are using HTTPS in production
echo "4️⃣  Checking API endpoint configuration..."
if grep -r "http://" config.ts | grep -v "localhost" | grep -v "192.168" > /dev/null 2>&1; then
  echo -e "${RED}✗ Found non-HTTPS API endpoint (production must use HTTPS)${NC}"
  grep -r "http://" config.ts | grep -v "localhost" | grep -v "192.168"
  failed=1
else
  echo -e "${GREEN}✓ API endpoints configured correctly${NC}"
fi
echo ""

# 5. Check version number is set
echo "5️⃣  Checking app version..."
version=$(grep '"version"' app.json | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
if [ -z "$version" ]; then
  echo -e "${RED}✗ No version number found in app.json${NC}"
  failed=1
else
  echo -e "${GREEN}✓ Version: $version${NC}"
fi
echo ""

# 6. Check bundle IDs are configured
echo "6️⃣  Checking platform bundle IDs..."
ios_bundle=$(grep "bundleIdentifier" app.json | grep -oE '"[^"]*"' | tail -1 | tr -d '"')
android_package=$(grep '"package"' app.json | head -1 | grep -oE '"[^"]*"' | tail -1 | tr -d '"')

if [ -z "$ios_bundle" ]; then
  echo -e "${RED}✗ iOS bundleIdentifier not configured${NC}"
  failed=1
else
  echo -e "${GREEN}✓ iOS Bundle ID: $ios_bundle${NC}"
fi

if [ -z "$android_package" ]; then
  echo -e "${RED}✗ Android package not configured${NC}"
  failed=1
else
  echo -e "${GREEN}✓ Android Package: $android_package${NC}"
fi
echo ""

# 7. Check for any uncommitted changes
echo "7️⃣  Checking for uncommitted changes..."
if ! git diff-index --quiet HEAD --; then
  echo -e "${YELLOW}⚠ Uncommitted changes detected${NC}"
  echo "   Stage and commit your changes before submission"
  git status --short
  echo ""
fi

# 8. Verify EAS configuration
echo "8️⃣  Checking EAS configuration..."
if [ ! -f "eas.json" ]; then
  echo -e "${RED}✗ eas.json not found${NC}"
  failed=1
else
  echo -e "${GREEN}✓ EAS configuration found${NC}"

  production_gradle_command=$(node -e "const fs = require('fs'); const config = JSON.parse(fs.readFileSync('eas.json', 'utf8')); process.stdout.write(config.build?.production?.android?.gradleCommand || '')")

  if echo "$production_gradle_command" | grep -q '^assembleRelease'; then
    echo -e "${RED}✗ Android production build is configured to generate an APK${NC}"
    echo "   Google Play releases for new apps should use an Android App Bundle (AAB)"
    echo "   Update the production Android gradleCommand to bundleRelease or remove the override"
    failed=1
  else
    echo -e "${GREEN}✓ Android production build is configured for an AAB${NC}"
  fi

  # Check if credentials are set
  if [ -z "$ADMIN_USERNAME" ] || [ -z "$ADMIN_PASSWORD" ]; then
    echo -e "${YELLOW}⚠ Backend credentials not set in environment${NC}"
  else
    echo -e "${GREEN}✓ Backend credentials configured${NC}"
  fi
fi
echo ""

# Summary
echo "========================================"
if [ $failed -eq 0 ]; then
  echo -e "${GREEN}✓ Validation complete - ready for submission${NC}"
  exit 0
else
  echo -e "${RED}✗ Validation found critical issues${NC}"
  echo "   Please fix the errors above before submitting"
  exit 1
fi
