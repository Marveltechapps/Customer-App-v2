/**
 * Loads the Settings screen chunk (menu SVGs + screen tree) during idle time on Home
 * so Profile → Settings opens without waiting on first navigation.
 */
export function prewarmSettingsModule(): void {
  void import('../screens/SettingsScreen');
}
