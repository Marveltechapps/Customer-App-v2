import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useVideoPlayer, VideoView, type VideoSource } from 'expo-video';
import type { BlockProps } from './types';
import MuteIcon from '../components/icons/MuteIcon';
import UnmuteIcon from '../components/icons/UnmuteIcon';
import { useResponsive } from '../utils/responsive';
import { logger } from '@/utils/logger';

interface VideoBlockStyle {
  borderRadius?: number;
  height?: number;
  aspectRatio?: number;
}

/** Full-width, responsive video block for landing pages (CMS-driven `videoBlock`). */
export default function VideoBlock({ config }: BlockProps) {
  const { width: screenWidth, getVideoHeroHeight, scale } = useResponsive();

  const videoUrl = ((config?.videoUrl as string) || (config?.url as string) || '').trim();
  const blockStyle = (config?.style as VideoBlockStyle | undefined) ?? undefined;
  const autoplay = config?.autoplay !== false;
  const loop = config?.loop !== false;
  const startMuted = config?.muted !== false;
  const showMuteToggle = config?.showMuteToggle !== false;
  const borderRadius = blockStyle?.borderRadius ?? 0;

  const [isMuted, setIsMuted] = useState(startMuted);
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);

  const containerHeight = useMemo(() => {
    if (blockStyle?.height) return blockStyle.height;
    if (blockStyle?.aspectRatio) return screenWidth / blockStyle.aspectRatio;
    return getVideoHeroHeight();
  }, [blockStyle?.height, blockStyle?.aspectRatio, screenWidth, getVideoHeroHeight]);

  const videoSource: VideoSource = useMemo(
    () => (videoUrl ? { uri: videoUrl } : null),
    [videoUrl],
  );

  const player = useVideoPlayer(videoSource, (p) => {
    p.loop = loop;
    p.muted = startMuted;
    if (autoplay) p.play();
  });

  const lastUrlRef = useRef(videoUrl);
  useEffect(() => {
    if (!player || !videoUrl || videoUrl === lastUrlRef.current) return;
    lastUrlRef.current = videoUrl;
    void player.replaceAsync(videoSource).then(() => {
      if (autoplay) player.play();
    });
  }, [videoUrl, videoSource, player, autoplay]);

  useEffect(() => {
    if (!player) return;
    player.muted = isMuted;
  }, [isMuted, player]);

  useEffect(() => {
    if (!player) return;
    const sub = player.addListener('statusChange', (status) => {
      if (status.status === 'readyToPlay') setIsReady(true);
      if (status.status === 'error') {
        setHasError(true);
        logger.warn('VideoBlock playback error', { videoUrl, error: status.error });
      }
    });
    return () => sub.remove();
  }, [player, videoUrl]);

  if (!videoUrl || hasError) return null;

  return (
    <View style={[styles.container, { height: containerHeight, borderRadius }]}>
      <VideoView
        player={player}
        style={[styles.video, { borderRadius }]}
        contentFit="cover"
        nativeControls={false}
        fullscreenOptions={{ enable: false }}
        startsPictureInPictureAutomatically={false}
      />

      {!isReady && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#FFFFFF" />
        </View>
      )}

      {showMuteToggle && (
        <TouchableOpacity
          style={[
            styles.muteButton,
            { width: scale(40), height: scale(40), borderRadius: scale(20) },
          ]}
          onPress={() => setIsMuted((prev) => !prev)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={isMuted ? 'Unmute video' : 'Mute video'}
        >
          {isMuted ? (
            <MuteIcon width={20} height={20} color="#FFFFFF" />
          ) : (
            <UnmuteIcon width={20} height={20} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  muteButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
});
