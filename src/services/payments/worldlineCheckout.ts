import { Platform, NativeModules } from 'react-native';
import WeiplCheckout from 'react-native-weipl-checkout';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { api } from '../api/client';
import { endpoints } from '../api/endpoints';
import { logger } from '@/utils/logger';

type PlatformKey = 'android' | 'ios';

type WorldlineSessionResponse = {
  paymentId: string;
  orderId: string;
  txnId: string;
  attemptNo: number;
  /** Matches server `WORLDLINE_HASH_ALGO` resolution — use with `deviceIdForPlatform` for SDK payload. */
  hashAlgo?: string;
  sessionPayload: any;
};

function extractApiErrorMessage(error: unknown): string | null {
  if (typeof error === 'string') return error;
  if (!error || typeof error !== 'object') return null;
  if ('message' in error && typeof (error as any).message === 'string') return (error as any).message;
  return null;
}

/**
 * Worldline hashes merchantId|txnId|totalAmount|…|mobile|email|…|SALT; the gateway rebuilds that
 * from `consumerData`. Trim inputs so the app sends the same strings the server hashes.
 * SALT/encryption key lives only on the server (`WORLDLINE_SALT`).
 */
/** Always return strings (empty when absent) so API + Paynimo pipe match server hash — never omit or use undefined. */
export function normalizeWorldlineConsumerFields(
  email?: string | null,
  mobile?: string | null
): { consumerEmailId: string; consumerMobileNo: string } {
  const consumerEmailId = email != null && String(email).trim() !== '' ? String(email).trim() : '';
  const consumerMobileNo = mobile != null && String(mobile).trim() !== '' ? String(mobile).trim() : '';
  return { consumerEmailId, consumerMobileNo };
}

export type WorldlinePaymentStatus = {
  orderId: string;
  orderPaymentStatus: 'paid' | 'pending' | 'failed';
  uiState: 'WAITING_FOR_PAYMENT' | 'VERIFYING' | 'PAID' | 'FAILED' | 'PENDING_VERIFICATION' | 'RETRY_AVAILABLE' | 'UNKNOWN';
  recommendedAction: 'NONE' | 'CREATE_SESSION' | 'GO_TO_ORDER' | 'POLL_STATUS' | 'CONTACT_SUPPORT' | 'RETRY_PAYMENT' | 'OPEN_GATEWAY';
  latestPayment: {
    txnId: string;
    attemptNo: number;
    status: 'created' | 'initiated' | 'success' | 'failed' | 'cancelled' | 'pending' | 'unknown';
    statusCode: string;
    statusMessage: string;
    verificationError: 'hash_mismatch' | 'amount_mismatch' | 'none';
    isExpired: boolean;
    updatedAt: string;
  } | null;
};

function getPlatform(): PlatformKey {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}

/**
 * Must match server `formatWorldlineTxnAmount` (worldlinePaymentsService.js).
 * Paynimo recomputes the request hash from consumerData; amounts must be two-decimal strings
 * or the native bridge may send JSON numbers (10) instead of "10.00" → Hash_Validation_fail.
 */
function formatWorldlineAmountForSdk(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return '0.00';
  return (Math.round(n * 100) / 100).toFixed(2);
}

function canonicalizePaynimoPaymentMode(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return 'all';
  const lower = raw.toLowerCase();
  if (lower === 'upi') return 'UPI';
  if (lower === 'netbanking' || lower === 'nb') return 'netBanking';
  if (lower === 'card' || lower === 'cards') return 'cards';
  if (lower === 'wallet' || lower === 'wallets') return 'wallets';
  if (lower === 'all') return 'all';
  // Allow other Paynimo modes to pass through (cashCards, NEFTRTGS, etc.)
  return raw;
}

/**
 * Paynimo: sh1 → SHA-256 + AndroidSH1/iOSSH1; sh2 → SHA-512 + AndroidSH2/iOSSH2 (default).
 * Mirrors server `parseAlgoToken` / `resolveWorldlineHashAlgo`.
 */
export function parseClientHashAlgo(raw: unknown): 'sh1' | 'sh2' {
  const a = String(raw ?? '').trim().toLowerCase();
  if (a === 'sh1' || a === 'sha256' || a === 'sha-256') return 'sh1';
  if (a === 'sh2' || a === 'sha512' || a === 'sha-512') return 'sh2';
  return 'sh2';
}

