import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import Toast from 'react-native-toast-message';
import { getHomeConfig, saveHomeConfig, type HomeConfig } from '@/services/adminCms/adminCmsService';

export default function HomeConfigTab() {
  const [form, setForm] = useState<HomeConfig>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cfg = await getHomeConfig();
        if (mounted) setForm(cfg || {});
      } catch (e: any) {
        Toast.show({ type: 'error', text1: e?.message || 'Failed to load home config' });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const saved = await saveHomeConfig(form);
      setForm(saved || form);
      Toast.show({ type: 'success', text1: 'Home config saved' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.message || 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const fields: Array<{ key: keyof HomeConfig; label: string; hint: string }> = [
    { key: 'heroVideoUrl', label: 'Hero Video URL', hint: 'Autoplay video behind homepage hero' },
    { key: 'searchPlaceholder', label: 'Search Placeholder', hint: 'Text inside the search bar' },
    { key: 'deliveryTypeLabel', label: 'Delivery Label', hint: 'e.g. Delivered in 10 mins' },
    { key: 'organicTagline', label: 'Organic Tagline', hint: 'e.g. 100% Farm Fresh & Organic' },
    { key: 'organicIconUrl', label: 'Tagline Icon URL', hint: 'S3 URL to small icon beside tagline' },
    { key: 'categorySectionTitle', label: 'Category Section Title', hint: 'e.g. Shop by Category' },
  ];

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.infoBar}>
        <Text style={styles.infoText}>
          These fields are returned by the customer Bootstrap API and read by the app on open.
        </Text>
      </View>

      <View style={styles.card}>
        {fields.map((f) => (
          <View key={String(f.key)} style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>{f.label}</Text>
            <TextInput
              style={styles.fieldInput}
              value={(form[f.key] as any) || ''}
              onChangeText={(v) => setForm({ ...form, [f.key]: v })}
              placeholder={f.hint}
              placeholderTextColor="#BBB"
              autoCapitalize="none"
            />
            <Text style={styles.fieldHint}>{f.hint}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
        <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Home Config'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { padding: 14, paddingBottom: 40, gap: 12 },
  infoBar: { backgroundColor: '#E6F1FB', borderRadius: 8, borderWidth: 0.5, borderColor: '#B5D4F4', padding: 10 },
  infoText: { fontSize: 12, color: '#185FA5', lineHeight: 18 },
  card: { backgroundColor: '#FFF', borderRadius: 12, borderWidth: 0.5, borderColor: '#E5E5E5', padding: 14 },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#555', marginBottom: 5 },
  fieldInput: { borderWidth: 0.5, borderColor: '#CCC', borderRadius: 8, padding: 10, fontSize: 13, color: '#1A1A1A' },
  fieldHint: { fontSize: 10, color: '#AAA', marginTop: 3 },
  saveBtn: { backgroundColor: '#1A1A1A', borderRadius: 10, padding: 14, alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});

