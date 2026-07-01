import React, { Suspense, useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, InteractionManager } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import ErrorBoundary from '../components/common/ErrorBoundary';
import ScreenErrorFallback from '../components/common/ScreenErrorFallback';

// Critical screens - load immediately
import SplashScreen from '../screens/SplashScreen';
import NoInternet from '../screens/NoInternet';
import Login from '../screens/Login';
import Home from '../screens/Home'; // Direct import to match MainTabNavigator
import CategoryProducts from '../screens/CategoryProducts';
// Lazy load other screens for better performance
const SettingsScreen = React.lazy(() => import('../screens/SettingsScreen'));
const Onboarding = React.lazy(() => import('../screens/Onboarding'));
const OTPVerification = React.lazy(() => import('../screens/OTPVerification'));
const VerificationSuccess = React.lazy(() => import('../screens/VerificationSuccess'));
const LocationPermission = React.lazy(() => import('../screens/LocationPermission'));
const MainTabNavigator = React.lazy(() => import('./MainTabNavigator'));
const OrderStatusStack = React.lazy(() => import('./OrderStatusStack'));
const OrdersStack = React.lazy(() => import('./OrdersStack'));
const CustomerSupportStack = React.lazy(() => import('./CustomerSupportStack'));
const LocationStack = React.lazy(() => import('./LocationStack'));
const RefundsStack = React.lazy(() => import('./RefundsStack'));
const Profile = React.lazy(() => import('../screens/Profile'));
const GeneralInfoStack = React.lazy(() => import('./GeneralInfoStack'));
const Notifications = React.lazy(() => import('../screens/Notifications'));
const Checkout = React.lazy(() => import('../screens/Checkout'));
const Payment = React.lazy(() => import('../screens/Payment'));
const PaymentSuccess = React.lazy(() => import('../screens/PaymentSuccess'));
const Coupons = React.lazy(() => import('../screens/Coupons'));
const Category = React.lazy(() => import('../screens/Category'));
const Search = React.lazy(() => import('../screens/Search'));
const SearchResults = React.lazy(() => import('../screens/SearchResults'));
const ProductDetail = React.lazy(() => import('../screens/ProductDetail'));
const BannerDetail = React.lazy(() => import('../screens/BannerDetail'));
const TinyTimmies = React.lazy(() => import('../screens/TinyTimmies'));
const CategoriesExpo = React.lazy(() => import('../screens/CategoriesExpo'));
const Wallet = React.lazy(() => import('../screens/Wallet'));
const DynamicPage = React.lazy(() => import('../screens/DynamicPage'));
const CollectionProducts = React.lazy(() => import('../screens/CollectionProducts'));
const AdminCms = React.lazy(() => import('../screens/admin/cms/CmsScreen'));

const LoadingFallback = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' }}>
    <ActivityIndicator size="large" color="#034703" />
  </View>
);

