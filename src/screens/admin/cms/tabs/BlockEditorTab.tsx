import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import Toast from 'react-native-toast-message';

import { getPage, listPages, updatePage, type CmsPage } from '@/services/adminCms/adminCmsService';

const BLOCK_TYPES = [
  'heroBanner',
  'bannerCarousel',
  'categoryGrid',
  'productCarousel',
  'collectionCarousel',
  'promoImage',
  'videoBlock',
  'lifestyleGrid',
  'textBanner',
  'organicTagline',
] as const;

type PageBlock = {
  _id?: string;
  type: string;
  order: number;
  config?: any;
  dataSource?: any;
};

export default function BlockEditorTab({ initialPageId }: { initialPageId: string | null }) {
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string>(initialPageId || '');
  const [page, setPage] = useState<CmsPage | null>(null);
  const [blocks, setBlocks] = useState<PageBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [form, setForm] = useState<PageBlock | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await listPages();
        setPages(data);
      } catch (e: any) {
        Toast.show({ type: 'error', text1: e?.message || 'Failed to load pages' });
      }
    })();
  }, []);

  useEffect(() => {
    if (initialPageId) setSelectedPageId(initialPageId);
  }, [initialPageId]);

  const loadPage = async (id: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const p = await getPage(id);
      setPage(p);
      const b = Array.isArray(p.blocks) ? (p.blocks as PageBlock[]) : [];
      const sorted = b.slice().sort((a, c) => (a.order || 1) - (c.order || 1));
      setBlocks(sorted.map((x, i) => ({ ...x, order: i + 1 })));
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.message || 'Failed to load blocks' });
      setPage(null);
      setBlocks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedPageId) void loadPage(selectedPageId);
  }, [selectedPageId]);

  const persist = async (nextBlocks: PageBlock[]) => {
    if (!page?._id) return;
    setSaving(true);
    try {
      const payloadBlocks = nextBlocks.map((b) => ({
        type: b.type,
        order: b.order,
        config: b.config || {},
        dataSource: b.dataSource || {},
      }));
      const updated = await updatePage(page._id, { blocks: payloadBlocks });
      setPage(updated);
      Toast.show({ type: 'success', text1: 'Saved' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.message || 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const handleDragEnd = async ({ data }: { data: PageBlock[] }) => {
    const reordered = data.map((b, i) => ({ ...b, order: i + 1 }));
    setBlocks(reordered);
    await persist(reordered);
  };

  const openEdit = (index: number) => {
    setEditingIndex(index);
    setForm({ ...blocks[index] });
  };

  const openNew = (type: string) => {
    setEditingIndex(-1);
    setForm({
      type,
      order: blocks.length + 1,
      config: { title: '' },
      dataSource: {},
    });
  };

  const removeBlock = (index: number) => {
    Alert.alert('Delete block', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const next = blocks.filter((_b, i) => i !== index).map((b, i) => ({ ...b, order: i + 1 }));
          setBlocks(next);
          setEditingIndex(null);
          setForm(null);
          await persist(next);
        },
      },
    ]);
  };

  const saveEdit = async () => {
    if (!form) return;
    const next = blocks.slice();
    if (editingIndex === -1) {
      next.push({ ...form });
    } else if (editingIndex != null && editingIndex >= 0) {
      next[editingIndex] = { ...form };
    }
    next.sort((a, b) => (a.order || 1) - (b.order || 1));
    const normalized = next.map((b, i) => ({ ...b, order: i + 1 }));
    setBlocks(normalized);
    setEditingIndex(null);
    setForm(null);
    await persist(normalized);
  };

  const renderItem = useCallback(({ item, drag, isActive, index }: any) => {
    return (
      <ScaleDecorator>
        <TouchableOpacity
          style={[styles.blockRow, isActive && styles.blockRowActive]}
          onLongPress={drag}
          onPress={() => openEdit(index)}
        >
          <Text style={styles.dragHandle}>⠿</Text>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.blockTitle} numberOfLines={1}>
              {item.type}
              {item.config?.title ? ` · ${item.config.title}` : ''}
            </Text>
            <Text style={styles.blockSub} numberOfLines={1}>
              #{item.order}
              {item.dataSource?.collectionId ? ` · collection: ${String(item.dataSource.collectionId)}` : ''}
            </Text>
          </View>
        </TouchableOpacity>
      </ScaleDecorator>
    );
  }, [blocks]);

  const pageLabel = useMemo(() => {
    const p = pages.find((x) => x._id === selectedPageId);
    return p ? `${p.title || p.slug} (${p.slug})` : '';
  }, [pages, selectedPageId]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.pickerCard}>
        <Text style={styles.pickerLabel}>Select page:</Text>
        <View style={styles.pickerBorder}>
          <Picker selectedValue={selectedPageId} onValueChange={(v) => setSelectedPageId(String(v))} style={styles.picker}>
            <Picker.Item label="Select a page..." value="" />
            {pages.map((p) => (
              <Picker.Item key={p._id} label={`${p.title || p.slug} (${p.slug})`} value={p._id} />
            ))}
          </Picker>
        </View>
        {!!pageLabel && <Text style={styles.pickerHint}>{pageLabel}</Text>}
      </View>

      {(loading || saving) && <ActivityIndicator style={{ marginVertical: 12 }} />}

      {!!selectedPageId && !loading && (
        <>
          <Text style={styles.sectionLabel}>Blocks (long press to reorder)</Text>
          <DraggableFlatList
            data={blocks}
            keyExtractor={(item, idx) => String(item._id || `${item.type}-${idx}`)}
            onDragEnd={handleDragEnd}
            renderItem={renderItem}
            scrollEnabled={false}
          />

          <Text style={styles.sectionLabel}>Add block</Text>
          <View style={styles.addBtnRow}>
            {BLOCK_TYPES.map((t) => (
              <TouchableOpacity key={t} style={styles.addBtn} onPress={() => openNew(t)}>
                <Text style={styles.addBtnText}>+ {t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {form && (
            <View style={styles.editPanel}>
              <Text style={styles.editPanelTitle}>{editingIndex === -1 ? 'Add block' : 'Edit block'}</Text>

              <Text style={styles.fieldLabel}>Type</Text>
              <View style={styles.pickerBorder}>
                <Picker
                  selectedValue={form.type}
                  onValueChange={(v) => setForm({ ...form, type: String(v) })}
                >
                  {BLOCK_TYPES.map((t) => (
                    <Picker.Item key={t} label={t} value={t} />
                  ))}
                </Picker>
              </View>

              <Field
                label="Title (config.title)"
                value={String(form.config?.title || '')}
                onChange={(v) => setForm({ ...form, config: { ...(form.config || {}), title: v } })}
              />

              <Field
                label="Collection ID (dataSource.collectionId)"
                value={String(form.dataSource?.collectionId || '')}
                onChange={(v) => setForm({ ...form, dataSource: { ...(form.dataSource || {}), collectionId: v } })}
                placeholder="Paste a Collection _id (or keep empty)"
              />

              <View style={styles.editBtns}>
                <TouchableOpacity style={styles.saveBtnPrimary} onPress={saveEdit} disabled={saving}>
                  <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setEditingIndex(null); setForm(null); }}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                {editingIndex != null && editingIndex >= 0 && (
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => removeBlock(editingIndex)}>
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </>
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
  content: { padding: 14, paddingBottom: 40 },
  pickerCard: { backgroundColor: '#FFF', borderRadius: 10, borderWidth: 0.5, borderColor: '#E5E5E5', padding: 12, marginBottom: 12 },
  pickerLabel: { fontSize: 11, color: '#888', marginBottom: 4 },
  pickerBorder: { borderWidth: 0.5, borderColor: '#CCC', borderRadius: 8, overflow: 'hidden' },
  picker: { height: 48 },
  pickerHint: { marginTop: 8, fontSize: 11, color: '#666' },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
  blockRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderWidth: 0.5, borderColor: '#E5E5E5', borderRadius: 8, marginBottom: 6, backgroundColor: '#FFF' },
  blockRowActive: { opacity: 0.7, transform: [{ scale: 1.01 }] },
  dragHandle: { fontSize: 14, color: '#AAA', marginRight: 8 },
  blockTitle: { fontSize: 12, fontWeight: '700', color: '#1A1A1A' },
  blockSub: { fontSize: 10, color: '#888', marginTop: 2 },
  addBtnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  addBtn: { borderWidth: 0.5, borderColor: '#CCC', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#FFF' },
  addBtnText: { fontSize: 11, color: '#333', fontWeight: '700' },
  editPanel: { backgroundColor: '#FFF', borderWidth: 0.5, borderColor: '#E5E5E5', borderRadius: 12, padding: 14, marginTop: 4 },
  editPanelTitle: { fontSize: 13, fontWeight: '700', color: '#1A1A1A', marginBottom: 12 },
  fieldWrap: { marginBottom: 10 },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: '#666', marginBottom: 4 },
  fieldInput: { borderWidth: 0.5, borderColor: '#CCC', borderRadius: 8, padding: 10, fontSize: 13, color: '#1A1A1A' },
  editBtns: { flexDirection: 'row', gap: 8, marginTop: 8 },
  saveBtnPrimary: { flex: 1, backgroundColor: '#1A1A1A', borderRadius: 8, padding: 12, alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  cancelBtn: { flex: 1, borderWidth: 0.5, borderColor: '#CCC', borderRadius: 8, padding: 12, alignItems: 'center' },
  cancelBtnText: { fontSize: 13, color: '#333', fontWeight: '700' },
  deleteBtn: { borderWidth: 0.5, borderColor: '#A32D2D', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, alignItems: 'center' },
  deleteBtnText: { fontSize: 13, color: '#A32D2D', fontWeight: '700' },
});

