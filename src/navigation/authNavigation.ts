import { CommonActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { markSplashCompleted } from '../constants/appLaunch';

/** Screens that may be restored after a successful login. */
export type AuthReturnTo = 'Settings';

type AuthNavigation = NativeStackNavigationProp<RootStackParamList>;

/**
 * Send an unauthenticated user to Login while preserving where they intended to go.
 * Uses replace so protected screens (e.g. Settings) cannot remain on the stack.
 */
export function navigateToLoginForProtectedScreen(
  navigation: AuthNavigation,
  options: { returnTo: AuthReturnTo; fromSplash?: string },
): void {
  markSplashCompleted();
  navigation.replace('Login', {
    fromSplash: options.fromSplash ?? options.returnTo.toLowerCase(),
    returnTo: options.returnTo,
  });
}

/**
 * After auth succeeds (or Login detects an existing session), land on MainTabs
 * and optionally open the intended protected screen (Settings).
 */
export function completePostAuthNavigation(
  navigation: AuthNavigation,
  options?: { returnTo?: AuthReturnTo; needsLocation?: boolean },
): void {
  const returnTo = options?.returnTo;
  const needsLocation = options?.needsLocation === true;

  if (needsLocation) {
    navigation.replace('LocationPermission', {
      fromAuth: true,
      ...(returnTo ? { returnTo } : {}),
    });
    return;
  }

  if (returnTo === 'Settings') {
    navigation.dispatch(
      CommonActions.reset({
        index: 1,
        routes: [{ name: 'MainTabs' }, { name: 'Settings' }],
      }),
    );
    return;
  }

  navigation.replace('MainTabs');
}
