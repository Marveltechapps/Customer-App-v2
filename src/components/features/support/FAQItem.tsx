import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import ChevronDownIcon from '@/assets/images/chevron-down.svg';
import ChevronUpIcon from '@/assets/images/chevron-up.svg';

interface FAQItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onPress: () => void;
}

const FAQItem: React.FC<FAQItemProps> = ({ question, answer, isOpen, onPress }) => {
  const animatedHeight = useRef(new Animated.Value(0)).current;
  const animatedOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOpen) {
      // Expand animation - using spring for smoother 60fps motion
      Animated.parallel([
        Animated.spring(animatedHeight, {
          toValue: 1,
          tension: 65, // Lower = slower, Higher = faster (default: 40)
          friction: 11, // Lower = bouncier, Higher = less bouncy (default: 7)
          useNativeDriver: false, // Required for maxHeight
        }),
        Animated.timing(animatedOpacity, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.ease), // Smooth ease-out curve
          useNativeDriver: false, // Must match - cannot mix native and JS drivers on same node
        }),
      ]).start();
    } else {
      // Collapse animation - using spring for smoother 60fps motion
      Animated.parallel([
        Animated.spring(animatedHeight, {
          toValue: 0,
          tension: 80, // Faster collapse
          friction: 12, // Less bouncy for collapse
          useNativeDriver: false, // Required for maxHeight
        }),
        Animated.timing(animatedOpacity, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.ease), // Smooth ease-in curve
          useNativeDriver: false, // Must match - cannot mix native and JS drivers on same node
        }),
      ]).start();
    }
  }, [isOpen, animatedHeight, animatedOpacity]);

  const maxHeight = animatedHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 500], // Max height for answer content
  });

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.questionRow}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.questionTextContainer}>
          <Text style={styles.question}>{question}</Text>
        </View>
        <View style={styles.iconContainer}>
          {isOpen ? (
            <ChevronUpIcon width={20} height={20} />
          ) : (
            <ChevronDownIcon width={20} height={20} />
          )}
        </View>
      </TouchableOpacity>
      <Animated.View
        style={[
          styles.answerContainer,
          {
            maxHeight: maxHeight,
            opacity: animatedOpacity,
            overflow: 'hidden',
          },
        ]}
      >
        <View style={styles.answerContent}>
          <Text style={styles.answer}>{answer}</Text>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#D1D1D1',
  },
  questionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 4,
  },
  questionTextContainer: {
    flex: 1,
    paddingRight: 8,
  },
  question: {
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 20,
    color: '#1A1A1A',
    textAlign: 'left',
  },
  iconContainer: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  answerContainer: {
    width: '100%',
    paddingTop: 8,
  },
  answerContent: {
    width: '100%',
  },
  answer: {
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 20,
    color: '#2C2C2C',
    textAlign: 'left',
  },
});

export default FAQItem;

