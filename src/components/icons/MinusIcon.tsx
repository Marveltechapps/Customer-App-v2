import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface MinusIconProps {
  width?: number;
  height?: number;
  color?: string;
}

export default function MinusIcon({ 
  width = 20, 
  height = 20, 
  color = '#FFFFFF' 
}: MinusIconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 20 20" fill="none">
      <Path
        d="M4.16699 10H15.8337"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}