/**
 * Must match server `deviceIdForPlatform` (worldlinePaymentsService.js): AndroidSH1/AndroidSH2, iOSSH1/iOSSH2.
 */
export function deviceIdForPlatform(platform: PlatformKey, hashAlgo?: string | null): string {
  const resolved = parseClientHashAlgo(hashAlgo);
  const isSh1 = resolved === 'sh1';
  if (platform === 'android') return isSh1 ? 'AndroidSH1' : 'AndroidSH2';
  if (platform === 'ios') return isSh1 ? 'iOSSH1' : 'iOSSH2';
  return '';
}

export function normalizeWorldlineDeviceIdCasing(platform: PlatformKey, value: unknown, hashAlgo?: string | null): string {
  const raw = String(value ?? '').trim();
  if (!raw) return deviceIdForPlatform(platform, hashAlgo);
  if (platform === 'android') {
    const u = raw.toUpperCase();
    if (u.endsWith('SH1')) return 'AndroidSH1';
    if (u.endsWith('SH2')) return 'AndroidSH2';
    return raw;
  }
  if (platform === 'ios') {
    const u = raw.toUpperCase();
    if (u.endsWith('SH1') || u.includes('IOSSH1')) return 'iOSSH1';
    if (u.endsWith('SH2') || u.includes('IOSSH2')) return 'iOSSH2';
    return raw;
  }
  return raw;
}

/** Deep-clone and coerce string fields so Android ReadableMap → JSONObject matches hashed pipe values. */
export function normalizeWorldlineSessionPayloadForSdk(sessionPayload: any, hashAlgo?: string | null): any {
  const p = JSON.parse(JSON.stringify(sessionPayload ?? {}));
  const cd = p.consumerData;
  if (!cd) return p;
  const platform = getPlatform();
  cd.merchantId = String(cd.merchantId ?? '');
  cd.txnId = String(cd.txnId ?? '');
  cd.consumerId = String(cd.consumerId ?? '');
  cd.deviceId = normalizeWorldlineDeviceIdCasing(platform, cd.deviceId, hashAlgo);
  cd.token = String(cd.token ?? '');
  cd.currency = String(cd.currency ?? 'INR');
  cd.returnUrl = String(cd.returnUrl ?? '');
  // Paynimo expects specific mode keys (docs list: all, cards, netBanking, UPI, wallets, ...).
  cd.paymentMode = canonicalizePaynimoPaymentMode(cd.paymentMode);
  cd.totalAmount = formatWorldlineAmountForSdk(cd.totalAmount);
  // Paynimo must see '' for missing fields, same as server token pipe — not null/undefined/omitted.
  cd.consumerMobileNo =
    cd.consumerMobileNo != null && String(cd.consumerMobileNo).trim() !== ''
      ? String(cd.consumerMobileNo).trim()
      : '';
  cd.consumerEmailId =
    cd.consumerEmailId != null && String(cd.consumerEmailId).trim() !== ''
      ? String(cd.consumerEmailId).trim()
      : '';
  if (Array.isArray(cd.items)) {
    cd.items = cd.items.map((it: Record<string, unknown>) => ({
      ...it,
      itemId: String(it.itemId ?? ''),
      amount: formatWorldlineAmountForSdk(it.amount),
      comAmt:
        it.comAmt != null && String(it.comAmt).trim() !== ''
          ? formatWorldlineAmountForSdk(it.comAmt)
          : '0.00',
    }));
  }
  return p;
}

function resolveWorldlineSdk(): { open: (payload: any, onSuccess: (res: any) => void, onError: (err: any) => void) => void } | null {
  const moduleRef: any = WeiplCheckout as any;
  
  // Check if native module is available
  // The JS wrapper in react-native-weipl-checkout calls NativeModules.WeiplCheckout.open()
  // if NativeModules.WeiplCheckout is null, it throws "Cannot read property 'open' of null"
  if (!NativeModules.WeiplCheckout) {
    logger.warn('Worldline NativeModule (WeiplCheckout) is missing.', {
      executionEnvironment: Constants.executionEnvironment,
      isExpoGo: Constants.executionEnvironment === ExecutionEnvironment.StoreClient,
    });
    return null;
  }

  if (moduleRef && typeof moduleRef.open === 'function') {
    return moduleRef;
  }
  if (moduleRef?.default && typeof moduleRef.default.open === 'function') {
    return moduleRef.default;
  }
  return null;
}

