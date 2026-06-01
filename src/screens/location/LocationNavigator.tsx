import React, { useState } from 'react';
import SavedAddressesEmpty from './SavedAddressesEmpty';
import SavedAddressesList from './SavedAddressesList';
import LocationSearch from './LocationSearch';
import LocationSearchResults from './LocationSearchResults';
import MapAddressPin from './MapAddressPin';
import EnterCompleteAddress from './EnterCompleteAddress';
import AddressSavedSuccess from './AddressSavedSuccess';

type LocationScreen =
  | 'saved-addresses-empty'
  | 'saved-addresses-list'
  | 'location-search'
  | 'location-search-results'
  | 'map-address-pin'
  | 'enter-complete-address'
  | 'address-saved-success';

interface LocationNavigatorProps {
  initialScreen?: LocationScreen;
  onBackToHelpSupport?: () => void;
}

const SCREEN_MAP: Record<LocationScreen, React.ComponentType<any>> = {
  'saved-addresses-empty': SavedAddressesEmpty,
  'saved-addresses-list': SavedAddressesList,
  'location-search': LocationSearch,
  'location-search-results': LocationSearchResults,
  'map-address-pin': MapAddressPin,
  'enter-complete-address': EnterCompleteAddress,
  'address-saved-success': AddressSavedSuccess,
};

const LocationNavigator: React.FC<LocationNavigatorProps> = ({
  initialScreen = 'saved-addresses-empty',
  onBackToHelpSupport,
}) => {
  const [currentScreen] = useState<LocationScreen>(initialScreen);
  const ScreenComponent = SCREEN_MAP[currentScreen] || SavedAddressesEmpty;
  return <ScreenComponent />;
};

export default LocationNavigator;
