import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import ChevronDownIcon from '@/assets/images/chevron-down.svg';

interface HelpItemProps {
  title: string;
  onPress?: () => void;
}

const HelpItem: React.FC<HelpItemProps> = ({ title, onPress }) => {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Text style={styles.text}>{title}</Text>
        </View>
        <View style={styles.iconContainer}>
          <ChevronDownIcon width={20} height={20} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    minHeight: 20,
  },
  textContainer: {
    flex: 1,
  },
  iconContainer: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 20, // 1.4285714285714286em = ~20px
    color: '#4C4C4C',
    textAlign: 'left',
  },
});

export default HelpItem;