export async function createWorldlineSession(params: {
  orderId: string;
  consumerEmailId?: string;
  consumerMobileNo?: string;
  paymentMode?: 'all' | 'cards' | 'netBanking' | 'UPI' | 'wallets';
}): Promise<WorldlineSessionResponse> {
  const platform = getPlatform();
  const { consumerEmailId, consumerMobileNo } = normalizeWorldlineConsumerFields(
    params.consumerEmailId,
    params.consumerMobileNo
  );
  // Hash algorithm (sh1=SHA-256 / sh2=SHA-512) is chosen on the server via WORLDLINE_HASH_ALGO
  // so kits can be aligned without shipping a new app build.
  const res = await api.post<WorldlineSessionResponse>(endpoints.payments.worldline.session, {
    orderId: params.orderId,
    platform,
    consumerEmailId,
    consumerMobileNo,
    paymentMode: params.paymentMode,
  });

  if (!res.success || !res.data) {
    throw new Error(extractApiErrorMessage((res as any).error) || 'Unable to start payment session');
  }
  return res.data;
}

/** Safe JSON.stringify for SDK objects (handles non-enumerable / circular edge cases). */
function safeStringifyForLogs(value: unknown): string {
  try {
    return JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? String(v) : v));
  } catch {
    return '[unserializable]';
  }
}

const WORLDLINE_MSG_JSON_KEYS = ['msg', 'message', 'MSG', 'responseMsg', 'respMsg'] as const;

/** Paynimo SDK `msg` pipe order (must match server `WORLDLINE_PAYNIMO_MSG_PIPE_ORDER`). */
const WORLDLINE_PAYNIMO_MSG_PIPE_ORDER = [
  'txn_status',
  'txn_msg',
  'txn_err_msg',
  'clnt_txn_ref',
  'tpsl_bank_cd',
  'tpsl_txn_id',
  'txn_amt',
  'clnt_rqst_meta',
  'tpsl_txn_time',
  'bal_amt',
  'card_id',
  'alias_name',
  'BankTransactionID',
  'mandate_reg_no',
  'token',
  'hash',
] as const;

function parsePipeMsgClient(msgStr: unknown): Record<string, string> | null {
  if (!msgStr || typeof msgStr !== 'string') return null;
  if (msgStr.trimStart().startsWith('{')) return null;
  const parts = msgStr.split('|');
  const need = WORLDLINE_PAYNIMO_MSG_PIPE_ORDER.length;
  if (parts.length < need) return null;

  if (parts.length === need) {
    const parsed: Record<string, string> = {};
    WORLDLINE_PAYNIMO_MSG_PIPE_ORDER.forEach((key, i) => {
      parsed[key] = parts[i] ?? '';
    });
    return parsed;
  }

  const N = parts.length;
  const metaEnd = N - (need - 8);
  return {
    txn_status: parts[0] ?? '',
    txn_msg: parts[1] ?? '',
    txn_err_msg: parts[2] ?? '',
    clnt_txn_ref: parts[3] ?? '',
    tpsl_bank_cd: parts[4] ?? '',
    tpsl_txn_id: parts[5] ?? '',
    txn_amt: parts[6] ?? '',
    clnt_rqst_meta: parts.slice(7, metaEnd).join('|'),
    tpsl_txn_time: parts[N - 8] ?? '',
    bal_amt: parts[N - 7] ?? '',
    card_id: parts[N - 6] ?? '',
    alias_name: parts[N - 5] ?? '',
    BankTransactionID: parts[N - 4] ?? '',
    mandate_reg_no: parts[N - 3] ?? '',
    token: parts[N - 2] ?? '',
    hash: parts[N - 1] ?? '',
  };
}

/** Parse a JSON object from string; returns null if not a plain object. */
export function safeJsonParseWorldlineObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  if (!t) return null;
  try {
    const parsed = JSON.parse(t) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* not JSON */
  }
  return null;
}

/**
 * RN SDK often returns `{ merchant_code, msg }` with Paynimo fields inside `msg`:
 * - pipe-delimited string (most common), or
 * - JSON string (some flows)
 */
