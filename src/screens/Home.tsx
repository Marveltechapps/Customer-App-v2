import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, StatusBar, Text, ScrollView, Animated, NativeScrollEvent, NativeSyntheticEvent, Easing, TouchableOpacity, InteractionManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useCatalogCache } from '../contexts/CatalogCacheContext';
import type { RootStackNavigationProp } from '../types/navigation';
import TopSection from '../components/layout/TopSection';
import FloatingCartBar from '../components/features/cart/FloatingCartBar';
import ErrorBoundary from '../components/common/ErrorBoundary';
import LocationSelectDrawer from '../components/features/location/LocationSelectDrawer';
import { blockRegistry } from '../blocks/blockRegistry';
import { addressService, type Address } from '../services/address/addressService';
import { subscribeAddressesChanged } from '../utils/addressRefresh';
import {
  addressToLocationData,
  formatAddressLines,
  pickDefaultAddress,
} from '../utils/addressLocationSync';
import { useLocation } from '../contexts/LocationContext';
import { useAppConfig } from '../contexts/AppConfigContext';
import { useCart } from '@/contexts/CartContext';
import { navigationFlags } from '../utils/navigationFlags';
import { getEnvConfigSafe } from '../config/env';
import CmsRemoteImage from '../components/common/CmsRemoteImage';
import { Theme } from '../constants/Theme';
import { prewarmSettingsModule } from '../utils/prewarmSettingsModule';

const MAX_SECTIONS = 20;

