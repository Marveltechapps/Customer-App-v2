import React, { useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthScreenTheme } from '@/hooks/useAuthScreenTheme';

export default function AuthHeader() {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const theme = useAuthScreenTheme();

  const headerHeight = useMemo(() => {
    const calculated = screenHeight * 0.14;
    return Math.min(Math.max(calculated, 96), 128) + insets.top;
  }, [screenHeight, insets.top]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        shadowWrap: {
          backgroundColor: theme.colors.headerBg,
          borderBottomLeftRadius: theme.layout.headerRadius,
          borderBottomRightRadius: theme.layout.headerRadius,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.22,
          shadowRadius: 10,
          elevation: 8,
          zIndex: 2,
        },
        header: {
          backgroundColor: theme.colors.headerBg,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.headerBorder,
          borderBottomLeftRadius: theme.layout.headerRadius,
          borderBottomRightRadius: theme.layout.headerRadius,
          overflow: 'hidden',
        },
        brandCenter: {
          flex: 1,
          width: '100%',
          alignItems: 'center',
          justifyContent: 'center',
        },
        brandName: {
          fontSize: theme.typography.fontSize.xl,
          fontWeight: theme.typography.fontWeight.bold,
          color: theme.colors.headerBrand,
          textAlign: 'center',
        },
      }),
    [theme]
  );

  return (
    <View style={[styles.shadowWrap, { height: headerHeight }]}>
      <View style={[styles.header, { height: headerHeight }]}>
        <View style={[styles.brandCenter, { paddingTop: insets.top }]}>
          <Text style={styles.brandName}>{theme.brandName}</Text>
        </View>
      </View>
    </View>
  );
}