export function buildWorldlineCompletePayload(sdkResponse: unknown): {
  response: Record<string, unknown>;
  debug?: { rawSdkJson: string };
} {
  const raw =
    sdkResponse != null && typeof sdkResponse === 'object' && !Array.isArray(sdkResponse)
      ? (sdkResponse as Record<string, unknown>)
      : {};
  let mergedGatewayResponse: Record<string, unknown> = { ...raw };

  for (const k of WORLDLINE_MSG_JSON_KEYS) {
    const val = mergedGatewayResponse[k];
    if (val && typeof val === 'string') {
      const pipeParsed = parsePipeMsgClient(val);
      if (pipeParsed) {
        mergedGatewayResponse = { ...mergedGatewayResponse, ...pipeParsed };
        break;
      }
    }
  }

  /** Re-parse msg/message/etc. on the evolving merged object until stable (nested JSON strings). */
  for (let round = 0; round < 8; round++) {
    const before = safeStringifyForLogs(mergedGatewayResponse);
    for (const k of WORLDLINE_MSG_JSON_KEYS) {
      const parsed = safeJsonParseWorldlineObject(mergedGatewayResponse[k]);
      if (parsed) {
        mergedGatewayResponse = { ...mergedGatewayResponse, ...parsed };
      }
    }
    if (safeStringifyForLogs(mergedGatewayResponse) === before) break;
  }

  const pickTpsl = () =>
    String(
      mergedGatewayResponse.tpsl_txn_id ??
        mergedGatewayResponse.tpslTxnId ??
        mergedGatewayResponse.TPSL_TXN_ID ??
        mergedGatewayResponse.tpsl_txnId ??
        ''
    ).trim();

  const missingTpslTxnId = !pickTpsl();
  const debug = missingTpslTxnId ? { rawSdkJson: safeStringifyForLogs(sdkResponse) } : undefined;

  return { response: mergedGatewayResponse, debug };
}

