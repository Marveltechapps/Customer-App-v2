import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import HomeFilledIcon from '../icons/HomeFilledIcon';
import HomeOutlinedIcon from '../icons/HomeOutlinedIcon';
import ShopFilledIcon from '../icons/ShopFilledIcon';
import ShopOutlinedIcon from '../icons/ShopOutlinedIcon';
import CartFilledIcon from '../icons/CartFilledIcon';
import CartOutlinedIcon from '../icons/CartOutlinedIcon';

interface BottomNavigationBarProps {
  activeTab?: 'home' | 'shop' | 'cart';
  onHomePress?: () => void;
  onShopPress?: () => void;
  onCartPress?: () => void;
  onCenterPress?: () => void;
}

export default function BottomNavigationBar({
  activeTab = 'home',
  onHomePress,
  onShopPress,
  onCartPress,
  onCenterPress,
}: BottomNavigationBarProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={styles.container}>
        {/* Home Tab */}
        <TouchableOpacity
          style={styles.homeTab}
          onPress={onHomePress}
          activeOpacity={0.7}
        >
          <View style={styles.tabContent}>
            {activeTab === 'home' ? (
              <HomeFilledIcon color="#034703" size={24} />
            ) : (
              <HomeOutlinedIcon color="#0C0C0C" size={24} />
            )}
            <Text
              style={[
                styles.tabText,
                activeTab === 'home' ? styles.activeTabText : styles.inactiveTabText,
              ]}
            >
              HOME
            </Text>
          </View>
        </TouchableOpacity>

        {/* Shop Tab */}
        <TouchableOpacity
          style={styles.shopTab}
          onPress={onShopPress}
          activeOpacity={0.7}
        >
          <View style={styles.shopTabContent}>
            {activeTab === 'shop' ? (
              <ShopFilledIcon color="#034703" size={24} />
            ) : (
              <ShopOutlinedIcon color="#0C0C0C" size={24} />
            )}
            <Text
              style={[
                styles.tabText,
                activeTab === 'shop' ? styles.activeTabText : styles.inactiveTabText,
              ]}
              numberOfLines={1}
            >
              CATEGORY
            </Text>
          </View>
        </TouchableOpacity>

        {/* Cart Tab */}
        <TouchableOpacity
          style={styles.cartTab}
          onPress={onCartPress}
          activeOpacity={0.7}
        >
          <View style={styles.cartTabContent}>
            {activeTab === 'cart' ? (
              <CartFilledIcon color="#034703" size={24} />
            ) : (
              <CartOutlinedIcon color="#0C0C0C" size={24} />
            )}
            <Text
              style={[
                styles.tabText,
                activeTab === 'cart' ? styles.activeTabText : styles.inactiveTabText,
              ]}
            >
              CART
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FFFFFF',
  },
  container: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    height: 60,
    paddingHorizontal: 0,
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 4, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 0.4,
      },
    }),
  },
  homeTab: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingVertical: 0,
    gap: 4,
    flex: 1,
    height: '100%',
    alignSelf: 'stretch',
  },
  tabContent: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    width: '100%',
  },
  shopTab: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 0,
    height: '100%',
    gap: 4,
    flex: 1,
    alignSelf: 'stretch',
    paddingVertical: 0,
  },
  shopTabContent: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    width: '100%',
  },
  cartTab: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 0,
    height: '100%',
    gap: 4,
    flex: 1,
    alignSelf: 'stretch',
  },
  cartTabContent: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    width: '100%',
  },
  tabText: {
    fontFamily: 'Inter',
    fontSize: 10,
    lineHeight: 14, // 1.4em
    textAlign: 'center',
    textTransform: 'uppercase',
    flexShrink: 0,
    overflow: 'visible',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  activeTabText: {
    fontWeight: '600',
    color: '#034703',
  },
  inactiveTabText: {
    fontWeight: '400',
    color: '#0C0C0C',
  },
});

