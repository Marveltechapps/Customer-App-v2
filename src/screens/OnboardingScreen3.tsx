import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { logger } from '@/utils/logger';
import { navigateToLoginScreen } from '../utils/navigationRef';
import { LOCAL_ONBOARDING_PAGES } from '../constants/onboarding';
import { Colors } from '../constants/Colors';
import { useResponsive } from '@/utils/responsive';

const PAGE = LOCAL_ONBOARDING_PAGES[2];
/** Figma reference: 361 × 425 image slot. */
const IMAGE_ASPECT_RATIO = 361 / 425;

interface OnboardingScreen3Props {
  onComplete?: () => void;
}

const OnboardingScreen3: React.FC<OnboardingScreen3Props> = ({ onComplete }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [loading, setLoading] = useState(false);
  const { hp } = useResponsive();

  const handleComplete = async () => {
    setLoading(true);
    try {
      if (onComplete) {
        onComplete();
      } else {
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
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      <View style={styles.headerContainer}>
        <View style={styles.imageOuter}>
          <View style={styles.imageContainer}>
            <Image
              source={PAGE.image}
              style={[styles.image, { aspectRatio: IMAGE_ASPECT_RATIO, maxHeight: hp(46) }]}
              resizeMode="cover"
            />
          </View>
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.heading}>{PAGE.title}</Text>
          <Text style={styles.paragraph}>{PAGE.description}</Text>
        </View>
      </View>

      <View style={styles.paginationContainer}>
        <View style={styles.paginationDot} />
        <View style={styles.paginationDot} />
        <View style={[styles.paginationDot, styles.paginationDotActive]} />
      </View>

      <TouchableOpacity
        style={[styles.ctaButton, loading && styles.ctaButtonDisabled]}
        onPress={handleComplete}
        disabled={loading}
        activeOpacity={0.8}
      >
        <Text style={styles.ctaButtonText}>
          {PAGE.ctaText || 'Begin your clean food journey'}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
  imageOuter: {
    width: '100%',
    paddingHorizontal: 16,
  },
  imageContainer: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
  },
  textContainer: {
    width: '100%',
    paddingHorizontal: 16,
    gap: 20,
  },
  heading: {
    fontFamily: 'Inter',
    fontWeight: '700',
    fontSize: 24,
    lineHeight: 32,
    color: Colors.text,
    textAlign: 'center',
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
    backgroundColor: Colors.primary,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
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
    color: Colors.white,
    textAlign: 'center',
  },
});

export default OnboardingScreen3;
