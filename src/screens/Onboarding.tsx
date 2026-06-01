import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  StatusBar,
  Animated,
  PanResponder,
  Easing,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getOnboardingPages, completeOnboarding, type OnboardingPage } from '../services/onboarding/onboardingService';
import { tokenManager } from '../services/api/tokenManager';
import { saveOnboardingCompleted } from '../utils/storage';
import { getEnvConfigSafe } from '../config/env';
import { logger } from '@/utils/logger';
import { navigateToLoginScreen } from '../utils/navigationRef';
import { scale, verticalScale, getSpacing, useDimensions, scaleFont } from '../utils/responsive';

// Static image mapping - Required because React Native doesn't support dynamic require()
const ONBOARDING_IMAGES: { [key: number]: any } = {
  1: require('../assets/images/onboarding-screen-1.png'),
  2: require('../assets/images/onboarding-screen-2.png'),
  3: require('../assets/images/onboarding-screen-3.png'),
};

// Helper function to get onboarding image
const getOnboardingImage = (pageNumber: number) => {
  return ONBOARDING_IMAGES[pageNumber] || ONBOARDING_IMAGES[1]; // Default to page 1 if not found
};

interface OnboardingProps {
  onComplete?: () => void;
}

/**
 * Onboarding Component
 * Single component that displays all onboarding pages
 * Only image, title, and description change between pages
 * Balance/layout remains the same
 */