export async function openWorldlineGateway(
  sessionPayload: any,
  options?: { hashAlgo?: string | null }
): Promise<any> {
  const cd = sessionPayload?.consumerData;
  if (!cd?.token || !cd?.merchantId || !cd?.txnId) {
    logger.error('Worldline session payload missing consumerData fields required by Paynimo', {
      hasToken: !!cd?.token,
      hasMerchantId: !!cd?.merchantId,
      hasTxnId: !!cd?.txnId,
    });
    throw new Error('Invalid payment session. Please try again.');
  }

  // Check for simulator/device constraints for UPI
  const isUpiMode = cd?.paymentMode === 'UPI';
  const isIosSimulator = Platform.OS === 'ios' && !Constants.isDevice;
  
  if (isUpiMode && isIosSimulator) {
    logger.warn('UPI payment attempted on iOS Simulator', {
      paymentMode: cd?.paymentMode,
      platform: Platform.OS,
      isDevice: Constants.isDevice,
    });
    throw new Error(
      'UPI payments require a real device with UPI apps (PhonePe, GPay, etc.) installed. ' +
      'iOS Simulator does not support UPI. Please test on a physical iPhone/iPad with UPI apps, ' +
      'or use Card payment for testing on simulator.'
    );
  }

  const sdk = resolveWorldlineSdk();
  if (!sdk) {
    const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
    const errorMsg = isExpoGo 
      ? 'Payment gateway is not supported in Expo Go. Please use a Development Build or the real app.'
      : 'Payment gateway native module is missing. If you just installed it, please rebuild the app (npx expo run:android/ios).';
    
    logger.error('Worldline SDK is unavailable', {
      platform: Platform.OS,
      isExpoGo,
      hasPayload: !!sessionPayload,
      nativeModuleNames: Object.keys(NativeModules).filter(k => k.toLowerCase().includes('weipl') || k.toLowerCase().includes('checkout')),
    });
    
    throw new Error(errorMsg);
  }

  const payloadForSdk = normalizeWorldlineSessionPayloadForSdk(sessionPayload, options?.hashAlgo);

  logger.info('Worldline SDK payload prepared', {
    hashAlgo: options?.hashAlgo ?? null,
    hasDeviceId: !!payloadForSdk?.consumerData?.deviceId,
    deviceId: payloadForSdk?.consumerData?.deviceId,
    totalAmount: payloadForSdk?.consumerData?.totalAmount,
    hasToken: !!payloadForSdk?.consumerData?.token,
    tokenLength: payloadForSdk?.consumerData?.token?.length,
    paymentMode: payloadForSdk?.consumerData?.paymentMode,
    merchantId: payloadForSdk?.consumerData?.merchantId,
    txnId: payloadForSdk?.consumerData?.txnId,
    platform: Platform.OS,
    isSimulator: Platform.OS === 'ios' && !Constants.isDevice,
  });

  // CRITICAL iOS UPI limitation: UPI requires a real device with UPI apps installed.
  // Simulator will show "banks are unavailable for UPI" because:
  // 1. No UPI apps (PhonePe, GPay, etc.) are installed on simulator
  // 2. UPI intent flow requires real device app switching
  if (Platform.OS === 'ios' && !Constants.isDevice && payloadForSdk?.consumerData?.paymentMode === 'UPI') {
    logger.warn('UPI payment attempted on iOS Simulator - will fail', {
      platform: 'ios',
      isSimulator: true,
      paymentMode: 'UPI',
      note: 'UPI requires real iOS device with UPI apps installed',
    });
    throw new Error(
      'UPI payments require a real iOS device with UPI apps installed (PhonePe, Google Pay, Paytm, etc.). ' +
      'UPI cannot work on iOS Simulator. Please test on a real device or use Cards/Cash payment for simulator testing.'
    );
  }

  return new Promise<any>((resolve, reject) => {
    let timeoutId: any = null;
    let callbackFired = false;

    try {
      logger.info('Calling SDK.open() with payment payload');
      
      timeoutId = setTimeout(() => {
        if (!callbackFired) {
          callbackFired = true;
          logger.error('SDK.open() response timeout - gateway likely frozen', {
            txnId: cd.txnId,
            timeout: 90000,
          });
          reject(new Error('Payment gateway took too long to respond. Please retry or check your internet connection.'));
        }
      }, 90000); // 90 second timeout

      sdk.open(
        payloadForSdk,
        (res: any) => {
          if (callbackFired) {
            logger.warn('SDK success callback fired after timeout or second time', { txnId: cd.txnId });
            return;
          }
          callbackFired = true;
          clearTimeout(timeoutId);

          const resKeys = res && typeof res === 'object' && !Array.isArray(res) ? Object.keys(res as object) : [];
          let responseJson: string;
          try {
            responseJson = JSON.stringify(res);
          } catch {
            responseJson = safeStringifyForLogs(res);
          }
          logger.info('SDK success callback - payment gateway closed (all enumerable keys)', {
            txnId: cd.txnId,
            responseKeyCount: resKeys.length,
            responseKeys: resKeys,
            responseJson,
            txn_status: (res as any)?.txn_status,
            paymentMode: (res as any)?.paymentMode,
          });

          // Validate response has expected fields
          if (!res || typeof res !== 'object') {
            logger.error('SDK returned invalid response', { response: res });
            reject(new Error('Payment gateway returned invalid response. Please try again.'));
            return;
          }

          /* Resolve full native object as-is; merging msg for the API happens in buildWorldlineCompletePayload. */
          resolve(res);
        },
        (err: any) => {
          if (callbackFired) {
            logger.warn('SDK error callback fired after timeout or second time', { txnId: cd.txnId });
            return;
          }
          callbackFired = true;
          clearTimeout(timeoutId);

          logger.error('SDK error callback - user cancelled or gateway error', {
            txnId: cd.txnId,
            errorMessage: err?.message || err,
            errorKeys: err ? Object.keys(err) : [],
            paymentMode: cd.paymentMode,
            platform: Platform.OS,
            deviceId: cd.deviceId,
            merchantId: cd.merchantId,
            fullError: JSON.stringify(err),
          });

          // For UPI-specific errors, log additional context
          if (cd.paymentMode === 'UPI') {
            logger.error('UPI payment failed - merchant enablement or app discovery issue', {
              txnId: cd.txnId,
              errorMessage: err?.message || err,
              possibleCauses: [
                'Merchant not boarded for UPI with Worldline',
                'Test/sandbox environment has UPI disabled',
                'Android 11+ package visibility blocking UPI apps',
                'No UPI apps installed on device',
                'UPI apps not responding to upi://pay intent',
              ],
              merchantId: cd.merchantId,
              deviceId: cd.deviceId,
              platform: Platform.OS,
            });
          }

          // Distinguish user cancellation from actual errors
          const errorMessage = err?.message || String(err || 'Payment gateway error');
          if (errorMessage.toLowerCase().includes('cancel') || errorMessage.toLowerCase().includes('user')) {
            reject(new Error('Payment cancelled by user. Please try again if you wish to complete this order.'));
          } else {
            reject(new Error(errorMessage || 'Payment gateway encountered an error. Please try again.'));
          }
        }
      );
    } catch (e) {
      if (!callbackFired) {
        callbackFired = true;
        clearTimeout(timeoutId);
        logger.error('Crash inside Worldline SDK call', {
          txnId: cd.txnId,
          error: e,
        });
        reject(new Error('The payment gateway crashed. Please try again or use a different payment method.'));
      }
    }
  });
}

