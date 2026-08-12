import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Image,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import Text from './common/Text';
import {
  useDimensions,
  scale,
  getSpacing,
  resolveBannerSlideHeight,
  getBannerAspectRatio,
} from '../utils/responsive';

export type CategoryMediaFields = {
  bannerImage?: string | null;
  bannerVideo?: string | null;
  youtubeUrl?: string | null;
  title?: string;
};

type Props = {
  media: CategoryMediaFields | null | undefined;
  /** When true, compact layout for subcategory switch */
  compact?: boolean;
};

function isDirectVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url) || /\/video\//i.test(url);
}

function LoopingVideo({ uri, style }: { uri: string; style: object }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={style}
      contentFit="cover"
      nativeControls={false}
      fullscreenOptions={{ enable: false }}
    />
  );
}

/**
 * Dynamic Category / SubCategory media from Master Sheet:
 * hero (video preferred over image) + optional YouTube / reference CTA.
 */
export default function CategoryMediaBlock({ media, compact }: Props) {
  const { width: screenWidth } = useDimensions();
  const bannerImage = String(media?.bannerImage || '').trim();
  const bannerVideo = String(media?.bannerVideo || '').trim();
  const youtubeUrl = String(media?.youtubeUrl || '').trim();
  const title = media?.title || 'Category';

  const hasHero = Boolean(bannerVideo || bannerImage);
  const hasYoutube = Boolean(youtubeUrl);
  const showVideoTile = Boolean(bannerVideo) && Boolean(bannerImage);
  // When only video (no image), hero plays video; no duplicate tile.
  // When image + video: hero = image, tile = video (matches mockups).

  const dims = useMemo(() => {
    const sidebarWidth = scale(72, screenWidth);
    const productsPadding = getSpacing(8, screenWidth);
    const bannerContainerPadding = getSpacing(20, screenWidth);
    const availableWidth =
      screenWidth - sidebarWidth - productsPadding - bannerContainerPadding;
    const maxBannerWidth = scale(269, screenWidth);
    const bannerWidth = Math.min(maxBannerWidth, availableWidth);
    const bannerHeight = resolveBannerSlideHeight(bannerWidth, {
      variant: compact ? 'secondary' : 'promo',
      screenWidth,
    });
    const aspect =
      bannerWidth > 0 ? bannerWidth / bannerHeight : getBannerAspectRatio('promo');
    const tileGap = getSpacing(8, screenWidth);
    const tileWidth =
      showVideoTile && hasYoutube
        ? (bannerWidth - tileGap) / 2
        : bannerWidth;
    return { bannerWidth, bannerHeight, aspect, tileGap, tileWidth };
  }, [screenWidth, compact, showVideoTile, hasYoutube]);

  if (!hasHero && !hasYoutube) return null;

  const openYoutube = () => {
    if (!youtubeUrl) return;
    void Linking.openURL(youtubeUrl).catch(() => {});
  };

  const heroIsVideo = Boolean(bannerVideo) && !bannerImage;
  const heroVideoIsDirect = heroIsVideo && isDirectVideoUrl(bannerVideo);

  return (
    <View style={styles.wrap}>
      {hasHero ? (
        <View
          style={[
            styles.hero,
            { width: dims.bannerWidth, aspectRatio: dims.aspect },
          ]}
        >
          {heroIsVideo && heroVideoIsDirect ? (
            <LoopingVideo uri={bannerVideo} style={styles.fill} />
          ) : heroIsVideo && bannerVideo ? (
            <TouchableOpacity style={styles.fill} onPress={() => void Linking.openURL(bannerVideo)} activeOpacity={0.9}>
              <View style={[styles.fill, styles.videoFallback]}>
                <Text style={styles.watchBadge}>WATCH</Text>
                <Text style={styles.heroTitle} numberOfLines={2}>
                  {title}
                </Text>
              </View>
            </TouchableOpacity>
          ) : bannerImage ? (
            <Image source={{ uri: bannerImage }} style={styles.fill} resizeMode="cover" />
          ) : null}
        </View>
      ) : null}

      {(showVideoTile || hasYoutube) && (
        <View style={[styles.row, { width: dims.bannerWidth, gap: dims.tileGap }]}>
          {showVideoTile ? (
            <TouchableOpacity
              style={[styles.tile, { width: dims.tileWidth, aspectRatio: 1.2 }]}
              activeOpacity={0.9}
              onPress={() => {
                if (bannerVideo) void Linking.openURL(bannerVideo).catch(() => {});
              }}
            >
              {isDirectVideoUrl(bannerVideo) ? (
                <LoopingVideo uri={bannerVideo} style={styles.fill} />
              ) : (
                <View style={[styles.fill, styles.videoTileBg]}>
                  <Text style={styles.watchBadge}>WATCH</Text>
                  <Text style={styles.tileTitle}>Health Benefit Video</Text>
                </View>
              )}
            </TouchableOpacity>
          ) : null}

          {hasYoutube ? (
            <TouchableOpacity
              style={[
                styles.tile,
                styles.refTile,
                {
                  width: showVideoTile ? dims.tileWidth : dims.bannerWidth,
                  aspectRatio: showVideoTile ? 1.2 : 2.4,
                },
              ]}
              activeOpacity={0.9}
              onPress={openYoutube}
            >
              <Text style={styles.refBadge}>REFERENCE</Text>
              <Text style={styles.refTitle} numberOfLines={2}>
                Know More about {title}
              </Text>
              <Text style={styles.refUrl} numberOfLines={1}>
                {youtubeUrl}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    paddingHorizontal: 4,
    paddingVertical: 12,
    gap: 8,
  },
  hero: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#EDEDED',
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  videoFallback: {
    backgroundColor: '#1a3d1a',
    justifyContent: 'flex-end',
    padding: 12,
  },
  watchBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#000',
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
  },
  tile: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#E8E8E8',
  },
  videoTileBg: {
    backgroundColor: '#2a2a2a',
    justifyContent: 'flex-end',
    padding: 10,
  },
  tileTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  refTile: {
    backgroundColor: '#0b5d18',
    padding: 10,
    justifyContent: 'flex-end',
  },
  refBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 8,
  },
  refTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  refUrl: {
    color: '#e8ffe8',
    fontSize: 10,
    textDecorationLine: 'underline',
  },
});
