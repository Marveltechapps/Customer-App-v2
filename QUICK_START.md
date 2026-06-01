# Quick Start Guide - Customer App v1

## Fresh Start After Fixes

If you encounter any of the previous issues again, follow these steps in order:

### 1. Clear Everything
```bash
# Stop the dev server (Ctrl+C in terminal)

# Clear watchman
watchman watch-del '/Users/muthuramanveerashekar/Desktop/Dev/selorg-combined/customer-app-v1'

# Clear caches
rm -rf node_modules/.cache

# Clear Metro cache
npm start -- --reset-cache
```

### 2. Start Fresh
```bash
# In the customer-app-v1 directory
npm start
```

### 3. Run on Simulator
In another terminal:
```bash
# For iOS
npm run ios

# For Android
npm run android
```

## Environment Configuration

The app is now set to **development mode**:
- `mode=dev` - Uses local backend
- `API_BASE_URL=http://localhost:5001/api/v1/customer` - Points to local API

To switch to production, edit `.env`:
```
mode=prod
API_BASE_URL=https://api.selorg.com/api/v1/customer
```

## What Was Fixed

✅ **Watchman recrawl warning** - Cleared watch cache
✅ **Missing native modules** - Added graceful fallbacks in NetworkContext
✅ **TypeError: Cannot read property 'subscribe'** - Fixed undefined module checks

## Key Changes Made

1. **NetworkContext.tsx** - Safe module availability checking
2. **App.tsx** - Added native module status logging
3. **.env** - Changed to development mode for local testing
4. **nativeModuleCheck.ts** - New utility for module validation

## Troubleshooting

See `EXPO_TROUBLESHOOTING.md` for detailed troubleshooting steps.

### Common Issues

| Issue | Solution |
|-------|----------|
| App still crashes on startup | Clear Metro cache: `npm start -- --reset-cache` |
| Simulator shows blank white screen | Restart app: Kill simulator and run `npm run ios` again |
| Network errors | Make sure backend API is running on `localhost:5001` |
| Module not found errors | Run `npm install` and clear caches |

## Backend Connection

For local development, ensure your backend is running:
```bash
# In the backend directory
npm start  # Should run on port 5001
```

The app will connect to `http://localhost:5001/api/v1/customer`

## Development Tips

- Use React Native Debugger for better debugging experience
- Check Expo CLI logs for detailed error messages
- Keep the dev server running in one terminal, run app in another
- Use `npm start -- --web` to test on web browser first
