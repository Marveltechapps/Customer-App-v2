/**
 * Shared top-right Skip control (Zepto-style).
 * Uses safe-area insets so it stays clear of status bars, notches,
 * Dynamic Island, and landscape side insets on phones and tablets.
 */

import React, { useMemo } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scale, verticalScale, getSpacing, scaleFont } from '@/utils/responsive';

export interface SkipButtonProps {
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle;
}

export default function SkipButton({
  onPress,
  disabled = false,
  accessibilityLabel = 'Skip',
  style,
}: SkipButtonProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const positionStyle = useMemo(() => {
    const edgeGap = Math.max(getSpacing(16, width), 12);
    const topGap = Math.max(verticalScale(8), 8);
    return {
      top: insets.top + topGap,
      right: Math.max(insets.right, edgeGap),
    };
  }, [insets.top, insets.right, width]);

  const responsiveStyles = useMemo(
    () => ({
      paddingVertical: Math.max(verticalScale(6), 6),
      paddingHorizontal: Math.max(scale(14, width), 14),
      borderRadius: scale(8, width),
      fontSize: scaleFont(14, 13, 16, width),
    }),
    [width]
  );

  return (
    <TouchableOpacity
      style={[
        styles.button,
        positionStyle,
        {
          paddingVertical: responsiveStyles.paddingVertical,
          paddingHorizontal: responsiveStyles.paddingHorizontal,
          borderRadius: responsiveStyles.borderRadius,
        },
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={disabled}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
    >
      <Text style={[styles.label, { fontSize: responsiveStyles.fontSize }]}>Skip</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    zIndex: 100,
    elevation: 100,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: '#D0D0D0',
    backgroundColor: 'transparent',
  },
  label: {
    fontFamily: 'Inter',
    fontWeight: '500',
    color: '#6B6B6B',
  },
});