export default function HomeScreen() {
  const navigation = useNavigation<RootStackNavigationProp>();
  const { appConfig } = useAppConfig();
  const { getTotalItems } = useCart();
  const cartItemCount = getTotalItems();
  const scrollViewRef = useRef<ScrollView>(null);
  const [videoLayout, setVideoLayout] = useState({ y: 0, height: 0 });
  const [isVideoVisible, setIsVideoVisible] = useState(true);
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const { location: contextLocation, setLocation, assignedStore } = useLocation();
  const [showLocationDrawer, setShowLocationDrawer] = useState(false);
  const hasShownDrawerRef = useRef(false);

  // Staggered animations for each section (length = MAX_SECTIONS)
  const sectionAnimations = useRef(
    Array.from({ length: MAX_SECTIONS }, () => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(30),
    }))
  ).current;
  const {
    bootstrapData,
    cmsBlocks,
    homeConfig,
    homeCoupons,
    homeLoading,
    homeError,
    ensureCatalogLoaded,
    reloadCatalog,
  } = useCatalogCache();
  const [defaultAddress, setDefaultAddress] = useState<Address | null>(null);
  const [addressSynced, setAddressSynced] = useState(false);

  const syncDeliveryAddressFromServer = useCallback(async () => {
    try {
      const res = await addressService.getAll();
      if (!res?.success || !Array.isArray(res.data) || res.data.length === 0) {
        setDefaultAddress(null);
        await setLocation(null);
        return false;
      }
      const selected = pickDefaultAddress(res.data);
      if (!selected) {
        setDefaultAddress(null);
        await setLocation(null);
        return false;
      }
      setDefaultAddress(selected);
      await setLocation(addressToLocationData(selected));
      return true;
    } catch {
      // Transient errors: do not wipe; keep last synced defaultAddress if any.
    } finally {
      setAddressSynced(true);
    }
  }, [setLocation]);

  useFocusEffect(
    useCallback(() => {
      void syncDeliveryAddressFromServer();
    }, [syncDeliveryAddressFromServer]),
  );

  useEffect(() => {
    return subscribeAddressesChanged(() => {
      void syncDeliveryAddressFromServer();
    });
  }, [syncDeliveryAddressFromServer]);

  // Show location drawer once on first mount only when user has no saved addresses.
  useEffect(() => {
    if (!hasShownDrawerRef.current) {
      hasShownDrawerRef.current = true;
      const skipDrawer = navigationFlags.skipLocationDrawer;
      navigationFlags.skipLocationDrawer = false;
      if (skipDrawer) {
        return;
      }
      void (async () => {
        const hasAddresses = await syncDeliveryAddressFromServer();
        if (!hasAddresses) {
          setTimeout(() => setShowLocationDrawer(true), 600);
        }
      })();
    }
  }, [syncDeliveryAddressFromServer]);

  const hasSavedDeliveryAddress = Boolean(defaultAddress?.line1?.trim());
  const formattedAddress = hasSavedDeliveryAddress
    ? formatAddressLines(defaultAddress)
    : 'Add location';
  const deliveryDestinationLabel = hasSavedDeliveryAddress
    ? defaultAddress?.label || defaultAddress?.city || 'Home'
    : contextLocation?.city || contextLocation?.area || 'your area';

  // Animate sections when screen is focused
  const hasAnimatedOnceRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      const prewarmTask = InteractionManager.runAfterInteractions(() => {
        prewarmSettingsModule();
      });

      // Screen is focused
      setIsScreenFocused(true);
      if (!hasAnimatedOnceRef.current) {
        hasAnimatedOnceRef.current = true;
        // Reset all animation values
        sectionAnimations.forEach((anim) => {
          anim.opacity.setValue(0);
          anim.translateY.setValue(30);
        });

        // Animate all sections with staggered delays
        const animations = sectionAnimations.map((anim, index) => {
          return Animated.parallel([
            Animated.timing(anim.opacity, {
              toValue: 1,
              duration: 500,
              delay: index * 80,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(anim.translateY, {
              toValue: 0,
              duration: 500,
              delay: index * 80,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]);
        });
        Animated.parallel(animations).start();
      }

      // Cleanup when screen loses focus
      return () => {
        prewarmTask.cancel();
        setIsScreenFocused(false);
      };
    }, [])
  );

  const handleProfilePress = () => {
    navigation.navigate('Settings');
  };

  const handleLocationPress = () => {
    setShowLocationDrawer(true);
  };

  const handleAddressSelect = useCallback(
    (address: Address) => {
      setDefaultAddress(address);
      void setLocation(addressToLocationData(address));
      setShowLocationDrawer(false);
    },
    [setLocation],
  );

  const handleAddNewAddress = useCallback(() => {
    setShowLocationDrawer(false);
    navigation.navigate('Addresses');
  }, [navigation]);

  const handleVideoLayout = (layout: { y: number; height: number }) => {
    setVideoLayout(layout);
    // Video is initially visible when layout is measured (at top of screen)
    if (layout.y === 0 || layout.y < 100) {
      setIsVideoVisible(true);
    }
  };

  useEffect(() => {
    void ensureCatalogLoaded();
  }, [ensureCatalogLoaded]);

  const homeImageLayoutHints = useMemo(() => {
    const blocks = cmsBlocks || [];
    return {
      firstBannerBlockIndex: blocks.findIndex(
        (b: { type?: string }) => b?.type === 'heroBanner' || b?.type === 'bannerCarousel'
      ),
      firstCategoryGridBlockIndex: blocks.findIndex((b: { type?: string }) => b?.type === 'categoryGrid'),
      firstCarouselBlockIndex: blocks.findIndex(
        (b: { type?: string }) => b?.type === 'productCarousel' || b?.type === 'collectionCarousel'
      ),
    };
  }, [cmsBlocks]);
  const { apiBaseUrl, env } = getEnvConfigSafe();
  const isDevBackend = env === 'development' || /localhost|127\.0\.0\.1/i.test(apiBaseUrl);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    const screenHeight = event.nativeEvent.layoutMeasurement.height;
    
    // Only calculate visibility if video layout is known
    if (videoLayout.height === 0) {
      return;
    }
    
    // Calculate if video is visible
    const videoTop = videoLayout.y;
    const videoBottom = videoLayout.y + videoLayout.height;
    const visibleTop = scrollY;
    const visibleBottom = scrollY + screenHeight;
    
    // Video is visible if any part of it is in the viewport
    const isVisible = videoBottom > visibleTop && videoTop < visibleBottom;
    setIsVideoVisible(isVisible);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.animatedContainer}>
          <ScrollView 
            ref={scrollViewRef}
            style={styles.scrollView} 
            contentContainerStyle={[
              styles.scrollContent,
              // Keep banner dot rows above the floating cart + tab bar (cart is position:absolute, zIndex 1000)
              cartItemCount > 0 && { paddingBottom: 112 },
            ]}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            scrollEnabled={!showLocationDrawer}
            nestedScrollEnabled
          >
            {/* Top Section with Input, Location, Profile and Video */}
            <ErrorBoundary
              fallback={
                <View style={{ padding: 16, backgroundColor: '#FFFFFF', minHeight: 200 }}>
                  <Text style={{ color: '#666', textAlign: 'center' }}>Top section unavailable</Text>
                </View>
              }
            >
              <TopSection
                deliveryType={`${homeConfig?.deliveryTypeLabel ?? 'Delivery'} in ${assignedStore ? '10-15 mins' : '10 mins'} to ${deliveryDestinationLabel}`}
                address={addressSynced ? formattedAddress : '…'}
                searchPlaceholder={homeConfig?.searchPlaceholder ?? appConfig.search?.placeholder ?? 'Search for products'}
                heroVideoUrl={homeConfig?.heroVideoUrl ?? undefined}
                onLocationPress={handleLocationPress}
                onProfilePressIn={prewarmSettingsModule}
                onProfilePress={handleProfilePress}
                onLayout={handleVideoLayout}
                isVisible={isVideoVisible}
                isScreenFocused={isScreenFocused}
              />
            </ErrorBoundary>

            {/* Coupon Banner Carousel */}
            {homeCoupons.length > 0 && (
              <View style={styles.couponCarouselContainer}>
                <Animated.FlatList
                  data={homeCoupons}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  pagingEnabled={false}
                  snapToInterval={312 + 12} // width + gap
                  decelerationRate="fast"
                  contentContainerStyle={styles.couponCarouselContent}
                  keyExtractor={(item) => item._id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.couponBannerCard, { borderColor: item.themeColor || '#2A7D4F' }]}
                      onPress={() => {
                        navigation.navigate('MainTabs', {
                          screen: 'Cart',
                          params: {
                            appliedCoupon: {
                              code: item.code,
                              discount: item.discountValue,
                            },
                          },
                        });
                      }}
                      activeOpacity={0.9}
                    >
                      {item.bannerImageUrl ? (
                        <CmsRemoteImage
                          uri={item.bannerImageUrl}
                          style={styles.couponBannerImage}
                          contentFit="cover"
                          priority="normal"
                          recyclingKey={`coupon-${item._id}`}
                        />
                      ) : (
                        <View style={[styles.couponTextCard, { backgroundColor: (item.themeColor || '#2A7D4F') + '15' }]}>
                          <Text style={[styles.couponDisplayName, { color: item.themeColor || '#2A7D4F' }]}>{item.displayName}</Text>
                          <Text style={styles.couponDiscountSummary}>{item.description || `Get ${item.discountValue}${item.couponType === 'PERCENTAGE' ? '%' : ' ₹'} off`}</Text>
                          {item.endDate && (
                            <Text style={styles.couponExpiryText}>Expires: {new Date(item.endDate).toLocaleDateString()}</Text>
                          )}
                        </View>
                      )}
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}

          {/* Loading state */}
          {homeLoading && !cmsBlocks && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>Loading home…</Text>
            </View>
          )}

          {/* Error state - subtle inline banner instead of full screen block */}
          {!homeLoading && homeError && (
            <View style={styles.errorBanner}>
              <View style={styles.errorBannerContent}>
                <Text style={styles.errorBannerText}>
                  {homeError === 'Network Error' || homeError.toLowerCase().includes('network')
                    ? 'Unable to load all content.'
                    : homeError}
                </Text>
                <TouchableOpacity style={styles.retryBannerButton} onPress={() => void reloadCatalog()} activeOpacity={0.7}>
                  <Text style={styles.retryBannerButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Skeleton placeholders when bootstrap failed and there is no cached content */}
          {!homeLoading && homeError && (!cmsBlocks || cmsBlocks.length === 0) && (
            <View style={styles.skeletonWrap} accessibilityRole="progressbar" accessibilityLabel="Loading home content">
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.skeletonCard}>
                  <View style={styles.skeletonLineWide} />
                  <View style={styles.skeletonLine} />
                  <View style={styles.skeletonRow}>
                    <View style={styles.skeletonThumb} />
                    <View style={styles.skeletonThumb} />
                    <View style={styles.skeletonThumb} />
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Empty state - no sections configured */}
          {!homeLoading && !homeError && cmsBlocks && cmsBlocks.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                {isDevBackend
                  ? 'No home content. Add sections in Admin → Customer App Home → Section list.'
                  : 'No home content available right now. Please try again later.'}
              </Text>
            </View>
          )}

          {/* CMS blocks - non-blocking for bootstrap error */}
          {!homeLoading && cmsBlocks && cmsBlocks.length > 0 && cmsBlocks.map((block, index) => {
            const Component = blockRegistry[block.type];
            if (!Component) return null;
            return (
              <Animated.View
                key={block.id}
                style={{
                  opacity: sectionAnimations[Math.min(index, MAX_SECTIONS - 1)].opacity,
                  transform: [{ translateY: sectionAnimations[Math.min(index, MAX_SECTIONS - 1)].translateY }],
                }}
              >
                <ErrorBoundary fallback={
                  <View style={{ padding: 16, backgroundColor: '#FFFFFF', minHeight: 100 }}>
                    <Text style={{ color: '#666', textAlign: 'center' }}>Block unavailable</Text>
                  </View>
                }>
                  <Component
                    id={block.id}
                    type={block.type}
                    config={block.config || {}}
                    data={block.data || {}}
                    homeBlockIndex={index}
                    firstBannerBlockIndex={homeImageLayoutHints.firstBannerBlockIndex}
                    firstCategoryGridBlockIndex={homeImageLayoutHints.firstCategoryGridBlockIndex}
                    firstCarouselBlockIndex={homeImageLayoutHints.firstCarouselBlockIndex}
                  />
                </ErrorBoundary>
              </Animated.View>
            );
          })}
          </ScrollView>
        </View>

        {/* Floating Cart Bar - positioned right above bottom navigation bar */}
        <ErrorBoundary
          fallback={null}
        >
          <FloatingCartBar onPress={() => navigation.navigate('MainTabs', { screen: 'Cart' })} hasBottomNav={true} />
        </ErrorBoundary>

      </SafeAreaView>

      {/* Location drawer rendered outside SafeAreaView to overlay on top of home page */}
      <LocationSelectDrawer
        visible={showLocationDrawer}
        onClose={() => setShowLocationDrawer(false)}
        onSelect={handleAddressSelect}
        onAddNew={handleAddNewAddress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  safeArea: {
    flex: 1,
  },
  animatedContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Theme.spacing.sectionCardGap,
  },
  emptyState: {
    padding: 24,
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyStateHint: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#034703',
    borderRadius: 8,
    alignSelf: 'center',
  },
  retryButtonText: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '600',
  },
  errorBanner: {
    backgroundColor: '#FFF4F4',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFDADA',
  },
  errorBannerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorBannerText: {
    fontSize: 12,
    color: '#D32F2F',
    flex: 1,
    marginRight: 8,
  },
  retryBannerButton: {
    backgroundColor: '#D32F2F',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  retryBannerButtonText: {
    fontSize: 11,
    color: '#FFF',
    fontWeight: '600',
  },
  skeletonWrap: {
    marginHorizontal: 16,
    marginTop: 12,
    gap: 12,
  },
  skeletonCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  skeletonLineWide: {
    height: 14,
    borderRadius: 6,
    backgroundColor: '#E8E8E8',
    width: '55%',
    marginBottom: 12,
  },
  skeletonLine: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F0F0F0',
    width: '80%',
    marginBottom: 16,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  skeletonThumb: {
    flex: 1,
    height: 72,
    borderRadius: 8,
    backgroundColor: '#ECECEC',
  },
  couponCarouselContainer: {
    marginTop: 16,
    marginBottom: 8,
  },
  couponCarouselContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  couponBannerCard: {
    width: 312,
    height: 120,
    borderRadius: 12,
    borderWidth: 1.5,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  couponBannerImage: {
    width: '100%',
    height: '100%',
  },
  couponTextCard: {
    width: '100%',
    height: '100%',
    padding: 16,
    justifyContent: 'center',
    gap: 4,
  },
  couponDisplayName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#034703',
  },
  couponDiscountSummary: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4C4C4C',
  },
  couponExpiryText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B6B6B',
    marginTop: 4,
  },
});
