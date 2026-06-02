import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import Text from './common/Text';
import CmsRemoteImage from './common/CmsRemoteImage';
import { collectProductImageUrlCandidates, getImageFitFromUrl } from '../utils/productImage';
import { scale, scaleFont, getSpacing, getBorderRadius, useDimensions } from '../utils/responsive';

interface SubCategoryItemProps {
  id: string;
  name: string;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  cardImageUrl?: string | null;
  isSelected: boolean;
  onPress: (id: string) => void;
}

export default function SubCategoryItem({
  id,
  name,
  imageUrl,
  thumbnailUrl,
  cardImageUrl,
  isSelected,
  onPress,
}: SubCategoryItemProps) {
  const { width } = useDimensions();

  const imageUri = useMemo(() => {
    const candidates = collectProductImageUrlCandidates({
      id,
      name,
      imageUrl: imageUrl ?? undefined,
      thumbnailUrl: thumbnailUrl ?? undefined,
      cardImageUrl: cardImageUrl ?? undefined,
    });
    return candidates[0] ?? '';
  }, [cardImageUrl, id, imageUrl, name, thumbnailUrl]);

  const imageFit = getImageFitFromUrl(imageUri);

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
      imageContainerOuterSelectedAndroid:
        Platform.OS === 'android'
          ? {
              borderWidth: scale(2),
              borderRadius: borderRadius,
            }
          : {},
    };
  }, [width]);

  return (
    <TouchableOpacity
      style={[styles.container, responsiveStyles.container, isSelected && [styles.selectedContainer, responsiveStyles.selectedContainer]]}
      onPress={() => onPress(id)}
      activeOpacity={0.7}
    >
      <View style={[styles.imageContainerWrapper, responsiveStyles.imageContainerWrapper]}>
        <View
          style={[
            styles.imageContainerOuter,
            responsiveStyles.imageContainerOuter,
            isSelected && styles.imageContainerOuterSelected,
            isSelected && responsiveStyles.imageContainerOuterSelectedAndroid,
          ]}
        >
          <View style={[styles.imageContainer, responsiveStyles.imageContainer, isSelected && styles.imageContainerSelected]}>
            {imageUri ? (
              <CmsRemoteImage
                uri={imageUri}
                style={styles.image}
                contentFit={imageFit}
                contentPosition="center"
                recyclingKey={`subcat-${id}`}
                cachePolicy="disk"
              />
            ) : (
              <View style={styles.image} />
            )}
          </View>
        </View>
      </View>
      <View style={[styles.textContainer, responsiveStyles.textContainer]}>
        <Text
          style={
            isSelected
              ? ([styles.categoryName, responsiveStyles.categoryName, styles.selectedCategoryName] as any)
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
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  selectedContainer: {
    backgroundColor: '#F5F5F5',
    borderLeftColor: '#2D5016',
  },
  imageContainerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainerOuter: {
    overflow: 'hidden',
    backgroundColor: '#F0F0F0',
  },
  imageContainerOuterSelected: {
    borderColor: '#2D5016',
  },
  imageContainer: {
    overflow: 'hidden',
    backgroundColor: '#F0F0F0',
  },
  imageContainerSelected: {},
  image: {
    width: '100%',
    height: '100%',
  },
  textContainer: {
    alignItems: 'center',
    width: '100%',
  },
  categoryName: {
    fontFamily: 'Inter',
    fontWeight: '500',
    color: '#666666',
    textAlign: 'center',
  },
  selectedCategoryName: {
    color: '#2D5016',
    fontWeight: '600',
  },
});
