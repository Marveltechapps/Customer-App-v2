import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch } from 'react-native';

interface NotificationItemProps {
  title: string;
  description: string;
  enabled: boolean;
  onToggle?: (enabled: boolean) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  title,
  description,
  enabled,
  onToggle,
}) => {
  const handleToggle = (value: boolean) => {
    if (onToggle) {
      onToggle(value);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.contentRow}>
        <View style={styles.textContainer}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={handleToggle}
          trackColor={{ false: '#8E8B8B', true: '#3F723F' }}
          thumbColor="#FFFFFF"
          ios_backgroundColor="#8E8B8B"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  contentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    gap: 4,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 20, // 1.4285714285714286em = ~20px
    color: '#1A1A1A',
    textAlign: 'left',
    marginBottom: 0,
  },
  description: {
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 20, // 1.6666666666666667em = ~20px
    color: '#4C4C4C',
    textAlign: 'left',
    marginTop: 0,
  },
});

export default NotificationItem;

