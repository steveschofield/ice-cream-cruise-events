# Local Development Environment Guide

Complete setup for building and testing the Ice Cream Cruisers app locally on macOS.

## Quick Start

### 1. Setup Local Environment (first time only)

```bash
bash scripts/setup-dev-environment.sh
```

This automatically:
- Installs Homebrew if needed
- Installs Java Development Kit (JDK 17)
- Installs Android SDK and tools
- Configures environment variables
- Verifies Xcode Command Line Tools
- Checks Node.js and npm

After running, **reload your shell:**
```bash
source ~/.zshrc
```

### 2. Verify Setup

```bash
# Check Java
java -version

# Check Android tools
adb --version

# Check Android SDK
echo $ANDROID_HOME
```

All should show valid versions.

## Development Workflow

### Local Testing

1. **Run tests locally:**
   ```bash
   npm test
   ```

2. **Run app in development:**
   ```bash
   npm start        # Web/Expo Go
   npm run ios      # iOS simulator
   npm run android  # Android emulator
   ```

### Local Building

1. **Test builds before submission:**
   ```bash
   bash scripts/test-build.sh
   ```

   Choose platform:
   - Option 1: iOS only (requires Xcode)
   - Option 2: Android only (requires Android SDK)
   - Option 3: Both

2. **Monitor build logs:**
   ```bash
   tail -f logs/build_test_*.log
   ```

### Pre-Submission Checklist

1. **Run validation:**
   ```bash
   bash scripts/validate-submission.sh
   ```

2. **Run presubmit checks:**
   ```bash
   bash scripts/presubmit.sh
   ```

3. **Test builds locally:**
   ```bash
   bash scripts/test-build.sh
   ```

4. **Submit to stores:**
   ```bash
   export ADMIN_USERNAME='admin'
   export ADMIN_PASSWORD='Aspfree1!'
   bash scripts/submit-to-stores.sh
   ```

## Detailed Setup (Manual)

If the automatic setup script doesn't work, here's the manual process:

### Java Development Kit

```bash
# Install OpenJDK 17
brew install openjdk@17

# Create symlink
sudo ln -sfn /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk \
  /Library/Java/JavaVirtualMachines/openjdk-17.jdk

# Verify
java -version
```

### Android SDK

```bash
# Install Android command-line tools
brew install android-commandlinetools

# Create SDK directory
mkdir -p ~/Library/Android/sdk

# Setup environment variables in ~/.zshrc
export ANDROID_SDK_ROOT=$HOME/Library/Android/sdk
export ANDROID_HOME=$ANDROID_SDK_ROOT
export PATH=$PATH:$ANDROID_SDK_ROOT/platform-tools
export PATH=$PATH:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin

# Reload shell
source ~/.zshrc

# Install required packages
sdkmanager "platform-tools"
sdkmanager "platforms;android-34"
sdkmanager "platforms;android-36"
sdkmanager "build-tools;36.0.0"
sdkmanager "ndk;27.1.12297006"

# Accept licenses
yes | sdkmanager --licenses
```

### Xcode Command Line Tools

```bash
# Install if not present
xcode-select --install

# Verify
xcode-select --version
```

## Troubleshooting

### "ANDROID_HOME not set" error

```bash
# Verify environment variable is set
echo $ANDROID_HOME

# If empty, reload shell
source ~/.zshrc

# If still empty, add to ~/.zshrc manually:
export ANDROID_SDK_ROOT=$HOME/Library/Android/sdk
export ANDROID_HOME=$ANDROID_SDK_ROOT
export PATH=$PATH:$ANDROID_SDK_ROOT/platform-tools
```

### "SDK location not found" error

```bash
# Ensure Android SDK is installed
ls -la ~/Library/Android/sdk/

# If missing, re-run setup
bash scripts/setup-dev-environment.sh
```

### "Java not found" error

```bash
# Verify Java installation
java -version

# If not found, install:
brew install openjdk@17

# Create symlink:
sudo ln -sfn /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk \
  /Library/Java/JavaVirtualMachines/openjdk-17.jdk
```

### "xcrun: error" on iOS builds

This means Xcode Command Line Tools are missing or outdated:

```bash
# Reinstall
sudo rm -rf /Library/Developer/CommandLineTools
xcode-select --install
```

## Environment Variables

These should be in your `~/.zshrc`:

```bash
# Java
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk

# Android SDK
export ANDROID_SDK_ROOT=$HOME/Library/Android/sdk
export ANDROID_HOME=$ANDROID_SDK_ROOT
export PATH=$PATH:$ANDROID_SDK_ROOT/platform-tools
export PATH=$PATH:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin
```

Verify with:
```bash
echo $ANDROID_HOME
echo $JAVA_HOME
```

## Recommended Tools

### Android Studio (optional)

For a more complete IDE experience:

```bash
brew install android-studio
```

### Emulators

Create and run emulators:

```bash
# List available devices
avdmanager list avd

# Create a device (interactive)
avdmanager create avd -n "Pixel6" -k "android-36"

# Start emulator
emulator -avd Pixel6
```

## Performance Tips

1. **Use hardware acceleration** for Android emulator (enable in Android Studio)
2. **Allocate enough RAM** to emulators (recommended: 4GB+)
3. **Use SSD** for faster builds
4. **Close unnecessary apps** while building

## Need Help?

Check the logs for detailed error messages:

```bash
# Latest build log
cat logs/build_test_*.log | tail -200

# Search for errors
grep -i "error\|failed" logs/build_test_*.log
```

Then share the relevant section for debugging.
