import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, StatusBar, Platform, ScrollView, TouchableOpacity, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import type { RootStackNavigationProp } from '../types/navigation';
import SearchIcon from '../components/icons/SearchIcon';
import Text from '../components/common/Text';
import CategoryCard from '../components/CategoryCard';
import FloatingCartBar from '../components/features/cart/FloatingCartBar';
import { useDimensions, getSpacing, scale } from '../utils/responsive';
import { logger } from '@/utils/logger';
import { homeService } from '../services/home/homeService';
import { getProductImageSource } from '../utils/productImage';

interface Category {
  id: string;
  name: string;
  image: any;
}

interface CategoryGroup {
  id: string;
  title: string;
  categories: Category[];
}

/** Map home API payload to CategoryGroup[] for this screen */
async function fetchCategoryGroupsFromHome(): Promise<CategoryGroup[]> {
  const res = await homeService.getHomePayload();
  const data = res?.data ?? res;
  const rawCategories = data?.categories ?? [];
  const typeByKey = data?.typeByKey ?? {};
  const sectionKey = Object.keys(typeByKey).find((k) => typeByKey[k] === 'super_category');
  const sectionDef = sectionKey
    ? (data?.config?.sectionDefinitions ?? []).find((d: any) => d.key === sectionKey)
    : null;
  const sectionTitle: string | undefined = sectionDef?.label;

  // No hardcoded fallback titles. If dashboard section definitions are missing, render nothing.
  if (!sectionTitle) return [];

  if (!Array.isArray(rawCategories) || rawCategories.length === 0) {
    return [{ id: 'main', title: sectionTitle, categories: [] }];
  }

  const categories: Category[] = rawCategories.map((c: any) => ({
    id: String(c._id ?? c.id),
    name: c.name ?? '',
    image: getProductImageSource({
      imageUrl: c.imageUrl,
      name: c.name,
      id: String(c._id ?? c.id ?? ''),
    }),
  }));

  return [{ id: 'main', title: sectionTitle, categories }];
}

interface CategoriesScreenProps {
  fetchCategories?: () => Promise<CategoryGroup[]>;
  onCategoryPress?: (categoryId: string) => void;
  onSearchPress?: () => void;
}

