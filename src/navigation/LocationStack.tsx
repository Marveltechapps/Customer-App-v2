import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { LocationStackParamList } from '../types/navigation';
import SavedAddressesEmpty from '../screens/location/SavedAddressesEmpty';
import SavedAddressesList from '../screens/location/SavedAddressesList';
import LocationSearch from '../screens/location/LocationSearch';
import LocationSearchResults from '../screens/location/LocationSearchResults';
import MapAddressPin from '../screens/location/MapAddressPin';
import EnterCompleteAddress from '../screens/location/EnterCompleteAddress';

const Stack = createNativeStackNavigator<LocationStackParamList>();

const LocationStack: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="SavedAddressesList"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="SavedAddressesList" component={SavedAddressesList} />
      <Stack.Screen name="SavedAddressesEmpty" component={SavedAddressesEmpty} />
      <Stack.Screen name="LocationSearch" component={LocationSearch} />
      <Stack.Screen name="LocationSearchResults" component={LocationSearchResults} />
      <Stack.Screen name="MapAddressPin" component={MapAddressPin} />
      <Stack.Screen name="EnterCompleteAddress" component={EnterCompleteAddress} />
    </Stack.Navigator>
  );
};

export default LocationStack;

