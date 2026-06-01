/**
 * Contact Support Screen
 * Submit a support ticket from the customer app
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Header from '../components/layout/Header';
import { createSupportTicket } from '../services/support/supportService';

const CATEGORIES = [
  'General Inquiry',
  'Order / Products',
  'Shipping & Delivery',
  'Payment Related',
  'Returns & Exchanges',
  'Other',
];

const ContactSupport: React.FC = () => {
  const navigation = useNavigation();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!subject.trim() || !name.trim() || !email.trim()) {
      Alert.alert('Missing fields', 'Please fill in subject, name, and email.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await createSupportTicket({
        subject: subject.trim(),
        description: description.trim() || subject.trim(),
        category: mapCategoryToApi(category),
        customerName: name.trim(),
        customerEmail: email.trim(),
      });

      setSubmitting(false);
      if (result.success) {
        Alert.alert(
          'Ticket submitted',
          `Your ticket ${result.data?.ticketNumber || ''} has been submitted. We'll get back to you soon.`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        setSubject('');
        setDescription('');
        setCategory('');
      } else {
        Alert.alert('Error', result.error || 'Failed to submit ticket');
      }
    } catch (e) {
      setSubmitting(false);
      Alert.alert('Error', 'Failed to submit ticket. Please try again.');
    }
  };

  const mapCategoryToApi = (c: string): string => {
    const map: Record<string, string> = {
      'General Inquiry': 'account',
      'Order / Products': 'order',
      'Shipping & Delivery': 'delivery',
      'Payment Related': 'payment',
      'Returns & Exchanges': 'order',
      'Other': 'technical',
    };
    return map[c] || 'order';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Contact Support" onBackPress={() => navigation.goBack()} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>Subject *</Text>
        <TextInput
          style={styles.input}
          placeholder="Brief summary of your issue"
          placeholderTextColor="#9CA3AF"
          value={subject}
          onChangeText={setSubject}
          maxLength={100}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe your issue in detail..."
          placeholderTextColor="#9CA3AF"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={5}
          maxLength={500}
        />

        <Text style={styles.label}>Category</Text>
        <View style={styles.categoryRow}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.chip, category === c && styles.chipActive]}
              onPress={() => setCategory(c)}
            >
              <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Your Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="Full name"
          placeholderTextColor="#9CA3AF"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Email *</Text>
        <TextInput
          style={styles.input}
          placeholder="your@email.com"
          placeholderTextColor="#9CA3AF"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Text style={styles.submitBtnText}>Submit ticket</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  textArea: { height: 100, textAlignVertical: 'top' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipActive: { backgroundColor: '#EEF2FF', borderColor: '#175FBE' },
  chipText: { fontSize: 13, color: '#6B7280' },
  chipTextActive: { color: '#175FBE', fontWeight: '600' },
  submitBtn: {
    marginTop: 24,
    backgroundColor: '#175FBE',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});

export default ContactSupport;
