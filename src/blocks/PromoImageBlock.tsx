import React from 'react';
import { View, type ImageSourcePropType } from 'react-native';
import GreensBanner from '../components/GreensBanner';
import SectionImage from '../components/SectionImage';
import type { BlockProps } from './types';
import { getProductImageSource } from '../utils/productImage';

export default function PromoImageBlock({ config, data }: BlockProps) {
  const promoBlocks = (data?.promoBlocks as Record<string, { imageUrl?: string; link?: string; redirectType?: string; redirectValue?: string }>) || {};
  const blockStyle = config?.style as { borderRadius?: number; height?: number } | undefined;
  const greens = promoBlocks.greens_banner;
  const sectionImg = promoBlocks.section_image;

  const promoHasVisual = (p: { imageUrl?: string; thumbnailUrl?: string; bannerImageUrl?: string; cardImageUrl?: string } | undefined) =>
    !!p && !!(p.imageUrl || p.thumbnailUrl || p.bannerImageUrl || p.cardImageUrl);

  const greensBase = promoHasVisual(greens)
    ? getProductImageSource({ ...(greens as object), id: 'greens_banner' } as Parameters<typeof getProductImageSource>[0])
    : null;
  const sectionBase = promoHasVisual(sectionImg)
    ? getProductImageSource({ ...(sectionImg as object), id: 'section_image' } as Parameters<typeof getProductImageSource>[0])
    : null;

  const withPromoMeta = (
    base: ImageSourcePropType,
    meta: { link?: string; redirectType?: string; redirectValue?: string },
  ): ImageSourcePropType =>
    typeof base === 'number'
      ? base
      : ({
          ...base,
          link: meta.link,
          redirectType: meta.redirectType,
          redirectValue: meta.redirectValue,
        } as ImageSourcePropType);

  return (
    <View>
      {greensBase ? (
        <GreensBanner
          image={withPromoMeta(greensBase, {
            link: greens!.link,
            redirectType: greens!.redirectType,
            redirectValue: greens!.redirectValue,
          })}
          blockStyle={blockStyle}
        />
      ) : null}
      {sectionBase ? (
        <SectionImage
          image={withPromoMeta(sectionBase, {
            link: sectionImg!.link,
            redirectType: sectionImg!.redirectType,
            redirectValue: sectionImg!.redirectValue,
          })}
          blockStyle={blockStyle}
        />
      ) : null}
    </View>
  );
}
