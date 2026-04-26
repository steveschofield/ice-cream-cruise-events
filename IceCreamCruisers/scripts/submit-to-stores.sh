#!/bin/bash

# Ice Cream Cruisers - App Store Submission Script
# Handles pre-submission checks, builds, and submissions to iOS and Android stores

echo "🚀 Ice Cream Cruisers - Store Submission"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "app.json" ]; then
  echo -e "${RED}✗ Error: app.json not found. Please run this script from the IceCreamCruisers directory${NC}"
  exit 1
fi

# Step 1: Pre-submission checks
echo -e "${BLUE}Step 1: Running pre-submission checks...${NC}"
bash scripts/presubmit.sh
if [ $? -ne 0 ]; then
  echo -e "${RED}✗ Pre-submission checks failed. Please fix issues above before continuing.${NC}"
  exit 1
fi
echo ""

# Step 2: Verify environment variables
echo -e "${BLUE}Step 2: Checking environment variables...${NC}"
if [ -z "$ADMIN_USERNAME" ] || [ -z "$ADMIN_PASSWORD" ]; then
  echo -e "${YELLOW}⚠ Backend admin credentials not set${NC}"
  echo "For production deployment, you may need to set:"
  echo "  export ADMIN_USERNAME='your_username'"
  echo "  export ADMIN_PASSWORD='your_password'"
  read -p "Continue without credentials? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi
echo ""

# Step 3: Ask which platforms to build
echo -e "${BLUE}Step 3: Select platform(s) to build and submit${NC}"
echo "1) iOS only (to TestFlight/App Store)"
echo "2) Android only (to Google Play Store)"
echo "3) Both iOS and Android"
read -p "Enter choice (1-3): " platform_choice
echo ""

# Step 4: Ask about auto-submit
echo -e "${BLUE}Step 4: Submission method${NC}"
echo "1) Build and auto-submit to stores"
echo "2) Build only (submit manually later)"
read -p "Enter choice (1-2): " submit_choice
echo ""

# Determine if we should auto-submit
if [ "$submit_choice" == "1" ]; then
  AUTO_SUBMIT="--auto-submit"
  echo -e "${YELLOW}⚠ App will be automatically submitted to stores${NC}"
else
  AUTO_SUBMIT=""
  echo -e "${YELLOW}ℹ Build only - you can submit later with 'eas submit'${NC}"
fi
echo ""

# Step 5: Execute builds
echo -e "${BLUE}Step 5: Building and submitting...${NC}"
echo ""

if [ "$platform_choice" == "1" ] || [ "$platform_choice" == "3" ]; then
  echo -e "${BLUE}Building iOS app...${NC}"
  eas build --platform ios $AUTO_SUBMIT
  if [ $? -ne 0 ]; then
    echo -e "${RED}✗ iOS build failed${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ iOS build complete${NC}"
  echo ""
fi

if [ "$platform_choice" == "2" ] || [ "$platform_choice" == "3" ]; then
  echo -e "${BLUE}Building Android app...${NC}"
  eas build --platform android $AUTO_SUBMIT
  if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Android build failed${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ Android build complete${NC}"
  echo ""
fi

# Summary
echo "========================================"
echo -e "${GREEN}✓ Submission process complete!${NC}"
echo ""

if [ "$submit_choice" == "1" ]; then
  echo "📱 App submitted to stores:"
  if [ "$platform_choice" == "1" ] || [ "$platform_choice" == "3" ]; then
    echo "  • iOS: Check TestFlight and App Store Connect"
  fi
  if [ "$platform_choice" == "2" ] || [ "$platform_choice" == "3" ]; then
    echo "  • Android: Check Google Play Console"
  fi
else
  echo "📱 Build complete. To submit manually later:"
  echo "  eas submit --platform ios"
  echo "  eas submit --platform android"
fi

echo ""
echo "ℹ Next steps:"
echo "  1. Monitor build status in EAS dashboard"
echo "  2. For iOS: Review and submit from TestFlight"
echo "  3. For Android: Monitor review in Play Console"
echo "  4. Once approved, users can download your app!"
