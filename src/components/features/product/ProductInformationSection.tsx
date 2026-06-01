import React, { useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform, LayoutAnimation, UIManager, type ViewStyle } from 'react-native';
import Text from '../../common/Text';
import ChevronDownIcon from '../../icons/ChevronDownIcon';
import type { ProductInformationBlock } from '@/utils/productDescription';
import { Theme } from '@/constants/Theme';

const SECTION_GAP = Theme.spacing.sectionCardGap;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  blocks: ProductInformationBlock[];
  defaultExpanded?: boolean;
  /** Merged with outer card (e.g. margin overrides). */
  style?: ViewStyle;
};

export default function ProductInformationSection({ blocks, defaultExpanded = false, style }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const toggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((e) => !e);
  }, []);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <View style={[styles.card, style]}>
      <TouchableOpacity style={styles.header} onPress={toggle} activeOpacity={0.7} accessibilityRole="button">
        <Text style={styles.title}>Product Information</Text>
        <View style={[styles.chevronWrap, expanded && styles.chevronExpanded]}>
          <ChevronDownIcon width={20} height={20} color="#4C4C4C" />
        </View>
      </TouchableOpacity>
      {expanded ? (
        <View style={styles.body}>
          {blocks.map((b) => (
            <View key={b.key} style={styles.bulletRow}>
              <Text style={styles.bulletLine}>
                <Text style={styles.bullet}>• </Text>
                <Text style={styles.label}>{b.label}</Text>
                <Text style={styles.bodyText}> - {b.text}</Text>
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 0.6,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: SECTION_GAP,
    marginTop: SECTION_GAP,
    marginBottom: 0,
    gap: 12,
    alignSelf: 'stretch',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    alignSelf: 'stretch',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
    color: '#333333',
    fontFamily: 'Inter',
    flex: 1,
  },
  chevronWrap: {
    transform: [{ rotate: '0deg' }],
  },
  chevronExpanded: {
    transform: [{ rotate: '180deg' }],
  },
  body: {
    gap: 12,
    alignSelf: 'stretch',
  },
  bulletRow: {
    alignSelf: 'stretch',
  },
  bulletLine: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 24,
    color: '#666666',
    fontFamily: 'Inter',
    textAlign: 'left',
  },
  bullet: {
    fontSize: 14,
    color: '#333333',
    fontFamily: 'Inter',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333333',
    fontFamily: 'Inter',
  },
  bodyText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666666',
    fontFamily: 'Inter',
  },
});
