import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface ChevronRightIconProps {
  width?: number;
  height?: number;
  color?: string;
}

export default function ChevronRightIcon({ 
  width = 16, 
  height = 16, 
  color = '#4C4C4C' 
}: ChevronRightIconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 20 20" fill="none">
      <Path
        d="M7.5 15L12.5 10L7.5 5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

