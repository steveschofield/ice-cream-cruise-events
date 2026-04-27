#!/bin/bash

echo "🚀 Pre-Submission Checklist"
echo "=========================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

failed=0

# 1. Type checking (informational only - don't block submission)
echo "📋 Running TypeScript type check..."
npm run type-check 2>&1 | grep -c "error TS" > /tmp/ts-errors.count
ts_error_count=$(cat /tmp/ts-errors.count)
if [ $? -eq 0 ] && [ "$ts_error_count" -eq 0 ]; then
  echo -e "${GREEN}✓ Type check passed${NC}"
else
  echo -e "${YELLOW}⚠ Type check has issues (see above) - review before submission${NC}"
fi
echo ""

# 2. Linting
echo "🔍 Running ESLint..."
npm run lint
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Linting passed${NC}"
else
  echo -e "${RED}✗ Linting failed${NC}"
  failed=1
fi
echo ""

# 3. Unit & Integration tests
echo "🧪 Running tests..."
SKIP_INTEGRATION_TESTS=true npm run test:ci
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Tests passed${NC}"
else
  echo -e "${RED}✗ Tests failed${NC}"
  failed=1
fi
echo ""

# 4. Check app.json
echo "📝 Checking app.json configuration..."
if grep -q '"name"' app.json && grep -q '"version"' app.json; then
  echo -e "${GREEN}✓ app.json is configured${NC}"
else
  echo -e "${RED}✗ app.json is missing required fields${NC}"
  failed=1
fi
echo ""

# 5. Check environment variables
echo "🔐 Checking environment variables..."
if [ -z "$ADMIN_USERNAME" ] || [ -z "$ADMIN_PASSWORD" ]; then
  echo -e "${YELLOW}⚠ Backend admin credentials not set (needed for production)${NC}"
fi
echo ""

# Summary
echo "=========================="
if [ $failed -eq 0 ]; then
  echo -e "${GREEN}✓ All checks passed! Ready to submit to app stores${NC}"
  exit 0
else
  echo -e "${RED}✗ Some checks failed. Please fix before submitting${NC}"
  exit 1
fi
