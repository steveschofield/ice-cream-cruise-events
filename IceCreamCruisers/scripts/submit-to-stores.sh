#!/bin/bash

# Ice Cream Cruisers - App Store Submission Script
# Handles pre-submission checks, builds, and submissions to iOS and Android stores

set -o pipefail

echo "🚀 Ice Cream Cruisers - Store Submission"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

extract_build_id() {
  local json_file="$1"

  node - "$json_file" <<'NODE'
const fs = require('fs');

const file = process.argv[2];
const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
const builds = Array.isArray(parsed) ? parsed : [parsed];
const build = builds.find(candidate => candidate && typeof candidate === 'object' && candidate.id);

if (!build?.id) {
  process.exit(1);
}

process.stdout.write(build.id);
NODE
}

extract_archive_reference() {
  local json_file="$1"

  node - "$json_file" <<'NODE'
const fs = require('fs');

const file = process.argv[2];
const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
const builds = Array.isArray(parsed) ? parsed : [parsed];
const build = builds.find(candidate => candidate && typeof candidate === 'object') ?? {};
const artifacts = build.artifacts ?? {};
const archiveRef =
  artifacts.applicationArchiveUrl ??
  artifacts.buildUrl ??
  artifacts.applicationArchivePath ??
  '';

process.stdout.write(archiveRef);
NODE
}

verify_android_artifact() {
  local build_id="$1"
  local build_json
  local archive_ref

  build_json=$(mktemp)
  if ! eas build:view "$build_id" --json > "$build_json"; then
    rm -f "$build_json"
    echo -e "${RED}✗ Failed to inspect Android build ${build_id}${NC}" >&2
    return 1
  fi

  archive_ref=$(extract_archive_reference "$build_json")
  rm -f "$build_json"

  if [ -z "$archive_ref" ]; then
    echo -e "${YELLOW}⚠ Unable to verify Android artifact path for build ${build_id}${NC}" >&2
    return 0
  fi

  if [[ "$archive_ref" == *.apk* ]]; then
    echo -e "${RED}✗ Android production build ${build_id} produced an APK instead of an AAB${NC}" >&2
    echo "   Artifact: $archive_ref" >&2
    return 1
  fi

  echo -e "${GREEN}✓ Android artifact verified as AAB${NC}" >&2
}

run_store_build() {
  local platform="$1"
  local build_json
  local build_id
  local build_message

  build_json=$(mktemp)
  build_message="submit-script-${platform}-$(date +%Y%m%d%H%M%S)"

  if ! eas build --platform "$platform" --profile production --wait --json --message "$build_message" > "$build_json"; then
    rm -f "$build_json"
    return 1
  fi

  if ! build_id=$(extract_build_id "$build_json"); then
    rm -f "$build_json"
    echo -e "${RED}✗ Failed to determine ${platform} build ID from EAS output${NC}" >&2
    return 1
  fi

  rm -f "$build_json"

  if [ "$platform" == "android" ]; then
    if ! verify_android_artifact "$build_id"; then
      return 1
    fi
  fi

  printf '%s\n' "$build_id"
}

submit_store_build() {
  local platform="$1"
  local build_id="$2"

  echo -e "${BLUE}Submitting ${platform} build ${build_id}...${NC}" >&2
  eas submit --platform "$platform" --profile production --id "$build_id" --wait
}

# Check if we're in the right directory
if [ ! -f "app.json" ]; then
  echo -e "${RED}✗ Error: app.json not found. Please run this script from the IceCreamCruisers directory${NC}"
  exit 1
fi

if ! command -v eas > /dev/null 2>&1; then
  echo -e "${RED}✗ Error: eas CLI is not installed or not on PATH${NC}"
  exit 1
fi

# Step 1: Pre-submission checks (skip integration tests - no backend running)
echo -e "${BLUE}Step 1: Running pre-submission checks...${NC}"
SKIP_INTEGRATION_TESTS=true npm run presubmit
if [ $? -ne 0 ]; then
  echo -e "${RED}✗ Pre-submission checks failed. Please fix issues above before continuing.${NC}"
  exit 1
