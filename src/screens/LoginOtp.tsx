import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { sendOtp, verifyOtp, resendOtp } from '../services/auth/authService';
import { tokenManager } from '../services/api/tokenManager';
import { getApiErrorMessage } from '../services/api/types';
import { useNavigation } from '@react-navigation/native';

export default function LoginOtp() {
  const navigation = useNavigation();
  const [phone, setPhone] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSend = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const resp = await sendOtp(phone);
      if (resp && resp.data?.sessionId) {
        setSessionId(resp.data.sessionId);
        setMessage('OTP sent. Check your messages.');
      } else {
        setMessage('Failed to send OTP');
      }
    } catch (e) {
      setMessage(getApiErrorMessage(e, 'Error sending OTP'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!sessionId) {
      setMessage('No session. Send OTP first.');
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const resp = await verifyOtp(sessionId, otp);
      if (resp && resp.data && resp.data.accessToken) {
        // tokens saved by authService -> tokenManager
        (navigation as any).replace('MainTabs');
      } else {
        setMessage('Invalid OTP or verification failed.');
      }
    } catch (e) {
      setMessage(getApiErrorMessage(e, 'Error verifying OTP.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      await resendOtp(sessionId);
      setMessage('OTP resent.');
    } catch (e) {
      setMessage(getApiErrorMessage(e, 'Resend failed.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login / OTP</Text>
      {!sessionId ? (
        <>
          <TextInput style={styles.input} placeholder="+919012345678" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <TouchableOpacity style={styles.button} onPress={handleSend} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send OTP</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TextInput style={styles.input} placeholder="Enter OTP" value={otp} onChangeText={setOtp} keyboardType="number-pad" />
          <TouchableOpacity style={styles.button} onPress={handleVerify} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Verify</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.link} onPress={handleResend} disabled={loading}>
            <Text style={styles.linkText}>Resend OTP</Text>
          </TouchableOpacity>
        </>
      )}
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, marginBottom: 12 },
  button: { backgroundColor: '#034703', padding: 12, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600' },
  link: { marginTop: 8, alignItems: 'center' },
  linkText: { color: '#034703' },
  message: { marginTop: 12, color: '#666', textAlign: 'center' },
});

