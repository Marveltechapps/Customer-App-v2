import React from 'react';
import { View, StyleSheet, Image, TouchableOpacity, ImageSourcePropType } from 'react-native';
import Text from '../../common/Text';

interface SearchSuggestionItemProps {
  id: string;
  name: string;
  image: ImageSourcePropType;
  onPress?: () => void;
}

export default function SearchSuggestionItem({ 
  name, 
  image, 
  onPress 
}: SearchSuggestionItemProps) {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.imageContainer}>
        <Image
          source={image}
          style={styles.image}
          resizeMode="cover"
        />
      </View>
      <Text style={styles.name}>{name}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 10.5,
    paddingLeft: 8,
    borderRadius: 10.5,
    paddingVertical: 0,
  },
  imageContainer: {
    width: 40,
    height: 40,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    flexShrink: 0,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  name: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    color: '#222222r',
    flex: 1,
  },
});

