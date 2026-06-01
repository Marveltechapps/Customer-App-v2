import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { LocationStackNavigationProp } from '../../types/navigation';
import Header from '../../components/layout/Header';
import ClearIcon from '../../assets/images/clear-icon.svg';
import MapPinIcon from '../../assets/images/map-pin.svg';
import { logger } from '@/utils/logger';

// Dummy static data - Replace with API call later
interface SearchResult {
  id: string;
  title: string;
  address: string;
}

const DUMMY_SEARCH_RESULTS: SearchResult[] = [
  {
    id: '1',
    title: 'T. Nagar',
    address:
      'Pondy Bazaar, Sir Thyagaraya Road, Parthasarathi Puram, T. Nagar, Chennai, Tamil Nadu, India',
  },
  {
    id: '2',
    title: 'T. Nagar',
    address:
      'Pondy Bazaar, Sir Thyagaraya Road, Parthasarathi Puram, T. Nagar, Chennai, Tamil Nadu, India',
  },
];

const LocationSearchResults: React.FC = () => {
  const navigation = useNavigation<LocationStackNavigationProp>();
  const route = useRoute();
  const searchQuery = (route.params as { searchQuery?: string })?.searchQuery || '';
  const [query, setQuery] = useState(searchQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  // Placeholder for API call - Replace with actual API later
  useEffect(() => {
    const performSearch = async () => {
      if (query.length === 0) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        // TODO: Replace with actual API call
        // const response = await fetch(`/api/locations/search?q=${encodeURIComponent(query)}`);
        // const data = await response.json();
        // setResults(data.results);

        // Using dummy data for now
        setResults(DUMMY_SEARCH_RESULTS);
      } catch (error) {
        logger.error('Error searching locations', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(() => {
      performSearch();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [query]);

  const handleSearchChange = (text: string) => {
    setQuery(text);
    if (text.length === 0) {
      navigation.navigate('LocationSearch');
    } else {
      navigation.setParams({ searchQuery: text });
    }
  };

  const handleClear = () => {
    setQuery('');
    navigation.navigate('LocationSearch');
  };

  const handleResultPress = (result: SearchResult) => {
    navigation.navigate('MapAddressPin', { location: result });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Header title="Select your location" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentContainer}>
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search an area or address"
                placeholderTextColor="#6B6B6B"
                value={query}
                onChangeText={handleSearchChange}
              />
              {query.length > 0 && (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={handleClear}
                  activeOpacity={0.7}
                >
                  <ClearIcon width={16} height={16} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.resultsContainer}>
            {loading ? (
              <Text style={styles.loadingText}>Searching...</Text>
            ) : results.length > 0 ? (
              <View style={styles.resultsList}>
                {results.map((result, index) => (
                  <TouchableOpacity
                    key={result.id || index}
                    style={[
                      styles.resultItem,
                      index < results.length - 1 && styles.resultItemBorder,
                    ]}
                    onPress={() => handleResultPress(result)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.resultIconContainer}>
                      <MapPinIcon width={20} height={20} />
                    </View>
                    <View style={styles.resultTextContainer}>
                      <View style={styles.resultTitleContainer}>
                        <Text style={styles.resultTitle}>{result.title}</Text>
                      </View>
                      <View style={styles.resultAddressContainer}>
                        <Text style={styles.resultAddress}>{result.address}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : query.length > 0 ? (
              <View style={styles.noResultsContainer}>
                <Text style={styles.noResultsText}>No results found</Text>
              </View>
            ) : null}
          </View>
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
    gap: 20,
  },
  searchContainer: {
    width: '100%',
  },
  searchInputContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D1D1',
    borderRadius: 8.5,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 20, // 1.4285714285714286em
    color: '#1A1A1A',
  },
  clearButton: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultsContainer: {
    width: '100%',
  },
  resultsList: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D1D1',
    borderRadius: 10.5,
    padding: 1,
  },
  resultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 11,
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  resultItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#D1D1D1',
  },
  resultIconContainer: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultTextContainer: {
    flex: 1,
    gap: 4,
    width: 292.5,
  },
  resultTitleContainer: {
    width: '100%',
  },
  resultTitle: {
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 16,
    lineHeight: 24, // 1.5em
    color: '#1A1A1A',
    textAlign: 'left',
  },
  resultAddressContainer: {
    width: '100%',
  },
  resultAddress: {
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18, // 1.5em
    color: '#6B6B6B',
    textAlign: 'left',
  },
  loadingText: {
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 14,
    color: '#828282',
    textAlign: 'center',
    paddingVertical: 20,
  },
  noResultsContainer: {
    width: '100%',
    paddingVertical: 20,
    alignItems: 'center',
  },
  noResultsText: {
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
  },
});

export default LocationSearchResults;

