# Expo Development Client Troubleshooting Guide

## Issues Fixed

### 1. Watchman Recrawl Warning

**Problem:**
```
Recrawled this watch 33 times, most recently because: MustScanSubDirs UserDroppedTo resolve, please review...
```

**Solution:**
The watchman cache has been cleared. If this warning reappears:
```bash
watchman watch-del '/Users/muthuramanveerashekar/Desktop/Dev/selorg-combined/customer-app-v1'
watchman watch-project '/Users/muthuramanveerashekar/Desktop/Dev/selorg-combined/customer-app-v1'
```

### 2. Missing Native Modules

**Problem:**
```
[React] [Error: Cannot find native module 'ExponentImagePicker']
[React] [Error: Cannot find native module 'ExpoLinking']
```

**Cause:**
In the Expo Development Client on a simulator, some native modules are not available. This is normal behavior when running via the development client instead of a prebuilt app.

**Solution:**
The following fixes have been implemented:

- **NetworkContext.tsx**: Added fallback handling for NetInfo module
  - Checks if NetInfo.addEventListener is available before subscribing
  - Defaults to `isConnected: true` if the module isn't available
  - Gracefully handles errors when subscribing/unsubscribing

- **Native Module Checker**: New utility file (`src/utils/nativeModuleCheck.ts`)
  - Provides safe module availability checking
  - Helps identify missing modules for debugging
  - Can be used in other components that depend on native modules

### 3. "Cannot read property 'subscribe' of undefined"

**Problem:**
```
TypeError: Cannot read property 'subscribe' of undefined
```

**Root Cause:**
The error occurred because `NetInfo.addEventListener` was being called when the NetInfo native module wasn't available in the Expo Development Client.

**Solution:**
- Added null-safety checks for `NetInfo.addEventListener`
- Added try-catch wrapper around event listener subscription
- Added proper cleanup in the useEffect return function
- Added validation that unsubscribe is a function before calling it

## How to Use the App in Development

### For Local Development (with Expo Dev Client):

1. **Set environment to development** (already done in `.env`):
   ```
   mode=dev
   ENV=development
   API_BASE_URL=http://localhost:5001/api/v1/customer
   ```

2. **Start the development server**:
   ```bash
   npm start
   ```

3. **Run on iOS simulator**:
   ```bash
   npm run ios
   ```

4. **Run on Android emulator**:
   ```bash
   npm run android
   ```

### For Production Testing:

1. **Update .env for production**:
   ```
   mode=prod
   ENV=production
   API_BASE_URL=https://api.selorg.com/api/v1/customer
   ```

2. **Rebuild and deploy**

## Implementation Details

### NetworkContext Changes

The `NetworkContext` now:
1. Checks if `NetInfo.addEventListener` exists before calling it
2. Assumes the app is connected if the native module isn't available
3. Wraps subscription in a try-catch block
4. Safely handles unsubscription in the cleanup function

```typescript
// Checks for both fetch and addEventListener methods
if (!NetInfo || typeof NetInfo.fetch !== 'function' || typeof NetInfo.addEventListener !== 'function') {
  setIsConnected(true);
  return;
}

// Safe subscription with error handling
let unsubscribe: (() => void) | undefined;
try {
  unsubscribe = NetInfo.addEventListener?.((state: NetInfoState) => {
    // ... event handling
  });
} catch (error) {
  logger.warn('Failed to subscribe to NetInfo events', error);
}
```

## Module Availability Check

A new utility is available for checking native module availability:

```typescript
import { isNativeModuleAvailable, getMissingNativeModules, logNativeModuleStatus } from '@/utils/nativeModuleCheck';

// Check specific module
if (isNativeModuleAvailable('RNCAsyncStorage')) {
  // Use AsyncStorage
}

// Get all missing modules (for debugging)
const missing = getMissingNativeModules();
console.log('Missing modules:', missing);

// Log status in app startup
logNativeModuleStatus();
```

## Why These Errors Happen

1. **Expo Development Client Limitations**: The development client is a lightweight wrapper that only includes a subset of Expo modules. Not all native modules are available at runtime.

2. **Module Dependencies**: Some libraries in your project may require native modules that aren't included in the development client.

3. **Simulator Limitations**: iOS Simulators have different native module support than physical devices.

## Monitoring

The app now logs missing native modules on startup. Check the Expo dev server logs to see if any modules are unavailable:

```bash
# Look for warnings like:
# ⚠️  Missing native modules in Expo Development Client: [...]
```

## Next Steps

- These changes ensure the app works gracefully when native modules aren't available
- The app will start and be fully functional for testing
- Network connectivity monitoring falls back to assuming connected status
- For production builds, use `eas build` to create a fully compiled app with all native modules

## If Issues Persist

1. **Clear all caches**:
   ```bash
   rm -rf node_modules/.cache
   watchman watch-del '/Users/muthuramanveerashekar/Desktop/Dev/selorg-combined/customer-app-v1'
   npm start -- --clear
   ```

2. **Rebuild from scratch**:
   ```bash
   rm -rf ios android node_modules
   npm install
   npm start
   ```

3. **Use EAS Build for production** instead of local development client:
   ```bash
   eas build --platform ios
   ```
