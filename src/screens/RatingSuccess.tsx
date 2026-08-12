import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SuccessBackground from '../assets/images/success-background.svg';
import SuccessIconContainer from '../assets/images/success-icon-container.svg';
import { useResponsive, scaleFont } from '../utils/responsive';

interface RatingSuccessProps {
  visible: boolean;
  onClose?: () => void;
  onDone?: () => void;
}

/** Design reference: 350×163 background pattern, content padding-top at 82px. */
const DESIGN_CARD_WIDTH = 350;
const DESIGN_BG_HEIGHT = 163;
const DESIGN_CONTENT_TOP = 82;

const RatingSuccess: React.FC<RatingSuccessProps> = ({
  visible,
  onClose,
  onDone,
}) => {
  const { width: screenWidth } = useResponsive();
  const cardWidth = Math.min(screenWidth - 40, DESIGN_CARD_WIDTH);
  const bgHeight = (cardWidth / DESIGN_CARD_WIDTH) * DESIGN_BG_HEIGHT;
  const contentTop = (cardWidth / DESIGN_CARD_WIDTH) * DESIGN_CONTENT_TOP;

  const handleDone = () => {
    if (onDone) {
      onDone();
    } else if (onClose) {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <StatusBar barStyle="light-content" />
        <View style={[styles.modalContainer, { width: cardWidth }]}>
          <View style={[styles.backgroundContainer, { height: bgHeight }]}>
            <SuccessBackground width="100%" height="100%" preserveAspectRatio="xMidYMid slice" />
          </View>
          
          <View style={[styles.contentContainer, { paddingTop: contentTop }]}>
            <View style={styles.iconContainer}>
              <SuccessIconContainer width={122} height={122} />
            </View>
            
            <View style={styles.messageContainer}>
              <View style={styles.titleContainer}>
                <Text style={[styles.title, { fontSize: scaleFont(20, 18, 24) }]}>Successful !</Text>
              </View>
              <Text style={styles.subtitle}>Thanks for your feedback</Text>
            </View>
            
            <TouchableOpacity
              style={styles.doneButton}
              onPress={handleDone}
              activeOpacity={0.7}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    maxWidth: 350,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
  },
  backgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 24,
    paddingHorizontal: 40,
    gap: 16,
  },
  iconContainer: {
    width: 122,
    height: 122,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageContainer: {
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  titleContainer: {
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '500',
    lineHeight: 28,
    color: '#1A1A1A',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    color: '#818181',
    textAlign: 'center',
  },
  doneButton: {
    width: '100%',
    maxWidth: 201,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#034703',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.31,
    shadowRadius: 4,
    elevation: 4,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    color: '#034703',
  },
});

export default RatingSuccess;

