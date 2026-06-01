import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';

interface ExploreNowCardProps {
  title?: string;
  description?: string;
  image?: string;
  onPress?: () => void;
}

const ExploreNowCard: React.FC<ExploreNowCardProps> = ({
  title = "Explore now",
  description = "Discover more products and offers",
  image,
  onPress,
}) => {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {image ? (
        <Image source={{ uri: image }} style={styles.backgroundImage} />
      ) : (
        <View style={styles.placeholderBackground} />
      )}
      <View style={styles.overlay} />
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 0,
    position: 'relative',
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    position: 'absolute',
  },
  placeholderBackground: {
    width: '100%',
    height: '100%',
    backgroundColor: '#034703',
    position: 'absolute',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 24,
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    fontWeight: '400',
    color: '#FFFFFF',
    lineHeight: 20,
    opacity: 0.9,
  },
});

export default ExploreNowCard;

