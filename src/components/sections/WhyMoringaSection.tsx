import React, { useMemo } from 'react';
import { View, StyleSheet, Image, ImageSourcePropType } from 'react-native';
import Text from '../common/Text';
import { scale, getSpacing } from '../../utils/responsive';

interface WhyMoringaSectionProps {
  title?: string;
  description?: string;
  leafImage1?: ImageSourcePropType;
  leafImage2?: ImageSourcePropType;
  mainImage?: ImageSourcePropType;
}

export default function WhyMoringaSection({
  title = 'WHY MORINGA?',
  description = 'Packed with 92 nutrients, 46 antioxidants, and 100% ancient wisdom',
  leafImage1 = require('../../assets/images/why-moringa-leaf-1-350e8c.png'),
  leafImage2 = require('../../assets/images/why-moringa-leaf-2-350e8c.png'),
  mainImage = require('../../assets/images/why-moringa-main-4971eb.png'),
}: WhyMoringaSectionProps) {
  // Responsive dimensions - calculated using responsive utilities
  const sectionDimensions = useMemo(() => {
    const baseSectionWidth = 349; // Base design width
    const containerPadding = getSpacing(16) * 2; // 16px on each side
    const sectionWidth = Math.min(scale(baseSectionWidth), scale(375) - containerPadding);
    const sectionAspectRatio = 729 / 349; // Height / Width ratio
    const sectionHeight = sectionWidth * sectionAspectRatio;
    
    return {
      sectionWidth,
      sectionHeight,
    };
  }, []);

  const { sectionWidth, sectionHeight } = sectionDimensions;

  const leftPosition = -16 / 349 * sectionWidth;
  const rightPosition = (237 / 349) * sectionWidth;
  const topPosition1 = (529.51 / 729) * sectionHeight;
  const topPosition2 = (105.51 / 729) * sectionHeight;
  const textTop = (11.51 / 729) * sectionHeight;
  const mainImageTop = (140.51 / 729) * sectionHeight;

  const leaf1Width = (162.53 / 349) * sectionWidth;
  const leaf1Height = (191.29 / 729) * sectionHeight;
  const leaf2Width = (132.96 / 349) * sectionWidth;
  const leaf2Height = (156.09 / 729) * sectionHeight;
  const mainImageWidth = (291 / 349) * sectionWidth;
  const mainImageHeight = (517 / 729) * sectionHeight;
  const textContainerWidth = (325 / 349) * sectionWidth;

  return (
    <View style={[styles.container, { width: sectionWidth, height: sectionHeight }]}>
      {/* Leaf Image 1 - Left Bottom */}
      <View
        style={[
          styles.leafImage1,
          {
            left: leftPosition,
            top: topPosition1,
            width: leaf1Width,
            height: leaf1Height,
          },
        ]}
      >
        <Image
          source={leafImage1}
          style={styles.leafImage}
          resizeMode="contain"
        />
      </View>

      {/* Leaf Image 2 - Right Top */}
      <View
        style={[
          styles.leafImage2,
          {
            left: rightPosition,
            top: topPosition2,
            width: leaf2Width,
            height: leaf2Height,
          },
        ]}
      >
        <Image
          source={leafImage2}
          style={styles.leafImage}
          resizeMode="contain"
        />
      </View>

      {/* Text Container */}
      <View
        style={[
          styles.textContainer,
          {
            top: textTop,
            width: textContainerWidth,
            left: (11 / 349) * sectionWidth,
          },
        ]}
      >
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>

      {/* Main Image */}
      <View
        style={[
          styles.mainImageContainer,
          {
            top: mainImageTop,
            width: mainImageWidth,
            height: mainImageHeight,
            left: (29 / 349) * sectionWidth,
          },
        ]}
      >
        <Image
          source={mainImage}
          style={styles.mainImage}
          resizeMode="cover"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignSelf: 'center',
    marginVertical: 24,
  },
  leafImage1: {
    position: 'absolute',
    zIndex: 1,
  },
  leafImage2: {
    position: 'absolute',
    zIndex: 1,
  },
  leafImage: {
    width: '100%',
    height: '100%',
  },
  textContainer: {
    position: 'absolute',
    alignItems: 'center',
    gap: 8,
    zIndex: 2,
  },
  title: {
    fontFamily: 'highman-trial', // Note: Figma uses "Highman Trial" but using Inter as fallback
    fontSize: 36,
    fontWeight: '700',
    lineHeight: 48, // 1.1 * 52
    letterSpacing: 0, // 3.846% of 52
    color: '#1A1A1A',
    textAlign: 'left',
    textTransform: 'uppercase',
  },
  description: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20, // 1.5 * 16
    color: '#1A1A1A',
    textAlign: 'center',
    width: '100%',
  },
  mainImageContainer: {
    position: 'absolute',
    borderRadius: 8,
    overflow: 'hidden',
    zIndex: 0,
  },
  mainImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
});

