import { useCallback, useRef } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { RootStackNavigationProp } from '../types/navigation';
import { useUser } from '../contexts/UserContext';
import {
  navigateToLoginForProtectedScreen,
  type AuthReturnTo,
} from '../navigation/authNavigation';

/**
 * Route guard: keeps unauthenticated users off a protected screen.
 * Redirects to Login with returnTo so post-login navigation can resume.
 */
export function useRequireAuth(returnTo: AuthReturnTo) {
  const navigation = useNavigation<RootStackNavigationProp>();
  const { isAuthenticated, isRestoring } = useUser();
  const redirectedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      redirectedRef.current = false;
      if (isRestoring) return;
      if (isAuthenticated) return;
      if (redirectedRef.current) return;
      redirectedRef.current = true;
      navigateToLoginForProtectedScreen(navigation, { returnTo });
    }, [isAuthenticated, isRestoring, navigation, returnTo]),
  );

  return {
    isAllowed: isAuthenticated,
    isChecking: isRestoring,
  };
}
