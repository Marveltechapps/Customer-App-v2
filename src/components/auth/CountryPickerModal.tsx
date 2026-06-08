import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthScreenTheme } from '@/hooks/useAuthScreenTheme';
import { COUNTRY_LIST, type CountryOption } from '@/lib/countries';

interface CountryPickerModalProps {
  visible: boolean;
  selectedCode: string;
  onSelect: (country: CountryOption) => void;
  onClose: () => void;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.75;

/**
 * In-screen bottom sheet (no RN Modal) so Android/iOS never show a dark native backdrop.
 * Uses animated overlay + slide-up sheet for a smooth open/close experience.
 */
export default function CountryPickerModal({
  visible,
  selectedCode,
  onSelect,
  onClose,
}: CountryPickerModalProps) {
  const theme = useAuthScreenTheme();
  const [query, setQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const animateIn = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 22,
        stiffness: 220,
        mass: 0.9,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const animateOut = useCallback(
    (onDone?: () => void) => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SHEET_HEIGHT,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) onDone?.();
      });
    },
    [fadeAnim, slideAnim]
  );

  useEffect(() => {
    if (visible) {
      setMounted(true);
      slideAnim.setValue(SHEET_HEIGHT);
      fadeAnim.setValue(0);
      requestAnimationFrame(() => animateIn());
      return;
    }

    if (mounted) {
      animateOut(() => {
        setMounted(false);
        setQuery('');
      });
    }
  }, [visible, mounted, animateIn, animateOut, slideAnim, fadeAnim]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        host: {
          ...StyleSheet.absoluteFillObject,
          zIndex: 1000,
          elevation: 1000,
          justifyContent: 'flex-end',
        },
        backdrop: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: 'rgba(0, 0, 0, 0.55)',
        },
        backdropPressable: {
          flex: 1,
        },
        sheetWrapper: {
          height: SHEET_HEIGHT,
        },
        sheet: {
          flex: 1,
          backgroundColor: theme.colors.surface,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.12,
          shadowRadius: 12,
          elevation: 16,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: theme.layout.contentPaddingH,
          paddingVertical: theme.spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.inputBorder,
        },
        title: {
          fontSize: theme.typography.fontSize.lg,
          fontWeight: theme.typography.fontWeight.bold,
          color: theme.colors.textPrimary,
        },
        search: {
          marginHorizontal: theme.layout.contentPaddingH,
          marginVertical: theme.spacing.sm,
          borderWidth: 1,
          borderColor: theme.colors.inputBorder,
          borderRadius: theme.radius.md,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          fontSize: theme.typography.fontSize.lg,
          color: theme.colors.textPrimary,
          backgroundColor: theme.colors.background,
        },
        list: {
          flex: 1,
          paddingHorizontal: theme.spacing.sm,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radius.md,
          gap: theme.spacing.sm,
        },
        rowSelected: {
          backgroundColor: theme.colors.countrySelectedBg,
        },
        flag: {
          fontSize: 20,
          width: 28,
        },
        name: {
          flex: 1,
          fontSize: theme.typography.fontSize.lg,
          color: theme.colors.textPrimary,
        },
        dial: {
          fontSize: theme.typography.fontSize.md,
          color: theme.colors.mutedText,
          fontWeight: theme.typography.fontWeight.semibold,
        },
      }),
    [theme]
  );

  if (!mounted) return null;

  return (
    <View style={styles.host} pointerEvents="box-none">
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <Pressable
          style={styles.backdropPressable}
          onPress={onClose}
          accessibilityLabel="Close country picker"
        />
      </Animated.View>
      <Animated.View style={[styles.sheetWrapper, { transform: [{ translateY: slideAnim }] }]}>
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Select country</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.8}>
              <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.search}
            placeholder="Search country"
            placeholderTextColor={theme.colors.placeholder}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
          />
          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {filteredCountries(query).map((country) => {
              const selected = country.code === selectedCode;
              return (
                <TouchableOpacity
                  key={country.code}
                  style={[styles.row, selected && styles.rowSelected]}
                  onPress={() => {
                    onSelect(country);
                    onClose();
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.flag}>{country.flag}</Text>
                  <Text style={styles.name}>{country.name}</Text>
                  <Text style={styles.dial}>{country.dialCode}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

function filteredCountries(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return COUNTRY_LIST;
  return COUNTRY_LIST.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.dialCode.includes(q) ||
      c.code.toLowerCase().includes(q)
  );
}
