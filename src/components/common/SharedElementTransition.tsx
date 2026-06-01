import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';

interface SharedElementTransitionProps {
  children: React.ReactNode;
  startPosition: { x: number; y: number; width: number; height: number } | null;
  endPosition: { x: number; y: number; width: number; height: number } | null;
  onAnimationComplete?: () => void;
  duration?: number;
  style?: ViewStyle;
}

/**
 * SharedElementTransition Component
 * Animates a component from startPosition to endPosition
 * Used for smooth transitions between screens
 */
export default function SharedElementTransition({
  children,
  startPosition,
  endPosition,
  onAnimationComplete,
  duration = 300,
  style,
}: SharedElementTransitionProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scaleX = useRef(new Animated.Value(1)).current;
  const scaleY = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!startPosition || !endPosition) {
      return;
    }

    // Calculate differences
    const deltaX = endPosition.x - startPosition.x;
    const deltaY = endPosition.y - startPosition.y;
    const scaleXValue = endPosition.width / startPosition.width;
    const scaleYValue = endPosition.height / startPosition.height;

    // Reset to start position
    translateX.setValue(0);
    translateY.setValue(0);
    scaleX.setValue(1);
    scaleY.setValue(1);
    opacity.setValue(1);

    // Animate to end position
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: deltaX,
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: deltaY,
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(scaleX, {
        toValue: scaleXValue,
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(scaleY, {
        toValue: scaleYValue,
        duration,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onAnimationComplete) {
        onAnimationComplete();
      }
    });
  }, [startPosition, endPosition, duration, translateX, translateY, scaleX, scaleY, onAnimationComplete]);

  if (!startPosition || !endPosition) {
    return <View style={style}>{children}</View>;
  }

  return (
    <Animated.View
      style={[
        style,
        {
          position: 'absolute',
          left: startPosition.x,
          top: startPosition.y,
          width: startPosition.width,
          height: startPosition.height,
          transform: [
            { translateX },
            { translateY },
            { scaleX },
            { scaleY },
          ],
          opacity,
          zIndex: 9999,
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

