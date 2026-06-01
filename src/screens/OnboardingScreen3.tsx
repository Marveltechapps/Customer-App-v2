import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  StatusBar,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { logger } from '@/utils/logger';
import { navigateToLoginScreen } from '../utils/navigationRef';

// Dummy static data - Replace with API call later
const ONBOARDING_DATA = {
  title: "India's First Lab-Tested Organic App",
  description:
    "India's first lab-tested organic grocery app. We're your health guardian.",
  image: require('../assets/images/onboarding-screen-3.png'),
  currentPage: 3,
  totalPages: 3,
  ctaText: 'Begin your clean food journey',
};

interface OnboardingScreen3Props {
  onComplete?: () => void;
}

/**
 * OnboardingScreen3 Component
 * Final screen of the onboarding flow
 * Displays information about lab-tested organic groceries
 * Includes CTA button to begin the journey
 */
const OnboardingScreen3: React.FC<OnboardingScreen3Props> = ({
  onComplete,
}) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [loading, setLoading] = useState<boolean>(false);

  // Placeholder for API call - Replace with actual API later
  useEffect(() => {
    // TODO: Track onboarding view analytics
    // const trackOnboardingView = async () => {
    //   try {
    //     await analytics.track('onboarding_screen_viewed', {
    //       screen: 'onboarding_3',
    //       timestamp: new Date().toISOString(),
    //     });
    //   } catch (error) {
    //     console.error('Error tracking onboarding view:', error);
    //   }
    // };
    // trackOnboardingView();
  }, []);

  // Placeholder function for completing onboarding - Replace with actual API later
  const handleComplete = async () => {
    setLoading(true);
    try {
      // TODO: Mark onboarding as completed
      // await AsyncStorage.setItem('onboarding_completed', 'true');
      // await AsyncStorage.setItem('onboarding_completed_at', new Date().toISOString());

      // TODO: Track onboarding completion
      // await analytics.track('onboarding_completed', {
      //   completed_at: new Date().toISOString(),
      //   total_screens: 3,
      // });

      if (onComplete) {
        onComplete();
      } else {
        // Default navigation behavior - Navigate to Login screen
        navigateToLoginScreen(navigation);
      }
    } catch (error) {
      logger.error('Error completing onboarding', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F5F5" />

      {/* Header Section with Image and Text */}
      <View style={styles.headerContainer}>
        {/* Image Container */}
        <View style={styles.imageContainer}>
          <Image
            source={ONBOARDING_DATA.image}
            style={styles.image}
            resizeMode="cover"
          />
        </View>

        {/* Text Container */}
        <View style={styles.textContainer}>
          <View style={styles.headingContainer}>
            <Text style={styles.heading}>{ONBOARDING_DATA.title}</Text>
          </View>
          <View style={styles.paragraphContainer}>
            <Text style={styles.paragraph}>{ONBOARDING_DATA.description}</Text>
          </View>
        </View>
      </View>

      {/* Pagination Dots */}
      <View style={styles.paginationContainer}>
        <View style={styles.paginationDot} />
        <View style={styles.paginationDot} />
        <View style={[styles.paginationDot, styles.paginationDotActive]} />
      </View>

      {/* CTA Button */}
      <TouchableOpacity
        style={[styles.ctaButton, loading && styles.ctaButtonDisabled]}
        onPress={handleComplete}
        disabled={loading}
        activeOpacity={0.8}
      >
        <Text style={styles.ctaButtonText}>{ONBOARDING_DATA.ctaText}</Text>
        <View style={styles.ctaButtonIcon}>
          <Text style={styles.ctaButtonIconText}>›</Text>
        </View>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

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
      styles.ctaButton,
      loading && styles.ctaButtonDisabled,
    ]}
    onPress={onPress}
    disabled={loading}
    activeOpacity={0.8}
  >
    <Text style={styles.ctaButtonText}>
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
  headerContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 24,
    gap: 24,
  },
  imageContainer: {
    width: '100%',
    paddingHorizontal: 16,
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  image: {
    width: '100%',
    height: 425,
    borderRadius: 8,
  },
  textContainer: {
    width: '100%',
    paddingHorizontal: 16,
    gap: 20,
  },
  headingContainer: {
    width: '100%',
  },
  heading: {
    fontFamily: 'Inter',
    fontWeight: '700',
    fontSize: 24,
    lineHeight: 32,
    color: '#1A1A1A',
    textAlign: 'center',
  },
  paragraphContainer: {
    width: '100%',
  },
  paragraph: {
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 21,
    color: '#6B6B6B',
    textAlign: 'center',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 20,
  },
  paginationDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#E8E8E8',
  },
  paginationDotActive: {
    width: 28,
    backgroundColor: '#034703',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#034703',
    borderRadius: 8,
    paddingVertical: 13,
    paddingHorizontal: 143,
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 32,
  },
  ctaButtonDisabled: {
    opacity: 0.6,
  },
  ctaButtonText: {
    fontFamily: 'Inter',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 22.4,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  ctaButtonIcon: {
    width: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaButtonIconText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default OnboardingScreen3;

