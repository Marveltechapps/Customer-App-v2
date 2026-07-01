import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface VerificationCheckIconProps {
  width?: number;
  height?: number;
  color?: string;
}

export default function VerificationCheckIcon({ 
  width = 28, 
  height = 28, 
  color = '#034703' 
}: VerificationCheckIconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 28 28" fill="none">
      <Path
        d="M5.5 14L10.5 19L22.5 7"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

