import React from 'react';
import { Image, type StyleProp, type ImageStyle, type ViewStyle } from 'react-native';
import {
  Image as ExpoImage,
  type ImageContentPosition,
  type ImageLoadEventData,
} from 'expo-image';
import { logger } from '@/utils/logger';
import {
  isDevelopment,
  isIosSimulator,
  isSslPinningEnabledForImages,
  shouldUseSimulatorImagePlaceholder,
} from '@/config/env';
import {
  getPlaceholderUrl,
  LOCAL_PLACEHOLDER_IMAGE,
  shouldUseLocalPlaceholder,
} from '@/config/placeholder';
import {
  buildRetriableImageUrl,
  buildProductImageMasterSheetRow,
  classifyImageNetworkError,
  getRetryDelayMs,
  IMAGE_RETRY_MAX_ATTEMPTS,
  type ProductImageMasterSheetRow,
  type ProductLikeImageInput,
} from '@/utils/productImage';

export type CmsImagePriority = 'low' | 'normal' | 'high';

type Props = {
  uri: string;
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
  /** Catalog fields for master-sheet diagnostics when load fails. */
  imageMasterSheetContext?: ProductLikeImageInput;
};

export default function CmsRemoteImage({
  uri,
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
  const useSimulatorPlaceholderMode = shouldUseSimulatorImagePlaceholder();
  const [fallbackToNative, setFallbackToNative] = React.useState(false);
  const [didLoad, setDidLoad] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);
  const [usePlaceholderFallback, setUsePlaceholderFallback] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = React.useRef(true);

  const normalizedUri = React.useMemo(() => {
    const raw = typeof uri === 'string' ? uri.trim() : '';
    if (!raw) return getPlaceholderUrl();
    if (shouldUseLocalPlaceholder(raw)) return getPlaceholderUrl();
    try {
      return /[\s<>"'`]/.test(raw) ? encodeURI(raw) : raw;
    } catch {
      return raw;
    }
  }, [uri]);

  const preferLocalPlaceholder = React.useMemo(
    () => shouldUseLocalPlaceholder(normalizedUri),
    [normalizedUri],
  );

  const attemptedUri = React.useMemo(() => {
    const base = normalizedUri?.trim() || getPlaceholderUrl();
    try {
      return buildRetriableImageUrl(base, attempt);
    } catch {
      return getPlaceholderUrl();
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

  const markFinalFallback = React.useCallback((reason: string, errorLike?: unknown) => {
    const masterSheet: ProductImageMasterSheetRow = buildProductImageMasterSheetRow(
      imageMasterSheetContext,
      {
        resolvedUrl: normalizedUri,
        attemptedUri: attemptedUri,
        issue: 'load_failed',
      },
    );
    logger.error('[FALLBACK] Maximum retry attempts reached, image load failed', {
      timestamp: new Date().toISOString(),
      uri: normalizedUri,
      attempt: attempt + 1,
      reason,
      errorType: classifyImageNetworkError(errorLike),
      error: errorLike,
      simulator: isIosSimulator(),
      development: isDevelopment(),
      note: 'Showing bundled placeholder asset',
    });
    logger.error('[IMAGE_MASTER_SHEET] Remote image failed — update catalog image URL', masterSheet);
    setUsePlaceholderFallback(true);
    onError?.();
  }, [attempt, attemptedUri, imageMasterSheetContext, normalizedUri, onError]);

  const scheduleRetry = React.useCallback((failureReason: string, errorLike?: unknown) => {
    const nextAttempt = attempt + 1;
    if (nextAttempt >= IMAGE_RETRY_MAX_ATTEMPTS) {
      markFinalFallback(failureReason, errorLike);
      return;
    }
    const delayMs = getRetryDelayMs(nextAttempt);
    logger.warn('[RETRY] Scheduling image retry', {
      timestamp: new Date().toISOString(),
      uri: normalizedUri,
      currentAttempt: attempt + 1,
      nextAttempt: nextAttempt + 1,
      delayMs,
      reason: failureReason,
      errorType: classifyImageNetworkError(errorLike),
    });
    retryTimerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      setFallbackToNative(false);
      setAttempt(nextAttempt);
    }, delayMs);
  }, [attempt, markFinalFallback, normalizedUri]);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimers();
    };
  }, [clearTimers]);

  React.useEffect(() => {
    logger.info('[NETWORK] Image mode status', {
      timestamp: new Date().toISOString(),
      uri: normalizedUri,
      simulator: isIosSimulator(),
      development: isDevelopment(),
      simulatorPlaceholderMode: useSimulatorPlaceholderMode,
      sslPinningEnabled: isSslPinningEnabledForImages(),
      sslPinningNote: isDevelopment() ? 'SSL pinning disabled for development (not configured)' : 'Production mode',
    });
  }, [normalizedUri, useSimulatorPlaceholderMode]);

  React.useEffect(() => {
    setFallbackToNative(false);
    setDidLoad(false);
    setAttempt(0);
    setUsePlaceholderFallback(useSimulatorPlaceholderMode || preferLocalPlaceholder);
    clearTimers();
  }, [normalizedUri, preferLocalPlaceholder, useSimulatorPlaceholderMode, clearTimers]);

  React.useEffect(() => {
    if (useSimulatorPlaceholderMode || preferLocalPlaceholder) return;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 6000);
    (async () => {
      try {
        logger.info('[NETWORK] Image preflight HEAD request', {
          timestamp: new Date().toISOString(),
          uri: attemptedUri,
          attempt: attempt + 1,
        });
        const res = await fetch(attemptedUri, { method: 'HEAD', signal: controller.signal });
        logger.info('[NETWORK] Image preflight success', {
          timestamp: new Date().toISOString(),
          uri: attemptedUri,
          status: res.status,
          attempt: attempt + 1,
        });
      } catch (error) {
        logger.error('[ERROR] Image preflight failed', {
          timestamp: new Date().toISOString(),
          uri: attemptedUri,
          attempt: attempt + 1,
          errorType: classifyImageNetworkError(error),
          error,
        });
      } finally {
        clearTimeout(t);
      }
    })();
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [attempt, attemptedUri, preferLocalPlaceholder, useSimulatorPlaceholderMode]);

  React.useEffect(() => {
    if (usePlaceholderFallback || preferLocalPlaceholder) return;
    logger.info('[NETWORK] Image load attempt', {
      timestamp: new Date().toISOString(),
      uri: attemptedUri,
      attempt: attempt + 1,
      loader: fallbackToNative ? 'native' : 'expo-image',
    });
  }, [attempt, attemptedUri, fallbackToNative, usePlaceholderFallback]);

  React.useEffect(() => {
    if (didLoad || usePlaceholderFallback) return;
    clearTimers();
    timeoutRef.current = setTimeout(() => {
      logger.error('[ERROR] Image load timeout', {
        timestamp: new Date().toISOString(),
        uri: attemptedUri,
        attempt: attempt + 1,
        timeoutMs: 10000,
        loader: fallbackToNative ? 'native' : 'expo-image',
      });
      if (!fallbackToNative) {
        logger.warn('[FALLBACK] Switching from expo-image to native fallback', {
          timestamp: new Date().toISOString(),
          uri: attemptedUri,
          attempt: attempt + 1,
        });
        setFallbackToNative(true);
        return;
      }
      scheduleRetry('timeout');
    }, 10000);
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [attempt, attemptedUri, clearTimers, didLoad, fallbackToNative, preferLocalPlaceholder, scheduleRetry, usePlaceholderFallback]);

  if (usePlaceholderFallback || preferLocalPlaceholder) {
    return (
      <Image
        source={LOCAL_PLACEHOLDER_IMAGE}
        style={style as StyleProp<ImageStyle>}
        resizeMode={contentFit === 'cover' ? 'cover' : 'contain'}
        onLoad={() => {
          setDidLoad(true);
          onLoadProp?.({
            cacheType: 'none',
            source: { url: normalizedUri, width: 0, height: 0, mediaType: null },
          });
        }}
      />
    );
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
          logger.info('[NETWORK] Native fallback image load success', {
            timestamp: new Date().toISOString(),
            uri: attemptedUri,
            attempt: attempt + 1,
          });
          const src = e.nativeEvent.source;
          const w = src?.width;
          const h = src?.height;
          if (typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0) {
            onLoadProp?.({
              cacheType: 'none',
              source: {
                url: attemptedUri,
                width: w,
                height: h,
                mediaType: null,
              },
            });
          }
        }}
        onError={(evt) => {
          const nativeError = (evt as { nativeEvent?: { error?: string } })?.nativeEvent?.error;
          logger.error('[ERROR] Native fallback image load failed', {
            timestamp: new Date().toISOString(),
            uri: attemptedUri,
            attempt: attempt + 1,
            errorType: classifyImageNetworkError(nativeError),
            error: nativeError,
          });
          scheduleRetry('native_fallback_failed', nativeError);
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
        logger.info('[NETWORK] expo-image load success', {
          timestamp: new Date().toISOString(),
          uri: attemptedUri,
          attempt: attempt + 1,
        });
        onLoadProp?.(e);
      }}
      onError={(errorEvt) => {
        const possibleMessage =
          (errorEvt as { error?: string })?.error ??
          (errorEvt as { nativeEvent?: { error?: string } })?.nativeEvent?.error;
        logger.error('[ERROR] expo-image load failed', {
          timestamp: new Date().toISOString(),
          uri: attemptedUri,
          attempt: attempt + 1,
          errorType: classifyImageNetworkError(possibleMessage),
          error: possibleMessage,
        });
        logger.warn('[FALLBACK] Switching to native fallback', {
          timestamp: new Date().toISOString(),
          uri: attemptedUri,
          attempt: attempt + 1,
        });
        setFallbackToNative(true);
      }}
      {...(enforceEarlyResizing ? { enforceEarlyResizing: true } : {})}
    />
  );
}
