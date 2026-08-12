import React, { useMemo } from 'react';
import { View, StyleSheet, Text, Image, ImageSourcePropType } from 'react-native';
import { scaleFont, Spacing, useResponsive } from '../../utils/responsive';

interface OrganicTaglineSectionProps {
  icon?: ImageSourcePropType;
  tagline?: string;
}

export default function OrganicTaglineSection({ icon, tagline }: OrganicTaglineSectionProps) {
  const { width: screenWidth, spacing } = useResponsive();

  const layout = useMemo(() => {
    const horizontalPad = Spacing.lg();
    const contentWidth = Math.max(0, screenWidth - horizontalPad * 2);
    const fontSize = scaleFont(36, 28, 42);
    const lineHeight = Math.round(fontSize * 1.33);
    const iconWidth = Math.max(18, spacing(23));
    const iconHeight = Math.max(16, spacing(20));
    return {
      horizontalPad,
      contentWidth,
      fontSize,
      lineHeight,
      iconWidth,
      iconHeight,
      minHeight: Math.max(lineHeight * 2, spacing(96)),
    };
  }, [screenWidth, spacing]);

  if (!tagline) {
    return null;
  }

  return (
    <View style={[styles.container, { paddingHorizontal: layout.horizontalPad }]}>
      <View style={[styles.contentContainer, { minHeight: layout.minHeight }]}>
        <Text
          style={[
            styles.taglineText,
            { fontSize: layout.fontSize, lineHeight: layout.lineHeight },
          ]}
        >
          {tagline}
        </Text>
        {icon ? (
          <View
            style={[
              styles.iconContainer,
              {
                width: layout.iconWidth,
                height: layout.iconHeight,
              },
            ]}
          >
            <Image source={icon} style={styles.icon} resizeMode="contain" />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingTop: Spacing.xl(),
    paddingBottom: 0,
    gap: Spacing.md(),
    backgroundColor: '#F5f5f5',
  },
  contentContainer: {
    width: '100%',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  taglineText: {
    fontFamily: 'Inter',
    fontWeight: '700',
    color: '#ACACAC',
    textAlign: 'left',
    width: '100%',
    paddingRight: 28,
  },
  iconContainer: {
    position: 'absolute',
    right: 0,
    bottom: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    width: '100%',
    height: '100%',
  },
});
