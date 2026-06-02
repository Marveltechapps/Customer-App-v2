import React, { useState } from 'react';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import Toast from 'react-native-toast-message';
import { createPage, deletePage, listPages, type CmsPage } from '@/services/adminCms/adminCmsService';

export default function CmsPagesTab({ onEditBlocks }: { onEditBlocks: (pageId: string) => void }) {
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listPages();
      setPages(data);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.message || 'Failed to load pages' });
    } finally {
      setLoading(false);
    }
  };

  useRefreshOnFocus(() => {
    void load();
  }, []);

  const add = async () => {
    const s = slug.trim().toLowerCase().replace(/\s+/g, '-');
    if (!s) {
      Toast.show({ type: 'error', text1: 'Slug is required' });
      return;
    }
    setCreating(true);
    try {
      const page = await createPage({ slug: s, title: title.trim() });
      setPages((prev) => [page, ...prev]);
      setSlug('');
      setTitle('');
      Toast.show({ type: 'success', text1: 'Page created' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.response?.data?.message || e?.message || 'Create failed' });
    } finally {
      setCreating(false);
    }
  };

  const remove = (id: string) => {
    Alert.alert('Delete page', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePage(id);
            setPages((prev) => prev.filter((p) => p._id !== id));
            Toast.show({ type: 'success', text1: 'Page deleted' });
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
        <Text style={styles.cardTitle}>Create new page</Text>
        <Field label="Slug" value={slug} onChange={setSlug} placeholder="e.g. tiny-tummies" />
        <Field label="Title" value={title} onChange={setTitle} placeholder="Optional" />
        <TouchableOpacity style={styles.primaryBtn} onPress={add} disabled={creating}>
          <Text style={styles.primaryBtnText}>{creating ? 'Creating...' : 'Create Page'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.rowBetween}>
        <Text style={styles.sectionLabel}>Pages</Text>
        <TouchableOpacity onPress={load}>
          <Text style={styles.link}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 16 }} />
      ) : (
        pages.map((p) => (
          <View key={p._id} style={styles.pageRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.pageTitle} numberOfLines={1}>
                {p.title || p.slug}
              </Text>
              <Text style={styles.pageSub} numberOfLines={1}>
                {p.slug} · {p.status}
              </Text>
            </View>
            <TouchableOpacity style={styles.smallBtn} onPress={() => onEditBlocks(p._id)}>
              <Text style={styles.smallBtnText}>Blocks</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.smallBtn, styles.smallBtnDanger]} onPress={() => remove(p._id)}>
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
  pageRow: { backgroundColor: '#FFF', borderWidth: 0.5, borderColor: '#E5E5E5', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  pageTitle: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  pageSub: { fontSize: 11, color: '#888', marginTop: 2 },
  smallBtn: { borderWidth: 0.5, borderColor: '#CCC', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#FFF' },
  smallBtnText: { fontSize: 12, fontWeight: '700', color: '#333' },
  smallBtnDanger: { borderColor: '#A32D2D' },
  smallBtnDangerText: { color: '#A32D2D' },
});

