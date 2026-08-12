import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, StatusBar, Platform, ScrollView, TouchableOpacity, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useCatalogCache } from '../contexts/CatalogCacheContext';
import { LinearGradient } from 'expo-linear-gradient';
import type { RootStackNavigationProp } from '../types/navigation';
import SearchIcon from '../components/icons/SearchIcon';
import Text from '../components/common/Text';
import CategoryCard from '../components/CategoryCard';
import FloatingCartBar from '../components/features/cart/FloatingCartBar';
import { useResponsive, getGridMetrics, scaleFont, Spacing } from '../utils/responsive';
import { logger } from '@/utils/logger';
import type { CategoryGroup, CategoryListItem } from '../utils/catalogCacheLoaders';

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
  const { categoryGroups: cachedCategoryGroups, categoriesLoading, ensureCatalogLoaded } = useCatalogCache();
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const loading = categoriesLoading && (!cachedCategoryGroups || cachedCategoryGroups.length === 0);

  const { width: screenWidth } = useResponsive();
  const grid = getGridMetrics(screenWidth, {
    gap: 16,
    horizontalPadding: 16,
    preferredCardWidth: 110,
  });
  const columns = grid.columns;
  const cardWidth = grid.cardWidth;
  const titleFontSize = scaleFont(20, 18, 24);
  const groupTitleFontSize = scaleFont(16, 14, 18);

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

  useEffect(() => {
    void ensureCatalogLoaded();
  }, [ensureCatalogLoaded]);

  useEffect(() => {
    if (fetchCategories) {
      void (async () => {
        try {
          const data = await fetchCategories();
          setCategoryGroups(Array.isArray(data) ? data : []);
        } catch (error) {
          logger.error('Error fetching categories', error);
          setCategoryGroups([]);
        }
      })();
      return;
    }
    if (cachedCategoryGroups) {
      setCategoryGroups(cachedCategoryGroups);
    }
  }, [fetchCategories, cachedCategoryGroups]);

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
            <Text style={[styles.title, { fontSize: titleFontSize, lineHeight: Math.round(titleFontSize * 1.4) }]}>
              All Categories
            </Text>
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
            // Dynamic columns based on screen width (phones 3, tablets 4–6+)
            const rows: CategoryListItem[][] = [];
            for (let i = 0; i < group.categories.length; i += columns) {
              rows.push(group.categories.slice(i, i + columns));
            }

            const groupRowCount = Math.max(1, Math.ceil(group.categories.length / columns));
            const dynamicGroupPaddingVertical = groupRowCount <= 1 ? Spacing.md() : Spacing.xl();
            const dynamicGroupGap = groupRowCount <= 1 ? Spacing.md() : Spacing.lg();

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
                    paddingHorizontal: grid.horizontalPadding,
                    paddingVertical: dynamicGroupPaddingVertical,
                    gap: dynamicGroupGap,
                  },
                ]}
              >
                {/* Header Container */}
                <View style={styles.headerContainer}>
                  <View style={styles.groupTitleContainer}>
                    <Text
                      style={[
                        styles.groupTitle,
                        {
                          fontSize: groupTitleFontSize,
                          lineHeight: Math.round(groupTitleFontSize * 1.5),
                        },
                      ]}
                    >
                      {group.title}
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

                {/* Category Container */}
                <View style={[styles.categoriesContainer, { gap: Spacing.xxl() }]}>
                  {rows.map((row, rowIndex) => (
                    <View key={rowIndex} style={[styles.row, { gap: grid.gap }]}>
                      {row.map((category, categoryIndexInRow) => {
                        const currentCardIndex =
                          cardIndex + rowIndex * columns + categoryIndexInRow;
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
                      {row.length < columns &&
                        Array.from({ length: columns - row.length }).map((_, index) => (
                          <View
                            key={`spacer-${index}`}
                            style={[styles.spacer, { width: cardWidth }]}
                          />
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
    fontWeight: '700',
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
    paddingBottom: 80,
    paddingTop: 0,
    gap: 0,
  },
  categoryGroup: {
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
    flexShrink: 1,
    maxWidth: '55%',
  },
  groupTitle: {
    fontFamily: 'Inter',
    fontWeight: '500',
    color: '#222222',
  },
  dividerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    minWidth: 24,
  },
  divider: {
    width: '100%',
    height: 1,
  },
  categoriesContainer: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    width: '100%',
  },
  spacer: {},
});

