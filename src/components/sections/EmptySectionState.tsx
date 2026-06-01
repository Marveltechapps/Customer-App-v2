import React from 'react';
import { StyleSheet, View } from 'react-native';
import Text from '../common/Text';

interface EmptySectionStateProps {
  title?: string;
  message?: string;
}

export default function EmptySectionState({
  title,
  message = 'Content will be available soon.',
}: EmptySectionStateProps) {
  return (
    <View style={styles.container}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <View style={styles.card}>
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222222',
  },
  card: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#F7F7F7',
    borderRadius: 10,
    minHeight: 72,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    color: '#5F5F5F',
    textAlign: 'center',
  },
});
