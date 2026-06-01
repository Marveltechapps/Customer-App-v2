import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import OverviewTab from './tabs/OverviewTab';
import UploadTab from './tabs/UploadTab';
import CmsPagesTab from './tabs/CmsPagesTab';
import BlockEditorTab from './tabs/BlockEditorTab';
import BannersTab from './tabs/BannersTab';
import CollectionsTab from './tabs/CollectionsTab';
import HomeConfigTab from './tabs/HomeConfigTab';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'upload', label: 'Upload Sheet' },
  { id: 'pages', label: 'CMS Pages' },
  { id: 'blocks', label: 'Block Editor' },
  { id: 'banners', label: 'Banners' },
  { id: 'collections', label: 'Collections' },
  { id: 'homeconfig', label: 'Home Config' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function CmsScreen() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);

  const goToTab = (tabId: TabId, pageId: string | null = null) => {
    setActiveTab(tabId);
    if (pageId) setSelectedPageId(pageId);
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab onNavigate={goToTab} />;
      case 'upload':
        return <UploadTab />;
      case 'pages':
        return <CmsPagesTab onEditBlocks={(pageId) => goToTab('blocks', pageId)} />;
      case 'blocks':
        return <BlockEditorTab initialPageId={selectedPageId} />;
      case 'banners':
        return <BannersTab />;
      case 'collections':
        return <CollectionsTab />;
      case 'homeconfig':
        return <HomeConfigTab />;
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>CMS — Content Management</Text>
          <Text style={styles.headerSub}>Upload sheets · Manage pages · Edit blocks</Text>
        </View>
        <TouchableOpacity style={styles.btnPrimary} onPress={() => goToTab('pages')}>
          <Text style={styles.btnPrimaryText}>Pages</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScroll}
        >
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabItem, activeTab === tab.id && styles.tabItemActive]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.content}>{renderTab()}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5E5',
    gap: 12,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  headerSub: { fontSize: 12, color: '#888', marginTop: 2 },
  btnPrimary: { backgroundColor: '#1A1A1A', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  btnPrimaryText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  tabBar: { backgroundColor: '#FAFAFA', borderBottomWidth: 0.5, borderBottomColor: '#E5E5E5' },
  tabScroll: { paddingHorizontal: 4 },
  tabItem: { paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomColor: '#1A1A1A' },
  tabText: { fontSize: 13, color: '#888' },
  tabTextActive: { color: '#1A1A1A', fontWeight: '600' },
  content: { flex: 1 },
});

