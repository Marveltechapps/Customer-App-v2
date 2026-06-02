import React, { useCallback, useState } from 'react';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { getCmsOverview, type AdminCmsOverview } from '@/services/adminCms/adminCmsService';

type TabId = 'overview' | 'upload' | 'pages' | 'blocks' | 'banners' | 'collections' | 'homeconfig';

export default function OverviewTab({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
  const [data, setData] = useState<AdminCmsOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCmsOverview();
      setData(res);
    } finally {
      setLoading(false);
    }
  }, []);

  useRefreshOnFocus(() => {
    void loadOverview();
  }, [loadOverview]);

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} />;
  if (!data) {
    return (
      <View style={{ padding: 16 }}>
        <Text style={{ color: '#888' }}>Failed to load overview.</Text>
      </View>
    );
  }

  const missingPrice = data.issues?.missingPrice || 0;
  const inactiveProducts = data.issues?.inactiveProducts || 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {(missingPrice > 0 || inactiveProducts > 0) && (
        <View style={styles.warnBar}>
          <Text style={styles.warnText}>
            {missingPrice > 0 ? `${missingPrice} products missing price` : ''}
            {missingPrice > 0 && inactiveProducts > 0 ? ' · ' : ''}
            {inactiveProducts > 0 ? `${inactiveProducts} products inactive/draft` : ''}
          </Text>
        </View>
      )}

      <View style={styles.metricsRow}>
        {[
          { label: 'Total SKUs', value: data.counts?.skus ?? 0, sub: 'From SKU Master' },
          { label: 'CMS Pages', value: data.counts?.pages ?? 0, sub: 'Published/draft pages' },
          { label: 'Banners', value: data.counts?.banners ?? 0, sub: 'Hero/Mid banners' },
          { label: 'Collections', value: data.counts?.collections ?? 0, sub: 'Manual / rule-based' },
        ].map((m) => (
          <View key={m.label} style={styles.metricCard}>
            <Text style={styles.metricLabel}>{m.label}</Text>
            <Text style={styles.metricValue}>{m.value}</Text>
            <Text style={styles.metricSub}>{m.sub}</Text>
          </View>
        ))}
      </View>

      <View style={styles.actionsCard}>
        <Text style={styles.actionsTitle}>Quick actions</Text>
        {[
          { label: 'Upload SKU Mastersheet', tab: 'upload' as const },
          { label: 'Upload CMS Pages Mastersheet', tab: 'upload' as const },
          { label: 'Edit page blocks', tab: 'blocks' as const },
          { label: 'Manage pages', tab: 'pages' as const },
          { label: 'Manage banners', tab: 'banners' as const },
        ].map((a) => (
          <TouchableOpacity key={a.label} style={styles.actionRow} onPress={() => onNavigate(a.tab)}>
            <Text style={styles.actionLabel}>{a.label}</Text>
            <Text style={styles.actionArrow}>→</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { padding: 14, gap: 12 },
  warnBar: {
    backgroundColor: '#FAEEDA',
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: '#FAC775',
    padding: 10,
  },
  warnText: { fontSize: 12, color: '#854F0B' },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFF',
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: '#E5E5E5',
    padding: 12,
  },
  metricLabel: { fontSize: 11, color: '#888' },
  metricValue: { fontSize: 22, fontWeight: '700', color: '#1A1A1A', marginTop: 4 },
  metricSub: { fontSize: 10, color: '#AAA', marginTop: 2 },
  actionsCard: { backgroundColor: '#FFF', borderRadius: 10, borderWidth: 0.5, borderColor: '#E5E5E5', padding: 14 },
  actionsTitle: { fontSize: 13, fontWeight: '700', color: '#1A1A1A', marginBottom: 10 },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 0.5,
    borderTopColor: '#F0F0F0',
  },
  actionLabel: { fontSize: 13, color: '#333' },
  actionArrow: { fontSize: 14, color: '#888' },
});

