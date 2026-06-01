import React from 'react';
import { View, StyleSheet } from 'react-native';
import GPayAsset from '@/assets/images/payment/gpay-logo.svg';
import PhonePeAsset from '@/assets/images/payment/phonepe-logo.svg';
import PaytmAsset from '@/assets/images/payment/paytm-logo.svg';
import BhimAsset from '@/assets/images/payment/bhim-logo.svg';
import UpiAsset from '@/assets/images/payment/upi-logo.svg';

type Props = { size?: number };

function LogoBadge({
  size = 36,
  children,
}: Props & { children: React.ReactNode }) {
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2 }]}>
      {children}
    </View>
  );
}

export function GPayLogo({ size = 36 }: Props) {
  return (
    <LogoBadge size={size}>
      <GPayAsset width={Math.round(size * 0.74)} height={Math.round(size * 0.74)} />
    </LogoBadge>
  );
}

export function PhonePeLogo({ size = 36 }: Props) {
  return (
    <LogoBadge size={size}>
      <PhonePeAsset width={Math.round(size * 0.78)} height={Math.round(size * 0.78)} />
    </LogoBadge>
  );
}

export function PaytmLogo({ size = 36 }: Props) {
  return (
    <LogoBadge size={size}>
      <PaytmAsset width={Math.round(size * 0.8)} height={Math.round(size * 0.8)} />
    </LogoBadge>
  );
}

export function BhimLogo({ size = 36 }: Props) {
  return (
    <LogoBadge size={size}>
      <BhimAsset width={Math.round(size * 0.8)} height={Math.round(size * 0.8)} />
    </LogoBadge>
  );
}

export function UpiGenericLogo({ size = 36 }: Props) {
  return (
    <LogoBadge size={size}>
      <UpiAsset width={Math.round(size * 0.8)} height={Math.round(size * 0.8)} />
    </LogoBadge>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

