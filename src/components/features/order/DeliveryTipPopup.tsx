import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface DeliveryTipPopupProps {
  visible: boolean;
  currentTip?: number;
  onClose: () => void;
  onApply: (tip: number, isCustom: boolean) => void;
  /** Tip presets from app config; defaults to [20, 30, 50, 100] */
  tipPresets?: number[];
}

const DEFAULT_PRESET_TIPS = [20, 30, 50, 100];

const DeliveryTipPopup: React.FC<DeliveryTipPopupProps> = ({
  visible,
  currentTip,
  onClose,
  onApply,
  tipPresets = DEFAULT_PRESET_TIPS,
}) => {
  const presetTips = tipPresets?.length ? tipPresets : DEFAULT_PRESET_TIPS;
  const [selectedTip, setSelectedTip] = useState<number | null>(currentTip || null);
  const [customTip, setCustomTip] = useState('');
  const [isCustomSelected, setIsCustomSelected] = useState(false);

  const handlePresetTipPress = (tip: number) => {
    setSelectedTip(tip);
    setIsCustomSelected(false);
    setCustomTip('');
  };

  const handleCustomTipPress = () => {
    setIsCustomSelected(true);
    setSelectedTip(null);
  };

  const handleApply = () => {
    let tipAmount = 0;
    let isCustom = false;

    if (isCustomSelected && customTip) {
      tipAmount = parseFloat(customTip) || 0;
      isCustom = true;
    } else if (selectedTip !== null) {
      tipAmount = selectedTip;
      isCustom = false;
    }

    if (tipAmount > 0) {
      onApply(tipAmount, isCustom);
      onClose();
      // Reset state
      setSelectedTip(null);
      setCustomTip('');
      setIsCustomSelected(false);
    }
  };

  const handleCancel = () => {
    onClose();
    setSelectedTip(currentTip || null);
    setCustomTip('');
    setIsCustomSelected(false);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.header}>
              <Text style={styles.title}>Delivery Tip</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleCancel}
                activeOpacity={0.7}
              >
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.content}>
              <Text style={styles.subtitle}>Select or enter a custom tip amount</Text>

              <View style={styles.presetTipsContainer}>
                {presetTips.map((tip) => (
                  <TouchableOpacity
                    key={tip}
                    style={[
                      styles.tipButton,
                      selectedTip === tip && !isCustomSelected && styles.tipButtonSelected,
                    ]}
                    onPress={() => handlePresetTipPress(tip)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.tipButtonText,
                        selectedTip === tip &&
                          !isCustomSelected &&
                          styles.tipButtonTextSelected,
                      ]}
                    >
                      ₹{tip}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[
                    styles.tipButton,
                    styles.customTipButton,
                    isCustomSelected && styles.tipButtonSelected,
                  ]}
                  onPress={handleCustomTipPress}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.tipButtonText,
                      isCustomSelected && styles.tipButtonTextSelected,
                    ]}
                  >
                    Custom
                  </Text>
                </TouchableOpacity>
              </View>

              {isCustomSelected && (
                <View style={styles.customTipInputContainer}>
                  <Text style={styles.inputLabel}>Enter custom amount</Text>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.currencySymbol}>₹</Text>
                    <TextInput
                      style={styles.customTipInput}
                      value={customTip}
                      onChangeText={setCustomTip}
                      placeholder="0"
                      keyboardType="numeric"
                      placeholderTextColor="#828282"
                    />
                  </View>
                </View>
              )}

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancel}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.applyButton,
                    (!selectedTip && !isCustomSelected) ||
                      (isCustomSelected && !customTip) ||
                      (isCustomSelected && parseFloat(customTip) <= 0)
                      ? styles.applyButtonDisabled
                      : null,
                  ]}
                  onPress={handleApply}
                  activeOpacity={0.7}
                  disabled={
                    (!selectedTip && !isCustomSelected) ||
                    (isCustomSelected && !customTip) ||
                    (isCustomSelected && parseFloat(customTip) <= 0)
                  }
                >
                  <Text style={styles.applyButtonText}>Apply</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
    lineHeight: 28,
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 28,
    fontWeight: '300',
    color: '#828282',
    lineHeight: 32,
  },
  content: {
    gap: 20,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#828282',
    lineHeight: 20,
  },
  presetTipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tipButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    minWidth: 80,
    alignItems: 'center',
  },
  customTipButton: {
    flex: 1,
    minWidth: 100,
  },
  tipButtonSelected: {
    backgroundColor: '#034703',
    borderColor: '#034703',
  },
  tipButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
    lineHeight: 20,
  },
  tipButtonTextSelected: {
    color: '#FFFFFF',
  },
  customTipInputContainer: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
    lineHeight: 20,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
    marginRight: 8,
  },
  customTipInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
    height: '100%',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
    lineHeight: 20,
  },
  applyButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#034703',
    alignItems: 'center',
  },
  applyButtonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.5,
  },
  applyButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    lineHeight: 20,
  },
});

export default DeliveryTipPopup;

