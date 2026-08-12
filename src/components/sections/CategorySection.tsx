import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import type { RootStackNavigationProp } from '../../types/navigation';
import Text from '../common/Text';
import CategoryCard from '../CategoryCard';
import handleHomeLink from '../../utils/navigation/linkHandler';
import { getProductImageSource, getProductImageUrl } from '../../utils/productImage';
import { getGridMetrics, scaleFont, Spacing, useResponsive } from '../../utils/responsive';

interface Category {
  id: string;
  name: string;
  image: any;
  /** When set, tap opens this link (product:id, category:id, URL, or screen); else CategoryProducts */
  link?: string;
}

interface CategorySectionProps {
  title?: string;
  onCategoryPress?: (categoryId: string) => void;
  categories?: Category[];
  blockStyle?: { columns?: number };
  /** When true, category tiles use high network/decode priority (first grid on home). */
  highImagePriority?: boolean;
}

export default function CategorySection({
  title,
  onCategoryPress,
  categories: externalCategories,
  blockStyle,
  highImagePriority,
}: CategorySectionProps) {
  const navigation = useNavigation<RootStackNavigationProp>();
  const { width: screenWidth } = useResponsive();

  const sourceCategories = useMemo(() => {
    const raw = externalCategories ?? [];
    return raw.map((c) => {
      const img = c?.image as any;
      const isStatic = typeof img === 'number';
      if (isStatic) return c;

      const existingUri =
        typeof img === 'object' && img && !Array.isArray(img) && typeof img.uri === 'string'
          ? img.uri.trim()
          : null;
      if (existingUri && /^https?:\/\//i.test(existingUri)) return c;

      const normalizedUri = getProductImageUrl({
        id: c?.id,
        name: c?.name,
        imageUrl:
          (typeof img === 'string' ? img : undefined) ??
          (typeof img?.uri === 'string' ? img.uri : undefined) ??
          (typeof img?.url === 'string' ? img.url : undefined) ??
          (typeof img?.imageUrl === 'string' ? img.imageUrl : undefined),
        image: img,
      });

      return {
        ...c,
        image: getProductImageSource({ id: c?.id, name: c?.name, imageUrl: normalizedUri }),
      };
    });
  }, [externalCategories]);

  const grid = useMemo(() => {
    // Dynamic columns by breakpoint; CMS columns only floor phone layouts
    const requested = blockStyle?.columns;
    if (requested && requested >= 2 && requested <= 7 && screenWidth < 768) {
      return getGridMetrics(screenWidth, {
        columns: Math.max(requested, 3),
        gap: 12,
        horizontalPadding: 16,
      });
    }
    return getGridMetrics(screenWidth, {
      gap: 12,
      horizontalPadding: 16,
      preferredCardWidth: 110,
    });
  }, [screenWidth, blockStyle?.columns]);

  const effectiveColumns = Math.max(
    1,
    Math.min(grid.columns, sourceCategories.length || grid.columns),
  );

  const cardWidth = useMemo(() => {
    const available =
      screenWidth - grid.horizontalPadding * 2 - grid.gap * Math.max(0, effectiveColumns - 1);
    return Math.floor(Math.max(72, available / effectiveColumns));
  }, [screenWidth, grid.horizontalPadding, grid.gap, effectiveColumns]);

  const rowCount = Math.max(1, Math.ceil(sourceCategories.length / effectiveColumns));
  const dynamicPaddingVertical = rowCount <= 1 ? Spacing.md() : Spacing.xl();
  const dynamicContainerGap = rowCount <= 1 ? Spacing.md() : Spacing.lg();
  const dynamicCategoriesGap = rowCount <= 1 ? Spacing.md() : Spacing.lg();
  const titleFontSize = scaleFont(16, 14, 18);
  const titleLineHeight = Math.round(titleFontSize * 1.5);

  const handleCategoryPress = (categoryId: string) => {
    try {
      if (onCategoryPress) {
        onCategoryPress(categoryId);
        return;
      }
      const category = sourceCategories.find((cat) => cat.id === categoryId);
      if (category?.link) {
        handleHomeLink(category.link, navigation);
        return;
      }
      const categoryName = category?.name || 'Category';
      navigation.navigate('CategoryProducts', {
        categoryId,
        categoryName: categoryName.replace(/\n/g, ' '),
      });
    } catch (error) {
      console.warn('Error navigating to category:', error);
    }
  };

  const rows: Category[][] = [];
  for (let i = 0; i < sourceCategories.length; i += effectiveColumns) {
    rows.push(sourceCategories.slice(i, i + effectiveColumns));
  }

  return (
    <View
      style={[
        styles.container,
        {
          paddingHorizontal: grid.horizontalPadding,
          paddingVertical: dynamicPaddingVertical,
          gap: dynamicContainerGap,
        },
      ]}
    >
      <View style={styles.headerContainer}>
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { fontSize: titleFontSize, lineHeight: titleLineHeight }]}>
            {title}
          </Text>
        </View>
        <View style={styles.dividerContainer}>
          <LinearGradient
            colors={['rgba(121, 121, 121, 1)', 'rgba(245, 245, 245, 1)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.divider}
          />
        </View>
      </View>

      <View style={[styles.categoriesContainer, { gap: dynamicCategoriesGap }]}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={[styles.row, { gap: grid.gap }]}>
            {row.map((category) => (
              <CategoryCard
                key={category.id}
                image={category.image}
                name={category.name}
                onPress={() => handleCategoryPress(category.id)}
                width={cardWidth}
                imagePriority={highImagePriority ? 'high' : 'normal'}
                imageRecyclingKey={`category-${category.id}`}
              />
            ))}
            {/* Equal-width spacers so partial rows stay aligned */}
            {row.length < effectiveColumns &&
              Array.from({ length: effectiveColumns - row.length }).map((_, index) => (
                <View key={`spacer-${rowIndex}-${index}`} style={{ width: cardWidth }} />
              ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 10,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
    maxWidth: '55%',
  },
  dividerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    height: 1,
    minWidth: 24,
  },
  divider: {
    width: '100%',
    height: 1,
  },
  title: {
    fontFamily: 'Inter',
    fontWeight: '500',
    color: '#222222',
    textAlign: 'left',
    textAlignVertical: 'center',
  },
  categoriesContainer: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    justifyContent: 'flex-start',
    width: '100%',
  },
});
