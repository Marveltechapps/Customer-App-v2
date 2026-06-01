import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import ChatIcon from '@/assets/images/chat-icon.svg';

interface SupportCardProps {
  onChatPress?: () => void;
}

const SupportCard: React.FC<SupportCardProps> = ({ onChatPress }) => {
  return (
    <View style={styles.container}>
      <View style={styles.innerColumn}>
        <View style={styles.iconTextRow}>
          <View style={styles.iconContainer}>
            <ChatIcon width={40} height={40} />
          </View>
          <View style={styles.textSection}>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>Need help with this order?</Text>
            </View>
            <View style={styles.messageContainer}>
              <Text style={styles.message}>
                Chat with us now — we're just a tap away
              </Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={styles.button}
          onPress={onChatPress}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Chat now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderWidth: 0.6,
    borderColor: '#F4F4F4',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: '100%',
  },
  innerColumn: {
    width: '100%',
  },
  iconTextRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textSection: {
    flex: 1,
    marginLeft: 8,
  },
  titleContainer: {
    width: '100%',
    marginBottom: 4,
  },
  title: {
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 20, // 1.4285714285714286em = ~20px
    color: '#1A1A1A',
    textAlign: 'left',
  },
  messageContainer: {
    width: '100%',
    marginTop: 4,
  },
  message: {
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 16, // 1.3333333333333333em = ~16px
    color: '#828282',
    textAlign: 'left',
  },
  button: {
    backgroundColor: '#3F723F',
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  buttonText: {
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 18,
    color: '#FFFFFF',
    textAlign: 'center',
  },
});

export default SupportCard;

