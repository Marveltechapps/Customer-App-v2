import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function Divider() {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(121, 121, 121, 1)', 'rgba(245, 245, 245, 1)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: 1,
    justifyContent: 'center',
  },
  gradient: {
    width: '100%',
    height: 1,
  },
});

