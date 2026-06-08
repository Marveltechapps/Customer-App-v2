import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AUTH_PRIMARY } from '@/constants/authTheme';
import type { LoginMode } from '@/services/auth/authService';

interface LoginMethodTabsProps {
  value: LoginMode;
  onChange: (mode: LoginMode) => void;
}

const TABS: { key: LoginMode; label: string }[] = [
  { key: 'mobile', label: 'Mobile' },
  { key: 'email', label: 'Email' },
  { key: 'whatsapp', label: 'WhatsApp' },
];

export default function LoginMethodTabs({ value, onChange }: LoginMethodTabsProps) {
  const styles = useMemo(
    () =>
      StyleSheet.create({
        track: {
          flexDirection: 'row',
          backgroundColor: '#F3F4F6',
          borderRadius: 16,
          padding: 4,
          gap: 4,
        },
        tab: {
          flex: 1,
          paddingVertical: 11,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
        },
        tabActive: {
          backgroundColor: AUTH_PRIMARY,
        },
        tabLabel: {
          fontSize: 14,
          fontWeight: '700',
          color: '#1A1A1A',
        },
        tabLabelActive: {
          color: '#FFFFFF',
        },
      }),
    []
  );

  return (
    <View style={styles.track}>
      {TABS.map((tab) => {
        const active = value === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, active && styles.tabActive]}
            onPress={() => onChange(tab.key)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
