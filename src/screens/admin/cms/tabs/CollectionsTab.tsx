import React, { useState } from 'react';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import Toast from 'react-native-toast-message';
import { createCollection, deleteCollection, listCollections, type CmsCollection } from '@/services/adminCms/adminCmsService';

export default function CollectionsTab() {
  const [items, setItems] = useState<CmsCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listCollections();
      setItems(data);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.message || 'Failed to load collections' });
    } finally {
      setLoading(false);
    }
  };

  useRefreshOnFocus(() => {
    void load();
  }, []);

  const add = async () => {
    const s = slug.trim();
    if (!s) return Toast.show({ type: 'error', text1: 'Collection slug (ID) is required' });
    setCreating(true);
    try {
      const created = await createCollection({ slug: s, name: name.trim() || s, type: 'rule-based' });
      setItems((prev) => [created, ...prev]);
      setSlug('');
      setName('');
      Toast.show({ type: 'success', text1: 'Collection created' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.response?.data?.message || e?.message || 'Create failed' });
    } finally {
      setCreating(false);
    }
  };

  const remove = (id: string) => {
    Alert.alert('Delete collection', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCollection(id);
            setItems((prev) => prev.filter((c) => c._id !== id));
            Toast.show({ type: 'success', text1: 'Collection deleted' });
          } catch (e: any) {
            Toast.show({ type: 'error', text1: e?.message || 'Delete failed' });
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Create collection</Text>
        <Field label="Collection ID / Slug" value={slug} onChange={setSlug} placeholder="e.g. COLL-ORGANIC" />
        <Field label="Name" value={name} onChange={setName} placeholder="Optional" />
        <TouchableOpacity style={styles.primaryBtn} onPress={add} disabled={creating}>
          <Text style={styles.primaryBtnText}>{creating ? 'Creating...' : 'Create'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.rowBetween}>
        <Text style={styles.sectionLabel}>Collections</Text>
        <TouchableOpacity onPress={load}>
          <Text style={styles.link}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 16 }} />
      ) : (
        items.map((c) => (
          <View key={c._id} style={styles.row}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.title} numberOfLines={1}>
                {c.name}
              </Text>
              <Text style={styles.sub} numberOfLines={1}>
                {c.slug} · {c.type}
              </Text>
            </View>
            <TouchableOpacity style={[styles.smallBtn, styles.smallBtnDanger]} onPress={() => remove(c._id)}>
              <Text style={[styles.smallBtnText, styles.smallBtnDangerText]}>Delete</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#BBB"
        autoCapitalize="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { padding: 14, paddingBottom: 40, gap: 12 },
  card: { backgroundColor: '#FFF', borderWidth: 0.5, borderColor: '#E5E5E5', borderRadius: 12, padding: 14 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#1A1A1A', marginBottom: 10 },
  fieldWrap: { marginBottom: 10 },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: '#666', marginBottom: 4 },
  fieldInput: { borderWidth: 0.5, borderColor: '#CCC', borderRadius: 8, padding: 10, fontSize: 13, color: '#1A1A1A' },
  primaryBtn: { backgroundColor: '#1A1A1A', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 4 },
  primaryBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  link: { color: '#185FA5', fontWeight: '600' },
  row: { backgroundColor: '#FFF', borderWidth: 0.5, borderColor: '#E5E5E5', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  sub: { fontSize: 11, color: '#888', marginTop: 2 },
  smallBtn: { borderWidth: 0.5, borderColor: '#CCC', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#FFF' },
  smallBtnText: { fontSize: 12, fontWeight: '700', color: '#333' },
  smallBtnDanger: { borderColor: '#A32D2D' },
  smallBtnDangerText: { color: '#A32D2D' },
});

