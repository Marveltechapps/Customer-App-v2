import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Theme } from '../constants/Theme';

interface LogoutButtonProps {
  onPress: () => void;
}

export default function LogoutButton({ onPress }: LogoutButtonProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.button}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Text style={styles.text}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: Theme.colors.primary,
    borderRadius: 4,
    // Inset shadow effect
    shadowColor: '#011501',
    shadowOffset: {
      width: 3,
      height: 3,
    },
    shadowOpacity: 0.31,
    shadowRadius: 4,
    elevation: 3,
  },
  button: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
  },
  text: {
    ...Theme.typography.body,
    color: Theme.colors.primary,
    textAlign: 'center',
  },
});

