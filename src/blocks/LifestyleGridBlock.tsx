import React, { useMemo } from 'react';
import LifestyleSection from '../components/sections/LifestyleSection';
import type { BlockProps } from './types';
import type { LifestyleItem } from '../components/LifestyleCard';
import { getProductImageSource } from '../utils/productImage';
const LIFESTYLE_DEFAULT_POSITION = { x: 0, y: 34, width: 152, height: 111 };
const LIFESTYLE_DEFAULT_TITLE_POSITION = { x: 15, y: 12, width: 122 };

function normalizeItems(raw: unknown[]): LifestyleItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: any, idx: number) => ({
    id: String(item._id ?? item.id ?? idx),
    title: item.name ?? '',
    image: getProductImageSource({ ...item, id: String(item._id ?? item.id ?? idx), name: item.name }),
    imagePosition: LIFESTYLE_DEFAULT_POSITION,
    titlePosition: LIFESTYLE_DEFAULT_TITLE_POSITION,
    link: item.link ?? undefined,
    redirectType: item.redirectType ?? undefined,
    redirectValue: item.redirectValue ?? undefined,
  }));
}

export default function LifestyleGridBlock({ config, data }: BlockProps) {
  const rawItems = (data?.items as unknown[]) || [];
  const blockStyle = config?.style as { cardWidth?: number } | undefined;
  const fetchItems = useMemo(
    () => async (): Promise<LifestyleItem[]> => normalizeItems(rawItems),
    [rawItems]
  );
  if (rawItems.length === 0) return null;
  return <LifestyleSection fetchItems={fetchItems} blockStyle={blockStyle} />;
}
