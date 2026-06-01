import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useDimensions, scale, getSpacing } from '../../utils/responsive';

interface VideoSectionProps {
  onPress?: () => void;
}

export default function VideoSection({ onPress }: VideoSectionProps) {
  const { width: screenWidth } = useDimensions();
  
  // Calculate responsive dimensions
  const videoDimensions = useMemo(() => {
    const containerPadding = getSpacing(16) * 2; // 16px on each side
    const videoWidth = screenWidth - containerPadding;
    // Maintain aspect ratio from design (276px height for ~349px width)
    const aspectRatio = 276 / 349; // Original design aspect ratio
    const videoHeight = videoWidth * aspectRatio;
    
    return {
      videoWidth,
      videoHeight: Math.max(scale(200), Math.min(videoHeight, scale(400))), // Min 200, max 400
      containerPadding: getSpacing(16),
    };
  }, [screenWidth]);

  return (
    <View style={styles.container}>
      <View style={styles.contentContainer}>
        {/* Placeholder: Show placeholder for video (video player disabled for Expo Go compatibility) */}
        <View
          style={[
            styles.video,
            {
              width: videoDimensions.videoWidth,
              height: videoDimensions.videoHeight,
              backgroundColor: '#EDEDED',
              justifyContent: 'center',
              alignItems: 'center',
            },
          ]}
        >
          {/* Placeholder for video in Expo Go */}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: getSpacing(16),
    paddingTop: getSpacing(20),
    paddingBottom: getSpacing(20),
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  video: {
    borderRadius: scale(8),
    backgroundColor: '#EDEDED',
  },
});
