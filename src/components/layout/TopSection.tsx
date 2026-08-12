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
import { useResponsive, scale, wp } from '../../utils/responsive';
import { logger } from '@/utils/logger';
import {
  formatUnreadBadge,
  useUnreadNotificationCount,
} from '../../hooks/useUnreadNotificationCount';

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

// Video source - local asset used when CMS does not provide a remote hero URL
const homepageVideo = require('../../assets/videos/homepage_video.mp4');
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
        style={[
          styles.audioToggleButton,
          {
            bottom: scale(16),
            right: scale(16),
            width: scale(40),
            height: scale(40),
            borderRadius: scale(20),
          },
        ]}
        onPress={onToggleAudio}
        activeOpacity={0.7}
      >
        {isMuted ? (
          <MuteIcon width={scale(24)} height={scale(24)} color="#FFFFFF" />
        ) : (
          <UnmuteIcon width={scale(24)} height={scale(24)} color="#FFFFFF" />
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
  const { width: screenWidth, getVideoHeroHeight, spacing } = useResponsive();
  const videoContainerRef = useRef<View>(null);
  const [isMuted, setIsMuted] = useState(true); // Audio state: default muted
  const { count: unreadCount } = useUnreadNotificationCount();
  const profileBadge = formatUnreadBadge(unreadCount);

  // Use backend hero video URL when present, otherwise local asset (skip local in Expo Go to avoid huge download)
  const hasRemoteVideo = Boolean(heroVideoUrl && typeof heroVideoUrl === 'string' && heroVideoUrl.trim());
  const videoSource = useMemo(() => {
    if (hasRemoteVideo) return { uri: heroVideoUrl!.trim() };
    if (isExpoGo) return null;
    return homepageVideo;
  }, [hasRemoteVideo, heroVideoUrl]);

  const shouldShowVideo = videoSource != null;

  // Full-width video height from aspect ratio — updates on rotation / tablet
  const videoDimensions = useMemo(() => {
    const containerHeight = getVideoHeroHeight();
    const fadeGradientHeight = Math.max(spacing(12), containerHeight * 0.05);
    return {
      videoHeight: containerHeight,
      fadeGradientHeight,
      containerHeight,
    };
  }, [screenWidth, getVideoHeroHeight, spacing]);

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
          },
        ]}
        onLayout={handleVideoLayout}
      >
        {/* Green Background Layer - Bottom (zIndex: 0) */}
        <View
          style={[
            styles.greenBackground,
            { height: videoDimensions.containerHeight },
          ]}
        />

        {/* Video - Absolute position to overlay text */}
        {shouldShowVideo && videoSource != null ? (
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
          // Expo Go / no video: keep brand green (never flash white)
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[
              styles.videoFadeGradient,
              { height: videoDimensions.fadeGradientHeight },
            ]}
          />
        )}
      </View>

      {/* Top Content Section - Input, Location & Profile - Top Layer (zIndex: 10) */}
      <View
        style={[
          styles.topContent,
          {
            paddingHorizontal: spacing(14),
            paddingTop: spacing(17),
            paddingBottom: spacing(20),
            gap: spacing(12),
          },
        ]}
      >
        {/* Location and Profile Row */}
        <View style={[styles.locationProfileRow, { gap: Math.min(wp(28.85), spacing(48)) }]}>
          <View style={styles.locationContainer}>
            <LocationSelector
              deliveryType={deliveryType}
              address={address}
              onPress={onLocationPress}
            />
          </View>
          <TouchableOpacity
            style={[styles.profileButton, { width: scale(24), height: scale(24) }]}
            onPressIn={onProfilePressIn}
            onPress={onProfilePress}
            activeOpacity={0.7}
            accessibilityLabel={
              profileBadge
                ? `Settings, ${unreadCount} unread notifications`
                : 'Settings'
            }
          >
            <ProfileIconHome />
            {profileBadge ? (
              <View style={styles.profileBadge}>
                <Text style={styles.profileBadgeText}>{profileBadge}</Text>
              </View>
            ) : null}
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
    backgroundColor: '#034703',
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
    position: 'absolute',
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
    zIndex: 10,
  },
  locationProfileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  locationContainer: {
    flex: 1,
    minWidth: 0,
  },
  profileButton: {
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    position: 'relative',
  },
  profileBadge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ED0004',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  profileBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
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
    fontSize: 14,
    fontFamily: 'Inter',
    fontWeight: '400',
  },
  audioToggleButton: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 15,
  },
});
