import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Theme } from '../../constants/Theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  shadow?: boolean;
}

export default function Card({ children, style, shadow = true }: CardProps) {
  return (
    <View style={[styles.card, shadow && styles.shadow, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Theme.colors.background,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});

