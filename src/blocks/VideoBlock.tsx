import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { BlockProps } from './types';

// VideoBlock - placeholder; TopSection has hero video. For standalone video blocks in landing pages,
// we'd integrate react-native-video. For now render nothing or a simple placeholder.
export default function VideoBlock({ config }: BlockProps) {
  const videoUrl = (config?.videoUrl as string) || (config?.url as string);
  if (!videoUrl) return null;
  // TODO: Integrate video player for landing pages
  return <View style={styles.placeholder} />;
}

const styles = StyleSheet.create({
  placeholder: {
    height: 200,
    backgroundColor: '#E0E0E0',
  },
});
