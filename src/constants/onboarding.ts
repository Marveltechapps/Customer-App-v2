/**
 * Final onboarding content — local assets only (no dummy/placeholder data).
 */
import type { ImageSourcePropType } from 'react-native';

export type LocalOnboardingPage = {
  pageNumber: number;
  title: string;
  description: string;
  image: ImageSourcePropType;
  ctaText?: string;
};

export const ONBOARDING_IMAGES: Record<1 | 2 | 3, ImageSourcePropType> = {
  1: require('../assets/images/onboarding/onboarding-screen-1.jpg'),
  2: require('../assets/images/onboarding/onboarding-screen-2.jpg'),
  3: require('../assets/images/onboarding/onboarding-screen-3.jpg'),
};

export const LOCAL_ONBOARDING_PAGES: LocalOnboardingPage[] = [
  {
    pageNumber: 1,
    title: 'Clean, Healthy Food for Your Family',
    description: 'You want clean, healthy food for your family. We deliver it.',
    image: ONBOARDING_IMAGES[1],
  },
  {
    pageNumber: 2,
    title: 'Toxin-Free Groceries',
    description: 'Most groceries contain hidden toxins. SELORG eliminates them.',
    image: ONBOARDING_IMAGES[2],
  },
  {
    pageNumber: 3,
    title: "India's First Lab-Tested Organic App",
    description:
      "India's first lab-tested organic grocery app. We're your health guardian.",
    image: ONBOARDING_IMAGES[3],
    ctaText: 'Begin your clean food journey',
  },
];

export const getOnboardingImage = (pageNumber: number): ImageSourcePropType => {
  if (pageNumber === 2) return ONBOARDING_IMAGES[2];
  if (pageNumber === 3) return ONBOARDING_IMAGES[3];
  return ONBOARDING_IMAGES[1];
};
