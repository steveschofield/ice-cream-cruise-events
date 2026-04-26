#!/bin/bash

# Local build test script
# Tests builds locally before submitting to EAS
# All output is logged to logs/ directory for review

# Setup logging
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_DIR="./logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/build_test_${TIMESTAMP}.log"

# Start logging
exec 1> >(tee -a "$LOG_FILE")
exec 2>&1

echo "🏗️  Testing local builds..."
echo "=============================="
echo "Timestamp: $(date)"
echo "Log file: $LOG_FILE"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

failed=0

# Log system info
echo "System Information:"
echo "  Node: $(node --version)"
echo "  npm: $(npm --version)"
echo "  npm config: $(npm config get production 2>/dev/null || echo 'not set')"
echo ""

# Check if eas-cli is installed
if ! command -v eas &> /dev/null; then
  echo -e "${YELLOW}⚠️  EAS CLI not installed. Installing...${NC}"
  npm install -g eas-cli
else
  echo "EAS CLI: $(eas --version)"
fi
echo ""

# Ask which platform to test
echo -e "${BLUE}Which platform would you like to test?${NC}"
echo "1) iOS"
echo "2) Android"
echo "3) Both"
read -p "Enter choice (1-3): " platform_choice
echo ""

# Test iOS build
if [ "$platform_choice" == "1" ] || [ "$platform_choice" == "3" ]; then
  echo -e "${BLUE}Testing iOS build locally...${NC}"
  echo "This may take 5-10 minutes on your machine"
  echo ""
  START_TIME=$(date +%s)
  echo "iOS Build started: $(date)"
  eas build --platform ios --local --output ./builds/ios.ipa
  iOS_RESULT=$?
  END_TIME=$(date +%s)
  DURATION=$((END_TIME - START_TIME))
  if [ $iOS_RESULT -ne 0 ]; then
    echo -e "${RED}✗ iOS build failed locally${NC}"
    echo "Duration: ${DURATION}s"
    failed=1
  else
    echo -e "${GREEN}✓ iOS build successful${NC}"
    echo "   Output: ./builds/ios.ipa"
    echo "   Duration: ${DURATION}s"
  fi
  echo ""
fi

# Test Android build
if [ "$platform_choice" == "2" ] || [ "$platform_choice" == "3" ]; then
  echo -e "${BLUE}Testing Android build locally...${NC}"
  echo "This may take 5-10 minutes on your machine"
  echo ""
  START_TIME=$(date +%s)
  echo "Android Build started: $(date)"
  eas build --platform android --local --output ./builds/android.apk
  ANDROID_RESULT=$?
  END_TIME=$(date +%s)
  DURATION=$((END_TIME - START_TIME))
  if [ $ANDROID_RESULT -ne 0 ]; then
    echo -e "${RED}✗ Android build failed locally${NC}"
    echo "Duration: ${DURATION}s"
    failed=1
  else
    echo -e "${GREEN}✓ Android build successful${NC}"
    echo "   Output: ./builds/android.apk"
    echo "   Duration: ${DURATION}s"
  fi
  echo ""
fi

# Summary
echo ""
echo "=============================="
echo "Build test completed at: $(date)"
if [ $failed -eq 0 ]; then
  echo -e "${GREEN}✓ Local builds successful!${NC}"
  echo ""
  echo "Your builds are ready. You can now:"
  echo "1. Test the builds locally on devices/simulators"
  echo "2. Run the submission script to upload to stores"
  echo ""
  echo "To submit:"
  echo "  export ADMIN_USERNAME='admin'"
  echo "  export ADMIN_PASSWORD='Aspfree1!'"
  echo "  bash scripts/submit-to-stores.sh"
  echo ""
  echo "📋 Full log saved to: $LOG_FILE"
else
  echo -e "${RED}✗ Local build failed${NC}"
  echo "Fix the issues above before submitting"
  echo ""
  echo "📋 Full log saved to: $LOG_FILE"
  echo "Review the log for details on what failed"
  exit 1
fi
