import React from 'react';
import Constants from 'expo-constants';
import { VideoView, useVideoPlayer } from 'expo-video';
import BannerRemoteImage from './BannerRemoteImage';

type Props = {
  imageUrl?: string;
  uri?: string;
  videoUrl?: string;
  title: string;
  id: string | number;
  style: any;
  contentFit: 'cover' | 'contain' | 'fill' | 'none';
  priority?: 'high' | 'normal' | 'low';
  recyclingKey?: string;
};

const isExpoGo = Constants.appOwnership === 'expo';

function LoopingMutedVideo({
  videoUrl,
  style,
  contentFit,
}: {
  videoUrl: string;
  style: any;
  contentFit: 'cover' | 'contain' | 'fill' | 'none';
}) {
  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <VideoView
      player={player}
      style={style}
      contentFit={contentFit}
      nativeControls={false}
      fullscreenOptions={{ enable: false }}
    />
  );
}

export default function BannerMedia({
  imageUrl,
  uri,
  videoUrl,
  title,
  id,
  style,
  contentFit,
  priority = 'normal',
  recyclingKey,
}: Props) {
  const resolvedVideo = typeof videoUrl === 'string' ? videoUrl.trim() : '';
  // Enable video player for both Expo Go and Dev Client
  const shouldRenderVideo = Boolean(resolvedVideo);
  if (shouldRenderVideo) {
    return <LoopingMutedVideo videoUrl={resolvedVideo} style={style} contentFit={contentFit} />;
  }

  return (
    <BannerRemoteImage
      imageUrl={imageUrl}
      uri={uri}
      title={title}
      id={id}
      style={style}
      contentFit={contentFit}
      priority={priority}
      recyclingKey={recyclingKey}
    />
  );
}
