import React, { useMemo } from 'react';
import { View, StyleSheet, Image, ImageSourcePropType } from 'react-native';
import Text from '../common/Text';
import { scaleFont, Spacing, useResponsive } from '../../utils/responsive';

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
  const { width: screenWidth } = useResponsive();

  const dims = useMemo(() => {
    const horizontalPad = Spacing.lg();
    const sectionWidth = Math.max(0, screenWidth - horizontalPad * 2);
    const sectionAspectRatio = 729 / 349;
    const sectionHeight = sectionWidth * sectionAspectRatio;
    return {
      horizontalPad,
      sectionWidth,
      sectionHeight,
      leftPosition: (-16 / 349) * sectionWidth,
      rightPosition: (237 / 349) * sectionWidth,
      topPosition1: (529.51 / 729) * sectionHeight,
      topPosition2: (105.51 / 729) * sectionHeight,
      textTop: (11.51 / 729) * sectionHeight,
      mainImageTop: (140.51 / 729) * sectionHeight,
      leaf1Width: (162.53 / 349) * sectionWidth,
      leaf1Height: (191.29 / 729) * sectionHeight,
      leaf2Width: (132.96 / 349) * sectionWidth,
      leaf2Height: (156.09 / 729) * sectionHeight,
      mainImageWidth: (291 / 349) * sectionWidth,
      mainImageHeight: (517 / 729) * sectionHeight,
      textContainerWidth: (325 / 349) * sectionWidth,
      titleSize: scaleFont(24, 20, 28),
      descSize: scaleFont(14, 12, 16),
    };
  }, [screenWidth]);

  return (
    <View style={[styles.outer, { paddingHorizontal: dims.horizontalPad }]}>
      <View style={[styles.container, { width: dims.sectionWidth, height: dims.sectionHeight }]}>
        <View
          style={[
            styles.leafImage1,
            {
              left: dims.leftPosition,
              top: dims.topPosition1,
              width: dims.leaf1Width,
              height: dims.leaf1Height,
            },
          ]}
        >
          <Image source={leafImage1} style={styles.leafImage} resizeMode="contain" />
        </View>

        <View
          style={[
            styles.leafImage2,
            {
              left: dims.rightPosition,
              top: dims.topPosition2,
              width: dims.leaf2Width,
              height: dims.leaf2Height,
            },
          ]}
        >
          <Image source={leafImage2} style={styles.leafImage} resizeMode="contain" />
        </View>

        <View
          style={[
            styles.mainImageContainer,
            {
              top: dims.mainImageTop,
              width: dims.mainImageWidth,
              height: dims.mainImageHeight,
              left: (dims.sectionWidth - dims.mainImageWidth) / 2,
            },
          ]}
        >
          <Image source={mainImage} style={styles.mainImage} resizeMode="contain" />
        </View>

        <View
          style={[
            styles.textContainer,
            {
              top: dims.textTop,
              width: dims.textContainerWidth,
              left: (dims.sectionWidth - dims.textContainerWidth) / 2,
            },
          ]}
        >
          <Text style={[styles.title, { fontSize: dims.titleSize, lineHeight: Math.round(dims.titleSize * 1.2) }]}>
            {title}
          </Text>
          <Text
            style={[
              styles.description,
              { fontSize: dims.descSize, lineHeight: Math.round(dims.descSize * 1.4) },
            ]}
          >
            {description}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: Spacing.xl(),
  },
  container: {
    position: 'relative',
    overflow: 'hidden',
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
  mainImageContainer: {
    position: 'absolute',
    zIndex: 2,
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  textContainer: {
    position: 'absolute',
    zIndex: 3,
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontFamily: 'Inter',
    fontWeight: '700',
    color: '#034703',
    textAlign: 'center',
  },
  description: {
    fontFamily: 'Inter',
    fontWeight: '400',
    color: '#4C4C4C',
    textAlign: 'center',
  },
});
