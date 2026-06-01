import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import BackIcon from './icons/BackIcon';

interface BackButtonProps {
  onPress: () => void;
}

export default function BackButton({ onPress }: BackButtonProps) {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <BackIcon />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

