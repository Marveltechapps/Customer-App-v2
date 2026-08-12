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
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import SkipButton from '@/components/common/SkipButton';
import { completeOnboarding } from '../services/onboarding/onboardingService';
import { tokenManager } from '../services/api/tokenManager';
import {
  getOnboardingCompleted,
  saveOnboardingCompleted,
} from '../utils/storage';
import { logger } from '@/utils/logger';
import { scale, verticalScale, getSpacing, scaleFont } from '../utils/responsive';
import {
  LOCAL_ONBOARDING_PAGES,
  type LocalOnboardingPage,
} from '../constants/onboarding';
import { Colors } from '../constants/Colors';
import { APP_LAUNCH_ID } from '../constants/appLaunch';

interface OnboardingProps {
  onComplete?: () => void;
}

/**
 * Onboarding — 3 final screens (local assets).
 * Swipe, pagination, Skip, Next, and Get Started preserved.
 */
function Onboarding({ onComplete }: OnboardingProps) {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  /** null = still checking; false = new user (show); true = returning (redirect) */
  const [gateChecked, setGateChecked] = useState(false);
  const [allowedForNewUser, setAllowedForNewUser] = useState(false);

  const pages: LocalOnboardingPage[] = LOCAL_ONBOARDING_PAGES;
  const currentPage = pages[currentPageIndex];
  const isLastPage = currentPageIndex === pages.length - 1;
  const isFirstPage = currentPageIndex === 0;

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const imageOpacity = useRef(new Animated.Value(1)).current;
  const imageScale = useRef(new Animated.Value(0.9)).current;
  const titleOpacity = useRef(new Animated.Value(1)).current;
  const titleTranslateY = useRef(new Animated.Value(20)).current;
  const descriptionOpacity = useRef(new Animated.Value(1)).current;
  const descriptionTranslateY = useRef(new Animated.Value(20)).current;
  const paginationDotScales = useRef(
    Array.from({ length: pages.length }, () => new Animated.Value(1))
  ).current;
  const paginationDotOpacities = useRef(
    Array.from({ length: pages.length }, () => new Animated.Value(0.5))
  ).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const swipeAnim = useRef(new Animated.Value(0)).current;
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentPageIndexRef = useRef(currentPageIndex);
  const isLastPageRef = useRef(isLastPage);
  const isFirstPageRef = useRef(isFirstPage);

  const navigateAfterOnboarding = async () => {
    await tokenManager.initialize();
    if (tokenManager.isTokenValid()) {
      navigation.replace('MainTabs');
      return;
    }
    // Go straight to Login (do not bounce through Splash — that delayed/blocked login)
    navigation.replace('Login', { fromSplash: APP_LAUNCH_ID });
  };

  const goToPrevious = () => {
    if (isFirstPageRef.current) return;
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    if (progressAnimationRef.current) {
      progressAnimationRef.current.stop();
      progressAnimationRef.current = null;
    }
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
      setCurrentPageIndex((i) => Math.max(0, i - 1));
    });
  };

  const advanceToNextPage = () => {
    if (isLastPageRef.current) return;
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    if (progressAnimationRef.current) {
      progressAnimationRef.current.stop();
      progressAnimationRef.current = null;
    }
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
      setCurrentPageIndex((i) => Math.min(pages.length - 1, i + 1));
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 10,
      onPanResponderMove: (_, gestureState) => {
        swipeAnim.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        const swipeThreshold = SCREEN_WIDTH * 0.25;
        if (Math.abs(gestureState.dx) > swipeThreshold) {
          if (gestureState.dx < 0 && !isLastPageRef.current) {
            advanceToNextPage();
          } else if (gestureState.dx > 0 && !isFirstPageRef.current) {
            goToPrevious();
          } else {
            Animated.spring(swipeAnim, {
              toValue: 0,
              useNativeDriver: true,
            }).start();
          }
        } else {
          Animated.spring(swipeAnim, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // New users only: returning users (onboarding done) or signed-in users never see these screens.
  useEffect(() => {
    let mounted = true;
    const gate = async () => {
      try {
        await tokenManager.initialize();
        if (!mounted) return;

        if (tokenManager.isTokenValid()) {
          navigation.replace('MainTabs');
          return;
        }

        const alreadyDone = await getOnboardingCompleted();
        if (!mounted) return;

        if (alreadyDone) {
          navigation.replace('Login', { fromSplash: APP_LAUNCH_ID });
          return;
        }

        setAllowedForNewUser(true);
      } catch (error) {
        logger.warn('Onboarding gate check failed, defaulting to login', error);
        if (mounted) {
          navigation.replace('Login', { fromSplash: APP_LAUNCH_ID });
        }
      } finally {
        if (mounted) setGateChecked(true);
      }
    };
    void gate();
    return () => {
      mounted = false;
    };
  }, [navigation]);

  useEffect(() => {
    currentPageIndexRef.current = currentPageIndex;
    isLastPageRef.current = isLastPage;
    isFirstPageRef.current = isFirstPage;
  }, [currentPageIndex, isLastPage, isFirstPage]);

  useEffect(() => {
    if (!allowedForNewUser) return;

    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    if (progressAnimationRef.current) {
      progressAnimationRef.current.stop();
      progressAnimationRef.current = null;
    }

    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    imageOpacity.setValue(0);
    imageScale.setValue(0.9);
    titleOpacity.setValue(0);
    titleTranslateY.setValue(20);
    descriptionOpacity.setValue(0);
    descriptionTranslateY.setValue(20);
    swipeAnim.setValue(0);
    progressAnim.setValue(0);

    paginationDotScales.forEach((s, index) => {
      s.setValue(index === currentPageIndex ? 1.2 : 1);
    });
    paginationDotOpacities.forEach((o, index) => {
      o.setValue(index === currentPageIndex ? 1 : 0.5);
    });

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

    const paginationAnimations = pages
      .map((_, index) => {
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
      })
      .filter((anim): anim is Animated.CompositeAnimation => anim !== null);

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

    if (!isLastPage) {
      progressAnimationRef.current = Animated.timing(progressAnim, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: false,
      });
      progressAnimationRef.current.start();

      autoAdvanceTimer.current = setTimeout(() => {
        const nextIndex = currentPageIndexRef.current + 1;
        if (nextIndex < pages.length) {
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
  }, [currentPageIndex, isLastPage, allowedForNewUser]);

  const finishOnboarding = async () => {
    // Persist locally first so next launch skips onboarding even if API is slow/down
    await saveOnboardingCompleted();
    void completeOnboarding().catch(() => {
      logger.info('User not authenticated, onboarding marked completed locally only');
    });
    if (onComplete) {
      onComplete();
    } else {
      await navigateAfterOnboarding();
    }
  };

  const handleNext = async () => {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    if (progressAnimationRef.current) {
      progressAnimationRef.current.stop();
      progressAnimationRef.current = null;
    }

    setLoading(true);
    try {
      if (isLastPage) {
        await finishOnboarding();
      } else {
        advanceToNextPage();
      }
    } catch (error) {
      logger.error('Error handling next', error);
    } finally {
      setLoading(false);
    }
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
    setLoading(true);
    try {
      await finishOnboarding();
    } catch (error) {
      logger.error('Error skipping onboarding', error);
    } finally {
      setLoading(false);
    }
  };

  const responsiveStyles = {
    imageHeight: verticalScale(425 * 0.95),
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

  const ctaLabel = isLastPage
    ? currentPage.ctaText || 'Begin your clean food journey'
    : 'Next';

  if (!gateChecked || !allowedForNewUser) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Animated.View
        style={[
          styles.headerContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }, { translateX: swipeAnim }],
            paddingTop: responsiveStyles.headerPaddingTop,
            paddingBottom: responsiveStyles.headerPaddingBottom,
            gap: responsiveStyles.headerContainerGap,
          },
        ]}
        {...panResponder.panHandlers}
      >
        <Animated.View
          style={[
            styles.imageOuter,
            {
              opacity: imageOpacity,
              transform: [{ scale: imageScale }],
            },
          ]}
        >
          <View style={[styles.imageContainer, { height: responsiveStyles.imageHeight }]}>
            <Image
              key={currentPage.pageNumber}
              source={currentPage.image}
              style={styles.image}
              resizeMode="cover"
              accessibilityLabel={currentPage.title}
            />
          </View>
        </Animated.View>

        <View style={[styles.textContainer, { gap: responsiveStyles.textContainerGap }]}>
          <Animated.View
            style={[
              styles.headingContainer,
              {
                opacity: titleOpacity,
                transform: [{ translateY: titleTranslateY }],
              },
            ]}
          >
            <Text style={[styles.heading, { fontSize: responsiveStyles.headingFontSize }]}>
              {currentPage.title}
            </Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.paragraphContainer,
              {
                opacity: descriptionOpacity,
                transform: [{ translateY: descriptionTranslateY }],
              },
            ]}
          >
            <Text style={[styles.paragraph, { fontSize: responsiveStyles.paragraphFontSize }]}>
              {currentPage.description}
            </Text>
          </Animated.View>
        </View>
      </Animated.View>

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
        {pages.map((_, index) => {
          const isActive = index === currentPageIndex;
          const dotInactiveWidth = scale(7);
          const dotActiveWidth = scale(28);
          const animatedWidth = isActive
            ? progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [dotInactiveWidth, dotActiveWidth],
              })
            : dotInactiveWidth;

          return (
            <View key={index} style={styles.paginationDotWrapper}>
              <Animated.View
                style={{
                  width: isActive ? animatedWidth : dotInactiveWidth,
                  height: scale(7),
                  overflow: 'hidden',
                  borderRadius: scale(3.5),
                }}
              >
                <Animated.View
                  style={[
                    styles.paginationDot,
                    isActive && styles.paginationDotActive,
                    {
                      transform: [
                        { scale: paginationDotScales[index] || new Animated.Value(1) },
                      ],
                      opacity: paginationDotOpacities[index] || new Animated.Value(0.5),
                    },
                  ]}
                />
              </Animated.View>
            </View>
          );
        })}
      </Animated.View>

      <View style={[styles.buttonContainer, { marginBottom: responsiveStyles.buttonMarginBottom }]}>
        <TouchableOpacity
          style={[
            styles.nextButton,
            loading && styles.nextButtonDisabled,
            {
              paddingVertical: responsiveStyles.buttonPaddingVertical,
              paddingHorizontal: responsiveStyles.buttonPaddingHorizontal,
            },
          ]}
          onPress={handleNext}
          disabled={loading}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
        >
          <Text style={styles.nextButtonText}>{ctaLabel}</Text>
          {!isLastPage && (
            <View style={styles.nextButtonIcon}>
              <Text style={styles.nextButtonIconText}>›</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
      </SafeAreaView>

      <SkipButton
        onPress={handleSkip}
        disabled={loading}
        accessibilityLabel="Skip onboarding"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },
  headerContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageOuter: {
    width: '100%',
    paddingHorizontal: getSpacing(16),
    alignSelf: 'stretch',
  },
  imageContainer: {
    width: '100%',
    borderRadius: scale(20),
    overflow: 'hidden',
    backgroundColor: Colors.white,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
        borderWidth: 0.5,
        borderColor: 'rgba(0, 0, 0, 0.05)',
      },
    }),
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
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
    color: Colors.text,
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
    width: scale(28),
    height: scale(7),
    borderRadius: scale(3.5),
    backgroundColor: '#E8E8E8',
  },
  paginationDotActive: {
    backgroundColor: Colors.primary,
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
    backgroundColor: Colors.primary,
    borderRadius: scale(12),
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
    color: Colors.white,
    textAlign: 'center',
  },
  nextButtonIcon: {
    width: scale(14),
    height: scale(14),
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: verticalScale(1),
  },
  nextButtonIconText: {
    color: Colors.white,
    fontSize: scale(16),
    fontWeight: 'bold',
    lineHeight: scale(14),
    textAlign: 'center',
  },
});

export default Onboarding;
