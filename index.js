/**
 * @format
 */

import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { registerRootComponent } from 'expo';
import App from './App';
import { registerFcmBackgroundMessageHandler } from './src/services/notifications/fcmMessagingHandlers';

// RNFB: background/quit data handlers must register before the React tree mounts.
registerFcmBackgroundMessageHandler();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
