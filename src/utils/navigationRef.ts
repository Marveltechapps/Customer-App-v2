import { NavigationContainerRef, CommonActions } from '@react-navigation/native';
import type { RootStackParamList } from '../types/navigation';
import { APP_LAUNCH_ID, hasSplashCompletedThisSession, markSplashCompleted } from '../constants/appLaunch';
import { resolveNotificationNavigation } from './resolveNotificationNavigation';

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

/**
 * Login is allowed after splash has run this session, or when Splash stamped the route.
 * Never bounce Login → Splash → Login (that caused the continuous splash loop).
 */
export function isLoginAuthorizedFromSplash(fromSplash?: string): boolean {
  if (hasSplashCompletedThisSession()) return true;
  return fromSplash === APP_LAUNCH_ID || typeof fromSplash === 'string';
}

/** Go to Login without replaying Splash (splash already ran on cold start). */
export function navigateToLoginScreen(
  navigation: { replace: (name: keyof RootStackParamList, params?: any) => void }
) {
  markSplashCompleted();
  navigation.replace('Login', { fromSplash: APP_LAUNCH_ID });
}

/** Session expired / logout — clear user and reset to Login (not Splash). */
export function resetToLogin() {
  _onLogout?.();
  markSplashCompleted();
  if (!_navRef?.isReady()) return;
  _navRef.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: 'Login', params: { fromSplash: APP_LAUNCH_ID } }],
    })
  );
}

export function navigateFromNotification(data: Record<string, any> | undefined) {
  if (!data || !_navRef?.isReady()) return;

  const target = resolveNotificationNavigation({
    type: typeof data.type === 'string' ? data.type : undefined,
    orderId: typeof data.orderId === 'string' ? data.orderId : undefined,
    ...data,
  });
  if (!target) return;

  if (target.screen === 'Payment') {
    _navRef.navigate('Payment', target.params);
    return;
  }
  _navRef.navigate(target.screen as any);
}
