import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Image, ScrollView, ImageSourcePropType } from 'react-native';
import LifestyleCard, { LifestyleItem } from '../LifestyleCard';
import { logger } from '@/utils/logger';
import { handleRedirect } from '../../utils/navigation/linkHandler';
import { useNavigation } from '@react-navigation/native';
import type { RootStackNavigationProp } from '../../types/navigation';
import { bannerIsTapEnabled } from '@/utils/bannerInteraction';

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

  return (
    <View style={styles.container}>
      {/* Background Shape */}
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
              blockStyle?.cardWidth != null && { minWidth: blockStyle.cardWidth, width: blockStyle.cardWidth },
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
    height: 317,
    position: 'relative',
    paddingHorizontal: 0,
    paddingTop: 16, // No top padding since spacing is handled by GreensBanner
    paddingBottom: 20,
    overflow: 'hidden',
  },
  backgroundShape: {
    position: 'absolute',
    left: -29,
    top: 0,
    width: 440,
    height: 317,
    backgroundColor: '#9DE8F7',
  },
  headerImageContainer: {
    position: 'absolute',
    left: 9.25,
    top: 5,
    width: 363.5,
    height: 128,
    zIndex: 1,
  },
  headerImage: {
    width: '100%',
    height: '100%',
  },
  scrollView: {
    position: 'absolute',
    left: 8,
    top: 147.7,
    right: 0,
    height: 145,
    zIndex: 1,
  },
  scrollContent: {
    paddingRight: 16,
    paddingLeft: 0,
  },
  cardWrapper: {
    marginRight: 16,
  },
  firstCard: {
    marginLeft: 0,
  },
  lastCard: {
    marginRight: 16,
  },
});

