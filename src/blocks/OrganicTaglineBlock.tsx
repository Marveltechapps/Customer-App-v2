import React from 'react';
import EmptySectionState from '../components/sections/EmptySectionState';
import OrganicTaglineSection from '../components/sections/OrganicTaglineSection';
import type { BlockProps } from './types';

export default function OrganicTaglineBlock({ config }: BlockProps) {
  const title = (config?.title as string) || undefined;
  const tagline = (config?.tagline as string) || undefined;
  const iconUrl = (config?.iconUrl as string) || undefined;
  if (!tagline) {
    return <EmptySectionState title={title || 'Organic Promise'} />;
  }
  return (
    <OrganicTaglineSection
      tagline={tagline}
      icon={iconUrl ? { uri: iconUrl } : undefined}
    />
  );
}
