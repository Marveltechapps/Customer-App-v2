import React from 'react';
import { Text as RNText, StyleSheet, TextStyle, TextProps } from 'react-native';
import { Theme } from '../../constants/Theme';

interface CustomTextProps extends TextProps {
  variant?: 'h1' | 'h2' | 'h3' | 'body' | 'bodySmall' | 'caption';
  color?: string;
  style?: TextStyle;
}

export default function Text({
  variant = 'body',
  color,
  style,
  children,
  ...props
}: CustomTextProps) {
  const textStyle = [
    styles.base,
    styles[variant],
    color && { color },
    style,
  ];

  return (
    <RNText style={textStyle} {...props}>
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  base: {
    color: Theme.colors.text,
  },
  h1: Theme.typography.h1,
  h2: Theme.typography.h2,
  h3: Theme.typography.h3,
  body: Theme.typography.body,
  bodySmall: Theme.typography.bodySmall,
  caption: Theme.typography.caption,
});

