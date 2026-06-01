import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface CloseIconProps {
  width?: number;
  height?: number;
  color?: string;
}

export default function CloseIcon({ 
  width = 24, 
  height = 24, 
  color = '#4C4C4C' 
}: CloseIconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 6L6 18M6 6L18 18"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