fi
echo ""

# Step 1b: Additional validation checks
echo -e "${BLUE}Step 1b: Running security and configuration validation...${NC}"
bash scripts/validate-submission.sh
if [ $? -ne 0 ]; then
  echo -e "${RED}✗ Validation checks failed. Please fix issues above before continuing.${NC}"
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

# Step 4: Ask about submission flow
echo -e "${BLUE}Step 4: Submission method${NC}"
echo "1) Build, verify, and submit the exact build to stores"
echo "2) Build only (submit manually later)"
read -p "Enter choice (1-2): " submit_choice
echo ""

# Determine if we should submit after building
if [ "$submit_choice" == "1" ]; then
  SHOULD_SUBMIT=true
  echo -e "${YELLOW}⚠ App will be submitted using the exact build ID created by this script${NC}"
else
  SHOULD_SUBMIT=false
  echo -e "${YELLOW}ℹ Build only - you can submit later with 'eas submit'${NC}"
fi
echo ""

# Step 5: Execute builds
echo -e "${BLUE}Step 5: Building and submitting...${NC}"
echo ""

IOS_BUILD_ID=""
ANDROID_BUILD_ID=""

if [ "$platform_choice" == "1" ] || [ "$platform_choice" == "3" ]; then
  echo -e "${BLUE}Building iOS app...${NC}"
  IOS_BUILD_ID=$(run_store_build ios)
  if [ $? -ne 0 ]; then
    echo -e "${RED}✗ iOS build failed${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ iOS build complete${NC}"
  echo "   Build ID: $IOS_BUILD_ID"
  if [ "$SHOULD_SUBMIT" = true ]; then
    if ! submit_store_build ios "$IOS_BUILD_ID"; then
      echo -e "${RED}✗ iOS submission failed${NC}"
      exit 1
    fi
    echo -e "${GREEN}✓ iOS submission complete${NC}"
  fi
  echo ""
fi

if [ "$platform_choice" == "2" ] || [ "$platform_choice" == "3" ]; then
  echo -e "${BLUE}Building Android app...${NC}"
  ANDROID_BUILD_ID=$(run_store_build android)
  if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Android build failed${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ Android build complete${NC}"
  echo "   Build ID: $ANDROID_BUILD_ID"
  if [ "$SHOULD_SUBMIT" = true ]; then
    if ! submit_store_build android "$ANDROID_BUILD_ID"; then
      echo -e "${RED}✗ Android submission failed${NC}"
      exit 1
    fi
    echo -e "${GREEN}✓ Android submission complete${NC}"
  fi
  echo ""
fi

# Summary
echo "========================================"
echo -e "${GREEN}✓ Submission process complete!${NC}"
echo ""

if [ "$submit_choice" == "1" ]; then
  echo "📱 App submitted to stores:"
  if [ "$platform_choice" == "1" ] || [ "$platform_choice" == "3" ]; then
    echo "  • iOS: Check TestFlight and App Store Connect (build $IOS_BUILD_ID)"
  fi
  if [ "$platform_choice" == "2" ] || [ "$platform_choice" == "3" ]; then
    echo "  • Android: Check Google Play Console (build $ANDROID_BUILD_ID)"
  fi
else
  echo "📱 Build complete. To submit manually later:"
  if [ -n "$IOS_BUILD_ID" ]; then
    echo "  eas submit --platform ios --profile production --id $IOS_BUILD_ID"
  fi
  if [ -n "$ANDROID_BUILD_ID" ]; then
    echo "  eas submit --platform android --profile production --id $ANDROID_BUILD_ID"
  fi
fi

echo ""
echo "ℹ Next steps:"
echo "  1. Monitor build status in EAS dashboard"
echo "  2. For iOS: Review and submit from TestFlight"
echo "  3. For Android: Monitor review in Play Console"
echo "  4. Once approved, users can download your app!"
