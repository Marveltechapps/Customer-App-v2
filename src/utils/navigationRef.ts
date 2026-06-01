import { NavigationContainerRef, CommonActions } from '@react-navigation/native';
import type { RootStackParamList } from '../types/navigation';
import { APP_LAUNCH_ID } from '../constants/appLaunch';

let _navRef: NavigationContainerRef<RootStackParamList> | null = null;
let _onLogout: (() => void) | null = null;

export function setNavigationRef(ref: NavigationContainerRef<RootStackParamList> | null) {
  _navRef = ref;
}

export function getNavigationRef() {
  return _navRef;
}

/** Register callback to run when session is cleared (e.g. 401). Used by UserContext to clear user state. */
export function setOnLogoutCallback(cb: (() => void) | null) {
  _onLogout = cb;
}

export function isLoginAuthorizedFromSplash(fromSplash?: string): boolean {
  return fromSplash === APP_LAUNCH_ID;
}

/** Always show branded splash, then login (never push Login directly). */
export function navigateToLoginScreen(
  navigation: { replace: (name: 'Splash', params?: RootStackParamList['Splash']) => void }
) {
  navigation.replace('Splash', { next: 'Login' });
}

export function resetToLogin() {
  _onLogout?.();
  if (!_navRef?.isReady()) return;
  _navRef.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: 'Splash', params: { next: 'Login' } }],
    })
  );
}

/** On cold start / reload, force Splash if navigation restored onto Login without a valid launch token. */
export function ensureSplashOnLaunch() {
  if (!_navRef?.isReady()) return;
  const route = _navRef.getCurrentRoute();
  if (route?.name !== 'Login') return;
  const params = route.params as RootStackParamList['Login'];
  if (isLoginAuthorizedFromSplash(params?.fromSplash)) return;
  _navRef.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: 'Splash', params: { next: 'Login' } }],
    })
  );
}

export function navigateFromNotification(data: Record<string, any> | undefined) {
  if (!data || !_navRef?.isReady()) return;

  const type = data.type as string | undefined;
  if (!type) return;

  const ORDER_TYPES = [
    'ORDER_PLACED',
    'ORDER_CONFIRMED',
    'ORDER_PACKED',
    'ORDER_ON_WAY',
    'ORDER_ARRIVED',
    'ORDER_DELIVERED',
    'ORDER_CANCELLED',
    'DELIVERY_DELAYED',
    'MISSING_ITEMS',
  ];

  const REFUND_TYPES = ['REFUND_APPROVED', 'REFUND_COMPLETED', 'REFUND_REJECTED'];

  if (ORDER_TYPES.includes(type)) {
    if (type === 'ORDER_CANCELLED') {
      _navRef.navigate('Orders' as any);
    } else if (type === 'ORDER_DELIVERED') {
      _navRef.navigate('Orders' as any);
    } else {
      _navRef.navigate('OrderStatus' as any);
    }
  } else if (REFUND_TYPES.includes(type)) {
    _navRef.navigate('Refunds' as any);
  } else if (type === 'WALLET_CREDIT') {
    _navRef.navigate('Wallet' as any);
  } else if (type === 'SUPPORT_REPLY') {
    _navRef.navigate('CustomerSupport' as any);
  }
}
