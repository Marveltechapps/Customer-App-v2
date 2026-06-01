import React, { useMemo } from 'react';
import { View, StyleSheet, Text, Image, ImageSourcePropType } from 'react-native';
import { scale, getSpacing } from '../../utils/responsive';

interface OrganicTaglineSectionProps {
  icon?: ImageSourcePropType;
  tagline?: string;
}

export default function OrganicTaglineSection({ icon, tagline }: OrganicTaglineSectionProps) {
  if (!tagline) {
    return null;
  }
  // Responsive dimensions
  const responsiveDimensions = useMemo(() => {
    const containerPadding = getSpacing(16) * 2; // 16px on each side
    const baseContentWidth = 350; // Base design width
    const contentWidth = Math.min(scale(baseContentWidth), scale(375) - containerPadding);
    const iconWidth = scale(22.92);
    const iconHeight = scale(20.04);
    
    // Icon position: 304px from left in 350px container (from Figma)
    // Scale proportionally for different screen widths
    const iconLeft = (304 / 350) * contentWidth;
    const iconTop = scale(66.96);
    
    return {
      contentWidth,
      iconWidth,
      iconHeight,
      iconLeft,
      iconTop,
    };
  }, []);

  const { contentWidth, iconWidth, iconHeight, iconLeft, iconTop } = responsiveDimensions;

  return (
    <View style={styles.container}>
      <View style={[styles.contentContainer, { width: contentWidth }]}>
        {/* Tagline Text */}
        <Text style={styles.taglineText}>{tagline}</Text>
        
        {/* Icon positioned absolutely */}
        <View
          style={[
            styles.iconContainer,
            {
              left: iconLeft,
              top: iconTop,
              width: iconWidth,
              height: iconHeight,
            },
          ]}
        >
          {icon ? (
          <Image source={icon} style={styles.icon} resizeMode="contain" />
        ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 0, // Remove bottom padding
    gap: 12,
    backgroundColor: '#F5f5f5',
  },
  contentContainer: {
    position: 'relative',
    height: 96,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  taglineText: {
    fontFamily: 'Inter', // Using Inter instead of Segoe UI for consistency
    fontSize: 36,
    fontWeight: '700',
    lineHeight: 48, // 1.333 * 36
    color: '#ACACAC',
    textAlign: 'left',
    width: '100%',
  },
  iconContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    width: '100%',
    height: '100%',
  },
});

