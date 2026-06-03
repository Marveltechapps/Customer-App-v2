import React, { useRef, useState, useMemo, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import Constants from 'expo-constants';
import LocationSelector from '../features/location/LocationSelector';
import SearchBar from '../features/search/SearchBar';
import ProfileIconHome from '../icons/ProfileIconHome';
import MuteIcon from '../icons/MuteIcon';
import UnmuteIcon from '../icons/UnmuteIcon';
import { useDimensions, scale, getSpacing, wp } from '../../utils/responsive';
import { logger } from '@/utils/logger';

interface TopSectionProps {
  deliveryType?: string;
  address?: string;
  searchPlaceholder?: string;
  heroVideoUrl?: string | null;
  onLocationPress?: () => void;
  onProfilePress?: () => void;
  /** Fires on touch-down so Settings chunk can load before navigate completes. */
  onProfilePressIn?: () => void;
  onSearch?: (text: string) => void;
  onLayout?: (layout: { y: number; height: number }) => void;
  isVisible?: boolean;
  isScreenFocused?: boolean; // New prop to track screen focus
}

// Video source - using the video file from assets/videos
const homepageVideo = require('../../assets/videos/homepage_video.mp4');

  // Check if running in Expo Go
  const isExpoGo = Constants.appOwnership === 'expo';

  /** Inner video component - uses expo-video */
  function HeroVideo({
    videoSource,
    containerHeight,
    fadeGradientHeight,
    isVisible,
    isScreenFocused,
    isMuted,
    onToggleAudio,
  }: {
    videoSource: { uri: string } | number;
    containerHeight: number;
    fadeGradientHeight: number;
    isVisible: boolean;
    isScreenFocused: boolean;
    isMuted: boolean;
    onToggleAudio: () => void;
  }) {
    const source = typeof videoSource === 'object' ? videoSource.uri : videoSource;
    const player = useVideoPlayer(source, (p) => {
      p.loop = true;
      p.muted = true; // Default to muted for reliable autoplay
      p.play();
    });

    useEffect(() => {
      player.muted = isMuted;
    }, [isMuted, player]);

    useEffect(() => {
      if (isVisible && isScreenFocused) {
        player.play();
      } else {
        player.pause();
        // Auto-mute when paused or off-screen
        player.muted = true;
      }
    }, [isVisible, isScreenFocused, player]);

    // Update player source only if it actually changed to avoid flickering/restarts
    const lastSourceRef = useRef(source);
    useEffect(() => {
      if (source !== lastSourceRef.current) {
        void player.replaceAsync(source).then(() => {
          player.play();
        });
        lastSourceRef.current = source;
      }
    }, [source, player]);

    return (
      <>
        <VideoView
          player={player}
          style={[styles.backgroundVideo, { height: containerHeight }]}
          contentFit="cover"
          nativeControls={false}
          fullscreenOptions={{ enable: false }}
          startsPictureInPictureAutomatically={false}
        />
        <LinearGradient
          colors={['#FFFFFF', 'rgba(255, 255, 255, 0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[styles.videoFadeGradient, { height: fadeGradientHeight }]}
        />
        <TouchableOpacity
          style={styles.audioToggleButton}
          onPress={onToggleAudio}
          activeOpacity={0.7}
        >
          {isMuted ? (
            <MuteIcon width={24} height={24} color="#FFFFFF" />
          ) : (
            <UnmuteIcon width={24} height={24} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </>
    );
  }

  export default function TopSection({
    deliveryType = 'Delivery to Home',
    address = '',
    searchPlaceholder = 'Search for products',
    heroVideoUrl,
    onLocationPress,
    onProfilePress,
    onProfilePressIn,
    onSearch,
    onLayout,
    isVisible = true,
    isScreenFocused = true,
  }: TopSectionProps) {
    const { width: screenWidth } = useDimensions();
    const videoContainerRef = useRef<View>(null);
    const [isMuted, setIsMuted] = useState(true); // Audio state: default muted

    // Use backend hero video URL when present, otherwise local asset
    const hasRemoteVideo = Boolean(heroVideoUrl && typeof heroVideoUrl === 'string' && heroVideoUrl.trim());
    const videoSource = useMemo(() => {
      return hasRemoteVideo ? { uri: heroVideoUrl!.trim() } : homepageVideo;
    }, [hasRemoteVideo, heroVideoUrl]);

    // Enable video player for both Expo Go and Dev Client
    const shouldShowVideo = true;

  // Video container height - explicit height for proper layout
  const VIDEO_CONTAINER_HEIGHT = 400; // Increased by another 20% (300 * 1.20 = 360)
  
  // Responsive video dimensions - maintain aspect ratio from design (340/381)
  const videoDimensions = useMemo(() => {
    const baseVideoHeight = (340 / 381) * screenWidth; // Maintain aspect ratio
    const videoHeight = baseVideoHeight * 1.15; // Increased by 15% (previously 35%)
    const fadeGradientHeight = videoHeight * 0.05; // 5% fade at top of video
    
    return {
      videoHeight,
      fadeGradientHeight,
      containerHeight: VIDEO_CONTAINER_HEIGHT,
    };
  }, [screenWidth]);

  const handleVideoLayout = (event: any) => {
    const { y, height } = event.nativeEvent.layout;
    if (onLayout) {
      onLayout({ y, height });
    }
  };

  // Auto-mute when video goes off-screen
  useEffect(() => {
    if (!isVisible) setIsMuted(true);
  }, [isVisible]);

  // Toggle audio mute/unmute
  const handleToggleAudio = () => {
    setIsMuted((prev) => !prev);
    logger.info('Audio toggled', { muted: !isMuted });
  };

  return (
    <View style={styles.container}>
      {/* Video Container - Relative position with explicit height */}
      <View 
        ref={videoContainerRef}
        style={[
          styles.videoContainer, 
          { 
            height: videoDimensions.containerHeight,
          }
        ]}
        onLayout={handleVideoLayout}
      >
        {/* Green Background Layer - Bottom (zIndex: 0) */}
        <View 
          style={[
            styles.greenBackground, 
            { height: videoDimensions.containerHeight }
          ]} 
        />

        {/* Video - Absolute position to overlay text */}
        {shouldShowVideo ? (
          <HeroVideo
            videoSource={videoSource}
            containerHeight={videoDimensions.containerHeight}
            fadeGradientHeight={videoDimensions.fadeGradientHeight}
            isVisible={isVisible}
            isScreenFocused={isScreenFocused ?? true}
            isMuted={isMuted}
            onToggleAudio={handleToggleAudio}
          />
        ) : (
          // Expo Go: no expo-video — show explicit unavailable state
          <>
            <View
              style={[
                styles.backgroundVideo,
                {
                  height: videoDimensions.containerHeight,
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: '#FFFFFF',
                },
              ]}
            >
              <Text style={styles.videoUnavailableText}>Video not available</Text>
            </View>
            {/* White gradient at top of fallback (top to 5%) */}
            <LinearGradient
              colors={['#FFFFFF', 'rgba(255, 255, 255, 0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={[
                styles.videoFadeGradient, 
                { height: videoDimensions.fadeGradientHeight }
              ]}
            />
          </>
        )}
      </View>

      {/* Top Content Section - Input, Location & Profile - Top Layer (zIndex: 10) */}
      <View style={styles.topContent}>
        {/* Location and Profile Row */}
        <View style={styles.locationProfileRow}>
          <View style={styles.locationContainer}>
            <LocationSelector
              deliveryType={deliveryType}
              address={address}
              onPress={onLocationPress}
            />
          </View>
          <TouchableOpacity
            style={styles.profileButton}
            onPressIn={onProfilePressIn}
            onPress={onProfilePress}
            activeOpacity={0.7}
          >
            <ProfileIconHome />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBarContainer}>
          <SearchBar placeholder={searchPlaceholder} onSearch={onSearch} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
  },
  videoContainer: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#034703', // Match green background for smoother transitions
  },
  greenBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    width: '100%',
    backgroundColor: '#034703',
    zIndex: 0,
  },
  backgroundVideo: {
    width: '100%',
    position: 'absolute', // Video inside is absolute to overlay text
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  videoFadeGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    width: '100%',
    zIndex: 2,
  },
  topContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: getSpacing(14),
    paddingTop: getSpacing(17),
    paddingBottom: getSpacing(20),
    gap: getSpacing(12),
    zIndex: 10,
  },
  locationProfileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    gap: wp(28.85), // Responsive gap (108.18/375 * 100%)
  },
  locationContainer: {
    flex: 1,
  },
  profileButton: {
    width: scale(24),
    height: scale(24),
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  searchBarContainer: {
    width: '100%',
  },
  placeholderContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  placeholderText: {
    color: '#FFFFFF',
    fontSize: scale(14),
    fontFamily: 'Inter',
    fontWeight: '400',
  },
  videoUnavailableText: {
    color: '#6B7280',
    fontSize: scale(14),
    fontWeight: '500',
  },
  audioToggleButton: {
    position: 'absolute',
    bottom: getSpacing(16),
    right: getSpacing(16),
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 15,
  },
});
