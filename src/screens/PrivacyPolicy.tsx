import React, { useState, useCallback } from 'react';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { GeneralInfoStackNavigationProp } from '../types/navigation';
import Header from '../components/layout/Header';
import LegalContentRenderer from '../components/common/LegalContentRenderer';
import { getPrivacy } from '../services/legal/legalService';
import type { LegalDocumentData } from '../services/legal/legalService';
import { logger } from '@/utils/logger';

const FALLBACK_PRIVACY = `Privacy Policy content is loaded from the server. If you see this, the request may have failed or content is not configured.`;
const FALLBACK_TITLE = 'Privacy Policy';

const PrivacyPolicy: React.FC = () => {
  const navigation = useNavigation<GeneralInfoStackNavigationProp>();
  const [title, setTitle] = useState<string>(FALLBACK_TITLE);
  const [doc, setDoc] = useState<LegalDocumentData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPrivacy = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPrivacy();
      if (res.success && res.data) {
        setTitle(res.data.title || FALLBACK_TITLE);
        setDoc(res.data);
      } else {
        setDoc({ content: FALLBACK_PRIVACY, contentFormat: 'plain', title: FALLBACK_TITLE, version: '', effectiveDate: '', lastUpdated: '' });
      }
    } catch (err) {
      logger.error('Error fetching privacy content', err);
      setDoc({ content: FALLBACK_PRIVACY, contentFormat: 'plain', title: FALLBACK_TITLE, version: '', effectiveDate: '', lastUpdated: '' });
    } finally {
      setLoading(false);
    }
  }, []);

  useRefreshOnFocus(() => {
    void fetchPrivacy();
  }, [fetchPrivacy]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Header title={title} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentContainer}>
          {loading ? (
            <Text style={styles.loadingText}>Loading...</Text>
          ) : doc ? (
            <>
              {doc.lastUpdated ? (
                <Text style={styles.lastUpdatedText}>Last updated: {doc.lastUpdated}</Text>
              ) : null}
              <LegalContentRenderer content={doc.content} contentFormat={doc.contentFormat} />
            </>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  contentContainer: {
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  loadingText: {
    fontWeight: '400',
    fontSize: 14,
    color: '#828282',
    textAlign: 'center',
    paddingVertical: 20,
  },
  lastUpdatedText: {
    fontSize: 12,
    color: '#828282',
    marginBottom: 8,
  },
});

export default PrivacyPolicy;

