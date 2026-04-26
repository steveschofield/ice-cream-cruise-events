#!/bin/bash

# Local development environment setup for macOS
# Installs all required tools for building iOS and Android apps locally

echo "🛠️  Setting up Ice Cream Cruisers local development environment"
echo "=============================================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

failed=0
installed=0

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
  echo -e "${RED}✗ This script is designed for macOS only${NC}"
  exit 1
fi

# 1. Check/Install Homebrew
echo -e "${BLUE}1️⃣  Checking Homebrew...${NC}"
if ! command -v brew &> /dev/null; then
  echo -e "${YELLOW}Installing Homebrew...${NC}"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  installed=$((installed + 1))
fi
echo -e "${GREEN}✓ Homebrew ready${NC}"
echo ""

# 2. Check/Install Java (JDK 17 for React Native)
echo -e "${BLUE}2️⃣  Checking Java Development Kit...${NC}"
if ! command -v java &> /dev/null; then
  echo -e "${YELLOW}Installing OpenJDK 17...${NC}"
  brew install openjdk@17
  # Create symlink for system Java
  sudo ln -sfn /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-17.jdk
  installed=$((installed + 1))
else
  JAVA_VERSION=$(java -version 2>&1 | head -1)
  echo "Found: $JAVA_VERSION"
fi
echo -e "${GREEN}✓ Java ready${NC}"
echo ""

# 3. Check/Install Android SDK
echo -e "${BLUE}3️⃣  Checking Android SDK...${NC}"
ANDROID_SDK_ROOT="${HOME}/Library/Android/sdk"

