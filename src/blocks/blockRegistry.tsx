import React from 'react';
import type { BlockProps } from './types';

import HeroBannerBlock from './HeroBannerBlock';
import BannerCarouselBlock from './BannerCarouselBlock';
import CategoryGridBlock from './CategoryGridBlock';
import ProductCarouselBlock from './ProductCarouselBlock';
import CollectionCarouselBlock from './CollectionCarouselBlock';
import PromoImageBlock from './PromoImageBlock';
import VideoBlock from './VideoBlock';
import LifestyleGridBlock from './LifestyleGridBlock';
import OrganicTaglineBlock from './OrganicTaglineBlock';

export const blockRegistry: Record<string, React.ComponentType<BlockProps>> = {
  heroBanner: HeroBannerBlock,
  bannerCarousel: BannerCarouselBlock,
  categoryGrid: CategoryGridBlock,
  productCarousel: ProductCarouselBlock,
  collectionCarousel: CollectionCarouselBlock,
  promoImage: PromoImageBlock,
  videoBlock: VideoBlock,
  lifestyleGrid: LifestyleGridBlock,
  organicTagline: OrganicTaglineBlock,
  textBanner: PromoImageBlock, // fallback to promo
};
