# React Native App Setup Guide

This is a React Native project built with TypeScript.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (>= 20)
- **npm** or **yarn**
- **React Native CLI**
- **Android Studio** (for Android development)
- **Xcode** (for iOS development, macOS only)
- **CocoaPods** (for iOS dependencies)

## Initial Setup

### 1. Environment Configuration

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` and set the required values:

```env
GOOGLE_MAPS_API_KEY=your-api-key-here
# For local dev the app talks to the unified backend at /api/v1/customer (no need to set if using defaults)
API_BASE_URL=https://api.example.com
API_VERSION=/api/v1
ENV=development
```

**API base URL (same method as HHD and Picker apps):** Config in `app.config.js` + `src/config/env.ts`. Priority: `API_BASE_URL` env → dev default. In development the app defaults to `http://localhost:5000/api/v1/customer` (unified backend). Override with `API_BASE_URL` for production or a different host. **If you see "Network Error" on a physical device or Android emulator**, `localhost` points to the device — set `API_BASE_URL` in `.env` to your machine's LAN IP (e.g. `http://192.168.1.x:5000/api/v1/customer`) and ensure the backend is running and reachable.

**Important**: The `GOOGLE_MAPS_API_KEY` is required. Get your API key from [Google Cloud Console](https://console.cloud.google.com/google/maps-apis).

### 2. Install Dependencies

```bash
npm install
```

### 3. iOS Setup (macOS only)

Install CocoaPods dependencies:

```bash
cd ios
pod install
cd ..
```

### 4. Android Setup

Ensure you have:
- Android SDK installed
- Android SDK Platform Tools in your PATH
- An Android emulator or physical device

## Running the App

### Quick Start

Use the provided shell scripts in the `shell-commands` folder:

#### Run on Android
```bash
./shell-commands/run-android.sh
```

#### Run on iOS
```bash
./shell-commands/run-ios.sh
```

### Manual Commands

#### Start Metro Bundler
```bash
npm start
```

#### Run Android (in a new terminal)
```bash
npm run android
```

#### Run iOS (in a new terminal)
```bash
npm run ios
```

## Building for Production

### Build Android APK
```bash
./shell-commands/build-android-apk.sh
```

The APK will be located at:
```
android/app/build/outputs/apk/release/app-release.apk
```

### Build iOS IPA
```bash
./shell-commands/build-ios-ipa.sh
```

**Note:** iOS builds require:
- Valid Apple Developer account
- Code signing certificates
- Provisioning profiles
- Updated `ExportOptions.plist` with your Team ID

The IPA will be located at:
```
ios/build/ipa/Frontend.ipa
```

## Project Structure

```
.
├── android/          # Android native code
├── ios/              # iOS native code
├── src/              # React Native source code
│   ├── components/   # Reusable components
│   ├── screens/      # Screen components
│   ├── navigation/   # Navigation setup
│   ├── contexts/     # React contexts
│   └── utils/        # Utility functions
├── shell-commands/   # Build and run scripts
└── package.json      # Dependencies and scripts
```

## Troubleshooting

### Android Issues

- **ADB not found**: Add Android SDK platform-tools to your PATH:
  ```bash
  export ANDROID_HOME=~/Library/Android/sdk
  export PATH=$PATH:$ANDROID_HOME/platform-tools
  ```

- **No devices found**: Start an emulator or connect a physical device via USB

### iOS Issues

- **Pod install fails**: Try:
  ```bash
  cd ios
  pod deintegrate
  pod install
  cd ..
  ```

- **Build errors**: Clean and rebuild:
  ```bash
  cd ios
  xcodebuild clean -workspace Frontend.xcworkspace -scheme Frontend
  cd ..
  ```

### Metro Bundler Issues

- **Cache issues**: Reset Metro cache:
  ```bash
  npm start -- --reset-cache
  ```

## Development

- **Fast Refresh**: Enabled by default. Changes to your code will automatically reload.
- **Dev Menu**: 
  - Android: Press `R` twice or `Ctrl+M` (Windows/Linux) / `Cmd+M` (macOS)
  - iOS: Press `Cmd+D` in simulator

## Testing

Run tests:

```bash
npm test                 # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Generate coverage report
```

See [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) for testing guidelines.

## Code Quality

```bash
npm run lint            # Check for linting errors
npm run lint:fix        # Fix linting errors automatically
npm run format          # Format code with Prettier
```

## Architecture

The app follows a modular architecture:

- **Components**: Reusable UI components in `src/components/`
- **Screens**: Screen components in `src/screens/`
- **Services**: API and business logic in `src/services/`
- **Contexts**: Global state management in `src/contexts/`
- **Navigation**: Navigation configuration in `src/navigation/`
- **Utils**: Utility functions in `src/utils/`

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Run tests and linting: `npm test && npm run lint`
4. Commit your changes (follow conventional commits)
5. Push and create a pull request

## Troubleshooting

### Environment Variables Not Working

After updating `.env`, you may need to:
- Restart Metro bundler
- Rebuild the app: `npx expo prebuild --clean`

### Google Maps API Key Issues

- Ensure the API key is set in `.env`
- Verify the key has Maps SDK enabled in Google Cloud Console
- Check API key restrictions match your app's bundle identifier
- Rebuild the app after setting the key

See [SENTRY_SETUP.md](./SENTRY_SETUP.md) for error tracking setup.

## Learn More

- [React Native Documentation](https://reactnative.dev)
- [React Native Getting Started](https://reactnative.dev/docs/getting-started)
- [Expo Documentation](https://docs.expo.dev)
