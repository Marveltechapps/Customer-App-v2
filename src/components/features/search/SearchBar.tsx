import React, { useState } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { RootStackNavigationProp } from '@/types/navigation';
import SearchIcon from '../../icons/SearchIcon';

interface SearchBarProps {
  placeholder?: string;
  onSearch?: (text: string) => void;
  onPress?: () => void;
}

export default function SearchBar({ 
  placeholder = 'Search for "Dal" ', 
  onSearch, 
  onPress,
}: SearchBarProps) {
  const navigation = useNavigation<RootStackNavigationProp>();
  const [searchText, setSearchText] = useState('');

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      navigation.navigate('Search');
    }
  };

  const handleTextChange = (text: string) => {
    setSearchText(text);
    if (onSearch) {
      onSearch(text);
    }
  };

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={1}>
      <View style={styles.searchInputContainer}>
        <View style={styles.searchIconContainer}>
          <SearchIcon />
        </View>
        <TextInput
          style={styles.searchInput}
          placeholder={placeholder}
          placeholderTextColor="#6B6B6B"
          value={searchText}
          onChangeText={handleTextChange}
          returnKeyType="search"
          editable={false}
          pointerEvents="none"
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D1D1',
    borderRadius: 8.5,
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 8,
    minHeight: 48,
    height: 48,
  },
  searchIconContainer: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    color: '#222222',
    padding: 0,
    margin: 0,
    textAlign: 'left',
  },
});

