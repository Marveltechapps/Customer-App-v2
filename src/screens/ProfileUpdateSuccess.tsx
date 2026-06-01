import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import SuccessIconContainer from '../assets/images/success-icon-container.svg';
import SuccessBackground from '../assets/images/success-background.svg';
import { logger } from '@/utils/logger';

interface ProfileUpdateSuccessProps {
  visible: boolean;
  onDone?: () => void;
}

const ProfileUpdateSuccess: React.FC<ProfileUpdateSuccessProps> = ({
  visible,
  onDone,
}) => {
  const handleDone = () => {
    if (onDone) {
      onDone();
    } else {
      logger.info('Done pressed');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleDone}
    >
      <StatusBar barStyle="dark-content" backgroundColor="rgba(0, 0, 0, 0.5)" />
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Decorative Background Pattern */}
          <View style={styles.backgroundPatternContainer}>
            <SuccessBackground width={350} height={163} />
          </View>
          
          {/* Content Section - Column layout, center aligned */}
          <View style={styles.contentSection}>
            {/* Icon Container - White circle background with centered tick icon */}
            <View style={styles.iconContainer}>
              <SuccessIconContainer width={122} height={122} />
            </View>
            
            {/* Message Container - Column, center aligned, gap: 16px */}
            <View style={styles.messageContainer}>
              {/* Message - Column, center aligned, gap: 12px */}
              <View style={styles.messageContent}>
                {/* Title Container - Column, center justified, center aligned, gap: 8px */}
                <View style={styles.titleContainer}>
                  {/* Title - Row, center aligned */}
                  <View style={styles.titleWrapper}>
                    <Text style={styles.title}>Successful !</Text>
                  </View>
                </View>
                {/* Subtitle */}
                <Text style={styles.subtitle}>Your profile has been updated</Text>
              </View>
              
              {/* Button Container - gap: 16px from message, padding: 6px 10px, gap: 10px */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.button}
                  onPress={handleDone}
                  activeOpacity={0.8}
                >
                  {/* Button - Row, center justified, center aligned, gap: 2px, stretch */}
                  <View style={styles.buttonInner}>
                    <Text style={styles.buttonText}>Done</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: 350,
    height: 368,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  backgroundPatternContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 350,
    height: 163,
  },
  contentSection: {
    position: 'absolute',
    top: 82,
    left: 62,
    flexDirection: 'column',
    alignItems: 'center',
    width: 226, // 350 - (62 * 2) = 226
  },
  iconContainer: {
    width: 122,
    height: 122,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 0,
  },
  messageContainer: {
    width: '100%',
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: 0,
  },
  messageContent: {
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 16, // Gap: 16px between message content and button container
  },
  titleContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12, // Gap: 12px between title container and subtitle
  },
  titleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontFamily: 'Inter',
    fontWeight: '500',
    fontSize: 20,
    lineHeight: 28, // 1.4em = 28px
    color: '#1A1A1A',
    textAlign: 'left',
  },
  subtitle: {
    fontFamily: 'Inter',
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 24, // 1.5em = 24px
    color: '#818181',
    textAlign: 'center',
  },
  buttonContainer: {
    width: 201,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#034703',
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(1, 21, 1, 0.05)',
  },
  button: {
    width: '100%',
    alignSelf: 'stretch',
  },
  buttonInner: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 24,
  },
  buttonText: {
    fontFamily: 'Inter',
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 24, // 1.5em = 24px
    color: '#034703',
    textAlign: 'center',
  },
});

export default ProfileUpdateSuccess;

