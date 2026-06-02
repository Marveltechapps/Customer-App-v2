import React from 'react';
import { Image, View, type StyleProp, type ImageStyle, type ViewStyle } from 'react-native';
import {
  Image as ExpoImage,
  type ImageContentPosition,
  type ImageLoadEventData,
} from 'expo-image';
import { logger } from '@/utils/logger';
import { shouldUseLocalPlaceholder } from '@/config/placeholder';
import {
  buildRetriableImageUrl,
  buildProductImageMasterSheetRow,
  classifyImageNetworkError,
  getRetryDelayMs,
  IMAGE_RETRY_MAX_ATTEMPTS,
  type ProductLikeImageInput,
} from '@/utils/productImage';

export type CmsImagePriority = 'low' | 'normal' | 'high';

type Props = {
  uri: string;
  /** Alternate catalog URLs to try when the primary fails (e.g. images[1], imageUrl without resize params). */
  uriCandidates?: string[];
  style?: StyleProp<ImageStyle> | StyleProp<ViewStyle>;
  contentFit: 'cover' | 'contain';
  contentPosition?: ImageContentPosition;
  recyclingKey?: string;
  priority?: CmsImagePriority;
  transition?: number;
  cachePolicy?: 'disk' | 'memory' | 'memory-disk' | 'none';
  onError?: () => void;
  onLoad?: (event: ImageLoadEventData) => void;
  enforceEarlyResizing?: boolean;
  imageMasterSheetContext?: ProductLikeImageInput;
};