export async function completeWorldlinePayment(params: {
  orderId: string;
  txnId: string;
  response: any;
  /** Optional: when `tpsl_txn_id` still missing after merge — server stores under `_clientSdkDebug`. */
  debug?: { rawSdkJson: string };
}): Promise<any> {
  const res = await api.post<any>(endpoints.payments.worldline.complete, params);
  if (!res.success || !res.data) {
    logger.error('Worldline complete failed', { res });
    throw new Error(extractApiErrorMessage((res as any).error) || 'Unable to verify payment');
  }
  return res.data;
}

export async function getWorldlineStatus(orderId: string): Promise<WorldlinePaymentStatus> {
  if (!orderId?.trim()) {
    throw new Error('orderId is required to fetch payment status');
  }

  const res = await api.get<WorldlinePaymentStatus>(
    endpoints.payments.worldline.status,
    { 
      params: { 
        orderId,
        _t: Date.now() // Cache buster to ensure we get fresh status
      } 
    }
  );
  if (!res.success || !res.data) {
    throw new Error(extractApiErrorMessage((res as any).error) || 'Unable to fetch payment status');
  }
  return res.data;
}

export async function pollWorldlineStatus(
  orderId: string,
  onUpdate?: (status: WorldlinePaymentStatus) => void,
  maxAttempts = 10
): Promise<WorldlinePaymentStatus> {
  if (!orderId?.trim()) {
    return {
      orderId,
      orderPaymentStatus: 'unknown' as any,
      uiState: 'UNKNOWN',
      recommendedAction: 'CONTACT_SUPPORT',
      latestPayment: null,
    };
  }

  let attempts = 0;
  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  let lastKnown: WorldlinePaymentStatus | null = null;
  let consecutiveFailures = 0;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const status = await getWorldlineStatus(orderId);
      lastKnown = status;
      consecutiveFailures = 0;
      if (onUpdate) onUpdate(status);

      // Stop if terminal
      if (status.uiState === 'PAID' || status.uiState === 'FAILED' || status.uiState === 'RETRY_AVAILABLE' || status.uiState === 'UNKNOWN') {
        return status;
      }

      // If we've polled at least 3 times and it's still "waiting for payment", 
      // the backend likely hasn't received the callback yet. Transition to pending.
      if (attempts >= 4 && status.uiState === 'WAITING_FOR_PAYMENT') {
        return {
          ...status,
          uiState: 'PENDING_VERIFICATION'
        };
      }

      // If pending or verifying, wait and poll again
      await delay(Math.min(2000 * attempts, 10000)); // Linear backoff
    } catch (err) {
      logger.warn('Polling status attempt failed', { attempts, err });
      consecutiveFailures++;

      // Don't keep the UI stuck forever if we can't reach the backend.
      if (consecutiveFailures >= 3) {
        return (
          lastKnown ?? {
            orderId,
            orderPaymentStatus: 'pending',
            uiState: 'PENDING_VERIFICATION',
            recommendedAction: 'POLL_STATUS',
            latestPayment: null,
          }
        );
      }
    }
  }

  try {
    return await getWorldlineStatus(orderId); // Final check
  } catch (err) {
    logger.warn('Final status check failed', { err });
    return (
      lastKnown ?? {
        orderId,
        orderPaymentStatus: 'pending',
        uiState: 'PENDING_VERIFICATION',
        recommendedAction: 'POLL_STATUS',
        latestPayment: null,
      }
    );
  }
}

/** Legacy wrapper if still used elsewhere, though refactoring callsites is preferred */
export async function startWorldlineCheckout(params: {
  orderId: string;
  consumerEmailId?: string;
  consumerMobileNo?: string;
  paymentMode?: 'all' | 'cards' | 'netBanking' | 'UPI' | 'wallets';
}): Promise<any> {
  const session = await createWorldlineSession(params);
  const sdkResponse = await openWorldlineGateway(session.sessionPayload, { hashAlgo: session.hashAlgo });
  const { response, debug } = buildWorldlineCompletePayload(sdkResponse);
  return await completeWorldlinePayment({
    orderId: params.orderId,
    txnId: session.txnId,
    response,
    ...(debug ? { debug } : {}),
  });
}

