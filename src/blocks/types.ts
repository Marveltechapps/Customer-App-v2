export interface BlockProps {
  id: string;
  type: string;
  config: Record<string, unknown>;
  data: Record<string, unknown>;
  /** Home list index of the first hero/banner block (for image fetch priority). */
  firstBannerBlockIndex?: number;
  /** Home list index of the first category grid block. */
  firstCategoryGridBlockIndex?: number;
  /** Home list index of the first product/collection carousel block. */
  firstCarouselBlockIndex?: number;
  /** This block's index in the home blocks array. */
  homeBlockIndex?: number;
}
