import React, { useCallback, useState } from 'react';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { View, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RootStackRouteProp } from '../types/navigation';
import BackIcon from '../components/icons/BackIcon';
import Text from '../components/common/Text';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { blockRegistry } from '../blocks/blockRegistry';
import { api } from '../services/api/client';
import { endpoints } from '../services/api/endpoints';
import { getApiErrorMessage } from '../services/api/types';

export default function DynamicPage() {
  const navigation = useNavigation();
  const route = useRoute<RootStackRouteProp<'DynamicPage'>>();
  const { slug } = route.params;
  const showHeader = slug !== 'home';
  const [blocks, setBlocks] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get(endpoints.page(slug));
      if (resp?.success && resp?.data?.blocks) {
        setBlocks(resp.data.blocks);
      } else {
        setBlocks(null);
        setError('Page not found');
      }
    } catch (err) {
      setBlocks(null);
      setError(getApiErrorMessage(err, 'Failed to load page'));
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useRefreshOnFocus(() => {
    void loadPage();
  }, [loadPage]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#034703" />
      </View>
    );
  }

  if (error || !blocks) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || 'Page not found'}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {showHeader && (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <BackIcon />
          </TouchableOpacity>
          <Text style={styles.title}>Back</Text>
        </View>
      )}
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {blocks.map((block) => {
        const Component = blockRegistry[block.type];
        if (!Component) return null;
        return (
          <ErrorBoundary key={block.id} fallback={null}>
            <Component
              id={block.id}
              type={block.type}
              config={block.config || {}}
              data={block.data || {}}
            />
          </ErrorBoundary>
        );
      })}
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  title: { fontSize: 18, fontWeight: '600', marginLeft: 12 },
  scroll: { flex: 1 },
  content: { paddingBottom: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' },
  errorText: { color: '#666', fontSize: 14 },
});