function Onboarding({ onComplete }: OnboardingProps) {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { width: responsiveWidth } = useDimensions();
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [onboardingPages, setOnboardingPages] = useState<OnboardingPage[]>([]);
  const [fetchingPages, setFetchingPages] = useState<boolean>(true);
  const fallbackNavigateRef = useRef(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const imageOpacity = useRef(new Animated.Value(1)).current;
  const imageScale = useRef(new Animated.Value(0.9)).current; // Image scale animation
  const titleOpacity = useRef(new Animated.Value(1)).current;
  const titleTranslateY = useRef(new Animated.Value(20)).current; // Staggered text animation
  const descriptionOpacity = useRef(new Animated.Value(1)).current;
  const descriptionTranslateY = useRef(new Animated.Value(20)).current; // Staggered text animation
  // Pagination dots - support up to 10 pages from API
  const paginationDotScales = useRef(
    Array.from({ length: 10 }, () => new Animated.Value(1))
  ).current;
  const paginationDotOpacities = useRef(
    Array.from({ length: 10 }, () => new Animated.Value(0.5))
  ).current;
  
  // Progress animation for active dot (8 seconds)
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  
  // Swipe animation
  const swipeAnim = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        swipeAnim.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        const swipeThreshold = SCREEN_WIDTH * 0.25;
        if (Math.abs(gestureState.dx) > swipeThreshold) {
          if (gestureState.dx < 0 && !isLastPage) {
            // Swipe left - go to next
            handleNext();
          } else if (gestureState.dx > 0 && !isFirstPage) {
            // Swipe right - go to previous
            goToPrevious();
          } else {
            // Snap back
            Animated.spring(swipeAnim, {
              toValue: 0,
              useNativeDriver: true,
            }).start();
          }
        } else {
          // Snap back
          Animated.spring(swipeAnim, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Auto-advance timer ref
  const autoAdvanceTimer = useRef<NodeJS.Timeout | null>(null);
  const currentPageIndexRef = useRef(currentPageIndex);

  // Pages from API only (no fallback)
  const pages = onboardingPages.map((page) => ({
    ...page,
    image: page.imageUrl?.startsWith('http')
      ? { uri: page.imageUrl }
      : getOnboardingImage(page.pageNumber || 1),
  }));
  const safePages = pages;

  const currentPage = safePages[currentPageIndex];
  const isLastPage = currentPageIndex === safePages.length - 1;
  const isFirstPage = currentPageIndex === 0;

  const navigateAfterOnboarding = async () => {
    await tokenManager.initialize();
    if (tokenManager.isTokenValid()) {
      navigation.replace('MainTabs');
    } else {
      navigateToLoginScreen(navigation);
    }
  };

  // Fetch onboarding pages from API only; on failure/empty, fallback = move to login/home
  const fetchPages = async () => {
    try {
      setFetchingPages(true);
      const response = await getOnboardingPages();

      // Backend returns { success, data: [...] }; interceptor returns that body as response
      const raw = response as { data?: unknown; pages?: unknown };
      const data = raw?.data ?? raw?.pages;
      const items = Array.isArray(data) ? data : Array.isArray(response) ? response : [];

      if (items.length > 0) {
        const sortedPages = [...items].sort(
          (a, b) =>
            (Number((a as OnboardingPage).pageNumber) ?? (a as OnboardingPage).order ?? 0) -
            (Number((b as OnboardingPage).pageNumber) ?? (b as OnboardingPage).order ?? 0)
        ) as OnboardingPage[];
        setOnboardingPages(sortedPages);
        if (__DEV__) {
          logger.info(`Onboarding: loaded ${sortedPages.length} pages from API`);
        }
      } else {
        // Empty pages is valid: backend has no onboarding configured -> skip ahead
        if (__DEV__) {
          logger.debug('Onboarding: no pages configured, skipping ahead');
        }
        setOnboardingPages([]);
      }
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      const isNetworkError =
        err?.code === 'NETWORK_ERROR' ||
        err?.message === 'Network Error' ||
        (typeof err?.message === 'string' && err.message.toLowerCase().includes('network'));
      logger.warn('Error fetching onboarding pages, using fallback (move to next screen)', error);
      if (__DEV__ && isNetworkError) {
        const baseUrl = getEnvConfigSafe().apiBaseUrl;
        logger.warn(
          'Network Error: app cannot reach the backend. If running on a physical device or Android emulator, ' +
            'localhost does not point to your machine. Start selorg-backend on port 3333 and set API_BASE_URL in .env to your machine IP, e.g. ' +
            'API_BASE_URL=http://192.168.1.x:3333/api/v1/customer. Current baseUrl: ' + baseUrl
        );
      }
      setOnboardingPages([]);
    } finally {
      setFetchingPages(false);
    }
  };

  useEffect(() => {
    fetchPages();
  }, []);

  // Auth guard: if already logged in with valid token, stay in app
  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        await tokenManager.initialize();
        if (mounted && tokenManager.isTokenValid()) {
          navigation.replace('MainTabs');
        }
      } catch {
        // ignore
      }
    };
    check();
    return () => { mounted = false; };
  }, [navigation]);

  // Update ref when page index changes
  useEffect(() => {
    currentPageIndexRef.current = currentPageIndex;
  }, [currentPageIndex]);

  // Go to previous page function
  const goToPrevious = () => {
    if (isFirstPage) return;
    
    // Clear auto-advance timer when manually navigating
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    // Stop progress animation
    if (progressAnimationRef.current) {
      progressAnimationRef.current.stop();
      progressAnimationRef.current = null;
    }
    
    // Animate out current content
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 30,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentPageIndex(currentPageIndex - 1);
    });
  };

  // Animate card change when page index changes
  useEffect(() => {
    // Clear auto-advance timer
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }

    // Stop progress animation if running
    if (progressAnimationRef.current) {
      progressAnimationRef.current.stop();
      progressAnimationRef.current = null;
    }

    // Reset animation values
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    imageOpacity.setValue(0);
    imageScale.setValue(0.9);
    titleOpacity.setValue(0);
    titleTranslateY.setValue(20);
    descriptionOpacity.setValue(0);
    descriptionTranslateY.setValue(20);
    swipeAnim.setValue(0);
    progressAnim.setValue(0); // Reset progress animation

    // Reset pagination dots
    paginationDotScales.forEach((scale, index) => {
      scale.setValue(index === currentPageIndex ? 1.2 : 1);
    });
    paginationDotOpacities.forEach((opacity, index) => {
      opacity.setValue(index === currentPageIndex ? 1 : 0.5);
    });

    // Animate in new content
    // 1. Image scale + fade animation
    const imageAnimation = Animated.parallel([
      Animated.timing(imageOpacity, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(imageScale, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    // 2. Staggered text animation - title first, then description
    const titleAnimation = Animated.parallel([
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 500,
        delay: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(titleTranslateY, {
        toValue: 0,
        duration: 500,
        delay: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    const descriptionAnimation = Animated.parallel([
      Animated.timing(descriptionOpacity, {
        toValue: 1,
        duration: 500,
        delay: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(descriptionTranslateY, {
        toValue: 0,
        duration: 500,
        delay: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    // 3. Pagination dot animation
    const paginationAnimations = safePages.map((_, index) => {
      const isActive = index === currentPageIndex;
      if (paginationDotScales[index] && paginationDotOpacities[index]) {
        return Animated.parallel([
          Animated.spring(paginationDotScales[index], {
            toValue: isActive ? 1.2 : 1,
            useNativeDriver: true,
          }),
          Animated.timing(paginationDotOpacities[index], {
            toValue: isActive ? 1 : 0.5,
            duration: 300,
            useNativeDriver: true,
          }),
        ]);
      }
      return null;
    }).filter((anim): anim is Animated.CompositeAnimation => anim !== null);

    // Start all animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
      imageAnimation,
      titleAnimation,
      descriptionAnimation,
      ...paginationAnimations,
    ]).start();

    // Auto-advance: After 8 seconds, go to next page (except on last page)
    if (!isLastPage) {
      // Start progress animation - animate from 0 to 1 over 8 seconds
      progressAnimationRef.current = Animated.timing(progressAnim, {
        toValue: 1,
        duration: 8000, // 8 seconds
        easing: Easing.linear, // Linear for smooth progress
        useNativeDriver: false, // Width animation requires useNativeDriver: false
      });
      progressAnimationRef.current.start();

      autoAdvanceTimer.current = setTimeout(() => {
        const nextIndex = currentPageIndexRef.current + 1;
        if (nextIndex < safePages.length) {
          // Animate out current content and go to next
          Animated.parallel([
            Animated.timing(fadeAnim, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
              toValue: -30,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start(() => {
            setCurrentPageIndex(nextIndex);
          });
        }
      }, 8000);
    }

    // Cleanup
    return () => {
      if (autoAdvanceTimer.current) {
        clearTimeout(autoAdvanceTimer.current);
        autoAdvanceTimer.current = null;
      }
      if (progressAnimationRef.current) {
        progressAnimationRef.current.stop();
        progressAnimationRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPageIndex, isLastPage]);

  // Handle next/complete button
  const handleNext = async () => {
    // Clear auto-advance timer when manually navigating
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    // Stop progress animation
    if (progressAnimationRef.current) {
      progressAnimationRef.current.stop();
      progressAnimationRef.current = null;
    }

    setLoading(true);
    try {
      if (isLastPage) {
        // Last page - complete onboarding and continue based on auth state
        try {
          // Mark onboarding as completed in backend (if user is authenticated)
          await completeOnboarding();
        } catch (error) {
          // If user is not authenticated, just mark locally
          logger.info('User not authenticated, marking onboarding completed locally');
        }

        // Mark onboarding as completed locally
        await saveOnboardingCompleted();

        // TODO: Track onboarding completion
        // await analytics.track('onboarding_completed', {
        //   completed_at: new Date().toISOString(),
        //   total_screens: safePages.length,
        // });

        if (onComplete) {
          onComplete();
        } else {
          await navigateAfterOnboarding();
        }
      } else {
        // Not last page - Go to next page with smooth animation
        // TODO: Track onboarding progression
        // await analytics.track('onboarding_next_clicked', {
        //   from_page: currentPageIndex + 1,
        //   to_page: currentPageIndex + 2,
        // });

        // Animate out current content
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: -30,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          // Change page after animation completes
          setCurrentPageIndex(currentPageIndex + 1);
        });
      }
    } catch (error) {
      logger.error('Error handling next', error);
    } finally {
      setLoading(false);
    }
  };

  // Show loading indicator while fetching pages
  if (fetchingPages) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar barStyle="dark-content" backgroundColor="#F5F5F5" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#034703" />
        </View>
      </SafeAreaView>
    );
  }

  // API returned empty or failed - fallback: mark complete, then continue based on auth state
  if (safePages.length === 0) {
    if (!fallbackNavigateRef.current) {
      fallbackNavigateRef.current = true;
      (async () => {
        try {
          await saveOnboardingCompleted();
        } catch (e) {
          logger.warn('Fallback: saveOnboardingCompleted failed', e);
        }
        if (onComplete) {
          onComplete();
        } else {
          await navigateAfterOnboarding();
        }
      })();
    }
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar barStyle="dark-content" backgroundColor="#F5F5F5" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#034703" />
        </View>
      </SafeAreaView>
    );
  }

  // Responsive dimensions - Image size optimized for screen
  // Calculate responsive values based on screen size
  const responsiveStyles = {
    imageHeight: verticalScale(425 * 0.95), // Reduced by 5% for better balance (425 * 0.95 = 403.75)
    headingFontSize: scaleFont(24),
    paragraphFontSize: scaleFont(14),
    buttonPaddingVertical: verticalScale(13),
    buttonPaddingHorizontal: scale(16),
    headerPaddingTop: verticalScale(20),
    headerPaddingBottom: verticalScale(16),
    buttonMarginBottom: Math.max(insets.bottom, verticalScale(24)),
    textContainerGap: verticalScale(16),
    headerContainerGap: verticalScale(20),
    paginationPaddingVertical: verticalScale(12),
    paginationMarginTop: verticalScale(4),
  };

  const handleSkip = async () => {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    if (progressAnimationRef.current) {
      progressAnimationRef.current.stop();
      progressAnimationRef.current = null;
    }
    setCurrentPageIndex(safePages.length - 1);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F5F5" />

      {/* Skip Button - Top Right */}
      {!isLastPage && (
        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          activeOpacity={0.7}
        >
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Header Section with Image and Text */}
      <Animated.View
        style={[
          styles.headerContainer,
          {
            opacity: fadeAnim,
            transform: [
              { translateY: slideAnim },
              { translateX: swipeAnim },
            ],
            paddingTop: responsiveStyles.headerPaddingTop,
            paddingBottom: responsiveStyles.headerPaddingBottom,
            gap: responsiveStyles.headerContainerGap,
          },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Image Container - Scale + Fade Animation */}
        <Animated.View
          style={[
            styles.imageContainer,
            {
              opacity: imageOpacity,
              transform: [{ scale: imageScale }],
              height: responsiveStyles.imageHeight,
            },
          ]}
        >
          <Image
            source={typeof currentPage.image === 'object' && 'uri' in currentPage.image 
              ? currentPage.image 
              : currentPage.image || getOnboardingImage(currentPageIndex + 1)}
            style={styles.image}
            resizeMode="cover"
            // Prevent background bleeding in release builds
            defaultSource={undefined}
          />
        </Animated.View>

        {/* Text Container - Staggered Animation */}
        <View style={[styles.textContainer, { gap: responsiveStyles.textContainerGap }]}>
          {/* Title - Animates first */}
          <Animated.View
            style={[
              styles.headingContainer,
              {
                opacity: titleOpacity,
                transform: [{ translateY: titleTranslateY }],
              },
            ]}
          >
            <Text style={[styles.heading, { fontSize: responsiveStyles.headingFontSize }]}>{currentPage.title}</Text>
          </Animated.View>
          
          {/* Description - Animates after title */}
          <Animated.View
            style={[
              styles.paragraphContainer,
              {
                opacity: descriptionOpacity,
                transform: [{ translateY: descriptionTranslateY }],
              },
            ]}
          >
            <Text style={[styles.paragraph, { fontSize: responsiveStyles.paragraphFontSize }]}>{currentPage.description}</Text>
          </Animated.View>
        </View>
      </Animated.View>

      {/* Pagination Dots - Animated with Progress Bar */}
      <Animated.View
        style={[
          styles.paginationContainer,
          {
            opacity: fadeAnim,
            paddingVertical: responsiveStyles.paginationPaddingVertical,
            marginTop: responsiveStyles.paginationMarginTop,
          },
        ]}
      >
        {safePages.map((_, index) => {
          const isActive = index === currentPageIndex;
          
          // Interpolate width for active dot: 7px to 28px over 8 seconds (responsive)
          const dotInactiveWidth = scale(7);
          const dotActiveWidth = scale(28);
          const animatedWidth = isActive
            ? progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [dotInactiveWidth, dotActiveWidth], // From inactive width to active width
              })
            : dotInactiveWidth; // Inactive dots stay at scaled 7px

          return (
            <View key={index} style={styles.paginationDotWrapper}>
              <Animated.View
                style={[
                  {
                    width: isActive ? animatedWidth : dotInactiveWidth, // Animate width only for active dot (JS-driven)
                    height: scale(7),
                    overflow: 'hidden',
                    borderRadius: scale(3.5), // Rounded edges for the loading bar
                  },
                ]}
              >
                <Animated.View
                  style={[
                    styles.paginationDot,
                    index === currentPageIndex && styles.paginationDotActive,
                    {
                      transform: [{ scale: paginationDotScales[index] || new Animated.Value(1) }],
                      opacity: paginationDotOpacities[index] || new Animated.Value(0.5),
                    },
                  ]}
                />
              </Animated.View>
            </View>
          );
        })}
      </Animated.View>

      {/* Next/Complete Button */}
      <View style={[styles.buttonContainer, { marginBottom: responsiveStyles.buttonMarginBottom }]}>
        <TouchableOpacity
          style={[
            styles.nextButton, 
            loading && styles.nextButtonDisabled,
            {
              paddingVertical: responsiveStyles.buttonPaddingVertical,
              paddingHorizontal: responsiveStyles.buttonPaddingHorizontal,
            }
          ]}
          onPress={handleNext}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonText}>
            {isLastPage
              ? (currentPage.ctaText || 'Get Started')
              : 'Next'}
          </Text>
          {!isLastPage && (
            <View style={styles.nextButtonIcon}>
              <Text style={styles.nextButtonIconText}>›</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// Reusable Sub-components (for easy componentization)
const PaginationDot: React.FC<{ active: boolean }> = ({ active }) => (
  <View
    style={[styles.paginationDot, active && styles.paginationDotActive]}
  />
);

const OnboardingButton: React.FC<{
  text: string;
  onPress: () => void;
  loading?: boolean;
}> = ({ text, onPress, loading = false }) => (
  <TouchableOpacity
    style={[
      styles.nextButton,
      loading && styles.nextButtonDisabled,
    ]}
    onPress={onPress}
    disabled={loading}
    activeOpacity={0.8}
  >
    <Text style={styles.nextButtonText}>
      {text}
    </Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontFamily: 'Inter',
    fontSize: scale(16),
    color: '#6B6B6B',
    textAlign: 'center',
  },
  skipButton: {
    position: 'absolute',
    top: verticalScale(16),
    right: getSpacing(16),
    zIndex: 10,
    paddingVertical: verticalScale(6),
    paddingHorizontal: scale(16),
  },
  skipButtonText: {
    fontFamily: 'Inter',
    fontWeight: '500',
    fontSize: scale(14),
    color: '#6B6B6B',
  },
  headerContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    width: '100%',
    paddingHorizontal: getSpacing(16),
    borderRadius: scale(8),
    overflow: 'hidden',
    alignSelf: 'stretch',
    // Set solid background color to fix shadow calculation warning
    backgroundColor: '#FFFFFF',
    // Platform-specific shadow handling
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 4,
        },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        // Reduced elevation to prevent grey background in release builds
        elevation: 2,
        // Add a subtle border to replace elevation shadow
        borderWidth: 0.5,
        borderColor: 'rgba(0, 0, 0, 0.05)',
      },
    }),
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: scale(8),
    // Ensure image fills container without background bleeding
    backgroundColor: 'transparent',
    // Prevent any default background
    ...Platform.select({
      android: {
        // Android-specific: ensure proper rendering
        overflow: 'hidden',
      },
    }),
  },
  textContainer: {
    width: '100%',
    paddingHorizontal: getSpacing(16),
  },
  headingContainer: {
    width: '100%',
  },
  heading: {
    fontFamily: 'Inter',
    fontWeight: '700',
    lineHeight: verticalScale(32),
    color: '#1A1A1A',
    textAlign: 'center',
  },
  paragraphContainer: {
    width: '100%',
  },
  paragraph: {
    fontFamily: 'Inter',
    fontWeight: '400',
    lineHeight: verticalScale(21),
    color: '#6B6B6B',
    textAlign: 'center',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: scale(7),
  },
  paginationDotWrapper: {
    height: scale(7),
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  paginationDot: {
    width: scale(28), // Full width - container will clip it
    height: scale(7),
    borderRadius: scale(3.5),
    backgroundColor: '#E8E8E8',
  },
  paginationDotActive: {
    backgroundColor: '#034703',
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: getSpacing(16),
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    backgroundColor: '#034703',
    borderRadius: scale(8),
    gap: scale(6),
    minHeight: verticalScale(48),
  },
  nextButtonDisabled: {
    opacity: 0.6,
  },
  nextButtonText: {
    fontFamily: 'Inter',
    fontWeight: '500',
    fontSize: scale(14),
    lineHeight: verticalScale(22.4),
    color: '#FFFFFF',
    textAlign: 'center',
  },
  nextButtonIcon: {
    width: scale(14),
    height: scale(14),
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: verticalScale(1), // Slight adjustment for better visual centering
  },
  nextButtonIconText: {
    color: '#FFFFFF',
    fontSize: scale(16),
    fontWeight: 'bold',
    lineHeight: scale(14),
    textAlign: 'center',
  },
});

export default Onboarding;

