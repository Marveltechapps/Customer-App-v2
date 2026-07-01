import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Header from '../components/layout/Header';

const RETURN_REASONS = [
  'Received wrong item',
  'Item damaged or defective',
  'Quality not as expected',
  'Item expired or near expiry',
  'Missing items from order',
  'Other',
];

const ReturnRequest: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const orderId = (route.params as { orderId?: string })?.orderId;

  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert('Select Reason', 'Please select a reason for the return.');
      return;
    }
    setSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 500));
      Alert.alert(
        'Request Submitted',
        'Your return request has been submitted. Our team will review it shortly.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch {
      Alert.alert('Error', 'Failed to submit return request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Header title="Return Item" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.formContainer}>
          {orderId && (
            <View style={styles.orderIdCard}>
              <Text style={styles.orderIdLabel}>Order</Text>
              <Text style={styles.orderIdValue}>#{orderId}</Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reason for Return</Text>
            {RETURN_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason}
                style={[
                  styles.reasonOption,
                  selectedReason === reason && styles.reasonOptionSelected,
                ]}
                onPress={() => setSelectedReason(reason)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.radioOuter,
                    selectedReason === reason && styles.radioOuterSelected,
                  ]}
                >
                  {selectedReason === reason && <View style={styles.radioInner} />}
                </View>
                <Text
                  style={[
                    styles.reasonText,
                    selectedReason === reason && styles.reasonTextSelected,
                  ]}
                >
                  {reason}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upload Photo (Optional)</Text>
            <TouchableOpacity
              style={styles.photoUploadButton}
              onPress={() =>
                Alert.alert('Coming Soon', 'Photo upload will be available in a future update.')
              }
              activeOpacity={0.7}
            >
              <Text style={styles.photoUploadText}>+ Add Photo</Text>
              <Text style={styles.photoUploadHint}>Helps us process your request faster</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, (!selectedReason || submitting) && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!selectedReason || submitting}
            activeOpacity={0.8}
          >
            <Text style={styles.submitButtonText}>
              {submitting ? 'Submitting...' : 'Submit Return Request'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  formContainer: {
    padding: 16,
    gap: 16,
  },
  orderIdCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderIdLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: '#828282',
  },
  orderIdValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    gap: 12,
  },
  reasonOptionSelected: {
    borderColor: '#034703',
    backgroundColor: '#F0FFF0',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D4D4D4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: '#034703',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#034703',
  },
  reasonText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#4C4C4C',
    flex: 1,
  },
  reasonTextSelected: {
    color: '#1A1A1A',
    fontWeight: '500',
  },
  photoUploadButton: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D4D4D4',
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  photoUploadText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#034703',
  },
  photoUploadHint: {
    fontSize: 12,
    fontWeight: '400',
    color: '#828282',
  },
  submitButton: {
    backgroundColor: '#034703',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 20,
  },
});

export default ReturnRequest;
