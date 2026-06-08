import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

const selorgLogo = require('../../../assets/selorg-logo.png');

/** Logo + welcome copy shown between the green header and login form card. */
export default function LoginWelcomeSection() {
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          alignItems: 'center',
          marginTop: -28,
          marginBottom: 16,
        },
        logoRing: {
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: '#E8F0E8',
          borderWidth: 2,
          borderColor: '#B8D4BA',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 14,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 6,
          elevation: 3,
        },
        logo: {
          width: 44,
          height: 44,
          resizeMode: 'contain',
        },
        title: {
          fontSize: 20,
          fontWeight: '700',
          color: '#1A1A1A',
          textAlign: 'center',
          marginBottom: 4,
        },
        subtitle: {
          fontSize: 14,
          fontWeight: '400',
          color: '#4C4C4C',
          textAlign: 'center',
          lineHeight: 20,
        },
      }),
    []
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.logoRing}>
        <Image source={selorgLogo} style={styles.logo} accessibilityLabel="Selorg logo" />
      </View>
      <Text style={styles.title}>Welcome to Selorg</Text>
      <Text style={styles.subtitle}>
        Fresh & organic groceries, delivered to your door
      </Text>
    </View>
  );
}
