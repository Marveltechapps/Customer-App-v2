import React, { useState, useRef, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../layout/Header';
import { api } from '../../../services/api/client';
import { endpoints } from '../../../services/api/endpoints';
import { logger } from '@/utils/logger';
import {
  fetchSupportChatMessages,
  getOrCreateLiveChatTicket,
  normalizeChatMessages,
  SUPPORT_CHAT_WELCOME,
  type SupportChatMessage,
} from '@/utils/supportChat';

export interface LiveChatTicketConfig {
  subject: string;
  type: 'general_inquiry' | 'order_issue';
  orderNumber?: string;
}

interface SupportLiveChatProps {
  headerTitle: string;
  ticket: LiveChatTicketConfig;
}

const formatTime = (ts: string): string => {
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    const h = d.getHours() % 12 || 12;
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h}:${m} ${d.getHours() >= 12 ? 'PM' : 'AM'}`;
  } catch {
    return '';
  }
};

const SupportLiveChat: React.FC<SupportLiveChatProps> = ({ headerTitle, ticket }) => {
  const [messages, setMessages] = useState<SupportChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const ensureTicket = useCallback(async () => {
    return getOrCreateLiveChatTicket({
      subject: ticket.subject,
      type: ticket.type,
      orderNumber: ticket.orderNumber,
    });
  }, [ticket.subject, ticket.type, ticket.orderNumber]);

  const fetchMessages = useCallback(
    async (tid: string) => {
      try {
        const msgs = await fetchSupportChatMessages(tid);
        setMessages(normalizeChatMessages(msgs, { subject: ticket.subject }));
      } catch (err) {
        logger.error('Error fetching messages', err);
      }
    },
    [ticket.subject],
  );

  const startChat = useCallback(async () => {
    setLoading(true);
    setInitError(null);
    const tid = await ensureTicket();
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (tid) {
      setTicketId(tid);
      await fetchMessages(tid);
      pollRef.current = setInterval(() => fetchMessages(tid), 5000);
    } else {
      setInitError('Could not start chat. Check your connection and try again.');
    }
    setLoading(false);
  }, [ensureTicket, fetchMessages]);

  useFocusEffect(
    useCallback(() => {
      void startChat();
      return () => {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      };
    }, [startChat]),
  );

  const displayMessages = useMemo(() => {
    if (messages.length > 0) return messages;
    if (!loading && ticketId && !initError) return [SUPPORT_CHAT_WELCOME];
    return messages;
  }, [messages, loading, ticketId, initError]);

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;
    const text = inputText.trim();
    setInputText('');
    setSendError(null);

    const tempMsg: SupportChatMessage = {
      id: `temp-${Date.now()}`,
      text,
      sender: 'customer',
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    let tid = ticketId;
    if (!tid) {
      tid = await ensureTicket();
      if (!tid) {
        setInitError('Could not send message. Please try again.');
        setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
        return;
      }
      setTicketId(tid);
    }

    setSending(true);
    try {
      await api.post(endpoints.support.sendMessage(tid), { message: text });
      await fetchMessages(tid);
    } catch (err) {
      logger.error('Error sending message', err);
      setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
      setSendError('Message failed to send. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: SupportChatMessage }) => {
    const isCustomer = item.sender === 'customer';
    return (
      <View style={[styles.messageBubbleRow, isCustomer ? styles.customerRow : styles.agentRow]}>
        {!isCustomer && <Text style={styles.agentLabel}>Support</Text>}
        <View style={[styles.messageBubble, isCustomer ? styles.customerBubble : styles.agentBubble]}>
          <Text style={[styles.messageText, isCustomer ? styles.customerText : styles.agentText]}>
            {item.text}
          </Text>
          {item.id !== SUPPORT_CHAT_WELCOME.id && (
            <Text style={[styles.messageTime, isCustomer ? styles.customerTime : styles.agentTime]}>
              {formatTime(item.timestamp)}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Header title={headerTitle} />

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#034703" />
            <Text style={styles.loadingText}>Connecting to support...</Text>
          </View>
        ) : initError && messages.length === 0 ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{initError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={startChat} activeOpacity={0.7}>
              <Text style={styles.retryButtonText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {sendError ? (
              <View style={styles.sendErrorBanner}>
                <Text style={styles.sendErrorText}>{sendError}</Text>
              </View>
            ) : null}
            <FlatList
              ref={flatListRef}
              data={displayMessages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.messagesList}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            />
          </>
        )}

        {!loading && (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type a message..."
              placeholderTextColor="#828282"
              multiline
              maxLength={500}
              editable={!initError || Boolean(ticketId)}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!inputText.trim() || sending}
              activeOpacity={0.7}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.sendButtonText}>Send</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  chatContainer: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: '#828282' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 },
  errorText: { fontSize: 14, color: '#828282', textAlign: 'center' },
  retryButton: {
    backgroundColor: '#034703',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  sendErrorBanner: {
    backgroundColor: '#FFF3F3',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE0E0',
  },
  sendErrorText: { fontSize: 13, color: '#C62828', textAlign: 'center' },
  messagesList: { padding: 16, paddingBottom: 8, flexGrow: 1 },
  messageBubbleRow: { marginBottom: 12 },
  customerRow: { alignItems: 'flex-end' },
  agentRow: { alignItems: 'flex-start' },
  agentLabel: { fontSize: 11, color: '#828282', marginBottom: 4, marginLeft: 4 },
  messageBubble: { maxWidth: '85%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  customerBubble: { backgroundColor: '#034703', borderBottomRightRadius: 4 },
  agentBubble: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#E8E8E8' },
  messageText: { fontSize: 14, lineHeight: 20 },
  customerText: { color: '#FFFFFF' },
  agentText: { color: '#1A1A1A' },
  messageTime: { fontSize: 10, marginTop: 4 },
  customerTime: { color: 'rgba(255,255,255,0.7)', textAlign: 'right' },
  agentTime: { color: '#828282' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F4F4F4',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
    color: '#1A1A1A',
  },
  sendButton: {
    backgroundColor: '#034703',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 72,
  },
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});

export default SupportLiveChat;
