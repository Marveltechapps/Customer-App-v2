import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Theme } from '../constants/Theme';
import ChevronRightIcon from './icons/ChevronRightIcon';

interface SettingsMenuItemProps {
  icon: React.ReactNode;
  title: string;
  onPress?: () => void;
}

export default function SettingsMenuItem({ icon, title, onPress }: SettingsMenuItemProps) {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <View style={styles.leftSection}>
          <View style={styles.iconContainer}>
            {icon}
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.text}>{title}</Text>
          </View>
        </View>
        <View style={styles.chevronContainer}>
          <ChevronIcon />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// Chevron right icon component
const ChevronIcon = () => (
  <View style={styles.chevron}>
    <ChevronRightIcon />
  </View>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: Theme.colors.cardBackground,
    borderRadius: Theme.borderRadius.md, // 8px
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 44,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  iconContainer: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  text: {
    ...Theme.typography.menuItem,
    color: Theme.colors.textSecondary,
  },
  chevronContainer: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  chevron: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

