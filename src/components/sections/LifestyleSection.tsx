import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, Image, ScrollView, ImageSourcePropType } from 'react-native';
import LifestyleCard, { LifestyleItem } from '../LifestyleCard';
import { logger } from '@/utils/logger';
import { handleRedirect } from '../../utils/navigation/linkHandler';
import { useNavigation } from '@react-navigation/native';
import type { RootStackNavigationProp } from '../../types/navigation';
import { bannerIsTapEnabled } from '@/utils/bannerInteraction';
import { useResponsive } from '../../utils/responsive';

/** Figma reference: header image slot 363.5 × 128. */
const HEADER_IMAGE_ASPECT_RATIO = 363.5 / 128;

interface LifestyleSectionProps {
  onItemPress?: (itemId: string) => void;
  fetchItems?: () => Promise<LifestyleItem[]>;
  headerImage?: ImageSourcePropType;
  blockStyle?: { cardWidth?: number };
}

export default function LifestyleSection({
  onItemPress,
  fetchItems,
  headerImage,
  blockStyle,
}: LifestyleSectionProps) {
  const navigation = useNavigation<RootStackNavigationProp>();
  const { wp, isTablet } = useResponsive();
  const [items, setItems] = useState<LifestyleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const headerImg = headerImage;

  // Placeholder for API integration
  useEffect(() => {
    if (fetchItems) {
      const loadItems = async () => {
        setLoading(true);
        try {
          const data = await fetchItems();
          setItems(data);
        } catch (error) {
          logger.error('Error fetching lifestyle items', error);
          setItems([]);
        } finally {
          setLoading(false);
        }
      };
      loadItems();
    }
  }, [fetchItems]);

  // Responsive card width: ~38% of screen on phones, ~22% on tablets (unless CMS overrides it).
  const cardWidth = useMemo(() => {
    if (blockStyle?.cardWidth != null) return blockStyle.cardWidth;
    const target = isTablet ? wp(22) : wp(38);
    return Math.round(Math.min(220, Math.max(120, target)));
  }, [blockStyle?.cardWidth, isTablet, wp]);

  const handleItemPress = (itemId: string) => {
    const item = items.find((i) => i.id === itemId) as any;
    if (onItemPress) {
      onItemPress(itemId);
      return;
    }
    if (!bannerIsTapEnabled(item)) {
      return;
    }
    if (item && (item.link || (item.redirectType && item.redirectValue))) {
      if (item.redirectType && item.redirectValue) {
        handleRedirect({ redirectType: item.redirectType, redirectValue: item.redirectValue }, navigation);
      } else if (item.link) {
        handleRedirect(item.link, navigation);
      }
      return;
    }
    logger.info('Lifestyle item pressed', { itemId });
  };

  if (items.length === 0 && !loading) return null;

  return (
    <View style={styles.container}>
      {/* Background Shape — full-width/height fill instead of fixed Figma bleed */}
      <View style={styles.backgroundShape} />

      {/* Header Image */}
      {headerImg ? (
        <View style={styles.headerImageContainer}>
          <Image source={headerImg} style={styles.headerImage} resizeMode="cover" />
        </View>
      ) : null}

      {/* Lifestyle Cards - Horizontal Scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
        {items.map((item, index) => (
          <View
            key={item.id}
            style={[
              styles.cardWrapper,
              { width: cardWidth },
              index === 0 && styles.firstCard,
              index === items.length - 1 && styles.lastCard,
            ]}
          >
            <LifestyleCard item={item} onPress={handleItemPress} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    paddingTop: 16, // No top padding since spacing is handled by GreensBanner
    paddingBottom: 20,
    overflow: 'hidden',
  },
  backgroundShape: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#9DE8F7',
  },
  headerImageContainer: {
    width: '100%',
    paddingHorizontal: 9,
    zIndex: 1,
  },
  headerImage: {
    width: '100%',
    aspectRatio: HEADER_IMAGE_ASPECT_RATIO,
  },
  scrollView: {
    width: '100%',
    marginTop: 12,
    zIndex: 1,
  },
  scrollContent: {
    paddingHorizontal: 8,
  },
  cardWrapper: {
    marginRight: 16,
  },
  firstCard: {
    marginLeft: 0,
  },
  lastCard: {
    marginRight: 8,
  },
});
