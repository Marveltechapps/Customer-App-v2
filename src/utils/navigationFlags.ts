/**
 * Module-level flags for cross-screen navigation state.
 * Used when passing params through nested navigators is impractical.
 */
export const navigationFlags = {
  /** Set to true by LocationPermission before navigating to MainTabs.
   *  Home checks this to skip auto-showing the location drawer. */
  skipLocationDrawer: false,
};
