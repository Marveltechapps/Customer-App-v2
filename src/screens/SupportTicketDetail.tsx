/**
 * Support ticket detail – status, thread, reply, reopen
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import Header from '../components/layout/Header';
import type {
  CustomerSupportStackNavigationProp,
  CustomerSupportStackParamList,
} from '../types/navigation';
import {
  fetchSupportTicketMessages,
  listMySupportTickets,
  reopenSupportTicket,
  sendSupportTicketMessage,
  type SupportTicketMessage,
  type SupportTicketSummary,
} from '../services/support/supportService';

type DetailRoute = RouteProp<CustomerSupportStackParamList, 'SupportTicketDetail'>;

const SupportTicketDetail: React.FC = () => {
  const navigation = useNavigation<CustomerSupportStackNavigationProp>();
  const route = useRoute<DetailRoute>();
  const { ticketId } = route.params;

  const [ticket, setTicket] = useState<SupportTicketSummary | null>(null);
  const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tickets, msgs] = await Promise.all([
        listMySupportTickets(),
        fetchSupportTicketMessages(ticketId),
      ]);
      setTicket(tickets.find((t) => t.id === ticketId) ?? null);
      setMessages(msgs);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const handleSend = async () => {
    const text = reply.trim();
    if (!text) return;
    setSending(true);
    try {
      const ok = await sendSupportTicketMessage(ticketId, text);
      if (ok) {
        setReply('');
        await load();
      } else {
        Alert.alert('Error', 'Could not send message');
      }
    } catch {
      Alert.alert('Error', 'Could not send message');
    } finally {
      setSending(false);
    }
  };

  const handleReopen = () => {
    Alert.alert('Reopen ticket', 'Reopen this ticket so our team can help again?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reopen',
        onPress: async () => {
          const ok = await reopenSupportTicket(ticketId);
          if (ok) await load();
          else Alert.alert('Error', 'Could not reopen ticket');
        },
      },
    ]);
  };

  const canReply = ticket && !['closed'].includes(ticket.status);
  const statusLabel = ticket?.status ? ticket.status.replace(/_/g, ' ') : '';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title={ticket?.ticketNumber || 'Ticket'} onBackPress={() => navigation.goBack()} />
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#175FBE" size="large" />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={80}
        >
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {ticket && (
              <View style={styles.summary}>
                <Text style={styles.subject}>{ticket.subject}</Text>
                <Text style={styles.status}>Status: {statusLabel}</Text>
                {ticket.description ? (
                  <Text style={styles.description}>{ticket.description}</Text>
                ) : null}
                {ticket.canReopen && (
                  <TouchableOpacity style={styles.reopenBtn} onPress={handleReopen}>
                    <Text style={styles.reopenText}>Reopen ticket</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            <Text style={styles.threadTitle}>Conversation</Text>
            {messages.length === 0 ? (
              <Text style={styles.emptyThread}>No messages yet.</Text>
            ) : (
              messages.map((m) => (
                <View
                  key={m.id}
                  style={[styles.bubble, m.sender === 'customer' ? styles.bubbleCustomer : styles.bubbleAgent]}
                >
                  <Text style={styles.bubbleSender}>{m.sender === 'customer' ? 'You' : 'Support'}</Text>
                  <Text style={styles.bubbleText}>{m.text}</Text>
                  <Text style={styles.bubbleTime}>
                    {(m.sender === 'customer' ? 'You' : m.authorName || 'Support')} ·{' '}
                    {new Date(m.timestamp).toLocaleString()}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
          {canReply && (
            <View style={styles.composer}>
              <TextInput
                style={styles.input}
                placeholder="Type a message..."
                placeholderTextColor="#9CA3AF"
                value={reply}
                onChangeText={setReply}
                multiline
              />
              <TouchableOpacity
                style={[styles.sendBtn, sending && styles.sendDisabled]}
                onPress={handleSend}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.sendText}>Send</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  flex: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24 },
  summary: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  subject: { fontSize: 17, fontWeight: '700', color: '#1A1A1A', marginBottom: 6 },
  status: { fontSize: 13, color: '#6B7280', marginBottom: 8, textTransform: 'capitalize' },
  description: { fontSize: 14, color: '#374151', lineHeight: 20 },
  reopenBtn: { marginTop: 12, alignSelf: 'flex-start' },
  reopenText: { color: '#175FBE', fontWeight: '600', fontSize: 14 },
  threadTitle: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', marginBottom: 10 },
  emptyThread: { color: '#6B7280', fontSize: 14 },
  bubble: { borderRadius: 10, padding: 12, marginBottom: 10, maxWidth: '90%' },
  bubbleCustomer: { alignSelf: 'flex-end', backgroundColor: '#EEF2FF' },
  bubbleAgent: { alignSelf: 'flex-start', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E7EB' },
  bubbleSender: { fontSize: 11, fontWeight: '600', color: '#6B7280', marginBottom: 4 },
  bubbleText: { fontSize: 14, color: '#1A1A1A' },
  bubbleTime: { fontSize: 11, color: '#6B7280', marginTop: 6 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sendBtn: {
    backgroundColor: '#175FBE',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.7 },
  sendText: { color: '#FFF', fontWeight: '600' },
});

export default SupportTicketDetail;
