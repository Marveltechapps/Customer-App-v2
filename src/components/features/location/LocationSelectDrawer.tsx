import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
  Easing,
  ActivityIndicator,
  ScrollView,
  PanResponder,
} from 'react-native';
import Text from '../../common/Text';
import { addressService, type Address } from '../../../services/address/addressService';
import { Colors } from '../../../constants/Colors';
import { Theme } from '../../../constants/Theme';
import { logger } from '@/utils/logger';
import { notifyAddressesChanged, subscribeAddressesChanged } from '../../../utils/addressRefresh';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DRAWER_MAX_HEIGHT = SCREEN_HEIGHT * 0.55;
const BACKDROP_OPACITY = 0.5;
const DRAG_THRESHOLD = 80;

/** iOS-like sheet motion: soft open, ease-out dismiss */
const OPEN_SPRING = {
  tension: 52,
  friction: 12,
  overshootClamping: true,
  useNativeDriver: true as const,
};
const OPEN_BACKDROP_MS = 340;
const CLOSE_MS = 320;
const EASE_OUT_OPEN = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_IN_CLOSE = Easing.bezier(0.4, 0, 1, 1);

interface LocationSelectDrawerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (address: Address) => void;
  onAddNew: () => void;
}

export default function LocationSelectDrawer({
  visible,
  onClose,
  onSelect,
  onAddNew,
}: LocationSelectDrawerProps) {
  const translateY = useRef(new Animated.Value(DRAWER_MAX_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rendered, setRendered] = useState(false);
  const closingAnimRef = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 8,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > DRAG_THRESHOLD || gestureState.vy > 0.5) {
          closeDrawer();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            ...OPEN_SPRING,
          }).start();
        }
      },
    })
  ).current;

  const loadAddresses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await addressService.getAll();
      if (res?.success && res.data) {
        const list = Array.isArray(res.data) ? res.data : [];
        setAddresses(list);
        const defaultAddr = list.find((a) => a.isDefault);
        if (defaultAddr) setSelectedId(defaultAddr._id);
      }
    } catch (err) {
      logger.warn('Failed to load addresses for drawer', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const closeDrawer = useCallback(() => {
    if (closingAnimRef.current) return;
    closingAnimRef.current = true;
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: DRAWER_MAX_HEIGHT,
        duration: CLOSE_MS,
        easing: EASE_IN_CLOSE,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: CLOSE_MS,
        easing: EASE_IN_CLOSE,
        useNativeDriver: true,
      }),
    ]).start(() => {
      closingAnimRef.current = false;
      setRendered(false);
      onClose();
    });
  }, [onClose, translateY, backdropOpacity]);

  useEffect(() => {
    if (!visible) return;
    closingAnimRef.current = false;
    setRendered(true);
    loadAddresses();
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        ...OPEN_SPRING,
      }),
      Animated.timing(backdropOpacity, {
        toValue: BACKDROP_OPACITY,
        duration: OPEN_BACKDROP_MS,
        easing: EASE_OUT_OPEN,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, loadAddresses, translateY, backdropOpacity]);

  useEffect(() => {
    if (visible || !rendered || closingAnimRef.current) return;
    closeDrawer();
  }, [visible, rendered, closeDrawer]);

  useEffect(() => {
    return subscribeAddressesChanged(() => {
      void loadAddresses();
    });
  }, [loadAddresses]);

  const handleSelect = useCallback(
    async (address: Address) => {
      setSelectedId(address._id);
      try {
        let selected = address;
        if (!address.isDefault) {
          const res = await addressService.setDefault(address._id);
          if (res?.success && res.data) {
            selected = res.data;
          } else {
            selected = { ...address, isDefault: true };
          }
          await loadAddresses();
          notifyAddressesChanged({ type: 'upsert', address: selected });
        }
        onSelect(selected);
      } catch (err) {
        logger.warn('Failed to set default address', err);
        onSelect(address);
      }
    },
    [loadAddresses, onSelect],
  );

  if (!rendered) return null;

  const formatAddr = (a: Address) => {
    const parts = [a.line1, a.line2, a.landmark, a.city, a.state, a.pincode].filter(Boolean);
    return parts.join(', ');
  };

  const getLabelIcon = (label: string) => {
    const lower = label?.toLowerCase() ?? '';
    if (lower.includes('home')) return '🏠';
    if (lower.includes('work') || lower.includes('office')) return '🏢';
    if (lower.includes('other')) return '📍';
    return '📍';
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <TouchableWithoutFeedback onPress={closeDrawer}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[
          styles.drawer,
          { maxHeight: DRAWER_MAX_HEIGHT, transform: [{ translateY }] },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={styles.handleBar} />

        <View style={styles.headerRow}>
          <Text style={styles.title}>Choose delivery location</Text>
          <TouchableOpacity
            style={styles.addButton}
            activeOpacity={0.7}
            onPress={onAddNew}
          >
            <Text style={styles.addButtonIcon}>＋</Text>
            <Text style={styles.addButtonText}>New</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>
          Select an address for delivery
        </Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : addresses.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📍</Text>
            <Text style={styles.emptyText}>No saved addresses yet</Text>
            <Text style={styles.emptySubtext}>
              Add a delivery address to get started
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {addresses.map((addr) => {
              const isSelected = addr._id === selectedId;
              return (
                <TouchableOpacity
                  key={addr._id}
                  style={[
                    styles.addressCard,
                    isSelected && styles.addressCardSelected,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => handleSelect(addr)}
                >
                  <View style={styles.addressRow}>
                    <Text style={styles.addressIcon}>
                      {getLabelIcon(addr.label)}
                    </Text>
                    <View style={styles.addressInfo}>
                      <View style={styles.labelRow}>
                        <Text style={styles.addressLabel}>{addr.label}</Text>
                        {addr.isDefault && (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultBadgeText}>Default</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.addressText} numberOfLines={2}>
                        {formatAddr(addr)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.radio,
                        isSelected && styles.radioSelected,
                      ]}
                    >
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  drawer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Theme.spacing.md,
    paddingBottom: 34,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  title: {
    ...Theme.typography.h3,
    color: Colors.text,
    flex: 1,
    marginRight: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  subtitle: {
    ...Theme.typography.bodySmall,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  loadingContainer: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyText: {
    ...Theme.typography.body,
    color: Colors.text,
    marginBottom: 4,
  },
  emptySubtext: {
    ...Theme.typography.bodySmall,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  list: {
    maxHeight: SCREEN_HEIGHT * 0.28,
  },
  listContent: {
    gap: 10,
    paddingBottom: 4,
  },
  addressCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: Theme.borderRadius.lg,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  addressCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#F0FFF0',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  addressInfo: {
    flex: 1,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  addressLabel: {
    ...Theme.typography.menuItem,
    fontWeight: '600',
    color: Colors.text,
  },
  defaultBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  defaultBadgeText: {
    ...Theme.typography.caption,
    color: Colors.white,
    fontWeight: '600',
    fontSize: 10,
  },
  addressText: {
    ...Theme.typography.caption,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  radioSelected: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    backgroundColor: Colors.primary,
    borderRadius: Theme.borderRadius.md,
    minHeight: 34,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 6,
  },
  addButtonIcon: {
    fontSize: 14,
    color: Colors.white,
    fontWeight: '700',
  },
  addButtonText: {
    ...Theme.typography.caption,
    color: Colors.white,
    fontWeight: '600',
  },
});
