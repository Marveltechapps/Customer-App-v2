import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '@/components/common/Button';
import { useAuthScreenTheme } from '@/hooks/useAuthScreenTheme';
import { getPrivacy, getTerms } from '@/services/legal/legalService';

interface PolicyModalProps {
  visible: boolean;
  type: 'terms' | 'privacy';
  onClose: () => void;
}

export default function PolicyModal({ visible, type, onClose }: PolicyModalProps) {
  const theme = useAuthScreenTheme();
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState(type === 'terms' ? 'Terms of Service' : 'Privacy Policy');
  const [body, setBody] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = type === 'terms' ? await getTerms() : await getPrivacy();
      const doc = resp?.data;
      setTitle(doc?.title || (type === 'terms' ? 'Terms of Service' : 'Privacy Policy'));
      setBody(doc?.content || 'Content is temporarily unavailable. Please try again later.');
    } catch {
      setTitle(type === 'terms' ? 'Terms of Service' : 'Privacy Policy');
      setBody(
        type === 'terms'
          ? 'By using Selorg Customer you agree to our terms of service and shopping policies.'
          : 'We collect only the information required to operate customer services, orders, and delivery workflows.'
      );
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.pageBg,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.inputBorder,
          backgroundColor: theme.colors.surface,
        },
        headerTitle: {
          fontSize: theme.typography.fontSize['2xl'],
          fontWeight: theme.typography.fontWeight.bold,
          color: theme.colors.textPrimary,
          flex: 1,
          textAlign: 'center',
        },
        closeBtn: {
          position: 'absolute',
          right: theme.spacing.lg,
          padding: theme.spacing.sm,
        },
        loading: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        },
        scroll: { flex: 1 },
        scrollContent: {
          padding: theme.layout.contentPaddingH,
          paddingBottom: theme.spacing.xxl,
        },
        body: {
          fontSize: theme.typography.fontSize.md,
          lineHeight: 22,
          color: theme.colors.mutedText,
        },
        footer: {
          padding: theme.layout.contentPaddingH,
          borderTopWidth: 1,
          borderTopColor: theme.colors.inputBorder,
        },
      }),
    [theme]
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
            <Ionicons name="close" size={22} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.body}>{body}</Text>
          </ScrollView>
        )}
        <View style={styles.footer}>
          <Button title="I Understand & Accept" onPress={onClose} variant="primary" />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
