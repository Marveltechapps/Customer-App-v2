import React, { useState, useEffect } from 'react';
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
import { logger } from '@/utils/logger';
import GeneralInfoItem from '../components/GeneralInfoItem';

// Dummy static data - Replace with API call later
interface GeneralInfoItemData {
  id: string;
  title: string;
  icon?: string;
}

const DUMMY_GENERAL_INFO_ITEMS: GeneralInfoItemData[] = [
  {
    id: '1',
    title: 'Terms & Conditions',
  },
  {
    id: '2',
    title: 'Privacy Policy',
  },
];

const GeneralInfo: React.FC = () => {
  const navigation = useNavigation<GeneralInfoStackNavigationProp>();
  const [generalInfoItems, setGeneralInfoItems] = useState<GeneralInfoItemData[]>([]);
  const [loading, setLoading] = useState(false);

  // Placeholder for API call - Replace with actual API later
  useEffect(() => {
    const fetchGeneralInfoItems = async () => {
      setLoading(true);
      try {
        // TODO: Replace with actual API call
        // const response = await fetch('/api/general-info');
        // const data = await response.json();
        // setGeneralInfoItems(data.items);

        // Using dummy data for now
        setGeneralInfoItems(DUMMY_GENERAL_INFO_ITEMS);
      } catch (error) {
        logger.error('Error fetching general info items', error);
        // Fallback to dummy data
        setGeneralInfoItems(DUMMY_GENERAL_INFO_ITEMS);
      } finally {
        setLoading(false);
      }
    };

    fetchGeneralInfoItems();
  }, []);

  const handleItemPress = (item: GeneralInfoItemData) => {
    if (item.title === 'Terms & Conditions') {
      navigation.navigate('TermsAndConditions');
    } else if (item.title === 'Privacy Policy') {
      navigation.navigate('PrivacyPolicy');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Header title="General Info" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.itemsContainer}>
          {loading ? (
            <Text style={styles.loadingText}>Loading...</Text>
          ) : generalInfoItems.length > 0 ? (
            generalInfoItems.map((item) => (
              <View key={item.id} style={styles.itemWrapper}>
                <GeneralInfoItem
                  title={item.title}
                  onPress={() => handleItemPress(item)}
                />
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No items available</Text>
          )}
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
  itemsContainer: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    gap: 8,
  },
  itemWrapper: {
    width: '100%',
    marginBottom: 8,
  },
  loadingText: {
    fontWeight: '400',
    fontSize: 14,
    color: '#828282',
    textAlign: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    fontWeight: '400',
    fontSize: 14,
    color: '#828282',
    textAlign: 'center',
    paddingVertical: 20,
  },
});

export default GeneralInfo;

