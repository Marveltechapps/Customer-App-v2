import React, { useState, useEffect } from 'react';
import { View, StyleSheet, StatusBar, Platform, ScrollView, TextInput, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { RootStackNavigationProp } from '../types/navigation';
import BackIcon from '../components/icons/BackIcon';
import Text from '../components/common/Text';
import SearchSuggestionItem from '../components/features/search/SearchSuggestionItem';
import { logger } from '@/utils/logger';
import * as productService from '../services/products/productService';
import { getProductImageSource } from '../utils/productImage';

interface SearchItem {
  id: string;
  name: string;
  image: any;
  category?: string;
}

interface SearchScreenProps {
  fetchSearchData?: (query: string) => Promise<SearchItem[]>;
  onItemPress?: (item: SearchItem) => void;
}

export default function SearchScreen({ 
  fetchSearchData, 
  onItemPress 
}: SearchScreenProps) {
  const navigation = useNavigation<RootStackNavigationProp>();
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const query = searchText.trim();
    if (query.length === 0) {
      setSearchResults([]);
      setLoading(false);
      return;
    }
    const performSearch = async () => {
      setLoading(true);
      try {
        if (fetchSearchData) {
          const results = await fetchSearchData(searchText);
          setSearchResults(results);
        } else if (query.length < 2) {
          const resp = await productService.searchProductSuggestions(query);
          const items = productService.productsFromListResponse(resp);
          const mapped: SearchItem[] = items.map((p) => ({
            id: String(p.id ?? (p as { _id?: string })._id ?? ''),
            name: p.name ?? '',
            image: getProductImageSource(p),
            category: p.categoryName,
          }));
          setSearchResults(mapped);
        } else {
          const resp = await productService.searchProducts(query);
          const items = productService.productsFromListResponse(resp);
          const mapped: SearchItem[] = items.map((p) => ({
            id: String(p.id ?? (p as { _id?: string })._id ?? ''),
            name: p.name ?? '',
            image: getProductImageSource(p),
            category: p.categoryName,
          }));
          setSearchResults(mapped);
        }
      } catch (error) {
        logger.error('Error fetching search data', error);
        setSearchResults([]);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(performSearch, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchText, fetchSearchData]);

  const handleBack = () => {
    navigation.goBack();
  };

  const handleClear = () => {
    setSearchText('');
    setSearchResults([]);
  };

  const handleItemPress = (item: SearchItem) => {
    if (onItemPress) {
      onItemPress(item);
    } else {
      // Navigate to search results page with the search query
      navigation.navigate('SearchResults', { query: item.name });
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F5F5" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            {/* Search Container */}
            <View style={styles.searchContainer}>
              {/* Back Button */}
              <TouchableOpacity
                style={styles.backButton}
                onPress={handleBack}
                activeOpacity={0.7}
              >
                <BackIcon />
              </TouchableOpacity>

              {/* Text Input */}
              <View style={styles.textInputContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search products..."
                  placeholderTextColor="#828282"
                  value={searchText}
                  onChangeText={setSearchText}
                  autoFocus
                  returnKeyType="search"
                  textAlignVertical="center"
                  numberOfLines={1}
                />
              </View>

              {/* Clear Button */}
              {searchText.length > 0 && (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={handleClear}
                  activeOpacity={0.7}
                >
                  <View style={styles.clearButtonIcon}>
                    <Text style={styles.clearButtonText}>✕</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>

            {/* Search Suggestions or Empty State */}
            {searchText.trim().length === 0 ? (
              /* Empty State Text Container */
              <View style={styles.emptyStateContainer}>
                <View style={styles.textContainer}>
                  <Text style={styles.emptyStateTitle}>
                    Start typing to search for products
                  </Text>
                </View>
                <View style={styles.subtitleContainer}>
                  <Text style={styles.emptyStateSubtitle}>
                    Search by name, category, or keywords
                  </Text>
                </View>
              </View>
            ) : (
              /* Search Suggestions List */
              <View style={styles.suggestionsContainer}>
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Searching...</Text>
                  </View>
                ) : searchResults.length > 0 ? (
                  searchResults.map((item) => (
                    <SearchSuggestionItem
                      key={item.id}
                      id={item.id}
                      name={item.name}
                      image={item.image}
                      onPress={() => handleItemPress(item)}
                    />
                  ))
                ) : (
                  <View style={styles.noResultsContainer}>
                    <Text style={styles.noResultsText}>No results found</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
    gap: 12,
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center', // Center all items vertically
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderRadius: 8.5,
    paddingHorizontal: 12,
    paddingVertical: 0, // Remove vertical padding to use alignItems: center
    minHeight: 48,
    height: 48,
  },
  backButton: {
    width: 32,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  textInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', // Center content vertically
    gap: 4,
    alignSelf: 'center',
    height: '100%', // Full height of parent container
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18, // Slightly larger than fontSize (14 * 1.28 ≈ 18)
    color: '#3B3B3B',
    paddingHorizontal: 0, // Horizontal padding handled by container
    paddingVertical: 0, // No vertical padding for perfect centering
    margin: 0,
    textAlign: 'left',
    textAlignVertical: 'center', // Vertically center text
    includeFontPadding: false, // Remove extra font padding
  },
  clearButton: {
    width: 32,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  clearButtonIcon: {
    width: 17.5,
    height: 17.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 18,
    color: '#828282',
    fontFamily: 'Inter',
    lineHeight: 17.5,
  },
  suggestionsContainer: {
    width: '100%',
    alignSelf: 'stretch',
    gap: 4,
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '400',
    color: '#212121',
  },
  noResultsContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  noResultsText: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '400',
    color: '#212121',
  },
  emptyStateContainer: {
    width: '100%',
    alignSelf: 'stretch',
    gap: 4,
    height: 48.58,
  },
  textContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 10,
  },
  emptyStateTitle: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    color: '#212121',
    textAlign: 'center',
  },
  subtitleContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 10,
    paddingHorizontal: 2,
  },
  emptyStateSubtitle: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
    color: '#212121',
    textAlign: 'center',
  },
});

