import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { OrdersStackParamList } from '../types/navigation';
import OrderStatusMain from '../screens/OrderStatusMain';
import OrderReceived from '../screens/OrderReceived';
import OrderStatusDetails from '../screens/OrderStatusDetails';
import OrderItemsDetails from '../screens/OrderItemsDetails';

const Stack = createNativeStackNavigator<OrdersStackParamList>();

const OrderStatusStack: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="OrderStatusMain"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="OrderStatusMain" component={OrderStatusMain} />
      <Stack.Screen name="OrderReceived" component={OrderReceived} />
      <Stack.Screen name="OrderStatusDetails" component={OrderStatusDetails} />
      <Stack.Screen name="OrderItemsDetails" component={OrderItemsDetails} />
    </Stack.Navigator>
  );
};

export default OrderStatusStack;