export default function CategoriesScreen({
  fetchCategories,
  onCategoryPress,
  onSearchPress,
}: CategoriesScreenProps) {
  const navigation = useNavigation<RootStackNavigationProp>();
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Calculate responsive card width for 3-column grid
  const { width: screenWidth } = useDimensions();
  const containerPadding = getSpacing(16) * 2; // Left and right padding
  const gapBetweenCards = getSpacing(16); // Gap between cards in a row
  const totalGaps = gapBetweenCards * 2; // 2 gaps for 3 cards
  const cardWidth = (screenWidth - containerPadding - totalGaps) / 3;

  // Animation for header
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerTranslateY = useRef(new Animated.Value(-20)).current;

  // Calculate total number of category cards for animations (cap for ref stability)
  const totalCategories = categoryGroups.reduce((sum, group) => sum + group.categories.length, 0);
  const MAX_ANIM_CARDS = 100;
  
  // Create animation refs for each category card (fixed max so ref is stable after load)
  const cardAnimations = useRef(
    Array.from({ length: MAX_ANIM_CARDS }, () => ({
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0.9),
    }))
  ).current;

  // Load categories from backend: use fetchCategories prop if provided, else home API
  useEffect(() => {
    let cancelled = false;
    const loadCategories = async () => {
      setLoading(true);
      try {
        const data = fetchCategories
          ? await fetchCategories()
          : await fetchCategoryGroupsFromHome();
        if (!cancelled) {
          setCategoryGroups(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        logger.error('Error fetching categories', error);
        if (!cancelled) setCategoryGroups([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadCategories();
    return () => {
      cancelled = true;
    };
  }, [fetchCategories]);

  // Animate header and cards when screen is focused
  useFocusEffect(
    useCallback(() => {
      // Reset animation values
      headerOpacity.setValue(0);
      headerTranslateY.setValue(-20);
      cardAnimations.forEach((anim) => {
        anim.opacity.setValue(0);
        anim.scale.setValue(0.9);
      });

      // Header animation
      Animated.parallel([
        Animated.timing(headerOpacity, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(headerTranslateY, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();

      // Staggered card animations
      cardAnimations.forEach((anim, index) => {
        Animated.parallel([
          Animated.timing(anim.opacity, {
            toValue: 1,
            duration: 400,
            delay: index * 40, // 40ms delay between cards
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(anim.scale, {
            toValue: 1,
            duration: 400,
            delay: index * 40,
            easing: Easing.out(Easing.back(1.2)),
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, [])
  );

  const handleSearch = () => {
    if (onSearchPress) {
      onSearchPress();
    } else {
      navigation.navigate('Search');
    }
  };

  const handleCategoryPress = (categoryId: string) => {
    if (onCategoryPress) {
      onCategoryPress(categoryId);
    } else {
      const category = categoryGroups.flatMap((g) => g.categories).find((cat) => cat.id === categoryId);
      const categoryName = category?.name || 'Category';
      navigation.navigate('CategoryProducts', {
        categoryId,
        categoryName: categoryName.replace(/\n/g, ' '), // Replace newlines with spaces
      });
    }
  };


  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header - Animated */}
        <Animated.View
          style={[
            styles.header,
            {
              opacity: headerOpacity,
              transform: [{ translateY: headerTranslateY }],
            },
          ]}
        >
          {/* Title Container */}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>All Categories</Text>
          </View>

          {/* Search Button */}
          <TouchableOpacity
            style={styles.searchButton}
            onPress={handleSearch}
            activeOpacity={0.7}
          >
            <View style={styles.searchButtonIcon}>
              <SearchIcon />
            </View>
          </TouchableOpacity>
        </Animated.View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading categories…</Text>
            </View>
          ) : (
          <>
          {/* Category Groups */}
          {categoryGroups.map((group, groupIndex) => {
            // Group categories into rows of 3
            const rows: Category[][] = [];
            for (let i = 0; i < group.categories.length; i += 3) {
              rows.push(group.categories.slice(i, i + 3));
            }

            const groupRowCount = Math.max(1, Math.ceil(group.categories.length / 3));
            const dynamicGroupPaddingVertical = groupRowCount <= 1 ? 12 : 20;
            const dynamicGroupGap = groupRowCount <= 1 ? 12 : 16;

            // Calculate starting card index for this group
            let cardIndex = 0;
            for (let i = 0; i < groupIndex; i++) {
              cardIndex += categoryGroups[i].categories.length;
            }

            return (
              <View
                key={group.id}
                style={[
                  styles.categoryGroup,
                  {
                    paddingVertical: dynamicGroupPaddingVertical,
                    gap: dynamicGroupGap,
                  },
                ]}
              >
                {/* Header Container */}
                <View style={styles.headerContainer}>
                  <View style={styles.groupTitleContainer}>
                    <Text style={styles.groupTitle}>{group.title}</Text>
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

                {/* Category Container */}
                <View style={styles.categoriesContainer}>
                  {rows.map((row, rowIndex) => (
                    <View key={rowIndex} style={styles.row}>
                      {row.map((category, categoryIndexInRow) => {
                        const currentCardIndex = cardIndex + rowIndex * 3 + categoryIndexInRow;
                        const anim = cardAnimations[currentCardIndex] ?? cardAnimations[0];
                        return (
                          <Animated.View
                            key={category.id}
                            style={{
                              opacity: anim.opacity,
                              transform: [{ scale: anim.scale }],
                            }}
                          >
                            <CategoryCard
                              image={category.image}
                              name={category.name}
                              onPress={() => handleCategoryPress(category.id)}
                              width={cardWidth}
                            />
                          </Animated.View>
                        );
                      })}
                      {/* Fill remaining slots if row has less than 3 items */}
                      {row.length < 3 && Array.from({ length: 3 - row.length }).map((_, index) => (
                        <View key={`spacer-${index}`} style={[styles.spacer, { width: cardWidth }]} />
                      ))}
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
          </>
          )}
        </ScrollView>

        {/* Floating Cart Bar - 4px above bottom nav bar */}
        <FloatingCartBar onPress={() => navigation.navigate('Cart')} hasBottomNav={true} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Inter',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28, // 1.4 * 20
    color: '#1A1A1A',
    textAlign: 'left',
  },
  searchButton: {
    width: 32,
    height: 32,
    borderRadius: 52,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  searchButtonIcon: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 80, // Add padding to prevent content from being hidden behind bottom nav
    paddingTop: 0,
    gap: 0,
  },
  categoryGroup: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 16,
    alignSelf: 'stretch',
    marginBottom: 0,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 10,
  },
  groupTitleContainer: {
    flexShrink: 0,
  },
  groupTitle: {
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24, // 1.5 * 16
    color: '#222222',
  },
  dividerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    width: '100%',
    height: 1,
  },
  categoriesContainer: {
    gap: 24, // Gap between rows
  },
  row: {
    flexDirection: 'row',
    gap: 16, // Gap between cards
    width: '100%',
  },
  spacer: {
    // Width will be set dynamically via inline style
  },
});

