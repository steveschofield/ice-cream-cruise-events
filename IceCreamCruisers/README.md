# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Testing

Run tests locally before submission:

```bash
npm test                    # Run all tests with watch mode
npm run test:ci             # Run tests with coverage (CI mode)
bash scripts/presubmit.sh   # Run full pre-submission checklist
```

The presubmit checklist verifies:
- ESLint linting
- Jest tests
- app.json configuration
- Environment variables

Integration tests can be skipped in CI environments:
```bash
SKIP_INTEGRATION_TESTS=true npm test
```

## Submitting to App Stores

Complete submission with a single command:

```bash
bash scripts/submit-to-stores.sh
```

This script will:
1. Run pre-submission checks (linting, tests, validation)
2. Verify environment variables
3. Ask which platform(s) to submit to
4. Build and submit to Apple App Store and/or Google Play Store

### Manual Submission

If you prefer step-by-step control:

```bash
# Step 1: Pre-submission checks
bash scripts/presubmit.sh

# Step 2: Build
eas build --platform ios      # iOS only
eas build --platform android  # Android only
eas build --platform all      # Both

# Step 3: Submit (if not using --auto-submit)
eas submit --platform ios
eas submit --platform android
```

### Environment Setup

For production deployment, set backend credentials:
```bash
export ADMIN_USERNAME="your_username"
export ADMIN_PASSWORD="your_password"
```

Then run the submission script which will use these credentials.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
