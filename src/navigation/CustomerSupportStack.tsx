import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { CustomerSupportStackParamList } from '../types/navigation';
import CustomerSupport from '../screens/CustomerSupport';
import HelpSubSection from '../screens/HelpSubSection';
import ContactSupport from '../screens/ContactSupport';
import MySupportTickets from '../screens/MySupportTickets';
import SupportTicketDetail from '../screens/SupportTicketDetail';
import GeneralChat from '../screens/GeneralChat';

const Stack = createNativeStackNavigator<CustomerSupportStackParamList>();

const CustomerSupportStack: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="CustomerSupport"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="CustomerSupport" component={CustomerSupport} />
      <Stack.Screen name="HelpSubSection" component={HelpSubSection} />
      <Stack.Screen name="ContactSupport" component={ContactSupport} />
      <Stack.Screen name="MySupportTickets" component={MySupportTickets} />
      <Stack.Screen name="SupportTicketDetail" component={SupportTicketDetail} />
      <Stack.Screen name="GeneralChat" component={GeneralChat} />
    </Stack.Navigator>
  );
};

export default CustomerSupportStack;

