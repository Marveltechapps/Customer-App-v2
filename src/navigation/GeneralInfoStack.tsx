import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { GeneralInfoStackParamList } from '../types/navigation';
import GeneralInfo from '../screens/GeneralInfo';
import TermsAndConditions from '../screens/TermsAndConditions';
import PrivacyPolicy from '../screens/PrivacyPolicy';

const Stack = createNativeStackNavigator<GeneralInfoStackParamList>();

const GeneralInfoStack: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="GeneralInfo"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="GeneralInfo" component={GeneralInfo} />
      <Stack.Screen name="TermsAndConditions" component={TermsAndConditions} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicy} />
    </Stack.Navigator>
  );
};

export default GeneralInfoStack;

