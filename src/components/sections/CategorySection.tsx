import React, { useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import type { RootStackNavigationProp } from '../../types/navigation';
import Text from '../common/Text';
import CategoryCard from '../CategoryCard';
import handleHomeLink from '../../utils/navigation/linkHandler';
import { getProductImageSource, getProductImageUrl } from '../../utils/productImage';

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
  categories?: Category[]; // optional external categories from backend
  blockStyle?: { columns?: number };
  /** When true, category tiles use high network/decode priority (first grid on home). */
  highImagePriority?: boolean;
}

export default function CategorySection({ title, onCategoryPress, categories: externalCategories, blockStyle, highImagePriority }: CategorySectionProps) {
  const navigation = useNavigation<RootStackNavigationProp>();
  const { width: screenWidth } = useWindowDimensions();
  // Grocery category grids use at least 3 per row (e.g. Flour & Masala). CMS may still send columns: 2.
  const requestedCols = blockStyle?.columns;
  const columns =
    requestedCols && requestedCols >= 2 && requestedCols <= 5
      ? Math.max(requestedCols, 3)
      : 3;
  const sourceCategories = useMemo(() => {
    const raw = externalCategories ?? [];
    return raw.map((c) => {
      // If caller already provided a static require(), keep as-is.
      const img = c?.image as any;
      const isStatic = typeof img === 'number';
      if (isStatic) return c;

      // If caller provided a valid http(s) uri already, keep as-is.
      const existingUri =
        typeof img === 'object' && img && !Array.isArray(img) && typeof img.uri === 'string'
          ? img.uri.trim()
          : null;
      if (existingUri && /^https?:\/\//i.test(existingUri)) return c;

      // Otherwise normalize whatever shape into a safe absolute URL.
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

      return { ...c, image: getProductImageSource({ id: c?.id, name: c?.name, imageUrl: normalizedUri }) };
    });
  }, [externalCategories]);
  const effectiveColumns = Math.max(1, Math.min(columns, sourceCategories.length || columns));
  const horizontalPadding = 16 * 2;
  const cardGap = 12;

  const cardWidth = useMemo(() => {
    const available = Math.max(200, screenWidth - horizontalPadding - cardGap * Math.max(0, effectiveColumns - 1));
    const computed = Math.floor(available / effectiveColumns);
    return Math.max(96, Math.min(140, computed));
  }, [screenWidth, effectiveColumns]);
  const rowCount = Math.max(1, Math.ceil(sourceCategories.length / columns));
  const dynamicPaddingVertical = rowCount <= 1 ? 12 : 20;
  const dynamicContainerGap = rowCount <= 1 ? 12 : 16;
  const dynamicCategoriesGap = rowCount <= 1 ? 12 : 16;

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

  // Group categories into rows
  const rows: Category[][] = [];
  for (let i = 0; i < sourceCategories.length; i += columns) {
    rows.push(sourceCategories.slice(i, i + columns));
  }

  return (
    <View style={[styles.container, { paddingVertical: dynamicPaddingVertical, gap: dynamicContainerGap }]}>
      <View style={styles.headerContainer}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{title}</Text>
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
          <View key={rowIndex} style={[styles.row, { gap: cardGap }]}>
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
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 10, // Matches Figma
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  dividerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: 1,
  },
  divider: {
    width: 214, // Fixed width from Figma
    height: 1,
  },
  title: {
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '500', // Changed from '600' to '500' to match Figma
    lineHeight: 24, // 1.5em = 24px
    color: '#222222',
    textAlign: 'left',
    textAlignVertical: 'center',
  },
  categoriesContainer: {
    gap: 16, // Overridden dynamically for compact/1-row layouts
  },
  row: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    justifyContent: 'flex-start',
  },
});

