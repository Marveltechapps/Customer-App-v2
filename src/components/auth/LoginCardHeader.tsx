import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AUTH_BRAND_NAME, AUTH_PRIMARY } from '@/constants/authTheme';

interface LoginCardHeaderProps {
  width: number;
}

/** Green header band with organic wave bottom — pinned to top of login screen. */
export default function LoginCardHeader({ width }: LoginCardHeaderProps) {
  const insets = useSafeAreaInsets();
  const waveHeight = 22;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        shadowWrap: {
          width: '100%',
          backgroundColor: AUTH_PRIMARY,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.18,
          shadowRadius: 10,
          elevation: 8,
          zIndex: 2,
        },
        wrap: {
          backgroundColor: AUTH_PRIMARY,
          overflow: 'hidden',
        },
        titleBlock: {
          paddingTop: Math.max(insets.top, 12) + 16,
          paddingBottom: 18,
          alignItems: 'center',
          justifyContent: 'center',
        },
        title: {
          fontSize: 18,
          fontWeight: '700',
          color: '#FFFFFF',
          letterSpacing: 0.2,
        },
        wave: {
          marginTop: -1,
        },
      }),
    [insets.top]
  );

  const wavePath = `M0,0 H${width} V${waveHeight * 0.28} C${width * 0.78},${waveHeight * 1.05} ${width * 0.32},${waveHeight * 0.02} 0,${waveHeight * 0.62} Z`;

  return (
    <View style={styles.shadowWrap}>
      <View style={styles.wrap}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{AUTH_BRAND_NAME}</Text>
        </View>
        <Svg width={width} height={waveHeight} style={styles.wave}>
          <Path d={wavePath} fill={AUTH_PRIMARY} />
        </Svg>
      </View>
    </View>
  );
}