if [ ! -d "$ANDROID_SDK_ROOT" ]; then
  echo -e "${YELLOW}Installing Android SDK...${NC}"
  mkdir -p "$ANDROID_SDK_ROOT"

  # Use Homebrew to install command-line tools
  brew tap homebrew/cask
  brew install android-commandlinetools

  # Initialize SDK
  mkdir -p "$ANDROID_SDK_ROOT/cmdline-tools"
  mv /opt/homebrew/Caskroom/android-commandlinetools/*/cmdline-tools \
     "$ANDROID_SDK_ROOT/cmdline-tools/latest" 2>/dev/null || true

  echo -e "${YELLOW}Installing Android SDK packages (this may take a few minutes)...${NC}"
  yes | $ANDROID_SDK_ROOT/cmdline-tools/latest/bin/sdkmanager --licenses > /dev/null 2>&1 || true
  $ANDROID_SDK_ROOT/cmdline-tools/latest/bin/sdkmanager \
    "platform-tools" \
    "platforms;android-34" \
    "platforms;android-36" \
    "build-tools;34.0.0" \
    "build-tools;36.0.0" \
    "ndk;27.1.12297006" \
    "cmake;3.22.1" \
    2>&1 | grep -E "Installing|Installed|Error" || true

  installed=$((installed + 1))
else
  echo "Found: $ANDROID_SDK_ROOT"
fi
echo -e "${GREEN}✓ Android SDK ready${NC}"
echo ""

# 4. Setup environment variables
echo -e "${BLUE}4️⃣  Setting up environment variables...${NC}"

# Check if variables are already set
if ! grep -q "ANDROID_SDK_ROOT" ~/.zshrc 2>/dev/null; then
  echo "" >> ~/.zshrc
  echo "# Android SDK configuration" >> ~/.zshrc
  echo "export ANDROID_SDK_ROOT=\$HOME/Library/Android/sdk" >> ~/.zshrc
  echo "export ANDROID_HOME=\$ANDROID_SDK_ROOT" >> ~/.zshrc
  echo "export PATH=\$PATH:\$ANDROID_SDK_ROOT/platform-tools" >> ~/.zshrc
  echo "export PATH=\$PATH:\$ANDROID_SDK_ROOT/cmdline-tools/latest/bin" >> ~/.zshrc
  echo "" >> ~/.zshrc

  echo -e "${YELLOW}⚠️  Environment variables added to ~/.zshrc${NC}"
  echo "   Run: source ~/.zshrc"
else
  echo "Environment variables already configured"
fi

# Source the variables for current session
export ANDROID_SDK_ROOT=$HOME/Library/Android/sdk
export ANDROID_HOME=$ANDROID_SDK_ROOT
export PATH=$PATH:$ANDROID_SDK_ROOT/platform-tools
export PATH=$PATH:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin

echo -e "${GREEN}✓ Environment variables set${NC}"
echo ""

# 5. Check Xcode
echo -e "${BLUE}5️⃣  Checking Xcode...${NC}"
if ! command -v xcode-select &> /dev/null; then
  echo -e "${YELLOW}⚠️  Xcode Command Line Tools not found${NC}"
  echo "   Installing (this may take 5-10 minutes)..."
  xcode-select --install
  echo "   After installation completes, run this script again"
else
  XCODE_VERSION=$(xcode-select --version)
  echo "Found: $XCODE_VERSION"
  echo -e "${GREEN}✓ Xcode ready${NC}"
fi
echo ""

# 6. Check/Install Fastlane (required for iOS builds)
echo -e "${BLUE}6️⃣  Checking Fastlane...${NC}"
if ! command -v fastlane &> /dev/null; then
  echo -e "${YELLOW}Installing Fastlane via Homebrew...${NC}"
  brew tap fastlane/fastlane
  brew install fastlane
  installed=$((installed + 1))
else
  FASTLANE_VERSION=$(fastlane --version)
  echo "Found: $FASTLANE_VERSION"
fi
echo -e "${GREEN}✓ Fastlane ready${NC}"
echo ""

# 6. Check Node and npm
echo -e "${BLUE}6️⃣  Checking Node.js and npm...${NC}"
NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
echo "Node: $NODE_VERSION"
echo "npm: $NPM_VERSION"
echo -e "${GREEN}✓ Node/npm ready${NC}"
echo ""

# 7. Verify all dependencies
echo -e "${BLUE}7️⃣  Verifying dependencies...${NC}"
echo ""

# Verify Java
if command -v java &> /dev/null; then
  echo -e "${GREEN}✓ Java${NC}"
else
  echo -e "${RED}✗ Java${NC}"
  failed=1
fi

# Verify Android SDK
if [ -d "$ANDROID_SDK_ROOT" ]; then
  echo -e "${GREEN}✓ Android SDK${NC}"
else
  echo -e "${RED}✗ Android SDK${NC}"
  failed=1
fi

# Verify Android tools
if [ -f "$ANDROID_SDK_ROOT/platform-tools/adb" ]; then
  echo -e "${GREEN}✓ Android platform tools${NC}"
else
  echo -e "${RED}✗ Android platform tools${NC}"
  failed=1
fi

# Verify Xcode
if command -v xcode-select &> /dev/null; then
  echo -e "${GREEN}✓ Xcode Command Line Tools${NC}"
else
  echo -e "${YELLOW}⚠️  Xcode Command Line Tools${NC}"
fi

# Verify Fastlane
if command -v fastlane &> /dev/null; then
  echo -e "${GREEN}✓ Fastlane${NC}"
else
  echo -e "${RED}✗ Fastlane${NC}"
  failed=1
fi

echo ""

# Summary
echo "=============================================================="
if [ $failed -eq 0 ]; then
  echo -e "${GREEN}✓ Environment setup complete!${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Reload your shell: source ~/.zshrc"
  echo "2. Verify setup: adb --version"
  echo "3. Run local builds: bash scripts/test-build.sh"
  echo ""

  if [ $installed -gt 0 ]; then
    echo -e "${YELLOW}⚠️  You installed new tools. Please restart your terminal and run:${NC}"
    echo "   source ~/.zshrc"
    echo "   bash scripts/setup-dev-environment.sh  # Run again to verify"
  fi
else
  echo -e "${RED}✗ Setup incomplete${NC}"
  echo "Please review errors above and try again"
  exit 1
fi
