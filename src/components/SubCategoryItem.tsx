import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, ImageSourcePropType, Platform } from 'react-native';
import Text from './common/Text';
import { scale, scaleFont, getSpacing, getBorderRadius, useDimensions } from '../utils/responsive';

interface SubCategoryItemProps {
  id: string;
  name: string;
  image: ImageSourcePropType;
  isSelected: boolean;
  onPress: (id: string) => void;
}

export default function SubCategoryItem({
  id,
  name,
  image,
  isSelected,
  onPress,
}: SubCategoryItemProps) {
  const { width } = useDimensions();
  
  // Responsive sizes - memoized to prevent recalculation on every render
  const responsiveStyles = useMemo(() => {
    const imageSize = scale(40);
    const borderRadius = getBorderRadius(4);
    const containerPadding = getSpacing(12);
    const horizontalPadding = getSpacing(4);
    const gap = getSpacing(4);
    const fontSize = scaleFont(10, 9, 12);
    const lineHeight = fontSize * 1.4;
    const borderWidth = scale(2);
    const textPadding = scale(3.5);
    const shadowRadius = scale(2);
    const androidBorderWidth = scale(2);
    
    return {
      container: {
        paddingVertical: containerPadding,
        paddingHorizontal: horizontalPadding,
        gap: gap,
      },
      imageContainerWrapper: {
        width: imageSize,
        height: imageSize,
      },
      imageContainerOuter: {
        width: imageSize,
        height: imageSize,
        borderRadius: borderRadius,
      },
      imageContainer: {
        width: imageSize,
        height: imageSize,
        borderRadius: borderRadius,
      },
      selectedContainer: {
        borderLeftWidth: borderWidth,
      },
      textContainer: {
        paddingHorizontal: textPadding,
      },
      categoryName: {
        fontSize: fontSize,
        lineHeight: lineHeight,
      },
      imageContainerOuterSelectedAndroid: Platform.OS === 'android' ? {
        borderWidth: androidBorderWidth,
        borderRadius: borderRadius,
      } : {},
    };
  }, [width]);

  return (
    <TouchableOpacity
      style={[styles.container, responsiveStyles.container, isSelected && [styles.selectedContainer, responsiveStyles.selectedContainer]]}
      onPress={() => onPress(id)}
      activeOpacity={0.7}
    >
      <View style={[styles.imageContainerWrapper, responsiveStyles.imageContainerWrapper]}>
        <View style={[
          styles.imageContainerOuter, 
          responsiveStyles.imageContainerOuter, 
          isSelected && styles.imageContainerOuterSelected,
          isSelected && responsiveStyles.imageContainerOuterSelectedAndroid
        ]}>
          <View style={[styles.imageContainer, responsiveStyles.imageContainer, isSelected && styles.imageContainerSelected]}>
            <Image source={image} style={styles.image} resizeMode="cover" />
          </View>
        </View>
      </View>
      <View style={[styles.textContainer, responsiveStyles.textContainer]}>
        <Text 
          style={
            isSelected 
              ? [styles.categoryName, responsiveStyles.categoryName, styles.selectedCategoryName] as any
              : [styles.categoryName, responsiveStyles.categoryName]
          }
        >
          {name}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'column',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  selectedContainer: {
    backgroundColor: '#E0F2F1',
    borderLeftColor: '#034703',
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomWidth: 0,
  },
  imageContainerWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainerOuter: {
    // Dimensions moved to dynamic styles
  },
  imageContainerOuterSelected: {
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(3, 71, 3, 0.3)',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 2, // Spread effect
      },
      android: {
        // For Android, use border to simulate shadow spread - borderWidth and borderRadius will be overridden by dynamic styles
        borderColor: 'rgba(3, 71, 3, 0.3)',
      },
    }),
  },
  imageContainer: {
    backgroundColor: 'rgba(3, 71, 3, 0.1)',
    borderWidth: 0, // No border for unselected items
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  imageContainerSelected: {
    borderWidth: 1,
    borderColor: '#3F723F', // Green border only when selected
  },
  image: {
    width: '100%',
    height: '100%',
  },
  textContainer: {
    paddingVertical: 0,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  categoryName: {
    fontFamily: 'Inter',
    fontWeight: '500',
    color: '#4C4C4C',
    textAlign: 'center',
  },
  selectedCategoryName: {
    color: '#034703',
    fontWeight: '600',
  },
});

