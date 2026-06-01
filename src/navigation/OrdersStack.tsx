import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { OrdersStackParamList } from '../types/navigation';
import MyOrders from '../screens/MyOrders';
import OrderCanceledDetails from '../screens/OrderCanceledDetails';
import OrderSuccessfulDetails from '../screens/OrderSuccessfulDetails';
import RateOrder from '../screens/RateOrder';
import OrderStatusMain from '../screens/OrderStatusMain';
import OrderReceived from '../screens/OrderReceived';
import OrderStatusDetails from '../screens/OrderStatusDetails';
import OrderItemsDetails from '../screens/OrderItemsDetails';
import OrderChat from '../screens/OrderChat';

const Stack = createNativeStackNavigator<OrdersStackParamList>();

const OrdersStack: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="MyOrders"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="MyOrders" component={MyOrders} />
      <Stack.Screen name="OrderCanceledDetails" component={OrderCanceledDetails} />
      <Stack.Screen name="OrderSuccessfulDetails" component={OrderSuccessfulDetails} />
      <Stack.Screen name="RateOrder" component={RateOrder} />
      <Stack.Screen name="OrderStatusMain" component={OrderStatusMain} />
      <Stack.Screen name="OrderReceived" component={OrderReceived} />
      <Stack.Screen name="OrderStatusDetails" component={OrderStatusDetails} />
      <Stack.Screen name="OrderItemsDetails" component={OrderItemsDetails} />
      <Stack.Screen name="OrderChat" component={OrderChat} />
    </Stack.Navigator>
  );
};

export default OrdersStack;

