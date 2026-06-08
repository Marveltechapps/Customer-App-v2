import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthScreenTheme } from '@/hooks/useAuthScreenTheme';

interface ConsentCheckboxProps {
  checked: boolean;
  onToggle: () => void;
  onTermsPress: () => void;
  onPrivacyPress: () => void;
}

export default function ConsentCheckbox({
  checked,
  onToggle,
  onTermsPress,
  onPrivacyPress,
}: ConsentCheckboxProps) {
  const theme = useAuthScreenTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 10,
        },
        checkbox: {
          width: 20,
          height: 20,
          borderRadius: 6,
          borderWidth: 1.5,
          borderColor: theme.colors.checkboxBorder,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 1,
        },
        checkboxChecked: {
          backgroundColor: theme.colors.primary,
          borderColor: theme.colors.primary,
        },
        text: {
          flex: 1,
          fontSize: theme.typography.fontSize.sm,
          color: theme.colors.mutedText,
          lineHeight: 18,
        },
        link: {
          color: theme.colors.legalLink,
          textDecorationLine: 'underline',
        },
      }),
    [theme]
  );

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={[styles.checkbox, checked && styles.checkboxChecked]}
        onPress={onToggle}
        activeOpacity={0.8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
      >
        {checked && <Ionicons name="checkmark" size={14} color={theme.colors.onPrimary} />}
      </TouchableOpacity>
      <Text style={styles.text}>
        I agree to the{' '}
        <Text style={styles.link} onPress={onTermsPress}>
          Terms of Service
        </Text>{' '}
        and{' '}
        <Text style={styles.link} onPress={onPrivacyPress}>
          Privacy Policy
        </Text>
      </Text>
    </View>
  );
}
