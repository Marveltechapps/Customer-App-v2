import React from 'react';
import CategorySection from '../components/sections/CategorySection';
import EmptySectionState from '../components/sections/EmptySectionState';
import type { BlockProps } from './types';
import { getProductImageSource } from '../utils/productImage';
import type { ImageSourcePropType } from 'react-native';

function normalizeCategories(raw: unknown[]): { id: string; name: string; image: ImageSourcePropType; link?: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((c: any) => ({
    id: String(c._id ?? c.id ?? ''),
    name: c.name ?? '',
    image: getProductImageSource({
      ...c,
      id: String(c._id ?? c.id ?? ''),
      name: c.name,
    }),
    link: c.link ?? undefined,
  }));
}

export default function CategoryGridBlock({
  config,
  data,
  homeBlockIndex,
  firstCategoryGridBlockIndex,
}: BlockProps) {
  const title = config?.title as string | undefined;
  const blockStyle = config?.style as { columns?: number } | undefined;
  const rawCategories = (data?.categories as unknown[]) || [];
  const categories = normalizeCategories(rawCategories);
  const highImagePriority =
    typeof homeBlockIndex === 'number' &&
    typeof firstCategoryGridBlockIndex === 'number' &&
    firstCategoryGridBlockIndex >= 0 &&
    homeBlockIndex === firstCategoryGridBlockIndex;
  if (categories.length === 0) {
    return <EmptySectionState title={title || 'Categories'} />;
  }
  return (
    <CategorySection title={title} categories={categories} blockStyle={blockStyle} highImagePriority={highImagePriority} />
  );
}
