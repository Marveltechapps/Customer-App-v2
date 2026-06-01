import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, ActivityIndicator } from 'react-native';
import Toast from 'react-native-toast-message';
import * as DocumentPicker from 'expo-document-picker';

import { uploadSkuMaster, uploadCmsPages, type AdminCmsUploadResult } from '@/services/adminCms/adminCmsService';

function UploadZone({
  label,
  sublabel,
  onUpload,
  maxMB,
}: {
  label: string;
  sublabel: string;
  maxMB: number;
  onUpload: (file: { uri: string; name: string; type?: string }) => Promise<AdminCmsUploadResult>;
}) {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<AdminCmsUploadResult | null>(null);

  const pickAndUpload = async () => {
    try {
      const selection = await DocumentPicker.getDocumentAsync({
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        copyToCacheDirectory: true,
      });
      if (selection.canceled || !selection.assets?.[0]) return;
      const file = selection.assets[0];

      if (!file?.name || !file.name.toLowerCase().endsWith('.xlsx')) {
        Toast.show({ type: 'error', text1: 'Only .xlsx files allowed' });
        return;
      }
      setUploading(true);
      setResult(null);

      const res = await onUpload({
        uri: file.uri,
        name: file.name,
        type: file.type ?? undefined,
      });
      setResult(res);
      Toast.show({
        type: res.success ? 'success' : 'error',
        text1: res.success ? 'Import complete!' : 'Import completed with issues',
      });
    } catch (err: any) {
      const msg = err?.message || 'Upload failed';
      setResult({ success: false, counts: {}, errors: [{ message: msg }] });
      Toast.show({ type: 'error', text1: msg });
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.uploadCard}>
      <Text style={styles.uploadLabel}>{label}</Text>
      <Text style={styles.uploadSub}>{sublabel}</Text>

      <TouchableOpacity style={styles.uploadZone} onPress={pickAndUpload} disabled={uploading}>
        <Text style={styles.uploadIcon}>📊</Text>
        <Text style={styles.uploadZoneTitle}>{uploading ? 'Uploading...' : 'Tap to pick .xlsx file'}</Text>
        <Text style={styles.uploadZoneSub}>.xlsx only · Max {maxMB}MB</Text>
        {uploading && <ActivityIndicator style={{ marginTop: 8 }} color="#1A1A1A" />}
      </TouchableOpacity>

      {result && (
        <>
          {result.success ? (
            <View style={styles.statusSuccess}>
              <Text style={styles.statusSuccessText}>
                ✓ Import complete — {result.errors?.length || 0} issue(s)
              </Text>
            </View>
          ) : (
            <View style={styles.statusError}>
              <Text style={styles.statusErrorText}>
                Import finished with {result.errors?.length || 0} issue(s)
              </Text>
            </View>
          )}

          {result.counts && Object.keys(result.counts).length > 0 && (
            <View style={styles.resultTable}>
              <View style={styles.resultHeader}>
                <Text style={[styles.resultCell, styles.resultHeaderText, { flex: 2 }]}>Sheet</Text>
                <Text style={[styles.resultCell, styles.resultHeaderText]}>Records</Text>
              </View>
              {Object.entries(result.counts).map(([k, v]) => (
                <View key={k} style={styles.resultRow}>
                  <Text style={[styles.resultCell, { flex: 2 }]}>{k}</Text>
                  <Text style={styles.resultCell}>{String(v)}</Text>
                </View>
              ))}
            </View>
          )}

          {Array.isArray(result.errors) && result.errors.length > 0 && (
            <View style={styles.errorBox}>
              <Text style={styles.errorBoxTitle}>{result.errors.length} issue(s):</Text>
              {result.errors.slice(0, 5).map((e, i) => (
                <Text key={i} style={styles.errorBoxItem}>
                  • {e.sheet || 'Sheet'}{e.row ? ` row ${e.row}` : ''}: {e.message}
                </Text>
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}

export default function UploadTab() {
  const [overwrite, setOverwrite] = useState(true);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.infoBar}>
        <Text style={styles.infoBarText}>
          Both mastersheets upload separately. SKU Mastersheet = product data. CMS Pages Mastersheet = pages + blocks +
          collections.
        </Text>
      </View>

      <UploadZone
        label="1 — SKU Mastersheet (.xlsx)"
        sublabel="Imports products + categories + hero banners"
        onUpload={(file) => uploadSkuMaster(file, overwrite)}
        maxMB={20}
      />
      <UploadZone
        label="2 — CMS Pages Mastersheet (.xlsx)"
        sublabel="Imports pages + blocks + collections"
        onUpload={uploadCmsPages}
        maxMB={10}
      />

      <View style={styles.rulesCard}>
        <Text style={styles.rulesTitle}>Import rules</Text>
        <View style={styles.ruleRow}>
          <View style={styles.ruleText}>
            <Text style={styles.ruleLabel}>Overwrite existing products</Text>
            <Text style={styles.ruleSub}>If SKU exists → replace with new data</Text>
          </View>
          <Switch value={overwrite} onValueChange={setOverwrite} />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12 },
  infoBar: { backgroundColor: '#E6F1FB', borderWidth: 0.5, borderColor: '#B5D4F4', borderRadius: 8, padding: 10 },
  infoBarText: { fontSize: 12, color: '#185FA5', lineHeight: 18 },
  uploadCard: { backgroundColor: '#FFF', borderWidth: 0.5, borderColor: '#E5E5E5', borderRadius: 12, padding: 14, gap: 8 },
  uploadLabel: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  uploadSub: { fontSize: 11, color: '#888' },
  uploadZone: { borderWidth: 1.5, borderColor: '#CCC', borderStyle: 'dashed', borderRadius: 10, padding: 24, alignItems: 'center' },
  uploadIcon: { fontSize: 28, marginBottom: 6, opacity: 0.4 },
  uploadZoneTitle: { fontSize: 13, fontWeight: '600', color: '#1A1A1A', marginBottom: 3 },
  uploadZoneSub: { fontSize: 11, color: '#888' },
  statusSuccess: { backgroundColor: '#EAF3DE', borderWidth: 0.5, borderColor: '#C0DD97', borderRadius: 8, padding: 8 },
  statusSuccessText: { fontSize: 12, color: '#3B6D11' },
  statusError: { backgroundColor: '#FCEBEB', borderWidth: 0.5, borderColor: '#F7C1C1', borderRadius: 8, padding: 8 },
  statusErrorText: { fontSize: 12, color: '#A32D2D' },
  resultTable: { borderWidth: 0.5, borderColor: '#E5E5E5', borderRadius: 8, marginTop: 8, overflow: 'hidden' },
  resultHeader: { flexDirection: 'row', backgroundColor: '#F5F5F5', padding: 6 },
  resultHeaderText: { fontWeight: '700', fontSize: 10, color: '#666', textTransform: 'uppercase' },
  resultRow: { flexDirection: 'row', padding: 6, borderTopWidth: 0.5, borderTopColor: '#E5E5E5', alignItems: 'center' },
  resultCell: { flex: 1, fontSize: 11, color: '#333' },
  errorBox: { backgroundColor: '#FFF3CD', borderRadius: 8, padding: 8, marginTop: 6 },
  errorBoxTitle: { fontSize: 11, fontWeight: '700', color: '#854F0B' },
  errorBoxItem: { fontSize: 11, color: '#854F0B', marginTop: 2 },
  rulesCard: { backgroundColor: '#FFF', borderWidth: 0.5, borderColor: '#E5E5E5', borderRadius: 12, padding: 14 },
  rulesTitle: { fontSize: 13, fontWeight: '700', color: '#1A1A1A', marginBottom: 10 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: '#F0F0F0' },
  ruleText: { flex: 1, marginRight: 12 },
  ruleLabel: { fontSize: 13, color: '#1A1A1A' },
  ruleSub: { fontSize: 11, color: '#888', marginTop: 2 },
});

