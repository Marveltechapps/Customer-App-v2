import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import Home from '../screens/Home';
import CategoriesExpo from '../screens/CategoriesExpo';
import Checkout from '../screens/Checkout';
import BottomNavigationBar from '../components/layout/BottomNavigationBar';
import type { MainTabParamList } from '../types/navigation';
import { useNotificationDeepLink } from '../hooks/useNotificationDeepLink';

const Tab = createBottomTabNavigator<MainTabParamList>();

// Custom tab bar component that uses our BottomNavigationBar
function CustomTabBar({ state, descriptors, navigation }: any) {
  // Hide bottom navigation when Cart tab is active
  const isCartActive = state.routes[state.index].name === 'Cart';
  
  // Don't render bottom navigation when Cart is active
  if (isCartActive) {
    return null;
  }
  
  return (
    <BottomNavigationBar
      activeTab={
        state.routes[state.index].name === 'Home'
          ? 'home'
          : state.routes[state.index].name === 'Categories'
          ? 'shop'
          : 'cart'
      }
      onHomePress={() => {
        const event = navigation.emit({
          type: 'tabPress',
          target: 'Home',
          canPreventDefault: true,
        });

        if (!event.defaultPrevented) {
          navigation.navigate('Home');
        }
      }}
      onShopPress={() => {
        const event = navigation.emit({
          type: 'tabPress',
          target: 'Categories',
          canPreventDefault: true,
        });

        if (!event.defaultPrevented) {
          navigation.navigate('Categories');
        }
      }}
      onCartPress={() => {
        const event = navigation.emit({
          type: 'tabPress',
          target: 'Cart',
          canPreventDefault: true,
        });

        if (!event.defaultPrevented) {
          navigation.navigate('Cart');
        }
      }}
    />
  );
}

const MainTabNavigator: React.FC = () => {
  useNotificationDeepLink();
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home" component={Home} />
      <Tab.Screen name="Categories" component={CategoriesExpo} />
      <Tab.Screen name="Cart" component={Checkout} />
    </Tab.Navigator>
  );
};

export default MainTabNavigator;

