# Worldline UPI Payment Issue - Comprehensive Root Cause & Solution

## Issue Summary

UPI payments were failing with error: **"Please select other payment mode, banks are unavailable for UPI"**

## Root Causes Identified

### 1. **Critical: Merchant/Environment Enablement (Most Common)**
- **UPI requires merchant boarding with Worldline** - not just API integration
- **Test/sandbox environments may have UPI disabled** even with correct code
- **Current backend uses test merchant `T1113241`** - UPI enablement must be verified with Worldline
- Official source: [Worldline UPI Boarding Process](https://docs.connect.worldline-solutions.com/payment-product/upi)

### 2. **Critical: Platform Constraint (iOS Simulator)**
- **UPI payments REQUIRE a physical device** with actual UPI apps installed (PhonePe, GPay, Paytm, etc.)
- **iOS Simulator cannot run UPI apps** → Worldline SDK detects no available UPI providers → Shows "banks unavailable" error
- This is **expected and correct behavior** - not a bug in your code

### 3. **Android 11+ Package Visibility (Fixed in Latest Build)**
- **Android 11+** restricts app-to-app visibility unless explicitly declared
- **Required**: `<queries>` tag in `AndroidManifest.xml` with UPI intent + explicit package names
- **Fixed**: Added both generic `upi://pay` intent AND explicit package declarations for major UPI apps

### 4. **Parameter Format Issues (Fixed)**
- `paymentMode`: Must be exact case `"UPI"` (not `"upi"`)
- `deviceId`: Must be uppercase `"ANDROIDSH1"` / `"ANDROIDSH2"` (backend sends mixed case `AndroidSH2`)
- Both now normalized client-side before calling SDK

## Fixes Applied

### Fix 1: Android Package Visibility (✅ Applied)

**File**: `customer-app-v1/android/app/src/main/AndroidManifest.xml`

Added comprehensive UPI app declarations per official Android package visibility guidelines:

```xml
<queries>
  <!-- Generic UPI intent (per Worldline docs) -->
  <intent>
    <action android:name="android.intent.action.VIEW"/>
    <data android:scheme="upi" android:host="pay"/>
  </intent>
  
  <!-- Explicit packages for reliable UPI app discovery on Android 11+ -->
  <package android:name="com.phonepe.app"/>
  <package android:name="com.google.android.apps.nbu.paisa.user"/>
  <package android:name="net.one97.paytm"/>
  <package android:name="in.org.npci.upiapp"/>
  <package android:name="com.amazon.mShop.android.shopping"/>
  <package android:name="in.amazon.mShop.android.shopping"/>
  <package android:name="com.freecharge.android"/>
  <package android:name="com.mobikwik_new"/>
</queries>
```

**Source**: 
- [Android Package Visibility](https://developer.android.com/training/package-visibility/declaring)
- Community UPI integration patterns

### Fix 2: Correct paymentMode & deviceId Values (✅ Applied)

**Client** (`customer-app-v1/src/services/payments/worldlineCheckout.ts`):
- Added `canonicalizePaynimoPaymentMode()` function to normalize values
- Maps `"upi"` → `"UPI"`, `"nb"` → `"netBanking"`, etc.
- Added `canonicalizeWorldlineDeviceId()` to ensure uppercase `ANDROIDSH1/ANDROIDSH2`
- Updated type definitions to match official docs

**Backend** (`selorg-dashboard-backend-v1.1/src/customer-backend/services/worldlinePaymentsService.js`):
- Generates mixed-case `AndroidSH2` - client now normalizes to `ANDROIDSH2`

### Fix 3: Enhanced Debug Logging (✅ Applied)

Added comprehensive logging to diagnose issues:
- SDK payload prepared log (line 236-247): Shows `deviceId`, `paymentMode`, `totalAmount`, `platform`
- UPI-specific error logging with possible causes when SDK error callback fires
- Helps distinguish between merchant config issues vs device/app issues

### Fix 4: Platform Detection & User Guidance (✅ Applied)

Added simulator detection in `openWorldlineGateway()`:
```typescript
const isUpiMode = cd?.paymentMode === 'UPI';
const isIosSimulator = Platform.OS === 'ios' && !Constants.isDevice;

if (isUpiMode && isIosSimulator) {
  throw new Error(
    'UPI payments require a real device with UPI apps installed. ' +
    'iOS Simulator does not support UPI. Please test on a physical iPhone/iPad, ' +
    'or use Card payment for testing on simulator.'
  );
}
```

## Testing Instructions

### Critical: Verify Merchant UPI Enablement FIRST

**Before testing code changes**, verify with Worldline:
```
Contact: Worldline India Support / Integration Manager
Question: "Is UPI enabled for test merchant ID T1113241?"
Required info: 
- Merchant ID: T1113241
- Environment: Test/Sandbox vs Production
- Payment mode: UPI
```

**Why**: If UPI is not enabled for this merchant/environment, all UPI payments will fail with "banks unavailable" regardless of code correctness.

### ❌ DO NOT Test UPI on iOS Simulator
- Will always fail with "banks unavailable"
- This is expected behavior

### ✅ Test UPI on Physical Android Device

1. **Install the rebuilt APK** on physical Android device:
   ```bash
   # APK location
   customer-app-v1/android/app/build/outputs/apk/release/app-release.apk
   
   # Install via ADB (USB debugging enabled)
   adb install -r customer-app-v1/android/app/build/outputs/apk/release/app-release.apk
   ```

2. **Ensure UPI apps are installed**: PhonePe, GPay, Paytm, BHIM

3. **Start logcat to capture diagnostics**:
   ```bash
   adb logcat | grep -i "worldline\|upi\|paynimo"
   ```

4. **Try UPI payment** in the app

5. **Check logs for**:
   ```
   Worldline SDK payload prepared
   - deviceId: ANDROIDSH1 or ANDROIDSH2 (must be uppercase)
   - paymentMode: UPI (must be uppercase)
   - merchantId: T1113241
   - platform: android
   ```

### Interpreting Results

| Symptom | Root Cause | Solution |
|---------|-----------|----------|
| "banks unavailable" + logs show correct payload | Merchant not boarded for UPI or test environment restriction | Contact Worldline to enable UPI for merchant `T1113241` |
| "banks unavailable" + logs show `deviceId: AndroidSH2` (mixed case) | Client normalization failed | Report bug with logs |
| "banks unavailable" + logs show `paymentMode: upi` (lowercase) | Client normalization failed | Report bug with logs |
| UPI app picker appears but no apps listed | Android package visibility issue persists | Try adding more explicit `<package>` entries |
| UPI app opens successfully | All issues resolved ✅ | - |

### ✅ Alternative: Test Card Payment on Simulator
- Card payments work fine on simulator
- Use test cards from Worldline sandbox docs

## Environment Configuration

**Backend** (`selorg-dashboard-backend-v1.1/.env`):
```env
# Test merchant credentials
WORLDLINE_MERCHANT_ID=T1113241
WORLDLINE_HASH_ALGO=sh2
WORLDLINE_SALT=8832728874XQPHCF
WORLDLINE_RETURN_URL=https://api.selorg.com/api/v1/customer/payments/worldline/return
```

**Important**: 
- Test merchant may have limited payment mode availability
- Verify UPI enablement with Worldline before assuming code issues
- Production merchant will require different credentials and enablement

## Android Considerations

Android requires:
1. **Physical device** with Android 11+ (or emulator with Play Store)
2. **UPI apps installed** (PhonePe, GPay, etc.)
3. **`<queries>` declarations** in AndroidManifest.xml (✅ now complete)
4. **USB debugging enabled** for `adb` access (for log capture)

## File Changes Summary

| File | Change |
|------|--------|
| `customer-app-v1/android/app/src/main/AndroidManifest.xml` | • Added explicit `<package>` declarations for UPI apps<br>• Per Android 11+ package visibility requirements |
| `customer-app-v1/src/services/payments/worldlineCheckout.ts` | • Added `canonicalizePaynimoPaymentMode()`<br>• Added `canonicalizeWorldlineDeviceId()`<br>• Enhanced UPI error logging<br>• iOS simulator detection |
| `customer-app-v1/src/screens/Payment.tsx` | • Pass `"UPI"` instead of `"upi"` |
| `selorg-dashboard-backend-v1.1/src/customer-backend/services/worldlinePaymentsService.js` | • Generates mixed-case deviceId (client normalizes) |

## Official Documentation References

1. **Paynimo React Native Params**: https://www.paynimo.com/paynimocheckout/docs/
   - Lists exact `paymentMode` values (case-sensitive)
   - AndroidManifest `<queries>` requirements

2. **Worldline React Native SDK**: https://github.com/Worldline-ePayments-India/react-native-weipl-checkout
   - Official wrapper implementation
   - deviceId format requirements

3. **Worldline UPI Boarding**: https://docs.connect.worldline-solutions.com/payment-product/upi
   - Merchant onboarding requirements for UPI
   - Test vs production enablement

4. **Android Package Visibility**: https://developer.android.com/training/package-visibility/declaring
   - Android 11+ intent query requirements

5. **UPI Linking Specs**: https://www.npci.org.in/sites/all/themes/npcl/images/PDF/UPI_Linking_Specs_ver_1.5.1.pdf
   - Why physical device is mandatory for UPI

## Next Steps (Priority Order)

1. **VERIFY MERCHANT ENABLEMENT** (contact Worldline about test merchant `T1113241` UPI support)
2. **Install rebuilt APK** on physical Android device
3. **Capture `adb logcat`** during UPI payment attempt
4. **Share logs** if issue persists - logs will show whether it's merchant config or app discovery

## Known Limitations & Expected Behavior

- ❌ UPI will never work on iOS Simulator (by design)
- ❌ UPI will never work on base Android Emulator without Play Store
- ❌ UPI may not work in test/sandbox environments if merchant not boarded for UPI
- ✅ UPI works on physical devices with UPI apps installed AND merchant properly configured
- ✅ Card payments work everywhere (simulator + device)

## Troubleshooting Decision Tree

```
"banks unavailable for UPI" error
├─ On iOS Simulator?
│  └─ EXPECTED - use physical device
├─ On Android physical device?
│  ├─ Check logs: correct deviceId/paymentMode?
│  │  ├─ NO → Code bug (report with logs)
│  │  └─ YES → Check merchant enablement
│  │     ├─ Merchant not boarded for UPI?
│  │     │  └─ Contact Worldline to enable UPI
│  │     └─ Merchant enabled but still failing?
│  │        └─ Check UPI apps installed + package visibility
└─ Other platform → Report to development team
```