// Helper function to create lazy screen wrapper with error boundary
const createLazyScreen = (
  LazyComponent: React.LazyExoticComponent<React.ComponentType<any>>,
  screenName?: string
) => {
  const LazyScreen = (props: any) => {
    const [retryKey, setRetryKey] = useState(0);

    return (
      <ErrorBoundary
        key={retryKey}
        fallback={
          <ScreenErrorFallback onRetry={() => setRetryKey((k) => k + 1)} />
        }
        onError={(error, errorInfo) => {
          console.error(`Error in lazy-loaded screen: ${screenName || 'Unknown'}`, error, errorInfo);
        }}
      >
        <Suspense fallback={<LoadingFallback />}>
          <LazyComponent {...props} />
        </Suspense>
      </ErrorBoundary>
    );
  };

  LazyScreen.displayName = screenName ? `LazyScreen(${screenName})` : 'LazyScreen';
  return LazyScreen;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
  useEffect(() => {
    // Prewarm commonly opened settings routes so first open feels instant.
    const task = InteractionManager.runAfterInteractions(() => {
      void import('../screens/SettingsScreen');
      void import('../screens/Profile');
      void import('../screens/Notifications');
      void import('./CustomerSupportStack');
      void import('./LocationStack');
      void import('./OrdersStack');
      void import('./RefundsStack');
      void import('./GeneralInfoStack');
    });
    return () => task.cancel();
  }, []);

  return (
    <View style={styles.container}>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: true,
        }}
      >
        <Stack.Screen 
          name="Splash" 
          component={SplashScreen}
          options={{
            animation: 'none', // No animation for splash screen
            gestureEnabled: false, // Prevent swipe back from splash
          }}
        />
        <Stack.Screen name="Onboarding" component={createLazyScreen(Onboarding, 'Onboarding')} />
        <Stack.Screen name="NoInternet" component={NoInternet} />
        <Stack.Screen name="Login" component={Login} />
        <Stack.Screen name="OTPVerification" component={createLazyScreen(OTPVerification, 'OTPVerification')} />
        <Stack.Screen 
          name="VerificationSuccess" 
          component={createLazyScreen(VerificationSuccess, 'VerificationSuccess')}
          options={{
            animation: 'none', // No animation for success screen
            gestureEnabled: false, // Prevent swipe back
          }}
        />
        <Stack.Screen
          name="LocationPermission"
          component={createLazyScreen(LocationPermission, 'LocationPermission')}
          options={{
            animation: 'slide_from_right',
            gestureEnabled: false,
          }}
        />
        <Stack.Screen 
          name="MainTabs" 
          component={createLazyScreen(MainTabNavigator, 'MainTabs')}
          options={{
            headerShown: false,
            gestureEnabled: false, // Prevent swipe back from main tabs
          }}
        />
        <Stack.Screen name="Checkout" component={createLazyScreen(Checkout, 'Checkout')} />
        <Stack.Screen name="Payment" component={createLazyScreen(Payment, 'Payment')} />
        <Stack.Screen
          name="PaymentSuccess"
          component={createLazyScreen(PaymentSuccess, 'PaymentSuccess')}
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen name="OrderStatus" component={createLazyScreen(OrderStatusStack, 'OrderStatus')} />
        <Stack.Screen name="Settings" component={createLazyScreen(SettingsScreen, 'Settings')} />
        <Stack.Screen name="Orders" component={createLazyScreen(OrdersStack, 'Orders')} />
        <Stack.Screen name="CustomerSupport" component={createLazyScreen(CustomerSupportStack, 'CustomerSupport')} />
        <Stack.Screen name="Addresses" component={createLazyScreen(LocationStack, 'Addresses')} />
        <Stack.Screen name="Refunds" component={createLazyScreen(RefundsStack, 'Refunds')} />
        <Stack.Screen name="Profile" component={createLazyScreen(Profile, 'Profile')} />
        <Stack.Screen name="GeneralInfo" component={createLazyScreen(GeneralInfoStack, 'GeneralInfo')} />
        <Stack.Screen name="Notifications" component={createLazyScreen(Notifications, 'Notifications')} />
        <Stack.Screen name="Coupons" component={createLazyScreen(Coupons, 'Coupons')} />
        <Stack.Screen name="Home" component={Home} />
        <Stack.Screen name="Category" component={createLazyScreen(Category, 'Category')} />
        <Stack.Screen name="Search" component={createLazyScreen(Search, 'Search')} />
        <Stack.Screen name="SearchResults" component={createLazyScreen(SearchResults, 'SearchResults')} />
        <Stack.Screen name="ProductDetail" component={createLazyScreen(ProductDetail, 'ProductDetail')} />
        <Stack.Screen name="CategoryProducts" component={CategoryProducts} />
        <Stack.Screen name="CollectionProducts" component={createLazyScreen(CollectionProducts, 'CollectionProducts')} />
        <Stack.Screen name="DynamicPage" component={createLazyScreen(DynamicPage, 'DynamicPage')} />
        <Stack.Screen name="BannerDetail" component={createLazyScreen(BannerDetail, 'BannerDetail')} />
        <Stack.Screen name="TinyTimmies" component={createLazyScreen(TinyTimmies, 'TinyTimmies')} />
        <Stack.Screen name="CategoriesExpo" component={createLazyScreen(CategoriesExpo, 'CategoriesExpo')} />
        <Stack.Screen name="Wallet" component={createLazyScreen(Wallet, 'Wallet')} />
        <Stack.Screen name="AdminCms" component={createLazyScreen(AdminCms, 'AdminCms')} />
      </Stack.Navigator>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
});

export default AppNavigator;

