/**
 * Main Screen - Entry point with complete navigation
 * 
 * This is the main file to view the output. It defaults to the Location section
 * and provides complete navigation for both Help & Support sections and the 
 * Location section with all 7 screens.
 * 
 * Default Screen: Location (Saved Addresses)
 * 
 * Navigation Structure:
 * - LocationNavigator (default/main screen - complete Location flow with 7 screens)
 *   - Saved Addresses (Empty/List)
 *   - Location Search
 *   - Search Results
 *   - Map Address Pin
 *   - Enter Complete Address
 *   - Success Modal
 * - CustomerSupport (Help & Support items)
 *   - HelpSubSection (FAQ screens for each help category)
 * 
 * Location Navigation Flow:
 * 1. Saved Addresses (Empty/List) → 2. Location Search → 3. Search Results
 * → 4. Map Address Pin → 5. Enter Complete Address → 6. Success Modal
 * 
 * Usage:
 * - Import and use this component as the main screen
 * - All navigation flows are handled internally
 * - Ready for React Navigation integration
 * 
 * Example:
 * ```tsx
 * import MainScreen from './src/screens/MainScreen';
 * 
 * function App() {
 *   return <MainScreen onBackPress={() => navigation.goBack()} />;
 * }
 * ```
 */

import React, { useState } from 'react';
import CustomerSupport from './CustomerSupport';
import LocationNavigator from './location/LocationNavigator';

interface MainScreenProps {
  onBackPress?: () => void;
  initialScreen?: 'help-support' | 'location';
}

/**
 * MainScreen Component
 * 
 * This is the primary entry point. It defaults to the Location section and
 * manages navigation between:
 * - LocationNavigator: Complete 7-screen location flow (DEFAULT/MAIN SCREEN)
 * - CustomerSupport: 7 Help & Support categories with FAQ screens
 * 
 * Features:
 * - Defaults to Location screen on load
 * - Complete navigation flow for all screens
 * - Dummy data with API placeholders
 * - TypeScript support
 * - Production-ready structure
 * 
 * All screens are self-contained and ready for API integration.
 */
const MainScreen: React.FC<MainScreenProps> = ({
  onBackPress,
  initialScreen = 'location',
}) => {
  const [currentView, setCurrentView] = useState<'help-support' | 'location'>(
    initialScreen
  );

  const handleLocationNavigation = () => {
    setCurrentView('location');
  };

  const handleBackToHelpSupport = () => {
    setCurrentView('help-support');
  };

  const handleMainBackPress = () => {
    // Navigate to Address page (Location section) when back is pressed from Help & Support
    if (currentView === 'location') {
      handleBackToHelpSupport();
    } else {
      // Always navigate to Location when back is pressed from Help & Support main screen
      setCurrentView('location');
    }
  };

  if (currentView === 'location') {
    return (
      <LocationNavigator
        initialScreen="saved-addresses-empty"
        onBackToHelpSupport={handleBackToHelpSupport}
      />
    );
  }

  return (
    <CustomerSupport />
  );
};

export default MainScreen;

