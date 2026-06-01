import React, { useEffect } from 'react';
import { View, StyleSheet, TextInput } from 'react-native';
import { useSharedElement } from '@/contexts/SharedElementContext';
import SharedElementTransition from './SharedElementTransition';
import SearchIcon from '../icons/SearchIcon';

/**
 * SharedElementOverlay Component
 * Renders the animated search bar during transition
 * Should be placed at the root level to overlay all screens
 */
export default function SharedElementOverlay() {
  const { startPosition, endPosition, isAnimating, reset } = useSharedElement();

  // Reset after animation completes
  useEffect(() => {
    if (isAnimating && startPosition && endPosition) {
      const timer = setTimeout(() => {
        reset();
      }, 350); // Slightly longer than animation duration

      return () => clearTimeout(timer);
    }
  }, [isAnimating, startPosition, endPosition, reset]);

  if (!isAnimating || !startPosition || !endPosition) {
    return null;
  }

  return (
    <View style={styles.overlay} pointerEvents="none">
      <SharedElementTransition
        startPosition={startPosition}
        endPosition={endPosition}
        duration={300}
        onAnimationComplete={() => {
          // Animation complete - will be reset by useEffect
        }}
      >
        <View style={styles.searchBarContainer}>
          <View style={styles.searchIconContainer}>
            <SearchIcon />
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Search for products..."
            placeholderTextColor="#6B6B6B"
            editable={false}
            pointerEvents="none"
          />
        </View>
      </SharedElementTransition>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    pointerEvents: 'none',
  },
  searchBarContainer: {
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
    width: '100%',
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