export default function CmsRemoteImage({
  uri,
  uriCandidates,
  style,
  contentFit,
  contentPosition,
  recyclingKey,
  priority = 'normal',
  transition = 100,
  cachePolicy = 'disk',
  onError,
  onLoad: onLoadProp,
  enforceEarlyResizing = false,
  imageMasterSheetContext,
}: Props) {
  const candidateList = React.useMemo(() => {
    const raw = [uri, ...(uriCandidates ?? [])]
      .map((u) => (typeof u === 'string' ? u.trim() : ''))
      .filter((u) => u && !shouldUseLocalPlaceholder(u));
    const seen = new Set<string>();
    return raw.filter((u) => {
      if (seen.has(u)) return false;
      seen.add(u);
      return true;
    });
  }, [uri, uriCandidates]);

  const [candidateIndex, setCandidateIndex] = React.useState(0);
  const [fallbackToNative, setFallbackToNative] = React.useState(false);
  const [didLoad, setDidLoad] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);
  const [loadFailed, setLoadFailed] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = React.useRef(true);
  const loggedFailureUris = React.useRef<Set<string>>(new Set());

  const activeUri = candidateList[candidateIndex] ?? uri;

  const normalizedUri = React.useMemo(() => {
    const raw = typeof activeUri === 'string' ? activeUri.trim() : '';
    if (!raw || shouldUseLocalPlaceholder(raw)) return '';
    try {
      return /[\s<>"'`]/.test(raw) ? encodeURI(raw) : raw;
    } catch {
      return raw;
    }
  }, [activeUri]);

  const attemptedUri = React.useMemo(() => {
    const base = normalizedUri?.trim();
    if (!base) return '';
    try {
      return buildRetriableImageUrl(base, attempt);
    } catch {
      return base;
    }
  }, [normalizedUri, attempt]);

  const clearTimers = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const logLoadFailureOnce = React.useCallback(
    (reason: string, errorLike?: unknown) => {
      const logKey = normalizedUri;
      if (!logKey || loggedFailureUris.current.has(logKey)) return;
      loggedFailureUris.current.add(logKey);
      logger.warn('[IMAGE] Could not load catalog image', {
        uri: normalizedUri,
        reason,
        errorType: classifyImageNetworkError(errorLike),
        catalog: buildProductImageMasterSheetRow(imageMasterSheetContext, {
          resolvedUrl: normalizedUri,
          attemptedUri,
          issue: 'load_failed',
        }),
      });
    },
    [attemptedUri, imageMasterSheetContext, normalizedUri],
  );

  const markLoadFailed = React.useCallback(
    (reason: string, errorLike?: unknown) => {
      clearTimers();
      setFallbackToNative(false);
      setLoadFailed(true);
      logLoadFailureOnce(reason, errorLike);
      onError?.();
    },
    [clearTimers, logLoadFailureOnce, onError],
  );

  const tryNextCandidate = React.useCallback((): boolean => {
    if (candidateIndex + 1 < candidateList.length) {
      clearTimers();
      setCandidateIndex((i) => i + 1);
      setFallbackToNative(false);
      setAttempt(0);
      setDidLoad(false);
      setLoadFailed(false);
      return true;
    }
    return false;
  }, [candidateIndex, candidateList.length, clearTimers]);

  const handleLoadFailure = React.useCallback(
    (reason: string, errorLike?: unknown) => {
      if (tryNextCandidate()) return;
      const nextAttempt = attempt + 1;
      if (nextAttempt < IMAGE_RETRY_MAX_ATTEMPTS) {
        const delayMs = getRetryDelayMs(nextAttempt);
        retryTimerRef.current = setTimeout(() => {
          if (!mountedRef.current) return;
          setFallbackToNative(false);
          setAttempt(nextAttempt);
        }, delayMs);
        return;
      }
      markLoadFailed(reason, errorLike);
    },
    [attempt, markLoadFailed, tryNextCandidate],
  );

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimers();
    };
  }, [clearTimers]);

  React.useEffect(() => {
    setCandidateIndex(0);
    setFallbackToNative(false);
    setDidLoad(false);
    setAttempt(0);
    setLoadFailed(false);
    clearTimers();
  }, [candidateList, clearTimers]);

  React.useEffect(() => {
    if (didLoad || loadFailed || !attemptedUri) return;
    clearTimers();
    timeoutRef.current = setTimeout(() => {
      if (!fallbackToNative) {
        setFallbackToNative(true);
        return;
      }
      handleLoadFailure('timeout');
    }, 10000);
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [attemptedUri, clearTimers, didLoad, fallbackToNative, handleLoadFailure, loadFailed]);

  if (!attemptedUri || loadFailed) {
    return <View style={style as StyleProp<ImageStyle>} />;
  }

  if (fallbackToNative) {
    return (
      <Image
        source={{ uri: attemptedUri }}
        style={style as StyleProp<ImageStyle>}
        resizeMode={contentFit === 'cover' ? 'cover' : 'contain'}
        onLoad={(e) => {
          setDidLoad(true);
          clearTimers();
          const src = e.nativeEvent.source;
          const w = src?.width;
          const h = src?.height;
          if (typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0) {
            onLoadProp?.({
              cacheType: 'none',
              source: { url: attemptedUri, width: w, height: h, mediaType: null },
            });
          }
        }}
        onError={(evt) => {
          const nativeError = (evt as { nativeEvent?: { error?: string } })?.nativeEvent?.error;
          handleLoadFailure('native_fallback_failed', nativeError);
        }}
      />
    );
  }

  return (
    <ExpoImage
      source={{ uri: attemptedUri }}
      style={style as StyleProp<ImageStyle>}
      contentFit={contentFit}
      {...(contentPosition != null ? { contentPosition } : {})}
      cachePolicy={cachePolicy}
      transition={transition}
      priority={priority}
      recyclingKey={recyclingKey ?? normalizedUri}
      onLoad={(e) => {
        setDidLoad(true);
        clearTimers();
        onLoadProp?.(e);
      }}
      onError={(errorEvt) => {
        const possibleMessage =
          (errorEvt as { error?: string })?.error ??
          (errorEvt as { nativeEvent?: { error?: string } })?.nativeEvent?.error;
        if (!fallbackToNative) {
          setFallbackToNative(true);
          return;
        }
        handleLoadFailure('expo_image_failed', possibleMessage);
      }}
      {...(enforceEarlyResizing ? { enforceEarlyResizing: true } : {})}
    />
  );
}
