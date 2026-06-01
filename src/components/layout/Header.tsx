import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import BackButtonIcon from '../../assets/images/back-button.svg';

interface HeaderProps {
  title: string;
  onBackPress?: () => void;
  showBackButton?: boolean; // Explicitly control back button visibility
  titleStyle?: {
    fontSize?: number;
    color?: string;
  };
  itemCount?: string;
  onAddMorePress?: () => void;
}

const Header: React.FC<HeaderProps> = ({ title, onBackPress, showBackButton: showBackButtonProp, titleStyle, itemCount, onAddMorePress }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  // If showBackButton is explicitly set to false, hide it. Otherwise, show it if onBackPress is provided or navigation can go back
  const showBackButton = showBackButtonProp !== undefined 
    ? showBackButtonProp 
    : (onBackPress !== undefined || navigation.canGoBack());

  return (
    <View style={styles.container}>
      {showBackButton && (
        <>
          <TouchableOpacity 
            onPress={handleBackPress} 
            style={styles.backButton} 
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Back button"
          >
            <View style={styles.iconContainer} pointerEvents="none">
              <BackButtonIcon width={24} height={24} />
            </View>
          </TouchableOpacity>
          <View style={styles.spacer} />
        </>
      )}
      <View style={styles.titleContainer}>
        <Text style={[
          styles.title,
          titleStyle && {
            fontSize: titleStyle.fontSize,
            color: titleStyle.color,
          },
        ]}>{title}</Text>
        {itemCount && (
          <Text style={styles.itemCount}>{itemCount}</Text>
        )}
      </View>
      {onAddMorePress && (
        <TouchableOpacity
          style={styles.addMoreButton}
          onPress={onAddMorePress}
          activeOpacity={0.7}
        >
          <Text style={styles.addMoreButtonText}>+ Add More</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    width: '100%',
  },
  backButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 44,
    height: 44,
    minWidth: 44,
    minHeight: 44,
  },
  iconContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spacer: {
    width: 8,
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 0,
  },
  title: {
    fontWeight: '600',
    fontSize: 20,
    lineHeight: 28, // 1.4em = 28px
    color: '#1A1A1A',
    textAlign: 'left',
  },
  itemCount: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B6B6B',
    lineHeight: 16,
    marginTop: 0,
  },
  addMoreButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#034703',
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  addMoreButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#034703',
    lineHeight: 20,
  },
});

export default Header;

